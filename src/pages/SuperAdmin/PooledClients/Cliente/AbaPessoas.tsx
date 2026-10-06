// src/pages/SuperAdmin/PooledClients/Cliente/AbaPessoas.tsx
import { useCallback, useEffect, useState } from 'react';
import { Link2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { Button, Checkbox, Input, Label } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { tempoDesde } from '@/lib/formato';
import clientInstancesService, { type CentralInstance } from '@/services/clientInstances/clientInstancesService';
import { clientesService } from '@/services/superAdmin/clientesService';
import type { Pessoa } from '@/types/admin/clientes';
import { copyText } from '@/utils/clipboard';
import { pedidoRemoverPessoa } from '../confirmacoes';
import type { PropsDaAba } from './Pagina';

// Pessoas do cliente (antiga janela Membros). Acesso SÓ por link: não existe
// senha em lugar nenhum desta tela (entrega 3).
const EQUIPE = /@lealmidia\.com\.br$/i;

export default function AbaPessoas({ cliente }: PropsDaAba) {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState(false);
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviarWa, setEnviarWa] = useState(true);
  const [instancias, setInstancias] = useState<CentralInstance[]>([]);
  const [instancia, setInstancia] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Link que não deu pra copiar (área de transferência bloqueada): fica na tela pra copiar à mão.
  // Guarda de quem é: o link cria a senha, então não pode ir pra pessoa errada.
  const [linkManual, setLinkManual] = useState<{ quem: string; url: string } | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const carregar = useCallback(async () => {
    setErro(false);
    try { setPessoas(await clientesService.pessoas(cliente.id)); } catch { setErro(true); }
  }, [cliente.id]);

  useEffect(() => { void carregar(); setLinkManual(null); }, [carregar]);
  useEffect(() => {
    // Mesma escolha da janela Membros antiga: Operacional conectada, senão a primeira conectada.
    clientInstancesService.centralInstances().then((r) => {
      const lista = r.data.data ?? [];
      setInstancias(lista);
      const op = lista.find((i) => i.name.startsWith('Operacional') && i.connected);
      setInstancia((atual) => atual || op?.name || lista.find((i) => i.connected)?.name || lista[0]?.name || '');
    }).catch(() => setInstancias([]));
  }, []);

  const adicionar = async () => {
    if (!email.trim()) return;
    setSalvando(true);
    try {
      const r = await clientesService.adicionarPessoa(cliente.id, {
        email: email.trim(), name: nome.trim() || undefined, whatsapp_number: telefone.trim() || undefined,
        send_whatsapp: telefone.trim() ? enviarWa : false, instance: instancia || undefined,
      });
      const copiou = r.access_url ? await copyText(r.access_url) : false;
      setLinkManual(r.access_url && !copiou ? { quem: email.trim(), url: r.access_url } : null);
      const enviou = !!r.whatsapp?.sent;
      if (!r.access_url) toast.success('Pessoa adicionada.');
      else if (copiou) toast.success(`Link de acesso copiado${enviou ? ' e enviado no WhatsApp' : ''}.`);
      else toast.error(`Não deu pra copiar o link${enviou ? ' (foi enviado no WhatsApp)' : ''}. Ele está na tela.`);
      if (telefone.trim() && enviarWa && !enviou) toast.error(`Não enviou: ${r.whatsapp?.skipped ?? r.whatsapp?.error ?? 'erro no envio'}`);
      setEmail(''); setNome(''); setTelefone('');
      void carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra adicionar.');
    } finally { setSalvando(false); }
  };

  const copiarLink = async (p: Pessoa) => {
    let url: string;
    try { url = await clientesService.linkDeAcesso(cliente.id, p.id); } catch { toast.error('Não deu pra gerar o link.'); return; }
    if (await copyText(url)) { setLinkManual(null); toast.success('Link de acesso copiado (vale 24 h).'); }
    else { setLinkManual({ quem: p.email, url }); toast.error('Não deu pra copiar o link. Ele está na tela.'); }
  };

  const enviarLink = async (p: Pessoa) => {
    try {
      const wa = await clientesService.enviarLink(cliente.id, p.id, instancia || undefined);
      if (wa.sent) toast.success('Link enviado no WhatsApp.');
      else toast.error(`Não enviou: ${wa.skipped ?? wa.error ?? 'erro no envio'}`);
    } catch (e: any) {
      const wa = e?.response?.data?.whatsapp;
      toast.error(`Não enviou: ${wa?.skipped ?? e?.response?.data?.error ?? 'erro no envio'}`);
    }
  };

  const remover = async (p: Pessoa) => {
    if (!(await confirmar(pedidoRemoverPessoa(p.email)))) return;
    try { await clientesService.removerPessoa(cliente.id, p.id); setLinkManual((l) => (l?.quem === p.email ? null : l)); void carregar(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Não deu pra remover.'); }
  };

  return (
    <div className="flex flex-col gap-4">
      {erro ? (
        <EmptyState tipo="erro" title="Não deu para carregar as pessoas" aoTentarDeNovo={() => void carregar()} />
      ) : pessoas === null ? (
        <div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-muted" />
      ) : pessoas.length === 0 ? (
        <EmptyState tipo="vazio" title="Nenhuma pessoa ainda" description="Adicione a primeira pessoa abaixo." />
      ) : (
        <ul className="divide-y rounded-lg border">
          {pessoas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name || p.email}</p>
                <p className="truncate text-xs text-muted-foreground">{p.email}{p.role ? ' · ' : ''}{p.role && <span>{p.role}</span>}</p>
              </div>
              <span className="text-xs text-muted-foreground">{p.last_seen_at ? `visto ${tempoDesde(p.last_seen_at)}` : 'nunca entrou'}</span>
              <Button size="sm" variant="outline" aria-label={`Copiar link de ${p.email}`} onClick={() => void copiarLink(p)}><Link2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" aria-label={`Enviar link a ${p.email}`} disabled={!p.whatsapp_number} onClick={() => void enviarLink(p)}><Send className="h-4 w-4" /></Button>
              {!EQUIPE.test(p.email) && (
                <Button size="sm" variant="outline" aria-label={`Remover ${p.email}`} onClick={() => void remover(p)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {linkManual && (
        <div role="status" className="rounded-lg border p-3">
          <Label htmlFor="link-manual">Não deu pra copiar. Copie o link de acesso de {linkManual.quem}:</Label>
          <Input id="link-manual" readOnly value={linkManual.url} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      <section aria-labelledby="nova-pessoa" className="rounded-lg border p-4">
        <h2 id="nova-pessoa" className="mb-3 text-sm font-semibold">Adicionar pessoa</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="np-email">E-mail</Label><Input id="np-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label htmlFor="np-nome">Nome</Label><Input id="np-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label htmlFor="np-tel">WhatsApp</Label><Input id="np-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
        </div>
        {telefone.trim() && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={enviarWa} onCheckedChange={(v) => setEnviarWa(v === true)} /> Enviar o link no WhatsApp</label>
            {enviarWa && (
              <Seletor aria-label="Número que envia" value={instancia} onChange={(e) => setInstancia(e.target.value)} className="w-56">
                {instancias.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
              </Seletor>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">A pessoa cria a própria senha pelo link (vale 24 h). O link também é copiado pra você.</p>
        <Button className="mt-3" disabled={!email.trim() || salvando} onClick={() => void adicionar()}>Adicionar pessoa</Button>
      </section>
      {dialogoDeConfirmacao}
    </div>
  );
}
