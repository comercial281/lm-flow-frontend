// A QUAIS NÚMEROS DA ROLETA cada pessoa tem acesso.
//
// É o miolo da lista de marcar: é por esta resposta que a tela decide se
// pergunta "atende por qual número?" (só quando há mais de um), se deixa marcar
// a pessoa, ou se oferece o "Liberar e adicionar".
//
// Fica fora do componente pelo mesmo motivo do roletaFormChecks: é a regra que
// precisa ser conferível sem montar o formulário inteiro.
//
// A relação pessoa↔número JÁ EXISTE no sistema (a equipe de cada instância). A
// tela antiga a usava ao contrário — obrigava a escolher o número primeiro para
// só então filtrar a gente —, e por isso quem não tinha acesso simplesmente não
// aparecia, sem dizer por quê.

export interface InstanciaDaRoleta {
  inbox_id: string;
  is_active: boolean;
}

export interface EquipeInput {
  /** As instâncias da roleta, como estão no formulário. */
  instances: InstanciaDaRoleta[];
  /** O número de entrada — é o que vale quando a roleta ainda não tem lista. */
  inboxDeEntrada: string;
  /**
   * Quem está em cada número: `{ [inbox_id]: [{ id, auto_granted? }] }`.
   *
   * `auto_granted` é a marca do acesso AUTOMÁTICO — o sistema liberou a pessoa
   * para ela abrir um lead que já é dela naquele número. Esse acesso NÃO a torna
   * elegível a receber lead novo (é a barreira de 30/07/2026), e o servidor
   * recusa a roleta que a inclua. Contar esse acesso aqui era o que fazia a
   * tela oferecer gente que o salvamento depois rejeitava.
   */
  membrosPorInstancia: Record<string, { id: string; auto_granted?: boolean }[]>;
}

/**
 * Os números DESTA ROLETA em que a pessoa pode receber lead.
 *
 * Vazio = ela não pode entrar na roleta enquanto alguém não liberar o acesso —
 * a barreira de 30/07/2026, que existe porque corretor sorteado sem acesso fica
 * com o card visível no funil e a conversa invisível na caixa.
 */
export function instanciasComAcesso(userId: string, f: EquipeInput): string[] {
  if (!userId) return [];

  const ativas = f.instances.filter(i => i.is_active && i.inbox_id).map(i => i.inbox_id);
  // Sem lista de números (roleta de um número só, ou formulário recém-aberto),
  // quem responde é o número de entrada.
  const alvos = ativas.length ? ativas : [f.inboxDeEntrada];

  return alvos.filter(id =>
    !!id && (f.membrosPorInstancia[id] ?? []).some(u => u.id === userId && u.auto_granted !== true),
  );
}

/**
 * O número que a pessoa vai atender ao ser marcada.
 *
 * Um acesso só = resolvido, e a tela nem pergunta. Vários = devolve vazio, que
 * é o sinal para a tela mostrar o seletor. É isto que faz a pergunta "atende
 * pelo quê?" desaparecer no caso que é a maioria.
 */
export function instanciaResolvida(userId: string, f: EquipeInput): string {
  const acessos = instanciasComAcesso(userId, f);
  return acessos.length === 1 ? acessos[0] : '';
}
