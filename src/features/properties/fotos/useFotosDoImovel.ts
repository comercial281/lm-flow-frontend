import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { propertyPhotosService, type PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import {
  idDaCapa, juntar, moverNoGrupo, moverParaCapa, posicoes, separar, separarCapaDoLote, validarArquivos,
} from './regrasDasFotos';

type Lote = 'ocultar' | 'mostrar' | 'excluir';

// A ordem gravada já é "fotos, depois mídias"?
const jaEstaArrumada = (fotos: PropertyPhoto[]) => {
  const { imagens, midias } = separar(fotos);
  return juntar(imagens, midias).every((p, i) => p.id === fotos[i]?.id);
};

export function useFotosDoImovel(propertyId: string) {
  const [fotos, setFotos] = useState<PropertyPhoto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  // Resposta de leitura antiga (outro imóvel, releitura atrasada) não entra.
  const pedido = useRef(0);

  const carregar = useCallback(async () => {
    const meu = ++pedido.current;
    setCarregando(true);
    try {
      const lista = await propertyPhotosService.list(propertyId);
      if (meu !== pedido.current) return;
      setFotos(lista);
      setErro(false);
    } catch {
      if (meu === pedido.current) setErro(true);
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, [propertyId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const gravarOrdem = useCallback(async (nova: PropertyPhoto[]) => {
    setFotos(nova);
    setSalvandoOrdem(true);
    try {
      setFotos(await propertyPhotosService.reorder(propertyId, posicoes(nova)));
    } catch {
      toast.error('Não deu pra salvar a ordem. Tente de novo.');
      await carregar();
    } finally {
      setSalvandoOrdem(false);
    }
  }, [propertyId, carregar]);

  const mover = useCallback(async (grupo: 'imagens' | 'midias', deId: string, paraId: string) => {
    const sep = separar(fotos);
    const movido = moverNoGrupo(sep[grupo], deId, paraId);
    if (!movido) return;
    await gravarOrdem(grupo === 'imagens' ? juntar(movido, sep.midias) : juntar(sep.imagens, movido));
  }, [fotos, gravarOrdem]);

  // Põe as novas no fim e, se a ordem gravada ficaria fora de "fotos, depois mídias", regrava.
  const acrescentar = useCallback(async (novas: PropertyPhoto[]) => {
    const todas = [...fotos, ...novas];
    if (jaEstaArrumada(todas)) setFotos(todas);
    else { const { imagens, midias } = separar(todas); await gravarOrdem(juntar(imagens, midias)); }
  }, [fotos, gravarOrdem]);

  const enviar = useCallback(async (files: File[]) => {
    const { ok, recusados } = validarArquivos(files);
    recusados.forEach(msg => toast.error(msg));
    if (!ok.length) return;
    setEnviando(0);
    try {
      // Sem tipo: o servidor descobre vídeo e áudio pelo arquivo (inferred_photo_type).
      const criadas = await propertyPhotosService.upload(propertyId, ok, { published: true, onProgress: setEnviando });
      toast.success(criadas.length === 1 ? '1 arquivo enviado' : `${criadas.length} arquivos enviados`);
      await acrescentar(criadas);
    } catch {
      toast.error('Não deu pra enviar. Confira a internet e tente de novo.');
    } finally {
      setEnviando(null);
    }
  }, [propertyId, acrescentar]);

  const adicionarPorEndereco = useCallback(async (url: string) => {
    try {
      const nova = await propertyPhotosService.create(propertyId, { file_url: url.trim(), published: true });
      await acrescentar([nova]);
      toast.success('Foto adicionada');
      return true;
    } catch {
      toast.error('Não deu pra adicionar. Confira o endereço.');
      return false;
    }
  }, [propertyId, acrescentar]);

  const usarComoCapa = useCallback(async (id: string) => {
    try {
      await propertyPhotosService.setAsCover(propertyId, id);
      setFotos(prev => moverParaCapa(prev, id));
      toast.success('Capa atualizada');
    } catch {
      toast.error('Não deu pra trocar a capa.');
    }
  }, [propertyId]);

  const alternarVisivel = useCallback(async (id: string) => {
    const atual = fotos.find(p => p.id === id);
    if (!atual) return;
    try {
      const nova = await propertyPhotosService.update(propertyId, id, { published: !atual.published });
      setFotos(prev => prev.map(p => (p.id === id ? { ...p, published: nova.published } : p)));
      toast.success(nova.published ? 'Voltou a aparecer' : 'Oculta do site, dos portais e da IA');
    } catch {
      toast.error('Não deu pra mudar. Tente de novo.');
    }
  }, [propertyId, fotos]);

  const excluir = useCallback(async (id: string) => {
    try {
      await propertyPhotosService.delete(propertyId, id);
      setFotos(prev => prev.filter(p => p.id !== id));
      toast.success('Excluída');
    } catch {
      toast.error('Não deu pra excluir. Tente de novo.');
    }
  }, [propertyId]);

  const emLote = useCallback(async (ids: string[], acao: Lote) => {
    const capaId = idDaCapa(fotos);
    const alvo = acao === 'ocultar' ? separarCapaDoLote(ids, capaId) : { ids, pulouCapa: false };
    let feitos = 0;
    let falhas = 0;
    // Um por vez: o servidor não tem rota de lote, e em paralelo uma rede ruim
    // derrubaria todas juntas.
    for (const id of alvo.ids) {
      try {
        if (acao === 'excluir') await propertyPhotosService.delete(propertyId, id);
        else await propertyPhotosService.update(propertyId, id, { published: acao === 'mostrar' });
        feitos++;
      } catch {
        falhas++;
      }
    }
    await carregar();
    return { feitos, falhas, pulouCapa: alvo.pulouCapa };
  }, [propertyId, fotos, carregar]);

  return {
    fotos, carregando, erro, enviando, salvandoOrdem,
    capaId: idDaCapa(fotos),
    carregar, enviar, adicionarPorEndereco, usarComoCapa, mover, alternarVisivel, excluir, emLote,
  };
}

export type FotosDoImovel = ReturnType<typeof useFotosDoImovel>;
