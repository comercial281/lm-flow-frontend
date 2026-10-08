const dois = (n: number) => String(n).padStart(2, '0');

/** "2026-10-09" + "14:30" no horário de quem usa → ISO pra mandar ao servidor. */
export function juntarDataEHora(data: string, hora: string): string {
  const [a, m, d] = data.split('-').map(Number);
  const [h, min] = (hora || '00:00').split(':').map(Number);
  return new Date(a, m - 1, d, h, min, 0, 0).toISOString();
}

/** O contrário, pra preencher a janela de edição. */
export function separarDataEHora(iso: string): { data: string; hora: string } {
  const x = new Date(iso);
  return {
    data: `${x.getFullYear()}-${dois(x.getMonth() + 1)}-${dois(x.getDate())}`,
    hora: `${dois(x.getHours())}:${dois(x.getMinutes())}`,
  };
}

/** Sugestão da janela nova: a próxima hora cheia. */
export function proximaHoraCheia(agora: Date = new Date()): { data: string; hora: string } {
  const x = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), agora.getHours() + 1, 0, 0, 0);
  return separarDataEHora(x.toISOString());
}
