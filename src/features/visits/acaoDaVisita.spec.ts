// src/features/visits/acaoDaVisita.spec.ts
import { describe, it, expect } from 'vitest';
import { acaoDaVisita, temRetorno } from './acaoDaVisita';

const AGORA = new Date('2026-09-30T12:00:00Z');
const ONTEM = '2026-09-29T12:00:00Z';
const AMANHA = '2026-10-01T12:00:00Z';

const visita = (status: string, scheduled_at = ONTEM, extra: Record<string, unknown> = {}) =>
  ({ status, scheduled_at, ...extra }) as Parameters<typeof acaoDaVisita>[0];

describe('acaoDaVisita: clique na Agenda', () => {
  it('Realizada abre Dar retorno (antes só mostrava o aviso "Visita Realizada")', () => {
    expect(acaoDaVisita(visita('completed'), 'clique', AGORA)).toBe('retorno');
  });

  it('Agendada, Confirmada e Em andamento abrem o resumo (Confirmar / Realizada / Cancelar), passada ou futura', () => {
    for (const s of ['scheduled', 'confirmed', 'in_progress']) {
      expect(acaoDaVisita(visita(s, ONTEM), 'clique', AGORA)).toBe('resumo');
      expect(acaoDaVisita(visita(s, AMANHA), 'clique', AGORA)).toBe('resumo');
    }
  });

  it('Cancelada, Não compareceu e Reagendada continuam só com o aviso', () => {
    for (const s of ['cancelled', 'no_show', 'rescheduled']) {
      expect(acaoDaVisita(visita(s), 'clique', AGORA)).toBeNull();
    }
  });
});

describe('acaoDaVisita: link ?visita= da Dashboard', () => {
  it('Realizada abre Dar retorno', () => {
    expect(acaoDaVisita(visita('completed'), 'link', AGORA)).toBe('retorno');
  });

  it('Agendada/Confirmada que já passou abre o diálogo de realizada', () => {
    expect(acaoDaVisita(visita('scheduled', ONTEM), 'link', AGORA)).toBe('complete');
    expect(acaoDaVisita(visita('confirmed', ONTEM), 'link', AGORA)).toBe('complete');
  });

  it('visita futura só é mostrada: nunca grava realização por link', () => {
    expect(acaoDaVisita(visita('scheduled', AMANHA), 'link', AGORA)).toBeNull();
    expect(acaoDaVisita(visita('confirmed', AMANHA), 'link', AGORA)).toBeNull();
  });

  it('Em andamento, Cancelada, Não compareceu e Reagendada só são mostradas', () => {
    for (const s of ['in_progress', 'cancelled', 'no_show', 'rescheduled']) {
      expect(acaoDaVisita(visita(s, ONTEM), 'link', AGORA)).toBeNull();
    }
  });
});

describe('temRetorno', () => {
  it('sem nota e sem comentário, falta o retorno', () => {
    expect(temRetorno({ rating: null, feedback_notes: undefined })).toBe(false);
    expect(temRetorno({ rating: 0, feedback_notes: '   ' })).toBe(false);
  });

  it('nota ou comentário bastam', () => {
    expect(temRetorno({ rating: 4 })).toBe(true);
    expect(temRetorno({ rating: null, feedback_notes: 'Gostou da varanda' })).toBe(true);
  });
});
