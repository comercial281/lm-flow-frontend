import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import type { AssistenteAnswers } from '../assistenteMapping';
import { CampoTexto, Interruptor, LinhaMarcar, Secao } from './Campos';

/**
 * Etapa 1 — Quem é a IA.
 *
 * As respostas sobre a imobiliária (o que vende, tom, diferenciais) não têm
 * campo próprio na IA: alimentam o *Redigir com IA*, que preenche persona,
 * objetivo, instruções e saudação para a pessoa REVISAR nos campos de baixo. Se
 * ninguém redigir, o que foi contado vira as Instruções em prosa simples na hora
 * de gravar — nada se perde.
 */
export default function EtapaQuemE({
  a, set, onRedigir, redigindo,
}: {
  a: AssistenteAnswers;
  set: (patch: Partial<AssistenteAnswers>) => void;
  onRedigir: () => void;
  redigindo: boolean;
}) {
  const temBase = !!(a.nome_imobiliaria.trim() || a.o_que_vende.trim() || a.tom.trim());
  return (
    <div className="space-y-8">
      <Secao titulo="Apresentação" ajuda="Como a IA se chama e por quem ela fala.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoTexto id="as_nome_ia" label="Nome da IA" value={a.nome_ia} onChange={(v) => set({ nome_ia: v })}
            placeholder="Ex: Bia" ajuda="É como ela se apresenta ao lead e como aparece nesta tela." />
          <CampoTexto id="as_imob" label="Nome da imobiliária" value={a.nome_imobiliaria} onChange={(v) => set({ nome_imobiliaria: v })}
            placeholder="Ex: Aurora Imóveis" />
        </div>
        <CampoTexto id="as_vende" label="O que vocês vendem ou alugam, onde e em que faixa" rows={3}
          value={a.o_que_vende} onChange={(v) => set({ o_que_vende: v })}
          placeholder="Ex: apartamentos de 2 e 3 quartos na zona sul de São Paulo, de 350 a 700 mil"
          ajuda="Uma frase basta. É o que a IA usa para entender com quem está falando." />
      </Secao>

      <Secao titulo="Tom de voz" ajuda="Três adjetivos dizem mais do que um parágrafo.">
        <CampoTexto id="as_tom" label="Como a IA fala" value={a.tom} onChange={(v) => set({ tom: v })}
          placeholder="Ex: próxima, direta, sem formalidade" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <LinhaMarcar checked={a.usa_giria} onChange={(v) => set({ usa_giria: v })}
            titulo="Pode usar gíria leve" desc='"opa", "show", "fechou" — com moderação.' />
          <LinhaMarcar checked={a.usa_emoji} onChange={(v) => set({ usa_emoji: v })}
            titulo="Pode usar emoji" desc="Um por mensagem, no máximo." />
        </div>
        <Interruptor id="as_audio" on={a.audio_enabled} onChange={(v) => set({ audio_enabled: v })}
          titulo="Responde em áudio quando o lead manda áudio"
          desc="Ela espelha o lead: áudio com áudio, texto com texto. A voz é escolhida na tela de configuração." />
      </Secao>

      <Secao titulo="O que faz vocês diferentes" ajuda="O que a IA pode usar a favor quando o lead hesita.">
        <CampoTexto id="as_dif" label="Diferenciais" rows={3} value={a.diferenciais} onChange={(v) => set({ diferenciais: v })}
          placeholder="Ex: atendimento no fim de semana, parceria com três bancos, 20 anos na região" />
        <CampoTexto id="as_prova" label="Prova social (opcional)" rows={2} value={a.prova_social} onChange={(v) => set({ prova_social: v })}
          placeholder="Ex: mais de 400 famílias atendidas em 2025; nota 4,9 no Google"
          ajuda="Números e histórias reais. A IA só cita o que estiver aqui." />
      </Secao>

      <Secao
        titulo="Como ela se apresenta"
        ajuda="Os quatro textos que a IA lê antes de qualquer conversa. Escreva, ou peça para a IA redigir a partir do que você contou acima e revise."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRedigir} disabled={redigindo || !temBase}>
            {redigindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {redigindo ? 'Redigindo...' : 'Redigir com IA'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {temBase ? 'Preenche os quatro campos abaixo para você revisar. É uma consulta à IA.' : 'Conte pelo menos o nome, o que vendem ou o tom para liberar.'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoTexto id="as_role" label="Quem ela é" rows={2} value={a.persona_role} onChange={(v) => set({ persona_role: v })}
            placeholder="Ex: Consultora de vendas da Aurora Imóveis" />
          <CampoTexto id="as_goal" label="O objetivo dela" rows={2} value={a.persona_goal} onChange={(v) => set({ persona_goal: v })}
            placeholder="Ex: entender o que o lead procura e marcar a visita" />
        </div>
        <CampoTexto id="as_instr" label="Instruções" rows={6} value={a.instructions} onChange={(v) => set({ instructions: v })}
          placeholder="Regras, contexto e o que ela precisa saber para atender bem. Em branco, o que você contou acima entra aqui em prosa simples." />
        <CampoTexto id="as_greet" label="Primeira mensagem (opcional)" rows={2} value={a.greeting} onChange={(v) => set({ greeting: v })}
          placeholder="Ex: Oi! Sou a Bia, da Aurora. Vi que você se interessou pelo Reserva do Parque 😊"
          ajuda="Em branco, a IA abre sozinha seguindo o roteiro." />
      </Secao>
    </div>
  );
}
