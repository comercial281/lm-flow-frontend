// LM Notion — logica pura das views: filtro, ordenacao, agrupamento,
// formula e rollup. SEM React, SEM acesso a rede. Tudo aqui e testavel isolado.

import type {
  PageRow, NotionProperty, FilterGroup, FilterCondition, SortRule,
  SelectOption, PropertyValue, RollupConfig, FilterOperator, PropertyType, ViewConfig,
} from '../types'

// ── Helpers de leitura de valor ────────────────────────────────────────────

/** Valor bruto de uma propriedade numa linha (titulo vem da coluna title). */
export function rawValue(row: PageRow, property: NotionProperty): PropertyValue {
  switch (property.type) {
    case 'title':            return row.title
    case 'created_time':     return row.created_at
    case 'last_edited_time': return row.updated_at
    case 'created_by':       return row.created_by
    case 'last_edited_by':   return row.last_edited_by
    case 'relation':         return row.relations[property.id] ?? []
    default:                 return row.props[property.id] ?? null
  }
}

/**
 * Valor que a celula deve EXIBIR — inclui os tipos derivados.
 * rawValue nao basta: formula e rollup nao moram em notion_page_props,
 * sao calculados na hora. Toda view deve usar esta funcao, nunca
 * row.props[id] direto, senao coluna de formula/created_time sai vazia.
 *
 * relatedRows: linhas do database ALVO de um rollup. Sem elas o rollup
 * nao tem como somar/contar e devolve null.
 */
export function resolveCellValue(
  row: PageRow,
  property: NotionProperty,
  properties: NotionProperty[],
  relatedRows: PageRow[] = [],
): PropertyValue {
  if (property.type === 'formula') {
    const expr = property.config?.expression ?? ''
    if (!expr.trim()) return null
    return evaluateFormula(expr, row, properties) as PropertyValue
  }
  if (property.type === 'rollup') {
    const relProp = property.config?.relation_property_id
    if (relProp && relatedRows.length > 0) {
      const ligadas = new Set(row.relations[relProp] ?? [])
      const alvo = relatedRows.filter(r => ligadas.has(r.id))
      return computeRollup(alvo, property.config, properties) as PropertyValue
    }
    // Sem as linhas do alvo em maos, aceita o valor ja calculado por quem
    // tinha (o DatabaseView grava o resultado em row.props). Assim as views
    // nao precisam receber as linhas do outro database.
    return row.props[property.id] ?? null
  }
  return rawValue(row, property)
}

/**
 * Vale a pena mostrar este valor num card? Usado por galeria/lista/quadro
 * pra nao poluir o card com propriedade vazia. `false` de checkbox NAO e
 * vazio — a caixa desmarcada e informacao.
 */
export function isVazio(v: PropertyValue): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  return false
}

/**
 * Colunas que a view deve mostrar, na ordem das propriedades.
 *
 * A fonte e `config.hidden_props` (o que esconder). O campo antigo
 * `visible_props` (o que mostrar) tinha um defeito grave: propriedade criada
 * DEPOIS da lista ser salva nao estava nela e sumia pra sempre — o usuario
 * adicionava uma coluna e ela simplesmente nao aparecia. So e lido como
 * legado, quando `hidden_props` ainda nao existe naquela view.
 */
export function propriedadesVisiveis(
  properties: NotionProperty[],
  view: { visible_props?: string[]; config?: ViewConfig },
): NotionProperty[] {
  const escondidas = view.config?.hidden_props
    ?? legadoParaEscondidas(properties, view.visible_props ?? [])
  const fora = new Set(escondidas)
  return properties.filter(p => !fora.has(p.id))
}

function legadoParaEscondidas(properties: NotionProperty[], visiveis: string[]): string[] {
  if (visiveis.length === 0) return []
  const dentro = new Set(visiveis)
  return properties.filter(p => !dentro.has(p.id)).map(p => p.id)
}

/** Liga/desliga uma coluna, devolvendo o patch de config pra salvar. */
export function alternarColuna(
  properties: NotionProperty[],
  view: { visible_props?: string[]; config?: ViewConfig },
  propertyId: string,
): { config: ViewConfig; visible_props: string[] } {
  const atuais = view.config?.hidden_props
    ?? legadoParaEscondidas(properties, view.visible_props ?? [])
  const set = new Set(atuais)
  if (set.has(propertyId)) set.delete(propertyId)
  else set.add(propertyId)
  // Zera o campo legado pra nao existirem duas fontes de verdade.
  return { config: { ...(view.config ?? {}), hidden_props: [...set] }, visible_props: [] }
}

/**
 * O que gravar quando um card e solto numa coluna do quadro.
 * Fica aqui, puro, porque a parte que E nossa (decidir o novo valor) precisa
 * ser testavel sem depender do gesto de arrastar do dnd-kit.
 * Devolve null quando nao ha nada a fazer: sem coluna alvo, sem agrupamento,
 * linha inexistente, ou card solto na mesma coluna de onde saiu.
 */
