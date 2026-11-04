import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/core/api', () => ({ default: {} }));

import { dePainel, deReajuste, deRepasses, deSegundaVia, diasAte, reajusteSemIndice } from './locacaoService';
import type { Contrato, Repasse } from './tipos';

const contrato = (over: Partial<Contrato> = {}) =>
  ({ id: 'c1', status: 'ativo', indice: 'igpm', inicio: '2025-12-10', ultimo_reajuste: null, aluguel_inicial: 2000, historico_aluguel: [], ...over }) as unknown as Contrato;

describe('dePainel', () => {
  it('lê os KPIs aninhados do servidor e manda cada aviso pro lugar certo', () => {
    const p = dePainel({
      kpis: {
        contratos_ativos: { quantidade: 3, aluguel_mensal: 7500 },
        em_atraso: { quantidade: 1, valor: 2421.89 },
        a_repassar: { valor: 4100, proprietarios: 2 },
        receita_30_dias: 610,
      },
      avisos: [
        { severidade: 'bad', titulo: 'Boleto vencido', detalhe: 'x', acao: { tipo: 'ver_boleto', cobranca_id: 'b1', contrato_id: 'c9' } },
        { severidade: 'warn', titulo: 'Reajuste', detalhe: 'y', acao: { tipo: 'abrir_contrato', contrato_id: 'c2', aba: 'reajuste' } },
        { severidade: 'info', titulo: 'Lote', detalhe: 'z', acao: { tipo: 'ir_repasses' } },
        { severidade: 'ok', titulo: 'Sem ação', detalhe: 'w' },
      ],
    });
    expect(p.kpis).toEqual({
      em_atraso_total: 2421.89, em_atraso_qtd: 1, contratos_ativos: 3, aluguel_mensal_total: 7500,
      a_repassar_total: 4100, proprietarios_a_repassar: 2, receita_30_dias: 610,
    });
    expect(p.avisos[0]).toMatchObject({ tag: 'Urgente', acao_tipo: 'contrato', contrato_id: 'c9', aba_do_contrato: 'cobrancas' });
    expect(p.avisos[1]).toMatchObject({ tag: 'Atenção', contrato_id: 'c2', aba_do_contrato: 'reajuste' });
    expect(p.avisos[2]).toMatchObject({ acao_tipo: 'repasses' });
    expect(p.avisos[3].acao_tipo).toBeUndefined();
  });
});

describe('reajuste', () => {
  const hoje = new Date(2026, 9, 27); // 27/10/2026, 44 dias antes de 10/12

  it('converte porcentagem em fração e acumula mês a mês', () => {
    const r = deReajuste(
      { aniversario: '2026-12-10', indice_acumulado_pct: 2.01, aplicado_pct: 2.01, aluguel_atual: 2000, aluguel_novo: 2040.2,
        meses: [{ mes: '2026-01', indice_pct: 1 }, { mes: '2026-02', indice_pct: 1 }] },
      contrato(), hoje,
    );
    expect(r.pct).toBeCloseTo(0.0201);
    expect(r.meses[1].acumulado).toBeCloseTo(0.0201);
    expect(r.dias_para_aniversario).toBe(44);
    expect(r.pode_aplicar).toBe(true);
  });

  it('trava fora da janela de 45 dias e em contrato encerrado', () => {
    const base = { aniversario: '2026-12-10', indice_acumulado_pct: 0, aplicado_pct: 0, aluguel_atual: 2000, aluguel_novo: 2000, meses: [] };
    expect(deReajuste(base, contrato(), new Date(2026, 9, 25)).pode_aplicar).toBe(false); // 46 dias
    expect(deReajuste(base, contrato({ status: 'encerrado' } as Partial<Contrato>), hoje).pode_aplicar).toBe(false);
  });

  it('sem índice publicado: aniversário a partir do início, aluguel do histórico, nunca aplica', () => {
    const r = reajusteSemIndice(contrato({ historico_aluguel: [{ data: '2025-12-10', valor: 2100 }] } as Partial<Contrato>), 'IGP-M de out/2026 ainda não saiu', hoje);
    expect(r.aniversario).toBe('2026-12-10');
    expect(r.aluguel_atual).toBe(2100);
    expect(r.pode_aplicar).toBe(false);
    expect(r.erro).toMatch(/IGP-M/);
  });

  it('início em 29/02 faz aniversário em 28/02 do ano seguinte', () => {
    expect(reajusteSemIndice(contrato({ inicio: '2024-02-29' } as Partial<Contrato>), 'x', hoje).aniversario).toBe('2025-02-28');
    expect(diasAte('2026-10-28', hoje)).toBe(1);
  });
});

describe('deRepasses', () => {
  it('soma só o que está aguardando no lote, por proprietário', () => {
    const rep = (chave: string, valor: number, status: Repasse['status']) => ({ id: chave + valor, proprietario_chave: chave, proprietario_nome: chave, pix_chave: null, valor, status, enviado_em: null, erro: null }) as Repasse;
    const r = deRepasses(
      [rep('ana', 1000, 'aguardando'), rep('ana', 500, 'aguardando'), rep('ana', 900, 'enviado'), rep('bia', 300, 'aguardando')],
      [{ chave: 'ana', nome: 'Ana', saldo: 1500, liberado: 1500, contratos: 2 }, { chave: 'caio', saldo: 0, liberado: 0 }],
      5,
    );
    expect(r.prazo_dias_uteis).toBe(5);
    expect(r.saldos[0]).toMatchObject({ nome: 'Ana', no_lote: 1500, imoveis: 2 });
    expect(r.saldos[1]).toMatchObject({ nome: 'caio', no_lote: 0, imoveis: 0 });
  });
});

describe('deSegundaVia', () => {
  it('com encargos usa o total de hoje; sem encargos, o total do boleto', () => {
    const b = { id: 'b1', total: 2421.89, imovel_descricao: 'Apto 12' } as never;
    expect(deSegundaVia(b)).toMatchObject({ total_hoje: 2421.89, dias_atraso: 0, endereco: 'Apto 12' });
    expect(deSegundaVia({ ...(b as object), imovel_endereco: 'Rua A, 10', encargos: { dias: 4, multa: 48.44, juros: 3.23, total: 2473.56 } } as never))
      .toMatchObject({ total_hoje: 2473.56, multa_hoje: 48.44, dias_atraso: 4, endereco: 'Rua A, 10' });
  });
});
