import { describe, expect, it } from 'vitest';
import { dadosParaSalvar, estadoInicial, lerValor, previaPrimeiroBoleto, primeiroPassoComErro, wzErro, type EstadoDoAssistente } from './wizard';

const base = (): EstadoDoAssistente => ({
  ...estadoInicial('2026-11-04'),
  imovel: 'Apto 12 · Rua Exemplo, 100 · Centro',
  inqNome: 'Maria Souza',
  aluguel: '3.000,00',
  caucao: '9.000,00',
});

const cfg = { taxa_boleto: 3.5, comissao_locacao_pct: 40, comissao_captacao_pct: 10 };

describe('lerValor', () => {
  it('lê o dinheiro como a pessoa digita', () => {
    expect(lerValor('2.800,50')).toBe(2800.5);
    expect(lerValor('2800')).toBe(2800);
    expect(lerValor('')).toBe(0);
    expect(lerValor('abc')).toBeNaN();
  });
});

describe('validação do passo 1', () => {
  it('pede o imóvel', () => {
    expect(wzErro(1, { ...base(), imovel: '  ' })).toBe('Escreva o imóvel.');
  });
  it('proprietário novo precisa de nome e PIX', () => {
    expect(wzErro(1, { ...base(), proprietario: 'novo', novoNome: 'Ana' })).toBe('Preencha nome e chave PIX do novo proprietário.');
    expect(wzErro(1, { ...base(), proprietario: 'novo', novoNome: 'Ana', novoPix: 'ana@pix.com' })).toBeNull();
  });
  it('pede o inquilino', () => {
    expect(wzErro(1, { ...base(), inqNome: '' })).toBe('Escreva o nome do inquilino.');
  });
  it('passa quando está completo', () => {
    expect(wzErro(1, base())).toBeNull();
  });
});

describe('validação do passo 2', () => {
  it('pede aluguel e início', () => {
    expect(wzErro(2, { ...base(), aluguel: '' })).toBe('Informe o valor do aluguel.');
    expect(wzErro(2, { ...base(), inicio: '' })).toBe('Informe a data de início.');
  });
  it('a taxa de administração fica entre 6% e 10%', () => {
    expect(wzErro(2, { ...base(), taxaAdm: '5' })).toMatch(/entre 6% e 10%/);
    expect(wzErro(2, { ...base(), taxaAdm: '11' })).toMatch(/entre 6% e 10%/);
    expect(wzErro(2, { ...base(), taxaAdm: '6' })).toBeNull();
    expect(wzErro(2, { ...base(), taxaAdm: '10' })).toBeNull();
    expect(wzErro(2, { ...base(), taxaAdm: '8,5' })).toBeNull();
  });
});

describe('validação do passo 3', () => {
  it('mês adiantado só sem garantia', () => {
    expect(wzErro(3, { ...base(), cobranca: 'antecipado' })).toMatch(/Mês adiantado só é permitido/);
    expect(wzErro(3, { ...base(), cobranca: 'antecipado', garantia: 'nenhuma' })).toBeNull();
  });
  it('caução: pede o valor e não passa de 3 aluguéis', () => {
    expect(wzErro(3, { ...base(), caucao: '' })).toMatch(/Informe o valor da caução/);
    expect(wzErro(3, { ...base(), caucao: '9.000,01' })).toBe('A caução não pode passar de 3 aluguéis (art. 38).');
    expect(wzErro(3, { ...base(), caucao: '9.000,00' })).toBeNull();
  });
  it('seguro-fiança pede vencimento e apólice', () => {
    const s = { ...base(), garantia: 'seguro' as const };
    expect(wzErro(3, s)).toMatch(/vencimento da apólice/);
    expect(wzErro(3, { ...s, vence: '2027-11-04' })).toBe('Escreva a seguradora e o número da apólice.');
    expect(wzErro(3, { ...s, vence: '2027-11-04', detalhe: 'Porto, apólice 123' })).toBeNull();
  });
  it('fiador, título e outra pedem o detalhe', () => {
    expect(wzErro(3, { ...base(), garantia: 'fianca' })).toBe('Escreva o nome e o CPF do fiador.');
    expect(wzErro(3, { ...base(), garantia: 'titulo' })).toBe('Escreva o número do título de capitalização.');
    expect(wzErro(3, { ...base(), garantia: 'outra' })).toBe('Descreva a garantia.');
  });
  it('acha o primeiro passo com problema', () => {
    expect(primeiroPassoComErro(base())).toBeNull();
    expect(primeiroPassoComErro({ ...base(), aluguel: '' })).toBe(2);
    expect(primeiroPassoComErro({ ...base(), imovel: '' })).toBe(1);
  });
});

