// src/pages/SuperAdmin/ChavesMcp/index.tsx
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui/ds';
import { dataHora } from '@/lib/formato';
import { mcpKeysService } from '@/services/superAdmin/mcpKeysService';
import type { ChaveMcp } from '@/types/admin/mcpKeys';
import { ESQUELETO, PAGINA } from '@/pages/Admin/Area/estilo';

// Plataforma → Chaves do MCP (spec 2026-10-11-mcp-admin-design.md, 3.1).
// O endereço com a chave aparece UMA vez, logo depois de gerar.
export default function ChavesMcp() {
  const [chaves, setChaves] = useState<ChaveMcp[] | null>(null);
  const [erro, setErro] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [endereco, setEndereco] = useState<string | null>(null);
  const [revogar, setRevogar] = useState<ChaveMcp | null>(null);

  const carregar = useCallback(async () => {
    setErro(false);
    try { setChaves(await mcpKeysService.listar()); } catch { setErro(true); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const gerar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const nova = await mcpKeysService.gerar(nome.trim());
      setChaves((atual) => [nova, ...(atual ?? [])]);
      setEndereco(nova.url);
      setGerando(false);
      setNome('');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Não deu pra gerar a chave.'); }
    finally { setSalvando(false); }
  };

  const confirmarRevogar = async () => {
    if (!revogar) return;
    try {
      const feita = await mcpKeysService.revogar(revogar.id);
      setChaves((atual) => (atual ?? []).map((c) => (c.id === feita.id ? feita : c)));
      toast.success('Chave revogada.');
    } catch { toast.error('Não deu pra revogar.'); }
    finally { setRevogar(null); }
  };

  const copiar = async () => {
    if (!endereco) return;
    try { await navigator.clipboard.writeText(endereco); toast.success('Endereço copiado.'); }
    catch { toast.error('Não deu pra copiar. Selecione e copie à mão.'); }
  };

  return (
    <div className={PAGINA}>
      <div className="flex items-start gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Conecte o LM Flow no Claude: no Claude, Configurações → Conectores → Adicionar conector personalizado, e cole o
          endereço. No Claude Code: <code>claude mcp add --transport http lm-flow &lt;endereço&gt;</code>. Quem tiver o
          endereço entra como admin em todos os clientes.
        </p>
        <Button className="ml-auto" onClick={() => setGerando(true)}>Gerar chave</Button>
      </div>

      {erro ? <EmptyState tipo="erro" title="Não deu para carregar as chaves" aoTentarDeNovo={() => void carregar()} />
        : chaves === null ? <div aria-busy="true" className={`h-40 ${ESQUELETO}`} />
        : chaves.length === 0 ? <EmptyState tipo="vazio" title="Nenhuma chave ainda" description="Gere a primeira pra conectar o Claude." />
        : (
          <ul className="divide-y rounded-xl border bg-card">
            {chaves.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">lmf_{c.key_prefix}… · criada {dataHora(c.created_at)}{c.created_by_email ? ` por ${c.created_by_email}` : ''}</p>
                </div>
                <p className="text-sm text-muted-foreground">{c.last_used_at ? `Usada ${dataHora(c.last_used_at)}` : 'Nunca usada'}</p>
                <span className={`text-xs font-medium ${c.active ? 'text-emerald-600' : 'text-muted-foreground'}`}>{c.active ? 'Ativa' : 'Revogada'}</span>
                {c.active && (
                  <Button variant="outline" size="sm" className="ml-auto" aria-label={`Revogar ${c.name}`} onClick={() => setRevogar(c)}>Revogar</Button>
                )}
              </li>
            ))}
          </ul>
        )}

      <Dialog open={gerando} onOpenChange={setGerando}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar chave do MCP</DialogTitle></DialogHeader>
          <div><Label htmlFor="mcp-nome">Nome da chave</Label>
            <Input id="mcp-nome" placeholder="Claude do Tony" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <DialogFooter><Button disabled={!nome.trim() || salvando} onClick={() => void gerar()}>Gerar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={endereco !== null} onOpenChange={(aberto) => { if (!aberto) setEndereco(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guarde o endereço agora</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Ele não aparece de novo. Quem tiver esse endereço entra como admin em todos os clientes.</p>
          <Input readOnly aria-label="Endereço do MCP" value={endereco ?? ''} onFocus={(e) => e.currentTarget.select()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => void copiar()}>Copiar</Button>
            <Button onClick={() => setEndereco(null)}>Já guardei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revogar !== null} onOpenChange={(aberto) => { if (!aberto) setRevogar(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revogar {revogar?.name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A chave para na hora. Quem estiver usando perde o acesso.</p>
          <DialogFooter><Button variant="destructive" onClick={() => void confirmarRevogar()}>Revogar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
