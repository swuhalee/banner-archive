import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchBanners } from '@/features/banners/actions/fetch-banners'
import { fetchBanner } from '@/features/banners/actions/fetch-banner'
import { analyzeBanner } from '@/features/uploads/actions/analyze-banner'
import type { BannerListParams } from '@/features/banners/schemas/banner-schema'
import type { BannerListResponse, BannerWithImages } from '@/features/banners/types/banner'
import type { CommitRequest, CommitResponse } from '@/features/uploads/types/upload'

export const bannerKeys = {
  all: ['banners'] as const,
  lists: () => ['banners', 'list'] as const,
  list: (params: BannerListParams) => ['banners', 'list', params] as const,
  detail: (id: string) => ['banners', 'detail', id] as const,
}

// POST /api/uploads/commit 엔드포인트에 저장 요청을 보내고, 진행 상황을 실시간으로 수신하는 함수
// upload-dialog.tsx는 진행률 받기&완료 데이터 받기만 신경 쓰고, 실제 네트워크 통신과 스트림 파싱은 이 함수가 담당하도록 역할 분리
// 이게 왜 banner-queries.ts에 있냐면, 이 파일이 배너 관련 데이터 통신 레이어라서 fetch/mutation 로직을 같은 모듈에 모아 관리하려는 구조임
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

export function useBanners(params: BannerListParams = {}) {
  return useQuery({
    queryKey: bannerKeys.list(params),
    queryFn: () => fetchBanners(params),
  })
}

export function useBanner(id: string) {
  return useQuery({
    queryKey: bannerKeys.detail(id),
    queryFn: () => fetchBanner(id),
    enabled: Boolean(id),
    // 상세 데이터는 목록보다 변경이 드물기에 캐시를 더 길게 유지
    staleTime: 60 * 1000,
  })
}

export function useAnalyzeBanner() {
  return useMutation({ mutationFn: analyzeBanner })
}

export type { BannerListResponse, BannerWithImages, CommitRequest, CommitResponse }
