'use client'

import { useBanners } from '@/features/banners/queries/banner-queries'
import ArchivePhotoCard from '@/features/banners/components/archive-photo-card'
import { SkeletonPhotoCard } from '@/features/banners/components/skeleton-photo-card'

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
