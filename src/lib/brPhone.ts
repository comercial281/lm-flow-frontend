/**
 * Utilitários de telefone brasileiro para os formulários públicos do Site Builder.
 *
 * Regras:
 * - Fixo:    10 dígitos → (DD) 0000-0000
 * - Celular: 11 dígitos → (DD) 90000-0000 (nono dígito obrigatório)
 * - DDD válido entre 11 e 99.
 */

/** Máscara dinâmica do IMask: escolhe fixo (10) ou celular (11) conforme o tamanho. */
export const BR_PHONE_MASK = [
  { mask: '(00) 0000-0000' },
  { mask: '(00) 00000-0000' },
];

/** Placeholder padrão usado nos campos de telefone. */
export const BR_PHONE_PLACEHOLDER = '(11) 99999-9999';

/** Mantém apenas os dígitos de um valor de telefone. */
export function brPhoneDigits(value?: string | null): string {
  return (value || '').replace(/\D/g, '');
}

/**
 * Valida um telefone brasileiro (fixo ou celular).
 * Aceita string mascarada ou só dígitos.
 */
export function isValidBrPhone(value?: string | null): boolean {
  const d = brPhoneDigits(value);
  if (d.length !== 10 && d.length !== 11) return false;

  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  // Celular (11 dígitos) precisa do nono dígito iniciando em 9.
  if (d.length === 11 && d[2] !== '9') return false;

  return true;
}
