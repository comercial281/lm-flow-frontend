import { useId, type ReactNode } from 'react';
import { BrPhoneInput } from '@/components/shared';
import { TEXTO_ENVIO_NA_PREVIA } from '@/features/siteBuilder/public/previa';
import { I, Ic, ListaDoSite, onlyDigits, type SiteInfo } from '../portalShared';
import { FINALIDADES, NEGOCIOS, type FichaDoAnuncie } from '../anuncie/useFichaDoAnuncie';
import { MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Anuncie do Moderno (spec 7): à esquerda, título, texto e o painel de
   contato na cor principal; à direita, a ficha de hoje num cartão claro, nos
   dois passos ("O imóvel" e "Seus dados"). Campos, validação, prévia e envio
   são os do `useFichaDoAnuncie` (mesmos do Clássico).
──────────────────────────────────────────────────────────────────────────── */

const CAMPO = 'w-full rounded-xl border bg-[var(--m-ground)] px-4 py-3 text-[15px] text-[var(--m-head)] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--brand)]';
const ROTULO = 'mb-1 block text-[12px] font-semibold text-[var(--m-muted)]';
const BOTAO = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-semibold transition-transform hover:-translate-y-px disabled:opacity-60';

function Rotulado({ rotulo, obrigatorio, children }: { rotulo: string; obrigatorio?: boolean; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>{rotulo}{obrigatorio && ' *'}</label>
      {children(id)}
    </div>
  );
}

function Texto({ rotulo, valor, mudar, placeholder, type = 'text', obrigatorio = false }: {
  rotulo: string; valor: string; mudar: (v: string) => void; placeholder?: string; type?: string; obrigatorio?: boolean;
}) {
  return (
    <Rotulado rotulo={rotulo} obrigatorio={obrigatorio}>
      {id => <input id={id} type={type} value={valor} required={obrigatorio} placeholder={placeholder} onChange={e => mudar(e.target.value)} className={`${CAMPO} border-[var(--m-line)]`} />}
    </Rotulado>
  );
}

function Lista({ rotulo, valor, mudar, vazio, opcoes }: { rotulo: string; valor: string; mudar: (v: string) => void; vazio: string; opcoes: [string, string][] }) {
  return (
    <Rotulado rotulo={rotulo}>
      {id => (
        <ListaDoSite
          id={id} value={valor} onChange={mudar} vazio={vazio} options={opcoes}
          className={`${CAMPO} appearance-none border-[var(--m-line)] [&_option]:bg-[#FFFFFF] [&_option]:text-[#17140F]`}
        />
      )}
    </Rotulado>
  );
}

const par = (a: ReactNode, b: ReactNode) => <div className="grid gap-4 sm:grid-cols-2">{a}{b}</div>;

export default function AnuncieModerno({ ficha, site }: { ficha: FichaDoAnuncie; site: SiteInfo }) {
  const f = ficha;
  const telefoneDoSite = site.contact?.phone?.trim();

  if (f.sent) {
    return (
      <main className="px-4 py-[clamp(48px,7vw,88px)]">
        <div className="mx-auto max-w-[640px]">
          {f.enviadoNaPrevia ? (
            <div role="status" className="rounded-[28px] bg-amber-400 px-6 py-12 text-center text-lg font-semibold text-neutral-900">{TEXTO_ENVIO_NA_PREVIA}</div>
          ) : (
            <div className="rounded-[28px] border border-[var(--m-line)] bg-[var(--m-surface)] px-6 py-12 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#1FAF5A] text-white"><Ic d="M20 6 9 17l-5-5" s={26} /></div>
              <h1 className="font-[var(--display)] text-[clamp(24px,3vw,32px)] font-semibold text-[var(--m-head)]">{f.page?.thanks_title || 'Recebemos a sua ficha!'}</h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--m-text)]">
                {f.page?.thanks_text || 'Vamos avaliar as informações do seu imóvel e entrar em contato em breve.'}
              </p>
              {f.waHref && (
                <a href={f.waHref} target="_blank" rel="noreferrer" className={`mt-7 bg-[#1FAF5A] text-white ${BOTAO}`}>
                  <Ic d={I.wa} s={18} /> Prefere falar no WhatsApp?
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pb-[clamp(56px,8vw,96px)] pt-[clamp(36px,5vw,64px)]">
      <div className={`${MIOLO} grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-12`}>
        <div>
          <h1 className="font-[var(--display)] text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--m-head)] [text-wrap:balance]">
            {f.page?.title || 'Anuncie seu imóvel com a gente'}
          </h1>
          <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-[var(--m-text)]">
            {f.page?.intro || 'Preencha a ficha abaixo e um especialista entra em contato para avaliar seu imóvel.'}
          </p>
          {(f.waHref || telefoneDoSite) && (
            <div className="mt-7 rounded-[28px] bg-[var(--brand)] p-6 text-[var(--brand-ink)]">
              <p className="font-[var(--display)] text-[20px] font-semibold">Prefere conversar?</p>
              <p className="mt-1 text-[14px] opacity-80">Um especialista avalia seu imóvel com você.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {f.waHref && (
                  <a href={f.waHref} target="_blank" rel="noreferrer" className={`bg-[#1FAF5A] text-white ${BOTAO}`}><Ic d={I.wa} s={18} /> WhatsApp</a>
                )}
                {telefoneDoSite && (
                  <a href={`tel:${onlyDigits(telefoneDoSite)}`} className={`border border-current ${BOTAO}`}><Ic d={I.phone} s={17} /> {telefoneDoSite}</a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-[var(--m-line)] bg-[var(--m-surface)] p-[clamp(20px,3vw,32px)]">
          <ol className="mb-6 flex flex-wrap gap-2 text-[13px] font-semibold">
            {([[1, 'O imóvel'], [2, 'Seus dados']] as const).map(([n, rotulo]) => (
              <li key={n} aria-current={f.step === n ? 'step' : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 ${f.step === n ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'bg-[var(--m-brand-soft)] text-[var(--m-head)]'}`}>
                <span className="text-[11px] opacity-80">{n}</span> {rotulo}
              </li>
            ))}
          </ol>

          {f.step === 1 ? (
            <form onSubmit={f.goToOwner} className="space-y-5">
              {par(
                <Lista rotulo="Finalidade" valor={f.finalidade} mudar={f.setFinalidade} vazio="Selecione" opcoes={FINALIDADES.map(x => [x, x])} />,
                <Lista rotulo="Tipo" valor={f.tipo} mudar={f.setTipo} vazio="Selecione" opcoes={f.tipoOptions} />,
              )}
              <Lista rotulo="Para" valor={f.negocio} mudar={f.setNegocio} vazio="Venda, locação ou os dois" opcoes={NEGOCIOS.map(x => [x, x])} />
              <Texto rotulo="Endereço" valor={f.endereco} mudar={f.setEndereco} obrigatorio placeholder="Rua, número, bairro e cidade" />
              {par(
                <Texto rotulo="Nome do condomínio/edifício" valor={f.condominioNome} mudar={f.setCondominioNome} />,
                <Texto rotulo="Valor do condomínio" valor={f.condominioValor} mudar={f.setCondominioValor} placeholder="R$" />,
              )}
              {par(
                <Texto rotulo="Área total/terreno (m²)" valor={f.areaTotal} mudar={f.setAreaTotal} />,
                <Texto rotulo="Área útil/construída (m²)" valor={f.areaUtil} mudar={f.setAreaUtil} />,
              )}
              {par(
                <Texto rotulo="Dormitórios" valor={f.dormitorios} mudar={f.setDormitorios} />,
                <Texto rotulo="Suítes" valor={f.suites} mudar={f.setSuites} />,
              )}
              {par(
                <Texto rotulo="Vagas cobertas" valor={f.vagasCobertas} mudar={f.setVagasCobertas} />,
                <Texto rotulo="Vagas descobertas" valor={f.vagasDescobertas} mudar={f.setVagasDescobertas} />,
              )}
              <Texto rotulo="Valor pretendido" valor={f.valorPretendido} mudar={f.setValorPretendido} placeholder="R$" />
              <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[var(--m-text)]">
                {/* A caixinha da casa pintada na cor do cliente (exceção da trava `caixinhaCrua`, como no Clássico). */}
                <input
                  type="checkbox" checked={f.aceitaFinanciamento} onChange={e => f.setAceitaFinanciamento(e.target.checked)}
                  className="grid h-4 w-4 shrink-0 cursor-pointer appearance-none place-content-center rounded-[4px] border border-[var(--m-line)] bg-[var(--m-ground)] transition-colors checked:border-[var(--brand)] checked:bg-[var(--brand)] before:hidden before:h-2.5 before:w-2.5 before:bg-[var(--brand-ink)] before:content-[''] before:[clip-path:polygon(14%_44%,0_65%,50%_100%,100%_16%,80%_0%,43%_62%)] checked:before:block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                />
                Aceita financiamento?
              </label>
              <Rotulado rotulo="Outras características">
                {id => (
                  <textarea id={id} value={f.caracteristicas} onChange={e => f.setCaracteristicas(e.target.value)} rows={5}
                    placeholder="Pense nos diferenciais que seu imóvel possui" className={`${CAMPO} border-[var(--m-line)]`} />
                )}
              </Rotulado>
              <button type="submit" className={`w-full bg-[var(--brand)] text-[var(--brand-ink)] ${BOTAO}`}>
                Próximo <Ic d={I.arrow} s={17} />
              </button>
            </form>
          ) : (
            <form onSubmit={f.submit} className="space-y-5">
              <Texto rotulo="Seu nome" valor={f.nome} mudar={f.setNome} obrigatorio placeholder="Como podemos te chamar?" />
              <Rotulado rotulo="WhatsApp" obrigatorio>
                {id => (
                  <>
                    <BrPhoneInput
                      id={id} value={f.telefone} required aria-invalid={f.telefoneErr}
                      onChange={v => { f.setTelefone(v); if (f.telefoneErr) f.setTelefoneErr(false); }}
                      className={`${CAMPO} ${f.telefoneErr ? 'border-red-400' : 'border-[var(--m-line)]'}`}
                    />
                    {f.telefoneErr && <p className="mt-1 text-[13px] text-red-500">Digite um telefone válido com DDD.</p>}
                  </>
                )}
              </Rotulado>
              <Texto rotulo="E-mail" valor={f.email} mudar={f.setEmail} type="email" placeholder="seu@email.com" />
              {f.failed && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-600">{f.failed} O que você preencheu continua aqui.</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => f.setStep(1)} className={`border border-[var(--m-line)] text-[var(--m-head)] ${BOTAO}`}>Voltar</button>
                <button type="submit" disabled={f.sending} className={`flex-1 bg-[var(--brand)] text-[var(--brand-ink)] ${BOTAO}`}>
                  {f.sending ? 'Enviando…' : 'Enviar minha ficha'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
