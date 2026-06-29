import { useState, useEffect } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@evoapi/design-system/card';
import { Button } from '@evoapi/design-system/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system/select';
import { Save, Shuffle, User, Wifi } from 'lucide-react';
import apiAuth from '@/services/core/apiAuth';

interface InboxConfig {
  id: number;
  name: string;
  auto_assignment_config?: {
    distribution_mode?: string;
    return_rule?: string;
  };
}

const DISTRIBUTION_OPTIONS = [
  { value: 'roleta', label: 'Roleta (round-robin automático)', icon: Shuffle, desc: 'Distribui leads em ordem entre os corretores da roleta' },
  { value: 'manual', label: 'Manual (gerente atribui)', icon: User, desc: 'Leads chegam sem dono — gerente distribui manualmente' },
  { value: 'availability', label: 'Por disponibilidade', icon: Wifi, desc: 'Atribui ao corretor online com menos conversas abertas' },
];

const RETURN_OPTIONS = [
  { value: 'same_agent', label: 'Mesmo corretor sempre' },
  { value: 'first_available', label: 'Primeiro disponível' },
  { value: 'by_status', label: 'Depende do status (reabre → redistribui)' },
];

export default function AssignmentSettings() {
  const [inboxes, setInboxes] = useState<InboxConfig[]>([]);
  const [selected, setSelected] = useState<InboxConfig | null>(null);
  const [distribution, setDistribution] = useState('roleta');
  const [returnRule, setReturnRule] = useState('same_agent');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiAuth.get('/inboxes').then(res => {
      const data = (res as any)?.data?.payload ?? (res as any)?.payload ?? [];
      setInboxes(data);
      if (data.length > 0) {
        const first = data[0];
        setSelected(first);
        setDistribution(first.auto_assignment_config?.distribution_mode ?? 'roleta');
        setReturnRule(first.auto_assignment_config?.return_rule ?? 'same_agent');
      }
    }).catch(() => toast.error('Erro ao carregar inboxes'));
  }, []);

  const handleSelectInbox = (id: string) => {
    const inbox = inboxes.find(i => String(i.id) === id);
    if (!inbox) return;
    setSelected(inbox);
    setDistribution(inbox.auto_assignment_config?.distribution_mode ?? 'roleta');
    setReturnRule(inbox.auto_assignment_config?.return_rule ?? 'same_agent');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiAuth.patch(`/inboxes/${selected.id}`, {
        channel: {},
        auto_assignment_config: { distribution_mode: distribution, return_rule: returnRule },
      });
      setInboxes(prev => prev.map(i => i.id === selected.id
        ? { ...i, auto_assignment_config: { distribution_mode: distribution, return_rule: returnRule } }
        : i
      ));
      toast.success('Configuração salva!');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Distribuição de Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure como os leads são distribuídos entre os corretores</p>
      </div>

      {inboxes.length > 1 && (
        <div>
          <label className="text-sm font-medium mb-1 block">Canal (inbox)</label>
          <Select value={selected ? String(selected.id) : ''} onValueChange={handleSelectInbox}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecionar canal" />
            </SelectTrigger>
            <SelectContent>
              {inboxes.map(i => (
                <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Modo de distribuição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {DISTRIBUTION_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setDistribution(opt.value)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                distribution === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}>
              <opt.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${distribution === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quando o lead retorna</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={returnRule} onValueChange={setReturnRule}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RETURN_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">Define o que acontece quando um lead que já tinha corretor recontata</p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !selected} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? 'Salvando...' : 'Salvar configuração'}
      </Button>
    </div>
  );
}
