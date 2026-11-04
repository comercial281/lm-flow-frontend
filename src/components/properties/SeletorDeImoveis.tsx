import { useEffect, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { propertiesService } from '@/services/properties/propertiesService';
import type { ListingKind } from '@/features/properties/listingKind';

const TEXTOS = {
  buscar: 'Buscar por título ou código',
  nenhum: 'Nenhum imóvel encontrado.',
  erro: 'Não deu pra carregar os imóveis. Tente de novo.',
  naoEncontrado: 'Imóvel não encontrado',
  sugerido: 'Sugerido',
  selecionados: 'Escolhidos',
  tirar: 'Tirar',
  todos: 'Todos',
} as const;

const TIPOS: { valor: '' | ListingKind; rotulo: string }[] = [
  { valor: '', rotulo: TEXTOS.todos },
  { valor: 'development', rotulo: 'Empreendimentos' },
  { valor: 'resale', rotulo: 'Revenda' },
  { valor: 'auction', rotulo: 'Leilão' },
];

const POR_PAGINA = 20;

interface Resumo { id: string; title: string; code: string }

type PropLike = { id: string | number; title?: string | null; code?: string | null };
const resumir = (p: PropLike): Resumo => ({ id: String(p.id), title: p.title || p.code || 'Imóvel', code: p.code ?? '' });

/**
 * Escolha de imóveis com a lista aberta desde o início (20 mais recentes), busca
 * no servidor e filtro por tipo. Imóvel escolhido fora da página listada
 * continua em "Escolhidos" (nome buscado uma vez por id); falha ao buscar o nome
 * mantém a escolha com texto de reserva, nunca a descarta.
 */
export function SeletorDeImoveis({ id, selecionados, max = 10, sugestaoQ, disabled, aoMudar }: {
  id: string;
  selecionados: string[];
  max?: number;
  sugestaoQ: string | null;
  disabled?: boolean;
  aoMudar: (ids: string[]) => void;
}) {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'' | ListingKind>('');
  const [lista, setLista] = useState<Resumo[]>([]);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState(false);
  const [pronto, setPronto] = useState(false); // 1ª resposta da lista já veio (ou falhou)
  const [sugerido, setSugerido] = useState<Resumo | null>(null);
  const [nomes, setNomes] = useState<Record<string, Resumo | 'falha'>>({});
  const pedidos = useRef(new Set<string>());

  // Lista: imediata ao montar/trocar o tipo; com atraso de 300 ms ao digitar.
  // Só a resposta do pedido mais novo vale.
  useEffect(() => {
    const q = texto.trim();
    let vivo = true; // cleanup derruba: resposta de pedido velho não escreve
    const buscar = () => {
      propertiesService
        .list({ ...(q ? { q } : {}), ...(tipo ? { listing_kind: tipo } : {}), per_page: POR_PAGINA, sort: 'recent' })
        .then(r => {
          if (!vivo) return;
          const itens = (r.data ?? []).map(resumir);
          setLista(itens);
          setTotal(r.meta?.total ?? itens.length);
          setErro(false);
          setPronto(true);
          setNomes(n => { const c = { ...n }; itens.forEach(i => { c[i.id] = i; }); return c; });
        })
        .catch(() => { if (vivo) { setErro(true); setPronto(true); setLista([]); setTotal(0); } });
    };
    if (!q) { buscar(); return () => { vivo = false; }; }
    const espera = window.setTimeout(buscar, 300);
    return () => { window.clearTimeout(espera); vivo = false; };
  }, [texto, tipo]);

  // Sugestão: melhor resultado de sugestaoQ; sem resultado ou com erro, não aparece.
  useEffect(() => {
    setSugerido(null);
    const q = sugestaoQ?.trim();
    if (!q) return;
    let vivo = true;
    propertiesService.list({ q, per_page: 1 })
      .then(r => {
        const p = r.data?.[0];
        if (!vivo || !p) return;
        const s = resumir(p);
        setSugerido(s);
        setNomes(n => ({ ...n, [s.id]: s }));
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [sugestaoQ]);

  // Nome de quem foi escolhido e não veio em nenhuma lista: uma busca por id.
  // Espera a 1ª lista: quem já veio nela dispensa a busca por id.
  useEffect(() => {
    if (!pronto) return;
    selecionados.forEach(sid => {
      if (nomes[sid] || pedidos.current.has(sid)) return;
      pedidos.current.add(sid);
      propertiesService.get(sid)
        .then(p => setNomes(n => ({ ...n, [sid]: resumir(p) })))
        .catch(() => setNomes(n => ({ ...n, [sid]: 'falha' })));
    });
  }, [selecionados, nomes, pronto]);

  const cheio = selecionados.length >= max;
  const alternar = (pid: string) => {
    if (disabled) return;
    aoMudar(selecionados.includes(pid) ? selecionados.filter(x => x !== pid) : cheio ? selecionados : [...selecionados, pid]);
  };

  const mostrarSugerido = !!sugerido && !texto.trim() && !tipo;
  const itens = mostrarSugerido ? [sugerido, ...lista.filter(i => i.id !== sugerido.id)] : lista;

  const rotuloDe = (sid: string): Resumo => {
    const n = nomes[sid];
    if (n === 'falha') return { id: sid, title: TEXTOS.naoEncontrado, code: '' };
    return n ?? { id: sid, title: '…', code: '' };
  };

  return (
    <div className="grid min-w-0 gap-2">
      {selecionados.length > 0 && (
        <div data-testid="selecionados" aria-label={TEXTOS.selecionados} className="flex min-w-0 flex-wrap gap-1.5">
          {selecionados.map(sid => {
            const r = rotuloDe(sid);
            return (
              <span key={sid} className="flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-3 pr-0.5 text-sm">
                <span className="min-w-0 truncate">{r.title}</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`${TEXTOS.tirar} ${r.title}`} disabled={disabled} onClick={() => alternar(sid)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} value={texto} onChange={e => setTexto(e.target.value)} placeholder={TEXTOS.buscar} className="pl-9" disabled={disabled} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map(t => (
          <Button key={t.valor} type="button" size="sm" variant={tipo === t.valor ? 'default' : 'outline'} aria-pressed={tipo === t.valor} disabled={disabled} onClick={() => setTipo(t.valor)}>
            {t.rotulo}
          </Button>
        ))}
      </div>

      {erro ? (
        <p className="px-2 text-sm text-muted-foreground">{TEXTOS.erro}</p>
      ) : itens.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">{TEXTOS.nenhum}</p>
      ) : (
        <ul className="max-h-60 min-w-0 overflow-y-auto overflow-x-hidden rounded-md border border-border">
          {itens.map(p => {
            const marcado = selecionados.includes(p.id);
            return (
              <li key={p.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={marcado}
                  disabled={disabled || (cheio && !marcado)}
                  onClick={() => alternar(p.id)}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
                    marcado && 'bg-primary/10',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.code}</span>
                  </span>
                  {mostrarSugerido && p.id === sugerido.id && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{TEXTOS.sugerido}</span>
                  )}
                  {marcado && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!erro && total > 0 && (
        <p className="px-2 text-xs text-muted-foreground">Mostrando {lista.length} de {total}</p>
      )}
    </div>
  );
}
