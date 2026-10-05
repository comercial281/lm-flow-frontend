import { describe, it, expect } from 'vitest';
import { linhasDoProblema } from './formatoAtencao';
import type { ClienteComProblema } from '@/types/admin/overview';

const agora = new Date('2026-10-15T15:00:00Z');
const cliente: ClienteComProblema = { schema: 'tenant_alfa', name: 'Alfa', slug: 'alfa', severity: 'vermelho', problems: [] };

describe('linhasDoProblema', () => {
  it('número caído: uma linha por número, com desde quando', () => {
    const l = linhasDoProblema(
      cliente,
      {
        kind: 'numero_caido',
        severity: 'vermelho',
        numbers: [
          { inbox_id: 1, name: 'Plantão', phone: '5511912341234', since: '2026-10-15T12:00:00Z' },
          { inbox_id: 2, name: 'Vendas', phone: null, since: null },
        ],
      },
      agora,
    );
    expect(l.map((x) => x.texto)).toEqual([
      'Número (11) 91234-1234 (Plantão) caiu há 3 h',
      'Número Vendas está desconectado',
    ]);
    expect(l[0].acao).toEqual({ rotulo: 'Ver números', href: '/admin/clientes/numeros' });
  });

  it('IA falhando leva pra Custos filtrado em só erros', () => {
    const [l] = linhasDoProblema(cliente, { kind: 'ia_falhando', severity: 'vermelho', count: 8 }, agora);
    expect(l.texto).toBe('8 chamadas da IA falharam nas últimas 24 h');
    expect(l.acao.href).toBe('/admin/clientes/custos?tenant=tenant_alfa&so_erros=1');
  });

  it('custo fora do normal mostra o normal; sem média vira "sem histórico"', () => {
    const [a] = linhasDoProblema(
      cliente,
      { kind: 'custo_ia_alto', severity: 'amarelo', last_24h_brl: 48, daily_avg_brl: 9 },
      agora,
    );
    expect(a.texto.replace(/ /g, ' ')).toBe('IA gastou R$ 48,00 nas últimas 24 h (normal: R$ 9,00/dia)');
    expect(a.acao.href).toBe('/admin/clientes/custos?tenant=tenant_alfa');
    const [b] = linhasDoProblema(
      cliente,
      { kind: 'custo_ia_alto', severity: 'amarelo', last_24h_brl: 12, daily_avg_brl: 0 },
      agora,
    );
    expect(b.texto.replace(/ /g, ' ')).toBe('IA gastou R$ 12,00 nas últimas 24 h (sem histórico)');
  });

  it('avisos, chamados e erro na criação', () => {
    expect(linhasDoProblema(cliente, { kind: 'aviso_nao_chega', severity: 'amarelo', people: 1 }, agora)[0]).toEqual({
      texto: '1 pessoa não recebe aviso',
      acao: { rotulo: 'Ver pessoas', href: '/admin/usuarios?tenant=tenant_alfa&notificacao=com_problema' },
    });
    expect(linhasDoProblema(cliente, { kind: 'chamado_sem_resposta', severity: 'amarelo', count: 1, ticket_id: 'abc' }, agora)[0]).toEqual({
      texto: '1 chamado esperando resposta',
      acao: { rotulo: 'Abrir chamado', href: '/admin/suporte/abc' },
    });
    expect(
      linhasDoProblema(cliente, { kind: 'chamado_sem_resposta', severity: 'amarelo', count: 2, ticket_id: null }, agora)[0].acao,
    ).toEqual({ rotulo: 'Ver chamados', href: '/admin/suporte' });
    expect(linhasDoProblema(cliente, { kind: 'erro_criacao', severity: 'vermelho' }, agora)[0]).toEqual({
      texto: 'Deu erro ao criar o cliente',
      acao: { rotulo: 'Ver clientes', href: '/admin/clientes' },
    });
  });
  it('tipo de problema desconhecido (servidor mais novo) não quebra a aba', () => {
    const desconhecido = { kind: 'coisa_nova', severity: 'amarelo' } as unknown as Parameters<typeof linhasDoProblema>[1];
    expect(linhasDoProblema(cliente, desconhecido, agora)).toEqual([]);
  });
});
