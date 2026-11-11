import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/shared/ManualOriginInput', () => ({ ManualOriginInput: () => null }));

import CardOriginTab from './CardOriginTab';
import type { PipelineItem } from '@/types/analytics';

const abrir = (lead_origin: Record<string, unknown>) =>
  render(
    <CardOriginTab
      item={{ id: 'i1', lead_origin } as unknown as PipelineItem}
      manualOrigin="" onManualOriginChange={() => {}} savedManualOrigin=""
      savingManualOrigin={false} onSaveManualOrigin={() => {}}
    />,
  );

describe('aba Origem: página de fora', () => {
  it('mostra o endereço da página como link que abre em nova aba', () => {
    abrir({ source: 'site', site: 'LP Centro', page_url: 'https://exemplo.com.br/centro' });
    const link = screen.getByRole('link', { name: 'https://exemplo.com.br/centro' });
    expect(link).toHaveAttribute('href', 'https://exemplo.com.br/centro');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Página')).toBeInTheDocument();
  });

  it('diz "pelo botão flutuante" só quando entry_button é flutuante', () => {
    const { unmount } = abrir({ source: 'site', entry_button: 'flutuante' });
    expect(screen.getByText('pelo botão flutuante')).toBeInTheDocument();
    unmount();
    abrir({ source: 'site', entry_button: 'outro' });
    expect(screen.queryByText('pelo botão flutuante')).toBeNull();
  });

  it('não mostra o tracking', () => {
    abrir({ source: 'site', tracking: { utm_source: 'meta', fbclid: 'abc123' } });
    expect(screen.queryByText(/abc123|utm_source|tracking/i)).toBeNull();
  });

  it('endereço que não é http(s) não vira link', () => {
    abrir({ source: 'site', page_url: 'javascript:alert(1)' });
    expect(screen.queryByRole('link')).toBeNull();
  });
});
