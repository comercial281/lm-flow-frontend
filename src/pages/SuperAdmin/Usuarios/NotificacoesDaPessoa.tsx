import { BaseStatusBadge } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import { dataHora, plural, telefone as formatarTelefone, VAZIO } from '@/lib/formato';
import type { NotificationDeliveryRow, UserNotifications } from '@/types/admin/users';
import {
  origemDoAviso, passosDoPush, rotuloPermissao, rotuloWhatsapp, statusDaPermissao, statusDoWhatsapp,
} from './formatoUsuarios';

// Ficha → Notificações: se o aviso está chegando, por canal. Cada lista mostra no
// máximo 10 (o servidor corta) e não tem rolagem própria: uma rolagem só por página.
interface Props {
  dados: UserNotifications | null;
  telefone: string | null;
  aoTentarDeNovo?: () => void;
}

export default function NotificacoesDaPessoa({ dados, telefone, aoTentarDeNovo }: Props) {
  if (!dados) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Notificações</h3>
        <EmptyState tipo="erro" title="Não deu para ler as notificações desta pessoa" aoTentarDeNovo={aoTentarDeNovo} />
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao titulo="Push">
        <div className="mb-3 flex flex-col gap-1 text-sm">
          {dados.permissions.length === 0 ? (
            <span className="text-muted-foreground">Permissão: ainda não vista (aparece quando a pessoa abrir o LM Flow)</span>
          ) : dados.permissions.map((p) => (
            <div key={p.device} className="flex flex-wrap items-center gap-2">
              <BaseStatusBadge status={statusDaPermissao(p.permission)} text={rotuloPermissao(p.permission)} />
              <span>{p.device}</span>
              <span className="text-muted-foreground">· visto {dataHora(p.seen_at)}</span>
            </div>
          ))}
          <span className="text-muted-foreground">{plural(dados.push_devices, 'aparelho com Modo Plantão', 'aparelhos com Modo Plantão')}</span>
        </div>
        {dados.push.length === 0 ? (
          <EmptyState tipo="vazio" title="Nenhum push enviado ainda" />
        ) : (
          <ul className="flex flex-col divide-y">
            {dados.push.map((d) => <LinhaPush key={d.id} d={d} />)}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="WhatsApp">
        <p className="mb-3 text-sm text-muted-foreground">
          {telefone ? `Número de WhatsApp: ${formatarTelefone(telefone)}` : 'Sem número de WhatsApp no cadastro da pessoa. Se houver um número no campo da roleta, os avisos vão para ele.'}
        </p>
        {dados.whatsapp.length === 0 ? (
          <EmptyState tipo="vazio" title="Nenhum aviso por WhatsApp ainda" />
        ) : (
          <ul className="flex flex-col divide-y">
            {dados.whatsapp.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">{dataHora(d.sent_at)}</span>
                  <BaseStatusBadge status={statusDoWhatsapp(d.status)} text={rotuloWhatsapp(d.status)} />
                </div>
                <span>{d.preview ?? VAZIO}</span>
                {d.status === 'falhou' && d.error && <span className="text-destructive">{d.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="Na tela">
        {dados.bell.length === 0 ? (
          <EmptyState tipo="vazio" title="Nenhum aviso na tela" />
        ) : (
          <ul className="flex flex-col divide-y">
            {dados.bell.map((b, i) => (
              <li key={`${b.created_at}:${i}`} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="tabular-nums text-muted-foreground">{dataHora(b.created_at)}</span>
                <span className="min-w-0 flex-1 truncate">{b.title}</span>
                <BaseStatusBadge status={b.read ? 'success' : 'pending'} text={b.read ? 'Lido' : 'Não lido'} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const id = `notif-${titulo.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card p-4">
      <h3 id={id} className="mb-3 text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function LinhaPush({ d }: { d: NotificationDeliveryRow }) {
  const origem = origemDoAviso(d.kind);
  return (
    <li className="flex flex-col gap-1 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums text-muted-foreground">{dataHora(d.sent_at)}</span>
        {d.recipient && <span className="text-muted-foreground">· {d.recipient}</span>}
        {origem && <span className="text-muted-foreground">· {origem}</span>}
      </div>
      <span>{d.preview ?? VAZIO}</span>
      {d.status === 'falhou' ? (
        <div className="flex flex-wrap items-center gap-2">
          <BaseStatusBadge status="error" text="Falhou" />
          {d.error && <span className="text-destructive">{d.error}</span>}
        </div>
      ) : (
        <ol className="flex flex-wrap items-center gap-1" aria-label="Caminho do push">
          {passosDoPush(d).map((p, i) => (
            <li key={p.rotulo} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="text-muted-foreground">→</span>}
              <span className={p.feito ? 'font-medium text-foreground' : 'text-muted-foreground opacity-60'}>{p.rotulo}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
