import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Bot, Check, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { salesAgentsService, type AgentPlaybook, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { followupSequencesService } from '@/services/followupSequences/followupSequencesService';
import { answersFromAgent, payloadFromAnswers, type AssistenteAnswers } from './assistenteMapping';
import { chaveDoRascunho, ETAPAS, motivoDoErro } from './assistenteOpcoes';
import EtapaQuemE from './steps/EtapaQuemE';
import EtapaOQueVende from './steps/EtapaOQueVende';
import EtapaRumo from './steps/EtapaRumo';
import EtapaLimites from './steps/EtapaLimites';
import EtapaOperacao, { type OpcaoLista } from './steps/EtapaOperacao';
import EtapaRevisao from './steps/EtapaRevisao';

/**
 * O assistente de configuração da IA Vendedora — tela cheia, por etapas.
 *
 * Substitui o "Configurar por formulário" (seis perguntas num modal, tudo gerado
 * pela IA). Decisões do dono (2026-09-04):
 *
 * - **Grava DIRETO nos campos.** A IA só entra para REDIGIR os quatro textos de
 *   apresentação, a pedido, e a pessoa revisa antes de seguir.
 * - **Abre na criação, mas dá para criar sem.** O "+" cria a IA (desligada) e
 *   cai aqui; *Configurar depois, na mão* volta para a tela de sempre sem gravar
 *   nada. A IA existe nos dois caminhos.
 * - **UM PATCH no Concluir**, montado por função pura (`assistenteMapping.ts`),
 *   direto no serviço — não passa pelo `saveAgent` da tela, que descarta o que
 *   não está na lista dele.
 * - **Rascunho no navegador, por IA.** Fechar a aba no passo 4 não perde os três
 *   anteriores. Apagado no Concluir e no Configurar depois.
 * - **O assistente não liga ninguém.** Ligar continua sendo o interruptor da
 *   tela de configuração.
 */

interface Rascunho { etapa: number; respostas: AssistenteAnswers }

function lerRascunho(agentId: string): Rascunho | null {
  try {
    const raw = window.localStorage.getItem(chaveDoRascunho(agentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Rascunho>;
    if (!parsed || typeof parsed !== 'object' || !parsed.respostas) return null;
    return { etapa: Number(parsed.etapa) || 0, respostas: parsed.respostas };
  } catch {
    return null;
  }
}

function gravarRascunho(agentId: string, rascunho: Rascunho) {
  try { window.localStorage.setItem(chaveDoRascunho(agentId), JSON.stringify(rascunho)); } catch { /* sem espaço ou sem storage: segue sem rascunho */ }
}

function apagarRascunho(agentId: string) {
  try { window.localStorage.removeItem(chaveDoRascunho(agentId)); } catch { /* idem */ }
}

const listaDe = (res: unknown): { id: string | number; name: string }[] => {
  const raw = (res as { data?: { id: string | number; name: string }[] }).data
    ?? (Array.isArray(res) ? (res as { id: string | number; name: string }[]) : []);
  return raw;
};

export default function AssistenteIA() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [agent, setAgent] = useState<SalesAgent | null>(null);
  const [playbook, setPlaybook] = useState<AgentPlaybook | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState<AssistenteAnswers | null>(null);
  // O que a IA tinha ao abrir: rascunho só existe quando algo divergiu disto,
  // senão abrir, olhar e sair pelo Voltar do navegador já "retomaria" da próxima vez.
  const [inicial, setInicial] = useState<AssistenteAnswers | null>(null);
  const [retomado, setRetomado] = useState(false);
  const [redigindo, setRedigindo] = useState(false);
  const [gravando, setGravando] = useState(false);

  const [pipelines, setPipelines] = useState<OpcaoLista[]>([]);
  const [stages, setStages] = useState<OpcaoLista[]>([]);
  const [funis, setFunis] = useState<OpcaoLista[]>([]);

  // Carga: a IA (obrigatória), o roteiro (rótulos, dicas e listas — opcional,
  // servidor antigo devolve erro e a tela usa a reserva), funis e funis de
  // follow-up (opcionais). Leitura de fundo não grita: o que falhar só não aparece.
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    setCarregando(true);
    Promise.all([
      salesAgentsService.get(id),
      salesAgentsService.playbook(id).catch(() => null),
      pipelinesService.getPipelines().then(listaDe).catch(() => []),
      followupSequencesService.getAll().catch(() => []),
    ])
      .then(([ag, pb, pipes, seqs]) => {
        if (!vivo) return;
        setAgent(ag);
        setPlaybook(pb);
        setPipelines(pipes.map((p) => ({ value: String(p.id), label: p.name })));
        setFunis(seqs.filter((f) => f.is_active).map((f) => ({ value: f.slug, label: f.name })));
        const base = answersFromAgent(ag, pb);
        setInicial(base);
        const rascunho = lerRascunho(ag.id);
        if (rascunho) {
          setRespostas({ ...base, ...rascunho.respostas });
          setEtapa(Math.min(Math.max(rascunho.etapa, 0), ETAPAS.length - 1));
          setRetomado(true);
        } else {
          setRespostas(base);
        }
      })
      .catch((err: unknown) => {
        if (!vivo) return;
        setErroCarga(motivoDoErro(err) ?? 'Não encontrei essa IA.');
      })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id]);

  // As colunas acompanham o funil escolhido na etapa de Operação.
  const pipelineId = respostas?.pipeline_id ?? '';
  useEffect(() => {
    if (!pipelineId) { setStages([]); return; }
    let vivo = true;
    pipelinesService.getPipelineStages(pipelineId)
      .then(listaDe)
      .then((lista) => { if (vivo) setStages(lista.map((s) => ({ value: String(s.id), label: s.name }))); })
      .catch(() => { if (vivo) setStages([]); });
    return () => { vivo = false; };
  }, [pipelineId]);

  // Rascunho a cada mudança, por IA — e apagado quando volta a ser igual ao gravado.
  useEffect(() => {
    if (!agent || !respostas || !inicial) return;
    if (JSON.stringify(respostas) === JSON.stringify(inicial)) apagarRascunho(agent.id);
    else gravarRascunho(agent.id, { etapa, respostas });
  }, [agent, etapa, respostas, inicial]);

  const set = useCallback((patch: Partial<AssistenteAnswers>) => {
    setRespostas((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const irPara = (n: number) => {
    setEtapa(Math.min(Math.max(n, 0), ETAPAS.length - 1));
    window.scrollTo({ top: 0 });
  };

  const voltarParaATela = () => navigate(`/ia-vendedora?agent=${encodeURIComponent(id)}`);

  const configurarDepois = () => {
    if (agent) apagarRascunho(agent.id);
    voltarParaATela();
  };

  const recomecar = () => {
    if (!agent) return;
    apagarRascunho(agent.id);
    const base = answersFromAgent(agent, playbook);
    setInicial(base);
    setRespostas(base);
    setRetomado(false);
    setEtapa(0);
  };

  // O único uso da IA no assistente: redigir os quatro textos de apresentação a
  // partir do que a pessoa contou. Preenche SÓ esses quatro, para revisão —
  // método e perguntas de qualificação continuam sendo escolha da pessoa.
  const redigir = async () => {
    if (!respostas) return;
    setRedigindo(true);
    try {
      const cfg = await salesAgentsService.generateConfig({
        nome_da_imobiliaria: respostas.nome_imobiliaria || respostas.nome_ia,
        o_que_vende: respostas.o_que_vende,
        tom_de_voz: [
          respostas.tom,
          respostas.usa_giria ? 'pode usar gíria leve' : '',
          respostas.usa_emoji ? 'pode usar emoji com moderação' : '',
        ].filter(Boolean).join('; '),
        diferenciais: respostas.diferenciais,
        faz_locacao: respostas.locacao_enabled ? 'sim' : 'não, só venda',
        prova_social: respostas.prova_social,
      });
      set({
        persona_role: cfg.persona_role ?? respostas.persona_role,
        persona_goal: cfg.persona_goal ?? respostas.persona_goal,
        instructions: cfg.instructions ?? respostas.instructions,
        greeting: cfg.greeting ?? respostas.greeting,
      });
      toast.success('Redigi os quatro textos. Revise antes de continuar.');
    } catch (err) {
      const motivo = motivoDoErro(err);
      toast.error(motivo ? `Não consegui redigir: ${motivo}` : 'Não consegui redigir agora. Verifique a chave de IA e tente de novo.');
    } finally {
      setRedigindo(false);
    }
  };

  const payload = useMemo(() => (agent && respostas ? payloadFromAnswers(respostas, agent) : {}), [agent, respostas]);
  const nadaMudou = Object.keys(payload).length === 0;

  const concluir = async () => {
    if (!agent || !respostas) return;
    if (nadaMudou) {
      apagarRascunho(agent.id);
      toast.info('Nada mudou. A IA continua como estava.');
      voltarParaATela();
      return;
    }
    setGravando(true);
    try {
      await salesAgentsService.update(agent.id, payload);
      apagarRascunho(agent.id);
      toast.success('Perfil salvo. A IA continua desligada — ligue quando quiser testar.');
      voltarParaATela();
    } catch (err) {
      const motivo = motivoDoErro(err);
      toast.error(motivo ? `Não salvou: ${motivo}` : 'Não consegui salvar. Tente de novo.');
    } finally {
      setGravando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (erroCarga || !agent || !respostas) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <Bot className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm">{erroCarga ?? 'Não encontrei essa IA.'}</p>
        <Button type="button" variant="outline" onClick={() => navigate('/ia-vendedora')}>Voltar para a IA Vendedora</Button>
      </div>
    );
  }

  const ultima = etapa === ETAPAS.length - 1;
  const atual = ETAPAS[etapa];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Trilho das etapas. No celular vira a barra do topo. */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-muted/20 p-5 md:flex">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Assistente</div>
            <div className="truncate text-sm font-semibold">{respostas.nome_ia.trim() || agent.name}</div>
          </div>
        </div>
        <ol className="space-y-1">
          {ETAPAS.map((e, i) => {
            const feita = i < etapa;
            const aqui = i === etapa;
            return (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => irPara(i)}
                  aria-current={aqui ? 'step' : undefined}
                  className={`flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors ${aqui ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${aqui ? 'border-primary bg-primary text-primary-foreground' : feita ? 'border-primary text-primary' : 'border-sidebar-border text-muted-foreground'}`}>
                    {feita ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm ${aqui ? 'font-semibold' : ''}`}>{e.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{e.resumo}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto pt-6">
          <button type="button" onClick={configurarDepois} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
            <X className="h-3 w-3" /> Configurar depois, na mão
          </button>
          <p className="mt-1 text-[11px] text-muted-foreground">Sai sem gravar. A IA já existe, desligada.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-sidebar-border px-5 py-3 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Etapa {etapa + 1} de {ETAPAS.length}</div>
              <h2 className="truncate text-lg font-semibold">{atual.titulo}</h2>
            </div>
            <button type="button" onClick={configurarDepois} className="text-xs text-muted-foreground hover:underline md:hidden">Configurar depois</button>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }} />
          </div>
        </header>

        {retomado && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800 md:px-8 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <span>Retomamos de onde você parou. As respostas estavam guardadas neste navegador.</span>
            <button type="button" onClick={recomecar} className="inline-flex shrink-0 items-center gap-1 hover:underline">
              <RotateCcw className="h-3 w-3" /> Recomeçar do que está gravado
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
          <div className="mx-auto w-full max-w-3xl">
            {etapa === 0 && <EtapaQuemE a={respostas} set={set} onRedigir={redigir} redigindo={redigindo} />}
            {etapa === 1 && <EtapaOQueVende a={respostas} set={set} playbook={playbook} />}
            {etapa === 2 && <EtapaRumo a={respostas} set={set} playbook={playbook} />}
            {etapa === 3 && <EtapaLimites a={respostas} set={set} />}
            {etapa === 4 && <EtapaOperacao a={respostas} set={set} agent={agent} pipelines={pipelines} stages={stages} funis={funis} />}
            {etapa === 5 && <EtapaRevisao a={respostas} playbook={playbook} irPara={irPara} pipelines={pipelines} stages={stages} funis={funis} />}
          </div>
        </main>

        <footer className="border-t border-sidebar-border px-5 py-3 md:px-8">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => irPara(etapa - 1)} disabled={etapa === 0 || gravando}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {ultima ? (
              <Button type="button" onClick={concluir} disabled={gravando}>
                {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {nadaMudou ? 'Concluir sem mudanças' : 'Concluir e gravar'}
              </Button>
            ) : (
              <Button type="button" onClick={() => irPara(etapa + 1)}>
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
