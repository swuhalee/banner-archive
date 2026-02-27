import { cache } from 'react'
import { QueryClient } from '@tanstack/react-query'

// React cache()로 동일 요청 내 모든 서버 컴포넌트가 하나의 인스턴스를 공유함.
// 서버 전용 파일 - 'use client' 컴포넌트에서 import 금지.
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          retry: 1,
        },
      },
    }),
)
