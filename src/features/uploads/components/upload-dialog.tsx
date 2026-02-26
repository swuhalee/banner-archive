"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import RouteDialog from "@/components/ui/route-dialog";
import RegionSelector from "./region-selector";
import {
  useAnalyzeBanner,
  bannerKeys,
  commitBannerWithProgress,
} from "@/features/banners";
import type { BBox, PrivacyRegion, RejectedDuplicate, UploadCandidate } from "@/features/uploads/types/upload";
import {
  getUploadFileValidationError,
  toFriendlyAnalyzeErrorMessage,
} from "@/features/uploads/utils/upload-validation";
import { convertToWebP } from "@/features/uploads/utils/convert-to-webp";
import { uploadSourceForAnalysis } from "@/features/uploads/utils/source-upload";
import { BANNER_SUBJECT_TYPES, type BannerSubjectType } from "@/lib/constants";

// ─── 타입 ────────────────────────────────────────────────────────────────────

type EditableCandidate = {
  tempId: string;
  title: string;
  hashtagsText: string; // 쉼표 구분 편집용
  subjectType: string;
  bbox: BBox;
  confidence: number;
  excluded: boolean;
};

type Step = "form" | "analyzing" | "review" | "committing" | "done";

type UploadState = {
  // 폼
  previewUrl: string | null;
  selectedFile: File | null;
  regionText: string;
  observedAt: string;
  subjectType: BannerSubjectType | "";
  confirmed1: boolean;
  confirmed2: boolean;
  // 분석 결과
  uploadSourceId: string;
  candidates: EditableCandidate[];
  privacyRegions: PrivacyRegion[];
  faceCount: number;
  plateCount: number;
  // UI 상태
  step: Step;
  errorMessage: string | null;
  analyzeProgress: number;
  commitProgress: number;
  // 저장 결과
  savedCount: number;
  rejectedDuplicates: RejectedDuplicate[];
};

type UploadAction =
  | { type: "FILE_SELECTED"; file: File; previewUrl: string }
  | { type: "FILE_ERROR"; message: string }
  | { type: "FORM_FIELD_CHANGED"; field: "regionText" | "observedAt"; value: string }
  | { type: "SUBJECT_TYPE_CHANGED"; value: BannerSubjectType | "" }
  | { type: "CONFIRM_CHANGED"; field: "confirmed1" | "confirmed2"; value: boolean }
  | { type: "ANALYZE_START" }
  | { type: "ANALYZE_PROGRESS"; value: number }
  | { type: "ANALYZE_SUCCESS"; uploadSourceId: string; candidates: EditableCandidate[]; privacyRegions: PrivacyRegion[]; faceCount: number; plateCount: number }
  | { type: "ANALYZE_ERROR"; message: string }
  | { type: "COMMIT_START" }
  | { type: "COMMIT_PROGRESS"; value: number }
  | { type: "COMMIT_SUCCESS"; savedCount: number; rejectedDuplicates: RejectedDuplicate[] }
  | { type: "COMMIT_ERROR"; message: string }
  | { type: "UPDATE_CANDIDATE"; tempId: string; patch: Partial<EditableCandidate> }
  | { type: "RESET" };

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function makeInitialState(): UploadState {
  return {
    previewUrl: null,
    selectedFile: null,
    regionText: "",
    observedAt: new Date().toISOString().slice(0, 10),
    subjectType: "",
    confirmed1: false,
    confirmed2: false,
    uploadSourceId: "",
    candidates: [],
    privacyRegions: [],
    faceCount: 0,
    plateCount: 0,
    step: "form",
    errorMessage: null,
    analyzeProgress: 0,
    commitProgress: 0,
    savedCount: 0,
    rejectedDuplicates: [],
  };
}

function toEditable(c: UploadCandidate): EditableCandidate {
  return {
    tempId: c.tempId,
    title: c.title ?? "",
    hashtagsText: c.hashtags.join(", "),
    subjectType: c.subjectType ?? "",
    bbox: c.bbox,
    confidence: c.confidence,
    excluded: false,
  };
}

