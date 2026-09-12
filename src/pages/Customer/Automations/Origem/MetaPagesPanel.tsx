import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Facebook, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { metaPagesService, type MetaPage } from '@/services/integrations/metaPagesService';
import AddMetaPageDialog from './AddMetaPageDialog';

// Páginas do Facebook conectadas para Lead Ads — a lista, e as ações por página.
//
// O servidor aceita N páginas por cliente há tempos; o que faltava era a porta.
// A aba antiga era um formulário genérico com UM Page ID e UM token: conectar a
// segunda página funcionava por baixo, mas a tela só mostrava a última — sem
// lista, sem como desativar/remover/religar uma página específica, e com um
// "Desconectar" que derrubava todas de uma vez.
//
// Quem conecta continua sendo só a Leal Mídia (decisão do dono, 12/09/2026): o
// cliente vê a lista, não mexe. O critério é o MESMO do servidor (e-mail do
// super-admin) — dois critérios diferentes fariam a tela oferecer o que a API
// recusa.

interface Props {
  /** Leva para a aba de formulários — depois de conectar, é o próximo passo. */
  onGoToForms: () => void;
}

export default function MetaPagesPanel({ onGoToForms }: Props) {
  const isSuperAdmin = useIsSuperAdmin();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  // null = carregando. A lista é leitura de fundo: recusa por cargo (Corretor
  // não tem integrations.read) ou tabela ainda não criada viram um texto
  // discreto, nunca aviso vermelho.
  const [pages, setPages] = useState<MetaPage[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setPages(await metaPagesService.getAll());
      setUnavailable(false);
    } catch {
      setPages([]);
      setUnavailable(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (page: MetaPage, action: () => Promise<unknown>, okMsg: string, failMsg: string) => {
    setBusyId(page.id);
    try {
      await action();
      toast.success(okMsg);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, failMsg));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = (page: MetaPage) =>
    run(
      page,
      () => metaPagesService.update(page.id, { is_active: !page.is_active }),
      page.is_active ? 'Página desativada — os leads dela param de entrar' : 'Página ativada',
      'Não foi possível alterar a página',
    );

  const resubscribe = (page: MetaPage) =>
    run(
      page,
      () => metaPagesService.subscribeWebhook(page.id),
      'Recebimento em tempo real ativado',
      'Não foi possível ativar o recebimento em tempo real',
    );

  const removePage = async (page: MetaPage) => {
    const ok = await confirmar({
      titulo: 'Remover página',
      descricao: (
        <>
          A página <strong>{page.page_name}</strong> deixa de receber leads neste CRM e os
          formulários cadastrados dela perdem o vínculo com a página. Para parar
          temporariamente, prefira <strong>Desativar</strong>.
        </>
      ),
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    });
    if (!ok) return;
    await run(page, () => metaPagesService.remove(page.id), 'Página removida', 'Não foi possível remover a página');
  };

  const onAdded = (page: MetaPage) => {
    setAddOpen(false);
    toast.success(`Página ${page.page_name} conectada`);
    // Sem a inscrição no app, o Facebook NÃO manda o lead — conectar não basta.
    // O motivo vem do Graph e aparece também na linha, com o botão de religar.
    if (!page.webhook_subscribed) {
      toast.warning(
        page.last_error
          ? `Recebimento em tempo real não ativado: ${page.last_error}`
          : 'Recebimento em tempo real não ativado — use "Religar recebimento".',
      );
    }
    void load();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Páginas conectadas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            As páginas do Facebook/Instagram de onde os leads dos formulários de anúncio entram
            neste CRM. Cada página traz os próprios formulários, na aba <em>Formulários</em>.
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Adicionar página
          </Button>
        )}
      </div>

      {unavailable && (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as páginas conectadas.
        </p>
      )}

      {!unavailable && pages === null && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}

      {!unavailable && pages !== null && pages.length === 0 && (
        <EmptyState
          icon={Facebook}
          title="Nenhuma página do Facebook conectada"
          description={
            isSuperAdmin
              ? 'Adicione a página do cliente para começar a receber os leads dos formulários de anúncio.'
              : 'As páginas são conectadas pela Leal Mídia. Fale com o suporte para ligar a sua.'
          }
          action={isSuperAdmin ? { label: 'Adicionar página', onClick: () => setAddOpen(true) } : undefined}
        />
      )}

      {!unavailable && pages !== null && pages.length > 0 && (
        <>
          <ul className="divide-y rounded-lg border">
            {pages.map(page => {
              const busy = busyId === page.id;
              const realtimeBroken = !page.webhook_subscribed || !!page.last_error;
              return (
                <li key={page.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{page.page_name}</span>
                      <Badge variant={page.is_active ? 'secondary' : 'outline'} className="text-xs">
                        {page.is_active ? 'Ativa' : 'Desativada'}
                      </Badge>
                      {page.webhook_subscribed && !page.last_error ? (
                        <Badge variant="secondary" className="text-xs">Recebimento em tempo real: ok</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40">
                          Recebimento em tempo real: não ativado
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {page.uses_own_token ? 'Token próprio' : 'Token de sistema'}
                      </Badge>
                      {page.accept_unconfigured_forms && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40">
                          Aceita qualquer formulário
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{page.page_id}</div>
                    {page.last_error && (
                      <p className="text-xs text-amber-600 mt-1">{page.last_error}</p>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {realtimeBroken && page.is_active && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => resubscribe(page)}>
                          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? 'animate-spin' : ''}`} />
                          Religar recebimento
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleActive(page)}>
                        {page.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => void removePage(page)}
                        aria-label={`Remover ${page.page_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-sm text-muted-foreground">
            <span>Conectou uma página nova? Sincronize os formulários dela.</span>
            <Button variant="outline" size="sm" onClick={onGoToForms}>Ver formulários</Button>
          </div>
        </>
      )}

      {dialogoDeConfirmacao}
      <AddMetaPageDialog open={addOpen} onOpenChange={setAddOpen} onAdded={onAdded} />
    </div>
  );
}
