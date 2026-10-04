import { createContext, useContext, useEffect, useState, type RefObject } from 'react';
import { tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';
import {
  BUILTIN_MESSAGE_VARIABLES,
  insertAtCursor,
  withTenantVariables,
  type MessageVariable,
} from '@/features/flowAutomations/messageVariables';
import { cn } from '@/lib/utils';

// Botõezinhos de variável embaixo de uma caixa de mensagem (sprint 4, A.4).
// Um clique põe `{{variável}}` onde o cursor está. A lista vem do contexto: o
// construtor carrega as variáveis da imobiliária uma vez e passa pra todo
// bloco; fora dele (tela de regras), só as prontas.

export const MessageVariablesContext = createContext<MessageVariable[]>(BUILTIN_MESSAGE_VARIABLES);

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
  return (
    <div className={cn('flex flex-wrap items-center gap-1 mt-1.5', props.className)}>
      <span className="text-xs text-muted-foreground mr-1">Inserir variável:</span>
      {variables.map(v => (
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
          {v.label}
        </button>
      ))}
    </div>
  );
}
