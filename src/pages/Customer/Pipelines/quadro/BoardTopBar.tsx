// src/pages/Customer/Pipelines/quadro/BoardTopBar.tsx
// Topo do quadro do funil em três faixas (spec funil §4.1, decisão 10 do Tony):
//   1. ← e o selo do funil · Lead e ⋯
//   2. Abertos · Ganhos · Perdidos · Todos (com os números) e a caixa Arquivados
//   3. busca · contador da aba · Quadro|Lista · Filtros
// O quadro é ferramenta de tela cheia (exceção do padrão de telas): só a folga
// lateral alinha (16/24px).
import { Archive, ArrowLeft, ArrowUpDown, Copy, Download, Edit, Megaphone, MoreVertical, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input,
} from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import PipelineSwitcher from '@/components/pipelines/PipelineSwitcher';
import { numero, plural } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Pipeline, PipelineStatusCounts } from '@/types/analytics';
import type { AbaDoQuadro } from './enderecoDoQuadro';

export type ModoDoQuadro = 'board' | 'list';

const ABAS_COM_SITUACAO: { chave: Exclude<AbaDoQuadro, 'arquivados'>; rotulo: string; conta: keyof PipelineStatusCounts }[] = [
  { chave: 'abertos', rotulo: 'Abertos', conta: 'open' },
  { chave: 'ganhos', rotulo: 'Ganhos', conta: 'won' },
  { chave: 'perdidos', rotulo: 'Perdidos', conta: 'lost' },
  { chave: 'todos', rotulo: 'Todos', conta: 'all' },
];

const MODOS: { valor: ModoDoQuadro; rotulo: string }[] = [
  { valor: 'board', rotulo: 'Quadro' },
  { valor: 'list', rotulo: 'Lista' },
];

export interface BoardTopBarProps {
  pipeline: Pipeline | null;
  pipelines: Pipeline[];
  onTrocarFunil: (pipelineId: string) => void;
  onVoltar: () => void;
  aba: AbaDoQuadro;
  onTrocarAba: (aba: AbaDoQuadro) => void;
  /** Números das abas (servidor); sem eles, as abas aparecem sem número. */
  contagens?: PipelineStatusCounts;
  busca: string;
  onBusca: (texto: string) => void;
  /** Cards à vista na aba, depois de busca e filtros. */
  totalVisivel: number;
  modo: ModoDoQuadro;
  onModo: (modo: ModoDoQuadro) => void;
  quantosFiltros: number;
  onAbrirFiltros: () => void;
  podeAdicionar: boolean;
  onAdicionar: () => void;
  acoes: { exportar: boolean; disparo: boolean };
  onExportar: () => void;
  onDisparo: () => void;
  onEditarFunil: () => void;
  onReordenarEtapas: () => void;
  onCopiarId: () => void;
  onExcluirFunil: () => void;
}

export default function BoardTopBar({
  pipeline, pipelines, onTrocarFunil, onVoltar, aba, onTrocarAba, contagens, busca, onBusca, totalVisivel,
  modo, onModo, quantosFiltros, onAbrirFiltros, podeAdicionar, onAdicionar, acoes, onExportar, onDisparo,
  onEditarFunil, onReordenarEtapas, onCopiarId, onExcluirFunil,
}: BoardTopBarProps) {
  const emArquivados = aba === 'arquivados';

  return (
    <header className="flex-shrink-0 border-b border-border bg-background px-4 shadow-sm sm:px-6">
      {/* Faixa 1: funil e ações */}
      <div className="flex items-center gap-2 py-2">
        <Button variant="ghost" size="sm" onClick={onVoltar} aria-label="Voltar" title="Voltar"
          className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PipelineSwitcher pipelines={pipelines} selectedPipeline={pipeline} onSwitchPipeline={onTrocarFunil} />
        <div className="ml-auto flex items-center gap-2">
          {podeAdicionar && (
            <Button size="sm" onClick={onAdicionar} title="Adicionar lead" className="whitespace-nowrap">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Lead
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Mais ações do funil" title="Mais ações do funil">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {acoes.exportar && (
                <DropdownMenuItem onClick={onExportar}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </DropdownMenuItem>
              )}
              {acoes.disparo && (
                <DropdownMenuItem onClick={onDisparo}>
                  <Megaphone className="mr-2 h-4 w-4" />
                  Disparo em massa
                </DropdownMenuItem>
              )}
              {(acoes.exportar || acoes.disparo) && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={onEditarFunil}>
                <Edit className="mr-2 h-4 w-4" />
                Editar funil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onReordenarEtapas}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Reordenar etapas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopiarId}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onExcluirFunil}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir funil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Faixa 2: situação */}
      <div className="flex items-center gap-2">
        <Abas
          rotulo="Situação dos leads"
          abas={ABAS_COM_SITUACAO.map(a => ({ chave: a.chave, rotulo: a.rotulo, contagem: contagens?.[a.conta] }))}
          ativa={emArquivados ? undefined : aba}
          aoTrocar={chave => onTrocarAba(chave as AbaDoQuadro)}
          className="min-w-0 flex-1 border-b-0"
        />
        <button
          type="button"
          onClick={() => onTrocarAba('arquivados')}
          aria-pressed={emArquivados}
          aria-label={contagens ? `Arquivados ${numero(contagens.archived)}` : 'Arquivados'}
          title="Arquivados"
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium tabular-nums transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            emArquivados ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          {contagens && <span>{numero(contagens.archived)}</span>}
        </button>
      </div>

      {/* Faixa 3: busca, contador, visualização e filtros */}
      <div className="flex flex-wrap items-center gap-2 py-3">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={busca}
            onChange={e => onBusca(e.target.value)}
            placeholder="Buscar lead"
            aria-label="Buscar lead"
            className="h-9 pl-9 pr-8"
          />
          {busca && (
            <button type="button" onClick={() => onBusca('')} aria-label="Limpar busca" title="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{plural(totalVisivel, 'lead', 'leads')}</span>
        <BotoesDeEscolha rotulo="Visualização" valor={modo} opcoes={MODOS} aoEscolher={onModo} />
        <Button type="button" variant={quantosFiltros > 0 ? 'default' : 'outline'} size="sm" onClick={onAbrirFiltros}
          className="gap-1.5 whitespace-nowrap">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {quantosFiltros > 0 ? `Filtros · ${quantosFiltros}` : 'Filtros'}
        </Button>
      </div>
    </header>
  );
}
