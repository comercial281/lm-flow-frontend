// "Confiar neste navegador por 30 dias" da verificação em duas etapas.
//
// O servidor devolve um passe assinado (`mfa_trust_token`) quando a pessoa marca a
// caixinha ao digitar o código. A tela guarda o passe aqui, por e-mail, e manda no
// próximo login: com ele válido, a senha basta. Quem decide é o servidor (o passe
// cai sozinho quando a pessoa troca a senha ou desliga e religa a verificação).
//
// O navegador interno do WhatsApp pode recusar o armazenamento: aí não guarda e o
// código é pedido de novo, sem erro.

const PREFIXO = 'lmflow:mfa_trust:';

const chave = (email: string) => `${PREFIXO}${email.trim().toLowerCase()}`;

export const lerConfianca = (email: string): string | undefined => {
  if (!email.trim()) return undefined;
  try {
    return localStorage.getItem(chave(email)) || undefined;
  } catch {
    return undefined;
  }
};

export const guardarConfianca = (email: string, passe: string | undefined | null): void => {
  if (!email.trim() || !passe) return;
  try {
    localStorage.setItem(chave(email), passe);
  } catch {
    /* navegador sem armazenamento: pede o código de novo da próxima vez */
  }
};

export const esquecerConfianca = (email: string): void => {
  try {
    localStorage.removeItem(chave(email));
  } catch {
    /* noop */
  }
};

// Código reserva: 8 caracteres com letra (o servidor aceita com ou sem o traço).
export const pareceCodigoReserva = (valor: string): boolean => {
  const limpo = valor.toLowerCase().replace(/[^a-z0-9]/g, '');
  return limpo.length === 8 && /[a-z]/.test(limpo);
};

// Arquivo .txt dos códigos reserva (botão "Baixar" do Perfil, Segurança).
export const textoDosCodigosReserva = (codigos: string[], email: string, quando: Date = new Date()): string => {
  const data = quando.toLocaleDateString('pt-BR');
  return [
    'LM Flow · Códigos reserva da verificação em duas etapas',
    `Conta: ${email}`,
    `Gerados em: ${data}`,
    '',
    'Cada código entra uma vez só, no lugar do código do aplicativo.',
    'Guarde este arquivo fora do celular. Gerar códigos novos invalida estes.',
    '',
    ...codigos.map((c, i) => `${String(i + 1).padStart(2, ' ')}. ${c}`),
    '',
  ].join('\n');
};

export const baixarCodigosReserva = (codigos: string[], email: string): void => {
  const blob = new Blob([textoDosCodigosReserva(codigos, email)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lmflow-codigos-reserva.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
