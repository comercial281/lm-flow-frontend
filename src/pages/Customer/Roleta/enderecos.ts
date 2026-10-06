// Endereços da roleta nova (separados dos componentes: arquivo que exporta
// componente E constante quebra o Fast Refresh do Vite).
export const ENDERECO_DA_LISTA = '/automations/roleta-config';
export const ENDERECO_DA_ROLETA = (id: string) => `${ENDERECO_DA_LISTA}/${id}`;
/** O card do lead abre pelo contato (desde 02/10, "Uma tela só pro cliente"). */
export const ENDERECO_DO_LEAD = (contactId: string) => `/contacts/${contactId}`;
