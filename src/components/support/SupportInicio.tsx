import { useMemo, useState } from 'react';
import { Bug, ChevronRight, Lightbulb, MessageCircle, Search, Send } from 'lucide-react';
import { SUPORTE_WHATSAPP_URL } from '@/components/layout/components/Sidebar';
import type { SupportKind } from '@/services/support/supportService';
import { ROTEIRO, type PassoId } from './roteiro';
import { buscarPerguntas } from './buscaRoteiro';

interface Props {
  onPergunta: (id: PassoId) => void;
  onChamado: (kind: SupportKind, rascunho?: string) => void;
}

/** Aba Início: falar com o time, busca + perguntas do roteiro e atalhos. */
export default function SupportInicio({ onPergunta, onChamado }: Props) {
  const [termo, setTermo] = useState('');
  const achadas = useMemo(() => buscarPerguntas(termo), [termo]);

  return (
    <div className="space-y-3 p-3">
      <button
        type="button"
        onClick={() => onChamado('question')}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold shadow-sm hover:bg-accent"
      >
        Falar com o time
        <Send className="h-4 w-4 text-primary" aria-hidden="true" />
      </button>

      <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
        <label className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={termo}
            onChange={e => setTermo(e.target.value)}
            placeholder="Qual é a sua dúvida?"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        {achadas.length > 0 ? (
          <ul className="mt-1">
            {achadas.map(id => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onPergunta(id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {ROTEIRO[id].pergunta}
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2 px-3 py-3 text-sm">
            <p className="text-muted-foreground">Não achei essa dúvida. Quer falar com o time?</p>
            <button type="button" onClick={() => onChamado('question', termo.trim())} className="font-medium text-primary hover:underline">
              Falar com o time
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1 text-sm">
        <button type="button" onClick={() => onChamado('bug')} className="flex items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent">
          <Bug className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Reportar um bug
        </button>
        <button type="button" onClick={() => onChamado('suggestion')} className="flex items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent">
          <Lightbulb className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Dar uma sugestão
        </button>
        <a href={SUPORTE_WHATSAPP_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent">
          <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}
