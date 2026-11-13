import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { criarServicoDeFotos, propertyPhotosService, type PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import {
  idDaCapa, juntar, moverNoGrupo, moverParaCapa, posicoes, separar, separarCapaDoLote, tipoPeloEndereco, validarArquivos,
} from './regrasDasFotos';

type Lote = 'ocultar' | 'mostrar' | 'excluir' | 'sem_marca' | 'com_marca';

// A ordem gravada já é "fotos, depois mídias"?
const jaEstaArrumada = (fotos: PropertyPhoto[]) => {
  const { imagens, midias } = separar(fotos);
  return juntar(imagens, midias).every((p, i) => p.id === fotos[i]?.id);
};

/** As mesmas ações para as fotos do imóvel e as das áreas comuns do condomínio. */
export type ServicoDeFotos = ReturnType<typeof criarServicoDeFotos>;

// `servico` precisa ser estável (constante de módulo): ele entra nas dependências.
export function useFotosDoImovel(propertyId: string, servico: ServicoDeFotos = propertyPhotosService) {
  const [fotos, setFotosEstado] = useState<PropertyPhoto[]>([]);
  // Cópia sempre atual da lista: o fim de um envio lento parte da lista de AGORA,
  // não da que existia quando o envio começou.
  const fotosRef = useRef<PropertyPhoto[]>([]);
  const enviandoRef = useRef(false);
  const setFotos = useCallback((v: PropertyPhoto[] | ((prev: PropertyPhoto[]) => PropertyPhoto[])) => {
    fotosRef.current = typeof v === 'function' ? v(fotosRef.current) : v;
    setFotosEstado(fotosRef.current);
  }, []);
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
      const lista = await servico.list(propertyId);
      if (meu !== pedido.current) return;
      setFotos(lista);
      setErro(false);
    } catch {
      if (meu === pedido.current) setErro(true);
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, [propertyId, servico, setFotos]);

  useEffect(() => { void carregar(); }, [carregar]);

  const gravarOrdem = useCallback(async (nova: PropertyPhoto[]) => {
    setFotos(nova);
    setSalvandoOrdem(true);
    try {
      setFotos(await servico.reorder(propertyId, posicoes(nova)));
    } catch {
      toast.error('Não deu pra salvar a ordem. Tente de novo.');
      await carregar();
    } finally {
      setSalvandoOrdem(false);
    }
  }, [propertyId, servico, carregar, setFotos]);

  const mover = useCallback(async (grupo: 'imagens' | 'midias', deId: string, paraId: string) => {
    const sep = separar(fotosRef.current);
    const movido = moverNoGrupo(sep[grupo], deId, paraId);
    if (!movido) return;
    await gravarOrdem(grupo === 'imagens' ? juntar(movido, sep.midias) : juntar(sep.imagens, movido));
  }, [gravarOrdem]);

  // Põe as novas no fim e, se a ordem gravada ficaria fora de "fotos, depois mídias", regrava.
  const acrescentar = useCallback(async (novas: PropertyPhoto[]) => {
    const todas = [...fotosRef.current, ...novas];
    if (jaEstaArrumada(todas)) setFotos(todas);
    else { const { imagens, midias } = separar(todas); await gravarOrdem(juntar(imagens, midias)); }
  }, [setFotos, gravarOrdem]);

  const enviar = useCallback(async (files: File[]) => {
    const { ok, recusados } = validarArquivos(files);
    recusados.forEach(msg => toast.error(msg));
    if (!ok.length) return;
    if (enviandoRef.current) { toast.info('Espere o envio terminar'); return; }
    enviandoRef.current = true;
    setEnviando(0);
    try {
      // Sem tipo: no envio de arquivo o servidor descobre vídeo e áudio (inferred_photo_type).
      const criadas = await servico.upload(propertyId, ok, { published: true, onProgress: setEnviando });
      toast.success(criadas.length === 1 ? '1 arquivo enviado' : `${criadas.length} arquivos enviados`);
      await acrescentar(criadas);
    } catch {
      toast.error('Não deu pra enviar. Confira a internet e tente de novo.');
    } finally {
      enviandoRef.current = false;
      setEnviando(null);
    }
  }, [propertyId, servico, acrescentar]);

  const adicionarPorEndereco = useCallback(async (url: string) => {
    try {
      // O servidor só descobre vídeo e áudio no envio de arquivo; por endereço o tipo sai da extensão.
      const tipo = tipoPeloEndereco(url);
      const nova = await servico.create(propertyId, {
        file_url: url.trim(), ...(tipo ? { photo_type: tipo } : {}), published: true,
      });
      await acrescentar([nova]);
      toast.success('Foto adicionada');
      return true;
    } catch {
      toast.error('Não deu pra adicionar. Confira o endereço.');
      return false;
    }
  }, [propertyId, servico, acrescentar]);

  const usarComoCapa = useCallback(async (id: string) => {
    try {
      await servico.setAsCover(propertyId, id);
      setFotos(prev => moverParaCapa(prev, id));
      toast.success('Capa atualizada');
    } catch {
      toast.error('Não deu pra trocar a capa.');
    }
  }, [propertyId, servico, setFotos]);

  const alternarVisivel = useCallback(async (id: string) => {
    const atual = fotosRef.current.find(p => p.id === id);
    if (!atual) return;
    try {
      const nova = await servico.update(propertyId, id, { published: !atual.published });
      setFotos(prev => prev.map(p => (p.id === id ? { ...p, published: nova.published } : p)));
      toast.success(nova.published ? 'Voltou a aparecer' : 'Oculta do site, dos portais e da IA');
    } catch {
      toast.error('Não deu pra mudar. Tente de novo.');
    }
  }, [propertyId, servico, setFotos]);

  // Foto que já veio com o logo do cliente: sai no site sem a nossa marca por cima.
  const alternarMarca = useCallback(async (id: string) => {
    const atual = fotosRef.current.find(p => p.id === id);
    if (!atual) return;
    try {
      const nova = await servico.update(propertyId, id, { skip_watermark: !atual.skip_watermark });
      setFotos(prev => prev.map(p => (p.id === id ? { ...p, skip_watermark: nova.skip_watermark } : p)));
      toast.success(nova.skip_watermark ? "Sai no site sem a marca d'água" : "Volta a sair com a marca d'água");
    } catch {
      toast.error('Não deu pra mudar. Tente de novo.');
    }
  }, [propertyId, servico, setFotos]);

  const excluir = useCallback(async (id: string) => {
    try {
      await servico.delete(propertyId, id);
      setFotos(prev => prev.filter(p => p.id !== id));
      toast.success('Excluída');
    } catch {
      toast.error('Não deu pra excluir. Tente de novo.');
    }
  }, [propertyId, servico, setFotos]);

  const emLote = useCallback(async (ids: string[], acao: Lote) => {
    const capaId = idDaCapa(fotosRef.current);
    const alvo = acao === 'ocultar' ? separarCapaDoLote(ids, capaId) : { ids, pulouCapa: false };
    let feitos = 0;
    let falhas = 0;
    // Um por vez: o servidor não tem rota de lote, e em paralelo uma rede ruim
    // derrubaria todas juntas.
    for (const id of alvo.ids) {
      try {
        if (acao === 'excluir') await servico.delete(propertyId, id);
        else if (acao === 'sem_marca' || acao === 'com_marca') await servico.update(propertyId, id, { skip_watermark: acao === 'sem_marca' });
        else await servico.update(propertyId, id, { published: acao === 'mostrar' });
        feitos++;
      } catch {
        falhas++;
      }
    }
    await carregar();
    return { feitos, falhas, pulouCapa: alvo.pulouCapa };
  }, [propertyId, servico, carregar]);

  return {
    fotos, carregando, erro, enviando, salvandoOrdem,
    capaId: idDaCapa(fotos),
    carregar, enviar, adicionarPorEndereco, usarComoCapa, mover, alternarVisivel, alternarMarca, excluir, emLote,
  };
}

export type FotosDoImovel = ReturnType<typeof useFotosDoImovel>;
