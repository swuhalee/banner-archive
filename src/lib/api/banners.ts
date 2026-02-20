import type { BannerListResponse, BannerWithImages } from '@/types/banner'

export type BannerListParams = {
  q?: string
  from?: string
  to?: string
  hashtag?: string
  region?: string
  page?: number
  limit?: number
}

export async function fetchBanners(params: BannerListParams = {}): Promise<BannerListResponse> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  if (params.hashtag) sp.set('hashtag', params.hashtag)
  if (params.region) sp.set('region', params.region)
  if (params.page != null) sp.set('page', String(params.page))
  if (params.limit != null) sp.set('limit', String(params.limit))

  const res = await fetch(`/api/banners?${sp}`)
  if (!res.ok) throw new Error('배너 목록을 불러오지 못했습니다')
  return res.json()
}

export async function fetchBanner(id: string): Promise<BannerWithImages> {
  const res = await fetch(`/api/banners/${id}`)
  if (!res.ok) throw new Error('배너를 불러오지 못했습니다')
  return res.json()
}

export async function uploadBanner(formData: FormData): Promise<BannerWithImages> {
  const res = await fetch('/api/uploads', { method: 'POST', body: formData })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? '업로드에 실패했습니다')
  }
  return res.json()
}
