// Barra de topo da IA Vendedora (modelo do Meu site): seletor da IA com "Nova IA",
// o selo do veredito e os menus Painel ▾ · Configurar · Ensinar · Testar ·
// Diagnóstico, no lugar da lista de IAs à esquerda e das 8 abas.
// O menu lateral do LM Flow não muda: isto é navegação DENTRO da página.
import { Bot, ChevronDown, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { GRUPOS, itensDoGrupo, telaInfo, type TelaId } from '@/features/salesAgents/iaMenu';
import { situacaoDaIa, type Situacao } from '@/features/salesAgents/situacao';
import SeloSituacao from './SeloSituacao';

export interface IaBarraProps {
  agents: SalesAgent[];
  selecionada: SalesAgent | null;
  /** Veredito da IA aberta, já com o Diagnóstico. As outras do seletor usam só a configuração. */
  situacao: Situacao | null;
  tela: TelaId;
  insights: boolean;
  podeCriar: boolean;
  podeExcluir: boolean;
  aoIr: (tela: TelaId) => void;
  aoTrocarIa: (id: string) => void;
  aoCriar: () => void;
  aoDuplicar: () => void;
  aoExcluir: () => void;
}

export default function IaBarra({
  agents, selecionada, situacao, tela, insights, podeCriar, podeExcluir,
  aoIr, aoTrocarIa, aoCriar, aoDuplicar, aoExcluir,
}: IaBarraProps) {
  const grupoAtual = telaInfo(tela).grupo;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-card px-6 py-2">
      <div className="flex min-w-0 items-center gap-2 py-1">
        <Bot className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="max-w-[280px] px-2">
              <span className="truncate text-sm font-semibold">{selecionada?.name ?? 'IA Vendedora'}</span>
              <ChevronDown className="ml-1 h-4 w-4 shrink-0" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[300px]">
            {agents.map((a) => (
              <DropdownMenuItem key={a.id} onSelect={() => aoTrocarIa(a.id)} className="flex items-center justify-between gap-3">
                <span className={`truncate text-sm ${a.id === selecionada?.id ? 'font-semibold' : ''}`}>{a.name}</span>
                <SeloSituacao compacto situacao={a.id === selecionada?.id && situacao ? situacao : situacaoDaIa(a)} />
              </DropdownMenuItem>
            ))}
            {podeCriar && (
              <>
                {agents.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={aoCriar}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden /> Nova IA
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {situacao && <SeloSituacao situacao={situacao} />}
      </div>

      {selecionada && (
        <nav aria-label="Menu da IA Vendedora" className="flex flex-1 flex-wrap items-center gap-1">
          {GRUPOS.map((g) => {
            const itens = itensDoGrupo(g.id, { insights });
            const cls = grupoAtual === g.id ? 'bg-accent text-accent-foreground' : '';
            // Grupo de uma tela só é botão direto; o Painel sem a chave fica só com a Visão geral.
            if (itens.length === 1) {
              return (
                <Button key={g.id} variant="ghost" className={cls} onClick={() => aoIr(itens[0].id)}>
                  {g.rotulo}
                </Button>
              );
            }
            return (
              <DropdownMenu key={g.id}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className={cls}>
                    {g.rotulo} <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[240px]">
                  {itens.map((t) => (
                    <DropdownMenuItem key={t.id} onSelect={() => aoIr(t.id)} className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-medium">{t.rotulo}</span>
                      <span className="text-xs text-muted-foreground">{t.dica}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>
      )}

      {selecionada && (podeCriar || podeExcluir) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Mais ações" title="Mais ações">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {podeCriar && (
              <DropdownMenuItem onSelect={aoDuplicar}>
                <Copy className="mr-2 h-4 w-4" aria-hidden /> Duplicar esta IA
              </DropdownMenuItem>
            )}
            {podeExcluir && (
              <DropdownMenuItem onSelect={aoExcluir} className="text-red-600 focus:text-red-600">
                <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Excluir IA
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
