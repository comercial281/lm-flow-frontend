// Etiquetas citadas num texto do histórico. O servidor escreve exatamente
// "<nome> adicionou <etiquetas>" / "<nome> removeu <etiquetas>" (etiquetas separadas por ", ").
// Título só casa na lista depois do verbo, e inteiro: o resto do texto nunca é editado.
// UUID de etiqueta casa em qualquer ponto (como antes). Número solto não casa.
export interface EtiquetaDaConta {
  id: string;
  title: string;
  color: string;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ADICIONOU_REMOVEU = /^(.*?) (adicionou|removeu) (.+)$/s;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function etiquetasNaMensagem(
  conteudo: string,
  etiquetas: EtiquetaDaConta[],
): { texto: string; etiquetas: EtiquetaDaConta[] } {
  const achadas: Array<{ pos: number; etiqueta: EtiquetaDaConta }> = [];
  const jaAchada = (e: EtiquetaDaConta) => achadas.some(a => a.etiqueta.id === e.id);
  let texto = conteudo;

  const uuids = (conteudo.match(UUID) || []).map(u => u.toLowerCase());
  for (const e of etiquetas) {
    const id = String(e.id);
    if (uuids.includes(id.toLowerCase()) && !jaAchada(e)) {
      achadas.push({ pos: conteudo.toLowerCase().indexOf(id.toLowerCase()), etiqueta: e });
      texto = texto.replace(new RegExp(escapar(id), 'gi'), '').replace(/\s+/g, ' ').trim();
    }
  }

  const m = ADICIONOU_REMOVEU.exec(texto);
  if (m) {
    const [, nome, verbo, lista] = m;
    const inicioDaLista = texto.length - lista.length;
    const sobras: string[] = [];
    let cursor = 0;
    for (const token of lista.replace(/\.$/, '').split(', ')) {
      const etiqueta = etiquetas.find(e => e.title === token);
      if (etiqueta && !jaAchada(etiqueta)) {
        achadas.push({ pos: inicioDaLista + lista.indexOf(token, cursor), etiqueta });
      } else {
        sobras.push(token);
      }
      cursor += token.length + 2;
    }
    if (sobras.length < lista.replace(/\.$/, '').split(', ').length) {
      texto = `${nome} ${verbo}${sobras.length ? ` ${sobras.join(', ')}` : ''}`;
    }
  }

  achadas.sort((a, b) => a.pos - b.pos);
  return { texto, etiquetas: achadas.map(a => a.etiqueta) };
}
