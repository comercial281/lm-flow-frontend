import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, Input } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import BarraSalvar from '@/components/base/BarraSalvar';
import Carregando from '@/components/base/Carregando';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import Chave from '@/components/base/Chave';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { locacaoService } from '@/features/locacao/locacaoService';
import { LEI_MES_VENCIDO, LEMBRETES_DA_REGUA } from '@/features/locacao/textos';
import type { ConfigDaLocacao } from '@/features/locacao/tipos';
import { Falha, Titulo } from './comum';
import { useCarga } from './usoComum';

/** Os números ficam como texto enquanto a pessoa digita (vírgula, campo vazio) e viram número só ao salvar. */
type Rascunho = Record<'multa_pct' | 'juros_mes_pct' | 'taxa_boleto' | 'prazo_repasse_dias_uteis' | 'comissao_locacao_pct' | 'comissao_captacao_pct' | 'taxa_adm_padrao' | 'dias_antes_gerar_boleto', string>
  & Pick<ConfigDaLocacao, 'encargos_para' | 'provedor' | 'asaas_ambiente'>
  & { asaas_api_key: string; asaas_webhook_token: string };

const CAMPOS_NUMERICOS = ['multa_pct', 'juros_mes_pct', 'taxa_boleto', 'prazo_repasse_dias_uteis', 'comissao_locacao_pct', 'comissao_captacao_pct', 'taxa_adm_padrao', 'dias_antes_gerar_boleto'] as const;

const paraTexto = (n: number) => String(n).replace('.', ',');
const paraNumero = (s: string) => Number(s.replace(',', '.'));

function doServidor(c: ConfigDaLocacao): Rascunho {
  return {
    multa_pct: paraTexto(c.multa_pct),
    juros_mes_pct: paraTexto(c.juros_mes_pct),
    taxa_boleto: paraTexto(c.taxa_boleto),
    prazo_repasse_dias_uteis: paraTexto(c.prazo_repasse_dias_uteis),
    comissao_locacao_pct: paraTexto(c.comissao_locacao_pct),
    comissao_captacao_pct: paraTexto(c.comissao_captacao_pct),
    taxa_adm_padrao: paraTexto(c.taxa_adm_padrao),
    dias_antes_gerar_boleto: paraTexto(c.dias_antes_gerar_boleto),
    encargos_para: c.encargos_para,
    provedor: c.provedor,
    asaas_ambiente: c.asaas_ambiente,
    asaas_api_key: '',
    asaas_webhook_token: '',
  };
}

