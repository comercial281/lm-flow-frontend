import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(__dirname, caminho), 'utf8');
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const codigo = semComentario(ler('MessageInput.tsx'));

describe('MessageInput → campo enxuto', () => {
  it("o editor do chat só oferece negrito e itálico", () => {
    expect(codigo).toContain("acoes={['bold', 'italic']}");
  });

  it('não tem mais atalho escondido Alt+P / Alt+L', () => {
    expect(codigo).not.toContain('altKey');
  });

  it('os botões só-ícone têm tooltip de verdade', () => {
    expect(codigo).not.toContain('title="Funis de Mensagem"');
    expect(codigo).toContain('label="Funis de mensagem"');
    expect(codigo).toContain('label="Modelos de mensagem"');
  });

  // 08/10/2026: Enviar book saiu do campo; Modelos só com algum modelo no número.
  it('não tem mais Enviar book', () => {
    expect(codigo).not.toContain('Enviar book');
    expect(codigo).not.toContain('PropertyBookPopover');
  });

  it('Modelos de mensagem depende de existir modelo no número', () => {
    expect(codigo).toContain('useTemModelos(inboxId, canMessageTemplate)');
    expect(codigo).toContain('{temModelos && (');
  });

  it('Resposta, assinatura e IA vão na barra do editor, sem linha própria', () => {
    expect(codigo).toContain('barraExtra={barraDoEditor}');
    expect(codigo.match(/<ReplyModeToggle/g)).toHaveLength(1);
    expect(codigo.match(/<AIAssistanceButton/g)).toHaveLength(1);
  });

  it('usa a frase que o ChatArea manda', () => {
    expect(codigo).toContain("placeholder ?? t('messageInput.placeholders.default')");
  });
});

describe('Editor compartilhado → landings e Site Builder ficam com tudo', () => {
  it('nenhum dos dois passa `acoes`', () => {
    for (const f of [
      '../../../features/landing/editor/panelKit.tsx',
      '../../../pages/Customer/Settings/SiteBuilder/SiteBuilder.tsx',
    ]) {
      expect(semComentario(ler(f))).not.toContain('acoes=');
    }
  });
});
