#!/usr/bin/env node
// Conta, na tela do cliente, o que a Fase 3 (base de design e linguagem) proíbe:
// termo técnico, palavra fora do glossário, formatação fora do módulo único,
// chave de ligar/desligar feita à mão e botão só-ícone sem nome.
//
// POR QUE ISTO EXISTE
// A causa nº 7 do Raio-X (25/09) é "zero padrão": cada tela resolveu a mesma
// coisa do seu jeito. Consertar uma vez não adianta se a próxima tela nascer
// torta. Esta catraca conta, e o build reprova quando a conta SOBE. Mesma ideia
// do conferir-caixinhas: teto que só desce.
//
// COMO ELE LÊ AS TELAS
// Pelo compilador do TypeScript, não por grep: texto de tela é o que está entre
// tags, em atributo de texto (title, placeholder, label, hint, text…), em toast,
// em confirmação, nas palavras de plural() e na mensagem de reserva de
// apiErrorMessage(), e nos mapas de rótulo (TRIGGER_LABELS…). Nome de variável, rota,
// tipo e chave de i18n NÃO contam — "pipeline" em código fica; "Pipeline" na
// tela é que conta.
//
// USO
//   node scripts/conferir-padrao.mjs                       conta
//   node scripts/conferir-padrao.mjs --listar tecnico      lista uma categoria (ou "tudo")
//   node scripts/conferir-padrao.mjs --tetos arquivo.json  sai 1 se alguma passar do teto

import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative, sep, basename, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = process.env.CONFERIR_PADRAO_RAIZ || join(dirname(fileURLToPath(import.meta.url)), '..');

// ── O que é "tela do cliente" ──────────────────────────────────────────────
// Fica fora: o painel raiz (equipe da Leal Mídia), as páginas públicas e as
// landings (outro público, outro pacote) e o widget de site.
export const FORA_DO_ESCOPO = [
  'src/pages/SuperAdmin/',
  'src/pages/Admin/',
  'src/pages/Public/',
  'src/pages/Widget/',
  'src/features/landing/',
  'src/i18n/',
  'src/test/',
];
// Herança do Evolution que o cliente imobiliário não usa (Raio-X, causa 9:
// "sobra"). A fase 4 decide se some; revisar texto de tela que vai ser apagada
// é trabalho jogado fora. Sai da contagem, e da trava, até lá.
export const SOBRA = [
  'src/components/agents/', 'src/components/ai_agents/', 'src/components/AccessTokens/',
  'src/components/ApiKeysModal.tsx', 'src/components/customMcpServers/', 'src/components/mcpServers/',
  'src/components/customTools/', 'src/components/tools/', 'src/components/widget/',
  'src/components/channels/forms/ApiForm.tsx', 'src/components/channels/forms/TelegramForm.tsx',
  'src/components/channels/forms/SmsForm.tsx', 'src/components/channels/EmailForm.tsx',
  'src/components/channels/WebWidgetForm.tsx', 'src/components/channels/FacebookChannelForm.tsx',
  'src/components/channels/InstagramForm.tsx', 'src/pages/OAuth/', 'src/pages/Shared/Documentation/',
  'src/pages/Shared/Marketplace/',
];
export const NAMESPACES_SOBRA = new Set([
  'aiAgents', 'agents', 'accessTokens', 'apiKeys', 'api', 'telegram', 'sms', 'email', 'webWidget',
  'widget', 'messenger', 'instagram', 'customMcpServers', 'customerMcpServers', 'mcpServers',
  'customTools', 'tools', 'marketplace', 'documentation', 'oauth',
]);
export const noEscopo = rel =>
  /\.(ts|tsx)$/.test(rel) &&
  !/\.(spec|test)\.tsx?$/.test(rel) &&
  !rel.includes('SuperAdmin') &&
  !/Callback\.tsx$/.test(rel) &&
  !FORA_DO_ESCOPO.some(p => rel.startsWith(p)) &&
  !SOBRA.some(p => rel.startsWith(p));

// Em tela de CONECTAR outro sistema, "token" e "webhook" ficam: são as palavras
// que o Meta, o Google e o site do cliente usam, e é por elas que o gestor procura
// lá do outro lado. Fora dessas telas, somem.
export const TELAS_DE_CONEXAO = [
  'src/components/integrations/', 'src/hooks/integrations/', 'src/pages/Customer/Settings/Integrations',
  'src/pages/Customer/Automations/PixelCapi/', 'src/components/channels/', 'src/hooks/channels/',
  'src/pages/Customer/Channels/', 'src/i18n/locales/pt-BR/integrations.json',
  'src/i18n/locales/pt-BR/channels.json', 'src/i18n/locales/pt-BR/whatsapp.json',
];
const PERMITIDO_EM_CONEXAO = new Set(['token', 'webhook', 'Evolution', 'Cloud API']);

// ── As réguas ──────────────────────────────────────────────────────────────
const palavra = fonte => new RegExp(`(?<![\\p{L}\\d_])(?:${fonte})(?![\\p{L}\\d_])`, 'iu');

export const TERMOS_TECNICOS = [
  ['instância', palavra('inst[âa]ncias?')],
  ['instance', palavra('instances?')],
  ['inbox', palavra('inbox(?:es)?')],
  ['Evolution', palavra('evolution')],
  ['Cloud API', palavra('cloud api')],
  ['token', palavra('tokens?')],
  ['webhook', palavra('webhooks?')],
  ['tenant', palavra('tenants?')],
  ['slug', palavra('slugs?')],
  ['HMAC', palavra('hmac')],
  ['E.164', palavra('e\\.164')],
  ['trigger', palavra('triggers?')],
  ['built-in', palavra('built-in')],
  ['string|null', /string\|null/i],
  ['placeholder', palavra('placeholders?')],
  ['payload', palavra('payloads?')],
  ['act_…', /act_\d{5,}/],
];

export const FORA_DO_GLOSSARIO = [
  ['pipeline → funil', palavra('pipelines?')],
  ['tag → etiqueta', palavra('tags?')],
  ['label → etiqueta', palavra('labels?')],
  ['estágio → etapa', palavra('est[áa]gios?')],
  ['deletar → excluir', palavra('delet(?:ar|e|ado|ada|ados|adas)')],
  ['apagar → excluir', palavra('apag(?:ar|ue|ado|ada|ados|adas)')],
  ['caixa de entrada → número de WhatsApp', palavra('caixas? de entrada')],
  ['"salvar alterações" → Salvar', palavra('salvar altera[çc][õo]es')],
  ['"salvar configurações" → Salvar', palavra('salvar configura[çc](?:[ãa]o|[õo]es)')],
];

