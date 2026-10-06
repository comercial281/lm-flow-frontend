import { describe, expect, it } from 'vitest';

import { fonteDaIaVendedora, lerTelaDaIa } from '../../test/fonteDaIaVendedora';
import { CAMPOS_DO_PASSO } from '../../pages/Customer/Automations/SalesAgents/configurar/camposDosPassos';

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

describe('para quem a IA passa o lead', () => {
  const src = fonteDaIaVendedora();
  const passo2 = lerTelaDaIa('configurar/passos/Passo2Objetivo.tsx');

  // Desde a entrega 2 o destino é campo do passo 2 (e do 1, que o muda junto da
  // persona): o patch do passo manda o que mudou, e `null` limpa o alvo
  // (patchDoPasso.spec.ts) — a cicatriz do `??` com a roleta velha por baixo.
  it('os três campos são do passo 2', () => {
    expect(CAMPOS_DO_PASSO[2]).toEqual(expect.arrayContaining(['handoff_target', 'handoff_roleta_config_id', 'handoff_user_id']));
  });

  it('trocar o destino limpa o alvo que não vale mais', () => {
    expect(passo2).toContain("handoff_roleta_config_id: v === 'roleta' ? rascunho.handoff_roleta_config_id ?? null : null");
    expect(passo2).toContain("handoff_user_id: v === 'user' ? rascunho.handoff_user_id ?? null : null");
  });

  it('o padrão é a roleta do número — e é o primeiro cartão', () => {
    const lista = passo2.slice(passo2.indexOf('const DESTINOS'), passo2.indexOf('export default function Passo2Objetivo'));
    expect(lista.indexOf("valor: 'inbox_roleta'")).toBeGreaterThan(-1);
    expect(lista.indexOf("valor: 'inbox_roleta'")).toBeLessThan(lista.indexOf("valor: 'roleta'"));
    expect(lista.indexOf("valor: 'roleta'")).toBeLessThan(lista.indexOf("valor: 'user'"));
  });

  // O aviso de alvo em branco virou pendência do passo (pendencias.spec.ts):
  // aparece no trilho, no passo 8 e no Painel.
  it('a roleta já escolhida continua na lista mesmo desativada', () => {
    expect(passo2).toContain('r.ativa || r.id === rascunho.handoff_roleta_config_id');
  });

  it('a leitura das listas é de fundo e não grita', () => {
    expect(passo2).toContain('Leitura de fundo');
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
