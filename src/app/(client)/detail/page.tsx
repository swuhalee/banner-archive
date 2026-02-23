import { notFound } from "next/navigation";
import { DetailDialog } from "@/features/banners";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export default async function DetailPage({ searchParams }: Props) {
  const { id } = await searchParams;
  if (!id) notFound();

  // 페이지 형태로 상세 정보 보여주기
  // reload나 detail dialog의 주소로 접근했을 때 페이지로 보여주기 위해 asModal을 false로 설정
  return <DetailDialog id={id} asModal={false} />;
}
