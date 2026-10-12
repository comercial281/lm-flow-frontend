import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BarraSalvar from '@/components/base/BarraSalvar';
import Aviso from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import { mesmoConteudo, useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import {
  portalsService,
  type PortalDisplayAddress,
  type PortalSettings,
} from '@/services/portals/portalsService';
import { extractError } from '@/utils/apiHelpers';
import { useLeadDestinationOptions } from '@/components/pipelines/useLeadDestinationOptions';
import { hasAnyDestinationOption, type LeadDestinationValue } from '@/components/pipelines/LeadDestinationFields';
import SaleRentDestination from '@/components/pipelines/SaleRentDestination';

interface Props {
  portalKey: string;
  /** Ausente no servidor antigo: a aba abre com os padrões. */
  settings?: PortalSettings | null;
  onSaved?: () => void;
}

const ENDERECOS: Array<{ valor: PortalDisplayAddress; rotulo: string; descricao: string }> = [
  { valor: 'neighborhood', rotulo: 'Só o bairro', descricao: 'O anúncio mostra bairro e cidade.' },
  { valor: 'street', rotulo: 'Rua, sem número', descricao: 'Mostra a rua, sem o número do imóvel.' },
  { valor: 'all', rotulo: 'Endereço completo', descricao: 'Rua e número, como está no cadastro.' },
];

const RECEBER_LEADS = [
  { valor: 'sim' as const, rotulo: 'Sim' },
  { valor: 'nao' as const, rotulo: 'Não' },
];

const texto = (v: string | null | undefined) => v ?? '';
/** Campo de texto vazio vira nulo — "apagou" é "sem valor", não string em branco. */
const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim());

interface Form {
  provider_name: string;
  contact_email: string;
  contact_name: string;
  display_address: PortalDisplayAddress;
  leads_enabled: boolean;
  sale: LeadDestinationValue;
  rent: LeadDestinationValue;
  rent_same_as_sale: boolean;
}

const destinoDe = (
  pipeline?: string | null, stage?: string | null, roleta?: string | null, assignee?: string | null,
): LeadDestinationValue => ({
  pipeline_id: texto(pipeline), stage_id: texto(stage), roleta_config_id: texto(roleta),
  default_assignee_id: texto(assignee), label_id: '',
});

const formDe = (s: PortalSettings | null | undefined): Form => ({
  provider_name: texto(s?.provider_name),
  contact_email: texto(s?.contact_email),
  contact_name: texto(s?.contact_name),
  display_address: s?.display_address ?? 'neighborhood',
  // Ausente = ligado: é o comportamento de sempre do webhook.
  leads_enabled: s?.leads_enabled !== false,
  sale: destinoDe(s?.pipeline_id, s?.stage_id, s?.roleta_config_id, s?.default_assignee_id),
  rent: destinoDe(s?.rent_pipeline_id, s?.rent_stage_id, s?.rent_roleta_config_id, s?.rent_default_assignee_id),
  // Ausente = mesmo destino: é para onde a locação sempre foi.
  rent_same_as_sale: s?.rent_same_as_sale !== false,
});

/** O servidor novo sempre manda a chave; o antigo não conhece locação. */
const conheceLocacao = (s: PortalSettings | null | undefined) => typeof s?.rent_same_as_sale === 'boolean';

/**
 * A aba *Configurar* do portal, no modelo do Kenlo: dados do anunciante,
 * endereço no anúncio, leads e destino do lead — tudo gravado num *Salvar*
 * só (uma requisição, `PUT /portals/:key/settings`), pela BarraSalvar.
 *
 * Venda e Locação são duas seções (o `SaleRentDestination`, o mesmo bloco do
 * site), não abas: a página do portal já tem abas e a regra é um nível só.
 *
 * Os seletores de destino são leitura de fundo: cargo sem acesso a funis,
 * roletas ou usuários só não vê aquele seletor — nada de aviso vermelho. E o
 * que a pessoa não pôde ver não viaja no salvar: o PUT é parcial, então o que
 * está gravado ali fica como está.
 */
