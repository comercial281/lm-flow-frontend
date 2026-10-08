// src/components/pipelines/EditItemModal.situacao.source.spec.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A janela do card × situação (spec funil §3.8). Desde a E4 a janela é casca:
// o estado mora no useCardDoLead e o desenho nos blocos. A janela de verdade
// tem a caracterização (EditItemModal.caracterizacao.spec.tsx); este spec
// segura onde cada pedaço da situação mora.
const raiz = resolve(__dirname, '../../..');
const ler = (p: string) => readFileSync(resolve(raiz, p), 'utf8');
const janela = ler('src/components/pipelines/EditItemModal.tsx');
const hook = ler('src/features/cardDoLead/useCardDoLead.ts');
const situacao = ler('src/features/cardDoLead/blocos/BlocoSituacao.tsx');
const identidade = ler('src/features/cardDoLead/blocos/BlocoIdentidade.tsx');

describe('janela do card × situação (spec funil §3.8)', () => {
  it('Ganho/Perdido/Reabrir vêm da situação do card, não da coluna', () => {
    expect(janela).toContain('<CardResultFooter item={card.situacao.item ?? item} onMudou={aoMudarSituacao} bloqueado={card.etapa.movendo} onSalvando={card.situacao.setRodapeSalvando} />');
    expect(janela).toContain('onItemStatusChanged?.(novo)');
    expect(janela).not.toMatch(/<CardResultFooter[^>]*stages=/);
    for (const src of [janela, hook, situacao, identidade]) expect(src).not.toContain('etapaFinal');
  });

  it('card fechado: selo junto do nome e Etapa travada (reabrir antes)', () => {
    expect(identidade).toContain('<SeloSituacao');
    expect(identidade).toContain('status={situacaoDe(situacao.item)}');
    expect(situacao).toMatch(/disabled=\{etapa\.movendo \|\| situacao\.fechado \|\| situacao\.rodapeSalvando\}/);
    expect(situacao).toContain('{ETAPA_TRAVADA}');
    expect(hook).toMatch(/if \(!item \|\| !etapaId \|\| toStageId === etapaId \|\| fechado \|\| rodapeSalvando\) return;/);
  });

  // Ajuste de 08/10 (a rede da P3-T5 muda de arquivo): a Etapa acompanha a
  // situação, e escolher Concluído marca Ganho pela rota da situação.
  it('Concluído na Etapa é Ganho, e a Etapa acompanha o Ganho/Reabrir', () => {
    expect(hook).toContain('if (novo.stage_id) setEtapaId(String(novo.stage_id));');
    expect(hook).toContain('if (ehColunaDeGanho(stages.find(s => String(s.id) === String(toStageId)))) {');
    expect(hook).toContain("await pipelinesService.setItemStatus(item.pipeline_id, item.id, { status: 'won' });");
    expect(janela).toContain('onLabelsChanged, onItemStatusChanged });');
    // O painel da Meta recomeça quando a situação muda (Ganho/Perdido/Reabrir).
    expect(janela).toContain('key={situacaoDe(card.situacao.item)}');
  });

  // Sessão de Tarefas (08/10): a casca mantém a aba Tarefas, e o "Colocar no
  // funil" vai pela conversa do card.
  it('aba Tarefas na casca e Colocar no funil pela conversa', () => {
    expect(janela).toContain("chave: 'tasks'");
    expect(janela).toContain('<TarefasDoLead pipelineItemIds={[String(item.id)]} criarNoCard={String(item.id)} aoContar={setResumoTarefas} />');
    expect(situacao).toContain('conversationId={conversaDoCard(item)}');
  });
});
