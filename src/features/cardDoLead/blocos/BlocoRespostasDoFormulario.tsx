// src/features/cardDoLead/blocos/BlocoRespostasDoFormulario.tsx
// Respostas do formulário: 4 e "Ver todas".
import { useState } from 'react';
import type { PipelineItem } from '@/types/analytics';
import { RESPOSTAS_VISIVEIS, contatoDoCard, respostasDoLead } from '../cardDoLead';
import CaixaDoCard from './CaixaDoCard';

/** `semCaixa`: só o conteúdo, inteiro (sem "Ver todas"), pra dentro da caixa "Sobre o lead" da janela. */
export default function BlocoRespostasDoFormulario({ item, semCaixa = false }: { item: PipelineItem; semCaixa?: boolean }) {
  const respostas = respostasDoLead(contatoDoCard(item));
  const [todas, setTodas] = useState(false);
  const visiveis = todas || semCaixa ? respostas : respostas.slice(0, RESPOSTAS_VISIVEIS);
  if (semCaixa) {
    return (
      <div>
        <h5 className="mb-2 text-xs font-semibold text-foreground">Respostas do formulário</h5>
        {respostas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este lead não respondeu formulário.</p>
        ) : (
          <dl className="space-y-2.5">
            {respostas.map((r, i) => (
              <div key={`${r.label}-${i}`} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground capitalize">{r.label}</dt>
                <dd className="text-sm break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }
  return (
    <CaixaDoCard titulo="Respostas do formulário">
      {respostas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este lead não respondeu formulário.</p>
      ) : (
        <>
          {/* A chave leva o índice: pergunta repetida tem o mesmo rótulo. */}
          <dl className="space-y-2.5">
            {visiveis.map((r, i) => (
              <div key={`${r.label}-${i}`} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground capitalize">{r.label}</dt>
                <dd className="text-sm font-medium break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
          {respostas.length > RESPOSTAS_VISIVEIS && (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setTodas(v => !v)}>
              {todas ? 'Ver menos' : `Ver todas (${respostas.length})`}
            </button>
          )}
        </>
      )}
    </CaixaDoCard>
  );
}
