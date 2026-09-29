// NOME FIXO NO TEXTO (fase 2b.2, E39). O dono do produto mostrou o print:
// "Eu sou a Gabriela, consultora…" saindo para lead de QUALQUER corretor, por
// qualquer número. Nos editores da ação de mensagem (Automações de Lead) e do
// passo do funil (Follow-up), a tela avisa — não barra — quando o texto tem o
// primeiro nome de alguém da equipe, e sugere {{corretor}}.
//
// Regra: palavra inteira, sem acento e sem caixa, fora de {{…}}, nome com 3
// letras ou mais (desativados também contam: nome de quem saiu é o pior caso).
// Conselho de escrita, não regra de envio — por isso mora na tela.

export interface TeamMemberLike {
  name?: string | null;
}

export const TEAM_NAME_MIN_LENGTH = 3;

// O intervalo de acentos é escrito como \u0300-\u036f de propósito: caractere
// combinante literal no fonte é a cicatriz do landingUrl.ts — o editor ou o
// lint apagam em silêncio, e a comparação sem acento quebra.
const semAcento = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** O primeiro nome (como está cadastrado) de quem aparece no texto, ou null. */
export function teamNameInText(text: string | null | undefined, team: ReadonlyArray<TeamMemberLike>): string | null {
  const livre = semAcento(String(text ?? '').replace(/\{\{[^}]*\}\}/g, ' '));
  if (!livre.trim()) return null;

  const palavras = new Set(livre.split(/[^a-z0-9]+/).filter(Boolean));
  for (const pessoa of team) {
    const primeiro = String(pessoa.name ?? '').trim().split(/\s+/)[0] ?? '';
    if (primeiro.length < TEAM_NAME_MIN_LENGTH) continue;
    if (palavras.has(semAcento(primeiro))) return primeiro;
  }
  return null;
}

export function teamNameWarning(text: string | null | undefined, team: ReadonlyArray<TeamMemberLike>): string | null {
  const nome = teamNameInText(text, team);
  if (!nome) return null;
  return (
    `O texto cita "${nome}", que é da equipe: todo lead recebe esse nome, seja de qual corretor for. ` +
    'Para sair o nome de quem atende o lead, use {{corretor}}.'
  );
}
