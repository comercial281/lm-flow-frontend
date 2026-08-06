import { describe, it, expect } from 'vitest';
import { contactSaveError } from './contactErrors';

/** Erro do axios como o backend devolve em POST /contacts. */
function apiError(code: string, details?: Record<string, unknown>, message = 'boom') {
  return { response: { status: 422, data: { error: { code, message, details } } } };
}

describe('contactSaveError', () => {
  it('names the existing contact when the phone is already taken', () => {
    const result = contactSaveError(
      apiError('DUPLICATE_PHONE', {
        field: 'phone_number',
        duplicate: true,
        visible: true,
        contact: { id: 'abc', name: 'Joana da Carteira', phone_number: '+5519999990000' },
      }),
      'Erro ao criar contato',
    );

    expect(result.duplicate).toBe(true);
    expect(result.existing?.id).toBe('abc');
    expect(result.message).toBe('Já existe um contato com esse telefone: Joana da Carteira.');
  });

  it('uses the e-mail wording for an e-mail conflict', () => {
    const result = contactSaveError(
      apiError('DUPLICATE_EMAIL', {
        field: 'email',
        duplicate: true,
        visible: true,
        contact: { id: 'def', name: 'Maria' },
      }),
      'Erro ao criar contato',
    );

    expect(result.message).toBe('Já existe um contato com esse e-mail: Maria.');
  });

  // Corretor isolado não recebe o nome do lead de outro corretor, mas precisa
  // saber por que o cadastro não passou — senão fica tentando de novo.
  it('says the contact exists even without being allowed to identify it', () => {
    const result = contactSaveError(
      apiError('DUPLICATE_PHONE', { field: 'phone_number', duplicate: true, visible: false }),
      'Erro ao criar contato',
    );

    expect(result.duplicate).toBe(true);
    expect(result.existing).toBeUndefined();
    expect(result.message).toContain('cadastrado por outra pessoa da equipe');
  });

  it('passes a non-duplicate validation error through with the backend message', () => {
    const result = contactSaveError(
      apiError('VALIDATION_ERROR', undefined, 'Phone number should be in e164 format'),
      'Erro ao criar contato',
    );

    expect(result.duplicate).toBe(false);
    expect(result.message).toBe('Phone number should be in e164 format');
  });

  it('falls back when the error carries nothing usable', () => {
    const result = contactSaveError(new Error('network down'), 'Erro ao criar contato');

    expect(result.duplicate).toBe(false);
    expect(result.message).toBe('Erro ao criar contato');
  });
});
