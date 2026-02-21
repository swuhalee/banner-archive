"use client";

import { submitAppeal, type AppealReasonType } from "@/features/banners/queries/appeals-queries";
import { Dialog, DialogPanel } from "@headlessui/react";
import { useState } from "react";

type ReportDialogProps = {
  open: boolean;
  onClose: () => void;
  detailId?: string;
};

const REASON_OPTIONS: { value: AppealReasonType; label: string }[] = [
  { value: "privacy", label: "개인정보 침해" },
  { value: "portrait", label: "초상권 침해" },
  { value: "false_info", label: "허위 정보" },
  { value: "other", label: "기타" },
];

function ReportDialogContent({
  detailId,
  onCancel,
  onSuccess,
}: {
  detailId?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const [reasonType, setReasonType] = useState<AppealReasonType | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!detailId) return;
    if (!reasonType) {
      setError("신고 유형을 선택해주세요");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await submitAppeal({ bannerId: detailId, reasonType, reasonDetail: reasonDetail || undefined });
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "신고 접수에 실패했습니다");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="w-full max-w-[560px] rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="mb-1 font-bold">신고</h2>
      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
        잘못된 정보나 문제가 있는 기록인가요? <br /> 모든 신고는 익명으로 접수되며 안전하게 처리됩니다.
      </p>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
          무엇을 신고하시겠습니까?
          <select
            value={reasonType}
            onChange={(e) => setReasonType(e.target.value as AppealReasonType)}
          >
            <option value="" disabled>
              옵션 선택
            </option>
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
          세부 정보(옵션)
          <textarea
            placeholder="이 현수막에 어떤 문제가 있는지 추가 세부 정보를 알려주세요"
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
          />
        </label>
        {error && <p className="text-[13px] text-red-500">{error}</p>}
        <div className="inline-actions justify-end">
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={isPending}>
            취소
          </button>
          <button type="button" className="btn btn-solid" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "접수 중..." : "신고"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="w-full max-w-140 rounded-[14px] border border-(--line) bg-(--surface) p-6">
      <h2 className="mb-1 font-bold">신고 접수 완료</h2>
      <p className="text-[13px] leading-relaxed text-(--text-muted)">
        신고가 익명으로 접수되었습니다. 검토 후 조치가 이루어집니다.
      </p>
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-solid text-[13px]" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

export default function ReportDialog(props: ReportDialogProps) {
  const [submitted, setSubmitted] = useState(false);

  function handleClose() {
    setSubmitted(false);
    props.onClose();
  }

  return (
    <Dialog open={props.open} onClose={handleClose} className="report-dialog">
      <DialogPanel aria-label="신고 요청">
        {submitted ? (
          <SuccessContent onClose={handleClose} />
        ) : (
          <ReportDialogContent
            detailId={props.detailId}
            onCancel={handleClose}
            onSuccess={() => setSubmitted(true)}
          />
        )}
      </DialogPanel>
    </Dialog>
  );
}