export function resultadoDoDrop(
  rows: PageRow[],
  groupProp: NotionProperty | null,
  pageId: string,
  targetKey: string | null,
): { pageId: string; propertyId: string; value: PropertyValue } | null {
  if (!targetKey || !groupProp) return null
  const row = rows.find(r => r.id === pageId)
  if (!row) return null

  const atual = typeof row.props[groupProp.id] === 'string'
    ? (row.props[groupProp.id] as string)
    : NO_VALUE_KEY
  if (atual === targetKey) return null

  return {
    pageId,
    propertyId: groupProp.id,
    value: targetKey === NO_VALUE_KEY ? null : targetKey,
  }
}

/**
 * Previa em texto puro do conteudo da pagina (blocos do BlockNote), pra mostrar
 * no card do quadro "o que tem dentro da tarefa". Anda recursivamente pelos
 * blocos e filhos, junta o texto e corta em `max` caracteres. Ignora blocos sem
 * texto (imagem, divisor). Retorna '' quando a pagina esta vazia.
 */
export function previewDoConteudo(content: unknown, max = 140): string {
  if (!Array.isArray(content)) return ''
  const linhas: string[] = []

  const textoDoInline = (inline: unknown): string => {
    if (typeof inline === 'string') return inline
    if (Array.isArray(inline)) return inline.map(textoDoInline).join('')
    if (inline && typeof inline === 'object') {
      const o = inline as { text?: unknown; content?: unknown }
      if (typeof o.text === 'string') return o.text
      if (o.content != null) return textoDoInline(o.content)
    }
    return ''
  }

  // Cada bloco vira uma LINHA propria — assim o card mostra o conteudo
  // organizado (uma linha por item), nao um texto atropelado tudo junto.
  const anda = (blocos: unknown[]) => {
    for (const b of blocos) {
      if (linhas.join('\n').length >= max) return
      if (!b || typeof b !== 'object') continue
      const bloco = b as { content?: unknown; children?: unknown }
      const t = textoDoInline(bloco.content).replace(/\s+/g, ' ').trim()
      if (t) linhas.push(t)
      if (Array.isArray(bloco.children)) anda(bloco.children)
    }
  }
  anda(content)

  const texto = linhas.join('\n').trim()
  return texto.length > max ? texto.slice(0, max).trimEnd() + '…' : texto
}

/**
 * Texto pra busca por palavra-chave num card. Junta titulo + valores de texto
 * (texto/url/email/telefone/numero) + NOMES das opcoes de select/status/tags +
 * o conteudo da pagina. Assim buscar "urgente" acha um card que tem a tag
 * Urgente ou a palavra no corpo, nao so no titulo. Tudo minusculo.
 */
export function textoBuscavel(row: PageRow, properties: NotionProperty[]): string {
  const partes: string[] = [row.title ?? '']
  for (const p of properties) {
    if (p.type === 'title') continue
    const v = rawValue(row, p)
    if (p.type === 'select' || p.type === 'status') {
      const o = findOption(p, v)
      if (o) partes.push(o.name)
    } else if (p.type === 'multi_select') {
      const ids = Array.isArray(v) ? (v as string[]) : []
      for (const id of ids) { const o = findOption(p, id); if (o) partes.push(o.name) }
    } else if (['text', 'url', 'email', 'phone', 'number'].includes(p.type)) {
      if (v != null && v !== '') partes.push(String(v))
    }
  }
  partes.push(previewDoConteudo(row.content, 500))
  return partes.join(' ').toLowerCase()
}

/**
 * Quais colunas do quadro aparecem. A coluna "Sem valor" (catch-all de tarefas
 * sem a propriedade de agrupamento) SÓ aparece quando tem card — vazia ela é só
 * ruído. Colunas nomeadas (opções do status) continuam aparecendo vazias, a não
 * ser que hide_empty_groups esteja ligado.
 */
export function gruposVisiveis<T extends { key: string; rows: unknown[] }>(
  grupos: T[],
  hideEmpty: boolean | undefined,
): T[] {
  return grupos.filter(g => {
    if (g.rows.length > 0) return true
    if (g.key === NO_VALUE_KEY) return false
    return !hideEmpty
  })
}

/** Coluna (key) a que uma linha pertence no quadro agrupado por `groupProp`. */
export function colunaDaLinha(row: PageRow, groupProp: NotionProperty | null): string {
  if (!groupProp) return NO_VALUE_KEY
  const ids = new Set(optionsOf(groupProp).map(o => o.id))
  const raw = rawValue(row, groupProp)
  return typeof raw === 'string' && ids.has(raw) ? raw : NO_VALUE_KEY
}

/**
 * Decide o que fazer quando um card e solto no quadro. Regras cravadas com o
 * Giovani (2026-07-22):
 *   - Arrastar dentro da MESMA coluna reordena pra posicao exata onde soltou.
 *   - Arrastar pra OUTRA coluna sempre coloca o card no TOPO (primeiro).
 * A posicao e gravada em notion_pages.sort_order (double precision), calculada
 * como ponto medio entre os vizinhos — assim reordenar nunca precisa renumerar
 * a coluna inteira.
 *
 * overId pode ser a KEY de uma coluna (soltou no fundo/vazio) ou o ID de outro
 * card (soltou em cima dele -> entra ANTES dele).
 *
 * Retorna:
 *   - groupValue: 'manter' quando nao muda de coluna; senao o novo valor da
 *     propriedade de agrupamento (null = coluna "Sem valor").
 *   - sortOrder: novo sort_order do card movido.
 */
