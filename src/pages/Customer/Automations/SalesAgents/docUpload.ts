// Aceitos no upload de arquivo. PDF entrou junto com o envio: é o formato em que a
// imobiliária tem TODO o material dela (book, planta, memorial) e a base recusava.
// MP4 entrou em 29/09/26: vídeo de lançamento/decorado que a IA manda pro lead.
export const DOC_ACCEPT = '.pdf,.txt,.md,.csv,.docx,.xlsx,.jpg,.jpeg,.png,.webp,.mp4';
export const DOC_MAX_BYTES = 25 * 1024 * 1024;
// Espelha SalesAgents::FileDelivery::MAX_VIDEO_BYTES no servidor. Vídeo não vira
// link quando é grande (decisão do dono): acima disto ele nunca sairia.
export const VIDEO_MAX_BYTES = 16 * 1024 * 1024;

// Video "de aparência" pelo MIME ou pela extensão — cobre o drag-and-drop e o
// "Todos os arquivos", que não respeitam o DOC_ACCEPT do input.
function isVideoLike(file: { name: string; type: string }) {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi)$/i.test(file.name);
}

// MP4 de verdade: às vezes o navegador manda type vazio (arrasta de fora), então a
// extensão sozinha já basta.
function isMp4(file: { name: string; type: string }) {
  return file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
}

/** A mensagem pro dono quando o arquivo não pode subir; null quando pode. */
export function docUploadError(file: { name: string; size: number; type: string }): string | null {
  if (isVideoLike(file) && !isMp4(file)) {
    return `"${file.name}" não é MP4. Converta o vídeo para MP4 antes de subir.`;
  }
  if (isMp4(file) && file.size > VIDEO_MAX_BYTES) {
    return `"${file.name}" tem mais de 16 MB. Vídeo pesado demais pro WhatsApp: reduza o vídeo antes de subir.`;
  }
  if (file.size > DOC_MAX_BYTES) {
    return `"${file.name}" tem mais de 25 MB. Reduza o arquivo antes de subir.`;
  }
  return null;
}
