import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { bannerListQueryOptions } from '@/features/banners'
import { getQueryClient } from '@/lib/query-client'
import HomeContent, { HOME_PARAMS } from './_components/home-content'

export default async function HomePage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(bannerListQueryOptions(HOME_PARAMS))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeContent />
    </HydrationBoundary>
  )
}
