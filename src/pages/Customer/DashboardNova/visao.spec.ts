// src/pages/Customer/DashboardNova/visao.spec.ts
import { describe, it, expect } from 'vitest';
import { deQuemSaoOsNumeros, modoDeVolta, recorteBateComDestino, rotuloDaVolta } from './visao';
import type { FiltrosDashboard, ScopeInfoNova } from './types';

type Modo = 'mine' | 'team' | 'all';
const escopo = (mode: Modo, over: Partial<ScopeInfoNova> = {}): ScopeInfoNova => ({
  mode, locked: false, available_modes: ['mine', 'team', 'all'], owner_id: null,
  blocks: { media_spend: false, operations: false }, ...over,
});
const semFiltro: FiltrosDashboard = { preset: 'last_7_days' };

describe('recorteBateComDestino', () => {
  it('a imobiliária inteira sem filtro: a tela de destino mostra o mesmo recorte', () => {
    expect(recorteBateComDestino(escopo('all'), semFiltro)).toBe(true);
  });

  it('o funil escolhido e o período não contam: o link leva os dois', () => {
    expect(recorteBateComDestino(escopo('all'), { preset: 'this_month', pipelineId: 'p1', scope: 'all' })).toBe(true);
  });

  it('o corretor travado: o destino já recorta por ele', () => {
    expect(recorteBateComDestino(escopo('mine', { locked: true, available_modes: ['mine'] }), semFiltro)).toBe(true);
  });

  it('"Meu time" e "Só os meus" destravado: o destino mostraria a casa inteira', () => {
    expect(recorteBateComDestino(escopo('team'), semFiltro)).toBe(false);
    expect(recorteBateComDestino(escopo('mine'), semFiltro)).toBe(false);
  });

  it('qualquer filtro do painel tira o link, mesmo na imobiliária inteira', () => {
    const filtros: FiltrosDashboard[] = [
      { ...semFiltro, ownerId: 'u1' },
      { ...semFiltro, inboxId: 'i1' },
      { ...semFiltro, labelId: 'l1' },
      { ...semFiltro, aiOnly: true },
      { ...semFiltro, salesAgentId: 's1' },
    ];
    filtros.forEach(f => expect(recorteBateComDestino(escopo('all'), f)).toBe(false));
  });

  it('corretor escolhido que o servidor aplicou também conta', () => {
    expect(recorteBateComDestino(escopo('all', { owner_id: 'u1' }), semFiltro)).toBe(false);
  });

  it('o corretor travado com Número ou Etiqueta: o destino não filtra por eles', () => {
    const travado = escopo('mine', { locked: true, available_modes: ['mine'] });
    expect(recorteBateComDestino(travado, { ...semFiltro, labelId: 'l1' })).toBe(false);
  });

  it('sem resposta ainda, nada vira link', () => {
    expect(recorteBateComDestino(undefined, semFiltro)).toBe(false);
  });
});

describe('deQuemSaoOsNumeros', () => {
  it('diz de quem são os números pelo recorte que o servidor aplicou', () => {
    expect(deQuemSaoOsNumeros(escopo('all'))).toBe('A imobiliária');
    expect(deQuemSaoOsNumeros(escopo('team'))).toBe('Meu time');
    expect(deQuemSaoOsNumeros(escopo('mine'))).toBe('Seus números');
  });

  it('com um corretor escolhido, o nome dele; sem o nome, "Um corretor"', () => {
    expect(deQuemSaoOsNumeros(escopo('all', { owner_id: 'u1' }), 'Ana Souza')).toBe('Ana Souza');
    expect(deQuemSaoOsNumeros(escopo('team', { owner_id: 'u1' }))).toBe('Um corretor');
  });
});

describe('volta de "Só os meus"', () => {
  it('quem pode ver a imobiliária volta para ela', () => {
    const s = escopo('mine');
    expect(modoDeVolta(s)).toBe('all');
    expect(rotuloDaVolta('all')).toBe('Voltar para a imobiliária');
  });

  it('o gerente volta para o time dele, e o botão diz isso', () => {
    const s = escopo('mine', { available_modes: ['mine', 'team'] });
    expect(modoDeVolta(s)).toBe('team');
    expect(rotuloDaVolta('team')).toBe('Voltar para o meu time');
  });

  it('sem outro modo, não há para onde voltar', () => {
    expect(modoDeVolta(escopo('mine', { available_modes: ['mine'] }))).toBeNull();
    expect(modoDeVolta(undefined)).toBeNull();
  });
});
