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
});
