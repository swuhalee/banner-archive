import Link from "next/link";
import { UploadNavLink } from "@/features/uploads";

/*
 * 모든 페이지에 적용되는 공통 레이아웃 
*/
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
          {/* 
            <a> 대신 <Link> 사용하여 Client Side Navigation을 구현함
            Link가 화면에 보이면 해당 경로의 코드를 미리 로드함 (production 환경)
          */}
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
                href="/stats"
                className="px-4 py-2 text-[13px] font-medium text-[var(--text-muted)] hover:shadow-[inset_0_-1.5px_0_var(--line-strong)] active:shadow-[inset_0_-1.5px_0_var(--line-strong)]"
              >
                통계
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
