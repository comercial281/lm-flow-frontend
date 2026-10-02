import { telefone, toDate } from '@/lib/formato';
import { SOURCE_META } from '@/features/leadOrigin/origem';
import { isPhoneLikeName } from '@/lib/nomeDoContato';

// Regras e textos do painel do lead em Conversas. Funções puras, com spec: a
// tela só desenha o que sai daqui. Textos literais (chave nova de t() não entra).

export const TEXTOS_DO_PAINEL = {
  semNome: 'Contato sem nome',
  copiarTelefone: 'Copiar telefone',
  telefoneCopiado: 'Telefone copiado.',
  erroAoCopiar: 'Não foi possível copiar o telefone.',
  editarContato: 'Editar contato',
  fechar: 'Fechar',
  veioDe: 'Veio de:',
  verAnuncio: 'Ver anúncio',
  abrir: 'abrir',
  funil: 'Funil',
  etapa: 'Etapa',
  abrirCard: 'Abrir card do lead',
  colocarNoFunil: 'Colocar no funil',
  erroAoMudarEtapa: 'Não foi possível mudar a etapa.',
  etiquetas: 'Etiquetas',
  notas: 'Notas',
  escrevaUmaNota: 'Escreva uma nota...',
  salvarNota: 'Salvar nota',
  semNotas: 'Nenhuma nota ainda.',
  verTodas: 'Ver todas',
  verMenos: 'Ver menos',
  erroAoSalvarNota: 'Não foi possível salvar a nota.',
  respostasDoFormulario: 'Respostas do formulário',
  verMais: 'Ver mais',
} as const;

type Objeto = Record<string, unknown>;

const FONTES_DE_ANUNCIO = new Set(['whatsapp_ctwa', 'meta_lead_ads', 'anuncio']);

const textoDe = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

