import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaPaginas from './TelaPaginas';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';

vi.mock('@/services/siteBuilder/siteBuilderService', () => ({
  siteBuilderService: {
    listPages: vi.fn(), createPage: vi.fn(), updatePage: vi.fn(), deletePage: vi.fn(),
    createPageFromTemplate: vi.fn(), uploadAsset: vi.fn(),
  },
}));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const site = { id: 's1' } as never;
const pagina = {
  id: 'p1', site_id: 's1', title: 'Sobre nós', slug: 'sobre-nos', page_kind: 'portal_static',
  content_html: '<p>Somos a XYZ</p>', active: true, in_menu: true, menu_position: 0,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

const erroDaApi = (status: number, message: string, details?: Record<string, string>) =>
  Object.assign(new Error(message), { response: { status, data: { success: false, error: { code: 'X', message, details } } } });

const editor = () => document.querySelector('.prosemirror-editor') as HTMLElement;

async function abrirEdicao() {
  render(<TelaPaginas site={site} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Editar página' }));
  await waitFor(() => expect(editor().innerHTML).toContain('Somos a XYZ'));
}

describe('TelaPaginas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(siteBuilderService.listPages).mockResolvedValue([pagina] as never);
    vi.mocked(siteBuilderService.updatePage).mockResolvedValue(pagina as never);
  });

  it('o HTML antigo abre no editor (h1 vira título, h4 vira subtítulo, script some)', async () => {
    vi.mocked(siteBuilderService.listPages).mockResolvedValue([{
      ...pagina, content_html: '<h1>Quem somos</h1><h4>Equipe</h4><p>Texto <b>forte</b></p><script>alert(1)</script>',
    }] as never);
    render(<TelaPaginas site={site} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar página' }));
    await waitFor(() => expect(editor().innerHTML).toContain('Quem somos'));
    expect(editor().querySelector('h2')?.textContent).toBe('Quem somos');
    expect(editor().querySelector('h3')?.textContent).toBe('Equipe');
    expect(editor().querySelector('strong')?.textContent).toBe('forte');
    expect(editor().innerHTML).not.toContain('alert');
  });

  it('abrir e salvar sem mexer no conteúdo não manda content_html', async () => {
    await abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(siteBuilderService.updatePage).toHaveBeenCalled());
    const enviado = vi.mocked(siteBuilderService.updatePage).mock.calls[0][2];
    expect(enviado).not.toHaveProperty('content_html');
    expect(enviado).toMatchObject({ title: 'Sobre nós', slug: 'sobre-nos', active: true, in_menu: true });
  });

  it('o editor grava HTML: virar título e salvar manda o content_html novo', async () => {
    await abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Título' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(siteBuilderService.updatePage).toHaveBeenCalled());
    expect(vi.mocked(siteBuilderService.updatePage).mock.calls[0][2]).toMatchObject({ content_html: '<h2>Somos a XYZ</h2>' });
  });

  it('a barra da página tem título, subtítulo, listas, citação, link e imagem, e não tem código', async () => {
    await abrirEdicao();
    for (const nome of ['Título', 'Subtítulo', 'Lista numerada', 'Citação', 'Imagem']) {
      expect(screen.getByRole('button', { name: nome })).toBeTruthy();
    }
    expect(screen.getByTitle('Transformar a seleção em link')).toBeTruthy();
    expect(screen.getByTitle('richTextEditor.toolbar.bulletList')).toBeTruthy();
    expect(screen.queryByTitle('richTextEditor.toolbar.code')).toBeNull();
  });

  it('imagem por endereço entra no conteúdo; endereço sem https avisa', async () => {
    await abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Imagem' }));
    await userEvent.type(screen.getByLabelText('Endereço da imagem'), 'www.foto.com/a.jpg');
    expect(screen.getByText(/Use um endereço que comece com https:\/\//)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Pôr a imagem' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.clear(screen.getByLabelText('Endereço da imagem'));
    await userEvent.type(screen.getByLabelText('Endereço da imagem'), 'https://cdn.x/fachada.jpg');
    await userEvent.type(screen.getByLabelText('Descrição da imagem'), 'Fachada');
    await userEvent.click(screen.getByRole('button', { name: 'Pôr a imagem' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(siteBuilderService.updatePage).toHaveBeenCalled());
    expect(vi.mocked(siteBuilderService.updatePage).mock.calls[0][2].content_html)
      .toContain('<img src="https://cdn.x/fachada.jpg" alt="Fachada">');
  });

  it('imagem enviada do computador sobe pelo uploadAsset e entra no conteúdo', async () => {
    vi.mocked(siteBuilderService.uploadAsset).mockResolvedValue({ url: 'https://cdn.x/enviada.png' });
    await abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Imagem' }));
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: imagem da página'), new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(editor().querySelector('img')?.getAttribute('src')).toBe('https://cdn.x/enviada.png'));
  });

  it('passou de 200 KB: o aviso aparece na janela e ela continua aberta', async () => {
    vi.mocked(siteBuilderService.updatePage).mockRejectedValue(
      erroDaApi(422, 'O conteúdo da página passou do limite de 200 KB. Divida em mais de uma página.'));
    await abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Título' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',
      'O conteúdo da página passou do limite de 200 KB. Divida em mais de uma página.');
    expect(screen.getByRole('dialog', { name: 'Editar página' })).toBeTruthy();
  });

  it('estrutura que não dá pra salvar também vira aviso na janela', async () => {
    vi.mocked(siteBuilderService.updatePage).mockRejectedValue(
      erroDaApi(422, 'O conteúdo da página tem uma estrutura que não dá pra salvar.'));
    await abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Título' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/estrutura que não dá pra salvar/);
  });

  it('salvar avisa o pai (o menu acompanha), com o endereço antigo', async () => {
    const aoMudarPagina = vi.fn();
    render(<TelaPaginas site={site} aoMudarPagina={aoMudarPagina} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar página' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(aoMudarPagina).toHaveBeenCalledWith({ tipo: 'salva', pagina, slugAntigo: 'sobre-nos' }));
  });

  it('excluir pede confirmação e avisa o pai', async () => {
    const aoMudarPagina = vi.fn();
    vi.mocked(siteBuilderService.deletePage).mockResolvedValue(undefined);
    render(<TelaPaginas site={site} aoMudarPagina={aoMudarPagina} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir página' }));
    expect(siteBuilderService.deletePage).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(siteBuilderService.deletePage).toHaveBeenCalledWith('s1', 'p1'));
    expect(aoMudarPagina).toHaveBeenCalledWith({ tipo: 'excluida', slug: 'sobre-nos' });
  });

  it('a lista relê quando o menu foi salvo (versaoDasPaginas muda)', async () => {
    const { rerender } = render(<TelaPaginas site={site} versaoDasPaginas={0} />);
    await waitFor(() => expect(siteBuilderService.listPages).toHaveBeenCalledTimes(1));
    rerender(<TelaPaginas site={site} versaoDasPaginas={1} />);
    await waitFor(() => expect(siteBuilderService.listPages).toHaveBeenCalledTimes(2));
  });

  describe('Nova página: em branco ou modelo', () => {
    it('as três opções aparecem; em branco abre o editor e cria com o content_html', async () => {
      vi.mocked(siteBuilderService.createPage).mockResolvedValue({ ...pagina, id: 'p2', slug: 'nova' } as never);
      render(<TelaPaginas site={site} />);
      await screen.findByText('Sobre nós');
      await userEvent.click(screen.getByRole('button', { name: 'Nova página' }));
      const escolha = screen.getByRole('dialog', { name: 'Nova página' });
      for (const nome of [/Em branco/, /Sobre nós/, /Política de privacidade/]) {
        expect(within(escolha).getByRole('button', { name: nome })).toBeTruthy();
      }
      await userEvent.click(within(escolha).getByRole('button', { name: /Em branco/ }));
      await userEvent.type(screen.getByLabelText('Título *'), 'Nova');
      await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
      await waitFor(() => expect(siteBuilderService.createPage).toHaveBeenCalled());
      const enviado = vi.mocked(siteBuilderService.createPage).mock.calls[0][1];
      expect(enviado).toHaveProperty('content_html');
      // Entra depois das que já existem (menu_position da última + 1).
      expect(enviado.menu_position).toBe(1);
    });

    it('Sobre nós chama o modelo e abre a página criada pra revisar', async () => {
      const criada = { ...pagina, id: 'p3', slug: 'sobre-nos-2', active: false, in_menu: false, content_html: '<h2>Sobre a Imob</h2>' };
      vi.mocked(siteBuilderService.createPageFromTemplate).mockResolvedValue(criada as never);
      const aoMudarPagina = vi.fn();
      render(<TelaPaginas site={site} aoMudarPagina={aoMudarPagina} />);
      await screen.findByText('Sobre nós');
      await userEvent.click(screen.getByRole('button', { name: 'Nova página' }));
      await userEvent.click(screen.getByRole('button', { name: /Sobre nós/ }));
      await waitFor(() => expect(siteBuilderService.createPageFromTemplate).toHaveBeenCalledWith('s1', 'about', undefined));
      expect(aoMudarPagina).toHaveBeenCalledWith({ tipo: 'salva', pagina: criada });
      await waitFor(() => expect(editor().querySelector('h2')?.textContent).toBe('Sobre a Imob'));
    });

    it('Política de privacidade pede o CPF ou CNPJ e chama o modelo com o document', async () => {
      vi.mocked(siteBuilderService.createPageFromTemplate).mockResolvedValue(
        { ...pagina, id: 'p4', slug: 'politica-de-privacidade', active: false, in_menu: false } as never);
      render(<TelaPaginas site={site} />);
      await screen.findByText('Sobre nós');
      await userEvent.click(screen.getByRole('button', { name: 'Nova página' }));
      await userEvent.click(screen.getByRole('button', { name: /Política de privacidade/ }));
      expect(siteBuilderService.createPageFromTemplate).not.toHaveBeenCalled();
      // Sem documento, nem chama o servidor.
      await userEvent.click(screen.getByRole('button', { name: 'Criar a política' }));
      expect(screen.getByText('Informe o CPF ou o CNPJ.')).toBeTruthy();
      expect(siteBuilderService.createPageFromTemplate).not.toHaveBeenCalled();
      await userEvent.type(screen.getByLabelText('CPF ou CNPJ'), '11.222.333/0001-81');
      await userEvent.click(screen.getByRole('button', { name: 'Criar a política' }));
      await waitFor(() => expect(siteBuilderService.createPageFromTemplate)
        .toHaveBeenCalledWith('s1', 'privacy', '11.222.333/0001-81'));
    });

    it('documento inválido: o erro do servidor (field document) aparece no campo', async () => {
      vi.mocked(siteBuilderService.createPageFromTemplate).mockRejectedValue(
        erroDaApi(422, 'Informe um CPF ou CNPJ válido.', { field: 'document' }));
      render(<TelaPaginas site={site} />);
      await screen.findByText('Sobre nós');
      await userEvent.click(screen.getByRole('button', { name: 'Nova página' }));
      await userEvent.click(screen.getByRole('button', { name: /Política de privacidade/ }));
      await userEvent.type(screen.getByLabelText('CPF ou CNPJ'), '123');
      await userEvent.click(screen.getByRole('button', { name: 'Criar a política' }));
      expect(await screen.findByText('Informe um CPF ou CNPJ válido.')).toBeTruthy();
      expect(screen.getByLabelText('CPF ou CNPJ').getAttribute('aria-invalid')).toBe('true');
    });

    it('409 vira frase amigável', async () => {
      vi.mocked(siteBuilderService.createPageFromTemplate).mockRejectedValue(
        erroDaApi(409, 'PG::UniqueViolation: duplicate key value'));
      render(<TelaPaginas site={site} />);
      await screen.findByText('Sobre nós');
      await userEvent.click(screen.getByRole('button', { name: 'Nova página' }));
      await userEvent.click(screen.getByRole('button', { name: /Sobre nós/ }));
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Outra página acabou de ser criada com o mesmo endereço. Tente de novo em instantes.');
    });
  });
});
