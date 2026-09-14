import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';
import { NativeSelect } from '@/components/ui/native-select';
import {
  portalsService,
  type PortalDisplayAddress,
  type PortalSettings,
} from '@/services/portals/portalsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { roletaConfigService, roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { usersService } from '@/services/users';
import type { User } from '@/types/users';
import { extractError } from '@/utils/apiHelpers';

interface Props {
  portalKey: string;
  /** Ausente no servidor antigo: o card abre com os padrões. */
  settings?: PortalSettings | null;
  onSaved?: () => void;
}

interface Opt {
  id: string;
  label: string;
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
  pipeline_id: string;
  stage_id: string;
  roleta_config_id: string;
  default_assignee_id: string;
}

const formDe = (s: PortalSettings | null | undefined): Form => ({
  provider_name: texto(s?.provider_name),
  contact_email: texto(s?.contact_email),
  contact_name: texto(s?.contact_name),
  display_address: s?.display_address ?? 'neighborhood',
  // Ausente = ligado: é o comportamento de sempre do webhook.
  leads_enabled: s?.leads_enabled !== false,
  pipeline_id: texto(s?.pipeline_id),
  stage_id: texto(s?.stage_id),
  roleta_config_id: texto(s?.roleta_config_id),
  default_assignee_id: texto(s?.default_assignee_id),
});

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

  const [pipelines, setPipelines] = useState<Opt[] | null>(null);
  const [stages, setStages] = useState<Opt[]>([]);
  const [roletas, setRoletas] = useState<RoletaConfig[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);

  // O servidor é a fonte: depois do salvar (e de qualquer recarga) o card volta
  // a mostrar o que ficou gravado.
  useEffect(() => { setForm(formDe(settings)); }, [settings]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const carregarColunas = async (pipelineId: string): Promise<Opt[]> => {
    try {
      const res = await pipelinesService.getPipelineStages(pipelineId);
      return ((res?.data ?? []) as Array<{ id: string; name: string }>).map(s => ({ id: s.id, label: s.name }));
    } catch {
      return [];
    }
  };

  useEffect(() => {
    let ativo = true;
    (async () => {
      // Três leituras de fundo, independentes: a que falhar (cargo sem acesso)
      // só esconde o próprio seletor. `allSettled` para uma recusa não derrubar
      // as outras duas.
      const [pRes, rRes, uRes] = await Promise.allSettled([
        pipelinesService.getPipelines(),
        roletaConfigService.getAll(),
        usersService.getUsers({ per_page: 100 }),
      ]);
      if (!ativo) return;

      if (pRes.status === 'fulfilled') {
        const lista = (pRes.value?.data ?? []) as Array<{ id: string; name: string }>;
        setPipelines(lista.map(p => ({ id: p.id, label: p.name })));
        const inicial = settings?.pipeline_id;
        if (inicial) {
          const cols = await carregarColunas(inicial);
          if (ativo) setStages(cols);
        }
      }
      if (rRes.status === 'fulfilled') setRoletas(rRes.value ?? []);
      if (uRes.status === 'fulfilled') {
        setUsers((uRes.value?.data ?? []).filter(u => !u.deactivated));
      }
    })();
    return () => { ativo = false; };
    // Só na montagem: o funil gravado inicial é o que decide as colunas iniciais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trocar o funil LIMPA a coluna: a coluna é de outro funil, e o servidor a
  // recusaria — a pessoa veria a escolha guardada e o lead caindo em outro lugar.
  const onPipeline = async (pipelineId: string) => {
    setForm(prev => ({ ...prev, pipeline_id: pipelineId, stage_id: '' }));
    setStages([]);
    if (pipelineId) setStages(await carregarColunas(pipelineId));
  };

  // Funil gravado que não existe mais (apagado depois da configuração): o
  // seletor mostra a escolha em vez de ficar em branco com o id preso por baixo
  // — senão salvar qualquer outro campo devolvia "Funil não encontrado" sem a
  // tela apontar de onde vinha. Quem escolhe outro funil (ou o padrão) limpa.
  const pipelineOptions = useMemo<Opt[]>(() => {
    if (!pipelines) return [];
    if (form.pipeline_id && !pipelines.some(p => p.id === form.pipeline_id)) {
      return [...pipelines, { id: form.pipeline_id, label: 'Funil escolhido (não existe mais)' }];
    }
    return pipelines;
  }, [pipelines, form.pipeline_id]);

  // A roleta já escolhida continua na lista mesmo desativada: sem ela o campo
  // abriria em "não distribuir" e salvar trocaria a escolha do gestor sem ele ver.
  const roletaOptions = useMemo<Opt[]>(() => {
    if (!roletas) return [];
    const opts = roletas.filter(r => r.is_active).map(r => ({ id: r.id, label: roletaLabel(r) }));
    if (form.roleta_config_id && !opts.some(o => o.id === form.roleta_config_id)) {
      opts.push({ id: form.roleta_config_id, label: 'Roleta escolhida (desativada)' });
    }
    return opts;
  }, [roletas, form.roleta_config_id]);
  const roletaDesativada =
    !!form.roleta_config_id && !!roletas && !roletas.some(r => r.id === form.roleta_config_id && r.is_active);

  const userOptions = useMemo<Opt[]>(() => {
    if (!users) return [];
    const opts = users.map(u => ({ id: u.id, label: u.name }));
    if (form.default_assignee_id && !opts.some(o => o.id === form.default_assignee_id)) {
      opts.push({ id: form.default_assignee_id, label: 'Responsável escolhido (fora da lista)' });
    }
    return opts;
  }, [users, form.default_assignee_id]);

  const temDestino = pipelines !== null || roletas !== null || users !== null;

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
    if (pipelines !== null) {
      partial.pipeline_id = form.pipeline_id || null;
      partial.stage_id = form.pipeline_id ? form.stage_id || null : null;
    }
    if (roletas !== null) partial.roleta_config_id = form.roleta_config_id || null;
    if (users !== null) partial.default_assignee_id = form.default_assignee_id || null;

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
            O portal manda o lead para a URL de webhook acima. Aqui você decide se ele vira contato.
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
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pipelines !== null && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Funil</span>
                  <NativeSelect
                    aria-label="Funil"
                    value={form.pipeline_id}
                    onChange={e => { void onPipeline(e.target.value); }}
                  >
                    <option value="">Funil padrão do CRM</option>
                    {pipelineOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </NativeSelect>
                </label>
                {form.pipeline_id && (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Coluna</span>
                    <NativeSelect
                      aria-label="Coluna"
                      value={form.stage_id}
                      onChange={e => set('stage_id', e.target.value)}
                    >
                      <option value="">Primeira coluna do funil</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </NativeSelect>
                  </label>
                )}
              </>
            )}
            {roletas !== null && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Roleta</span>
                <NativeSelect
                  aria-label="Roleta"
                  value={form.roleta_config_id}
                  onChange={e => set('roleta_config_id', e.target.value)}
                >
                  <option value="">Não distribuir (entra sem responsável)</option>
                  {roletaOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </NativeSelect>
                {roletaDesativada && (
                  <span className="block text-[11px] text-amber-600">
                    Esta roleta está desativada: enquanto ela não for religada, o lead continua
                    entrando sem responsável.
                  </span>
                )}
              </label>
            )}
            {users !== null && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Responsável</span>
                <NativeSelect
                  aria-label="Responsável"
                  value={form.default_assignee_id}
                  onChange={e => set('default_assignee_id', e.target.value)}
                >
                  <option value="">Ninguém</option>
                  {userOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </NativeSelect>
                {form.roleta_config_id && form.default_assignee_id && (
                  <span className="block text-[11px] text-muted-foreground">
                    Com responsável escolhido, o lead vai direto para ele — a roleta não sorteia.
                  </span>
                )}
              </label>
            )}
          </div>
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
