import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { erroDaApi, supportService } from '@/services/support/supportService';
import SupportThread from './SupportThread';
import SupportComposer from './SupportComposer';
import { useChamado } from './useChamado';
import { useSinalSuporte } from './aoVivo';

interface Props {
  id: string;
  /** Mostra o balão de confirmação logo depois de abrir. */
  recemCriado?: boolean;
  /** Card aberto? Fechado, o chamado fica montado (guarda o rascunho) mas para de buscar. */
  aberto: boolean;
  /** Abrir = ler: o contador da bolinha precisa recontar. */
  onLido: () => void;
}

export default function SupportChamadoCliente({ id, recemCriado, aberto, onLido }: Props) {
  const carregar = useCallback(() => supportService.show(id), [id]);
  // Sinal ao vivo traz a resposta na hora; a checagem a cada 30 s é só reserva.
  const { dado, erro, recarregar } = useChamado(carregar, aberto ? 30000 : 0);
  useSinalSuporte(ticketId => {
    if (aberto && ticketId === id) void recarregar();
  });

  // Reabriu o card: o que veio enquanto estava fechado aparece já, sem esperar o próximo tick.
  // Chat abre no fim: a mensagem mais nova é a que importa (carga, envio e polling).
  const rolagem = useRef<HTMLDivElement>(null);
  const total = dado?.messages.length;
  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [total, recemCriado]);

  const estavaAberto = useRef(aberto);
  useEffect(() => {
    if (aberto && !estavaAberto.current) void recarregar();
    estavaAberto.current = aberto;
  }, [aberto, recarregar]);

  useEffect(() => {
    if (dado) onLido();
  }, [dado?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = async (body: string, imagens: File[]) => {
    try {
      await supportService.reply(id, body, imagens);
      await recarregar();
    } catch (e) {
      toast.error(erroDaApi(e, 'Não consegui enviar. Tente novamente.'));
      throw e;
    }
  };

  if (erro && !dado) return <p className="p-4 text-sm text-destructive">{erro}</p>;
  if (!dado) return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rolagem} className="flex-1 overflow-y-auto">
        <SupportThread mensagens={dado.messages} eu="customer" />
        {recemCriado && (
          <p className="mx-3 mb-3 w-fit max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm">
            Recebemos! O time responde por aqui e você também recebe por e-mail.
          </p>
        )}
        {dado.status === 'resolved' && (
          <div className="mx-3 mb-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <p className="font-medium">Este chamado foi resolvido.</p>
            <p className="text-muted-foreground">Se precisar, é só escrever de novo.</p>
          </div>
        )}
      </div>
      <SupportComposer onEnviar={responder} />
    </div>
  );
}
