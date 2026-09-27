// Texto da spec da Fase 1 (Cargos). Literal de propósito: é a mesma frase na
// rota sem permissão e na lista recusada pelo servidor.
export const NO_ACCESS_MESSAGE = 'Seu cargo não tem acesso a esta tela. Quem libera é o administrador da conta.';

// A leitura das permissões FALHOU (rede, 5xx) — não é recusa do cargo. Culpar o
// cargo aqui mandaria a pessoa pedir ao administrador uma permissão que ela já
// tem; o certo é tentar de novo.
export const PERMISSIONS_LOAD_FAILED_MESSAGE = 'Não consegui carregar as permissões.';
export const PERMISSIONS_RETRY_LABEL = 'Tentar de novo';
