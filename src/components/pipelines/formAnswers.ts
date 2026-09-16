// O que o lead respondeu no formulário, pronto para desenhar no card.
//
// Existem DUAS origens com formatos diferentes, e é por isso que esta
// normalização mora num arquivo só:
//
//  - Formulário do Meta Ads: pares soltos, { "Qual seu orçamento?": "Acima de..." }.
//  - Landing de anúncio: TODAS as perguntas dentro de UMA chave, como lista
//    ({ answers: [{ question, answer, optionId }, ...] }), com os cookies do
//    clique do anúncio soltos ao lado.
//
// Lida crua, a landing imprimia "[object Object]" por pergunta e mostrava o
// identificador do envio e os cookies como se fossem resposta. O servidor
// passou a gravar plano (igual ao Meta), mas o lead JÁ capturado continua no
// formato antigo — por isso a leitura entende os dois.

export type FormAnswerRow = { label: string; value: string };

// Rastreio do anúncio: existe para a conversão da Meta, não é resposta de
// ninguém. Mesma lista do servidor.
const TRACKING_KEYS = new Set([
  'event_id', 'fbp', 'fbc', 'fbclid', 'gclid', 'landing_url', 'referrer',
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Chave técnica ("nome_completo") vira texto; pergunta escrita por gente já
// vem com espaço e pontuação e é preservada como está.
const toLabel = (key: string): string => (key.includes(' ') ? key : key.replace(/_/g, ' '));

// Múltipla escolha chega como lista. Objeto solto não vira linha: seria o
// "[object Object]" que esta leitura veio acabar.
const toValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v != null && !isRecord(v) && !Array.isArray(v))
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join(', ');
  }
  if (isRecord(value)) return '';
  return value == null ? '' : String(value).trim();
};

const stepRows = (list: unknown): FormAnswerRow[] => {
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const label = String(entry.question ?? '').trim();
    const value = toValue(entry.answer);
    return label && value ? [{ label, value }] : [];
  });
};

export function normalizeFormAnswers(raw: unknown): FormAnswerRow[] {
  if (!isRecord(raw)) return [];

  return Object.entries(raw).flatMap(([key, value]) => {
    const k = key.trim();
    if (!k || TRACKING_KEYS.has(k.toLowerCase())) return [];
    if (k.toLowerCase() === 'answers') return stepRows(value);

    const text = toValue(value);
    return text ? [{ label: toLabel(k), value: text }] : [];
  });
}

// ⚠️ A MESMA RESPOSTA É GRAVADA EM DOIS LUGARES, e isso é de propósito.
//
// O servidor guarda as respostas dentro de `form_answers` (é o que o bloco lê) e
// ESPELHA cada uma solta, ao lado, com a chave sem acento e sem pontuação — é de
// lá que o interpolador de funil lê `{{qual_a_renda_familiar_da_sua_casa}}`. O
// card imprimia as duas listas em sequência, então toda pergunta do formulário do
// Meta aparecia DUAS vezes no bloco "Respostas do lead": uma com acento e "?",
// outra sem (relato do dono do produto, 16/09/2026).
//
// O espelho não pode sumir do servidor — sem ele a variável de funil para de
// resolver. Quem decide o que aparece é esta leitura: chave espelhada de uma
// resposta que JÁ está na lista não vira linha. O que não é espelho (o campo que
// alguém gravou à mão no contato) continua aparecendo.
const HIDDEN_ATTRIBUTE_KEYS = new Set([
  'empreendimento', 'imovel_codigo', 'origem_lead', 'form_answers',
]);

// "Você está buscando?" e "voce_esta_buscando" têm que virar a MESMA coisa —
// é a normalização que o servidor usa para criar a chave espelhada. O intervalo
// de acentos vai escrito como escapes (`\u0300-\u036f`), nunca com os
// caracteres combinantes literais, que qualquer normalização de editor apaga
// em silêncio.
const attributeKey = (raw: string): string =>
  raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Os campos soltos do contato que ainda merecem uma linha no bloco, já sem os
// espelhos das respostas e sem o rastreio do anúncio.
export function extraAttributeRows(raw: unknown, answers: FormAnswerRow[]): FormAnswerRow[] {
  if (!isRecord(raw)) return [];

  const jaListadas = new Set(answers.map((a) => attributeKey(a.label)).filter(Boolean));

  return Object.entries(raw).flatMap(([key, value]) => {
    const k = key.trim();
    if (!k || HIDDEN_ATTRIBUTE_KEYS.has(k) || TRACKING_KEYS.has(k.toLowerCase())) return [];
    if (value == null || value === '' || typeof value === 'object') return [];

    const normalizada = attributeKey(k);
    if (normalizada && jaListadas.has(normalizada)) return [];

    return [{ label: toLabel(k), value: String(value) }];
  });
}

// O resultado da régua de qualificação da landing, gravado no card na captura.
// Sem ele as respostas contam metade da história: o gestor lê o que o lead
// respondeu e não sabe se aquilo passou no corte que ele mesmo configurou.
export type LandingVerdict = { label: string; score: number | null; approved: boolean };

export function landingVerdict(customFields: unknown): LandingVerdict | null {
  if (!isRecord(customFields)) return null;
  const q = customFields.qualification;
  if (q !== 'qualified' && q !== 'disqualified') return null;

  const raw = customFields.intent_score;
  const parsed = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')
    ? Number(raw)
    : NaN;
  const score = Number.isFinite(parsed) ? parsed : null;

  return {
    label: q === 'qualified' ? 'Qualificado' : 'Desqualificado',
    score,
    approved: q === 'qualified',
  };
}