describe('o que vai para a API', () => {
  it('separa o imóvel do endereço e lê os valores', () => {
    const d = dadosParaSalvar({ ...base(), proprietario: 'abc-123' });
    expect(d.imovel_descricao).toBe('Apto 12');
    expect(d.imovel_endereco).toBe('Rua Exemplo, 100 · Centro');
    expect(d.proprietario_owner_id).toBe('abc-123');
    expect(d.aluguel_inicial).toBe(3000);
    expect(d.garantia).toMatchObject({ tipo: 'caucao', valor: 9000 });
    expect(d.taxa_adm_pct).toBe(8);
    expect(d.dia_vencimento).toBe(10);
  });
  it('proprietário novo vai com nome e PIX, sem id', () => {
    const d = dadosParaSalvar({ ...base(), proprietario: 'novo', novoNome: 'Ana', novoPix: 'ana@pix.com' });
    expect(d.proprietario_owner_id).toBeNull();
    expect(d.proprietario_nome).toBe('Ana');
    expect(d.proprietario_pix_chave).toBe('ana@pix.com');
  });
});

describe('prévia do primeiro boleto', () => {
  it('sem aluguel não há prévia', () => {
    expect(previaPrimeiroBoleto({ ...base(), aluguel: '' }, cfg)).toBeNull();
  });
  it('mês vencido, contrato no dia 1: o primeiro boleto sai no mês seguinte e cobra o mês cheio', () => {
    const p = previaPrimeiroBoleto({ ...base(), inicio: '2026-11-01' }, cfg)!;
    expect(p.periodo).toEqual({ ini: '2026-11-01', fim: '2026-11-30' });
    expect(p.parcial).toBe(false);
    expect(p.aluguel).toBe(3000);
    expect(p.vencimento).toBe('2026-12-10');
    expect(p.taxa).toBe(240);
    expect(p.recebeProprietario).toBe(2760);
    expect(p.total).toBe(3003.5);
  });
  it('entrada no meio do mês é proporcional', () => {
    const p = previaPrimeiroBoleto({ ...base(), inicio: '2026-11-16' }, cfg)!;
    expect(p.parcial).toBe(true);
    expect(p.aluguel).toBe(1500);
  });
  it('intermediação: 1º aluguel cheio vira a taxa e avisa quando passa do aluguel do boleto', () => {
    const p = previaPrimeiroBoleto({ ...base(), inicio: '2026-11-16', intermediacao: 'cheio' }, cfg)!;
    expect(p.taxa).toBe(3000);
    expect(p.taxaMaiorQueAluguel).toBe(true);
    expect(p.recebeProprietario).toBe(-1500);
    expect(p.comissaoLocacao).toBe(1200);
    expect(p.comissaoCaptacao).toBe(300);
  });
  it('intermediação proporcional: a taxa é o valor do 1º boleto', () => {
    const p = previaPrimeiroBoleto({ ...base(), inicio: '2026-11-16', intermediacao: 'proporcional' }, cfg)!;
    expect(p.taxa).toBe(1500);
    expect(p.recebeProprietario).toBe(0);
  });
  it('soma condomínio, seguro incêndio e taxa de boleto no total', () => {
    const p = previaPrimeiroBoleto({ ...base(), inicio: '2026-11-01', condominio: '500,00', seguro: '40,00' }, cfg)!;
    expect(p.extras.map((x) => x.valor)).toEqual([500, 40, 3.5]);
    expect(p.total).toBe(3543.5);
  });
});
