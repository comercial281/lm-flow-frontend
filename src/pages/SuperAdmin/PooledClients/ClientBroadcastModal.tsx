import { useState, useEffect } from 'react';
import { X, Send, Loader2, Check, Megaphone, Users } from 'lucide-react';
import api from '@/services/core/api';

interface PooledTenant {
  id: string; name: string; slug: string; status: string;
  settings?: Record<string, any>;
}
interface Instance { name: string; connected: boolean; }
interface Recipient { slug: string; name: string; phone: string; selected: boolean; }
interface SendResult { slug: string; sent: boolean; phone?: string; error?: string; http?: string; }

export default function ClientBroadcastModal({ tenants, onClose }: { tenants: PooledTenant[]; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instance, setInstance] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setRecipients(tenants.map(t => ({
      slug: t.slug,
      name: t.name,
      phone: (t.settings?.phone as string) || '',
      selected: true,
    })));
    api.get('/super/pooled_tenants/instances')
      .then(r => {
        const list: Instance[] = r.data?.data || [];
        setInstances(list);
        const firstConnected = list.find(i => i.connected) || list[0];
        if (firstConnected) setInstance(firstConnected.name);
      })
      .catch(() => {});
  }, [tenants]);

  const update = (i: number, patch: Partial<Recipient>) =>
    setRecipients(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const allSelected = recipients.length > 0 && recipients.every(r => r.selected);
  const toggleAll = () => setRecipients(rs => rs.map(r => ({ ...r, selected: !allSelected })));

  const selected = recipients.filter(r => r.selected);
  const selectedWithPhone = selected.filter(r => r.phone.replace(/\D/g, '').length >= 10);

  const send = async () => {
    setSending(true); setError(''); setResults(null);
    try {
      const r = await api.post('/super/pooled_tenants/broadcast', {
        message,
        instance,
        recipients: selected.map(x => ({ slug: x.slug, name: x.name, phone: x.phone })),
      });
      setResults(r.data?.data?.results || []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao disparar');
    } finally {
      setSending(false);
    }
  };

  const resultFor = (slug: string) => results?.find(x => x.slug === slug);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0f0520', border: '1px solid rgba(124,58,237,0.3)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-white font-bold text-base">Comunicado aos clientes</h2>
              <p className="text-xs text-white/40">Manda mensagem, acesso ou aviso de atualização pros donos dos CRMs.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Mensagem */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70">Mensagem <span className="text-white/30">(use {'{{nome}}'} pro nome do cliente)</span></label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              placeholder={'Olá {{nome}}! Novidade no seu CRM: ...'}
              className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-violet-500 resize-y"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
          </div>

          {/* Instância remetente */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70">Enviar pela instância (Leal Mídia)</label>
            <select value={instance} onChange={e => setInstance(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-violet-500"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
              {instances.length === 0 && <option value="" style={{ background: '#150a26' }}>Carregando...</option>}
              {instances.map(i => (
                <option key={i.name} value={i.name} style={{ background: '#150a26' }}>
                  {i.name} {i.connected ? '🟢' : '🔴 (offline)'}
                </option>
              ))}
            </select>
          </div>

          {/* Destinatários */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-white/70 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Clientes ({selectedWithPhone.length} com telefone de {selected.length} selecionados)
              </label>
              <button onClick={toggleAll} className="text-xs text-violet-400 hover:text-violet-300">
                {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {recipients.map((r, i) => {
                const res = resultFor(r.slug);
                const hasPhone = r.phone.replace(/\D/g, '').length >= 10;
                return (
                  <div key={r.slug} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: r.selected ? 'rgba(124,58,237,0.10)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div onClick={() => update(i, { selected: !r.selected })}
                      className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center cursor-pointer ${r.selected ? 'bg-violet-600' : 'bg-white/10'}`}>
                      {r.selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-white/90 w-40 truncate">{r.name}</span>
                    <input value={r.phone} onChange={e => update(i, { phone: e.target.value })} placeholder="telefone (DDD+número)"
                      className={`flex-1 px-2 py-1 rounded text-xs text-white placeholder-white/25 outline-none ${hasPhone ? '' : 'ring-1 ring-amber-500/40'}`}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.15)' }} />
                    {res && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${res.sent ? 'text-emerald-300' : 'text-red-300'}`}>
                        {res.sent ? '✓ enviado' : `✗ ${res.error || res.http || 'falhou'}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {results && (
            <p className="text-sm text-violet-300">
              {results.filter(r => r.sent).length} enviado(s) de {results.length}.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white">
            Fechar
          </button>
          <button onClick={send} disabled={sending || !message.trim() || !instance || selectedWithPhone.length === 0}
            className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Send className="w-4 h-4" /> Enviar pra {selectedWithPhone.length} cliente(s)</>}
          </button>
        </div>
      </div>
    </div>
  );
}
