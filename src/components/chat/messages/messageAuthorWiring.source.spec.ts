import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// A bolha usa a regra testada (features/numbers/messageAuthor.ts) — uma só,
// para o selo "Atendente" não voltar a mostrar nome inventado (fase 2b.2).
const bruto = readFileSync(resolve(__dirname, 'MessageBubble.tsx'), 'utf8');
const codigo = bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('MessageBubble → nome ao lado de "Atendente"', () => {
  it('vem de agentDisplayNameFor', () => {
    expect(codigo).toContain('const agentDisplayName = agentDisplayNameFor(message);');
    expect(codigo).not.toContain('const isAutomated');
    expect(codigo).not.toContain('const senderIsContact');
  });
});
