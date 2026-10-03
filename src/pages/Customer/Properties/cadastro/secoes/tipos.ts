// Assinatura comum das seções do cadastro de imóvel (Fase 4, Imóveis, entrega 3).
// Seção que precisa de mais coisa soma props próprias a esta.
import type { Property, PropertyFormData } from '@/services/properties/propertiesService';

export interface PropsDaSecao {
  form: PropertyFormData;
  setF: (patch: Partial<PropertyFormData>) => void;
  /** O imóvel salvo, na edição; nulo na criação. */
  editando: Property | null;
}

/** Campo de número livre: vazio vira nulo. */
export const numeroOuNulo = (v: string): number | null => (v ? parseFloat(v) : null);

/** Classe dos seletores do formulário (a mesma que a janela antiga usava). */
export const CLASSE_SELETOR = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
