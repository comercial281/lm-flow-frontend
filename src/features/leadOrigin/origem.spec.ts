import { describe, expect, it } from 'vitest';
import { SOURCE_META } from './origem';

// A tabela saiu de dentro da aba Origem do card do lead para ser a MESMA régua
// do painel do lead em Conversas. Os rótulos não podem mudar na mudança.

describe('SOURCE_META — rótulo de cada origem', () => {
  it.each([
    ['whatsapp_ctwa', '💬 WhatsApp Direto (CTWA)'],
    ['meta_lead_ads', '📋 Formulário Meta Ads'],
    ['landing', '🌐 Landing Page'],
    ['utm', 'Campanha (UTM)'],
    ['organic_whatsapp', 'WhatsApp orgânico'],
    ['manual', 'Adicionado manualmente'],
    ['bolsao', '🗃️ Bolsão de Leads'],
    ['portal', 'Portal'],
    ['site', 'Site'],
    ['unknown', 'Origem não identificada'],
  ])('%s → %s', (source, rotulo) => {
    expect(SOURCE_META[source]?.label).toBe(rotulo);
    expect(SOURCE_META[source]?.cls).toBeTruthy();
  });

  it('origem que a tela não conhece não tem rótulo', () => {
    expect(SOURCE_META['tiktok_ads']).toBeUndefined();
  });
});
