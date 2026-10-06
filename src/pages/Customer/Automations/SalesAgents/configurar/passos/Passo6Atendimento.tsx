// Passo 6 · Atendimento. Número, quem ela atende, horários e como ela responde.
//
// "Quem ela atende" escreve em português as regras de entrada de hoje (o editor
// delas é o de sempre, `TriggersSection`, ligado ao rascunho). A palavra-chave
// antiga (`trigger_keyword`) não tem mais campo: aparece como aviso com "Tirar essa
// regra", porque escondida ela continuaria restringindo calada.
//
// Horários: um bloco só (sempre · só fora do comercial · só no horário escolhido),
// com o aviso fora do horário logo embaixo.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import { Secao } from '@/components/base/Secao';
import { Campo, CampoTexto, CampoTextoLongo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { DEFAULT_WINDOW, type ScheduleWindow } from '@/components/schedule/scheduleWindows';
import type { ActiveHours, ActiveHoursMode } from '@/services/salesAgents/salesAgentsService';
import { formIdsDropped } from '@/features/salesAgents/formTrigger';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { resumoDeQuemAtende, resumoDoAtendimento } from '@/features/salesAgents/resumoDosPassos';
import { TriggersSection } from '../blocos/TriggersSection';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDosPassos';
import { Aviso, Caixa, CascaDoPasso, Escolha, type OpcaoDeEscolha } from '../pecas';
import type { PropsDoPasso } from '../passos';

type Quem = 'todos' | 'alguns';
const QUEM: OpcaoDeEscolha<Quem>[] = [
  { valor: 'todos', titulo: 'Todos os leads do número' },
  { valor: 'alguns', titulo: 'Só alguns leads', descricao: 'Por campanha, formulário, palavra, etiqueta ou funil.' },
];
const HORARIOS: OpcaoDeEscolha<ActiveHoursMode>[] = [
  { valor: 'always', titulo: 'Sempre, 24 horas' },
  { valor: 'outside_business', titulo: 'Só fora do horário comercial (18:00 às 07:00)', descricao: 'Quando não tem ninguém do time.' },
  { valor: 'custom', titulo: 'Só no horário que eu escolher' },
];

export default function Passo6Atendimento({ agent, inboxes, aoSalvo, irParaPasso }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[6], aoSalvo);
  const [quem, setQuem] = useState<Quem>((agent.triggers ?? []).length ? 'alguns' : 'todos');
  useEffect(() => setQuem((agent.triggers ?? []).length ? 'alguns' : 'todos'), [agent]);

  const horas: ActiveHours = rascunho.active_hours ?? {};
  const modo = horas.mode ?? 'always';
  const janelas = (horas.windows?.length ? horas.windows : [DEFAULT_WINDOW]) as ScheduleWindow[];
  const setHoras = (p: Partial<ActiveHours>) => mudar({ active_hours: { ...horas, tz: horas.tz ?? 'America/Sao_Paulo', ...p } });
  const escolherHorario = (m: ActiveHoursMode) =>
    setHoras({ mode: m, ...(m === 'custom' ? { windows: horas.windows?.length ? horas.windows : [DEFAULT_WINDOW] } : {}) });

  const numero = inboxes.find((i) => String(i.id) === String(rascunho.inbox_id ?? ''))?.name ?? null;
  const palavra = (rascunho.trigger_keyword ?? '').trim();
  const corretor = lerEscolhas(rascunho).persona === 'broker';
  const trocouNumero = (rascunho.inbox_id ?? null) !== (agent.inbox_id ?? null);

  const escolherQuem = (q: Quem) => {
    setQuem(q);
    if (q === 'todos') mudar({ triggers: [] });
  };

  const aoSalvar = async () => {
    const r = await salvar();
    if (r?.patch.triggers && formIdsDropped(r.patch.triggers, r.atualizado.triggers)) {
      toast.error('O servidor não guardou os formulários marcados. Avise o suporte.');
    }
  };

  const previa = (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Resumo</p>
      <p className="text-sm">{resumoDoAtendimento(rascunho, numero)}</p>
    </div>
  );

  return (
    <CascaDoPasso numero={6} previa={previa} pendente={pendente} salvando={salvando} erro={erro} aoSalvar={() => void aoSalvar()} aoDescartar={descartar}>
      <Secao titulo="Número" descricao="O WhatsApp em que ela recebe e responde os leads.">
        <Campo id="p6-numero" rotulo="Número de WhatsApp">
          <Seletor id="p6-numero" className={`${CLASSE_DO_CAMPO} w-full`} value={rascunho.inbox_id ?? ''}
            onChange={(e) => mudar({ inbox_id: e.target.value || null })}>
            <option value="">Escolha o número</option>
            {inboxes.map((i) => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
          </Seletor>
        </Campo>
        {corretor && !trocouNumero && rascunho.number_owner_name && (
          <p className="text-sm text-muted-foreground">Dono deste número: {rascunho.number_owner_name}. É pra ele que o lead vai.</p>
        )}
        {corretor && trocouNumero && <Aviso tom="neutro">Salve pra conferir quem é o dono do número novo.</Aviso>}
      </Secao>

      <Secao titulo="Quem ela atende" descricao="Todos os leads que escrevem no número, ou só alguns.">
        {palavra && (
          <Aviso>
            <p>Ela só entra quando o lead escreve "{palavra}" (regra antiga, sem campo nesta tela).</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => mudar({ trigger_keyword: null })}>
              Tirar essa regra
            </Button>
          </Aviso>
        )}
        <Escolha nome="quem" legenda="Quem ela atende" valor={quem} opcoes={QUEM} aoEscolher={escolherQuem} />
        {quem === 'alguns' && (
          <>
            {(rascunho.triggers ?? []).length > 0 && (
              <div className="text-sm">
                <p className="font-medium">Ela entra pra:</p>
                <ul className="list-disc pl-5">{resumoDeQuemAtende(rascunho.triggers ?? []).map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}
            <TriggersSection agent={rascunho} onSave={mudar} />
          </>
        )}
      </Secao>

      <Secao titulo="Horários" descricao="Quando ela responde. Fora disso, o lead pode receber um aviso.">
        <Escolha nome="horario" legenda="Horários" valor={modo} opcoes={HORARIOS} aoEscolher={escolherHorario} />
        {modo === 'custom' && (
          <WeeklyWindowsEditor value={janelas} idPrefix="p6_win" onChange={(next) => setHoras({ mode: 'custom', windows: next })} />
        )}
        {modo !== 'always' && (
          <>
            <Caixa id="p6-fora" rotulo="Avisar quem escrever fora do horário" descricao="Uma vez por conversa por dia. Sem isso, quem escreve de madrugada não recebe nada."
              marcada={!!rascunho.out_of_hours_reply} aoMudar={(v) => mudar({ out_of_hours_reply: v })} />
            {rascunho.out_of_hours_reply && (
              <CampoTextoLongo id="p6-fora-texto" rotulo="Mensagem fora do horário" rows={2} valor={rascunho.out_of_hours_message ?? ''}
                ajuda="Vazio: ela escreve sozinha e já diz quando volta." aoMudar={(v) => mudar({ out_of_hours_message: v.trim() ? v : null })} />
            )}
          </>
        )}
      </Secao>

      <Secao titulo="Como ela responde" descricao="Ritmo e formato das respostas.">
        <Caixa id="p6-varias" rotulo="Responder em várias mensagens" descricao="Mensagens curtas com digitando entre elas, como um corretor no WhatsApp."
          marcada={rascunho.message_split_enabled !== false} aoMudar={(v) => mudar({ message_split_enabled: v })} />
        <Caixa id="p6-audio" rotulo="Responder em áudio" marcada={!!rascunho.audio_enabled} aoMudar={(v) => mudar({ audio_enabled: v })} />
        {rascunho.audio_enabled && (
          <>
            <Campo id="p6-audio-quando" rotulo="Quando responder em áudio">
              <Seletor id="p6-audio-quando" className={`${CLASSE_DO_CAMPO} w-full`} value={rascunho.audio_mode ?? 'mirror'}
                onChange={(e) => mudar({ audio_mode: e.target.value as 'mirror' | 'always' | 'never' })}>
                <option value="mirror">Quando o lead mandar áudio (recomendado)</option>
                <option value="always">Sempre</option>
                <option value="never">Nunca</option>
              </Seletor>
            </Campo>
            <CampoTexto id="p6-voz" rotulo="Voz" valor={rascunho.audio_voice_id ?? ''} ajuda="Código da voz combinada com a equipe da plataforma."
              aoMudar={(v) => mudar({ audio_voice_id: v.trim() || null })} />
          </>
        )}
      </Secao>

      <Secao titulo="Avançado" descricao="Modelo, ritmo, limites por dia e o texto que a IA recebe. Você vê; a equipe da plataforma muda.">
        <Button type="button" variant="outline" onClick={() => irParaPasso('avancado')}>Abrir Avançado</Button>
      </Secao>
    </CascaDoPasso>
  );
}
