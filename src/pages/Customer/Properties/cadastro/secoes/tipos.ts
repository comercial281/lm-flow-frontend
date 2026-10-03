// Assinatura comum das seções do cadastro de imóvel (Fase 4, Imóveis, entrega 3).
// Seção que precisa de mais coisa soma props próprias a esta.
import type { Property, PropertyFormData } from '@/services/properties/propertiesService';

/**
 * O que a seção muda: um pedaço do formulário, ou uma função que o monta a
 * partir do formulário mais recente (para mudanças seguidas que não podem se
 * atropelar, como as linhas de tipologia).
 */
export type MudancaDoFormulario = Partial<PropertyFormData> | ((prev: PropertyFormData) => Partial<PropertyFormData>);

export interface PropsDaSecao {
  form: PropertyFormData;
  setF: (patch: MudancaDoFormulario) => void;
  /** O imóvel salvo, na edição; nulo na criação. */
  editando: Property | null;
}

/** Campo de número livre: vazio vira nulo. */
export const numeroOuNulo = (v: string): number | null => (v ? parseFloat(v) : null);

/** Classe dos seletores do formulário (a mesma que a janela antiga usava). */
export const CLASSE_SELETOR = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
