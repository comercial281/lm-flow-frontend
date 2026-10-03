// Peças pequenas reutilizadas pelas seções do cadastro de imóvel.
import { useId } from 'react';
import { Input, Label as UILabel } from '@/components/ui/ds';
import { numero } from '@/lib/formato';

interface OpcaoDePilula<V extends string> { valor: V; rotulo: string }

/** Escolha única em pílulas (radiogroup). `valor` fora das opções = nenhuma marcada. */
export function Pilulas<V extends string>({ rotulo, valor, opcoes, aoMudar }: {
  rotulo: string;
  valor: V | null | undefined;
  opcoes: OpcaoDePilula<V>[];
  aoMudar: (v: V) => void;
}) {
  const idDoRotulo = useId();
  return (
    <div>
      <p id={idDoRotulo} className="mb-1 block text-sm font-medium">{rotulo}</p>
      <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
        {opcoes.map(o => {
          const on = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => aoMudar(o.valor)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              {o.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type SimNaoNulo = 'sim' | 'nao' | 'nulo';
const OPCOES_SIM_NAO: OpcaoDePilula<SimNaoNulo>[] = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'nulo', rotulo: 'Não informado' },
];

/** Sim · Não · Não informado. Grava `true`, `false` ou `null`. */
export function CampoSimNao({ rotulo, valor, aoMudar }: {
  rotulo: string;
  valor: boolean | null | undefined;
  aoMudar: (v: boolean | null) => void;
}) {
  const atual: SimNaoNulo = valor === true ? 'sim' : valor === false ? 'nao' : 'nulo';
  return (
    <Pilulas
      rotulo={rotulo}
      valor={atual}
      opcoes={OPCOES_SIM_NAO}
      aoMudar={v => aoMudar(v === 'sim' ? true : v === 'nao' ? false : null)}
    />
  );
}

/** Inteiro ≥ 0; vazio vira nulo. */
export function CampoNumero({ rotulo, valor, aoMudar, placeholder }: {
  rotulo: string;
  valor: number | null | undefined;
  aoMudar: (v: number | null) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <UILabel htmlFor={id}>{rotulo}</UILabel>
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        value={valor ?? ''}
        placeholder={placeholder}
        onChange={e => {
          const v = e.target.value;
          if (!v) return aoMudar(null);
          const n = parseInt(v, 10);
          if (Number.isFinite(n) && n >= 0) aoMudar(n);
        }}
        className="mt-1"
      />
    </div>
  );
}

/** Campo de texto simples, com o rótulo amarrado ao campo. */
export function CampoTexto({ rotulo, valor, aoMudar, placeholder, type = 'text', multilinha = false }: {
  rotulo: string;
  valor: string | null | undefined;
  aoMudar: (v: string) => void;
  placeholder?: string;
  type?: string;
  multilinha?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <UILabel htmlFor={id}>{rotulo}</UILabel>
      {multilinha ? (
        <textarea
          id={id}
          value={valor ?? ''}
          onChange={e => aoMudar(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      ) : (
        <Input id={id} type={type} value={valor ?? ''} placeholder={placeholder}
          onChange={e => aoMudar(e.target.value)} className="mt-1" />
      )}
    </div>
  );
}

/** Só os dígitos de um texto. */
export const soDigitos = (v: string): string => v.replace(/\D/g, '');

/** Dígitos guardados → "450.000" (milhar da casa). Vazio fica vazio. */
export const mascaraReais = (digitos: string | null | undefined): string => {
  const d = soDigitos(digitos ?? '');
  return d ? numero(Number(d)) : '';
};

/** Valor em reais com máscara; guarda só dígitos. */
export function CampoReais({ rotulo, valor, aoMudar }: {
  rotulo: string;
  valor: string | null | undefined;
  aoMudar: (digitos: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <UILabel htmlFor={id}>{rotulo}</UILabel>
      <Input id={id} inputMode="numeric" value={mascaraReais(valor)} placeholder="450.000"
        onChange={e => aoMudar(soDigitos(e.target.value))} className="mt-1" />
    </div>
  );
}
