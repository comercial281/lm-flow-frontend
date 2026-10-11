import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { SettingsLabelsTour } from '@/tours';
import { toast } from 'sonner';
import { Tags } from 'lucide-react';
import { Pagina } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';

import { labelsService } from '@/services/contacts/labelsService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { useAppDataStore } from '@/store/appDataStore';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { Label, LabelFormData } from '@/types/settings';

import LabelsHeader from '@/components/labels/LabelsHeader';
import LabelModal from '@/components/labels/LabelModal';
import LinhaEtiqueta from './LinhaEtiqueta';
import CaixaDoSistema from './CaixaDoSistema';
import { agruparEtiquetas } from './agruparEtiquetas';
import { Card } from '@/components/ui/ds';

export default function Labels() {
  const { t } = useLanguage('labels');
  const { can, isReady: permissionsReady } = useUserPermissions();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const fetchLabels = useAppDataStore(s => s.fetchLabels);

  const [labels, setLabels] = useState<Label[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Label | null>(null);
  const hasLoaded = useRef(false);

  const loadLabels = useCallback(async () => {
    if (!can('labels', 'read')) {
      toast.error(t('messages.permissionDenied.read'));
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const response = await labelsService.getLabels({ withCounts: true });
      setLabels(response.data);
    } catch (error) {
      // Erro nunca vira lista vazia: a tela mostra o estado de erro com "Tentar de novo".
      console.error('Error loading labels:', error);
      toast.error(t('messages.loadError'));
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [can, t]);

  useEffect(() => {
    if (!permissionsReady || hasLoaded.current) return;
    hasLoaded.current = true;
    loadLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsReady]);

  // Catálogo pode passar de milhares de etiquetas: agrupa só quando muda a lista ou a busca.
  const grupos = useMemo(() => agruparEtiquetas(labels, busca), [labels, busca]);
  const buscando = busca.trim().length > 0;

  const handleCreate = () => {
    if (!can('labels', 'create')) {
      toast.error(t('messages.permissionDenied.create'));
      return;
    }
    setEditando(null);
    setModalAberto(true);
  };

  const handleEdit = (label: Label) => {
    if (!can('labels', 'update')) {
      toast.error(t('messages.permissionDenied.update'));
      return;
    }
    setEditando(label);
    setModalAberto(true);
  };

  const handleTrocarCor = async (label: Label) => {
    if (!can('labels', 'update')) {
      toast.error(t('messages.permissionDenied.update'));
      return;
    }
    try {
      const nova = await labelsService.shuffleColor(label.id);
      // Mantém contagem e nome de exibição que a resposta pode não trazer.
      setLabels(prev => prev.map(l => (l.id === label.id ? { ...l, ...nova } : l)));
      // Atualiza o catálogo guardado na hora, sem recarregar a lista inteira a cada troca.
      useAppDataStore.setState(s => ({
        labels: s.labels.map(x => (x.id === nova.id ? { ...x, color: nova.color } : x)),
      }));
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não deu pra trocar a cor'));
    }
  };

  const handleDelete = async (label: Label) => {
    if (!can('labels', 'delete')) {
      toast.error(t('messages.permissionDenied.delete'));
      return;
    }
    const ok = await confirmar({
      titulo: t('dialog.delete.title'),
      descricao: t('dialog.delete.description', { title: label.display_name ?? label.title }),
      rotuloDaAcao: t('dialog.delete.confirm'),
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await labelsService.deleteLabel(label.id);
      toast.success(t('messages.deleteSuccess'));
      setLabels(prev => prev.filter(l => l.id !== label.id));
      fetchLabels(true)?.catch(() => {});
    } catch (error) {
      console.error('Error deleting label:', error);
      toast.error(apiErrorMessage(error, t('messages.deleteError')));
    }
  };

  const handleSubmit = async (data: LabelFormData) => {
    const permissao = editando ? 'update' : 'create';
    if (!can('labels', permissao)) {
      toast.error(editando ? t('messages.permissionDenied.update') : t('messages.permissionDenied.create'));
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        const atualizada = await labelsService.updateLabel(editando.id, data);
        toast.success(t('messages.updateSuccess'));
        setLabels(prev => prev.map(l => (l.id === editando.id ? { ...l, ...atualizada } : l)));
      } else {
        await labelsService.createLabel(data);
        toast.success(t('messages.createSuccess'));
        await loadLabels();
      }
      fetchLabels(true)?.catch(() => {});
      setModalAberto(false);
      setEditando(null);
    } catch (error) {
      console.error('Error saving label:', error);
      toast.error(apiErrorMessage(error, editando ? t('messages.updateError') : t('messages.createError')));
    } finally {
      setSalvando(false);
    }
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setModalAberto(false);
      setEditando(null);
    }
  };

  const semNada = labels.length === 0;
  const semResultado = !semNada && grupos.suas.length === 0 && grupos.sistema.length === 0;

  return (
    <Pagina
      rolagem="conteudo"
      dataTour="settings-labels-page"
      cabecalho={
        <div data-tour="settings-labels-header">
          <LabelsHeader
            totalCount={labels.length}
            searchValue={busca}
            onSearchChange={setBusca}
            onNewLabel={handleCreate}
          />
        </div>
      }
    >
      <SettingsLabelsTour />

      <div className="flex-1 overflow-auto" data-tour="settings-labels-content">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground">{t('loading')}</div>
          </div>
        ) : loadError ? (
          <EmptyState tipo="erro" icon={Tags} aoTentarDeNovo={loadLabels} />
        ) : semNada ? (
          <EmptyState
            tipo="vazio"
            icon={Tags}
            title="Nenhuma etiqueta ainda"
            description="Etiquetas separam seus leads e conversas para você achar rápido."
            exemplo="Investidor, Primeiro imóvel, Permuta"
            action={can('labels', 'create') ? { label: t('empty.action'), onClick: handleCreate } : undefined}
          />
        ) : semResultado ? (
          <EmptyState tipo="semResultado" icon={Tags} aoLimparFiltros={() => setBusca('')} />
        ) : (
          <div className="space-y-8 p-4">
            {(grupos.suas.length > 0 || !buscando) && (
              <section className="space-y-2">
                <h2 className="text-base font-semibold">Suas etiquetas</h2>
                {grupos.suas.length > 0 ? (
                  <Card className="gap-0 py-0">
                    {grupos.suas.map(l => (
                      <LinhaEtiqueta
                        key={l.id}
                        label={l}
                        onEditar={handleEdit}
                        onTrocarCor={can('labels', 'update') ? handleTrocarCor : undefined}
                        onExcluir={can('labels', 'delete') ? handleDelete : undefined}
                      />
                    ))}
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Você ainda não criou nenhuma. Ex.: Investidor, Primeiro imóvel, Permuta.
                  </p>
                )}
              </section>
            )}
            {grupos.sistema.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-base font-semibold">Do sistema</h2>
                <p className="text-sm text-muted-foreground">
                  O sistema coloca estas etiquetas sozinho. Aqui você só muda a cor.
                </p>
                <div className="space-y-2">
                  {grupos.sistema.map(c => (
                    <CaixaDoSistema
                      key={c.id}
                      nome={c.nome}
                      frase={c.frase}
                      itens={c.itens}
                      abertaPorBusca={buscando}
                      onTrocarCor={can('labels', 'update') ? handleTrocarCor : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {dialogoDeConfirmacao}

      <LabelModal
        open={modalAberto}
        onOpenChange={handleModalClose}
        label={editando || undefined}
        isNew={!editando}
        loading={salvando}
        onSubmit={handleSubmit}
      />
    </Pagina>
  );
}
