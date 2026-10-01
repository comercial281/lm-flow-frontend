import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * O Modo Cliente saiu (01/10/2026). Quem estava nele tem a chave
 * `lm_client_mode` salva no navegador. Antes, essa chave trocava o cliente de
 * TODA requisição do app. Sem a barra do Modo Cliente, a pessoa ficaria presa
 * dentro de um cliente sem saber. Este spec garante que a chave velha não manda
 * em mais nada.
 */
describe('tenant sem Modo Cliente', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('ignora o lm_client_mode salvo e usa o cliente do endereço', async () => {
    localStorage.setItem('x-tenant', 'minha');
    localStorage.setItem(
      'lm_client_mode',
      JSON.stringify({ tenant: { id: '1', slug: 'outro', schema: 'outro', name: 'Outro' }, token: 'tok-do-cliente' }),
    );

    const { getTenantSlug } = await import('./tenant');

    expect(getTenantSlug()).toBe('minha');
  });
});
