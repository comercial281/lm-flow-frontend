import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { WEEKDAYS } from '@/components/schedule/scheduleWindows';
import { resumoDaJanela } from '@/features/salesAgents/followupHours';
import type { AgentPlaybook } from '@/services/salesAgents/salesAgentsService';
import { PROXIMO_PASSO_PADRAO, TIPO_VENDA_PADRAO, VOCABULARIO_POR_TIPO, type AssistenteAnswers } from '../assistenteMapping';
import {
  ETAPAS, FOLLOWUP_OPCOES, HANDOFF_OPCOES, INTENCAO_OPCOES, MOMENTOS, PROXIMOS_PASSOS_RESERVA, TIPOS_DE_VENDA_RESERVA,
} from '../assistenteOpcoes';
import type { OpcaoLista } from './EtapaOperacao';

const nomeDoDia = (d: number) => WEEKDAYS.find(([n]) => n === d)?.[1] ?? String(d);
const ou = (v: string, reserva: string) => (v.trim() ? v.trim() : reserva);

function Bloco({ indice, children, onEditar }: { indice: number; children: ReactNode; onEditar: () => void }) {
  const etapa = ETAPAS[indice];
  return (
    <section className="rounded-lg border border-sidebar-border">
      <header className="flex items-center justify-between border-b border-sidebar-border px-4 py-2.5">
        <h3 className="text-sm font-semibold">{indice + 1}. {etapa.titulo}</h3>
        <button type="button" onClick={onEditar} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Pencil className="h-3 w-3" /> Editar
        </button>
      </header>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-3 text-sm md:grid-cols-[180px_1fr]">{children}</dl>
    </section>
  );
}

function Linha({ rotulo, valor, apagado }: { rotulo: string; valor: ReactNode; apagado?: boolean }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground md:pt-0.5">{rotulo}</dt>
      <dd className={`whitespace-pre-wrap break-words ${apagado ? 'text-muted-foreground italic' : ''}`}>{valor}</dd>
    </>
  );
}

/**
 * Etapa 6 — Revisão. Tudo que vai ser gravado, por etapa, com "Editar" que volta
 * ao passo. O que está no padrão de fábrica aparece como padrão, em itálico.
 */
