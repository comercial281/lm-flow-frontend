import type { Label, LabelCategory } from '@/types/settings';

export const CATEGORIAS_DO_SISTEMA: { id: LabelCategory; nome: string; frase: string }[] = [
  { id: 'service', nome: 'Atendimento', frase: 'Colocada quando uma visita é marcada, pela IA ou pelo botão Agendar visita.' },
  { id: 'followup', nome: 'Follow-up', frase: 'Colocadas pelo follow-up e pelos fluxos para saber em que mensagem o lead está.' },
  { id: 'lead_source', nome: 'Origem do lead', frase: 'Colocadas no lead que chega pelo formulário do Meta e pelos portais.' },
  { id: 'deal_type', nome: 'Tipo de negócio', frase: 'Venda ou locação, colocadas pela IA, pelo site e pelos portais.' },
  { id: 'property', nome: 'Imóveis', frase: 'Colocadas automaticamente no lead que chega pela página de cada imóvel.' },
  { id: 'sales_agent', nome: 'IA Vendedora (antigas)', frase: 'A IA não coloca mais essas etiquetas. Elas continuam nos leads que já tinham.' },
];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const casa = (label: Label, busca: string) => {
  if (!busca) return true;
  const alvo = semAcento(busca.trim());
  return semAcento(label.display_name ?? label.title).includes(alvo) || semAcento(label.title).includes(alvo);
};

export function agruparEtiquetas(labels: Label[], busca: string) {
  const filtradas = labels.filter(l => casa(l, busca));
  const suas = filtradas.filter(l => !l.category || l.category === 'own');
  const sistema = CATEGORIAS_DO_SISTEMA
    .map(c => ({ ...c, itens: filtradas.filter(l => l.category === c.id) }))
    .filter(c => c.itens.length > 0);
  return { suas, sistema };
}
