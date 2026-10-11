import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
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

function abrir(docs: SalesAgentDocument[], extra: Partial<ArquivosDaIa> = {}) {
  const a: ArquivosDaIa = { docs, estado: 'pronto', carregar: vi.fn().mockResolvedValue(undefined), apagar: vi.fn().mockResolvedValue(true),
    reprocessar: vi.fn().mockResolvedValue(undefined), aoCriar: vi.fn().mockResolvedValue(undefined), ...extra };
  const confirmar = vi.fn().mockResolvedValue(true);
  const r = render(<Arquivos agent={agenteDeTeste()} gravar={vi.fn()} licoes={{} as never} arquivos={a} irPara={vi.fn()} confirmar={confirmar} />);
  return { a, confirmar, container: r.container };
}

const S = vi.mocked(salesAgentsService);

describe('Arquivos', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('cartão com selos e o "quando"', () => {
    abrir([D('a')]);
    expect(screen.getByText('Arquivo a')).toBeInTheDocument();
    expect(screen.getByText('Aprende')).toBeInTheDocument();
    expect(screen.getByText('Manda pro lead')).toBeInTheDocument();
    expect(screen.getByText(/Manda quando pedir/)).toBeInTheDocument();
  });

  it('manda sem "quando" vira pendência no cartão', () => {
    abrir([D('a', { send_when: '' })]);
    expect(screen.getByText('Falta dizer quando mandar')).toBeInTheDocument();
  });

  it('selos de envio e de leitura', () => {
    abrir([
      D('l', { send_mode: 'link' }),
      D('b', { send_mode: 'blocked' }),
      D('p', { status: 'pending' }),
      D('n', { status: 'no_text' }),
      D('f', { status: 'failed', error_message: 'arquivo corrompido' }),
      D('t', { source_type: 'text', size_label: null, char_count: 1234, sendable: false }),
    ]);
    expect(screen.getByText('Vai como link')).toBeInTheDocument();
    expect(screen.getByText('Grande demais')).toBeInTheDocument();
    expect(screen.getByText('Lendo o arquivo…')).toBeInTheDocument();
    expect(screen.getByText('Sem texto pra aprender')).toBeInTheDocument();
    expect(screen.getByText('Falhou: arquivo corrompido')).toBeInTheDocument();
    expect(screen.getByText('1.234 caracteres')).toBeInTheDocument();
    // "Aprende" só com o arquivo lido (pronto); o pendente, o sem texto e o que falhou não.
    expect(screen.getAllByText('Aprende')).toHaveLength(3);
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
    // X da casa no topo da janela.
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(S.updateDocument).not.toHaveBeenCalled();
  });

  it('as chaves da janela só gravam no Salvar, com o mesmo pacote de hoje', async () => {
    const { a } = abrir([D('a', { send_topics: ['planta'], property_codes: ['AP1', 'AP2'], send_caption: 'segue' })]);
    await userEvent.click(screen.getByRole('button', { name: /Como ela usa: Arquivo a/ }));
    await userEvent.click(screen.getByRole('switch', { name: 'No máximo uma vez por conversa' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Ela aprende com o conteúdo' }));
    expect(S.updateDocument).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Quando mandar'));
    await userEvent.type(screen.getByLabelText('Quando mandar'), '  quando pedir a planta  ');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(S.updateDocument).toHaveBeenCalledWith('ia-1', 'a', {
      title: 'Arquivo a', sendable: true, learnable: false, send_once: true,
      send_when: 'quando pedir a planta', send_when_not: '', send_caption: 'segue',
      send_topics: ['planta'], property_codes: ['AP1', 'AP2'],
    });
    expect(a.carregar).toHaveBeenCalled();
  });

  it('desligar "Ela pode mandar pro lead" esconde as perguntas de envio', async () => {
    abrir([D('a')]);
    await userEvent.click(screen.getByRole('button', { name: /Como ela usa: Arquivo a/ }));
    expect(screen.getByLabelText('Quando mandar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver como chega no meu WhatsApp/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Ela pode mandar pro lead' }));
    expect(screen.queryByLabelText('Quando mandar')).not.toBeInTheDocument();
    expect(S.updateDocument).not.toHaveBeenCalled();
  });

  it('arquivo bloqueado não tem "Ver como chega" e explica por quê', async () => {
    abrir([D('a', { send_mode: 'blocked', size_label: '90 MB' })]);
    await userEvent.click(screen.getByRole('button', { name: /Como ela usa: Arquivo a/ }));
    expect(screen.queryByRole('button', { name: /Ver como chega no meu WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Arquivo grande demais \(90 MB\)/)).toBeInTheDocument();
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

  it('subir arquivo: relê, avisa a contagem e abre a janela do arquivo novo', async () => {
    S.uploadFileDocument.mockResolvedValue(D('novo', { title: 'Planta.pdf', send_when: '' }));
    const { a } = abrir([]);
    const arquivo = new File(['x'], 'Planta.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Escolher arquivo'), arquivo);
    expect(await screen.findByRole('dialog', { name: 'Como ela usa este arquivo' })).toBeInTheDocument();
    expect(S.uploadFileDocument).toHaveBeenCalledWith('ia-1', arquivo, undefined, expect.any(Function));
    expect(a.aoCriar).toHaveBeenCalled();
    expect(screen.getByLabelText('Nome')).toHaveValue('Planta.pdf');
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
});
