import type { OrigemDoProprietario, StatusDoProprietario } from '@/services/propertyOwners/propertyOwnersService';
import type { Tom } from '../listingKind';

export const STATUS_DO_PROPRIETARIO: { valor: StatusDoProprietario; rotulo: string; tom: Tom }[] = [
  { valor: 'available', rotulo: 'Disponível', tom: 'ok' },
  { valor: 'has_changes', rotulo: 'Com alteração', tom: 'alerta' },
  { valor: 'unavailable', rotulo: 'Indisponível', tom: 'neutro' },
  { valor: 'no_response', rotulo: 'Sem resposta', tom: 'info' },
];

export function rotuloDoStatus(s: StatusDoProprietario): string {
  return STATUS_DO_PROPRIETARIO.find(x => x.valor === s)?.rotulo ?? 'Disponível';
}

export const ORIGEM_DO_PROPRIETARIO: Record<OrigemDoProprietario, string> = {
  manual: 'Cadastro manual', site_capture: 'Captação do site', ai: 'IA',
};

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}
