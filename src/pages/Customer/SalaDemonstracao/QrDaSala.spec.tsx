import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import QrDaSala from './QrDaSala';

const session = {
  id: 's1', code: 'ABC123', lead_name: 'Maria', status: 'waiting' as const, conversation_id: null,
  contact_id: null, started_at: '2026-10-21T12:00:00Z', wa_link: 'https://wa.me/5511900000000?text=ABC123',
};

describe('QrDaSala', () => {
  it('renderiza o QR grande, o número, a espera e o código', () => {
    render(<QrDaSala session={session} waNumber="5511900000000" />);
    const qr = screen.getByLabelText('QR code para conversar com a IA');
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(Number(qr.getAttribute('width'))).toBeGreaterThanOrEqual(280);
    expect(screen.getByText('+55 11 90000-0000')).toBeInTheDocument();
    expect(screen.getByText('Aguardando o Maria mandar a primeira mensagem…')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('sem número configurado não quebra', () => {
    render(<QrDaSala session={session} waNumber={null} />);
    expect(screen.getByLabelText('QR code para conversar com a IA')).toBeInTheDocument();
  });
});
