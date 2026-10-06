import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { fonteDaIaVendedora } from '../../test/fonteDaIaVendedora';

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

describe('roteiro da IA na tela do cliente', () => {
  const src = fonteDaIaVendedora();

  it('o roteiro entra na lista campo-a-campo do PATCH', () => {
    // ⚠️ O corte vai até o FIM do payload (`setSelected(updated)`), não a um
    // número fixo de caracteres: a lista cresce a cada campo novo, e com a janela
    // fixa de 6000 este spec passou a reprovar quando o recorte por funil do
    // follow-up entrou ANTES do roteiro — sem nada de errado com o roteiro.
    const saveAgent = src.slice(src.indexOf('const saveAgent'), src.indexOf('setSelected(updated)'));

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

// O assistente em tela cheia saiu na entrega 2 (o passo a passo do Configurar é o
// mesmo pra criar e editar). O que os testes dele protegiam (PATCH só do que
// mudou, jsonb mesclado sobre o salvo) mora em patchDoPasso.spec.ts e
// camposDosPassos.spec.ts.
describe('Nova IA', () => {
  it('cria o rascunho pelo serviço, e o ?agent= de link antigo continua abrindo a IA', () => {
    const tela = fonteDaIaVendedora();
    expect(tela).toContain('salesAgentsService.create(novaIaRascunho())');
    expect(read('src/features/salesAgents/iaMenu.ts')).toContain("params.get('agent')");
  });
});
