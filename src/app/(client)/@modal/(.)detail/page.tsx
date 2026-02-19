import { notFound } from "next/navigation";
import DetailDialog from "../../_components/detail-dialog";
import { sanitizeReturnPath } from "../../_lib/return-path";

type Props = {
  searchParams: Promise<{ id?: string; from?: string }>;
};

export default async function DetailModalPage({ searchParams }: Props) {
  const { id, from } = await searchParams;
  if (!id) notFound();
  const closeHref = sanitizeReturnPath(from, "/");
  return <DetailDialog id={id} closeHref={closeHref} />;
}
