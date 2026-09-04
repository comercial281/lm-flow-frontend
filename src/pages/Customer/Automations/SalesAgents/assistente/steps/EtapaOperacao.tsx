import { Input, Label } from '@/components/ui/ds';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { DEFAULT_WINDOW } from '@/components/schedule/scheduleWindows';
import { DEFAULT_FOLLOWUP_WINDOW, estimativaPorDia, minutosPorDia, resumoDaJanela } from '@/features/salesAgents/followupHours';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { AssistenteAnswers } from '../assistenteMapping';
import { FOLLOWUP_OPCOES, HANDOFF_OPCOES, MOMENTOS } from '../assistenteOpcoes';
import { Campo, CartaoEscolha, Interruptor, Secao, Seletor } from './Campos';

export interface OpcaoLista { value: string; label: string }

/**
 * Etapa 5 — Operação: quando a IA atende, quando entrega, o que faz com quem
 * some e como mexe no funil. As listas de funil, coluna e funil de follow-up
 * vêm da página, que as carrega uma vez.
 */
export default function EtapaOperacao({
  a, set, agent, pipelines, stages, funis,
}: {
  a: AssistenteAnswers;
  set: (patch: Partial<AssistenteAnswers>) => void;
  agent: SalesAgent;
  pipelines: OpcaoLista[];
  stages: OpcaoLista[];
  funis: OpcaoLista[];
}) {
  const entregaAoFunil = a.followup_action === 'pipeline' || a.followup_action === 'sequence';
  const minutos = minutosPorDia(a.followup_janelas);
  // A conta de padeiro usa o ritmo que a IA já tem (o gotejamento não é editado
  // aqui) sobre a janela que está sendo escolhida.
  const estimativa = estimativaPorDia({ ...agent, followup_hours: { mode: 'custom', windows: a.followup_janelas } });

  // Trocar o funil LIMPA o mapa e a coluna do silêncio: as colunas escolhidas
  // são de outro funil, e o servidor as recusaria uma a uma — a pessoa veria as
  // escolhas guardadas e nenhum card andando.
  const escolherFunil = (id: string) => set({
    pipeline_id: id,
    pipeline_stage_map: {},
    followup_stage_id: '',
    followup_return_stage_id: '',
  });

  const escolherColuna = (momento: string, coluna: string) => {
    const mapa = { ...a.pipeline_stage_map };
    if (coluna) mapa[momento] = coluna; else delete mapa[momento];
    set({ pipeline_stage_map: mapa });
  };

  return (
    <div className="space-y-8">
      <Secao titulo="Horário de atuação" ajuda="Quando a IA responde quem escreve. Fora dele, a conversa espera um corretor.">
        <Interruptor id="as_24h" on={a.atuacao_sempre} onChange={(v) => set({ atuacao_sempre: v, atuacao_janelas: a.atuacao_janelas.length ? a.atuacao_janelas : [{ ...DEFAULT_WINDOW }] })}
          titulo="Atende 24 horas, todos os dias" desc="Desligue para escolher os dias e horários." />
        {!a.atuacao_sempre && (
          <WeeklyWindowsEditor value={a.atuacao_janelas} idPrefix="as_win" onChange={(next) => set({ atuacao_janelas: next })} />
        )}
      </Secao>

      <Secao titulo="Quando ela passa para um corretor" ajuda="Escolha um cenário. Ele vale para todos os leads desta IA.">
        <CartaoEscolha nome="Cenário de repasse" opcoes={HANDOFF_OPCOES} value={a.handoff_mode} onChange={(v) => set({ handoff_mode: v })} />
        {a.handoff_mode === 'temperatura' && (
          <Campo id="as_temp" label="A partir de" ajuda="É a mesma leitura que aparece no painel O que a IA entendeu, dentro da conversa.">
            <Seletor id="as_temp" value={a.min_temperature} onChange={(v) => set({ min_temperature: v === 'warm' ? 'warm' : 'hot' })}
              opcoes={[{ value: 'hot', label: 'Lead quente' }, { value: 'warm', label: 'Lead morno ou quente' }]} />
          </Campo>
        )}
      </Secao>

      <Secao titulo="Quando o lead sumir" ajuda="O follow-up automático: o que a IA faz com quem parou de responder.">
        <Interruptor id="as_fu" on={a.followup_enabled} onChange={(v) => set({ followup_enabled: v })}
          titulo="Ir atrás de quem sumiu" desc="Só para quem já respondeu alguma vez e ainda não foi passado ao corretor." />
        {a.followup_enabled && (
          <div className="space-y-4 pl-1">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="as_fu_min" className="text-xs">Depois de</Label>
                <Input id="as_fu_min" type="number" min={1} max={30} value={a.followup_min_days} className="mt-1 w-20"
                  onChange={(e) => set({ followup_min_days: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div>
                <Label htmlFor="as_fu_max" className="text-xs">a</Label>
                <Input id="as_fu_max" type="number" min={1} max={60} value={a.followup_max_days} className="mt-1 w-20"
                  onChange={(e) => set({ followup_max_days: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <span className="text-sm text-muted-foreground pb-2">
                dias de silêncio{entregaAoFunil ? ' até entregar o lead' : ', sorteados entre cada follow-up'}
              </span>
              {!entregaAoFunil && (
                <div>
                  <Label htmlFor="as_fu_att" className="text-xs">No máximo</Label>
                  <div className="flex items-center gap-2">
                    <Input id="as_fu_att" type="number" min={1} max={10} value={a.followup_max_attempts} className="mt-1 w-20"
                      onChange={(e) => set({ followup_max_attempts: Math.max(1, Number(e.target.value) || 1) })} />
                    <span className="text-sm text-muted-foreground pt-1">vezes</span>
                  </div>
                </div>
              )}
            </div>

            <CartaoEscolha nome="Quando o lead sumir" opcoes={FOLLOWUP_OPCOES} value={a.followup_action} onChange={(v) => set({ followup_action: v })} />

            {a.followup_action === 'pipeline' && (
              !a.pipeline_id ? (
                <p className="text-xs text-amber-600">Escolha o funil no bloco <em>A IA move o card</em>, logo abaixo. As colunas saem de lá.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Campo id="as_fu_stage" label="Coluna para o lead que sumiu" ajuda="Ela precisa ter a entrada Card entrou numa coluna, em Automações → Follow-up — senão o card muda de lugar e ninguém fala com o lead.">
                    <Seletor id="as_fu_stage" value={a.followup_stage_id} onChange={(v) => set({ followup_stage_id: v })} opcoes={stages} vazio="— escolha a coluna —" />
                  </Campo>
                  <Campo id="as_fu_ret" label="Quando ele voltar a responder, o card vai para">
                    <Seletor id="as_fu_ret" value={a.followup_return_stage_id} onChange={(v) => set({ followup_return_stage_id: v })} opcoes={stages} vazio="Primeira coluna do funil" />
                  </Campo>
                </div>
              )
            )}
            {a.followup_action === 'sequence' && (
              <Campo id="as_fu_seq" label="Funil de follow-up" ajuda="Só os funis ativos aparecem.">
                <Seletor id="as_fu_seq" value={a.followup_sequence_slug} onChange={(v) => set({ followup_sequence_slug: v })} opcoes={funis} vazio="— escolha o funil —" />
              </Campo>
            )}

            <div className="rounded-lg border border-sidebar-border p-3 space-y-2">
              <div className="text-sm font-medium">Quando o follow-up pode sair</div>
              <p className="text-xs text-muted-foreground">
                É diferente do horário de atuação: aquele é quando ela responde; este é quando ela toma a iniciativa.
                {entregaAoFunil && ' Aqui decide quando ela ENTREGA o lead; dali em diante manda o horário do funil.'}
              </p>
              <button type="button" className="text-xs text-primary hover:underline"
                onClick={() => set({ followup_janelas: [{ ...DEFAULT_FOLLOWUP_WINDOW }] })}>
                Aplicar o padrão (09h às 17h, seg a sáb)
              </button>
              <WeeklyWindowsEditor value={a.followup_janelas} idPrefix="as_fu_win" onChange={(next) => set({ followup_janelas: next })} />
              {minutos <= 0 ? (
                <p className="text-xs text-amber-600">Com início igual ao fim a janela fecha o dia inteiro. O dia todo se escreve 00:00 às 23:59.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No ritmo configurado em <em>Ir aos poucos</em>, dá cerca de {estimativa} leads por dia, {resumoDaJanela(a.followup_janelas)}.
                </p>
              )}
            </div>
          </div>
        )}
      </Secao>

      <Secao titulo="A IA move o card" ajuda="Conforme a conversa anda, o card acompanha no quadro. Ela só empurra para a frente.">
        <Interruptor id="as_move" on={a.pipeline_move_enabled} onChange={(v) => set({ pipeline_move_enabled: v })}
          titulo="Mover o card no funil" desc="O movimento fica assinado por ela no histórico do card." />
        {(a.pipeline_move_enabled || a.followup_action === 'pipeline') && (
          <div className="space-y-3">
            <Campo id="as_pipe" label="Em qual funil" ajuda={pipelines.length ? undefined : 'Nenhum funil encontrado. Crie um em Funis e volte aqui.'}>
              <Seletor id="as_pipe" value={a.pipeline_id} onChange={escolherFunil} opcoes={pipelines} vazio="— escolha o funil —" />
            </Campo>
            {a.pipeline_move_enabled && a.pipeline_id && (
              <div className="space-y-2 rounded-lg border border-sidebar-border p-3">
                <div className="text-xs text-muted-foreground">Para cada momento da conversa, a coluna. Em <em>não mover</em>, a IA não mexe no card naquele momento.</div>
                {MOMENTOS.map((m) => (
                  <div key={m.key} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{m.titulo}</div>
                      <div className="text-xs text-muted-foreground">{m.ajuda}</div>
                    </div>
                    <div className="w-52 shrink-0">
                      <Seletor id={`as_mom_${m.key}`} value={a.pipeline_stage_map[m.key] ?? ''} onChange={(v) => escolherColuna(m.key, v)} opcoes={stages} vazio="— não mover —" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Secao>
    </div>
  );
}
