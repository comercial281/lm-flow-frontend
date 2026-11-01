import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import type { SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import type { Arquivos as ArquivosDaIa } from '../useArquivos';

vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => ({
  ...(await orig<object>()),
  salesAgentsService: {
    updateDocument: vi.fn().mockResolvedValue({}),
    testSend: vi.fn(),
    uploadFileDocument: vi.fn(),
    createTextDocument: vi.fn().mockResolvedValue({}),
  },
}));
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';
import Arquivos from './Arquivos';

const D = (id: string, extra: Partial<SalesAgentDocument> = {}) => ({ id, title: `Arquivo ${id}`, status: 'ready', sendable: true, learnable: true, send_once: false, send_when: 'quando pedir', send_when_not: '', send_caption: '', send_mode: 'file', media_kind: 'document', source_type: 'file', size_label: '1 MB', char_count: 10, send_topics: [], property_codes: [], created_at: new Date().toISOString(), ...extra }) as SalesAgentDocument;

function abrir(docs: SalesAgentDocument[], extra: Partial<ArquivosDaIa> = {}, prova: string | null = null) {
  const a: ArquivosDaIa = { docs, estado: 'pronto', carregar: vi.fn().mockResolvedValue(undefined), apagar: vi.fn().mockResolvedValue(true),
    reprocessar: vi.fn().mockResolvedValue(undefined), aoCriar: vi.fn().mockResolvedValue(undefined), ...extra };
  const confirmar = vi.fn().mockResolvedValue(true);
  const gravar = gravarDeTeste('ensinar');
  const r = render(<Arquivos agent={agenteDeTeste({ social_proof: prova })} gravar={gravar} licoes={{} as never} arquivos={a} irPara={vi.fn()} confirmar={confirmar} />);
  return { a, confirmar, gravar, container: r.container };
}

const S = vi.mocked(salesAgentsService);

