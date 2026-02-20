import Link from "next/link";
import { sanitizeReturnPath } from "../_lib/return-path";

type ArchiveItem = {
  id: string;
  region: string;
  image: string;
};

type ArchivePhotoCardProps = {
  item: ArchiveItem;
  fromPath?: string;
};

export default function ArchivePhotoCard({ item, fromPath = "/" }: ArchivePhotoCardProps) {
  const safeFrom = sanitizeReturnPath(fromPath, "/");

  return (
    <article className="group mb-[14px] break-inside-avoid overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
      <Link
        href={`/detail?id=${encodeURIComponent(item.id)}&from=${encodeURIComponent(safeFrom)}`}
        className="relative block"
        aria-label={`${item.region} 상세 보기`}
      >
        <img
          src={item.image}
          alt={item.region}
          className="block w-full grayscale border-b border-[var(--line)]"
        />
        <div
          className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          aria-hidden
        />
        <p className="absolute right-3 bottom-3 left-3 m-0 translate-y-1 text-[13px] font-semibold text-white opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          {item.region}
        </p>
      </Link>
    </article>
  );
}
