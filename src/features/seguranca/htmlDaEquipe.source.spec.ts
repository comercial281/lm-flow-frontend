import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// HTML escrito pela equipe do cliente (contrato, modelos de e-mail, widget) passa
// pelo htmlSeguro antes da tela (auditoria 3E-07, 12/11/2026). Este teste lê o
// código: HTML cru de volta nesses arquivos quebra aqui.
const raiz = resolve(__dirname, '../../..');
const ler = (p: string) => readFileSync(resolve(raiz, p), 'utf8');

const ARQUIVOS = [
  'src/components/channels/settings/TemplatePreview.tsx',
  'src/pages/Customer/Settings/EmailTemplateEditor/EmailTemplateEditor.tsx',
  'src/components/channels/settings/widget/WidgetHead.tsx',
  'src/components/widget/PreChatForm.tsx',
  'src/components/contacts/StartConversationModal.tsx',
];

describe('HTML da equipe do cliente na tela', () => {
  it.each(ARQUIVOS)('%s só desenha HTML passado pelo htmlSeguro', (arquivo) => {
    const fonte = ler(arquivo);
    const usos = fonte.match(/dangerouslySetInnerHTML=\{\{\s*__html:\s*[^}]*\}\}/g) ?? [];
    expect(usos.length).toBeGreaterThan(0);
    for (const uso of usos) expect(uso).toMatch(/__html:\s*htmlSeguro\(/);
  });

  it('o contrato da Locação pinta o texto salvo pelo limpador, com a lista de classes', () => {
    const fonte = ler('src/pages/Customer/Locacao/ficha/AbaContrato.tsx');
    const pinturas = fonte.match(/\.innerHTML\s*=\s*[^;]+;/g) ?? [];
    expect(pinturas.length).toBeGreaterThan(0);
    for (const p of pinturas) expect(p).toMatch(/innerHTML\s*=\s*htmlSeguro\([^;]*CLASSES_DO_CONTRATO/);
  });
});
