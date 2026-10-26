// PAINEL "ESCOLHER LEADS" (opção "Lista de leads" do passo 1 do disparo).
// Abre à direita, por cima da janela do disparo: busca por nome ou telefone,
// filtro de etapa e etiqueta, lista de 20 por página com caixinha. A marcação
// mora em quem abre (`marcados`/`aoMudar`), então sobrevive à troca de página,
// à busca e a fechar o painel. Esc e o "Pronto" fecham só o painel.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/ds';
import { BasePagination } from '@/components/base';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { telefone } from '@/lib/formato';
import type { PipelineStage } from '@/types/analytics';
import { broadcastsService, type LeadOption } from '@/services/broadcasts/broadcastsService';

/** Id do campo "Leads" do passo 1: o foco volta pra ele quando o painel fecha. */
export const ID_DO_CAMPO_DE_LEADS = 'disparo-leads';

const POR_PAGINA = 20;
const ESPERA_DA_BUSCA = 300;

export interface PainelDeLeadsProps {
  aberto: boolean;
  pipelineId: string;
  marcados: string[];
  aoMudar(ids: string[]): void;
  aoFechar(): void;
  /** Etapas do funil da janela (filtro "Etapa"). */
  etapas?: PipelineStage[];
  /** Etiquetas da conta, a mesma fonte do "Por etiqueta" (filtro "Etiqueta", pelo nome). */
  etiquetas?: { title: string }[];
}

