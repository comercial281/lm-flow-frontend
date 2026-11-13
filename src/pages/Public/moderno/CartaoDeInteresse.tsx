import { BrPhoneInput } from '@/components/shared';
import { TEXTO_ENVIO_NA_PREVIA } from '@/features/siteBuilder/public/previa';
import FinalidadeChoice from '../FinalidadeChoice';
import { I, Ic } from '../ficha/iconesDaFicha';
import type { Contato, LinhaDeValor } from '../ficha/useFichaDoImovel';

/* ────────────────────────────────────────────────────────────────────────────
   Cartão de interesse da ficha do Moderno (spec 7; protótipo `.side`): preço
   ("a partir de" no lançamento), fase, código e CRECI, custos, "Fale com um
   especialista", nome e WhatsApp, Tenho interesse, Chamar no WhatsApp e,
   com o book ligado, Receber o book no WhatsApp. O envio, a prévia, a trava
   de duplo envio e as mensagens são os do Clássico (`useFichaDoImovel`).
──────────────────────────────────────────────────────────────────────────── */

const CAMPO = 'w-full rounded-xl border border-[var(--m-line)] bg-[var(--m-ground)] px-4 py-3 text-[15px] text-[var(--m-head)] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--brand)]';
const BOTAO = 'flex w-full items-center justify-center gap-2 rounded-full px-5 py-[13px] text-[14.5px] font-semibold transition-transform hover:-translate-y-px';

export interface PropsDoCartaoDeInteresse {
  contato: Contato; mostraBook: boolean; waHref: string | null;
  price: string | null; priceSuffix: string; aPartirDe: boolean; fase: string | null;
  linhaDoCodigo: string; money: LinhaDeValor[]; atendimento: string | null;
  /** Cartão do celular (no fluxo da página): é o alvo do "Tenho interesse" da barra fixa. */
  id?: string;
}

function Formulario({ contato, mostraBook, waHref }: Pick<PropsDoCartaoDeInteresse, 'contato' | 'mostraBook' | 'waHref'>) {
  const {
    name, setName, phone, setPhone, phoneErr, setPhoneErr, sent, enviando, falhouEnvio, enviadoNaPrevia,
    pedindoBook, setPedindoBook, finalidade, setFinalidade, submitLead, escolheFinalidade,
  } = contato;

  if (sent && enviadoNaPrevia) {
    return <div role="status" className="rounded-2xl bg-amber-400 p-5 text-center font-semibold text-neutral-900">{TEXTO_ENVIO_NA_PREVIA}</div>;
  }
  if (sent) {
    return (
      <div role="status" className="rounded-2xl bg-[var(--m-brand-soft)] p-5 text-center text-[var(--m-head)]">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#1FAF5A] text-white"><Ic d={I.check} s={22} /></div>
        {pedindoBook ? (
          <p className="font-semibold">Pronto! O book vai chegar no seu WhatsApp em alguns minutos.</p>
        ) : (
          <>
            <p className="font-semibold">Recebemos seu interesse!</p>
            <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">Um especialista vai te chamar em breve.</p>
          </>
        )}
      </div>
    );
  }
  return (
    <form onSubmit={submitLead} className="grid gap-2">
      {pedindoBook && <p className="text-[15px] font-semibold text-[var(--m-head)]">Receba o book no WhatsApp</p>}
      {escolheFinalidade && <FinalidadeChoice value={finalidade} onChange={setFinalidade} />}
      <input value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome" className={CAMPO} />
      <BrPhoneInput
        value={phone}
        onChange={v => { setPhone(v); if (phoneErr) setPhoneErr(false); }}
        required
        placeholder="Seu WhatsApp"
        aria-invalid={phoneErr}
        className={`${CAMPO} ${phoneErr ? 'border-red-400' : ''}`}
      />
      {phoneErr && <p className="-mt-0.5 text-[13px] text-red-500">Digite um telefone válido com DDD.</p>}
      {falhouEnvio && <p role="alert" className="text-[13px] text-red-500">{falhouEnvio}</p>}
      <button type="submit" disabled={enviando} className={`${BOTAO} bg-[var(--brand)] text-[var(--brand-ink)]`}>
        {pedindoBook ? 'Receber o book' : 'Tenho interesse'}
      </button>
      {pedindoBook && <button type="button" onClick={() => setPedindoBook(false)} className="w-full text-center text-[13px] text-[var(--m-muted)] underline">Voltar</button>}
      {waHref && (
        <a href={waHref} target="_blank" rel="noreferrer" className={`${BOTAO} bg-[#1FAF5A] text-white`}><Ic d={I.wa} s={18} /> Chamar no WhatsApp</a>
      )}
      {mostraBook && !pedindoBook && (
        <button type="button" onClick={() => setPedindoBook(true)} className={`${BOTAO} border border-[var(--m-line)] bg-[var(--m-surface)] text-[var(--m-head)]`}>
          <Ic d={I.wa} s={18} /> Receber o book no WhatsApp
        </button>
      )}
    </form>
  );
}

export default function CartaoDeInteresse(props: PropsDoCartaoDeInteresse) {
  const { price, priceSuffix, aPartirDe, fase, linhaDoCodigo, money, atendimento, id } = props;
  return (
    <div id={id} data-testid="cartao-de-interesse" className="rounded-[28px] border border-[var(--m-line)] bg-[var(--m-surface)] p-6 shadow-[0_20px_40px_-28px_rgba(8,10,22,0.35)]">
      {price && (
        <>
          {aPartirDe && <span className="block text-[12.5px] text-[var(--m-muted)]">a partir de</span>}
          <b className="block font-[var(--display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--m-head)] tabular-nums">
            {price}{priceSuffix && <span className="text-[15px] font-medium text-[var(--m-muted)]">{priceSuffix}</span>}
          </b>
        </>
      )}
      {fase && <div className="mt-1.5 text-[14px] font-semibold text-[var(--m-head)]">{fase}</div>}
      <div className="mt-1 text-[12.5px] text-[var(--m-muted)]">{linhaDoCodigo}</div>
      {money.length > 0 && (
        <div className="mt-4 border-y border-[var(--m-line)] py-3">
          {money.map(m => (
            <div key={m.label} className="flex justify-between gap-3 py-1 text-[13.5px]">
              <span className="text-[var(--m-muted)]">{m.label}</span>
              <b className="font-semibold tabular-nums text-[var(--m-head)]">{m.value}</b>
            </div>
          ))}
        </div>
      )}
      <h2 className="mb-2.5 mt-4 text-[14px] font-semibold text-[var(--m-head)]">Fale com um especialista sobre este imóvel</h2>
      <Formulario {...props} />
      {atendimento && <p className="mt-4 text-center text-[12px] text-[var(--m-muted)]">{atendimento}</p>}
    </div>
  );
}
