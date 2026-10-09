import { describe, expect, it } from 'vitest';
import { accessStatus } from './accessStatus';

// Datas locais, para o teste não depender do fuso da máquina.
const agora = new Date(2026, 9, 9, 12, 0);
const iso = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo, d, h, mi).toISOString();

describe('accessStatus', () => {
  it('desativado é Inativo, mesmo que tenha entrado um dia', () => {
    expect(accessStatus({ deactivated: true, last_seen_at: iso(2026, 9, 9, 10, 0) }, agora))
      .toEqual({ label: 'Inativo', detail: '', tone: 'off' });
  });

  it('entrou hoje mostra a hora', () => {
    expect(accessStatus({ last_seen_at: iso(2026, 9, 9, 10, 40) }, agora))
      .toEqual({ label: 'Ativo', detail: 'Entrou hoje, 10:40', tone: 'ok' });
  });

  it('entrou ontem conta pelo dia do calendário, não por 24h', () => {
    expect(accessStatus({ last_seen_at: iso(2026, 9, 8, 23, 59) }, new Date(2026, 9, 9, 0, 5)).detail)
      .toBe('Ontem, 23:59');
    expect(accessStatus({ last_seen_at: iso(2026, 9, 8, 18, 2) }, agora).detail).toBe('Ontem, 18:02');
  });

  it('entrou há mais de um dia mostra quantos', () => {
    expect(accessStatus({ last_seen_at: iso(2026, 9, 6, 9, 0) }, agora).detail).toBe('Há 3 dias');
  });

  it('link ainda válido e sem entrada: Link enviado com a hora limite', () => {
    expect(accessStatus({ access_link_until: iso(2026, 9, 9, 18, 30) }, agora))
      .toEqual({ label: 'Link enviado', detail: 'Ainda não entrou · vale até 18:30', tone: 'warn' });
  });

  it('quem já entrou ignora o link pendente', () => {
    expect(accessStatus({ last_seen_at: iso(2026, 9, 9, 9, 0), access_link_until: iso(2026, 9, 9, 18, 30) }, agora).label)
      .toBe('Ativo');
  });

  it('link vencido sem entrada pede link novo', () => {
    expect(accessStatus({ access_link_until: iso(2026, 9, 9, 8, 0) }, agora).label).toBe('Link expirou');
  });

  it('nada: nunca recebeu acesso', () => {
    expect(accessStatus({}, agora)).toEqual({ label: 'Nunca recebeu acesso', detail: '', tone: 'warn' });
  });
});
