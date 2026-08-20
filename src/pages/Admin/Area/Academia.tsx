import Tutorials from '@/pages/Customer/Tutorials';

/**
 * Academia dentro da Área do Admin.
 *
 * Antes o item do menu apontava pra /tutorials — que é rota do CRM, então
 * clicar jogava o Giovani de volta pro shell do cliente. Aqui a mesma tela roda
 * DENTRO do AdminLayout: ele gerencia as aulas sem sair do admin.
 *
 * É o mesmo componente de propósito: ele já libera os controles de edição por
 * `useIsSuperAdmin()` (abas Docs e Aulas). Duplicar a tela só criaria duas
 * versões pra manter. /tutorials continua existindo — é por onde o CLIENTE
 * assiste, dentro do CRM dele.
 */
export default function AdminAcademia() {
  return <Tutorials />;
}
