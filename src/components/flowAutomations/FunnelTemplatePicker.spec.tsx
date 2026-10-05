import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreviewStepLine } from './FunnelTemplatePicker';
import { BOOK_SUMMARY } from '@/features/flowAutomations/book';

describe('PreviewStepLine do book', () => {
  it('envio com o book do imóvel mostra a linha do book, não um balão vazio', () => {
    render(<ul><PreviewStepLine step={{ kind: 'send_whatsapp', media_source: 'property_book' }} /></ul>);
    expect(screen.getByText(BOOK_SUMMARY)).toBeInTheDocument();
  });

  it('com texto, mostra o texto e a linha do book', () => {
    render(<ul><PreviewStepLine step={{ kind: 'send_whatsapp', text: 'Oi!', media_source: 'property_book' }} /></ul>);
    expect(screen.getByText(/Oi!/)).toBeInTheDocument();
    expect(screen.getByText(BOOK_SUMMARY)).toBeInTheDocument();
  });
});
