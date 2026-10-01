// src/pages/Customer/DashboardNova/ListaRapida.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { dataHora, numero } from '@/lib/formato';
import { fetchDashboardList } from '@/services/dashboard/dashboardMetricsService';
import { linkAgenda, linkCard, linkConversa } from '@/features/dashboard/links';
import { paramsDaApi } from './useDashboardNova';
import type { PodeAbrir } from './usePodeAbrir';
import type { AbrirItem, FiltrosDashboard, ListaItem, ListaKind, ListaRapidaPayload } from './types';

interface Props {
  aberta: boolean;
  kind: ListaKind | null;
  titulo: string;
  filtros: FiltrosDashboard;
  /** Destino que o cargo ou o cliente não abre vira texto, sem clique. */
  pode: PodeAbrir;
  /** O número tem teto no servidor (ex.: "99+"): o total também sai com +. */
  limitado?: boolean;
  onFechar: () => void;
}

const destino = (open: AbrirItem): string => {
  if (open.type === 'card') return linkCard(open.pipeline_id, open.item_id);
  if (open.type === 'conversation') return linkConversa(open.id);
  return linkAgenda({ visita: open.id });
};

const abre = (open: AbrirItem, pode: PodeAbrir): boolean => {
  if (open.type === 'card') return pode.funil;
  if (open.type === 'conversation') return pode.conversas;
  return pode.agenda;
};

/**
 * Na visita, `since` é quando ela está marcada (futuro em "a confirmar"). No
 * lead do período, é quando ele entrou: "desde" soaria como "parado desde".
 */
const prefixoDoQuando = (item: ListaItem, kind: ListaKind): string => {
  if (item.open.type === 'visit') return 'visita em';
  if (kind === 'leads_periodo') return 'entrou em';
  return 'desde';
};

export const detalheDoItem = (item: ListaItem, kind: ListaKind): string => {
  const quando = item.since ? `${prefixoDoQuando(item, kind)} ${dataHora(item.since)}` : null;
  return [item.subtitle, item.owner_name, quando].filter(Boolean).join(' · ');
};

const textoVazio = (kind: ListaKind): string => {
  if (kind === 'leads_periodo') return 'Nenhum lead no período';
  if (kind === 'conversas_periodo') return 'Nenhuma conversa no período';
  return 'Nada pendente aqui';
};

/** O que voltou do servidor, carimbado com o pedido que o gerou. */
interface Resposta {
  pedido: number;
  lista: ListaRapidaPayload | null;
  erro: boolean;
}

/**
 * Os itens por trás de um número, sem sair da Dashboard. Sai das mesmas fontes
 * que o número (Dashboard::QuickList no servidor): clicar em "7" nunca abre 9.
 *
 * A busca não tem como ser abortada, então cada pedido ganha um número e só a
 * resposta do pedido EM VIGOR aparece. Abrir, ou trocar de pendência/filtro com
 * o painel aberto, abre um pedido novo: a lista anterior nunca aparece debaixo
 * do título de agora, nem por um instante. FECHAR não abre pedido: o painel
 * ainda desliza para fora com a última lista, em vez de piscar vazio.
 */
export const ListaRapida: React.FC<Props> = ({ aberta, kind, titulo, filtros, pode, limitado, onFechar }) => {
  const navigate = useNavigate();
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const ultimoRef = useRef(0);
  // String, não o objeto: a Dashboard redesenha com um `filtros` novo a cada
  // render, e isso não pode virar uma busca nova.
  const chaveFiltros = JSON.stringify(paramsDaApi(filtros));
  const chave = kind ? `${kind}|${chaveFiltros}` : '';

  // O pedido em vigor muda NO MESMO render em que a lista abre ou o pedido muda
  // com ela aberta (padrão "ajustar estado quando a prop muda" do React), então
  // a resposta antiga já sai de cena antes de pintar. Fechada, só anota.
  const [vigente, setVigente] = useState({ aberta, chave, pedido: 0 });
  if (vigente.aberta !== aberta || vigente.chave !== chave) {
    setVigente({ aberta, chave, pedido: aberta ? vigente.pedido + 1 : vigente.pedido });
  }
  const pedido = vigente.pedido;

  const carregar = useCallback(async () => {
    if (!kind) return;
    const meu = ++ultimoRef.current;
    setResposta(null);
    try {
      const lista = await fetchDashboardList(kind, JSON.parse(chaveFiltros));
      if (meu === ultimoRef.current) setResposta({ pedido, lista, erro: false });
    } catch {
      if (meu === ultimoRef.current) setResposta({ pedido, lista: null, erro: true });
    }
  }, [kind, chaveFiltros, pedido]);

  useEffect(() => {
    if (aberta) carregar();
    else ultimoRef.current += 1;
  }, [aberta, carregar]);

  const atual = resposta && resposta.pedido === pedido ? resposta : null;
  const lista = atual?.lista ?? null;
  const erro = !!atual?.erro;

  let descricao = 'Carregando…';
  if (erro) descricao = 'Não deu para carregar.';
  else if (lista) descricao = `${numero(lista.total)}${limitado ? '+' : ''} no total`;

  return (
    <Sheet open={aberta} onOpenChange={o => { if (!o) onFechar(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md gap-0">
        <SheetHeader className="pr-10">
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{descricao}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {erro && <EmptyState tipo="erro" aoTentarDeNovo={carregar} />}
          {kind && lista && lista.items.length === 0 && (
            <EmptyState title={textoVazio(kind)} description="Quando aparecer algo, ele entra nesta lista." />
          )}
          {lista?.items.map(item => {
            const detalhe = detalheDoItem(item, lista.kind);
            const texto = (
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.title}</span>
                {detalhe && <span className="block text-xs text-muted-foreground">{detalhe}</span>}
              </span>
            );
            return abre(item.open, pode) ? (
              <button key={item.id} type="button"
                className="flex w-full items-center gap-2 border-t border-border px-1 py-2.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => { onFechar(); navigate(destino(item.open)); }}>
                {texto}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ) : (
              <div key={item.id} className="flex w-full items-center border-t border-border px-1 py-2.5">{texto}</div>
            );
          })}
          {lista && lista.total > lista.items.length && (
            <p className="pt-3 text-xs text-muted-foreground">
              Mostrando {numero(lista.items.length)} de {numero(lista.total)}{limitado ? '+' : ''}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
