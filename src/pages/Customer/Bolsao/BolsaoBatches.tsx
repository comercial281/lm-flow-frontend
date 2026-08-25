import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/ds';
import {
  Upload,
  FlaskConical,
  Pause,
  Play,
  Trash2,
  Loader2,
  AlertTriangle,
  Inbox,
  Users,
  Eraser,
} from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { apiErrorMessage } from '@/utils/apiHelpers';
import bolsaoService, { BolsaoBatch, BolsaoClaimRow } from '@/services/bolsao/bolsaoService';
import BolsaoImportWizard from './BolsaoImportWizard';
import BolsaoTestLeadDialog from './BolsaoTestLeadDialog';
import BolsaoRulesCard from './BolsaoRulesCard';

// Enquanto houver lista importando, a tela pergunta de novo. Isso também é o
// watchdog do servidor: produção roda o job em processo e ele morre em todo
// deploy — é a consulta desta tela que o reenfileira.
const POLL_MS = 4_000;

const STATUS_LABEL: Record<BolsaoBatch['status'], string> = {
  preview: 'Aguardando confirmação',
  importing: 'Importando',
  ready: 'No ar',
  paused: 'Pausada',
  failed: 'Falhou',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function BolsaoBatches() {
  const [batches, setBatches] = useState<BolsaoBatch[]>([]);
  const [claims, setClaims] = useState<BolsaoClaimRow[]>([]);
  const [byUser, setByUser] = useState<{ user_id: string; name: string | null; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BolsaoBatch | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await bolsaoService.listBatches();
      setBatches(rows);

      // O #show é quem bate o watchdog do servidor. Só é chamado para lista que
      // está mesmo importando — chamar para todas seria trabalho à toa.
      rows.filter(b => b.status === 'importing').forEach(b => {
        bolsaoService.getBatch(b.id).catch(() => undefined);
      });
    } catch (e) {
      if (!silent) toast.error(apiErrorMessage(e, 'Não consegui carregar as listas.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadClaims = useCallback(async () => {
    try {
      const { rows, byUser: agg } = await bolsaoService.claims();
      setClaims(rows);
      setByUser(agg);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui carregar o histórico.'));
    }
  }, []);

  useEffect(() => {
    load();
    loadClaims();
  }, [load, loadClaims]);

  const importing = batches.some(b => b.status === 'importing');
  useEffect(() => {
    if (!importing) return;
    const id = window.setInterval(() => load(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [importing, load]);

  const togglePause = async (batch: BolsaoBatch) => {
    try {
      if (batch.status === 'paused') {
        await bolsaoService.resume(batch.id);
        toast.success('Lista de volta ao Bolsão.');
      } else {
        await bolsaoService.pause(batch.id);
        toast.success('Lista pausada. Ela sumiu do Bolsão, sem apagar nada.');
      }
      load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui mudar o estado da lista.'));
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await bolsaoService.deleteBatch(confirmDelete.id);
      toast.success('Lista apagada.');
      setConfirmDelete(null);
      load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui apagar a lista.'));
    }
  };

  const cleanupTest = async () => {
    setCleaning(true);
    try {
      const stats = await bolsaoService.cleanupTestLeads();
      toast.success(
        `Removi ${stats.removed} lead(s) de teste e arquivei ${stats.archived} card(s).`,
      );
      load(true);
      loadClaims();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui limpar os leads de teste.'));
    } finally {
      setCleaning(false);
    }
  };

  const hasTestBatch = batches.some(b => b.is_test);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Bolsão de Leads
          </h1>
          <p className="text-muted-foreground">
            Suba a lista e ela fica disponível para os corretores se servirem.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTestOpen(true)}>
            <FlaskConical className="h-4 w-4 mr-2" /> Criar lead de teste
          </Button>
          {hasTestBatch && (
            <Button variant="ghost" onClick={cleanupTest} disabled={cleaning}>
              {cleaning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eraser className="h-4 w-4 mr-2" />
              )}
              Limpar leads de teste
            </Button>
          )}
          <Button onClick={() => setWizardOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Subir planilha
          </Button>
        </div>
      </div>

      <Tabs defaultValue="listas">
        <TabsList>
          <TabsTrigger value="listas">Listas</TabsTrigger>
          <TabsTrigger value="quem-pegou">Quem pegou o quê</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="listas" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
            </div>
          ) : batches.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="Nenhuma lista ainda"
              description="Suba uma planilha de leads e eles ficam disponíveis para os corretores puxarem. Não precisa formatar nada antes."
              action={{ label: 'Subir planilha', onClick: () => setWizardOpen(true) }}
            />
          ) : (
            batches.map(batch => (
              <BatchCard
                key={batch.id}
                batch={batch}
                onTogglePause={() => togglePause(batch)}
                onDelete={() => setConfirmDelete(batch)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="quem-pegou" className="mt-4 space-y-4">
          <ClaimsPanel claims={claims} byUser={byUser} />
        </TabsContent>

        <TabsContent value="regras" className="mt-4">
          <BolsaoRulesCard />
        </TabsContent>
      </Tabs>

      <BolsaoImportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onImported={() => load(true)}
      />
      <BolsaoTestLeadDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        onCreated={() => load(true)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={v => (v ? null : setConfirmDelete(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar “{confirmDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os leads que ainda estão no Bolsão somem. Quem já foi puxado por um corretor continua
              com ele, como qualquer outro lead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BatchCard({
  batch,
  onTogglePause,
  onDelete,
}: {
  batch: BolsaoBatch;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  const rules = batch.effective_settings;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {batch.name}
              {batch.is_test && <Badge variant="secondary">TESTE</Badge>}
              <Badge variant={batch.status === 'ready' ? 'default' : 'outline'}>
                {STATUS_LABEL[batch.status]}
              </Badge>
            </CardTitle>
            <CardDescription>
              {batch.file_name ? `${batch.file_name} · ` : ''}
              {formatDate(batch.created_at)}
              {batch.uploaded_by?.name ? ` · por ${batch.uploaded_by.name}` : ''}
            </CardDescription>
          </div>

          <div className="flex gap-2">
            {batch.status !== 'importing' && batch.status !== 'preview' && (
              <Button variant="outline" size="sm" onClick={onTogglePause}>
                {batch.status === 'paused' ? (
                  <>
                    <Play className="h-4 w-4 mr-1" /> Voltar ao ar
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" /> Pausar
                  </>
                )}
              </Button>
            )}
            {!batch.is_test && (
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {batch.status === 'importing' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Importando as {batch.total_rows} linhas…
          </p>
        )}

        {batch.status === 'failed' && batch.error_message && (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {batch.error_message}
          </p>
        )}

        {/* O resumo honesto: o gestor precisa ver o que NÃO entrou, e por quê. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Disponíveis" value={batch.available_count} />
          <Stat label="Já puxados" value={batch.claimed_count} />
          <Stat label="Já eram de alguém" value={batch.duplicate_count} />
          <Stat label="Sem telefone válido" value={batch.invalid_count} />
        </div>

        <p className="text-xs text-muted-foreground">
          Regra desta lista: {rules.claims_per_window}{' '}
          {Number(rules.claims_per_window) === 1 ? 'lead' : 'leads'} a cada {rules.window_minutes}{' '}
          minutos.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ClaimsPanel({
  claims,
  byUser,
}: {
  claims: BolsaoClaimRow[];
  byUser: { user_id: string; name: string | null; count: number }[];
}) {
  if (claims.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Ninguém pegou nada ainda"
        description="Assim que os corretores começarem a puxar leads, o histórico aparece aqui — quem pegou, qual lead e quando."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Por corretor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {byUser.map(row => (
            <div key={row.user_id} className="min-w-[120px]">
              <p className="text-lg font-semibold text-foreground">{row.count}</p>
              <p className="text-xs text-muted-foreground">{row.name ?? 'Sem nome'}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Lead</th>
              <th className="p-2 text-left">Lista</th>
              <th className="p-2 text-left">Corretor</th>
              <th className="p-2 text-left">Quando</th>
            </tr>
          </thead>
          <tbody>
            {claims.map(row => (
              <tr key={row.id} className="border-t">
                <td className="p-2 text-foreground">{row.lead_name ?? '—'}</td>
                <td className="p-2 text-muted-foreground">{row.batch_name ?? '—'}</td>
                <td className="p-2 text-muted-foreground">{row.claimed_by?.name ?? '—'}</td>
                <td className="p-2 text-muted-foreground">
                  {new Date(row.claimed_at).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
