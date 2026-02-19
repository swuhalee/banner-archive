import UploadDialog from "../../_components/upload-dialog";
import { sanitizeReturnPath } from "../../_lib/return-path";

type Props = {
  searchParams: Promise<{ from?: string }>;
};

export default async function UploadModalPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const closeHref = sanitizeReturnPath(from, "/");
  return <UploadDialog closeHref={closeHref} />;
}
