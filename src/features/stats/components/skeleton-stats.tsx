import { Skeleton } from '@/components/ui/skeleton'

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
