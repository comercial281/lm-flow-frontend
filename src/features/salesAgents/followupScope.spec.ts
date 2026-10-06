import { describe, expect, it } from 'vitest';

import { fonteDaIaVendedora } from '../../test/fonteDaIaVendedora';
import { CAMPOS_DO_PASSO } from '../../pages/Customer/Automations/SalesAgents/configurar/camposDosPassos';

// O recorte por funil do follow-up da IA: ela vai atrás de todo lead calado do
// número, ou só dos que têm card nos funis escolhidos.
//
// As duas cicatrizes desta tela são CALADAS — nenhuma quebra tipo, teste de
// componente ou build —, por isso este spec lê o código-fonte, que é onde elas
// moram:
//
// 1. O `saveAgent` monta o PATCH campo a campo. Campo fora daquela lista é
//    descartado sem erro: a tela mostra os funis marcados, o aviso diz "Salvo", e
//    a IA continua indo atrás de todo mundo.
// 2. Lista VAZIA significa "todos os leads", não "nenhum". Trocar o `??` por `in`
//    aqui não quebra nada hoje, mas inverte o sentido do campo no dia em que
//    alguém mandar `null` para limpar.

describe('de quais leads a IA vai atrás', () => {
  const src = fonteDaIaVendedora();

  // Desde a entrega 2 o recorte é campo do passo 7 (camposDosPassos.ts): lista
  // vazia viaja como lista vazia ("todos os leads que ela atendeu"), e só
  // `undefined` vira null (patchDoPasso.spec.ts).
  it('o recorte é campo do passo 7', () => {
    expect(CAMPOS_DO_PASSO[7]).toContain('followup_pipeline_ids');
  });

  it('o bloco aparece no passo Voltar a chamar, mexendo no rascunho do passo', () => {
    expect(src).toContain('<FollowupPipelinesRow agent={rascunho} onSave={mudar} />');
    expect(src).toContain('De quais leads ela vai atrás');
  });

  // Sem este aviso, quem escolhe "só destes funis" e não marca nenhum sai da tela
  // achando que recortou — e a IA vai atrás de todo mundo, calada.
  it('avisa que nenhum funil marcado significa TODOS os leads', () => {
    expect(src).toContain('ela continua indo atrás de');
  });

  // Decisão do dono (29/09/2026): o follow-up só vai atrás de lead que a IA
  // atendeu e que não foi para a roleta — quem aplica é o servidor, e a tela
  // tem que DIZER isso. "Todos os leads deste número" voltaria a prometer o
  // comportamento antigo, que deixou de existir.
  it('diz que o público é quem a IA atendeu e que não foi para a roleta', () => {
    expect(src).toContain('Ela só vai atrás de quem ela mesma atendeu e que ainda não foi para a roleta.');
    expect(src).toContain('Todos os leads que ela atendeu');
    expect(src).not.toContain('Todos os leads deste número');
  });

  // Não é chave de funcionalidade: é campo do agente. Os dois scanners do
  // catálogo (que varrem por regex atrás de `useFeature`/`useClientToggle`) não
  // entram nesta história — e não devem passar a entrar.
  //
  // ⚠️ A busca é MONTADA, nunca escrita literal: os scanners varrem TODO arquivo
  // `.ts`, este spec incluído, e não sabem que a linha é uma negação. Escrito
  // literal, o auditor lê a chave como "usada no front", não a acha no catálogo
  // do servidor e QUEBRA O BUILD — foi exatamente o que aconteceu no primeiro
  // build deste PR, e ele estava fazendo o trabalho dele.
  const chamada = (hook: string, chave: string) => `${hook}('${chave}`;

  it('não vira chave de funcionalidade', () => {
    expect(src).not.toContain(chamada('useClientToggle', 'followup_pipeline_ids'));
    expect(src).not.toContain(chamada('useFeature', 'followup_pipeline_ids'));
  });
});