export function planoDoDrop(
  rows: PageRow[],
  groupProp: NotionProperty | null,
  activeId: string,
  overId: string | null,
): { pageId: string; groupValue: PropertyValue | 'manter'; sortOrder: number } | null {
  if (!groupProp || !overId || activeId === overId) return null
  const active = rows.find(r => r.id === activeId)
  if (!active) return null

  const colKeys = new Set<string>([...optionsOf(groupProp).map(o => o.id), NO_VALUE_KEY])
  const origem = colunaDaLinha(active, groupProp)

  // Descobre a coluna de destino e um card-ancora (se soltou sobre um card).
  let destino: string
  let ancoraId: string | null = null
  if (colKeys.has(overId)) {
    destino = overId
  } else {
    const overRow = rows.find(r => r.id === overId)
    if (!overRow) return null
    destino = colunaDaLinha(overRow, groupProp)
    ancoraId = overId
  }

  const mesmaColuna = origem === destino

  // Cards que ja estao na coluna de destino (sem o proprio card movido),
  // ordenados por sort_order — a lista onde vamos inserir.
  const naColuna = rows
    .filter(r => r.id !== activeId && colunaDaLinha(r, groupProp) === destino)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  // Indice de insercao.
  let index: number
  if (!mesmaColuna) {
    index = 0 // regra: mudou de coluna -> topo
  } else if (ancoraId) {
    const i = naColuna.findIndex(r => r.id === ancoraId)
    index = i < 0 ? naColuna.length : i // entra ANTES do card-ancora
  } else {
    index = naColuna.length // soltou no fundo da coluna -> ultimo
  }

  const prev = naColuna[index - 1]
  const next = naColuna[index]
  let sortOrder: number
  if (!prev && !next) sortOrder = 0
  else if (!prev) sortOrder = (next.sort_order ?? 0) - 1
  else if (!next) sortOrder = (prev.sort_order ?? 0) + 1
  else sortOrder = ((prev.sort_order ?? 0) + (next.sort_order ?? 0)) / 2

  return {
    pageId: activeId,
    groupValue: mesmaColuna ? 'manter' : (destino === NO_VALUE_KEY ? null : destino),
    sortOrder,
  }
}

function isDateValue(v: unknown): v is { start: string; end?: string | null } {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'start' in (v as object)
}

function isFileList(v: unknown): v is { name: string; url: string }[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null && 'url' in (v[0] as object)
}

export type TomPrazo = 'atrasado' | 'hoje' | 'breve' | 'futuro' | 'nenhum'

/**
 * Classifica um prazo pra dar DESTAQUE de urgencia (vermelho atrasado, ambar
 * hoje/em breve). `hoje` é injetável pra teste não depender do relógio.
 * Tarefa finalizada nunca é "urgente" — vira neutra.
 */
export function classificarPrazo(
  value: PropertyValue,
  finalizada: boolean,
  hoje: Date = new Date(),
): { tom: TomPrazo; texto: string } {
  const d = dateStart(value)
  if (!d) return { tom: 'nenhum', texto: '' }

  const curto = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  if (finalizada) return { tom: 'futuro', texto: curto }

  const dias = Math.round((startOfDay(d).getTime() - startOfDay(hoje).getTime()) / 86400000)
  if (dias < 0)  return { tom: 'atrasado', texto: dias === -1 ? 'Ontem' : `Atrasado ${-dias}d` }
  if (dias === 0) return { tom: 'hoje',   texto: 'Hoje' }
  if (dias === 1) return { tom: 'breve',  texto: 'Amanhã' }
  if (dias <= 3)  return { tom: 'breve',  texto: `Em ${dias}d` }
  return { tom: 'futuro', texto: curto }
}

/** Data de inicio de uma propriedade date (ou null). */
export function dateStart(value: PropertyValue): Date | null {
  if (isDateValue(value)) return parseDate(value.start)
  if (typeof value === 'string') return parseDate(value)
  return null
}

/** Data de fim de uma propriedade date; cai no start quando nao ha end. */
export function dateEnd(value: PropertyValue): Date | null {
  if (isDateValue(value) && value.end) return parseDate(value.end)
  return dateStart(value)
}

/**
 * Data pura ("2026-07-22") tem que virar meia-noite LOCAL, nao UTC.
 * `new Date('2026-07-22')` e interpretado como UTC pelo padrao da linguagem;
 * no Brasil (UTC-3) isso vira 21/07 21:00 e a data aparece um dia antes na
 * galeria, na lista, no calendario e na timeline. String com hora ou fuso
 * segue o parse normal.
 */
function parseDate(s: string): Date | null {
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (soData) {
    return new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]))
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function optionsOf(property: NotionProperty): SelectOption[] {
  return property.config?.options ?? []
}

