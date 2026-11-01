import Campanhas from '@/pages/Customer/Settings/Campanhas/Campanhas';

// Minha imobiliária → Campanhas (endereço /automations/origem, mantido para não quebrar link salvo, e é o
// que o "editar em Campanhas" da IA usa). Era a tela "Origem" e depois "Formulários"; desde 01/11/2026 (Tarefa 77) é
// a lista de Campanhas: formulários do Meta e anúncios de WhatsApp, com o que cada um vende e qual IA atende.
// A conexão da página do Facebook mora em Integrações → Facebook (/settings/facebook).
export default function Origem() {
  return <Campanhas />;
}
