import UploadDialog from "@/features/uploads/components/upload-dialog";
import { sanitizeReturnPath } from "@/lib/return-path";

type Props = {
  searchParams: Promise<{ from?: string }>;
};

export default async function UploadModalPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const closeHref = sanitizeReturnPath(from, "/");
  return <UploadDialog closeHref={closeHref} />;
}
