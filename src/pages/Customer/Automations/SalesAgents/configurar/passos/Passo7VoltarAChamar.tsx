// Passo 7 · Voltar a chamar. Retomada (as 2 cutucadas quando o lead para no meio)
// + follow-up (quando ele some). Desde 06/10/2026 a IA não escreve mais o
// follow-up: depois de X dias sem resposta ela ENTREGA o lead (move o card ou põe
// no follow-up escolhido) e sai de cena. Por isso só um campo de dias (o mínimo;
// o máximo acompanha) e nenhum "Máximo de tentativas": ela age uma vez por sumiço.
//
// ⚠️ "Ir aos poucos" (gotejamento) foi pro Avançado.
import { useState } from 'react';
import { toast } from 'sonner';
import { Secao } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import { linhaDoTempo } from '@/features/salesAgents/resumoDosPassos';
import { motivoSemEscolhaDoFollowup } from '@/features/salesAgents/pendencias';
import {
  clampReengagementHours, REENGAGEMENT_DEFAULT_FIRST_HOURS, REENGAGEMENT_DEFAULT_SECOND_HOURS,
} from '../../reengagementHours';
import { FollowupActionPicker, FollowupHoursRow, FollowupPipelinesRow } from '../blocos/FollowupSection';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDaIa';
import { Aviso, Caixa, CascaDoPasso } from '../pecas';
import type { PropsDoPasso } from '../passos';

export default function Passo7VoltarAChamar({ agent, aoSalvo }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[7], aoSalvo);
  const ligado = !!rascunho.followup_enabled;
  const linhas = linhaDoTempo(rascunho);

  // 06/10/2026: o servidor recusa o follow-up ligado sem uma saída (IA ainda em
  // "A IA escreve", ou sem valor). O Salvar não manda e diz o motivo; a recusa do
  // servidor, se vier mesmo assim, aparece no mesmo lugar (`erro` do rascunho).
  const semEscolha = motivoSemEscolhaDoFollowup(rascunho);
  const [tentouSemEscolha, setTentouSemEscolha] = useState(false);
  const aoSalvar = () => {
    if (semEscolha) {
      setTentouSemEscolha(true);
      toast.error(semEscolha);
      return;
    }
    setTentouSemEscolha(false);
    void salvar();
  };
  const erroDoPasso = (tentouSemEscolha && semEscolha) || erro;

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
    <CascaDoPasso numero={7} previa={previa} pendente={pendente} salvando={salvando} erro={erroDoPasso} aoSalvar={aoSalvar} aoDescartar={descartar}>
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

      <Secao titulo="Follow-up" descricao="Quando o lead some, ela entrega ele pro follow-up ou move o card. Quem nunca respondeu nenhuma vez é do Robô Sem Resposta, em Automações.">
        <Caixa id="p7-followup" rotulo="Ir atrás de quem sumiu" marcada={ligado} aoMudar={(v) => mudar({ followup_enabled: v })} />
        {ligado && (
          <>
            {/* O servidor entrega quando o silêncio passa do MÍNIMO; o máximo só
                espaça a nova tentativa quando a entrega falha. Gravar os dois
                iguais deixa um número só pra entender. */}
            <CampoTexto id="p7-dias" type="number" min={1} max={365} rotulo="Entregar o lead depois de (dias sem resposta)"
              ajuda="Quanto tempo de silêncio até entregar o lead." valor={String(rascunho.followup_min_days ?? 2)}
              aoMudar={(v) => {
                const dias = Math.min(365, Math.max(1, Number(v) || 1));
                mudar({ followup_min_days: dias, followup_max_days: dias });
              }} />
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
          <Secao titulo="Quando pode sair" descricao="O horário em que ela pode mandar a retomada e entregar o lead.">
            <FollowupHoursRow agent={rascunho} onSave={mudar} />
          </Secao>
          <Secao titulo="O que ela faz quando o lead some" descricao="Mover o card ou entregar pro follow-up. Quem manda as mensagens é o follow-up, com texto pronto.">
            <FollowupActionPicker agent={rascunho} onSave={mudar} />
          </Secao>
        </>
      )}
    </CascaDoPasso>
  );
}
