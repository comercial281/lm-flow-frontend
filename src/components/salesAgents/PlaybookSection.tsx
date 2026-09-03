import { useCallback, useEffect, useState } from 'react';
import { Button, Label, Textarea } from '@/components/ui/ds';
import { Loader2, RotateCcw, ScrollText } from 'lucide-react';
import { salesAgentsService, type AgentPlaybook, type IntentQuestionMode, type PlaybookBlock } from '@/services/salesAgents/salesAgentsService';

// A seção "Roteiro da conversa" — os blocos do comando da IA que até aqui eram
// texto fixo, sem tela nenhuma.
//
// O que ela conserta: o dono do produto tentou, em todos os campos que a tela
// oferecia, fazer a IA parar de perguntar "é pra morar ou é investimento?" — e ela
// continuou. A pergunta tinha CINCO fontes e só uma era editável (a redação, em
// Recepção inicial). As outras quatro viviam por dentro: a ordem da abertura, o
// roteiro que ramifica a partir dela, o método consultivo e a ficha que ela
// preenche a cada resposta.
//
// Por isso o seletor do topo NÃO é "mais um campo de texto": ele governa as cinco
// de uma vez. Ele vem primeiro na seção de propósito — é a decisão que a maioria
// das pessoas vem tomar aqui.

const MODE_LABELS: Record<IntentQuestionMode, { label: string; hint: string }> = {
  always: {
    label: 'Sempre',
    hint: 'Ela abre a conversa com a pergunta e conduz a partir da resposta (moradia / investimento / sondando). É como sempre funcionou.',
  },
  opening_only: {
    label: 'Só na abertura',
    hint: 'Ela pergunta na primeira mensagem, mas não volta a cobrar no meio da conversa: deduz pelo que o lead falar.',
  },
  never: {
    label: 'Nunca',
    hint: 'Ela não pergunta em momento nenhum. Abre com uma pergunta aberta e deduz a intenção pelo que o lead conta.',
  },
};

export default function PlaybookSection({
  agentId,
  playbook,
  onSave,
}: {
  agentId: string;
  /** O roteiro já reescrito neste cliente. Chave ausente = padrão de fábrica. */
  playbook: Record<string, string> | undefined;
  onSave: (patch: { playbook: Record<string, string> }) => void;
}) {
  const [data, setData] = useState<AgentPlaybook | null>(null);
  const [loading, setLoading] = useState(true);
  // Rascunho por bloco: o texto só vai pro servidor no blur, como o resto da tela.
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setData(await salesAgentsService.playbook(agentId));
    } catch {
      // Leitura de fundo NÃO grita: a seção some e o resto da tela continua de pé.
      // É a regra da casa desde os avisos vermelhos de permissão.
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="border-t border-border pt-5">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando o roteiro...
        </p>
      </div>
    );
  }

  if (!data) return null;

  const current = playbook ?? {};

  // Grava o roteiro inteiro de uma vez: o PATCH da tela é campo a campo, e mandar
  // só a chave alterada apagaria as outras.
  const write = (next: Record<string, string>) => onSave({ playbook: next });

  const setMode = (mode: IntentQuestionMode) => {
    write({ ...current, intent_question_mode: mode });
    // O modo muda o TEXTO DE FÁBRICA de cinco blocos. Sem recarregar, a tela
    // seguiria mostrando o roteiro do modo anterior como se fosse o que a IA
    // recebe — e é exatamente essa divergência que a seção veio acabar.
    setData({ ...data, intent_question_mode: mode });
    setDraft({});
    window.setTimeout(() => { void load(); }, 400);
  };

  const saveBlock = (block: PlaybookBlock, text: string) => {
    const trimmed = text.trim();
    const next = { ...current };

    // Vazio = HERDA, nunca "desliga". Apagar o texto devolve o bloco ao padrão de
    // fábrica; gravar string vazia tiraria o bloco do comando da IA.
    if (!trimmed || trimmed === block.factory_default.trim()) {
      delete next[block.key];
    } else {
      next[block.key] = trimmed;
    }

    write(next);
    setDraft((d) => { const c = { ...d }; delete c[block.key]; return c; });
    window.setTimeout(() => { void load(); }, 400);
  };

  const reset = (block: PlaybookBlock) => {
    const next = { ...current };
    delete next[block.key];
    write(next);
    setDraft((d) => ({ ...d, [block.key]: block.factory_default }));
    window.setTimeout(() => { void load(); }, 400);
  };

  return (
    <div className="border-t border-border pt-5 space-y-4">
      <div>
        <Label className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" /> Roteiro da conversa
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          O que a IA recebe por dentro: como ela abre, o que descobre, como responde objeção e
          como chama o que você vende. Campo em branco usa o padrão da casa.
        </p>
      </div>

      {/* O seletor vem primeiro: é a decisão que a maioria vem tomar aqui. */}
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <Label className="text-sm">Perguntar se é moradia ou investimento</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.intent_question_modes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                data.intent_question_mode === mode
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {MODE_LABELS[mode]?.label ?? mode}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {MODE_LABELS[data.intent_question_mode]?.hint}
        </p>
      </div>

      {data.blocks.map((block) => {
        const value = draft[block.key] ?? block.content;

        return (
          <div key={block.key}>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`pb-${block.key}`} className="text-sm">
                {block.label}
                {block.customized && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    reescrito
                  </span>
                )}
              </Label>
              {block.customized && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => reset(block)}
                >
                  <RotateCcw className="h-3 w-3" /> Voltar ao padrão
                </Button>
              )}
            </div>
            <Textarea
              id={`pb-${block.key}`}
              rows={block.key === 'vocabulary' ? 1 : 6}
              className="mt-1 font-mono text-[11px] leading-relaxed"
              value={value}
              onChange={(e) => setDraft((d) => ({ ...d, [block.key]: e.target.value }))}
              onBlur={(e) => saveBlock(block, e.target.value)}
            />
          </div>
        );
      })}

      <p className="text-[11px] text-muted-foreground">
        Os trechos entre chaves ({'{origem}'}, {'{pergunta_intencao}'}, {'{janelas}'}) são
        preenchidos na hora da conversa, com os dados daquele lead. Apagá-los tira a informação
        do texto que a IA recebe.
      </p>
    </div>
  );
}
