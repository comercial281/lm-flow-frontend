import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Desativar / reativar corretor mora na aba *Pessoas* da tela de **Equipe**.
//
// Este spec existe por uma cicatriz específica: a funcionalidade foi construída
// inteira sobre a tela antiga de Configurações > Usuários — que virou CÓDIGO
// MORTO quando `/settings/users` passou a redirecionar para `/equipe`. Rota
// nenhuma a importa. O botão existia no código e não aparecia para ninguém, e
// nada reprovou: não quebra tipo, não quebra build, não quebra render.
//
// Por isso a conferência lê o código-fonte da tela VIVA. Ela responde a duas
// perguntas que nenhum outro teste responde:
//
// 1. os botões estão na tela que o menu abre?
// 2. o "Remover do time" — que chamava o excluir, e o excluir quase nunca apaga
//    de verdade — saiu de lá?
const read = (p: string) => readFileSync(resolve(__dirname, '../../../..', p), 'utf8');

const TELA = 'src/pages/Customer/Team/PeopleTab.tsx';
const ROTAS = 'src/routes/index.tsx';

describe('desativar corretor na tela de Equipe', () => {
  const src = read(TELA);

  it('a janela que mostra o estrago é aberta por esta tela', () => {
    expect(src).toContain("import DeactivateUserDialog from '@/components/users/DeactivateUserDialog'");
    expect(src).toContain('<DeactivateUserDialog');
  });

  it('oferece a volta, que é o que faz a desativação ser reversível', () => {
    expect(src).toContain('usersService.reactivate(');
    expect(src).toContain('Reativar');
  });

  it('marca quem está fora, senão a lista diz que ele está ativo', () => {
    expect(src).toContain('member.deactivated');
    expect(src).toContain('Inativo');
  });

  // O excluir renomeava o e-mail da pessoa, randomizava a senha e respondia
  // "removido" — com ela ainda nas roletas, com acesso aos canais, dona dos
  // leads e recebendo aviso no WhatsApp. Duas saídas para "tirar alguém do
  // time" é exatamente a segunda verdade que esta leva veio desfazer.
  it('não tem mais o "Remover do time"', () => {
    expect(src).not.toContain('deleteUser(');
    expect(src).not.toContain('Remover do time');
  });

  // Se um dia o endereço voltar a apontar para a tela antiga, os botões somem
  // de novo — e de novo em silêncio.
  it('o endereço da tela antiga de Usuários continua redirecionando para cá', () => {
    expect(read(ROTAS)).toContain('/settings/users');
    expect(read(ROTAS)).toContain('/equipe');
  });
});
