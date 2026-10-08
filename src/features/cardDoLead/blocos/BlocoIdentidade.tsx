// src/features/cardDoLead/blocos/BlocoIdentidade.tsx
// Quem é o lead. Na janela: foto, nome grande, telefone, e-mail e o selo da
// origem, com os botões do topo ao lado. Na página o nome já é o título: o
// bloco vira "Dados da pessoa". Nome, telefone e e-mail não se editam no card;
// o lápis só aparece com `identity_correctable` do servidor (decisão de 02/10).
import type { ReactNode } from 'react';
import { Mail, Pencil, Phone } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { VAZIO, telefone } from '@/lib/formato';
import SeloSituacao from '@/features/pipelines/situacao/SeloSituacao';
import { detalheDaSituacao, situacaoDe } from '@/features/pipelines/situacao/situacao';
import { classeDaOrigem } from '../cardDoLead';
import type { CardDoLead } from '../useCardDoLead';
import CaixaDoCard from './CaixaDoCard';

interface BlocoIdentidadeProps {
  card: CardDoLead;
  variante?: 'janela' | 'pagina';
  /** Janela: os botões do topo (Ver card completo e ⋯). */
  acoes?: ReactNode;
}

export default function BlocoIdentidade({ card, variante = 'janela', acoes }: BlocoIdentidadeProps) {
  const { contato, avatarContact, nomeExibido, origem, dadosDaOrigem, corrigivel, identidade, situacao } = card;

  const lapis = corrigivel && contato?.id != null ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      aria-label="Corrigir telefone ou e-mail"
      title="Corrigir telefone ou e-mail"
      onClick={() => identidade.setCorrigindo(true)}
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  ) : null;

  // Origem como selo, junto de quem é o lead.
  const seloDaOrigem = origem ? (
    <span
      className={`mt-2 inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ${classeDaOrigem(dadosDaOrigem)}`}
      title={origem}
    >
      <span className="truncate">{origem}</span>
    </span>
  ) : null;

  if (variante === 'pagina') {
    return (
      <CaixaDoCard titulo="Dados da pessoa" acao={lapis}>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Telefone</dt>
            <dd className="lm-redact">{identidade.telefone ? telefone(identidade.telefone) : VAZIO}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">E-mail</dt>
            <dd className="truncate" title={identidade.email || undefined}>{identidade.email || VAZIO}</dd>
          </div>
        </dl>
        {seloDaOrigem}
      </CaixaDoCard>
    );
  }

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
        {seloDaOrigem}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {lapis}
        {acoes}
      </div>
    </div>
  );
}
