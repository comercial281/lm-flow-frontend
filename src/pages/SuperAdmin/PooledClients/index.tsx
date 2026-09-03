import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LogIn, Users, Loader2, RefreshCw, Building2, X, KeyRound, ExternalLink, Plus, Clock, Megaphone, SlidersHorizontal, Archive, ArchiveRestore, Snowflake, Play, Trash2, List, BarChart3, ScrollText, Gauge, UploadCloud, Eye, EyeOff, MessageCircle, XCircle, Bot, Radio, UserCog, ClipboardList, MessageSquarePlus, Activity, Workflow, Search, ChevronRight } from 'lucide-react';
import api from '@/services/core/api';
import IconActionButton from '@/components/base/IconActionButton';
import NewTenantWizard from './NewTenantWizard';
import ClientBroadcastModal from './ClientBroadcastModal';
import ClientFollowupRolloutModal from './ClientFollowupRolloutModal';
import MemberAccessConfigModal from '../ClientInstances/MemberAccessConfigModal';
import clientInstancesService, { DashboardData, CentralInstance, WhatsappSendResult } from '@/services/clientInstances/clientInstancesService';
import DashboardView from '../ClientInstances/DashboardView';
import LogsView from '../ClientInstances/LogsView';
import UserMetricsView from '../ClientInstances/UserMetricsView';
import ArchivedFeaturesView from './ArchivedFeaturesView';
import LeadsFeed from '../LeadsFeed';
import ClientMode from '../ClientMode';
import OnboardingForms from '../OnboardingForms';
import CustomerFeedbacks from '../CustomerFeedbacks';
import AdminAtividade from '@/pages/Admin/Area/Auditoria';
import { groupCatalogByTheme, itemLabel, matchesQuery, type CatalogItem } from '../featureCatalog';

import { toast } from 'sonner';

import { useConfirmacao } from '@/hooks/useConfirmacao';
type ViewTab =
  | 'clients'
  | 'dashboard'
  | 'logs'
  | 'metrics'
  | 'archived-features'
  | 'leads-ao-vivo'
  | 'modo-cliente'
  | 'formularios'
  | 'sugestoes-bugs'
  | 'atividade';

// Consumo de IA do mês corrente, já cruzado com a franquia contratada.
// Vem pronto do backend (SalesAgents::UsageReport) de propósito: a conta do
// excedente é a mesma que vai virar fatura, e ter a regra em dois lugares é
// como o número da tela e o número cobrado passam a divergir.
interface AiUsage {
  period: string;
  ai_leads: number;          // leads ÚNICOS atendidos no mês (unidade de cobrança)
  replied: number;           // turnos respondidos (um lead tem vários)
  runs: number;
  cost_usd: number;          // custo real com a Anthropic (ela cobra em dólar)
  cost_brl: number;          // o mesmo custo convertido pela cotação do dia
  usd_brl_rate: number;
  usd_brl_source: 'api' | 'config' | 'fallback';
  usd_brl_at: string | null;
  ai_leads_included: number | null;
  overage_leads: number;
  overage_price_brl: number;
  overage_amount_brl: number;
  usage_pct: number | null;
  franchise_status: 'sem_franquia' | 'ok' | 'atencao' | 'estourado';
}
interface PooledTenant {
  id: string; name: string; slug: string; status: string;
  members: number | null; login_url: string; admin_email?: string;
  settings?: Record<string, any>; archived?: boolean; created_at?: string;
  max_whatsapp_channels?: number; whatsapp_channels_used?: number | null;
  campaign_only_inbox?: boolean;
  ai_usage?: AiUsage;
  ai_leads_included?: number | null;
  ai_lead_overage_price_brl?: number;
}
interface Member { id: string; email: string; name?: string; plain_password?: string; }

