import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { DetailDialog, bannerDetailQueryOptions } from "@/features/banners";
import { getQueryClient } from "@/lib/query-client";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export default async function DetailPage({ searchParams }: Props) {
  const { id } = await searchParams;
  if (!id) notFound();

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(bannerDetailQueryOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DetailDialog id={id} asModal={false} />
    </HydrationBoundary>
  );
}
