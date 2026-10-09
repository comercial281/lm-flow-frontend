import { describe, expect, it } from 'vitest';
import { parsePeopleRows } from './parsePeopleRows';

describe('parsePeopleRows', () => {
  it('lê tab, ponto e vírgula e vírgula', () => {
    const r = parsePeopleRows('Ana\tana@x.com\t11940871974\nBia;bia@x.com;11 94087-1975\nCaio,caio@x.com,');
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { name: 'Ana', email: 'ana@x.com', whatsapp: '11940871974' },
      { name: 'Bia', email: 'bia@x.com', whatsapp: '11940871975' },
      { name: 'Caio', email: 'caio@x.com', whatsapp: '' },
    ]);
  });

  it('ignora o cabeçalho da planilha e as linhas vazias', () => {
    const r = parsePeopleRows('Nome;E-mail;Celular\n\n  \nAna;ana@x.com;\n');
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it('aponta a linha com e-mail inválido, contando as linhas do texto', () => {
    const r = parsePeopleRows('Nome;E-mail\nAna;ana@x.com\nBia;bia-sem-arroba');
    expect(r.rows.map(x => x.name)).toEqual(['Ana']);
    expect(r.errors).toEqual([{ line: 3, message: 'Linha 3: e-mail inválido' }]);
  });

  it('tira espaços e baixa o e-mail; sem nome, usa a parte antes do @', () => {
    const r = parsePeopleRows('  Ana Souza  ;  ANA@X.com  ; ');
    expect(r.rows[0]).toEqual({ name: 'Ana Souza', email: 'ana@x.com', whatsapp: '' });
    expect(parsePeopleRows(';joao@x.com').rows[0].name).toBe('joao');
  });

  it('celular fora do padrão vira erro da linha', () => {
    const r = parsePeopleRows('Ana;ana@x.com;123');
    expect(r.rows).toEqual([]);
    expect(r.errors[0].message).toBe('Linha 1: celular inválido');
  });
});
