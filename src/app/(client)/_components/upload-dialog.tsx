"use client";

import RouteDialog from "./route-dialog";

type UploadDialogProps = {
  closeHref?: string;
  asModal?: boolean;
};

export default function UploadDialog({ closeHref = "/", asModal = true }: UploadDialogProps) {
  const content = (
    <section className="upload-modal rounded-[24px] bg-[var(--surface)] p-4">
      <div className="grid grid-cols-2 gap-4 max-[1024px]:grid-cols-1">
        <article className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mt-2 grid min-h-[240px] place-items-center rounded-[12px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-alt)] text-[var(--text-muted)]">
            드래그 앤 드롭 또는 파일 선택
          </div>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">JPG, JPEG, PNG · 최대 20MB</p>
        </article>

        <form className="grid gap-3 bg-[var(--surface)] p-4" aria-label="업로드 폼">
          <h2 className="mb-1 font-bold">정보 입력</h2>
          <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
            위치
            <input type="text" placeholder="예: 서울 마포구 월드컵로 00" />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
            관측일
            <input type="date" defaultValue="2026-02-18" />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
            주체 유형
            <select defaultValue="">
              <option value="" disabled>
                선택하세요
              </option>
              <option>정치인</option>
              <option>정당</option>
              <option>기타</option>
            </select>
          </label>
          <label className="pt-2 flex items-center gap-1.5 text-[13px] leading-none text-[var(--text-muted)]">
            <input type="checkbox" className="m-0 h-[14px] w-[14px]" /> 사진을 촬영한 실제 위치와 날짜 정보가 정확합니다.
          </label>
          <label className="pb-4 flex items-center gap-1.5 text-[13px] leading-none text-[var(--text-muted)]">
            <input type="checkbox" className="m-0 h-[14px] w-[14px]" /> 직접 촬영한 사진이며, 본 아카이브 서비스의 기록 목적으로 활용됨에 동의합니다.
          </label>
          <button type="button" className="btn btn-solid">
            기록 업로드
          </button>
        </form>
      </div>
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
