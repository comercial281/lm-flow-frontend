import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

describe('nenhuma tela guarda nem mostra senha legível', () => {
  it.each(['src/types/users/users.ts', 'src/types/teamAccess.ts', 'src/pages/SuperAdmin/PooledClients/index.tsx'])(
    '%s não fala mais em plain_password',
    arquivo => expect(read(arquivo)).not.toContain('plain_password'),
  );

  it('o painel raiz oferece Enviar e Copiar link de acesso', () => {
    const src = read('src/pages/SuperAdmin/PooledClients/index.tsx');
    expect(src).toContain('Enviar link de acesso');
    expect(src).toContain('Copiar link de acesso');
  });

  it('a tela Equipe oferece Copiar link de acesso', () => {
    expect(read('src/pages/Customer/Team/PeopleTab.tsx')).toContain('Copiar link de acesso');
  });
});
