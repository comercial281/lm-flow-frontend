// Rótulo + cor por origem do lead (`lead_origin.source`, gravado pelo servidor em
// LeadOrigin::Recorder). Todo lead tem origem (nunca "sem dados"): anúncio,
// formulário, landing, portal, site, UTM, WhatsApp orgânico, manual ou não
// identificada.
//
// Mora aqui, e não dentro da aba Origem do card do lead, porque o painel do lead
// em Conversas usa a MESMA régua: duas tabelas de nome de origem é o que deixava
// a rosca da Dashboard em inglês (ver "Origem do lead: Portal e Site").
export const SOURCE_META: Record<string, { label: string; cls: string }> = {
  whatsapp_ctwa:    { label: '💬 WhatsApp Direto (CTWA)', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  meta_lead_ads:    { label: '📋 Formulário Meta Ads', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  landing:          { label: '🌐 Landing Page', cls: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  utm:              { label: 'Campanha (UTM)', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  organic_whatsapp: { label: 'WhatsApp orgânico', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  manual:           { label: 'Adicionado manualmente', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  bolsao:           { label: '🗃️ Bolsão de Leads', cls: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  portal:           { label: 'Portal', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  site:             { label: 'Site', cls: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  unknown:          { label: 'Origem não identificada', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
};
