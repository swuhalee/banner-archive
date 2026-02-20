'use client'

import { useEffect, useState } from 'react'
import { useBanners } from '@/lib/hooks/banners'
import type { Banner } from '@/types/banner'
import ArchivePhotoCard from '../_components/archive-photo-card'

export default function ArchivePage() {
  const [regionInput, setRegionInput] = useState('')
  const [region, setRegion] = useState('')

  // 400ms 디바운스
  useEffect(() => {
    const t = setTimeout(() => setRegion(regionInput), 400)
    return () => clearTimeout(t)
  }, [regionInput])

  const { data, isPending } = useBanners({ region: region || undefined, limit: 60 })

  // 최상위 지역명(첫 단어)으로 그룹핑
  const grouped = data?.data.reduce<Record<string, Banner[]>>((acc, banner) => {
    const key = banner.regionText.split(' ')[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(banner)
    return acc
  }, {})

  return (
    <div className="stack-lg">
      <section className="grid grid-cols-[2fr_1fr_1fr] gap-2 pb-[10px] max-[1024px]:grid-cols-1">
        <input
          type="text"
          placeholder="지역 검색"
          value={regionInput}
          onChange={(e) => setRegionInput(e.target.value)}
        />
        <select defaultValue="all">
          <option value="all">주체 전체</option>
          <option>정치인</option>
          <option>정당</option>
          <option>시장</option>
          <option>군수</option>
        </select>
        <select defaultValue="recent">
          <option value="recent">최근 관측순</option>
          <option value="first">최초 관측순</option>
          <option value="count">관측 횟수순</option>
        </select>
      </section>

      {isPending && (
        <p className="text-[13px] text-[var(--text-muted)]">불러오는 중...</p>
      )}

      {!isPending && (!grouped || Object.keys(grouped).length === 0) && (
        <p className="text-[13px] text-[var(--text-muted)]">검색 결과가 없습니다.</p>
      )}

      {grouped &&
        Object.entries(grouped).map(([regionKey, items]) => (
          <section key={regionKey} className="stack-md">
            <div className="grid gap-1">
              <h2 className="m-0">{regionKey}</h2>
              <p className="m-0 text-[13px] text-[var(--text-muted)]">{regionKey} 지역 기록</p>
            </div>
            <div className="masonry">
              {items.map((banner, idx) => (
                <ArchivePhotoCard
                  key={banner.id}
                  item={{
                    id: banner.id,
                    region: banner.regionText,
                    image: banner.images?.[0]?.maskedImageUrl ?? '',
                  }}
                  mediaClass={`media-${((idx + 1) % 4) + 1}`}
                  fromPath="/archive"
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
