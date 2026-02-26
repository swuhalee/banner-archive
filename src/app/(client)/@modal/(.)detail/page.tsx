import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { DetailDialog, bannerDetailQueryOptions } from "@/features/banners";
import { sanitizeReturnPath } from "@/lib/return-path";
import { getQueryClient } from "@/lib/query-client";

type Props = {
  searchParams: Promise<{ id?: string; from?: string }>;
};

export default async function DetailModalPage({ searchParams }: Props) {
  const { id, from } = await searchParams;
  if (!id) notFound();

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(bannerDetailQueryOptions(id));

  const closeHref = sanitizeReturnPath(from, "/");
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DetailDialog id={id} closeHref={closeHref} />
    </HydrationBoundary>
  );
}
