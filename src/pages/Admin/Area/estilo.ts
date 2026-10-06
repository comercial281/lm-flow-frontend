// Padrão visual da Área do Admin (Clientes, Pacotes, Comunicação, Plataforma e o
// que vier). Um lugar só: quadro, título de seção, respiro entre blocos e grades.
// Mudou aqui, muda em todas as telas. Nasceu em Clientes (05/10) e subiu para
// cá na onda 2 (06/10), quando a primeira tela fora de Clientes precisou dele.
export const PAGINA = 'flex flex-col gap-6';
export const SECAO = 'rounded-xl border bg-card p-5';
export const TITULO_SECAO = 'text-base font-semibold';
export const SUBTITULO_SECAO = 'mt-1 text-sm text-muted-foreground';
export const CORPO_SECAO = 'mt-4';
export const GRADE_CAMPOS = 'grid gap-4 sm:grid-cols-3';
export const GRADE_CARTOES = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';
export const AVISO = 'flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground';
export const SELO = 'rounded-full border px-2.5 py-0.5 text-xs';
export const ESQUELETO = 'animate-pulse rounded-xl bg-muted';
