import type {
  AnalyzeResponse,
  BannerListResponse,
  BannerWithImages,
  CommitRequest,
  CommitResponse,
} from '@/types/banner'

export type BannerListParams = {
  q?: string
  from?: string
  to?: string
  hashtag?: string
  region?: string
  subjectType?: string
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
  if (params.subjectType) sp.set('subjectType', params.subjectType)
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

export async function analyzeBanner(formData: FormData): Promise<AnalyzeResponse> {
  const res = await fetch('/api/uploads/analyze', { method: 'POST', body: formData })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? '분석에 실패했습니다')
  }
  return res.json()
}

export async function commitBanner(data: CommitRequest): Promise<CommitResponse> {
  const res = await fetch('/api/uploads/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? '저장에 실패했습니다')
  }
  return res.json()
}

export async function commitBannerWithProgress(
  data: CommitRequest,
  onProgress: (percent: number) => void,
): Promise<CommitResponse> {
  const res = await fetch('/api/uploads/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? '저장에 실패했습니다')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const event = JSON.parse(line.slice(6)) as Record<string, unknown>
      if (typeof event.error === 'string') throw new Error(event.error)
      if (typeof event.progress === 'number') onProgress(event.progress)
      if (event.done) return event.data as CommitResponse
    }
  }

  throw new Error('스트림이 예상치 않게 종료되었습니다')
}
