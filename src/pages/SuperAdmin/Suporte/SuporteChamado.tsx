import { Seletor } from '@/components/base/Seletor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Archive, LogIn } from 'lucide-react';
import { Button, Textarea } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { erroDaApi, type SupportStatus } from '@/services/support/supportService';
import { supportAdminService } from '@/services/support/supportAdminService';
import SupportThread from '@/components/support/SupportThread';
import SupportComposer from '@/components/support/SupportComposer';
import { useChamado } from '@/components/support/useChamado';
import { KIND_LABEL, STATUS_TIME } from '@/components/support/rotulos';

/** Chamado aberto, lado do time: conversa, resposta, situação, nota interna. */
export default function SuporteChamado() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const carregar = useCallback(() => supportAdminService.show(id), [id]);
  const { dado, erro, recarregar } = useChamado(carregar);
  const [nota, setNota] = useState('');
  const [resolverAoEnviar, setResolverAoEnviar] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  // Abre na mensagem mais nova (carga, envio e polling), como no card do cliente.
  const rolagem = useRef<HTMLDivElement>(null);
  const total = dado?.messages.length;
  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [total]);

  // ⚠️ Só semeia a nota quando troca de chamado: o polling (10 s) não pode
  // sobrescrever o que o time está digitando.
  useEffect(() => {
    if (dado) setNota(dado.admin_note ?? '');
  }, [dado?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = async (body: string, imagens: File[]) => {
    try {
      await supportAdminService.reply(id, body, imagens, resolverAoEnviar ? 'resolved' : undefined);
      setResolverAoEnviar(false);
      await recarregar();
    } catch (e) {
      toast.error(erroDaApi(e, 'Não consegui enviar.'));
      throw e;
    }
  };

  const mudar = async (mudanca: { status?: SupportStatus; admin_note?: string }, ok: string) => {
    try {
      await supportAdminService.update(id, mudanca);
      toast.success(ok);
      await recarregar();
    } catch (e) {
      toast.error(erroDaApi(e, 'Não consegui salvar.'));
    }
  };

  const entrar = async () => {
    if (!dado?.tenant_id) return;
    try {
      const url = await supportAdminService.entrarNoCliente(dado.tenant_id);
      if (url) window.open(url, '_blank');
      else toast.error('Falha ao gerar acesso.');
    } catch {
      toast.error('Falha ao entrar no CRM do cliente.');
    }
  };

  const arquivar = async () => {
    const ok = await confirmar({
      titulo: 'Arquivar este chamado?',
      descricao: 'Ele some da lista do Suporte e da aba Mensagens do cliente.',
      rotuloDaAcao: 'Arquivar',
    });
    if (!ok) return;
    try {
      await supportAdminService.archive(id);
      navigate('/admin/suporte');
    } catch (e) {
      toast.error(erroDaApi(e, 'Não consegui arquivar.'));
    }
  };

  if (erro && !dado) return <p className="text-sm text-destructive">{erro}</p>;
  if (!dado) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[1fr_300px]">
      <div className="flex min-h-0 flex-col rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link to="/admin/suporte" aria-label="Voltar para a lista" className="rounded-md p-1 hover:bg-accent">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h2 className="truncate text-base font-semibold">{dado.subject}</h2>
        </div>
        <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto">
          <SupportThread mensagens={dado.messages} eu="team" />
        </div>
        <SupportComposer
          onEnviar={responder}
          placeholder="Responder o cliente"
          extra={
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={resolverAoEnviar} onChange={e => setResolverAoEnviar(e.target.checked)} aria-label="Resolver ao enviar" />
              Resolver
            </label>
          }
        />
      </div>

      <aside className="space-y-4 text-sm">
        <dl className="space-y-1">
          <div><dt className="inline text-muted-foreground">Cliente: </dt><dd className="inline">{dado.tenant_slug ?? 'painel raiz'}</dd></div>
          <div><dt className="inline text-muted-foreground">Quem abriu: </dt><dd className="inline">{dado.user_name ?? 'sem nome'} {dado.user_email && `· ${dado.user_email}`}</dd></div>
          <div><dt className="inline text-muted-foreground">Tipo: </dt><dd className="inline">{KIND_LABEL[dado.kind]}</dd></div>
          {dado.page_url && <div><dt className="inline text-muted-foreground">Tela: </dt><dd className="inline break-all">{dado.page_url}</dd></div>}
        </dl>

        <label className="block space-y-1">
          <span className="text-muted-foreground">Situação</span>
          <Seletor
            aria-label="Situação"
            value={dado.status}
            onChange={e => void mudar({ status: e.target.value as SupportStatus }, 'Situação salva.')}
            className="w-full"
          >
            {(Object.keys(STATUS_TIME) as SupportStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_TIME[s]}</option>
            ))}
          </Seletor>
        </label>

        <div className="space-y-1">
          <span className="text-muted-foreground">Nota interna (o cliente não vê)</span>
          <Textarea value={nota} onChange={e => setNota(e.target.value)} rows={4} maxLength={4000} />
          <Button size="sm" variant="outline" onClick={() => void mudar({ admin_note: nota }, 'Nota salva.')}>Salvar nota</Button>
        </div>

        <div className="flex flex-col gap-2">
          {dado.tenant_id && (
            <Button size="sm" onClick={() => void entrar()}>
              <LogIn className="h-4 w-4" /> Entrar no cliente
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void arquivar()}>
            <Archive className="h-4 w-4" /> Arquivar
          </Button>
        </div>
      </aside>
      {dialogoDeConfirmacao}
    </div>
  );
}
