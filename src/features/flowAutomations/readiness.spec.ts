import { describe, it, expect } from 'vitest';
import { enableProblem, nodeProblem } from './readiness';
import type { FlowNodeKind } from '@/types/flowAutomations';

const b = (kind: FlowNodeKind, config: Record<string, unknown>, label: string | null = null) => ({ kind, config, label });
const gatilho = { event: 'lead.created', conditions: [] };

describe('o fluxo pode ser ligado?', () => {
  it('bloco do modelo com campo em branco recusa, dizendo qual bloco e o que falta', () => {
    const blocos = [
      b('send_whatsapp', { text: 'Oi {{first_name}}', send_from: 'owner' }),
      b('lead_action', { action_type: 'notify_group', params: { message: 'Chegou lead' } }),
    ];
    expect(enableProblem(gatilho, blocos)).toBe('Antes de ligar, complete o bloco "Avisar no grupo": falta preencher o destino do aviso.');
  });

  it('usa o apelido do bloco quando tem', () => {
    expect(enableProblem(gatilho, [b('move_stage', {}, 'Vai pra visita')])).toBe('Antes de ligar, complete o bloco "Vai pra visita": escolha a etapa.');
  });

  it('gatilho sem o que exige também recusa', () => {
    expect(enableProblem({ event: '', conditions: [] }, [])).toBe('Antes de ligar: escolha o gatilho do fluxo.');
  });

  it('tudo preenchido liga', () => {
    expect(enableProblem(gatilho, [
      b('lead_action', { action_type: 'assign_via_roleta', params: {} }),
      b('add_label', { labels: ['tráfego pago'] }),
      b('wait_for_reply', { minutes: 30, indefinite: false }),
    ])).toBeNull();
  });

  it('bloco escondido não trava (continua como estava)', () => {
    expect(nodeProblem(b('http_call', {}))).toBeNull();
    expect(nodeProblem(b('lead_action', { action_type: 'wait', params: {} }))).toBeNull();
  });

  it('etiqueta e mensagem em branco', () => {
    expect(nodeProblem(b('add_label', { labels: [] }))).toBe('Escolha a etiqueta.');
    expect(nodeProblem(b('send_whatsapp', { text: '  ' }))).toBe('Escreva a mensagem.');
  });
});
