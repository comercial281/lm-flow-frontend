import { useEffect, useState } from 'react';
import { Input, Label, Badge } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import {
  FORM_SOURCE_BADGE,
  QUESTIONS_EMPTY,
  QUESTIONS_LOAD_FAILED,
  QUESTIONS_MANUAL_HINT,
  formAnswerSentence,
  isOptionChecked,
  pickForm,
  pickQuestion,
  setAnswered,
  setContains,
  toggleOption,
  typeQuestion,
  type FlowForm,
  type FormAnswerConfig,
  type FormQuestion,
} from '@/features/flowAutomations/formAnswer';

// "Resposta do formulário" em três passos (spec 02/10, seção 5b): formulário,
// pergunta, resposta. Quando o servidor não consegue ler as perguntas (token do
// Meta vencido etc.), diz isso e deixa digitar pergunta e resposta, sem travar.

interface Props {
  value: FormAnswerConfig;
  onChange: (next: FormAnswerConfig) => void;
}

type Load<T> = { state: 'loading' } | { state: 'failed' } | { state: 'loaded'; data: T };

const boxClass = 'mt-1 max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border';
const rowClass = 'flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-muted/50 text-sm';

export function FormAnswerPicker({ value, onChange }: Props) {
  const [forms, setForms] = useState<Load<FlowForm[]>>({ state: 'loading' });
  const [questions, setQuestions] = useState<Load<{ questions: FormQuestion[]; error: string | null }> | null>(null);

  useEffect(() => {
    let vivo = true;
    flowAutomationsService
      .forms()
      .then(data => vivo && setForms({ state: 'loaded', data }))
      .catch(() => vivo && setForms({ state: 'failed' }));
    return () => {
      vivo = false;
    };
  }, []);

  const formSource = value.form_source;
  const formId = value.form_id;
  useEffect(() => {
    if (!formSource || !formId) {
      setQuestions(null);
      return;
    }
    let vivo = true;
    setQuestions({ state: 'loading' });
    flowAutomationsService
      .formQuestions(formSource, formId)
      .then(data => vivo && setQuestions({ state: 'loaded', data }))
      .catch(() => vivo && setQuestions({ state: 'failed' }));
    return () => {
      vivo = false;
    };
  }, [formSource, formId]);

  const formList = forms.state === 'loaded' ? forms.data : [];
  // O formulário gravado que não veio na lista (desvinculado, ou a lista falhou)
  // continua aparecendo marcado: salvar não pode trocar a escolha em silêncio.
  const savedMissing = !!formId && !formList.some(f => f.form_id === formId && f.source === formSource);

  const loadedQuestions = questions?.state === 'loaded' ? questions.data.questions : [];
  const questionsError =
    questions?.state === 'failed' ? QUESTIONS_LOAD_FAILED : questions?.state === 'loaded' ? questions.data.error : null;
  const manual =
    !!formId &&
    (questions?.state === 'failed' || (questions?.state === 'loaded' && (questions.data.error !== null || loadedQuestions.length === 0)));
  const question = loadedQuestions.find(q => q.key === value.question_key) ?? null;
  const questionMissing = !manual && !!value.question_key && questions?.state === 'loaded' && !question;
  const hasOptions = !manual && !!question && question.options.length > 0;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">1. Formulário</Label>
        {forms.state === 'loading' && <p className="text-xs text-muted-foreground mt-1">Carregando os formulários…</p>}
        {forms.state === 'failed' && (
          <p className="text-xs text-amber-600 mt-1">Não consegui carregar os formulários agora. A escolha que já estava continua.</p>
        )}
        {forms.state === 'loaded' && formList.length === 0 && !savedMissing && (
          <p className="text-xs text-muted-foreground mt-1">
            Nenhum formulário ainda. Os de anúncio aparecem quando são vinculados na tela Formulários; os do site, quando são criados no Site.
          </p>
        )}
        {(formList.length > 0 || savedMissing) && (
          <div className={boxClass} role="radiogroup" aria-label="Formulário">
            {savedMissing && (
              <label className={rowClass}>
                <input type="radio" checked readOnly className="h-4 w-4 accent-primary" />
                <span className="truncate flex-1">{value.form_name || formId}</span>
                {formSource && <Badge variant="outline" className="text-[10px]">{FORM_SOURCE_BADGE[formSource]}</Badge>}
              </label>
            )}
            {formList.map(f => (
              <label key={`${f.source}:${f.form_id}`} className={rowClass}>
                <input
                  type="radio"
                  name="flow-form-answer-form"
                  checked={f.form_id === formId && f.source === formSource}
                  onChange={() => onChange(pickForm(value, f))}
                  className="h-4 w-4 accent-primary"
                />
                <span className="truncate flex-1">{f.name || f.form_id}</span>
                <Badge variant="outline" className="text-[10px]">{FORM_SOURCE_BADGE[f.source]}</Badge>
              </label>
            ))}
          </div>
        )}
      </div>

      {formId && (
        <div>
          <Label className="text-xs">2. Pergunta</Label>
          {questions?.state === 'loading' && <p className="text-xs text-muted-foreground mt-1">Carregando as perguntas…</p>}
          {manual ? (
            <>
              <p className="text-xs text-amber-600 mt-1">{questionsError || QUESTIONS_EMPTY}</p>
              <p className="text-xs text-muted-foreground mt-1">{QUESTIONS_MANUAL_HINT}</p>
              <Input
                className="mt-1"
                value={value.question_label || value.question_key}
                onChange={e => onChange(typeQuestion(value, e.target.value))}
                aria-label="Pergunta"
              />
            </>
          ) : (
            questions?.state === 'loaded' && (
              <Seletor
                value={value.question_key}
                onChange={e => {
                  const q = loadedQuestions.find(x => x.key === e.target.value);
                  if (q) onChange(pickQuestion(value, q));
                }}
                className="mt-1 w-full"
                aria-label="Pergunta"
              >
                <option value="">Escolha a pergunta</option>
                {questionMissing && <option value={value.question_key}>{value.question_label || value.question_key} (não está mais no formulário)</option>}
                {loadedQuestions.map(q => (
                  <option key={q.key} value={q.key}>{q.label}</option>
                ))}
              </Seletor>
            )
          )}
        </div>
      )}

      {formId && value.question_key && (
        <div>
          <Label className="text-xs">3. Resposta</Label>
          {hasOptions ? (
            <>
              <p className="text-xs text-muted-foreground mt-1">É qualquer uma destas:</p>
              <div className={boxClass}>
                {question!.options.map(o => (
                  <label key={o.key || o.value} className={rowClass}>
                    <input
                      type="checkbox"
                      checked={isOptionChecked(value, o)}
                      onChange={() => onChange(toggleOption(value, question!.options, o))}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="truncate">{o.value || o.key}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-1 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="flow-form-answer-match"
                  checked={value.match !== 'contains'}
                  onChange={() => onChange(setAnswered(value))}
                  className="h-4 w-4 accent-primary"
                />
                Respondeu qualquer coisa
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="flow-form-answer-match"
                  checked={value.match === 'contains'}
                  onChange={() => onChange(setContains(value, value.values[0] ?? ''))}
                  className="h-4 w-4 accent-primary"
                />
                Contém o texto…
              </label>
              {value.match === 'contains' && (
                <Input
                  value={value.values[0] ?? ''}
                  onChange={e => onChange(setContains(value, e.target.value))}
                  aria-label="Texto que a resposta precisa ter"
                />
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs rounded-md bg-muted/40 px-2.5 py-2">{formAnswerSentence(value)}</p>
      <p className="text-xs text-muted-foreground">
        Vale a última resposta que o lead mandou: quem preencheu dois formulários diferentes fica com as respostas do mais recente. Sem resposta a essa pergunta, o caminho é Não.
      </p>
    </div>
  );
}
