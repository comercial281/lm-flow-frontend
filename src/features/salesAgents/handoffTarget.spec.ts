import { describe, expect, it } from 'vitest';

import { fonteDaIaVendedora, lerTelaDaIa } from '../../test/fonteDaIaVendedora';
import { PAGINAS } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';

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

describe('para quem a IA passa o lead (onda 3: página Destino)', () => {
  const src = fonteDaIaVendedora();
  const destino = lerTelaDaIa('configurar/paginas/Destino.tsx');

  // Desde a onda 3 o destino é campo da página Destino (e da Identidade, que o
  // muda junto da persona): a gravação manda o que mudou, e `null` limpa o alvo
  // (patchDoPasso.spec.ts) — a cicatriz do `??` com a roleta velha por baixo.
  it('os três campos são da página Destino', () => {
    expect(PAGINAS.destino.campos).toEqual(expect.arrayContaining(['handoff_target', 'handoff_roleta_config_id', 'handoff_user_id']));
  });

  it('escolher o destino limpa o alvo que não vale mais', () => {
    expect(destino).toContain("handoff_target: 'roleta', handoff_roleta_config_id: id, handoff_user_id: null");
    expect(destino).toContain("handoff_target: 'user', handoff_user_id: id, handoff_roleta_config_id: null");
  });

  it('"a roleta deste número" saiu: a Roleta é o primeiro cartão', () => {
    expect(destino).not.toContain("valor: 'inbox_roleta'");
    const lista = destino.slice(destino.indexOf('const DESTINOS'), destino.indexOf('export default function Destino'));
    expect(lista.indexOf("valor: 'roleta'")).toBeLessThan(lista.indexOf("valor: 'user'"));
  });

  it('a roleta já escolhida continua na lista mesmo desativada', () => {
    expect(destino).toContain('r.ativa || r.id === agent.handoff_roleta_config_id');
  });

  it('a leitura das listas é de fundo e não grita', () => {
    expect(destino).toContain('Leitura de fundo');
    expect(src).toContain('.catch(() => {});');
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
