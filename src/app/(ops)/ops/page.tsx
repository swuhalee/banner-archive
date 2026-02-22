import { db } from '@/server/db'
import { images, banners } from '@/server/db/schema'
import { resolveStorageUrl } from '@/server/lib/supabase/storage'
import { eq } from 'drizzle-orm'

async function fetchReviewImages() {
  return db
    .select({
      imageId: images.id,
      maskedImageUrl: images.maskedImageUrl,
      maskingMetadata: images.maskingMetadata,
      createdAt: images.createdAt,
      bannerId: banners.id,
      bannerTitle: banners.title,
      regionText: banners.regionText,
    })
    .from(images)
    .innerJoin(banners, eq(images.bannerId, banners.id))
    .where(eq(images.maskingStatus, 'review'))
    .orderBy(images.createdAt)
}

export default async function OpsConsolePage() {
  const reviewImages = await fetchReviewImages()

  return (
    <div className="stack-lg">
      <header className="grid gap-1">
        <h1>Ops Console</h1>
      </header>

      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold">마스킹 검토 필요</h2>
          {reviewImages.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-semibold text-amber-700">
              {reviewImages.length}건
            </span>
          )}
        </div>

        {reviewImages.length === 0 ? (
          <p className="text-[13px] text-(--text-muted)">검토가 필요한 항목이 없습니다.</p>
        ) : (
          <div className="grid gap-2">
            {reviewImages.map((row) => (
              <div
                key={row.imageId}
                className="flex items-center gap-3 rounded-xl border border-(--line) bg-(--surface) p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveStorageUrl(row.maskedImageUrl) ?? ''}
                  alt="마스킹 대상 이미지"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
                <div className="grid flex-1 gap-0.5 min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {row.bannerTitle ?? '(제목 없음)'}
                  </p>
                  <p className="text-[12px] text-(--text-muted)">{row.regionText}</p>
                  <p className="text-[11px] text-(--text-muted)">
                    {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  검토 필요
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
