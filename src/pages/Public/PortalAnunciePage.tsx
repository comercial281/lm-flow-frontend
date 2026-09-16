import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { BrPhoneInput } from '@/components/shared';
import { isValidBrPhone } from '@/lib/brPhone';
import {
  API, I, Ic, PROPERTY_TYPE_LABEL, PortalFooter, PortalHeader, Select, onlyDigits, usePortalData,
} from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — ANUNCIE SEU IMÓVEL

   O proprietário que quer VENDER ou ALUGAR. Até aqui o link "Anuncie" do rodapé
   rolava para o formulário de quem COMPRA — quem queria oferecer um imóvel caía
   no formulário contrário.

   ⚠️ Esta ficha vai SÓ POR E-MAIL para os endereços que o gestor cadastrou no
   Site Builder (decisão do dono do produto, 16/09/2026). Ela não cria contato,
   não cria card e não dispara automação: quem só ofereceu um imóvel não é lead
   de compra. O endereço é PRÓPRIO (`/site/anuncie`), e não um "modo" do
   formulário de contato, justamente porque aquele cria as três coisas.
──────────────────────────────────────────────────────────────────────────── */

const FINALIDADES = ['Residencial', 'Comercial', 'Rural'];
const NEGOCIOS = ['Venda', 'Locação', 'Venda e locação'];

/** Campo de texto simples, no visual dos demais formulários do portal. */
function Field({
  label, value, onChange, placeholder, type = 'text', required = false, error = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; error?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}{required && ' *'}
      </label>
      <input
        type={type} value={value} required={required} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        aria-invalid={error}
        className={`w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] ${error ? 'border-red-400' : 'border-black/10'}`}
      />
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-neutral-700">
      <input
        type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-black/20 accent-[var(--brand)]"
      />
      {label}
    </label>
  );
}

