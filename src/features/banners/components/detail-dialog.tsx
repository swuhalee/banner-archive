"use client";

import { useState } from "react";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import ReportDialog from "./report-dialog";
import RouteDialog from "@/components/ui/route-dialog";
import { useBanner } from "@/features/banners/queries/banner-queries";

type DetailDialogProps = {
  id: string;
  closeHref?: string;
  asModal?: boolean;
};

function formatKoreanDate(dateStr: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

/*
  배너 상세 정보 모달 컴포넌트
  - 배너의 이미지, 위치, 관측 날짜, 카테고리 등의 정보를 보여줌
  - 더보기 버튼을 통해 신고 기능 제공
  - asModal prop을 통해 모달 형태 또는 페이지 형태로 렌더링 가능
*/
export default function DetailDialog({ id, closeHref = "/archive", asModal = true }: DetailDialogProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { data: banner, isPending, isError } = useBanner(id);

  const imageUrl = banner?.images?.[0]?.maskedImageUrl;

  const content = (
    <>
      <section className="detail-modal rounded-[24px] bg-[var(--surface)] p-4">
        {isPending && (
          <div className="grid gap-4 p-4">
            <div className="h-[min(30dvh,320px)] min-h-[180px] w-full animate-pulse rounded-[16px] bg-[var(--surface-alt)]" />
          </div>
        )}

        {isError && (
          <div className="p-4">
            <p className="text-[13px] text-[var(--text-muted)]">배너를 불러오지 못했습니다.</p>
          </div>
        )}

        {banner && (
          <>
            <section className="overflow-hidden rounded-[16px] bg-[var(--surface-alt)]">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={banner.regionText}
                  className="block w-full"
                />
              )}
            </section>

            <section className="mt-3 grid gap-4 bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-2.5">
                <div className="grid">
                  <p className="text-[12px] text-[var(--text-muted)]">위치</p>
                  <p className="text-[15px] font-semibold">{banner.regionText}</p>
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
                  <span>{formatKoreanDate(banner.firstSeenAt)}에 최초 관측됨</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-muted)]">
                  <TodayOutlinedIcon sx={{ fontSize: 15 }} />
                  <span>가장 최근인 {formatKoreanDate(banner.lastSeenAt)}에도 관측됨</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-muted)]">
                  <TagOutlinedIcon sx={{ fontSize: 15 }} />
                  <span>현재까지 총 {banner.observedCount}회 관측됨</span>
                </div>
              </div>

              {banner.hashtags.length > 0 && (
                <div className="grid gap-2">
                  <p className="text-[12px] text-[var(--text-muted)]">카테고리</p>
                  <div className="flex flex-wrap gap-2">
                    {banner.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--text-muted)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </section>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} detailId={id} />
    </>
  );

  if (!asModal) {
    return <section className="mx-auto w-full max-w-[980px]">{content}</section>;
  }

  return (
    <RouteDialog ariaLabel="상세 기록 모달" dialogClassName="detail-dialog" closeHref={closeHref} disableOutsideClose={reportOpen}>
      {content}
    </RouteDialog>
  );
}
