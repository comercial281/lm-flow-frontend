import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  afterEach(() => vi.restoreAllMocks());

  it('usa a área de transferência do navegador quando existe', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyText('https://x/acesso?t=1')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://x/acesso?t=1');
  });

  it('sem ela (navegador de dentro do WhatsApp), cai no plano B', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    await expect(copyText('abc')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });
});
