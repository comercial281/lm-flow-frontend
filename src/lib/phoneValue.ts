/**
 * Conversão do valor dos campos de telefone (PhoneInput).
 *
 * O campo trabalha em E.164 (`+5511999999999`), mas cada tela guarda o número
 * do jeito que o servidor dela espera: contato em E.164, roleta/lembretes/
 * disparos só com dígitos (`5511999999999`). Estas funções fazem a ponte.
 */

/** Só os dígitos, sem "+" (ex.: "+55 (11) 99999-9999" → "5511999999999"). */
export function phoneDigits(value?: string | null): string {
  return (value || '').replace(/\D/g, '');
}

/**
 * Valor salvo → E.164 que o campo entende.
 *
 * Número antigo digitado sem país (10 ou 11 dígitos, só DDD + número) ganha o
 * 55 na frente: sem isso o campo leria "11…" como código de país.
 */
export function toE164(value?: string | null): string {
  const raw = (value || '').trim();
  const digits = phoneDigits(raw);
  if (!digits) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}
