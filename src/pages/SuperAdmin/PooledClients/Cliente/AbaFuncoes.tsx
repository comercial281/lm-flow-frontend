// src/pages/SuperAdmin/PooledClients/Cliente/AbaFuncoes.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Checkbox, Label } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { clientesService } from '@/services/superAdmin/clientesService';
import { itemLabel, type CatalogItem } from '../../featureCatalog';
import QuadrosDeFuncoes from '../QuadrosDeFuncoes';
import { pedidoDesligarMenu } from '../confirmacoes';
import { ESQUELETO } from '../estilo';
import type { PropsDaAba } from './Pagina';

// Funções do cliente: cada interruptor grava na hora (otimista, volta no erro),
// com "Desfazer". Desligar o menu inteiro confirma antes.
export default function AbaFuncoes({ cliente, recarregar }: PropsDaAba) {
  const [dados, setDados] = useState<{ catalog: CatalogItem[]; features: Record<string, boolean> } | null>(null);
  const [erro, setErro] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [somenteDiferentes, setSomenteDiferentes] = useState(false);
  const atual = useRef<Record<string, boolean>>({});
  const diferentes = new Set((cliente.package_diff?.features ?? []).map((f) => f.key));

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const r = await clientesService.funcoes(cliente.id);
      atual.current = r.features;
      setDados(r);
    } catch { setErro(true); }
  }, [cliente.id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const ligada = (k: string) => atual.current[k] !== false;

  const gravar = async (patch: Record<string, boolean>) => {
    // Só mexe nas chaves deste pedido: outra troca em andamento não é pisada.
    const chaves = Object.keys(patch);
    const antes = Object.fromEntries(chaves.map((k) => [k, ligada(k)]));
    const aplicar = (parte: Record<string, boolean>) => {
      atual.current = { ...atual.current, ...parte };
      setDados((d) => (d ? { ...d, features: atual.current } : d));
    };
    aplicar(patch);
    try {
      const novas = await clientesService.mudarFuncoes(cliente.id, patch);
      aplicar(Object.fromEntries(chaves.filter((k) => k in novas).map((k) => [k, novas[k]])));
      recarregar(); // o "≠ pacote" volta atualizado do servidor
      return true;
    } catch (e) {
      aplicar(antes);
      throw e;
    }
  };

  const aoMudar = async (patch: Record<string, boolean>, contexto: { menu?: string; tema?: string }) => {
    const chaves = Object.keys(patch);
    if (contexto.tema && chaves.length > 0 && chaves.every((k) => patch[k] === false)) {
      const ok = await confirmar({
        titulo: `Desligar tudo de ${contexto.tema}?`,
        descricao: `Os menus deste tema somem para as ${cliente.members ?? 0} pessoas de ${cliente.name}.`,
        rotuloDaAcao: 'Desligar', destrutivo: true,
      });
      if (!ok) return false;
    }
    if (contexto.menu && chaves.length === 1 && patch[chaves[0]] === false) {
      const ok = await confirmar(pedidoDesligarMenu(contexto.menu, cliente.members ?? 0, cliente.name));
      if (!ok) return false;
    }
    await gravar(patch);
    if (chaves.length === 1) {
      const item = dados?.catalog.find((c) => c.key === chaves[0]);
      const nome = item ? itemLabel(item) : chaves[0];
      const anterior = !patch[chaves[0]];
      toast(`${nome} ${patch[chaves[0]] ? 'ligada' : 'desligada'}`, {
        action: { label: 'Desfazer', onClick: () => { void gravar({ [chaves[0]]: anterior }).catch(() => toast.error('Não deu pra desfazer.')); } },
      });
    }
    return true;
  };

  if (erro) return <EmptyState tipo="erro" title="Não deu para carregar as funções" aoTentarDeNovo={() => void carregar()} />;
  if (!dados) return <div aria-busy="true" className={`h-60 ${ESQUELETO}`} />;
  return (
    <>
      {cliente.package && (
        <div className="mb-4 flex items-center gap-2">
          <Checkbox id="so-difere" checked={somenteDiferentes} onCheckedChange={(v) => setSomenteDiferentes(v === true)} aria-label="Só o que difere do pacote" />
          <Label htmlFor="so-difere" className="text-sm">Só o que difere do pacote</Label>
        </div>
      )}
      <QuadrosDeFuncoes catalog={dados.catalog} ligada={ligada} aoMudar={aoMudar} diferentes={diferentes} somenteDiferentes={somenteDiferentes} />
      {dialogoDeConfirmacao}
    </>
  );
}
