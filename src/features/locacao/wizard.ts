// Assistente de novo contrato: o estado (tudo texto, como vem dos campos), as
// validações de cada passo e a prévia do primeiro boleto.

import { lerDinheiro } from '@/lib/formato';
import { R, addMonths, dim, fimContrato, fracao, mk, pad, periodoDe, prorataAluguel, proximoAniversario } from './motor';
import type { ConfigDaLocacao, DadosDeNovoContrato, Garantia, Intermediacao, IndiceDeReajuste, ModoDeCobranca, PoliticaNegativo, TipoGarantia, UsoDoImovel } from './tipos';

export interface EstadoDoAssistente {
  imovel: string;
  uso: UsoDoImovel;
  /** '' = não escolheu · 'novo' = cadastrar agora · senão o id do proprietário. */
  proprietario: string;
  novoNome: string;
  novoDoc: string;
  novoPix: string;
  corretorLocacao: string;
  corretorCaptacao: string;
  inqNome: string;
  inqDoc: string;
  inqZap: string;
  aluguel: string;
  dia: string;
  inicio: string;
  meses: string;
  cobranca: ModoDeCobranca;
  indice: IndiceDeReajuste;
  politica: PoliticaNegativo;
  taxaAdm: string;
  intermediacao: Intermediacao;
  garantia: TipoGarantia;
  caucao: string;
  detalhe: string;
  vence: string;
  mensal: string;
  condominio: string;
  iptuResp: 'inq' | 'prop' | 'nao';
  iptuParcela: string;
  seguro: string;
}

export function estadoInicial(hoje: string, taxaAdmPadrao = 8): EstadoDoAssistente {
  return {
    imovel: '', uso: 'residencial', proprietario: '', novoNome: '', novoDoc: '', novoPix: '',
    corretorLocacao: '', corretorCaptacao: '', inqNome: '', inqDoc: '', inqZap: '',
    aluguel: '', dia: '10', inicio: hoje, meses: '30', cobranca: 'vencido', indice: 'IGP-M', politica: 'manter',
    taxaAdm: String(taxaAdmPadrao).replace('.', ','), intermediacao: 'nao',
    garantia: 'caucao', caucao: '', detalhe: '', vence: '', mensal: '',
    condominio: '', iptuResp: 'inq', iptuParcela: '', seguro: '',
  };
}

/** Texto digitado → número. Vazio = 0; inválido = NaN (a validação avisa). */
export function lerValor(texto: string): number {
  if (!texto.trim()) return 0;
  const n = lerDinheiro(texto);
  return n === null ? NaN : n;
}

export const PASSOS_DO_ASSISTENTE = ['Imóvel e pessoas', 'Aluguel e cobrança', 'Garantia e encargos', 'Conferir'] as const;

/** Mensagem do primeiro problema do passo `k` (1 a 3), ou null se está tudo certo. */
export function wzErro(k: number, e: EstadoDoAssistente): string | null {
  if (k === 1) {
    if (!e.imovel.trim()) return 'Escreva o imóvel.';
    if (e.proprietario === 'novo' && (!e.novoNome.trim() || !e.novoPix.trim())) return 'Preencha nome e chave PIX do novo proprietário.';
    if (!e.inqNome.trim()) return 'Escreva o nome do inquilino.';
  }
  if (k === 2) {
    const alu = lerValor(e.aluguel);
    if (!(alu > 0)) return 'Informe o valor do aluguel.';
    if (!e.inicio) return 'Informe a data de início.';
    const taxa = Number(e.taxaAdm.replace(',', '.'));
    if (!(taxa >= 6 && taxa <= 10)) return 'A taxa de administração fica entre 6% e 10% do aluguel.';
  }
  if (k === 3) {
    const alu = lerValor(e.aluguel);
    if (e.cobranca === 'antecipado' && e.garantia !== 'nenhuma') {
      return 'Mês adiantado só é permitido em contrato sem garantia (Lei 8.245, arts. 20 e 42). Escolha "Sem garantia" ou volte ao passo 2 e marque "Mês vencido".';
    }
    if (e.garantia === 'caucao') {
      const cau = lerValor(e.caucao);
      if (!(cau > 0)) return 'Informe o valor da caução: é ela que cobre o que o inquilino ficar devendo na saída.';
      if (cau > alu * 3 + 0.005) return 'A caução não pode passar de 3 aluguéis (art. 38).';
    }
    if (e.garantia === 'seguro' && !e.vence) return 'Informe o vencimento da apólice do seguro-fiança: o sistema avisa antes de ela vencer.';
    if (e.garantia === 'fianca' && !e.detalhe.trim()) return 'Escreva o nome e o CPF do fiador.';
    if (e.garantia === 'seguro' && !e.detalhe.trim()) return 'Escreva a seguradora e o número da apólice.';
    if (e.garantia === 'titulo' && !e.detalhe.trim()) return 'Escreva o número do título de capitalização.';
    if (e.garantia === 'outra' && !e.detalhe.trim()) return 'Descreva a garantia.';
  }
  return null;
}

