// src/pages/Customer/DashboardNova/ListaRapida.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { dataHora, numero } from '@/lib/formato';
import { fetchDashboardList } from '@/services/dashboard/dashboardMetricsService';
import { linkAgenda, linkCard, linkConversa } from '@/features/dashboard/links';
import { paramsDaApi } from './useDashboardNova';
import type { AbrirItem, FiltrosDashboard, ListaKind, ListaRapidaPayload } from './types';

interface Props {
  aberta: boolean;
  kind: ListaKind | null;
  titulo: string;
  filtros: FiltrosDashboard;
  onFechar: () => void;
}

const destino = (open: AbrirItem): string => {
  if (open.type === 'card') return linkCard(open.pipeline_id, open.item_id);
  if (open.type === 'conversation') return linkConversa(open.id);
  return linkAgenda({ visita: open.id });
};

/** O que voltou do servidor, carimbado com o pedido que o gerou. */
interface Resposta {
  chave: string;
  lista: ListaRapidaPayload | null;
  erro: boolean;
}

/**
 * Os itens por trás de um número, sem sair da Dashboard. Sai das mesmas fontes
 * que o número (Dashboard::QuickList no servidor): clicar em "7" nunca abre 9.
 *
 * A busca não tem como ser abortada, então cada pedido ganha um número e só a
 * resposta do ÚLTIMO entra na tela. Sem isso, trocar de pendência rápido podia
 * mostrar a lista anterior debaixo do título novo.
 */
export const ListaRapida: React.FC<Props> = ({ aberta, kind, titulo, filtros, onFechar }) => {
  const navigate = useNavigate();
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const pedidoRef = useRef(0);
  // String, não o objeto: a Dashboard redesenha com um `filtros` novo a cada
  // render, e isso não pode virar uma busca nova.
  const chaveFiltros = JSON.stringify(paramsDaApi(filtros));
  const chave = kind ? `${kind}|${chaveFiltros}` : '';

  const carregar = useCallback(async () => {
    if (!kind) return;
    const meu = ++pedidoRef.current;
    setResposta(null);
    try {
      const lista = await fetchDashboardList(kind, JSON.parse(chaveFiltros));
      if (meu === pedidoRef.current) setResposta({ chave, lista, erro: false });
    } catch {
      if (meu === pedidoRef.current) setResposta({ chave, lista: null, erro: true });
    }
  }, [kind, chaveFiltros, chave]);

  useEffect(() => {
    if (aberta) carregar();
    else pedidoRef.current += 1;
  }, [aberta, carregar]);

  // Resposta de outro pedido (pendência ou filtro anterior) não vale aqui.
  const atual = resposta && resposta.chave === chave ? resposta : null;
  const lista = atual?.lista ?? null;
  const erro = !!atual?.erro;
  const carregando = !!kind && !atual;

  return (
    <Dialog open={aberta} onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="!left-auto !right-0 !top-0 !translate-x-0 !translate-y-0 h-full max-w-md w-full rounded-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{lista ? `${numero(lista.total)} no total` : ' '}</DialogDescription>
        </DialogHeader>

        {erro && <EmptyState tipo="erro" aoTentarDeNovo={carregar} />}
        {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {lista && lista.items.length === 0 && (
          <EmptyState title="Nada pendente aqui" description="Quando aparecer algo, ele entra nesta lista." />
        )}
        {lista?.items.map(item => {
          const detalhe = [item.subtitle, item.owner_name, item.since ? `desde ${dataHora(item.since)}` : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <button key={item.id} type="button" className="w-full text-left py-2.5 px-1 border-t border-border hover:bg-muted/50"
              onClick={() => { onFechar(); navigate(destino(item.open)); }}>
              <span className="font-medium">{item.title}</span>
              {detalhe && <span className="block text-xs text-muted-foreground">{detalhe}</span>}
            </button>
          );
        })}
        {lista && lista.total > lista.items.length && (
          <p className="pt-3 text-xs text-muted-foreground">
            Mostrando os {numero(lista.items.length)} primeiros de {numero(lista.total)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
