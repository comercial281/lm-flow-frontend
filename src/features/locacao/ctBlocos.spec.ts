import { describe, expect, it } from 'vitest';
import { ctBlocos } from './ctBlocos';
import { contratoDoc } from './contratoDoc';
import type { Contrato } from './tipos';

const montar = (html: string): HTMLElement => {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  return raiz;
};

describe('ctBlocos', () => {
  it('separa título, cláusula, parágrafo e data', () => {
    const b = ctBlocos(montar('<h1>CONTRATO</h1><h3>CLÁUSULA PRIMEIRA — DO OBJETO</h3><p>texto</p><p class="ct-data">São Paulo, 04/11/2026.</p>'));
    expect(b.map((x) => x.k)).toEqual(['h1', 'h3', 'p', 'data']);
  });
  it('marca negrito e lacuna, e junta o espaço sobrando', () => {
    const [p] = ctBlocos(montar('<p>  O aluguel é de <b>R$ 2.800,00</b>, no\n  <span class="blank">dia</span>. </p>'));
    expect(p.k).toBe('p');
    if (p.k === 'ass') throw new Error('era para ser parágrafo');
    expect(p.runs).toEqual([
      { t: 'O aluguel é de ', b: false, bl: false },
      { t: 'R$ 2.800,00', b: true, bl: false },
      { t: ', no ', b: false, bl: false },
      { t: 'dia', b: false, bl: true },
      { t: '.', b: false, bl: false },
    ]);
  });
  it('lê as assinaturas: nome e papel', () => {
    const b = ctBlocos(montar('<div class="ct-ass"><div><span></span>Ana Prado<small>LOCADOR</small></div><div><span></span>Testemunha 1<small>Nome e CPF</small></div></div>'));
    expect(b).toEqual([{ k: 'ass', itens: [['Ana Prado', 'LOCADOR'], ['Testemunha 1', 'Nome e CPF']] }]);
  });
  it('descarta bloco vazio e entende <br> como espaço', () => {
    const b = ctBlocos(montar('<p></p><p>a<br>b</p>'));
    expect(b).toHaveLength(1);
    if (b[0].k === 'ass') throw new Error('era para ser parágrafo');
    expect(b[0].runs.map((r) => r.t).join('')).toBe('a b');
  });
  it('lê o contrato inteiro que a tela gera', () => {
    const c = {
      id: 'c1', status: 'ativo', imovel_descricao: 'Apto 12', proprietario_nome: 'Ana', inquilino_nome: 'Maria', inicio: '2026-11-04', meses: 30,
      dia_vencimento: 10, aluguel_inicial: 2800, historico_aluguel: [{ desde: '2026-11-04', valor: 2800, pct: null }], indice: 'IGP-M',
      politica_negativo: 'manter', cobranca: 'vencido', taxa_adm_pct: 8, intermediacao: 'nao', garantia: { tipo: 'nenhuma', valor: 0 },
      condominio_estimado: 0, iptu: { resp: 'nao', parcela: 0 }, seguro_incendio: 0,
    } as Contrato;
    const b = ctBlocos(montar(contratoDoc(c, { multa_pct: 10, juros_mes_pct: 1, taxa_boleto: 0 })));
    expect(b[0].k).toBe('h1');
    expect(b.filter((x) => x.k === 'h3')).toHaveLength(14);
    expect(b[b.length - 1].k).toBe('ass');
  });
});
