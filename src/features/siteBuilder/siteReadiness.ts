// "Seu site está N% pronto" do Painel. Cinco itens contam; o endereço próprio
// aparece mas não conta (é opcional e pago). A marca d'água também aparece como
// sugestão e NÃO conta por enquanto: a liberação dela espera a faxina do disco
// (decisão do dono). Quando liberar, volta a `conta: true`.
import type { Site } from '@/services/siteBuilder/siteBuilderService';
import type { TelaId } from './meuSiteMenu';

export interface ItemPronto { id: string; rotulo: string; feito: boolean; tela: TelaId; conta: boolean }

export function siteReadiness(site: Site, publishedProperties: number): { percent: number; itens: ItemPronto[] } {
  const s = site as Site & { watermark?: { enabled?: boolean; logo_url?: string | null } };
  const tem = (v: unknown) => typeof v === 'string' ? v.trim() !== '' : !!v;
  const itens: ItemPronto[] = [
    { id: 'logo', rotulo: 'Logo enviado', feito: tem(s.branding?.logo_url), tela: 'aparencia', conta: true },
    { id: 'contato', rotulo: 'Dados de contato', feito: tem(s.contact?.whatsapp) || tem(s.contact?.phone), tela: 'dados', conta: true },
    // Não há tela de imóveis no Meu site: o Painel leva este item para /properties.
    { id: 'imovel', rotulo: 'Ao menos 1 imóvel no site', feito: publishedProperties > 0, tela: 'aparencia', conta: true },
    { id: 'rastreamento', rotulo: 'Rastreamento ligado', feito: tem(s.tracking?.ga4_measurement_id) || tem(s.tracking?.facebook_pixel_id), tela: 'rastreamento', conta: true },
    { id: 'redes', rotulo: 'Redes sociais', feito: Object.values(s.social_links ?? {}).some(tem), tela: 'redes', conta: true },
    { id: 'marca', rotulo: "Marca d'água", feito: !!s.watermark?.enabled && tem(s.watermark?.logo_url), tela: 'marca', conta: false },
    { id: 'endereco', rotulo: 'Endereço próprio (opcional)', feito: tem(s.primary_domain), tela: 'endereco', conta: false },
  ];
  const contam = itens.filter(i => i.conta);
  return { percent: Math.round((contam.filter(i => i.feito).length / contam.length) * 100), itens };
}
