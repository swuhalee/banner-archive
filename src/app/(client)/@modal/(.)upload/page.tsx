import { UploadDialog } from "@/features/uploads";
import { sanitizeReturnPath } from "@/lib/return-path";

export const maxDuration = 60;

type Props = {
  searchParams: Promise<{ from?: string }>;
};

export default async function UploadModalPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const closeHref = sanitizeReturnPath(from, "/");
  return <UploadDialog closeHref={closeHref} />;
}
