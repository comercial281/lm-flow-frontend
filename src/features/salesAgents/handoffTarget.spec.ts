import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// PARA QUEM a IA passa o lead.
//
// As cicatrizes desta seção são CALADAS — nenhuma quebra tipo, teste de
// componente ou build —, por isso este spec lê o código-fonte, que é onde elas
// moram:
//
// 1. O `saveAgent` monta o PATCH campo a campo. Campo fora daquela lista é
//    descartado sem erro: a tela mostra a roleta escolhida, o aviso diz "Salvo",
//    e a IA continua entregando na roleta do número.
// 2. Os dois ALVOS precisam entrar com `in`, e não com `??`. Voltar para "a
//    roleta deste número" manda `null` para limpar; com `??` o servidor ficaria
//    com a roleta velha por baixo — a tela mostrando uma coisa e o lead sendo
//    entregue noutra.
const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

const TELA = 'src/pages/Customer/Automations/SalesAgents/SalesAgents.tsx';

describe('para quem a IA passa o lead', () => {
  const src = read(TELA);
  // Corte até o FIM do payload, nunca um número fixo de caracteres: a lista
  // cresce a cada campo novo, e janela fixa reprova o campo errado.
  const saveAgent = src.slice(src.indexOf('const saveAgent'), src.indexOf('setSelected(updated)'));

  it('os três campos entram na lista campo-a-campo do PATCH', () => {
    expect(saveAgent).toContain('handoff_target:');
    expect(saveAgent).toContain('handoff_roleta_config_id:');
    expect(saveAgent).toContain('handoff_user_id:');
  });

  // O modo nunca é limpável: o servidor devolve sempre um dos três.
  it('o modo entra com `??`', () => {
    expect(saveAgent).toContain('handoff_target: patch.handoff_target ?? selected.handoff_target');
  });

  // `null` nos alvos é escolha legítima — é como "voltei para a roleta do
  // número" apaga a escolha anterior.
  it('os dois alvos entram com `in`, porque null é escolha', () => {
    expect(saveAgent).toContain("'handoff_roleta_config_id' in patch");
    expect(saveAgent).toContain("'handoff_user_id' in patch");
  });

  it('a seção fica logo abaixo do cenário de repasse', () => {
    // As duas respondem à mesma pergunta (o que acontece quando a IA sai de
    // cena); separá-las faria procurar em dois lugares.
    const policy = src.indexOf('<HandoffPolicySection agent={agent} onSave={onSave} />');
    const destino = src.indexOf('<HandoffDestinationSection agent={agent} onSave={onSave} />');

    expect(policy).toBeGreaterThan(-1);
    expect(destino).toBeGreaterThan(policy);
  });

  it('o padrão é a roleta do número — e é o primeiro cartão', () => {
    // Escolha nova não muda o comportamento de quem nunca escolheu nada.
    const lista = src.slice(src.indexOf('const HANDOFF_TARGETS'), src.indexOf('function HandoffDestinationSection'));

    expect(lista.indexOf("value: 'inbox_roleta'")).toBeLessThan(lista.indexOf("value: 'roleta'"));
    expect(lista.indexOf("value: 'roleta'")).toBeLessThan(lista.indexOf("value: 'user'"));
  });

  // Sem estes avisos o gestor sai da tela achando que escolheu, e todo lead que
  // a IA passar fica sem responsável — em silêncio, que é o defeito que esta
  // leva inteira veio consertar.
  it('avisa quando o modo foi escolhido e o alvo ficou em branco', () => {
    const secao = src.slice(src.indexOf('function HandoffDestinationSection'), src.indexOf('// A IA move o card'));

    expect(secao).toContain('fica sem responsável');
    expect(secao).toContain('text-amber-600');
  });

  // Sumir com a roleta escolhida da lista faria o próximo salvamento apagar a
  // escolha do gestor, calado. Mesma doutrina do Destino do lead da landing.
  it('a roleta já escolhida continua na lista mesmo desativada', () => {
    const secao = src.slice(src.indexOf('function HandoffDestinationSection'), src.indexOf('// A IA move o card'));

    expect(secao).toContain('r.ativa || r.id === roletaId');
  });

  // Cargo sem acesso a roletas ou à equipe só não vê aquele seletor — a seção
  // continua inteira, e nada pinta de vermelho.
  it('a leitura das listas é de fundo e não grita', () => {
    const secao = src.slice(src.indexOf('function HandoffDestinationSection'), src.indexOf('// A IA move o card'));

    expect(secao).toContain('leitura de fundo não grita');
  });

  // Não é chave de funcionalidade: é campo do agente. Os dois scanners do
  // catálogo (que varrem por regex atrás de `useFeature`/`useClientToggle`) não
  // entram nesta história — e não devem passar a entrar.
  //
  // ⚠️ A busca é MONTADA, nunca escrita literal: os scanners varrem TODO arquivo
  // `.ts`, este spec incluído, e não sabem que a linha é uma negação. Escrito
  // literal, o auditor lê a chave como "usada no front", não a acha no catálogo
  // do servidor e QUEBRA O BUILD.
  const chamada = (hook: string, chave: string) => `${hook}('${chave}`;

  it('não vira chave de funcionalidade', () => {
    expect(src).not.toContain(chamada('useClientToggle', 'handoff_target'));
    expect(src).not.toContain(chamada('useFeature', 'handoff_target'));
  });
});
