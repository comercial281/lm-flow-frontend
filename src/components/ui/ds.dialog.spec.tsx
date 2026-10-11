import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ds';

/* Janela da casa (peça 17 do GLOSSARIO, escolha do dono em 10/10/2026): topo e
   rodapé fixos com só o meio rolando, e no celular a janela sobe de baixo. Tudo
   mora no ajuste da casa (ds.tsx); as janelas do app herdam sem mexer nelas. */

function Janela({
  className,
  size,
  comTopo = true,
  comRodape = true,
  showCloseButton,
  onOpenChange = vi.fn(),
}: {
  className?: string;
  size?: 'default' | 'wide';
  comTopo?: boolean;
  comRodape?: boolean;
  showCloseButton?: boolean;
  onOpenChange?: (aberta: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={className} size={size} showCloseButton={showCloseButton}>
        {comTopo ? (
          <DialogHeader>
            <DialogTitle>Novo lead</DialogTitle>
            <DialogDescription>Cadastre quem chegou por fora.</DialogDescription>
          </DialogHeader>
        ) : (
          <DialogTitle>Novo lead</DialogTitle>
        )}
        <label>
          Nome
          <input />
        </label>
        {comRodape && (
          <DialogFooter>
            <button type="button">Cancelar</button>
            <button type="button">Criar</button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

const caixa = () => screen.getByRole('dialog', { name: 'Novo lead' });
const topo = () => caixa().querySelector('[data-slot="dialog-header"]') as HTMLElement;
const rodape = () => caixa().querySelector('[data-slot="dialog-footer"]') as HTMLElement;

describe('Janela da casa: topo e rodapé fixos, só o meio rola', () => {
  it('a caixa limita a altura e rola por dentro, publicando o respiro pro topo e o rodapé', () => {
    render(<Janela />);
    expect(caixa()).toHaveClass('max-h-[90dvh]', 'overflow-y-auto', '[--janela-p:1.5rem]');
  });

  it('o topo fica preso em cima, com fundo e linha, ocupando a largura toda', () => {
    render(<Janela />);
    expect(topo()).toHaveClass('sticky', 'top-0', 'z-10', 'border-b', 'bg-background', 'px-[max(var(--janela-p),1.5rem)]', 'py-4');
    expect(topo()).toHaveClass('-mx-(--janela-p)', '-mt-(--janela-p)');
  });

  it('o rodapé fica preso embaixo, com fundo e linha, e respeita a barra de gestos do celular', () => {
    render(<Janela />);
    expect(rodape()).toHaveClass('sticky', 'bottom-0', 'z-10', 'border-t', 'bg-background', 'px-[max(var(--janela-p),1.5rem)]', 'py-4');
    expect(rodape()).toHaveClass('-mx-(--janela-p)', '-mb-(--janela-p)');
    expect(rodape()).toHaveClass('max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]');
  });

  it('o X mora no topo (pra não rolar pra fora), se chama "Fechar" e fecha', async () => {
    const onOpenChange = vi.fn();
    render(<Janela onOpenChange={onOpenChange} />);
    const fechar = within(topo()).getByRole('button', { name: 'Fechar' });
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(1);
    expect(topo()).toHaveClass('pr-12');
    await userEvent.click(fechar);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ao abrir, o foco vai pro primeiro campo, não pro X do topo', () => {
    render(<Janela />);
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveFocus();
  });

  it('sem topo, o X continua no canto da caixa', () => {
    render(<Janela comTopo={false} />);
    const fechar = screen.getByRole('button', { name: 'Fechar' });
    expect(fechar.parentElement).toBe(caixa());
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveFocus();
  });

  it('showCloseButton={false} continua tirando o X', () => {
    render(<Janela showCloseButton={false} />);
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull();
    expect(topo()).not.toHaveClass('pr-12');
  });

  it('janela com rolagem própria manda: nada de rolagem dupla', () => {
    render(<Janela className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" />);
    expect(caixa()).not.toHaveClass('overflow-y-auto');
    expect(caixa()).not.toHaveClass('max-h-[90dvh]');
    expect(caixa()).toHaveClass('overflow-hidden', 'max-h-[80vh]');
  });

  it('janela que cuida do próprio respiro (p-0) zera o recuo do topo e do rodapé', () => {
    render(<Janela className="max-w-2xl p-0" />);
    expect(caixa().style.getPropertyValue('--janela-p')).toBe('0rem');
    expect(caixa()).not.toHaveClass('[--janela-p:1.5rem]');
  });

  it('a larga (size="wide") mantém o preset dela e acompanha o respiro que muda por tela', () => {
    render(<Janela size="wide" />);
    expect(caixa()).toHaveClass('sm:max-w-[1400px]', 'max-h-[92dvh]', 'overflow-y-auto', 'p-5', 'sm:p-6', 'lg:p-8');
    expect(caixa()).toHaveClass('[--janela-p:1.25rem]', 'sm:[--janela-p:1.5rem]', 'lg:[--janela-p:2rem]');
    expect(caixa()).not.toHaveClass('max-h-[90dvh]');
  });

  it('as larguras pequena e grande viram teto inline (ganha do sm:max-w-lg do pacote)', () => {
    const { unmount } = render(<Janela className="max-w-md" />);
    expect(caixa().style.maxWidth).toBe('28rem');
    unmount();
    render(<Janela className="max-w-2xl" />);
    expect(caixa().style.maxWidth).toBe('42rem');
  });

  it('DialogHeader e DialogFooter fora de uma janela continuam os do pacote', () => {
    render(
      <div>
        <DialogHeader data-testid="topo-solto">t</DialogHeader>
        <DialogFooter data-testid="rodape-solto">r</DialogFooter>
      </div>,
    );
    expect(screen.getByTestId('topo-solto')).not.toHaveClass('sticky');
    expect(screen.getByTestId('rodape-solto')).not.toHaveClass('sticky');
  });
});

describe('Janela da casa no celular: sobe de baixo', () => {
  it('abaixo de 640px fica presa embaixo, com a largura inteira, cantos de cima e até 92dvh', () => {
    render(<Janela className="max-w-md" />);
    expect(caixa()).toHaveClass(
      'max-sm:top-auto',
      'max-sm:bottom-0',
      'max-sm:left-0',
      'max-sm:translate-x-0',
      'max-sm:translate-y-0',
      'max-sm:w-full',
      'max-sm:max-w-none!',
      'max-sm:max-h-[92dvh]',
      'max-sm:rounded-t-2xl',
      'max-sm:rounded-b-none',
      'max-sm:data-[state=open]:motion-safe:animate-janela-sobe',
    );
  });

  it('tem a alcinha cinza no topo, só de enfeite', () => {
    render(<Janela />);
    const alca = caixa().querySelector('[data-janela-alca]') as HTMLElement;
    expect(alca).toHaveAttribute('aria-hidden', 'true');
    expect(alca).toHaveClass('sm:hidden', 'rounded-full');
  });

  it('a confirmação (AlertDialogContent da casa) também sobe de baixo', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent className="max-w-md">
          <AlertDialogTitle>Excluir etiqueta?</AlertDialogTitle>
          <AlertDialogDescription>Ela sai de todas as conversas.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const confirmacao = screen.getByRole('alertdialog', { name: 'Excluir etiqueta?' });
    expect(confirmacao).toHaveClass('max-sm:bottom-0', 'max-sm:rounded-t-2xl', 'max-h-[90dvh]', 'overflow-y-auto');
    expect(confirmacao.style.maxWidth).toBe('28rem');
    expect(confirmacao.querySelector('[data-janela-alca]')).not.toBeNull();
  });
});
