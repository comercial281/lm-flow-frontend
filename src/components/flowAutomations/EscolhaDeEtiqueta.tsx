import { useId, useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Label as CampoLabel } from '@/components/ui/ds';
import { labelsService } from '@/services/contacts/labelsService';
import { colorForName, sanitizeTitle } from '@/components/labels/labelColors';
import type { Label } from '@/types/settings/labels';
import { cn } from '@/lib/utils';

// Escolher etiqueta no construtor (Entrega 3, arranjo "Lista com grupos"): busca no
// topo, lista sempre visível com Marcadas fixas no alto, Da equipe e Do sistema
// recolhido. Trabalha por TÍTULO (a automação casa por título) e mostra o nome bonito.

const CONTA_GRANDE = 200;
const LIMITE_CONTA_GRANDE = 30;

export interface EscolhaDeEtiquetaProps {
  modo: 'varias' | 'uma';
  escolhidas: string[];
  aoMudar: (titulos: string[]) => void;
  etiquetas: Label[];
  ordem?: 'nome' | 'mais_leads';
  /** Chamado depois de criar a etiqueta (o pai recarrega o catálogo). */
  aoCriar?: (titulo: string) => Promise<void> | void;
}

interface Linha {
  titulo: string;
  nome: string;
  cor?: string;
  leads: number;
  sumiu?: boolean;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const porNome = (a: Linha, b: Linha) => a.nome.localeCompare(b.nome, 'pt-BR');
const textoLeads = (n: number) => (n === 1 ? '1 lead' : `${n} leads`);
const textoMarcadas = (n: number) => (n === 0 ? 'Nenhuma marcada' : n === 1 ? '1 marcada' : `${n} marcadas`);

const paraLinha = (l: Label): Linha => ({
  titulo: l.title,
  nome: l.display_name || l.title,
  cor: l.color,
  leads: l.contacts_count ?? 0,
});

export function EscolhaDeEtiqueta({ modo, escolhidas, aoMudar, etiquetas, ordem = 'nome', aoCriar }: EscolhaDeEtiquetaProps) {
  const idBusca = useId();
  const [busca, setBusca] = useState('');
  const [sistemaAberto, setSistemaAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [criadas, setCriadas] = useState<Label[]>([]);

  const catalogo = useMemo(() => {
    const titulos = new Set(etiquetas.map(l => l.title));
    return [...etiquetas, ...criadas.filter(l => !titulos.has(l.title))];
  }, [etiquetas, criadas]);

  const porTitulo = useMemo(() => new Map(catalogo.map(l => [l.title, l])), [catalogo]);
  const contaGrande = catalogo.length > CONTA_GRANDE;
  const q = busca.trim();

  const ordenar = (linhas: Linha[]) =>
    [...linhas].sort(ordem === 'mais_leads' ? (a, b) => b.leads - a.leads || porNome(a, b) : porNome);

  const marcadas: Linha[] = escolhidas.map(t => {
    const l = porTitulo.get(t);
    return l ? paraLinha(l) : { titulo: t, nome: t, leads: 0, sumiu: true };
  });

  const { equipe, sistema, achou } = useMemo(() => {
    const doTime = catalogo.filter(l => (l.category ?? 'own') === 'own').map(paraLinha);
    const doSistema = catalogo.filter(l => (l.category ?? 'own') !== 'own').map(paraLinha);
    const nq = norm(q);
    const casa = (x: Linha) => norm(x.nome).includes(nq) || norm(x.titulo).includes(nq);
    if (q) {
      const t = doTime.filter(casa);
      const s = doSistema.filter(casa);
      return { equipe: t, sistema: s, achou: t.length + s.length };
    }
    if (contaGrande) {
      const top = [...doTime].sort((a, b) => b.leads - a.leads || porNome(a, b)).slice(0, LIMITE_CONTA_GRANDE);
      return { equipe: top, sistema: [] as Linha[], achou: top.length };
    }
    return { equipe: doTime, sistema: doSistema, achou: doTime.length + doSistema.length };
  }, [catalogo, q, contaGrande]);

  const marcadaSet = new Set(escolhidas);
  const equipeLivre = ordenar(equipe.filter(l => !marcadaSet.has(l.titulo)));
  const sistemaLivre = sistema.filter(l => !marcadaSet.has(l.titulo)).sort(porNome);

  const alternar = (titulo: string) => {
    if (modo === 'uma') return aoMudar([titulo]);
    aoMudar(marcadaSet.has(titulo) ? escolhidas.filter(t => t !== titulo) : [...escolhidas, titulo]);
  };

  const selecionar = (titulo: string) =>
    aoMudar(modo === 'uma' ? [titulo] : marcadaSet.has(titulo) ? escolhidas : [...escolhidas, titulo]);

  const criar = async () => {
    const titulo = sanitizeTitle(q);
    if (!titulo) {
      toast.error('Use letras ou números no nome da etiqueta.');
      return;
    }
    const existente = catalogo.find(l => l.title.toLowerCase() === titulo.toLowerCase());
    if (existente) {
      selecionar(existente.title);
      setBusca('');
      return;
    }
    if (criando) return;
    setCriando(true);
    try {
      const resp = await labelsService.createLabel({ title: titulo, color: colorForName(titulo), show_on_sidebar: true });
      const nova = ((resp as { data?: Label })?.data ?? (resp as unknown as Label)) as Label | undefined;
      const tituloFinal = nova?.title || titulo;
      setCriadas(prev => [...prev, { ...(nova as Label), title: tituloFinal, color: nova?.color || colorForName(titulo), category: 'own', contacts_count: 0 }]);
      await aoCriar?.(tituloFinal);
      selecionar(tituloFinal);
      setBusca('');
    } catch {
      toast.error('Não deu pra criar a etiqueta. Tente de novo.');
    } finally {
      setCriando(false);
    }
  };

  const linha = (l: Linha) => {
    const marcada = marcadaSet.has(l.titulo);
    return (
      <button
        key={l.titulo}
        type="button"
        role="checkbox"
        aria-checked={marcada}
        onClick={() => alternar(l.titulo)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50"
      >
        <span
          aria-hidden="true"
          className={cn('h-2.5 w-2.5 shrink-0 rounded-full', l.sumiu && 'border border-muted-foreground')}
          style={l.sumiu ? undefined : { backgroundColor: l.cor || colorForName(l.titulo) }}
        />
        <span className="min-w-0 flex-1 truncate">{l.nome}</span>
        {l.sumiu ? (
          <span className="text-xs text-destructive">não existe mais</span>
        ) : (
          <span className="text-xs text-muted-foreground">{textoLeads(l.leads)}</span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none',
            marcada ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
          )}
        >
          {marcada ? '✓' : ''}
        </span>
      </button>
    );
  };

  const titulo = (texto: string) => (
    <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{texto}</div>
  );

  const semResultado = q !== '' && achou === 0;
  const sistemaAbre = sistemaAberto || (q !== '' && equipeLivre.length === 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <CampoLabel className="text-xs" htmlFor={idBusca}>{modo === 'uma' ? 'Etiqueta' : 'Etiquetas'}</CampoLabel>
        <span className="text-xs text-muted-foreground">
          {textoMarcadas(escolhidas.length)}
          {modo === 'varias' && escolhidas.length > 0 && (
            <>
              {' '}
              <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => aoMudar([])}>
                Limpar
              </button>
            </>
          )}
        </span>
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id={idBusca}
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (semResultado) void criar();
              else if (q) {
                const primeira = [...equipeLivre, ...sistemaLivre][0];
                if (primeira) alternar(primeira.titulo);
              }
            } else if (e.key === 'Escape' && busca) {
              e.preventDefault();
              e.stopPropagation();
              setBusca('');
            }
          }}
          placeholder="Buscar ou criar etiqueta"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-border bg-background pl-7 pr-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div role="group" aria-label="Etiquetas" className="max-h-[330px] overflow-y-auto rounded-md border border-border">
        {marcadas.length > 0 && (
          <div className="border-b border-border pb-1">
            {titulo('Marcadas')}
            {marcadas.map(linha)}
          </div>
        )}
        {semResultado ? (
          <button
            type="button"
            onClick={() => void criar()}
            disabled={criando}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-primary hover:bg-muted/50 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">Criar etiqueta “{sanitizeTitle(q)}”</span>
          </button>
        ) : (
          <>
            {equipeLivre.length > 0 && (
              <div>
                {titulo('Da equipe')}
                {equipeLivre.map(linha)}
              </div>
            )}
            {sistemaLivre.length > 0 && (
              <div className={cn(equipeLivre.length > 0 && 'border-t border-border')}>
                <button
                  type="button"
                  aria-expanded={sistemaAbre}
                  onClick={() => setSistemaAberto(!sistemaAbre)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                >
                  <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', sistemaAbre && 'rotate-90')} aria-hidden="true" />
                  Do sistema <span className="font-normal">{sistemaLivre.length}</span>
                </button>
                {sistemaAbre && sistemaLivre.map(linha)}
              </div>
            )}
            {q === '' && contaGrande && (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">Em conta grande, as outras aparecem quando você digita.</p>
            )}
            {q === '' && !contaGrande && marcadas.length === 0 && equipeLivre.length === 0 && sistemaLivre.length === 0 && (
              <EmptyState tamanho="compacto" title="Nenhuma etiqueta ainda. Digite um nome pra criar." className="m-2 p-3 text-xs" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
