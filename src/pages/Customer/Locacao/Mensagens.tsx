import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { Card } from '@/components/ui/ds';
import { dataHora } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import type { MensagemDoSistema, Severidade } from '@/features/locacao/tipos';
import { Falha, Selo, Titulo } from './comum';
import { useCarga } from './usoComum';

const DESTINATARIO: Record<MensagemDoSistema['destinatario_tipo'], string> = {
  inquilino: 'Inquilino',
  proprietario: 'Proprietário',
  equipe: 'Equipe',
};

function seloDe(m: MensagemDoSistema): { sev: Severidade; rotulo: string } | null {
  switch (m.status) {
    case 'enviada': return { sev: 'ok', rotulo: 'Enviada' };
    case 'falhou': return { sev: 'bad', rotulo: 'Não saiu' };
    case 'bloqueada_demo': return { sev: 'warn', rotulo: 'Não enviada (conta de demonstração)' };
    case 'registrada': return { sev: 'info', rotulo: 'Só registrada' };
    default: return null;
  }
}

/** Tudo o que a Locação mandou (ou deixou de mandar) para inquilinos, proprietários e equipe. */
export default function Mensagens() {
  const { dados, erro, recarregar } = useCarga(() => locacaoService.mensagens(), 'mensagens');

  if (erro) return <Falha erro={erro} aoTentar={recarregar} />;
  if (!dados) return <Carregando linhas={5} rotulo="Carregando mensagens…" />;

  return (
    <section className="grid gap-3">
      <Titulo>Mensagens enviadas</Titulo>
      {dados.length === 0 ? (
        <EmptyState tamanho="compacto" title="Nenhuma mensagem ainda" description="Lembretes de boleto, avisos de atraso e recibos aparecem aqui conforme forem saindo." />
      ) : (
        <Card className="gap-0 divide-y divide-border/60 p-1">
          {dados.map(m => {
            const selo = seloDe(m);
            return (
              <div key={m.id} className="grid gap-1 px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{m.para_nome}</span>
                  <span className="text-xs text-muted-foreground">{DESTINATARIO[m.destinatario_tipo]} · {m.canal} · {dataHora(m.data)}</span>
                  {selo && <Selo sev={selo.sev}>{selo.rotulo}</Selo>}
                </div>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{m.texto}</p>
                {m.erro && <p className="text-xs text-red-600 dark:text-red-400">{m.erro}</p>}
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
