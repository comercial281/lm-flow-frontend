// Texto do contrato de locação (Lei 8.245/91), montado dos dados do cadastro.
// Devolve o HTML de DENTRO do documento; quem desenha a folha é a tela.
// Dado que o cadastro não tem vira <span class="blank">: aparece em amarelo e
// a tela conta quantos faltam.

import { data as dataBr, dinheiro } from '@/lib/formato';
import { extenso, fimContrato } from './motor';
import type { Contrato, ConfigDaLocacao } from './tipos';

export interface OpcoesDoContrato {
  /** Nome da imobiliária que administra. */
  administradora?: string;
}

const ORDINAIS = [
  'PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA',
  'DÉCIMA PRIMEIRA', 'DÉCIMA SEGUNDA', 'DÉCIMA TERCEIRA', 'DÉCIMA QUARTA', 'DÉCIMA QUINTA', 'DÉCIMA SEXTA', 'DÉCIMA SÉTIMA',
];

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const blank = (t: string) => `<span class="blank" title="Preencha antes de imprimir">${t}</span>`;
const valor = (v: string | null | undefined, ph: string) => (v && String(v).trim() ? esc(v) : blank(ph));
const vExt = (v: number) => `${dinheiro(v)} (${extenso(v)})`;
const numeroSemMoeda = (n: number) => extenso(n).replace(/ rea(l|is)$/, '');

/** Tira o "matrícula nº" da frente: o texto do contrato já escreve "matrícula nº". */
export function limparMatricula(m: string | null | undefined): string {
  return (m ?? '').replace(/^\s*(matr[ií]cula\s*)?n[º°o]?\.?\s*(?=\d)/i, '');
}

