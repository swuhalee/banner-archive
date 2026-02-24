'use client'

import { ArchivePhotoCard, SkeletonPhotoCard, useBanners } from '@/features/banners'

/*
 * 클라이언트 전용 페이지 컴포넌트
 * 서버에서 렌더링되지 않고, 브라우저에서만 실행됨
 * useBanners 훅을 사용하여 배너 데이터를 가져와서 화면에 표시함
 * 폴더 구조 기반 라우팅이라 /app/(client)/page.tsx는 루트 경로 '/'에 매핑됨
*/
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
