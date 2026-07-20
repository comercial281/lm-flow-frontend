/**
 * Origens de lead que podem entrar automaticamente num funil.
 * As chaves batem 1:1 com LeadOrigin::PipeEntry::GROUPS no backend.
 *
 * Onde é usado:
 * - Por PIPELINE: EditPipelineModal (regra própria da pipeline)
 * - Padrão do CLIENTE: SuperAdmin/PooledClients (herdado por pipelines sem regra própria)
 */
export const PIPE_ENTRY_SOURCES: { key: string; label: string; desc: string }[] = [
  { key: 'ads', label: 'Anúncio (Meta)', desc: 'Lead de campanha: Click-to-WhatsApp ou formulário de anúncio.' },
  { key: 'organic', label: 'WhatsApp orgânico', desc: 'Quem manda a 1ª mensagem no WhatsApp sem ser de anúncio.' },
  { key: 'form', label: 'Captação / site', desc: 'Lead de formulário ou landing page do site.' },
  { key: 'manual', label: 'Manual no CRM', desc: 'Conversa aberta na mão pelo corretor. Adicionar card na mão nunca é bloqueado.' },
];

export const PIPE_ENTRY_SOURCE_KEYS = PIPE_ENTRY_SOURCES.map((s) => s.key);
