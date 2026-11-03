import { describe, expect, it } from 'vitest';
import { fraseDaIntencao } from './intencao';

const origem = 'deste imóvel';

describe('fraseDaIntencao', () => {
  it('sem nada marcado vale o padrão da IA', () => {
    expect(fraseDaIntencao([], origem)).toEqual({ texto: 'Sem nada marcado: vale o padrão da IA.', curto: '' });
  });

  it('só Investimento: não pergunta e trata todo lead como Investimento', () => {
    const f = fraseDaIntencao(['investimento'], origem);
    expect(f.texto).toBe('Não pergunta a intenção. Todo lead deste imóvel é tratado como Investimento.');
    expect(f.curto).toBe('não pergunta; trata como Investimento');
  });

  it('os 4: pergunta só morar ou investir, nunca o menu, e cruza antes de perguntar', () => {
    const f = fraseDaIntencao(['moradia', 'investimento', 'primeiro_imovel', 'troca'], origem);
    expect(f.texto).toContain('Se nada responder antes, pergunta só: morar ou investir?');
    expect(f.texto).toContain('Nunca o menu com as 4 opções.');
    expect(f.texto).toContain('primeiro imóvel ou troca de imóvel');
    expect(f.texto.endsWith('Antes de qualquer pergunta, ela cruza a campanha, o formulário, o que o fluxo já perguntou e o que a pessoa disse.')).toBe(true);
    expect(f.curto).toBe('se nada responder antes, só "morar ou investir?"');
  });

  it('sem Investimento: não pergunta morar ou investir', () => {
    const f = fraseDaIntencao(['moradia', 'primeiro_imovel'], origem);
    expect(f.texto.startsWith('Não pergunta morar ou investir.')).toBe(true);
    expect(f.texto).toContain('o primeiro imóvel');
    expect(f.texto.endsWith('o que a pessoa disse.')).toBe(true);
  });

  it('Moradia e Investimento: sem o menu das 4 e sem a parte do primeiro imóvel', () => {
    const f = fraseDaIntencao(['moradia', 'investimento'], origem);
    expect(f.texto).toContain('Se nada responder antes, pergunta só: morar ou investir?');
    expect(f.texto).not.toContain('Nunca o menu');
    expect(f.texto).not.toContain('Se for morar');
  });

  it('um caminho só que não é Investimento usa o nome dele', () => {
    expect(fraseDaIntencao(['troca'], 'desta IA').texto).toBe('Não pergunta a intenção. Todo lead desta IA é tratado como Trocar de imóvel.');
  });

  it('nenhuma frase tem travessão', () => {
    (['investimento', 'moradia'] as const).forEach((k) => expect(fraseDaIntencao([k], origem).texto).not.toMatch(/[—–]/));
    expect(fraseDaIntencao(['moradia', 'investimento', 'troca'], origem).texto).not.toMatch(/[—–]/);
  });
});
