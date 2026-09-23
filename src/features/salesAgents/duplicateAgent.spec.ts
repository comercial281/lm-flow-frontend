import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { defaultCopyName, duplicateSummary } from './duplicateAgent';

const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

describe('defaultCopyName', () => {
  it('marca a cópia no nome, igual ao servidor', () => {
    expect(defaultCopyName('Clelia')).toBe('Clelia (cópia)');
  });

  it('não deixa a cópia sem nome', () => {
    expect(defaultCopyName('   ')).toBe('IA Vendedora (cópia)');
    expect(defaultCopyName(undefined)).toBe('IA Vendedora (cópia)');
  });

  it('respeita o limite de 200 do nome', () => {
    expect(defaultCopyName('x'.repeat(250))).toHaveLength(200);
  });
});

describe('duplicateSummary', () => {
  it('conta o que foi junto e avisa que nasceu desligada', () => {
    const txt = duplicateSummary({ name: 'Clelia (cópia)', duplicated: { lessons: 3, documents: 1, warnings: [] } });
    expect(txt).toContain('a configuração, 3 lições e 1 arquivo da base');
    expect(txt).toContain('DESLIGADA');
  });

  it('sem lição nem arquivo, fala só da configuração', () => {
    expect(duplicateSummary({ name: 'X', duplicated: { lessons: 0, documents: 0, warnings: [] } }))
      .toContain('criada com a configuração.');
  });

  it('aguenta servidor antigo sem o resumo', () => {
    expect(duplicateSummary({ name: 'X' })).toContain('DESLIGADA');
  });
});

// A cópia só aparece como a IA SELECIONADA se a tela a escolher depois de criar.
describe('a tela', () => {
  const tela = read('src/pages/Customer/Automations/SalesAgents/SalesAgents.tsx');

  it('tem o botão de duplicar e usa o serviço', () => {
    expect(tela).toContain('DuplicateAgentDialog');
    expect(read('src/components/salesAgents/DuplicateAgentDialog.tsx')).toContain('salesAgentsService.duplicate');
  });
});