// ─── 리듀서 ──────────────────────────────────────────────────────────────────

function reducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "FILE_SELECTED":
      return { ...state, selectedFile: action.file, previewUrl: action.previewUrl, errorMessage: null };

    case "FILE_ERROR":
      return { ...state, errorMessage: action.message };

    case "FORM_FIELD_CHANGED":
      return { ...state, [action.field]: action.value };

    case "SUBJECT_TYPE_CHANGED":
      return { ...state, subjectType: action.value };

    case "CONFIRM_CHANGED":
      return { ...state, [action.field]: action.value };

    case "ANALYZE_START":
      return { ...state, step: "analyzing", analyzeProgress: 0, errorMessage: null };

    case "ANALYZE_PROGRESS":
      return { ...state, analyzeProgress: action.value };

    case "ANALYZE_SUCCESS":
      return {
        ...state,
        step: "review",
        uploadSourceId: action.uploadSourceId,
        candidates: action.candidates,
        privacyRegions: action.privacyRegions,
        faceCount: action.faceCount,
        plateCount: action.plateCount,
      };

    case "ANALYZE_ERROR":
      return { ...state, step: "form", errorMessage: action.message };

    case "COMMIT_START":
      return { ...state, step: "committing", commitProgress: 0, errorMessage: null };

    case "COMMIT_PROGRESS":
      return { ...state, commitProgress: action.value };

    case "COMMIT_SUCCESS":
      return { ...state, step: "done", savedCount: action.savedCount, rejectedDuplicates: action.rejectedDuplicates };

    case "COMMIT_ERROR":
      return { ...state, step: "review", errorMessage: action.message };

    case "UPDATE_CANDIDATE":
      return {
        ...state,
        candidates: state.candidates.map((c) =>
          c.tempId === action.tempId ? { ...c, ...action.patch } : c
        ),
      };

    case "RESET":
      return makeInitialState();
  }
}

// ─── 단계별 컴포넌트 ──────────────────────────────────────────────────────────

type DoneStepProps = {
  savedCount: number;
  rejectedDuplicates: RejectedDuplicate[];
  privacyRegions: PrivacyRegion[];
};

