import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
import Catalogo from './Catalogo';

describe('Catálogo', () => {
  it('tipo de venda em botões: Lançamento (padrão) apaga a chave; outro grava a subchave', async () => {
    const gravar = gravarDeTeste('catalogo');
    render(<Catalogo agent={agenteDeTeste({ playbook: {} })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    expect(screen.getByRole('radio', { name: 'Lançamento' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Usado ou pronto' }));
    expect(gravar).toHaveBeenCalledWith({ playbook: { vars: { tipo_venda: 'usado' } } }, ['playbook.vars.tipo_venda']);
  });

  it('as 4 chaves do que ela pode usar; o book mostra a regra', async () => {
    const gravar = gravarDeTeste('catalogo');
    render(<Catalogo agent={agenteDeTeste()} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    ['Consultar o cadastro', 'Oferecer outras opções', 'Fotos e vídeo', 'Book do imóvel'].forEach((n) => expect(screen.getByRole('switch', { name: n })).toBeChecked());
    expect(screen.getByLabelText('Quando ela pode mandar o book')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Fotos e vídeo' }));
    expect(gravar).toHaveBeenCalledWith({ rich_media_enabled: false });
  });
});
