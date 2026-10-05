import type { PedidoDeConfirmacao } from '@/hooks/useConfirmacao';

// Textos das confirmações da página do cliente: dizem o EFEITO real.
// Congelar não bloqueia login (o servidor só pausa automações, webhooks e
// tarefas agendadas) — a frase não pode prometer o contrário.
type Nome = { name: string };

export const pedidoCongelar = (t: Nome): PedidoDeConfirmacao => ({
  titulo: `Congelar ${t.name}?`,
  descricao: `As automações e o WhatsApp de ${t.name} param até descongelar. As pessoas continuam entrando no CRM.`,
  rotuloDaAcao: 'Congelar', destrutivo: true,
});

export const pedidoDescongelar = (t: Nome): PedidoDeConfirmacao => ({
  titulo: `Descongelar ${t.name}?`,
  descricao: 'As automações e o WhatsApp voltam a funcionar.',
  rotuloDaAcao: 'Descongelar',
});

export const pedidoArquivar = (t: Nome): PedidoDeConfirmacao => ({
  titulo: `Arquivar ${t.name}?`,
  descricao: 'Ele sai da lista e das contas da Visão Geral, e as automações e o WhatsApp param. Dá pra desarquivar depois.',
  rotuloDaAcao: 'Arquivar', destrutivo: true,
});

export const pedidoDesarquivar = (t: Nome): PedidoDeConfirmacao => ({
  titulo: `Desarquivar ${t.name}?`,
  descricao: 'Ele volta pra lista, e as automações e o WhatsApp voltam a funcionar.',
  rotuloDaAcao: 'Desarquivar',
});

export const pedidoRemoverPessoa = (email: string): PedidoDeConfirmacao => ({
  titulo: `Remover ${email}?`,
  descricao: 'Ela perde o acesso a este CRM.',
  rotuloDaAcao: 'Remover', destrutivo: true,
});

export const pedidoDesligarMenu = (menu: string, pessoas: number, cliente: string): PedidoDeConfirmacao => ({
  titulo: `Desligar ${menu}?`,
  descricao: `O menu some para as ${pessoas} pessoas de ${cliente}.`,
  rotuloDaAcao: 'Desligar', destrutivo: true,
});

// Textos de demonstração: vêm dos window.confirm do painel antigo, que dizem o efeito real.
export const pedidoLigarDemo = (t: Nome): PedidoDeConfirmacao => ({
  titulo: `Ligar o modo demonstração em ${t.name}?`,
  descricao: 'A partir daí este cliente só manda WhatsApp para quem escrever para o número dele, e para de mandar e-mail. '
    + 'Use só no CRM de demonstração — num cliente de verdade isso faz o sistema parar de falar com os leads dele.',
  rotuloDaAcao: 'Ligar', destrutivo: true,
});

export const pedidoSemearDemo = (t: Nome): PedidoDeConfirmacao => ({
  titulo: `Semear a imobiliária fictícia em ${t.name}?`,
  descricao: 'Cria equipe, carteira de imóveis, leads, conversas e funil, com datas de hoje. '
    + 'Se o WhatsApp já estiver conectado, o histórico nasce dentro do número real.',
  rotuloDaAcao: 'Semear',
});
