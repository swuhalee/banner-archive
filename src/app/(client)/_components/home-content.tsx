'use client'

import { ArchivePhotoCard, SkeletonPhotoCard, useBanners } from '@/features/banners'

export const HOME_PARAMS = { limit: 20 } as const

export default function HomeContent() {
  const { data, isPending } = useBanners(HOME_PARAMS)

  return (
    <div className="stack-lg">
      <section className="masonry">
        {isPending
          ? Array.from({ length: 8 }, (_, i) => (
              <SkeletonPhotoCard key={i} mediaClass={`media-${(i % 4) + 1}`} />
            ))
          : data?.data.map((banner) => (
              <ArchivePhotoCard
                key={banner.id}
                item={{
                  id: banner.id,
                  region: banner.regionText,
                  image: banner.images?.[0]?.maskedImageUrl ?? '',
                }}
                fromPath="/"
              />
            ))}
      </section>
    </div>
  )
}
