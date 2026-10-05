import { Label } from '@/components/ui/ds';
import { type SalesAgent, type HandoffMode } from '@/services/salesAgents/salesAgentsService';
import { checklistItems, checklistNotices, toggleRequired } from '@/features/salesAgents/handoffChecklist';
import { briefingEnabled, keepBriefing, toggleBriefing } from '@/features/salesAgents/handoffBriefing';
import { speaksAsBroker, toggleVoice } from '@/features/salesAgents/handoffVoice';
import { Seletor } from '@/components/base/Seletor';
import { CheckRow } from '../comum';

// ---------------- Quando ela passa para um corretor ----------------

/**
 * O cenário de repasse: a única coisa que a imobiliária tem para dizer QUANDO a IA
 * entrega o lead a um humano. Até aqui quem decidia era a IA sozinha, a cada resposta.
 *
 * Cartões, e não uma lista suspensa, porque cada opção muda o volume de lead que cai no
 * colo do corretor — a consequência precisa estar visível na hora de escolher, não
 * escondida atrás de um clique.
 *
 * O primeiro cartão é "Como está hoje" e é o que fica marcado em toda imobiliária que já
 * existe: cenário novo não muda o comportamento de quem nunca escolheu nada.
 */
const HANDOFF_OPTIONS: { value: HandoffMode | ''; title: string; desc: string }[] = [
  {
    value: '',
    title: 'Como está hoje',
    desc: 'Ela passa quando julgar necessário. É o que já estava valendo.',
  },
  {
    value: 'duvida',
    title: 'Ao menor sinal de dúvida',
    desc: 'Qualquer insegurança dela vira repasse. O corretor recebe bastante lead, e cedo.',
  },
  {
    value: 'temperatura',
    title: 'Só quando o lead estiver quente',
    desc: 'Ela conduz sozinha — qualifica, manda material, oferece a visita — e só entrega o lead depois que ele esquenta.',
  },
  {
    value: 'checklist',
    title: 'Só depois de arrancar as informações do lead',
    desc: 'Ela conduz até o lead responder as perguntas que você marcar como obrigatórias — e, na resposta da última, ENTREGA o lead na hora, sem oferecer visita. Quem pede a visita ou fala em fechar passa antes disso, mesmo faltando pergunta.',
  },
  {
    value: 'sem_resposta',
    title: 'Só se ela não souber responder',
    desc: 'Repassa quando a resposta não está no que você deu a ela, ou quando as Instruções mandam passar aquele caso.',
  },
  {
    value: 'pos_visita',
    title: 'Só depois de agendar a visita',
    desc: 'O mais autônomo: ela só entrega com a visita marcada, ou quando bate numa objeção que tentou contornar e não conseguiu.',
  },
];

