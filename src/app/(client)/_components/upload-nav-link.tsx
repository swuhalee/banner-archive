"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sanitizeReturnPath } from "../_lib/return-path";

export default function UploadNavLink() {
  const pathname = usePathname();
  const from = sanitizeReturnPath(pathname, "/");

  return (
    <Link
      href={`/upload?from=${encodeURIComponent(from)}`}
      className="shrink-0 rounded-md border-[1.5px] border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--text-strong)] hover:border-[var(--line-strong)]"
    >
      업로드
    </Link>
  );
}
