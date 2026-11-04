import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data, dinheiro, hojeEmSaoPaulo } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { GARANTIA, INTERMEDIACAO, LEI_MES_VENCIDO } from '@/features/locacao/textos';
import {
  PASSOS_DO_ASSISTENTE, dadosParaSalvar, estadoInicial, previaPrimeiroBoleto, primeiroPassoComErro, wzErro,
  type EstadoDoAssistente,
} from '@/features/locacao/wizard';
import type { ConfigDaLocacao, Contrato, IndiceDeReajuste, PoliticaNegativo, TipoGarantia } from '@/features/locacao/tipos';
import { Dado } from './comum';

const CONFIG_PADRAO: Pick<ConfigDaLocacao, 'taxa_boleto' | 'comissao_locacao_pct' | 'comissao_captacao_pct' | 'taxa_adm_padrao'> = {
  taxa_boleto: 3.5, comissao_locacao_pct: 40, comissao_captacao_pct: 10, taxa_adm_padrao: 8,
};

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (contrato: Contrato) => void;
}

/** O assistente de novo contrato: quatro passos, com a conferência do primeiro boleto antes de salvar. */
export default function AssistenteNovoContrato({ aberto, aoFechar, aoCriar }: Props) {
  const [passo, setPasso] = useState(1);
  const [e, setE] = useState<EstadoDoAssistente>(() => estadoInicial(hojeEmSaoPaulo()));
  const [cfg, setCfg] = useState(CONFIG_PADRAO);
  const [donos, setDonos] = useState<{ id: string; nome: string }[]>([]);
  const [mostrarErro, setMostrarErro] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setPasso(1);
    setMostrarErro(false);
    locacaoService.config().then(c => {
      if (!vivo) return;
      setCfg(c);
      setE(estadoInicial(hojeEmSaoPaulo(), c.taxa_adm_padrao));
    }).catch(() => { if (vivo) setE(estadoInicial(hojeEmSaoPaulo())); });
    locacaoService.contratos({}).then(lista => {
      if (!vivo) return;
      const vistos = new Map<string, string>();
      lista.forEach(c => { if (c.proprietario_owner_id) vistos.set(c.proprietario_owner_id, c.proprietario_nome); });
      setDonos([...vistos].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [aberto]);

  const mudar = (p: Partial<EstadoDoAssistente>) => setE(x => ({ ...x, ...p }));
  const erroDoPasso = passo <= 3 ? wzErro(passo, e) : null;
  const previa = useMemo(() => previaPrimeiroBoleto(e, cfg), [e, cfg]);

  const avancar = () => {
    if (erroDoPasso) { setMostrarErro(true); return; }
    setMostrarErro(false);
    setPasso(p => Math.min(4, p + 1));
  };

  const salvar = async () => {
    const ruim = primeiroPassoComErro(e);
    if (ruim) { setPasso(ruim); setMostrarErro(true); return; }
    setSalvando(true);
    try {
      const contrato = await locacaoService.criarContrato(dadosParaSalvar(e));
      toast.success('Contrato criado.');
      aoCriar(contrato);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não deu pra criar o contrato.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={v => !v && aoFechar()}>
      <DialogContent size="wide" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>Passo {passo} de 4 · {PASSOS_DO_ASSISTENTE[passo - 1]}</DialogDescription>
        </DialogHeader>

        {passo === 1 && (
          <GradeDaJanela>
            <CampoDaJanela rotulo="Imóvel" htmlFor="wz-imovel" colunas={3} obrigatorio ajuda="Nome do imóvel e, depois de um ponto no meio (·), o endereço.">
              <Input id="wz-imovel" placeholder="Apto 42 Ed. Aurora · Rua das Flores, 100" value={e.imovel} onChange={ev => mudar({ imovel: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Uso" htmlFor="wz-uso">
              <Seletor id="wz-uso" value={e.uso} onChange={ev => mudar({ uso: ev.target.value as EstadoDoAssistente['uso'] })}>
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
              </Seletor>
            </CampoDaJanela>

            <CampoDaJanela rotulo="Proprietário" htmlFor="wz-prop" colunas={4}>
              <Seletor id="wz-prop" value={e.proprietario} onChange={ev => mudar({ proprietario: ev.target.value })}>
                <option value="">Escolha o proprietário</option>
                {donos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                <option value="novo">Cadastrar um novo proprietário</option>
              </Seletor>
            </CampoDaJanela>
            {e.proprietario === 'novo' && (
              <>
                <CampoDaJanela rotulo="Nome do proprietário" htmlFor="wz-pn" colunas={2} obrigatorio>
                  <Input id="wz-pn" value={e.novoNome} onChange={ev => mudar({ novoNome: ev.target.value })} />
                </CampoDaJanela>
                <CampoDaJanela rotulo="CPF ou CNPJ" htmlFor="wz-pd" colunas={2}>
                  <Input id="wz-pd" value={e.novoDoc} onChange={ev => mudar({ novoDoc: ev.target.value })} />
                </CampoDaJanela>
                <CampoDaJanela rotulo="Chave PIX para o repasse" htmlFor="wz-pp" colunas={4} obrigatorio>
                  <Input id="wz-pp" value={e.novoPix} onChange={ev => mudar({ novoPix: ev.target.value })} />
                </CampoDaJanela>
              </>
            )}

            <CampoDaJanela rotulo="Nome do inquilino" htmlFor="wz-in" colunas={2} obrigatorio>
              <Input id="wz-in" value={e.inqNome} onChange={ev => mudar({ inqNome: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="CPF ou CNPJ" htmlFor="wz-id" colunas={1}>
              <Input id="wz-id" value={e.inqDoc} onChange={ev => mudar({ inqDoc: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="WhatsApp" htmlFor="wz-iz" colunas={1} ajuda="Os lembretes de boleto saem por aqui.">
              <Input id="wz-iz" inputMode="tel" value={e.inqZap} onChange={ev => mudar({ inqZap: ev.target.value })} />
            </CampoDaJanela>

            <CampoDaJanela rotulo="Corretor da locação" htmlFor="wz-cl" colunas={2}>
              <Input id="wz-cl" value={e.corretorLocacao} onChange={ev => mudar({ corretorLocacao: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Corretor da captação" htmlFor="wz-cc" colunas={2}>
              <Input id="wz-cc" value={e.corretorCaptacao} onChange={ev => mudar({ corretorCaptacao: ev.target.value })} />
            </CampoDaJanela>
          </GradeDaJanela>
        )}

        {passo === 2 && (
          <GradeDaJanela>
            <CampoDaJanela rotulo="Aluguel (R$)" htmlFor="wz-alu" obrigatorio>
              <Input id="wz-alu" inputMode="decimal" value={e.aluguel} onChange={ev => mudar({ aluguel: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Dia do vencimento" htmlFor="wz-dia" ajuda="De 1 a 28.">
              <Input id="wz-dia" inputMode="numeric" value={e.dia} onChange={ev => mudar({ dia: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Início do contrato" htmlFor="wz-ini" obrigatorio>
              <Input id="wz-ini" type="date" value={e.inicio} onChange={ev => mudar({ inicio: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Duração (meses)" htmlFor="wz-mes">
              <Input id="wz-mes" inputMode="numeric" value={e.meses} onChange={ev => mudar({ meses: ev.target.value })} />
            </CampoDaJanela>

            <CampoDaJanela rotulo="Reajuste anual pelo" htmlFor="wz-ind" colunas={2}>
              <Seletor id="wz-ind" value={e.indice} onChange={ev => mudar({ indice: ev.target.value as IndiceDeReajuste })}>
                <option value="IGP-M">IGP-M</option>
                <option value="IPCA">IPCA</option>
              </Seletor>
            </CampoDaJanela>
            <CampoDaJanela rotulo="Se o índice for negativo" htmlFor="wz-pol" colunas={2}>
              <Seletor id="wz-pol" value={e.politica} onChange={ev => mudar({ politica: ev.target.value as PoliticaNegativo })}>
                <option value="manter">Manter o aluguel</option>
                <option value="aplicar">Aplicar a queda</option>
              </Seletor>
            </CampoDaJanela>

            <CampoDaJanela rotulo="Cobrança" colunas={4} ajuda={LEI_MES_VENCIDO}>
              <BotoesDeEscolha
                rotulo="Cobrança"
                valor={e.cobranca}
                opcoes={[{ valor: 'vencido', rotulo: 'Mês vencido' }, { valor: 'antecipado', rotulo: 'Mês adiantado' }]}
                aoEscolher={v => mudar({ cobranca: v })}
              />
            </CampoDaJanela>

            <CampoDaJanela rotulo="Taxa de administração (%)" htmlFor="wz-adm" ajuda="Entre 6% e 10% do aluguel.">
              <Input id="wz-adm" inputMode="decimal" value={e.taxaAdm} onChange={ev => mudar({ taxaAdm: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="1º aluguel é intermediação?" htmlFor="wz-int" colunas={3} ajuda={INTERMEDIACAO[e.intermediacao]}>
              <Seletor id="wz-int" value={e.intermediacao} onChange={ev => mudar({ intermediacao: ev.target.value as EstadoDoAssistente['intermediacao'] })}>
                <option value="nao">Não, cobra a taxa de administração normal</option>
                <option value="cheio">Sim, o 1º aluguel inteiro</option>
                <option value="proporcional">Sim, o valor do 1º boleto</option>
              </Seletor>
            </CampoDaJanela>
          </GradeDaJanela>
        )}

        {passo === 3 && (
          <GradeDaJanela>
            <CampoDaJanela rotulo="Garantia (uma só por contrato)" htmlFor="wz-gar" colunas={4}>
              <Seletor id="wz-gar" value={e.garantia} onChange={ev => mudar({ garantia: ev.target.value as TipoGarantia })}>
                {(Object.keys(GARANTIA) as TipoGarantia[]).map(k => <option key={k} value={k}>{GARANTIA[k]}</option>)}
              </Seletor>
            </CampoDaJanela>
            {e.garantia === 'caucao' && (
              <CampoDaJanela rotulo="Valor da caução (R$)" htmlFor="wz-cau" colunas={2} ajuda="No máximo 3 aluguéis (art. 38).">
                <Input id="wz-cau" inputMode="decimal" value={e.caucao} onChange={ev => mudar({ caucao: ev.target.value })} />
              </CampoDaJanela>
            )}
            {e.garantia === 'seguro' && (
              <>
                <CampoDaJanela rotulo="Vencimento da apólice" htmlFor="wz-vence" colunas={2}>
                  <Input id="wz-vence" type="date" value={e.vence} onChange={ev => mudar({ vence: ev.target.value })} />
                </CampoDaJanela>
                <CampoDaJanela rotulo="Parcela mensal do seguro-fiança (R$)" htmlFor="wz-mensal" colunas={2}>
                  <Input id="wz-mensal" inputMode="decimal" value={e.mensal} onChange={ev => mudar({ mensal: ev.target.value })} />
                </CampoDaJanela>
              </>
            )}
            {e.garantia !== 'caucao' && e.garantia !== 'nenhuma' && (
              <CampoDaJanela rotulo="Detalhes da garantia" htmlFor="wz-det" colunas={4} ajuda="Fiador com CPF, seguradora e apólice, número do título…">
                <Input id="wz-det" value={e.detalhe} onChange={ev => mudar({ detalhe: ev.target.value })} />
              </CampoDaJanela>
            )}

            <CampoDaJanela rotulo="O que mais vai no boleto" colunas={4}><span className="sr-only">Encargos</span></CampoDaJanela>
            <CampoDaJanela rotulo="Condomínio estimado (R$)" htmlFor="wz-cond" colunas={2} ajuda="Entra no boleto como estimado, até você lançar o valor real.">
              <Input id="wz-cond" inputMode="decimal" value={e.condominio} onChange={ev => mudar({ condominio: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Seguro incêndio, por mês (R$)" htmlFor="wz-seg" colunas={2}>
              <Input id="wz-seg" inputMode="decimal" value={e.seguro} onChange={ev => mudar({ seguro: ev.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="IPTU" htmlFor="wz-iptu" colunas={2}>
              <Seletor id="wz-iptu" value={e.iptuResp} onChange={ev => mudar({ iptuResp: ev.target.value as EstadoDoAssistente['iptuResp'] })}>
                <option value="inq">Inquilino paga</option>
                <option value="prop">Proprietário paga</option>
                <option value="nao">Não cobrar</option>
              </Seletor>
            </CampoDaJanela>
            {e.iptuResp === 'inq' && (
              <CampoDaJanela rotulo="Parcela do IPTU (R$)" htmlFor="wz-iptup" colunas={2}>
                <Input id="wz-iptup" inputMode="decimal" value={e.iptuParcela} onChange={ev => mudar({ iptuParcela: ev.target.value })} />
              </CampoDaJanela>
            )}
          </GradeDaJanela>
        )}

        {passo === 4 && (
          <div className="grid gap-4">
            <div className="grid">
              <Dado rotulo="Imóvel">{e.imovel}</Dado>
              <Dado rotulo="Inquilino">{e.inqNome}</Dado>
              <Dado rotulo="Proprietário">{e.proprietario === 'novo' ? e.novoNome : donos.find(d => d.id === e.proprietario)?.nome ?? 'a definir'}</Dado>
              <Dado rotulo="Aluguel">{dinheiro(Number(e.aluguel.replace(/\./g, '').replace(',', '.')) || 0)}</Dado>
              <Dado rotulo="Garantia">{GARANTIA[e.garantia]}</Dado>
              {previa && <Dado rotulo="Contrato termina em">{data(previa.fim)}</Dado>}
              {previa && <Dado rotulo="Primeiro reajuste">{data(previa.primeiroReajuste)}</Dado>}
            </div>

            {previa ? (
              <div className="grid gap-2 rounded-lg border border-border p-3">
                <h3 className="text-sm font-semibold">Primeiro boleto</h3>
                <p className="text-xs text-muted-foreground">Vence em {data(previa.vencimento)} · cobra de {data(previa.periodo.ini)} a {data(previa.periodo.fim)}{previa.parcial ? ' (período proporcional)' : ''}</p>
                <div className="grid">
                  <Dado rotulo={previa.parcial ? 'Aluguel proporcional' : 'Aluguel'}>{dinheiro(previa.aluguel)}</Dado>
                  {previa.extras.map(x => <Dado key={x.desc} rotulo={x.desc}>{dinheiro(x.valor)}</Dado>)}
                  <Dado rotulo="Total do boleto">{dinheiro(previa.total)}</Dado>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fica com a imobiliária: {previa.taxaRotulo} {dinheiro(previa.taxa)}. O proprietário recebe {dinheiro(previa.recebeProprietario)}.
                  {previa.comissaoLocacao + previa.comissaoCaptacao > 0 && ` Comissões: locação ${dinheiro(previa.comissaoLocacao)} e captação ${dinheiro(previa.comissaoCaptacao)}.`}
                </p>
                {previa.taxaMaiorQueAluguel && (
                  <Aviso tom="atencao" compacto>A taxa de intermediação é maior que o aluguel deste primeiro boleto: o proprietário não recebe nada nele.</Aviso>
                )}
              </div>
            ) : (
              <Aviso tom="atencao" compacto>Faltam dados para calcular o primeiro boleto. Volte ao passo 2.</Aviso>
            )}
          </div>
        )}

        {mostrarErro && erroDoPasso && <Aviso tom="erro" compacto>{erroDoPasso}</Aviso>}

        <DialogFooter>
          <Button variant="outline" onClick={passo === 1 ? aoFechar : () => { setMostrarErro(false); setPasso(p => p - 1); }}>{passo === 1 ? 'Cancelar' : 'Voltar'}</Button>
          {passo < 4
            ? <Button onClick={avancar}>Continuar</Button>
            : <Button disabled={salvando} onClick={() => void salvar()}>Criar contrato</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