/** Primeiro passo (1 a 3) com problema, ou null. Usado antes de salvar. */
export function primeiroPassoComErro(e: EstadoDoAssistente): number | null {
  for (const k of [1, 2, 3]) if (wzErro(k, e)) return k;
  return null;
}

export function garantiaDoEstado(e: EstadoDoAssistente): Garantia {
  return {
    tipo: e.garantia,
    valor: e.garantia === 'caucao' ? lerValor(e.caucao) : 0,
    detalhe: e.detalhe.trim() || null,
    vence: e.garantia === 'seguro' ? e.vence || null : null,
    mensal: e.garantia === 'seguro' ? lerValor(e.mensal) : null,
    desde: e.inicio,
  };
}

/** O que vai para a API em POST /locacao/contratos. */
export function dadosParaSalvar(e: EstadoDoAssistente, extras: { ownerId?: string | null } = {}): DadosDeNovoContrato {
  const partes = e.imovel.split('·').map((s) => s.trim()).filter(Boolean);
  const novo = e.proprietario === 'novo';
  return {
    imovel_descricao: partes[0] ?? e.imovel.trim(),
    imovel_endereco: partes.slice(1).join(' · ') || undefined,
    uso: e.uso,
    proprietario_owner_id: novo ? null : extras.ownerId ?? (e.proprietario || null),
    proprietario_nome: novo ? e.novoNome.trim() : '',
    proprietario_doc: novo ? e.novoDoc.trim() || undefined : undefined,
    proprietario_pix_chave: novo ? e.novoPix.trim() : undefined,
    inquilino_nome: e.inqNome.trim(),
    inquilino_doc: e.inqDoc.trim() || undefined,
    inquilino_telefone: e.inqZap.trim() || undefined,
    corretor_locacao: e.corretorLocacao.trim() || undefined,
    corretor_captacao: e.corretorCaptacao.trim() || undefined,
    aluguel_inicial: lerValor(e.aluguel),
    dia_vencimento: Math.min(28, Math.max(1, Math.round(Number(e.dia) || 10))),
    inicio: e.inicio,
    meses: Math.max(1, Math.round(Number(e.meses) || 30)),
    cobranca: e.cobranca,
    indice: e.indice,
    politica_negativo: e.politica,
    taxa_adm_pct: Number(e.taxaAdm.replace(',', '.')),
    intermediacao: e.intermediacao,
    garantia: garantiaDoEstado(e),
    condominio_estimado: lerValor(e.condominio),
    iptu: { resp: e.iptuResp, parcela: e.iptuResp === 'nao' ? 0 : lerValor(e.iptuParcela) },
    seguro_incendio: lerValor(e.seguro),
  };
}

export interface LinhaDaPrevia {
  desc: string;
  valor: number;
}

export interface PreviaDoPrimeiroBoleto {
  vencimento: string;
  periodo: { ini: string; fim: string };
  parcial: boolean;
  aluguel: number;
  extras: LinhaDaPrevia[];
  total: number;
  taxaRotulo: string;
  taxa: number;
  recebeProprietario: number;
  taxaMaiorQueAluguel: boolean;
  comissaoLocacao: number;
  comissaoCaptacao: number;
  fim: string;
  primeiroReajuste: string;
}