const FORMATO = [
  /\.toLocale(?:Date|Time)?String\(/,
  /\bIntl\.(?:NumberFormat|DateTimeFormat)\(/,
  /['"](?:BRL|USD)['"]/,
  /\.toFixed\(\d\)\s*\}?\s*%/, // "0.0%": ponto no lugar da vírgula
  /(?:R|US)\$ ?\$\{[^}]*\.toFixed\(/, // `R$ ${v.toFixed(2)}`
];

// Palavra comum escrita sem acento ("Configuracoes", "botao", "Permissao").
export const SEM_ACENTO = palavra(
  'configuracao|configuracoes|botao|botoes|permissao|permissoes|sequencia|sequencias|anuncio|anuncios|organico|' +
    'versao|versoes|visivel|visiveis|selecao|atribuicao|atribuicoes|demonstracao|voce|voces|tambem|informacao|' +
    'informacoes|descricao|descricoes|opcao|opcoes|acao|acoes|notificacao|notificacoes|funcao|funcoes|numero|numeros|' +
    'pagina|paginas|conteudo|conteudos|midia|midias|codigo|horario|horarios|usuario|usuarios|responsavel|disponivel|' +
    'automacao|automacoes|integracao|integracoes|conexao|conversao|conversoes|mensagens? automaticas?|imoveis|imovel',
);

// Título e botão em frase normal: "Novo cargo", não "Novo Cargo". Conta texto
// curto (2 a 5 palavras) em que TODA palavra de 3+ letras começa maiúscula,
// descontando nomes próprios do produto e de terceiros.
const NOMES_PROPRIOS = new Set([
  'WhatsApp', 'LM', 'Flow', 'IA', 'Vendedora', 'Meta', 'Google', 'Facebook', 'Instagram', 'Pixel', 'CAPI',
  'Leal', 'Mídia', 'Kenlo', 'Zap', 'OLX', 'Viva', 'Real', 'Chaves', 'Na', 'Mão', 'Ads', 'Business', 'API',
  'Caixa', 'Minha', 'Casa', 'Vida', 'Canva', 'Notion', 'YouTube', 'TikTok', 'LinkedIn', 'Gmail', 'Outlook', 'Sheets', 'Calendar', 'Drive',
]);
export function emTitleCase(texto) {
  const palavras = texto.trim().split(/\s+/);
  if (palavras.length < 2 || palavras.length > 5) return false;
  const relevantes = palavras.filter(p => /^\p{L}{3,}$/u.test(p) && !NOMES_PROPRIOS.has(p));
  if (relevantes.length < 2) return false;
  return relevantes.every(p => /^\p{Lu}\p{Ll}/u.test(p));
}

// "imóvel(is)", "contato(s)", "mensagem(ns)": plural de formulário de repartição.
export const PLURAL_DE_PARENTESES = /\p{L}\((?:s|es|is|ns|ões)\)/u;
const MODULOS_DE_FORMATO = ['src/lib/formato.ts', 'src/utils/dateUtils.ts'];

const CHAVE_A_MAO = /role=["']switch["']/;
const CHAVE_DA_CASA = 'src/components/base/Chave.tsx';

// Lista de escolha feita com <select> cru (ou o NativeSelect antigo): no
// computador abre a lista cinza do sistema operacional — a do Windows também.
// A da casa é o Seletor, que decide sozinho entre a lista do produto e a do
// celular. Spec: LM FLOW/specs/2026-10-02-seletor-unico-design.md.
const SELECT_NATIVO = /<select(?=[\s>]|$)|<NativeSelect\b/;
// O SeletorComAbas segue a mesma regra (lista do sistema no celular, com um
// grupo por aba), então também pode ter o <select> dele.
// Caixa de aviso / faixa pintada à mão (peças 11 e 12 do GLOSSARIO, escolha do
// dono em 10/10/2026): fundo colorido claro ou translúcido + borda da mesma
// família, na mesma linha. `hover:bg-…` não conta (é botão), pílula `rounded-full`
// e `<Badge>` também não (é selo). A régua é por linha: classe quebrada em várias linhas
// escapa, e a revisão de PR confere.
const COR_DE_AVISO = '(?:amber|yellow|orange|blue|sky|red|rose|emerald|green|violet|purple|indigo|teal|lime|cyan|fuchsia|pink)';
const FUNDO_DE_AVISO = new RegExp(`(?:^|[\\s'"\`{(]|dark:)bg-${COR_DE_AVISO}-(?:(?:50|100|950)(?:\\/\\d+)?|\\d{3}\\/\\d+)(?![\\w/])`);
const BORDA_DE_AVISO = new RegExp(`(?:^|[\\s'"\`{(]|dark:)border(?:-[lrtbxy])?-${COR_DE_AVISO}-\\d+`);
const AVISOS_DA_CASA = new Set(['src/components/base/Aviso.tsx', 'src/components/base/Faixa.tsx']);
export const avisoAMao = linha =>
  FUNDO_DE_AVISO.test(linha) && BORDA_DE_AVISO.test(linha) && !/rounded-full|<Badge\b/.test(linha);

// Confirmação fora da casa (peça 18 do GLOSSARIO, escolha do dono em
// 10/10/2026): toda pergunta "tem certeza?" é o `useConfirmacao`, que usa o
// `Dialog` da casa e só pinta de vermelho com `destrutivo: true`. O
// `AlertDialog` do pacote base mostra "Excluir" em roxo. A régua conta cada
// `<AlertDialog` aberto e cada import direto de `@evoapi/design-system/alert-dialog`,
// venha de onde vier (pacote ou `components/ui/ds`). Vale para o app INTEIRO,
// como a lista nativa: no dia da migração (11/10/2026) não sobrou nenhuma em
// tela nenhuma, nem no painel raiz nem no painel de landings. Os dois "digite o
// nome pra excluir" (canal e conta) já são `Dialog` da casa e não contam.
const ALERT_DIALOG = /<AlertDialog(?=[\s>]|$)|['"]@evoapi\/design-system\/alert-dialog['"]/;
const CONFIRMACOES_DA_CASA = new Set([
  'src/hooks/useConfirmacao.tsx',
  'src/hooks/usePergunta.tsx',
  'src/components/ui/ds.tsx',
]);
export const contaConfirmacao = rel =>
  rel.startsWith('src/') &&
  /\.(ts|tsx)$/.test(rel) &&
  !/\.(spec|test)\.tsx?$/.test(rel) &&
  !CONFIRMACOES_DA_CASA.has(rel);
// Aba fora da casa (peça 6 do GLOSSARIO, escolha do dono em 10/10/2026): a aba
// é o sublinhado do `Abas`. Conta (1) o `Tabs` do pacote base em JSX (`<Tabs`,
// `<TabsList`, `<TabsTrigger`, `<TabsContent`), que desenha pílula, e (2) a aba
// copiada à mão: `border-b-2` com `-mb-px` na mesma linha. O segmentado cinza de
// filtro (Conversas, Contatos, SeletorComAbas) não usa nenhum dos dois e fica.
// Régua por linha: classe quebrada em várias linhas escapa, e a revisão confere.
const TABS_DO_PACOTE = /<Tabs(?:List|Trigger|Content)?(?=[\s>/]|$)/;
const ABA_COPIADA = /(?=.*\bborder-b-2\b)(?=.*(?:^|[\s'"`])-mb-px\b)/;
const ABAS_DA_CASA = 'src/components/base/Abas.tsx';
export const abaForaDaCasa = linha => TABS_DO_PACOTE.test(linha) || ABA_COPIADA.test(linha);

// Alternador de visão à mão (peça 19 do GLOSSARIO, escolha do dono em
// 10/10/2026): o da casa é o `AlternadorDeVisao` (só ícones, colados num
// contorno). A marca confiável é o ícone de visão desenhado em JSX
// (`<Grid3X3`, `<LayoutGrid`, `<Kanban`…): no alternador da casa ele vai como
// dado (`icone: Grid3X3`), nunca como tag. Ícone em dado fora do alternador
// escapa; a revisão confere.
const ICONE_DE_VISAO = /<(?:Grid3X3|Grid3x3|LayoutGrid|LayoutList|Kanban|SquareKanban|Columns3)(?=[\s>/]|$)/;
const ALTERNADOR_DA_CASA = 'src/components/base/AlternadorDeVisao.tsx';
export const alternadorAMao = linha => ICONE_DE_VISAO.test(linha);
// Ação que só aparece com o mouse (peça 16 do GLOSSARIO, escolha do dono em
// 10/10/2026): no celular não existe "passar o mouse", então o botão some. Conta
// linha com `opacity-0` + `group-hover:opacity-100`, `invisible` +
// `group-hover:visible` ou `hidden` + `group-hover:flex|block|…` (com ou sem
// prefixo de tela, `md:opacity-0`, e com grupo nomeado, `group-hover/x:`). A ação
// fica visível e apagada (`opacity-70`) e acende no mouse. Realce decorativo que
// não é ação (brilho do cartão) vai pras exceções. A régua é por linha: classe
// montada em várias linhas escapa, e a revisão de PR confere.
const ANTES = `(?:^|[\\s'"\`{(])(?:[\\w-]+:)*`;
const SO_NO_MOUSE = [
  [new RegExp(`${ANTES}opacity-0(?![\\w/.-])`), /group-hover(?:\/[\w-]+)?:opacity-(?:100|[5-9]\d)\b/],
  [new RegExp(`${ANTES}invisible(?![\\w-])`), /group-hover(?:\/[\w-]+)?:visible\b/],
  [new RegExp(`${ANTES}hidden(?![\\w-])`), /group-hover(?:\/[\w-]+)?:(?:flex|block|inline-flex|inline-block|grid|inline)\b/],
];
export const soNoMouse = linha => SO_NO_MOUSE.some(([escondido, aparece]) => escondido.test(linha) && aparece.test(linha));

// Menu de ações com ⋯ deitado (peça 15 do GLOSSARIO, escolha do dono em
// 10/10/2026): o gatilho é o ⋮ em pé (`EllipsisVertical`, pela peça
// `BotaoMaisAcoes`). Conta o ícone deitado na tela, não o import.
export const menuDeitado = linha =>
  /<(?:MoreHorizontal|Ellipsis)(?:Icon)?(?=[\s/>]|$)|\b[iI]con[a-z]*=\{(?:MoreHorizontal|Ellipsis)(?:Icon)?\}/.test(linha);
// Cartão feito à mão (peça 20 do GLOSSARIO, escolha do dono em 10/10/2026): o
// cartão da casa é o `Card` do pacote base (data-slot="card", que ganha o anel
// violeta e a sombra da marca no globals.css). A régua é por linha: cantos
// `rounded-lg`/`rounded-xl` + `border` solta + fundo de cartão (`bg-card`, ou o
// `bg-sidebar` com `border-sidebar-border` que imitava os cartões de Canais).
// Caixa tracejada (`border-dashed`) não conta: é a lista vazia compacta ou o
// convite de criar (peça 7). Bloco dentro de cartão é `bg-muted/30` e não entra.
// O que a régua pega e não é cartão (menu, painel flutuante, carregando, vazio,
// linha arrastável…) vai pras exceções com o motivo.
const FUNDO_DE_CARTAO = /(?:^|[\s'"`{(])bg-card(?![\w-])/;
const FUNDO_DE_MENU = /(?:^|[\s'"`{(])bg-sidebar(?![\w-])/;
// Secoes/Secao é a moldura da tela de configuração (peça própria, não cartão).
const CARTOES_DA_CASA = new Set(['src/components/base/Secao.tsx']);
export const cartaoAMao = linha =>
  /(?:^|[\s'"`{(])rounded-(?:lg|xl)(?![\w-])/.test(linha) &&
  /(?:^|[\s'"`{(])border(?=[\s'"`]|$)/.test(linha) &&
  (FUNDO_DE_CARTAO.test(linha) || (FUNDO_DE_MENU.test(linha) && /border-sidebar-border/.test(linha))) &&
  !/border-dashed/.test(linha);

// Cor fixa em gráfico (peça 21 do GLOSSARIO, escolha do dono em 10/10/2026): as
// séries saem de `--chart-1` a `--chart-5` (ou de components/base/grafico.ts),
// que acompanham o tema escuro. Conta `fill`, `stroke` e `stopColor` com hex
// direto no atributo ("#…" ou {'#…'}). Cor guardada numa constante antes
// (`const COR = '#…'` e depois `fill={COR}`) escapa: a revisão de PR confere.
// Logo da marca vai pras exceções.
export const corFixaEmGrafico = linha => /\b(?:fill|stroke|stopColor)=(?:["']#|\{\s*["'`]#)/.test(linha);
// Janela (peça 17 do GLOSSARIO, escolha do dono em 10/10/2026). O ajuste da
// casa (`src/components/ui/ds.tsx`) é quem dá topo e rodapé fixos, rolagem por
// dentro e o jeito do celular (sobe de baixo); janela que escapa dele não ganha
// nada disso. Três réguas:
// - larguraDeJanela: só quatro larguras. `DialogContent`/`AlertDialogContent` com
//   `max-w-*` diferente de `max-w-md` (448) e `max-w-2xl` (672), com ou sem `sm:`.
//   A padrão (512) é sem largura e a larga (1400) é `size="wide"`. Variante de
//   celular (`max-sm:max-w-*`) não conta: é ajuste fino de tela pequena.
// - janelaDireta: `Dialog*` importado do pacote base (`@evoapi/design-system` ou
//   `/dialog`) fora do ajuste da casa. Vale pro app inteiro. (O `/alert-dialog`
//   é da peça Confirmação.)
// - janelaAMao: `fixed inset-0` na tela do cliente (janela montada à mão com uma
//   div). O que não é janela (visualizador de foto, camada de soltar arquivo,
//   fundo de menu de contexto, painel do construtor que vira tela cheia no
//   celular, simulador do Testar) fica em conferir-padrao.excecoes.json.
const AJUSTE_DA_CASA = 'src/components/ui/ds.tsx';
const LARGURAS_DA_CASA = new Set(['md', '2xl']);
const TAGS_DE_JANELA = new Set(['DialogContent', 'AlertDialogContent']);
export function largurasForaDaEscala(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  const visitar = no => {
    if ((ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) && TAGS_DE_JANELA.has(no.tagName.getText(fonte))) {
      const classe = no.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(fonte) === 'className');
      const texto = classe?.initializer ? classe.initializer.getText(fonte) : '';
      for (const m of texto.matchAll(/(?:^|[\s'"`{])((?:[\w\[\]-]+:)*)!?max-w-([^\s'"`}]+)/g)) {
        if (/(^|:)max-[\w-]*:$/.test(m[1]) || m[1].startsWith('max-')) continue;
        if (LARGURAS_DA_CASA.has(m[2].replace(/!$/, ''))) continue;
        const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
        achados.push({ linha: line + 1, texto: `<${no.tagName.getText(fonte)} className=${texto.replace(/\s+/g, ' ')}`, largura: `${m[1]}max-w-${m[2]}` });
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}
export function importaJanelaDoPacote(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  for (const no of fonte.statements) {
    if (!ts.isImportDeclaration(no) || !ts.isStringLiteral(no.moduleSpecifier)) continue;
    const mod = no.moduleSpecifier.text;
    if (mod !== '@evoapi/design-system' && mod !== '@evoapi/design-system/dialog') continue;
    const nomes = no.importClause?.namedBindings;
    const direto = mod.endsWith('/dialog') || (nomes && ts.isNamedImports(nomes) && nomes.elements.some(e => /^Dialog/.test((e.propertyName ?? e.name).text)));
    if (direto) {
      const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
      achados.push({ linha: line + 1, texto: no.getText(fonte).replace(/\s+/g, ' ') });
    }
  }
  return achados;
}
export const JANELA_A_MAO = /(?:^|[\s'"`])fixed inset-0(?=[\s'"`]|$)/;

// Rodapé à mão (peça 17 do GLOSSARIO, escolha do dono em 10/10/2026): os botões
// finais de toda janela moram no `DialogFooter` da casa (fica parado embaixo
// enquanto o meio rola; no celular empilha com a ação principal em cima).
// Janela com botão e sem `DialogFooter` tem o rodapé feito à mão (um `div flex
// justify-end` dentro do miolo), que rola junto com o conteúdo. A régua é por
// ARQUIVO: um achado quando há mais `<DialogContent` do que `<DialogFooter` e o
// arquivo tem `<Button`. Janela sem botão final (paleta de comando, conteúdo só
// de leitura, rodapé num componente filho que já usa o DialogFooter) vai pras
// exceções com o motivo (trecho = `<DialogContent`).
// Topo de janela não centraliza: a casa alinha título e frase à esquerda (text-left!
// no TOPO do ds.tsx). Pega text-center na mesma linha da tag do topo.
export const TOPO_CENTRALIZADO = /<(?:DialogHeader|DialogTitle|DialogDescription|AlertDialogHeader)\b[^>]*\btext-center\b/;
export function topoCentralizado(linha) { return TOPO_CENTRALIZADO.test(linha); }

// PONTO CEGO: a régua lê um arquivo por vez. Janela cujo rodapé mora num
// componente FILHO (o formulário que a janela renderiza, ex.: o botão Salvar
// dentro do `XxxForm`) não aparece: a janela não tem `<Button` e o filho não tem
// `<DialogContent`. O rodapé do filho tem que ser `DialogFooter` na mão, e a
// revisão de PR confere. Também não vê 'Cancelar/Salvar' escritos fora de
// `<Button` (botão de outro componente).
export function rodapeAMao(codigo) {
  const conta = re => (codigo.match(re) || []).length;
  const janelas = conta(/<DialogContent(?=[\s>/]|$)/g);
  const rodapes = conta(/<DialogFooter(?=[\s>/]|$)/g);
  if (janelas <= rodapes || !/<Button(?=[\s>/]|$)/.test(codigo)) return null;
  const i = codigo.search(/<DialogContent(?=[\s>/]|$)/);
  return { linha: codigo.slice(0, i).split('\n').length, janelas, rodapes };
}

const SELETORES_DA_CASA = new Set(['src/components/base/Seletor.tsx', 'src/components/base/SeletorComAbas.tsx']);
// Ficam com a lista do sistema DE PROPÓSITO (decisão 3 da spec do Seletor): o
// widget de chat roda num iframe no site do cliente, que mede a própria altura,
// e o portal público é outro público, com outro visual. Não entra mais ninguém
// aqui sem o dono pedir.
export const SELECT_NATIVO_PERMITIDO = new Set([
  'src/components/widget/PreChatForm.tsx',
  'src/pages/Public/portalShared.tsx',
]);
// Diferente das outras categorias, a lista nativa vale para o app INTEIRO:
// painel raiz, landing, primeiro acesso e a sobra do Evolution também. Desde o
// PR 3 do Seletor (02/10/2026) não sobrou nenhuma fora das exceções acima.
export const contaSelectNativo = rel =>
  rel.startsWith('src/') &&
  rel.endsWith('.tsx') &&
  !/\.(spec|test)\.tsx$/.test(rel) &&
  !SELETORES_DA_CASA.has(rel) &&
  !SELECT_NATIVO_PERMITIDO.has(rel);
const COMECO_DE_COMENTARIO = /^(\{?\/\*|\*)/;

// Atributos e propriedades cujo valor é texto que aparece na tela.
const ATRIBUTOS_DE_TEXTO = new Set([
  'title', 'placeholder', 'label', 'aria-label', 'alt', 'description', 'subtitle',
  'tooltip', 'emptyMessage', 'titulo', 'descricao', 'rotuloDaAcao', 'rotuloDeCancelar', 'hint', 'text',
]);
const PROPRIEDADES_DE_TEXTO = new Set([
  'label', 'title', 'titulo', 'descricao', 'description', 'subtitle', 'placeholder',
  'tooltip', 'rotuloDaAcao', 'rotuloDeCancelar', 'emptyMessage', 'helpText', 'hint',
]);
const MAPA_DE_ROTULOS = /(LABELS?|TEXTS?|TEXTOS?|ROTULOS?|COPY)$/;
// Funções que devolvem pra tela o texto que recebem: em plural(n, 'etapa',
// 'etapas') as palavras (2º e 3º argumentos) aparecem; em apiErrorMessage(erro,
// 'Não foi possível…') a mensagem de reserva (2º) aparece quando o servidor não
// manda uma. Os outros argumentos são dado, não texto.
const ARGUMENTOS_DE_TEXTO = { plural: [1, 2], apiErrorMessage: [1] };

// ── Leitura dos textos de uma tela ─────────────────────────────────────────
// .tsx é JSX; .ts é TypeScript puro (genérico como Envelope<T> e asserção
// <T>x não são tag JSX ali). Qualquer outra extensão mantém TSX, como antes.
const scriptKindDe = arquivo =>
  arquivo.endsWith('.tsx') ? ts.ScriptKind.TSX : arquivo.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX;

const nomeDe = n => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : '');

// Sobe da string até achar quem decide se ela é texto de tela.
function destinoDoTexto(no) {
  let atual = no.parent;
  let filho = no;
  while (atual) {
    if (ts.isConditionalExpression(atual)) {
      // Operando da condição (type === 'label' ? ...) não é texto de tela,
      // é discriminante de tipo. Os ramos (true/false) são.
      if (atual.condition === filho) return false;
      filho = atual;
      atual = atual.parent;
      continue;
    }
    if (ts.isBinaryExpression(atual)) {
      // Só passa texto se o operador o repassar: || ?? + ou && (apenas se filho for right).
      // Comparação (===, !==, ==, !=, <, >, in, instanceof) ou lado esquerdo de && é código.
      const op = atual.operatorToken.kind;
      const ehOuOu = op === ts.SyntaxKind.BarBarToken;
      const ehCoalescing = op === ts.SyntaxKind.QuestionQuestionToken;
      const ehConcat = op === ts.SyntaxKind.PlusToken;
      const ehE = op === ts.SyntaxKind.AmpersandAmpersandToken && atual.right === filho;
      if (!ehOuOu && !ehCoalescing && !ehConcat && !ehE) return false;
      filho = atual;
      atual = atual.parent;
      continue;
    }
    if (
      ts.isParenthesizedExpression(atual) ||
      ts.isTemplateSpan(atual) ||
      ts.isTemplateExpression(atual) ||
      ts.isAsExpression(atual)
    ) {
      filho = atual;
      atual = atual.parent;
      continue;
    }
    if (ts.isJsxExpression(atual)) {
      const pai = atual.parent;
      if (ts.isJsxElement(pai) || ts.isJsxFragment(pai)) return true;
      if (ts.isJsxAttribute(pai)) return ATRIBUTOS_DE_TEXTO.has(nomeDe(pai.name));
      return false;
    }
    if (ts.isJsxAttribute(atual)) return ATRIBUTOS_DE_TEXTO.has(nomeDe(atual.name));
    if (ts.isPropertyAssignment(atual) && atual.initializer === filho) {
      if (PROPRIEDADES_DE_TEXTO.has(nomeDe(atual.name))) return true;
      // valor de mapa de rótulos: const TRIGGER_LABELS = { manual: 'Manual' }
      const obj = atual.parent;
      const decl = obj?.parent;
      return !!(decl && ts.isVariableDeclaration(decl) && MAPA_DE_ROTULOS.test(nomeDe(decl.name)));
    }
    if (ts.isCallExpression(atual)) {
      const alvo = atual.expression;
      // toast('x'), toast.success('x'), toast.error('x')…
      if (ts.isIdentifier(alvo) && alvo.text === 'toast') return true;
      if (ts.isPropertyAccessExpression(alvo) && ts.isIdentifier(alvo.expression) && alvo.expression.text === 'toast') return true;
      // plural(n, 'etapa', 'etapas'), formato.plural(…), apiErrorMessage(e, '…')
      const funcao = ts.isIdentifier(alvo) ? alvo.text : ts.isPropertyAccessExpression(alvo) ? alvo.name.text : '';
      const posicoes = Object.hasOwn(ARGUMENTOS_DE_TEXTO, funcao) ? ARGUMENTOS_DE_TEXTO[funcao] : null;
      return !!posicoes && posicoes.includes(atual.arguments.indexOf(filho));
    }
    return false;
  }
  return false;
}

export function textosDaTela(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const textos = [];
  const guardar = (no, texto) => {
    const limpo = texto.replace(/\s+/g, ' ').trim();
    if (!/\p{L}/u.test(limpo)) return;
    const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
    textos.push({ linha: line + 1, texto: limpo });
  };
  const visitar = no => {
    if (ts.isJsxText(no)) guardar(no, no.text);
    else if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      if (destinoDoTexto(no)) guardar(no, no.text);
    } else if (ts.isTemplateExpression(no)) {
      if (destinoDoTexto(no)) guardar(no, [no.head.text, ...no.templateSpans.map(s => s.literal.text)].join(' '));
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return textos;
}

// ── Botão só-ícone sem nome ────────────────────────────────────────────────
const TAGS_DE_BOTAO = new Set(['Button', 'button']);
const ATRIBUTOS_DE_NOME = new Set(['aria-label', 'aria-labelledby', 'title', 'label']);

// Um botão "tem texto" se QUALQUER coisa dentro dele, em qualquer nível, vira
// palavra na tela: texto solto, uma expressão ({nome}, {t('x')}) ou uma imagem
// com alt. Ícone é elemento sem nada disso.
function temTexto(no) {
  if (!no) return false;
  if (ts.isJsxText(no)) return /\p{L}/u.test(no.text);
  if (ts.isJsxExpression(no)) return expressaoTemTexto(no.expression);
  if (ts.isJsxSelfClosingElement(no)) return ehImagemComAlt(no);
  if (ts.isJsxElement(no)) return ehImagemComAlt(no.openingElement) || no.children.some(temTexto);
  if (ts.isJsxFragment(no)) return no.children.some(temTexto);
  return false;
}
function expressaoTemTexto(expr) {
  if (!expr) return false;
  if (ts.isParenthesizedExpression(expr)) return expressaoTemTexto(expr.expression);
  if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) return temTexto(expr);
  if (ts.isConditionalExpression(expr)) return expressaoTemTexto(expr.whenTrue) || expressaoTemTexto(expr.whenFalse);
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return expressaoTemTexto(expr.right);
  if (expr.kind === ts.SyntaxKind.NullKeyword) return false;
  return true; // {nome}, {t('x')}, {'Salvar'}: vira texto
}
function ehImagemComAlt(abertura) {
  return (
    abertura.tagName.getText() === 'img' &&
    abertura.attributes.properties.some(a => ts.isJsxAttribute(a) && nomeDe(a.name) === 'alt')
  );
}

// ── Moldura e cabeçalho (padrão de telas, 07/10/2026) ─────────────────────
// Toda tela usa a moldura única (Pagina) e o cabeçalho da casa (BaseHeader,
// que é quem desenha o <h1> e a barrinha roxa). Título feito à mão, barrinha
// copiada e cabeçalho fora da moldura fazem a tela "pular" de lugar entre uma
// página e outra. Teto zero; ferramenta de tela cheia vai pras exceções.
export const CABECALHO_DA_CASA = 'src/components/base/BaseHeader.tsx';
export const MOLDURA_DA_CASA = 'src/components/base/Pagina.tsx';
const BARRA_A_MAO = /#7c3aed,\s*#9333ea/;

export function tagsJsx(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  const visitar = no => {
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
      achados.push({ tag: no.tagName.getText(fonte), linha: line + 1 });
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

// A tela usa a moldura da casa só se IMPORTA a Pagina de lá (um `const Pagina = X`
// local não vale). Aceita '@/components/base' (nomeado), '@/components/base/Pagina'
// (default ou nomeado) e caminho relativo que resolva pra src/components/base/Pagina.
export function importaPaginaDaCasa(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const dir = posix.dirname(arquivo);
  return fonte.statements.some(no => {
    if (!ts.isImportDeclaration(no) || !ts.isStringLiteral(no.moduleSpecifier)) return false;
    const clausula = no.importClause;
    if (!clausula) return false;
    let mod = no.moduleSpecifier.text;
    if (mod.startsWith('.')) mod = posix.normalize(posix.join(dir, mod));
    else if (mod.startsWith('@/')) mod = 'src/' + mod.slice(2);
    const nomeados = clausula.namedBindings && ts.isNamedImports(clausula.namedBindings) ? clausula.namedBindings.elements : [];
    const nomeadoPagina = nomeados.some(e => (e.propertyName ?? e.name).text === 'Pagina' && e.name.text === 'Pagina');
    if (['src/components/base', 'src/components/base/index'].includes(mod)) return nomeadoPagina;
    if (mod === 'src/components/base/Pagina') return nomeadoPagina || clausula.name?.text === 'Pagina';
    return false;
  });
}

// ── Escondido que só aparece com o mouse (10/10/2026, Raio-X do celular) ──
// No Tailwind 4, `hover:` e `group-hover:` só valem em aparelho com mouse
// (@media (hover: hover)). Então `opacity-0 group-hover:opacity-100` deixa o
// botão INVISÍVEL e ainda assim tocável no celular: dava pra apertar Excluir
// sem ver. O conserto é a peça 16 do GLOSSARIO (escolha do dono em 10/10/2026):
// a ação fica SEMPRE à vista, apagada, e acende no mouse ou no foco:
// `opacity-70 group-hover:opacity-100 focus-within:opacity-100`.
// A variante `toque:` (globals.css, @media (hover: none)) NÃO é a saída
// recomendada. Ela só vale em dois casos:
//   - `toque:hidden`: camada sobre foto que some no toque e deixa o toque cair
//     na foto (SharedImageBubble, ProfilePhotoUploader);
//   - `toque:opacity-100` fora da tela do cliente (página pública, sobra do fork).
// Na tela do cliente quem manda é a `soNoMouse` (linha a linha), que reprova
// `opacity-0 group-hover:opacity-100` mesmo com `toque:opacity-100`. As duas
// réguas ficam: esta vale no app inteiro e lê pelo compilador (pega cn(...)
// quebrado em linhas); a `soNoMouse` só na tela do cliente.
//
// Como lê: pelo compilador, junta as classes de um mesmo lugar (um className,
// um cn(...) inteiro, mesmo quebrado em várias linhas, uma variável ou uma
// chave de objeto) e conta quando há uma classe que ESCONDE (opacity-0,
// invisible, hidden) + uma que REVELA no passar do mouse + nenhuma `toque:`.
// Vale para o app inteiro (como a lista nativa): página pública é a mais aberta
// no celular.
// Cada jeito de esconder tem o seu jeito de revelar: opacity-0 ↔ opacity-N,
// invisible ↔ visible, hidden ↔ flex/block/… (`hidden sm:flex hover:opacity-90`
// não é revelar no mouse: o hover ali só clareia um botão que já aparece).
const VARIANTES = String.raw`(?:[\w[\]()/.&-]+:)*`;
const NO_MOUSE = String.raw`${VARIANTES}(?:group-hover|peer-hover|hover)(?:\/[\w-]+)?:${VARIANTES}!?`;
const PARES_DE_ESCONDER = [
  [new RegExp(String.raw`^${VARIANTES}!?opacity-0!?$`), new RegExp(String.raw`^${NO_MOUSE}opacity-[1-9]\d*!?$`)],
  [new RegExp(String.raw`^${VARIANTES}!?invisible!?$`), new RegExp(String.raw`^${NO_MOUSE}visible!?$`)],
  [
    new RegExp(String.raw`^${VARIANTES}!?hidden!?$`),
    new RegExp(String.raw`^${NO_MOUSE}(?:flex|block|inline-flex|inline-block|inline|grid|inline-grid|table|contents)!?$`),
  ],
];
// Peça que não recebe toque (brilho de fundo, ícone de enfeite) pode ficar
// escondida no celular: não há o que apertar sem ver.
const NAO_RECEBE_TOQUE = /^pointer-events-none$/;
const TEM_TOQUE = /(?:^|:)toque:/;
export const contaSoMouse = rel => rel.startsWith('src/') && /\.(ts|tsx)$/.test(rel) && !/\.(spec|test)\.tsx?$/.test(rel);

const ehTextoDeClasse = no =>
  ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no) || ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no);

// O "lugar" de uma classe: sobe até o atributo, a variável, a chave de objeto
// (fora de um cn({...})), o return ou a instrução. Tudo que está dentro dele
// conta junto: cn('opacity-0', cond && 'group-hover:opacity-100') é um lugar só.
function lugarDaClasse(no) {
  let atual = no.parent;
  while (atual && !ts.isSourceFile(atual)) {
    if (ts.isJsxAttribute(atual) || ts.isVariableDeclaration(atual) || ts.isReturnStatement(atual) || ts.isExpressionStatement(atual)) return atual;
    if (ts.isPropertyAssignment(atual) && !(atual.parent?.parent && ts.isCallExpression(atual.parent.parent))) return atual;
    atual = atual.parent;
  }
  return atual;
}

export function escondidosSoComMouse(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const lugares = new Map();
  const visitar = no => {
    if (ehTextoDeClasse(no)) {
      const lugar = lugarDaClasse(no);
      if (!lugares.has(lugar)) lugares.set(lugar, []);
      lugares.get(lugar).push(...no.text.split(/\s+/).filter(Boolean));
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  const achados = [];
  for (const [lugar, classes] of lugares) {
    if (classes.some(c => TEM_TOQUE.test(c) || NAO_RECEBE_TOQUE.test(c))) continue;
    const par = PARES_DE_ESCONDER.find(([esconde, revela]) => classes.some(c => esconde.test(c)) && classes.some(c => revela.test(c)));
    if (!par) continue;
    const revela = classes.find(c => par[1].test(c));
    const { line } = fonte.getLineAndCharacterOfPosition(lugar.getStart(fonte));
    achados.push({ linha: line + 1, texto: revela });
  }
  return achados;
}

export function botoesSemNome(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  const visitar = no => {
    if (ts.isJsxElement(no)) {
      const abre = no.openingElement;
      const tag = abre.tagName.getText(fonte);
      if (TAGS_DE_BOTAO.has(tag)) {
        const attrs = abre.attributes.properties;
        const temNome = attrs.some(a => ts.isJsxAttribute(a) && ATRIBUTOS_DE_NOME.has(nomeDe(a.name)));
        const temSpread = attrs.some(a => ts.isJsxSpreadAttribute(a));
        const temFilho = no.children.some(c => !(ts.isJsxText(c) && !c.text.trim()));
        if (!temNome && !temSpread && temFilho && !no.children.some(temTexto)) {
          const { line } = fonte.getLineAndCharacterOfPosition(abre.getStart(fonte));
          achados.push({ linha: line + 1, texto: `<${tag}> só com ícone` });
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

// ── Botão pintado à mão (peça 14 do GLOSSARIO, escolha do dono 10/10/2026) ──
// Botão de ação é o `Button` de `components/ui/ds` (é ele que leva o degradê do
// principal). A régua: `<button>` com `bg-primary` FIXO na className (não
// `bg-primary/10`, e não dentro de condição: `ativo ? 'bg-primary' : …` é o
// estado de filtro, pílula ou alternador, que não é botão de ação), ou
// `<button>`/`<Button>` com cor fixa `bg-[#…]`. Lê a className pelo compilador,
// então classe quebrada em várias linhas também conta.
const FUNDO_PRINCIPAL = /(?:^|[\s'"`])bg-primary(?![\w/-])/;
const FUNDO_FIXO = /(?:^|[\s'"`])bg-\[#/;
const emCondicao = (no, ate) => {
  for (let filho = no, pai = no.parent; pai && pai !== ate; filho = pai, pai = pai.parent) {
    if (ts.isConditionalExpression(pai) && pai.condition !== filho) return true;
    if (ts.isBinaryExpression(pai) && pai.right === filho &&
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(pai.operatorToken.kind)) return true;
  }
  return false;
};
export function botoesPintados(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  const visitar = no => {
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const tag = no.tagName.getText(fonte);
      const cn = (tag === 'button' || tag === 'Button') &&
        no.attributes.properties.find(a => ts.isJsxAttribute(a) && nomeDe(a.name) === 'className' && a.initializer);
      if (cn) {
        let pintado = false;
        const olhar = n => {
          if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
            const t = ' ' + n.text;
            if (FUNDO_FIXO.test(t) || (tag === 'button' && FUNDO_PRINCIPAL.test(t) && !emCondicao(n, cn))) pintado = true;
          }
          ts.forEachChild(n, olhar);
        };
        olhar(cn.initializer);
        if (pintado) {
          const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
          achados.push({ linha: line + 1, texto: cn.initializer.getText(fonte).replace(/\s+/g, ' ') });
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

// ── Botão com no mínimo 32 px (peça 14 do GLOSSARIO, 12/10/2026) ───────────
// `Button` nunca abaixo de 32 px: texto usa `size="sm"` (h-8); só-ícone usa
// `size="icon"` com `size-8`. Régua: na tag de abertura de `<Button`, uma classe
// `h-4..h-7` ou `size-4..size-7` (com ou sem `.5`), sem prefixo de tela/estado
// (`sm:h-7` não conta). JSX aninhado dentro de um atributo (ícone passado como
// prop) é apagado antes, pra o `h-4 w-4` do ícone não contar pro botão.
export const botaoPequeno = tag => /(?<![\w:/\-.])(?:h|size)-[4-7](?:\.5)?(?![\w.\-/])/.test(tag);
export function botoesPequenos(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  const visitar = no => {
    if ((ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) && no.tagName.getText(fonte) === 'Button') {
      const ini = no.getStart(fonte);
      let texto = no.getText(fonte);
      const buracos = [];
      const aninhado = n => {
        if (n !== no && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n))) {
          buracos.push([n.getStart(fonte) - ini, n.getEnd() - ini]);
          return;
        }
        ts.forEachChild(n, aninhado);
      };
      ts.forEachChild(no.attributes, aninhado);
      for (const [a, b] of buracos.sort((x, y) => y[0] - x[0])) texto = texto.slice(0, a) + ' ' + texto.slice(b);
      if (botaoPequeno(texto)) {
        const { line } = fonte.getLineAndCharacterOfPosition(ini);
        achados.push({ linha: line + 1, texto: no.getText(fonte).replace(/\s+/g, ' ') });
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

// ── Ícone com tamanho em pixel (peça 22 do GLOSSARIO, 10/10/2026) ──────────
// Ícone é `lucide-react` em três tamanhos, por classe: `h-3.5 w-3.5` (aba,
// etiqueta, filtro), `h-4 w-4` (botão, menu), `h-5 w-5` (título). Conta `size=`
// em ícone: componente importado de lucide-react, ou variável de ícone
// (`Icon`, `IconComponent`, `XxxIcon`, `item.icon`) com `size={…}`. Ícone da
// casa que recebe tamanho por nome (`<ChannelIcon size="sm">`) não conta.
const TAG_DE_ICONE = /(?:^|\.)(?:icon|Icon|IconComponent|[A-Z]\w*Icon)$/;
export function iconesComTamanho(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const lucide = new Set();
  for (const st of fonte.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.moduleSpecifier.text === 'lucide-react') {
      const nb = st.importClause?.namedBindings;
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) lucide.add(e.name.text);
    }
  }
  const achados = [];
  const visitar = no => {
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const tag = no.tagName.getText(fonte);
      if (lucide.has(tag) || TAG_DE_ICONE.test(tag)) {
        const sz = no.attributes.properties.find(a => ts.isJsxAttribute(a) && nomeDe(a.name) === 'size');
        // ícone da casa com tamanho por nome (`<ChannelIcon size="sm">`) não conta
        if (sz && (lucide.has(tag) || (sz.initializer && ts.isJsxExpression(sz.initializer)))) {
          const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
          achados.push({ linha: line + 1, texto: `<${tag} size=${sz.initializer ? sz.initializer.getText(fonte) : ''}>` });
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

// ── Carregando e estado vazio (peças 13 e 7 do GLOSSARIO, escolha do dono 10/10/2026) ──
// Três réguas, todas pelo compilador (não por linha):
//  - rodinhaCentral: elemento com `animate-spin` FORA de botão (Button, button,
//    *MenuItem, SelectItem, Badge, link) que é grande (h-6 pra cima, ou size={20+})
//    ou está sozinho dentro de uma caixa `justify-center`. É a rodinha no meio da
//    lista ou da tela, que vira o esqueleto cinza (`Carregando`). A rodinha
//    pequena dentro de botão ou ao lado de um texto fica.
//  - telaEmBranco: `fallback={null}` num <Suspense>: a tela some enquanto carrega.
//    Não conta quando o que carrega é uma janela (…Modal, …Dialog).
//  - vazioSolto: texto entre tags que começa com "Nenhum"/"Nenhuma" (fora de
//    opção de lista e do próprio EmptyState). É a lista vazia escrita à mão,
//    que vira `EmptyState` (grande na tela, compacto dentro de bloco). "Nenhum"
//    sozinho é valor de seletor e não conta; frase de ajuda que começa com
//    "Nenhum" vai pras exceções com motivo.
export const ESTADOS_DA_CASA = new Set([
  'src/components/base/Carregando.tsx',
  'src/components/base/EmptyState.tsx',
  // a tela de partida do app (antes de saber qual tela vem) fica com a rodinha
  'src/components/LoadingScreen.tsx',
]);
const TAG_DE_BOTAO = /^(?:\w*Button|button|a|Link|\w*MenuItem|SelectItem|\w*Badge|CommandItem)$/;
const RODINHA_GRANDE = /\b(?:h|size)-(?:[6-9]|1\d|2\d|3\d)\b|\bsize=\{(?:[2-9]\d)\}/;
const percorrerJsx = (fonte, aoAbrir) => {
  const visitar = (no, pilha) => {
    if (ts.isJsxElement(no) || ts.isJsxSelfClosingElement(no)) {
      const abre = ts.isJsxElement(no) ? no.openingElement : no;
      const tag = abre.tagName.getText(fonte);
      aoAbrir(abre, tag, pilha);
      const nova = [...pilha, { tag, abre }];
      ts.forEachChild(no, c => visitar(c, nova));
      return;
    }
    ts.forEachChild(no, c => visitar(c, pilha));
  };
  visitar(fonte, []);
};
const atributo = (abre, nome, fonte) =>
  abre.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(fonte) === nome);
const linhaDe = (fonte, no) => fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;

export function rodinhasCentrais(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  percorrerJsx(fonte, (abre, tag, pilha) => {
    const classe = atributo(abre, 'className', fonte)?.getText(fonte) ?? '';
    if (!/\banimate-spin\b/.test(classe)) return;
    if (pilha.some(p => TAG_DE_BOTAO.test(p.tag))) return;
    const pai = pilha[pilha.length - 1];
    const classeDoPai = pai ? atributo(pai.abre, 'className', fonte)?.getText(fonte) ?? '' : '';
    if (RODINHA_GRANDE.test(abre.getText(fonte)) || /\bjustify-center\b/.test(classeDoPai)) {
      achados.push({ linha: linhaDe(fonte, abre), texto: `<${tag}> ${classe}` });
    }
  });
  return achados;
}

export function telasEmBranco(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  percorrerJsx(fonte, abre => {
    const fb = atributo(abre, 'fallback', fonte);
    const valor = fb?.initializer && ts.isJsxExpression(fb.initializer) ? fb.initializer.expression : null;
    if (!valor || valor.kind !== ts.SyntaxKind.NullKeyword) return;
    // O texto leva o primeiro filho (`fallback={null} → <AgendarVisitaDialog>`), pra
    // exceção poder perdoar uma janela carregada sob demanda sem perdoar a tela.
    const filho = ts.isJsxElement(abre.parent)
      ? abre.parent.children.find(c => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c))
      : null;
    const tagDoFilho = filho ? (ts.isJsxElement(filho) ? filho.openingElement : filho).tagName.getText(fonte) : '';
    // Janela carregada sob demanda (…Modal, …Dialog) fica: o esqueleto apareceria
    // FORA da janela, no meio da tela de trás, no instante antes de ela abrir.
    if (/(?:Modal|Dialog)$/.test(tagDoFilho)) return;
    achados.push({ linha: linhaDe(fonte, abre), texto: `${fb.getText(fonte)} → <${tagDoFilho}>` });
  });
  return achados;
}

const TAG_DE_OPCAO = /^(?:option|SelectItem|\w*MenuItem|CommandItem|EmptyState|Aviso)$/;
export function vaziosSoltos(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKindDe(arquivo));
  const achados = [];
  // A tag dona do texto: a que o envolve, ou a que o recebe num atributo
  // (`<EmptyState description={<>Nenhum… <Link/></>} />` é do EmptyState).
  const tagDoPai = no => {
    let a = no.parent;
    while (a && !ts.isJsxElement(a) && !ts.isJsxSelfClosingElement(a)) a = a.parent;
    if (!a) return '';
    return (ts.isJsxElement(a) ? a.openingElement : a).tagName.getText(fonte);
  };
  // string que vira filho de tag: {vazio ? 'Nenhum…' : …}, {lista.length === 0 && 'Nenhum…'}
  const filhoDeTag = no => {
    let filho = no;
    let a = no.parent;
    while (a) {
      if (ts.isJsxExpression(a)) return ts.isJsxElement(a.parent) || ts.isJsxFragment(a.parent);
      const passa =
        (ts.isConditionalExpression(a) && a.condition !== filho) ||
        ts.isParenthesizedExpression(a) ||
        (ts.isBinaryExpression(a) && a.right === filho) ||
        ts.isTemplateSpan(a);
      if (!passa) return false;
      filho = a;
      a = a.parent;
    }
    return false;
  };
  const visitar = no => {
    let texto = null;
    if (ts.isJsxText(no)) texto = no.text;
    else if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && filhoDeTag(no)) texto = no.text;
    else if (ts.isTemplateExpression(no) && filhoDeTag(no)) texto = no.head.text;
    if (texto !== null) {
      const limpo = texto.replace(/\s+/g, ' ').trim();
      if (/^Nenhuma?\b/.test(limpo) && !/^Nenhuma?\.?$/.test(limpo) && !TAG_DE_OPCAO.test(tagDoPai(no))) {
        achados.push({ linha: linhaDe(fonte, no), texto: limpo });
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

// ── Textos dos arquivos de tradução ────────────────────────────────────────
export function textosDoJson(obj, caminho = '') {
  const saida = [];
  if (typeof obj === 'string') {
    // {{variavel}} é trocada pelo i18next antes de aparecer: não é texto de tela.
    const limpo = obj.replace(/\{\{[^}]*\}\}/g, ' ');
    if (/\p{L}/u.test(limpo)) saida.push({ linha: caminho, texto: limpo.trim() });
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) saida.push(...textosDoJson(v, caminho ? `${caminho}.${k}` : k));
  }
  return saida;
}

// ── Exceções justificadas ──────────────────────────────────────────────────
function carregarExcecoes() {
  try {
    return JSON.parse(readFileSync(join(RAIZ, 'scripts/conferir-padrao.excecoes.json'), 'utf8'));
  } catch {
    return [];
  }
}

// ── Varredura ──────────────────────────────────────────────────────────────
const andar = (dir, saida = []) => {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules') continue;
    const cheio = join(dir, entrada);
    if (statSync(cheio).isDirectory()) andar(cheio, saida);
    else saida.push(cheio);
  }
  return saida;
};

export function varrer() {
  const excecoes = carregarExcecoes();
  const achados = [];
  const anotar = (categoria, rel, linha, detalhe, texto) => {
    const perdoado = excecoes.some(
      e => e.categoria === categoria && e.arquivo === rel && texto && texto.includes(e.trecho),
    );
    if (!perdoado) achados.push({ categoria, onde: `${rel}:${linha}`, detalhe, texto });
  };
  const conferirTexto = (rel, linha, texto) => {
    const conexao = TELAS_DE_CONEXAO.some(p => rel.startsWith(p));
    for (const [nome, re] of TERMOS_TECNICOS) {
      if (conexao && PERMITIDO_EM_CONEXAO.has(nome)) continue;
      if (re.test(texto)) anotar('tecnico', rel, linha, nome, texto);
    }
    for (const [nome, re] of FORA_DO_GLOSSARIO) if (re.test(texto)) anotar('glossario', rel, linha, nome, texto);
    if (PLURAL_DE_PARENTESES.test(texto)) anotar('plural', rel, linha, 'plural com parênteses', texto);
    // endereço e e-mail de exemplo ("github.com/usuario") não são frase
    if (!/:\/\/|@/.test(texto) && SEM_ACENTO.test(texto)) anotar('acento', rel, linha, 'palavra sem acento', texto);
    if (emTitleCase(texto)) anotar('maiusculas', rel, linha, 'Maiúscula Em Toda Palavra', texto);
  };

  const arquivos = andar(join(RAIZ, 'src'));
  // Passada 1: os XxxHeader que só embrulham o BaseHeader (ContactsHeader…).
  const cabecalhos = new Set(['BaseHeader']);
  const embrulhos = new Set();
  for (const arquivo of arquivos) {
    const rel = relative(RAIZ, arquivo).split(sep).join('/');
    if (!noEscopo(rel) || !/Header\.tsx$/.test(rel) || rel === CABECALHO_DA_CASA) continue;
    if (tagsJsx(readFileSync(arquivo, 'utf8'), rel).some(t => t.tag === 'BaseHeader')) {
      cabecalhos.add(basename(rel, '.tsx'));
      embrulhos.add(rel);
    }
  }

  for (const arquivo of arquivos) {
    const rel = relative(RAIZ, arquivo).split(sep).join('/');
    const escopo = noEscopo(rel);
    const lista = contaSelectNativo(rel);
    const confirmacao = contaConfirmacao(rel);
    const janela = rel.startsWith('src/') && /\.tsx?$/.test(rel) && !/\.(spec|test)\.tsx?$/.test(rel) && rel !== AJUSTE_DA_CASA;
    const soMouse = contaSoMouse(rel);
    if (!escopo && !lista && !confirmacao && !janela && !soMouse) continue;
    const codigo = readFileSync(arquivo, 'utf8');
    if (janela && codigo.includes('@evoapi/design-system')) {
      for (const a of importaJanelaDoPacote(codigo, rel)) anotar('janelaDireta', rel, a.linha, 'janela importada do pacote base', a.texto);
    }
    if (escopo && (rel.endsWith('.tsx') || rel.endsWith('.ts'))) {
      for (const { linha, texto } of textosDaTela(codigo, rel)) conferirTexto(rel, linha, texto);
    }
    if (soMouse) {
      const linhas = codigo.split('\n');
      for (const { linha, texto } of escondidosSoComMouse(codigo, rel)) anotar('soMouse', rel, linha, texto, linhas[linha - 1].trim());
    }
    if (escopo && rel.endsWith('.tsx')) {
      for (const { linha, texto } of botoesSemNome(codigo, rel)) anotar('iconeSemNome', rel, linha, texto, texto);
      for (const { linha, texto } of botoesPintados(codigo, rel)) anotar('botaoPintado', rel, linha, 'botão pintado à mão', texto);
      for (const { linha, texto } of botoesPequenos(codigo, rel)) anotar('botaoPequeno', rel, linha, 'botão abaixo de 32 px', texto);
      for (const { linha, texto } of iconesComTamanho(codigo, rel)) anotar('tamanhoDeIcone', rel, linha, 'ícone com size em pixel', texto);
      if (!ESTADOS_DA_CASA.has(rel)) {
        for (const { linha, texto } of rodinhasCentrais(codigo, rel)) anotar('rodinhaCentral', rel, linha, 'rodinha no meio da tela', texto);
        for (const { linha, texto } of telasEmBranco(codigo, rel)) anotar('telaEmBranco', rel, linha, 'tela em branco carregando', texto);
        for (const { linha, texto } of vaziosSoltos(codigo, rel)) anotar('vazioSolto', rel, linha, '"Nenhum…" solto fora do EmptyState', texto);
      }
      const linhas = codigo.split('\n');
      const tags = tagsJsx(codigo, rel);
      if (rel !== CABECALHO_DA_CASA) {
        for (const t of tags.filter(x => x.tag === 'h1')) anotar('tituloAMao', rel, t.linha, 'título feito à mão', linhas[t.linha - 1].trim());
      }
      if (rel !== AJUSTE_DA_CASA) {
        const r = rodapeAMao(codigo);
        if (r) anotar('rodapeAMao', rel, r.linha, `${r.janelas} janelas, ${r.rodapes} DialogFooter`, linhas[r.linha - 1].trim());
        for (const a of largurasForaDaEscala(codigo, rel)) anotar('larguraDeJanela', rel, a.linha, a.largura, a.texto);
      }
      if (!embrulhos.has(rel) && rel !== CABECALHO_DA_CASA && rel !== MOLDURA_DA_CASA) {
        const cab = tags.find(x => cabecalhos.has(x.tag));
        if (cab && !(tags.some(x => x.tag === 'Pagina') && importaPaginaDaCasa(codigo, rel))) {
          anotar('foraDaMoldura', rel, cab.linha, 'cabeçalho fora da moldura', linhas[cab.linha - 1].trim());
        }
      }
    }
    codigo.split('\n').forEach((l, i) => {
      const limpa = l.trimStart();
      if (limpa.startsWith('//') || limpa.startsWith('*')) return;
      if (escopo && !MODULOS_DE_FORMATO.includes(rel) && FORMATO.some(re => re.test(l))) anotar('formato', rel, i + 1, 'formatação fora do módulo', l.trim());
      if (escopo && rel !== CHAVE_DA_CASA && CHAVE_A_MAO.test(l)) anotar('chaveMao', rel, i + 1, 'role="switch" feito à mão', l.trim());
      if (escopo && rel !== CABECALHO_DA_CASA && BARRA_A_MAO.test(l)) anotar('barraAMao', rel, i + 1, 'barrinha roxa copiada', l.trim());
      if (escopo && rel.endsWith('.tsx') && !AVISOS_DA_CASA.has(rel) && avisoAMao(l)) anotar('avisoAMao', rel, i + 1, 'aviso pintado à mão', l.trim());
      if (confirmacao && ALERT_DIALOG.test(l)) anotar('confirmacaoForaDaCasa', rel, i + 1, 'confirmação fora do useConfirmacao', l.trim());
      if (escopo && rel.endsWith('.tsx') && rel !== ABAS_DA_CASA && abaForaDaCasa(l)) anotar('abaForaDaCasa', rel, i + 1, 'aba fora da casa', l.trim());
      if (escopo && rel.endsWith('.tsx') && rel !== ALTERNADOR_DA_CASA && alternadorAMao(l)) anotar('alternadorAMao', rel, i + 1, 'alternador de visão à mão', l.trim());
      if (escopo && rel.endsWith('.tsx') && soNoMouse(l)) anotar('soNoMouse', rel, i + 1, 'ação que só aparece no mouse', l.trim());
      if (escopo && rel.endsWith('.tsx') && menuDeitado(l)) anotar('menuDeitado', rel, i + 1, 'menu de ações com ⋯ deitado', l.trim());
      if (escopo && rel.endsWith('.tsx') && !CARTOES_DA_CASA.has(rel) && cartaoAMao(l)) anotar('cartaoAMao', rel, i + 1, 'cartão feito à mão', l.trim());
      if (escopo && rel.endsWith('.tsx') && corFixaEmGrafico(l)) anotar('corFixaEmGrafico', rel, i + 1, 'cor fixa em gráfico', l.trim());
      if (escopo && rel.endsWith('.tsx') && JANELA_A_MAO.test(l)) anotar('janelaAMao', rel, i + 1, 'janela montada à mão', l.trim());
      if (escopo && rel.endsWith('.tsx') && topoCentralizado(l)) anotar('topoCentralizado', rel, i + 1, 'topo de janela centralizado', l.trim());
      // selectNativo (app inteiro): pula linhas que começam com comentário ou têm */ após a tag
      if (lista && SELECT_NATIVO.test(l) && !COMECO_DE_COMENTARIO.test(limpa)) {
        const match = SELECT_NATIVO.exec(l);
        const afterMatch = match ? l.substring(match.index + match[0].length) : '';
        if (!afterMatch.includes('*/')) {
          anotar('selectNativo', rel, i + 1, 'lista nativa fora do Seletor', l.trim());
        }
      }
    });
  }

  const pastaJson = join(RAIZ, 'src/i18n/locales/pt-BR');
  for (const nome of readdirSync(pastaJson).filter(n => n.endsWith('.json') && !NAMESPACES_SOBRA.has(n.slice(0, -5)))) {
    const rel = `src/i18n/locales/pt-BR/${nome}`;
    const dados = JSON.parse(readFileSync(join(pastaJson, nome), 'utf8'));
    for (const { linha, texto } of textosDoJson(dados)) conferirTexto(rel, linha, texto);
  }
  return achados;
}

export const CATEGORIAS = {
  tecnico: 'termo técnico na tela',
  glossario: 'palavra fora do glossário',
  formato: 'formatação fora do módulo',
  plural: 'plural com parênteses',
  acento: 'palavra sem acento',
  maiusculas: 'Maiúscula Em Toda Palavra',
  chaveMao: 'chave feita à mão',
  iconeSemNome: 'botão só-ícone sem nome',
  selectNativo: 'lista de escolha nativa (app inteiro)',
  tituloAMao: 'título de página feito à mão',
  barraAMao: 'barrinha roxa copiada',
  foraDaMoldura: 'cabeçalho fora da moldura',
  avisoAMao: 'aviso ou faixa pintado à mão',
  confirmacaoForaDaCasa: 'confirmação fora do useConfirmacao (app inteiro)',
  abaForaDaCasa: 'aba fora da casa (pílula ou à mão)',
  alternadorAMao: 'alternador de visão à mão',
  soNoMouse: 'ação que só aparece no mouse',
  menuDeitado: 'menu de ações com ⋯ deitado',
  cartaoAMao: 'cartão feito à mão (fora do Card)',
  corFixaEmGrafico: 'cor fixa em gráfico',
  botaoPintado: 'botão pintado à mão (fora do Button)',
  botaoPequeno: 'botão abaixo de 32 px (Button h-4..h-7)',
  tamanhoDeIcone: 'ícone com size em pixel',
  rodinhaCentral: 'rodinha no meio da tela (use Carregando)',
  telaEmBranco: 'tela em branco carregando (fallback={null})',
  vazioSolto: '"Nenhum…" solto fora do EmptyState',
  larguraDeJanela: 'janela com largura fora das quatro',
  janelaDireta: 'janela importada do pacote base (app inteiro)',
  janelaAMao: 'janela montada à mão (fixed inset-0)',
  rodapeAMao: 'janela com botões fora do DialogFooter',
  topoCentralizado: 'topo de janela centralizado (a casa alinha à esquerda)',
  soMouse: 'escondido que só aparece com mouse (app inteiro)',
};

function principal() {
  const achados = varrer();
  const conta = c => achados.filter(a => a.categoria === c).length;
  console.log('padrão da tela do cliente (Fase 3)\n');
  for (const [c, nome] of Object.entries(CATEGORIAS)) console.log(`  ${c.padEnd(16)}${String(conta(c)).padStart(6)}  ${nome}`);

  const i = process.argv.indexOf('--listar');
  if (i !== -1) {
    const qual = process.argv[i + 1] || 'tudo';
    for (const a of achados.filter(x => qual === 'tudo' || x.categoria === qual).sort((x, y) => x.onde.localeCompare(y.onde))) {
      console.log(`  ${a.categoria.padEnd(13)} ${a.onde}  [${a.detalhe}]  ${String(a.texto).slice(0, 90)}`);
    }
  }

  const t = process.argv.indexOf('--tetos');
  if (t !== -1) {
    const tetos = JSON.parse(readFileSync(process.argv[t + 1], 'utf8'));
    const estouros = Object.keys(CATEGORIAS).filter(c => typeof tetos[c] === 'number' && conta(c) > tetos[c]);
    if (estouros.length) {
      for (const c of estouros) console.error(`\n✗ ${CATEGORIAS[c]}: ${conta(c)}, e o teto é ${tetos[c]}.`);
      console.error(
        '\n  Rode com --listar <categoria> pra ver onde. A régua está em GLOSSARIO.md.\n' +
          '  Se o teto tiver que subir, suba junto com a razão: teto que sobe sozinho não é teto.',
      );
      process.exit(1);
    }
    console.log('\n✓ dentro de todos os tetos.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) principal();
