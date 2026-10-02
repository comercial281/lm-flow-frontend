// Nome cru às vezes vem como o número de telefone (o Evolution não manda pushName
// no 1º evento), às vezes até como o JID ("5511...@s.whatsapp.net"). Quem mostra
// o nome do contato precisa saber quando o "nome" é na verdade o telefone: o card
// do funil cai no melhor candidato, e a tela da oferta da roleta mascara.
export const isPhoneLikeName = (value?: string | null): boolean => {
  if (!value) return true;
  return /^[+\d\s()\-@.]+$/.test(value.replace(/whatsapp|net|us|s\./gi, ''));
};
