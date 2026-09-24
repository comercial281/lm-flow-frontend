import { describe, expect, it } from 'vitest';
import {
  LEAD_DESTINATION_NEEDS_RESPONSIBLE,
  leadDestinationBlocksSave,
  leadDestinationWarning,
} from './leadDestination';

describe('leadDestination', () => {
  it('não avisa nada com a chave desligada, mesmo sem responsável', () => {
    // O caso dos outros 895 imóveis: o campo *Corretor responsável* pode estar
    // vazio há meses e isso nunca foi problema.
    expect(leadDestinationWarning({ lead_goes_to_responsible: false })).toBeNull();
    expect(leadDestinationWarning({})).toBeNull();
    expect(leadDestinationBlocksSave({ responsible_id: null })).toBe(false);
  });

  it('avisa quando a chave está ligada e não há responsável', () => {
    // O servidor RECUSA o cadastro inteiro assim. Descobrir isso no clique de
    // *Salvar* transformaria um deslize em erro na cara de quem cadastrou.
    expect(leadDestinationWarning({ lead_goes_to_responsible: true }))
      .toBe(LEAD_DESTINATION_NEEDS_RESPONSIBLE);
    expect(leadDestinationWarning({ lead_goes_to_responsible: true, responsible_id: null }))
      .toBe(LEAD_DESTINATION_NEEDS_RESPONSIBLE);
    expect(leadDestinationBlocksSave({ lead_goes_to_responsible: true, responsible_id: '   ' }))
      .toBe(true);
  });

  it('libera com a chave ligada e responsável escolhido', () => {
    expect(leadDestinationWarning({ lead_goes_to_responsible: true, responsible_id: 'u-1' }))
      .toBeNull();
    expect(leadDestinationBlocksSave({ lead_goes_to_responsible: true, responsible_id: 'u-1' }))
      .toBe(false);
  });
});
