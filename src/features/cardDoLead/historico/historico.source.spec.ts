import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Onde cada modo do Histórico mora. Trocar o modo ou voltar a pedir o /events
// antigo não quebra tipo nem teste de componente — quebra a decisão do dono
// (janela: Histórico e Observações separados; página: Observações também como
// filtro, com a caixa de escrever). Por isso este spec lê o código-fonte.
const raiz = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(raiz, p), 'utf8');

const COLUNA_DA_PAGINA = 'src/features/cardDoLead/pagina/ColunaDoHistorico.tsx';
const ABA_DA_JANELA = 'src/components/pipelines/card/LeadDetailsTab.tsx';
const HOOK = 'src/features/cardDoLead/useCardDoLead.ts';
const PAGINA = 'src/pages/Customer/Pipelines/CardCompleto/CardCompletoPage.tsx';
const ARQUIVOS_DO_CARD = [
  'src/components/pipelines/EditItemModal.tsx',
  PAGINA,
  HOOK,
  ABA_DA_JANELA,
  COLUNA_DA_PAGINA,
];

describe('o Histórico novo no card', () => {
  it('a página usa o modo completo, com a chave de Observações do cliente, sem a caixa separada', () => {
    const src = read(COLUNA_DA_PAGINA);
    expect(src).toContain('<HistoricoDoLead');
    expect(src).toContain('modo="completo"');
    expect(src).toContain('comObservacoes={card.recursos.notas}');
    expect(src).not.toContain('BlocoObservacoes');
  });

  it('a janela usa o modo compacto, com as Observações numa caixa ao lado', () => {
    const src = read(ABA_DA_JANELA);
    expect(src).toContain('modo="compacto"');
    expect(src).toContain('<BlocoObservacoes');
  });

  it('a chave de recarga sai do useVersaoDoHistorico, no card da situação', () => {
    expect(read(HOOK)).toContain('useVersaoDoHistorico(');
    expect(read(HOOK)).toContain('itemDaSituacao?.id === item?.id');
  });

  it('Tirar da roleta recarrega o Histórico ao terminar (os passos da roleta moram em Rodízios)', () => {
    const src = read('src/features/cardDoLead/blocos/DialogosDoCard.tsx');
    expect(src).toMatch(/onDone=\{\(\) => \{[^}]*card\.historico\.recarregar\(\)/);
  });

  it('arquivar/desarquivar na página recarrega o Histórico (o item volta com o mesmo id e situação)', () => {
    // Achado 4 do preflight da Parte 5: sem isto, a linha "Arquivado" só aparece com F5.
    expect(read(PAGINA)).toContain('card.historico.recarregar()');
  });

  it('nenhum arquivo do card pede o histórico antigo nem pinta pelo prefixo do id', () => {
    for (const arquivo of ARQUIVOS_DO_CARD) {
      const src = read(arquivo);
      expect(src, arquivo).not.toContain('getContactEvents');
      expect(src, arquivo).not.toContain('corDoEvento');
    }
    expect(existsSync(resolve(raiz, 'src/features/cardDoLead/blocos/BlocoHistorico.tsx'))).toBe(false);
  });
});
