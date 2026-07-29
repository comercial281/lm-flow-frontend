import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/ui/ds';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Plus, RefreshCw, Trash2, XCircle,
} from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import EmptyState from '@/components/base/EmptyState';
import {
  metaPagesService,
  type MetaPage,
  type AvailableMetaPage,
} from '@/services/integrations/metaPagesService';

// Tela do Meta Lead Ads. Deixou de ser um wrapper do RealEstateIntegrationPage
// (um page_id + um token) porque o cliente pode usar 2–3 páginas/BMs: aqui cada
// página é uma linha que se adiciona, edita e remove.
//
// O operador não precisa descobrir o page_id: "Adicionar Facebook" lista as
// páginas que o nosso app enxerga e ele escolhe. Informar na mão continua
// disponível para página de um BM que o token de sistema não alcança.
export default function MetaAdsPage() {
  const navigate = useNavigate();

  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableMetaPage[]>([]);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualPageId, setManualPageId] = useState('');
  const [manualPageName, setManualPageName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<MetaPage | null>(null);
  const [editName, setEditName] = useState('');
  const [editToken, setEditToken] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPages(await metaPagesService.getAll());
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao carregar as páginas conectadas'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = async () => {
    setAddOpen(true);
    setManual(false);
    setManualPageId('');
    setManualPageName('');
    setManualToken('');
    setAvailableError(null);
    setLoadingAvailable(true);
    try {
      setAvailable(await metaPagesService.available());
    } catch (e) {
      // Sem token de sistema, ou o app não enxerga nenhuma página: cai direto no
      // preenchimento manual em vez de deixar a lista vazia sem explicação.
      setAvailable([]);
      setAvailableError(apiErrorMessage(e, 'Não foi possível listar as páginas do Facebook'));
      setManual(true);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const addPage = async (payload: { page_id: string; page_name?: string; access_token?: string }) => {
    if (!payload.page_id.trim()) {
      toast.error('Informe o Page ID');
      return;
    }
    setSaving(true);
    try {
      await metaPagesService.create(payload);
      toast.success('Página conectada');
      setAddOpen(false);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao conectar a página'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (page: MetaPage) => {
    setBusyId(page.id);
    try {
      await metaPagesService.update(page.id, { is_active: !page.is_active });
      toast.success(page.is_active ? 'Página pausada' : 'Página reativada');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao atualizar a página'));
    } finally {
      setBusyId(null);
    }
  };

  const resubscribe = async (page: MetaPage) => {
    setBusyId(page.id);
    try {
      await metaPagesService.subscribeWebhook(page.id);
      toast.success('Recebimento em tempo real ativado');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não foi possível ativar o recebimento em tempo real'));
    } finally {
      setBusyId(null);
    }
  };

  const removePage = async (page: MetaPage) => {
    if (!window.confirm(`Remover a página "${page.page_name}"? Os leads dela param de entrar.`)) return;
    setBusyId(page.id);
    try {
      await metaPagesService.remove(page.id);
      toast.success('Página removida');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao remover a página'));
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (page: MetaPage) => {
    setEditing(page);
    setEditName(page.page_name);
    setEditToken('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Token em branco significa "não mexer" — quem quer trocar cola o novo.
      await metaPagesService.update(editing.id, {
        page_name: editName,
        ...(editToken.trim() ? { access_token: editToken.trim() } : {}),
      });
      toast.success('Página atualizada');
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao atualizar a página'));
    } finally {
      setSaving(false);
    }
  };

  const activeCount = pages.filter(p => p.is_active).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur p-6">
        <button
          onClick={() => navigate('/settings/integrations')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Marketplace
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-3xl border">
              📘
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Meta Ads</h1>
                {activeCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {activeCount === 1 ? '1 página conectada' : `${activeCount} páginas conectadas`}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Captura leads dos formulários do Facebook e Instagram Ads. Cada lead vira um contato no
                CRM automaticamente. Você pode conectar quantas páginas o cliente usar.
              </p>
            </div>
          </div>

          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Facebook
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : pages.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Nenhuma página conectada"
            description="Conecte a página do Facebook do cliente para os leads dos anúncios entrarem no CRM."
            action={{ label: 'Adicionar Facebook', onClick: openAdd }}
          />
        ) : (
          <div className="max-w-3xl space-y-3">
            {pages.map(page => (
              <div
                key={page.id}
                className={`rounded-xl border bg-card p-4 ${page.is_active ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate">{page.page_name}</h3>
                      {page.is_active ? (
                        <Badge variant="secondary" className="text-xs">ativa</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">pausada</Badge>
                      )}
                      {page.webhook_subscribed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          recebendo em tempo real
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-700 dark:text-orange-400">
                          <XCircle className="h-3 w-3" />
                          sem recebimento em tempo real
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Page ID {page.page_id}
                      {' · '}
                      {page.uses_own_token ? 'token próprio' : 'token do sistema'}
                      {page.connected_at && ` · desde ${new Date(page.connected_at).toLocaleDateString('pt-BR')}`}
                    </p>
                    {page.last_error && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-orange-700 dark:text-orange-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {page.last_error}
                      </p>
                    )}
                    {!page.has_token && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-orange-700 dark:text-orange-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        Sem token utilizável: informe um token para esta página ou atribua a página ao
                        Usuário do Sistema com acesso a Leads.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => startEdit(page)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      disabled={busyId === page.id}
                      onClick={() => resubscribe(page)}
                      title="Reinscreve a página no app para receber os leads em tempo real"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      disabled={busyId === page.id}
                      onClick={() => toggleActive(page)}
                    >
                      {page.is_active ? 'Pausar' : 'Reativar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive"
                      disabled={busyId === page.id}
                      onClick={() => removePage(page)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Ponte para a tela onde os formulários viram pipeline/etiqueta. O
                caminho inverso já existia; este lado faltava. */}
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              Os formulários de cada página e para onde os leads vão ficam em{' '}
              <Link to="/settings/lead-ads-forms" className="text-primary hover:underline inline-flex items-center gap-1">
                Formulários Lead Ads <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Adicionar página */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Facebook</DialogTitle>
            <DialogDescription>
              Escolha uma das páginas que o LM Flow enxerga. Se a página do cliente não estiver na
              lista, informe o Page ID e o token dela.
            </DialogDescription>
          </DialogHeader>

          {!manual && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {loadingAvailable ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Buscando páginas...</p>
              ) : available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma página encontrada.
                </p>
              ) : (
                available.map(p => (
                  <div key={p.page_id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.page_id}
                        {!p.leads_ok && ' · sem acesso a Leads'}
                      </p>
                    </div>
                    {p.already_added ? (
                      <Badge variant="secondary" className="text-xs shrink-0">já adicionada</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="text-xs shrink-0"
                        disabled={saving}
                        onClick={() => addPage({ page_id: p.page_id, page_name: p.name })}
                      >
                        Usar esta
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {availableError && !manual && (
            <p className="flex items-start gap-1.5 text-xs text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {availableError}
            </p>
          )}

          {manual ? (
            <div className="space-y-3">
              {availableError && (
                <p className="flex items-start gap-1.5 text-xs text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {availableError}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="manual-page-id" className="text-sm">Page ID</Label>
                <Input
                  id="manual-page-id"
                  value={manualPageId}
                  onChange={e => setManualPageId(e.target.value)}
                  placeholder="123456789012345"
                />
                <p className="text-xs text-muted-foreground">
                  ID numérico da página. Em Configurações da Página → Informações da Página.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-page-name" className="text-sm">Nome (para você identificar)</Label>
                <Input
                  id="manual-page-name"
                  value={manualPageName}
                  onChange={e => setManualPageName(e.target.value)}
                  placeholder="Imobiliária Centro"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-token" className="text-sm">Access Token (opcional)</Label>
                <Input
                  id="manual-token"
                  type="password"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="EAAxxxxx..."
                />
                <p className="text-xs text-muted-foreground">
                  Em branco, a página usa o token de sistema do LM Flow. Só preencha quando a página
                  vier de um Business Manager que o nosso token não alcança.
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setManual(true)}
              className="text-xs text-primary hover:underline text-left"
            >
              A página não apareceu? Informar Page ID e token manualmente
            </button>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            {manual && (
              <Button
                disabled={saving || !manualPageId.trim()}
                onClick={() => addPage({
                  page_id: manualPageId.trim(),
                  page_name: manualPageName.trim() || undefined,
                  access_token: manualToken.trim() || undefined,
                })}
              >
                {saving ? 'Conectando...' : 'Conectar página'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar página */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar página</DialogTitle>
            <DialogDescription>Page ID {editing?.page_id}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-page-name" className="text-sm">Nome</Label>
              <Input id="edit-page-name" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-token" className="text-sm">Novo Access Token</Label>
              <Input
                id="edit-token"
                type="password"
                value={editToken}
                onChange={e => setEditToken(e.target.value)}
                placeholder={editing?.uses_own_token ? '•••••••• (já configurado)' : 'usando o token do sistema'}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para manter o token atual.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={saving} onClick={saveEdit}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
