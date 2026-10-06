// IA Vendedora — a casca (entrega 1 da refatoração, 05/10/2026).
//
// Barra de topo (`IaBarra`) com o seletor da IA, o selo do veredito e os menus
// Painel ▾ · Configurar · Ensinar · Testar · Diagnóstico, no modelo do Meu site.
// O endereço diz a IA e a tela (`?ia=<id>&tela=<id>`), com `replace`: o Voltar
// do navegador sai da página em vez de percorrer as telas. Cada tela mora em
// `telas/`; o Configurar é o passo a passo de `configurar/` (entrega 2), e cada
// passo grava só o que é dele (`configurar/useRascunho.ts`), devolvendo a IA salva
// por `aoSalvo`. Spec: LM FLOW/specs/2026-10-05-ia-vendedora-refatoracao-design.md.
import { startTransition, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import DuplicateAgentDialog from '@/components/salesAgents/DuplicateAgentDialog';
import { salesAgentsService, type HealthReport, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import NoAccessState from '@/components/permissions/NoAccessState';
import { classifyLoadFailure, type LoadFailure } from '@/services/core/forbidden';
import { useCan } from '@/hooks/useCan';
import inboxesService from '@/services/channels/inboxesService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { PEDIDO_SAIR_SEM_SALVAR, limparPendentes, temAlteracaoPendente } from '@/hooks/useAlteracoesNaoSalvas';
import {
  iaDaUrl, iaInicial, paramsDaIa, telaDaUrl, telaInfo, trilhaDe, type TelaId,
} from '@/features/salesAgents/iaMenu';
import { situacaoDaIa } from '@/features/salesAgents/situacao';
import { novaIaRascunho } from '@/features/salesAgents/tresEscolhas';
import { type InboxOption } from './configuracao/comum';
import IaBarra from './IaBarra';
import TelaVisaoGeral from './telas/TelaVisaoGeral';
import TelaSugestoes from './telas/TelaSugestoes';
import TelaRelatorioSemanal from './telas/TelaRelatorioSemanal';
import TelaConfigurar from './telas/TelaConfigurar';
import TelaEnsinar from './telas/TelaEnsinar';
import TelaTestar from './telas/TelaTestar';
import TelaDiagnostico from './telas/TelaDiagnostico';

// A última IA aberta neste navegador: com várias IAs, `/ia-vendedora` abre nela.
// Conveniência, não dado: storage bloqueado (aba anônima) só faz abrir a primeira.
const ULTIMA_IA = 'lmflow:ia-vendedora:ultima';
const lerUltimaIa = (): string | null => {
  try { return localStorage.getItem(ULTIMA_IA); } catch { return null; }
};
const gravarUltimaIa = (id: string) => {
  try { localStorage.setItem(ULTIMA_IA, id); } catch { /* storage bloqueado: segue sem lembrar */ }
};

export default function SalesAgents() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [selected, setSelected] = useState<SalesAgent | null>(null);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<SalesAgent | null>(null);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [diagnostico, setDiagnostico] = useState<{ id: string; report: HealthReport } | null>(null);
  const [conferindo, setConferindo] = useState(false);
  // Id da IA cuja leitura do Diagnóstico falhou (502, perfil sem a permissão…).
  const [diagnosticoFalhou, setDiagnosticoFalhou] = useState<string | null>(null);
  const pode = useCan();
  // ⚠️ A chave vai LITERAL aqui. Os dois scanners do catálogo de funcionalidades
  // (sync e audit) leem o código por regex: trocar o literal por uma constante
  // tira a chave do catálogo no deploy seguinte, o painel de Funções deixa de
  // oferecer o botão de liberar, e ninguém é avisado.
  // `isSuper ||`: a Leal Mídia sempre vê, como a aba de Landings.
  const isSuper = useIsSuperAdmin();
  const insightsToggle = useClientToggle('ia_insights');
  const roletaNova = useClientToggle('roleta_nova');
  const insightsLiberado = isSuper || insightsToggle;

  const [searchParams, setSearchParams] = useSearchParams();
  // Sugestões e Relatório semanal sem a chave caem na Visão geral (`telaDaUrl`):
  // o gate fica no menu e no endereço, como as Páginas de anúncio do Meu site.
  const tela = telaDaUrl(searchParams, { insights: insightsLiberado });
  const iaPedida = iaDaUrl(searchParams);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setLoadFailure(null);
    try {
      const list = await salesAgentsService.list();
      setAgents(list);
      setSelected((prev) => (prev ? list.find((a) => a.id === prev.id) ?? null : null));
    } catch (e) {
      const kind = classifyLoadFailure(e);
      setLoadFailure(kind);
      if (kind === 'failed') toast.error('Erro ao carregar os agentes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    inboxesService
      .list()
      .then((res) => {
        const data = ((res as unknown as { data?: InboxOption[] }).data) ?? [];
        setInboxes(data.map((i) => ({ id: i.id, name: i.name })));
      })
      .catch(() => setInboxes([]));
  }, [loadAgents]);

  // Endereço → IA aberta. Resolve a IA (a do endereço, a última usada ou a
  // primeira), reescreve o endereço no formato certo (inclusive o `?agent=` que o
  // assistente ainda usa pra devolver) e lembra a escolha.
  useEffect(() => {
    if (loading) return;
    const alvo = iaInicial(agents.map((a) => a.id), iaPedida, lerUltimaIa());
    // O passo do passo a passo atravessa a normalização (só vale em Configurar).
    const certo = paramsDaIa(alvo, tela, searchParams.get('passo'));
    if (searchParams.toString() !== new URLSearchParams(certo).toString()) setSearchParams(certo, { replace: true });
    if (alvo) gravarUltimaIa(alvo);
    setSelected((prev) => (prev?.id === alvo ? prev : agents.find((a) => a.id === alvo) ?? null));
  }, [loading, agents, iaPedida, tela, searchParams, setSearchParams]);

  // O Diagnóstico da IA aberta alimenta o selo e as pendências. Relido quando a
  // IA muda ou é salva (`updated_at`), nunca a cada tecla. Falha não grita: o
  // selo cai no que a própria configuração diz.
  const selId = selected?.id;
  const selUpdatedAt = selected?.updated_at;
  useEffect(() => {
    if (!selId) {
      setDiagnostico(null);
      return;
    }
    let vivo = true;
    setConferindo(true);
    setDiagnosticoFalhou(null);
    salesAgentsService
      .diagnostics(selId)
      .then((d) => { if (vivo) setDiagnostico({ id: selId, report: d }); })
      .catch(() => { if (vivo) { setDiagnostico(null); setDiagnosticoFalhou(selId); } })
      .finally(() => { if (vivo) setConferindo(false); });
    return () => { vivo = false; };
  }, [selId, selUpdatedAt]);

  const irPara = useCallback((t: TelaId, passo?: number) => {
    setSearchParams(paramsDaIa(selected?.id ?? null, t, passo), { replace: true });
  }, [selected?.id, setSearchParams]);

  // O que um passo (ou o Ensinar) salvou: atualiza a IA aberta E a lista do seletor.
  const aoSalvo = useCallback((a: SalesAgent) => {
    setSelected(a);
    setAgents((prev) => prev.map((x) => (x.id === a.id ? a : x)));
  }, []);

  // ⚠️ Cada passo do Configurar tem o próprio Salvar (a tela antiga gravava no blur).
  // Trocar de IA, de tela, criar ou duplicar com um passo pela metade pergunta antes;
  // senão a edição some calada. Os botões da barra não são links, e a guarda do menu
  // lateral (useGuardaDeSaida) não os pega.
  const guardar = useCallback(async (acao: () => void) => {
    if (temAlteracaoPendente() && !(await confirmar(PEDIDO_SAIR_SEM_SALVAR))) return;
    limparPendentes();
    acao();
  }, [confirmar]);

  const trocarIa = useCallback((id: string) => {
    setSearchParams(paramsDaIa(id, tela), { replace: true });
  }, [tela, setSearchParams]);

  // Cria a IA (desligada) e abre o assistente em tela cheia. Quem preferir
  // configurar na mão sai por "Configurar depois" lá dentro e volta para cá com a
  // IA nova selecionada (`?agent=`) — a IA existe nos dois caminhos.
  // Nova IA (entrega 2): cria um RASCUNHO desligado e sem número (modelo de partida
  // em `novaIaRascunho`) e abre o passo 1 do passo a passo. Substitui o "+" que
  // criava a IA e abria o assistente: o rascunho aparece no seletor como "Rascunho".
  const createAgent = async () => {
    try {
      const nova = await salesAgentsService.create(novaIaRascunho({ roletaNova }));
      // ⚠️ O React Router 7 troca o endereço dentro de uma transição. Se a lista
      // mudasse antes, a resolução do endereço veria a IA nova com o endereço velho
      // (vazio, na primeira IA da conta) e mandaria pra Visão geral. As duas
      // mudanças vão na MESMA transição.
      setSearchParams(paramsDaIa(nova.id, 'configurar', 1), { replace: true });
      startTransition(() => {
        setAgents((prev) => [nova, ...prev]);
        setSelected(nova);
      });
    } catch {
      toast.error('Não deu pra criar a IA. Tente de novo.');
    }
  };

  const deleteAgent = async (agent: SalesAgent) => {
    if (!(await confirmar({
      titulo: 'Excluir IA',
      descricao: <>Excluir a IA <strong>{agent.name}</strong>?</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await salesAgentsService.destroy(agent.id);
      toast.success('Excluído');
      if (selected?.id === agent.id) setSelected(null);
      await loadAgents();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  // Recusa do servidor NÃO é "nenhuma IA criada" — era assim que o gestor sem
  // a permissão criava uma IA duplicada.
  if (loadFailure === 'forbidden') return <NoAccessState />;

  const podeCriar = pode('sales_agents', 'create');
  // ⚠️ O relatório é de UMA IA: ao trocar A→B, o de A não vale pra B (o selo
  // mentiria até o de B chegar). Só relido por `updated_at` mantém, sem piscar.
  const diagnosticoDaIa = selected && diagnostico?.id === selected.id ? diagnostico.report : null;
  const situacao = selected ? situacaoDaIa(selected, diagnosticoDaIa) : null;
  const info = telaInfo(tela);
  const trilha = trilhaDe(tela);

  return (
    <>
      <div className="flex min-h-full flex-col">
        <IaBarra
          agents={agents}
          selecionada={selected}
          situacao={situacao}
          tela={tela}
          insights={insightsLiberado}
          podeCriar={podeCriar}
          podeExcluir={pode('sales_agents', 'delete')}
          aoIr={(t) => void guardar(() => irPara(t))}
          aoTrocarIa={(id) => void guardar(() => trocarIa(id))}
          aoCriar={() => void guardar(() => void createAgent())}
          aoDuplicar={() => void guardar(() => { if (selected) setDuplicating(selected); })}
          aoExcluir={() => selected && void deleteAgent(selected)}
        />
        <div className="w-full space-y-5 px-6 py-6">
          {loading && agents.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !selected || !situacao ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-sidebar-border bg-sidebar p-6">
              <p className="text-sm text-muted-foreground">Nenhuma IA Vendedora criada ainda.</p>
              {podeCriar && (
                <Button onClick={createAgent}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden /> Nova IA
                </Button>
              )}
            </div>
          ) : (
            // ⚠️ `key` = id da IA: trocar de IA remonta a tela inteira. Sem isso o
            // Testar levava a conversa da IA anterior (e a próxima mensagem iria
            // pra nova com o histórico da outra), a Visão geral mostrava os
            // números dela e Sugestões seguia lendo a análise dela.
            // Largura do Meu site (até 1400 px, centralizado) em todas as telas: com 768 px
            // o passo a passo ficava espremido entre o trilho e a prévia.
            <div key={selected.id} className="mx-auto w-full max-w-[1400px] space-y-5">
              <div className="space-y-1">
                {trilha && <p className="text-xs font-medium text-muted-foreground">{trilha}</p>}
                <h1 className="text-2xl font-semibold">{info.titulo}</h1>
                <p className="text-sm text-muted-foreground">{info.frase}</p>
              </div>
              {tela === 'visao-geral' && (
                <TelaVisaoGeral
                  agent={selected}
                  situacao={situacao}
                  diagnostico={diagnosticoDaIa}
                  conferindo={conferindo}
                  falhou={diagnosticoFalhou === selected.id}
                  mostrarSugestoes={insightsLiberado}
                  aoIr={irPara}
                />
              )}
              {tela === 'sugestoes' && insightsLiberado && <TelaSugestoes agent={selected} />}
              {tela === 'relatorio-semanal' && insightsLiberado && <TelaRelatorioSemanal />}
              {tela === 'configurar' && (
                <TelaConfigurar agent={selected} inboxes={inboxes} aoSalvo={aoSalvo} />
              )}
              {tela === 'ensinar' && <TelaEnsinar agent={selected} onCountChange={loadAgents} aoSalvo={aoSalvo} />}
              {tela === 'testar' && <TelaTestar agent={selected} />}
              {tela === 'diagnostico' && <TelaDiagnostico agent={selected} />}
            </div>
          )}
        </div>
      </div>
      {dialogoDeConfirmacao}
      {duplicating && (
        <DuplicateAgentDialog
          agent={duplicating}
          inboxes={inboxes}
          onClose={() => setDuplicating(null)}
          onDuplicated={(copy) => {
            // A cópia vira a IA aberta, em Configurar: é lá que se confere antes
            // de ligar.
            // ⚠️ A cópia entra na lista ANTES de o endereço apontar pra ela: sem
            // isso a resolução do endereço não acha o id e volta pra IA original.
            setDuplicating(null);
            // ...e vira a `selected` já: `loadAgents` abaixo liga o loading e a
            // resolução do endereço fica parada — sem isto, Configurar mostraria
            // (e salvaria em) a IA ORIGINAL enquanto o endereço aponta pra cópia.
            setAgents((prev) => [...prev.filter((a) => a.id !== copy.id), copy]);
            setSelected(copy);
            setSearchParams(paramsDaIa(copy.id, 'configurar'), { replace: true });
            loadAgents();
          }}
        />
      )}
    </>
  );
}
