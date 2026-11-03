import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import type { CaminhoDaIntencao, ConhecimentoDeFabrica, SalesAgent } from '@/services/salesAgents/salesAgentsService';

const listar = vi.hoisted(() => vi.fn());
const conhecimentos = vi.hoisted(() => vi.fn());
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: listar } }));
vi.mock('@/services/salesAgents/salesAgentsService', async (original) => ({
  ...(await original<typeof import('@/services/salesAgents/salesAgentsService')>()),
  salesAgentsService: { conhecimentosDeFabrica: conhecimentos },
}));
import PublicoEProduto from './PublicoEProduto';

beforeEach(() => {
  listar.mockReset(); listar.mockResolvedValue({ data: [] });
  conhecimentos.mockReset(); conhecimentos.mockRejectedValue(new Error('sem servidor'));
});

const catalogo = (marcados: string[]): CaminhoDaIntencao[] => [
  { chave: 'moradia', nome: 'Moradia', sinais: 'família', como: 'Descubra pra quem é.', ativo: marcados.includes('moradia') },
  { chave: 'investimento', nome: 'Investimento', sinais: 'renda', como: 'Fale do potencial.', ativo: marcados.includes('investimento') },
  { chave: 'primeiro_imovel', nome: 'Primeiro imóvel', sinais: 'aluguel', como: 'Renda e FGTS.', ativo: marcados.includes('primeiro_imovel') },
  { chave: 'troca', nome: 'Trocar de imóvel', sinais: 'já tem imóvel', como: 'Vende o atual?', ativo: marcados.includes('troca') },
];
const agente = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  intent_paths: catalogo(['moradia', 'investimento']), intent_paths_padrao: catalogo(['moradia', 'investimento']),
  serves: ['venda'], catalog_marks: { venda: 12, locacao: 3, leilao: 0, empreendimento: 5 }, ...extra,
});
const montar = (a: SalesAgent, gravar = gravarDeTeste('publico')) => (
  <><PublicoEProduto agent={a} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>
);
const abrir = (a = agente()) => {
  const gravar = gravarDeTeste('publico');
  const tela = render(montar(a, gravar));
  return { gravar, tela, de: (b: SalesAgent) => tela.rerender(montar(b, gravar)) };
};
const ligados = () => screen.getByText(/^Conhecimentos de fábrica ligados:/).textContent;

