import { describe, it, expect } from 'vitest';
import {
  atencaoTexto, diasTexto, faltaParaLigar, horaCurta, horarioTexto,
  numeroDoCorretor, origemTexto, origensEFila, posicaoTexto, prazoFrase, prazoTexto,
} from './roletaNovaTextos';

const membro = (is_active: boolean) => ({ user_id: 'u', weight: 10, is_active, position: 0, personal_whatsapp_number: '' });

describe('textos da roleta nova', () => {
  it('prazo: minutos, horas e sem prazo', () => {
    expect(prazoTexto(10)).toBe('10 min');
    expect(prazoTexto(60)).toBe('1 h');
    expect(prazoTexto(90)).toBe('1 h 30 min');
    expect(prazoTexto(0)).toBe('Sem prazo');
    expect(prazoTexto(null)).toBe('Sem prazo');
    expect(prazoFrase(10)).toBe('10 min pra aceitar');
  });

  it('hora curta e dias da semana', () => {
    expect(horaCurta('08:00')).toBe('8h');
    expect(horaCurta('08:30')).toBe('8h30');
    expect(horaCurta('20:00')).toBe('20h');
    expect(diasTexto([1, 2, 3, 4, 5, 6])).toBe('Seg a Sáb');
    expect(diasTexto([])).toBe('Todos os dias');
    expect(diasTexto([0, 1, 2, 3, 4, 5, 6])).toBe('Todos os dias');
    expect(diasTexto([1, 3, 5])).toBe('Seg, Qua, Sex');
    expect(diasTexto([6, 0])).toBe('Sáb, Dom');
  });

  it('horário da roleta', () => {
    expect(horarioTexto(undefined)).toBe('24 horas');
    expect(horarioTexto({ mode: 'always' })).toBe('24 horas');
    expect(horarioTexto({ mode: 'custom', windows: [{ start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] }] })).toBe('Seg a Sáb, 8h–20h');
    expect(horarioTexto({ mode: 'custom', windows: [] })).toBe('24 horas');
  });

  it('linha do cartão: origens → quem recebe (pausado não conta)', () => {
    expect(origensEFila({ origins_summary: ['Formulários "ZONA SUL", "ZONA OESTE"'], members: [membro(true), membro(true), membro(false)] }))
      .toBe('Formulários "ZONA SUL", "ZONA OESTE" → 2 corretores na fila');
    expect(origensEFila({ origins_summary: [], members: [membro(true)] })).toBe('Sem origem ainda → 1 corretor na fila');
    expect(origensEFila({ members: [] })).toBe('Sem origem ainda → ninguém na fila');
  });

  it('linha de atenção só com algo pra olhar', () => {
    expect(atencaoTexto({ pending_count: 2, exhausted_count_7d: 1 })).toBe('2 esperando aceite · 1 ninguém aceitou');
    expect(atencaoTexto({ pending_count: 0, exhausted_count_7d: 0 })).toBe('');
    expect(atencaoTexto({})).toBe('');
  });

  it('o que falta pra ligar', () => {
    expect(faltaParaLigar(0, 2)).toBe('Falta: uma origem');
    expect(faltaParaLigar(1, 0)).toBe('Falta: um corretor ativo na fila');
    expect(faltaParaLigar(0, 0)).toBe('Falta: uma origem e um corretor ativo na fila');
    expect(faltaParaLigar(1, 1)).toBe('');
  });

  it('posição, número do corretor e origem em frase', () => {
    expect(posicaoTexto(0)).toBe('1º');
    expect(numeroDoCorretor('(11) 97331-3240', 'connected')).toBe('(11) 97331-3240 · conectado');
    expect(numeroDoCorretor('(11) 97331-3240', 'disconnected')).toBe('(11) 97331-3240 · desconectado');
    expect(numeroDoCorretor(null, 'none')).toBe('sem número próprio');
    expect(origemTexto({ kind: 'meta_form', label: '21/08 - ALMA' })).toBe('Formulário do Meta · "21/08 - ALMA"');
    expect(origemTexto({ kind: 'meta_form_keyword', label: 'ALMA' })).toBe('Formulário do Meta · nome contém "ALMA"');
    expect(origemTexto({ kind: 'sales_agent', label: 'Sofia' })).toBe('IA Vendedora · Sofia');
    expect(origemTexto({ kind: 'portal_sale', label: 'ZAP' })).toBe('Portal · ZAP (venda)');
    expect(origemTexto({ kind: 'site_rent', label: 'Site da imobiliária' })).toBe('Site · Site da imobiliária (locação)');
  });

});
