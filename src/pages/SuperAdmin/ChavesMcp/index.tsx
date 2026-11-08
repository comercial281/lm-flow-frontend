// src/pages/SuperAdmin/ChavesMcp/index.tsx
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Aviso from '@/components/base/Aviso';
import EmptyState from '@/components/base/EmptyState';
import EtiquetasDeEscolha from '@/components/base/EtiquetasDeEscolha';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from '@/components/ui/ds';
import { dataHora } from '@/lib/formato';
import { mcpKeysService } from '@/services/superAdmin/mcpKeysService';
import type { ChaveMcp, ChaveMcpGerada, ClienteMcp, PerfilChaveMcp } from '@/types/admin/mcpKeys';
import { ESQUELETO, PAGINA } from '@/pages/Admin/Area/estilo';

const PERFIS: Record<PerfilChaveMcp, string> = { operator: 'Operador', owner: 'Dono', agent: 'Agente' };
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

/** Quebra o texto dos IPs por vírgula, espaço ou linha. */
const listaDeIps = (texto: string) => texto.split(/[\s,;]+/).map((i) => i.trim()).filter(Boolean);

function Vencimento({ chave }: { chave: ChaveMcp }) {
  if (!chave.expires_at) return null;
  const falta = new Date(chave.expires_at).getTime() - Date.now();
  const vencida = chave.expired || falta <= 0;
  const cor = vencida ? 'text-red-600' : falta < SETE_DIAS ? 'text-amber-600' : 'text-muted-foreground';
  return <p className={`text-sm ${cor}`}>{vencida ? 'Vencida' : 'Vence'} {dataHora(chave.expires_at)}</p>;
}

