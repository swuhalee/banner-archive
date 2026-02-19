import { notFound } from "next/navigation";
import DetailDialog from "../_components/detail-dialog";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export default async function DetailPage({ searchParams }: Props) {
  const { id } = await searchParams;
  if (!id) notFound();
  return <DetailDialog id={id} asModal={false} />;
}
