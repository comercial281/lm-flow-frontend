import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageStatus from './MessageStatus';
import { Message } from '@/types/chat/api';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@/utils/time/timeHelpers', () => ({
  formatMessageTime: () => '10:30',
}));

vi.mock('lucide-react', () => ({
  Check: (props: any) => (
    <svg data-testid="check-icon" {...props} />
  ),
  CheckCheck: (props: any) => (
    <svg data-testid="check-check-icon" {...props} />
  ),
  Clock: (props: any) => (
    <svg data-testid="clock-icon" {...props} />
  ),
  AlertCircle: (props: any) => (
    <svg data-testid="alert-icon" {...props} />
  ),
  Loader2: (props: any) => (
    <svg data-testid="loader-icon" {...props} />
  ),
}));

const createMessage = (status: Message['status'], isPrivate = false): Message => ({
  id: 'msg-1',
  created_at: '2024-01-01T10:30:00Z',
  status,
  private: isPrivate,
} as never);

describe('MessageStatus', () => {
  describe('sent status', () => {
    it('renderiza Check com aria-label "Enviado" quando isOwn=true', () => {
      render(<MessageStatus message={createMessage('sent')} isOwn={true} />);

      const checkIcon = screen.getByTestId('check-icon');
      expect(checkIcon).toBeTruthy();
      expect(checkIcon).toHaveAttribute('aria-label', 'Enviado');
    });

    it('não renderiza ícone quando isOwn=false', () => {
      render(<MessageStatus message={createMessage('sent')} isOwn={false} />);

      expect(screen.queryByTestId('check-icon')).toBeNull();
    });

    it('aplica classe text-muted-foreground', () => {
      render(<MessageStatus message={createMessage('sent')} isOwn={true} />);

      const checkIcon = screen.getByTestId('check-icon');
      expect(checkIcon.getAttribute('class')).toContain('text-muted-foreground');
    });
  });

  describe('delivered status', () => {
    it('renderiza CheckCheck com aria-label "Recebido" quando isOwn=true', () => {
      render(<MessageStatus message={createMessage('delivered')} isOwn={true} />);

      const checkCheckIcon = screen.getByTestId('check-check-icon');
      expect(checkCheckIcon).toBeTruthy();
      expect(checkCheckIcon).toHaveAttribute('aria-label', 'Recebido');
    });

    it('não renderiza ícone quando isOwn=false', () => {
      render(<MessageStatus message={createMessage('delivered')} isOwn={false} />);

      expect(screen.queryByTestId('check-check-icon')).toBeNull();
    });

    it('aplica classe text-muted-foreground', () => {
      render(<MessageStatus message={createMessage('delivered')} isOwn={true} />);

      const checkCheckIcon = screen.getByTestId('check-check-icon');
      expect(checkCheckIcon.getAttribute('class')).toContain('text-muted-foreground');
    });
  });

  describe('read status', () => {
    it('renderiza CheckCheck com aria-label "Visto" quando isOwn=true', () => {
      render(<MessageStatus message={createMessage('read')} isOwn={true} />);

      const checkCheckIcon = screen.getByTestId('check-check-icon');
      expect(checkCheckIcon).toBeTruthy();
      expect(checkCheckIcon).toHaveAttribute('aria-label', 'Visto');
    });

    it('aplica classe text-[#53bdeb] (WhatsApp blue) ao ícone', () => {
      render(<MessageStatus message={createMessage('read')} isOwn={true} />);

      const checkCheckIcon = screen.getByTestId('check-check-icon');
      expect(checkCheckIcon.getAttribute('class')).toContain('text-[#53bdeb]');
    });

    it('não renderiza ícone quando isOwn=false', () => {
      render(<MessageStatus message={createMessage('read')} isOwn={false} />);

      expect(screen.queryByTestId('check-check-icon')).toBeNull();
    });
  });
});
