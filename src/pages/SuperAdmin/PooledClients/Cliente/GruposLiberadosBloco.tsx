import { useState } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Seletor } from '@/components/base/Seletor';
import { Button, Input } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import { clientesService } from '@/services/superAdmin/clientesService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import type { ClientePooled } from '@/types/admin/clientes';
import {
  ALLOWED_KIND_LABEL, addAllowedGroup, allowedGroupsFrom, allowedGroupsPatch, allowedRow, groupsPatch,
  removeAllowedGroup, searchGroups, sortGroupsForPicker, suggestAllowedGroups,
  type AllowedGroup, type AllowedKind, type ClientGroupJids, type WaGroup,
} from '../clientGroups';

type Props = {
  cliente: ClientePooled;
  groupJids: ClientGroupJids;
  patch: (corpo: Record<string, unknown>) => Promise<unknown>;
};

// Lista de grupos da central liberados para este cliente (spec 2026-10-15).
// Só a Leal mexe aqui; dentro do CRM o cliente vê só os "Com o cliente".
// A lista da central só carrega no clique (conversa com o WhatsApp operacional),
// e carrega de novo a CADA clique: grupo criado ou renomeado aparece sem
// recarregar a página (o servidor guarda a lista por até 5 min e renova sozinho).
export function GruposLiberadosBloco({ cliente, groupJids, patch }: Props) {
  const gravada = allowedGroupsFrom(cliente.settings);
  const [lista, setLista] = useState<AllowedGroup[] | null>(gravada);
  const [central, setCentral] = useState<WaGroup[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState('');
  const [tipo, setTipo] = useState<AllowedKind>('cliente');
  const [gravando, setGravando] = useState(false);
  const [mudou, setMudou] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  // Devolve null quando a leitura falha (distinto de lista vazia).
  const carregarCentral = async (): Promise<WaGroup[] | null> => {
    setCarregando(true);
    setErro(null);
    try {
      const d = await clientesService.dadosDeProvisionamento();
      const grupos = (d.whatsapp_groups as WaGroup[]) || [];
      setCentral(grupos);
      return grupos;
    } catch {
      setErro('Não consegui listar os grupos do número operacional agora.');
      return null;
    } finally {
      setCarregando(false);
    }
  };

  const montarLista = async () => {
    const grupos = await carregarCentral();
    if (grupos === null) return;
    if (grupos.length === 0) {
      setErro('O número operacional não devolveu grupo nenhum.');
      return;
    }
    setLista(suggestAllowedGroups(grupos, cliente.name, groupJids));
    setMudou(true);
  };

  const abrirAdicionar = async () => {
    const grupos = await carregarCentral();
    if (grupos === null) return;
    if (grupos.length === 0) {
      setErro('O número operacional não devolveu grupo nenhum.');
      return;
    }
    setBusca('');
    setEscolhido('');
    setAdicionando(true);
  };

  // Digitar tira a escolha: o Incluir nunca leva um grupo que sumiu da lista filtrada.
  const buscar = (texto: string) => {
    setBusca(texto);
    setEscolhido('');
  };

  const incluir = () => {
    const g = central?.find(c => c.jid === escolhido);
    if (!g || !lista) return;
    setLista(addAllowedGroup(lista, g, tipo));
    setEscolhido('');
    setAdicionando(false);
    setMudou(true);
  };

  const remover = (jid: string) => {
    if (!lista) return;
    setLista(removeAllowedGroup(lista, jid));
    setMudou(true);
  };

  const salvar = async () => {
    if (!lista) return;
    // Lista vazia não é "sem mapeamento": marca o cliente como mapeado sem grupo
    // nenhum, e com a trava ligada todo aviso em grupo pela central para.
    if (lista.length === 0 && !(await confirmar({
      titulo: 'Salvar sem nenhum grupo?',
      descricao: 'Este cliente deixa de ver qualquer grupo da central.',
      rotuloDaAcao: 'Salvar sem grupo',
      destrutivo: true,
    }))) return;
    setGravando(true);
    try {
      await patch({ ...allowedGroupsPatch(lista), ...groupsPatch(groupJids) });
      setMudou(false);
      toast.success('Lista de grupos salva.');
    } catch {
      toast.error('Falha ao salvar a lista de grupos.');
    } finally {
      setGravando(false);
    }
  };

  const opcoes = central ? sortGroupsForPicker(central, cliente.name).filter(g => !lista?.some(l => l.jid === g.jid)) : [];
  const achados = searchGroups(opcoes, busca);

  return (
    <section aria-labelledby="grupos" className={SECAO}>
      <h2 id="grupos" className={`flex items-center gap-2 ${TITULO_SECAO}`}><MessageCircle className="h-4 w-4" /> Grupos WhatsApp</h2>
      <p className="text-sm text-muted-foreground">
        Os grupos do número operacional que este cliente pode ver e usar no CRM (Avisar no grupo, Roleta, Relatório
        semanal). Ele vê só os "Com o cliente"; os "Interno da Leal" aparecem só para a equipe da Leal.
      </p>

      {lista === null ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm italic text-muted-foreground">
            Ainda não mapeado: vale o grupo reconhecido pelo nome ("{cliente.name} x Leal Mídia").
          </p>
          <Button size="sm" variant="outline" onClick={() => void montarLista()} disabled={carregando || gravando}>Montar lista</Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhum grupo liberado.</p>}
          {lista.map(g => {
            const linha = allowedRow(g, central);
            return (
              <div key={g.jid} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                <span className={g.kind === 'cliente'
                  ? 'rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                  : 'rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground'}>
                  {ALLOWED_KIND_LABEL[g.kind]}
                </span>
                <span className="text-sm" title={g.jid}>{linha.text}</span>
                {linha.warning && <span className="w-full text-xs text-amber-600 dark:text-amber-400">{linha.warning}</span>}
                <Button size="sm" variant="ghost" className="ml-auto" aria-label={`Remover ${linha.text}`} onClick={() => remover(g.jid)} disabled={gravando}>
                  Remover
                </Button>
              </div>
            );
          })}

          {adicionando ? (
            <div className="space-y-2 sm:max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar grupo" placeholder="Buscar pelo nome ou pelo número" value={busca} autoFocus
                  onChange={e => buscar(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (achados[0]) setEscolhido(achados[0].jid); } }}
                  className="pl-9" />
              </div>
              {/* Lista que rola, já na ordem de sortGroupsForPicker: o grupo do cliente e os numerados no topo. */}
              <div role="listbox" aria-label="Grupo" className="max-h-64 overflow-y-auto rounded-md border border-border">
                {achados.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum grupo com esse nome.</p>
                ) : achados.map(g => (
                  <button key={g.jid} type="button" role="option" aria-selected={g.jid === escolhido} title={g.jid}
                    onClick={() => setEscolhido(g.jid)}
                    className={cn('block w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                      g.jid === escolhido && 'bg-primary/10 font-medium text-primary hover:bg-primary/10')}>
                    {g.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Seletor aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as AllowedKind)} className="w-full sm:w-48">
                  <option value="cliente">{ALLOWED_KIND_LABEL.cliente}</option>
                  <option value="logs">{ALLOWED_KIND_LABEL.logs}</option>
                </Seletor>
                <Button size="sm" onClick={incluir} disabled={!escolhido || gravando}>Incluir</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdicionando(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void abrirAdicionar()} disabled={carregando || gravando}>Adicionar grupo</Button>
          )}
        </div>
      )}

      {erro && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{erro}</p>}
      {lista !== null && (
        <div className="mt-3">
          <Button size="sm" onClick={() => void salvar()} disabled={gravando || !mudou}>Salvar lista</Button>
        </div>
      )}
      {dialogoDeConfirmacao}
    </section>
  );
}
