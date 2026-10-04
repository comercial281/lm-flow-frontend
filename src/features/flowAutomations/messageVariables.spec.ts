import { describe, it, expect } from 'vitest';
import { BUILTIN_MESSAGE_VARIABLES, insertAtCursor, withTenantVariables } from './messageVariables';

describe('variáveis de mensagem (sprint 4)', () => {
  it('as prontas são as das Automações, que o construtor também preenche', () => {
    const tokens = BUILTIN_MESSAGE_VARIABLES.map(v => v.token);
    expect(tokens).toContain('{{nome}}');
    expect(tokens).toContain('{{corretor}}');
    expect(tokens).toContain('{{imovel_titulo}}');
    // As antigas do construtor ({{first_name}}…) continuam valendo no envio, mas não são oferecidas.
    expect(tokens).not.toContain('{{first_name}}');
  });

  it('acrescenta as da imobiliária ligadas, sem repetir as prontas', () => {
    const list = withTenantVariables(BUILTIN_MESSAGE_VARIABLES, {
      custom: [
        { id: '1', token: 'empreendimento', placeholder: '{{empreendimento}}', label: 'Empreendimento', active: true, value_source: 'literal:x', created_at: '', updated_at: '' },
        { id: '2', token: 'desligada', placeholder: '{{desligada}}', label: 'Desligada', active: false, value_source: 'literal:x', created_at: '', updated_at: '' },
        { id: '3', token: 'nome', placeholder: '{{nome}}', label: 'Nome de novo', active: true, value_source: 'contact.name', created_at: '', updated_at: '' },
      ],
    });
    expect(list.length).toBe(BUILTIN_MESSAGE_VARIABLES.length + 1);
    expect(list[list.length - 1]).toEqual({ label: 'Empreendimento', token: '{{empreendimento}}', description: undefined, custom: true });
  });

  it('sem resposta do servidor, só as prontas', () => {
    expect(withTenantVariables(BUILTIN_MESSAGE_VARIABLES, null)).toEqual(BUILTIN_MESSAGE_VARIABLES);
  });

  it('põe no cursor, troca o trecho selecionado e, sem cursor, vai pro fim', () => {
    expect(insertAtCursor('Oi , tudo bem?', '{{nome}}', 3, 3)).toEqual({ text: 'Oi {{nome}}, tudo bem?', cursor: 11 });
    expect(insertAtCursor('Oi FULANO!', '{{nome}}', 3, 9)).toEqual({ text: 'Oi {{nome}}!', cursor: 11 });
    expect(insertAtCursor('Oi ', '{{nome}}')).toEqual({ text: 'Oi {{nome}}', cursor: 11 });
  });
});
