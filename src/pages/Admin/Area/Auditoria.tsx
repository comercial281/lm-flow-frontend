import LogsView from '@/pages/SuperAdmin/ClientInstances/LogsView';

/**
 * Atividade — juntou "Uso" + "Auditoria" numa tela só (elas respondiam a mesma
 * pergunta: "o que o cliente faz lá dentro?"). Em cima, a presença (quem está
 * online / usando); embaixo, o feed de ações. Por padrão mostra só os clientes
 * — a Leal Mídia (você e a equipe) fica escondida, com toggle pra revelar.
 * O uso detalhado por usuário continua em /admin/uso (link na faixa de presença).
 */
export default function AdminAtividade() {
  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="mb-4 border-l-4 border-primary pl-3">
        <h1 className="text-xl font-semibold">Atividade</h1>
        <p className="text-sm text-muted-foreground">Quem está online e tudo que os clientes fizeram</p>
      </div>
      <div className="flex-1 min-h-0">
        <LogsView />
      </div>
    </div>
  );
}
