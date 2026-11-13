import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';
import { classeDoNumero } from './destaqueModerno';
import { BLOCO, MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Faixa de números do Moderno (spec 6.2; protótipo `.stats`, `.stat`): a
   faixa de hoje (`sections.stats`, alvo do "Sobre" do menu, `id="sobre"`),
   com os mesmos números (imóveis e cidades contam sozinhos, "24h" fixo), em
   tamanho grande. Quem decide se aparece é o Início (`sections.stats`).
──────────────────────────────────────────────────────────────────────────── */

export default function NumerosModernos({ imoveis, cidades, modo }: { imoveis: number; cidades: number; modo: DestaqueDosTitulos }) {
  const numero = classeDoNumero(modo, { firme: 'text-[clamp(36px,4.2vw,52px)]', italico: 'text-[clamp(44px,5vw,64px)]' });
  const itens: [string, string][] = [
    [String(imoveis), 'imóveis disponíveis'],
    [String(cidades || 1), cidades === 1 ? 'cidade atendida' : 'cidades atendidas'],
    ['24h', 'resposta no WhatsApp'],
  ];
  return (
    <section id="sobre" className={BLOCO}>
      <div className={`${MIOLO} grid grid-cols-3 gap-4 sm:gap-6`}>
        {itens.map(([n, rotulo]) => (
          <div key={rotulo} className="border-t border-[var(--m-line)] pt-4">
            <b className={`block leading-none tabular-nums text-[var(--m-head)] ${numero}`}>{n}</b>
            <span className="mt-2 block text-[13px] text-[var(--m-muted)]">{rotulo}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
