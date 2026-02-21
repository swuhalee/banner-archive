'use client'

import { ArchivePhotoCard, SkeletonPhotoCard, useBanners } from '@/features/banners'

export default function HomePage() {
  const { data, isPending } = useBanners({ limit: 20 })

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
