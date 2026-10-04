// Mesma regra do servidor (SupportTickets::Images): até 3, PNG/JPG/WEBP, 5 MB.
// O servidor confere os BYTES; aqui é só pra recusar na hora, com o motivo.
export const MAX_IMAGENS = 3;
export const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

export function juntarImagens(atuais: File[], novas: File[]): { imagens: File[]; erro: string | null } {
  const imagens = [...atuais];
  let erro: string | null = null;
  for (const f of novas) {
    if (!TIPOS.includes(f.type)) {
      erro = 'Envie imagens em PNG, JPG ou WEBP.';
      continue;
    }
    if (f.size > MAX_BYTES) {
      erro = 'Cada imagem pode ter até 5 MB.';
      continue;
    }
    if (imagens.length >= MAX_IMAGENS) {
      erro = 'Até 3 imagens por mensagem.';
      continue;
    }
    imagens.push(f);
  }
  return { imagens, erro };
}
