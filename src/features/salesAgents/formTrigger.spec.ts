import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { formIdsDropped, formOptions, formTriggerNotice, toggleForm } from './formTrigger';

// Gatilho "Veio de um destes formulários" (23/09/2026): a IA só entra na conversa
// do lead que veio das campanhas escolhidas.
describe('formOptions', () => {
  const configs = [
    { form_id: '111', form_name: 'Capri', page_name: 'Imob A' },
    { form_id: '222', form_name: 'Green Park', page_name: null, is_active: false },
  ];

  it('marca só os escolhidos e diz a página', () => {
    const opts = formOptions(configs, ['111']);
    expect(opts.map((o) => [o.label, o.checked])).toEqual([
      ['Capri · Imob A', true],
      ['Green Park', false],
    ]);
    expect(opts[1].inactive).toBe(true);
  });

  // Escolhido cuja config foi apagada NÃO some: sumir faria o próximo clique regravar
  // a lista sem ele, calado.
  it('mantém à mostra o escolhido que não está mais cadastrado', () => {
    const orphan = formOptions(configs, ['999']).find((o) => o.formId === '999');
    expect(orphan).toMatchObject({ checked: true, orphan: true });
  });
});

describe('toggleForm', () => {
  it('liga e desliga sem mexer nos outros', () => {
    expect(toggleForm(['111'], '222')).toEqual(['111', '222']);
    expect(toggleForm(['111', '222'], '111')).toEqual(['222']);
    expect(toggleForm(undefined, '111')).toEqual(['111']);
  });
});

describe('formTriggerNotice', () => {
  it('avisa que nenhum marcado não ativa ninguém', () => {
    expect(formTriggerNotice([], 2)).toMatch(/não ativa a IA para ninguém/);
  });

  it('manda cadastrar quando não há formulário', () => {
    expect(formTriggerNotice([], 0)).toMatch(/Origem → Formulários/);
  });

  it('cala quando há escolha', () => {
    expect(formTriggerNotice(['111'], 2)).toBeNull();
  });
});

// ⚠️ A lista vai dentro de `triggers`, que já está no PATCH campo a campo do
// `saveAgent`. Campo solto no agente seria descartado em silêncio.
describe('ligação na tela', () => {
  const tela = readFileSync(
    resolve(__dirname, '../../pages/Customer/Automations/SalesAgents/SalesAgents.tsx'), 'utf8',
  );

  it('oferece o tipo form e grava form_ids dentro do gatilho', () => {
    expect(tela).toContain("{ value: 'form', label:");
    expect(tela).toContain("case 'form': return { type, form_ids: [] }");
    expect(tela).toContain('form_ids: toggleForm(');
  });
});

describe('formIdsDropped', () => {
  it('acusa quando o servidor devolve o gatilho sem a lista', () => {
    expect(formIdsDropped([{ type: 'form', form_ids: ['1'] }], [{ type: 'form' }])).toBe(true);
  });
  it('cala quando guardou, ou quando não havia nada marcado', () => {
    expect(formIdsDropped([{ type: 'form', form_ids: ['1'] }], [{ type: 'form', form_ids: ['1'] }])).toBe(false);
    expect(formIdsDropped([{ type: 'form', form_ids: [] }], [{ type: 'form' }])).toBe(false);
  });
});
