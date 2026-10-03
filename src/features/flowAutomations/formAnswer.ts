// CRITÉRIO "RESPOSTA DO FORMULÁRIO" (spec 02/10, seção 5b).
//
// Três passos sem digitar o que o sistema já sabe: o formulário (Anúncio ou
// Site), a pergunta (com o texto que o lead viu) e a resposta. Quem compara é o
// servidor: lê `form_answers` do contato pela chave da pergunta e ignora
// maiúscula, acento, espaço e sublinhado.
//
// Nas perguntas de múltipla escolha, `values` guarda a CHAVE e o TEXTO de cada
// opção marcada: o Meta às vezes devolve a resposta como `ate_r$_300_mil` e às
// vezes como "Até R$ 300 mil", e com "é qualquer uma destas" guardar os dois
// não muda o resultado. `value_labels` é só pra frase da tela.

export type FormSource = 'meta' | 'site';
export type FormAnswerMatch = 'any_of' | 'contains' | 'answered';

export interface FlowForm {
  source: FormSource;
  form_id: string;
  name: string;
}

export interface FormQuestionOption {
  key: string;
  value: string;
}

export interface FormQuestion {
  key: string;
  label: string;
  type: string;
  options: FormQuestionOption[];
}

export interface FormQuestionsResult {
  questions: FormQuestion[];
  /** Texto em português do servidor quando não deu pra ler (token vencido etc.). */
  error: string | null;
}

export interface FormAnswerConfig {
  criterion: 'form_answer';
  form_source: FormSource | '';
  form_id: string;
  form_name: string;
  question_key: string;
  question_label: string;
  match: FormAnswerMatch;
  values: string[];
  value_labels?: string[];
  [key: string]: unknown;
}

export const FORM_SOURCE_BADGE: Record<FormSource, string> = {
  meta: 'Anúncio',
  site: 'Site',
};

export const QUESTIONS_LOAD_FAILED = 'Não consegui ler as perguntas desse formulário agora.';
export const QUESTIONS_EMPTY = 'Esse formulário não tem perguntas pra escolher.';
export const QUESTIONS_MANUAL_HINT = 'Digite a pergunta como ela aparece no formulário e a resposta que você procura.';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

export function emptyFormAnswer(): FormAnswerConfig {
  return {
    criterion: 'form_answer',
    form_source: '',
    form_id: '',
    form_name: '',
    question_key: '',
    question_label: '',
    match: 'answered',
    values: [],
  };
}

/** O que está gravado, normalizado (lixo vira vazio). */
export function formAnswerOf(config: Record<string, unknown> | null | undefined): FormAnswerConfig {
  const c = config ?? {};
  const match = str(c.match);
  const source = str(c.form_source);
  const labels = strList(c.value_labels);
  return {
    criterion: 'form_answer',
    form_source: source === 'meta' || source === 'site' ? source : '',
    form_id: str(c.form_id),
    form_name: str(c.form_name),
    question_key: str(c.question_key),
    question_label: str(c.question_label),
    match: match === 'any_of' || match === 'contains' ? match : 'answered',
    values: strList(c.values),
    ...(labels.length ? { value_labels: labels } : {}),
  };
}

/** Passo 1. Trocar de formulário zera a pergunta e a resposta. */
export function pickForm(config: FormAnswerConfig, form: FlowForm): FormAnswerConfig {
  if (config.form_id === form.form_id && config.form_source === form.source) {
    return { ...config, form_name: form.name };
  }
  return { ...emptyFormAnswer(), form_source: form.source, form_id: form.form_id, form_name: form.name };
}

/** Passo 2. Múltipla escolha começa em "é qualquer uma destas"; aberta, em "respondeu qualquer coisa". */
export function pickQuestion(config: FormAnswerConfig, question: Pick<FormQuestion, 'key' | 'label' | 'options'>): FormAnswerConfig {
  const base: FormAnswerConfig = {
    ...config,
    question_key: question.key,
    question_label: question.label || question.key,
    values: [],
    match: question.options.length > 0 ? 'any_of' : 'answered',
  };
  delete base.value_labels;
  return base;
}

/** Escrita à mão (quando o servidor não conseguiu ler as perguntas). */
export function typeQuestion(config: FormAnswerConfig, text: string): FormAnswerConfig {
  return { ...config, question_key: text, question_label: text };
}

