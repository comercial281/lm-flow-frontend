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
// tags, em atributo de texto (title, placeholder, label…), em toast, em
// confirmação e nos mapas de rótulo (TRIGGER_LABELS…). Nome de variável, rota,
// tipo e chave de i18n NÃO contam — "pipeline" em código fica; "Pipeline" na
// tela é que conta.
//
// USO
//   node scripts/conferir-padrao.mjs                       conta
//   node scripts/conferir-padrao.mjs --listar tecnico      lista uma categoria (ou "tudo")
//   node scripts/conferir-padrao.mjs --tetos arquivo.json  sai 1 se alguma passar do teto

import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
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
  'src/pages/Shared/Marketplace/', 'src/pages/Admin/McpServers/',
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
    'automacao|automacoes|integracao|integracoes|conexao|mensagens? automaticas?|imoveis|imovel',
);

// Título e botão em frase normal: "Novo cargo", não "Novo Cargo". Conta texto
// curto (2 a 5 palavras) em que TODA palavra de 3+ letras começa maiúscula,
// descontando nomes próprios do produto e de terceiros.
const NOMES_PROPRIOS = new Set([
  'WhatsApp', 'LM', 'Flow', 'IA', 'Vendedora', 'Meta', 'Google', 'Facebook', 'Instagram', 'Pixel', 'CAPI',
  'Leal', 'Mídia', 'Kenlo', 'Zap', 'OLX', 'Viva', 'Real', 'Chaves', 'Na', 'Mão', 'Ads', 'Business', 'API',
  'Canva', 'Notion', 'YouTube', 'TikTok', 'LinkedIn', 'Gmail', 'Outlook', 'Sheets', 'Calendar', 'Drive',
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

// Atributos e propriedades cujo valor é texto que aparece na tela.
const ATRIBUTOS_DE_TEXTO = new Set([
  'title', 'placeholder', 'label', 'aria-label', 'alt', 'description', 'subtitle',
  'tooltip', 'emptyMessage', 'titulo', 'descricao', 'rotuloDaAcao', 'rotuloDeCancelar',
]);
const PROPRIEDADES_DE_TEXTO = new Set([
  'label', 'title', 'titulo', 'descricao', 'description', 'subtitle', 'placeholder',
  'tooltip', 'rotuloDaAcao', 'rotuloDeCancelar', 'emptyMessage', 'helpText', 'hint',
]);
const MAPA_DE_ROTULOS = /(LABELS?|TEXTS?|TEXTOS?|ROTULOS?|COPY)$/;

// ── Leitura dos textos de uma tela ─────────────────────────────────────────
const nomeDe = n => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : '');

// Sobe da string até achar quem decide se ela é texto de tela.
function destinoDoTexto(no) {
  let atual = no.parent;
  let filho = no;
  while (atual) {
    if (
      ts.isConditionalExpression(atual) ||
      ts.isBinaryExpression(atual) ||
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
      return false;
    }
    return false;
  }
  return false;
}

export function textosDaTela(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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

export function botoesSemNome(codigo, arquivo = 'x.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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

  for (const arquivo of andar(join(RAIZ, 'src'))) {
    const rel = relative(RAIZ, arquivo).split(sep).join('/');
    if (!noEscopo(rel)) continue;
    const codigo = readFileSync(arquivo, 'utf8');
    if (rel.endsWith('.tsx') || rel.endsWith('.ts')) {
      for (const { linha, texto } of textosDaTela(codigo, rel)) conferirTexto(rel, linha, texto);
    }
    if (rel.endsWith('.tsx')) {
      for (const { linha, texto } of botoesSemNome(codigo, rel)) anotar('iconeSemNome', rel, linha, texto, texto);
    }
    codigo.split('\n').forEach((l, i) => {
      const limpa = l.trimStart();
      if (limpa.startsWith('//') || limpa.startsWith('*')) return;
      if (!MODULOS_DE_FORMATO.includes(rel) && FORMATO.some(re => re.test(l))) anotar('formato', rel, i + 1, 'formatação fora do módulo', l.trim());
      if (rel !== CHAVE_DA_CASA && CHAVE_A_MAO.test(l)) anotar('chaveMao', rel, i + 1, 'role="switch" feito à mão', l.trim());
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
};

function principal() {
  const achados = varrer();
  const conta = c => achados.filter(a => a.categoria === c).length;
  console.log('padrão da tela do cliente (Fase 3)\n');
  for (const [c, nome] of Object.entries(CATEGORIAS)) console.log(`  ${c.padEnd(14)}${String(conta(c)).padStart(6)}  ${nome}`);

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
