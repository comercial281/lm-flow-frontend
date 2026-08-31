import { useState, useEffect, useMemo } from 'react';
import { X, Check, Loader2, Send, Users, Workflow, FileUp, AlertTriangle } from 'lucide-react';
import api from '@/services/core/api';
import { readFollowupPackage, FollowupPackage, FollowupPackageSummary } from '@/services/followupSequences/followupSequencesService';

/**
 * Plantar o MESMO funil de follow-up em vários clientes de uma vez.
 *
 * O dono do produto pediu pra montar um funil (foto, vídeo, áudio, figurinha e
 * texto) uma vez só e plugá-lo em todos os clientes. Cada cliente é um CRM
 * separado, então entrar num por um é justamente o trabalho que isto elimina.
 *
 * Duas decisões que valem a pena não desfazer:
 *
 * - **O funil chega DESLIGADO em todo destino.** Quem liga é uma pessoa que
 *   abriu o CRM e leu as mensagens. Automação disparando sozinha no WhatsApp de
 *   lead de verdade custa cliente — a mesma regra que a cópia de automação já
 *   segue.
 * - **Nenhum cliente vem marcado.** O comunicado marca todos porque aviso a
 *   mais é barulho; aqui cada marca cria um funil que alguém vai ter que apagar
 *   à mão se foi engano.
 */

interface PooledTenant {
  id: string; name: string; slug: string; status: string;
}
interface SourceSequence {
  id: string; name: string; slug: string; description?: string | null;
  is_active: boolean; steps_count: number; media_count: number;
}
interface TenantOption { id: string; slug: string; name: string; count?: number | null }
interface RolloutResult {
  tenant_slug: string; tenant_name: string; ok: boolean;
  sequence_name?: string; pendencias?: string[]; error?: string;
}

