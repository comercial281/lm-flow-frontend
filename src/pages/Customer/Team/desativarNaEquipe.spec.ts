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

// Desde a Equipe nova (2026-10-09) os botões moram na FICHA da pessoa, que a
// aba Pessoas abre ao clicar na linha. A trava segue a ficha — e confere que a
// aba de fato a abre, senão a ficha vira a próxima tela que ninguém vê.
const ABA = 'src/pages/Customer/Team/PeopleTab.tsx';
const TELA = 'src/pages/Customer/Team/person/PersonSheet.tsx';
const ROTAS = 'src/routes/index.tsx';

describe('desativar corretor na tela de Equipe', () => {
  const src = read(TELA);
  const aba = read(ABA);

  it('a aba Pessoas abre a ficha da pessoa', () => {
    expect(aba).toContain("import PersonSheet from './person/PersonSheet'");
    expect(aba).toContain('<PersonSheet');
  });

  it('a janela que mostra o estrago é aberta por esta tela', () => {
    expect(src).toContain("import DeactivateUserDialog from '@/components/users/DeactivateUserDialog'");
    expect(src).toContain('<DeactivateUserDialog');
  });

  it('oferece a volta, que é o que faz a desativação ser reversível', () => {
    expect(src).toContain('usersService.reactivate(');
    expect(src).toContain('Reativar');
  });

  // Desde a Equipe nova a lista é o PeopleList e o selo vem do accessStatus.
  it('marca quem está fora, senão a lista diz que ele está ativo', () => {
    const lista = read('src/pages/Customer/Team/people/PeopleList.tsx');
    const acesso = read('src/pages/Customer/Team/people/accessStatus.ts');
    expect(lista).toContain('accessStatus(member');
    expect(lista).toContain('member.deactivated');
    expect(acesso).toContain('member.deactivated');
    expect(acesso).toContain('Inativo');
  });

  // O excluir renomeava o e-mail da pessoa, randomizava a senha e respondia
  // "removido" — com ela ainda nas roletas, com acesso aos canais, dona dos
  // leads e recebendo aviso no WhatsApp. Duas saídas para "tirar alguém do
  // time" é exatamente a segunda verdade que esta leva veio desfazer.
  it('não tem mais o "Remover do time"', () => {
    for (const fonte of [src, aba]) {
      expect(fonte).not.toContain('deleteUser(');
      expect(fonte).not.toContain('Remover do time');
    }
  });

  // Desde 2026-09-16 existe o *Excluir cadastro* — que apaga DE VERDADE, e só o
  // cadastro que nunca foi usado. Ele NÃO é a volta do "Remover do time": a tela
  // não chama o apagar direto; passa pela janela, e a janela só oferece o botão
  // depois de ler o veredito do servidor (`erase` na prévia). Sem isso, um
  // servidor antigo apagaria gente com histórico respondendo "sucesso".
  it('o "Excluir cadastro" passa pela janela que pergunta ao servidor antes', () => {
    expect(src).toContain('<EraseUserDialog');
    expect(src).toContain('Excluir cadastro');

    const dialog = read('src/components/users/EraseUserDialog.tsx');
    expect(dialog).toContain('eraseVerdict(');
    expect(dialog).toContain('getDeactivationPreview(');
    expect(dialog).toContain('usersService.deleteUser(');
  });

  // Se um dia o endereço voltar a apontar para a tela antiga, os botões somem
  // de novo — e de novo em silêncio.
  it('o endereço da tela antiga de Usuários continua redirecionando para cá', () => {
    expect(read(ROTAS)).toContain('/settings/users');
    expect(read(ROTAS)).toContain('/equipe');
  });
});
