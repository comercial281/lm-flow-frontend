import type { CatalogItem } from '@/pages/SuperAdmin/featureCatalog';

export interface LimitesDoPacote { max_whatsapp_channels: number; ai_leads_included: number | null; ai_lead_overage_price_brl: number }
export interface PacoteDaLista {
  id: string; name: string; clients_count: number; features_on: number; limits: LimitesDoPacote;
  /** Preço do plano (R$/mês): a cota que conta como receita do cliente na margem. */
  price_brl: number | null;
}
export interface PacoteDetalhe extends PacoteDaLista {
  features: Record<string, boolean>; catalog: CatalogItem[]; clients: { id: string; name: string }[];
}
export interface MudancasDoPacote {
  features: { key: string; label: string; from: boolean; to: boolean }[];
  limits: { key: keyof LimitesDoPacote; from: number | null; to: number | null }[];
}
export interface EdicaoDoPacote { name?: string; features?: Record<string, boolean>; limits?: Partial<LimitesDoPacote>; price_brl?: number | null }
export interface ResultadoDeAplicar { clients_count: number; applied: number; failed: { name: string; message: string }[]; changes: MudancasDoPacote }