export default function PortalSettingsCard({ portalKey, settings, onSaved }: Props) {
  const gravado = useMemo(() => formDe(settings), [settings]);
  const [form, setForm] = useState<Form>(gravado);
  const [saving, setSaving] = useState(false);

  // O servidor é a fonte: depois do salvar (e de qualquer recarga) a aba volta
  // a mostrar o que ficou gravado.
  useEffect(() => { setForm(gravado); }, [gravado]);

  const temAlteracao = !mesmoConteudo(form, gravado);
  useAlteracoesNaoSalvas(temAlteracao);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const options = useLeadDestinationOptions();
  const temDestino = hasAnyDestinationOption(options);
  const locacao = conheceLocacao(settings);

  const save = async () => {
    const partial: Partial<PortalSettings> = {
      provider_name: ouNulo(form.provider_name),
      contact_email: ouNulo(form.contact_email),
      contact_name: ouNulo(form.contact_name),
      display_address: form.display_address,
      leads_enabled: form.leads_enabled,
    };
    // Só viaja o que a pessoa pôde ver. Seletor escondido por recusa de cargo
    // não pode apagar, calado, o que está gravado.
    const destino = (v: LeadDestinationValue, prefixo: '' | 'rent_') => {
      const out: Record<string, string | null> = {};
      if (options.pipelines !== null) {
        out[`${prefixo}pipeline_id`] = v.pipeline_id || null;
        out[`${prefixo}stage_id`] = v.pipeline_id ? v.stage_id || null : null;
      }
      if (options.roletas !== null) out[`${prefixo}roleta_config_id`] = v.roleta_config_id || null;
      if (options.users !== null) out[`${prefixo}default_assignee_id`] = v.default_assignee_id || null;
      return out;
    };
    Object.assign(partial, destino(form.sale, ''));
    if (locacao) {
      partial.rent_same_as_sale = form.rent_same_as_sale;
      if (!form.rent_same_as_sale) Object.assign(partial, destino(form.rent, 'rent_'));
    }

    setSaving(true);
    try {
      await portalsService.updateSettings(portalKey, partial);
      toast.success('Configuração salva');
      onSaved?.();
    } catch (err) {
      toast.error(extractError(err).message || 'Erro ao salvar a configuração');
    } finally {
      setSaving(false);
    }
  };

  const id = (campo: string) => `portal-cfg-${portalKey}-${campo}`;

  return (
    <>
      <Secoes>
        <Secao titulo="Dados do anunciante" descricao="O portal exige nome e e-mail para importar os anúncios.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor={id('provider_name')} className="text-sm font-medium">
                Nome da imobiliária no portal
              </label>
              <Input
                id={id('provider_name')}
                value={form.provider_name}
                onChange={e => set('provider_name', e.target.value)}
                placeholder="Como o anunciante aparece nos anúncios"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={id('contact_email')} className="text-sm font-medium">E-mail de contato</label>
              <Input
                id={id('contact_email')}
                type="email"
                value={form.contact_email}
                onChange={e => set('contact_email', e.target.value)}
                placeholder="contato@imobiliaria.com.br"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={id('contact_name')} className="text-sm font-medium">Nome do contato</label>
              <Input
                id={id('contact_name')}
                value={form.contact_name}
                onChange={e => set('contact_name', e.target.value)}
                placeholder="Quem responde pelo anúncio"
              />
            </div>
          </div>
        </Secao>

        <Secao titulo="Endereço no anúncio" descricao="O quanto do endereço do imóvel o portal mostra para quem vê o anúncio.">
          <CartoesDeEscolha
            rotulo="Endereço no anúncio"
            valor={form.display_address}
            opcoes={ENDERECOS}
            aoEscolher={v => set('display_address', v)}
            colunas={3}
          />
        </Secao>

        <Secao
          titulo="Leads"
          descricao="O portal manda o lead para o endereço de recebimento (aba Conexão). Aqui você decide se ele vira contato."
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">Receber leads automaticamente</p>
            <BotoesDeEscolha
              rotulo="Receber leads automaticamente"
              valor={form.leads_enabled ? 'sim' : 'nao'}
              opcoes={RECEBER_LEADS}
              aoEscolher={v => set('leads_enabled', v === 'sim')}
            />
          </div>
          {!form.leads_enabled && (
            <Aviso tom="atencao" compacto>
              Desligado, o lead que o portal mandar fica guardado e não vira contato.
            </Aviso>
          )}
        </Secao>

        {temDestino && (
          <SaleRentDestination
            sale={form.sale}
            rent={form.rent}
            rentSameAsSale={form.rent_same_as_sale}
            onSale={patch => setForm(prev => ({ ...prev, sale: { ...prev.sale, ...patch } }))}
            onRent={patch => setForm(prev => ({ ...prev, rent: { ...prev.rent, ...patch } }))}
            onRentSameAsSale={v => set('rent_same_as_sale', v)}
            options={options}
            showRent={locacao}
            titulos={{ unico: 'Destino do lead', venda: 'Destino do lead de venda', locacao: 'Destino do lead de locação' }}
            descricoes={{
              unico: 'Para onde vai o lead que chega deste portal. Em branco, ele entra como sempre entrou: no funil padrão, sem responsável.',
              venda: 'Para onde vai o lead de imóvel à venda. Em branco, ele entra como sempre entrou: no funil padrão, sem responsável. Imóvel de Venda + Locação segue o que o portal informar; sem informação, vai para venda.',
              locacao: 'Para onde vai o lead de imóvel para alugar.',
            }}
          />
        )}
      </Secoes>
      <BarraSalvar visivel={temAlteracao} salvando={saving} aoSalvar={save} aoDescartar={() => setForm(gravado)} />
    </>
  );
}
