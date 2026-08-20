import { useState, useEffect } from 'react';
import { Loader2, MessageCircle, RotateCcw, Save } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/ds';
import clientInstancesService, {
  CentralInstance, MemberAccessConfig,
} from '@/services/clientInstances/clientInstancesService';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Preenche as variaveis com dados de exemplo pra pre-visualizar a mensagem.
function preview(tpl: string): string {
  const vars: Record<string, string> = {
    nome:  'Bernardo',
    link:  'https://aptopremium.lmflow.com.br',
    email: 'contato@aptopremium.com.br',
    senha: 'aX7$k2mQp9',
  };
  let out = tpl;
  Object.entries(vars).forEach(([k, v]) => {
    out = out.split(`{{${k}}}`).join(v).split(`{${k}}`).join(v);
  });
  return out;
}

export default function MemberAccessConfigModal({ open, onClose }: Props) {
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);

  const [template, setTemplate] = useState('');
  const [instance, setInstance] = useState('');
  const [enabled, setEnabled]   = useState(true);
  const [defaultTemplate, setDefaultTemplate] = useState('');
  const [instances, setInstances] = useState<CentralInstance[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true); setError(''); setSaved(false);
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
      .catch(e => setError(e?.response?.data?.error ?? 'Erro ao carregar config'))
      .finally(() => setLoading(false));
  }, [open]);

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
      setError(e?.response?.data?.error ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Mensagem de acesso (WhatsApp)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Texto padrão enviado no WhatsApp do cliente quando você cria um acesso com telefone.
                Vale para todos os clientes. Variáveis:{' '}
                <code className="bg-muted px-1 rounded">{'{nome}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{link}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{email}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{senha}'}</code>
              </p>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                Envio ativado
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
                  <button
                    onClick={() => setTemplate(defaultTemplate)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    title="Restaurar texto padrão"
                  >
                    <RotateCcw className="h-3 w-3" /> Restaurar padrão
                  </button>
                </div>
                <textarea
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  rows={9}
                  className="w-full text-sm border rounded p-2 bg-background font-mono leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Instância remetente padrão</label>
                <select
                  value={instance}
                  onChange={e => setInstance(e.target.value)}
                  className="h-9 text-sm border rounded px-2 bg-background w-full"
                >
                  {instances.length === 0 && <option value={instance}>{instance || 'Operacional (LM01)'}</option>}
                  {instances.map(i => (
                    <option key={i.name} value={i.name}>
                      {i.name}{i.connected ? '' : ' (desconectada)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Prévia</label>
                <div className="rounded-lg bg-[#e5ddd5] dark:bg-muted p-3">
                  <div className="max-w-[85%] rounded-lg bg-[#dcf8c6] dark:bg-emerald-900/30 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap shadow-sm">
                    {preview(template)}
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t shrink-0">
          {saved && <span className="text-xs text-emerald-600 mr-auto self-center">Salvo!</span>}
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={saving || loading} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
