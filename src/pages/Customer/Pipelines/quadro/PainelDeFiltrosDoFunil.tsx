// src/pages/Customer/Pipelines/quadro/PainelDeFiltrosDoFunil.tsx
// Painel de filtros do funil, largo e com rolagem, na lateral direita (spec
// funil §4.3, modelo "Filtrar atendimentos" do Praedium). Edita um rascunho;
// só vale no Filtrar. Filtrar e Limpar filtros ficam fixos embaixo.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input, Label, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/ds';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import EtiquetasDeEscolha from '@/components/base/EtiquetasDeEscolha';
import EmptyState from '@/components/base/EmptyState';
import { listOptionsService, type ListOption } from '@/services/listOptions/listOptionsService';
import { ROTULOS_DO_FILTRO_DE_TAREFAS } from '@/features/tarefas/filtroDoFunil';
import type { PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS, type AbaDoQuadro, type FiltrosDoFunil, type TarefaDoFiltro } from './enderecoDoQuadro';
import { motivoNaAba, opcoesDeOrigem, opcoesDeResponsavel } from './filtrosDoFunil';

type EscolhaDeLargados = 'nenhum' | '7' | '14' | '30' | 'outro';

const OPCOES_DE_LARGADOS: { valor: EscolhaDeLargados; rotulo: string }[] = [
  { valor: 'nenhum', rotulo: 'Nenhum' },
  { valor: '7', rotulo: '7+ dias' },
  { valor: '14', rotulo: '14+ dias' },
  { valor: '30', rotulo: '30+ dias' },
  { valor: 'outro', rotulo: 'Outro' },
];

// Rótulos da regra publicada pela sessão de Tarefas (uma só fonte).
const OPCOES_DE_TAREFA: { valor: TarefaDoFiltro; rotulo: string }[] = [
  { valor: 'hoje', rotulo: ROTULOS_DO_FILTRO_DE_TAREFAS.hoje },
  { valor: 'atrasada', rotulo: ROTULOS_DO_FILTRO_DE_TAREFAS.atrasadas },
];

// AAAA-MM-DD do dia LOCAL (sem toLocale*: o formato de tela mora em @/lib/formato).
const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const escolhaDe = (largados: number | null): EscolhaDeLargados =>
  largados == null ? 'nenhum' : largados === 7 || largados === 14 || largados === 30 ? (String(largados) as EscolhaDeLargados) : 'outro';

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

export interface PainelDeFiltrosDoFunilProps {
  aberto: boolean;
  aoFechar: () => void;
  aba: AbaDoQuadro;
  filtros: FiltrosDoFunil;
  aoFiltrar: (filtros: FiltrosDoFunil) => void;
  /** Etapas do funil com os cards da aba (sem filtro): dão as opções de Origem e Responsável. */
  stages: PipelineStage[];
  /** Etiquetas da conta (o catálogo inteiro, não só as que aparecem nos cards). */
  etiquetas: { name: string; color: string }[];
}

