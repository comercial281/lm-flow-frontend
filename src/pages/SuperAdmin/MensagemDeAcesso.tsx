import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import clientInstancesService, {
  type CentralInstance, type MemberAccessConfig,
} from '@/services/clientInstances/clientInstancesService';

// Preenche as variáveis com dados de exemplo pra pré-visualizar a mensagem.
function preview(tpl: string): string {
  const vars: Record<string, string> = {
    nome: 'Bernardo',
    link: 'https://aptopremium.lmflow.com.br',
    email: 'contato@aptopremium.com.br',
  };
  let out = tpl;
  Object.entries(vars).forEach(([k, v]) => {
    out = out.split(`{{${k}}}`).join(v).split(`{${k}}`).join(v);
  });
  return out;
}

/**
 * Usuários → Mensagem de acesso. O texto do WhatsApp que a pessoa recebe quando
 * ganha acesso (link pra criar a senha, válido 24h) e de qual número da Leal
 * Mídia ele sai. Era a janela "Msg de acesso" no topo de Clientes.
 * A variável {senha} saiu da lista: desde a fase 1 a senha é criada pela
 * pessoa, pelo link.
 */
export default function MensagemDeAcesso() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Erro do carregamento inicial: sem config lida, o form não pode aparecer
  // (salvar por cima apagaria a mensagem gravada / religaria o envio).
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(false);
  const [template, setTemplate] = useState('');
  const [instance, setInstance] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [defaultTemplate, setDefaultTemplate] = useState('');
  const [instances, setInstances] = useState<CentralInstance[]>([]);

  const load = useCallback(() => {
    setLoading(true); setLoadError('');
    Promise.all([
      clientInstancesService.getMemberAccessConfig(),
      clientInstancesService.centralInstances().catch(() => ({ data: { data: [] as CentralInstance[] } })),
    ])
      .then(([cfgRes, instRes]) => {
        const cfg: MemberAccessConfig = cfgRes.data.data;
        setTemplate(cfg.template);
        setInstance(cfg.instance);
        setEnabled(cfg.enabled);
        setDefaultTemplate(cfg.default_template);
        setInstances(instRes.data.data ?? []);
      })
      .catch(e => setLoadError(e?.response?.data?.error ?? 'Não consegui carregar a mensagem de acesso.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const r = await clientInstancesService.saveMemberAccessConfig({ template, instance, enabled });
      const cfg = r.data.data;
      setTemplate(cfg.template);
      setInstance(cfg.instance);
      setEnabled(cfg.enabled);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Não consegui salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
        <h2 className="text-xl font-semibold">Mensagem de acesso</h2>
        <p className="text-sm text-destructive">{loadError}</p>
        <Button onClick={load} className="gap-1">Tentar de novo</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
      <h2 className="text-xl font-semibold">Mensagem de acesso</h2>
      <p className="text-sm text-muted-foreground">
        Enviada no WhatsApp da pessoa quando ela ganha acesso ao LM Flow com telefone. Vale para todos os clientes.
        Variáveis:{' '}
        <code className="rounded bg-muted px-1">{'{nome}'}</code>{' '}
        <code className="rounded bg-muted px-1">{'{link}'}</code>{' '}
        <code className="rounded bg-muted px-1">{'{email}'}</code>
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        Envio ligado
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="mensagem-de-acesso" className="text-xs font-medium text-muted-foreground">Mensagem</label>
          <button
            type="button"
            onClick={() => setTemplate(defaultTemplate)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Voltar ao texto padrão
          </button>
        </div>
        <textarea
          id="mensagem-de-acesso"
          value={template}
          onChange={e => setTemplate(e.target.value)}
          rows={9}
          className="w-full rounded border bg-background p-2 font-mono text-sm leading-relaxed"
        />
      </div>

      <div>
        <label htmlFor="numero-remetente" className="mb-1 block text-xs font-medium text-muted-foreground">
          Número de WhatsApp que envia
        </label>
        <select
          id="numero-remetente"
          value={instance}
          onChange={e => setInstance(e.target.value)}
          className="h-9 w-full rounded border bg-background px-2 text-sm"
        >
          {instances.length === 0 && <option value={instance}>{instance || 'Operacional (LM01)'}</option>}
          {instances.map(i => (
            <option key={i.name} value={i.name}>
              {i.name}{i.connected ? '' : ' (desconectado)'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Prévia</p>
        <div className="rounded-lg bg-muted p-3">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-sm shadow-sm">
            {preview(template)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-emerald-600">Salvo.</span>}
        <Button onClick={save} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
