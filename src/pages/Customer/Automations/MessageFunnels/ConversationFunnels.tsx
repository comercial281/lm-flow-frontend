import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Plus, Rocket, Search, Trash2, Users } from 'lucide-react';
import { Badge, Button, Input } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import IconActionButton from '@/components/base/IconActionButton';
import NoAccessState from '@/components/permissions/NoAccessState';
import { FunnelTemplatePicker } from '@/components/flowAutomations/FunnelTemplatePicker';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { isForbiddenError } from '@/services/core/forbidden';
import type { FlowAutomation } from '@/types/flowAutomations';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';
import { serverMessage } from '@/features/flowAutomations/guide';
import { useCan } from '@/hooks/useCan';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { cn } from '@/lib/utils';

// FUNIS DE MENSAGEM (Automações · sprint 4, parte B, spec 04/10/2026).
//
// O funil é ferramenta INDIVIDUAL do corretor: uma sequência de mensagens que
// ele dispara numa conversa. Cada funil é um fluxo do construtor (`kind =
// conversation`) com gatilho fixo. A página não tem abas internas (Variáveis
// e Atributos saíram): é a lista, separada em "Meus funis" e "Da equipe".
//
// - O corretor cria SÓ a partir de modelo ("+ Novo funil"); o gestor (quem tem
//   acesso às Automações) também começa do zero.
// - "Da equipe": todo mundo vê e dispara, só o gestor edita e marca.
// - O que cada um pode fazer vem do servidor em `permissions` (o servidor
//   também garante); a tela só esconde o que ele recusaria.

const COPY = FLOW_KIND_COPY.conversation;

type Aba = 'meus' | 'equipe';

function statusOf(f: FlowAutomation): { text: string; tone: 'amber' | 'green' | 'muted' } {
  const pending = f.guide_pending ?? [];
  if (pending.length > 0) {
    const first = pending[0];
    return { text: `Termine de montar: passo ${first.step} de ${first.total}`, tone: 'amber' };
  }
  if (f.is_enabled) return { text: 'Pronto pra disparar', tone: 'green' };
  return { text: 'Desligado: não aparece pra disparar', tone: 'muted' };
}