// Plataforma → Chaves do MCP (spec 2026-10-11-mcp-admin-design.md, 3.1).
// A chave crua e o cabeçalho aparecem UMA vez, logo depois de gerar.
export default function ChavesMcp() {
  const [chaves, setChaves] = useState<ChaveMcp[] | null>(null);
  const [erro, setErro] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [nome, setNome] = useState('');
  const [perfil, setPerfil] = useState<PerfilChaveMcp>('operator');
  const [clientes, setClientes] = useState<ClienteMcp[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [ips, setIps] = useState('');
  const [noEndereco, setNoEndereco] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerada, setGerada] = useState<ChaveMcpGerada | null>(null);
  const [revogar, setRevogar] = useState<ChaveMcp | null>(null);

  const nomesDosClientes = new Map((clientes ?? []).map((c) => [c.schema_name, c.name]));
  const agente = perfil === 'agent';
  const listaIps = listaDeIps(ips);
  const pronto = !!nome.trim() && (!agente || (escolhidos.length > 0 && listaIps.length > 0));

  const carregar = useCallback(async () => {
    setErro(false);
    try { setChaves(await mcpKeysService.listar()); } catch { setErro(true); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  // A lista de clientes serve à janela e aos nomes na lista de chaves.
  useEffect(() => {
    mcpKeysService.clientes().then(setClientes).catch(() => setClientes([]));
  }, []);

  const limpar = () => { setNome(''); setPerfil('operator'); setEscolhidos([]); setIps(''); setNoEndereco(false); };

  const gerar = async () => {
    if (salvando || !pronto) return;
    setSalvando(true);
    try {
      const nova = await mcpKeysService.gerar({
        name: nome.trim(),
        profile: perfil,
        ...(escolhidos.length > 0 ? { tenant_schemas: escolhidos } : {}),
        ...(listaIps.length > 0 ? { allowed_ips: listaIps } : {}),
        url_allowed: !agente && noEndereco,
      });
      setChaves((atual) => [nova, ...(atual ?? [])]);
      setGerada(nova);
      setGerando(false);
      limpar();
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

  const trocarPerfil = async (chave: ChaveMcp, novo: 'operator' | 'owner') => {
    try {
      const feita = await mcpKeysService.mudarPerfil(chave.id, novo);
      setChaves((atual) => (atual ?? []).map((c) => (c.id === feita.id ? feita : c)));
      toast.success(`Esta chave passa a ser ${PERFIS[novo]}.`);
    } catch { toast.error('Não deu pra mudar.'); }
  };

  const copiar = async (texto: string, aviso: string) => {
    try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
    catch { toast.error('Não deu pra copiar. Selecione e copie à mão.'); }
  };

  return (
    <div className={PAGINA}>
      <div className="flex items-start gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Conecte o LM Flow no Claude Code com <code>claude mcp add --transport http lm-flow &lt;endereço&gt; --header
          "&lt;cabeçalho&gt;"</code>. Operador lê e constrói; Dono também edita os 4 modelos da IA Vendedora; Agente é
          restrito a clientes e IPs escolhidos. A chave vence sozinha (90 dias; agente 30) e não renova: gere outra.
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
                <p className="text-sm">Perfil: {PERFIS[c.profile]}</p>
                <Vencimento chave={c} />
                <p className="text-sm text-muted-foreground">
                  Clientes: {c.tenant_schemas && c.tenant_schemas.length > 0
                    ? c.tenant_schemas.map((s) => nomesDosClientes.get(s) ?? s).join(', ')
                    : 'todos'}
                </p>
                <p className="text-sm text-muted-foreground">IP: {c.allowed_ips && c.allowed_ips.length > 0 ? c.allowed_ips.join(', ') : 'livre'}</p>
                <p className="text-sm text-muted-foreground">No endereço: {c.url_allowed ? 'sim' : 'não'}</p>
                {c.active && c.profile !== 'agent' && (
                  <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                    Perfil
                    <Seletor
                      aria-label={`Perfil: ${c.name}`}
                      className="w-28"
                      value={c.profile}
                      onChange={(e) => void trocarPerfil(c, e.target.value as 'operator' | 'owner')}
                    >
                      <option value="operator">{PERFIS.operator}</option>
                      <option value="owner">{PERFIS.owner}</option>
                    </Seletor>
                  </label>
                )}
                {c.active && (
                  <Button variant="outline" size="sm" aria-label={`Revogar ${c.name}`} onClick={() => setRevogar(c)}>Revogar</Button>
                )}
              </li>
            ))}
          </ul>
        )}

      <Dialog open={gerando} onOpenChange={setGerando}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar chave do MCP</DialogTitle></DialogHeader>
          <GrupoDaJanela titulo="Chave">
            <CampoDaJanela rotulo="Nome da chave" htmlFor="mcp-nome" obrigatorio>
              <Input id="mcp-nome" placeholder="Ex.: Claude do time" value={nome} onChange={(e) => setNome(e.target.value)} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Perfil" htmlFor="mcp-perfil">
              <Seletor id="mcp-perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilChaveMcp)}>
                <option value="operator">{PERFIS.operator}</option>
                <option value="owner">{PERFIS.owner}</option>
                <option value="agent">{PERFIS.agent}</option>
              </Seletor>
            </CampoDaJanela>
            {agente ? (
              <>
                <CampoDaJanela rotulo="Clientes" obrigatorio colunas={4} ajuda="O agente só enxerga os clientes marcados.">
                  <EtiquetasDeEscolha
                    semNome
                    rotulo="Clientes"
                    opcoes={(clientes ?? []).map((c) => ({ valor: c.schema_name, rotulo: c.name }))}
                    escolhidas={escolhidos}
                    aoMudar={setEscolhidos}
                  />
                </CampoDaJanela>
                <CampoDaJanela rotulo="IP de origem" htmlFor="mcp-ips" obrigatorio colunas={4} ajuda="Um ou mais, separados por vírgula.">
                  <Input id="mcp-ips" placeholder="Ex.: 203.0.113.10" value={ips} onChange={(e) => setIps(e.target.value)} />
                </CampoDaJanela>
              </>
            ) : (
              <CampoDaJanela rotulo="Chave no endereço" colunas={4}>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    aria-label="Chave no endereço (só para o conector do Claude no navegador ou celular)"
                    checked={noEndereco}
                    onCheckedChange={(v) => setNoEndereco(v === true)}
                  />
                  Chave no endereço (só para o conector do Claude no navegador ou celular)
                </label>
              </CampoDaJanela>
            )}
          </GrupoDaJanela>
          <DialogFooter><Button disabled={!pronto || salvando} onClick={() => void gerar()}>Gerar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gerada !== null} onOpenChange={(aberto) => { if (!aberto) setGerada(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guarde a chave agora</DialogTitle></DialogHeader>
          <Aviso tom="atencao">Ela não aparece de novo. Guarde num lugar seguro.</Aviso>
          <CampoDaJanela rotulo="Cabeçalho (cole no Claude Code)" htmlFor="mcp-cabecalho">
            <Input id="mcp-cabecalho" readOnly value={gerada?.header ?? ''} onFocus={(e) => e.currentTarget.select()} />
          </CampoDaJanela>
          {gerada?.url_allowed ? (
            <CampoDaJanela rotulo="Endereço com a chave (conector do navegador ou celular)" htmlFor="mcp-endereco">
              <Input id="mcp-endereco" readOnly value={gerada.url} onFocus={(e) => e.currentTarget.select()} />
            </CampoDaJanela>
          ) : (
            <CampoDaJanela rotulo="Endereço" htmlFor="mcp-endereco">
              <Input id="mcp-endereco" readOnly value={gerada?.url ?? ''} onFocus={(e) => e.currentTarget.select()} />
            </CampoDaJanela>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => void copiar(gerada?.header ?? '', 'Cabeçalho copiado.')}>Copiar cabeçalho</Button>
            {gerada?.url_allowed && (
              <Button variant="outline" onClick={() => void copiar(gerada.url, 'Endereço copiado.')}>Copiar endereço</Button>
            )}
            <Button onClick={() => setGerada(null)}>Já guardei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revogar !== null} onOpenChange={(aberto) => { if (!aberto) setRevogar(null); }}>
        <DialogContent compacta>
          <DialogHeader><DialogTitle>Revogar {revogar?.name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A chave para na hora. Quem estiver usando perde o acesso.</p>
          <DialogFooter><Button variant="destructive" onClick={() => void confirmarRevogar()}>Revogar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
