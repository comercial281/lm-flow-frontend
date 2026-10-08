// src/components/pipelines/EditItemModal.situacao.source.spec.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O card do lead tem mais de 800 linhas e chama 12 serviços ao abrir: montá-lo num
// teste mediria os mocks, não a ligação. Lê o código (como permissionRoutes).
const src = readFileSync(resolve(__dirname, 'EditItemModal.tsx'), 'utf8');

describe('janela do card × situação (spec funil §3.8)', () => {
  it('Ganho/Perdido/Reabrir vêm da situação do card, não da coluna', () => {
    expect(src).toContain('<CardResultFooter item={itemDaSituacao ?? item} onMudou={aoMudarSituacao} bloqueado={movendoEtapa} onSalvando={setRodapeSalvando} />');
    expect(src).toContain('onItemStatusChanged?.(novo)');
    expect(src).not.toContain('etapaFinal');
    expect(src).not.toMatch(/<CardResultFooter[^>]*stages=/);
  });

  it('card fechado: selo junto do nome e Etapa travada (reabrir antes)', () => {
    expect(src).toContain('<SeloSituacao status={situacaoDe(itemDaSituacao)}');
    expect(src).toMatch(/<CampoEtapa[^>]*disabled=\{movendoEtapa \|\| fechado \|\| rodapeSalvando\}/);
    expect(src).toContain('{ETAPA_TRAVADA}');
    expect(src).toMatch(/if \(!item \|\| !etapaId \|\| toStageId === etapaId \|\| fechado \|\| rodapeSalvando\) return;/);
  });

  // Ajuste de 08/10: Ganho leva o card para Concluído, e Concluído na Etapa é Ganho.
  it('a Etapa acompanha a situação, e escolher Concluído marca Ganho pela rota da situação', () => {
    expect(src).toContain('if (novo.stage_id) setEtapaId(String(novo.stage_id));');
    expect(src).toContain('if (ehColunaDeGanho(stages.find(s => String(s.id) === String(toStageId)))) {');
    expect(src).toContain("await pipelinesService.setItemStatus(item.pipeline_id, item.id, { status: 'won' });");
  });
});
