/** 공통 shimmer 박스 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--surface-alt)] ${className ?? ''}`} />
  )
}