export default function Regras() {
  const { dados, erro, recarregar, setDados } = useCarga(() => locacaoService.config(), 'config');
  const [r, setR] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (dados) setR(doServidor(dados)); }, [dados]);

  if (erro) return <Falha erro={erro} aoTentar={recarregar} />;
  if (!dados || !r) return <Carregando linhas={6} rotulo="Carregando as regras…" />;

  const mudar = (p: Partial<Rascunho>) => setR({ ...r, ...p });
  const original = doServidor(dados);
  const invalido = CAMPOS_NUMERICOS.some(k => r[k].trim() === '' || !Number.isFinite(paraNumero(r[k])) || paraNumero(r[k]) < 0);
  const taxaFora = paraNumero(r.taxa_adm_padrao) < 6 || paraNumero(r.taxa_adm_padrao) > 10;
  const mexeu = JSON.stringify(r) !== JSON.stringify(original);

  const salvar = async () => {
    if (invalido) { toast.error('Confira os números: nenhum campo pode ficar vazio ou negativo.'); return; }
    setSalvando(true);
    try {
      const corpo: Partial<ConfigDaLocacao> = {
        multa_pct: paraNumero(r.multa_pct),
        juros_mes_pct: paraNumero(r.juros_mes_pct),
        taxa_boleto: paraNumero(r.taxa_boleto),
        prazo_repasse_dias_uteis: paraNumero(r.prazo_repasse_dias_uteis),
        comissao_locacao_pct: paraNumero(r.comissao_locacao_pct),
        comissao_captacao_pct: paraNumero(r.comissao_captacao_pct),
        taxa_adm_padrao: paraNumero(r.taxa_adm_padrao),
        dias_antes_gerar_boleto: paraNumero(r.dias_antes_gerar_boleto),
        encargos_para: r.encargos_para,
        provedor: r.provedor,
        asaas_ambiente: r.asaas_ambiente,
      };
      // Só manda a chave se a pessoa digitou uma nova; senão o servidor mantém a que já tem.
      if (r.asaas_api_key.trim()) corpo.asaas_api_key = r.asaas_api_key.trim();
      if (r.asaas_webhook_token.trim()) corpo.asaas_webhook_token = r.asaas_webhook_token.trim();
      setDados(await locacaoService.salvarConfig(corpo));
      toast.success('Regras salvas.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra salvar as regras.'));
    } finally {
      setSalvando(false);
    }
  };

  const num = (id: string, rotulo: string, k: (typeof CAMPOS_NUMERICOS)[number], ajuda?: string, erroDoCampo?: string) => (
    <CampoDaJanela rotulo={rotulo} htmlFor={id} ajuda={ajuda} erro={erroDoCampo}>
      <Input id={id} inputMode="decimal" value={r[k]} onChange={e => mudar({ [k]: e.target.value })} />
    </CampoDaJanela>
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <Titulo>Atraso</Titulo>
        <Card className="gap-4 p-4">
          <GradeDaJanela>
            {num('reg-multa', 'Multa por atraso (%)', 'multa_pct', 'Cobrada uma vez, no dia seguinte ao vencimento.')}
            {num('reg-juros', 'Juros por mês (%)', 'juros_mes_pct', 'Contados por dia de atraso.')}
            <CampoDaJanela rotulo="Quem fica com multa e juros" colunas={2}>
              <BotoesDeEscolha
                rotulo="Quem fica com multa e juros"
                valor={r.encargos_para}
                opcoes={[{ valor: 'prop', rotulo: 'Proprietário' }, { valor: 'imob', rotulo: 'Imobiliária' }]}
                aoEscolher={v => mudar({ encargos_para: v })}
              />
            </CampoDaJanela>
          </GradeDaJanela>
        </Card>
      </section>

      <section className="grid gap-3">
        <Titulo>Pagamentos</Titulo>
        <Card className="gap-4 p-4">
          <GradeDaJanela>
            {num('reg-boleto', 'Taxa por boleto (R$)', 'taxa_boleto', 'Descontada do proprietário a cada aluguel pago.')}
            {num('reg-repasse', 'Prazo do repasse (dias úteis)', 'prazo_repasse_dias_uteis', 'Contados a partir do pagamento do inquilino.')}
            {num('reg-antes', 'Gerar o boleto quantos dias antes', 'dias_antes_gerar_boleto')}
            {num('reg-adm', 'Taxa de administração padrão (%)', 'taxa_adm_padrao', 'Usada nos contratos novos. Pode mudar em cada contrato.', taxaFora ? 'Costuma ficar entre 6% e 10%.' : undefined)}
            {num('reg-com-loc', 'Comissão de locação (%)', 'comissao_locacao_pct', 'Sobre a intermediação do 1º aluguel.')}
            {num('reg-com-cap', 'Comissão de captação (%)', 'comissao_captacao_pct', 'Sobre a intermediação do 1º aluguel.')}
          </GradeDaJanela>
          <Aviso tom="neutro" compacto>{LEI_MES_VENCIDO}</Aviso>
        </Card>
      </section>

      <section className="grid gap-3">
        <Titulo>Como o boleto é emitido</Titulo>
        <Card className="gap-4 p-4">
          <BotoesDeEscolha
            rotulo="Emissão do boleto"
            valor={r.provedor}
            opcoes={[{ valor: 'manual', rotulo: 'Registrar à mão' }, { valor: 'asaas', rotulo: 'Pelo Asaas' }]}
            aoEscolher={v => mudar({ provedor: v })}
          />
          {r.provedor === 'asaas' && (
            <GradeDaJanela>
              <CampoDaJanela rotulo="Ambiente" colunas={2}>
                <BotoesDeEscolha
                  rotulo="Ambiente do Asaas"
                  valor={r.asaas_ambiente}
                  opcoes={[{ valor: 'sandbox', rotulo: 'Teste' }, { valor: 'producao', rotulo: 'Valendo' }]}
                  aoEscolher={v => mudar({ asaas_ambiente: v })}
                />
              </CampoDaJanela>
              <CampoDaJanela rotulo="Chave de acesso do Asaas" htmlFor="reg-asaas-chave" colunas={2} ajuda={dados.asaas_api_key ? 'Já tem uma chave guardada. Só digite se quiser trocar.' : undefined}>
                <Input id="reg-asaas-chave" type="password" autoComplete="off" value={r.asaas_api_key} onChange={e => mudar({ asaas_api_key: e.target.value })} />
              </CampoDaJanela>
              <CampoDaJanela rotulo="Código de segurança do aviso do banco" htmlFor="reg-asaas-codigo" colunas={4} ajuda={dados.asaas_webhook_token ? 'Já tem um código guardado. Só digite se quiser trocar.' : 'O mesmo código que você cadastrar no Asaas para avisar os pagamentos.'}>
                <Input id="reg-asaas-codigo" type="password" autoComplete="off" value={r.asaas_webhook_token} onChange={e => mudar({ asaas_webhook_token: e.target.value })} />
              </CampoDaJanela>
            </GradeDaJanela>
          )}
          <Chave
            rotulo="Mandar lembretes no WhatsApp"
            descricao="Avisos de boleto e de atraso saem sozinhos pelo WhatsApp da conta."
            ligada={dados.whatsapp_ativo}
            aoMudar={async proximo => {
              setDados(await locacaoService.salvarConfig({ whatsapp_ativo: proximo }));
            }}
          />
        </Card>
      </section>

      <section className="grid gap-3">
        <Titulo>Régua de lembretes</Titulo>
        <Card className="gap-0 divide-y divide-border/60 p-1">
          {LEMBRETES_DA_REGUA.map(l => (
            <div key={l.quando} className="flex gap-4 px-3 py-2.5 text-sm">
              <span className="w-28 shrink-0 font-medium">{l.quando}</span>
              <span className="text-muted-foreground">{l.texto}</span>
            </div>
          ))}
        </Card>
      </section>

      <BarraSalvar visivel={mexeu} salvando={salvando} aoSalvar={() => void salvar()} aoDescartar={() => setR(original)} />
    </div>
  );
}
