import { describe, expect, it } from 'vitest';
import { passaNoFiltro, proximaAcao, situacaoDoContrato } from './chips';
import type { Contrato } from './tipos';

const contrato = (o: Partial<Contrato> = {}): Contrato => ({
  id: 'c1', status: 'ativo', imovel_descricao: 'Apto 12', proprietario_nome: 'Ana', inquilino_nome: 'Maria Souza',
  inicio: '2026-06-01', meses: 30, dia_vencimento: 10, aluguel_inicial: 3000, historico_aluguel: [{ desde: '2026-06-01', valor: 3000, pct: null }],
  indice: 'IGP-M', politica_negativo: 'manter', cobranca: 'vencido', taxa_adm_pct: 8, intermediacao: 'nao',
  garantia: { tipo: 'caucao', valor: 9000 }, condominio_estimado: 0, iptu: { resp: 'nao', parcela: 0 }, seguro_incendio: 0,
  chaves: { entrega: { assinado: true }, devolucao: { assinado: false } },
  vistoria: { entrada: { concluida: true, comodos: [] }, saida: { concluida: false, itens: {} } },
  ...o,
});
const HOJE = '2026-11-04';

describe('selos do contrato', () => {
  it('tudo certo = Em dia', () => {
    const s = situacaoDoContrato(contrato(), HOJE);
    expect(s.chips).toEqual([{ rotulo: 'Em dia', sev: 'ok' }]);
    expect(s.atencao).toBe(false);
  });
  it('aluguel atrasado é vermelho e pede atenção', () => {
    const s = situacaoDoContrato(contrato({ em_atraso_qtd: 1 }), HOJE);
    expect(s.chips[0]).toEqual({ rotulo: 'Aluguel atrasado', sev: 'bad' });
    expect(s.atencao).toBe(true);
  });
  it('reajuste: atrasado depois do aniversário, "em N dias" até 45 dias antes', () => {
    expect(situacaoDoContrato(contrato({ inicio: '2025-10-01', meses: 60 }), HOJE).chips.map((c) => c.rotulo)).toContain('Reajuste atrasado');
    expect(situacaoDoContrato(contrato({ inicio: '2025-12-01', meses: 60 }), HOJE).chips.map((c) => c.rotulo)).toContain('Reajuste em 27 dias');
    expect(situacaoDoContrato(contrato({ inicio: '2026-06-01', meses: 60 }), HOJE).chips.map((c) => c.rotulo)).not.toContain('Reajuste em');
  });
  it('prazo: termina em N dias (90) ou segue indeterminado', () => {
    expect(situacaoDoContrato(contrato({ inicio: '2026-01-05', meses: 12 }), HOJE).chips.map((c) => c.rotulo)).toContain('Termina em 61 dias');
    expect(situacaoDoContrato(contrato({ inicio: '2024-01-01', meses: 12, ultimo_reajuste: '2026-01-01' }), HOJE).chips.map((c) => c.rotulo)).toContain('Prazo indeterminado');
  });
  it('chaves não registradas é amarelo', () => {
    const s = situacaoDoContrato(contrato({ chaves: { entrega: { assinado: false }, devolucao: { assinado: false } } }), HOJE);
    expect(s.chips).toContainEqual({ rotulo: 'Chaves não registradas', sev: 'warn' });
  });
  it('encerrado mostra só Encerrado e não pede atenção', () => {
    const s = situacaoDoContrato(contrato({ status: 'encerrado', em_atraso_qtd: 2 }), HOJE);
    expect(s.chips).toEqual([{ rotulo: 'Encerrado', sev: 'info' }]);
    expect(s.atencao).toBe(false);
  });
});

describe('filtros da lista', () => {
  it('separa atenção, em dia e encerrados', () => {
    const ok = contrato();
    const mal = contrato({ em_atraso_qtd: 1 });
    const enc = contrato({ status: 'encerrado' });
    expect(passaNoFiltro(ok, 'em_dia', HOJE)).toBe(true);
    expect(passaNoFiltro(mal, 'em_dia', HOJE)).toBe(false);
    expect(passaNoFiltro(mal, 'atencao', HOJE)).toBe(true);
    expect(passaNoFiltro(enc, 'encerrados', HOJE)).toBe(true);
    expect(passaNoFiltro(enc, 'atencao', HOJE)).toBe(false);
    expect(passaNoFiltro(enc, 'todos', HOJE)).toBe(true);
  });
});

describe('próxima ação da ficha', () => {
  it('atraso vem antes de tudo', () => {
    const a = proximaAcao(contrato({ em_atraso_qtd: 1 }), HOJE, { diasDeAtraso: 5, valorEmAtraso: 'R$ 3.000,00' });
    expect(a.titulo).toBe('Aluguel atrasado há 5 dias');
    expect(a.aba).toBe('cobrancas');
  });
  it('depois, chaves e laudo', () => {
    expect(proximaAcao(contrato({ chaves: { entrega: { assinado: false }, devolucao: { assinado: false } } }), HOJE).titulo).toBe('Falta registrar a entrega das chaves');
    expect(proximaAcao(contrato({ vistoria: { entrada: { concluida: false, comodos: [] }, saida: { concluida: false, itens: {} } } }), HOJE).titulo).toBe('Falta concluir o laudo de vistoria de entrada');
  });
  it('sem pendência: tudo em dia', () => {
    expect(proximaAcao(contrato(), HOJE).titulo).toBe('Tudo em dia');
  });
});
