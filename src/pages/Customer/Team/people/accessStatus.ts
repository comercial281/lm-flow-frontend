import { hora } from '@/lib/formato';
import type { TeamAccessMember } from '@/types/teamAccess';

/* A coluna "Acesso" da lista de Pessoas: o gestor quer saber se a pessoa JÁ
   ENTROU no CRM, e se não, se ainda dá tempo do link que ela recebeu. O tom
   pinta o texto: ok (entrou), warn (falta ela agir), off (fora de combate). */

export type AccessTone = 'ok' | 'warn' | 'off';
export interface AccessStatus { label: string; detail: string; tone: AccessTone }

const diaDoCalendario = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function accessStatus(
  member: Pick<TeamAccessMember, 'deactivated' | 'last_seen_at' | 'access_link_until'>,
  now: Date = new Date(),
): AccessStatus {
  if (member.deactivated) return { label: 'Inativo', detail: '', tone: 'off' };

  const seen = member.last_seen_at ? new Date(member.last_seen_at) : null;
  if (seen && !Number.isNaN(seen.getTime())) {
    // Pelo dia do calendário local, não por 24h corridas: "ontem às 23h" visto
    // às 08h de hoje é "Ontem", e não "Hoje".
    const dias = Math.round((diaDoCalendario(now) - diaDoCalendario(seen)) / 86_400_000);
    const detail = dias <= 0
      ? `Entrou hoje, ${hora(seen)}`
      : dias === 1
        ? `Ontem, ${hora(seen)}`
        : `Há ${dias} dias`;
    return { label: 'Ativo', detail, tone: 'ok' };
  }

  const until = member.access_link_until ? new Date(member.access_link_until) : null;
  if (until && !Number.isNaN(until.getTime())) {
    if (until.getTime() > now.getTime()) {
      return { label: 'Link enviado', detail: `Ainda não entrou · vale até ${hora(until)}`, tone: 'warn' };
    }
    // Mandou e passou do prazo sem ela entrar: precisa de um link novo.
    return { label: 'Link expirou', detail: 'Ainda não entrou', tone: 'warn' };
  }

  return { label: 'Nunca recebeu acesso', detail: '', tone: 'warn' };
}
