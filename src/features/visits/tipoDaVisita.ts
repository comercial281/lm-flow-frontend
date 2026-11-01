import type { Visit } from '@/services/visits/visitsService';

// O tipo do compromisso da agenda (fase 5/6): visita, videochamada, reunião ou ligação.
// Os nomes são os mesmos do aviso "... marcada" que o servidor manda. Sem tipo, é Visita.
const ROTULOS: Record<string, string> = {
  visita: 'Visita',
  videochamada: 'Videochamada',
  reuniao: 'Reunião',
  ligacao: 'Ligação',
};

export function rotuloDoTipo(v: Pick<Visit, 'kind'>): string {
  return ROTULOS[String(v.kind ?? '')] ?? 'Visita';
}

/** Só o que foge do comum aparece escrito nos espaços apertados (pílula e bloco do calendário). */
export function tipoDiferente(v: Pick<Visit, 'kind'>): string | null {
  const rotulo = rotuloDoTipo(v);
  return rotulo === 'Visita' ? null : rotulo;
}
