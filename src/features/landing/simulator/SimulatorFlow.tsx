import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import {
  DEFAULT_SIMULATOR_RULES,
  type Purpose,
  type Readiness,
  type SimulationResult,
  type SimulatorAnswers,
  type SimulatorRules,
  computeSimulation,
} from './engine';

export interface RecommendedItem {
  code: string;
  title: string;
  price?: number | null;
  city?: string;
  imageUrl?: string;
}

export interface SimulatorFinishPayload {
  answers: SimulatorAnswers;
  result: SimulationResult;
  name: string;
  phone: string;
}

export interface SimulatorFlowProps {
  rules?: SimulatorRules;
  headline?: string;
  /** Called when the toggle is ON, to fetch catalog matches within budget. */
  getRecommendations?: (maxValue: number) => Promise<RecommendedItem[]>;
  onFinish?: (data: SimulatorFinishPayload) => void | Promise<void>;
}

const brl = (v?: number | null) =>
  v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const ANALYZING_MSGS = [
  'Analisando sua renda…',
  'Consultando condições de financiamento…',
  'Calculando o que cabe no seu bolso…',
  'Montando seu resultado…',
];

type Step = 'income' | 'down' | 'purpose' | 'readiness' | 'analyzing' | 'result';
const QUESTION_STEPS: Step[] = ['income', 'down', 'purpose', 'readiness'];

export function SimulatorFlow({
  rules = DEFAULT_SIMULATOR_RULES,
  headline = 'Descubra em 1 minuto a que imóvel você tem acesso',
  getRecommendations,
  onFinish,
}: SimulatorFlowProps) {
  const [step, setStep] = useState<Step>('income');
  const [income, setIncome] = useState('');
  const [down, setDown] = useState('');
  const [purpose, setPurpose] = useState<Purpose | undefined>();
  const [readiness, setReadiness] = useState<Readiness | undefined>();
  const [msgIdx, setMsgIdx] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [recos, setRecos] = useState<RecommendedItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const answers: SimulatorAnswers = useMemo(
    () => ({
      monthlyIncome: Number(income) || 0,
      downPayment: Number(down) || 0,
      purpose,
      readiness,
    }),
    [income, down, purpose, readiness],
  );

  const stepIndex = QUESTION_STEPS.indexOf(step);
  const progress =
    step === 'result' ? 100 : step === 'analyzing' ? 90 : ((stepIndex + 1) / (QUESTION_STEPS.length + 1)) * 100;

  // Analyzing animation → real compute → result.
  useEffect(() => {
    if (step !== 'analyzing') return;
    const rotate = setInterval(() => setMsgIdx((i) => (i + 1) % ANALYZING_MSGS.length), 700);
    const timer = setTimeout(async () => {
      const r = computeSimulation(answers, rules);
      setResult(r);
      if (r.recommend && r.maxPropertyValue > 0 && getRecommendations) {
        try {
          setRecos(await getRecommendations(r.maxPropertyValue));
        } catch {
          setRecos([]);
        }
      }
      setStep('result');
    }, 2500);
    return () => {
      clearInterval(rotate);
      clearTimeout(timer);
    };
  }, [step, answers, rules, getRecommendations]);

  const next = () => {
    const order: Step[] = ['income', 'down', 'purpose', 'readiness', 'analyzing'];
    setStep(order[order.indexOf(step) + 1]);
  };

  const handleFinish = async () => {
    if (!result || !name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await onFinish?.({ answers, result, name: name.trim(), phone: phone.trim() });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8 text-neutral-100">
      {/* progress */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {step === 'income' && (
        <Q title={headline} sub="Qual é a sua renda mensal (ou da família)?">
          <MoneyInput value={income} onChange={setIncome} placeholder="Ex: 8.000" autoFocus />
          <Primary disabled={!Number(income)} onClick={next}>Continuar</Primary>
        </Q>
      )}

      {step === 'down' && (
        <Q title="Quanto você tem de entrada?" sub="Pode ser um valor aproximado. Se não tiver, deixe 0.">
          <MoneyInput value={down} onChange={setDown} placeholder="Ex: 40.000" autoFocus />
          <Primary onClick={next}>Continuar</Primary>
        </Q>
      )}

      {step === 'purpose' && (
        <Q title="Você quer o imóvel para…">
          <Choice selected={purpose === 'live'} onClick={() => { setPurpose('live'); next(); }}>Morar</Choice>
          <Choice selected={purpose === 'invest'} onClick={() => { setPurpose('invest'); next(); }}>Investir</Choice>
        </Q>
      )}

      {step === 'readiness' && (
        <Q title="Como está sua situação hoje?">
          <Choice selected={readiness === 'credit_approved'} onClick={() => { setReadiness('credit_approved'); next(); }}>Já tenho crédito aprovado</Choice>
          <Choice selected={readiness === 'soon'} onClick={() => { setReadiness('soon'); next(); }}>Quero comprar em breve</Choice>
          <Choice selected={readiness === 'researching'} onClick={() => { setReadiness('researching'); next(); }}>Só pesquisando ainda</Choice>
        </Q>
      )}

      {step === 'analyzing' && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
          <p className="text-lg font-medium">{ANALYZING_MSGS[msgIdx]}</p>
          <p className="text-sm text-neutral-400">Estamos analisando seu perfil de verdade.</p>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 p-5 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-violet-300" />
            <p className="text-sm text-neutral-300">Seu resultado</p>
            <p className="mt-1 text-2xl font-bold">{result.diagnosis}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <Stat label="Parcela que cabe" value={`${brl(result.maxInstallment)}/mês`} />
            <Stat label="Banco financia até" value={brl(result.financiableAmount)} />
          </div>

          {result.recommend && recos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Imóveis que cabem no seu bolso</p>
              <div className="space-y-2">
                {recos.slice(0, 4).map((r) => (
                  <div key={r.code} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    {r.imageUrl && <img src={r.imageUrl} alt={r.title} className="h-12 w-12 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.title}</p>
                      {r.city && <p className="text-xs text-neutral-400">{r.city}</p>}
                    </div>
                    {r.price != null && <span className="text-sm font-semibold text-violet-300">{brl(r.price)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {done ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600/20 p-4 text-emerald-300">
              <Check className="h-5 w-5" /> Recebemos seus dados. Um especialista vai te chamar.
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl bg-white/5 p-4">
              <p className="text-sm font-semibold">Fale com um especialista sobre essas opções</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome"
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Seu WhatsApp" inputMode="tel"
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500" />
              <Primary disabled={submitting || !name.trim() || !phone.trim()} onClick={handleFinish}>
                {submitting ? 'Enviando…' : 'Quero falar com especialista'}
              </Primary>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- small ui bits ---- */
function Q({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold leading-tight">{title}</h2>
        {sub && <p className="mt-1 text-sm text-neutral-400">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
function MoneyInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="flex items-center rounded-xl border border-white/10 bg-neutral-900 px-3">
      <span className="text-neutral-400">R$</span>
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        className="w-full bg-transparent px-2 py-3 text-lg outline-none"
      />
    </div>
  );
}
function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-40">
      {children}
    </button>
  );
}
function Choice({ children, onClick, selected }: { children: React.ReactNode; onClick: () => void; selected?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${selected ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-neutral-900 hover:border-violet-500/60'}`}>
      {children}
    </button>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