export default function PortalAnunciePage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { state, site, fontHref, wa, cssVars } = usePortalData(tenant);

  const [step, setStep] = useState<1 | 2>(1);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Passo 1 — o imóvel
  const [finalidade, setFinalidade] = useState('');
  const [tipo, setTipo] = useState('');
  const [negocio, setNegocio] = useState('');
  const [condominioNome, setCondominioNome] = useState('');
  const [condominioValor, setCondominioValor] = useState('');
  const [aceitaFinanciamento, setAceitaFinanciamento] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [areaTotal, setAreaTotal] = useState('');
  const [areaUtil, setAreaUtil] = useState('');
  const [dormitorios, setDormitorios] = useState('');
  const [suites, setSuites] = useState('');
  const [vagasCobertas, setVagasCobertas] = useState('');
  const [vagasDescobertas, setVagasDescobertas] = useState('');
  const [valorPretendido, setValorPretendido] = useState('');
  const [caracteristicas, setCaracteristicas] = useState('');

  // Passo 2 — quem está oferecendo
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [telefoneErr, setTelefoneErr] = useState(false);
  const [email, setEmail] = useState('');

  const tipoOptions = useMemo(
    () => Object.entries(PROPERTY_TYPE_LABEL).map(([v, l]) => [v, l] as [string, string]),
    [],
  );

  const page = site.anuncie;
  const waText = page?.whatsapp_text || 'Olá! Quero anunciar meu imóvel com vocês.';
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}?text=${encodeURIComponent(waText)}` : null;

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  const goToOwner = (e: FormEvent) => {
    e.preventDefault();
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !nome.trim()) return;
    if (!isValidBrPhone(telefone)) { setTelefoneErr(true); return; }

    setSending(true);
    setFailed(false);
    try {
      const res = await fetch(`${API}/api/public/v1/site/anuncie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant },
        body: JSON.stringify({
          lead: {
            name: nome.trim(), phone: telefone, email: email.trim() || null,
            source: 'site',
            form_data: {
              finalidade, tipo: tipo ? (PROPERTY_TYPE_LABEL[tipo] || tipo) : '', negocio,
              endereco, condominio_nome: condominioNome, condominio_valor: condominioValor,
              area_total: areaTotal, area_util: areaUtil,
              dormitorios, suites,
              vagas_cobertas: vagasCobertas, vagas_descobertas: vagasDescobertas,
              aceita_financiamento: aceitaFinanciamento,
              valor_pretendido: valorPretendido,
              caracteristicas,
              proprietario_nome: nome.trim(),
              proprietario_telefone: telefone,
              proprietario_email: email.trim(),
            },
          },
        }),
      });
      if (!res.ok) throw new Error('falhou');
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // A ficha é longa: some com ela e a pessoa não preenche de novo. O erro
      // aparece e o botão volta, com tudo o que ela escreveu no lugar.
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      <PortalHeader site={site} tenant={tenant!} />

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
        {sent ? (
          <div className="rounded-[24px] border border-black/[0.07] bg-white px-6 py-12 text-center sm:px-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#25D366' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h1 className="font-[var(--display)] text-2xl font-semibold sm:text-3xl">
              {page?.thanks_title || 'Recebemos a sua ficha!'}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-neutral-600">
              {page?.thanks_text || 'Vamos avaliar as informações do seu imóvel e entrar em contato em breve.'}
            </p>
            {waHref && (
              <a
                href={waHref} target="_blank" rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white"
                style={{ background: '#25D366' }}
              >
                <Ic d={I.wa} s={18} /> Prefere falar no WhatsApp?
              </a>
            )}
          </div>
        ) : (
          <>
            <h1 className="font-[var(--display)] text-3xl font-semibold sm:text-4xl">
              {page?.title || 'Anuncie seu imóvel com a gente'}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-600">
              {page?.intro || 'Preencha a ficha abaixo e um especialista entra em contato para avaliar seu imóvel.'}
            </p>

            <div className="mt-6 flex items-center gap-2 text-[13px] font-medium">
              {([[1, 'O imóvel'], [2, 'Seus dados']] as const).map(([n, label]) => (
                <span key={n} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${step === n ? 'text-white' : 'bg-black/[0.05] text-neutral-500'}`}
                  style={step === n ? { background: 'var(--brand)' } : undefined}>
                  <span className="text-[11px] opacity-80">{n}</span> {label}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-black/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
              {step === 1 ? (
                <form onSubmit={goToOwner} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Finalidade</label>
                      <Select value={finalidade} onChange={setFinalidade} label="Selecione" options={FINALIDADES.map(f => [f, f])} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Tipo</label>
                      <Select value={tipo} onChange={setTipo} label="Selecione" options={tipoOptions} />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Para</label>
                    <Select value={negocio} onChange={setNegocio} label="Venda, locação ou os dois" options={NEGOCIOS.map(n => [n, n])} />
                  </div>

                  <Field label="Endereço" value={endereco} onChange={setEndereco} required
                    placeholder="Rua, número, bairro e cidade" />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nome do condomínio/edifício" value={condominioNome} onChange={setCondominioNome} />
                    <Field label="Valor do condomínio" value={condominioValor} onChange={setCondominioValor} placeholder="R$" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Área total/terreno (m²)" value={areaTotal} onChange={setAreaTotal} />
                    <Field label="Área útil/construída (m²)" value={areaUtil} onChange={setAreaUtil} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Dormitórios" value={dormitorios} onChange={setDormitorios} />
                    <Field label="Suítes" value={suites} onChange={setSuites} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Vagas cobertas" value={vagasCobertas} onChange={setVagasCobertas} />
                    <Field label="Vagas descobertas" value={vagasDescobertas} onChange={setVagasDescobertas} />
                  </div>

                  <Field label="Valor pretendido" value={valorPretendido} onChange={setValorPretendido} placeholder="R$" />

                  <Check label="Aceita financiamento?" checked={aceitaFinanciamento} onChange={setAceitaFinanciamento} />

                  <div>
                    <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
                      Outras características
                    </label>
                    <textarea
                      value={caracteristicas} onChange={e => setCaracteristicas(e.target.value)} rows={5}
                      placeholder="Pense nos diferenciais que seu imóvel possui"
                      className="w-full rounded-xl border border-black/10 px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)]"
                    />
                  </div>

                  <button type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--ink)' }}>
                    Próximo <Ic d={I.arrow} s={17} />
                  </button>
                </form>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <Field label="Seu nome" value={nome} onChange={setNome} required placeholder="Como podemos te chamar?" />

                  <div>
                    <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">WhatsApp *</label>
                    <BrPhoneInput
                      value={telefone}
                      onChange={v => { setTelefone(v); if (telefoneErr) setTelefoneErr(false); }}
                      required
                      aria-invalid={telefoneErr}
                      className={`w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] ${telefoneErr ? 'border-red-400' : 'border-black/10'}`}
                    />
                    {telefoneErr && <p className="mt-1 text-[13px] text-red-500">Digite um telefone válido com DDD.</p>}
                  </div>

                  <Field label="E-mail" value={email} onChange={setEmail} type="email" placeholder="seu@email.com" />

                  {failed && (
                    <p className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-600">
                      Não consegui enviar agora. Tente de novo em instantes — o que você preencheu continua aqui.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => setStep(1)}
                      className="rounded-xl border border-black/10 px-5 py-3.5 text-[15px] font-semibold text-neutral-600 hover:bg-black/[0.03]">
                      Voltar
                    </button>
                    <button type="submit" disabled={sending}
                      className="flex-1 rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ background: 'var(--brand)' }}>
                      {sending ? 'Enviando…' : 'Enviar minha ficha'}
                    </button>
                  </div>

                  {waHref && (
                    <p className="pt-1 text-center text-[14px] text-neutral-500">
                      Prefere falar direto?{' '}
                      <a href={waHref} target="_blank" rel="noreferrer" className="font-semibold text-[var(--brand)] hover:underline">
                        Chame a gente no WhatsApp
                      </a>
                    </p>
                  )}
                </form>
              )}
            </div>
          </>
        )}
      </main>

      <PortalFooter site={site} tenant={tenant!} />
    </div>
  );
}
