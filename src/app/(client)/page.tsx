'use client'

import { useBanners } from '@/lib/hooks/banners'
import ArchivePhotoCard from './_components/archive-photo-card'

export default function HomePage() {
  const { data, isPending } = useBanners({ limit: 20 })

  return (
    <div className="stack-lg">
      {isPending && (
        <p className="text-[13px] text-[var(--text-muted)]">불러오는 중...</p>
      )}
      <section className="masonry">
        {data?.data.map((banner, idx) => (
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
