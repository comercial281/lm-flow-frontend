import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Switch, Label as UILabel } from '@/components/ui/ds';
import SendFromField from '@/components/numbers/SendFromField';
import { VariableChipBar } from '@/components/flowAutomations/VariableChipBar';
import { sendFromOf, type SendFromValue } from '@/features/numbers/sendFrom';
import { siteBuilderService, type BookFlow } from '@/services/siteBuilder/siteBuilderService';
import salesAgentsService from '@/services/salesAgents/salesAgentsService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Campo, CampoTextoLongo } from '../ui/Campo';

// "Receber o book no WhatsApp" (Meu site › Página do imóvel › Empreendimentos).
// A chave NÃO espera o Salvar da página: ligar cria/religa o fluxo "Book pelo
// site" no servidor, então grava na hora. Quem decide número, mensagem e fluxo
// é o servidor; aqui só se mostra o estado devolvido por ele.

export const MENSAGEM_PADRAO_BOOK = 'Oi {{nome}}! Aqui está o book do {{imovel}}. Qualquer dúvida é só me chamar por aqui.';
const ROTA_CONSTRUTOR = '/automations/flow-builder';

interface Props {
  siteId: string;
  ligado: boolean;
  /** Chave já gravada no servidor: a tela atualiza `book_button` local sem marcar a ficha como alterada. */
  aoMudarChave: (ligado: boolean) => void;
}

export default function BookPeloSite({ siteId, ligado, aoMudarChave }: Props) {
  const [fluxo, setFluxo] = useState<BookFlow | null>(null);
  const [falhouLer, setFalhouLer] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [envio, setEnvio] = useState<SendFromValue>({ send_from: '', send_from_inbox_id: '' });
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO_BOOK);
  const [iaAssume, setIaAssume] = useState(true);
  const [temIa, setTemIa] = useState(false);
  const campoMensagem = useRef<HTMLTextAreaElement>(null);

  const aplicar = (f: BookFlow) => {
    setFluxo(f);
    setEnvio(sendFromOf({ send_from: f.send_from, send_from_inbox_id: f.send_from_inbox_id ?? '' }));
    setMensagem(f.mensagem || MENSAGEM_PADRAO_BOOK);
    setIaAssume(f.ia_assume);
  };

  useEffect(() => {
    let vivo = true;
    siteBuilderService.getBookFlow(siteId)
      .then(f => { if (vivo) { aplicar(f); setFalhouLer(false); } })
      .catch(() => { if (vivo) setFalhouLer(true); });
    // Só oferece "a IA assume" se o cliente tem IA Vendedora ligada.
    salesAgentsService.list()
      .then(l => { if (vivo) setTemIa(l.some(a => a.enabled)); })
      .catch(() => { /* sem a lista, esconde a pergunta */ });
    return () => { vivo = false; };
  }, [siteId]);

  const enviar = async (ligar: boolean, sucesso?: string) => {
    setOcupado(true);
    try {
      const f = await siteBuilderService.putBookFlow(siteId, {
        ligado: ligar,
        send_from: envio.send_from === 'owner' || envio.send_from === 'number' ? envio.send_from : '',
        send_from_inbox_id: envio.send_from_inbox_id || null,
        mensagem,
        ia_assume: iaAssume,
      });
      aplicar(f);
      aoMudarChave(f.ligado);
      if (sucesso) toast.success(sucesso);
    } catch (e) {
      // 422 (sem número): a chave fica como estava.
      toast.error(apiErrorMessage(e, 'Não foi possível atualizar o envio do book.'));
    } finally {
      setOcupado(false);
    }
  };

  const link = fluxo?.fluxo_id ? `${ROTA_CONSTRUTOR}/${fluxo.fluxo_id}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Switch id="book-ligado" checked={ligado} disabled={ocupado} className="mt-1"
          aria-describedby="book-ligado-frase" onCheckedChange={v => enviar(v)} />
        <div className="space-y-0.5">
          <UILabel htmlFor="book-ligado" className="cursor-pointer text-base font-normal">Receber o book no WhatsApp</UILabel>
          <p id="book-ligado-frase" className="text-sm text-muted-foreground">
            Mostra o botão nos empreendimentos que têm book. Quem pedir recebe o book no WhatsApp na hora.
          </p>
        </div>
      </div>

      {falhouLer && (
        <p className="text-sm text-amber-700 dark:text-amber-400">Não consegui ler o estado do envio do book. Recarregue a página.</p>
      )}

      {ligado && fluxo && fluxo.existe && !fluxo.fluxo_ligado && (
        <div className="space-y-2 rounded-md border border-amber-300 p-3 dark:border-amber-700">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            O fluxo está desligado no construtor: o botão aparece, mas o book não é enviado.
          </p>
          <Button type="button" variant="outline" disabled={ocupado} onClick={() => enviar(true, 'Fluxo ligado.')}>Ligar o fluxo</Button>
        </div>
      )}

      {ligado && fluxo && fluxo.personalizado && (
        <p className="text-sm text-muted-foreground">
          Este fluxo foi personalizado no construtor.{' '}
          {link && <Link to={link} className="underline">Ver no construtor</Link>}
        </p>
      )}

      {ligado && fluxo && !fluxo.personalizado && (
        <div className="space-y-4">
          <SendFromField scope="lead_automation_rules" value={envio} onChange={setEnvio} />
          <div className="space-y-1">
            <CampoTextoLongo id="book-mensagem" rotulo="Mensagem" rows={5} ref={campoMensagem} valor={mensagem} aoMudar={setMensagem} />
            <VariableChipBar targetRef={campoMensagem} value={mensagem} onChange={setMensagem} />
          </div>
          {temIa && (
            <Campo id="book-ia" rotulo="Depois do book, a IA Vendedora assume a conversa">
              <div role="radiogroup" aria-label="Depois do book, a IA Vendedora assume a conversa" className="flex gap-2">
                <Button type="button" role="radio" aria-checked={iaAssume} variant={iaAssume ? 'default' : 'outline'} onClick={() => setIaAssume(true)}>Sim</Button>
                <Button type="button" role="radio" aria-checked={!iaAssume} variant={!iaAssume ? 'default' : 'outline'} onClick={() => setIaAssume(false)}>Não</Button>
              </div>
            </Campo>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" disabled={ocupado} onClick={() => enviar(true, 'Envio do book salvo.')}>Salvar o envio do book</Button>
            {link && <Link to={link} className="text-sm underline">Ver no construtor</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
