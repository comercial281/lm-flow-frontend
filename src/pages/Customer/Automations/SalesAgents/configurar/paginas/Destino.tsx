// Tarefa 73 (01/11/2026): o Destino ganhou o cartão "Fica com o dono do número" (grava `number_owner`
// na hora, sem `persona_kind`; a trava da persona saiu junto com a persona), "Onde o atendimento continua"
// (`handoff_continue_at`, só com Roleta e Corretor fixo) e "Depois que ela passa" (texto fixo).
// ⚠️ Número de atendimento NUNCA grava pela metade: o servidor exige número E mensagem de chegada
// ({nome} do lead). Escolher o cartão, o número ou digitar a mensagem espera o outro; só os dois juntos gravam.
// Repasse · Destino (onda 3, decisão 9). Roleta (escolhe) · Corretor fixo
// (escolhe) · Sistema do cliente. "A roleta deste número" saiu (a rotina da onda
// 2 troca as IAs antigas; a que sobrou mostra o aviso e nenhum cartão marcado).
// Roleta nova (06/10/2026, vinda da main): a roleta não tem mais número. A IA que
// sobrou com o valor antigo vê a roleta que atendia o número (GET for_inbox) e
// confirma com um clique; sem roleta no número, o aviso pede a escolha.
//
// ⚠️ GRAVAÇÃO NA HORA SEM DESTINO PELA METADE: trocar o cartão NÃO grava. Roleta e
// corretor gravam quando alguém é escolhido; o Sistema do cliente com "Usar o
// sistema do cliente", que só acende com endereço salvo e chave pronta. Gravar o
// cartão sozinho faria uma IA ligada mandar o próximo lead pra ninguém.
// ⚠️ Nunca "webhook" na tela (decisão de 05/10 + conferir-padrao).
// Sistema do cliente → CVCRM (06/10/2026, #485 trazido do passo a passo antigo):
// "Qual sistema" escolhe entre o CVCRM (conexão do cliente em Integrações → CVCRM,
// sem endereço nem chave na IA) e o Outro sistema de sempre. Mesma regra da casa:
// trocar o sistema não grava; o botão "Usar" só acende com o sistema pronto.
// Empreendimento e fila gravam na hora (não mudam o destino sozinhos).
// Aviso de teste (14/10/2026): com roleta, corretor fixo ou dono do número JÁ
// gravados, "Mandar um aviso de teste" manda o aviso de oferta pra quem receberia,
// com cópia pra quem clicou. Escolha pela metade não mostra o botão: o servidor
// testa o destino gravado. O `key` é o destino: trocar de roleta ou corretor
// zera o resultado do teste anterior (senão "o próximo da fila é a Ana" ficava
// debaixo da roleta nova).
// ⚠️ O resumo grava só a subchave briefing_enabled: o hook monta o jsonb sobre o
// último salvo, então o critério gravado em outra página não é pisado.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import { roletaConfigService } from '@/services/roletaConfig/roletaConfigService';
import agentsService from '@/services/channels/agentsService';
import { briefingEnabled, toggleBriefing } from '@/features/salesAgents/handoffBriefing';
import { problemaNoEndereco } from '@/features/salesAgents/sistemaDoCliente';
import { FRASE_SEM_DONO } from '@/features/salesAgents/pendencias';
import SistemaDoCliente from '../SistemaDoCliente';
import SistemaDoClienteCvcrm from '../SistemaDoClienteCvcrm';
import AvisoDeTeste from '../AvisoDeTeste';
import type { ContinueAt, HandoffCvcrm, SistemaDoEnvio } from '@/services/salesAgents/salesAgentsService';
import TextoNaHora from '../TextoNaHora';
import Aviso from '@/components/base/Aviso';
import type { PropsDaPagina } from '../paginas';

