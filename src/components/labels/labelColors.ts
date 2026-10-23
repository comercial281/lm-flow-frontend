// Paleta da identidade (obsidiana/violeta) pra etiquetas novas sem cor definida.
export const PALETTE = ['#7c3aed', '#9333ea', '#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#db2777'];
export const colorForName = (name: string) =>
  PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

// O backend só aceita título com letras/números/espaço/hífen/underscore, começando
// e terminando em letra/número (mesma regra do Label). Saneia aqui pra evitar o
// "Validation failed" quando o nome tem ".", "/", "º" etc.
export const sanitizeTitle = (raw: string) =>
  raw
    .replace(/[^\p{L}\p{N} _-]/gu, ' ') // troca inválidos por espaço
    .replace(/\s+/g, ' ')               // colapsa espaços
    .replace(/^[ _-]+|[ _-]+$/g, '')    // tira separador das pontas
    .trim();
