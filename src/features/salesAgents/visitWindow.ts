/**
 * A leitura em português da antecedência mínima da visita.
 *
 * O campo é um número de HORAS, e ninguém lê "24" e pensa "o primeiro horário que
 * ela oferece é amanhã" — que é exatamente o que ele faz. Quem calcula o horário
 * de verdade é o servidor (ele manda para a IA a hora atual e o primeiro horário
 * livre já resolvido); esta frase é a MESMA leitura, para quem configura.
 *
 * Mora fora do JSX porque a tela da IA Vendedora tem ~4.800 linhas e nada
 * testável cabe lá dentro — a mesma decisão da janela do follow-up.
 */
export function antecedenciaResumo(horas: number): string {
  const h = Number.isFinite(horas) ? Math.max(0, Math.trunc(horas)) : 24;

  if (h === 0) {
    return 'Sem antecedência mínima: ela pode oferecer o próximo horário livre, ainda hoje.';
  }
  if (h < 24) {
    return `Com ${h} ${h === 1 ? 'hora' : 'horas'}, o primeiro horário que ela oferece é daqui a ${h} ${
      h === 1 ? 'hora' : 'horas'
    }.`;
  }
  if (h === 24) {
    return 'Com 24 horas, o primeiro horário que ela oferece é amanhã.';
  }
  if (h % 24 === 0) {
    const dias = h / 24;
    return `Com ${h} horas, o primeiro horário que ela oferece é daqui a ${dias} dias.`;
  }
  return `Com ${h} horas, ela só oferece horário a partir de ${h} horas a contar de agora.`;
}
