// src/components/base/SeletorComAbas.tsx
// Lista de escolha com ABAS no topo: uma escolha só, vinda de uma de duas (ou
// mais) listas. Nasceu no Responsável do Novo contato (02/10/2026), pedido do
// dono: "uma abinha em cima do dropdown pra trocar entre corretores | roleta, ao
// invés de rolar pra baixo". Vale para todo lugar com "dono fixo OU roleta" —
// o destino dos formulários (Lead Ads, portal, site, landing) é o próximo.
//
// Mesma regra do Seletor: no computador, a lista do produto (aqui com as abas);
// no celular, a lista do sistema, com um grupo por aba — a rodinha do iPhone não
// tem aba, e grupo é o equivalente que o polegar já conhece.
import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@evoapi/design-system/popover';
import { cn } from '@/lib/utils';
import { usePonteiroDeToque } from '@/hooks/usePonteiroDeToque';

export interface OpcaoComAbas {
  valor: string;
  rotulo: string;
  /** Desenhado antes do rótulo, na lista e na caixa (inicial do corretor, ícone da roleta). */
  icone?: ReactNode;
}

export interface AbaDoSeletor {
  chave: string;
  rotulo: string;
  opcoes: OpcaoComAbas[];
  /** Frase da aba sem opção nenhuma. */
  vazio?: string;
}

export interface EscolhaComAbas {
  aba: string;
  valor: string;
}

interface Props {
  abas: AbaDoSeletor[];
  value: EscolhaComAbas | null;
  onChange: (escolha: EscolhaComAbas) => void;
  placeholder?: string;
  disabled?: boolean;
  invalido?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

// O <select> do celular carrega aba e valor num texto só. ":" não aparece em id
// (uuid ou número), então a primeira ocorrência separa os dois.
const codificar = (e: EscolhaComAbas) => `${e.aba}:${e.valor}`;
export function decodificar(texto: string): EscolhaComAbas | null {
  const i = texto.indexOf(':');
  if (i <= 0) return null;
  return { aba: texto.slice(0, i), valor: texto.slice(i + 1) };
}

export function SeletorComAbas({
  abas, value, onChange, placeholder = 'Escolha', disabled, invalido, id, className,
  'aria-label': ariaLabel,
}: Props) {
  const toque = usePonteiroDeToque();
  const [aberto, setAberto] = useState(false);
  const [abaVista, setAbaVista] = useState<string>(value?.aba ?? abas[0]?.chave ?? '');

  const escolhida = value
    ? abas.find(a => a.chave === value.aba)?.opcoes.find(o => o.valor === value.valor) ?? null
    : null;

  if (toque) {
    return (
      <select
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        disabled={disabled}
        value={value ? codificar(value) : ''}
        onChange={e => {
          const escolha = decodificar(e.target.value);
          if (escolha) onChange(escolha);
        }}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs',
          invalido && 'border-destructive',
          className,
        )}
      >
        <option value="" disabled>{placeholder}</option>
        {abas.map(aba => (
          <optgroup key={aba.chave} label={aba.rotulo}>
            {aba.opcoes.map(o => (
              <option key={o.valor} value={codificar({ aba: aba.chave, valor: o.valor })}>{o.rotulo}</option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  const abaAtual = abas.find(a => a.chave === abaVista) ?? abas[0];

  return (
    <Popover
      open={aberto}
      onOpenChange={abrir => {
        // Abre sempre na aba do que já está escolhido: quem quer trocar de
        // corretor não deve cair na lista de roletas.
        if (abrir) setAbaVista(value?.aba ?? abas[0]?.chave ?? '');
        setAberto(abrir);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalido || undefined}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs outline-none',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
            invalido && 'border-destructive',
            className,
          )}
        >
          {escolhida?.icone}
          <span className={cn('flex-1 truncate', !escolhida && 'text-muted-foreground')}>
            {escolhida?.rotulo ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      {/* Acima de qualquer janela da casa, como o Seletor. */}
      <PopoverContent align="start" className="z-[1200] w-[var(--radix-popover-trigger-width)] min-w-56 p-1.5">
        {abas.length > 1 && (
          <div role="tablist" className="mb-1.5 flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
            {abas.map(aba => {
              const ativa = aba.chave === abaAtual?.chave;
              return (
                <button
                  key={aba.chave}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAbaVista(aba.chave)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                    ativa ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {aba.rotulo}
                </button>
              );
            })}
          </div>
        )}
        <div role="listbox" aria-label={abaAtual?.rotulo} className="max-h-64 overflow-y-auto">
          {abaAtual && abaAtual.opcoes.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">{abaAtual.vazio ?? 'Nada para escolher aqui.'}</p>
          )}
          {abaAtual?.opcoes.map(o => {
            const marcada = value?.aba === abaAtual.chave && value.valor === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="option"
                aria-selected={marcada}
                onClick={() => {
                  onChange({ aba: abaAtual.chave, valor: o.valor });
                  setAberto(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                {o.icone}
                <span className="flex-1 truncate">{o.rotulo}</span>
                {marcada && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default SeletorComAbas;
