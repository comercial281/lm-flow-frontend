import { describe, expect, it } from 'vitest';
import { contarLacunas, contratoDoc, imovelCurto, limparMatricula, nomeDoArquivo } from './contratoDoc';
import type { Contrato } from './tipos';

const contrato = (o: Partial<Contrato> = {}): Contrato => ({
  id: 'c1', status: 'ativo', imovel_descricao: 'Apto 12', imovel_endereco: 'Rua Exemplo, 100 · Centro', uso: 'residencial',
  proprietario_nome: 'Ana Prado', proprietario_doc: '123.456.789-00', inquilino_nome: 'Maria Souza', inquilino_doc: '987.654.321-00',
  inquilino_telefone: '(11) 91234-5678', inicio: '2026-11-04', meses: 30, dia_vencimento: 10, aluguel_inicial: 2800,
  historico_aluguel: [{ desde: '2026-11-04', valor: 2800, pct: null }], indice: 'IGP-M', politica_negativo: 'manter', cobranca: 'vencido',
  taxa_adm_pct: 8, intermediacao: 'nao', garantia: { tipo: 'caucao', valor: 8400 }, condominio_estimado: 500, iptu: { resp: 'inq', parcela: 120 },
  seguro_incendio: 0,
  ...o,
});
const cfg = { multa_pct: 10, juros_mes_pct: 1, taxa_boleto: 3.5 };
const nbsp = (s: string) => s.replace(/\u00a0/g, ' ');

describe('texto do contrato', () => {
  const html = nbsp(contratoDoc(contrato(), cfg, { administradora: 'Imobiliária Exemplo' }));

  it('abre com o título e as 14 cláusulas em ordem', () => {
    expect(html).toContain('<h1>CONTRATO DE LOCAÇÃO RESIDENCIAL</h1>');
    expect(html).toContain('CLÁUSULA PRIMEIRA — DO OBJETO');
    expect(html).toContain('CLÁUSULA DÉCIMA QUARTA — DO FORO');
    expect((html.match(/<h3>/g) ?? []).length).toBe(14);
  });
  it('escreve o aluguel com valor e por extenso, e o dia do vencimento', () => {
    expect(html).toContain('R$ 2.800,00 (dois mil e oitocentos reais)');
    expect(html).toContain('<b>dia 10</b>');
    expect(html).toContain('pago no mês seguinte ao vencido (mês vencido)');
  });
  it('prazo: 30 meses, de 04/11/2026 a 03/05/2029', () => {
    expect(html).toContain('<b>30 (trinta) meses</b>');
    expect(html).toContain('<b>04/11/2026</b>');
    expect(html).toContain('<b>03/05/2029</b>');
  });
  it('usa a multa e os juros da configuração', () => {
    expect(html).toContain('multa de <b>10%</b>');
    expect(html).toContain('juros de mora de <b>1% ao mês</b>');
    expect(html).toContain('tarifa de emissão do boleto, de R$ 3,50 por cobrança');
  });
  it('caução: valor por extenso e referência ao art. 38', () => {
    expect(html).toContain('R$ 8.400,00 (oito mil e quatrocentos reais)');
    expect(html).toContain('art. 38, § 2º');
  });
  it('lista só os encargos que existem', () => {
    expect(html).toContain('IPTU e as taxas que incidam sobre o imóvel, hoje de R$ 120,00 por mês');
    expect(html).not.toContain('seguro contra incêndio');
    const semCondominio = nbsp(contratoDoc(contrato({ condominio_estimado: 0 }), cfg));
    expect(semCondominio).not.toContain('despesas ordinárias de condomínio (art. 23, XII');
  });
  it('multa rescisória usa o que está no encerramento, ou 3 aluguéis', () => {
    expect(html).toContain('<b>3 aluguéis</b>');
    expect(nbsp(contratoDoc(contrato({ encerramento: { motivo: 'antecipada', multa_meses: 1 } }), cfg))).toContain('<b>1 aluguel</b>');
    expect(nbsp(contratoDoc(contrato({ encerramento: { motivo: 'antecipada', multa_meses: 1.5 } }), cfg))).toContain('<b>1,5 aluguéis</b>');
  });
  it('uso comercial muda título, destinação e artigo da prorrogação', () => {
    const c = nbsp(contratoDoc(contrato({ uso: 'comercial' }), cfg));
    expect(c).toContain('NÃO RESIDENCIAL');
    expect(c).toContain('art. 56, parágrafo único');
  });
  it('fiador assina junto', () => {
    const f = nbsp(contratoDoc(contrato({ garantia: { tipo: 'fianca', valor: 0, detalhe: 'João Lima, CPF 111' } }), cfg));
    expect(f).toContain('juntamente com o FIADOR');
    expect(f).toContain('<small>FIADOR</small>');
    expect(f).toContain('renunciando ao benefício de ordem');
  });
  it('sem garantia permite o mês adiantado', () => {
    const s = nbsp(contratoDoc(contrato({ garantia: { tipo: 'nenhuma', valor: 0 }, cobranca: 'antecipado' }), cfg));
    expect(s).toContain('A locação é contratada sem garantia');
    expect(s).toContain('pago antecipadamente, referente ao mês que se inicia');
  });
  it('protege o texto de HTML vindo do cadastro', () => {
    expect(contratoDoc(contrato({ inquilino_nome: '<img src=x onerror=alert(1)>' }), cfg)).not.toContain('<img');
  });
});

describe('lacunas do contrato', () => {
  it('conta os campos que o cadastro não tem', () => {
    const vazio = contratoDoc(contrato(), cfg);
    expect(contarLacunas(vazio)).toBeGreaterThan(5);
    expect(vazio).toContain('class="blank"');
  });
  it('some quando a qualificação é preenchida', () => {
    const q = { qual: 'brasileiro, casado, engenheiro', rg: '12.345.678-9 SSP/SP', end: 'Rua A, 1, São Paulo/SP' };
    const completo = contratoDoc(
      contrato({ qualificacao: { prop: q, inq: q, compl: 'CEP 05435-000, São Paulo/SP', matricula: 'matrícula nº 123.456 do 10º CRI', cidade: 'São Paulo' } }),
      cfg,
      { administradora: 'Imobiliária Exemplo' },
    );
    expect(contarLacunas(completo)).toBe(0);
    expect(completo).toContain('matrícula nº 123.456 do 10º CRI');
    expect(completo).not.toContain('matrícula nº matrícula');
  });
});

describe('apoios', () => {
  it('tira o "matrícula nº" da frente', () => {
    expect(limparMatricula('Matrícula nº 123.456')).toBe('123.456');
    expect(limparMatricula('123.456 do 10º CRI')).toBe('123.456 do 10º CRI');
    expect(limparMatricula(null)).toBe('');
  });
  it('nome do arquivo sem caracteres proibidos', () => {
    expect(nomeDoArquivo('Apto 12/B: "A"')).toBe('Contrato de locação - Apto 12-B- -A-');
  });
  it('imóvel curto é o que vem antes do ponto', () => {
    expect(imovelCurto('Apto 12 · Rua Exemplo · Centro')).toBe('Apto 12');
    expect(imovelCurto('Casa')).toBe('Casa');
  });
});
