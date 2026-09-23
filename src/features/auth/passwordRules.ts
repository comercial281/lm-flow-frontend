// A senha que a pessoa cria pelo link de acesso.
//
// A régua fica fora da tela para poder ser testada sozinha, e é a MESMA do
// servidor (mínimo de 6, as duas iguais). Divergir faria a tela liberar o botão
// e o servidor recusar depois — ou o contrário, que é pior: a pessoa presa num
// aviso que não explica nada.

export const MIN_SENHA = 6;

export interface PasswordCheck {
  ok: boolean;
  /** Motivo em português, pronto para a tela. Vazio quando está tudo certo. */
  message: string;
}

export function checkNewPassword(password: string, confirmation: string): PasswordCheck {
  const senha = password ?? '';
  const confirma = confirmation ?? '';

  // Espaço nas pontas não conta como senha: o teclado do celular os acrescenta
  // sozinho, e deixar a pessoa criar uma senha que começa ou termina em espaço
  // é garantir que ela não vai conseguir digitá-la de novo amanhã.
  if (senha.trim().length < MIN_SENHA) {
    return { ok: false, message: `A senha precisa ter ao menos ${MIN_SENHA} caracteres.` };
  }
  if (senha !== confirma) {
    return { ok: false, message: 'As duas senhas não são iguais.' };
  }

  return { ok: true, message: '' };
}

export default checkNewPassword;
