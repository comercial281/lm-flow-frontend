import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

describe('Esqueci minha senha na tela de login', () => {
  it('pede o link pelo endereço novo, com o cliente no cabeçalho', () => {
    const servico = read('src/services/auth/accessLinkService.ts');
    expect(servico).toContain("client.post('/access_link/request'");
    expect(servico).toContain('X-Tenant');
  });

  it('mostra a frase fixa e não usa mais o fluxo antigo', () => {
    const tela = read('src/pages/Auth/Auth.tsx');
    expect(tela).toContain('accessLinkService.requestLink(');
    expect(tela).toContain('FORGOT_PASSWORD_SENT');
    expect(tela).toContain('FORGOT_PASSWORD_HINT');
    expect(tela).not.toContain('forgotPassword({');
  });
});