export default function EtapaRevisao({
  a, playbook, irPara, pipelines, stages, funis,
}: {
  a: AssistenteAnswers;
  playbook: AgentPlaybook | null;
  irPara: (etapa: number) => void;
  pipelines: OpcaoLista[];
  stages: OpcaoLista[];
  funis: OpcaoLista[];
}) {
  const tipos = playbook?.sale_types?.length ? playbook.sale_types : TIPOS_DE_VENDA_RESERVA;
  const passos = playbook?.next_steps?.length ? playbook.next_steps : PROXIMOS_PASSOS_RESERVA;
  const nome = (lista: OpcaoLista[], id: string, reserva: string) => lista.find((o) => o.value === id)?.label ?? (id ? id : reserva);
  const tipoVenda = a.tipo_venda || TIPO_VENDA_PADRAO;
  const termoPadrao = VOCABULARIO_POR_TIPO[tipoVenda] ?? 'IMÓVEL';
  const limites = [
    a.limite_endereco && 'endereço exato',
    a.limite_desconto && 'desconto',
    a.limite_preco && 'preço final / proposta',
    a.limite_iptu && 'IPTU',
    ...a.limites_livres.map((l) => l.trim()).filter(Boolean),
  ].filter(Boolean) as string[];
  const naHora = [
    a.escalate_on_frustration && 'lead irritado',
    a.escalate_on_human_request && 'pediu uma pessoa',
    a.escalate_on_ai_detected && 'percebeu que é IA',
  ].filter(Boolean) as string[];
  const objecoes = a.objecoes.filter((o) => o.objecao.trim() && o.resposta.trim());
  const mapa = MOMENTOS.filter((m) => a.pipeline_stage_map[m.key]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira. Ao concluir, tudo isto é gravado de uma vez na IA — que continua <strong>desligada</strong> até você ligar na tela de configuração.
      </p>

      <Bloco indice={0} onEditar={() => irPara(0)}>
        <Linha rotulo="Nome da IA" valor={ou(a.nome_ia, '—')} />
        <Linha rotulo="Imobiliária" valor={ou(a.nome_imobiliaria, 'não informada')} apagado={!a.nome_imobiliaria.trim()} />
        <Linha rotulo="Tom" valor={ou(a.tom, 'o da casa')} apagado={!a.tom.trim()} />
        <Linha rotulo="Áudio" valor={a.audio_enabled ? 'responde áudio com áudio' : 'só texto'} />
        <Linha rotulo="Quem ela é" valor={ou(a.persona_role, 'em branco')} apagado={!a.persona_role.trim()} />
        <Linha rotulo="Objetivo" valor={ou(a.persona_goal, 'em branco')} apagado={!a.persona_goal.trim()} />
        <Linha rotulo="Instruções" valor={a.instructions.trim() ? a.instructions.trim() : 'montadas a partir do que você contou'} apagado={!a.instructions.trim()} />
        <Linha rotulo="Primeira mensagem" valor={ou(a.greeting, 'a IA abre sozinha')} apagado={!a.greeting.trim()} />
        <Linha rotulo="Prova social" valor={ou(a.prova_social, 'nenhuma')} apagado={!a.prova_social.trim()} />
      </Bloco>

      <Bloco indice={1} onEditar={() => irPara(1)}>
        <Linha rotulo="Tipo de venda" valor={tipos.find((t) => t.value === tipoVenda)?.label ?? tipoVenda} apagado={tipoVenda === TIPO_VENDA_PADRAO} />
        <Linha rotulo="Termo" valor={a.termo_imovel.trim().toUpperCase() === termoPadrao ? `${termoPadrao} (padrão do tipo)` : a.termo_imovel.trim().toUpperCase()} apagado={a.termo_imovel.trim().toUpperCase() === termoPadrao} />
        <Linha rotulo="Locação" valor={a.locacao_enabled ? 'trabalha com aluguel' : 'só venda'} />
      </Bloco>

      <Bloco indice={2} onEditar={() => irPara(2)}>
        <Linha rotulo="Moradia ou investimento" valor={INTENCAO_OPCOES.find((o) => o.value === a.intent_question_mode)?.title ?? a.intent_question_mode} />
        {a.intent_question_mode !== 'never' && (
          <Linha rotulo="Como pergunta" valor={ou(a.intent_question, 'redação da casa')} apagado={!a.intent_question.trim()} />
        )}
        <Linha rotulo="Primeiras perguntas" valor={a.perguntas_situacao.filter((p) => p.trim()).length ? a.perguntas_situacao.filter((p) => p.trim()).join('\n') : 'exemplos da casa'} apagado={!a.perguntas_situacao.some((p) => p.trim())} />
        <Linha rotulo="Precisa descobrir" valor={a.qualification_questions.filter((q) => q.trim()).join(' · ') || 'nada'} />
        <Linha rotulo="O que dói" valor={ou(a.dor_tipica, 'exemplo da casa')} apagado={!a.dor_tipica.trim()} />
        <Linha rotulo="Lead pronto" valor={ou(a.lead_pronto, 'exemplo da casa')} apagado={!a.lead_pronto.trim()} />
        <Linha rotulo="Próximo passo" valor={passos.find((p) => p.value === (a.proximo_passo || PROXIMO_PASSO_PADRAO))?.label ?? a.proximo_passo} apagado={(a.proximo_passo || PROXIMO_PASSO_PADRAO) === PROXIMO_PASSO_PADRAO} />
        <Linha rotulo="Visitas" valor={`${[...a.visita_dias].sort().map(nomeDoDia).join(', ') || 'nenhum dia'}, das ${a.visita_inicio} às ${a.visita_fim}`} />
        <Linha rotulo="Objeções" valor={objecoes.length ? objecoes.map((o) => `${o.objecao} → ${o.resposta}`).join('\n') : 'as da casa'} apagado={!objecoes.length} />
      </Bloco>

      <Bloco indice={3} onEditar={() => irPara(3)}>
        <Linha rotulo="Nunca" valor={limites.length ? limites.join(' · ') : 'sem limite marcado'} apagado={!limites.length} />
        <Linha rotulo="Passa na hora" valor={naHora.length ? naHora.join(' · ') : 'nunca'} />
      </Bloco>

      <Bloco indice={4} onEditar={() => irPara(4)}>
        <Linha rotulo="Atuação" valor={a.atuacao_sempre ? '24 horas, todos os dias' : resumoDaJanela(a.atuacao_janelas)} />
        <Linha rotulo="Repasse" valor={`${HANDOFF_OPCOES.find((o) => o.value === a.handoff_mode)?.title ?? a.handoff_mode}${a.handoff_mode === 'temperatura' ? ` (${a.min_temperature === 'warm' ? 'morno ou quente' : 'quente'})` : ''}`} />
        <Linha rotulo="Lead sumiu" valor={
          !a.followup_enabled ? 'não vai atrás' : (
            <>
              {FOLLOWUP_OPCOES.find((o) => o.value === a.followup_action)?.title}, depois de {a.followup_min_days} a {a.followup_max_days} dias
              {a.followup_action === 'ai' ? `, no máximo ${a.followup_max_attempts} vezes` : ''}
              {a.followup_action === 'pipeline' ? ` · coluna: ${nome(stages, a.followup_stage_id, 'não escolhida')} · volta para: ${nome(stages, a.followup_return_stage_id, 'primeira coluna')}` : ''}
              {a.followup_action === 'sequence' ? ` · funil: ${nome(funis, a.followup_sequence_slug, 'não escolhido')}` : ''}
              {`\nPode sair ${resumoDaJanela(a.followup_janelas)}`}
            </>
          )
        } apagado={!a.followup_enabled} />
        <Linha rotulo="Move o card" valor={
          !a.pipeline_move_enabled ? 'não' : (
            `${nome(pipelines, a.pipeline_id, 'funil não escolhido')}${mapa.length ? ': ' + mapa.map((m) => `${m.titulo} → ${nome(stages, a.pipeline_stage_map[m.key], '?')}`).join(' · ') : ' (nenhum momento mapeado)'}`
          )
        } apagado={!a.pipeline_move_enabled} />
      </Bloco>
    </div>
  );
}
