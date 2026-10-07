import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import NotificationCenter from './NotificationCenter';
import { toast } from 'sonner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import BaseHeader from '@/components/base/BaseHeader';
import { Pagina } from '@/components/base';
import BarraSalvar from '@/components/base/BarraSalvar';
import Chave from '@/components/base/Chave';
import IconActionButton from '@/components/base/IconActionButton';
import { useAlteracoesNaoSalvas, mesmoConteudo } from '@/hooks/useAlteracoesNaoSalvas';
import { accountService } from '@/services/account/accountService';
import { useAppDataStore } from '@/store/appDataStore';
import type { Account, FormDataOptions, UpdateAccount } from '@/types/settings';
import { Copy, Users2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { SettingsTour } from '@/tours';

// Tela piloto da Fase 3 (base de design e linguagem). Antes, três jeitos de
// salvar conviviam aqui: "Transcrição de áudio" salvava na hora; "Resolução
// automática" salvava sozinha ao DESLIGAR mas, ao ligar, só abria os campos e
// esperava um segundo botão ("meio ligada"); e "Ignorar conversas aguardando"
// era uma chave que esperava esse botão. Agora:
//   - chave = efeito na hora (Transcrição, Resolução automática);
//   - ligar a Resolução pergunta o tempo e a mensagem ali mesmo e já grava;
//   - todo o resto é campo (ou caixinha) e espera a BarraSalvar, que só
//     aparece quando há alteração — e sair com alteração pergunta antes.
// O que o sistema faz com a conversa NÃO mudou.

interface SectionLayoutProps {
  title: string;
  description: string;
  withBorder?: boolean;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

function SectionLayout({
  title,
  description,
  withBorder = false,
  children,
  headerActions,
}: SectionLayoutProps) {
  return (
    <section className={`pt-8 ${withBorder ? 'border-t border-sidebar-border' : ''} pb-8`}>
      <div className="grid grid-cols-4 gap-5 mb-5">
        <div className="col-span-3">
          <h4 className="text-lg font-medium text-sidebar-foreground mb-2">{title}</h4>
          <p className="text-sidebar-foreground/70 text-sm">{description}</p>
        </div>
        <div className="col-span-1 flex justify-end">{headerActions}</div>
      </div>
      <div className="text-sidebar-foreground">{children}</div>
    </section>
  );
}

interface FormState {
  name: string;
  locale: string;
  domain: string;
  supportEmail: string;
  autoResolveAfter: number;
  autoResolveMessage: string;
  autoResolveIgnoreWaiting: boolean;
  autoResolveLabel: string;
  audioTranscriptions: boolean;
  autoResolveEnabled: boolean;
}

const FORM_VAZIO: FormState = {
  name: '',
  locale: 'pt-BR',
  domain: '',
  supportEmail: '',
  autoResolveAfter: 0,
  autoResolveMessage: '',
  autoResolveIgnoreWaiting: false,
  autoResolveLabel: 'none',
  audioTranscriptions: false,
  autoResolveEnabled: false,
};

// O que a BarraSalvar cuida. As duas chaves (Transcrição e Resolução ligada)
// ficam de fora: elas gravam na hora.
const camposGerais = (f: FormState) => ({ name: f.name, locale: f.locale, domain: f.domain, supportEmail: f.supportEmail });
const camposResolucao = (f: FormState) => ({
  autoResolveAfter: f.autoResolveAfter,
  autoResolveMessage: f.autoResolveMessage,
  autoResolveIgnoreWaiting: f.autoResolveIgnoreWaiting,
  autoResolveLabel: f.autoResolveLabel,
});

const TEMPO_MINIMO = 10;
const TEMPO_SUGERIDO = 1440; // 24 horas

interface PedidoLigarResolucao {
  responder: (resposta: { tempo: number; mensagem: string } | null) => void;
}

export default function AccountSettings() {
  const { t } = useLanguage('accountSettings');
  const navigate = useNavigate();
  const { can, isReady: permissionsReady } = useUserPermissions();
  const normalizeAccountLocale = (locale?: string | null): string => {
    if (!locale) return 'pt-BR';
    const normalized = locale.replace('_', '-');
    if (normalized.toLowerCase() === 'pt-br') return 'pt-BR';
    return normalized;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<FormState>(FORM_VAZIO);
  const [carregado, setCarregado] = useState<FormState | null>(null);
  const [formDataOptions, setFormDataOptions] = useState<FormDataOptions>({
    inboxes: [],
    agents: [],
    teams: [],
    labels: [],
  });
  const [globalConfig, setGlobalConfig] = useState<{
    gitSha?: string;
    appVersion?: string;
    isOnEvolutionCloud?: boolean;
  }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pedidoLigar, setPedidoLigar] = useState<PedidoLigarResolucao | null>(null);
  const [tempoAoLigar, setTempoAoLigar] = useState(TEMPO_SUGERIDO);
  const [mensagemAoLigar, setMensagemAoLigar] = useState('');
  const pedidoAberto = useRef<PedidoLigarResolucao | null>(null);

  const temAlteracao =
    !!carregado &&
    (!mesmoConteudo(camposGerais(formData), camposGerais(carregado)) ||
      (formData.autoResolveEnabled && !mesmoConteudo(camposResolucao(formData), camposResolucao(carregado))));
  useAlteracoesNaoSalvas(temAlteracao);

  // Linguagens disponíveis - baseado no LANGUAGES_CONFIG do Evolution
  // Apenas idiomas com enabled: true e que estão em SUPPORTED_LOCALES
  const languages = [
    { code: 'en', name: 'English (en)' },
    { code: 'fr', name: 'Français (fr)' },
    { code: 'it', name: 'Italiano (it)' },
    { code: 'es', name: 'Español (es)' },
    { code: 'pt', name: 'Português (pt)' },
    { code: 'pt-BR', name: 'Português Brasileiro (pt-BR)' },
  ];

  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    loadAccountData();
  }, [permissionsReady]);

  const loadAccountData = async () => {
    if (!can('accounts', 'read')) {
      toast.error(t('messages.permissionDenied.read'));
      return;
    }
    try {
      setLoading(true);
      const [accountData, formDataRes, configRes] = await Promise.all([
        accountService.getAccount(),
        accountService.getFormData(),
        accountService.getGlobalConfig(),
      ]);

      setAccount(accountData);
      setFormDataOptions(formDataRes);
      setGlobalConfig(configRes);

      const settings = accountData.settings || {};
      const novo: FormState = {
        name: accountData.name || '',
        locale: normalizeAccountLocale(accountData.locale || 'pt-BR'),
        domain: accountData.domain || '',
        supportEmail: accountData.support_email || '',
        autoResolveAfter: settings.auto_resolve_after || 0,
        autoResolveMessage: settings.auto_resolve_message || '',
        autoResolveIgnoreWaiting: settings.auto_resolve_ignore_waiting || false,
        autoResolveLabel: settings.auto_resolve_label || 'none',
        audioTranscriptions: settings.audio_transcriptions || false,
        autoResolveEnabled: !!settings.auto_resolve_after,
      };
      setFormData(novo);
      setCarregado(novo);
      setErrors({});
    } catch (error) {
      console.error('Erro ao carregar dados da conta:', error);
      toast.error(t('messages.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof FormState, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('validation.nameRequired');
    }

    if (!formData.locale) {
      newErrors.locale = t('validation.localeRequired');
    }

    if (formData.autoResolveEnabled && formData.autoResolveAfter < TEMPO_MINIMO) {
      newErrors.autoResolveAfter = t('validation.minAutoResolveTime');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const recarregarTudo = async () => {
    await loadAccountData();
    // O nome no topo (Header) vem do store global: atualiza sem recarregar a página.
    await useAppDataStore.getState().fetchAccount(true);
  };

  // Uma gravação só pro que a BarraSalvar cuida: manda o bloco geral e/ou o da
  // resolução, conforme o que mudou.
  const salvar = async () => {
    if (!carregado) return;
    if (!can('accounts', 'update')) {
      toast.error(t('messages.permissionDenied.update'));
      return;
    }
    if (!validateForm()) return;

    const payload: UpdateAccount = {};
    if (!mesmoConteudo(camposGerais(formData), camposGerais(carregado))) {
      payload.name = formData.name;
      payload.locale = normalizeAccountLocale(formData.locale);
      payload.domain = formData.domain;
      payload.support_email = formData.supportEmail;
    }
    if (formData.autoResolveEnabled && !mesmoConteudo(camposResolucao(formData), camposResolucao(carregado))) {
      payload.auto_resolve_after = formData.autoResolveAfter;
      payload.auto_resolve_message = formData.autoResolveMessage;
      payload.auto_resolve_ignore_waiting = formData.autoResolveIgnoreWaiting;
      payload.auto_resolve_label = formData.autoResolveLabel === 'none' ? null : formData.autoResolveLabel;
    }

    setSaving(true);
    try {
      await accountService.updateAccount(payload);
      toast.success('Salvo');
      await recarregarTudo();
    } catch (error: unknown) {
      console.error('Erro ao salvar:', error);
      toast.error((error as Error).message || t('messages.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const descartar = () => {
    if (carregado) setFormData(carregado);
    setErrors({});
  };

  // Ligar pergunta o tempo e a mensagem numa janela. A Chave espera a resposta:
  // `false` (desistiu) volta sem aviso.
  const perguntarAoLigar = () =>
    new Promise<{ tempo: number; mensagem: string } | null>(resolve => {
      setTempoAoLigar(formData.autoResolveAfter >= TEMPO_MINIMO ? formData.autoResolveAfter : TEMPO_SUGERIDO);
      setMensagemAoLigar(formData.autoResolveMessage);
      const pedido = { responder: resolve };
      pedidoAberto.current = pedido;
      setPedidoLigar(pedido);
    });

  const responderPedido = (resposta: { tempo: number; mensagem: string } | null) => {
    pedidoAberto.current?.responder(resposta);
    pedidoAberto.current = null;
    setPedidoLigar(null);
  };

  const ligarDesligarResolucao = async (ligar: boolean): Promise<boolean | void> => {
    if (ligar) {
      const resposta = await perguntarAoLigar();
      if (!resposta) return false;
      await accountService.updateAccount({
        auto_resolve_after: resposta.tempo,
        auto_resolve_message: resposta.mensagem,
        auto_resolve_ignore_waiting: formData.autoResolveIgnoreWaiting,
        auto_resolve_label: formData.autoResolveLabel === 'none' ? null : formData.autoResolveLabel,
      });
      const patch = {
        autoResolveEnabled: true,
        autoResolveAfter: resposta.tempo,
        autoResolveMessage: resposta.mensagem,
      };
      setFormData(prev => ({ ...prev, ...patch }));
      setCarregado(prev => (prev ? { ...prev, ...patch } : prev));
    } else {
      await accountService.updateAccount({
        auto_resolve_after: null,
        auto_resolve_message: '',
        auto_resolve_ignore_waiting: false,
        auto_resolve_label: null,
      });
      const patch = {
        autoResolveEnabled: false,
        autoResolveAfter: 0,
        autoResolveMessage: '',
        autoResolveIgnoreWaiting: false,
        autoResolveLabel: 'none',
      };
      setFormData(prev => ({ ...prev, ...patch }));
      setCarregado(prev => (prev ? { ...prev, ...patch } : prev));
    }
  };

  const ligarDesligarTranscricao = async (ligar: boolean) => {
    await accountService.updateAccount({ audio_transcriptions: ligar });
    setFormData(prev => ({ ...prev, audioTranscriptions: ligar }));
    setCarregado(prev => (prev ? { ...prev, audioTranscriptions: ligar } : prev));
  };

  const copyAccountId = () => {
    if (account?.id) {
      navigator.clipboard.writeText(account.id.toString());
      toast.success(t('messages.success.accountIdCopied'));
    }
  };

  const isOnEvolutionCloud = globalConfig.isOnEvolutionCloud;
  const tempoAoLigarValido = tempoAoLigar >= TEMPO_MINIMO;

  if (loading && !carregado) {
    return (
      <div className="h-full flex flex-col p-4">
        <BaseHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sidebar-foreground/60">{t('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Pagina
      rolagem="conteudo"
      cabecalho={
        <div data-tour="settings-header">
          <BaseHeader title={t('title')} subtitle={t('subtitle')} />
        </div>
      }
    >
      <SettingsTour />

      <div className="flex-1 overflow-auto">
        <div className="w-full max-w-5xl">
          {/* Configurações Gerais */}
          <div data-tour="settings-general">
          <SectionLayout
            title={t('sections.general.title')}
            description={t('sections.general.description')}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('fields.name.label')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => handleFieldChange('name', e.target.value)}
                  placeholder={t('fields.name.placeholder')}
                  className={`bg-sidebar border-sidebar-border text-sidebar-foreground ${
                    errors.name ? 'border-red-500' : ''
                  }`}
                  disabled={saving}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="locale">{t('fields.locale.label')}</Label>
                <Select
                  value={formData.locale}
                  onValueChange={value => handleFieldChange('locale', value)}
                >
                  <SelectTrigger
                    id="locale"
                    className={`bg-sidebar border-sidebar-border text-sidebar-foreground ${
                      errors.locale ? 'border-red-500' : ''
                    }`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.locale && <p className="text-sm text-red-500">{errors.locale}</p>}
              </div>

              {account?.features?.custom_reply_domain && (
                <div className="space-y-2">
                  <Label htmlFor="domain">{t('fields.domain.label')}</Label>
                  <Input
                    id="domain"
                    value={formData.domain}
                    onChange={e => handleFieldChange('domain', e.target.value)}
                    placeholder={t('fields.domain.placeholder')}
                    className="bg-sidebar border-sidebar-border text-sidebar-foreground"
                    disabled={saving}
                  />
                  <p className="text-xs text-sidebar-foreground/60">
                    {t('fields.domain.description')}
                  </p>
                </div>
              )}

              {account?.features?.custom_reply_email && (
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">{t('fields.supportEmail.label')}</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={formData.supportEmail}
                    onChange={e => handleFieldChange('supportEmail', e.target.value)}
                    placeholder={t('fields.supportEmail.placeholder')}
                    className="bg-sidebar border-sidebar-border text-sidebar-foreground"
                    disabled={saving}
                  />
                </div>
              )}
            </div>
          </SectionLayout>
          </div>

          {/* Resolução automática */}
          <div data-tour="settings-auto-resolve">
          <SectionLayout
            title={t('sections.autoResolve.title')}
            description={t('sections.autoResolve.description')}
            withBorder
            headerActions={
              <Chave
                rotulo={t('sections.autoResolve.title')}
                semRotuloVisivel
                genero="a"
                ligada={formData.autoResolveEnabled}
                aoMudar={ligarDesligarResolucao}
              />
            }
          >
            {formData.autoResolveEnabled && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="autoResolveAfter">{t('fields.autoResolveTime.label')}</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="autoResolveAfter"
                      type="number"
                      min={TEMPO_MINIMO}
                      max="1438560"
                      value={formData.autoResolveAfter}
                      onChange={e =>
                        handleFieldChange('autoResolveAfter', parseInt(e.target.value) || 0)
                      }
                      className={`w-32 bg-sidebar border-sidebar-border text-sidebar-foreground ${
                        errors.autoResolveAfter ? 'border-red-500' : ''
                      }`}
                    />
                    <span className="text-sm text-sidebar-foreground/60">
                      {t('fields.autoResolveTime.unit')}
                    </span>
                  </div>
                  {errors.autoResolveAfter && (
                    <p className="text-sm text-red-500">{errors.autoResolveAfter}</p>
                  )}
                  <p className="text-xs text-sidebar-foreground/60">
                    {t('fields.autoResolveTime.description')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoResolveMessage">{t('fields.autoResolveMessage.label')}</Label>
                  <Textarea
                    id="autoResolveMessage"
                    value={formData.autoResolveMessage}
                    onChange={e => handleFieldChange('autoResolveMessage', e.target.value)}
                    placeholder={t('fields.autoResolveMessage.placeholder')}
                    className="bg-sidebar border-sidebar-border text-sidebar-foreground"
                    rows={3}
                  />
                </div>

                <div className="bg-sidebar-accent/30 border border-sidebar-border rounded-lg divide-y divide-sidebar-border">
                  <div className="p-3 flex items-center gap-2">
                    <Checkbox
                      id="autoResolveIgnoreWaiting"
                      checked={formData.autoResolveIgnoreWaiting}
                      onCheckedChange={checked => handleFieldChange('autoResolveIgnoreWaiting', checked === true)}
                    />
                    <Label htmlFor="autoResolveIgnoreWaiting" className="text-sm font-normal">
                      {t('fields.ignoreWaiting.label')}
                    </Label>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-sm">{t('fields.applyLabel.label')}</span>
                    <Select
                      value={formData.autoResolveLabel}
                      onValueChange={value => handleFieldChange('autoResolveLabel', value)}
                    >
                      <SelectTrigger className="w-40 bg-sidebar border-sidebar-border text-sidebar-foreground">
                        <SelectValue placeholder={t('fields.applyLabel.placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('fields.applyLabel.none')}</SelectItem>
                        {formDataOptions.labels.map((label: any) => (
                          <SelectItem key={label.title} value={label.title}>
                            {label.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </SectionLayout>
          </div>

          {/* Transcrição de Áudio */}
          {isOnEvolutionCloud && (
            <SectionLayout
              title={t('sections.audioTranscription.title')}
              description={t('sections.audioTranscription.description')}
              withBorder
              headerActions={
                <Chave
                  rotulo={t('sections.audioTranscription.title')}
                  semRotuloVisivel
                  genero="a"
                  ligada={formData.audioTranscriptions}
                  aoMudar={ligarDesligarTranscricao}
                />
              }
            >
              <></>
            </SectionLayout>
          )}

          {/* ID da Conta */}
          <div data-tour="settings-account-id">
          <SectionLayout
            title={t('sections.accountId.title')}
            description={t('sections.accountId.description')}
            withBorder
          >
            <div className="flex items-center gap-2 p-3 bg-sidebar-accent/30 border border-sidebar-border rounded-lg font-mono text-sm">
              <span className="text-sidebar-foreground">{account?.id}</span>
              <IconActionButton
                label="Copiar ID da conta"
                variant="ghost"
                onClick={copyAccountId}
                className="ml-auto"
                icon={<Copy className="h-4 w-4" />}
              />
            </div>
          </SectionLayout>
          </div>

          {/* Central de Notificações. Morava dentro de "Automações de Lead", onde ninguém
              procura os próprios avisos — e pior: cada chave dela cria uma regra que
              aparecia logo abaixo, na mesma tela, como se fosse outra coisa. Aqui é onde
              se procura "quem recebe o quê". */}
          <div className="mt-6">
            <NotificationCenter />
          </div>

          {/* Ponte para a Equipe. Esta tela é a CASA (nome, fuso, avisos); as
              PESSOAS moram em Equipe, e misturar as duas foi o que espalhou o
              assunto por quatro telas. Quem chega aqui procurando "adicionar
              corretor" precisa do caminho, não de mais um formulário. */}
          <SectionLayout
            title="Equipe e acessos"
            description="Cadastrar pessoas, definir cargo e escolher por quais números de WhatsApp cada uma atende."
            withBorder
            headerActions={
              <Button variant="outline" onClick={() => navigate('/equipe')} className="gap-1.5">
                <Users2 className="h-4 w-4" /> Gerenciar equipe
              </Button>
            }
          >
            <p className="text-sm text-sidebar-foreground/70">
              Pessoas, cargos e times ficam numa tela só, em <strong>Equipe</strong>, no menu principal.
            </p>
          </SectionLayout>

          {/* Informações de Build */}
          <div className="text-center py-4 text-sm text-sidebar-foreground/60 border-t border-sidebar-border">
            <div className="flex items-center justify-center gap-4">
              <span>v{globalConfig.appVersion || '1.0.0'}</span>
            </div>
          </div>

          <BarraSalvar visivel={temAlteracao} salvando={saving} aoSalvar={salvar} aoDescartar={descartar} />
        </div>
      </div>

      <Dialog open={!!pedidoLigar} onOpenChange={aberto => { if (!aberto) responderPedido(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar a resolução automática</DialogTitle>
            <DialogDescription>
              Fechar conversas paradas há quanto tempo? A mensagem, se tiver, vai pro lead quando a conversa fechar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tempoAoLigar">{t('fields.autoResolveTime.label')}</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="tempoAoLigar"
                  type="number"
                  min={TEMPO_MINIMO}
                  value={tempoAoLigar}
                  onChange={e => setTempoAoLigar(parseInt(e.target.value) || 0)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">{t('fields.autoResolveTime.unit')} (1440 = 24 horas)</span>
              </div>
              {!tempoAoLigarValido && <p className="text-sm text-red-500">{t('validation.minAutoResolveTime')}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mensagemAoLigar">{t('fields.autoResolveMessage.label')}</Label>
              <Textarea
                id="mensagemAoLigar"
                value={mensagemAoLigar}
                onChange={e => setMensagemAoLigar(e.target.value)}
                placeholder={t('fields.autoResolveMessage.placeholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => responderPedido(null)}>Cancelar</Button>
            <Button
              disabled={!tempoAoLigarValido}
              onClick={() => responderPedido({ tempo: tempoAoLigar, mensagem: mensagemAoLigar })}
            >
              Ligar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Pagina>
  );
}