describe('Produto (as marcas)', () => {
  it('as 4 marcas com a contagem do cadastro, a da IA marcada', () => {
    abrir();
    expect(screen.getByRole('checkbox', { name: 'Venda' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Empreendimento' })).not.toBeChecked();
    expect(screen.getByText('12 no cadastro')).toBeInTheDocument();
    expect(screen.getByText('5 no cadastro')).toBeInTheDocument();
    expect(screen.getByText('0 no cadastro', { selector: 'span' })).toBeInTheDocument();
  });

  it('marcar grava só o serves, na ordem das marcas', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Empreendimento' }));
    expect(gravar).toHaveBeenCalledWith({ serves: ['venda', 'empreendimento'] });
    expect(gravar.mock.calls[0][0]).not.toHaveProperty('locacao_enabled');
  });

  it('a última marca não desmarca', async () => {
    const { gravar } = abrir();
    expect(screen.getByRole('checkbox', { name: 'Venda' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Venda' }));
    expect(gravar).not.toHaveBeenCalled();
  });

  it('a lista de conhecimentos muda na hora ao marcar (antes do servidor)', () => {
    const { de } = abrir();
    expect(ligados()).toBe('Conhecimentos de fábrica ligados: Financiamento, FGTS, Custos da compra, Vender o atual pra comprar.');
    de(agente({ serves: ['venda', 'empreendimento'] }));
    expect(ligados()).toContain('Minha Casa Minha Vida');
    expect(ligados()).toContain('Compra na planta');
  });

  it('depois de gravar mostra o que o servidor devolve', async () => {
    const lista: ConhecimentoDeFabrica[] = [
      { topic: 'financiamento', title: 'Financiamento', body: null, reviewed_at: null, enabled: true, by_marks: true },
      { topic: 'fgts', title: 'FGTS', body: null, reviewed_at: null, enabled: false, by_marks: true },
      { topic: 'mcmv', title: 'Minha Casa Minha Vida', body: null, reviewed_at: null, enabled: true, by_marks: false },
    ];
    conhecimentos.mockResolvedValue(lista);
    abrir();
    await waitFor(() => expect(ligados()).toBe('Conhecimentos de fábrica ligados: Financiamento, Minha Casa Minha Vida.'));
    expect(conhecimentos).toHaveBeenCalledWith('ia-1');
  });

  it('desligado pelo cliente no Ensinar sai da lista do espelho', () => {
    abrir(agente({ factory_knowledge_off: ['fgts'] }));
    expect(ligados()).not.toContain('FGTS');
  });
});

describe('Público-alvo (os 4 caminhos)', () => {
  const lista = (gravar: ReturnType<typeof gravarDeTeste>) =>
    (gravar.mock.calls[0][0].playbook as { vars: { caminhos_intencao: CaminhoDaIntencao[] } }).vars.caminhos_intencao;

  it('mostra os 4 marcáveis e a frase de como ela pergunta', () => {
    abrir();
    expect(screen.getByRole('checkbox', { name: 'Moradia' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Primeiro imóvel' })).not.toBeChecked();
    expect(screen.getByText(/Se nada responder antes, pergunta só: morar ou investir\?/)).toBeInTheDocument();
  });

  it('marcar mexe só no ativo do caminho de fábrica e grava a lista inteira na mesma ordem', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Primeiro imóvel' }));
    expect(gravar.mock.calls[0][1]).toEqual(['playbook.vars.caminhos_intencao']);
    expect(lista(gravar)).toEqual(catalogo(['moradia', 'investimento', 'primeiro_imovel']));
  });

  it('caminho próprio do cliente não aparece e não é apagado', async () => {
    const proprio: CaminhoDaIntencao = { nome: 'Alto padrão', sinais: 'cobertura', como: 'Fale do exclusivo.', ativo: true };
    const { gravar } = abrir(agente({ playbook: { vars: { caminhos_intencao: [...catalogo(['moradia', 'investimento']), proprio] } } }));
    expect(screen.queryByText('Alto padrão')).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Investimento' }));
    const gravada = lista(gravar);
    expect(gravada.at(-1)).toEqual(proprio);
    expect(gravada.filter((c) => c.chave).map((c) => [c.chave, c.ativo])).toEqual([
      ['moradia', true], ['investimento', false], ['primeiro_imovel', false], ['troca', false],
    ]);
  });

  it('a frase só conta os 4 de fábrica (o próprio marcado fica de fora)', () => {
    const proprio: CaminhoDaIntencao = { nome: 'Alto padrão', como: 'x', ativo: true };
    abrir(agente({ playbook: { vars: { caminhos_intencao: [...catalogo(['investimento']), proprio] } } }));
    expect(screen.getByText(/Não pergunta a intenção\. Todo lead desta IA é tratado como Investimento\./)).toBeInTheDocument();
  });

  it('a pergunta de intenção e o quando perguntar seguem gravando', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Não pergunta, deduz' }));
    expect(gravar).toHaveBeenCalledWith(
      { playbook: { vars: { perguntas_situacao: ['Mora de aluguel?'] }, intent_question_mode: 'never' } },
      ['playbook.intent_question_mode'],
    );
  });
});

describe('Lead fora do perfil', () => {
  it.each([
    ['Passa pro corretor', 'passar'],
    ['Encerra com educação', 'encerrar'],
    ['Segue atendendo', 'atender'],
  ])('%s grava %s', async (rotulo, valor) => {
    const { gravar } = abrir(agente({ playbook: { vars: { fora_dos_caminhos: valor === 'passar' ? 'atender' : 'passar' } } }));
    await userEvent.click(screen.getByRole('radio', { name: new RegExp(`^${rotulo}`) }));
    expect(gravar).toHaveBeenCalledWith({ playbook: { vars: { fora_dos_caminhos: valor } } }, ['playbook.vars.fora_dos_caminhos']);
  });
});

describe('Imóvel principal e o que ela usa do cadastro', () => {
  it('imóvel principal grava o código; "não está entre os ativos" só depois da lista', async () => {
    let soltar: (v: unknown) => void = () => {};
    listar.mockReturnValue(new Promise((res) => { soltar = res; }));
    const { gravar } = abrir(agente({ default_property_code: 'AB01' }));
    expect(screen.getByLabelText('Imóvel principal')).toHaveValue('AB01');
    expect(screen.queryByText(/não está entre os ativos/)).toBeNull();
    soltar({ data: [{ code: 'AB02', title: 'Residencial Teste' }] });
    expect(await screen.findByRole('option', { name: 'AB01 (não está entre os ativos)' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Imóvel principal'), 'AB02');
    expect(gravar).toHaveBeenCalledWith({ default_property_code: 'AB02' });
  });

  it('busca no cadastro e outras opções gravam como no Catálogo de hoje', async () => {
    const { gravar } = abrir();
    expect(screen.getByRole('switch', { name: 'Consultar o cadastro' })).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Consultar o cadastro' }));
    expect(gravar).toHaveBeenCalledWith({ catalog_search_enabled: false });
    await userEvent.click(screen.getByRole('switch', { name: 'Oferecer outras opções' }));
    expect(gravar).toHaveBeenCalledWith({ cross_sell_enabled: false });
  });

  it('"Também atende locação" e Tipo de venda não aparecem; material mora em Materiais', () => {
    abrir();
    expect(screen.queryByText(/Também atende locação/)).toBeNull();
    expect(screen.queryByText('Tipo de venda')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Fotos e vídeo' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Book do imóvel' })).toBeNull();
  });
});
