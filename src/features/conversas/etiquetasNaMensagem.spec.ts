import { describe, expect, it } from 'vitest';
import { etiquetasNaMensagem } from './etiquetasNaMensagem';

const et = (id: string, title: string) => ({ id, title, color: '#123456' });

describe('etiquetasNaMensagem', () => {
  it('casa uma etiqueta pelo título e tira do texto', () => {
    const r = etiquetasNaMensagem('Tony adicionou visita-agendada', [et('1', 'visita-agendada')]);
    expect(r.texto).toBe('Tony adicionou');
    expect(r.etiquetas.map(e => e.title)).toEqual(['visita-agendada']);
  });

  it('casa duas etiquetas separadas por vírgula', () => {
    const r = etiquetasNaMensagem('Tony adicionou visita-agendada, demo-0001', [
      et('1', 'visita-agendada'),
      et('2', 'demo-0001'),
    ]);
    expect(r.texto).toBe('Tony adicionou');
    expect(r.etiquetas.map(e => e.title)).toEqual(['visita-agendada', 'demo-0001']);
  });

  it('número solto não casa', () => {
    const r = etiquetasNaMensagem('Atribuído a Ana por Bia 2', [et('2', 'quente'), et('3', 'frio')]);
    expect(r.etiquetas).toEqual([]);
    expect(r.texto).toBe('Atribuído a Ana por Bia 2');
  });

  it('título que é parte de outra palavra casa só a inteira', () => {
    const r = etiquetasNaMensagem('Tony adicionou visita-agendada', [
      et('1', 'visita'),
      et('2', 'visita-agendada'),
    ]);
    expect(r.etiquetas.map(e => e.title)).toEqual(['visita-agendada']);
  });

  it('casa por id (UUID)', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const r = etiquetasNaMensagem(`Tony removeu ${id}`, [et(id, 'quente')]);
    expect(r.texto).toBe('Tony removeu');
    expect(r.etiquetas.map(e => e.title)).toEqual(['quente']);
  });

  it('nome de pessoa igual a etiqueta não vira etiqueta fora de adicionou/removeu', () => {
    const r = etiquetasNaMensagem('Atribuído a Ana por Bia', [et('1', 'Ana'), et('2', 'Bia')]);
    expect(r.etiquetas).toEqual([]);
    expect(r.texto).toBe('Atribuído a Ana por Bia');
  });

  it('mantém a ordem da mensagem', () => {
    const r = etiquetasNaMensagem('Tony adicionou visita-agendada, demo-0001', [
      et('2', 'demo-0001'),
      et('1', 'visita-agendada'),
    ]);
    expect(r.etiquetas.map(e => e.title)).toEqual(['visita-agendada', 'demo-0001']);
    expect(r.texto).toBe('Tony adicionou');
  });

  it('removeu uma etiqueta', () => {
    const r = etiquetasNaMensagem('Tony removeu quente', [et('1', 'quente')]);
    expect(r.texto).toBe('Tony removeu');
    expect(r.etiquetas).toHaveLength(1);
  });

  it('etiqueta desconhecida fica como texto', () => {
    const r = etiquetasNaMensagem('Tony adicionou desconhecida', [et('1', 'quente')]);
    expect(r.texto).toBe('Tony adicionou desconhecida');
    expect(r.etiquetas).toEqual([]);
  });

  it('ignora ponto final na lista', () => {
    const r = etiquetasNaMensagem('Tony adicionou quente.', [et('1', 'quente')]);
    expect(r.texto).toBe('Tony adicionou');
    expect(r.etiquetas).toHaveLength(1);
  });

  it('nome da pessoa igual a etiqueta no começo não é cortado', () => {
    const r = etiquetasNaMensagem('Ana adicionou quente', [et('1', 'Ana'), et('2', 'quente')]);
    expect(r.texto).toBe('Ana adicionou');
    expect(r.etiquetas.map(e => e.title)).toEqual(['quente']);
  });
});
