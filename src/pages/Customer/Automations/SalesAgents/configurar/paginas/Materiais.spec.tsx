import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import type { SalesAgent, SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';

const listarDocs = vi.hoisted(() => vi.fn());
const atualizarDoc = vi.hoisted(() => vi.fn());
const subirArquivo = vi.hoisted(() => vi.fn());
const criarLink = vi.hoisted(() => vi.fn());
const listarImoveis = vi.hoisted(() => vi.fn());
const pegarImovel = vi.hoisted(() => vi.fn());
const listarCampanhas = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', async (original) => ({
  ...(await original<typeof import('@/services/salesAgents/salesAgentsService')>()),
  salesAgentsService: { listDocuments: listarDocs, updateDocument: atualizarDoc, uploadFileDocument: subirArquivo, criarLink },
}));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: listarImoveis, get: pegarImovel } }));
vi.mock('@/services/campanhas/campanhasService', () => ({ campanhasService: { lista: listarCampanhas } }));
import Materiais from './Materiais';

const doc = (id: string, extra: Partial<SalesAgentDocument> = {}) => ({
  id, sales_agent_id: 'ia-1', title: `Material ${id}`, source_type: 'file', sendable: true, property_codes: [], send_when: null,
  send_when_not: null, send_caption: null, send_once: true, send_topics: ['pagamento'], status: 'ready', ...extra,
}) as unknown as SalesAgentDocument;

const AB01 = {
  id: 'p1', code: 'AB01', title: 'Residencial Teste', listing_kind: 'development', latitude: -23.5, longitude: -46.6,
  address_neighborhood: 'Bairro Teste', address_city: 'Cidade Teste', has_book: true, book_file_name: 'book.pdf', virtual_tour_url: 'https://exemplo.test/tour', photos_count: 8,
};
const AB02 = { id: 'p2', code: 'AB02', title: 'Apartamento Teste', listing_kind: 'resale', latitude: -23.5, longitude: -46.6, address_neighborhood: 'Bairro Teste', has_book: false, virtual_tour_url: null };
const AB03 = { id: 'p3', code: 'AB03', title: 'Outro Teste', listing_kind: 'development', has_book: false };
const TODOS = [AB01, AB02, AB03];

beforeEach(() => {
  [listarDocs, atualizarDoc, subirArquivo, criarLink, listarImoveis, pegarImovel, listarCampanhas].forEach((m) => m.mockReset());
  listarDocs.mockResolvedValue([
    doc('casa', { title: 'Apresentação da casa', send_when: 'quando perguntarem quem somos' }),
    doc('semregra', { title: 'Site da casa', source_type: 'url' }),
    doc('planta', { title: 'Planta do AB01', property_codes: ['AB01'], send_when: 'quando pedirem a planta' }),
    doc('dois', { title: 'Tabela dos dois', property_codes: ['AB01', 'AB02'] }),
    doc('so02', { title: 'Folder do AB02', property_codes: ['AB02'] }),
    doc('mudo', { title: 'Só aprende', sendable: false }),
  ]);
  listarImoveis.mockImplementation(async (p: { q?: string }) => ({ data: p.q ? TODOS.filter((i) => i.code === p.q) : TODOS }));
  pegarImovel.mockRejectedValue(new Error('sem imóvel'));
  listarCampanhas.mockResolvedValue([]);
  atualizarDoc.mockResolvedValue(doc('novo'));
  criarLink.mockResolvedValue(doc('link', { source_type: 'url' }));
  subirArquivo.mockResolvedValue(doc('arq'));
});

const abrir = async (extra: Partial<SalesAgent> = {}) => {
  const gravar = gravarDeTeste('materiais');
  const irPara = vi.fn();
  render(<Materiais agent={agenteDeTeste({ default_property_code: 'AB01', ai_limits: {}, ...extra })} inboxes={[]} gravar={gravar} irPara={irPara} diagnostico={null} />);
  await screen.findByText('Apresentação da casa');
  await screen.findByText('Residencial Teste');
  return { gravar, irPara };
};
const grupo = (titulo: string) => screen.getByRole('group', { name: titulo });

