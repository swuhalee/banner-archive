import { UploadDialog } from "@/features/uploads";

export const maxDuration = 60;

export default function UploadPage() {
  return <UploadDialog asModal={false} />;
}
