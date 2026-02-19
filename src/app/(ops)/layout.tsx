export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="ops-shell">
      <section className="ops-panel">{children}</section>
    </main>
  );
}
