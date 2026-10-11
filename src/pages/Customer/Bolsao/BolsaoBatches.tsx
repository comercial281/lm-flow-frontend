import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { plural } from '@/lib/formato';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/ds';
import {
  Upload,
  FlaskConical,
  Pause,
  Play,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Users,
  Eraser,
} from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import Abas from '@/components/base/Abas';
import Carregando from '@/components/base/Carregando';
import { BaseHeader, Pagina } from '@/components/base';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { useConfirmacao } from '@/hooks/useConfirmacao';
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
  archived: 'Arquivada',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function BolsaoBatches() {
  const [batches, setBatches] = useState<BolsaoBatch[]>([]);
  const [claims, setClaims] = useState<BolsaoClaimRow[]>([]);
  const [byUser, setByUser] = useState<{ user_id: string; name: string | null; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  // Falha na leitura não vira "Nenhuma lista ainda" / "Ninguém pegou nada ainda".
  const [erroListas, setErroListas] = useState(false);
  const [erroHistorico, setErroHistorico] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [cleaning, setCleaning] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [aba, setAba] = useState('listas');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await bolsaoService.listBatches();
      setBatches(rows);
      setErroListas(false);

      // O #show é quem bate o watchdog do servidor. Só é chamado para lista que
      // está mesmo importando — chamar para todas seria trabalho à toa.
      rows.filter(b => b.status === 'importing').forEach(b => {
        bolsaoService.getBatch(b.id).catch(() => undefined);
      });
    } catch (e) {
      setErroListas(true);
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
      setErroHistorico(false);
    } catch (e) {
      setErroHistorico(true);
      toast.error(apiErrorMessage(e, 'Não consegui carregar o histórico.'));
    }
  }, []);

  useEffect(() => {
    load();
    loadClaims();
  }, [load, loadClaims]);

  // O servidor já manda as arquivadas por último; aqui só separamos as duas
  // pilhas: as que ainda podem servir em cima, as arquivadas recolhidas embaixo.
  const activeBatches = batches.filter(b => b.status !== 'archived');
  const archivedBatches = batches.filter(b => b.status === 'archived');

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
        toast.success('Lista pausada. Ela sumiu do Bolsão, sem excluir nada.');
      }
      load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui mudar o estado da lista.'));
    }
  };

  // Arquivar não é vermelho: nada é excluído e dá pra reabrir depois.
  const doArchive = async (batch: BolsaoBatch) => {
    const ok = await confirmar({
      titulo: `Arquivar “${batch.name}”?`,
      descricao:
        'Ela sai desta lista e para de oferecer leads: os que ainda estavam esperando saem do ' +
        'Bolsão. Quem já foi puxado por um corretor continua com ele, como qualquer outro lead. ' +
        'Nada é excluído — dá para reabrir depois.',
      rotuloDaAcao: 'Arquivar',
    });
    if (!ok) return;
    try {
      await bolsaoService.archiveBatch(batch.id);
      toast.success('Lista arquivada. Os leads que sobraram saíram do Bolsão.');
      load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui arquivar a lista.'));
    }
  };

  // Volta PAUSADA, não ao ar: lista arquivada há meses voltando a distribuir
  // leads velhos sem o gestor confirmar é a surpresa que o resto do Bolsão evita.
  const doUnarchive = async (batch: BolsaoBatch) => {
    try {
      await bolsaoService.unarchiveBatch(batch.id);
      toast.success('Lista reaberta, pausada. Clique em "Voltar ao ar" para os corretores verem os leads.');
      load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui reabrir a lista.'));
    }
  };

  const cleanupTest = async () => {
    setCleaning(true);
    try {
      const stats = await bolsaoService.cleanupTestLeads();
      toast.success(
        `Removi ${plural(stats.removed, 'lead de teste', 'leads de teste')} e arquivei ${plural(stats.archived, 'card', 'cards')}.`,
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
    <Pagina
      cabecalho={
        <BaseHeader
          title="Bolsão"
          subtitle="Suba a lista e ela fica disponível para os corretores se servirem."
          aDireita={
            <>
              <Button variant="outline" onClick={() => setTestOpen(true)}>
                <FlaskConical className="h-4 w-4 mr-2" /> Criar lead de teste
              </Button>
              {hasTestBatch && (
                <Button variant="ghost" onClick={cleanupTest} disabled={cleaning}>
                  {cleaning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eraser className="h-4 w-4 mr-2" />}
                  Limpar leads de teste
                </Button>
              )}
            </>
          }
          primaryAction={{ label: 'Subir planilha', icon: <Upload className="h-4 w-4" />, onClick: () => setWizardOpen(true) }}
        />
      }
    >
      <div className="flex flex-col gap-2">
        <Abas
          rotulo="Partes do Bolsão"
          ativa={aba}
          aoTrocar={setAba}
          abas={[
            { chave: 'listas', rotulo: 'Listas' },
            { chave: 'quem-pegou', rotulo: 'Quem pegou o quê' },
            { chave: 'regras', rotulo: 'Regras' },
          ]}
        />

        {aba === 'listas' && <div className="mt-4 space-y-4">
          {loading ? (
            <Carregando rotulo="Carregando…" className="py-2" />
          ) : batches.length === 0 && erroListas ? (
            <EmptyState tipo="erro" aoTentarDeNovo={() => void load()} />
          ) : batches.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="Nenhuma lista ainda"
              description="Suba uma planilha de leads e eles ficam disponíveis para os corretores puxarem. Não precisa formatar nada antes."
              action={{ label: 'Subir planilha', onClick: () => setWizardOpen(true) }}
            />
          ) : (
            <>
              {activeBatches.map(batch => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  onTogglePause={() => togglePause(batch)}
                  onArchive={() => doArchive(batch)}
                />
              ))}

              {activeBatches.length === 0 && (
                <EmptyState
                  tamanho="compacto"
                  title="Nenhuma lista no ar."
                  description="As arquivadas continuam aí embaixo."
                />
              )}

              {/* Arquivadas ficam recolhidas: saíram da frente de propósito, mas
                  nada foi apagado e dá pra trazer de volta. */}
              {archivedBatches.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowArchived(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showArchived ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Arquivadas ({archivedBatches.length})
                  </button>

                  {showArchived && (
                    <div className="mt-3 space-y-4">
                      {archivedBatches.map(batch => (
                        <BatchCard
                          key={batch.id}
                          batch={batch}
                          onUnarchive={() => doUnarchive(batch)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>}

        {aba === 'quem-pegou' && <div className="mt-4 space-y-4">
          <ClaimsPanel claims={claims} byUser={byUser} erro={erroHistorico} aoTentarDeNovo={() => void loadClaims()} />
        </div>}

        {aba === 'regras' && <div className="mt-4">
          <BolsaoRulesCard />
        </div>}
      </div>

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

      {dialogoDeConfirmacao}
    </Pagina>
  );
}

function BatchCard({
  batch,
  onTogglePause,
  onArchive,
  onUnarchive,
}: {
  batch: BolsaoBatch;
  onTogglePause?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
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
            {onTogglePause && batch.status !== 'importing' && batch.status !== 'preview' && (
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
            {/* Arquivar é a saída da lista, e não apaga nada. A de teste tem a
                própria limpeza ("Limpar leads de teste"), lá em cima. */}
            {onArchive && !batch.is_test && batch.status !== 'importing' && (
              <Button variant="ghost" size="sm" onClick={onArchive}>
                <Archive className="h-4 w-4 mr-1" /> Arquivar
              </Button>
            )}
            {onUnarchive && (
              <Button variant="outline" size="sm" onClick={onUnarchive}>
                <ArchiveRestore className="h-4 w-4 mr-1" /> Reabrir
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
  erro,
  aoTentarDeNovo,
}: {
  claims: BolsaoClaimRow[];
  byUser: { user_id: string; name: string | null; count: number }[];
  erro: boolean;
  aoTentarDeNovo: () => void;
}) {
  if (claims.length === 0 && erro) {
    return <EmptyState tipo="erro" aoTentarDeNovo={aoTentarDeNovo} />;
  }
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