describe('Da casa', () => {
  it('mostra só o material sem imóvel, com o "quando mandar"', async () => {
    await abrir();
    const casa = screen.getByRole('region', { name: 'Da casa' });
    expect(within(casa).getByText('Apresentação da casa')).toBeInTheDocument();
    expect(within(casa).getByText('quando perguntarem quem somos')).toBeInTheDocument();
    expect(within(casa).getByText(/Sem "quando mandar"/)).toBeInTheDocument();
    expect(within(casa).queryByText('Planta do AB01')).not.toBeInTheDocument();
    expect(within(casa).queryByText('Só aprende')).not.toBeInTheDocument();
  });

  it('a janela tem os 4 campos e salva sem send_topics', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Editar Apresentação da casa' }));
    const janela = screen.getByRole('dialog');
    ['Quando mandar', 'Quando não mandar', 'Mensagem junto'].forEach((r) => expect(within(janela).getByLabelText(r)).toBeInTheDocument());
    expect(within(janela).getByRole('switch', { name: 'Uma vez só' })).toBeChecked();
    await userEvent.clear(within(janela).getByLabelText('Quando mandar'));
    await userEvent.type(within(janela).getByLabelText('Quando mandar'), 'quando pedirem a apresentação');
    await userEvent.type(within(janela).getByLabelText('Mensagem junto'), 'segue a apresentação');
    await userEvent.click(within(janela).getByRole('switch', { name: 'Uma vez só' }));
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(atualizarDoc).toHaveBeenCalledTimes(1));
    const [agentId, docId, corpo] = atualizarDoc.mock.calls[0];
    expect([agentId, docId]).toEqual(['ia-1', 'casa']);
    expect(corpo).toEqual({ send_when: 'quando pedirem a apresentação', send_when_not: '', send_caption: 'segue a apresentação', send_once: false });
    expect(corpo).not.toHaveProperty('send_topics');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('+ Material da casa sobe arquivo como enviável e abre a janela', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: '+ Material da casa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Subir arquivo' }));
    const arquivo = new File(['x'], 'folder.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Escolher arquivo da casa'), arquivo);
    await waitFor(() => expect(subirArquivo).toHaveBeenCalledWith('ia-1', arquivo, undefined, expect.any(Function), { sendable: true }));
    expect(atualizarDoc).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Quando ela manda' })).toBeInTheDocument();
  });

  it('+ Material da casa por link cria o documento do tipo link', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: '+ Material da casa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Colar um link' }));
    const janela = screen.getByRole('dialog', { name: 'Novo link' });
    await userEvent.type(within(janela).getByLabelText('Nome'), 'Site da casa');
    await userEvent.type(within(janela).getByLabelText('Endereço do link'), 'https://exemplo.test');
    await userEvent.click(within(janela).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(criarLink).toHaveBeenCalledWith('ia-1', { title: 'Site da casa', url: 'https://exemplo.test' }));
    expect(await screen.findByRole('dialog', { name: 'Quando ela manda' })).toBeInTheDocument();
  });
});

