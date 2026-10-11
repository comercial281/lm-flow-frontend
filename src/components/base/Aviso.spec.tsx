import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bell } from 'lucide-react';
import Aviso from './Aviso';
import Faixa from './Faixa';

describe('Aviso: caixa de aviso da casa', () => {
  it('título em negrito abre a frase quando o texto é simples', () => {
    render(<Aviso tom="atencao" titulo="WhatsApp desconectado.">Reconecte pra voltar a receber mensagens.</Aviso>);
    const caixa = screen.getByRole('status');
    expect(caixa).toHaveTextContent('WhatsApp desconectado. Reconecte pra voltar a receber mensagens.');
    expect(screen.getByText('WhatsApp desconectado.').tagName).toBe('STRONG');
  });

  it('cada tom tem sua cor e seu ícone', () => {
    const { container, rerender } = render(<Aviso tom="sucesso">Integração ligada.</Aviso>);
    expect(screen.getByRole('status').className).toContain('bg-emerald-500/10');
    expect(container.querySelector('svg.lucide-circle-check')).not.toBeNull();
    rerender(<Aviso tom="atencao">Atenção.</Aviso>);
    expect(container.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
  });

  it('erro é anunciado na hora pro leitor de tela', () => {
    render(<Aviso tom="erro">Não deu pra salvar.</Aviso>);
    expect(screen.getByRole('alert')).toHaveTextContent('Não deu pra salvar.');
  });

  it('troca o ícone, tira o ícone e mostra a ação', () => {
    const { container, rerender } = render(<Aviso icone={Bell}>Lembrete.</Aviso>);
    expect(container.querySelector('svg.lucide-bell')).not.toBeNull();
    rerender(<Aviso icone={null} acao={<button type="button">Reconectar</button>}>Sem ícone.</Aviso>);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reconectar' })).toBeInTheDocument();
  });

  it('conteúdo montado vem abaixo do título', () => {
    render(<Aviso titulo="Como funciona"><ul><li>Passo 1</li></ul></Aviso>);
    expect(screen.getByText('Como funciona').tagName).toBe('P');
    expect(screen.getByText('Passo 1')).toBeInTheDocument();
  });
});

describe('Faixa: aviso que atravessa a tela', () => {
  it('mostra o texto e a ação à direita, com a cor do tom', () => {
    render(<Faixa acao={<button type="button">Ver ofertas</button>}>2 leads esperando você aceitar</Faixa>);
    const faixa = screen.getByRole('status');
    expect(faixa).toHaveTextContent('2 leads esperando você aceitar');
    expect(faixa.className).toContain('border-b');
    expect(faixa.className).toContain('bg-amber-500/10');
    expect(screen.getByRole('button', { name: 'Ver ofertas' })).toBeInTheDocument();
  });
});
