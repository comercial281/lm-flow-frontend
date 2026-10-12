import { describe, expect, it } from 'vitest';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import {
  contagens, daAba, destinoDaVolta, iaNoVideo, juntar, linkDasFotos, LIMITE_DO_VIDEO_DA_IA,
  moverNoGrupo, podeOcultar, separar, separarCapaDoLote, validarArquivos,
} from './regrasDasFotos';

const foto = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  ({ id, photo_type: 'main', content_type: 'image/jpeg', is_cover: false, published: true, ...extra }) as PropertyPhoto;
const video = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  foto(id, { photo_type: 'video', content_type: 'video/mp4', file_size_bytes: 5_000_000, ...extra });
const audio = (id: string) => foto(id, { photo_type: 'audio', content_type: 'audio/mpeg' });

describe('regrasDasFotos', () => {
  it('separa imagens de vídeos e áudios mantendo a ordem do servidor', () => {
    const sep = separar([foto('a'), video('v'), foto('b'), audio('s')]);
    expect(sep.imagens.map(p => p.id)).toEqual(['a', 'b']);
    expect(sep.midias.map(p => p.id)).toEqual(['v', 's']);
  });

  it('ordem junta fotos e depois mídias', () => {
    const sep = separar([video('v'), foto('a'), audio('s'), foto('b')]);
    expect(juntar(sep.imagens, sep.midias).map(p => p.id)).toEqual(['a', 'b', 'v', 's']);
  });

  it('mover troca de lugar dentro do grupo; id desconhecido devolve null', () => {
    const g = [foto('a'), foto('b'), foto('c')];
    expect(moverNoGrupo(g, 'c', 'a')?.map(p => p.id)).toEqual(['c', 'a', 'b']);
    expect(moverNoGrupo(g, 'a', 'a')).toBeNull();
    expect(moverNoGrupo(g, 'x', 'a')).toBeNull();
  });

  it('abas filtram e contam', () => {
    const lista = [foto('a'), foto('b', { published: false }), video('v'), audio('s'), video('w', { published: false })];
    const sep = separar(lista);
    expect(daAba(sep, 'fotos')).toEqual({ imagens: sep.imagens, midias: [] });
    expect(daAba(sep, 'midias')).toEqual({ imagens: [], midias: sep.midias });
    expect(daAba(sep, 'ocultas').imagens.map(p => p.id)).toEqual(['b']);
    expect(daAba(sep, 'ocultas').midias.map(p => p.id)).toEqual(['w']);
    expect(contagens(lista)).toEqual({ tudo: 5, fotos: 2, midias: 3, ocultas: 2 });
  });

  it('a IA manda só o primeiro vídeo MP4 visível, com tamanho conhecido, até 16 MB', () => {
    const mapa = iaNoVideo([
      video('mov', { content_type: 'video/quicktime' }),
      video('grande', { file_size_bytes: LIMITE_DO_VIDEO_DA_IA + 1 }),
      video('semTamanho', { file_size_bytes: 0 }),
      video('oculto', { published: false }),
      video('certo'),
      video('outro'),
      audio('s'),
      video('semTipo', { content_type: null as unknown as string, file_name: 'Tour.MP4' }),
    ]);
    expect(mapa.get('mov')).toBe('formato');
    expect(mapa.get('grande')).toBe('grande');
    expect(mapa.get('semTamanho')).toBe('semTamanho');
    expect(mapa.has('oculto')).toBe(false);
    expect(mapa.get('certo')).toBe('manda');
    expect(mapa.get('outro')).toBe('soUmVideo');
    expect(mapa.has('s')).toBe(false);
    expect(mapa.get('semTipo')).toBe('soUmVideo');
  });

  it('valida tipo e tamanho dos arquivos', () => {
    const ok = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const ruim = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
    const r = validarArquivos([ok, ruim]);
    expect(r.ok).toEqual([ok]);
    expect(r.recusados).toEqual(['a.exe: tipo de arquivo não aceito']);
  });

  it('link e volta', () => {
    expect(linkDasFotos('9')).toBe('/properties/9/fotos');
    expect(linkDasFotos('9', 'cadastro')).toBe('/properties/9/fotos?de=cadastro');
    expect(destinoDaVolta({ id: '9', de: 'cadastro', kind: 'resale', temHistorico: true }))
      .toEqual({ para: '/properties/9/editar', rotulo: 'Voltar ao cadastro' });
    expect(destinoDaVolta({ id: '9', de: null, kind: 'development', temHistorico: true }))
      .toEqual({ para: -1, rotulo: 'Imóveis' });
    expect(destinoDaVolta({ id: '9', de: null, kind: 'development', temHistorico: false }))
      .toEqual({ para: '/properties?aba=empreendimentos', rotulo: 'Imóveis' });
  });

  it('a capa não se oculta; mostrar de volta sempre pode', () => {
    expect(podeOcultar(foto('a'), 'a')).toBe(false);
    expect(podeOcultar(foto('b'), 'a')).toBe(true);
    expect(podeOcultar(foto('a', { published: false }), 'a')).toBe(true);
    expect(separarCapaDoLote(['a', 'b'], 'a')).toEqual({ ids: ['b'], pulouCapa: true });
    expect(separarCapaDoLote(['b'], 'a')).toEqual({ ids: ['b'], pulouCapa: false });
  });
});
