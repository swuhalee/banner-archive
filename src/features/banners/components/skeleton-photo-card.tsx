/** 홈·아카이브 사진 카드 스켈레톤 */
export function SkeletonPhotoCard({ mediaClass }: { mediaClass: string }) {
  return (
    <article className="mb-[14px] break-inside-avoid overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
      <div className={`feed-media ${mediaClass} animate-pulse !bg-[var(--surface-alt)]`} />
    </article>
  )
}