/** Nome legivel de uma option de select/status a partir do id. */
export function optionName(property: NotionProperty, id: unknown): string {
  if (typeof id !== 'string') return ''
  const found = optionsOf(property).find(o => o.id === id)
  return found ? found.name : id
}

export function findOption(property: NotionProperty, id: unknown): SelectOption | null {
  if (typeof id !== 'string') return null
  return optionsOf(property).find(o => o.id === id) ?? null
}

// ── formatValue ────────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const DATETIME_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** Representacao textual de um valor, do jeito que a UI mostra. */
export function formatValue(value: PropertyValue, property: NotionProperty): string {
  if (value === null || value === undefined || value === '') return ''

  switch (property.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(n)) return ''
      const precision = property.config?.precision
      switch (property.config?.format) {
        case 'percent':
          return `${formatNumber(n * 100, precision)}%`
        case 'real':
          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
        case 'dolar':
          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(n)
        default:
          return formatNumber(n, precision)
      }
    }

    case 'checkbox':
      return value ? 'Sim' : 'Nao'

    case 'select':
    case 'status':
      return optionName(property, value)

    case 'multi_select':
      return Array.isArray(value)
        ? value.map(id => optionName(property, id)).filter(Boolean).join(', ')
        : ''

    case 'date':
    case 'created_time':
    case 'last_edited_time': {
      const start = dateStart(value)
      if (!start) return ''
      const fmt = property.config?.include_time ? DATETIME_FMT : DATE_FMT
      const end = isDateValue(value) && value.end ? parseDate(value.end) : null
      return end ? `${fmt.format(start)} - ${fmt.format(end)}` : fmt.format(start)
    }

    case 'person':
    case 'relation':
      return Array.isArray(value) ? `${value.length}` : ''

    case 'files':
      return isFileList(value) ? value.map(f => f.name).join(', ') : ''

    default:
      if (Array.isArray(value)) return value.map(String).join(', ')
      if (typeof value === 'object') return ''
      return String(value)
  }
}

function formatNumber(n: number, precision?: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: precision ?? 0,
    maximumFractionDigits: precision ?? 2,
  }).format(n)
}

// ── Operadores por tipo ────────────────────────────────────────────────────

const TEXTUAL: FilterOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'is_empty', 'is_not_empty',
]
const NUMERIC: FilterOperator[] = ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
const DATEY: FilterOperator[] = ['is_overdue', 'is_today', 'is_this_week', 'equals', 'not_equals', 'on_or_before', 'on_or_after', 'is_empty', 'is_not_empty']
const CHOICE: FilterOperator[] = ['equals', 'not_equals', 'is_empty', 'is_not_empty']
const MULTI: FilterOperator[] = ['contains', 'not_contains', 'is_empty', 'is_not_empty']
const BOOL: FilterOperator[] = ['checked', 'unchecked']

/** Operadores que fazem sentido para o tipo da propriedade. */
export function operatorsFor(type: PropertyType): FilterOperator[] {
  switch (type) {
    case 'checkbox':                                        return BOOL
    case 'number': case 'auto_number':                      return NUMERIC
    case 'date': case 'created_time': case 'last_edited_time': return DATEY
    case 'select': case 'status':                           return CHOICE
    case 'multi_select': case 'person': case 'relation': case 'files': return MULTI
    default:                                                return TEXTUAL
  }
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'e igual a',
  not_equals: 'e diferente de',
  contains: 'contem',
  not_contains: 'nao contem',
  starts_with: 'comeca com',
  ends_with: 'termina com',
  is_empty: 'esta vazio',
  is_not_empty: 'nao esta vazio',
  greater_than: 'maior que',
  less_than: 'menor que',
  on_or_before: 'em ou antes de',
  on_or_after: 'em ou depois de',
  checked: 'marcado',
  unchecked: 'desmarcado',
  is_overdue: 'esta atrasada',
  is_today: 'vence hoje',
  is_this_week: 'vence esta semana',
}

/** Operadores que dispensam campo de valor. */
const SEM_VALOR: FilterOperator[] = [
  'is_empty', 'is_not_empty', 'checked', 'unchecked', 'is_overdue', 'is_today', 'is_this_week',
]
export function operatorNeedsValue(op: FilterOperator): boolean {
  return !SEM_VALOR.includes(op)
}

// ── applyFilters ───────────────────────────────────────────────────────────

function isEmptyValue(v: PropertyValue): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (isDateValue(v)) return !v.start
  return false
}

