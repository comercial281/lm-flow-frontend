import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import type { AgentPlaybook } from '@/services/salesAgents/salesAgentsService';
import { PROXIMO_PASSO_PADRAO, type AssistenteAnswers } from '../assistenteMapping';
import { INTENCAO_OPCOES, PROXIMOS_PASSOS_RESERVA } from '../assistenteOpcoes';
import { Campo, CampoLinhas, CampoTexto, CartaoEscolha, PilulasDias, Secao, Seletor } from './Campos';

/**
 * Etapa 3 — O rumo da conversa.
 *
 * É a etapa dos PONTOS-CHAVE: cada campo entra no lugar de um exemplo de fábrica
 * DENTRO do método da casa. Vazio = o exemplo da casa, e a tela mostra qual é.
 * Rótulos e dicas vêm do servidor quando ele os manda — a tela não inventa texto.
 */
export default function EtapaRumo({
  a, set, playbook,
}: {
  a: AssistenteAnswers;
  set: (patch: Partial<AssistenteAnswers>) => void;
  playbook: AgentPlaybook | null;
}) {
  const rotulo = (k: string, reserva: string) => playbook?.var_labels?.[k] ?? reserva;
  const dica = (k: string) => playbook?.var_hints?.[k];
  const padrao = playbook?.slot_defaults;
  const passos = playbook?.next_steps?.length ? playbook.next_steps : PROXIMOS_PASSOS_RESERVA;
  const objecoesDeFabrica = padrao?.objecoes ?? [];

  const setObjecao = (i: number, patch: Partial<{ objecao: string; resposta: string }>) => {
    const next = a.objecoes.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    set({ objecoes: next });
  };

  return (
    <div className="space-y-8">
      <Secao titulo="Moradia ou investimento" ajuda="A pergunta mais discutida do roteiro. Você decide se ela existe.">
        <CartaoEscolha nome="Perguntar se é moradia ou investimento" opcoes={INTENCAO_OPCOES}
          value={a.intent_question_mode} onChange={(v) => set({ intent_question_mode: v })} colunas={3} />
        {a.intent_question_mode !== 'never' && (
          <CampoTexto id="as_intent" label="Como ela pergunta" value={a.intent_question} onChange={(v) => set({ intent_question: v })}
            placeholder="Ex: tá procurando pra morar ou é mais um investimento?"
            ajuda="Em branco, vale a redação da casa." />
        )}
      </Secao>

      <Secao titulo="As primeiras perguntas" ajuda="Como os SEUS corretores abrem a conversa. Elas entram na camada de situação do método.">
        <CampoLinhas id="as_situacao" label={rotulo('perguntas_situacao', 'Perguntas que seus corretores fazem primeiro')}
          value={a.perguntas_situacao} onChange={(v) => set({ perguntas_situacao: v })}
          placeholder={padrao?.perguntas_situacao || 'Uma pergunta por linha'}
          ajuda={dica('perguntas_situacao') ?? 'Uma por linha. Em branco, valem os exemplos da casa.'} />
        <CampoLinhas id="as_qualif" label="O que a IA precisa ter descoberto antes de passar o lead"
          value={a.qualification_questions} onChange={(v) => set({ qualification_questions: v })}
          placeholder={'Orçamento\nPrazo de compra\nRegião de interesse\nPrecisa de financiamento'}
          ajuda="É o checklist, não a pergunta: a IA descobre no ritmo da conversa." />
      </Secao>

      <Secao titulo="O cliente-tipo" ajuda="O que dói e o que mostra que ele está pronto.">
        <CampoTexto id="as_dor" label={rotulo('dor_tipica', 'O que dói no seu cliente-tipo')} rows={2}
          value={a.dor_tipica} onChange={(v) => set({ dor_tipica: v })}
          placeholder={padrao?.dor_tipica || 'Ex: paga aluguel caro e quer parar de jogar dinheiro fora'}
          ajuda={dica('dor_tipica')} />
        <CampoTexto id="as_pronto" label={rotulo('lead_pronto', 'Quando o lead está pronto pro próximo passo')} rows={2}
          value={a.lead_pronto} onChange={(v) => set({ lead_pronto: v })}
          placeholder={padrao?.lead_pronto || 'Ex: já sabe o bairro, tem a entrada e perguntou de horário'}
          ajuda={dica('lead_pronto')} />
      </Secao>

      <Secao titulo="O próximo passo" ajuda="Para onde a IA conduz toda conversa.">
        <Campo id="as_passo" label={rotulo('proximo_passo', 'Próximo passo que a IA busca')} ajuda={dica('proximo_passo')}>
          <Seletor id="as_passo" value={a.proximo_passo || PROXIMO_PASSO_PADRAO} onChange={(v) => set({ proximo_passo: v })} opcoes={passos} />
        </Campo>
        <div className="rounded-lg border border-sidebar-border p-3 space-y-2">
          <Label>Quando a IA pode marcar visita</Label>
          <PilulasDias value={a.visita_dias} onChange={(dias) => set({ visita_dias: dias })} />
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <Label htmlFor="as_vis_ini" className="text-xs">Das</Label>
              <Input id="as_vis_ini" type="time" value={a.visita_inicio} className="mt-1 w-28" onChange={(e) => set({ visita_inicio: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="as_vis_fim" className="text-xs">até</Label>
              <Input id="as_vis_fim" type="time" value={a.visita_fim} className="mt-1 w-28" onChange={(e) => set({ visita_fim: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Antecedência mínima, datas bloqueadas e duração ficam na tela de configuração.</p>
        </div>
      </Secao>

      <Secao titulo="Objeções" ajuda="O que o lead diz para não avançar, e como vocês respondem.">
        {objecoesDeFabrica.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Em branco, a IA usa as {objecoesDeFabrica.length} da casa: {objecoesDeFabrica.map((o) => o.objecao).join(' · ')}.
          </p>
        )}
        <div className="space-y-3">
          {a.objecoes.map((o, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-sidebar-border p-3 md:grid-cols-[1fr_1.4fr_auto]">
              <div>
                <Label htmlFor={`as_obj_${i}`} className="text-xs">Objeção</Label>
                <Input id={`as_obj_${i}`} value={o.objecao} placeholder="Ex: Tá caro" className="mt-1" onChange={(e) => setObjecao(i, { objecao: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`as_resp_${i}`} className="text-xs">Como respondem</Label>
                <Textarea id={`as_resp_${i}`} rows={2} value={o.resposta} placeholder="Ex: pergunta caro em relação a quê e mostra a conta do aluguel" className="mt-1" onChange={(e) => setObjecao(i, { resposta: e.target.value })} />
              </div>
              <button type="button" aria-label="Remover objeção" className="self-center text-muted-foreground hover:text-destructive"
                onClick={() => set({ objecoes: a.objecoes.filter((_, idx) => idx !== i) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => set({ objecoes: [...a.objecoes, { objecao: '', resposta: '' }] })}>
          <Plus className="h-3.5 w-3.5" /> Adicionar objeção
        </Button>
        <p className="text-xs text-muted-foreground">Objeção sem resposta (ou o contrário) não é gravada.</p>
      </Secao>
    </div>
  );
}
