import { describe, it, expect } from 'vitest';
import { destinoTravado, instanciaDoModo, modoDoNumero, CENTRAL_DA_LEAL } from './destinoDoGrupo';

describe('destino do Avisar no grupo na tela do cliente', () => {
  it('só nome da central é a central; vazio ou outro número é o WhatsApp deste CRM', () => {
    expect(modoDoNumero('')).toBe('proprio');
    expect(modoDoNumero(undefined)).toBe('proprio');
    expect(modoDoNumero(CENTRAL_DA_LEAL)).toBe('central');
    expect(modoDoNumero('Nova Instancia')).toBe('central');
    expect(modoDoNumero(' Operacional (LM01) ')).toBe('central');
    // número do próprio cliente que a equipe escolheu
    expect(modoDoNumero('lmf_apto_01')).toBe('proprio');
    expect(instanciaDoModo('central')).toBe(CENTRAL_DA_LEAL);
    expect(instanciaDoModo('proprio')).toBe('');
  });

  const base = {
    modo: 'central' as const, grupos: [{ id: '9@g.us' }], numerosDeUsuarios: ['5511999990000'], ehEquipe: false, carregando: false,
  };

  it('destino gravado fora do que o cliente vê fica travado', () => {
    expect(destinoTravado({ ...base, destino: '8@g.us' })).toBe(true);
  });

  it('não trava: grupo visível, usuário do CRM, vazio, equipe da Leal ou lista carregando', () => {
    expect(destinoTravado({ ...base, destino: '9@g.us' })).toBe(false);
    expect(destinoTravado({ ...base, destino: '5511999990000' })).toBe(false);
    expect(destinoTravado({ ...base, destino: '' })).toBe(false);
    expect(destinoTravado({ ...base, destino: '8@g.us', ehEquipe: true })).toBe(false);
    expect(destinoTravado({ ...base, destino: '8@g.us', carregando: true })).toBe(false);
  });

  it('pelo número próprio nunca trava (grupo do cliente pode não vir na lista filtrada)', () => {
    expect(destinoTravado({ ...base, modo: 'proprio', destino: '8@g.us' })).toBe(false);
  });
});