export default function PainelDeFiltrosDoFunil({
  aberto, aoFechar, aba, filtros, aoFiltrar, stages, etiquetas,
}: PainelDeFiltrosDoFunilProps) {
  const [rascunho, setRascunho] = useState<FiltrosDoFunil>(filtros);
  const [largados, setLargados] = useState<EscolhaDeLargados>(escolhaDe(filtros.largados));
  const [outrosDias, setOutrosDias] = useState('');

  // Abriu: o rascunho começa do que está valendo.
  useEffect(() => {
    if (!aberto) return;
    setRascunho(filtros);
    setLargados(escolhaDe(filtros.largados));
    setOutrosDias(escolhaDe(filtros.largados) === 'outro' ? String(filtros.largados) : '');
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const comMotivo = motivoNaAba(aba);
  const [motivos, setMotivos] = useState<ListOption[] | null>(null);
  const [erroMotivos, setErroMotivos] = useState(false);
  const carregarMotivos = useCallback(async () => {
    setErroMotivos(false);
    try {
      // Arquivado também: card antigo ainda tem o motivo velho.
      setMotivos(await listOptionsService.list('loss_reasons', { includeInactive: true }));
    } catch {
      setErroMotivos(true);
    }
  }, []);
  useEffect(() => {
    if (aberto && comMotivo && motivos === null && !erroMotivos) void carregarMotivos();
  }, [aberto, comMotivo, motivos, erroMotivos, carregarMotivos]);

  const mudar = <K extends keyof FiltrosDoFunil>(chave: K, valor: FiltrosDoFunil[K]) =>
    setRascunho(r => ({ ...r, [chave]: valor }));

  const idsDasEtapas = useMemo(() => stages.map(s => String(s.id)), [stages]);
  const opcoesDeEtapa = useMemo(() => stages.map(s => ({ valor: String(s.id), rotulo: s.name })), [stages]);
  const origens = useMemo(() => opcoesDeOrigem(stages), [stages]);
  const responsaveis = useMemo(() => opcoesDeResponsavel(stages), [stages]);

  const atalho = (diasAtras: number) => {
    const hoje = new Date();
    const desde = new Date(hoje);
    desde.setDate(desde.getDate() - diasAtras);
    setRascunho(r => ({ ...r, de: diaLocal(desde), ate: diaLocal(hoje) }));
  };

  const filtrar = () => {
    const dias = Number.parseInt(outrosDias, 10);
    const valorDeLargados =
      largados === 'nenhum' ? null : largados === 'outro' ? (Number.isFinite(dias) && dias > 0 ? dias : null) : Number(largados);
    aoFiltrar({ ...rascunho, largados: valorDeLargados });
    aoFechar();
  };

  const limpar = () => {
    setRascunho(FILTROS_VAZIOS);
    setLargados('nenhum');
    setOutrosDias('');
    aoFiltrar(FILTROS_VAZIOS);
  };

  return (
    <Sheet open={aberto} onOpenChange={o => { if (!o) aoFechar(); }}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Filtros do funil</SheetTitle>
          <SheetDescription>Valem para a aba aberta. O endereço guarda os filtros: dá pra mandar o link.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          <Secao id="filtro-criado" titulo="Criado em">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => atalho(0)}>Hoje</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => atalho(7)}>Últimos 7 dias</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => atalho(30)}>Últimos 30 dias</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="filtro-de">De</Label>
                <Input id="filtro-de" type="date" value={rascunho.de} max={rascunho.ate || undefined}
                  onChange={e => mudar('de', e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="filtro-ate">Até</Label>
                <Input id="filtro-ate" type="date" value={rascunho.ate} min={rascunho.de || undefined}
                  onChange={e => mudar('ate', e.target.value)} />
              </div>
            </div>
          </Secao>

          <Secao id="filtro-etapas" titulo="Etapas">
            <EtiquetasDeEscolha rotulo="Etapas" opcoes={opcoesDeEtapa} escolhidas={rascunho.etapas} aoMudar={v => mudar('etapas', v)} />
          </Secao>

          <Secao id="filtro-origem" titulo="Origem">
            {origens.length === 0
              ? <p className="text-sm text-muted-foreground">Nenhum lead nesta aba.</p>
              : <EtiquetasDeEscolha rotulo="Origem" opcoes={origens} escolhidas={rascunho.origens} aoMudar={v => mudar('origens', v)} />}
          </Secao>

          <Secao id="filtro-resp" titulo="Responsável">
            {responsaveis.length === 0
              ? <p className="text-sm text-muted-foreground">Nenhum lead nesta aba.</p>
              : <EtiquetasDeEscolha rotulo="Responsável" opcoes={responsaveis} escolhidas={rascunho.resp} aoMudar={v => mudar('resp', v)} />}
          </Secao>

          <Secao id="filtro-etiq" titulo="Etiquetas">
            {etiquetas.length === 0
              ? <p className="text-sm text-muted-foreground">Nenhuma etiqueta cadastrada.</p>
              : <EtiquetasDeEscolha rotulo="Etiquetas" opcoes={etiquetas.map(e => ({ valor: e.name, rotulo: e.name }))}
                  escolhidas={rascunho.etiq} aoMudar={v => mudar('etiq', v)} />}
          </Secao>

          {comMotivo && (
            <Secao id="filtro-motivo" titulo="Motivo da perda">
              {erroMotivos ? (
                <EmptyState tipo="erro" aoTentarDeNovo={() => { void carregarMotivos(); }} />
              ) : motivos === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Carregando os motivos" />
              ) : (
                <EtiquetasDeEscolha
                  rotulo="Motivo da perda"
                  opcoes={motivos.map(m => ({ valor: m.id, rotulo: m.active ? m.label : `${m.label} (arquivado)` }))}
                  escolhidas={rascunho.motivos}
                  aoMudar={v => mudar('motivos', v)}
                />
              )}
            </Secao>
          )}

          <Secao id="filtro-largados" titulo="Largados">
            <BotoesDeEscolha rotulo="Sem contato há" valor={largados} opcoes={OPCOES_DE_LARGADOS} aoEscolher={setLargados} />
            {largados === 'outro' && (
              <div className="flex items-center gap-2">
                <Input aria-label="Dias sem contato" type="number" min={1} value={outrosDias}
                  onChange={e => setOutrosDias(e.target.value)} className="w-28" />
                <span className="text-sm text-muted-foreground">dias ou mais sem contato</span>
              </div>
            )}
          </Secao>

          <Secao id="filtro-tarefas" titulo="Tarefas">
            <EtiquetasDeEscolha rotulo="Tarefas" opcoes={OPCOES_DE_TAREFA} escolhidas={rascunho.tarefas}
              aoMudar={v => mudar('tarefas', v as TarefaDoFiltro[])} />
          </Secao>

          <Secao id="filtro-colunas" titulo="Colunas visíveis">
            <EtiquetasDeEscolha
              rotulo="Colunas visíveis"
              opcoes={opcoesDeEtapa}
              escolhidas={rascunho.colunas.length ? rascunho.colunas : idsDasEtapas}
              aoMudar={v => mudar('colunas', v.length === 0 || v.length === idsDasEtapas.length ? [] : v)}
            />
            <p className="text-xs text-muted-foreground">Nenhuma marcada mostra todas.</p>
          </Secao>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border bg-background p-4">
          <Button type="button" variant="outline" className="flex-1" onClick={limpar}>Limpar filtros</Button>
          <Button type="button" className="flex-1" onClick={filtrar}>Filtrar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