type Escolha = 'roleta' | 'user' | 'number_owner' | 'webhook';
const DESTINOS = [
  { valor: 'roleta' as const, rotulo: 'Roleta', descricao: 'Distribui entre os corretores da roleta escolhida.' },
  { valor: 'user' as const, rotulo: 'Corretor fixo', descricao: 'Sempre a mesma pessoa, com o botão de aceitar.' },
  { valor: 'number_owner' as const, rotulo: 'Fica com o dono do número', descricao: 'Cada lead fica com o corretor dono do número em que ele escreveu.' },
  { valor: 'webhook' as const, rotulo: 'Sistema do cliente', descricao: 'Manda pro sistema que a imobiliária já usa, com o resumo. Ninguém da roleta recebe.' },
];
const ONDE_CONTINUA: { valor: ContinueAt; rotulo: string; descricao: string }[] = [
  { valor: 'corretor_number', rotulo: 'No número do corretor', descricao: 'É onde a resposta sai mais rápido.' },
  { valor: 'same_number', rotulo: 'Neste número', descricao: 'O corretor atende pelo número da IA.' },
  { valor: 'service_number', rotulo: 'Num número de atendimento', descricao: 'Com uma mensagem de chegada.' },
];
const FALTA_MENSAGEM = 'Escreva a mensagem de chegada: é ela que avisa o lead do número novo.';
const FALTA_NUMERO = 'Escolha o número de atendimento onde a conversa continua.';
const SISTEMAS = [
  { valor: 'cvcrm' as const, rotulo: 'CVCRM', descricao: 'O lead é cadastrado direto no CVCRM do cliente, no empreendimento e na fila que você escolher.' },
  { valor: 'generic' as const, rotulo: 'Outro sistema', descricao: 'O lead vai pro endereço que a equipe do sistema da imobiliária passar, com uma chave secreta.' },
];