function DoneStep({ savedCount, rejectedDuplicates, privacyRegions }: DoneStepProps) {
  return (
    <div className="grid gap-4 p-8 text-center">
      {savedCount > 0 ? (
        <>
          <p className="font-bold">{savedCount}개의 현수막 기록이 완료되었습니다.</p>
          <p className="text-[13px] text-(--text-muted)">
            각 현수막이 개별 아카이브에 추가되었습니다.
          </p>
          {privacyRegions.length > 0 && (
            <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-[12px] font-semibold text-green-700">
              <span>✓</span>
              개인정보 마스킹 적용됨
            </span>
          )}
        </>
      ) : (
        <p className="font-bold text-(--text-muted)">저장된 현수막이 없습니다.</p>
      )}
      {rejectedDuplicates.length > 0 && (
        <div className="mt-2 grid gap-2 text-left">
          {rejectedDuplicates.map((r) => (
            <p key={r.tempId} className="rounded-lg bg-(--surface-alt) px-3 py-2 text-[12px] text-(--text-muted)">
              기존 등록 현수막과 {r.similarityScore}% 일치하여 중복 업로드로 저장되지 않았습니다.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

type LoadingStepProps = {
  step: "analyzing" | "committing";
  progress: number;
  previewUrl: string | null;
};

function LoadingStep({ step, progress, previewUrl }: LoadingStepProps) {
  return (
    <div className="grid gap-3 p-8 text-center">
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="미리보기"
          className="mx-auto max-h-60 rounded-lg object-contain opacity-60"
        />
      )}
      <p className="font-bold">
        {step === "analyzing" ? "현수막을 감지하고 있습니다" : "저장 중"}
      </p>
      <div className="mx-auto w-full max-w-65">
        <div className="mb-1.5 flex items-center justify-between text-[12px] text-(--text-muted)">
          <span className="font-semibold tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--line)">
          <div
            className="h-full rounded-full bg-(--accent) transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type ReviewStepProps = {
  candidates: EditableCandidate[];
  previewUrl: string | null;
  privacyRegions: PrivacyRegion[];
  faceCount: number;
  plateCount: number;
  errorMessage: string | null;
  activeCount: number;
  onUpdateCandidate: (tempId: string, patch: Partial<EditableCandidate>) => void;
  onReset: () => void;
  onCommit: () => void;
};

function ReviewStep({
  candidates,
  previewUrl,
  privacyRegions,
  faceCount,
  plateCount,
  errorMessage,
  activeCount,
  onUpdateCandidate,
  onReset,
  onCommit,
}: ReviewStepProps) {
  return (
    <div className="grid gap-4">
      {/* 이미지 + bbox 오버레이 */}
      <div className="relative w-full overflow-hidden rounded-xl border border-(--line)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl!} alt="원본 사진" className="block w-full" />
        {candidates.map((c, i) => (
          <div
            key={c.tempId}
            className="pointer-events-none absolute"
            style={{
              left: `${c.bbox.x * 100}%`,
              top: `${c.bbox.y * 100}%`,
              width: `${c.bbox.width * 100}%`,
              height: `${c.bbox.height * 100}%`,
              border: `2px solid ${c.excluded ? "var(--accent-muted)" : "var(--accent)"}`,
              opacity: c.excluded ? 0.4 : 1,
            }}
          >
            <span
              className="absolute left-0 top-0 px-1 text-[11px] font-bold text-white"
              style={{ background: c.excluded ? "var(--accent-muted)" : "var(--accent)" }}
            >
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* 후보 카드 목록 */}
      <div className="grid gap-3">
        {candidates.map((c, i) => (
          <div
            key={c.tempId}
            className="grid gap-2 rounded-xl border border-(--line) p-3"
            style={{ opacity: c.excluded ? 0.5 : 1 }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: c.excluded ? "var(--accent-muted)" : "var(--accent)" }}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-[13px] font-semibold">현수막 {i + 1}</span>
              <label className="flex cursor-pointer items-center gap-1 text-[12px] text-(--text-muted)">
                <input
                  type="checkbox"
                  className="m-0 h-3.25 w-3.25"
                  checked={c.excluded}
                  onChange={(e) => onUpdateCandidate(c.tempId, { excluded: e.target.checked })}
                />
                제외
              </label>
            </div>

            <label className="grid gap-1 text-[12px] font-semibold text-(--text-muted)">
              제목 / 슬로건
              <input
                type="text"
                placeholder="현수막 핵심 문구"
                value={c.title}
                disabled={c.excluded}
                onChange={(e) => onUpdateCandidate(c.tempId, { title: e.target.value })}
              />
            </label>

            <label className="grid gap-1 text-[12px] font-semibold text-(--text-muted)">
              해시태그 (쉼표로 구분)
              <input
                type="text"
                placeholder="키워드1, 키워드2"
                value={c.hashtagsText}
                disabled={c.excluded}
                onChange={(e) => onUpdateCandidate(c.tempId, { hashtagsText: e.target.value })}
              />
            </label>

            <label className="grid gap-1 text-[12px] font-semibold text-(--text-muted)">
              주체 유형
              <select
                value={c.subjectType}
                disabled={c.excluded}
                onChange={(e) => onUpdateCandidate(c.tempId, { subjectType: e.target.value })}
              >
                <option value="">선택하세요</option>
                {BANNER_SUBJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>

      {privacyRegions.length > 0 && (
        <div className="rounded-[10px] bg-amber-50 px-3 py-2.5 text-[12px] text-amber-700">
          <span className="font-semibold">개인정보 감지됨</span>
          {" — "}
          {[
            faceCount > 0 && `얼굴 ${faceCount}개`,
            plateCount > 0 && `번호판 ${plateCount}개`,
          ]
            .filter(Boolean)
            .join(", ")}
          {" 저장 시 자동 마스킹 처리됩니다."}
        </div>
      )}

      {errorMessage && (
        <p className="text-[13px] text-red-500">{errorMessage}</p>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost flex-1 text-[13px]" onClick={onReset}>
          처음으로
        </button>
        <button
          type="button"
          className="btn btn-solid flex-1 text-[13px]"
          disabled={activeCount === 0}
          onClick={onCommit}
        >
          {activeCount}개 저장하기
        </button>
      </div>
    </div>
  );
}

type FormStepProps = {
  previewUrl: string | null;
  regionText: string;
  observedAt: string;
  subjectType: BannerSubjectType | "";
  confirmed1: boolean;
  confirmed2: boolean;
  errorMessage: string | null;
  canAnalyze: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onFieldChange: (field: "regionText" | "observedAt", value: string) => void;
  onSubjectTypeChange: (value: BannerSubjectType | "") => void;
  onConfirmChange: (field: "confirmed1" | "confirmed2", value: boolean) => void;
  onAnalyze: () => void;
};

function FormStep({
  previewUrl,
  regionText,
  observedAt,
  subjectType,
  confirmed1,
  confirmed2,
  errorMessage,
  canAnalyze,
  fileInputRef,
  onFileSelect,
  onDrop,
  onFieldChange,
  onSubjectTypeChange,
  onConfirmChange,
  onAnalyze,
}: FormStepProps) {
  return (
    <div className="grid grid-cols-2 gap-4 max-[1024px]:grid-cols-1">
      {/* 이미지 업로드 영역 */}
      <article className="rounded-2xl border border-(--line) bg-(--surface) p-4">
        <div
          className="mt-2 grid min-h-60 place-items-center rounded-xl border border-dashed border-(--line-strong) bg-(--surface-alt) text-(--text-muted) cursor-pointer overflow-hidden"
          onClick={() => fileInputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="미리보기" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[13px]">드래그 앤 드롭 또는 파일 선택</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
        />
        <p className="mt-2 text-[13px] text-(--text-muted)">GIF 제외 이미지 · 최대 20MB</p>
      </article>

      {/* 정보 입력 폼 */}
      <form
        className="grid gap-3 bg-(--surface) p-4"
        aria-label="업로드 폼"
        onSubmit={(e) => { e.preventDefault(); if (canAnalyze) onAnalyze(); }}
      >
        <h2 className="mb-1 font-bold">정보 입력</h2>

        <div className="grid gap-1.5 text-[13px] font-semibold text-(--text-muted)">
          위치
          <RegionSelector
            value={regionText}
            onChange={(value) => onFieldChange("regionText", value)}
          />
        </div>

        <label className="grid gap-1.5 text-[13px] font-semibold text-(--text-muted)">
          관측일
          <input
            type="date"
            value={observedAt}
            onChange={(e) => onFieldChange("observedAt", e.target.value)}
          />
        </label>

        <label className="grid gap-1.5 text-[13px] font-semibold text-(--text-muted)">
          주체 유형
          <select
            value={subjectType}
            onChange={(e) => onSubjectTypeChange(e.target.value as BannerSubjectType | "")}
          >
            <option value="" disabled>선택하세요</option>
            {BANNER_SUBJECT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>

        <label className="pt-2 flex items-center gap-1.5 text-[13px] leading-none text-(--text-muted)">
          <input
            type="checkbox"
            className="m-0 h-3.5 w-3.5"
            checked={confirmed1}
            onChange={(e) => onConfirmChange("confirmed1", e.target.checked)}
          />
          사진을 촬영한 실제 위치와 날짜 정보가 정확합니다.
        </label>

        <label className="pb-4 flex items-center gap-1.5 text-[13px] leading-none text-(--text-muted)">
          <input
            type="checkbox"
            className="m-0 h-3.5 w-3.5"
            checked={confirmed2}
            onChange={(e) => onConfirmChange("confirmed2", e.target.checked)}
          />
          직접 촬영한 사진이며, 본 아카이브 서비스의 기록 목적으로 활용됨에 동의합니다.
        </label>

        {errorMessage && (
          <p className="text-[13px] text-red-500">{errorMessage}</p>
        )}

        <button type="submit" className="btn btn-solid" disabled={!canAnalyze}>
          현수막 분석 시작
        </button>
      </form>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

type UploadDialogProps = {
  closeHref?: string;
  asModal?: boolean;
};

export default function UploadDialog({ closeHref = "/", asModal = true }: UploadDialogProps) {
  const queryClient = useQueryClient();
  const analyzeMutation = useAnalyzeBanner();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [state, dispatch] = useReducer(reducer, null, makeInitialState);
  // analyzeTimerActive가 true인 동안 exponential 진행률 타이머 실행
  const [analyzeTimerActive, setAnalyzeTimerActive] = useState(false);

  // previewUrl이 교체되거나 컴포넌트가 언마운트될 때 이전 Object URL 해제
  useEffect(() => {
    return () => {
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    };
  }, [state.previewUrl]);

  // 분석 대기 중 진행률 애니메이션 (45% → 89%, 지수 접근)
  // useEffect cleanup으로 타이머 생명주기를 자동 관리 → 누락 위험 없음
  useEffect(() => {
    if (!analyzeTimerActive) return;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += 200;
      const fromAnalysis = Math.round(45 * (1 - Math.exp(-elapsed / 12000)));
      dispatch({ type: "ANALYZE_PROGRESS", value: Math.min(89, 45 + fromAnalysis) });
    }, 200);
    return () => clearInterval(id);
  }, [analyzeTimerActive]);

  // ── 파일 선택 ──

  async function handleFileSelect(file: File) {
    const validationError = getUploadFileValidationError(file);
    if (validationError) {
      dispatch({ type: "FILE_ERROR", message: validationError });
      return;
    }

    let webpFile: File;
    try {
      webpFile = await convertToWebP(file);
    } catch (error) {
      dispatch({
        type: "FILE_ERROR",
        message: error instanceof Error ? error.message : "이미지 변환에 실패했습니다.",
      });
      return;
    }

    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    dispatch({ type: "FILE_SELECTED", file: webpFile, previewUrl: URL.createObjectURL(webpFile) });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  }

  // ── 전체 초기화 ──

  function handleReset() {
    setAnalyzeTimerActive(false);
    analyzeMutation.reset();
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    dispatch({ type: "RESET" });
  }

  // ── 분석 요청 ──

  async function handleAnalyze() {
    if (!state.selectedFile || !state.regionText || !state.observedAt) return;

    dispatch({ type: "ANALYZE_START" });

    let sourcePath: string;
    try {
      const result = await uploadSourceForAnalysis(state.selectedFile, (uploadPercent) => {
        dispatch({ type: "ANALYZE_PROGRESS", value: Math.min(45, Math.round(uploadPercent * 0.45)) });
      });
      sourcePath = result.sourcePath;
    } catch (err) {
      dispatch({
        type: "ANALYZE_ERROR",
        message: err instanceof Error ? err.message : "원본 업로드에 실패했습니다",
      });
      return;
    }

    dispatch({ type: "ANALYZE_PROGRESS", value: 45 });
    setAnalyzeTimerActive(true);

    const formData = new FormData();
    formData.append("sourcePath", sourcePath);
    formData.append("regionText", state.regionText);
    formData.append("observedAt", state.observedAt);
    if (state.subjectType) formData.append("subjectType", state.subjectType);

    analyzeMutation.mutate(formData, {
      onSuccess: (data) => {
        setAnalyzeTimerActive(false);

        if (data.candidates.length === 0) {
          dispatch({
            type: "ANALYZE_ERROR",
            message: "현수막을 인식할 수 없습니다. 다른 사진을 업로드해주세요.",
          });
          return;
        }

        dispatch({ type: "ANALYZE_PROGRESS", value: 100 });
        setTimeout(() => {
          dispatch({
            type: "ANALYZE_SUCCESS",
            uploadSourceId: data.uploadSourceId,
            candidates: data.candidates.map(toEditable),
            privacyRegions: data.privacyRegions,
            faceCount: data.privacyRegions.filter((r) => r.type === "face").length,
            plateCount: data.privacyRegions.filter((r) => r.type === "licensePlate").length,
          });
        }, 300);
      },
      onError: (err) => {
        setAnalyzeTimerActive(false);
        dispatch({ type: "ANALYZE_ERROR", message: toFriendlyAnalyzeErrorMessage(err) });
      },
    });
  }

  // ── 저장 요청 ──

  async function handleCommit() {
    const selected = state.candidates.filter((c) => !c.excluded);
    if (selected.length === 0) return;

    const selectedCandidates = selected.map((c) => ({
      tempId: c.tempId,
      title: c.title.trim() || null,
      hashtags: c.hashtagsText.split(",").map((h) => h.trim()).filter(Boolean),
      subjectType: c.subjectType || null,
      bbox: c.bbox,
      confidence: c.confidence,
    }));

    dispatch({ type: "COMMIT_START" });

    try {
      const data = await commitBannerWithProgress(
        { uploadSourceId: state.uploadSourceId, selectedCandidates },
        (percent) => dispatch({ type: "COMMIT_PROGRESS", value: percent }),
      );
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() });
      dispatch({ type: "COMMIT_SUCCESS", savedCount: data.savedCount, rejectedDuplicates: data.rejectedDuplicates });
    } catch (err) {
      dispatch({
        type: "COMMIT_ERROR",
        message: err instanceof Error ? err.message : "저장에 실패했습니다",
      });
    }
  }

  // ── 파생 값 ──

  const canAnalyze = Boolean(
    state.selectedFile && state.regionText && state.observedAt && state.confirmed1 && state.confirmed2
  );
  const activeCount = state.candidates.filter((c) => !c.excluded).length;
  const currentProgress = state.step === "analyzing" ? state.analyzeProgress : state.commitProgress;

  // ── 렌더링 ──

  const content = (
    <section className="upload-modal rounded-3xl bg-(--surface) p-4">
      {state.step === "done" && (
        <DoneStep
          savedCount={state.savedCount}
          rejectedDuplicates={state.rejectedDuplicates}
          privacyRegions={state.privacyRegions}
        />
      )}

      {(state.step === "analyzing" || state.step === "committing") && (
        <LoadingStep
          step={state.step}
          progress={currentProgress}
          previewUrl={state.previewUrl}
        />
      )}

      {state.step === "review" && (
        <ReviewStep
          candidates={state.candidates}
          previewUrl={state.previewUrl}
          privacyRegions={state.privacyRegions}
          faceCount={state.faceCount}
          plateCount={state.plateCount}
          errorMessage={state.errorMessage}
          activeCount={activeCount}
          onUpdateCandidate={(tempId, patch) => dispatch({ type: "UPDATE_CANDIDATE", tempId, patch })}
          onReset={handleReset}
          onCommit={handleCommit}
        />
      )}

      {state.step === "form" && (
        <FormStep
          previewUrl={state.previewUrl}
          regionText={state.regionText}
          observedAt={state.observedAt}
          subjectType={state.subjectType}
          confirmed1={state.confirmed1}
          confirmed2={state.confirmed2}
          errorMessage={state.errorMessage}
          canAnalyze={canAnalyze}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
          onDrop={handleDrop}
          onFieldChange={(field, value) => dispatch({ type: "FORM_FIELD_CHANGED", field, value })}
          onSubjectTypeChange={(value) => dispatch({ type: "SUBJECT_TYPE_CHANGED", value })}
          onConfirmChange={(field, value) => dispatch({ type: "CONFIRM_CHANGED", field, value })}
          onAnalyze={handleAnalyze}
        />
      )}
    </section>
  );

  if (!asModal) {
    return <section className="mx-auto w-full max-w-300">{content}</section>;
  }

  return (
    <RouteDialog ariaLabel="기록 업로드 모달" dialogClassName="upload-dialog" closeHref={closeHref}>
      {content}
    </RouteDialog>
  );
}
