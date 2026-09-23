import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O convite de acesso tem quatro cicatrizes que NÃO quebram tipo, teste de
// componente nem build — todas falham caladas, em produção, no aparelho de
// quem está tentando entrar. Por isso este spec lê o código-fonte.
const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

const ROTAS = 'src/routes/index.tsx';
const GUARDA = 'src/guards/RouterGuard.tsx';
const SERVICO = 'src/services/auth/accessLinkService.ts';
const TELA_LOGIN = 'src/pages/Auth/Auth.tsx';
const TELA_CONVITE = 'src/pages/Auth/AccessInvite.tsx';
const EQUIPE = 'src/pages/Customer/Team/PeopleTab.tsx';
const ASSISTENTE = 'src/pages/Customer/Team/AddPersonWizard.tsx';

describe('o convite de acesso', () => {
  it('tem rota, e ela fica FORA do layout do CRM', () => {
    const src = read(ROTAS);
    expect(src).toContain('path="/acesso"');
    expect(src).toContain('<AccessInvite />');
  });

  // A guarda do roteador roda ANTES das rotas. Sem as duas listas, o link cai
  // no login (a tela onde a pessoa não consegue entrar) ou, se o aparelho tiver
  // a sessão de outra pessoa, nas conversas dela.
  it('está nas DUAS listas da guarda do roteador', () => {
    const src = read(GUARDA);
    const publicas = src.slice(src.indexOf('PUBLIC_ROUTES'), src.indexOf('AUTH_EXEMPT_ROUTES'));
    const isentas = src.slice(src.indexOf('AUTH_EXEMPT_ROUTES'));
    expect(publicas).toContain("'/acesso'");
    expect(isentas).toContain("'/acesso'");
  });

  // ⚠️ A API responde em api.lmflow.com.br, onde o subdomínio é "api" — que é
  // reservado. Sem o cabeçalho, o servidor procura a pessoa no apartamento
  // errado e recusa o convite como se fosse de outro cliente.
  it('manda o cliente no cabeçalho da requisição pública', () => {
    const src = read(SERVICO);
    expect(src).toContain('X-Tenant');
    expect(src).toContain('getSubdomainSlug');
  });

  // Abrir o link não pode consumi-lo: o WhatsApp pré-visualiza links, e a
  // pré-visualização queimaria o convite antes de a pessoa tocar nele.
  it('abre o convite por leitura e só consome no envio', () => {
    const src = read(SERVICO);
    expect(src).toContain("client.get<{ data: AccessLinkInvite }>('/access_link'");
    expect(src).toContain("client.post<{ data: AccessLinkRedeemed }>('/access_link'");

    const tela = read(TELA_CONVITE);
    // O `redeem` só acontece no envio do formulário, nunca na abertura.
    const abertura = tela.slice(tela.indexOf('const abrirConvite'), tela.indexOf('const concluir'));
    expect(abertura).toContain('peek(');
    expect(abertura).not.toContain('redeem(');
  });

  // O teclado do celular corrige e capitaliza sozinho, e com o olho aberto o
  // campo de senha vira campo de texto comum. Foi assim que a senha certa
  // chegou errada no servidor.
  it('desliga correção e maiúscula automática nos campos de senha e login', () => {
    for (const arquivo of [TELA_LOGIN, TELA_CONVITE]) {
      const src = read(arquivo);
      expect(src).toContain('autoCapitalize="none"');
      expect(src).toContain('autoCorrect="off"');
    }
  });

  // A tela de login não pode voltar a afirmar a causa quando o servidor não
  // mandou motivo nenhum — é o que fez três rodadas de investigação acusarem a
  // senha de quem estava com a senha certa.
  it('a tela de login lê o motivo do servidor por um lugar só', () => {
    const src = read(TELA_LOGIN);
    expect(src).toContain('loginFeedback');
    expect(src).not.toContain('Credenciais inválidas');
  });

  // Nenhuma senha viaja escrita na conversa: quem a cria é a própria pessoa.
  it('os dois botões de enviar acesso não mandam mais senha', () => {
    for (const arquivo of [EQUIPE, ASSISTENTE]) {
      const src = read(arquivo);
      const chamada = src.slice(src.indexOf('sendAccess('), src.indexOf('sendAccess(') + 220);
      expect(chamada).not.toContain('password');
    }
  });
});
