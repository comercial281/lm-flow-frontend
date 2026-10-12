// Ordem das fotos do imóvel: a primeira foto é sempre a capa (06/10/2026).
// O servidor devolve a lista com a capa na frente; vídeo e áudio nunca são capa.
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

export function ehVideoOuAudio(photo: PropertyPhoto): boolean {
  const tipo = photo.content_type ?? '';
  return tipo.startsWith('video/') || tipo.startsWith('audio/') || photo.photo_type === 'video' || photo.photo_type === 'audio';
}

// A capa marcada; sem marca, a primeira imagem da lista (mesma regra do servidor).
export function idDaCapa(photos: PropertyPhoto[]): string | null {
  const marcada = photos.find(p => p.is_cover && !ehVideoOuAudio(p));
  return (marcada ?? photos.find(p => !ehVideoOuAudio(p)))?.id ?? null;
}

// "Definir como capa": a foto vai para a frente e as outras mantêm a ordem.
export function moverParaCapa(photos: PropertyPhoto[], id: string): PropertyPhoto[] {
  const alvo = photos.find(p => p.id === id);
  if (!alvo) return photos;
  return [alvo, ...photos.filter(p => p.id !== id)].map(p => ({ ...p, is_cover: p.id === id }));
}

export function posicoes(photos: PropertyPhoto[]): { id: string; position: number }[] {
  return photos.map((p, i) => ({ id: p.id, position: i }));
}
