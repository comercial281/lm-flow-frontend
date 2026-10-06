// src/pages/SuperAdmin/PushCentral/index.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { dataHora, plural } from '@/lib/formato';
import { AVISO, CORPO_SECAO, PAGINA, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import pushCentralService, {
  type AudienceCount,
  type PushAudience,
  type PushIndexData,
  type PushLog,
  type PushRule,
  type PushRulePayload,
  type PushTenantScope,
} from '@/services/push/pushCentralService';
import { STATUS_CLASS, pedidoDeDisparo, textoDoPublico } from './pushRegras';

/**
 * Comunicação → Push (Área do Admin).
 *
 * Tudo que liga/desliga push nasce AQUI, na tela, com nome em PT-BR — nada de
 * regra escondida em código ou ENV. Três seções na mesma página (06/10: as abas
 * internas viraram seções, fim do terceiro nível):
 *   Regras         -> o que dispara sozinho (push da Leal Mídia)
 *   Disparo manual -> escrever e mandar agora. Confirma ANTES com o público e a
 *                     quantidade, contados pelo servidor (a mesma conta do envio);
 *                     com zero aparelhos o Enviar fica travado.
 *   Histórico      -> o que saiu, pra quem, e o que FALHOU
 *
 * O que a equipe do CLIENTE recebe dentro do CRM mora em Avisos na tela.
 */

const EMPTY_FORM: PushRulePayload = {
  name: '',
  // Campanha e formulário, não "qualquer origem".
  //
  // `lead.novo` pega TODA chegada, inclusive `lead.whatsapp_direto` — e com um
  // WhatsApp por corretor isso vira push a cada estranho que escreve no número
  // pessoal dele: fornecedor, família, engano. Foi o que aconteceu em produção
  // com a APTO PREMIUM em 04/08/2026.
  //
  // Os dois gatilhos abaixo são o lead que o cliente pagou para receber, e é
  // esse que merece tocar o celular de alguém. Quem quiser "qualquer origem"
  // ainda marca na tela — o que muda é só o ponto de partida.
  triggers: ['lead.campanha', 'lead.formulario'],
  tenant_scope: 'all',
  tenant_slugs: [],
  audience: 'admin',
  title: 'Lead novo em {{cliente}}',
  body: '{{nome_lead}} chegou as {{hora}} via {{origem}}',
  url: '',
  is_active: true,
};

const erroDaApi = (e: unknown, reserva: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || reserva;

export default function PushCentral() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [data, setData] = useState<PushIndexData | null>(null);
  const [erroRegras, setErroRegras] = useState(false);
  const [logs, setLogs] = useState<PushLog[] | null>(null);
  const [erroLogs, setErroLogs] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<PushRule | null>(null);
  const [form, setForm] = useState<PushRulePayload>(EMPTY_FORM);
  const [open, setOpen] = useState(false);

  const [manual, setManual] = useState({
    audience: 'admin' as PushAudience,
    tenant_slug: '',
    title: 'Aviso da Leal Mídia',
    body: '',
  });
  const [sending, setSending] = useState(false);
  const [conta, setConta] = useState<AudienceCount | null>(null);
  const [erroConta, setErroConta] = useState(false);
  // 422 do servidor: o cliente escolhido não serve (sem CRM montado etc.). É um
  // motivo para mostrar na tela e travar o Enviar, não um erro de rede.
  const [recusaConta, setRecusaConta] = useState<string | null>(null);
  // Descarta a resposta de uma contagem antiga quando o público mudou no meio.
  const contagemAtual = useRef(0);

  const load = useCallback(async () => {
    setErroRegras(false);
    try {
      const res = await pushCentralService.list();
      setData(res.data.data);
    } catch {
      setErroRegras(true);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setErroLogs(false);
    try {
      const res = await pushCentralService.logs({ limit: 100 });
      setLogs(res.data.data);
    } catch {
      setLogs(null);
      setErroLogs(true);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadLogs();
  }, [load, loadLogs]);

  // Quantas pessoas e aparelhos o disparo alcança AGORA. Devolve a conta para o
  // envio confirmar com o número fresco, não com o que estava na tela.
  const contar = useCallback(async (audience: PushAudience, slug: string): Promise<AudienceCount | null> => {
    const minha = ++contagemAtual.current;
    setConta(null);
    setErroConta(false);
    setRecusaConta(null);
    if (audience === 'client' && !slug) return null;
    try {
      const res = await pushCentralService.audienceCount({ audience, tenant_slug: audience === 'client' ? slug : undefined });
      if (minha !== contagemAtual.current) return null;
      setConta(res.data.data);
      return res.data.data;
    } catch (e) {
      if (minha !== contagemAtual.current) return null;
      const r = (e as { response?: { status?: number; data?: { error?: string } } })?.response;
      if (r?.status === 422 && r.data?.error) setRecusaConta(r.data.error);
      else setErroConta(true);
      return null;
    }
  }, []);

  useEffect(() => {
    void contar(manual.audience, manual.tenant_slug);
  }, [manual.audience, manual.tenant_slug, contar]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (rule: PushRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      triggers: rule.triggers?.length ? rule.triggers : rule.trigger ? [rule.trigger] : [],
      tenant_scope: rule.tenant_scope,
      tenant_slugs: rule.tenant_slugs || [],
      audience: rule.audience,
      title: rule.title,
      body: rule.body,
      url: rule.url || '',
      is_active: rule.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Dê um nome pra regra');
    if (form.triggers.length === 0) return toast.error('Escolha pelo menos um gatilho');
    if (!form.body.trim()) return toast.error('Escreva a mensagem');
    if (form.tenant_scope === 'selected' && form.tenant_slugs.length === 0) {
      return toast.error('Escolha pelo menos um cliente');
    }

    setSaving(true);
    try {
      if (editing) {
        await pushCentralService.update(editing.id, form);
        toast.success('Regra atualizada');
      } else {
        await pushCentralService.create(form);
        toast.success('Regra criada');
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(erroDaApi(e, 'Erro ao salvar a regra'));
    } finally {
      setSaving(false);
    }
  };

  // A Chave vira na hora; se o servidor recusar, ela volta e avisa sozinha.
  const toggle = async (rule: PushRule) => {
    const res = await pushCentralService.toggle(rule.id);
    const atualizada = res.data.data;
    setData(prev => (prev ? { ...prev, rules: prev.rules.map(r => (r.id === rule.id ? atualizada : r)) } : prev));
  };

  const remove = async (rule: PushRule) => {
    if (!(await confirmar({
      titulo: 'Excluir regra',
      descricao: <>Excluir a regra <strong>{rule.name}</strong>?</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await pushCentralService.remove(rule.id);
      toast.success('Regra excluída');
      await load();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const options = data?.options;
  const nomeCliente = options?.tenants.find(t => t.slug === manual.tenant_slug)?.name ?? manual.tenant_slug;

  const motivoDisparo = (() => {
    if (manual.audience === 'client' && !manual.tenant_slug) return 'Escolha o cliente.';
    if (recusaConta) return recusaConta;
    if (erroConta) return 'Não consegui contar os aparelhos.';
    if (!conta) return 'Contando os aparelhos…';
    if (conta.devices === 0) return 'Ninguém neste público está com o push ligado (Modo Plantão): nada sairia.';
    if (!manual.body.trim()) return 'Escreva a mensagem.';
    return '';
  })();

  const sendManual = async () => {
    if (motivoDisparo || sending) return;
    const fresca = await contar(manual.audience, manual.tenant_slug);
    if (!fresca || fresca.devices === 0) return;
    if (!(await confirmar(pedidoDeDisparo(manual.audience, fresca, nomeCliente)))) return;

    setSending(true);
    try {
      const res = await pushCentralService.sendNow({
        audience: manual.audience,
        title: manual.title,
        body: manual.body,
        tenant_slug: manual.audience === 'client' ? manual.tenant_slug : undefined,
      });
      const log = res.data.data;
      if (log?.status === 'no_subscription') {
        toast.error('Ninguém com push ligado (Modo Plantão desligado)');
      } else if (log?.status === 'failed') {
        toast.error(`Falhou: ${log.error || 'erro desconhecido'}`);
      } else {
        toast.success(`Enviado para ${plural(log?.devices ?? 0, 'aparelho', 'aparelhos')}`);
      }
      setManual(m => ({ ...m, body: '' }));
      void loadLogs();
    } catch (e) {
      toast.error(erroDaApi(e, 'Erro ao disparar'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className={PAGINA}>
        <header>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Bell className="h-5 w-5" />
            Push
          </h2>
          <p className={SUBTITULO_SECAO}>
            Avisos no celular quando acontece algo nos clientes. Você escolhe o gatilho, de quais
            clientes e pra quem vai.
          </p>
        </header>

        {data && !data.push_ready && (
          <p className={AVISO}>
            O envio de push não está configurado no servidor. Nada será entregue até isso ser resolvido.
          </p>
        )}

        {/* ── REGRAS ── */}
        <section aria-labelledby="push-regras" className={SECAO}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="push-regras" className={TITULO_SECAO}>Regras</h3>
              <p className={SUBTITULO_SECAO}>O push que chega para a Leal Mídia quando algo acontece nos clientes.</p>
            </div>
            <Button onClick={openNew} disabled={!data}>
              <Plus className="mr-2 h-4 w-4" />
              Nova regra
            </Button>
          </div>
          <div className={CORPO_SECAO}>
            {erroRegras ? (
              <EmptyState tipo="erro" aoTentarDeNovo={() => void load()} className="py-8" />
            ) : !data ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : data.rules.length === 0 ? (
              <EmptyState title="Nenhuma regra ainda" description="Crie a primeira em Nova regra." className="py-8" />
            ) : (
              <div className="grid gap-3">
                {data.rules.map(rule => (
                  <div
                    key={rule.id}
                    className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${
                      rule.superseded ? 'border-dashed opacity-70' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{rule.name}</span>
                        {(rule.triggers_labels?.length ? rule.triggers_labels : [rule.trigger_label]).map(label => (
                          <Badge key={label} variant="outline">
                            {label}
                          </Badge>
                        ))}
                        <Badge variant="outline">{rule.audience_label}</Badge>
                        {rule.superseded && (
                          <Badge variant="outline" className="text-muted-foreground">
                            não dispara mais
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {rule.tenant_scope === 'all'
                            ? 'Todos os clientes'
                            : plural(rule.tenant_slugs.length, 'cliente', 'clientes')}
                        </Badge>
                      </div>
                      <p className="mt-2 break-words text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{rule.title}</span> — {rule.body}
                      </p>
                      {/*
                        Dizer a verdade em vez de mostrar "ligada" para uma regra muda.
                        Push para a equipe do cliente passou a ter dono único (Avisos na
                        tela), porque dois donos faziam o corretor receber o mesmo lead
                        duas vezes.
                      */}
                      {rule.superseded && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Push para a equipe do cliente agora vive em <strong>Avisos na tela</strong>: esta
                          regra está guardada, mas não envia mais nada. O que ela avisava está em:{' '}
                          {rule.superseded_by.join(', ')}.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Chave
                        rotulo={`Regra ${rule.name}`}
                        semRotuloVisivel
                        genero="a"
                        ligada={rule.is_active && !rule.superseded}
                        desabilitada={rule.superseded}
                        aoMudar={() => toggle(rule)}
                      />
                      <Button variant="ghost" size="sm" aria-label={`Editar ${rule.name}`} onClick={() => openEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Excluir ${rule.name}`} onClick={() => void remove(rule)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── DISPARO MANUAL ── */}
        <section aria-labelledby="push-manual" className={SECAO}>
          <h3 id="push-manual" className={TITULO_SECAO}>Disparo manual</h3>
          <p className={SUBTITULO_SECAO}>
            Escreva e mande agora. Antes de sair, a tela confirma para quantas pessoas e aparelhos vai.
          </p>
          <div className={`${CORPO_SECAO} max-w-xl space-y-4`}>
            {!options ? (
              <p className="text-sm text-muted-foreground">
                {erroRegras
                  ? 'Depende da lista de clientes, que não carregou. Use "Tentar de novo" em Regras.'
                  : 'Carregando…'}
              </p>
            ) : (
              <>
                <div>
                  <Label htmlFor="push-para-quem">Para quem</Label>
                  <Seletor
                    id="push-para-quem"
                    className="mt-1 w-full"
                    value={manual.audience}
                    onChange={e => setManual(m => ({ ...m, audience: e.target.value as PushAudience }))}
                  >
                    {options.audiences.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Seletor>
                </div>

                {manual.audience === 'client' && (
                  <div>
                    <Label htmlFor="push-cliente">Cliente</Label>
                    <Seletor
                      id="push-cliente"
                      className="mt-1 w-full"
                      value={manual.tenant_slug}
                      onChange={e => setManual(m => ({ ...m, tenant_slug: e.target.value }))}
                    >
                      <option value="">Escolha o cliente</option>
                      {options.tenants.map(t => (
                        <option key={t.slug} value={t.slug}>
                          {t.name}
                        </option>
                      ))}
                    </Seletor>
                  </div>
                )}

                <div>
                  <Label htmlFor="push-titulo">Título</Label>
                  <Input
                    id="push-titulo"
                    className="mt-1"
                    value={manual.title}
                    onChange={e => setManual(m => ({ ...m, title: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="push-mensagem">Mensagem</Label>
                  <Textarea
                    id="push-mensagem"
                    className="mt-1"
                    rows={3}
                    value={manual.body}
                    onChange={e => setManual(m => ({ ...m, body: e.target.value }))}
                    placeholder="O que você quer avisar agora"
                  />
                </div>

                {conta && conta.devices > 0 && <p className="text-sm">{textoDoPublico(manual.audience, conta, nomeCliente)}</p>}
                {erroConta && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                    Não consegui contar os aparelhos.
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => void contar(manual.audience, manual.tenant_slug)}
                    >
                      Tentar de novo
                    </Button>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void sendManual()} disabled={!!motivoDisparo || sending}>
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Enviar
                  </Button>
                  {motivoDisparo && !erroConta && (
                    <span className="text-xs text-muted-foreground">{motivoDisparo}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── HISTÓRICO ── */}
        <section aria-labelledby="push-historico" className={SECAO}>
          <h3 id="push-historico" className={TITULO_SECAO}>Histórico</h3>
          <p className={SUBTITULO_SECAO}>O que saiu, para quem, e o que falhou.</p>
          <div className={CORPO_SECAO}>
            {erroLogs ? (
              <EmptyState tipo="erro" aoTentarDeNovo={() => void loadLogs()} className="py-8" />
            ) : logs === null ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                title="Nada disparado ainda"
                description="O que sair por regra ou por disparo manual aparece aqui."
                className="py-8"
              />
            ) : (
              <div className="grid gap-2">
                {logs.map(log => (
                  <div key={log.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_CLASS[log.status]}`}>
                          {log.status_label}
                        </span>
                        <span className="truncate font-medium">{log.rule_name}</span>
                        {log.tenant_name && <span className="text-muted-foreground">· {log.tenant_name}</span>}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{dataHora(log.created_at)}</span>
                    </div>
                    <p className="mt-1 break-words text-muted-foreground">
                      {log.title} — {log.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plural(log.devices, 'aparelho', 'aparelhos')} · {plural(log.recipients, 'pessoa', 'pessoas')}
                    </p>
                    {log.error && <p className="mt-1 break-words text-xs text-destructive">Erro: {log.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── JANELA DE REGRA ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regra' : 'Nova regra'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="regra-nome">Nome da regra</Label>
              <Input
                id="regra-nome"
                className="mt-1"
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Lead de tráfego chegou"
              />
            </div>

            <div>
              <Label>Quando disparar</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Marque um ou mais. A regra dispara quando qualquer um acontecer.
              </p>
              <div className="mt-1 max-h-44 space-y-2 overflow-auto rounded-md border p-3">
                {options?.triggers.map(o => {
                  const id = `regra-gatilho-${o.value}`;
                  return (
                    <div key={o.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={id}
                        checked={form.triggers.includes(o.value)}
                        onCheckedChange={v =>
                          setForm(f => ({
                            ...f,
                            triggers: v === true ? [...f.triggers, o.value] : f.triggers.filter(x => x !== o.value),
                          }))
                        }
                      />
                      <label htmlFor={id} className="cursor-pointer">
                        {o.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="regra-escopo">De quais clientes</Label>
              <Seletor
                id="regra-escopo"
                className="mt-1 w-full"
                value={form.tenant_scope}
                onChange={e => setForm(f => ({ ...f, tenant_scope: e.target.value as PushTenantScope }))}
              >
                {options?.tenant_scopes.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Seletor>
            </div>

            {form.tenant_scope === 'selected' && (
              <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-3">
                {options?.tenants.map(t => {
                  const id = `regra-cliente-${t.slug}`;
                  return (
                    <div key={t.slug} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={id}
                        checked={form.tenant_slugs.includes(t.slug)}
                        onCheckedChange={v =>
                          setForm(f => ({
                            ...f,
                            tenant_slugs: v === true ? [...f.tenant_slugs, t.slug] : f.tenant_slugs.filter(s => s !== t.slug),
                          }))
                        }
                      />
                      <label htmlFor={id} className="cursor-pointer">
                        {t.name}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <Label htmlFor="regra-publico">Para quem</Label>
              <Seletor
                id="regra-publico"
                className="mt-1 w-full"
                value={form.audience}
                onChange={e => setForm(f => ({ ...f, audience: e.target.value as PushAudience }))}
              >
                {options?.audiences.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Seletor>
              {/*
                A opção continua na lista porque as regras antigas ainda a usam e
                precisam abrir para edição. Mas criar uma nova assim não avisa
                ninguém, e a tela precisa dizer isso ANTES de a pessoa escrever o
                título e o corpo achando que vai funcionar.
              */}
              {form.audience === 'client' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Regra automática para a equipe do cliente não dispara mais: esses avisos vivem em{' '}
                  <strong>Avisos na tela</strong>. Aqui só continua valendo o push para a Leal Mídia — e o
                  disparo manual, logo abaixo das regras.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="regra-titulo">Título do aviso</Label>
              <Input
                id="regra-titulo"
                className="mt-1"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="regra-mensagem">Mensagem do aviso</Label>
              <Textarea
                id="regra-mensagem"
                className="mt-1"
                rows={3}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">Variáveis: {options?.variables.join(' · ')}</p>
            </div>

            {/* Opção de formulário (espera o Salvar): caixinha, nunca chave. */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="regra-ligada"
                checked={!!form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v === true }))}
              />
              <Label htmlFor="regra-ligada">Regra ligada</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialogoDeConfirmacao}
    </div>
  );
}