function matches(row: PageRow, cond: FilterCondition, property: NotionProperty): boolean {
  const value = rawValue(row, property)

  switch (cond.operator) {
    case 'is_empty':     return isEmptyValue(value)
    case 'is_not_empty': return !isEmptyValue(value)
    case 'checked':      return value === true
    case 'unchecked':    return value !== true
    default: break
  }

  const target = cond.value

  // Multi-valor (multi_select, person, relation): compara por pertencimento.
  if (Array.isArray(value)) {
    const list = value.map(String)
    const needle = String(target ?? '')
    switch (cond.operator) {
      case 'contains':     return list.includes(needle)
      case 'not_contains': return !list.includes(needle)
      case 'equals':       return list.length === 1 && list[0] === needle
      case 'not_equals':   return !(list.length === 1 && list[0] === needle)
      default:             return true
    }
  }

  // Datas.
  const isDateProp = property.type === 'date'
    || property.type === 'created_time' || property.type === 'last_edited_time'
  if (isDateProp) {
    const a = dateStart(value)
    // Operadores RELATIVOS: comparam com "hoje" na hora (nao guardam data).
    if (cond.operator === 'is_overdue' || cond.operator === 'is_today' || cond.operator === 'is_this_week') {
      if (!a) return false
      const hoje = startOfDay(new Date())
      const dia = startOfDay(a)
      if (cond.operator === 'is_overdue') return dia.getTime() < hoje.getTime()
      if (cond.operator === 'is_today') return dia.getTime() === hoje.getTime()
      // esta semana: de hoje ate domingo (fim da semana corrente)
      const fimSemana = new Date(hoje)
      fimSemana.setDate(hoje.getDate() + (7 - hoje.getDay()))
      return dia.getTime() >= hoje.getTime() && dia.getTime() <= fimSemana.getTime()
    }
    const b = typeof target === 'string' || typeof target === 'number' ? parseDate(String(target)) : null
    if (!a || !b) return false
    const dayA = startOfDay(a).getTime()
    const dayB = startOfDay(b).getTime()
    switch (cond.operator) {
      case 'equals':       return dayA === dayB
      case 'not_equals':   return dayA !== dayB
      case 'on_or_before': return dayA <= dayB
      case 'on_or_after':  return dayA >= dayB
      case 'greater_than': return dayA > dayB
      case 'less_than':    return dayA < dayB
      default:             return true
    }
  }

  // Numeros.
  if (property.type === 'number' || property.type === 'auto_number') {
    const a = typeof value === 'number' ? value : Number(value)
    const b = Number(target)
    if (Number.isNaN(a) || Number.isNaN(b)) return false
    switch (cond.operator) {
      case 'equals':       return a === b
      case 'not_equals':   return a !== b
      case 'greater_than': return a > b
      case 'less_than':    return a < b
      default:             return true
    }
  }

  // Select/status: compara id cru e tambem o nome legivel.
  if (property.type === 'select' || property.type === 'status') {
    const id = typeof value === 'string' ? value : ''
    const needle = String(target ?? '')
    const hit = id === needle || optionName(property, id).toLowerCase() === needle.toLowerCase()
    switch (cond.operator) {
      case 'equals':     return hit
      case 'not_equals': return !hit
      default:           return true
    }
  }

  // Texto e afins.
  const text = (typeof value === 'object' ? formatValue(value, property) : String(value ?? '')).toLowerCase()
  const needle = String(target ?? '').toLowerCase()
  switch (cond.operator) {
    case 'equals':       return text === needle
    case 'not_equals':   return text !== needle
    case 'contains':     return text.includes(needle)
    case 'not_contains': return !text.includes(needle)
    case 'starts_with':  return text.startsWith(needle)
    case 'ends_with':    return text.endsWith(needle)
    default:             return true
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Aplica um grupo de filtros (and/or). Condicao com propriedade sumida e ignorada. */
export function applyFilters(
  rows: PageRow[],
  filters: FilterGroup,
  props: NotionProperty[],
): PageRow[] {
  const conditions = filters?.conditions ?? []
  if (conditions.length === 0) return rows

  const byId = new Map(props.map(p => [p.id, p]))
  const valid = conditions.filter(c => byId.has(c.property_id))
  if (valid.length === 0) return rows

  const isOr = filters.operator === 'or'
  return rows.filter(row => {
    const results = valid.map(c => matches(row, c, byId.get(c.property_id)!))
    return isOr ? results.some(Boolean) : results.every(Boolean)
  })
}

// ── applySorts ─────────────────────────────────────────────────────────────

function comparable(row: PageRow, property: NotionProperty): string | number {
  const v = rawValue(row, property)
  const ehData = property.type === 'date' || property.type === 'created_time' || property.type === 'last_edited_time'
  if (v === null || v === undefined) {
    // Data vazia vai pro FIM (nao pro topo) ao ordenar por prazo asc.
    return ehData ? Number.MAX_SAFE_INTEGER : ''
  }
  switch (property.type) {
    case 'number': case 'auto_number':
      return typeof v === 'number' ? v : Number(v) || 0
    case 'checkbox':
      return v === true ? 1 : 0
    case 'date': case 'created_time': case 'last_edited_time': {
      const d = dateStart(v)
      return d ? d.getTime() : 0
    }
    case 'select': case 'status':
      return optionName(property, v).toLowerCase()
    case 'multi_select': case 'person': case 'relation': case 'files':
      return Array.isArray(v) ? v.length : 0
    default:
      return formatValue(v, property).toLowerCase()
  }
}

/** Ordena por multiplas regras, na ordem em que aparecem. Estavel. */
export function applySorts(
  rows: PageRow[],
  sorts: SortRule[],
  props: NotionProperty[],
): PageRow[] {
  if (!sorts || sorts.length === 0) return rows
  const byId = new Map(props.map(p => [p.id, p]))
  const valid = sorts.filter(s => byId.has(s.property_id))
  if (valid.length === 0) return rows

  return [...rows].sort((a, b) => {
    for (const rule of valid) {
      const property = byId.get(rule.property_id)!
      const va = comparable(a, property)
      const vb = comparable(b, property)
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb), 'pt-BR')
      if (cmp !== 0) return rule.direction === 'desc' ? -cmp : cmp
    }
    return 0
  })
}

