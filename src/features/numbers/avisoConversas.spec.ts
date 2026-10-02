import { describe, it, expect } from 'vitest';
import {
  SEM_NUMERO_CORRETOR, avisoListaVazia, enderecoConexao, faixaReconectar, fraseForaDoAr, numerosParaReconectar,
  tituloForaDoAr, type NumeroDaConversa,
} from './avisoConversas';

// A caixa de Conversas vazia dizia "Não há conversas disponíveis no momento"
// para quem nem tinha número conectado — indistinguível de tela quebrada.

const numero = (over: Partial<NumeroDaConversa> = {}): NumeroDaConversa => ({
  id: '1', name: 'WhatsApp da Ana', connection_status: 'connected', owner_user_id: null, ...over,
});

describe('avisoListaVazia — o que a lista vazia mostra', () => {
  it('sem resposta do servidor (ou cargo que não lê números), não arrisca nada', () => {
    expect(avisoListaVazia({ numeros: null, gestor: false, podeCriar: false })).toBeNull();
  });

  it('corretor sem número: pede ao gestor, sem botão', () => {
    expect(avisoListaVazia({ numeros: [], gestor: false, podeCriar: true })).toEqual({
      tipo: 'semNumero', gestor: false, podeCriar: false,
    });
  });

  it('gestor sem número: botão de conectar só se ele pode criar', () => {
    expect(avisoListaVazia({ numeros: [], gestor: true, podeCriar: true })).toEqual({
      tipo: 'semNumero', gestor: true, podeCriar: true,
    });
    expect(avisoListaVazia({ numeros: [], gestor: true, podeCriar: false })).toEqual({
      tipo: 'semNumero', gestor: true, podeCriar: false,
    });
  });

  it('número criado e nunca pareado (o servidor manda "disconnected"): falta ler o QR', () => {
    expect(avisoListaVazia({ numeros: [numero({ connection_status: 'disconnected' })], gestor: false, podeCriar: false }))
      .toEqual({ tipo: 'foraDoAr', numeros: [{ id: '1', nome: 'WhatsApp da Ana' }] });
  });

  it('"conectando" também não recebe mensagem', () => {
    const r = avisoListaVazia({ numeros: [numero({ connection_status: 'connecting' })], gestor: false, podeCriar: false });
    expect(r?.tipo).toBe('foraDoAr');
  });

  it('número no ar e lista vazia: segue o texto de sempre (só não chegou ninguém)', () => {
    expect(avisoListaVazia({ numeros: [numero()], gestor: false, podeCriar: false })).toBeNull();
  });

  it('canal sem sessão (status nulo) não tem o que cair: conta como no ar', () => {
    expect(avisoListaVazia({ numeros: [numero({ connection_status: null })], gestor: true, podeCriar: true })).toBeNull();
  });

  it('lista só os números fora do ar', () => {
    const r = avisoListaVazia({
      numeros: [numero(), numero({ id: '2', name: 'Loja', connection_status: 'disconnected' })],
      gestor: true,
      podeCriar: true,
    });
    expect(r).toEqual({ tipo: 'foraDoAr', numeros: [{ id: '2', nome: 'Loja' }] });
  });
});

describe('numerosParaReconectar — a faixa em cima da lista com conversas', () => {
  const caido = numero({ id: '7', name: 'Loja', connection_status: 'disconnected', owner_user_id: '42' });

  it('corretor: todo número dele que caiu', () => {
    expect(numerosParaReconectar({ numeros: [numero(), caido], gestor: false, meuId: '1' }))
      .toEqual([{ id: '7', nome: 'Loja' }]);
  });

  it('gestor: só o número de que ele é dono — o resto chega pelo sininho', () => {
    expect(numerosParaReconectar({ numeros: [caido], gestor: true, meuId: '1' })).toEqual([]);
    expect(numerosParaReconectar({ numeros: [caido], gestor: true, meuId: 42 as unknown as string }))
      .toEqual([{ id: '7', nome: 'Loja' }]);
  });

  it('gestor sem id conhecido não casa com número sem dono', () => {
    expect(numerosParaReconectar({ numeros: [numero({ connection_status: 'disconnected' })], gestor: true, meuId: null }))
      .toEqual([]);
  });

  it('sem lista, sem faixa', () => {
    expect(numerosParaReconectar({ numeros: null, gestor: false, meuId: '1' })).toEqual([]);
  });
});

describe('os textos', () => {
  it('o corretor sem número lê a mesma frase da tela de WhatsApp', () => {
    expect(SEM_NUMERO_CORRETOR.title).toBe('Você ainda não tem um número de WhatsApp');
    expect(SEM_NUMERO_CORRETOR.description).toBe('Peça ao gestor da sua imobiliária para criar o seu.');
  });

  it('um número: diz qual; vários: no plural', () => {
    const um = [{ id: '1', nome: 'Ana' }];
    const dois = [...um, { id: '2', nome: 'Loja' }];
    expect(tituloForaDoAr(um)).toBe('Seu WhatsApp não está conectado');
    expect(tituloForaDoAr(dois)).toBe('Seus números de WhatsApp não estão conectados');
    expect(fraseForaDoAr(um)).toContain('do número Ana');
    expect(faixaReconectar(um)).toBe('O número Ana está desconectado. Mensagens novas só chegam depois de reconectar.');
    expect(faixaReconectar(dois)).toMatch(/^2 números seus estão desconectados/);
  });

  it('nunca fala instância, inbox nem canal', () => {
    const textos = [
      tituloForaDoAr([{ id: '1', nome: 'X' }]), fraseForaDoAr([{ id: '1', nome: 'X' }]),
      faixaReconectar([{ id: '1', nome: 'X' }]), faixaReconectar([{ id: '1', nome: 'X' }, { id: '2', nome: 'Y' }]),
    ].join(' ');
    expect(textos).not.toMatch(/inst[aâ]ncia|inbox|canal/i);
  });

  it('o botão abre a configuração do número na parte da conexão', () => {
    expect(enderecoConexao('9')).toBe('/channels/9/settings?tab=configuration');
  });
});
