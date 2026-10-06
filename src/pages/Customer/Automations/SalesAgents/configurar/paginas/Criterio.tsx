// Repasse · Critério (onda 3). Quando ela passa (4 cartões + as opções antigas só
// pra quem tem), lead frio (crm_policy.cold) e a PASSAGEM IMEDIATA, que estava
// escondida (escalate_on_*: a tela dizia "ela sempre passa" e dependia delas).
//
// ⚠️ Decisão de 05/10 (não reabrir): "duvida" e "sem_resposta" são cenários
// antigos de verdade ("ao menor sinal de dúvida" / "só se ela não souber
// responder", não "o lead sumiu"). Aparecem só pra quem já tem, e continuam valendo.
// ⚠️ Toda escrita do cenário passa por keepBriefing (handoffBriefing.spec lê a fonte).
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import type { OpcaoDeEscolha } from '@/components/base/BotoesDeEscolha';
import type { HandoffMode } from '@/services/salesAgents/salesAgentsService';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { keepBriefing } from '@/features/salesAgents/handoffBriefing';
import { perguntasDoAgente } from '@/features/salesAgents/perguntas';
import { Aviso } from '../Aviso';
import type { PropsDaPagina } from '../paginas';

type Quando = HandoffMode | 'julgar';

export default function Criterio({ agent, gravar, irPara }: PropsDaPagina) {
  const cfg = agent.transfer_config ?? {};
  const quando: Quando = (cfg.mode as Quando | undefined) ?? 'julgar';
  const visita = lerEscolhas(agent).alcance === 'visit';
  const crm = agent.crm_policy ?? {};
  const semPerguntas = !perguntasDoAgente(agent).some((p) => p.obrigatoria);

  const opcoes: OpcaoDeEscolha<Quando>[] = [
    { valor: 'checklist', rotulo: 'Perguntas obrigatórias respondidas', descricao: 'Recomendado. O lead chega pré-qualificado.' },
    { valor: 'temperatura', rotulo: 'Lead quente', descricao: 'Ela conduz e passa quando o lead esquenta.' },
    { valor: 'julgar', rotulo: 'Ela decide', descricao: 'Sem regra fixa: ela escolhe a hora.' },
    { valor: 'pos_visita', rotulo: 'Visita marcada', descricao: 'Só passa com a visita na agenda.', desabilitada: !visita, motivo: 'Só com o objetivo "Agendar visita".' },
    ...(quando === 'duvida' ? [{ valor: 'duvida' as Quando, rotulo: 'Ao menor sinal de dúvida (opção antiga)', descricao: 'Continua valendo até você escolher outra.' }] : []),
    ...(quando === 'sem_resposta' ? [{ valor: 'sem_resposta' as Quando, rotulo: 'Só quando ela não souber responder (opção antiga)', descricao: 'Continua valendo até você escolher outra.' }] : []),
  ];

  const escolherQuando = (v: Quando) =>
    gravar({ transfer_config: keepBriefing(cfg, { ...cfg, mode: v === 'julgar' ? undefined : v, min_temperature: v === 'temperatura' ? cfg.min_temperature ?? 'hot' : undefined }) }, ['transfer_config.mode', 'transfer_config.min_temperature']);

  return (
    <Secoes>
      <Secao titulo="Quando ela passa" descricao="O momento em que o lead sai dela e vai pra uma pessoa.">
        <CartoesDeEscolha<Quando> rotulo="Quando ela passa" valor={quando} opcoes={opcoes} aoEscolher={(v) => void escolherQuando(v)} />
        {quando === 'temperatura' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">A partir de</span>
            <BotoesDeEscolha rotulo="Temperatura" valor={cfg.min_temperature ?? 'hot'}
              opcoes={[{ valor: 'warm', rotulo: 'Morno' }, { valor: 'hot', rotulo: 'Quente' }]}
              aoEscolher={(t) => void gravar({ transfer_config: { ...cfg, min_temperature: t } }, ['transfer_config.min_temperature'])} />
          </div>
        )}
        {quando === 'checklist' && semPerguntas && (
          <Aviso>
            <p>Nenhuma pergunta obrigatória ainda.</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => irPara('qualificacao')}>Abrir Qualificação</Button>
          </Aviso>
        )}
        {quando === 'pos_visita' && !visita && <Aviso>Ela só qualifica e passa, então "Visita marcada" nunca acontece. Escolha outro.</Aviso>}
      </Secao>

      <Secao titulo="Lead frio" descricao="Quem ainda está só olhando. Desligado, ela segue conversando em vez de passar.">
        <LinhaComChave rotulo="Passar também lead frio ou curioso" ligada={crm.cold === true}
          aoMudar={(v) => gravar({ crm_policy: { ...crm, cold: v } }, ['crm_policy.cold'])} />
      </Secao>

      <Secao titulo="Passagem imediata" descricao="Situações em que ela passa na hora, sem esperar o critério acima.">
        <LinhaComChave rotulo="Lead irritado" ligada={agent.escalate_on_frustration !== false}
          aoMudar={(v) => gravar({ escalate_on_frustration: v })} />
        <LinhaComChave rotulo="Pediu pra falar com uma pessoa" ligada={agent.escalate_on_human_request !== false}
          aoMudar={(v) => gravar({ escalate_on_human_request: v })} />
        <LinhaComChave rotulo="Perguntou se é robô" ligada={agent.escalate_on_ai_detected !== false}
          aoMudar={(v) => gravar({ escalate_on_ai_detected: v })} />
      </Secao>
    </Secoes>
  );
}