// ── groupRows ──────────────────────────────────────────────────────────────

export const NO_VALUE_KEY = '__sem_valor__'

/** Agrupa linhas por uma propriedade select/status. Sem propriedade = grupo unico. */
export function groupRows(
  rows: PageRow[],
  property: NotionProperty | null,
): { key: string; option: SelectOption | null; rows: PageRow[] }[] {
  if (!property) return [{ key: NO_VALUE_KEY, option: null, rows }]

  const options = optionsOf(property)
  const buckets = new Map<string, PageRow[]>()
  for (const option of options) buckets.set(option.id, [])
  buckets.set(NO_VALUE_KEY, [])

  for (const row of rows) {
    const raw = rawValue(row, property)
    const id = typeof raw === 'string' && raw ? raw : NO_VALUE_KEY
    const key = buckets.has(id) ? id : NO_VALUE_KEY
    buckets.get(key)!.push(row)
  }

  const groups: { key: string; option: SelectOption | null; rows: PageRow[] }[] =
    options.map(option => ({
      key: option.id,
      option,
      rows: buckets.get(option.id) ?? [],
    }))
  groups.push({ key: NO_VALUE_KEY, option: null, rows: buckets.get(NO_VALUE_KEY) ?? [] })
  return groups
}

// ── computeRollup ──────────────────────────────────────────────────────────

/** Calcula um rollup sobre as linhas ja relacionadas (o chamador resolve a relacao). */
export function computeRollup(
  rows: PageRow[],
  config: RollupConfig,
  props: NotionProperty[],
): string | number | null {
  const fn = config.fn ?? 'count'
  if (fn === 'count') return rows.length

  const target = props.find(p => p.id === config.target_property_id)
  if (!target) return null

  const values = rows.map(r => rawValue(r, target))

  if (fn === 'show_original') {
    return values.map(v => formatValue(v, target)).filter(Boolean).join(', ')
  }

  if (fn === 'count_values') {
    return values.filter(v => !isEmptyValue(v)).length
  }

  if (fn === 'percent_checked') {
    if (rows.length === 0) return 0
    const checked = values.filter(v => v === true).length
    return Math.round((checked / rows.length) * 100)
  }

  const numbers = values
    .map(v => {
      if (typeof v === 'number') return v
      if (typeof v === 'boolean') return v ? 1 : 0
      const d = dateStart(v)
      if (d) return d.getTime()
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    })
    .filter((n): n is number => n !== null)

  if (numbers.length === 0) return null

  switch (fn) {
    case 'sum':   return numbers.reduce((a, b) => a + b, 0)
    case 'avg':   return numbers.reduce((a, b) => a + b, 0) / numbers.length
    case 'min':   return Math.min(...numbers)
    case 'max':   return Math.max(...numbers)
    case 'range': return Math.max(...numbers) - Math.min(...numbers)
    default:      return null
  }
}

// ── evaluateFormula ────────────────────────────────────────────────────────
// Parser proprio: tokenizer + descida recursiva. NUNCA eval / new Function.

type FormulaValue = string | number | boolean | Date | null

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ident'; v: string }
  | { t: 'op'; v: string }
  | { t: 'punct'; v: '(' | ')' | ',' }

const OPERATORS = ['>=', '<=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '>', '<', '=']

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]

    if (/\s/.test(ch)) { i++; continue }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push({ t: 'num', v: Number(src.slice(i, j)) })
      i = j
      continue
    }

    if (ch === '"' || ch === "'") {
      let j = i + 1
      let out = ''
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) { out += src[j + 1]; j += 2; continue }
        out += src[j]; j++
      }
      if (j >= src.length) throw new Error('String sem fechamento')
      tokens.push({ t: 'str', v: out })
      i = j + 1
      continue
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      tokens.push({ t: 'ident', v: src.slice(i, j) })
      i = j
      continue
    }

    if (ch === '(' || ch === ')' || ch === ',') {
      tokens.push({ t: 'punct', v: ch })
      i++
      continue
    }

    const op = OPERATORS.find(o => src.startsWith(o, i))
    if (op) {
      tokens.push({ t: 'op', v: op === '=' ? '==' : op })
      i += op.length
      continue
    }

    throw new Error(`Caractere invalido: ${ch}`)
  }
  return tokens
}

interface Ctx { row: PageRow; props: NotionProperty[] }

class Parser {
  private pos = 0
  constructor(private tokens: Token[], private ctx: Ctx) {}

