import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { bannerListQueryOptions } from '@/features/banners'
import { getQueryClient } from '@/lib/query-client'
import ArchiveContent, { ARCHIVE_DEFAULT_PARAMS } from './_components/archive-content'

export default async function ArchivePage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(bannerListQueryOptions(ARCHIVE_DEFAULT_PARAMS))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArchiveContent />
    </HydrationBoundary>
  )
}
