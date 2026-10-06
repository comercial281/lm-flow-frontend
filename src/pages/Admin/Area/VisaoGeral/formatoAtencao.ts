import { dinheiro, plural, telefone, tempoDesde } from '@/lib/formato';
import type { ClienteComProblema, Problema, Situacao } from '@/types/admin/overview';

// Textos e destinos da aba Atenção. O servidor manda dado (números, nomes,
// datas); a frase e o botão nascem aqui, num lugar só.
export interface LinhaDeProblema {
  texto: string;
  acao: { rotulo: string; href: string };
}

export const CONTADORES: { chave: Situacao; rotulo: string }[] = [
  { chave: 'ativo', rotulo: 'Ativos' },
  { chave: 'provisionando', rotulo: 'Provisionando' },
  { chave: 'congelado', rotulo: 'Congelados' },
  { chave: 'com_erro', rotulo: 'Com erro' },
];

// Entrega 4: abre a tela de Números já rolada e aberta no cliente.
const numerosDo = (c: ClienteComProblema) => ({
  rotulo: 'Ver números',
  href: `/admin/clientes/numeros?cliente=${encodeURIComponent(c.schema)}`,
});

export function linhasDoProblema(c: ClienteComProblema, p: Problema, agora: Date = new Date()): LinhaDeProblema[] {
  const custos = `/admin/clientes/custos?tenant=${encodeURIComponent(c.schema)}`;
  switch (p.kind) {
    case 'numero_caido':
      return p.numbers.map((n) => {
        const fone = telefone(n.phone);
        const quem = fone ? `${fone} (${n.name})` : n.name;
        const texto = n.since ? `Número ${quem} caiu ${tempoDesde(n.since, agora)}` : `Número ${quem} está desconectado`;
        return { texto, acao: numerosDo(c) };
      });
    case 'erro_criacao':
      return [{ texto: 'Deu erro ao criar o cliente', acao: { rotulo: 'Ver clientes', href: '/admin/clientes' } }];
    case 'ia_falhando':
      return [
        {
          texto: `${plural(p.count, 'chamada da IA falhou', 'chamadas da IA falharam')} nas últimas 24 h`,
          acao: { rotulo: 'Ver erros', href: `${custos}&so_erros=1` },
        },
      ];
    case 'custo_ia_alto': {
      const normal = p.daily_avg_brl > 0 ? `normal: ${dinheiro(p.daily_avg_brl)}/dia` : 'sem histórico';
      return [{ texto: `IA gastou ${dinheiro(p.last_24h_brl)} nas últimas 24 h (${normal})`, acao: { rotulo: 'Ver custos', href: custos } }];
    }
    case 'aviso_nao_chega':
      return [
        {
          texto: `${plural(p.people, 'pessoa não recebe', 'pessoas não recebem')} aviso`,
          acao: { rotulo: 'Ver pessoas', href: `/admin/usuarios?tenant=${encodeURIComponent(c.schema)}&notificacao=com_problema` },
        },
      ];
    case 'chamado_sem_resposta':
      return [
        {
          texto: `${plural(p.count, 'chamado esperando', 'chamados esperando')} resposta`,
          acao: p.ticket_id
            ? { rotulo: 'Abrir chamado', href: `/admin/suporte/${p.ticket_id}` }
            : { rotulo: 'Ver chamados', href: '/admin/suporte' },
        },
      ];
    default: {
      // Servidor mais novo que a tela: tipo que ela não conhece fica de fora em vez de quebrar a aba.
      const _desconhecido: never = p;
      void _desconhecido;
      return [];
    }
  }
}