  private peek(): Token | undefined { return this.tokens[this.pos] }

  private eatOp(...ops: string[]): string | null {
    const tok = this.peek()
    if (tok && tok.t === 'op' && ops.includes(tok.v)) { this.pos++; return tok.v }
    return null
  }

  private eatPunct(p: '(' | ')' | ','): boolean {
    const tok = this.peek()
    if (tok && tok.t === 'punct' && tok.v === p) { this.pos++; return true }
    return false
  }

  private expectPunct(p: '(' | ')' | ','): void {
    if (!this.eatPunct(p)) throw new Error(`Esperado "${p}"`)
  }

  parse(): FormulaValue {
    const value = this.parseOr()
    if (this.pos < this.tokens.length) throw new Error('Sobrou conteudo na expressao')
    return value
  }

  private parseOr(): FormulaValue {
    let left = this.parseAnd()
    while (this.eatOp('||')) {
      const right = this.parseAnd()
      left = truthy(left) || truthy(right)
    }
    return left
  }

  private parseAnd(): FormulaValue {
    let left = this.parseComparison()
    while (this.eatOp('&&')) {
      const right = this.parseComparison()
      left = truthy(left) && truthy(right)
    }
    return left
  }

  private parseComparison(): FormulaValue {
    let left = this.parseAdditive()
    for (;;) {
      const op = this.eatOp('==', '!=', '>=', '<=', '>', '<')
      if (!op) return left
      const right = this.parseAdditive()
      left = compare(op, left, right)
    }
  }

  private parseAdditive(): FormulaValue {
    let left = this.parseMultiplicative()
    for (;;) {
      const op = this.eatOp('+', '-')
      if (!op) return left
      const right = this.parseMultiplicative()
      if (op === '+') {
        // "+" concatena quando qualquer lado e texto.
        left = (typeof left === 'string' || typeof right === 'string')
          ? `${toText(left)}${toText(right)}`
          : toNumber(left) + toNumber(right)
      } else {
        left = toNumber(left) - toNumber(right)
      }
    }
  }

  private parseMultiplicative(): FormulaValue {
    let left = this.parseUnary()
    for (;;) {
      const op = this.eatOp('*', '/', '%')
      if (!op) return left
      const right = this.parseUnary()
      const a = toNumber(left)
      const b = toNumber(right)
      if ((op === '/' || op === '%') && b === 0) { left = null; continue }
      left = op === '*' ? a * b : op === '/' ? a / b : a % b
    }
  }

  private parseUnary(): FormulaValue {
    if (this.eatOp('-')) return -toNumber(this.parseUnary())
    if (this.eatOp('+')) return toNumber(this.parseUnary())
    const tok = this.peek()
    if (tok && tok.t === 'ident' && tok.v === 'not' && this.tokens[this.pos + 1]?.t === 'punct') {
      // tratado em parsePrimary como funcao
    }
    return this.parsePrimary()
  }

  private parseArgs(): FormulaValue[] {
    this.expectPunct('(')
    const args: FormulaValue[] = []
    if (this.eatPunct(')')) return args
    for (;;) {
      args.push(this.parseOr())
      if (this.eatPunct(',')) continue
      this.expectPunct(')')
      return args
    }
  }

  /** if() precisa de avaliacao preguicosa: so o ramo escolhido roda. */
  private parseIf(): FormulaValue {
    this.expectPunct('(')
    const cond = this.parseOr()
    this.expectPunct(',')
    const startThen = this.pos
    this.skipExpression()
    const endThen = this.pos
    this.expectPunct(',')
    const startElse = this.pos
    this.skipExpression()
    const endElse = this.pos
    this.expectPunct(')')

    const [from, to] = truthy(cond) ? [startThen, endThen] : [startElse, endElse]
    return new Parser(this.tokens.slice(from, to), this.ctx).parse()
  }

