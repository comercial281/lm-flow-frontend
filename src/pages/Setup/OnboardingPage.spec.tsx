import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OnboardingPage from './OnboardingPage';

// Primeiro acesso: a primeira tela que todo cliente novo vê. Estilo todo inline
// e escuro, que não segue o tema do app.
const OPCOES: Record<string, string[]> = {
  'survey.teamSize.options': ['Só eu', '2 a 5 pessoas'],
  'survey.channel.options': ['WhatsApp', 'Outro'],
};
const t = (chave: string) => OPCOES[chave] ?? (chave === 'survey.channel.other' ? 'Outro' : chave);
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, refreshUser: vi.fn() }) }));
vi.mock('@/services/setup/setupService', () => ({ setupService: { saveSurvey: vi.fn() } }));
vi.mock('@/services/survey/surveyService', () => ({ surveyService: { saveSurvey: vi.fn() } }));
vi.mock('@/components/AppLogo', () => ({ AppLogo: () => null }));

const tela = () => render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

describe('Primeiro acesso no celular (e sem matchMedia)', () => {
  it('continua o <select> de hoje, com o estilo escuro inline', () => {
    tela();
    const caixa = screen.getByLabelText('survey.teamSize.label');
    expect(caixa.tagName).toBe('SELECT');
    expect(caixa.style.height).toBe('40px');
  });
});

describe('Primeiro acesso no computador', () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false, media: '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
    delete window.matchMedia;
  });

  it('a caixa tem a cara de hoje e uma seta só (a da tela)', () => {
    tela();
    const caixa = screen.getByLabelText('survey.teamSize.label');
    expect(caixa.tagName).toBe('BUTTON');
    expect(caixa.style.height).toBe('40px');
    expect(caixa.style.width).toBe('100%');
    // bare: a seta do design system some; fica a seta desenhada pela tela.
    expect(caixa.className).toContain('[&>svg:last-child]:hidden');
    expect(caixa).toHaveTextContent('Selecionar...');
  });

  it('a lista abre escura e as opções sem fundo inline (o realce do mouse aparece)', async () => {
    tela();
    await userEvent.click(screen.getByLabelText('survey.teamSize.label'));
    expect(await screen.findByRole('listbox')).toHaveClass('dark');
    const opcao = screen.getByRole('option', { name: 'Só eu' });
    expect(opcao.style.background).toBe('');
    expect(opcao.style.color).toBe('');
  });

  it('escolher grava e conta no progresso', async () => {
    tela();
    expect(screen.getByText(/^0 survey\.progress\.of 6$/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('survey.teamSize.label'));
    await userEvent.click(await screen.findByRole('option', { name: '2 a 5 pessoas' }));
    expect(screen.getByLabelText('survey.teamSize.label')).toHaveTextContent('2 a 5 pessoas');
    expect(screen.getByText(/^1 survey\.progress\.of 6$/)).toBeInTheDocument();
  });

  it('"Outro" no canal abre o campo livre e o foco vai para ele, como antes', async () => {
    tela();
    await userEvent.click(screen.getByLabelText('survey.channel.label'));
    await userEvent.click(await screen.findByRole('option', { name: 'Outro' }));
    const campo = screen.getByPlaceholderText('survey.channel.otherPlaceholder');
    // A lista do produto devolve o foco ao botão ao fechar; o campo tem que ganhar.
    await waitFor(() => expect(campo).toHaveFocus());
    // E continua nele depois que a lista termina de fechar (onCloseAutoFocus).
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 300));
    expect(campo).toHaveFocus();
  });

  it('com "Outro" já escolhido, reabrir a lista e fechar com Esc devolve o foco ao botão, não ao campo', async () => {
    tela();
    const botao = screen.getByLabelText('survey.channel.label');
    await userEvent.click(botao);
    await userEvent.click(await screen.findByRole('option', { name: 'Outro' }));
    const campo = screen.getByPlaceholderText('survey.channel.otherPlaceholder');
    await waitFor(() => expect(campo).toHaveFocus());
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await userEvent.click(botao);
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitFor(() => expect(botao).toHaveFocus());
    expect(campo).not.toHaveFocus();
  });

  it('o foco pinta a borda verde no botão, como pintava no select', () => {
    tela();
    const caixa = screen.getByLabelText('survey.teamSize.label');
    caixa.focus();
    expect(caixa.style.borderColor).toBe('rgb(0, 255, 167)');
    caixa.blur();
    expect(caixa.style.borderColor).toBe('rgb(39, 39, 42)');
  });
});
