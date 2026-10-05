// src/pages/SuperAdmin/PooledClients/Cliente/AbaFuncoes.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { clientesService } from '@/services/superAdmin/clientesService';
import { itemLabel, type CatalogItem } from '../../featureCatalog';
import QuadrosDeFuncoes from '../QuadrosDeFuncoes';
import { pedidoDesligarMenu } from '../confirmacoes';
import type { PropsDaAba } from './Pagina';

// Funções do cliente: cada interruptor grava na hora (otimista, volta no erro),
// com "Desfazer". Desligar o menu inteiro confirma antes.
export default function AbaFuncoes({ cliente }: PropsDaAba) {
  const [dados, setDados] = useState<{ catalog: CatalogItem[]; features: Record<string, boolean> } | null>(null);
  const [erro, setErro] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const atual = useRef<Record<string, boolean>>({});

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
    const antes = { ...atual.current };
    atual.current = { ...atual.current, ...patch };
    setDados((d) => (d ? { ...d, features: atual.current } : d));
    try {
      const novas = await clientesService.mudarFuncoes(cliente.id, patch);
      atual.current = novas;
      setDados((d) => (d ? { ...d, features: novas } : d));
      return true;
    } catch (e) {
      atual.current = antes;
      setDados((d) => (d ? { ...d, features: antes } : d));
      throw e;
    }
  };

  const aoMudar = async (patch: Record<string, boolean>, contexto: { menu?: string }) => {
    const chaves = Object.keys(patch);
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
  if (!dados) return <div aria-busy="true" className="h-60 animate-pulse rounded-lg bg-muted" />;
  return (
    <>
      <QuadrosDeFuncoes catalog={dados.catalog} ligada={ligada} aoMudar={aoMudar} />
      {dialogoDeConfirmacao}
    </>
  );
}
