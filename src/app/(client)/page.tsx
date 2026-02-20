'use client'

import { useBanners } from '@/lib/hooks/banners'
import ArchivePhotoCard from './_components/archive-photo-card'
import { SkeletonPhotoCard } from './_components/skeleton'

export default function HomePage() {
  const { data, isPending } = useBanners({ limit: 20 })

  return (
    <div className="stack-lg">
      <section className="masonry">
        {isPending
          ? Array.from({ length: 8 }, (_, i) => (
              <SkeletonPhotoCard key={i} mediaClass={`media-${(i % 4) + 1}`} />
            ))
          : data?.data.map((banner, idx) => (
              <ArchivePhotoCard
                key={banner.id}
                item={{
                  id: banner.id,
                  region: banner.regionText,
                  image: banner.images?.[0]?.maskedImageUrl ?? '',
                }}
                mediaClass={`media-${(idx % 4) + 1}`}
                fromPath="/"
              />
            ))}
      </section>
    </div>
  )
}