export function isOptionChecked(config: FormAnswerConfig, option: FormQuestionOption): boolean {
  return config.match === 'any_of' && (config.values.includes(option.key) || config.values.includes(option.value));
}

/** Passo 3, múltipla escolha: marca/desmarca uma opção, na ordem das opções. */
export function toggleOption(config: FormAnswerConfig, options: FormQuestionOption[], option: FormQuestionOption): FormAnswerConfig {
  const checked = options.filter(o => (o.key === option.key ? !isOptionChecked(config, o) : isOptionChecked(config, o)));
  const values = Array.from(new Set(checked.flatMap(o => [o.key, o.value]).filter(Boolean)));
  const value_labels = checked.map(o => o.value || o.key);
  return { ...config, match: 'any_of', values, value_labels };
}

/** Passo 3, pergunta aberta: "contém o texto…". */
export function setContains(config: FormAnswerConfig, text: string): FormAnswerConfig {
  const next: FormAnswerConfig = { ...config, match: 'contains', values: text ? [text] : [] };
  delete next.value_labels;
  return next;
}

/** Passo 3, pergunta aberta: "respondeu qualquer coisa". */
export function setAnswered(config: FormAnswerConfig): FormAnswerConfig {
  const next: FormAnswerConfig = { ...config, match: 'answered', values: [] };
  delete next.value_labels;
  return next;
}

const quoted = (s: string) => `"${s}"`;

function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ou ${items[items.length - 1]}`;
}

/**
 * A frase do bloco: Se no formulário "Lançamento Vila Nova" a resposta de
 * "Qual o valor do imóvel?" for "Até R$ 300 mil" ou "De R$ 300 a 500 mil".
 */
export function formAnswerSentence(config: FormAnswerConfig): string {
  if (!config.form_id) return 'Resposta do formulário: escolha o formulário';
  const form = quoted(config.form_name || config.form_id);
  if (!config.question_key) return `Se no formulário ${form}: escolha a pergunta`;
  const question = quoted(config.question_label || config.question_key);
  if (config.match === 'answered') return `Se no formulário ${form} a pergunta ${question} foi respondida`;
  if (config.match === 'contains') {
    const text = config.values[0];
    return text
      ? `Se no formulário ${form} a resposta de ${question} contiver ${quoted(text)}`
      : `Se no formulário ${form} a resposta de ${question}: escreva o texto`;
  }
  const labels = config.value_labels?.length ? config.value_labels : config.values;
  if (labels.length === 0) return `Se no formulário ${form} a resposta de ${question}: marque as opções`;
  return `Se no formulário ${form} a resposta de ${question} for ${joinOr(labels.map(quoted))}`;
}

/** O que falta pra salvar o bloco (null = pronto). */
export function formAnswerProblem(config: FormAnswerConfig): string | null {
  if (!config.form_id) return 'Escolha o formulário.';
  if (!config.question_key) return 'Escolha a pergunta.';
  if (config.match === 'any_of' && config.values.length === 0) return 'Marque pelo menos uma resposta.';
  if (config.match === 'contains' && !config.values[0]) return 'Escreva o texto que a resposta precisa ter.';
  return null;
}

// ── Leitura das respostas da API (tolerante ao envelope) ───────────────────

export function formsFrom(raw: unknown): FlowForm[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map(item => {
      const o = (item ?? {}) as Record<string, unknown>;
      const source = str(o.source);
      return {
        source: (source === 'site' ? 'site' : 'meta') as FormSource,
        form_id: str(o.form_id ?? o.id),
        name: str(o.name ?? o.form_name),
      };
    })
    .filter(f => f.form_id);
}

export function questionsFrom(raw: unknown): FormQuestionsResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.questions) ? o.questions : [];
  const questions = list
    .map(item => {
      const q = (item ?? {}) as Record<string, unknown>;
      const options = (Array.isArray(q.options) ? q.options : [])
        .map(op => {
          if (typeof op === 'string') return { key: op, value: op };
          const x = (op ?? {}) as Record<string, unknown>;
          const value = str(x.value ?? x.label);
          return { key: str(x.key) || value, value: value || str(x.key) };
        })
        .filter(op => op.key || op.value);
      return { key: str(q.key), label: str(q.label) || str(q.key), type: str(q.type), options };
    })
    .filter(q => q.key);
  const error = typeof o.error === 'string' && o.error.trim() ? o.error : null;
  return { questions, error };
}
