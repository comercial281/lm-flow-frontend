// Menu "⋯" do card × roleta nova (06/10/2026): "Mandar pra roleta" escolhe uma
// roleta LIGADA (o card nunca cria roleta); sem nenhuma, leva pra página da
// roleta. "Tirar da roleta" só com oferta esperando aceite.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CardMoreMenu from './CardMoreMenu';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({ pipelinesService: { removeItemFromPipeline: vi.fn() } }));

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const item = { id: 'pi-1', pipeline_id: 'p1', contact: { id: 'c1', name: 'Maria' } } as never;
const roleta = { id: 'r1', name: 'Zona Sul', is_active: true } as never;

function montar(props: Partial<Parameters<typeof CardMoreMenu>[0]> = {}) {
  const onTrocarRoleta = vi.fn();
  render(
    <MemoryRouter initialEntries={['/pipelines/p1']}>
      <Routes>
        <Route path="/pipelines/p1" element={
          <CardMoreMenu item={item} roletas={[roleta]} trocandoRoleta={false} onTrocarRoleta={onTrocarRoleta}
            onRemovido={vi.fn()} {...props} />
        } />
        <Route path="/automations/roleta-config" element={<p>Página da roleta</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onTrocarRoleta };
}

const abrirMenu = () => userEvent.click(screen.getByRole('button', { name: 'Mais ações do card' }));

describe('CardMoreMenu · roleta', () => {
  it('"Mandar pra roleta" escolhe uma roleta ligada e manda', async () => {
    const { onTrocarRoleta } = montar();
    await abrirMenu();
    expect(screen.queryByRole('menuitem', { name: /Trocar roleta/ })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mandar pra roleta' }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('A roleta escolhida oferece o lead a um corretor.');
    await userEvent.click(screen.getByRole('combobox', { name: 'Roleta' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Zona Sul' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mandar pra roleta' }));
    await waitFor(() => expect(onTrocarRoleta).toHaveBeenCalledWith('r1'));
  });

  it('sem roleta ligada, o item leva pra página da roleta (o card não cria roleta)', async () => {
    montar({ roletas: [] });
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mandar pra roleta' }));
    expect(await screen.findByText('Página da roleta')).toBeInTheDocument();
  });

  it('sem acesso às roletas: o item fica desabilitado e diz por quê (não leva pra página)', async () => {
    montar({ roletas: null });
    await abrirMenu();
    const item = screen.getByRole('menuitem', { name: /Mandar pra roleta/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent('Sem acesso às roletas');
    await userEvent.click(item);
    expect(screen.queryByText('Página da roleta')).toBeNull();
  });

  it('"Tirar da roleta" só aparece com oferta esperando aceite', async () => {
    const onTirarDaRoleta = vi.fn();
    montar({ onTirarDaRoleta });
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar da roleta' }));
    expect(onTirarDaRoleta).toHaveBeenCalled();
  });

  it('sem oferta, não há "Tirar da roleta"', async () => {
    montar();
    await abrirMenu();
    expect(screen.queryByRole('menuitem', { name: 'Tirar da roleta' })).toBeNull();
  });
});

describe('CardMoreMenu · página do card completo (E4)', () => {
  it('"Copiar link do card" copia o caminho que a página passa', async () => {
    const user = userEvent.setup();
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    montar({ linkDoCard: '/pipelines/p1/card/pi-1' });

    await user.click(screen.getByRole('button', { name: 'Mais ações do card' }));
    await user.click(screen.getByRole('menuitem', { name: 'Copiar link do card' }));

    expect(escrever).toHaveBeenCalledWith(`${window.location.origin}/pipelines/p1/card/pi-1`);
  });

  it('sem linkDoCard continua copiando o link do quadro', async () => {
    const user = userEvent.setup();
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    montar();

    await user.click(screen.getByRole('button', { name: 'Mais ações do card' }));
    await user.click(screen.getByRole('menuitem', { name: 'Copiar link do card' }));

    expect(escrever).toHaveBeenCalledWith(`${window.location.origin}/pipelines/p1?card=pi-1`);
  });

  it('Arquivar e Desarquivar só aparecem quando a página pede', async () => {
    const onArquivar = vi.fn();
    montar({ onArquivar });
    await abrirMenu();
    expect(screen.queryByRole('menuitem', { name: 'Desarquivar' })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    expect(onArquivar).toHaveBeenCalled();
  });
});
