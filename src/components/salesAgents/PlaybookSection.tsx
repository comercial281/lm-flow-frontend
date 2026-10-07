import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { Loader2, Pencil, Plus, RotateCcw, ScrollText, Trash2, X } from 'lucide-react';
import {
  salesAgentsService,
  type AgentPlaybook,
  type AgentPlaybookConfig,
  type PlaybookBlock,
  type PlaybookObjection,
  type PlaybookVars,
} from '@/services/salesAgents/salesAgentsService';
import { Seletor } from '@/components/base/Seletor';

// A seção "Roteiro da conversa".
//
// Duas metades, nesta ordem de propósito:
//
// 1. PONTOS-CHAVE DA VENDA — o que a imobiliária preenche: o próximo passo, o
//    que dói no cliente-tipo, as objeções e as respostas. É o
//    caminho NORMAL de personalizar a IA. Cada ponto entra num encaixe do alicerce
//    (o método de venda da casa); vazio = exemplo de fábrica.
//
// 2. OS BLOCOS DO COMANDO — mostrados como a IA vai LER (encaixes resolvidos).
//    Reescrever o bloco inteiro continua possível, como válvula de escape, com a
//    lista do que ele aceita entre chaves: marcador fora da lista é recusado pelo
//    servidor, porque iria literal para o modelo.
//
// O que isto consertou: o método consultivo tinha todos os exemplos escritos à
// mão — inclusive "tá procurando pra morar ou investir?" — e o que a imobiliária
// preenchia entrava em OUTRO lugar do comando, numa segunda lista. O modelo
// recebia os dois e escolhia. Agora as perguntas dela entram DENTRO do método.

const RELOAD_DELAY_MS = 400;

function isVars(v: unknown): v is PlaybookVars {
  return typeof v === 'object' && v !== null;
}

