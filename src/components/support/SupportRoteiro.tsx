import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUPORTE_WHATSAPP_URL } from '@/components/layout/components/Sidebar';
import type { SupportKind } from '@/services/support/supportService';
import { ROTEIRO, type Opcao, type PassoId } from './roteiro';

interface Props {
  inicio: PassoId;
  onChamado: (kind: SupportKind, origem: { subject: string; faqTopic: PassoId }) => void;
  onInicio: () => void;
}

/**
 * A conversa do roteiro: cada passo vira balões do "Suporte LM Flow"; a opção
 * escolhida vira balão da pessoa. Só as opções do ÚLTIMO passo ficam clicáveis.
 */
export default function SupportRoteiro({ inicio, onChamado, onInicio }: Props) {
  const navigate = useNavigate();
  const [caminho, setCaminho] = useState<{ passo: PassoId; escolha?: string }[]>([{ passo: inicio }]);
  const atual = caminho[caminho.length - 1].passo;

  const escolher = (op: Opcao) => {
    const a = op.acao;
    if ('vai' in a) {
      setCaminho([...caminho.slice(0, -1), { passo: atual, escolha: op.rotulo }, { passo: a.vai }]);
    } else if ('chamado' in a) {
      onChamado(a.chamado, { subject: ROTEIRO[inicio].pergunta ?? op.rotulo, faqTopic: inicio });
    } else if ('guia' in a) {
      navigate(a.guia);
    } else if ('whatsapp' in a) {
      window.open(SUPORTE_WHATSAPP_URL, '_blank', 'noreferrer');
    } else {
      onInicio();
    }
  };

  return (
    <div className="space-y-3 p-3">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
        {ROTEIRO[inicio].pergunta}
      </p>
      {caminho.map(({ passo, escolha }, i) => (
        <div key={`${passo}-${i}`} className="space-y-2">
          {ROTEIRO[passo].texto.map(t => (
            <p key={t} className="w-fit max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm">
              {t}
            </p>
          ))}
          {escolha && (
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{escolha}</p>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        {ROTEIRO[atual].opcoes.map(op => (
          <button
            key={op.rotulo}
            type="button"
            onClick={() => escolher(op)}
            className="rounded-full border border-primary/40 px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
          >
            {op.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
