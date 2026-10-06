// Repasse · Destino (onda 3, decisão 9). Roleta (escolhe) · Corretor fixo
// (escolhe) · Sistema do cliente. "A roleta deste número" saiu (a rotina da onda
// 2 troca as IAs antigas; a que sobrou mostra o aviso e nenhum cartão marcado).
// Roleta nova (06/10/2026, vinda da main): a roleta não tem mais número. A IA que
// sobrou com o valor antigo vê a roleta que atendia o número (GET for_inbox) e
// confirma com um clique; sem roleta no número, o aviso pede a escolha.
// Persona "O corretor" TRAVA o destino: o lead fica com o dono do número.
//
// ⚠️ GRAVAÇÃO NA HORA SEM DESTINO PELA METADE: trocar o cartão NÃO grava. Roleta e
// corretor gravam quando alguém é escolhido; o Sistema do cliente com "Usar o
// sistema do cliente", que só acende com endereço salvo e chave pronta. Gravar o
// cartão sozinho faria uma IA ligada mandar o próximo lead pra ninguém.
// ⚠️ A escolha pela metade some se a persona virar corretor com a página aberta
// (Desfazer, outra aba): a trava manda.
// ⚠️ Nunca "webhook" na tela (decisão de 05/10 + conferir-padrao).
// ⚠️ O resumo grava só a subchave briefing_enabled: o hook monta o jsonb sobre o
// último salvo, então o critério gravado em outra página não é pisado.
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import { roletaConfigService } from '@/services/roletaConfig/roletaConfigService';
import agentsService from '@/services/channels/agentsService';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { briefingEnabled, toggleBriefing } from '@/features/salesAgents/handoffBriefing';
import { problemaNoEndereco } from '@/features/salesAgents/sistemaDoCliente';
import { FRASE_SEM_DONO } from '@/features/salesAgents/pendencias';
import SistemaDoCliente from '../SistemaDoCliente';
import { Aviso } from '../Aviso';
import type { PropsDaPagina } from '../paginas';

type Escolha = 'roleta' | 'user' | 'webhook';
const DESTINOS = [
  { valor: 'roleta' as const, rotulo: 'Roleta', descricao: 'Distribui entre os corretores da roleta escolhida.' },
  { valor: 'user' as const, rotulo: 'Corretor fixo', descricao: 'Sempre a mesma pessoa, com o botão de aceitar.' },
  { valor: 'webhook' as const, rotulo: 'Sistema do cliente', descricao: 'Manda pro sistema que a imobiliária já usa, com o resumo. Ninguém da roleta recebe.' },
];

