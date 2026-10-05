import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/ds';
import { type SalesAgent, type SalesAgentHandoffTarget } from '@/services/salesAgents/salesAgentsService';
import agentsService from '@/services/channels/agentsService';
import { roletaConfigService } from '@/services/roletaConfig/roletaConfigService';
import { Seletor } from '@/components/base/Seletor';

/**
 * PARA QUEM ela passa o lead — a outra metade da pergunta que o cenário acima
 * responde pela primeira vez.
 *
 * Até aqui a IA não escolhia nada: ela jogava o lead na roleta DO NÚMERO em que
 * a conversa estava, e ponto. Número sem roleta, roleta em modo manual, roleta
 * fora do horário, ou duas roletas no mesmo número sem nenhuma marcada como
 * "atende quem escreve direto": em todos o lead ficava sem dono, com a etiqueta
 * de atendimento humano, e ninguém era avisado. A landing e o formulário do Meta
 * escolhem a roleta na tela deles desde sempre — só a IA não escolhia.
 *
 * "A roleta deste número" é o primeiro e continua marcado em toda imobiliária
 * que já existe: escolha nova não muda o comportamento de quem nunca escolheu.
 */
const HANDOFF_TARGETS: { value: SalesAgentHandoffTarget; title: string; desc: string }[] = [
  {
    value: 'inbox_roleta',
    title: 'A roleta deste número',
    desc: 'É o que já estava valendo. Vale a roleta do WhatsApp em que a IA atende.',
  },
  {
    value: 'roleta',
    title: 'Uma roleta específica',
    desc: 'Para quando a IA atende num número e os corretores atendem em outros. A roleta sorteia, oferta e o lead vira de quem aceitar.',
  },
  {
    value: 'user',
    title: 'Um corretor fixo',
    desc: 'Sem roleta: o lead vai sempre para a mesma pessoa. Ela recebe o aviso com o botão de aceitar, e o lead é dela quando aceitar.',
  },
];

export function HandoffDestinationSection({ agent, onSave }: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [roletas, setRoletas] = useState<{ id: string; label: string; ativa: boolean }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; name: string }[]>([]);

  const modo: SalesAgentHandoffTarget = agent.handoff_target ?? 'inbox_roleta';
  const roletaId = agent.handoff_roleta_config_id ?? '';
  const userId = agent.handoff_user_id ?? '';

  // Leitura de FUNDO: cargo sem acesso a roletas ou à equipe só não vê aquele
  // seletor — a seção continua inteira, e nada pinta de vermelho.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const rs = await roletaConfigService.getAll();
        if (!vivo) return;
        setRoletas((rs || []).map((r) => ({
          id: String(r.id),
          label: r.display_name || r.name || r.inbox_name || 'Roleta sem nome',
          ativa: r.is_active !== false,
        })));
      } catch {
        /* leitura de fundo não grita */
      }
      try {
        const us = await agentsService.getAll();
        if (!vivo) return;
        setPessoas((us || []).map((u) => ({ id: String(u.id), name: u.name || u.email || 'Sem nome' })));
      } catch {
        /* leitura de fundo não grita */
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Trocar de modo LIMPA o alvo do outro, de propósito: alvo gravado por baixo
  // do modo que não o usa é a segunda verdade sobre quem recebe o lead — e a
  // primeira leitura torta entregaria para quem o gestor acha que tirou da
  // jogada. O servidor faz a mesma limpeza; aqui é para a tela não mentir.
  const trocarModo = (value: SalesAgentHandoffTarget) => {
    if (value === modo) return;
    onSave({
      handoff_target: value,
      handoff_roleta_config_id: value === 'roleta' ? (roletaId || null) : null,
      handoff_user_id: value === 'user' ? (userId || null) : null,
    });
  };

  // A roleta escolhida continua na lista mesmo desativada ou apagada: sumir com
  // ela faria o próximo salvamento apagar a escolha do gestor, calado. Mesma
  // doutrina do Destino do lead da landing.
  const roletasVisiveis = roletas.filter((r) => r.ativa || r.id === roletaId);
  const escolhidaSumiu = roletaId !== '' && !roletas.some((r) => r.id === roletaId);
  const escolhidaDesativada = roletas.some((r) => r.id === roletaId && !r.ativa);

  return (
    <div>
      <div className="text-sm font-medium mb-1">Para quem ela passa o lead</div>
      <div className="text-xs text-muted-foreground mb-2">
        Quem recebe o lead quando a IA sai de cena. Se ele já tiver responsável, continua com ele — e a
        pessoa é avisada de que o atendimento passou a ser dela.
      </div>

      <div className="space-y-2">
        {HANDOFF_TARGETS.map((opt) => {
          const escolhido = modo === opt.value;
          return (
            <div
              key={opt.value}
              className={`rounded-md border p-3 transition-colors ${escolhido ? 'border-primary bg-primary/5' : 'border-sidebar-border'}`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="handoff_target"
                  className="mt-1"
                  checked={escolhido}
                  onChange={() => trocarModo(opt.value)}
                />
                <div>
                  <div className="text-sm font-medium">{opt.title}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>

              {opt.value === 'roleta' && escolhido && (
                <div className="mt-2 ml-7">
                  <Label htmlFor="handoff_roleta">Qual roleta</Label>
                  <Seletor
                    id="handoff_roleta"
                    value={roletaId}
                    onChange={(e) => onSave({ handoff_roleta_config_id: e.target.value || null })}
                    className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— escolha a roleta —</option>
                    {roletasVisiveis.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}{r.ativa ? '' : ' (desativada)'}</option>
                    ))}
                  </Seletor>
                  {/* Sem este aviso o gestor sai da tela achando que escolheu, e
                      todo lead que a IA passar fica sem ninguém. */}
                  {roletaId === '' && (
                    <p className="text-xs text-amber-600 mt-1">
                      Enquanto nenhuma roleta estiver escolhida, o lead que a IA passar fica sem
                      responsável — e a gestão recebe um aviso a cada vez.
                    </p>
                  )}
                  {escolhidaDesativada && (
                    <p className="text-xs text-amber-600 mt-1">
                      Esta roleta está desativada. Enquanto ela estiver assim, o lead fica sem responsável.
                    </p>
                  )}
                  {escolhidaSumiu && (
                    <p className="text-xs text-amber-600 mt-1">
                      A roleta escolhida não aparece mais na lista. Escolha outra, ou o lead fica sem responsável.
                    </p>
                  )}
                </div>
              )}

              {opt.value === 'user' && escolhido && (
                <div className="mt-2 ml-7">
                  <Label htmlFor="handoff_user">Qual corretor</Label>
                  <Seletor
                    id="handoff_user"
                    value={userId}
                    onChange={(e) => onSave({ handoff_user_id: e.target.value || null })}
                    className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— escolha o corretor —</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Seletor>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ele recebe o lead no WhatsApp e no app, com o botão de aceitar, e <strong>sem prazo</strong>:
                    a oferta fica com ele até aceitar ou recusar. Não há para quem repassar.
                  </p>
                  {userId === '' && (
                    <p className="text-xs text-amber-600 mt-1">
                      Enquanto ninguém estiver escolhido, o lead que a IA passar fica sem responsável.
                    </p>
                  )}
                </div>
              )}

              {opt.value === 'inbox_roleta' && escolhido && (
                <p className="text-xs text-muted-foreground mt-2 ml-7">
                  Se este número não tiver uma roleta ativa, o lead entra sem responsável e a gestão é
                  avisada com o motivo.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
