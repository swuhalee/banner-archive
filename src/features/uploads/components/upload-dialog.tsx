"use client";

import { useEffect, useRef, useState } from "react";
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
import { uploadSourceForAnalysis } from "@/features/uploads/utils/source-upload";
import { BANNER_SUBJECT_TYPES, type BannerSubjectType } from "@/lib/constants";

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

type UploadDialogProps = {
  closeHref?: string;
  asModal?: boolean;
};

const createInitialFormState = () => ({
  previewUrl: null as string | null,
  selectedFile: null as File | null,
  regionText: "",
  observedAt: new Date().toISOString().slice(0, 10),
  subjectType: "" as BannerSubjectType | "",
  confirmed1: false,
  confirmed2: false,
});

const initialAnalysisState = {
  uploadSourceId: "",
  candidates: [] as EditableCandidate[],
  privacyRegions: [] as PrivacyRegion[],
  faceCount: 0,
  plateCount: 0,
};

const initialUiState = {
  step: "form" as Step,
  errorMessage: null as string | null,
  analyzeProgress: 0,
  commitProgress: 0,
};

const initialResultState = {
  savedCount: 0,
  rejectedDuplicates: [] as RejectedDuplicate[],
};

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

export default function UploadDialog({ closeHref = "/", asModal = true }: UploadDialogProps) {
  const queryClient = useQueryClient();
  const analyzeMutation = useAnalyzeBanner();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formState, setFormState] = useState(createInitialFormState);
  const [analysisState, setAnalysisState] = useState(initialAnalysisState);
  const [uiState, setUiState] = useState(initialUiState);
  const [resultState, setResultState] = useState(initialResultState);

  const {
    previewUrl,
    selectedFile,
    regionText,
    observedAt,
    subjectType,
    confirmed1,
    confirmed2,
  } = formState;
  const { uploadSourceId, candidates, privacyRegions, faceCount, plateCount } = analysisState;
  const { step, errorMessage, analyzeProgress, commitProgress } = uiState;
  const { savedCount, rejectedDuplicates } = resultState;

  // 파일 선택
  function handleFileSelect(file: File) {
    const validationError = getUploadFileValidationError(file);
    if (validationError) {
      setUiState((prev) => ({
        ...prev,
        errorMessage: validationError,
      }));
      return;
    }

    setFormState((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        ...prev,
        selectedFile: file,
        previewUrl: URL.createObjectURL(file),
      };
    });
    setUiState((prev) => ({ ...prev, errorMessage: null }));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  // previewUrl이 바뀌거나 컴포넌트가 사라질 때 이전 URL 해제
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // 전체 초기화
  function handleReset() {
    if (analyzeTimerRef.current) {
      clearInterval(analyzeTimerRef.current);
      analyzeTimerRef.current = null;
    }
    analyzeMutation.reset();
    setFormState((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return createInitialFormState();
    });
    setAnalysisState(initialAnalysisState);
    setResultState(initialResultState);
    setUiState(initialUiState);
  }

  // 분석 요청
  async function handleAnalyze() {
    if (!selectedFile || !regionText || !observedAt) return;

    let sourcePath = "";
    let elapsed = 0;

    const formData = new FormData();
    setUiState((prev) => ({
      ...prev,
      step: "analyzing",
      analyzeProgress: 0,
      errorMessage: null,
    }));

    try {
      const result = await uploadSourceForAnalysis(selectedFile, (uploadPercent) => {
        const mapped = Math.min(45, Math.round(uploadPercent * 0.45));
        setUiState((prev) => ({ ...prev, analyzeProgress: mapped }));
      });
      sourcePath = result.sourcePath;
    } catch (err) {
      setUiState((prev) => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : "원본 업로드에 실패했습니다",
        step: "form",
      }));
      return;
    }

    setUiState((prev) => ({ ...prev, analyzeProgress: 45 }));
    analyzeTimerRef.current = setInterval(() => {
      elapsed += 200;
      const fromAnalysis = Math.round(45 * (1 - Math.exp(-elapsed / 12000)));
      setUiState((prev) => ({
        ...prev,
        analyzeProgress: Math.min(89, 45 + fromAnalysis),
      }));
    }, 200);

    formData.append("sourcePath", sourcePath);
    formData.append("sourceContentType", selectedFile.type);
    formData.append("regionText", regionText);
    formData.append("observedAt", observedAt);
    if (subjectType) formData.append("subjectType", subjectType);

    analyzeMutation.mutate(formData, {
      onSuccess: (data) => {
        if (analyzeTimerRef.current) {
          clearInterval(analyzeTimerRef.current);
          analyzeTimerRef.current = null;
        }
        setUiState((prev) => ({ ...prev, analyzeProgress: 100 }));

        if (data.candidates.length === 0) {
          setUiState((prev) => ({
            ...prev,
            errorMessage: "현수막을 인식할 수 없습니다. 다른 사진을 업로드해주세요.",
            step: "form",
          }));
          return;
        }
        setAnalysisState({
          uploadSourceId: data.uploadSourceId,
          candidates: data.candidates.map(toEditable),
          privacyRegions: data.privacyRegions,
          faceCount: data.privacyRegions.filter((r) => r.type === "face").length,
          plateCount: data.privacyRegions.filter((r) => r.type === "licensePlate").length,
        });
        setTimeout(() => {
          setUiState((prev) => ({ ...prev, step: "review" }));
        }, 300);
      },
      onError: (err) => {
        if (analyzeTimerRef.current) {
          clearInterval(analyzeTimerRef.current);
          analyzeTimerRef.current = null;
        }
        setUiState((prev) => ({
          ...prev,
          errorMessage: toFriendlyAnalyzeErrorMessage(err),
          step: "form",
        }));
      },
    });
  }

  // 저장 요청
  async function handleCommit() {
    const selected = candidates.filter((c) => !c.excluded);
    if (selected.length === 0) return;

    const selectedCandidates = selected.map((c) => ({
      tempId: c.tempId,
      title: c.title.trim() || null,
      hashtags: c.hashtagsText.split(",").map((h) => h.trim()).filter(Boolean),
      subjectType: c.subjectType || null,
      bbox: c.bbox,
      confidence: c.confidence,
    }));

    setUiState((prev) => ({
      ...prev,
      step: "committing",
      commitProgress: 0,
      errorMessage: null,
    }));

    try {
      const data = await commitBannerWithProgress(
        { uploadSourceId, selectedCandidates },
        (percent) => setUiState((prev) => ({ ...prev, commitProgress: percent })),
      );
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() });
      setResultState({
        savedCount: data.savedCount,
        rejectedDuplicates: data.rejectedDuplicates,
      });
      setUiState((prev) => ({ ...prev, step: "done" }));
    } catch (err) {
      setUiState((prev) => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : "저장에 실패했습니다",
        step: "review",
      }));
    }
  }

  // 현수막이 여러 개라면, 개별 필드 업데이트
  function updateCandidate(tempId: string, patch: Partial<EditableCandidate>) {
    setAnalysisState((prev) => ({
      ...prev,
      candidates: prev.candidates.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)),
    }));
  }

  const canAnalyze = Boolean(selectedFile && regionText && observedAt && confirmed1 && confirmed2);
  const activeCount = candidates.filter((c) => !c.excluded).length;
  const currentProgress = step === "analyzing" ? analyzeProgress : commitProgress;

  // 렌더링
  const content = (
    <section className="upload-modal rounded-[24px] bg-[var(--surface)] p-4">

      {/* 완료 화면 */}
      {step === "done" && (
        <div className="grid gap-4 p-8 text-center">
          {savedCount > 0 ? (
            <>
              <p className="font-bold">{savedCount}개의 현수막 기록이 완료되었습니다.</p>
              <p className="text-[13px] text-[var(--text-muted)]">
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
      )}

      {/* 로딩 화면 (분석 / 저장 중) */}
      {(step === "analyzing" || step === "committing") && (
        <div className="grid gap-3 p-8 text-center">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="미리보기"
              className="mx-auto max-h-[240px] rounded-[8px] object-contain opacity-60"
            />
          )}
          <p className="font-bold">
            {step === "analyzing" ? "현수막을 감지하고 있습니다" : "저장 중"}
          </p>
          <div className="mx-auto w-full max-w-[260px]">
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-[var(--text-muted)]">
              <span className="font-semibold tabular-nums">{currentProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full bg-(--accent) transition-all duration-300 ease-out"
                style={{ width: `${currentProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 검토 화면 */}
      {step === "review" && (
        <div className="grid gap-4">
          {/* 이미지 + bbox 오버레이 */}
          <div className="relative w-full overflow-hidden rounded-[12px] border border-[var(--line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl!} alt="원본 사진" className="block w-full" /> {/* TODO: 이미지 사이즈 줄여야 함 */}
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
                className="grid gap-2 rounded-[12px] border border-[var(--line)] p-3"
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
                  <label className="flex cursor-pointer items-center gap-1 text-[12px] text-[var(--text-muted)]">
                    <input
                      type="checkbox"
                      className="m-0 h-[13px] w-[13px]"
                      checked={c.excluded}
                      onChange={(e) => updateCandidate(c.tempId, { excluded: e.target.checked })}
                    />
                    제외
                  </label>
                </div>

                <label className="grid gap-1 text-[12px] font-semibold text-[var(--text-muted)]">
                  제목 / 슬로건
                  <input
                    type="text"
                    placeholder="현수막 핵심 문구"
                    value={c.title}
                    disabled={c.excluded}
                    onChange={(e) => updateCandidate(c.tempId, { title: e.target.value })}
                  />
                </label>

                <label className="grid gap-1 text-[12px] font-semibold text-[var(--text-muted)]">
                  해시태그 (쉼표로 구분)
                  <input
                    type="text"
                    placeholder="키워드1, 키워드2"
                    value={c.hashtagsText}
                    disabled={c.excluded}
                    onChange={(e) => updateCandidate(c.tempId, { hashtagsText: e.target.value })}
                  />
                </label>

                <label className="grid gap-1 text-[12px] font-semibold text-[var(--text-muted)]">
                  주체 유형
                  <select
                    value={c.subjectType}
                    disabled={c.excluded}
                    onChange={(e) => updateCandidate(c.tempId, { subjectType: e.target.value })}
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
            <button type="button" className="btn btn-ghost flex-1 text-[13px]" onClick={handleReset}>
              처음으로
            </button>
            <button
              type="button"
              className="btn btn-solid flex-1 text-[13px]"
              disabled={activeCount === 0}
              onClick={handleCommit}
            >
              {activeCount}개 저장하기
            </button>
          </div>
        </div>
      )}

      {/* 업로드 폼 */}
      {step === "form" && (
        <div className="grid grid-cols-2 gap-4 max-[1024px]:grid-cols-1">
          {/* 이미지 업로드 영역 */}
          <article className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4">
            <div
              className="mt-2 grid min-h-[240px] place-items-center rounded-[12px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-alt)] text-[var(--text-muted)] cursor-pointer overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
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
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">JPG, JPEG, PNG, WebP · 최대 20MB (HEIC 불가)</p>
          </article>

          {/* 정보 입력 폼 */}
          <form
            className="grid gap-3 bg-[var(--surface)] p-4"
            aria-label="업로드 폼"
            onSubmit={(e) => { e.preventDefault(); if (canAnalyze) handleAnalyze(); }}
          >
            <h2 className="mb-1 font-bold">정보 입력</h2>

            <div className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
              위치
              <RegionSelector
                value={regionText}
                onChange={(value) => setFormState((prev) => ({ ...prev, regionText: value }))}
              />
            </div>

            <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
              관측일
              <input
                type="date"
                value={observedAt}
                onChange={(e) => setFormState((prev) => ({ ...prev, observedAt: e.target.value }))}
              />
            </label>

            <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
              주체 유형
              <select
                value={subjectType}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    subjectType: e.target.value as BannerSubjectType | "",
                  }))
                }
              >
                <option value="" disabled>선택하세요</option>
                {BANNER_SUBJECT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="pt-2 flex items-center gap-1.5 text-[13px] leading-none text-[var(--text-muted)]">
              <input
                type="checkbox"
                className="m-0 h-[14px] w-[14px]"
                checked={confirmed1}
                onChange={(e) => setFormState((prev) => ({ ...prev, confirmed1: e.target.checked }))}
              />
              사진을 촬영한 실제 위치와 날짜 정보가 정확합니다.
            </label>

            <label className="pb-4 flex items-center gap-1.5 text-[13px] leading-none text-[var(--text-muted)]">
              <input
                type="checkbox"
                className="m-0 h-[14px] w-[14px]"
                checked={confirmed2}
                onChange={(e) => setFormState((prev) => ({ ...prev, confirmed2: e.target.checked }))}
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
      )}
    </section>
  );

  if (!asModal) {
    return <section className="mx-auto w-full max-w-[1200px]">{content}</section>;
  }

  return (
    <RouteDialog ariaLabel="기록 업로드 모달" dialogClassName="upload-dialog" closeHref={closeHref}>
      {content}
    </RouteDialog>
  );
}
