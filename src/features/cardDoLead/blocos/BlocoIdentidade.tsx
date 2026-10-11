// src/features/cardDoLead/blocos/BlocoIdentidade.tsx
// Quem é o lead. Na janela: foto, nome grande, telefone, e-mail e o selo da
// origem, com os botões do topo ao lado. Na página (11/10/2026, "cartão da
// pessoa") os dados vão pro cartão do topo (`DadosDaPessoa`, no
// CardDoLeadHeader) e a Ficha não tem mais a caixa "Dados da pessoa". Nome,
// telefone e e-mail não se editam no card; o lápis só aparece com
// `identity_correctable` do servidor (decisão de 02/10).
import type { ReactNode } from 'react';
import { Mail, Pencil, Phone } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { VAZIO, telefone } from '@/lib/formato';
import SeloSituacao from '@/features/pipelines/situacao/SeloSituacao';
import { detalheDaSituacao, situacaoDe } from '@/features/pipelines/situacao/situacao';
import { classeDaOrigem } from '../cardDoLead';
import type { CardDoLead } from '../useCardDoLead';

function LapisDeCorrigir({ card }: { card: CardDoLead }) {
  const { corrigivel, contato, identidade } = card;
  if (!corrigivel || contato?.id == null) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 shrink-0 p-0"
      aria-label="Corrigir telefone ou e-mail"
      title="Corrigir telefone ou e-mail"
      onClick={() => identidade.setCorrigindo(true)}
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}

function SeloDaOrigem({ card, className = '' }: { card: CardDoLead; className?: string }) {
  const { origem, dadosDaOrigem } = card;
  if (!origem) return null;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ${classeDaOrigem(dadosDaOrigem)} ${className}`}
      title={origem}
    >
      <span className="truncate">{origem}</span>
    </span>
  );
}

function Campo({ rotulo, title, className = '', children }: {
  rotulo: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="truncate font-medium" title={title}>{children}</dd>
    </div>
  );
}

/**
 * Página do card: telefone, origem, e-mail e roleta no cartão do topo. Com o
 * cartão estreito (celular) o e-mail ocupa a linha inteira (não corta); a
 * roleta só aparece quando o lead veio por uma.
 */
export function DadosDaPessoa({ card, className = '' }: { card: CardDoLead; className?: string }) {
  const { identidade, roletaDoLead } = card;
  return (
    <div role="group" aria-label="Dados da pessoa" className={`flex min-w-0 items-start gap-2 ${className}`}>
      <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-3 text-sm">
        <Campo rotulo="Telefone">
          <span className="lm-redact">{identidade.telefone ? telefone(identidade.telefone) : VAZIO}</span>
        </Campo>
        <Campo rotulo="Origem">{card.origem ? <SeloDaOrigem card={card} className="py-0.5" /> : VAZIO}</Campo>
        <Campo rotulo="E-mail" title={identidade.email || undefined} className="col-span-2 @xl:col-span-1">
          {identidade.email || VAZIO}
        </Campo>
        {roletaDoLead && <Campo rotulo="Roleta" title={roletaDoLead}>{roletaDoLead}</Campo>}
      </dl>
      <LapisDeCorrigir card={card} />
    </div>
  );
}

interface BlocoIdentidadeProps {
  card: CardDoLead;
  /** Os botões do topo da janela (Ver card completo e ⋯). */
  acoes?: ReactNode;
}

export default function BlocoIdentidade({ card, acoes }: BlocoIdentidadeProps) {
  const { avatarContact, nomeExibido, identidade, situacao } = card;

  return (
    <div className="flex items-start gap-3 pr-6">
      {avatarContact && (
        <ContactAvatar contact={avatarContact} size="md" showColoredFallback className="shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {/* O selo da situação (Parte 3) fica ao lado do nome; na página ele vai no título. */}
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xl font-semibold leading-tight lm-redact" title={nomeExibido}>{nomeExibido}</p>
          <SeloSituacao
            status={situacaoDe(situacao.item)}
            detalhe={detalheDaSituacao(situacao.item)}
            className="shrink-0"
          />
        </div>
        {identidade.telefone && (
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> {telefone(identidade.telefone)}
          </p>
        )}
        {identidade.email && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate" title={identidade.email}>
            <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{identidade.email}</span>
          </p>
        )}
        <SeloDaOrigem card={card} className="mt-2" />
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <LapisDeCorrigir card={card} />
        {acoes}
      </div>
    </div>
  );
}