describe('+ Material deste imóvel', () => {
  it('link: um POST só, com property_codes; o da casa não manda o campo', async () => {
    await abrir();
    await userEvent.click(within(grupo('Residencial Teste')).getByRole('button', { name: '+ Material deste imóvel' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Colar um link' }));
    let janela = screen.getByRole('dialog', { name: 'Novo link' });
    await userEvent.type(within(janela).getByLabelText('Nome'), 'Tour do AB01');
    await userEvent.type(within(janela).getByLabelText('Endereço do link'), 'https://exemplo.test/t');
    await userEvent.click(within(janela).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(criarLink).toHaveBeenCalledWith('ia-1', { title: 'Tour do AB01', url: 'https://exemplo.test/t', propertyCodes: ['AB01'] }));
    expect(atualizarDoc).not.toHaveBeenCalled();
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Quando ela manda' })).getByRole('button', { name: 'Cancelar' }));

    await userEvent.click(screen.getByRole('button', { name: '+ Material da casa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Colar um link' }));
    janela = screen.getByRole('dialog', { name: 'Novo link' });
    await userEvent.type(within(janela).getByLabelText('Nome'), 'Site');
    await userEvent.type(within(janela).getByLabelText('Endereço do link'), 'https://exemplo.test/s');
    await userEvent.click(within(janela).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(criarLink).toHaveBeenLastCalledWith('ia-1', { title: 'Site', url: 'https://exemplo.test/s' }));
  });

  it('arquivo: o upload já leva sendable e property_codes, sem PATCH depois', async () => {
    await abrir();
    await userEvent.click(within(grupo('Residencial Teste')).getByRole('button', { name: '+ Material deste imóvel' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Subir arquivo' }));
    await userEvent.upload(screen.getByLabelText('Escolher arquivo de Residencial Teste'), new File(['x'], 'planta.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(subirArquivo).toHaveBeenCalledWith('ia-1', expect.any(File), undefined, expect.any(Function), { sendable: true, property_codes: ['AB01'] }));
    expect(atualizarDoc).not.toHaveBeenCalled();
  });

  it('upload falho: diz que não deu pra subir e não abre janela', async () => {
    const { toast } = await import('sonner');
    const erro = vi.spyOn(toast, 'error').mockImplementation(() => '');
    subirArquivo.mockRejectedValue(new Error('x'));
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: '+ Material da casa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Subir arquivo' }));
    await userEvent.upload(screen.getByLabelText('Escolher arquivo da casa'), new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(erro).toHaveBeenCalledWith('Não deu pra subir o arquivo. Tente de novo.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('De cada imóvel', () => {
  it('diz que as chaves valem pra todos os imóveis', async () => {
    await abrir();
    expect(within(grupo('Residencial Teste')).getAllByText(/vale pra todos os imóveis/).length).toBeGreaterThanOrEqual(3);
  });

  it('o imóvel só mostra o material ligado a ele (material de outro imóvel não aparece)', async () => {
    await abrir();
    const g = within(grupo('Residencial Teste'));
    expect(g.getByText('Planta do AB01')).toBeInTheDocument();
    expect(g.getByText('Tabela dos dois')).toBeInTheDocument();
    expect(g.queryByText('Folder do AB02')).not.toBeInTheDocument();
    expect(g.queryByText('Apresentação da casa')).not.toBeInTheDocument();
    const h = within(grupo('Apartamento Teste'));
    expect(h.getByText('Tabela dos dois')).toBeInTheDocument();
    expect(h.getByText('Folder do AB02')).toBeInTheDocument();
  });

  it('Book liga na hora e edita a regra; Fotos e vídeo com "quando" fixo; Tour só com link', async () => {
    const { gravar } = await abrir({ send_property_book_enabled: false, rich_media_enabled: true, book_send_rule: 'quando pedirem detalhes' });
    const g = within(grupo('Residencial Teste'));
    expect(g.getByText('quando pedirem detalhes')).toBeInTheDocument();
    await userEvent.click(g.getByRole('switch', { name: 'Mandar o book' }));
    expect(gravar).toHaveBeenLastCalledWith({ send_property_book_enabled: true });
    await userEvent.click(g.getByRole('switch', { name: 'Mandar fotos e vídeo' }));
    expect(gravar).toHaveBeenLastCalledWith({ rich_media_enabled: false });
    expect(g.getByText('quando pedirem fotos, vídeo ou quiserem ver o imóvel')).toBeInTheDocument();
    expect(g.getByText('Tour virtual')).toBeInTheDocument();
    expect(within(grupo('Apartamento Teste')).queryByText('Tour virtual')).not.toBeInTheDocument();
    expect(within(grupo('Apartamento Teste')).queryByText('Book')).not.toBeInTheDocument();

    await userEvent.click(g.getByRole('button', { name: 'Editar a regra do book' }));
    const janela = screen.getByRole('dialog', { name: 'Quando ela manda o book' });
    await userEvent.clear(within(janela).getByLabelText('Quando mandar'));
    await userEvent.type(within(janela).getByLabelText('Quando mandar'), 'quando pedirem plantas');
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(gravar).toHaveBeenLastCalledWith({ book_send_rule: 'quando pedirem plantas' }));
  });

  it('Localização grava location_pin_enabled (não o rich_media_enabled)', async () => {
    const { gravar } = await abrir({ location_pin_enabled: true, rich_media_enabled: false });
    const g = within(grupo('Residencial Teste'));
    expect(g.getByText('quando perguntarem onde fica ou como chegar')).toBeInTheDocument();
    await userEvent.click(g.getByRole('switch', { name: 'Mandar a localização' }));
    expect(gravar).toHaveBeenLastCalledWith({ location_pin_enabled: false });
  });

  it('revenda explica por que o pino não sai', async () => {
    await abrir();
    const g = within(grupo('Apartamento Teste'));
    expect(g.getByText(/Só empreendimento manda o pino/)).toBeInTheDocument();
    expect(g.queryByRole('switch', { name: 'Mandar a localização' })).not.toBeInTheDocument();
  });

  it('com "Endereço exato" ligado nem o empreendimento manda o pino, e leva à Condução', async () => {
    const { irPara } = await abrir({ ai_limits: { address: true } });
    const g = within(grupo('Residencial Teste'));
    expect(g.getByText(/restrição "Endereço exato" está ligada/)).toBeInTheDocument();
    expect(g.queryByRole('switch', { name: 'Mandar a localização' })).not.toBeInTheDocument();
    await userEvent.click(g.getByRole('button', { name: 'Abrir Condução' }));
    expect(irPara).toHaveBeenCalledWith('conducao');
  });

  it('Ver outro imóvel acrescenta o imóvel à página sem gravar nada no agente', async () => {
    const { gravar } = await abrir();
    expect(screen.queryByRole('group', { name: 'Outro Teste' })).not.toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText('Ver outro imóvel'), 'AB03');
    expect(await screen.findByRole('group', { name: 'Outro Teste' })).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
  });

  it('o principal e os imóveis das campanhas entram mesmo sem material', async () => {
    listarCampanhas.mockResolvedValue([{ property_ids: ['p3'] }]);
    pegarImovel.mockImplementation(async (id: string) => TODOS.find((i) => i.id === id));
    await abrir();
    expect(await screen.findByRole('group', { name: 'Outro Teste' })).toBeInTheDocument();
  });

  it('imóvel que o cadastro não achou aparece só com o material', async () => {
    listarDocs.mockResolvedValue([doc('x', { title: 'Material solto', property_codes: ['ZZ99'] })]);
    listarImoveis.mockImplementation(async () => ({ data: [] }));
    render(<Materiais agent={agenteDeTeste({ default_property_code: null })} inboxes={[]} gravar={gravarDeTeste('materiais')} irPara={vi.fn()} diagnostico={null} />);
    const g = within(await screen.findByRole('group', { name: 'ZZ99' }));
    expect(g.getByText('Material solto')).toBeInTheDocument();
    expect(g.getByText(/não está entre os imóveis/)).toBeInTheDocument();
  });
});
