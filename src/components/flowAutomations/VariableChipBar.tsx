import { createContext, useContext, useEffect, useState, type RefObject } from 'react';
import { tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';
import {
  BUILTIN_MESSAGE_VARIABLES,
  FEATURED_VARIABLE_TOKENS,
  insertAtCursor,
  withTenantVariables,
  type MessageVariable,
} from '@/features/flowAutomations/messageVariables';
import { Button } from '@/components/ui/ds';
import { cn } from '@/lib/utils';

// Botõezinhos de variável embaixo de uma caixa de mensagem (sprint 4, A.4).
// Um clique põe `{{variável}}` onde o cursor está. A lista vem do contexto: o
// construtor carrega as variáveis da imobiliária uma vez e passa pra todo
// bloco; fora dele (tela de regras), só as prontas.
//
// Barra única de variáveis do sistema (27/10/2026): em TODA caixa de mensagem
// (construtor, Disparo em massa, Agendar mensagem, Funis, Roleta, Book) só Nome,
// Corretor e Imóvel ficam à vista e o resto vai em "Mais variáveis". Antes só o
// construtor recolhia; as outras telas despejavam a lista inteira.

export const MessageVariablesContext = createContext<MessageVariable[]>(BUILTIN_MESSAGE_VARIABLES);

const GRUPOS: { key: 'lead' | 'visita' | 'anuncio' | 'imobiliaria'; titulo: string }[] = [
  { key: 'lead', titulo: 'Do lead' },
  { key: 'visita', titulo: 'Da visita (só nos gatilhos de visita)' },
  { key: 'anuncio', titulo: 'Do anúncio' },
  { key: 'imobiliaria', titulo: 'Da imobiliária' },
];

/** As prontas + as da imobiliária. Erro de leitura = só as prontas (nunca trava a tela). */
export function useTenantMessageVariables(): MessageVariable[] {
  const [variables, setVariables] = useState<MessageVariable[]>(BUILTIN_MESSAGE_VARIABLES);
  useEffect(() => {
    let alive = true;
    tenantTemplateVariablesService
      .list()
      .then(response => {
        if (alive) setVariables(withTenantVariables(BUILTIN_MESSAGE_VARIABLES, response));
      })
      .catch(() => {
        // fica com as prontas
      });
    return () => {
      alive = false;
    };
  }, []);
  return variables;
}

type InsertMode =
  /** Põe no cursor da caixa apontada por `targetRef`. */
  | { targetRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>; value: string; onChange: (next: string) => void; onInsert?: never }
  /** Quem chama decide onde pôr (ex.: no fim do campo). */
  | { onInsert: (token: string) => void; targetRef?: never; value?: never; onChange?: never };

type Props = InsertMode & {
  /** Lista própria; sem ela, a do contexto. */
  variables?: MessageVariable[];
  className?: string;
};

export function VariableChipBar(props: Props) {
  const fromContext = useContext(MessageVariablesContext);
  const variables = props.variables ?? fromContext;
  const [maisAberto, setMaisAberto] = useState(false);

  const insert = (token: string) => {
    if (props.onInsert) {
      props.onInsert(token);
      return;
    }
    const el = props.targetRef.current;
    const { text, cursor } = insertAtCursor(props.value, token, el?.selectionStart, el?.selectionEnd);
    props.onChange(text);
    // Depois do redesenho, o cursor volta pra caixa logo depois da variável.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  if (variables.length === 0) return null;

  const chip = (v: MessageVariable) => (
    <button
      key={v.token}
      type="button"
      // Não tira o foco da caixa: é o que mantém a posição do cursor.
      onMouseDown={e => e.preventDefault()}
      onClick={() => insert(v.token)}
      title={v.description ? `${v.description} · ${v.token}` : v.token}
      className={cn(
        'text-xs px-2 py-0.5 rounded-full border transition-colors',
        v.custom
          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-input bg-muted/40 hover:bg-muted',
      )}
    >
      {v.label} {v.token}
    </button>
  );

  // Ordem à vista = ordem de FEATURED_VARIABLE_TOKENS.
  const destaque = FEATURED_VARIABLE_TOKENS.flatMap(t => variables.filter(v => v.token === t));
  const resto = variables.filter(v => !FEATURED_VARIABLE_TOKENS.includes(v.token));
  const grupoDe = (v: MessageVariable) => (v.custom ? 'imobiliaria' : (v.group ?? 'lead'));
  const grupos = GRUPOS.map(g => ({ ...g, itens: resto.filter(v => grupoDe(v) === g.key) })).filter(g => g.itens.length > 0);
  // Lista sem grupo nenhum (ex.: os avisos da Roleta): sem título, que diria "Do lead" pro prazo do aceite.
  const comTitulo = resto.some(v => v.custom || v.group);
  return (
    <div className={cn('mt-1.5', props.className)}>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Inserir variável:</span>
        {destaque.map(v => chip(v))}
        {resto.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={maisAberto}
            onClick={() => setMaisAberto(o => !o)}
            className="h-8 px-2 text-xs"
          >
            Mais variáveis
          </Button>
        )}
      </div>
      {maisAberto && (
        <div className="mt-1.5 space-y-2">
          {grupos.map(g => (
            <div key={g.key}>
              {comTitulo && <div className="text-xs font-medium text-muted-foreground mb-1">{g.titulo}</div>}
              <div className="flex flex-wrap gap-1">{g.itens.map(v => chip(v))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
