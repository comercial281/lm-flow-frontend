import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A lista de etiquetas do CRM aparece em TRÊS lugares da landing de anúncio: o
// passo "Destino do lead" do assistente de criação, a janela "Destino do lead"
// do cartão da landing (dois seletores ali — o normal e o do desqualificado) e o
// destino por resposta dentro do editor de formulário.
//
// A cicatriz é CALADA: a rota de etiquetas é PAGINADA (20 por página por
// padrão). Quem tem mais que isso recebia só as 20 primeiras em ordem
// alfabética — nada quebra, nenhum erro aparece, a etiqueta simplesmente não
// está na lista. Já tinha acontecido no seletor de etiqueta do dashboard
// ("tráfego" sumindo com 37 etiquetas cadastradas) e voltou aqui porque estas
// três telas chamavam a rota crua em vez do serviço, que é quem carrega o
// pedido do catálogo COMPLETO.
const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

const TELAS = [
  'src/features/landing/wizard/CreateLandingWizard.tsx',
  'src/features/landing/manage/LeadRoutingModal.tsx',
  'src/features/landing/editor/LeadFormPanel.tsx',
];

describe('etiquetas nas telas da landing de anúncio', () => {
  it.each(TELAS)('%s pede a lista ao serviço de etiquetas', (tela) => {
    expect(read(tela)).toContain('labelsService.getLabels()');
  });

  // Montada em pedaços de propósito: escrita inteira, esta string é
  // indistinguível de uma chamada de verdade para quem varrer o código.
  const ROTA_CRUA = ["api.get('", '/labels', "')"].join('');

  it.each(TELAS)('%s não volta a chamar a rota crua', (tela) => {
    expect(read(tela)).not.toContain(ROTA_CRUA);
  });

  it('o serviço continua pedindo o catálogo completo', () => {
    // Sem isso, passar pelo serviço não conserta nada: ele voltaria a trazer
    // as mesmas 20 etiquetas da primeira página.
    expect(read('src/services/contacts/labelsService.ts')).toContain('per_page: 1000');
  });
});
