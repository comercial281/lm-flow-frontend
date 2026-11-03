// A ficha de quem fala (fase 6, Tarefa 71): a voz efetiva de um número (o que ele tem de
// próprio, e o resto vem da casa), a prévia de como ela se apresenta e o texto "o que a voz faz".
import type { AgentNumber, HouseVoice, QuemFala, Voz } from '@/services/salesAgents/salesAgentsService';

export const ROTULO_DA_VOZ: Record<QuemFala, string> = {
  corretor: 'Corretor',
  consultora: 'Consultora',
  dono_gerente: 'Dono ou gerente',
};

/** Uma frase pra cada voz: o que muda na conversa. */
export const O_QUE_A_VOZ_FAZ: Record<QuemFala, string> = {
  corretor: 'Fala como o próprio dono do número, em primeira pessoa, e usa a agenda dele.',
  consultora: 'Fala como alguém do time e passa pro corretor no fim.',
  dono_gerente: 'Fala como quem manda e pode chamar alguém da equipe pro lead.',
};

const vazio = (t: string | undefined | null) => !t || !t.trim();

/** Número cuja caixa de entrada foi excluída em Canais: o servidor manda `inbox_name` nulo. */
export const NUMERO_EXCLUIDO = 'Número excluído';

/**
 * O nome do número na tela: o usuário dono, senão o nome da caixa de entrada, senão "Número excluído".
 * ⚠️ Os dois podem vir nulos (caixa excluída e sem dono): a tela de Números e usuários
 * caía inteira tirando as iniciais de nulo (03/11/2026).
 */
export function nomeDoNumero(n: Pick<AgentNumber, 'owner_name' | 'inbox_name'>): string {
  return n.owner_name || n.inbox_name || NUMERO_EXCLUIDO;
}

export function iniciaisDoNome(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * A voz com que o número fala: campo ausente ou em branco herda o da casa. O endereço do
 * escritório é da casa e não entra aqui.
 */
export function vozDoNumero(numero: Pick<AgentNumber, 'voice'>, casa: HouseVoice | null | undefined): Voz {
  const propria = numero.voice ?? {};
  const base = casa ?? {};
  const voz: Voz = {};
  const kind = propria.kind ?? base.kind;
  const gender = propria.gender ?? base.gender;
  const name = !vazio(propria.name) ? propria.name : base.name;
  const intro = !vazio(propria.intro) ? propria.intro : base.intro;
  if (kind) voz.kind = kind;
  if (!vazio(name)) voz.name = name;
  if (gender) voz.gender = gender;
  if (!vazio(intro)) voz.intro = intro;
  return voz;
}

const IMOBILIARIA_DE_EXEMPLO = 'Aurora Imóveis';

/** Quem fala quando a ficha não diz o nome: pelo jeito de falar e pelo gênero. */
function papel(voz: Voz): string {
  const ela = voz.gender === 'ela';
  if (voz.kind === 'dono_gerente') return ela ? 'a dona' : 'o dono';
  return ela ? 'a corretora' : 'o corretor';
}

/** A primeira mensagem de exemplo, como o lead lê. Texto fixo, nome de lead e imóvel inventados. */
export function previaDaApresentacao(voz: Voz, imobiliaria: string = IMOBILIARIA_DE_EXEMPLO): string {
  const intro = voz.intro?.trim();
  let apresenta: string;
  if (intro) apresenta = intro.charAt(0).toUpperCase() + intro.slice(1);
  else if (voz.kind === 'consultora' || !voz.kind) apresenta = `Aqui é do time da ${imobiliaria}`;
  else apresenta = `Aqui é ${voz.name?.trim() || papel(voz)}`;
  return `Oi, Maria! ${apresenta.replace(/[.\s]+$/, '')}. Vi que você se interessou pelo Residencial Teste. Me conta: é pra morar ou pra investir?`;
}

/** Quantos formulários o número escuta: os do gatilho dele, ou os do agente quando ele herda. */
export function formulariosDoNumero(
  numero: Pick<AgentNumber, 'triggers'>,
  triggersDoAgente: { type: string; form_ids?: string[] }[] | null | undefined,
): number {
  const gatilhos = numero.triggers ?? triggersDoAgente ?? [];
  return gatilhos.filter((t) => t.type === 'form').reduce((soma, t) => soma + (t.form_ids?.length ?? 0), 0);
}
