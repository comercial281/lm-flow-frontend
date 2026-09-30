import type { Finalidade } from './finalidade';

interface Props {
  value: Finalidade;
  onChange: (value: Finalidade) => void;
}

const OPCOES: Array<[Finalidade, string]> = [
  ['venda', 'Quero comprar'],
  ['locacao', 'Quero alugar'],
];

/**
 * "Quero comprar / Quero alugar" nos formulários do site: é o que separa o lead
 * de venda do de locação quando o imóvel não decide sozinho (spec 2026-09-30,
 * D3). Usa a cor da marca do cliente (`--brand`), como o resto do portal.
 */
export default function FinalidadeChoice({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="O que você procura" className="grid grid-cols-2 gap-2">
      {OPCOES.map(([opcao, label]) => (
        <label
          key={opcao}
          className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-[14px] font-semibold transition-colors ${
            value === opcao ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-black/10 text-neutral-600'
          }`}
        >
          <input
            type="radio"
            name="finalidade"
            value={opcao}
            checked={value === opcao}
            onChange={() => onChange(opcao)}
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
