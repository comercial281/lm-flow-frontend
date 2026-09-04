import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Duas cicatrizes desta tela que só aparecem em PRODUÇÃO, e caladas. Nenhuma das
// duas quebra tipo, teste de componente ou build — por isso este spec lê o
// código-fonte, que é onde elas moram.
//
// 1. O `saveAgent` monta o PATCH campo a campo. Campo fora daquela lista é
//    descartado sem erro: a tela mostra o valor, o aviso diz "Salvo", e nada foi
//    salvo. Já aconteceu com a curtida e com os dois campos do book do imóvel.
//
// 2. Os dois scanners do catálogo de funcionalidades varrem o código por REGEX.
//    Trocar a chave literal por uma constante tira a chave do catálogo no deploy
//    seguinte, o painel de Funções deixa de oferecer o botão de liberar, e
//    ninguém é avisado.
const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

const TELA = 'src/pages/Customer/Automations/SalesAgents/SalesAgents.tsx';

describe('roteiro da IA na tela do cliente', () => {
  const src = read(TELA);

  it('o roteiro entra na lista campo-a-campo do PATCH', () => {
    const saveAgent = src.slice(src.indexOf('const saveAgent'), src.indexOf('const saveAgent') + 6000);

    expect(saveAgent).toContain('playbook:');
  });

  // Com `??`, limpar o roteiro inteiro (voltar tudo ao padrão de fábrica) seria
  // trocado de volta pelo valor antigo: a tela mostraria "no padrão", o aviso
  // diria "Salvo", e o servidor continuaria com o texto reescrito.
  it('e entra com `in`, não com `??` — objeto vazio é escolha legítima', () => {
    expect(src).toContain("playbook: 'playbook' in patch ? patch.playbook : selected.playbook");
  });

  it('a chave do gate vai LITERAL, para os scanners do catálogo a enxergarem', () => {
    expect(src).toContain("useClientToggle('ia_playbook')");
  });

  // O comentário dizia "a Leal Mídia sempre vê" e o código não fazia isso: a seção
  // ficava escondida até de quem libera a chave. A aba de Landings é a régua.
  it('e a Leal Mídia sempre vê, como a aba de Landings', () => {
    expect(src).toContain('isSuper || roteiroToggle');
    expect(src).toContain('isSuper || insightsToggle');
  });

  // Os pontos-chave viajam DENTRO do `playbook`, como `vars`. Se alguém um dia os
  // mover para campo próprio, ele precisa entrar na lista do PATCH — senão a tela
  // mostra, o aviso diz "Salvo", e nada foi salvo.
  it('os pontos-chave viajam dentro do playbook (vars), não em campo solto', () => {
    const secao = read('src/components/salesAgents/PlaybookSection.tsx');
    expect(secao).toContain('next_config.vars = cleaned');
  });
});

// O assistente em tela cheia grava por conta própria, num PATCH só. Ele NÃO pode
// passar pelo `saveAgent` da tela (que descarta campo fora da lista) e precisa
// mandar o `playbook` INTEIRO — só `vars` apagaria os blocos reescritos.
describe('assistente de configuração da IA', () => {
  const pagina = read('src/pages/Customer/Automations/SalesAgents/assistente/AssistenteIA.tsx');
  const mapeamento = read('src/pages/Customer/Automations/SalesAgents/assistente/assistenteMapping.ts');

  it('grava direto no serviço, num PATCH só', () => {
    expect(pagina).toContain('salesAgentsService.update(agent.id, payload)');
    expect(pagina).not.toContain('saveAgent(');
  });

  it('o playbook é mesclado por cima do que a IA já tem, nunca substituído', () => {
    expect(mapeamento).toContain("const next: AgentPlaybookConfig = { ...(atual ?? {}) };");
    expect(mapeamento).toContain('playbookDasRespostas(a, agent.playbook)');
  });

  it('o "+" da tela leva para o assistente, e o assistente devolve pela query ?agent=', () => {
    const tela = read(TELA);
    expect(tela).toContain('navigate(`/ia-vendedora/${agent.id}/assistente`)');
    expect(tela).toContain("searchParams.get('agent')");
    expect(pagina).toContain('/ia-vendedora?agent=');
  });

  // Dois editores de janela na mesma etapa (atuação e follow-up): prefixo
  // repetido faz o rótulo "Das" de um focar o campo do outro.
  it('os dois editores de horário têm prefixos próprios', () => {
    const operacao = read('src/pages/Customer/Automations/SalesAgents/assistente/steps/EtapaOperacao.tsx');
    expect(operacao).toContain('idPrefix="as_win"');
    expect(operacao).toContain('idPrefix="as_fu_win"');
  });
});