export default function ConversationFunnels() {
  const navigate = useNavigate();
  const pode = useCan();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [funnels, setFunnels] = useState<FlowAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const [search, setSearch] = useState('');
  const [aba, setAba] = useState<Aba>('meus');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Gestor = quem tem acesso às Automações (mesma régua do servidor). Com algum
  // funil na lista, o `permissions` do servidor manda.
  const isManager = pode('flow_automations', 'update');
  const canCreateBlank = funnels.length > 0 ? funnels.some(f => f.permissions?.can_create_blank) : isManager;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFunnels(await flowAutomationsService.list({ kind: 'conversation' }));
      setFailed(false);
      setRecusado(false);
    } catch (e) {
      if (isForbiddenError(e)) setRecusado(true);
      else setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (f: Pick<FlowAutomation, 'id'>) => navigate(`${COPY.listPath}/${f.id}`);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return funnels.filter(f => !f.archived_at && (!term || f.name.toLowerCase().includes(term)));
  }, [funnels, search]);
  const mine = visible.filter(f => !f.team);
  const team = visible.filter(f => f.team);
  const shown = aba === 'meus' ? mine : team;

  const toggle = async (f: FlowAutomation): Promise<boolean> => {
    const pending = f.guide_pending?.[0];
    if (!f.is_enabled && pending) {
      toast.error(`Falta terminar o guia antes de ligar: Passo ${pending.step} de ${pending.total} — ${pending.title}.`);
      return false;
    }
    try {
      const updated = await flowAutomationsService.toggle(f.id);
      setFunnels(list => list.map(x => (x.id === f.id ? { ...x, is_enabled: updated.is_enabled } : x)));
      return true;
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra ligar agora. Tente de novo.'));
      return false;
    }
  };

  const markTeam = async (f: FlowAutomation, next: boolean): Promise<boolean> => {
    try {
      await flowAutomationsService.update(f.id, { team: next });
      setFunnels(list => list.map(x => (x.id === f.id ? { ...x, team: next } : x)));
      toast.success(next ? `"${f.name}" agora é da equipe: todo mundo vê e dispara.` : `"${f.name}" voltou a ser só do dono.`);
      return true;
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra mudar agora. Tente de novo.'));
      return false;
    }
  };

  const duplicate = async (f: FlowAutomation) => {
    try {
      const copy = await flowAutomationsService.duplicate(f.id);
      toast.success('Funil duplicado: a cópia é sua.');
      open(copy);
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra duplicar agora. Tente de novo.'));
    }
  };

  const destroy = async (f: FlowAutomation) => {
    if (!(await confirmar({
      titulo: 'Excluir funil',
      descricao: <>Excluir <strong>{f.name}</strong>? Essa ação não pode ser desfeita.</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await flowAutomationsService.destroy(f.id);
      setFunnels(list => list.filter(x => x.id !== f.id));
      toast.success('Funil excluído');
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra excluir agora. Tente de novo.'));
    }
  };

  if (recusado) return <NoAccessState />;

  return (
    <div className="h-full flex flex-col p-4 min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-bold">{COPY.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4 max-w-3xl">{COPY.description}</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-8" placeholder={COPY.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar funil" />
        </div>
        <Button onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> {COPY.newButton}
        </Button>
      </div>

      <Abas
        rotulo="Funis"
        ativa={aba}
        aoTrocar={chave => setAba(chave as Aba)}
        abas={[
          { chave: 'meus', rotulo: `Meus funis (${mine.length})` },
          { chave: 'equipe', rotulo: `Da equipe (${team.length})`, icone: Users },
        ]}
        className="mb-3"
      />

      {failed && !loading && <EmptyState tipo="erro" aoTentarDeNovo={() => void load()} />}

      {!failed && !loading && shown.length === 0 && search && (
        <EmptyState tipo="semResultado" aoLimparFiltros={() => setSearch('')} />
      )}
      {!failed && !loading && shown.length === 0 && !search && aba === 'meus' && (
        <EmptyState
          icon={Rocket}
          title={COPY.emptyTitle}
          description={COPY.emptyDescription}
          action={{ label: COPY.newButton, onClick: () => setPickerOpen(true) }}
        />
      )}
      {!failed && !loading && shown.length === 0 && !search && aba === 'equipe' && (
        <EmptyState
          icon={Users}
          title="Nenhum funil da equipe"
          description='O gestor marca um funil como "Da equipe" pra todo mundo poder disparar nas conversas.'
        />
      )}

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 overflow-auto pb-4" aria-label={aba === 'meus' ? 'Meus funis' : 'Funis da equipe'}>
        {shown.map(f => {
          const status = statusOf(f);
          const canEdit = f.permissions?.can_edit !== false;
          const canMarkTeam = f.permissions?.can_mark_team ?? isManager;
          return (
            <li key={f.id} className="rounded-lg border border-border p-3 flex flex-col gap-2" data-testid="funil">
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left" onClick={() => open(f)}>
                  <span className="block truncate text-base font-semibold hover:underline">{f.name}</span>
                  {f.team && f.owner_name && <span className="block text-xs text-muted-foreground">Criado por {f.owner_name}</span>}
                </button>
                {f.team && (
                  <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                    <Users className="h-3 w-3" aria-hidden="true" /> Da equipe
                  </Badge>
                )}
              </div>
              <p
                className={cn(
                  'text-xs',
                  status.tone === 'amber' && 'text-amber-700 dark:text-amber-300',
                  status.tone === 'green' && 'text-emerald-700 dark:text-emerald-300',
                  status.tone === 'muted' && 'text-muted-foreground',
                )}
              >
                {status.text}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {status.tone === 'amber' && canEdit && (
                  <Button size="sm" onClick={() => open(f)}>Continuar o passo a passo</Button>
                )}
                {status.tone !== 'amber' && canEdit && (
                  <Chave rotulo="Ligado" ligada={f.is_enabled} aoMudar={() => toggle(f)} />
                )}
                {canMarkTeam && (
                  <Chave rotulo="Da equipe" ligada={!!f.team} aoMudar={next => markTeam(f, next)} />
                )}
                <div className="ml-auto flex items-center gap-1">
                  {!canEdit && (
                    <Button size="sm" variant="outline" onClick={() => open(f)}>Ver</Button>
                  )}
                  <IconActionButton
                    label={canEdit ? 'Duplicar' : 'Duplicar pra ter a sua cópia'}
                    icon={<Copy className="h-3.5 w-3.5" />}
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => void duplicate(f)}
                  />
                  {canEdit && (
                    <IconActionButton
                      label="Excluir"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => void destroy(f)}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <FunnelTemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        canCreateBlank={canCreateBlank}
        onCreated={flow => {
          setPickerOpen(false);
          open(flow);
        }}
      />
      {dialogoDeConfirmacao}
    </div>
  );
}
