import LeadAdsForms from '@/pages/Customer/Settings/LeadAdsForms';

// Minha imobiliária → Formulários (endereço /automations/origem, mantido para
// não quebrar link salvo). Era a tela "Origem", com a aba das páginas do
// Facebook ao lado; desde 01/10/2026 a conexão da página mora em
// Integrações → Facebook (/settings/facebook) e aqui ficam só os formulários.
export default function Origem() {
  return <LeadAdsForms />;
}
