"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import RouteDialog from "./route-dialog";
import { useUploadBanner } from "@/lib/hooks/banners";

type UploadDialogProps = {
  closeHref?: string;
  asModal?: boolean;
};

export default function UploadDialog({ closeHref = "/", asModal = true }: UploadDialogProps) {
  const { mutate, isPending, isSuccess, isError, error, data, reset } = useUploadBanner();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [regionText, setRegionText] = useState("");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));
  const [subjectType, setSubjectType] = useState("");
  const [confirmed1, setConfirmed1] = useState(false);
  const [confirmed2, setConfirmed2] = useState(false);

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    reset();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleSubmit() {
    if (!selectedFile || !regionText || !observedAt) return;
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("regionText", regionText);
    formData.append("observedAt", observedAt);
    if (subjectType) formData.append("subjectType", subjectType);
    mutate(formData);
  }

  function handleReset() {
    reset();
    setSelectedFile(null);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setRegionText("");
    setConfirmed1(false);
    setConfirmed2(false);
  }

  const canSubmit = selectedFile && regionText && observedAt && confirmed1 && confirmed2 && !isPending;

  const content = (
    <section className="upload-modal rounded-[24px] bg-[var(--surface)] p-4">
      {isSuccess && data ? (
        <div className="grid gap-4 p-8 text-center">
          <p className="font-bold">업로드가 완료되었습니다.</p>
          <p className="text-[13px] text-[var(--text-muted)]">현수막 기록이 아카이브에 추가되었습니다.</p>
          <div className="flex justify-center gap-3">
            <Link
              href={`/detail?id=${data.id}`}
              className="btn btn-solid text-[13px]"
            >
              자세히 보기
            </Link>
            <button type="button" className="btn btn-ghost text-[13px]" onClick={handleReset}>
              다시 업로드
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-[1024px]:grid-cols-1">
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

          <form
            className="grid gap-3 bg-[var(--surface)] p-4"
            aria-label="업로드 폼"
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          >
            <h2 className="mb-1 font-bold">정보 입력</h2>
            <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
              위치
              <input
                type="text"
                placeholder="예: 서울 마포구 월드컵로 00"
                value={regionText}
                onChange={(e) => setRegionText(e.target.value)}
              />
            </label>
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
              <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
                <option value="" disabled>선택하세요</option>
                <option>정치인</option>
                <option>정당</option>
                <option>기타</option>
              </select>
            </label>
            <label className="pt-2 flex items-center gap-1.5 text-[13px] leading-none text-[var(--text-muted)]">
              <input
                type="checkbox"
                className="m-0 h-[14px] w-[14px]"
                checked={confirmed1}
                onChange={(e) => setConfirmed1(e.target.checked)}
              /> 사진을 촬영한 실제 위치와 날짜 정보가 정확합니다.
            </label>
            <label className="pb-4 flex items-center gap-1.5 text-[13px] leading-none text-[var(--text-muted)]">
              <input
                type="checkbox"
                className="m-0 h-[14px] w-[14px]"
                checked={confirmed2}
                onChange={(e) => setConfirmed2(e.target.checked)}
              /> 직접 촬영한 사진이며, 본 아카이브 서비스의 기록 목적으로 활용됨에 동의합니다.
            </label>

            {isError && (
              <p className="text-[13px] text-red-500">
                {error instanceof Error ? error.message : '업로드에 실패했습니다'}
              </p>
            )}

            <button type="submit" className="btn btn-solid" disabled={!canSubmit}>
              {isPending ? "업로드 중..." : "기록 업로드"}
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
