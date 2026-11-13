import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { I, Ic, type PortalProperty, type PortalTab } from './portalShared';
import { ROTULO_DO_GRUPO, buscarNoIndice, indiceDeLugar, type SugestaoDeLugar } from '@/features/siteBuilder/public/sugestoesDeLugar';

interface Props {
  items: PortalProperty[];
  tab: PortalTab;
  texto: string;
  onTexto: (v: string) => void;
  onEscolher: (s: SugestaoDeLugar) => void;
  /** Enter sem item ativo, ou sair do campo. */
  onConfirmar?: () => void;
  className?: string;
  /** Pra onde a lista abre: pra baixo (padrão) ou pra cima, quando o campo está no pé da tela (capa do Moderno). */
  abrirPara?: 'baixo' | 'cima';
  /** Nome do campo (leitor de tela) e texto de exemplo; a barra grande do Moderno também aceita código. */
  rotulo?: string;
  placeholder?: string;
}

/**
 * Campo "Condomínio, bairro ou cidade": texto livre com sugestões (combobox).
 * Setas mudam o item ativo, Enter escolhe, Esc e clique fora fecham.
 */
export default function CampoDeLugar({
  items, tab, texto, onTexto, onEscolher, onConfirmar, className = '', abrirPara = 'baixo',
  rotulo = 'Condomínio, bairro ou cidade', placeholder = rotulo,
}: Props) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  // O índice sai do catálogo uma vez por aba; cada tecla só filtra o que já está normalizado.
  const indice = useMemo(() => indiceDeLugar(items, tab), [items, tab]);
  const sugestoes = useMemo(() => buscarNoIndice(indice, texto), [indice, texto]);
  const mostrando = aberto && sugestoes.length > 0;

  useEffect(() => { setAtivo(-1); }, [texto]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) { setAberto(false); onConfirmar?.(); }
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto, onConfirmar]);

  const escolher = (s: SugestaoDeLugar) => { setAberto(false); setAtivo(-1); onEscolher(s); };
  const idDe = (i: number) => `${id}-op-${i}`;

  // A lista rola (8 itens + cabeçalhos passam da altura dela): a seta leva junto o item ativo,
  // com o cabeçalho do grupo quando ele é o primeiro. jsdom não tem scrollIntoView.
  const irPara = (i: number) => {
    setAtivo(i);
    document.getElementById(idDe(i))?.parentElement?.scrollIntoView?.({ block: 'nearest' });
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!mostrando) { setAberto(true); return; }
      irPara((ativo + 1) % sugestoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (mostrando) irPara(ativo <= 0 ? sugestoes.length - 1 : ativo - 1);
    } else if (e.key === 'Enter') {
      if (mostrando && ativo >= 0) { e.preventDefault(); escolher(sugestoes[ativo]); }
      // Sem item ativo o Enter segue para o formulário em volta (a busca da capa); a página de busca não tem formulário.
      else { setAberto(false); onConfirmar?.(); }
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  let grupoAnterior = '';
  return (
    <div ref={raiz} className={`relative ${className}`}
      onBlur={e => {
        if (e.relatedTarget && raiz.current?.contains(e.relatedTarget as Node)) return;
        setAberto(false); onConfirmar?.();
      }}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Ic d={I.search} s={17} /></span>
      <input
        type="text" role="combobox" aria-expanded={mostrando} aria-controls={`${id}-lista`} aria-autocomplete="list"
        aria-activedescendant={mostrando && ativo >= 0 ? idDe(ativo) : undefined}
        aria-label={rotulo} autoComplete="off"
        value={texto} placeholder={placeholder}
        onChange={e => { onTexto(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--brand)]" />
      {mostrando && (
        // Clicar na lista (inclusive arrastar a barra de rolagem) não tira o foco do campo: senão ele confirma e fecha.
        <ul id={`${id}-lista`} role="listbox" aria-label="Sugestões" onMouseDown={e => e.preventDefault()}
          className={`absolute left-0 right-0 z-30 max-h-72 ${abrirPara === 'cima' ? 'bottom-full mb-2' : 'top-full mt-1'} overflow-auto rounded-xl border border-black/[0.08] bg-white py-1 shadow-lg`}>
          {sugestoes.map((s, i) => {
            const cabecalho = s.grupo !== grupoAnterior;
            grupoAnterior = s.grupo;
            return (
              <li key={`${s.grupo}-${s.rotulo}`} role="presentation">
                {cabecalho && <div role="presentation" className="px-3.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{ROTULO_DO_GRUPO[s.grupo]}</div>}
                <div id={idDe(i)} role="option" aria-selected={i === ativo}
                  onMouseDown={e => e.preventDefault()} onClick={() => escolher(s)} onMouseEnter={() => setAtivo(i)}
                  className={`cursor-pointer px-3.5 py-2 text-[14px] ${i === ativo ? 'bg-black/[0.05]' : ''}`}>
                  {s.rotulo}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
