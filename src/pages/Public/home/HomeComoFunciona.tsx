import { TITULO_PASSOS_FABRICA, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';

/* ────────────────────────────────────────────────────────────────────────────
   "Como funciona": o passo a passo numerado de como comprar. Opcional
   (home.steps.enabled, desligado de fábrica). Sem nenhum passo escrito, a
   seção não aparece: nada de título solto sem o que mostrar.
──────────────────────────────────────────────────────────────────────────── */

export default function HomeComoFunciona({ home }: { home: HomeConfig }) {
  const { enabled, title, items } = home.steps;
  if (!enabled || items.length === 0) return null;

  const colunas = items.length === 1 ? 'md:grid-cols-1' : items.length === 2 ? 'md:grid-cols-2' : items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4';

  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h2 className="text-center font-[var(--display)] text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
        {title.trim() || TITULO_PASSOS_FABRICA}
      </h2>
      <ol className={`mt-10 grid gap-8 ${colunas}`}>
        {items.map((p, i) => (
          <li key={i} className="flex flex-col items-start text-left">
            <span className="font-[var(--display)] text-5xl font-semibold leading-none text-[var(--brand)]">{i + 1}</span>
            <h3 className="mt-3 font-[var(--display)] text-[20px] font-semibold text-[var(--ink)]">{p.title}</h3>
            {p.text && <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{p.text}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
