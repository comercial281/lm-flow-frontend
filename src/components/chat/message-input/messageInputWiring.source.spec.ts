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

  it('os três botões só-ícone têm tooltip de verdade', () => {
    expect(codigo).not.toContain('title="Funis de Mensagem"');
    expect(codigo).not.toContain('title="Enviar book de imóvel"');
    expect(codigo).toContain('label="Funis de mensagem"');
    expect(codigo).toContain('label="Enviar book"');
    expect(codigo).toContain('label="Modelos de mensagem"');
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
