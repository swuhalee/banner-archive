/** 공통 shimmer 박스 */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--surface-alt)] ${className ?? ''}`} />
  )
}

/** 홈·아카이브 사진 카드 스켈레톤 */
export function SkeletonPhotoCard({ mediaClass }: { mediaClass: string }) {
  return (
    <article className="mb-[14px] break-inside-avoid overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
      <div className={`feed-media ${mediaClass} animate-pulse !bg-[var(--surface-alt)]`} />
    </article>
  )
}

/** 통계 요약 카드 스켈레톤 */
export function SkeletonSummaryCard() {
  return (
    <div className="rounded-xl border border-[var(--line)] p-5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-7 w-20" />
    </div>
  )
}

/** 통계 차트 섹션 스켈레톤 */
export function SkeletonChartSection() {
  return (
    <section className="rounded-xl border border-[var(--line)] p-5">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-[260px] w-full rounded-lg" />
    </section>
  )
}
