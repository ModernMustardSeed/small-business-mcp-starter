export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-ink pt-6">
      <h2 className="text-2xl font-bold leading-none tracking-[-0.045em]">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export function PolicyHeader({ label, children, updated }: { label: string; children: React.ReactNode; updated?: string }) {
  return (
    <>
      <p className="label text-teal">{label}</p>
      <h1 className="mt-4 text-4xl font-bold leading-none tracking-[-0.045em] sm:text-5xl">{children}</h1>
      {updated ? <p className="mt-4 text-ink-2">Last updated {updated}.</p> : null}
    </>
  );
}
