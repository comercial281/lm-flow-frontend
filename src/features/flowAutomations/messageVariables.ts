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
  /** Em qual grupo aparece sob "Mais variáveis" (as da imobiliária ficam em "Da imobiliária"). */
  group?: 'lead' | 'visita' | 'anuncio';
}

/** As três que ficam à vista no construtor; o resto vai em "Mais variáveis". */
export const FEATURED_VARIABLE_TOKENS = ['{{nome}}', '{{corretor}}', '{{imovel_titulo}}'];

export const BUILTIN_MESSAGE_VARIABLES: MessageVariable[] = [
  { label: 'Nome', token: '{{nome}}', group: 'lead' },
  { label: 'Nome completo', token: '{{nome_completo}}', group: 'lead' },
  // Responsável pelo lead. Vazio até alguém assumir — no gatilho do aceite da
  // roleta já é o corretor que acabou de aceitar.
  { label: 'Corretor', token: '{{corretor}}', group: 'lead' },
  { label: 'Corretor (completo)', token: '{{corretor_completo}}', group: 'lead' },
  { label: 'Telefone', token: '{{telefone}}', group: 'lead' },
  { label: 'E-mail', token: '{{email}}', group: 'lead' },
  { label: 'Data', token: '{{data}}', group: 'lead' },
  { label: 'Hora', token: '{{hora}}', group: 'lead' },
  { label: 'Link do card', token: '{{link_do_card}}', group: 'lead' },
  { label: 'Imóvel', token: '{{imovel_titulo}}', description: 'O imóvel pelo qual o lead chegou', group: 'lead' },
  { label: 'Link do imóvel', token: '{{imovel_link}}', group: 'lead' },
  // Da visita: preenchidas nos gatilhos de visita (agendada, remarcada, realizada, lembretes).
  { label: 'Data da visita', token: '{{visita_data}}', description: 'Só nos gatilhos de visita', group: 'visita' },
  { label: 'Hora da visita', token: '{{visita_hora}}', description: 'Só nos gatilhos de visita', group: 'visita' },
  { label: 'Horário anterior', token: '{{visita_horario_anterior}}', description: 'Só na Visita remarcada: o dia e a hora de antes', group: 'visita' },
  { label: 'Imóvel da visita', token: '{{imovel}}', description: 'Só nos gatilhos de visita: o imóvel da visita marcada (pode ser outro que o imóvel pelo qual o lead chegou)', group: 'visita' },
  { label: 'Corretor da visita', token: '{{visita_corretor}}', description: 'Só nos gatilhos de visita: quem vai fazer a visita (pode ser diferente do responsável pelo lead)', group: 'visita' },
  { label: 'Origem', token: '{{origem}}', group: 'anuncio' },
  { label: 'Campanha', token: '{{campanha}}', group: 'anuncio' },
  { label: 'Conjunto', token: '{{conjunto}}', group: 'anuncio' },
  { label: 'Anúncio', token: '{{anuncio}}', group: 'anuncio' },
  { label: 'Título anúncio', token: '{{titulo_anuncio}}', group: 'anuncio' },
  { label: 'Plataforma', token: '{{plataforma}}', group: 'anuncio' },
  { label: 'Respostas form', token: '{{respostas}}', group: 'anuncio' },
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
