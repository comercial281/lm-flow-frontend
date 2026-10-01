import { describe, it, expect } from 'vitest';
import { tipoFinal, etapaDeGanho, etapaDePerda } from './etapaFinal';

describe('etapa final', () => {
  it('quem manda é o servidor, quando ele diz', () => {
    expect(tipoFinal({ name: 'Fechamento', final: 'won' })).toBe('won');
    expect(tipoFinal({ name: 'Venda', final: null })).toBeNull();
  });

  it('servidor antigo (sem o campo): vale o nome, como os botões sempre fizeram', () => {
    expect(tipoFinal({ name: 'Venda' })).toBe('won');
    expect(tipoFinal({ name: 'Desqualificado' })).toBe('lost');
    expect(tipoFinal({ name: 'Em atendimento' })).toBeNull();
  });

  it('acha a coluna de ganho e a de perda na lista', () => {
    const etapas = [
      { id: '1', name: 'Novo', final: null },
      { id: '2', name: 'Fechamento', final: 'won' as const },
      { id: '3', name: 'Encerrado', final: 'lost' as const },
    ];
    expect(etapaDeGanho(etapas)?.id).toBe('2');
    expect(etapaDePerda(etapas)?.id).toBe('3');
  });

  it('a etapa marcada (Concluída / Cancelada) ganha da que só bate pelo nome', () => {
    const etapas = [
      { id: '1', name: 'Venda', final: 'won' as const, stage_type: 'active' },
      { id: '2', name: 'Perdido', final: 'lost' as const, stage_type: 'active' },
      { id: '3', name: 'Contrato assinado', final: 'won' as const, stage_type: 'completed' },
      { id: '4', name: 'Encerrado', final: 'lost' as const, stage_type: 'cancelled' },
    ];
    expect(etapaDeGanho(etapas)?.id).toBe('3');
    expect(etapaDePerda(etapas)?.id).toBe('4');
  });

  it('sem nenhuma marcada, a primeira pelo final (como antes)', () => {
    const etapas = [
      { id: '1', name: 'Venda', stage_type: 'active' },
      { id: '2', name: 'Fechado', stage_type: 'active' },
      { id: '3', name: 'Perdido' },
    ];
    expect(etapaDeGanho(etapas)?.id).toBe('1');
    expect(etapaDePerda(etapas)?.id).toBe('3');
  });
});