/** Como ficaria o primeiro boleto com o que está preenchido (null se faltar o básico). */
export function previaPrimeiroBoleto(e: EstadoDoAssistente, cfg: Pick<ConfigDaLocacao, 'taxa_boleto' | 'comissao_locacao_pct' | 'comissao_captacao_pct'>): PreviaDoPrimeiroBoleto | null {
  const alu = lerValor(e.aluguel);
  if (!(alu > 0) || !e.inicio) return null;
  const meses = Math.max(1, Math.round(Number(e.meses) || 30));
  const dia = Math.min(28, Math.max(1, Math.round(Number(e.dia) || 10)));
  const hist = [{ desde: e.inicio, valor: alu }];

  let k = mk(e.inicio);
  let periodo = periodoDe({ inicio: e.inicio, cobranca: e.cobranca }, k);
  for (let t = 0; t < 3 && !periodo; t++) {
    k = mk(addMonths(`${k}-01`, 1));
    periodo = periodoDe({ inicio: e.inicio, cobranca: e.cobranca }, k);
  }
  if (!periodo) return null;

  const [ano, mes] = k.split('-').map(Number);
  const vencimento = `${k}-${pad(Math.min(dia, dim(ano, mes)))}`;
  const fr = fracao(periodo.ini, periodo.fim);
  const parcial = fr < 0.999;
  const aluguel = prorataAluguel(hist, periodo.ini, periodo.fim);

  const extras: LinhaDaPrevia[] = [];
  const cond = lerValor(e.condominio);
  if (cond > 0) extras.push({ desc: parcial ? 'Condomínio (estimado, proporcional)' : 'Condomínio (estimado)', valor: R(cond * fr) });
  const iptu = lerValor(e.iptuParcela);
  if (e.iptuResp === 'inq' && iptu > 0 && mes >= 2 && mes <= 11) extras.push({ desc: `IPTU parcela ${mes - 1}/10`, valor: iptu });
  const inc = lerValor(e.seguro);
  if (inc > 0) extras.push({ desc: 'Seguro incêndio (mensal)', valor: inc });
  const fianca = e.garantia === 'seguro' ? lerValor(e.mensal) : 0;
  if (fianca > 0) extras.push({ desc: 'Seguro-fiança (mensal)', valor: fianca });
  if (cfg.taxa_boleto > 0) extras.push({ desc: 'Taxa de boleto', valor: cfg.taxa_boleto });

  const taxaAdm = Number(e.taxaAdm.replace(',', '.')) || 0;
  let taxa: number;
  let taxaRotulo: string;
  if (e.intermediacao === 'cheio') {
    taxa = alu;
    taxaRotulo = 'taxa de intermediação (1º aluguel cheio)';
  } else if (e.intermediacao === 'proporcional') {
    taxa = aluguel;
    taxaRotulo = 'taxa de intermediação (valor do 1º boleto)';
  } else {
    taxa = R((aluguel * taxaAdm) / 100);
    taxaRotulo = `taxa de administração (${String(taxaAdm).replace('.', ',')}%)`;
  }
  const total = R(aluguel + extras.reduce((s, x) => s + x.valor, 0));
  const comissaoBase = e.intermediacao === 'nao' ? 0 : taxa;
  return {
    vencimento,
    periodo,
    parcial,
    aluguel,
    extras,
    total,
    taxaRotulo,
    taxa: R(taxa),
    recebeProprietario: R(aluguel - taxa),
    taxaMaiorQueAluguel: taxa > aluguel + 0.005,
    comissaoLocacao: R((comissaoBase * cfg.comissao_locacao_pct) / 100),
    comissaoCaptacao: R((comissaoBase * cfg.comissao_captacao_pct) / 100),
    fim: fimContrato(e.inicio, meses),
    primeiroReajuste: proximoAniversario(null, e.inicio),
  };
}