export default function PainelDeLeads({
  aberto, pipelineId, marcados, aoMudar, aoFechar, etapas = [], etiquetas = [],
}: PainelDeLeadsProps) {
  const [busca, setBusca] = useState('');
  const [buscaEsperada, setBuscaEsperada] = useState('');
  const [etapa, setEtapa] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [leads, setLeads] = useState<LeadOption[] | null>(null);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState(false);
  const ultimaCarga = useRef(0);

  // Funil trocado: os filtros do outro funil não valem mais.
  useEffect(() => {
    setEtapa('');
    setPagina(1);
  }, [pipelineId]);

  // A busca espera a pessoa parar de digitar; busca nova volta pra página 1.
  useEffect(() => {
    const nova = busca.trim();
    if (nova === buscaEsperada) return;
    const t = setTimeout(() => {
      setBuscaEsperada(nova);
      setPagina(1);
    }, ESPERA_DA_BUSCA);
    return () => clearTimeout(t);
  }, [busca, buscaEsperada]);

  const carregar = useCallback(() => {
    const vez = ++ultimaCarga.current;
    setErro(false);
    setLeads(null);
    broadcastsService
      .leadOptions({
        pipeline_id: pipelineId,
        q: buscaEsperada || undefined,
        stage_id: etapa || undefined,
        label: etiqueta || undefined,
        page: pagina,
      })
      .then(r => {
        if (vez !== ultimaCarga.current) return;
        setLeads(r.data);
        setTotal(r.meta.total);
      })
      .catch(() => {
        if (vez !== ultimaCarga.current) return;
        setLeads([]);
        setTotal(0);
        setErro(true);
      });
  }, [pipelineId, buscaEsperada, etapa, etiqueta, pagina]);

  // Resposta que chega depois de fechar (ou de trocar o filtro) não vale.
  const descartarCarga = useCallback(() => {
    ultimaCarga.current++;
  }, []);

  useEffect(() => {
    if (!aberto || !pipelineId) return;
    carregar();
    return descartarCarga;
  }, [aberto, pipelineId, carregar, descartarCarga]);

  const marcadosSet = useMemo(() => new Set(marcados), [marcados]);
  const idsDaPagina = useMemo(() => (leads ?? []).map(l => l.contact_id), [leads]);
  const marcadosNaPagina = idsDaPagina.filter(id => marcadosSet.has(id)).length;
  const paginaToda = idsDaPagina.length > 0 && marcadosNaPagina === idsDaPagina.length;

  const alternar = (id: string) =>
    aoMudar(marcadosSet.has(id) ? marcados.filter(m => m !== id) : [...marcados, id]);

  // Marca a página inteira; se ela já está toda marcada, desmarca.
  const alternarPagina = () => {
    if (paginaToda) {
      const daPagina = new Set(idsDaPagina);
      aoMudar(marcados.filter(m => !daPagina.has(m)));
    } else {
      aoMudar([...marcados, ...idsDaPagina.filter(id => !marcadosSet.has(id))]);
    }
  };

  const comFiltro = buscaEsperada !== '' || etapa !== '' || etiqueta !== '';
  const totalDePaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <Sheet open={aberto} onOpenChange={o => { if (!o) aoFechar(); }}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-sm"
        onCloseAutoFocus={e => {
          // O painel abre pela escolha da lista, que some: o foco volta pro campo "Leads".
          const campo = document.getElementById(ID_DO_CAMPO_DE_LEADS);
          if (campo) {
            e.preventDefault();
            campo.focus();
          }
        }}
      >
        <SheetHeader className="gap-3 border-b border-border pr-10">
          <SheetTitle>Escolher leads</SheetTitle>
          <SheetDescription className="sr-only">Marque quem recebe o disparo.</SheetDescription>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Buscar por nome ou telefone"
              placeholder="Buscar por nome ou telefone"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Seletor
              aria-label="Etapa"
              className="w-full"
              value={etapa}
              onChange={e => { setEtapa(e.target.value); setPagina(1); }}
            >
              <option value="">Etapa: todas</option>
              {etapas.map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </Seletor>
            <Seletor
              aria-label="Etiqueta"
              className="w-full"
              value={etiqueta}
              onChange={e => { setEtiqueta(e.target.value); setPagina(1); }}
            >
              <option value="">Etiqueta: todas</option>
              {etiquetas.map(l => (
                <option key={l.title} value={l.title}>{l.title}</option>
              ))}
            </Seletor>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {erro ? (
            <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={carregar} className="m-4 p-3" />
          ) : leads === null ? (
            <Carregando variante="lista" linhas={5} rotulo="Carregando os leads…" className="px-4" />
          ) : leads.length === 0 ? (
            <EmptyState
              tamanho="compacto"
              title={comFiltro ? 'Nenhum lead encontrado.' : 'Nenhum lead com telefone neste funil.'}
              className="m-4 p-3"
            />
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2.5 border-b border-border px-4 py-2.5 text-[13px] text-foreground/80">
                <Checkbox
                  checked={paginaToda ? true : marcadosNaPagina > 0 ? 'indeterminate' : false}
                  onCheckedChange={alternarPagina}
                />
                {idsDaPagina.length === 1 ? 'Marcar o lead desta página' : `Marcar os ${idsDaPagina.length} desta página`}
              </label>
              <ul>
                {leads.map(l => (
                  <li key={l.contact_id} className="border-b border-border/50">
                    <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50">
                      <Checkbox checked={marcadosSet.has(l.contact_id)} onCheckedChange={() => alternar(l.contact_id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{l.name || telefone(l.phone)}</span>
                        {l.name && <span className="block text-xs text-muted-foreground">{telefone(l.phone)}</span>}
                      </span>
                      {l.stage_name && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {l.stage_name}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
              {totalDePaginas > 1 && (
                <BasePagination
                  className="px-4 py-3"
                  currentPage={pagina}
                  totalPages={totalDePaginas}
                  totalItems={total}
                  itemsPerPage={POR_PAGINA}
                  onPageChange={setPagina}
                  showItemsPerPage={false}
                  showTotalItems={false}
                  showPageNumbers={false}
                />
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-background p-4 text-sm">
          <span aria-live="polite">
            <strong>{marcados.length}</strong> {marcados.length === 1 ? 'marcado' : 'marcados'}
          </span>
          <Button type="button" onClick={aoFechar}>Pronto</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