const STATUS: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Ativo',         cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' },
  trial:     { label: 'Provisionando', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40' },
  error:     { label: 'Erro',          cls: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40' },
  suspended: { label: 'Suspenso',      cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40' },
};

// Origens de lead que o cliente pode ligar/desligar pra entrar no funil.
// As chaves batem 1:1 com LeadOrigin::PipeEntry::GROUPS no backend.
const PIPE_SOURCE_KEYS = ['ads', 'organic', 'form', 'manual'] as const;
const PIPE_SOURCES: { key: string; label: string; desc: string }[] = [
  { key: 'ads',     label: 'Anúncio (Meta)',   desc: 'Lead de campanha: Click-to-WhatsApp ou formulário de anúncio.' },
  { key: 'organic', label: 'WhatsApp orgânico', desc: 'Quem manda a 1ª mensagem no WhatsApp sem ser de anúncio.' },
  { key: 'form',    label: 'Captação / site',   desc: 'Lead de formulário ou landing page do site.' },
  { key: 'manual',  label: 'Manual no CRM',     desc: 'Conversa aberta na mão pelo corretor. Adicionar card na mão nunca é bloqueado.' },
];

// Cor da barra por situação da franquia. Verde/âmbar/vermelho só quando existe
// franquia contratada; sem franquia a barra não aparece, porque não há de quê.
const FRANCHISE_BAR: Record<string, string> = {
  ok: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  estourado: 'bg-red-500',
  sem_franquia: 'bg-violet-500',
};

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// De onde veio a cotação, para o texto que aparece ao passar o mouse no custo.
// Número de dinheiro em tela sem dizer de onde veio e de quando é vira discussão
// na hora de faturar.
function rateNote(u: AiUsage): string {
  // Dólar e cotação com 4 casas, não 2. Este texto existe para alguém CONFERIR
  // a conta, então os dois números precisam ser os mesmos que a conta usou:
  // arredondados (US$ 2,76 × R$ 5,16) dão R$ 14,24 onde a tela mostra R$ 14,25,
  // e numa tela de dinheiro é assim que nasce discussão sobre a fatura.
  const dec = { minimumFractionDigits: 2, maximumFractionDigits: 4 };
  const rate = u.usd_brl_rate.toLocaleString('pt-BR', dec);
  const base = `US$ ${u.cost_usd.toLocaleString('en-US', dec)} · dólar a R$ ${rate}`;
  if (u.usd_brl_source === 'fallback') return `${base} (cotação indisponível, valor de referência)`;
  if (u.usd_brl_source === 'config') return `${base} (cotação fixada na configuração)`;
  const at = u.usd_brl_at ? new Date(u.usd_brl_at).toLocaleString('pt-BR') : null;
  return at ? `${base} (cotação de ${at})` : base;
}

// Linha de consumo de IA no cartão do cliente: quanto ele usou, quanto tem
// direito, quanto custou e quanto isso vira de excedente a cobrar.
// Tudo em real, que é a moeda em que se decide preço aqui. O dólar (que é como a
// Anthropic cobra) e a cotação usada ficam no texto ao passar o mouse: some da
// leitura do dia a dia sem sumir de quem precisa conferir a conta.
function AiUsageLine({ u }: { u?: AiUsage }) {
  if (!u) return null;
  const pct = u.usage_pct;
  return (
    <div className="mt-2">
      <div className="text-xs text-muted-foreground flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
        <Bot className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {u.ai_leads} lead{u.ai_leads === 1 ? '' : 's'} na IA
          {u.ai_leads_included ? ` de ${u.ai_leads_included}` : ''}
        </span>
        {!u.ai_leads_included && <span className="opacity-60">sem franquia</span>}
        <span className="opacity-60 cursor-help" title={rateNote(u)}>
          custo R$ {brl(u.cost_brl)}
          {u.usd_brl_source === 'fallback' && '*'}
        </span>
        {u.overage_leads > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            excedente {u.overage_leads} = R$ {brl(u.overage_amount_brl)}
          </span>
        )}
      </div>
      {typeof pct === 'number' && (
        <div className="h-1 mt-1.5 rounded-full bg-border overflow-hidden">
          <div className={`h-full rounded-full ${FRANCHISE_BAR[u.franchise_status] || 'bg-violet-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function MembersModal({ tenant, onClose }: { tenant: PooledTenant; onClose: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [sendWa, setSendWa] = useState(true);
  const [instances, setInstances] = useState<CentralInstance[]>([]);
  const [instance, setInstance] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [visiblePwds, setVisiblePwds] = useState<Set<string>>(new Set());
  const togglePwd = (id: string) => setVisiblePwds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const loadMembers = () =>
    api.get(`/super/pooled_tenants/${tenant.id}/members`)
      .then(r => setMembers(r.data?.data || []))
      .finally(() => setLoading(false));

  useEffect(() => { loadMembers(); }, [tenant.id]);

  // Instancias remetentes (centrais da Leal Midia). Pre-seleciona a Operacional conectada.
  useEffect(() => {
    clientInstancesService.centralInstances()
      .then(r => {
        const list = r.data.data ?? [];
        setInstances(list);
        const op = list.find(i => i.name.startsWith('Operacional') && i.connected);
        setInstance(prev => prev || op?.name || list.find(i => i.connected)?.name || list[0]?.name || '');
      })
      .catch(() => setInstances([]));
  }, []);

  const phone = newPhone.trim();
  const willSend = !!phone && sendWa;

  const addMember = async () => {
    if (!newEmail.trim() || newPwd.length < 8) { setNotice({ ok: false, text: 'Informe e-mail e senha de ao menos 8 caracteres.' }); return; }
    setAdding(true); setNotice(null);
    try {
      const r = await api.post(`/super/pooled_tenants/${tenant.id}/add_member`, {
        email: newEmail.trim(), name: newName.trim(), password: newPwd,
        whatsapp_number: phone || undefined, send_whatsapp: sendWa, instance: instance || undefined,
      });
      const wa: WhatsappSendResult | undefined = r.data?.whatsapp;
      const who = newName.trim() || newEmail.trim();
      if (!wa || wa.skipped === 'sem telefone') {
        setNotice({ ok: true, text: `Acesso de ${who} criado em ${tenant.slug}.lmflow.com.br` });
      } else if (wa.sent) {
        setNotice({ ok: true, text: `Acesso de ${who} criado e enviado no WhatsApp${wa.instance ? ` (${wa.instance})` : ''}.` });
      } else if (wa.skipped) {
        setNotice({ ok: true, text: `Acesso de ${who} criado. WhatsApp não enviado: ${wa.skipped}.` });
      } else {
        setNotice({ ok: false, text: `Acesso criado, mas o WhatsApp falhou: ${wa.error ?? `HTTP ${wa.http}`}.` });
      }
      setNewEmail(''); setNewName(''); setNewPwd(''); setNewPhone('');
      setLoading(true); await loadMembers();
    } catch (e: any) { setNotice({ ok: false, text: e?.response?.data?.error || 'Falha ao criar acesso.' }); }
    finally { setAdding(false); }
  };

  const removeMember = async (m: Member) => {
    // ⚠️ ESTE window.confirm FICA, POR ORA — e o motivo não é esquecimento.
    // Os outros do painel viraram `useConfirmacao` (Dialog do design system),
    // mas este roda DENTRO de um modal que já é Dialog. Diálogo sobre diálogo
    // mexe com armadilha de foco e empilhamento, e isso não se confere lendo
    // código: precisa de navegador. Numa tela onde a confirmação guarda ação
    // destrutiva em cliente pagante, uma confirmação quebrada é pior que uma
    // feia. Trocar exige abrir e testar.
    if (!window.confirm(`Remover o acesso de ${m.email}? Ele não conseguirá mais logar neste CRM.`)) return;
    setSavingId(m.id);
    try {
      await api.post(`/super/pooled_tenants/${tenant.id}/remove_member`, { user_id: m.id });
      setMembers(prev => prev.filter(x => x.id !== m.id));
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Falha ao remover.'); }
    finally { setSavingId(null); }
  };

  const setPassword = async (m: Member) => {
    // Continua sendo a caixinha do navegador de propósito: o substituto é um
    // Dialog do design system, e este componente já roda dentro de um.
    //
    // Dialog dentro de Dialog mexe com armadilha de foco e com empilhamento, e
    // isso não se confere lendo código: precisa de navegador — e aqui o
    // agravante é que a caixinha tem CAMPO, que precisa receber o foco pra
    // funcionar, justamente o que a armadilha do diálogo de fora disputa.
    const pwd = window.prompt(`Nova senha para ${m.email} (min. 8 caracteres):`);
    if (!pwd) return;
    if (pwd.length < 8) { toast.error('Senha precisa de ao menos 8 caracteres.'); return; }
    setSavingId(m.id);
    try {
      await api.post(`/super/pooled_tenants/${tenant.id}/set_password`, { user_id: m.id, password: pwd });
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, plain_password: pwd } : x));
    } catch { toast.error('Falha ao trocar a senha.'); }
    finally { setSavingId(null); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: '#150a26', border: '1px solid rgba(124,58,237,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <div>
            <h3 className="text-white font-semibold text-sm">Membros - {tenant.name}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{tenant.slug}.lmflow.com.br</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
          ) : members.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum membro.</p>
          ) : members.map(m => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/90 truncate">{m.name || m.email}</div>
                <div className="text-xs text-white/40 truncate">{m.email}</div>
              </div>
              {m.plain_password && (
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-md" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <span className="text-xs font-mono text-white/70" style={{ minWidth: 60 }}>
                    {visiblePwds.has(m.id) ? m.plain_password : '••••••••'}
                  </span>
                  <button onClick={() => togglePwd(m.id)} className="text-white/40 hover:text-white/80 ml-1">
                    {visiblePwds.has(m.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              <button onClick={() => setPassword(m)} disabled={savingId === m.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-white/10 text-white/60 hover:text-white hover:border-violet-500/40 disabled:opacity-50">
                {savingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Trocar senha
              </button>
              {!/@lealmidia\.com\.br$/i.test(m.email) && (
                <button onClick={() => removeMember(m)} disabled={savingId === m.id} title="Remover acesso"
                  className="flex items-center justify-center p-1.5 rounded-md border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <p className="text-xs font-medium text-white/70">Adicionar acesso (e-mail real do cliente)</p>
          {notice && (
            <div className="flex items-start gap-2 rounded-md px-2.5 py-2 text-xs"
              style={{ background: notice.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${notice.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, color: notice.ok ? '#6ee7b7' : '#fca5a5' }}>
              {notice.ok ? <MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              <span className="flex-1">{notice.text}</span>
              <button onClick={() => setNotice(null)} className="text-white/40 hover:text-white/80">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@cliente.com"
              className="flex-1 px-2 py-1.5 rounded text-xs text-white placeholder-white/25 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome"
              className="w-28 px-2 py-1.5 rounded text-xs text-white placeholder-white/25 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
          </div>
          <div className="flex gap-2">
            <input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="senha (min. 8)"
              className="flex-1 px-2 py-1.5 rounded text-xs text-white placeholder-white/25 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
            <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="WhatsApp c/ DDD (opcional)"
              className="flex-1 px-2 py-1.5 rounded text-xs text-white placeholder-white/25 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
          </div>
          {phone && (
            <div className="rounded-md px-2.5 py-2 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                <input type="checkbox" checked={sendWa} onChange={e => setSendWa(e.target.checked)} />
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                Enviar o acesso por WhatsApp (link + login + senha)
              </label>
              {willSend && (
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-xs text-white/40">Enviar por:</span>
                  <select value={instance} onChange={e => setInstance(e.target.value)}
                    className="flex-1 px-2 py-1 rounded text-xs text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    {instances.length === 0 && <option value="">padrão (Operacional LM01)</option>}
                    {instances.map(i => (
                      <option key={i.name} value={i.name} style={{ background: '#150a26' }}>
                        {i.name}{i.connected ? '' : ' (desconectada)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={addMember} disabled={adding}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : willSend ? <MessageCircle className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {willSend ? 'Criar e enviar' : 'Criar acesso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type FeatureItem = CatalogItem;

function FeaturesModal({ tenant, onClose }: { tenant: PooledTenant; onClose: () => void }) {
  const [catalog, setCatalog] = useState<FeatureItem[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Busca e seções recolhidas: são ~60 chaves em 7 temas. Aberto tudo de uma
  // vez é a parede de interruptores que esta tela tinha; recolhido, o tema já
  // diz quantas funções tem e quantas estão ligadas antes de alguém abrir.
  const [query, setQuery] = useState('');
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [savingTheme, setSavingTheme] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/super/pooled_tenants/${tenant.id}/features`)
      .then(r => { setCatalog(r.data?.data?.catalog || []); setFeatures(r.data?.data?.features || {}); })
      .finally(() => setLoading(false));
  }, [tenant.id]);

  // Ausência de chave = LIGADO (mesma regra do resolved_features no servidor).
  const isOn = useCallback((key: string) => features[key] !== false, [features]);

  const toggle = async (key: string) => {
    const next = !features[key];
    setSavingKey(key);
    setFeatures(f => ({ ...f, [key]: next }));
    try {
      const r = await api.patch(`/super/pooled_tenants/${tenant.id}/update_features`, { features: { [key]: next } });
      setFeatures(r.data?.data?.features || {});
    } catch {
      setFeatures(f => ({ ...f, [key]: !next })); // reverte
      toast.error('Falha ao salvar a função.');
    } finally { setSavingKey(null); }
  };

  // Liga/desliga um tema inteiro numa requisição só: o endpoint aceita várias
  // chaves de uma vez, e uma chamada por interruptor deixaria o cliente meio
  // ligado se a rede caísse no meio.
  const toggleTheme = async (themeKey: string, keys: string[], next: boolean) => {
    if (!keys.length) return;
    const prev = features;
    const patch: Record<string, boolean> = {};
    for (const k of keys) patch[k] = next;
    setSavingTheme(themeKey);
    setFeatures(f => ({ ...f, ...patch }));
    try {
      const r = await api.patch(`/super/pooled_tenants/${tenant.id}/update_features`, { features: patch });
      setFeatures(r.data?.data?.features || {});
    } catch {
      setFeatures(prev);
      toast.error('Falha ao salvar as funções deste tema.');
    } finally { setSavingTheme(null); }
  };

  // Durante a busca tudo fica aberto: recolhido, o resultado ficaria escondido
  // atrás de um clique — e quem digitou já disse o que procura.
  const buscando = query.trim().length > 0;
  const seções = groupCatalogByTheme(catalog)
    .map(s => ({
      ...s,
      menus: s.menus
        .map(m => ({ ...m, all: m.all.filter(i => matchesQuery(i, query)) }))
        .filter(m => m.all.length > 0),
      all: s.all.filter(i => matchesQuery(i, query)),
    }))
    .filter(s => s.all.length > 0);

  // Regra de ENTRADA no funil por ORIGEM (tenant.settings.pipe_entry_sources): o
  // cliente escolhe quais origens de lead entram automático no pipeline. Fallback
  // pro legado only_ad_leads (true => só 'ads'; senão todas). Salva via update do
  // pooled_tenants (preserva os group_jids).
  const initialSources: string[] = Array.isArray(tenant.settings?.pipe_entry_sources)
    ? tenant.settings!.pipe_entry_sources
    // Legado only_ad_leads=true barrava SÓ o WhatsApp orgânico (o gate antigo vivia
    // só no caminho de conversa; contato de site/manual sempre entrava). Espelha
    // LeadOrigin::PipeEntry::LEGACY_ONLY_ADS no backend.
    : (tenant.settings?.only_ad_leads
        ? PIPE_SOURCE_KEYS.filter(k => k !== 'organic')
        : [...PIPE_SOURCE_KEYS]);
  const [sources, setSources] = useState<string[]>(initialSources.filter(s => (PIPE_SOURCE_KEYS as readonly string[]).includes(s)));
  const [savingSource, setSavingSource] = useState<string | null>(null);
  const toggleSource = async (key: string) => {
    const next = sources.includes(key) ? sources.filter(s => s !== key) : [...sources, key];
    const prev = sources;
    setSavingSource(key);
    setSources(next);
    try {
      const s = tenant.settings || {};
      await api.patch(`/super/pooled_tenants/${tenant.id}`, {
        name: tenant.name,
        pipe_entry_sources: next,
        whatsapp_reminder_group_jid: s.whatsapp_reminder_group_jid || '',
        whatsapp_logs_group_jid: s.whatsapp_logs_group_jid || '',
      });
    } catch {
      setSources(prev);
      toast.error('Falha ao salvar a regra de entrada no funil.');
    } finally { setSavingSource(null); }
  };

  // Isolamento por corretor: cada corretor só vê os leads dele na caixa e em
  // Contatos. Ligado por padrão no backend (Tenant#broker_isolation? trata chave
  // ausente como true), então aqui `!== false` reflete o mesmo default. Existe
  // para o caso legítimo de caixa compartilhada de propósito — SDR triando,
  // atendimento central.
  const [brokerIsolation, setBrokerIsolation] = useState<boolean>(tenant.settings?.broker_isolation !== false);
  const [savingIsolation, setSavingIsolation] = useState(false);
  const saveBrokerIsolation = async (next: boolean) => {
    const prev = brokerIsolation;
    setBrokerIsolation(next);
    setSavingIsolation(true);
    try {
      await api.patch(`/super/pooled_tenants/${tenant.id}`, { name: tenant.name, broker_isolation: next });
    } catch {
      setBrokerIsolation(prev);
      toast.error('Falha ao salvar o isolamento por corretor.');
    } finally { setSavingIsolation(false); }
  };

  // Inbox só-campanha: a lista de conversas passa a mostrar SÓ quem entrou em
  // algum funil (lead de campanha) ou conversa iniciada na mão pelo painel. Quem
  // o gate de origem barrou — WhatsApp orgânico, form de site — some da caixa
  // também, não só do funil. Par natural do seletor de origens acima: lá se
  // decide o que vira card, aqui se decide se o que não virou card ainda aparece.
  // Default OFF no backend (Tenant#campaign_only_inbox?), então `?? false` aqui
  // reflete o mesmo default para tenant que ainda não tem a chave.
  const [campaignOnly, setCampaignOnly] = useState<boolean>(tenant.campaign_only_inbox ?? false);
  const [savingCampaignOnly, setSavingCampaignOnly] = useState(false);
  const saveCampaignOnly = async (next: boolean) => {
    const prev = campaignOnly;
    setCampaignOnly(next);
    setSavingCampaignOnly(true);
    try {
      await api.patch(`/super/pooled_tenants/${tenant.id}`, { name: tenant.name, campaign_only_inbox: next });
    } catch {
      setCampaignOnly(prev);
      toast.error('Falha ao salvar o inbox só-campanha.');
    } finally { setSavingCampaignOnly(false); }
  };

  // Modo demonstração: arma a trava de saída no backend. O cliente de
  // demonstração tem um número de WhatsApp REAL pareado e leads FICTÍCIOS — com
  // a chave ligada, só recebe mensagem quem escreveu para o número primeiro, e
  // nenhum lead inventado é incomodado por follow-up, funil ou aviso de gestor.
  // Default OFF: chave ausente = cliente normal.
  const [demoMode, setDemoMode] = useState<boolean>(tenant.settings?.demo_mode === true);
  const [savingDemo, setSavingDemo] = useState(false);
  const saveDemoMode = async (next: boolean) => {
    // ⚠️ ESTE window.confirm FICA, POR ORA — e o motivo não é esquecimento.
    // Os outros do painel viraram `useConfirmacao` (Dialog do design system),
    // mas este roda DENTRO de um modal que já é Dialog. Diálogo sobre diálogo
    // mexe com armadilha de foco e empilhamento, e isso não se confere lendo
    // código: precisa de navegador. Numa tela onde a confirmação guarda ação
    // destrutiva em cliente pagante, uma confirmação quebrada é pior que uma
    // feia. Trocar exige abrir e testar.
    if (next && !window.confirm(
      `Ligar o modo demonstração em "${tenant.name}"?\n\n` +
      'A partir daí este cliente só manda WhatsApp para quem escrever para o número dele, ' +
      'e para de mandar e-mail. Use só no CRM de demonstração — num cliente de verdade isso ' +
      'faz o sistema parar de falar com os leads dele.',
    )) return;

    const prev = demoMode;
    setDemoMode(next);
    setSavingDemo(true);
    try {
      await api.patch(`/super/pooled_tenants/${tenant.id}`, { name: tenant.name, demo_mode: next });
    } catch {
      setDemoMode(prev);
      toast.error('Falha ao salvar o modo demonstração.');
    } finally { setSavingDemo(false); }
  };

  // Semear a demo: cria a imobiliária fictícia inteira (equipe, carteira, leads,
  // conversas e funil) com datas relativas ao momento em que roda. O backend
  // recusa se o modo demonstração estiver desligado — dado fictício e trava de
  // saída andam juntos. Idempotente: apertar de novo reaproveita o que existe.
  const [seeding, setSeeding] = useState(false);
  const [seedInfo, setSeedInfo] = useState<string | null>(null);
  const seedDemo = async () => {
    // ⚠️ ESTE window.confirm FICA, POR ORA — e o motivo não é esquecimento.
    // Os outros do painel viraram `useConfirmacao` (Dialog do design system),
    // mas este roda DENTRO de um modal que já é Dialog. Diálogo sobre diálogo
    // mexe com armadilha de foco e empilhamento, e isso não se confere lendo
    // código: precisa de navegador. Numa tela onde a confirmação guarda ação
    // destrutiva em cliente pagante, uma confirmação quebrada é pior que uma
    // feia. Trocar exige abrir e testar.
    if (!window.confirm(
      `Semear a imobiliária fictícia em "${tenant.name}"?\n\n` +
      'Cria equipe, carteira de imóveis, leads, conversas e funil, com datas de hoje. ' +
      'Se o WhatsApp já estiver conectado, o histórico nasce dentro do número real.',
    )) return;

    setSeeding(true);
    setSeedInfo(null);
    try {
      const r = await api.post(`/super/pooled_tenants/${tenant.id}/demo_seed`, { dry_run: false });
      const d = r.data?.data || {};
      setSeedInfo(
        `Pronto: ${d.equipe} pessoas, ${d.imoveis} imóveis, ${d.leads} leads, ${d.cards} cards` +
        (d.caixa?.whatsapp_real ? ' — dentro do número de WhatsApp conectado.' : ' — numa caixa própria (conecte o chip e semeie de novo para o histórico ficar no número real).'),
      );
    } catch (e) {
      // O backend recusa em cliente sem o modo demonstração e devolve o motivo
      // em português — mostrar a mensagem dele é mais útil que um erro genérico.
      const motivo = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSeedInfo(null);
      toast.error(motivo || 'Falha ao semear a demonstração.');
    } finally { setSeeding(false); }
  };

  // Fotos da carteira fictícia. O gerador não inventa imagem de imóvel — usar
  // foto aleatória da internet seria mostrar imóvel de outra pessoa numa
  // apresentação comercial. O dono sobe as fotos uma vez num endereço público e
  // cola os links aqui; ficam guardados na ficha, então sobrevivem ao recomeço.
  const [photoUrls, setPhotoUrls] = useState<string>((tenant.settings?.demo_photo_urls || []).join('\n'));
  const [savingPhotos, setSavingPhotos] = useState(false);
  const savePhotoUrls = async () => {
    setSavingPhotos(true);
    try {
      const lista = photoUrls.split('\n').map(u => u.trim()).filter(Boolean);
      await api.patch(`/super/pooled_tenants/${tenant.id}`, { name: tenant.name, demo_photo_urls: lista });
      setSeedInfo(`${lista.length} foto(s) guardada(s). Semeie de novo para a carteira usá-las.`);
    } catch {
      toast.error('Falha ao salvar as fotos da demonstração.');
    } finally { setSavingPhotos(false); }
  };

  // Recomeçar a demo entre uma call e outra. Limpa TODO o movimento (inclusive o
  // lead do prospect da call anterior) e semeia de novo com datas frescas —
  // preservando canal, acessos e a IA configurada, para o WhatsApp não pedir QR
  // de novo. Confirmação por digitação, igual à de apagar cliente.
  const [resetting, setResetting] = useState(false);
  const resetDemo = async () => {
    // Continua sendo a caixinha do navegador de propósito: o substituto é um
    // Dialog do design system, e este componente já roda dentro de um.
    //
    // Dialog dentro de Dialog mexe com armadilha de foco e com empilhamento, e
    // isso não se confere lendo código: precisa de navegador — e aqui o
    // agravante é que a caixinha tem CAMPO, que precisa receber o foco pra
    // funcionar, justamente o que a armadilha do diálogo de fora disputa.
    //
    // Esta é a confirmação por digitação — a pessoa escreve o slug do
    // cliente pra provar que leu. Trocar por Dialog sem navegador arrisca
    // justamente a trava mais forte do painel.
    const digitado = window.prompt(
      `Recomeçar a demonstração de "${tenant.name}"?\n\n` +
      'Apaga leads, conversas, funil, visitas e propostas, e gera tudo de novo com datas de hoje. ' +
      'O WhatsApp continua conectado.\n\n' +
      `Digite "${tenant.slug}" para confirmar:`,
    );
    if (digitado !== tenant.slug) return;

    setResetting(true);
    setSeedInfo(null);
    try {
      const r = await api.post(`/super/pooled_tenants/${tenant.id}/demo_reset`, { confirm_slug: tenant.slug });
      const d = r.data?.data?.semeadura || {};
      setSeedInfo(`Recomeçada: ${d.leads} leads, ${d.cards} cards, ${d.visitas} visitas, ${d.propostas} propostas.`);
    } catch (e) {
      const motivo = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(motivo || 'Falha ao recomeçar a demonstração.');
    } finally { setResetting(false); }
  };

  // Vistoria: roda o painel por dentro e acusa bloco vazio ou entidade sem
  // exemplo. É o que avisa que uma funcionalidade nova chegou à demo sem dado —
  // antes do cliente ver a tela vazia na call.
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<{ saude?: string; painel?: { vazios?: string[] }; entidades_sem_exemplo?: string[] } | null>(null);
  const runAudit = async () => {
    setAuditing(true);
    try {
      const r = await api.get(`/super/pooled_tenants/${tenant.id}/demo_audit`);
      setAudit(r.data?.data || null);
    } catch (e) {
      const motivo = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(motivo || 'Falha ao vistoriar a demonstração.');
    } finally { setAuditing(false); }
  };

  // Limite de canais de WhatsApp que o cliente pode criar (0 = ilimitado).
  const [maxWa, setMaxWa] = useState<number>(Number(tenant.max_whatsapp_channels ?? tenant.settings?.max_whatsapp_channels ?? 5) || 0);
  const [savingMax, setSavingMax] = useState(false);
  const usedWa = tenant.whatsapp_channels_used;
  const saveMaxWa = async () => {
    setSavingMax(true);
    try {
      const s = tenant.settings || {};
      await api.patch(`/super/pooled_tenants/${tenant.id}`, {
        name: tenant.name,
        only_ad_leads: !!s.only_ad_leads,
        whatsapp_reminder_group_jid: s.whatsapp_reminder_group_jid || '',
        whatsapp_logs_group_jid: s.whatsapp_logs_group_jid || '',
        max_whatsapp_channels: maxWa,
      });
    } catch {
      toast.error('Falha ao salvar o limite de canais.');
    } finally { setSavingMax(false); }
  };

  // Franquia de leads de IA do plano + preço do lead excedente.
  // Vazio = sem franquia contratada: o painel segue mostrando o consumo, mas
  // não calcula excedente (não se cobra por um limite que ninguém combinou).
  const [aiLeads, setAiLeads] = useState<string>(
    tenant.ai_leads_included != null ? String(tenant.ai_leads_included) : ''
  );
  const [aiPrice, setAiPrice] = useState<string>(String(tenant.ai_lead_overage_price_brl ?? 2.49));
  const [savingAi, setSavingAi] = useState(false);
  const saveAiFranchise = async () => {
    setSavingAi(true);
    try {
      const s = tenant.settings || {};
      await api.patch(`/super/pooled_tenants/${tenant.id}`, {
        name: tenant.name,
        // Reenviados junto pelo mesmo motivo do bloco de canais: PATCH parcial
        // aqui já apagou grupo de WhatsApp de cliente antes.
        only_ad_leads: !!s.only_ad_leads,
        whatsapp_reminder_group_jid: s.whatsapp_reminder_group_jid || '',
        whatsapp_logs_group_jid: s.whatsapp_logs_group_jid || '',
        ai_leads_included: aiLeads.trim() === '' ? null : Math.max(0, parseInt(aiLeads, 10) || 0),
        ai_lead_overage_price_brl: aiPrice.trim() === '' ? null : Math.max(0, parseFloat(aiPrice.replace(',', '.')) || 0),
      });
    } catch {
      toast.error('Falha ao salvar a franquia de IA.');
    } finally { setSavingAi(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: '#150a26', border: '1px solid rgba(124,58,237,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <div>
            <h3 className="text-white font-semibold text-sm">Funções - {tenant.name}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Liga/desliga o que o cliente vê em {tenant.slug}.lmflow.com.br</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="text-sm text-white/90">O que entra no funil (padrão do cliente)</div>
            <div className="text-xs text-white/40 mb-2">
              Padrão herdado pelas pipelines que não têm regra própria. Cada pipeline pode
              sobrescrever isso em Pipelines &gt; editar &gt; Entrada de leads.
            </div>
            <div className="space-y-1.5">
              {PIPE_SOURCES.map(src => {
                const on = sources.includes(src.key);
                return (
                  <div key={src.key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/90">{src.label}</div>
                      <div className="text-xs text-white/40">{src.desc}</div>
                    </div>
                    <button onClick={() => toggleSource(src.key)} disabled={savingSource === src.key}
                      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? 'bg-violet-600' : 'bg-white/15'}`}>
                      {savingSource === src.key
                        ? <Loader2 className="w-3 h-3 animate-spin text-white absolute top-1.5 left-3.5" />
                        : <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-1'}`} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90">Máximo de canais de WhatsApp</div>
              <div className="text-xs text-white/40">
                Quantas instâncias este cliente pode conectar. 0 = ilimitado.
                {typeof usedWa === 'number' && <> Usando {usedWa} de {maxWa > 0 ? maxWa : '∞'}.</>}
              </div>
            </div>
            <input type="number" min={0} value={maxWa}
              onChange={e => setMaxWa(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
              className="w-14 px-2 py-1 rounded bg-white/10 text-white text-sm text-center outline-none flex-shrink-0" />
            <button onClick={saveMaxWa} disabled={savingMax}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white flex-shrink-0 disabled:opacity-50">
              {savingMax ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
            </button>
          </div>
          <div className="px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="text-sm text-white/90">Franquia de leads na IA</div>
            <div className="text-xs text-white/40 mt-0.5">
              Quantos leads a IA atende por mês dentro do plano, e quanto custa cada lead acima disso.
              Em branco = sem franquia (mostra o consumo, não cobra excedente).
              Estourar a franquia nunca desliga a IA: o excedente entra na fatura.
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-white/50 flex-shrink-0">Leads/mês</label>
              <input type="number" min={0} value={aiLeads} placeholder="—"
                onChange={e => setAiLeads(e.target.value)}
                className="w-20 px-2 py-1 rounded bg-white/10 text-white text-sm text-center outline-none flex-shrink-0" />
              <label className="text-xs text-white/50 flex-shrink-0 ml-1">Excedente R$</label>
              <input type="text" inputMode="decimal" value={aiPrice}
                onChange={e => setAiPrice(e.target.value)}
                className="w-20 px-2 py-1 rounded bg-white/10 text-white text-sm text-center outline-none flex-shrink-0" />
              <button onClick={saveAiFranchise} disabled={savingAi}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white flex-shrink-0 disabled:opacity-50 ml-auto">
                {savingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90">Isolamento por corretor</div>
              <div className="text-xs text-white/40">
                Cada corretor só vê os leads dele na caixa e em Contatos, mesmo dividindo um
                número. Gerente e admin continuam vendo tudo. Desligue só se o time atende a
                caixa em conjunto de propósito.
              </div>
            </div>
            <button onClick={() => saveBrokerIsolation(!brokerIsolation)} disabled={savingIsolation}
              className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50"
              style={{ background: brokerIsolation ? '#7c3aed' : 'rgba(255,255,255,0.15)' }}
              aria-pressed={brokerIsolation} aria-label="Isolamento por corretor">
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: brokerIsolation ? '1.375rem' : '0.125rem' }} />
            </button>
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90">Inbox só-campanha</div>
              <div className="text-xs text-white/40">
                A caixa mostra só conversas que entraram em algum funil ou iniciadas na mão
                pelo painel. Quem foi barrado pelas origens acima (WhatsApp orgânico, form do
                site) some da caixa também, não só do funil. Ligue para o corretor não ver
                mensagem de conhecido; deixe desligado para ele ver tudo e só o funil filtrar.
              </div>
            </div>
            <button onClick={() => saveCampaignOnly(!campaignOnly)} disabled={savingCampaignOnly}
              className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50"
              style={{ background: campaignOnly ? '#7c3aed' : 'rgba(255,255,255,0.15)' }}
              aria-pressed={campaignOnly} aria-label="Inbox só-campanha">
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: campaignOnly ? '1.375rem' : '0.125rem' }} />
            </button>
          </div>
          {/* Âmbar, e não roxo como os outros: não é preferência de operação, é
              uma chave que muda o que o sistema faz com mensagem de verdade. */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90">Modo demonstração</div>
              <div className="text-xs text-white/40">
                Só para o CRM que usamos em call de venda. Com a chave ligada, este cliente
                só manda WhatsApp para quem escreveu para o número dele primeiro, e não manda
                e-mail nenhum — assim os leads fictícios da demonstração nunca recebem
                follow-up, funil ou aviso de gestor. Na tela nada muda: a mensagem aparece
                como enviada na conversa.
              </div>
            </div>
            <button onClick={() => saveDemoMode(!demoMode)} disabled={savingDemo}
              className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50"
              style={{ background: demoMode ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}
              aria-pressed={demoMode} aria-label="Modo demonstração">
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: demoMode ? '1.375rem' : '0.125rem' }} />
            </button>
          </div>
          {/* Só aparece com a chave ligada: semear é uma ação que só faz sentido
              no CRM de demonstração, e o backend recusa em qualquer outro. */}
          {demoMode && (
            <div className="px-3 py-2.5 rounded-lg mb-1"
              style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">Semear demonstração</div>
                  <div className="text-xs text-white/40">
                    Cria a imobiliária fictícia inteira — equipe, carteira, leads, conversas e
                    funil — com datas de hoje. Conecte o WhatsApp antes, para o histórico nascer
                    dentro do número real.
                  </div>
                </div>
                <button onClick={seedDemo} disabled={seeding}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white flex-shrink-0 disabled:opacity-50">
                  {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Semear'}
                </button>
              </div>
              {seedInfo && <div className="mt-2 text-xs text-emerald-300">{seedInfo}</div>}

              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(245,158,11,0.25)' }}>
                <div className="text-xs text-white/60 mb-1">Fotos da carteira (um endereço por linha)</div>
                <div className="text-[11px] text-white/35 mb-1.5">
                  O gerador não inventa foto de imóvel. Suba as suas num endereço público e cole os
                  links aqui — ficam guardados e sobrevivem ao recomeço.
                </div>
                <textarea value={photoUrls} onChange={e => setPhotoUrls(e.target.value)} rows={3}
                  placeholder="https://.../casa-1.jpg"
                  className="w-full px-2 py-1.5 rounded bg-white/10 text-white text-xs outline-none font-mono" />
                <button onClick={savePhotoUrls} disabled={savingPhotos}
                  className="mt-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/10 text-white/90 disabled:opacity-50">
                  {savingPhotos ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar fotos'}
                </button>
              </div>

              <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(245,158,11,0.25)' }}>
                <button onClick={runAudit} disabled={auditing}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/90 disabled:opacity-50">
                  {auditing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Conferir saúde'}
                </button>
                <button onClick={resetDemo} disabled={resetting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white disabled:opacity-50">
                  {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Recomeçar demo'}
                </button>
                <span className="text-[11px] text-white/40">Recomeçar não desconecta o WhatsApp.</span>
              </div>

              {audit && (
                <div className="mt-2 text-xs">
                  <span className={
                    audit.saude === 'verde' ? 'text-emerald-300'
                      : audit.saude === 'amarelo' ? 'text-amber-300' : 'text-red-300'
                  }>
                    {audit.saude === 'verde' ? '● Pronta para apresentar'
                      : audit.saude === 'amarelo' ? '● Falta exemplo em alguma tela nova'
                        : '● O painel abriria com bloco vazio'}
                  </span>
                  {!!audit.painel?.vazios?.length && (
                    <div className="text-white/50 mt-1">Blocos vazios no painel: {audit.painel.vazios.join(', ')}</div>
                  )}
                  {!!audit.entidades_sem_exemplo?.length && (
                    <div className="text-white/50 mt-1">
                      Sem dado de exemplo: {audit.entidades_sem_exemplo.slice(0, 12).join(', ')}
                      {audit.entidades_sem_exemplo.length > 12 && ` e mais ${audit.entidades_sem_exemplo.length - 12}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Procurar função (ex: áudio, follow-up, bolsão)"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none" />
                {buscando && (
                  <button onClick={() => setQuery('')} className="text-white/40 hover:text-white/80 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {seções.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-white/40">
                  Nenhuma função com esse nome.
                </div>
              )}

              {seções.map(secao => {
                const chaves = secao.all.map(i => i.key);
                const ligadas = chaves.filter(isOn).length;
                const aberto = buscando || !!abertos[secao.key];
                const salvandoTema = savingTheme === secao.key;

                return (
                  <div key={secao.key} className="rounded-lg overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={() => setAbertos(a => ({ ...a, [secao.key]: !a[secao.key] }))}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03]">
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-white/40 flex-shrink-0 transition-transform ${aberto ? 'rotate-90' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/90">{secao.label}</div>
                        {secao.hint && <div className="text-[11px] text-white/35 truncate">{secao.hint}</div>}
                      </div>
                      <span className={`text-[11px] flex-shrink-0 ${ligadas === 0 ? 'text-white/25' : 'text-white/45'}`}>
                        {ligadas} de {chaves.length}
                      </span>
                    </button>

                    {aberto && (
                      <div className="px-2 pb-2 space-y-1.5">
                        <div className="flex items-center gap-2 px-1 pb-0.5">
                          {salvandoTema
                            ? <Loader2 className="w-3 h-3 animate-spin text-violet-300" />
                            : (
                              <>
                                <button onClick={() => toggleTheme(secao.key, chaves, true)}
                                  className="text-[11px] text-violet-300 hover:text-violet-200">ligar tudo deste tema</button>
                                <span className="text-white/20 text-[11px]">·</span>
                                <button onClick={() => toggleTheme(secao.key, chaves, false)}
                                  className="text-[11px] text-white/40 hover:text-red-300">desligar tudo</button>
                              </>
                            )}
                        </div>

                        {secao.menus.map(menu => (
                          <div key={`${secao.key}-${menu.key}`} className="rounded-md overflow-hidden"
                            style={{ background: 'rgba(0,0,0,0.20)' }}>
                            {menu.all.map(f => {
                              const éMenu = !!menu.toggle && f.key === menu.toggle.key;
                              const on = isOn(f.key);
                              return (
                                <div key={f.key}
                                  className={`flex items-center gap-3 py-2 pr-3 ${éMenu ? 'pl-3' : menu.toggle ? 'pl-7' : 'pl-3'}`}
                                  style={éMenu ? { background: 'rgba(124,58,237,0.10)' } : undefined}>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm truncate ${éMenu ? 'text-white/90 font-medium' : 'text-white/75'}`}>
                                      {itemLabel(f)}
                                      {éMenu && (
                                        <span className="ml-2 text-[10px] uppercase tracking-wide text-violet-300/80">menu inteiro</span>
                                      )}
                                    </div>
                                    {f.description && <div className="text-xs text-white/40 truncate">{f.description}</div>}
                                  </div>
                                  <button onClick={() => toggle(f.key)} disabled={savingKey === f.key}
                                    className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? 'bg-violet-600' : 'bg-white/15'}`}>
                                    {savingKey === f.key
                                      ? <Loader2 className="w-3 h-3 animate-spin text-white absolute top-1.5 left-3.5" />
                                      : <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-1'}`} />}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PooledClients() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [tenants, setTenants] = useState<PooledTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [membersOf, setMembersOf] = useState<PooledTenant | null>(null);
  const [featuresOf, setFeaturesOf] = useState<PooledTenant | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showFollowupRollout, setShowFollowupRollout] = useState(false);
  const [showAccessCfg, setShowAccessCfg] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PooledTenant | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS: ViewTab[] = ['clients', 'dashboard', 'logs', 'metrics', 'archived-features', 'leads-ao-vivo', 'modo-cliente', 'formularios', 'sugestoes-bugs', 'atividade'];
  const initialTab = searchParams.get('tab') as ViewTab | null;
  const [tab, setTabState] = useState<ViewTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'clients',
  );
  const setTab = (id: ViewTab) => {
    setTabState(id);
    setSearchParams(id === 'clients' ? {} : { tab: id }, { replace: true });
  };
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/super/pooled_tenants${showArchived ? '?archived=true' : ''}`); setTenants(r.data?.data || []); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, [showArchived]);
  useEffect(() => { load(); }, [load]);

  // Aba Dashboard: métricas por cliente (snapshots pooled-aware do SyncClientMetricsJob).
  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    try { const r = await clientInstancesService.dashboard(); setDashData(r.data.data); }
    catch { setDashData(null); }
    finally { setLoadingDash(false); }
  }, []);
  useEffect(() => { if (tab === 'dashboard') loadDashboard(); }, [tab, loadDashboard]);

  // Arquivar a partir do card de métrica (id do ClientInstance, não do Tenant pooled).
  const handleArchiveCI = async (id: number) => {
    if (!(await confirmar({
      titulo: 'Arquivar cliente',
      descricao: 'Ele sai das métricas. O CRM dele continua no ar.',
      rotuloDaAcao: 'Arquivar',
      destrutivo: true,
    }))) return;
    try { await clientInstancesService.archive(id); loadDashboard(); } catch { toast.error('Falha ao arquivar.'); }
  };

  const handleSyncAll = async () => {
    // A ação mais cara do painel inteiro: mexe em TODOS os clientes pagantes de
    // uma vez. Enquanto foi window.confirm, o aviso disputava espaço com o
    // endereço do site no cabeçalho da caixinha do navegador.
    if (!(await confirmar({
      titulo: 'Redeploy de TODOS os tenants',
      descricao: (
        <>
          Isso dispara redeploy na Vercel de <strong>todos os tenants ativos</strong>, de uma vez.
          Não é por cliente.
        </>
      ),
      rotuloDaAcao: 'Redeployar todos',
      rotuloDeCancelar: 'Voltar',
      destrutivo: true,
    }))) return;
    setSyncingAll(true);
    try {
      const res = await clientInstancesService.syncAllFrontends();
      const results = res.data.data;
      const ok = results.filter(r => r.success).map(r => r.name).join(', ');
      const fail = results.filter(r => !r.success).map(r => `${r.name}: ${r.error}`).join('\n');
      let msg = res.data.message;
      if (ok) msg += `\nOK: ${ok}`;
      if (fail) msg += `\nFalhou:\n${fail}`;
      toast.error(msg);
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Erro ao sincronizar todos'); }
    finally { setSyncingAll(false); }
  };

  const doAction = async (t: PooledTenant, action: 'suspend' | 'unsuspend' | 'archive' | 'unarchive') => {
    setBusyId(t.id);
    try { await api.post(`/super/pooled_tenants/${t.id}/${action}`); await load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Falha na ação.'); }
    finally { setBusyId(null); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await api.delete(`/super/pooled_tenants/${confirmDelete.id}`, { data: { confirm_slug: deleteText.trim() } });
      setConfirmDelete(null); setDeleteText(''); await load();
    } catch (e: any) {
      // 409 = o servidor paralisou o cliente mas nao conseguiu apagar (o banco
      // dele ainda estava em uso). Ele saiu da lista ativa e esta em Arquivados:
      // manter a janela aberta e a lista velha faria parecer que nada aconteceu.
      const busy = e?.response?.status === 409;
      toast.error(e?.response?.data?.error || 'Falha ao excluir.', busy ? { duration: 8000 } : undefined);
      if (busy) { setConfirmDelete(null); setDeleteText(''); await load(); }
    }
    finally { setBusyId(null); }
  };

  // Poll só enquanto algum tenant estiver REALMENTE provisionando (trial recém-criado),
  // não pra trial legado já provisionado (senão pollava pra sempre).
  useEffect(() => {
    const stillProvisioning = tenants.some(t =>
      t.status === 'trial' && t.created_at && (Date.now() - Date.parse(t.created_at)) < 15 * 60 * 1000,
    );
    if (!stillProvisioning) return;
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [tenants, load]);

  const enter = async (t: PooledTenant) => {
    setEntering(t.id);
    try {
      const r = await api.post(`/super/pooled_tenants/${t.id}/sso`);
      const url = r.data?.data?.url;
      if (url) window.open(url, '_blank');
      else toast.error('Falha ao gerar acesso.');
    } catch { toast.error('Falha ao entrar no CRM do cliente.'); }
    finally { setEntering(null); }
  };

  return (
    <>
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-violet-500" /> Clientes (SaaS)
            </h1>
            <p className="text-sm text-muted-foreground">Entre, gerencie membros, métricas e logs de cada CRM.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconActionButton
              label="Atualizar"
              icon={<RefreshCw className={`h-4 w-4 ${loading || loadingDash ? 'animate-spin' : ''}`} />}
              onClick={() => (tab === 'dashboard' ? loadDashboard() : load())}
            />
            <IconActionButton
              label="Sync Todos — redeploy Vercel de todos os tenants (atualiza todos com o código da raiz)"
              icon={syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              onClick={handleSyncAll}
              disabled={syncingAll}
            />
            {tab === 'clients' && (
              <>
                <IconActionButton
                  label={showArchived ? 'Mostrar ativos' : 'Mostrar arquivados'}
                  icon={showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  onClick={() => setShowArchived(v => !v)}
                  className={showArchived ? 'border-violet-500/50 text-violet-700 dark:text-violet-300 bg-violet-500/10' : ''}
                />
                <IconActionButton
                  label="Comunicado — enviar aviso para os clientes"
                  icon={<Megaphone className="h-4 w-4" />}
                  onClick={() => setShowBroadcast(true)}
                  disabled={tenants.length === 0}
                />
                <IconActionButton
                  label="Funil de follow-up — aplicar o mesmo funil (mensagens e mídia) em vários clientes de uma vez"
                  icon={<Workflow className="h-4 w-4" />}
                  onClick={() => setShowFollowupRollout(true)}
                  disabled={tenants.length === 0}
                />
                <IconActionButton
                  label="Msg de acesso — editar a mensagem enviada no WhatsApp ao criar um membro"
                  icon={<MessageCircle className="h-4 w-4" />}
                  onClick={() => setShowAccessCfg(true)}
                />
                <button onClick={() => setShowWizard(true)}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
                  <Plus className="w-4 h-4" /> Novo Cliente
                </button>
              </>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 border-b">
          {([
            { id: 'clients', label: 'Clientes', Icon: List },
            { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
            { id: 'logs', label: 'Logs', Icon: ScrollText },
            { id: 'metrics', label: 'Métricas de Uso', Icon: Gauge },
            { id: 'archived-features', label: 'Arquivados', Icon: Archive },
            { id: 'leads-ao-vivo', label: 'Leads ao Vivo', Icon: Radio },
            { id: 'modo-cliente', label: 'Modo Cliente', Icon: UserCog },
            { id: 'formularios', label: 'Formulários', Icon: ClipboardList },
            { id: 'sugestoes-bugs', label: 'Sugestões/Bugs', Icon: MessageSquarePlus },
            { id: 'atividade', label: 'Atividade', Icon: Activity },
          ] as { id: ViewTab; label: string; Icon: typeof List }[]).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
      {tab === 'dashboard' ? (
        <DashboardView data={dashData} loading={loadingDash} onArchive={handleArchiveCI} />
      ) : tab === 'logs' ? (
        <div className="h-full"><LogsView /></div>
      ) : tab === 'metrics' ? (
        <div className="h-full"><UserMetricsView /></div>
      ) : tab === 'archived-features' ? (
        <ArchivedFeaturesView />
      ) : tab === 'leads-ao-vivo' ? (
        <LeadsFeed />
      ) : tab === 'modo-cliente' ? (
        <ClientMode />
      ) : tab === 'formularios' ? (
        <OnboardingForms />
      ) : tab === 'sugestoes-bugs' ? (
        <CustomerFeedbacks />
      ) : tab === 'atividade' ? (
        <div className="h-full"><AdminAtividade /></div>
      ) : loading && tenants.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 max-w-5xl mx-auto">
          {tenants.map(t => {
            // "Provisionando" = status trial SÓ durante a janela real (criado há
            // pouco). Tenant trial antigo já está provisionado (o job vira pra
            // active no fim; legados ficam trial) — não pode travar o "Entrar".
            const createdMs = t.created_at ? Date.parse(t.created_at) : 0;
            const isProvisioning = t.status === 'trial' && createdMs > 0 && (Date.now() - createdMs) < 15 * 60 * 1000;
            const st = isProvisioning
              ? STATUS.trial
              : (STATUS[t.status === 'trial' ? 'active' : t.status] || { label: t.status, cls: 'bg-white/10 text-white/60 border-white/20' });
            return (
              <div key={t.id} className="rounded-xl p-4 border" style={{ background: 'rgba(124,58,237,0.04)', borderColor: 'rgba(124,58,237,0.15)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate flex items-center gap-2">
                      {t.name}
                      {isProvisioning && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 flex-shrink-0" />}
                    </div>
                    <a href={`https://${t.slug}.lmflow.com.br`} target="_blank" rel="noreferrer"
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 truncate">
                      {t.slug}.lmflow.com.br <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
                {isProvisioning ? (
                  <p className="text-xs text-blue-700/80 dark:text-blue-300/70 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Criando schema e configurando... aguarde.
                  </p>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {t.members ?? '?'} membro(s)
                    </div>
                    <AiUsageLine u={t.ai_usage} />
                  </>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => enter(t)} disabled={entering === t.id || isProvisioning}
                    className="lmf-btn-shimmer flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40">
                    {entering === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    {isProvisioning ? 'Aguardando...' : 'Entrar'}
                  </button>
                  <button onClick={() => setMembersOf(t)} disabled={isProvisioning}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
                    <Users className="w-4 h-4" /> Membros
                  </button>
                  <button onClick={() => setFeaturesOf(t)} disabled={isProvisioning}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
                    <SlidersHorizontal className="w-4 h-4" /> Funções
                  </button>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                  {t.status === 'suspended' && !t.archived ? (
                    <button onClick={() => doAction(t, 'unsuspend')} disabled={busyId === t.id}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
                      <Play className="w-3.5 h-3.5" /> Descongelar
                    </button>
                  ) : !t.archived ? (
                    <button onClick={() => doAction(t, 'suspend')} disabled={busyId === t.id || isProvisioning}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50">
                      <Snowflake className="w-3.5 h-3.5" /> Congelar
                    </button>
                  ) : null}
                  {t.archived ? (
                    <button onClick={() => doAction(t, 'unarchive')} disabled={busyId === t.id}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 disabled:opacity-50">
                      <ArchiveRestore className="w-3.5 h-3.5" /> Desarquivar
                    </button>
                  ) : (
                    <button onClick={() => doAction(t, 'archive')} disabled={busyId === t.id || isProvisioning}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50">
                      <Archive className="w-3.5 h-3.5" /> Arquivar
                    </button>
                  )}
                  <button onClick={() => { setConfirmDelete(t); setDeleteText(''); }} disabled={busyId === t.id}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50 ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
          {tenants.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum cliente ainda.</p>
          )}
        </div>
      )}
      </div>
      {membersOf && <MembersModal tenant={membersOf} onClose={() => setMembersOf(null)} />}
      {featuresOf && <FeaturesModal tenant={featuresOf} onClose={() => setFeaturesOf(null)} />}
      {showWizard && <NewTenantWizard onClose={() => setShowWizard(false)} onCreated={load} />}
      {showBroadcast && <ClientBroadcastModal tenants={tenants} onClose={() => setShowBroadcast(false)} />}
      {showFollowupRollout && <ClientFollowupRolloutModal tenants={tenants} onClose={() => setShowFollowupRollout(false)} />}
      {showAccessCfg && <MemberAccessConfigModal open={showAccessCfg} onClose={() => setShowAccessCfg(false)} />}
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#150a26', border: '1px solid rgba(239,68,68,0.4)' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
              <h3 className="text-red-400 font-bold text-sm flex items-center gap-2"><Trash2 className="w-4 h-4" /> Excluir cliente — irreversível</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-white/80">
                Isso <strong>apaga permanentemente</strong> o CRM de <strong>{confirmDelete.name}</strong> e <strong>todos os dados</strong> (conversas, leads, pipeline). Não tem volta.
              </p>
              <p className="text-xs text-white/50">
                O cliente é <strong>paralisado antes</strong> (automações e webhooks desligados). Se a exclusão não terminar, ele fica em <strong>Arquivados</strong> e você tenta de novo.
              </p>
              <p className="text-xs text-white/50">Pra confirmar, digite o slug exato: <code className="text-red-300">{confirmDelete.slug}</code></p>
              <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder={confirmDelete.slug} autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/25 outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239,68,68,0.3)' }} />
            </div>
            <div className="flex justify-between px-5 py-4 border-t" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
              <button onClick={() => setConfirmDelete(null)} className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white">Cancelar</button>
              <button onClick={doDelete} disabled={busyId === confirmDelete.id || deleteText.trim() !== confirmDelete.slug}
                className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-40" style={{ background: '#dc2626' }}>
                {busyId === confirmDelete.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}
