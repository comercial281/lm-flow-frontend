// Passo 7 · Voltar a chamar. Retomada (as 2 cutucadas quando o lead para no meio)
// + follow-up (quando ele some). O limite de 3 tentativas vale pra IA nova; quem
// já tinha follow-up infinito continua assim, com o aviso.
//
// ⚠️ "Ir aos poucos" (gotejamento) foi pro Avançado.
import { Secao } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import { linhaDoTempo } from '@/features/salesAgents/resumoDosPassos';
import {
  clampReengagementHours, REENGAGEMENT_DEFAULT_FIRST_HOURS, REENGAGEMENT_DEFAULT_SECOND_HOURS,
} from '../../reengagementHours';
import { FollowupActionPicker, FollowupHoursRow, FollowupPipelinesRow } from '../../configuracao/legado/FollowupSection';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDosPassos';
import { Aviso, Caixa, CascaDoPasso } from '../pecas';
import type { PropsDoPasso } from '../passos';

export default function Passo7VoltarAChamar({ agent, aoSalvo }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[7], aoSalvo);
  const ligado = !!rascunho.followup_enabled;
  const linhas = linhaDoTempo(rascunho);

  const previa = (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Linha do tempo</p>
      {linhas.length ? (
        <ol className="space-y-1 text-sm">{linhas.map((l) => <li key={l}>{l}</li>)}</ol>
      ) : (
        <p className="text-sm">Ela não volta a chamar quem sumiu.</p>
      )}
    </div>
  );

  return (
    <CascaDoPasso numero={7} previa={previa} pendente={pendente} salvando={salvando} erro={erro} aoSalvar={() => void salvar()} aoDescartar={descartar}>
      <Secao titulo="Retomada" descricao="Quando ela pergunta e o lead para de responder no meio da conversa, ela retoma a pergunta duas vezes antes do follow-up.">
        <Caixa id="p7-retomada" rotulo="Retomar a pergunta antes do follow-up" marcada={!!rascunho.reengagement_enabled}
          aoMudar={(v) => mudar({ reengagement_enabled: v })} />
        {rascunho.reengagement_enabled && (
          <>
            {!ligado && <Aviso>A retomada só funciona com o follow-up ligado.</Aviso>}
            {ligado && rascunho.followup_only && <Aviso>Com "Só follow-up" ela não responde ao vivo, então não há pergunta pra retomar.</Aviso>}
            <CampoTexto id="p7-retomada-1" type="number" min={1} max={48} rotulo="1ª mensagem depois de (horas sem resposta)"
              valor={String(rascunho.reengagement_first_hours ?? REENGAGEMENT_DEFAULT_FIRST_HOURS)}
              aoMudar={(v) => mudar({ reengagement_first_hours: clampReengagementHours(Number(v), REENGAGEMENT_DEFAULT_FIRST_HOURS) })} />
            <CampoTexto id="p7-retomada-2" type="number" min={1} max={48} rotulo="2ª mensagem (horas depois da 1ª)"
              valor={String(rascunho.reengagement_second_hours ?? REENGAGEMENT_DEFAULT_SECOND_HOURS)}
              aoMudar={(v) => mudar({ reengagement_second_hours: clampReengagementHours(Number(v), REENGAGEMENT_DEFAULT_SECOND_HOURS) })} />
          </>
        )}
      </Secao>

      <Secao titulo="Follow-up" descricao="Quando o lead some, ela volta a chamar. Quem nunca respondeu nenhuma vez é do Robô Sem Resposta, em Automações.">
        <Caixa id="p7-followup" rotulo="Ir atrás de quem sumiu" marcada={ligado} aoMudar={(v) => mudar({ followup_enabled: v })} />
        {ligado && (
          <>
            <CampoTexto id="p7-min" type="number" min={1} max={365} rotulo="A cada (mínimo de dias)" valor={String(rascunho.followup_min_days ?? 2)}
              aoMudar={(v) => mudar({ followup_min_days: Math.min(365, Math.max(1, Number(v) || 1)) })} />
            <CampoTexto id="p7-max" type="number" min={1} max={365} rotulo="Até (máximo de dias)" valor={String(rascunho.followup_max_days ?? 3)}
              aoMudar={(v) => mudar({ followup_max_days: Math.min(365, Math.max(1, Number(v) || 1)) })} />
            <CampoTexto id="p7-tentativas" type="number" min={0} rotulo="Máximo de tentativas" valor={String(rascunho.followup_max_attempts ?? 3)}
              ajuda="0 = sem limite." aoMudar={(v) => mudar({ followup_max_attempts: Math.max(0, Number(v) || 0) })} />
            {rascunho.followup_max_attempts === 0 && <Aviso>Sem limite de tentativas: ela continua indo atrás pra sempre.</Aviso>}
            <Caixa id="p7-so-followup" rotulo="Só follow-up (ela não responde ao vivo)" marcada={!!rascunho.followup_only}
              aoMudar={(v) => mudar({ followup_only: v })} />
          </>
        )}
      </Secao>

      {ligado && (
        <>
          <Secao titulo="Quais leads" descricao="De quais funis ela vai atrás.">
            <FollowupPipelinesRow agent={rascunho} onSave={mudar} />
          </Secao>
          <Secao titulo="Quando pode sair" descricao="O horário em que ela pode mandar a retomada e o follow-up.">
            <FollowupHoursRow agent={rascunho} onSave={mudar} />
          </Secao>
          <Secao titulo="O que ela faz quando o lead some" descricao="Escrever a mensagem, mover o card ou entregar pro follow-up.">
            <FollowupActionPicker agent={rascunho} onSave={mudar} />
          </Secao>
        </>
      )}
    </CascaDoPasso>
  );
}