describe('Arquivos', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('cartão com selo de aprende e a ligação com imóveis; o "quando mandar" não mora aqui (é Materiais)', () => {
    abrir([D('a', { property_codes: ['AB01'] })]);
    expect(screen.getByText('Arquivo a')).toBeInTheDocument();
    expect(screen.getByText('Aprende')).toBeInTheDocument();
    expect(screen.getByText('Ligado a AB01')).toBeInTheDocument();
    expect(screen.queryByText(/Manda quando pedir/)).not.toBeInTheDocument();
    expect(screen.queryByText('Falta dizer quando mandar')).not.toBeInTheDocument();
  });

  it('selos de leitura', () => {
    abrir([
      D('p', { status: 'pending' }),
      D('n', { status: 'no_text' }),
      D('f', { status: 'failed', error_message: 'arquivo corrompido' }),
      D('t', { source_type: 'text', size_label: null, char_count: 1234, sendable: false }),
    ]);
    expect(screen.getByText('Lendo o arquivo…')).toBeInTheDocument();
    expect(screen.getByText('Sem texto pra aprender')).toBeInTheDocument();
    expect(screen.getByText('Falhou: arquivo corrompido')).toBeInTheDocument();
    expect(screen.getByText('1.234 caracteres')).toBeInTheDocument();
    // "Aprende" só com o arquivo lido (pronto); o pendente, o sem texto e o que falhou não.
    expect(screen.getAllByText('Aprende')).toHaveLength(1);
  });

  it('espera longa avisa em âmbar', () => {
    abrir([D('p', { status: 'pending', created_at: new Date(Date.now() - 10 * 60000).toISOString() })]);
    expect(screen.getByText(/Está demorando mais que o normal/)).toBeInTheDocument();
    expect(screen.getByText(/menu ⋮ do arquivo/)).toBeInTheDocument();
    // Uma fala só: o selo passa a dizer há quanto tempo, sem um segundo "Processando".
    expect(screen.getByText('Lendo há 10 min')).toBeInTheDocument();
    expect(screen.queryByText('Lendo o arquivo…')).not.toBeInTheDocument();
    expect(screen.queryByText(/Processando/)).not.toBeInTheDocument();
  });

  it('caracteres só no arquivo lido; falha sem motivo não tem dois-pontos', () => {
    abrir([
      D('p', { status: 'pending', size_label: null, char_count: 0 }),
      D('f', { status: 'failed', error_message: null, size_label: null, char_count: 0 }),
      D('t', { source_type: 'text', size_label: null, char_count: 42, sendable: false }),
    ]);
    expect(screen.getByText('42 caracteres')).toBeInTheDocument();
    expect(screen.queryByText('0 caracteres')).not.toBeInTheDocument();
    expect(screen.getByText('Falhou')).toBeInTheDocument();
  });

  it('a faixa de soltar diz os limites de verdade (vídeo é menor)', () => {
    abrir([D('a')]);
    expect(screen.getByText(/até 25 MB \(vídeo até 16 MB\)/)).toBeInTheDocument();
  });

  it('sem arquivo, a área de soltar grande diz que está vazio', () => {
    abrir([]);
    expect(screen.getByText('Nenhum arquivo ainda')).toBeInTheDocument();
    expect(screen.getByText(/Arraste arquivos pra cá/)).toBeInTheDocument();
  });

  it('com arquivo, a área de soltar vira faixa (sem o título de vazio)', () => {
    abrir([D('a')]);
    expect(screen.queryByText('Nenhum arquivo ainda')).not.toBeInTheDocument();
    expect(screen.getByText(/Arraste arquivos pra cá/)).toBeInTheDocument();
  });

  it('carregando não mostra vazio; erro tem Tentar de novo', async () => {
    const { a } = abrir([], { estado: 'erro' });
    expect(screen.queryByText('Nenhum arquivo ainda')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(a.carregar).toHaveBeenCalled();
  });

  it('carregando mostra esqueleto, não vazio', () => {
    abrir([], { estado: 'carregando' });
    expect(screen.getByText('Carregando os arquivos').closest('[role="status"]')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Nenhum arquivo ainda')).not.toBeInTheDocument();
  });

  it('clicar no cartão abre a janela; Cancelar fecha sem gravar', async () => {
    abrir([D('a')]);
    await userEvent.click(screen.getByRole('button', { name: /Como ela usa: Arquivo a/ }));
    expect(screen.getByRole('dialog', { name: 'Como ela usa este arquivo' })).toBeInTheDocument();
    // Miolo da janela: grupos com título.
    expect(screen.getByRole('group', { name: 'Arquivo' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Imóveis' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Quando mandar' })).not.toBeInTheDocument();
    // X da casa no topo da janela.
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(S.updateDocument).not.toHaveBeenCalled();
  });

  it('a janela não tem mais o envio (foi pra Materiais) e o Salvar manda só nome, aprende e imóveis', async () => {
    const { a } = abrir([D('a', { property_codes: ['AP1', 'AP2'] })]);
    await userEvent.click(screen.getByRole('button', { name: /Como ela usa: Arquivo a/ }));
    expect(screen.queryByLabelText('Em que situação mandar')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Ela pode mandar pro lead' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver como chega/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Ela aprende com o conteúdo' }));
    expect(S.updateDocument).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(S.updateDocument).toHaveBeenCalledWith('ia-1', 'a', { title: 'Arquivo a', learnable: false, property_codes: ['AP1', 'AP2'] });
    expect(a.carregar).toHaveBeenCalled();
  });

  it('"Ligado a imóveis" grava property_codes sem espaço nem vazio', async () => {
    abrir([D('a')]);
    await userEvent.click(screen.getByRole('button', { name: /Como ela usa: Arquivo a/ }));
    await userEvent.type(screen.getByLabelText('Ligado a imóveis'), ' ab01 , AB02,, ');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(S.updateDocument).toHaveBeenCalled());
    expect(S.updateDocument).toHaveBeenCalledWith('ia-1', 'a', expect.objectContaining({ property_codes: ['ab01', 'AB02'] }));
  });

  it('arquivo sem texto avisa dentro da janela', async () => {
    abrir([D('a', { status: 'no_text' })]);
    await userEvent.click(screen.getByRole('button', { name: /Como ela usa: Arquivo a/ }));
    expect(screen.getByText(/não tem texto pra aprender/)).toBeInTheDocument();
  });

  it('excluir pede confirmação', async () => {
    const { a, confirmar } = abrir([D('a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Ações do arquivo Arquivo a' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Excluir arquivo', rotuloDaAcao: 'Excluir' }));
    await waitFor(() => expect(a.apagar).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' })));
  });

  it('Tentar de novo só em pendente ou falhou', async () => {
    const { a } = abrir([D('a'), D('p', { status: 'pending' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Ações do arquivo Arquivo a' }));
    expect(screen.queryByRole('menuitem', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Ações do arquivo Arquivo p' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tentar de novo' }));
    await waitFor(() => expect(a.reprocessar).toHaveBeenCalledWith(expect.objectContaining({ id: 'p' })));
  });

  it('subir arquivo: relê e avisa a contagem, sem janela de envio', async () => {
    S.uploadFileDocument.mockResolvedValue(D('novo', { title: 'Planta.pdf' }));
    const { a } = abrir([]);
    const arquivo = new File(['x'], 'Planta.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Escolher arquivo'), arquivo);
    await waitFor(() => expect(a.aoCriar).toHaveBeenCalled());
    expect(S.uploadFileDocument).toHaveBeenCalledWith('ia-1', arquivo, undefined, expect.any(Function));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arquivo grande demais solto na área nem sobe', async () => {
    abrir([D('a')]);
    const grande = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(grande, 'size', { value: 30 * 1024 * 1024 });
    fireEvent.drop(screen.getByText(/Arraste arquivos pra cá/), { dataTransfer: { files: [grande] } });
    expect(S.uploadFileDocument).not.toHaveBeenCalled();
  });

  it('Escrever texto cria o texto e relê', async () => {
    const { a } = abrir([]);
    await userEvent.click(screen.getByRole('button', { name: 'Escrever texto' }));
    const janela = screen.getByRole('dialog', { name: 'Escrever texto' });
    expect(janela).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Ela aprende com o conteúdo' })).toBeChecked();
    await userEvent.type(screen.getByLabelText('Nome'), 'Formas de pagamento');
    await userEvent.type(screen.getByLabelText('Texto'), 'Aceitamos FGTS na entrada.');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(S.createTextDocument).toHaveBeenCalledWith('ia-1', 'Formas de pagamento', 'Aceitamos FGTS na entrada.');
    expect(a.aoCriar).toHaveBeenCalled();
  });

  it('a prova social mora na mesma página: um caso por linha', () => {
    abrir([D('a')], {}, '300 famílias\nNota 4,9');
    expect(screen.getByText('300 famílias')).toBeInTheDocument();
    expect(screen.getByText('Nota 4,9')).toBeInTheDocument();
  });

  it('adicionar caso grava o texto inteiro com o novo no fim (só social_proof)', async () => {
    const { gravar } = abrir([], {}, 'A');
    await userEvent.type(screen.getByLabelText('Novo caso'), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(gravar).toHaveBeenCalledWith({ social_proof: 'A\nB' });
  });

  it('excluir o único caso grava vazio (null), depois de confirmar', async () => {
    const { gravar, confirmar } = abrir([], {}, 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Ações do caso 1' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Excluir caso' }));
    await waitFor(() => expect(gravar).toHaveBeenCalledWith({ social_proof: null }));
  });

  it('editar caso grava a lista com o texto trocado', async () => {
    const { gravar } = abrir([], {}, 'A\nB');
    await userEvent.click(screen.getByRole('button', { name: 'Ações do caso 2' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const campo = screen.getByLabelText('Editar caso');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'B2');
    await userEvent.click(screen.getByRole('button', { name: 'Pronto' }));
    expect(gravar).toHaveBeenCalledWith({ social_proof: 'A\nB2' });
  });
});
