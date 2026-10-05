import { useEffect, useState } from 'react';
import { Input, Label } from '@/components/ui/ds';
import { type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { Toggle } from '../comum';

/**
 * Curtir mensagem do cliente.
 *
 * A curtida SAI no WhatsApp do lead — não é marca interna —, então a lista de
 * emojis é decisão de marca da imobiliária, não do modelo. Nasce desligada:
 * ligar por padrão faria a IA começar a reagir no WhatsApp de leads de quem
 * nunca pediu.
 */
const REACTION_EMOJI_OPTIONS = ['👍', '❤️', '😂', '🙏', '🔥', '👏', '😍', '✅', '🎉', '😉'];

export function ReactionSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const on = !!agent.reaction_enabled;
  const selecionados = agent.reaction_emojis ?? [];

  // O teto tem estado PRÓPRIO enquanto se digita, e só grava ao sair do campo.
  // Gravando a cada tecla, digitar "10" salvava 1 e depois 10; e apagar a caixa
  // pra redigitar salvava ZERO, que aqui quer dizer DESLIGAR a curtida.
  const [teto, setTeto] = useState(String(agent.reaction_max_per_conversation ?? 3));
  useEffect(() => {
    setTeto(String(agent.reaction_max_per_conversation ?? 3));
  }, [agent.id, agent.reaction_max_per_conversation]);

  // Caixa vazia ao sair = "não mexi", nunca zero: zero é uma escolha destrutiva
  // (desliga a curtida) e ninguém a faz apagando um campo pra redigitar.
  const gravarTeto = () => {
    const texto = teto.trim();
    if (texto === '' || Number.isNaN(Number(texto))) {
      setTeto(String(agent.reaction_max_per_conversation ?? 3));
      return;
    }
    onSave({ reaction_max_per_conversation: Number(texto) });
  };

  const alternar = (emoji: string) => {
    const proxima = selecionados.includes(emoji)
      ? selecionados.filter((e) => e !== emoji)
      : [...selecionados, emoji];
    // Lista vazia volta a valer o padrão de fábrica no servidor — nunca "nenhum
    // emoji", que seria indistinguível de a curtida estar quebrada.
    onSave({ reaction_emojis: proxima });
  };

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Curtir mensagens do cliente</div>
          <div className="text-xs text-muted-foreground">
            A IA reage com emoji na mensagem do lead, como uma pessoa faz. A curtida aparece no
            WhatsApp dele. Serve pra fechar conversa sem esticar: um "obrigado, até amanhã!" recebe
            um 👍 em vez de mais uma mensagem.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ reaction_enabled: v })} rotulo="curtir mensagens do cliente" />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-1">
          <div>
            <Label className="text-xs">Emojis que ela pode usar</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REACTION_EMOJI_OPTIONS.map((emoji) => {
                const ativo = selecionados.includes(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => alternar(emoji)}
                    aria-pressed={ativo}
                    className={`h-9 w-9 rounded-md border text-lg leading-none transition ${
                      ativo
                        ? 'border-primary bg-primary/10'
                        : 'border-sidebar-border bg-background opacity-50 hover:opacity-100'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum marcado = a IA usa a lista padrão (👍 ❤️ 😂 🙏 🔥).
            </p>
          </div>

          <div>
            <Label htmlFor="reaction_max" className="text-xs">No máximo quantas curtidas por conversa</Label>
            <Input
              id="reaction_max"
              type="number"
              min={0}
              max={20}
              value={teto}
              onChange={(e) => setTeto(e.target.value)}
              onBlur={gravarTeto}
              className="mt-1 w-28"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Curtida demais deixa de ser gentileza e vira ruído. Zero desliga a curtida.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
