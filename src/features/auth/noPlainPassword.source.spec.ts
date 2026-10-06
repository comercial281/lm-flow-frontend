import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

describe('nenhuma tela guarda nem mostra senha legível', () => {
  it.each(['src/types/users/users.ts', 'src/types/teamAccess.ts', 'src/pages/SuperAdmin/PooledClients/index.tsx'])(
    '%s não fala mais em plain_password',
    arquivo => expect(read(arquivo)).not.toContain('plain_password'),
  );

  it('a aba Pessoas oferece Enviar e Copiar link de acesso e não tem senha', () => {
    const src = read('src/pages/SuperAdmin/PooledClients/Cliente/AbaPessoas.tsx');
    expect(src).toContain('Enviar link a');
    expect(src).toContain('Copiar link de');
    expect(src).not.toContain('plain_password');
    expect(src).not.toContain('set_password');
    expect(src).not.toMatch(/type="password"/);
  });

  it('a tela Equipe oferece Copiar link de acesso', () => {
    expect(read('src/pages/Customer/Team/PeopleTab.tsx')).toContain('Copiar link de acesso');
  });

  // 06/10/2026: a coluna saiu do servidor; a Equipe do admin não conta mais "senhas guardadas".
  it.each(['src/services/superLogs/superLogsService.ts', 'src/pages/Admin/Area/supportReviewRules.ts', 'src/pages/Admin/Area/Equipe.tsx'])(
    '%s não conta mais senha legível',
    arquivo => {
      const src = read(arquivo);
      expect(src).not.toContain('plain_passwords');
      expect(src).not.toContain('plainPasswords');
      expect(src).not.toContain('legível(is)');
    },
  );

  it('o resumo da Equipe usa plural de verdade, sem "(s)"', () => {
    expect(read('src/pages/Admin/Area/Equipe.tsx')).not.toContain('(s)');
  });
});
