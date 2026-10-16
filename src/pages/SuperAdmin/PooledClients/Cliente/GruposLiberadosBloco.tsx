import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Seletor } from '@/components/base/Seletor';
import { Button } from '@/components/ui/ds';
import { SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import { clientesService } from '@/services/superAdmin/clientesService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import type { ClientePooled } from '@/types/admin/clientes';
import {
  ALLOWED_KIND_LABEL, addAllowedGroup, allowedGroupsFrom, allowedGroupsPatch, allowedRow, groupsPatch,
  removeAllowedGroup, sortGroupsForPicker, suggestAllowedGroups,
  type AllowedGroup, type AllowedKind, type ClientGroupJids, type WaGroup,
} from '../clientGroups';

type Props = {
  cliente: ClientePooled;
  groupJids: ClientGroupJids;
  patch: (corpo: Record<string, unknown>) => Promise<unknown>;
};

// Lista de grupos da central liberados para este cliente (spec 2026-10-15).
// Só a Leal mexe aqui; dentro do CRM o cliente vê só os "Com o cliente".
// A lista da central só carrega no clique (conversa com o WhatsApp operacional).
export function GruposLiberadosBloco({ cliente, groupJids, patch }: Props) {
  const gravada = allowedGroupsFrom(cliente.settings);
  const [lista, setLista] = useState<AllowedGroup[] | null>(gravada);
  const [central, setCentral] = useState<WaGroup[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [escolhido, setEscolhido] = useState('');
  const [tipo, setTipo] = useState<AllowedKind>('cliente');
  const [gravando, setGravando] = useState(false);
  const [mudou, setMudou] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  // Devolve null quando a leitura falha (distinto de lista vazia).
  const carregarCentral = async (): Promise<WaGroup[] | null> => {
    if (central) return central;
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
    setAdicionando(true);
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
            <div className="flex flex-wrap items-end gap-2">
              <Seletor aria-label="Grupo" value={escolhido} onChange={e => setEscolhido(e.target.value)} className="w-full sm:w-80">
                <option value="">{carregando ? 'Carregando grupos do número operacional...' : 'Escolha o grupo'}</option>
                {opcoes.map(g => <option key={g.jid} value={g.jid}>{g.name}</option>)}
              </Seletor>
              <Seletor aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as AllowedKind)} className="w-full sm:w-48">
                <option value="cliente">{ALLOWED_KIND_LABEL.cliente}</option>
                <option value="logs">{ALLOWED_KIND_LABEL.logs}</option>
              </Seletor>
              <Button size="sm" onClick={incluir} disabled={!escolhido || gravando}>Incluir</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdicionando(false)}>Cancelar</Button>
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
