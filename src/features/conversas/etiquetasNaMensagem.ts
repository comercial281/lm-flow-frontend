// Etiquetas citadas num texto do histórico ("Tony adicionou visita-agendada, demo-0001").
// Casa por id (UUID) e por título como palavra inteira (separado por espaço ou vírgula).
// Número solto não casa: "Atribuído a Ana por Bia 2" não vira etiqueta.
export interface EtiquetaDaConta {
  id: string;
  title: string;
  color: string;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function etiquetasNaMensagem(
  conteudo: string,
  etiquetas: EtiquetaDaConta[],
): { texto: string; etiquetas: EtiquetaDaConta[] } {
  let texto = conteudo;
  const achadas: EtiquetaDaConta[] = [];
  const jaAchada = (e: EtiquetaDaConta) => achadas.some(a => a.id === e.id);

  const uuids = (conteudo.match(UUID) || []).map(u => u.toLowerCase());
  for (const e of etiquetas) {
    if (uuids.includes(String(e.id).toLowerCase()) && !jaAchada(e)) {
      achadas.push(e);
      texto = texto.replace(new RegExp(escapar(String(e.id)), 'gi'), '');
    }
  }

  // Títulos maiores primeiro: "visita-agendada" sai antes de "visita".
  const porTamanho = [...etiquetas].sort((a, b) => b.title.length - a.title.length);
  for (const e of porTamanho) {
    if (!e.title || jaAchada(e)) continue;
    const re = new RegExp(`(^|[\\s,])${escapar(e.title)}(?=$|[\\s,])`, 'i');
    if (re.test(texto)) {
      achadas.push(e);
      texto = texto.replace(new RegExp(re.source, 'gi'), '$1');
    }
  }

  texto = texto
    .replace(/\s+,/g, ',')
    .replace(/,(\s*,)+/g, ',')
    .replace(/[\s,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { texto, etiquetas: achadas };
}