export default function PlaybookSection({
  agentId,
  playbook,
  onSave,
}: {
  agentId: string;
  /** O roteiro já gravado neste cliente. Chave ausente = padrão de fábrica. */
  playbook: AgentPlaybookConfig | undefined;
  onSave: (patch: { playbook: AgentPlaybookConfig }) => void;
}) {
  const [data, setData] = useState<AgentPlaybook | null>(null);
  const [loading, setLoading] = useState(true);
  // Rascunho por bloco: o texto só vai pro servidor no blur, como o resto da tela.
  const [draft, setDraft] = useState<Record<string, string>>({});
  // Blocos abertos para reescrever (o padrão é ler o resolvido).
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  // Rascunho dos pontos-chave, também gravado no blur.
  const [vars, setVars] = useState<PlaybookVars>({});

  const load = useCallback(async () => {
    try {
      const fresh = await salesAgentsService.playbook(agentId);
      setData(fresh);
      setVars(fresh.vars ?? {});
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

  const current: AgentPlaybookConfig = playbook ?? {};
  const currentVars: PlaybookVars = isVars(current.vars) ? current.vars : {};

  // Grava o roteiro inteiro de uma vez: o PATCH da tela é campo a campo, e mandar
  // só a chave alterada apagaria as outras.
  const write = (next: AgentPlaybookConfig) => {
    onSave({ playbook: next });
    window.setTimeout(() => { void load(); }, RELOAD_DELAY_MS);
  };

  // --- pontos-chave -------------------------------------------------------

  // Vazio = HERDA o exemplo de fábrica: a chave sai do hash em vez de ir em branco.
  // ⚠️ Onda 3 (06/10/2026): começa do que JÁ está gravado e só mexe nas chaves
  // desta seção (próximo passo, dor, objeções). As outras chaves de `vars` têm dono
  // em outra tela — `caminhos_intencao` (Intenção), `tipo_venda` (Catálogo),
  // `lead_pronto` (Agendamento) — e reescrever a partir de uma lista fixa as apagava.
  const commitVars = (next: PlaybookVars) => {
    const cleaned: PlaybookVars = { ...currentVars };
    if (next.proximo_passo && next.proximo_passo !== 'visita') cleaned.proximo_passo = next.proximo_passo; else delete cleaned.proximo_passo;
    if (next.dor_tipica?.trim()) cleaned.dor_tipica = next.dor_tipica.trim(); else delete cleaned.dor_tipica;
    const objs = (next.objecoes ?? [])
      .map((o) => ({ objecao: o.objecao.trim(), resposta: o.resposta.trim() }))
      .filter((o) => o.objecao && o.resposta);
    if (objs.length) cleaned.objecoes = objs; else delete cleaned.objecoes;

    if (JSON.stringify(cleaned) === JSON.stringify(currentVars)) return;

    const next_config: AgentPlaybookConfig = { ...current };
    if (Object.keys(cleaned).length) next_config.vars = cleaned;
    else delete next_config.vars;
    write(next_config);
  };

  const objecoes: PlaybookObjection[] = vars.objecoes ?? [];
  const setObjecao = (i: number, patch: Partial<PlaybookObjection>) => {
    const next = objecoes.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    setVars({ ...vars, objecoes: next });
  };
  const removeObjecao = (i: number) => {
    const next = objecoes.filter((_, idx) => idx !== i);
    const v = { ...vars, objecoes: next };
    setVars(v);
    commitVars(v);
  };

  // --- blocos --------------------------------------------------------------

  const saveBlock = (block: PlaybookBlock, text: string) => {
    const trimmed = text.trim();
    const next: AgentPlaybookConfig = { ...current };

    // Vazio = HERDA, nunca "desliga". Apagar o texto devolve o bloco ao padrão de
    // fábrica; gravar string vazia tiraria o bloco do comando da IA.
    if (!trimmed || trimmed === block.factory_default.trim()) {
      delete next[block.key];
    } else {
      next[block.key] = trimmed;
    }

    setDraft((d) => { const c = { ...d }; delete c[block.key]; return c; });
    write(next);
  };

  const reset = (block: PlaybookBlock) => {
    const next: AgentPlaybookConfig = { ...current };
    delete next[block.key];
    setDraft((d) => ({ ...d, [block.key]: block.factory_default }));
    write(next);
  };

  const label = (k: string) => data.var_labels[k] ?? k;
  const hint = (k: string) => data.var_hints[k];

  return (
    <div className="border-t border-border pt-5 space-y-4">
      <div>
        <Label className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" /> Roteiro da conversa
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          O método de venda é o da casa. O que muda de imobiliária pra imobiliária são os
          pontos-chave abaixo — eles entram dentro do método, no lugar dos exemplos de
          fábrica. Campo em branco usa o exemplo da casa.
        </p>
      </div>

      {/* ---------------- Pontos-chave da venda ---------------- */}
      <div className="rounded-md border border-border p-3 space-y-4">
        <div>
          <p className="text-sm font-medium">Pontos-chave da venda</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            É aqui que a IA vira a SUA IA. Cada ponto entra no lugar de um exemplo de
            fábrica dentro do método.
          </p>
        </div>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="pv-passo" className="text-xs">{label('proximo_passo')}</Label>
            <Seletor
              id="pv-passo"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={vars.proximo_passo ?? 'visita'}
              onChange={(e) => {
                const v = { ...vars, proximo_passo: e.target.value };
                setVars(v);
                commitVars(v);
              }}
            >
              {data.next_steps.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Seletor>
            <p className="text-[11px] text-muted-foreground mt-1">{hint('proximo_passo')}</p>
          </div>
        </div>

        <div>
          <Label htmlFor="pv-dor" className="text-xs">{label('dor_tipica')}</Label>
          <Textarea
            id="pv-dor"
            rows={2}
            placeholder="Ex: paga aluguel caro e quer parar de jogar dinheiro fora"
            value={vars.dor_tipica ?? ''}
            onChange={(e) => setVars({ ...vars, dor_tipica: e.target.value })}
            onBlur={() => commitVars(vars)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">{hint('dor_tipica')}</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{label('objecoes')}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setVars({ ...vars, objecoes: [...objecoes, { objecao: '', resposta: '' }] })}
            >
              <Plus className="h-3 w-3" /> Objeção
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{hint('objecoes')}</p>

          {objecoes.length === 0 ? (
            <p className="mt-2 rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
              Usando as {data.slot_defaults.objecoes.length} de fábrica:{' '}
              {data.slot_defaults.objecoes.map((o) => o.objecao).join(' · ')}
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {objecoes.map((o, i) => (
                <div key={i} className="rounded-md border border-border p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="O que o lead diz (ex: tá caro)"
                      value={o.objecao}
                      onChange={(e) => setObjecao(i, { objecao: e.target.value })}
                      onBlur={() => commitVars(vars)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground"
                      aria-label="Remover objeção"
                      onClick={() => removeObjecao(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Como vocês respondem"
                    value={o.resposta}
                    onChange={(e) => setObjecao(i, { resposta: e.target.value })}
                    onBlur={() => commitVars(vars)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Os blocos, como a IA vai ler ---------------- */}
      <div>
        <p className="text-sm font-medium">O que a IA recebe</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Cada bloco já com os seus pontos-chave no lugar. Reescrever o bloco inteiro é
          o caminho de exceção — os trechos entre chaves são os encaixes, e cada bloco
          só aceita os dele.
        </p>
      </div>

      {data.blocks.map((block) => {
        const open = editing[block.key] === true;
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
              <div className="flex items-center gap-1">
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setEditing((e) => ({ ...e, [block.key]: !open }))}
                >
                  {open ? <><X className="h-3 w-3" /> Fechar</> : <><Pencil className="h-3 w-3" /> Reescrever</>}
                </Button>
              </div>
            </div>

            {open ? (
              <>
                <Textarea
                  id={`pb-${block.key}`}
                  rows={block.key === 'vocabulary' ? 1 : 8}
                  className="mt-1 font-mono text-[11px] leading-relaxed"
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [block.key]: e.target.value }))}
                  onBlur={(e) => saveBlock(block, e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Este bloco aceita:{' '}
                  {block.allowed_markers.map((m) => (
                    <code key={m} className="mr-1 rounded bg-muted px-1 py-0.5 text-[10px]">{`{${m}}`}</code>
                  ))}
                </p>
              </>
            ) : (
              <pre
                id={`pb-${block.key}`}
                className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground"
              >
                {block.resolved}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
