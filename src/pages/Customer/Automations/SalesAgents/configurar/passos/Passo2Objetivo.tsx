// Passo 2 · Objetivo. Até onde ela vai, pra onde vai o lead, quando ela passa e o
// que vai junto.
//
// ⚠️ Mudar o ALCANCE mexe só em `reach` + `booking_enabled` (espelho): nunca no
// destino. Na persona do próprio corretor o destino é o dono do número e não se
// escolhe; IA antiga com fixo vê o aviso e o botão explícito.
//
// ⚠️ "Sem resposta" e "dúvida" são cenários ANTIGOS de verdade
// (`HandoffPolicy`: "só se ela não souber responder" / "ao menor sinal de dúvida"),
// não "o lead sumiu". Aparecem só pra quem já os tem, e continuam valendo.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import { Secao } from '@/components/base/Secao';
import { Campo, CampoTexto, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import type { AlcanceDaIa, HandoffCvcrm, HandoffMode, SalesAgentHandoffTarget, SistemaDoEnvio } from '@/services/salesAgents/salesAgentsService';
import { roletaConfigService } from '@/services/roletaConfig/roletaConfigService';
import agentsService from '@/services/channels/agentsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { briefingEnabled, keepBriefing, toggleBriefing } from '@/features/salesAgents/handoffBriefing';
import { fraseDoObjetivo } from '@/features/salesAgents/resumoDosPassos';
import { FRASE_SEM_DONO } from '@/features/salesAgents/pendencias';
import type { PipelineOpt, StageOpt } from '../../configuracao/comum';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDosPassos';
import { Aviso, Caixa, CascaDoPasso, Escolha, type OpcaoDeEscolha } from '../pecas';
import { MOMENTOS_DO_FUNIL } from '../opcoes';
import type { PropsDoPasso } from '../passos';
import SistemaDoCliente from '../SistemaDoCliente';
import SistemaDoClienteCvcrm from '../SistemaDoClienteCvcrm';
import { problemaNoEndereco, webhookDisponivel } from '@/features/salesAgents/sistemaDoCliente';

type Quando = HandoffMode | 'julgar';

const ALCANCES: OpcaoDeEscolha<AlcanceDaIa>[] = [
  { valor: 'qualify', titulo: 'Só qualifica e passa', descricao: 'Ela entende o que o lead procura, faz as perguntas e passa pra uma pessoa.' },
  { valor: 'visit', titulo: 'Vai até o fim', descricao: 'Além de qualificar, marca a visita na agenda e passa a confirmação.' },
];

// "Sistema do cliente" (entrega 5): não vale na persona do próprio corretor.
// Roleta nova (06/10/2026): a roleta não tem número, então "A roleta deste
// número" saiu; fica "Uma roleta".
const DESTINOS: OpcaoDeEscolha<Exclude<SalesAgentHandoffTarget, 'number_owner' | 'inbox_roleta'>>[] = [
  { valor: 'roleta', titulo: 'Uma roleta', descricao: 'O lead vai pro próximo da fila da roleta escolhida.' },
  { valor: 'user', titulo: 'Um corretor fixo', descricao: 'O lead vai sempre pra mesma pessoa, com o botão de aceitar.' },
  {
    valor: 'webhook',
    titulo: 'Sistema do cliente',
    descricao: 'O lead vai pro sistema que a imobiliária já usa (o CRM dela), com o resumo da IA. Ninguém da roleta recebe.',
  },
];

// Sistema do cliente → CVCRM (06/10/2026): o CVCRM tem ligação pronta (a conexão
// é do cliente, em Integrações → CVCRM); "Outro sistema" é o envio de sempre, com
// endereço e chave secreta. IA que já usava o Sistema do cliente abre no Outro.
const SISTEMAS: OpcaoDeEscolha<SistemaDoEnvio>[] = [
  { valor: 'cvcrm', titulo: 'CVCRM', descricao: 'O lead é cadastrado direto no CVCRM do cliente, no empreendimento e na fila que você escolher.' },
  { valor: 'generic', titulo: 'Outro sistema', descricao: 'O lead vai pro endereço que a equipe do sistema da imobiliária passar, com uma chave secreta.' },
];

export default function Passo2Objetivo({ agent, aoSalvo }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[2], aoSalvo);
  // IA que ainda tem gravado "A roleta deste número" (valor antigo): a tela já
  // escolhe "Uma roleta" com a roleta que atendia o número e pede a confirmação.
  const [confirmarRoleta, setConfirmarRoleta] = useState(false);
  const [roletas, setRoletas] = useState<{ id: string; nome: string; ativa: boolean }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [funis, setFunis] = useState<PipelineOpt[]>([]);
  const [colunas, setColunas] = useState<StageOpt[]>([]);

  const escolhas = lerEscolhas(rascunho);
  const cfg = rascunho.transfer_config ?? {};
  const quando: Quando = (cfg.mode as Quando | undefined) ?? 'julgar';
  const mover = rascunho.pipeline_move_enabled === true;
  const funil = rascunho.pipeline_id ?? '';
  const mapa = rascunho.pipeline_stage_map ?? {};
  const crm = rascunho.crm_policy ?? {};

  // Leitura de fundo: cargo sem acesso a roletas ou à equipe só não vê a lista.
  useEffect(() => {
    let vivo = true;
    roletaConfigService.getAll()
      .then((rs) => { if (vivo) setRoletas((rs || []).map((r) => ({ id: String(r.id), nome: r.display_name || r.name || r.inbox_name || 'Roleta sem nome', ativa: r.is_active !== false }))); })
      .catch(() => {});
    agentsService.getAll()
      .then((us) => { if (vivo) setPessoas((us || []).map((u) => ({ id: String(u.id), nome: u.name || u.email || 'Sem nome' }))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const naRoletaDoNumero = rascunho.handoff_target === 'inbox_roleta' && escolhas.persona !== 'broker';
  useEffect(() => {
    if (!naRoletaDoNumero) return;
    let vivo = true;
    // Leitura de fundo: sem roleta no número (ou sem acesso), a roleta fica em
    // branco e o aviso pede pra escolher.
    const inbox = rascunho.inbox_id ? String(rascunho.inbox_id) : null;
    (inbox ? roletaConfigService.getForInbox(inbox) : Promise.resolve(null))
      .then((r) => {
        if (!vivo) return;
        mudar({ handoff_target: 'roleta', handoff_roleta_config_id: r ? String(r.id) : null, handoff_user_id: null });
        setConfirmarRoleta(true);
      });
    return () => { vivo = false; };
  }, [naRoletaDoNumero, rascunho.inbox_id, mudar]);

  useEffect(() => {
    if (!mover) return;
    pipelinesService.getPipelines()
      .then((res: unknown) => {
        const lista = (res as { data?: PipelineOpt[] }).data ?? (Array.isArray(res) ? (res as PipelineOpt[]) : []);
        setFunis(lista.map((p) => ({ id: String(p.id), name: p.name })));
      })
      .catch(() => setFunis([]));
  }, [mover]);

  useEffect(() => {
    if (!mover || !funil) { setColunas([]); return; }
    pipelinesService.getPipelineStages(funil)
      .then((res: unknown) => {
        const lista = (res as { data?: StageOpt[] }).data ?? (Array.isArray(res) ? (res as StageOpt[]) : []);
        setColunas(lista.map((s) => ({ id: String(s.id), name: s.name })));
      })
      .catch(() => setColunas([]));
  }, [mover, funil]);

  const escolherAlcance = (a: AlcanceDaIa) => {
    const corrigeCenario = a === 'qualify' && cfg.mode === 'pos_visita' ? { transfer_config: keepBriefing(cfg, { ...cfg, mode: 'checklist' as HandoffMode }) } : {};
    mudar({ reach: a, booking_enabled: a === 'visit', ...corrigeCenario });
  };

  const escolherQuando = (v: Quando) =>
    mudar({ transfer_config: keepBriefing(cfg, { ...cfg, mode: v === 'julgar' ? undefined : v, min_temperature: v === 'temperatura' ? cfg.min_temperature ?? 'hot' : undefined }) });

  const trocarDestino = (v: SalesAgentHandoffTarget) => mudar({
    handoff_target: v,
    handoff_roleta_config_id: v === 'roleta' ? rascunho.handoff_roleta_config_id ?? null : null,
    handoff_user_id: v === 'user' ? rascunho.handoff_user_id ?? null : null,
  });

  const opcoesQuando: OpcaoDeEscolha<Quando>[] = [
    { valor: 'checklist', titulo: 'Só depois das perguntas obrigatórias (recomendado)', descricao: 'Ela só passa com as perguntas marcadas como obrigatórias respondidas (passo Roteiro). O lead chega pré-qualificado.' },
    { valor: 'temperatura', titulo: 'Quando o lead estiver quente', descricao: 'Ela conduz sozinha e só passa quando o lead esquenta.' },
    { valor: 'julgar', titulo: 'Quando ela julgar', descricao: 'Ela decide a hora de passar.' },
    { valor: 'pos_visita', titulo: 'Depois da visita', descricao: 'Ela só passa com a visita marcada, ou numa objeção que não conseguiu contornar.', desabilitada: escolhas.alcance !== 'visit', motivo: 'Só quando ela vai até o fim.' },
    ...(quando === 'duvida' ? [{ valor: 'duvida' as Quando, titulo: 'Ao menor sinal de dúvida (opção antiga)', descricao: 'Continua valendo até você escolher outra.' }] : []),
    ...(quando === 'sem_resposta' ? [{ valor: 'sem_resposta' as Quando, titulo: 'Só quando ela não souber responder (opção antiga)', descricao: 'Continua valendo até você escolher outra.' }] : []),
  ];

  const destinos = DESTINOS.map((o) => (o.valor === 'webhook' && !webhookDisponivel(escolhas.persona)
    ? { ...o, desabilitada: true, motivo: 'Na persona corretor o lead vai sempre pro dono do número.' }
    : o));

  const sistema: SistemaDoEnvio = rascunho.handoff_webhook_system === 'cvcrm' ? 'cvcrm' : 'generic';
  const escolhaCvcrm: HandoffCvcrm = {
    empreendimento: rascunho.handoff_cvcrm?.empreendimento ?? null,
    fila: rascunho.handoff_cvcrm?.fila ?? null,
  };

  // Endereço ruim não sai do passo: o servidor também recusa, mas aqui a frase é a da tela.
  // No CVCRM não há endereço na IA (é o da conexão do cliente).
  const salvarPasso = () => {
    if (rascunho.handoff_target === 'webhook' && sistema === 'generic') {
      const problema = problemaNoEndereco(rascunho.handoff_webhook_url ?? '');
      if (problema) {
        toast.error(problema);
        return;
      }
    }
    void salvar();
  };

  const nomeDaRoleta = roletas.find((r) => r.id === rascunho.handoff_roleta_config_id)?.nome ?? null;
  const nomeDoCorretor = pessoas.find((p) => p.id === rascunho.handoff_user_id)?.nome ?? null;
  const roletasVisiveis = roletas.filter((r) => r.ativa || r.id === rascunho.handoff_roleta_config_id);

  const previa = (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">O que acontece</p>
      <p className="text-sm">{fraseDoObjetivo(rascunho, { roleta: nomeDaRoleta, corretor: nomeDoCorretor })}</p>
    </div>
  );

  return (
    <CascaDoPasso numero={2} previa={previa} pendente={pendente} salvando={salvando} erro={erro} aoSalvar={salvarPasso} aoDescartar={descartar}>
      <Secao titulo="Até onde ela vai" descricao="Se ela só prepara o lead ou se também marca a visita.">
        <Escolha nome="alcance" legenda="Até onde ela vai" valor={escolhas.alcance} opcoes={ALCANCES} aoEscolher={escolherAlcance} />
      </Secao>

      <Secao titulo="Pra onde vai o lead" descricao="Quem recebe o lead quando ela sai de cena. Lead que já tem responsável continua com ele, e a pessoa é avisada.">
        {escolhas.persona === 'broker' ? (
          <>
            <p className="text-sm">
              Pro dono do número{rascunho.number_owner_name ? `: ${rascunho.number_owner_name}` : ''}. Ela fala como o próprio corretor, então o lead vai sempre pra ele.
            </p>
            {rascunho.handoff_target !== 'number_owner' && (
              <Aviso>
                <p>Hoje o lead vai para outro destino, e não para o dono do número.</p>
                {/* ⚠️ Sem dono, converter mandaria o lead pra ninguém. E a conversão grava
                    a persona na coluna: IA antiga tem a persona só DERIVADA da voz, e a
                    trava do servidor (número sem dono) só olha a coluna. */}
                {rascunho.inbox_id && !rascunho.number_owner_id ? (
                  <p className="mt-2 text-destructive">{FRASE_SEM_DONO}</p>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="mt-2"
                    onClick={() => mudar({ persona_kind: 'broker', handoff_target: 'number_owner', handoff_user_id: null, handoff_roleta_config_id: null })}>
                    Passar a entregar pro dono do número
                  </Button>
                )}
              </Aviso>
            )}
          </>
        ) : (
          <>
            <Escolha nome="destino" legenda="Pra onde vai o lead" opcoes={destinos} aoEscolher={trocarDestino}
              valor={rascunho.handoff_target === 'number_owner' ? null : rascunho.handoff_target} />
            {confirmarRoleta && rascunho.handoff_target === 'roleta' && (
              <Aviso>
                <p className="font-medium">Confirme a roleta</p>
                <p className="mt-1">
                  {rascunho.handoff_roleta_config_id
                    ? 'Ela passava o lead pra roleta do número em que atende. A roleta não tem mais número, então deixamos escolhida a que atendia este número. Confira e salve.'
                    : 'Ela passava o lead pra roleta do número em que atende, e a roleta não tem mais número. Escolha a roleta e salve.'}
                </p>
              </Aviso>
            )}
            {rascunho.handoff_target === 'roleta' && (
              <Campo id="p2-roleta" rotulo="Qual roleta">
                <Seletor id="p2-roleta" className={`${CLASSE_DO_CAMPO} w-full`} value={rascunho.handoff_roleta_config_id ?? ''}
                  onChange={(e) => mudar({ handoff_roleta_config_id: e.target.value || null })}>
                  <option value="">Escolha a roleta</option>
                  {roletasVisiveis.map((r) => <option key={r.id} value={r.id}>{r.nome}{r.ativa ? '' : ' (desligada)'}</option>)}
                </Seletor>
              </Campo>
            )}
            {rascunho.handoff_target === 'webhook' && (
              <div className="mt-2 ml-7">
                <Escolha nome="sistema" legenda="Qual sistema" opcoes={SISTEMAS} valor={sistema}
                  aoEscolher={(v) => mudar({ handoff_webhook_system: v })} />
              </div>
            )}
            {rascunho.handoff_target === 'webhook' && sistema === 'cvcrm' && (
              <SistemaDoClienteCvcrm
                agentId={agent.id}
                valor={escolhaCvcrm}
                // O objeto vai sempre inteiro (empreendimento E fila): o servidor troca o campo todo.
                aoMudar={(v) => mudar({ handoff_cvcrm: v })}
                podeTestar={agent.handoff_target === 'webhook' && agent.handoff_webhook_system === 'cvcrm' && !pendente}
              />
            )}
            {rascunho.handoff_target === 'webhook' && sistema === 'generic' && (
              <SistemaDoCliente
                agentId={agent.id}
                url={rascunho.handoff_webhook_url ?? ''}
                urlSalva={agent.handoff_webhook_url ?? null}
                chaveGerada={Boolean(agent.handoff_webhook_secret_set)}
                chaveIlegivel={agent.handoff_webhook_secret_state === 'unreadable'}
                onUrlChange={(v) => mudar({ handoff_webhook_url: v.trim() ? v.trim() : null })}
                // A chave é gravada na hora (não espera o Salvar): a casca fica sabendo,
                // sem mexer no rascunho do passo (o updated_at não muda).
                onChaveGerada={() => aoSalvo({ ...agent, handoff_webhook_secret_set: true, handoff_webhook_secret_state: 'ready' })}
              />
            )}
            {rascunho.handoff_target === 'user' && (
              <Campo id="p2-corretor" rotulo="Qual corretor">
                <Seletor id="p2-corretor" className={`${CLASSE_DO_CAMPO} w-full`} value={rascunho.handoff_user_id ?? ''}
                  onChange={(e) => mudar({ handoff_user_id: e.target.value || null })}>
                  <option value="">Escolha o corretor</option>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Seletor>
              </Campo>
            )}
          </>
        )}
      </Secao>

      <Secao titulo="Quando ela passa" descricao="O momento em que o lead sai dela e vai pra uma pessoa.">
        <Escolha nome="quando" legenda="Quando ela passa" valor={quando} opcoes={opcoesQuando} aoEscolher={escolherQuando} />
        {quando === 'pos_visita' && escolhas.alcance !== 'visit' && (
          <Aviso>Ela só qualifica e passa, então "depois da visita" nunca acontece. Escolha outra opção.</Aviso>
        )}
        {quando === 'temperatura' && (
          <Campo id="p2-temperatura" rotulo="A partir de">
            <Seletor id="p2-temperatura" className={`${CLASSE_DO_CAMPO} w-full`} value={cfg.min_temperature ?? 'hot'}
              onChange={(e) => mudar({ transfer_config: { ...cfg, min_temperature: e.target.value as 'hot' | 'warm' } })}>
              <option value="hot">Lead quente</option>
              <option value="warm">Lead morno ou quente</option>
            </Seletor>
          </Campo>
        )}
        <Caixa id="p2-resumo" rotulo="Mandar o resumo da conversa junto" marcada={briefingEnabled(cfg)}
          descricao="Quem recebe o lead vê o que ela descobriu (temperatura, respostas e resumo) no aviso e no card do lead."
          aoMudar={(v) => mudar({ transfer_config: toggleBriefing(cfg, v) })} />
        <Aviso tom="neutro">Ela sempre passa pra uma pessoa quando o lead se irrita, pede uma pessoa ou pergunta se é robô.</Aviso>
      </Secao>

      <Secao titulo="Mover o card no funil" descricao="Conforme a conversa anda, ela leva o card pra coluna que você escolher. Ela nunca puxa o card de volta.">
        <Caixa id="p2-mover" rotulo="Mover o card conforme a conversa anda" marcada={mover}
          aoMudar={(v) => mudar({ pipeline_move_enabled: v })} />
        {mover && (
          <>
            <Campo id="p2-funil" rotulo="Em qual funil">
              <Seletor id="p2-funil" className={`${CLASSE_DO_CAMPO} w-full`} value={funil}
                onChange={(e) => mudar({ pipeline_id: e.target.value || null, pipeline_stage_map: {} })}>
                <option value="">Escolha o funil</option>
                {funis.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Seletor>
            </Campo>
            {funil && MOMENTOS_DO_FUNIL.map(([chave, titulo]) => (
              <Campo key={chave} id={`p2-momento-${chave}`} rotulo={titulo}>
                <Seletor id={`p2-momento-${chave}`} className={`${CLASSE_DO_CAMPO} w-full`} value={mapa[chave] ?? ''}
                  onChange={(e) => {
                    const proximo = { ...mapa };
                    if (e.target.value) proximo[chave] = e.target.value; else delete proximo[chave];
                    mudar({ pipeline_stage_map: proximo });
                  }}>
                  <option value="">Não mover</option>
                  {colunas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Seletor>
              </Campo>
            ))}
          </>
        )}
      </Secao>

      <Secao titulo="Quem vai pro CRM" descricao="Quem compra sempre vai. Aqui você decide os outros.">
        <Caixa id="p2-frio" rotulo="Mandar lead frio pro CRM" descricao="Lead que ainda não mostrou interesse também vira card."
          marcada={crm.cold === true} aoMudar={(v) => mudar({ crm_policy: { ...crm, cold: v } })} />
        <Caixa id="p2-captacao" rotulo="Mandar pro CRM quem quer vender ou alugar o próprio imóvel"
          marcada={crm.capture === true} aoMudar={(v) => mudar({ crm_policy: { ...crm, capture: v } })} />
      </Secao>

      <Secao titulo="Depois da visita" descricao="Pedido de avaliação no Google pra quem visitou.">
        <Caixa id="p2-google" rotulo="Pedir avaliação no Google" marcada={!!rascunho.ask_google_review}
          aoMudar={(v) => mudar({ ask_google_review: v })} />
        {rascunho.ask_google_review && (
          <CampoTexto id="p2-google-link" rotulo="Link de avaliação do Google" valor={rascunho.google_review_link ?? ''}
            aoMudar={(v) => mudar({ google_review_link: v.trim() || null })} placeholder="https://g.page/r/..." />
        )}
      </Secao>
    </CascaDoPasso>
  );
}