// Os rótulos da aba Origem do card têm emoji na frente (selo colorido). Na linha
// "Veio de" do painel é texto corrido: o emoji sai, o resto é o mesmo rótulo.
const semEmoji = (rotulo: string): string => rotulo.replace(/^[^\p{L}\p{N}(]+/u, '').trim();

/**
 * "Veio de": a mesma régua da aba Origem do card do lead. Primeiro a origem
 * gravada no item do funil (`lead_origin`); sem ela, o anúncio da conversa
 * (`ad_referral`). Origem não identificada ou nada: `null` (a linha não aparece).
 */
export function origemDoLead(entrada: {
  leadOrigin?: { source?: string; manual_origin?: string; [k: string]: unknown } | null;
  adReferral?: Objeto | null;
}): { rotulo: string; link: string | null } | null {
  const origem = (entrada.leadOrigin ?? null) as Objeto | null;
  const anuncio = entrada.adReferral && Object.keys(entrada.adReferral).length > 0 ? entrada.adReferral : null;
  const source = textoDe(origem?.source);
  // "Ver anúncio" só aponta pra anúncio: o link do anúncio da conversa, ou o da
  // origem gravada quando ela É um anúncio. Landing, site e portal não têm link aqui.
  const link =
    textoDe(anuncio?.source_url) || (FONTES_DE_ANUNCIO.has(source) ? textoDe(origem?.source_url) : '') || null;

  if (source === 'unknown') return null;

  const meta = source ? SOURCE_META[source] : undefined;
  if (meta) {
    let rotulo = semEmoji(meta.label);
    // Portal e site: o nome de qual portal/site trouxe o lead vem no próprio registro.
    const nome = source === 'portal' ? textoDe(origem?.portal) : source === 'site' ? textoDe(origem?.site) : '';
    if (nome) rotulo = `${rotulo} · ${nome}`;
    return { rotulo, link };
  }

  // Sem origem gravada (ou o espelho antigo do anúncio, gravado como "anuncio"):
  // o anúncio de onde a conversa veio.
  const doAnuncio = anuncio ?? (source === 'anuncio' ? origem : null);
  if (doAnuncio) {
    const app = textoDe(doAnuncio.source_app).toLowerCase();
    return { rotulo: app === 'instagram' ? 'Anúncio no Instagram' : 'Anúncio no Facebook', link };
  }

  return null;
}

export const OUTRO_NUMERO = 'outro número';

/**
 * "Também conversou pelo número X": a conversa mais recente do lead além da
 * aberta, e quantas outras existem além dela. A lista já vem recortada pela
 * permissão do servidor (`GET /contacts/:id/conversations`): conversa que a
 * pessoa não pode abrir nem chega aqui.
 */
export function outraConversa(
  conversas: Array<{
    id: number | string;
    inbox?: { id?: number | string; name?: string } | null;
    last_activity_at?: string | number;
  }>,
  atualId: number | string,
  // Lista de números da tela (useNumerosDaConversa): o nome que o gestor deu ao
  // número é o `display_name`; o `inbox.name` da conversa é o identificador interno.
  numeros?: Array<{ id: number | string; display_name?: string | null }> | null,
): { id: string; numero: string; mais: number } | null {
  const outras = conversas.filter(c => String(c.id) !== String(atualId));
  if (outras.length === 0) return null;

  const quando = (c: (typeof outras)[number]) => toDate(c.last_activity_at)?.getTime() ?? 0;
  const maisRecente = outras.reduce((a, b) => (quando(b) > quando(a) ? b : a));
  const inboxId = maisRecente.inbox?.id;
  const apelido =
    inboxId != null ? numeros?.find(n => String(n.id) === String(inboxId))?.display_name : undefined;

  return {
    id: String(maisRecente.id),
    numero: textoDe(apelido) || textoDe(maisRecente.inbox?.name) || OUTRO_NUMERO,
    mais: outras.length - 1,
  };
}

/** O texto da linha, antes do "abrir". Sem nome do número, não fica "pelo número outro número". */
export function textoOutraConversa(numero: string): string {
  return numero === OUTRO_NUMERO ? 'Também conversou por outro número' : `Também conversou pelo número ${numero}`;
}

// Mesmo filtro de vazios que "Informações do Contato" usava: valor vazio, nulo
// escrito por extenso, objeto (ad_referral, lead_origin) e o "not informed" do
// formulário não são resposta.
const ehResposta = (valor: unknown): boolean => {
  if (!valor) return false;
  const texto = String(valor);
  return (
    texto.trim() !== '' &&
    texto !== 'null' &&
    texto !== 'undefined' &&
    texto !== '[object Object]' &&
    texto.toLowerCase() !== 'not informed'
  );
};

const rotuloDaChave = (chave: string): string =>
  chave
    .split('_')
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ');

/**
 * "Respostas do formulário": os atributos personalizados e as informações
 * extras do contato que têm valor de verdade. Lista vazia = a seção não aparece.
 */
export function respostasDoFormulario(
  personalizados: Record<string, unknown> | null | undefined,
  adicionais: Record<string, unknown> | null | undefined,
): Array<{ id: string; rotulo: string; valor: string }> {
  const linhas = (origem: string, attrs: Record<string, unknown> | null | undefined) =>
    Object.entries(attrs ?? {})
      .filter(([, valor]) => ehResposta(valor))
      .map(([chave, valor]) => ({ id: `${origem}.${chave}`, rotulo: rotuloDaChave(chave), valor: String(valor) }));
  return [...linhas('custom', personalizados), ...linhas('additional', adicionais)];
}

/**
 * Nome do lead na tela. Quando o "nome" é na verdade o telefone (o Evolution não
 * manda pushName no 1º evento), a oferta aberta mascara ele também: senão o
 * número inteiro escapava pelo nome. Fora da oferta, o nome vai como veio.
 */
export function nomeNaTela(nome: string | null | undefined, emOferta: boolean): string | null | undefined {
  if (!emOferta || !nome || !isPhoneLikeName(nome)) return nome;
  return mascararTelefone(nome.replace(/@.*$/, ''));
}

/**
 * Telefone do lead enquanto a oferta da roleta está aberta para quem vê:
 * "(11) •••••-••34", como na página de aceite. Mantém o DDD e os 2 últimos
 * dígitos. É máscara de TELA: o servidor ainda manda o número inteiro.
 */
export function mascararTelefone(telefoneCru: string | null | undefined): string | null {
  const formatado = telefone(telefoneCru);
  if (!formatado) return null;

  const comDdd = /^(\(\d{2}\) )(.*)$/.exec(formatado);
  const prefixo = comDdd ? comDdd[1] : '';
  const resto = comDdd ? comDdd[2] : formatado;

  const totalDigitos = resto.replace(/\D/g, '').length;
  let vistos = 0;
  const mascarado = resto.replace(/\d/g, digito => {
    vistos += 1;
    return vistos > totalDigitos - 2 ? digito : '•';
  });
  return `${prefixo}${mascarado}`;
}

/**
 * Painel do lead ao trocar de conversa. Em tela larga (≥1280px) abre sempre,
 * mesmo que o X o tenha fechado na conversa anterior. Abaixo disso, fica como
 * estava, como era antes: aberto continua aberto, fechado continua fechado.
 */
export function painelAoTrocarDeConversa(telaLarga: boolean, abertoAgora: boolean): boolean {
  return telaLarga ? true : abertoAgora;
}

/**
 * A conversa está em oferta da roleta para quem vê? Sem dono e com oferta minha
 * em aberto. Enquanto a lista de ofertas não chegou (logo depois de abrir o app),
 * lead sem dono conta como em oferta: melhor mascarar um instante a mais do que
 * mostrar o telefone inteiro antes da resposta.
 */
export function emOfertaParaQuemVe(e: { semDono: boolean; ofertasCarregadas: boolean; temOferta: boolean }): boolean {
  return e.semDono && (!e.ofertasCarregadas || e.temOferta);
}
