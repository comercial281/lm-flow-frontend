// Os nomes que a tela usa pras escolhas da IA. Um lugar só: o passo 1, o resumo do
// passo 8 e a prévia falam igual.
import type { PersonaDaIa } from '@/services/salesAgents/salesAgentsService';

export const PERSONA_ROTULOS: Record<PersonaDaIa, string> = {
  broker: 'O próprio corretor',
  owner: 'Dono da imobiliária',
  assistant: 'Assistente da imobiliária',
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
