import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';
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
  /** Ausente no servidor antigo: o card abre com os padrões. */
  settings?: PortalSettings | null;
  onSaved?: () => void;
}

const ENDERECOS: Array<{ value: PortalDisplayAddress; label: string; hint: string }> = [
  { value: 'neighborhood', label: 'Só o bairro', hint: 'O anúncio mostra bairro e cidade.' },
  { value: 'street', label: 'Rua, sem número', hint: 'Mostra a rua, sem o número do imóvel.' },
  { value: 'all', label: 'Endereço completo', hint: 'Rua e número, como está no cadastro.' },
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
 * A tela *Configurar* do portal, no modelo do Kenlo: dados do anunciante,
 * endereço no anúncio, leads e destino do lead — tudo gravado num *Salvar
 * configuração* só (uma requisição, `PUT /portals/:key/settings`).
 *
 * Os seletores de destino são leitura de fundo: cargo sem acesso a funis,
 * roletas ou usuários só não vê aquele seletor — nada de aviso vermelho. E o
 * que a pessoa não pôde ver não viaja no salvar: o PUT é parcial, então o que
 * está gravado ali fica como está.
 */
export default function PortalSettingsCard({ portalKey, settings, onSaved }: Props) {
  const [form, setForm] = useState<Form>(() => formDe(settings));
  const [saving, setSaving] = useState(false);

  // O servidor é a fonte: depois do salvar (e de qualquer recarga) o card volta
  // a mostrar o que ficou gravado.
  useEffect(() => { setForm(formDe(settings)); }, [settings]);

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
    <div className="rounded-xl border bg-card p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-sm">Configurar</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Como a imobiliária aparece no portal, o que sai no anúncio e o que acontece com o lead
          que chega de lá.
        </p>
      </div>

      {/* Dados do anunciante */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Dados do anunciante</h3>
          <p className="text-xs text-muted-foreground">
            O portal exige nome e e-mail para importar os anúncios.
          </p>
        </div>
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
      </section>

      {/* Endereço no anúncio */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Endereço no anúncio</h3>
          <p className="text-xs text-muted-foreground">
            O quanto do endereço do imóvel o portal mostra para quem vê o anúncio.
          </p>
        </div>
        <div role="radiogroup" aria-label="Endereço no anúncio" className="grid gap-2 sm:grid-cols-3">
          {ENDERECOS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer ${
                form.display_address === opt.value ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name={id('display_address')}
                value={opt.value}
                checked={form.display_address === opt.value}
                onChange={() => set('display_address', opt.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Leads */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Leads</h3>
          <p className="text-xs text-muted-foreground">
            O portal manda o lead para a URL de recebimento acima. Aqui você decide se ele vira contato.
          </p>
        </div>
        <div role="radiogroup" aria-label="Receber leads automaticamente" className="space-y-2">
          <p className="text-sm font-medium">Receber leads automaticamente</p>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={id('leads_enabled')}
                checked={form.leads_enabled}
                onChange={() => set('leads_enabled', true)}
              />
              Sim
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={id('leads_enabled')}
                checked={!form.leads_enabled}
                onChange={() => set('leads_enabled', false)}
              />
              Não
            </label>
          </div>
          {!form.leads_enabled && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Desligado, o lead que o portal mandar fica guardado e não vira contato.
            </p>
          )}
        </div>
      </section>

      {/* Destino do lead */}
      {temDestino && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Destino do lead</h3>
            <p className="text-xs text-muted-foreground">
              Para onde vai o lead que chega deste portal. Em branco, ele entra como sempre entrou:
              no funil padrão, sem responsável.
              {locacao && ' O imóvel do anúncio decide se o lead é de Venda ou de Locação; imóvel de Venda + Locação segue o que o portal informar, e sem informação vai para Venda.'}
            </p>
          </div>
          <SaleRentDestination
            sale={form.sale}
            rent={form.rent}
            rentSameAsSale={form.rent_same_as_sale}
            onSale={patch => setForm(prev => ({ ...prev, sale: { ...prev.sale, ...patch } }))}
            onRent={patch => setForm(prev => ({ ...prev, rent: { ...prev.rent, ...patch } }))}
            onRentSameAsSale={v => set('rent_same_as_sale', v)}
            options={options}
            showRent={locacao}
          />
        </section>
      )}

      <div className="flex justify-end">
        <Button className="text-xs" onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>
    </div>
  );
}
