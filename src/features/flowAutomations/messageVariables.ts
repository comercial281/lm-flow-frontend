// VARIÁVEIS DE MENSAGEM COMO BOTÕEZINHOS (sprint 4, spec 04/10/2026, A.4).
//
// Uma lista só pra toda caixa de mensagem do construtor e da tela de regras:
// as variáveis prontas (as que o servidor preenche no envio,
// LeadAutomation::Executor#interpolate, que o construtor também usa desde
// 02/10) e, depois delas, as variáveis que a imobiliária criou
// (`/tenant_template_variables`, resolvidas pelo MESMO código no envio).
// Isso substitui a aba Variáveis do "Funis de mensagem".

import type { TemplateVariablesResponse } from '@/types/messageFunnels';

export interface MessageVariable {
  /** Nome no botão. */
  label: string;
  /** O que entra no texto, com as chaves: "{{nome}}". */
  token: string;
  /** Explicação curta (balão do botão). */
  description?: string;
  /** Criada pela imobiliária (e não uma das prontas). */
  custom?: boolean;
}

export const BUILTIN_MESSAGE_VARIABLES: MessageVariable[] = [
  { label: 'Nome', token: '{{nome}}' },
  { label: 'Nome completo', token: '{{nome_completo}}' },
  // Responsável pelo lead. Vazio até alguém assumir — no gatilho do aceite da
  // roleta já é o corretor que acabou de aceitar.
  { label: 'Corretor', token: '{{corretor}}' },
  { label: 'Corretor (completo)', token: '{{corretor_completo}}' },
  { label: 'Telefone', token: '{{telefone}}' },
  { label: 'E-mail', token: '{{email}}' },
  { label: 'Data', token: '{{data}}' },
  { label: 'Hora', token: '{{hora}}' },
  { label: 'Link do card', token: '{{link_do_card}}' },
  { label: 'Imóvel', token: '{{imovel_titulo}}', description: 'O imóvel pelo qual o lead chegou' },
  { label: 'Link do imóvel', token: '{{imovel_link}}' },
  { label: 'Origem', token: '{{origem}}' },
  { label: 'Campanha', token: '{{campanha}}' },
  { label: 'Conjunto', token: '{{conjunto}}' },
  { label: 'Anúncio', token: '{{anuncio}}' },
  { label: 'Título anúncio', token: '{{titulo_anuncio}}' },
  { label: 'Plataforma', token: '{{plataforma}}' },
  { label: 'Respostas form', token: '{{respostas}}' },
];

const normalizeToken = (token: string) => token.replace(/[{}\s]/g, '').toLowerCase();

/**
 * As prontas e, depois, as ligadas que a imobiliária criou. Variável da
 * imobiliária com o mesmo nome de uma pronta não aparece duas vezes.
 */
export function withTenantVariables(
  builtins: MessageVariable[],
  response: Pick<TemplateVariablesResponse, 'custom'> | null | undefined,
): MessageVariable[] {
  const seen = new Set(builtins.map(v => normalizeToken(v.token)));
  const custom = (response?.custom ?? [])
    .filter(v => v.active !== false && v.token)
    .flatMap(v => {
      const key = normalizeToken(v.token);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        label: v.label || v.token,
        token: v.placeholder || `{{${v.token}}}`,
        description: v.description || undefined,
        custom: true,
      }];
    });
  return [...builtins, ...custom];
}

/**
 * Põe a variável onde o cursor está (ou no lugar do trecho selecionado).
 * Sem cursor conhecido, vai pro fim. Devolve o texto novo e onde o cursor fica.
 */
export function insertAtCursor(
  text: string,
  token: string,
  start?: number | null,
  end?: number | null,
): { text: string; cursor: number } {
  const from = start == null ? text.length : Math.max(0, Math.min(start, text.length));
  const to = end == null ? from : Math.max(from, Math.min(end, text.length));
  return { text: text.slice(0, from) + token + text.slice(to), cursor: from + token.length };
}