export function HandoffPolicySection({ agent, onSave }: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const cfg = agent.transfer_config ?? {};
  const mode = cfg.mode ?? '';
  const minTemp = cfg.min_temperature ?? 'hot';
  const perguntas = agent.qualification_questions ?? [];
  const obrigatorias = cfg.required_questions;
  const itensChecklist = checklistItems(perguntas, obrigatorias);
  const avisosChecklist = checklistNotices(perguntas, obrigatorias);

  // Trocar de cenário LIMPA o campo do cenário anterior, de propósito: a temperatura
  // mínima e as perguntas obrigatórias só significam alguma coisa dentro do cenário
  // delas, e deixá-las penduradas faria o cartão voltar com uma escolha antiga que
  // ninguém lembra de ter feito.
  //
  // ⚠️ A escolha do RESUMO sobrevive a essa limpeza (keepBriefing): ela não é do
  // cenário nenhum, e apagá-la aqui faria o resumo voltar a sair sozinho depois de
  // o gestor tê-lo desligado, sem nada na tela dizendo isso.
  const pick = (value: HandoffMode | '') => {
    if (value === '') { onSave({ transfer_config: keepBriefing(cfg, {}) }); return; }
    if (value === 'temperatura') {
      onSave({ transfer_config: keepBriefing(cfg, { mode: value, min_temperature: minTemp }) });
      return;
    }
    if (value === 'checklist') {
      onSave({ transfer_config: keepBriefing(cfg, { mode: value, required_questions: obrigatorias ?? [] }) });
      return;
    }
    onSave({ transfer_config: keepBriefing(cfg, { mode: value }) });
  };

  // Desmarcar a ÚLTIMA obrigatória devolve null, porque lista vazia significa o OPOSTO
  // no servidor (todas valem). Quem não quer portão nenhum troca de cenário.
  const toggle = (text: string) => {
    const proximas = toggleRequired(perguntas, obrigatorias, text);
    if (proximas === null) return;
    onSave({ transfer_config: keepBriefing(cfg, { mode: 'checklist', required_questions: proximas }) });
  };

  return (
    <div>
      <div className="text-sm font-medium mb-1">Quando ela passa para um corretor</div>
      <div className="text-xs text-muted-foreground mb-2">
        Escolha um cenário. Ele vale para todos os leads deste atendimento.
      </div>

      <div className="space-y-2">
        {HANDOFF_OPTIONS.map((opt) => {
          const escolhido = mode === opt.value;
          return (
            <div
              key={opt.value || 'padrao'}
              className={`rounded-md border p-3 transition-colors ${escolhido ? 'border-primary bg-primary/5' : 'border-sidebar-border'}`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="handoff_mode"
                  className="mt-1"
                  checked={escolhido}
                  onChange={() => pick(opt.value)}
                />
                <div>
                  <div className="text-sm font-medium">{opt.title}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>

              {/* A partir de que temperatura ela entrega. Só aparece dentro do cartão
                  escolhido: solto, o campo pareceria valer para os outros cenários. */}
              {opt.value === 'temperatura' && escolhido && (
                <div className="mt-2 ml-7">
                  <Label htmlFor="handoff_min_temperature">A partir de</Label>
                  <Seletor
                    id="handoff_min_temperature"
                    value={minTemp}
                    onChange={(e) => onSave({
                      transfer_config: keepBriefing(cfg, {
                        mode: 'temperatura', min_temperature: e.target.value as 'hot' | 'warm',
                      }),
                    })}
                    className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="hot">Lead quente</option>
                    <option value="warm">Lead morno ou quente</option>
                  </Seletor>
                  <p className="text-xs text-muted-foreground mt-1">
                    É a mesma leitura que aparece no painel <em>O que a IA entendeu</em>, dentro da conversa.
                  </p>
                </div>
              )}

              {/* As perguntas que seguram o lead. Só aparecem dentro do cartão escolhido,
                  pelo mesmo motivo da temperatura mínima: soltas, pareceriam valer para
                  os outros cenários. */}
              {opt.value === 'checklist' && escolhido && (
                <div className="mt-2 ml-7">
                  <div className="text-xs font-medium mb-1">Quais perguntas seguram o lead</div>
                  {itensChecklist.length > 0 && (
                    <div className="space-y-1">
                      {itensChecklist.map((item) => (
                        <label
                          key={item.text}
                          className="flex items-start gap-2 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={item.required}
                            onChange={() => toggle(item.text)}
                          />
                          <span>
                            {item.text}
                            {item.orphan && (
                              <span className="ml-1 text-xs text-amber-700 dark:text-amber-500">
                                (fora da sua lista)
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {avisosChecklist.map((aviso) => (
                    <p
                      key={aviso.text}
                      className={`text-xs mt-2 ${
                        aviso.tone === 'amber'
                          ? 'text-amber-700 dark:text-amber-500'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {aviso.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* O que ela descobriu vai COM o lead. Sem isto o corretor recebe nome,
          telefone e prazo, e pergunta orçamento, região e prazo de novo — a IA já
          tinha anotado tudo. Fica fora dos cartões porque não é do cenário
          nenhum: vale em qualquer um deles. */}
      <div className="mt-3 border-t border-sidebar-border pt-3">
        <CheckRow
          checked={briefingEnabled(cfg)}
          onChange={(v) => onSave({ transfer_config: toggleBriefing(cfg, v) })}
          title="Mandar o resumo da conversa junto com o lead"
          desc="No WhatsApp do corretor vão três linhas (temperatura, e o que ela descobriu de orçamento, região e prazo). Na tela de aceite vai a ficha completa, com o resumo da conversa — o mesmo que aparece em O que a IA entendeu."
        />
        {/* A IA no WhatsApp de UM corretor: para o lead ela É esse corretor, então
            "vou te passar pra um colega do time" não faz sentido. Ligada, ela diz
            que vai verificar e já retorna — e é nessa frase que o lead é passado. */}
        <CheckRow
          checked={speaksAsBroker(cfg)}
          onChange={(v) => onSave({ transfer_config: toggleVoice(cfg, v) })}
          title="Ela fala como o próprio corretor deste número"
          desc="Use quando a IA atende no WhatsApp de um corretor. Ela nunca fala em colega, equipe ou “vou te passar”: diz que vai verificar e já retorna (“deixa eu confirmar as opções e já te passo”), e é nesse momento que o lead é passado (para quem estiver escolhido em Para quem ela passa o lead). Se o lead perguntar se está falando com um robô, ela não nega."
        />
      </div>
    </div>
  );
}
