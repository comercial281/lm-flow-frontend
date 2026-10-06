import { describe, it, expect } from 'vitest';
import { resumoDeMudancas } from './resumoDeMudancas';

describe('resumoDeMudancas', () => {
  it('frases curtas pra prévia', () => {
    expect(resumoDeMudancas({
      features: [{ key: 'bolsao', label: 'Bolsão', from: false, to: true }, { key: 'disparos', label: 'Disparos', from: true, to: false }],
      limits: [{ key: 'max_whatsapp_channels', from: 5, to: 2 }, { key: 'ai_leads_included', from: null, to: 100 },
               { key: 'ai_lead_overage_price_brl', from: 2.49, to: 1.99 }],
    })).toEqual(['liga Bolsão', 'desliga Disparos', 'números de WhatsApp 5 → 2', 'franquia de leads da IA sem franquia → 100',
                 'preço do excedente R$ 2,49 → R$ 1,99']);
  });

  it('0 números é ilimitado', () => {
    expect(resumoDeMudancas({ features: [], limits: [{ key: 'max_whatsapp_channels', from: 0, to: 3 }] }))
      .toEqual(['números de WhatsApp ilimitado → 3']);
  });

  it('aceita o formato do diff do cliente (tenant/package)', () => {
    expect(resumoDeMudancas({
      features: [{ label: 'Bolsão', package: true }],
      limits: [{ key: 'max_whatsapp_channels', tenant: 1, package: 0 }],
    })).toEqual(['liga Bolsão', 'números de WhatsApp 1 → ilimitado']);
  });
});