export default function Destino({ agent, inboxes, gravar, aoChaveGerada }: PropsDaPagina) {
  const gravado = agent.handoff_target;
  const [escolhendo, setEscolhendo] = useState<Escolha | null>(null);
  const [roletas, setRoletas] = useState<{ id: string; nome: string; ativa: boolean }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [url, setUrl] = useState(agent.handoff_webhook_url ?? '');
  const [erroUrl, setErroUrl] = useState<string | null>(null);
  const [roletaQueAtendia, setRoletaQueAtendia] = useState<{ id: string; nome: string } | null>(null);
  const sistemaGravado: SistemaDoEnvio = agent.handoff_webhook_system === 'cvcrm' ? 'cvcrm' : 'generic';
  const [sistemaEscolhido, setSistemaEscolhido] = useState<SistemaDoEnvio | null>(null);

  useEffect(() => { if (!editandoUrl.current) setUrl(agent.handoff_webhook_url ?? ''); }, [agent.handoff_webhook_url]);
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
  // Valor antigo "a roleta deste número": leitura de fundo da roleta que atendia o
  // número. Sem roleta (ou sem acesso), o aviso só pede a escolha.
  const naRoletaDoNumero = gravado === 'inbox_roleta' && !!agent.inbox_id;
  useEffect(() => {
    setRoletaQueAtendia(null);
    if (!naRoletaDoNumero || !agent.inbox_id) return;
    let vivo = true;
    roletaConfigService.getForInbox(String(agent.inbox_id))
      .then((r) => { if (vivo && r) setRoletaQueAtendia({ id: String(r.id), nome: r.display_name || r.name || 'Roleta sem nome' }); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [naRoletaDoNumero, agent.inbox_id]);

  const doGravado: Escolha | null = gravado === 'roleta' || gravado === 'user' || gravado === 'number_owner' || gravado === 'webhook' ? gravado : null;
  const atual = escolhendo ?? doGravado;
  const fechar = (ok: boolean) => { if (ok) setEscolhendo(null); };
  // O dono do número não pede mais nada: grava no clique. Os outros esperam a pessoa ser escolhida.
  const escolherCartao = (v: Escolha) => {
    if (v === 'number_owner') {
      setEscolhendo(null);
      void gravar({ handoff_target: 'number_owner', handoff_user_id: null, handoff_roleta_config_id: null });
      return;
    }
    setEscolhendo(v === doGravado ? null : v);
  };
  const semDono = (agent.numbers ?? []).length > 0 && (agent.numbers ?? []).every((n) => !n.owner_user_id) && !agent.number_owner_id;
  const opcoesDeDestino = DESTINOS.map((d) => (d.valor === 'number_owner' && semDono ? { ...d, desabilitada: true, motivo: FRASE_SEM_DONO } : d));

  // Onde o atendimento continua. `handoff_continue_at` nulo lê corretor_number.
  const continuaGravado: ContinueAt = agent.handoff_continue_at ?? 'corretor_number';
  const [servicoAberto, setServicoAberto] = useState(false);
  const [numeroDeAtendimento, setNumeroDeAtendimento] = useState('');
  const [mensagemDigitada, setMensagemDigitada] = useState('');
  const [faltou, setFaltou] = useState<string | null>(null);
  const continua: ContinueAt = servicoAberto ? 'service_number' : continuaGravado;
  const numeroSalvo = agent.handoff_service_inbox_id ? String(agent.handoff_service_inbox_id) : '';
  const numeroAtual = numeroDeAtendimento || numeroSalvo;
  const mensagemSalva = agent.handoff_arrival_message ?? '';
  const suasInboxes = new Set((agent.numbers ?? []).map((n) => String(n.inbox_id)));
  const outrosNumeros = (inboxes ?? []).filter((i) => !suasInboxes.has(String(i.id)));
  const escolherOndeContinua = (v: ContinueAt) => {
    setFaltou(null);
    if (v === 'service_number') { setServicoAberto(true); return; }
    setServicoAberto(false);
    void gravar({ handoff_continue_at: v });
  };
  // Só grava com o número E a mensagem (o servidor recusa sem eles); senão diz o que falta.
  const gravarAtendimento = (numero: string, mensagem: string) => {
    if (!numero) { setFaltou(FALTA_NUMERO); return; }
    if (!mensagem.trim()) { setFaltou(FALTA_MENSAGEM); return; }
    setFaltou(null);
    void gravar({ handoff_continue_at: 'service_number', handoff_service_inbox_id: numero, handoff_arrival_message: mensagem })
      .then((ok) => { if (ok) { setServicoAberto(false); setNumeroDeAtendimento(''); setMensagemDigitada(''); } });
  };
  const escolherNumeroDeAtendimento = (id: string) => {
    setNumeroDeAtendimento(id);
    if (!id) return;
    gravarAtendimento(id, mensagemDigitada || mensagemSalva);
  };
  const gravarMensagem = (texto: string) => {
    setMensagemDigitada(texto);
    if (!texto.trim() && !numeroAtual) { setFaltou(FALTA_MENSAGEM); return; }
    gravarAtendimento(numeroAtual, texto);
  };
  const escolherRoleta = (id: string) => { if (id) void gravar({ handoff_target: 'roleta', handoff_roleta_config_id: id, handoff_user_id: null }).then(fechar); };
  const escolherCorretor = (id: string) => { if (id) void gravar({ handoff_target: 'user', handoff_user_id: id, handoff_roleta_config_id: null }).then(fechar); };
  // ⚠️ O endereço grava ao sair do campo E quando a página some com edição pendente
  // (o React não dispara blur no desmonte). Tudo lido de refs: o desmonte roda
  // com a closure do primeiro render.
  const editandoUrl = useRef(false);
  const ref = useRef({ url, gravar, salvo: agent.handoff_webhook_url ?? '', alvo: gravado });
  ref.current = { url, gravar, salvo: agent.handoff_webhook_url ?? '', alvo: gravado };
  const salvarUrl = () => {
    editandoUrl.current = false;
    const { url: digitado, gravar: grava, salvo, alvo } = ref.current;
    const limpo = digitado.trim();
    if (limpo === salvo) return;
    // ⚠️ Com o sistema do cliente JÁ como destino, apagar o endereço deixaria o lead sem pra onde ir.
    if (!limpo && alvo === 'webhook') {
      setErroUrl('Informe o endereço do sistema do cliente');
      setUrl(salvo);
      return;
    }
    if (limpo && problemaNoEndereco(limpo)) return; // o campo já mostra o problema
    void grava({ handoff_webhook_url: limpo || null });
  };
  const mudarUrl = (v: string) => { editandoUrl.current = true; setErroUrl(null); setUrl(v); };
  useEffect(() => () => { if (editandoUrl.current) salvarUrl(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sistema: SistemaDoEnvio = sistemaEscolhido ?? sistemaGravado;
  const genericoPronto = !!agent.handoff_webhook_url && agent.handoff_webhook_secret_state === 'ready';
  // `handoff_cvcrm_connected` vem do servidor; ausente (servidor antigo) não trava aqui, o Ligar é quem confere.
  const cvcrmPronto = agent.handoff_cvcrm_connected !== false;
  const sistemaPronto = sistema === 'cvcrm' ? cvcrmPronto : genericoPronto;
  const usandoEste = gravado === 'webhook' && sistemaGravado === sistema;
  const escolhaCvcrm: HandoffCvcrm = { empreendimento: agent.handoff_cvcrm?.empreendimento ?? null, fila: agent.handoff_cvcrm?.fila ?? null };
  const usarSistema = () => void gravar({ handoff_target: 'webhook', handoff_webhook_system: sistema, handoff_roleta_config_id: null, handoff_user_id: null })
    .then((ok) => { if (ok) { setSistemaEscolhido(null); fechar(ok); } });
  const roletasVisiveis = roletas.filter((r) => r.ativa || r.id === agent.handoff_roleta_config_id);
  const cfg = agent.transfer_config ?? {};

  return (
    <Secoes>
      <Secao titulo="Quem recebe" descricao="Quem recebe o lead quando ela termina. Lead que já tem responsável continua com ele.">
        <>
            {gravado === 'inbox_roleta' && !escolhendo && (
              <Aviso tom="atencao">
                {roletaQueAtendia ? (
                  <>
                    <p className="font-medium">Confirme a roleta</p>
                    <p className="mt-1">
                      Hoje o lead vai pra roleta deste número, uma opção que saiu da tela: a roleta não tem mais número.
                      A que atendia este número é a {roletaQueAtendia.nome}.
                    </p>
                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => escolherRoleta(roletaQueAtendia.id)}>
                      Usar a roleta {roletaQueAtendia.nome}
                    </Button>
                  </>
                ) : (
                  <p>Hoje o lead vai pra roleta deste número, uma opção que saiu da tela. Escolha abaixo pra onde ele vai.</p>
                )}
              </Aviso>
            )}
            <CartoesDeEscolha<Escolha> rotulo="Destino" colunas={2} valor={atual} opcoes={opcoesDeDestino} aoEscolher={escolherCartao} />
            {atual === 'number_owner' && gravado === 'number_owner' && !semDono && <AvisoDeTeste agentId={agent.id} />}
            {atual === 'roleta' && (
              <Campo id="destino-roleta" rotulo="Qual roleta">
                <Seletor id="destino-roleta" className={`${CLASSE_DO_CAMPO} w-full`} value={gravado === 'roleta' ? agent.handoff_roleta_config_id ?? '' : ''}
                  onChange={(e) => escolherRoleta(e.target.value)}>
                  <option value="">Escolha a roleta</option>
                  {roletasVisiveis.map((r) => <option key={r.id} value={r.id}>{r.nome}{r.ativa ? '' : ' (desligada)'}</option>)}
                </Seletor>
              </Campo>
            )}
            {atual === 'roleta' && gravado === 'roleta' && agent.handoff_roleta_config_id && <AvisoDeTeste key={agent.handoff_roleta_config_id} agentId={agent.id} />}
            {atual === 'user' && (
              <Campo id="destino-corretor" rotulo="Qual corretor">
                <Seletor id="destino-corretor" className={`${CLASSE_DO_CAMPO} w-full`} value={gravado === 'user' ? agent.handoff_user_id ?? '' : ''}
                  onChange={(e) => escolherCorretor(e.target.value)}>
                  <option value="">Escolha o corretor</option>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Seletor>
              </Campo>
            )}
            {atual === 'user' && gravado === 'user' && agent.handoff_user_id && <AvisoDeTeste key={agent.handoff_user_id} agentId={agent.id} />}
            {atual === 'webhook' && (
              <>
                <CartoesDeEscolha<SistemaDoEnvio> rotulo="Qual sistema" colunas={2} valor={sistema} opcoes={SISTEMAS}
                  aoEscolher={(v) => setSistemaEscolhido(v === sistemaGravado ? null : v)} />
                {sistema === 'cvcrm' ? (
                  <SistemaDoClienteCvcrm agentId={agent.id} valor={escolhaCvcrm}
                    // O objeto vai sempre inteiro (empreendimento E fila): o servidor troca o campo todo.
                    aoMudar={(v) => void gravar({ handoff_cvcrm: v })}
                    podeTestar={gravado === 'webhook' && sistemaGravado === 'cvcrm'} />
                ) : (
                  <>
                    <SistemaDoCliente agentId={agent.id} url={url} urlSalva={agent.handoff_webhook_url ?? null}
                      chaveGerada={Boolean(agent.handoff_webhook_secret_set)} chaveIlegivel={agent.handoff_webhook_secret_state === 'unreadable'}
                      onUrlChange={mudarUrl} onUrlBlur={salvarUrl}
                      // A chave é gravada pela ação própria (nunca pelo salvar da IA): a casca só fica sabendo.
                      onChaveGerada={() => aoChaveGerada?.()} />
                    {erroUrl && <p className="text-sm text-destructive">{erroUrl}</p>}
                  </>
                )}
                {!usandoEste && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" disabled={!sistemaPronto} onClick={usarSistema}>
                      {sistema === 'cvcrm' ? 'Usar o CVCRM' : 'Usar o sistema do cliente'}
                    </Button>
                    {!sistemaPronto && (
                      <span className="text-sm text-muted-foreground">
                        {sistema === 'cvcrm' ? 'Conecte o CVCRM em Integrações antes.' : 'Salve o endereço e gere a chave antes.'}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
        </>
      </Secao>

      {(atual === 'roleta' || atual === 'user') && (
        <Secao titulo="Onde o atendimento continua"
          descricao="Depois que o corretor aceita o lead, a conversa segue por aqui. Vale só pra lead que a IA passou.">
          <CartoesDeEscolha<ContinueAt> rotulo="Onde o atendimento continua" colunas={3} valor={continua} opcoes={ONDE_CONTINUA}
            aoEscolher={escolherOndeContinua} />
          {continua === 'service_number' && (
            <>
              <Campo id="destino-numero-de-atendimento" rotulo="Número de atendimento">
                <Seletor id="destino-numero-de-atendimento" className={`${CLASSE_DO_CAMPO} w-full`} value={numeroAtual}
                  onChange={(e) => escolherNumeroDeAtendimento(e.target.value)}>
                  <option value="">Escolha o número</option>
                  {outrosNumeros.map((i) => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
                </Seletor>
              </Campo>
              <TextoNaHora id="destino-mensagem-de-chegada" rotulo="Mensagem de chegada" tipo="varias" salvo={mensagemSalva} maxLength={1000}
                ajuda="Sai por este número, como está escrita. {nome} vira o primeiro nome do lead. É ela que avisa o lead do número novo."
                aoGravar={gravarMensagem} />
              {faltou && <p className="text-sm text-destructive">{faltou}</p>}
            </>
          )}
        </Secao>
      )}

      <Secao titulo="Depois que ela passa" descricao="Vale pra todo destino. Não tem o que ligar nem desligar.">
        <div className="rounded-xl bg-muted/50 p-3.5 text-sm leading-relaxed">
          Se o lead escreve e ninguém responde em 15 minutos, a usuária recebe "lead esperando"; com 1 hora, o gerente também.
          Quando a conversa está num número da IA e a voz não é Corretor, ela segura até alguém chegar.
        </div>
      </Secao>

      <Secao titulo="Resumo junto" descricao="Quem recebe vê o que ela descobriu no aviso e no card do lead.">
        <LinhaComChave rotulo="Mandar o resumo da conversa" ligada={briefingEnabled(cfg)}
          aoMudar={(v) => gravar({ transfer_config: toggleBriefing(cfg, v) }, ['transfer_config.briefing_enabled'])}>
          <div aria-label="Exemplo do aviso" className="max-w-sm space-y-1.5 rounded-xl border border-border bg-background p-3.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <b>Novo lead: João Silva</b>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Quente</span>
            </div>
            <p className="text-[13px] text-muted-foreground">2 dormitórios · financiamento · até 400 mil · quer mudar em 6 meses</p>
          </div>
        </LinhaComChave>
      </Secao>
    </Secoes>
  );
}