export function contratoDoc(c: Contrato, cfg: Pick<ConfigDaLocacao, 'multa_pct' | 'juros_mes_pct' | 'taxa_boleto'>, op: OpcoesDoContrato = {}): string {
  const g = c.garantia;
  const cq = c.qualificacao ?? {};
  const res = c.uso !== 'comercial';
  const fim = fimContrato(c.inicio, c.meses);
  const aluguel = c.historico_aluguel?.[0]?.valor ?? c.aluguel_inicial;
  const adm = op.administradora?.trim() ? esc(op.administradora) : blank('nome da imobiliária');

  const pessoa = (nome: string, doc: string | null | undefined, x: { qual?: string; rg?: string; end?: string } | undefined, papel: string) =>
    `<b>${esc(nome)}</b>, ${valor(x?.qual, 'nacionalidade, estado civil, profissão')}, inscrito(a) no CPF/CNPJ sob o nº ${valor(doc, 'CPF ou CNPJ')}, RG nº ${valor(x?.rg, 'número e órgão emissor')}, residente e domiciliado(a) em ${valor(x?.end, 'endereço completo')}, doravante denominado(a) <b>${papel}</b>`;

  let n = 0;
  const cl = (titulo: string, texto: string) => `<h3>CLÁUSULA ${ORDINAIS[n++]} — ${titulo}</h3>${texto}`;

  const detalhe = g.detalhe ? esc(g.detalhe) : '';
  const garantia: Record<string, string> = {
    caucao: `<p>Em garantia das obrigações deste contrato, o LOCATÁRIO entrega ao LOCADOR caução em dinheiro no valor de ${vExt(g.valor || 0)}${detalhe ? ` (${detalhe})` : ''}, que não excede o equivalente a três meses de aluguel e será depositada em caderneta de poupança, revertendo em favor do LOCATÁRIO as vantagens dela decorrentes por ocasião do levantamento (art. 38, § 2º, da Lei 8.245/91). Ao fim da locação, a caução corrigida será devolvida ao LOCATÁRIO, deduzidos os débitos apurados no acerto final.</p>`,
    fianca: `<p>Assina este contrato, como FIADOR e principal pagador, ${detalhe ? `<b>${detalhe}</b>` : blank('nome do fiador')}, ${valor(cq.fiador, 'qualificação completa do fiador e do cônjuge')}, que se responsabiliza solidariamente por todas as obrigações do LOCATÁRIO até a efetiva entrega das chaves, inclusive na prorrogação por prazo indeterminado, renunciando ao benefício de ordem (arts. 827 e 828 do Código Civil) e ressalvado o direito de exoneração previsto no art. 40, X, da Lei 8.245/91.</p>`,
    seguro: `<p>As obrigações do LOCATÁRIO são garantidas por seguro de fiança locatícia${detalhe ? ` (${detalhe})` : ''}${g.vence ? `, com vigência até ${dataBr(g.vence)}` : ''}, cujo prêmio${(g.mensal ?? 0) > 0 ? `, de ${vExt(g.mensal ?? 0)} por mês,` : ''} é de responsabilidade do LOCATÁRIO e será cobrado junto com o aluguel (art. 23, XI, da Lei 8.245/91). O LOCATÁRIO se obriga a manter o seguro renovado durante toda a locação, sob pena de rescisão (art. 40, parágrafo único).</p>`,
    titulo: `<p>As obrigações do LOCATÁRIO são garantidas por cessão fiduciária de título de capitalização${detalhe ? ` (${detalhe})` : ''} (art. 37, IV, da Lei 8.245/91).</p>`,
    outra: `<p>As obrigações do LOCATÁRIO são garantidas por: ${detalhe || blank('descrever a garantia')}.</p>`,
    nenhuma: `<p>A locação é contratada sem garantia. Por isso, nos termos do art. 42 da Lei 8.245/91, o aluguel ${c.cobranca === 'antecipado' ? 'é pago antecipadamente, até o dia do vencimento do mês a vencer' : 'poderá ser exigido antecipadamente'}.</p>`,
  };

  const encargos = [
    c.condominio_estimado > 0
      ? `as despesas ordinárias de condomínio (art. 23, XII, e § 1º), hoje estimadas em ${dinheiro(c.condominio_estimado)} por mês, cobradas junto com o aluguel pelo valor real de cada mês; as despesas extraordinárias de condomínio (fundo de obras, reformas, pintura de fachada e afins) são do LOCADOR (art. 22, X)`
      : '',
    c.iptu.parcela > 0 && c.iptu.resp === 'inq' ? `o IPTU e as taxas que incidam sobre o imóvel, hoje de ${dinheiro(c.iptu.parcela)} por mês (art. 22, VIII, parte final)` : '',
    c.seguro_incendio > 0 ? `o prêmio de seguro contra incêndio do imóvel, de ${dinheiro(c.seguro_incendio)} por mês` : '',
    'o consumo de água, luz, gás e telefone, cujas contas deverá transferir para o seu nome',
    cfg.taxa_boleto > 0 ? `a tarifa de emissão do boleto, de ${dinheiro(cfg.taxa_boleto)} por cobrança` : '',
  ].filter(Boolean);

  const multaMeses = c.encerramento?.multa_meses != null ? +c.encerramento.multa_meses : 3;
  const dec = (v: number) => String(v).replace('.', ',');

  const partes: string[] = [];
  partes.push(`<h1>CONTRATO DE LOCAÇÃO ${res ? 'RESIDENCIAL' : 'NÃO RESIDENCIAL'}</h1>`);
  partes.push(
    `<p>Pelo presente instrumento particular, de um lado ${pessoa(c.proprietario_nome, c.proprietario_doc, cq.prop, 'LOCADOR')}, aqui representado por sua administradora, ${adm}; e de outro lado ${pessoa(c.inquilino_nome, c.inquilino_doc, cq.inq, 'LOCATÁRIO')}${c.inquilino_telefone ? `, com WhatsApp ${esc(c.inquilino_telefone)} para recebimento de boletos e avisos` : ''}; têm entre si justo e contratado a locação do imóvel abaixo descrito, que se regerá pela Lei 8.245/91 e pelas cláusulas seguintes.</p>`,
  );
  const imovel = [c.imovel_descricao, c.imovel_endereco].filter(Boolean).join(' · ');
  partes.push(
    cl('DO OBJETO', `<p>O objeto deste contrato é o imóvel situado em <b>${esc(imovel.replace(/ · /g, ', '))}</b>, ${valor(cq.compl, 'complemento, CEP, cidade e UF')}, matrícula nº ${valor(limparMatricula(cq.matricula), 'matrícula e cartório')}, destinado exclusivamente ao uso <b>${res ? 'residencial do LOCATÁRIO e de sua família' : 'não residencial (comercial)'}</b>, sendo vedada a mudança de destinação sem o consentimento por escrito do LOCADOR.</p>`),
  );
  partes.push(
    cl('DO PRAZO', `<p>A locação é feita pelo prazo de <b>${c.meses} (${numeroSemMoeda(c.meses)}) meses</b>, com início em <b>${dataBr(c.inicio)}</b> e término em <b>${dataBr(fim)}</b>, data em que o LOCATÁRIO se obriga a restituir o imóvel livre e desocupado, salvo prorrogação.</p><p>Findo o prazo sem oposição do LOCADOR por mais de trinta dias, a locação se prorroga por prazo indeterminado, nas mesmas condições (${res ? 'art. 46, § 1º' : 'art. 56, parágrafo único'}, da Lei 8.245/91).</p>`),
  );
  partes.push(
    cl(
      'DO ALUGUEL E DO PAGAMENTO',
      `<p>O aluguel mensal é de <b>${vExt(aluguel)}</b>, ${c.cobranca === 'antecipado' ? 'pago antecipadamente, referente ao mês que se inicia,' : 'pago no mês seguinte ao vencido (mês vencido),'} até o <b>dia ${c.dia_vencimento}</b> de cada mês, por meio do boleto bancário ou PIX enviado pela administradora ao LOCATÁRIO.</p><p>O pagamento após o vencimento sujeita o LOCATÁRIO à multa de <b>${dec(cfg.multa_pct)}%</b> sobre o valor devido, juros de mora de <b>${dec(cfg.juros_mes_pct)}% ao mês</b> calculados dia a dia e correção monetária, sem prejuízo das demais sanções deste contrato.</p>${c.intermediacao && c.intermediacao !== 'nao' ? `<p>O primeiro pagamento ${c.intermediacao === 'proporcional' ? 'será proporcional aos dias de ocupação do primeiro mês' : 'corresponderá ao primeiro aluguel cheio'}.</p>` : ''}`,
    ),
  );
  partes.push(
    cl('DO REAJUSTE', `<p>O aluguel será reajustado a cada período de doze meses, contado do início da locação, pela variação acumulada do <b>${esc(c.indice)}</b> nos doze meses anteriores, ou, na sua extinção, pelo índice oficial que o substituir. ${c.politica_negativo === 'manter' ? 'Se a variação acumulada for negativa, o aluguel é mantido sem redução.' : 'Se a variação acumulada for negativa, o aluguel será reduzido na mesma proporção.'}</p>`),
  );
  partes.push(
    cl('DOS ENCARGOS', `<p>Além do aluguel, cabe ao LOCATÁRIO pagar: ${encargos.join('; ')}.</p><p>Cabe ao LOCADOR pagar ${c.iptu.resp === 'prop' ? 'o IPTU e as taxas do imóvel, ' : ''}as despesas extraordinárias de condomínio e as demais obrigações do art. 22 da Lei 8.245/91.</p>`),
  );
  const gar = garantia[g.tipo] ?? '';
  if (gar) partes.push(cl('DA GARANTIA', gar + (g.tipo !== 'nenhuma' ? '<p>É vedada mais de uma modalidade de garantia neste contrato (art. 37, parágrafo único).</p>' : '')));
  partes.push(
    cl('DA VISTORIA E DA CONSERVAÇÃO', `<p>O LOCATÁRIO declara receber o imóvel no estado descrito no laudo de vistoria de entrada, assinado pelas partes e parte integrante deste contrato, obrigando-se a restituí-lo no mesmo estado, salvo as deteriorações decorrentes do uso normal (art. 23, III). Os reparos de danos causados pelo LOCATÁRIO, seus dependentes ou visitantes correm por sua conta (art. 23, V).</p><p>Na devolução, será feita vistoria de saída comparada à de entrada; os reparos apurados serão cobrados no acerto final.</p>`),
  );
  partes.push(
    cl('DAS BENFEITORIAS E MODIFICAÇÕES', `<p>Nenhuma modificação ou benfeitoria será feita sem autorização prévia e por escrito do LOCADOR. As benfeitorias necessárias serão indenizáveis; as úteis, só se autorizadas; as voluptuárias não serão indenizadas e poderão ser retiradas se não afetarem a estrutura do imóvel (arts. 35 e 36 da Lei 8.245/91).</p>`),
  );
  partes.push(cl('DA CESSÃO E SUBLOCAÇÃO', `<p>É vedado ao LOCATÁRIO ceder, sublocar ou emprestar o imóvel, no todo ou em parte, sem o consentimento prévio e escrito do LOCADOR (art. 13).</p>`));
  partes.push(
    cl('DA DEVOLUÇÃO ANTECIPADA', `<p>Se o LOCATÁRIO devolver o imóvel antes do fim do prazo, pagará multa equivalente a <b>${dec(multaMeses)} ${multaMeses === 1 ? 'aluguel' : 'aluguéis'}</b> vigentes, reduzida proporcionalmente ao tempo de contrato já cumprido (art. 4º da Lei 8.245/91 e art. 413 do Código Civil), dispensada a multa na hipótese do parágrafo único do art. 4º (transferência de emprego).</p><p>A devolução se faz mediante aviso por escrito com trinta dias de antecedência, entrega das chaves com termo assinado e quitação dos encargos até a data da saída.</p>`),
  );
  partes.push(
    cl('DA INFRAÇÃO CONTRATUAL', `<p>A falta de pagamento ou o descumprimento de qualquer cláusula autoriza a rescisão do contrato e a ação de despejo (art. 9º), respondendo a parte infratora pelos prejuízos causados.</p>`),
  );
  partes.push(
    cl('DO DIREITO DE PREFERÊNCIA E DAS VISITAS', `<p>No caso de venda do imóvel, o LOCATÁRIO terá preferência para adquiri-lo em igualdade de condições com terceiros (art. 27). O LOCATÁRIO permitirá a vistoria do imóvel pelo LOCADOR ou sua administradora, em dia e hora combinados, e a visita de interessados em caso de venda (art. 23, IX).</p>`),
  );
  partes.push(
    cl('DAS COMUNICAÇÕES', `<p>As partes aceitam como válidas as comunicações, boletos e avisos enviados por WhatsApp e e-mail informados neste contrato, obrigando-se a comunicar qualquer mudança de contato.</p>`),
  );
  partes.push(cl('DO FORO', `<p>Fica eleito o foro da comarca onde se situa o imóvel para dirimir as questões oriundas deste contrato (art. 58, II, da Lei 8.245/91).</p>`));
  partes.push(`<p>E, por estarem justas e contratadas, as partes assinam este instrumento em duas vias de igual teor, na presença de duas testemunhas${g.tipo === 'fianca' ? ', juntamente com o FIADOR' : ''}.</p>`);
  partes.push(`<p class="ct-data">${valor(cq.cidade, 'Cidade')}, ${dataBr(c.inicio)}.</p>`);
  partes.push(
    `<div class="ct-ass"><div><span></span>${esc(c.proprietario_nome)}<small>LOCADOR</small></div><div><span></span>${esc(c.inquilino_nome)}<small>LOCATÁRIO</small></div>${g.tipo === 'fianca' ? `<div><span></span>${detalhe || 'Fiador'}<small>FIADOR</small></div>` : ''}<div><span></span>Testemunha 1<small>Nome e CPF</small></div><div><span></span>Testemunha 2<small>Nome e CPF</small></div></div>`,
  );
  return partes.join('');
}

/** Quantas lacunas (campos em amarelo) o texto tem. */
export function contarLacunas(html: string): number {
  return (html.match(/class="blank"/g) ?? []).length;
}

/** Nome do arquivo baixado: sem os caracteres que o Windows não aceita. */
export function nomeDoArquivo(imovelCurto: string): string {
  return `Contrato de locação - ${imovelCurto}`.replace(/[\\/:*?"<>|]/g, '-');
}

/** Nome curto do imóvel: o que vem antes do primeiro "·". */
export function imovelCurto(descricao: string): string {
  return (descricao || '').split('·')[0].trim() || descricao;
}
