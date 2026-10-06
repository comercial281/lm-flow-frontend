// Rótulo da situação do cliente. A regra mora no servidor (Tenants::Situation,
// a mesma da Visão Geral); aqui só vira texto e cor. "Suspenso" virou "Congelado" na entrega 3.
export interface RotuloSituacao { label: string; cls: string; provisionando: boolean }

const CLASSES = {
  ativo: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  provisionando: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
  com_erro: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
  congelado: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40',
  arquivado: 'bg-muted text-muted-foreground border-border',
} as const;

const ROTULOS: Record<keyof typeof CLASSES, string> = {
  ativo: 'Ativo', provisionando: 'Provisionando', com_erro: 'Com erro', congelado: 'Congelado', arquivado: 'Arquivado',
};

const DO_STATUS: Record<string, keyof typeof CLASSES> = { active: 'ativo', trial: 'ativo', suspended: 'congelado', error: 'com_erro' };

export function rotuloDaSituacao(situation: string | undefined, status: string): RotuloSituacao {
  const chave = (situation && situation in CLASSES ? situation : DO_STATUS[status] ?? 'ativo') as keyof typeof CLASSES;
  return { label: ROTULOS[chave], cls: CLASSES[chave], provisionando: chave === 'provisionando' };
}
