// src/features/cardDoLead/pagina/CardDoLeadHeader.tsx
// Topo da página do card (11/10/2026, escolha do dono: "cartão da pessoa").
// Um cartão com três partes: quem é (foto no lugar da barrinha, nome, selo da
// situação e desde quando está no funil), os dados da pessoa (telefone, origem,
// e-mail, roleta) e as ações (Responsável, Ganho | Perdido, ⋯), que a página
// entrega prontas.
//
// Diagramação pela largura DO CARTÃO (não da janela: com o menu lateral aberto
// numa tela média sobra pouco espaço): a partir de 64rem, as três lado a lado
// (a coluna do nome só com a largura que precisa, até 22rem, pra sobrar espaço
// pro e-mail); a partir de 36rem, quem é e as ações em cima e os dados embaixo;
// menos que isso (celular), uma embaixo da outra (quem é, dados, ações). Lead
// fechado: o selo fica só ao lado do nome.
//
// O nome continua saindo do BaseHeader (trava `tituloAMao`), e o arquivo
// termina em Header.tsx pra trava `foraDaMoldura` tratar o cartão como embrulho
// do cabeçalho da casa: a página que o usa tem de estar na Pagina.
import type { ReactNode } from 'react';
import BaseHeader from '@/components/base/BaseHeader';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { VAZIO, dataCurta, tempoDesde } from '@/lib/formato';
import { DadosDaPessoa } from '../blocos/BlocoIdentidade';
import type { CardDoLead } from '../useCardDoLead';

/** "Entrou no funil em 26/09 · há 14 dias" (a data é a do card, não a do contato). */
export function desdeQuandoNoFunil(criadoEm: unknown, agora: Date = new Date()): string | undefined {
  const dia = dataCurta(criadoEm);
  if (dia === VAZIO) return undefined;
  return `Entrou no funil em ${dia} · ${tempoDesde(criadoEm as string | number, agora)}`;
}

interface CardDoLeadHeaderProps {
  card: CardDoLead;
  /** Quando o card nasceu (`created_at` do item do funil). */
  criadoEm?: string | number | null;
  /** O selo da situação (Ganho/Perdido), ao lado do nome. */
  aoLadoDoTitulo?: ReactNode;
  /** Responsável, Ganho | Perdido (ou Reabrir) e o ⋯. */
  acoes: ReactNode;
}

export default function CardDoLeadHeader({ card, criadoEm, aoLadoDoTitulo, acoes }: CardDoLeadHeaderProps) {
  return (
    <div className="@container">
      <section
        aria-label="Quem é o lead"
        className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border border-border bg-card p-4 @xl:grid-cols-[minmax(0,1fr)_16rem] @xl:p-5 @5xl:grid-cols-[fit-content(22rem)_minmax(0,1fr)_16rem] @5xl:items-center @5xl:gap-6"
      >
        <BaseHeader
          title={card.nomeExibido}
          foto={card.avatarContact
            ? <ContactAvatar contact={card.avatarContact} size="lg" showColoredFallback className="shrink-0" />
            : undefined}
          aoLadoDoTitulo={aoLadoDoTitulo}
          subtitle={desdeQuandoNoFunil(criadoEm)}
          className="min-w-0 @xl:col-start-1 @xl:row-start-1"
        />
        <DadosDaPessoa
          card={card}
          className="border-t border-border pt-4 @xl:col-span-2 @xl:row-start-2 @5xl:col-span-1 @5xl:col-start-2 @5xl:row-start-1 @5xl:border-l @5xl:border-t-0 @5xl:pl-5 @5xl:pt-0"
        />
        <div className="grid min-w-0 gap-2 @xl:col-start-2 @xl:row-start-1 @5xl:col-start-3">{acoes}</div>
      </section>
    </div>
  );
}
