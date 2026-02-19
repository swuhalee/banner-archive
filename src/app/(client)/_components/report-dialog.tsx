"use client";

import { Dialog, DialogPanel } from "@headlessui/react";

type ReportDialogProps = {
  open: boolean;
  onClose: () => void;
  detailId?: string;
};

function ReportDialogContent({ detailId, onCancel }: { detailId?: string; onCancel?: () => void }) {
  return (
    <div className="w-full max-w-[560px] rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="mb-1 font-bold">신고</h2>
      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
        잘못된 정보나 문제가 있는 기록인가요? <br /> 모든 신고는 익명으로 접수되며 안전하게 처리됩니다.
      </p>
      <form className="mt-3 grid gap-3">
        <input type="hidden" name="detailId" value={detailId ?? ""} />
        <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
          무엇을 신고하시겠습니까?
          <select defaultValue="">
            <option value="" disabled>
              옵션 선택
            </option>
            <option>개인정보 침해</option>
            <option>초상권 침해</option>
            <option>허위 정보</option>
            <option>기타</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
          세부 정보(옵션)
          <textarea placeholder="이 현수막에 어떤 문제가 있는지 추가 세부 정보를 알려주세요" />
        </label>
        <div className="inline-actions justify-end">
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn btn-solid">
            신고
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ReportDialog(props: ReportDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} className="report-dialog">
      <DialogPanel aria-label="신고 요청">
        <ReportDialogContent detailId={props.detailId} onCancel={props.onClose} />
      </DialogPanel>
    </Dialog>
  );
}
