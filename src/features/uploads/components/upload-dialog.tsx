"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDaumPostcodePopup } from "react-daum-postcode";
import RouteDialog from "@/components/ui/route-dialog";
import {
  useAnalyzeBanner,
  bannerKeys,
  commitBannerWithProgress,
  type BBox,
  type RejectedDuplicate,
  type UploadCandidate,
} from "@/features/banners";
import { BANNER_SUBJECT_TYPES, type BannerSubjectType } from "@/lib/constants";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

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

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

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

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function UploadDialog({ closeHref = "/", asModal = true }: UploadDialogProps) {
  const queryClient = useQueryClient();
  const analyzeMutation = useAnalyzeBanner();

  const openPostcode = useDaumPostcodePopup();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [regionText, setRegionText] = useState("");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));
  const [subjectType, setSubjectType] = useState<BannerSubjectType | "">("");
  const [confirmed1, setConfirmed1] = useState(false);
  const [confirmed2, setConfirmed2] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [uploadSourceId, setUploadSourceId] = useState("");
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [rejectedDuplicates, setRejectedDuplicates] = useState<RejectedDuplicate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [commitProgress, setCommitProgress] = useState(0);

  // ── 주소 검색 ────────────────────────────────────────────────────────────────
  function handleAddressSearch() {
    openPostcode({
      onComplete: (data) => {
        setRegionText(data.address);
      },
    });
  }

  // ── 파일 선택 ────────────────────────────────────────────────────────────────
  function handleFileSelect(file: File) {
    setSelectedFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setErrorMessage(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  // ── 전체 초기화 ──────────────────────────────────────────────────────────────
  function handleReset() {
    if (analyzeTimerRef.current) {
      clearInterval(analyzeTimerRef.current);
      analyzeTimerRef.current = null;
    }
    analyzeMutation.reset();
    setStep("form");
    setSelectedFile(null);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setRegionText("");
    setObservedAt(new Date().toISOString().slice(0, 10));
    setSubjectType("");
    setConfirmed1(false);
    setConfirmed2(false);
    setUploadSourceId("");
    setCandidates([]);
    setRejectedDuplicates([]);
    setErrorMessage(null);
    setAnalyzeProgress(0);
    setCommitProgress(0);
  }

  // ── Step 1 → Step 2: 분석 요청 ──────────────────────────────────────────────
  function handleAnalyze() {
    if (!selectedFile || !regionText || !observedAt) return;

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("regionText", regionText);
    formData.append("observedAt", observedAt);
    if (subjectType) formData.append("subjectType", subjectType);

    setStep("analyzing");
    setAnalyzeProgress(0);
    setErrorMessage(null);

    // 시뮬레이션 progress: 지수 감쇠로 90%까지 서서히 증가
    let elapsed = 0;
    analyzeTimerRef.current = setInterval(() => {
      elapsed += 200;
      setAnalyzeProgress(Math.min(89, Math.round(90 * (1 - Math.exp(-elapsed / 12000)))));
    }, 200);

    analyzeMutation.mutate(formData, {
      onSuccess: (data) => {
        if (analyzeTimerRef.current) {
          clearInterval(analyzeTimerRef.current);
          analyzeTimerRef.current = null;
        }
        setAnalyzeProgress(100);

        if (data.candidates.length === 0) {
          setErrorMessage("현수막을 인식할 수 없습니다. 다른 사진을 업로드해주세요.");
          setStep("form");
          return;
        }
        setUploadSourceId(data.uploadSourceId);
        setCandidates(data.candidates.map(toEditable));
        setTimeout(() => setStep("review"), 300);
      },
      onError: (err) => {
        if (analyzeTimerRef.current) {
          clearInterval(analyzeTimerRef.current);
          analyzeTimerRef.current = null;
        }
        setErrorMessage(err instanceof Error ? err.message : "분석에 실패했습니다");
        setStep("form");
      },
    });
  }

  // ── Step 3 → Step 4: 저장 요청 ──────────────────────────────────────────────
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

    setStep("committing");
    setCommitProgress(0);
    setErrorMessage(null);

    try {
      const data = await commitBannerWithProgress(
        { uploadSourceId, selectedCandidates },
        (percent) => setCommitProgress(percent),
      );
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() });
      setSavedCount(data.savedCount);
      setRejectedDuplicates(data.rejectedDuplicates);
      setStep("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "저장에 실패했습니다");
      setStep("review");
    }
  }

  // ── 후보 개별 필드 업데이트 ─────────────────────────────────────────────────
  function updateCandidate(tempId: string, patch: Partial<EditableCandidate>) {
    setCandidates((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)),
    );
  }

  const canAnalyze = Boolean(selectedFile && regionText && observedAt && confirmed1 && confirmed2);
  const activeCount = candidates.filter((c) => !c.excluded).length;
  const currentProgress = step === "analyzing" ? analyzeProgress : commitProgress;

  // ─── 렌더링 ──────────────────────────────────────────────────────────────────

  const content = (
    <section className="upload-modal rounded-[24px] bg-[var(--surface)] p-4">

      {/* ── 완료 화면 ─────────────────────────────────────────────────────────── */}
      {step === "done" && (
        <div className="grid gap-4 p-8 text-center">
          {savedCount > 0 ? (
            <>
              <p className="font-bold">{savedCount}개의 현수막 기록이 완료되었습니다.</p>
              <p className="text-[13px] text-[var(--text-muted)]">
                각 현수막이 개별 아카이브에 추가되었습니다.
              </p>
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

      {/* ── 로딩 화면 (분석 / 저장 중) ──────────────────────────────────────── */}
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
              {/* <span>{step === "analyzing" ? "분석 중..." : "저장 중..."}</span> */}
              <span className="font-semibold tabular-nums">{currentProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full bg-[#3b82f6] transition-all duration-300 ease-out"
                style={{ width: `${currentProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 검토 화면 ─────────────────────────────────────────────────────────── */}
      {step === "review" && (
        <div className="grid gap-4">
          {/* <h2 className="font-bold">감지된 현수막 검토</h2> */}

          {/* 이미지 + bbox 오버레이 */}
          <div className="relative w-full overflow-hidden rounded-[12px] border border-[var(--line)]">
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
                  border: `2px solid ${c.excluded ? "#9ca3af" : "#3b82f6"}`,
                  opacity: c.excluded ? 0.4 : 1,
                }}
              >
                <span
                  className="absolute left-0 top-0 px-1 text-[11px] font-bold text-white"
                  style={{ background: c.excluded ? "#9ca3af" : "#3b82f6" }}
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
                    style={{ background: c.excluded ? "#9ca3af" : "#3b82f6" }}
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

      {/* ── 업로드 폼 ─────────────────────────────────────────────────────────── */}
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
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">JPG, JPEG, PNG · 최대 20MB</p>
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
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="주소 검색을 눌러 선택하세요"
                  value={regionText}
                  readOnly
                  className="flex-1"
                />
                <button
                  type="button"
                  className="btn btn-ghost shrink-0 text-[13px]"
                  onClick={handleAddressSearch}
                >
                  주소 검색
                </button>
              </div>
            </div>

            <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
              관측일
              <input
                type="date"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
              주체 유형
              <select
                value={subjectType}
                onChange={(e) => setSubjectType(e.target.value as BannerSubjectType | "")}
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
                onChange={(e) => setConfirmed1(e.target.checked)}
              />
              사진을 촬영한 실제 위치와 날짜 정보가 정확합니다.
            </label>

            <label className="pb-4 flex items-center gap-1.5 text-[13px] leading-none text-[var(--text-muted)]">
              <input
                type="checkbox"
                className="m-0 h-[14px] w-[14px]"
                checked={confirmed2}
                onChange={(e) => setConfirmed2(e.target.checked)}
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
