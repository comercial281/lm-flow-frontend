import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { FlowNodeConfig } from '@/types/flowAutomations';

// Automações · sprint 4: a mensagem do funil de conversa pode ser mídia.

const uploadMedia = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { uploadMedia },
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { FunnelMessageFields, messageKindOf, withMessageKind } from './FunnelMessageFields';

function Harness({ initial, onConfig }: { initial: FlowNodeConfig; onConfig: (c: FlowNodeConfig) => void }) {
  const [config, setConfig] = useState(initial);
  return (
    <FunnelMessageFields
      config={config}
      conversation
      onChange={next => {
        setConfig(next);
        onConfig(next);
      }}
    />
  );
}

describe('mensagem do funil', () => {
  it('o tipo sai do que está no bloco; trocar zera o do tipo anterior com texto vazio', () => {
    expect(messageKindOf({ text: 'oi' })).toBe('text');
    expect(messageKindOf({ media_kind: 'image', media_url: '' })).toBe('image');
    expect(messageKindOf({ contact_phone: '5511999999999' })).toBe('contact');
    expect(withMessageKind({ text: 'x', media_kind: 'image', media_url: 'u' }, 'text')).toEqual({
      text: 'x', media_kind: '', media_url: '', media_filename: '',
    });
  });

  it('foto: escolher o arquivo sobe e grava a URL no bloco', async () => {
    uploadMedia.mockResolvedValue('https://cdn/foto.jpg');
    const onConfig = vi.fn();
    render(<Harness initial={{ text: '', media_kind: 'image', media_url: '' }} onConfig={onConfig} />);
    expect(screen.getByRole('radio', { name: 'Foto' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Legenda (opcional)')).toBeTruthy();
    const file = new File(['x'], 'fachada.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('arquivo-da-mensagem'), { target: { files: [file] } });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledWith(file));
    await waitFor(() => expect(onConfig).toHaveBeenLastCalledWith(expect.objectContaining({ media_kind: 'image', media_url: 'https://cdn/foto.jpg' })));
    expect(screen.getByRole('img', { name: 'Prévia do arquivo escolhido' })).toBeTruthy();
    expect(screen.getByText('Sai pelo número da conversa em que você disparar o funil.')).toBeTruthy();
  });
});