export default function ClientFollowupRolloutModal({
  tenants,
  onClose,
}: {
  tenants: PooledTenant[];
  onClose: () => void;
}) {
  // De onde vem o funil: de um CRM que já tem ele montado, ou de um arquivo
  // exportado. Os dois caminhos existem porque o funil tanto pode ter sido
  // montado no Principal quanto ter vindo de fora num arquivo.
  const [origin, setOrigin] = useState<'client' | 'file'>('client');

  const [sourceTenants, setSourceTenants] = useState<TenantOption[]>([]);
  const [sourceTenantId, setSourceTenantId] = useState('');
  const [sequences, setSequences] = useState<SourceSequence[]>([]);
  const [sequenceId, setSequenceId] = useState('');
  const [loadingSequences, setLoadingSequences] = useState(false);

  // Guarda o funil JÁ LIDO, não o arquivo: ler duas vezes o mesmo arquivo é a
  // chance de a prévia mostrar uma coisa e o envio mandar outra.
  const [filePackage, setFilePackage] = useState<FollowupPackage | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSummary, setFileSummary] = useState<FollowupPackageSummary | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<RolloutResult[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/super/tenant_automations/followups')
      .then(r => setSourceTenants(r.data?.data?.tenants || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sourceTenantId) { setSequences([]); setSequenceId(''); return; }
    setLoadingSequences(true);
    api.get('/super/tenant_automations/followups', { params: { tenant_id: sourceTenantId } })
      .then(r => setSequences(r.data?.data?.sequences || []))
      .catch(() => setSequences([]))
      .finally(() => setLoadingSequences(false));
  }, [sourceTenantId]);

  const pickFile = async (chosen: File | undefined) => {
    if (!chosen) return;
    const { pkg, summary, error: err } = await readFollowupPackage(chosen);
    if (err) { setError(err); setFilePackage(null); setFileSummary(null); setFileName(''); return; }
    setError('');
    setFilePackage(pkg);
    setFileSummary(summary);
    setFileName(chosen.name);
  };

  // O cliente de ORIGEM nunca é destino: aplicar ali criaria uma cópia do funil
  // ao lado do original dentro do mesmo CRM.
  const targets = useMemo(
    () => tenants.filter(t => !(origin === 'client' && t.id === sourceTenantId)),
    [tenants, origin, sourceTenantId],
  );
  const selectedSlugs = targets.filter(t => selected[t.id]);
  const allSelected = targets.length > 0 && targets.every(t => selected[t.id]);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    targets.forEach(t => { next[t.id] = !allSelected; });
    setSelected(next);
  };

  const sourceReady = origin === 'client' ? !!sequenceId : !!filePackage;

  const apply = async () => {
    setApplying(true); setError(''); setResults(null);
    try {
      const body: Record<string, unknown> = {
        target_tenant_ids: selectedSlugs.map(t => t.id),
      };
      if (origin === 'client') {
        body.source_tenant_id = sourceTenantId;
        body.sequence_id = sequenceId;
      } else if (filePackage) {
        body.package = filePackage;
      }
      const r = await api.post('/super/tenant_automations/apply_followup', body);
      setResults(r.data?.data?.results || []);
    } catch (e) {
      // O servidor devolve { error: "..." } nesta rota; o texto dele diz o que
      // faltou (cliente de origem, funil, destino) melhor que uma frase genérica.
      const detalhe = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(detalhe || 'Erro ao aplicar o funil');
    } finally {
      setApplying(false);
    }
  };

  const resultFor = (slug: string) => results?.find(x => x.tenant_slug === slug);
  const chosenSequence = sequences.find(s => s.id === sequenceId);
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0f0520', border: '1px solid rgba(124,58,237,0.3)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-white font-bold text-base">Aplicar funil de follow-up nos clientes</h2>
              <p className="text-xs text-white/40">Monta uma vez, usa em todo mundo. O funil chega desligado em cada CRM.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Origem */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/70">De onde vem o funil</label>
            <div className="flex gap-2">
              {([['client', 'De um cliente'], ['file', 'De um arquivo']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setOrigin(key)}
                  className={`text-xs px-3 py-1.5 rounded-lg ${origin === key ? 'text-white' : 'text-white/50'}`}
                  style={origin === key
                    ? { background: 'rgba(124,58,237,0.30)', border: '1px solid rgba(124,58,237,0.6)' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {label}
                </button>
              ))}
            </div>

            {origin === 'client' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={sourceTenantId} onChange={e => setSourceTenantId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-violet-500"
                  style={inputStyle}>
                  <option value="" style={{ background: '#150a26' }}>Cliente de origem...</option>
                  {sourceTenants.map(t => (
                    <option key={t.id} value={t.id} style={{ background: '#150a26' }}>
                      {t.name}{typeof t.count === 'number' ? ` (${t.count} funis)` : ''}
                    </option>
                  ))}
                </select>
                <select value={sequenceId} onChange={e => setSequenceId(e.target.value)} disabled={!sourceTenantId || loadingSequences}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                  style={inputStyle}>
                  <option value="" style={{ background: '#150a26' }}>
                    {loadingSequences ? 'Carregando...' : 'Funil...'}
                  </option>
                  {sequences.map(s => (
                    <option key={s.id} value={s.id} style={{ background: '#150a26' }}>
                      {s.name} — {s.steps_count} msg{s.media_count > 0 ? `, ${s.media_count} mídia(s)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-white/70 px-3 py-2 rounded-lg cursor-pointer" style={inputStyle}>
                  <FileUp className="w-4 h-4 text-violet-400" />
                  {fileName || 'Escolher o arquivo do funil (.json)'}
                  <input type="file" accept="application/json,.json" className="hidden"
                    onChange={e => pickFile(e.target.files?.[0])} />
                </label>
                {fileSummary && (
                  <p className="text-xs text-white/50">
                    {fileSummary.name} — {fileSummary.stepsCount} mensagens
                    {fileSummary.mediaCount > 0 ? `, ${fileSummary.mediaCount} mídia(s)` : ''}
                    {fileSummary.exportedFrom ? ` · de ${fileSummary.exportedFrom}` : ''}
                  </p>
                )}
              </div>
            )}

            {chosenSequence?.description && (
              <p className="text-xs text-white/40">{chosenSequence.description}</p>
            )}
          </div>

          {/* Destinos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-white/70 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Aplicar em ({selectedSlugs.length} de {targets.length})
              </label>
              <button onClick={toggleAll} className="text-xs text-violet-400 hover:text-violet-300">
                {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {targets.map(t => {
                const res = resultFor(t.slug);
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: selected[t.id] ? 'rgba(124,58,237,0.10)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div onClick={() => setSelected(s => ({ ...s, [t.id]: !s[t.id] }))}
                      className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center cursor-pointer ${selected[t.id] ? 'bg-violet-600' : 'bg-white/10'}`}>
                      {selected[t.id] && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-white/90 flex-1 truncate">{t.name}</span>
                    {res && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${res.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                        {res.ok
                          ? `✓ criado${res.pendencias?.length ? ` (${res.pendencias.length} pendência(s))` : ''}`
                          : `✗ ${res.error || 'falhou'}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* O que não deu pra traduzir em cada CRM: coluna que não existe lá,
              entrada não recriada. Fica listado, não em silêncio. */}
          {results?.some(r => r.pendencias?.length) && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }}>
              <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Pendências por cliente
              </p>
              {results.filter(r => r.pendencias?.length).map(r => (
                <div key={r.tenant_slug} className="text-[11px] text-amber-200/80">
                  <span className="font-medium">{r.tenant_name}:</span> {r.pendencias!.join(' · ')}
                </div>
              ))}
            </div>
          )}

          {results && (
            <p className="text-sm text-violet-300">
              {results.filter(r => r.ok).length} cliente(s) de {results.length} receberam o funil.
              Ele está DESLIGADO em todos — ligue em cada CRM depois de conferir.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white">
            Fechar
          </button>
          <button onClick={apply} disabled={applying || !sourceReady || selectedSlugs.length === 0}
            className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
            {applying
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando...</>
              : <><Send className="w-4 h-4" /> Aplicar em {selectedSlugs.length} cliente(s)</>}
          </button>
        </div>
      </div>
    </div>
  );
}
