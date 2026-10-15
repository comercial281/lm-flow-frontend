import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
  Skeleton,
  Checkbox,
} from '@/components/ui/ds';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  MessageSquare,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import MessageTemplateService, {
  supportsTemplateSync,
  usesStructuredComponents,
  getChannelTemplateConfig,
} from '@/services/channels/messageTemplatesService';
import { TemplatePreview } from './TemplatePreview';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { cn } from '@/lib/utils';
import { MessageTemplate, TemplateFormData } from '@/types';

interface MessageTemplateFormProps {
  inboxId: string;
  channelType: string;
  onUpdate?: () => void;
}

// Template Form Modal
const TemplateFormModal: React.FC<{
  isOpen: boolean;
  template?: MessageTemplate;
  onClose: () => void;
  onSave: (template: TemplateFormData) => void;
  mode: 'create' | 'edit';
  channelType: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}> = ({ isOpen, template, onClose, onSave, mode, channelType, t }) => {
  const channelConfig = getChannelTemplateConfig(channelType);
  const isStructured = usesStructuredComponents(channelType);

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    content: '',
    language: 'en_US',
    category: 'MARKETING',
    template_type: 'text',
    active: true,
    // Structured fields
    headerFormat: 'TEXT',
    headerText: '',
    bodyText: '',
    footerText: '',
    buttons: [],
  });

  useEffect(() => {
    if (template && mode === 'edit') {
      const convertedTemplate = MessageTemplateService.transformToFrontendFormat(
        template,
        channelType,
      );
      setFormData(convertedTemplate);
    } else {
      // Reset for create mode
      setFormData({
        name: '',
        content: '',
        language: 'en_US',
        category: (channelConfig.categories[0] as TemplateFormData['category']) || 'MARKETING',
        template_type:
          (channelConfig.templateTypes[0] as TemplateFormData['template_type']) || 'text',
        active: true,
        headerFormat: 'TEXT',
        headerText: '',
        bodyText: '',
        footerText: '',
        buttons: [],
      });
    }
  }, [template, mode, isOpen, channelType]);

  const handleSave = () => {
    // Validate based on channel type
    if (isStructured) {
      if (!formData.name.trim() || !formData.bodyText?.trim()) {
        toast.error(t('settings.messageTemplates.errors.requiredFields'));
        return;
      }
    } else {
      if (!formData.name.trim() || !formData.content.trim()) {
        toast.error(t('settings.messageTemplates.errors.requiredFields'));
        return;
      }
    }

    onSave(formData);
    onClose();
  };

  const addButton = () => {
    setFormData(prev => ({
      ...prev,
      buttons: [...(prev.buttons || []), { type: 'QUICK_REPLY', text: '' }],
    }));
  };

  const removeButton = (index: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons?.filter((_, i) => i !== index) || [],
    }));
  };

  const updateButton = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      buttons:
        prev.buttons?.map((btn, i) => (i === index ? { ...btn, [field]: value } : btn)) || [],
    }));
  };

  const isFormValid = isStructured
    ? formData.name.trim() && formData.bodyText?.trim()
    : formData.name.trim() && formData.content.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="wide" className="overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('settings.messageTemplates.form.createTitle')
              : t('settings.messageTemplates.form.editTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* Form */}
          <div className="grid content-start gap-5">
            <GrupoDaJanela titulo={t('settings.messageTemplates.form.groupIdentification')}>
              <GradeDaJanela>
                <CampoDaJanela
                  rotulo={t('settings.messageTemplates.form.name')}
                  htmlFor="modelo-nome"
                  obrigatorio
                  colunas={2}
                >
                  <Input
                    id="modelo-nome"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('settings.messageTemplates.form.namePlaceholder')}
                  />
                </CampoDaJanela>
                <CampoDaJanela rotulo={t('settings.messageTemplates.form.category')} htmlFor="modelo-categoria">
                  <Select
                    value={formData.category}
                    onValueChange={(value: string) =>
                      setFormData(prev => ({
                        ...prev,
                        category: value as TemplateFormData['category'],
                      }))
                    }
                  >
                    <SelectTrigger id="modelo-categoria" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {channelConfig.categories.map((cat: string) => (
                        <SelectItem key={cat} value={cat}>
                          {t(`settings.messageTemplates.form.categories.${cat.toLowerCase()}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoDaJanela>
                <CampoDaJanela rotulo={t('settings.messageTemplates.form.language')} htmlFor="modelo-idioma">
                  <Select
                    value={formData.language}
                    onValueChange={value => setFormData(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger id="modelo-idioma" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en_US">Inglês (EUA)</SelectItem>
                      <SelectItem value="es_ES">Espanhol</SelectItem>
                    </SelectContent>
                  </Select>
                </CampoDaJanela>
                <CampoDaJanela rotulo={t('settings.messageTemplates.form.templateType')} htmlFor="modelo-tipo" colunas={2}>
                  <Select
                    value={formData.template_type}
                    onValueChange={(value: string) =>
                      setFormData(prev => ({
                        ...prev,
                        template_type: value as TemplateFormData['template_type'],
                      }))
                    }
                  >
                    <SelectTrigger id="modelo-tipo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {channelConfig.templateTypes.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {t(`settings.messageTemplates.form.templateTypes.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoDaJanela>
              </GradeDaJanela>
            </GrupoDaJanela>

            {/* Structured Components (WhatsApp, Facebook, Instagram) */}
            {isStructured && channelConfig.supportsStructured && (
              <>
                {/* Header */}
                {channelConfig.supportsMedia && (
                  <GrupoDaJanela titulo={t('settings.messageTemplates.form.groupHeader')}>
                    <GradeDaJanela>
                      <CampoDaJanela
                        rotulo={t('settings.messageTemplates.form.headerFormat')}
                        htmlFor="modelo-cabecalho-formato"
                        colunas={formData.headerFormat === 'TEXT' ? 1 : 4}
                      >
                        <Select
                          value={formData.headerFormat}
                          onValueChange={(value: string) =>
                            setFormData(prev => ({
                              ...prev,
                              headerFormat: value as TemplateFormData['headerFormat'],
                            }))
                          }
                        >
                          <SelectTrigger id="modelo-cabecalho-formato" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TEXT">
                              {t('settings.messageTemplates.form.headerFormats.text')}
                            </SelectItem>
                            <SelectItem value="IMAGE">
                              {t('settings.messageTemplates.form.headerFormats.image')}
                            </SelectItem>
                            <SelectItem value="VIDEO">
                              {t('settings.messageTemplates.form.headerFormats.video')}
                            </SelectItem>
                            <SelectItem value="DOCUMENT">
                              {t('settings.messageTemplates.form.headerFormats.document')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </CampoDaJanela>
                      {formData.headerFormat === 'TEXT' && (
                        <CampoDaJanela
                          rotulo={t('settings.messageTemplates.form.headerText')}
                          htmlFor="modelo-cabecalho-texto"
                          colunas={3}
                        >
                          <Input
                            id="modelo-cabecalho-texto"
                            value={formData.headerText}
                            onChange={e =>
                              setFormData(prev => ({ ...prev, headerText: e.target.value }))
                            }
                            placeholder={t('settings.messageTemplates.form.headerTextPlaceholder')}
                          />
                        </CampoDaJanela>
                      )}
                    </GradeDaJanela>
                  </GrupoDaJanela>
                )}

                {/* Body + Footer */}
                <GrupoDaJanela titulo={t('settings.messageTemplates.form.groupBody')}>
                  <CampoDaJanela
                    rotulo={t('settings.messageTemplates.form.bodyText')}
                    htmlFor="modelo-corpo"
                    obrigatorio
                    ajuda={t('settings.messageTemplates.form.variablesHelp')}
                  >
                    <Textarea
                      id="modelo-corpo"
                      value={formData.bodyText}
                      onChange={e => setFormData(prev => ({ ...prev, bodyText: e.target.value }))}
                      placeholder={t('settings.messageTemplates.form.bodyTextPlaceholder')}
                      rows={4}
                    />
                  </CampoDaJanela>
                  <CampoDaJanela rotulo={t('settings.messageTemplates.form.footerText')} htmlFor="modelo-rodape">
                    <Input
                      id="modelo-rodape"
                      value={formData.footerText}
                      onChange={e => setFormData(prev => ({ ...prev, footerText: e.target.value }))}
                      placeholder={t('settings.messageTemplates.form.footerTextPlaceholder')}
                    />
                  </CampoDaJanela>
                </GrupoDaJanela>

                {/* Buttons */}
                {channelConfig.supportsButtons && (
                  <GrupoDaJanela
                    titulo={t('settings.messageTemplates.form.buttons')}
                    acao={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addButton}
                        disabled={(formData.buttons?.length || 0) >= 3}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('settings.messageTemplates.form.addButton')}
                      </Button>
                    }
                  >
                    {formData.buttons?.map((button, index) => (
                      <div key={index} className={cn('grid gap-3', index > 0 && 'border-t border-border pt-3')}>
                        <GradeDaJanela>
                          <CampoDaJanela rotulo={t('settings.messageTemplates.form.buttonType')} colunas={2}>
                            <Select
                              value={button.type}
                              onValueChange={(value: string) => updateButton(index, 'type', value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="QUICK_REPLY">
                                  {t('settings.messageTemplates.form.buttonTypes.quickReply')}
                                </SelectItem>
                                <SelectItem value="URL">
                                  {t('settings.messageTemplates.form.buttonTypes.url')}
                                </SelectItem>
                                <SelectItem value="PHONE_NUMBER">
                                  {t('settings.messageTemplates.form.buttonTypes.phone')}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </CampoDaJanela>
                          <CampoDaJanela rotulo={t('settings.messageTemplates.form.buttonText')} colunas={2}>
                            <div className="flex items-center gap-2">
                              <Input
                                value={button.text}
                                onChange={e => updateButton(index, 'text', e.target.value)}
                                placeholder={t('settings.messageTemplates.form.buttonTextPlaceholder')}
                                aria-label={t('settings.messageTemplates.form.buttonText')}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                onClick={() => removeButton(index)}
                                aria-label="Remover botão"
                                title="Remover botão"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CampoDaJanela>

                          {button.type === 'URL' && (
                            <CampoDaJanela rotulo={t('settings.messageTemplates.form.buttonTypes.url')} colunas={4}>
                              <Input
                                value={button.url || ''}
                                onChange={e => updateButton(index, 'url', e.target.value)}
                                placeholder={t('settings.messageTemplates.form.urlPlaceholder')}
                                aria-label={t('settings.messageTemplates.form.buttonTypes.url')}
                              />
                            </CampoDaJanela>
                          )}

                          {button.type === 'PHONE_NUMBER' && (
                            <CampoDaJanela rotulo={t('settings.messageTemplates.form.buttonTypes.phone')} colunas={4}>
                              <Input
                                value={button.phone_number || ''}
                                onChange={e => updateButton(index, 'phoneNumber', e.target.value)}
                                placeholder={t('settings.messageTemplates.form.phonePlaceholder')}
                                aria-label={t('settings.messageTemplates.form.buttonTypes.phone')}
                              />
                            </CampoDaJanela>
                          )}
                        </GradeDaJanela>
                      </div>
                    ))}
                  </GrupoDaJanela>
                )}
              </>
            )}

            {/* Email-specific fields */}
            {channelType === 'Channel::Email' && (
              <GrupoDaJanela titulo={t('settings.messageTemplates.form.groupEmail')}>
                <CampoDaJanela rotulo={t('settings.messageTemplates.form.subject')} htmlFor="modelo-assunto">
                  <Input
                    id="modelo-assunto"
                    value={formData.subject || ''}
                    onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder={t('settings.messageTemplates.form.subjectPlaceholder')}
                  />
                </CampoDaJanela>
              </GrupoDaJanela>
            )}

            {/* Simple Text Content (SMS, API, Telegram, Line) */}
            {/* Note: Email templates are edited in a dedicated page, not in this modal */}
            {!isStructured && (
              <GrupoDaJanela titulo={t('settings.messageTemplates.form.content')}>
                <CampoDaJanela
                  rotulo={t('settings.messageTemplates.form.content')}
                  htmlFor="modelo-conteudo"
                  obrigatorio
                  ajuda={channelConfig.usesLiquid ? t('settings.messageTemplates.form.liquidHelp') : undefined}
                >
                  <Textarea
                    id="modelo-conteudo"
                    value={formData.content}
                    onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={t('settings.messageTemplates.form.contentPlaceholder')}
                    rows={6}
                  />
                </CampoDaJanela>
              </GrupoDaJanela>
            )}

            {/* Active toggle */}
            <GrupoDaJanela titulo={t('settings.messageTemplates.form.groupState')}>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={formData.active !== false}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, active: checked === true }))}
                />
                <span>
                  <span className="font-medium">{t('settings.messageTemplates.form.active')}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t('settings.messageTemplates.form.activeHelp')}
                  </span>
                </span>
              </label>
            </GrupoDaJanela>
          </div>

          {/* Preview - Sticky on larger screens */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <TemplatePreview template={formData} channelType={channelType} t={t} />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            {t('settings.messageTemplates.form.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid}>
            {mode === 'create'
              ? t('settings.messageTemplates.form.create')
              : t('settings.messageTemplates.form.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MessageTemplateForm: React.FC<MessageTemplateFormProps> = ({
  inboxId,
  channelType,
  onUpdate,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage('channels');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<'name' | 'category' | 'status' | 'created_at'>(
    'name',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null);

  const canSync = supportsTemplateSync(channelType);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await MessageTemplateService.getTemplates(inboxId);
      setTemplates(response.data);
    } catch (error) {
      console.error(t('settings.messageTemplates.errors.loadError'), error);
      toast.error(t('settings.messageTemplates.errors.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [inboxId, t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filteredAndSortedTemplates = useMemo(() => {
    const filtered = templates.filter(
      template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.category && template.category.toLowerCase().includes(searchQuery.toLowerCase())),
    );

    filtered.sort((a, b) => {
      let aValue: string | number = (a[sortColumn] as string | number) || '';
      let bValue: string | number = (b[sortColumn] as string | number) || '';

      if (sortColumn === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    return filtered;
  }, [templates, searchQuery, sortColumn, sortDirection]);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleSyncTemplates = async () => {
    setIsSyncing(true);
    try {
      await MessageTemplateService.syncTemplates(inboxId);
      toast.success(t('settings.messageTemplates.success.syncSuccess'));
      await loadTemplates();
    } catch (error) {
      console.error(t('settings.messageTemplates.errors.syncError'), error);
      toast.error(t('settings.messageTemplates.errors.syncError'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateTemplate = async (templateData: TemplateFormData) => {
    try {
      await MessageTemplateService.createTemplate(inboxId, templateData, channelType);
      toast.success(t('settings.messageTemplates.success.createSuccess'));
      await loadTemplates();
      onUpdate?.();
    } catch (error) {
      console.error(t('settings.messageTemplates.errors.createError'), error);
      toast.error(t('settings.messageTemplates.errors.createError'));
    }
  };

  const handleEditTemplate = async (templateData: TemplateFormData) => {
    if (!editingTemplate || !editingTemplate.id) return;

    try {
      await MessageTemplateService.updateTemplate(
        inboxId,
        editingTemplate.id,
        templateData,
        channelType,
      );
      toast.success(t('settings.messageTemplates.success.updateSuccess'));
      await loadTemplates();
      onUpdate?.();
    } catch (error) {
      console.error(t('settings.messageTemplates.errors.updateError'), error);
      toast.error(t('settings.messageTemplates.errors.updateError'));
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete || !templateToDelete.id) return;

    try {
      await MessageTemplateService.deleteTemplate(inboxId, templateToDelete.id);
      toast.success(t('settings.messageTemplates.success.deleteSuccess'));
      await loadTemplates();
      onUpdate?.();
    } catch (error) {
      console.error(t('settings.messageTemplates.errors.deleteError'), error);
      toast.error(t('settings.messageTemplates.errors.deleteError'));
    } finally {
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
    }
  };

  const openEditModal = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setShowFormModal(true);
  };

  const openDeleteConfirm = (template: MessageTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
  };

  const getStatusBadge = (status?: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      APPROVED: {
        color: 'bg-green-600 dark:bg-green-500 text-white',
        text: t('settings.messageTemplates.status.approved'),
      },
      PENDING: {
        color: 'bg-orange-600 dark:bg-orange-500 text-white',
        text: t('settings.messageTemplates.status.pending'),
      },
      REJECTED: {
        color: 'bg-red-600 dark:bg-red-500 text-white',
        text: t('settings.messageTemplates.status.rejected'),
      },
      PAUSED: {
        color: 'bg-gray-600 dark:bg-gray-500 text-white',
        text: t('settings.messageTemplates.status.paused'),
      },
      ACTIVE: {
        color: 'bg-green-600 dark:bg-green-500 text-white',
        text: t('settings.messageTemplates.status.active'),
      },
      INACTIVE: {
        color: 'bg-gray-600 dark:bg-gray-500 text-white',
        text: t('settings.messageTemplates.status.inactive'),
      },
    };

    const config = statusConfig[status || 'ACTIVE'] || statusConfig.ACTIVE;
    return <Badge className={config.color}>{config.text}</Badge>;
  };

  const getCategoryBadge = (category?: string) => {
    if (!category) return null;

    const categoryConfig: Record<string, { color: string }> = {
      MARKETING: { color: 'bg-blue-600 dark:bg-blue-500 text-white' },
      UTILITY: { color: 'bg-green-600 dark:bg-green-500 text-white' },
      AUTHENTICATION: { color: 'bg-purple-600 dark:bg-purple-500 text-white' },
      TRANSACTIONAL: { color: 'bg-orange-600 dark:bg-orange-500 text-white' },
    };

    const config = categoryConfig[category] || { color: 'bg-gray-600 dark:bg-gray-500 text-white' };
    return (
      <Badge className={config.color}>
        {t(`settings.messageTemplates.categories.${category.toLowerCase()}`)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t('settings.messageTemplates.title')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('settings.messageTemplates.description')}
          </p>
        </div>
        <div className="flex gap-2">
          {canSync && (
            <Button variant="outline" onClick={handleSyncTemplates} loading={isSyncing}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('settings.messageTemplates.actions.sync')}
            </Button>
          )}
          <Button
            onClick={() => {
              if (channelType === 'Channel::Email') {
                // Redirect to dedicated email template editor page
                navigate(
                  `/settings/email-template-editor?inboxId=${inboxId}&channelType=${encodeURIComponent(
                    channelType,
                  )}`,
                );
              } else {
                // Use modal for other channel types
                setShowFormModal(true);
              }
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('settings.messageTemplates.newTemplate')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('settings.messageTemplates.searchPlaceholder')}
            className="pl-10"
          />
        </div>
      </div>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {t('settings.messageTemplates.table.name')}
                    {sortColumn === 'name' &&
                      (sortDirection === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      ))}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {t('settings.messageTemplates.table.category')}
                    {sortColumn === 'category' &&
                      (sortDirection === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      ))}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {t('settings.messageTemplates.table.status')}
                    {sortColumn === 'status' &&
                      (sortDirection === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      ))}
                  </button>
                </TableHead>
                <TableHead>{t('settings.messageTemplates.table.language')}</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {t('settings.messageTemplates.table.createdAt')}
                    {sortColumn === 'created_at' &&
                      (sortDirection === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      ))}
                  </button>
                </TableHead>
                <TableHead className="w-32">
                  {t('settings.messageTemplates.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTemplates.map(template => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{getCategoryBadge(template.category)}</TableCell>
                  <TableCell>{getStatusBadge(template.status)}</TableCell>
                  <TableCell>{template.language}</TableCell>
                  <TableCell>
                    {template.created_at
                      ? formatDateBR(template.created_at)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowPreview(true);
                        }}
                        aria-label="Visualizar modelo"
                        title="Visualizar modelo"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (channelType === 'Channel::Email') {
                            // Redirect to dedicated email template editor page
                            navigate(
                              `/settings/email-template-editor?inboxId=${inboxId}&templateId=${
                                template.id
                              }&channelType=${encodeURIComponent(channelType)}`,
                            );
                          } else {
                            // Use modal for other channel types
                            openEditModal(template);
                          }
                        }}
                        aria-label="Editar modelo"
                        title="Editar modelo"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteConfirm(template)}
                        aria-label="Excluir modelo"
                        title="Excluir modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredAndSortedTemplates.length === 0 && (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {t('settings.messageTemplates.emptyState.title')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? t('settings.messageTemplates.emptyState.searchEmpty')
                  : t('settings.messageTemplates.emptyState.description')}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => {
                    if (channelType === 'Channel::Email') {
                      // Redirect to dedicated email template editor page
                      navigate(
                        `/settings/email-template-editor?inboxId=${inboxId}&channelType=${encodeURIComponent(
                          channelType,
                        )}`,
                      );
                    } else {
                      // Use modal for other channel types
                      setShowFormModal(true);
                    }
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('settings.messageTemplates.newTemplate')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Form Modal */}
      <TemplateFormModal
        isOpen={showFormModal}
        template={editingTemplate || undefined}
        mode={editingTemplate ? 'edit' : 'create'}
        channelType={channelType}
        onClose={() => {
          setShowFormModal(false);
          setEditingTemplate(null);
        }}
        onSave={editingTemplate ? handleEditTemplate : handleCreateTemplate}
        t={t}
      />

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('settings.messageTemplates.preview.modalTitle')}</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <TemplatePreview
              template={MessageTemplateService.transformToFrontendFormat(
                selectedTemplate,
                channelType,
              )}
              channelType={channelType}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.messageTemplates.deleteDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 dark:text-slate-400">
              {t('settings.messageTemplates.deleteDialog.message', {
                templateName: templateToDelete?.name,
              })}
            </p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-2">
              {t('settings.messageTemplates.deleteDialog.warning')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('settings.messageTemplates.deleteDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>
              {t('settings.messageTemplates.deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessageTemplateForm;
