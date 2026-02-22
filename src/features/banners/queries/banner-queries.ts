import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchBanners } from '@/features/banners/actions/fetch-banners'
import { fetchBanner } from '@/features/banners/actions/fetch-banner'
import { analyzeBanner } from '@/features/uploads/actions/analyze-banner'
import type { BannerListParams } from '@/features/banners/schemas/banner-schema'
import type { BannerListResponse, BannerWithImages } from '@/features/banners/types/banner'
import type { CommitRequest, CommitResponse } from '@/features/uploads/types/upload'

// ─── React Query 키 팩토리 ─────────────────────────────────────────────────────

export const bannerKeys = {
  all: ['banners'] as const,
  lists: () => ['banners', 'list'] as const,
  list: (params: BannerListParams) => ['banners', 'list', params] as const,
  detail: (id: string) => ['banners', 'detail', id] as const,
}

// ─── commit (SSE 스트리밍) — API Route 유지 ───────────────────────────────────

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

// ─── React Query 훅 ───────────────────────────────────────────────────────────

export function useBanners(params: BannerListParams = {}) {
  return useQuery({
    queryKey: bannerKeys.list(params),
    queryFn: () => fetchBanners(params),
    staleTime: 30 * 1000,
  })
}

export function useBanner(id: string) {
  return useQuery({
    queryKey: bannerKeys.detail(id),
    queryFn: () => fetchBanner(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  })
}

export function useAnalyzeBanner() {
  return useMutation({ mutationFn: analyzeBanner })
}

// 타입 재사용을 위한 re-export
export type { BannerListResponse, BannerWithImages, CommitRequest, CommitResponse }
