import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

const TELA = 'src/pages/Customer/Automations/SalesAgents/SalesAgents.tsx';

describe('de quais leads a IA vai atrás', () => {
  const src = read(TELA);

  it('o recorte entra na lista campo-a-campo do PATCH', () => {
    // Corte até o FIM do payload, nunca um número fixo de caracteres: a lista
    // cresce a cada campo novo, e janela fixa reprova o campo errado.
    const saveAgent = src.slice(src.indexOf('const saveAgent'), src.indexOf('setSelected(updated)'));

    expect(saveAgent).toContain('followup_pipeline_ids:');
  });

  // Lista vazia NÃO é null: é a escolha "todos os leads deste número", e o `??`
  // a preserva. Com `in`, um `null` vindo de qualquer lugar viraria "lista
  // apagada" — que no servidor é a mesma coisa, mas por acaso, não por desenho.
  it('e entra com `??`, porque lista vazia é escolha legítima', () => {
    expect(src).toContain('followup_pipeline_ids: patch.followup_pipeline_ids ?? selected.followup_pipeline_ids');
  });

  it('o bloco aparece dentro do Follow-up automático', () => {
    expect(src).toContain('<FollowupPipelinesRow agent={agent} onSave={onSave} />');
    expect(src).toContain('De quais leads ela vai atrás');
  });

  // Sem este aviso, quem escolhe "só destes funis" e não marca nenhum sai da tela
  // achando que recortou — e a IA vai atrás de todo mundo, calada.
  it('avisa que nenhum funil marcado significa TODOS os leads', () => {
    expect(src).toContain('ela continua indo atrás de');
  });

  // Não é chave de funcionalidade: é campo do agente. Os dois scanners do
  // catálogo (que varrem por regex atrás de `useFeature`/`useClientToggle`) não
  // entram nesta história — e não devem passar a entrar.
  it('não vira chave de funcionalidade', () => {
    expect(src).not.toContain("useClientToggle('followup_pipeline");
    expect(src).not.toContain("useFeature('followup_pipeline");
  });
});