export default function Destino({ agent, gravar, irPara, aoChaveGerada }: PropsDaPagina) {
  const persona = lerEscolhas(agent).persona;
  const gravado = agent.handoff_target;
  const [escolhendo, setEscolhendo] = useState<Escolha | null>(null);
  const [roletas, setRoletas] = useState<{ id: string; nome: string; ativa: boolean }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [url, setUrl] = useState(agent.handoff_webhook_url ?? '');
  const [erroUrl, setErroUrl] = useState<string | null>(null);
  const [roletaQueAtendia, setRoletaQueAtendia] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => { if (persona === 'broker') setEscolhendo(null); }, [persona]);
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
  const naRoletaDoNumero = gravado === 'inbox_roleta' && persona !== 'broker' && !!agent.inbox_id;
  useEffect(() => {
    setRoletaQueAtendia(null);
    if (!naRoletaDoNumero || !agent.inbox_id) return;
    let vivo = true;
    roletaConfigService.getForInbox(String(agent.inbox_id))
      .then((r) => { if (vivo && r) setRoletaQueAtendia({ id: String(r.id), nome: r.display_name || r.name || 'Roleta sem nome' }); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [naRoletaDoNumero, agent.inbox_id]);

  const doGravado: Escolha | null = gravado === 'roleta' || gravado === 'user' || gravado === 'webhook' ? gravado : null;
  // Com a persona corretor a trava manda, mesmo no primeiro render depois da troca.
  const atual = persona === 'broker' ? null : escolhendo ?? doGravado;
  const fechar = (ok: boolean) => { if (ok) setEscolhendo(null); };
  const escolherCartao = (v: Escolha) => setEscolhendo(v === doGravado ? null : v);
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
  const sistemaPronto = !!agent.handoff_webhook_url && agent.handoff_webhook_secret_state === 'ready';
  const roletasVisiveis = roletas.filter((r) => r.ativa || r.id === agent.handoff_roleta_config_id);
  const cfg = agent.transfer_config ?? {};

  return (
    <Secoes>
      <Secao titulo="Destino" descricao="Quem recebe o lead quando ela termina. Lead que já tem responsável continua com ele.">
        {persona === 'broker' ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border-[1.5px] border-border bg-muted/40 p-3.5">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Fica com o dono do número</p>
                <p className="text-[13px] text-muted-foreground">
                  A persona é "O corretor": ela fala como ele, então o lead é dele{agent.number_owner_name ? ` (${agent.number_owner_name})` : ''}.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => irPara('identidade')}>Mudar persona</Button>
            </div>
            {gravado !== 'number_owner' && (
              <Aviso>
                <p>Hoje o lead vai para outro destino, e não para o dono do número.</p>
                {agent.inbox_id && !agent.number_owner_id ? (
                  <p className="mt-2 text-destructive">{FRASE_SEM_DONO}</p>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="mt-2"
                    onClick={() => void gravar({ persona_kind: 'broker', handoff_target: 'number_owner', handoff_user_id: null, handoff_roleta_config_id: null })}>
                    Passar a entregar pro dono do número
                  </Button>
                )}
              </Aviso>
            )}
          </>
        ) : (
          <>
            {gravado === 'inbox_roleta' && !escolhendo && (
              <Aviso>
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
            <CartoesDeEscolha<Escolha> rotulo="Destino" colunas={3} valor={atual} opcoes={DESTINOS} aoEscolher={escolherCartao} />
            {atual === 'roleta' && (
              <Campo id="destino-roleta" rotulo="Qual roleta">
                <Seletor id="destino-roleta" className={`${CLASSE_DO_CAMPO} w-full`} value={gravado === 'roleta' ? agent.handoff_roleta_config_id ?? '' : ''}
                  onChange={(e) => escolherRoleta(e.target.value)}>
                  <option value="">Escolha a roleta</option>
                  {roletasVisiveis.map((r) => <option key={r.id} value={r.id}>{r.nome}{r.ativa ? '' : ' (desligada)'}</option>)}
                </Seletor>
              </Campo>
            )}
            {atual === 'user' && (
              <Campo id="destino-corretor" rotulo="Qual corretor">
                <Seletor id="destino-corretor" className={`${CLASSE_DO_CAMPO} w-full`} value={gravado === 'user' ? agent.handoff_user_id ?? '' : ''}
                  onChange={(e) => escolherCorretor(e.target.value)}>
                  <option value="">Escolha o corretor</option>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Seletor>
              </Campo>
            )}
            {atual === 'webhook' && (
              <>
                <SistemaDoCliente agentId={agent.id} url={url} urlSalva={agent.handoff_webhook_url ?? null}
                  chaveGerada={Boolean(agent.handoff_webhook_secret_set)} chaveIlegivel={agent.handoff_webhook_secret_state === 'unreadable'}
                  onUrlChange={mudarUrl} onUrlBlur={salvarUrl}
                  // A chave é gravada pela ação própria (nunca pelo salvar da IA): a casca só fica sabendo.
                  onChaveGerada={() => aoChaveGerada?.()} />
                {erroUrl && <p className="text-sm text-destructive">{erroUrl}</p>}
                {gravado !== 'webhook' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" disabled={!sistemaPronto}
                      onClick={() => void gravar({ handoff_target: 'webhook', handoff_roleta_config_id: null, handoff_user_id: null }).then(fechar)}>
                      Usar o sistema do cliente
                    </Button>
                    {!sistemaPronto && <span className="text-sm text-muted-foreground">Salve o endereço e gere a chave antes.</span>}
                  </div>
                )}
              </>
            )}
          </>
        )}
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
