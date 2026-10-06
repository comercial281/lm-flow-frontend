// Os nomes que a tela usa pras escolhas da IA. Um lugar só: o passo 1, o resumo do
// passo 8 e a prévia falam igual.
import type { PersonaDaIa } from '@/services/salesAgents/salesAgentsService';

export const PERSONA_ROTULOS: Record<PersonaDaIa, string> = {
  // 06/10/2026 (onda 3): "Dono da imobiliária" (owner) não é mais oferecido; IA antiga "dono" é lida como Consultora.
  broker: 'O corretor',
  owner: 'Dono da imobiliária',
  // Era "Assistente da imobiliária" (que admitia ser virtual). Decisão do dono, 06/10:
  // o caso mais comum é uma consultora com nome de gente, da equipe da imobiliária.
  assistant: 'Consultora da imobiliária',
};

/** Tipo de venda (playbook.vars.tipo_venda). Ausente = lançamento, o padrão de fábrica. */
export const TIPO_DE_VENDA_PADRAO = 'lancamento';
export const TIPO_DE_VENDA_ROTULOS: Record<string, string> = {
  lancamento: 'Lançamento na planta',
  usado: 'Imóvel usado ou pronto',
  loteamento: 'Loteamento',
  locacao: 'Locação',
  misto: 'Misto (mais de um tipo)',
};
