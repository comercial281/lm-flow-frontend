import { TITULO_PASSOS_FABRICA, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';
import { TituloComDestaque } from '../TituloComDestaque';
import { classeDoNumero } from './destaqueModerno';
import { BLOCO, MIOLO, tituloDeSecao } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   "Como funciona" do Moderno (protótipo `.steps`, `.step`): os mesmos passos
   do Clássico (`home.steps`), em cartões numerados 01, 02… com o traço na cor
   de destaque. Desligado ou sem passo: a seção some.
──────────────────────────────────────────────────────────────────────────── */

export default function ComoFuncionaModerno({ home, modo }: { home: HomeConfig; modo: DestaqueDosTitulos }) {
  const { enabled, title, items } = home.steps;
  if (!enabled || items.length === 0) return null;

  const colunas = items.length === 1 ? '' : items.length === 2 ? 'sm:grid-cols-2' : items.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  const numero = classeDoNumero(modo, { firme: 'text-[40px]', italico: 'text-[48px]' });

  return (
    <section id="como-funciona" className={BLOCO}>
      <div className={MIOLO}>
        <h2 className={`mb-9 ${tituloDeSecao()}`}>
          <TituloComDestaque texto={title.trim() || TITULO_PASSOS_FABRICA} modo={modo} />
        </h2>
        <ol className={`grid grid-cols-1 gap-3 ${colunas}`}>
          {items.map((p, i) => (
            <li key={i} className="flex flex-col gap-2.5 rounded-[20px] border border-[var(--m-line)] bg-[var(--m-surface)] p-6">
              <b className={`block leading-none tabular-nums text-[var(--m-head)] ${numero}`}>{String(i + 1).padStart(2, '0')}</b>
              <span aria-hidden className="mb-1 block h-[3px] w-7 rounded-sm bg-[var(--accent)]" />
              <h3 className="font-[var(--display)] text-[18px] font-semibold tracking-[-0.01em] text-[var(--m-head)]">{p.title}</h3>
              {p.text && <p className="text-[14px] leading-relaxed text-[var(--m-text)]">{p.text}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
