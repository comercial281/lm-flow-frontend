import { digitsOf, national, validPhone } from '../numbers/numberPhone';

export interface PersonRow { name: string; email: string; whatsapp: string }
export interface ParseError { line: number; message: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Planilha colada vira linhas. Separador: tab (Excel/Sheets), ";" ou ",". Ordem
   fixa Nome, E-mail, Celular. Cabeçalho é detectado pela primeira linha sem
   nenhum e-mail com "@" — ela some sem virar erro. O celular guarda só os
   dígitos, igual ao cadastro de uma pessoa só. */
export function parsePeopleRows(text: string): { rows: PersonRow[]; errors: ParseError[] } {
  const rows: PersonRow[] = [];
  const errors: ParseError[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const line = i + 1;
    const sep = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : ',';
    const [name = '', email = '', phone = ''] = raw.split(sep).map(c => c.trim());

    // Cabeçalho: só na primeira linha com conteúdo, e só se nenhuma célula parece e-mail.
    const firstContent = lines.findIndex(l => l.trim()) === i;
    if (firstContent && !raw.includes('@') && /e-?mail/i.test(raw)) return;

    const mail = email.toLowerCase();
    if (!EMAIL.test(mail)) { errors.push({ line, message: `Linha ${line}: e-mail inválido` }); return; }
    const digits = digitsOf(phone);
    if (digits && !validPhone(national(digits))) {
      errors.push({ line, message: `Linha ${line}: celular inválido` });
      return;
    }
    rows.push({ name: name || mail.split('@')[0], email: mail, whatsapp: digits });
  });
  return { rows, errors };
}
