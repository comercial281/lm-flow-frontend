import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// A rota de etiquetas é PAGINADA: 20 por página por padrão. Quem chama sem pedir
// o catálogo completo recebe as 20 primeiras em ordem alfabética — e o defeito é
// MUDO. Nada quebra, nenhum tipo reclama, nenhum erro aparece na tela: a
// etiqueta simplesmente não está na lista, indistinguível de etiqueta que não
// existe.
//
// Esta pegadinha já mordeu quatro vezes, em telas diferentes, porque cada
// conserto foi local: a tela de etiquetas (criar uma que já existia fora da 1ª
// página dava "Validation failed"), o seletor do painel inicial ("tráfego"
// sumindo com 37 cadastradas), as três telas da landing de anúncio, e os
// formulários de macro, automação e conta.
//
// Por isso o portão é do REPOSITÓRIO INTEIRO e não de uma tela: existe UMA porta
// para buscar etiqueta, e é o serviço. O spec lê o código-fonte porque é lá que
// a regra mora — não há tipo, render nem build que a segure.
const raiz = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(raiz, p), 'utf8');

const SERVICO = 'src/services/contacts/labelsService.ts';

/** A chamada crua, montada em pedaços: escrita inteira, esta string seria
 *  indistinguível de uma chamada de verdade para quem varrer o código. */
const ROTA_CRUA = ["api.get('", '/labels', "'"].join('');

function arquivosDeCodigo(dir: string, achados: string[] = []): string[] {
  for (const entrada of readdirSync(resolve(raiz, dir), { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      arquivosDeCodigo(caminho, achados);
      continue;
    }
    if (!/\.tsx?$/.test(entrada.name)) continue;
    // Specs ficam de fora: eles PRECISAM citar a chamada crua para reprová-la.
    if (/\.spec\.tsx?$/.test(entrada.name)) continue;
    achados.push(caminho.split('\\').join('/'));
  }
  return achados;
}

describe('catálogo de etiquetas: uma porta só', () => {
  it('nenhum arquivo chama a rota de etiquetas direto, fora do próprio serviço', () => {
    const infratores = arquivosDeCodigo('src')
      .filter((p) => relative(SERVICO, p) !== '')
      .filter((p) => p !== SERVICO)
      .filter((p) => read(p).includes(ROTA_CRUA));

    // A mensagem entrega o conserto junto com a reprovação: quem cair aqui
    // provavelmente não sabe que a rota pagina.
    expect(infratores, 'use labelsService.getLabels(): a rota devolve só 20 por página').toEqual([]);
  });

  it('o serviço pede o catálogo COMPLETO', () => {
    // Sem isto, passar pelo serviço não conserta nada — ele voltaria a entregar
    // as mesmas 20 primeiras para todas as telas de uma vez.
    expect(read(SERVICO)).toContain('per_page: 1000');
  });

  // As telas onde a lista truncada foi vista com os próprios olhos. Não é a
  // lista completa de quem usa etiqueta — é a lista de quem já teve o defeito.
  const COM_CICATRIZ = [
    'src/features/landing/wizard/CreateLandingWizard.tsx',
    'src/features/landing/manage/LeadRoutingModal.tsx',
    'src/features/landing/editor/LeadFormPanel.tsx',
    'src/services/macros/macrosService.ts',
    'src/services/automation/automationService.ts',
    'src/services/account/accountService.ts',
    'src/services/chat/chatService.ts',
    'src/pages/Customer/DashboardV2/components/TagPicker.tsx',
  ];

  it.each(COM_CICATRIZ)('%s busca etiqueta pelo serviço', (arquivo) => {
    expect(read(arquivo)).toContain('labelsService.getLabels()');
  });
});
