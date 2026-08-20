import { Navigate } from 'react-router-dom';

// Esta tela foi UNIFICADA em "Distribuição de Leads" (/settings/roleta-config).
//
// Antes existiam duas telas pro mesmo conceito: esta escolhia o modo
// (inbox.auto_assignment_config) e a outra tinha quem participa, peso, prazo e
// gestor (RoletaConfig) — dois lugares pra entender uma coisa só, e dois motores
// decidindo a mesma distribuição.
//
// Agora a RoletaConfig é a fonte única (modo + quem + prazo + gestor) e esta rota
// só redireciona, pra não quebrar link antigo, favorito ou atalho.
export default function AssignmentSettings() {
  return <Navigate to="/automations/roleta-config" replace />;
}
