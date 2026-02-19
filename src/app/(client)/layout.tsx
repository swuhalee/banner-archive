import Link from "next/link";
import UploadNavLink from "./_components/upload-nav-link";

export default function ClientLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      <header className="site-header">
        <div className="container nav-wrap">
          <Link href="/" className="brand whitespace-nowrap">
            Banner Archive
          </Link>
          <div className="flex w-full max-w-[70vw] items-center justify-between gap-3 md:max-w-none md:pl-6">
            <nav className="flex items-center gap-4 overflow-x-auto" aria-label="주요 메뉴">
              <Link
                href="/archive"
                className="px-3 py-2 text-[13px] font-medium text-[var(--text-muted)] hover:shadow-[inset_0_-1.5px_0_var(--line-strong)] active:shadow-[inset_0_-1.5px_0_var(--line-strong)]"
              >
                아카이브
              </Link>
              <Link
                href="/collections"
                className="px-4 py-2 text-[13px] font-medium text-[var(--text-muted)] hover:shadow-[inset_0_-1.5px_0_var(--line-strong)] active:shadow-[inset_0_-1.5px_0_var(--line-strong)]"
              >
                컬렉션
              </Link>
            </nav>

            <UploadNavLink />
          </div>
        </div>
      </header>
      <main className="container page">{children}</main>
      {modal}
    </>
  );
}
