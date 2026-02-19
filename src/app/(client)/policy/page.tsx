export default function PolicyPage() {
  return (
    <div className="stack-lg">
      <section className="grid gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <h1>운영 정책</h1>
        <p className="text-[13px] text-[var(--text-muted)]">서비스는 신고가 아닌 기록 아카이빙을 목적으로 운영됩니다.</p>
      </section>

      <section className="grid grid-cols-2 gap-4 max-[1024px]:grid-cols-1">
        <article className="grid gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2>핵심 원칙</h2>
          <p>1. 번호판/시민 얼굴/현수막 인물 얼굴 자동 마스킹</p>
          <p>2. 중복 현수막은 이미지 저장 없이 관측일만 갱신</p>
          <p>3. 기록 목적 운영, 공격적 문구 금지</p>
        </article>
        <article className="grid gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2>삭제 요청</h2>
          <p>삭제 요청은 상세 페이지 옵션 메뉴에서 모달로 접수됩니다.</p>
          <p className="text-[13px] text-[var(--text-muted)]">SLA: 24시간 내 1차 검토, 3영업일 내 최종 처리</p>
        </article>
      </section>
    </div>
  );
}
