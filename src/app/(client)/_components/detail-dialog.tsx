"use client";

import { useState } from "react";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import ReportDialog from "./report-dialog";
import RouteDialog from "./route-dialog";

type DetailDialogProps = {
  id: string;
  closeHref?: string;
  asModal?: boolean;
};

export default function DetailDialog({ id, closeHref = "/archive", asModal = true }: DetailDialogProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const categories = ["정치", "정당", "정책", "지역 이슈", "선거"];

  const content = (
    <>
      <section className="detail-modal rounded-[24px] bg-[var(--surface)] p-4">
        <section className="overflow-hidden rounded-[16px] bg-[var(--surface)]">
          <div
            className="media-2 h-[min(30dvh,320px)] min-h-[180px] w-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(https://picsum.photos/seed/detail-${id}/1800/1200)` }}
          />
        </section>

        <section className="mt-3 grid gap-4 bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-2.5">
            <div className="grid">
              <p className="text-[12px] text-[var(--text-muted)]">위치</p>
              <p className="text-[15px] font-semibold">서울 마포구</p>
            </div>

            <div className="relative">
              <button
                type="button"
                className="btn btn-ghost h-9 w-9 px-0"
                aria-label="더보기"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizIcon fontSize="small" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 min-w-[120px] rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-sm">
                  <button
                    type="button"
                    className="w-full rounded-[8px] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-alt)]"
                    onClick={() => {
                      setMenuOpen(false);
                      setReportOpen(true);
                    }}
                  >
                    신고
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-muted)]">
              <CalendarMonthOutlinedIcon sx={{ fontSize: 15 }} />
              <span>2026년 2월 3일에 최초 관측됨</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-muted)]">
              <TodayOutlinedIcon sx={{ fontSize: 15 }} />
              <span>가장 최근인 2026년 2월 18일에도 관측됨</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-muted)]">
              <TagOutlinedIcon sx={{ fontSize: 15 }} />
              <span>현재까지 총 7회 관측됨</span>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-[12px] text-[var(--text-muted)]">카테고리</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--text-muted)]"
                >
                  #{category}
                </span>
              ))}
            </div>
          </div>
        </section>
      </section>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} detailId={id} />
    </>
  );

  if (!asModal) {
    return <section className="mx-auto w-full max-w-[980px]">{content}</section>;
  }

  return (
    <RouteDialog ariaLabel="상세 기록 모달" dialogClassName="detail-dialog" closeHref={closeHref}>
      {content}
    </RouteDialog>
  );
}
