// src/pages/SuperAdmin/comunicadoRegras.spec.ts
import { describe, it, expect } from 'vitest';
import type { ComunicadoAndamento } from '@/services/superAdmin/comunicadoService';
import { pedidoDeEnvio, personalizar, textoDoAndamento } from './comunicadoRegras';

const andamento = (extra: Partial<ComunicadoAndamento>): ComunicadoAndamento => ({
  id: 'c1', state: 'running', mode: 'owners', instance: 'LM01', message: '', by: '', started_at: '', finished_at: null,
  total: 28, sent: 10, failed: 2,
  items: [{ tenant_id: 't', name: 'Sem Fone', destination: null, status: 'skipped', detail: 'Sem telefone' }],
  ...extra,
});

describe('Comunicado: regras da tela', () => {
  it('personalizar faz a mesma troca do servidor: primeiro nome, e a quebra de linha fica', () => {
    expect(personalizar('Oi, {nome}!\n\nE {{nome}}  de novo', 'Moeda Forte')).toBe('Oi, Moeda!\n\nE Moeda de novo');
  });

  it('a confirmação diz o N e o destino, com plural certo', () => {
    expect(pedidoDeEnvio('owners', 28, 'LM01').titulo).toBe('Mandar para 28 donos?');
    expect(pedidoDeEnvio('groups', 25, 'LM01').titulo).toBe('Mandar para 25 grupos?');
    expect(pedidoDeEnvio('owners', 1, 'LM01').titulo).toBe('Mandar para 1 dono?');
    expect(pedidoDeEnvio('groups', 1, 'LM01').descricao).toContain('LM01');
  });

  it('andamento: enviando, terminado e interrompido', () => {
    expect(textoDoAndamento(andamento({}))).toBe('Enviando 12 de 28…');
    expect(textoDoAndamento(andamento({ state: 'done', sent: 1, failed: 0, items: [] }))).toBe('Terminou: 1 cliente recebeu.');
    expect(textoDoAndamento(andamento({ state: 'interrupted' })))
      .toBe('O envio parou no meio: 10 clientes receberam · 2 falharam · 1 ficou de fora.');
  });
});
