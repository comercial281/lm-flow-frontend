import { CalendarDays, Home, Mail, Megaphone, MessageCircle, Phone, Tag, UserRound, type LucideIcon } from 'lucide-react';

// A lista de categorias é do cliente (Minha imobiliária › Listas) e não guarda
// ícone: ele sai do nome. Ordem importa ("visita ao imóvel" é visita).
const REGRAS: [RegExp, LucideIcon][] = [
  [/follow|retorno|acompanha/, UserRound],
  [/oferta|campanha|divulga/, Megaphone],
  [/visita/, CalendarDays],
  [/im[oó]vel|atualiza|capta/, Home],
  [/liga|telefon/, Phone],
  [/whats|mensagem/, MessageCircle],
  [/e-?mail/, Mail],
];

export function iconeDaCategoria(nome: string): LucideIcon {
  const n = nome.toLowerCase();
  return REGRAS.find(([re]) => re.test(n))?.[1] ?? Tag;
}
