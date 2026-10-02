import { describe, it, expect } from 'vitest';
import {
  VALOR_VAZIO, lerItens, paraRadix, deRadix, valorExibido, eventoDeMudanca,
} from './seletorOpcoes';

describe('lerItens', () => {
  it('lê option com valor, rótulo, desligada e estilo', () => {
    const itens = lerItens(
      <>
        <option value="">Tipo de negócio</option>
        <option value="sale" disabled style={{ color: 'red' }}>Venda</option>
      </>,
    );
    expect(itens).toEqual([
      { tipo: 'opcao', valor: '', rotulo: 'Tipo de negócio', desligada: false, estilo: undefined },
      { tipo: 'opcao', valor: 'sale', rotulo: 'Venda', desligada: true, estilo: { color: 'red' } },
    ]);
  });

  it('achata Fragment, array e ignora false/null', () => {
    const opcoes = <><option value="a">A</option><option value="b">B</option></>;
    const itens = lerItens([opcoes, false, null, ['c'].map(v => <option key={v} value={v}>C</option>)]);
    expect(itens.map(i => i.tipo === 'opcao' && i.valor)).toEqual(['a', 'b', 'c']);
  });

  it('pula option hidden', () => {
    const itens = lerItens(<><option value="x" hidden>X</option><option value="y">Y</option></>);
    expect(itens).toHaveLength(1);
  });

  it('valor numérico vira texto; sem value, usa o texto da opção', () => {
    const itens = lerItens(<><option value={1}>Um</option><option>Dois</option></>);
    expect(itens.map(i => i.tipo === 'opcao' && i.valor)).toEqual(['1', 'Dois']);
  });

  it('optgroup vira grupo com as opções dentro, e grupo vazio some', () => {
    const itens = lerItens(
      <>
        <optgroup label="Roleta"><option value="r1">Roleta 1</option>{false}</optgroup>
        <optgroup label="Vazio">{null}</optgroup>
      </>,
    );
    expect(itens).toEqual([
      { tipo: 'grupo', rotulo: 'Roleta', opcoes: [{ valor: 'r1', rotulo: 'Roleta 1', desligada: false, estilo: undefined }] },
    ]);
  });
});

describe('tradução de valor', () => {
  it('vazio vai e volta', () => {
    expect(paraRadix('')).toBe(VALOR_VAZIO);
    expect(deRadix(VALOR_VAZIO)).toBe('');
    expect(paraRadix('sale')).toBe('sale');
    expect(deRadix('sale')).toBe('sale');
  });
});

describe('valorExibido', () => {
  const itens = lerItens(<><option value="">Todos</option><option value={2}>Dois</option></>);

  it('valor vazio aponta pra opção vazia', () => {
    expect(valorExibido('', itens)).toBe(VALOR_VAZIO);
  });
  it('número casa com a opção em texto', () => {
    expect(valorExibido(2, itens)).toBe('2');
  });
  it('valor que não casa mostra a primeira opção, como o nativo', () => {
    expect(valorExibido('zzz', itens)).toBe(VALOR_VAZIO);
    expect(valorExibido(undefined, lerItens(<option value="a">A</option>))).toBe('a');
  });
  it('sem opção nenhuma devolve undefined', () => {
    expect(valorExibido('a', [])).toBeUndefined();
  });
  it('acha opção dentro de grupo', () => {
    const g = lerItens(<optgroup label="G"><option value="x">X</option></optgroup>);
    expect(valorExibido('x', g)).toBe('x');
  });
});

describe('eventoDeMudanca', () => {
  it('tem target.value e currentTarget.value, e não lança em preventDefault', () => {
    const e = eventoDeMudanca('sale', 'tipo');
    expect(e.target.value).toBe('sale');
    expect(e.target.name).toBe('tipo');
    expect(e.currentTarget.value).toBe('sale');
    expect(() => e.preventDefault()).not.toThrow();
  });
});