  /** Anda ate a virgula/parentese de fecho do nivel atual, sem avaliar. */
  private skipExpression(): void {
    let depth = 0
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos]
      if (tok.t === 'punct') {
        if (tok.v === '(') depth++
        else if (tok.v === ')') { if (depth === 0) return; depth-- }
        else if (tok.v === ',' && depth === 0) return
      }
      this.pos++
    }
  }

  private parsePrimary(): FormulaValue {
    const tok = this.peek()
    if (!tok) throw new Error('Expressao incompleta')

    if (tok.t === 'num') { this.pos++; return tok.v }
    if (tok.t === 'str') { this.pos++; return tok.v }

    if (tok.t === 'punct' && tok.v === '(') {
      this.pos++
      const value = this.parseOr()
      this.expectPunct(')')
      return value
    }

    if (tok.t === 'ident') {
      this.pos++
      const name = tok.v

      if (name === 'true')  return true
      if (name === 'false') return false
      if (name === 'null')  return null

      if (name === 'if') return this.parseIf()

      const next = this.peek()
      if (!next || next.t !== 'punct' || next.v !== '(') {
        // Identificador solto: trata como nome de propriedade.
        return readProp(this.ctx, name)
      }
      return this.callFunction(name, this.parseArgs())
    }

    throw new Error('Token inesperado')
  }

  private callFunction(name: string, args: FormulaValue[]): FormulaValue {
    switch (name) {
      case 'prop':
        return readProp(this.ctx, toText(args[0] ?? ''))

      case 'concat':
        return args.map(toText).join('')

      case 'join': {
        const [sep, ...rest] = args
        return rest.map(toText).join(toText(sep ?? ''))
      }

      case 'length':
        return toText(args[0] ?? '').length

      case 'empty': {
        const v = args[0]
        return v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))
      }

      case 'now':
        return new Date()

      case 'today': {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), d.getDate())
      }

      case 'dateBetween': {
        const a = toDate(args[0])
        const b = toDate(args[1])
        if (!a || !b) return null
        const unit = args[2] === undefined ? 'days' : toText(args[2])
        const ms = a.getTime() - b.getTime()
        switch (unit) {
          case 'minutes': return Math.trunc(ms / 60000)
          case 'hours':   return Math.trunc(ms / 3600000)
          case 'weeks':   return Math.trunc(ms / 604800000)
          case 'months':  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth())
          case 'years':   return a.getFullYear() - b.getFullYear()
          default:        return Math.trunc(ms / 86400000)
        }
      }

      case 'not':    return !truthy(args[0] ?? null)
      case 'and':    return args.every(truthy)
      case 'or':     return args.some(truthy)
      case 'number': return toNumber(args[0] ?? null)
      case 'text':   return toText(args[0] ?? null)
      case 'abs':    return Math.abs(toNumber(args[0] ?? null))
      case 'round':  return Math.round(toNumber(args[0] ?? null))
      case 'floor':  return Math.floor(toNumber(args[0] ?? null))
      case 'ceil':   return Math.ceil(toNumber(args[0] ?? null))
      case 'min':    return Math.min(...args.map(toNumber))
      case 'max':    return Math.max(...args.map(toNumber))
      case 'upper':  return toText(args[0] ?? '').toUpperCase()
      case 'lower':  return toText(args[0] ?? '').toLowerCase()
      case 'contains': return toText(args[0] ?? '').includes(toText(args[1] ?? ''))

      default:
        throw new Error(`Funcao desconhecida: ${name}`)
    }
  }
}

function readProp(ctx: Ctx, name: string): FormulaValue {
  const property = ctx.props.find(p => p.name === name) ?? ctx.props.find(p => p.id === name)
  if (!property) return null
  const raw = rawValue(ctx.row, property)

  switch (property.type) {
    case 'number': case 'auto_number':
      return typeof raw === 'number' ? raw : (raw === null || raw === '' ? null : Number(raw))
    case 'checkbox':
      return raw === true
    case 'date': case 'created_time': case 'last_edited_time':
      return dateStart(raw)
    default: {
      const text = formatValue(raw, property)
      return text === '' ? null : text
    }
  }
}

function truthy(v: FormulaValue): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v)
  if (typeof v === 'string') return v.length > 0
  return true
}

function toNumber(v: FormulaValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.getTime()
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

function toText(v: FormulaValue): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return DATE_FMT.format(v)
  if (typeof v === 'boolean') return v ? 'Sim' : 'Nao'
  return String(v)
}

function toDate(v: FormulaValue | undefined): Date | null {
  if (v instanceof Date) return v
  if (typeof v === 'string') return parseDate(v)
  if (typeof v === 'number') return new Date(v)
  return null
}

function compare(op: string, a: FormulaValue, b: FormulaValue): boolean {
  const bothNumeric = (typeof a === 'number' || a instanceof Date) && (typeof b === 'number' || b instanceof Date)
  if (bothNumeric || (op !== '==' && op !== '!=')) {
    const x = toNumber(a)
    const y = toNumber(b)
    switch (op) {
      case '>':  return x > y
      case '<':  return x < y
      case '>=': return x >= y
      case '<=': return x <= y
      case '==': return x === y
      case '!=': return x !== y
      default:   return false
    }
  }
  const x = typeof a === 'string' || typeof b === 'string' ? toText(a) : a
  const y = typeof a === 'string' || typeof b === 'string' ? toText(b) : b
  return op === '==' ? x === y : x !== y
}

/**
 * Avalia uma formula do Notion sobre uma linha.
 * Suporta prop("Nome"), + - * / %, comparacoes, && ||, if(cond, a, b),
 * concat, length, now, today, dateBetween, empty, not/and/or e utilitarios.
 * Erro de sintaxe devolve null (a celula mostra vazio, nao quebra a view).
 */
export function evaluateFormula(
  expression: string,
  row: PageRow,
  props: NotionProperty[],
): string | number | boolean | null {
  if (!expression || !expression.trim()) return null
  try {
    const tokens = tokenize(expression)
    if (tokens.length === 0) return null
    const result = new Parser(tokens, { row, props }).parse()
    if (result instanceof Date) return DATE_FMT.format(result)
    if (typeof result === 'number' && !Number.isFinite(result)) return null
    return result
  } catch {
    return null
  }
}
