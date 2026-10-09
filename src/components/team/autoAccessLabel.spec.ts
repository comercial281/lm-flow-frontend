import { describe, expect, it } from 'vitest';
import { autoAccessLabel } from './autoAccessLabel';

describe('autoAccessLabel', () => {
  it('conta os leads no singular e no plural', () => {
    expect(autoAccessLabel({ reason: 'leads', leads: 1 })).toBe('é responsável por 1 lead daqui');
    expect(autoAccessLabel({ reason: 'leads', leads: 2 })).toBe('é responsável por 2 leads daqui');
  });
  it('explica a roleta e o lead sem número', () => {
    expect(autoAccessLabel({ reason: 'roleta', leads: 0 })).toMatch(/roleta/);
    expect(autoAccessLabel({ reason: 'lead_sem_canal', leads: 0 })).toMatch(/não entrou por número/);
  });
  it('sem detalhe, diz que o sistema liberou', () => {
    expect(autoAccessLabel(undefined)).toBe('liberado pelo sistema');
  });
});
