import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState, { TEXTO_ERRO, TEXTO_SEM_RESULTADO } from './EmptyState';

describe('EmptyState: quatro casos, nunca confundidos', () => {
  it('vazio (padrão): título, frase, exemplo imobiliário e botão de criar', async () => {
    const criar = vi.fn();
    render(
      <EmptyState
        title="Nenhum lembrete ainda"
        description="Lembretes mandam uma mensagem no WhatsApp na hora certa."
        exemplo="Lembrar o corretor da visita de amanhã"
        action={{ label: 'Novo lembrete', onClick: criar }}
      />,
    );
    expect(screen.getByText('Nenhum lembrete ainda')).toBeInTheDocument();
    expect(screen.getByText('Lembrar o corretor da visita de amanhã')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Novo lembrete' }));
    expect(criar).toHaveBeenCalled();
  });

  it('erro: é alerta, diz que o que existe continua salvo e oferece tentar de novo', async () => {
    const tentar = vi.fn();
    render(<EmptyState tipo="erro" aoTentarDeNovo={tentar} />);
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO_ERRO.title);
    await userEvent.click(screen.getByRole('button', { name: TEXTO_ERRO.acao }));
    expect(tentar).toHaveBeenCalled();
  });

  it('sem resultado: oferece limpar filtros', async () => {
    const limpar = vi.fn();
    render(<EmptyState tipo="semResultado" aoLimparFiltros={limpar} />);
    expect(screen.getByText(TEXTO_SEM_RESULTADO.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TEXTO_SEM_RESULTADO.acao }));
    expect(limpar).toHaveBeenCalled();
  });

  it('continua aceitando o uso antigo (título + descrição, sem tipo)', () => {
    render(<EmptyState title="Nenhuma etiqueta" description="Crie a primeira." />);
    expect(screen.getByText('Nenhuma etiqueta')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('EmptyState compacto: caixa tracejada pra dentro de bloco', () => {
  it('frase e ação em link roxo ao lado, sem ícone grande', async () => {
    const criar = vi.fn();
    const { container } = render(
      <EmptyState tamanho="compacto" title="Nenhuma visita com este lead ainda." action={{ label: 'Agendar visita', onClick: criar }} />,
    );
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa.className).toContain('border-dashed');
    expect(caixa).toHaveTextContent('Nenhuma visita com este lead ainda. Agendar visita');
    expect(container.querySelector('h3')).toBeNull();
    const link = screen.getByRole('button', { name: 'Agendar visita' });
    expect(link.className).toContain('text-primary');
    await userEvent.click(link);
    expect(criar).toHaveBeenCalled();
  });

  it('erro compacto é alerta, com "Tentar de novo" ao lado da frase', async () => {
    const tentar = vi.fn();
    render(<EmptyState tamanho="compacto" tipo="erro" aoTentarDeNovo={tentar} />);
    expect(screen.getByRole('alert')).toHaveTextContent(`${TEXTO_ERRO.title}. ${TEXTO_ERRO.acao}`);
    await userEvent.click(screen.getByRole('button', { name: TEXTO_ERRO.acao }));
    expect(tentar).toHaveBeenCalled();
  });

  it('sem resultado compacto oferece limpar filtros', () => {
    render(<EmptyState tamanho="compacto" tipo="semResultado" aoLimparFiltros={() => {}} />);
    expect(screen.getByRole('button', { name: TEXTO_SEM_RESULTADO.acao })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
