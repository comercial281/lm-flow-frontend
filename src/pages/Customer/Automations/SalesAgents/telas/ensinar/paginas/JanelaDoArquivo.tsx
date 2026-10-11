// Ensinar · Arquivos: a janela "Como ela usa este arquivo" (era o FileConfigDialog da
// Base de conhecimento) e a "Escrever texto". Janela no padrão da casa: topo e rodapé
// fixos, só o meio rola; no celular sobe de baixo com a largura inteira.
//
// As chaves aqui dentro NÃO gravam na hora (exceção da janela, decisão 6 do spec):
// são estado local até o Salvar, que manda tudo de uma vez no mesmo pacote de antes.
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import LinhaComChave from '@/components/base/LinhaComChave';
import { cn } from '@/lib/utils';
import { salesAgentsService, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import { DOCUMENT_TOPICS } from '@/features/salesAgents/documentTopics';
import SendToMeButton from '../../../SendToMeButton';

/** Chave da janela: só muda o estado local (quem grava é o Salvar). */
const local = (set: (v: boolean) => void) => (v: boolean) => { set(v); return Promise.resolve(true); };

function Janela({ titulo, descricao, aoFechar, rodape, children }: {
  titulo: string; descricao: string; aoFechar: () => void; rodape: ReactNode; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
      {/* `max-w-2xl` vira teto inline no ajuste da casa (ds.tsx); `p-0` tira o respiro
          do pacote pra o topo e o rodapé encostarem na borda. `dvh`, não `vh`: no
          celular o `vh` ignora a barra do navegador e esconde o rodapé. */}
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:translate-y-0 max-sm:rounded-b-none">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
        <DialogFooter className="border-t px-6 py-4">{rodape}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * As perguntas de uso do arquivo. Escritas em português, elas são o que ensina a IA
 * a hora certa de mandar — não existe lista de palavra-chave por trás.
 */
export default function JanelaDoArquivo({ agentId, doc, aoFechar, aoSalvar }: {
  agentId: string; doc: SalesAgentDocument; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [sendable, setSendable] = useState(doc.sendable);
  const [learnable, setLearnable] = useState(doc.learnable);
  const [sendOnce, setSendOnce] = useState(doc.send_once);
  const [when, setWhen] = useState(doc.send_when ?? '');
  const [whenNot, setWhenNot] = useState(doc.send_when_not ?? '');
  const [caption, setCaption] = useState(doc.send_caption ?? '');
  const [topics, setTopics] = useState<string[]>(doc.send_topics ?? []);
  const [codes, setCodes] = useState((doc.property_codes ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const toggleTopic = (slug: string) =>
    setTopics((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await salesAgentsService.updateDocument(agentId, doc.id, {
        title: title.trim() || doc.title,
        sendable, learnable, send_once: sendOnce,
        send_when: when.trim(),
        send_when_not: whenNot.trim(),
        send_caption: caption.trim(),
        send_topics: topics,
        property_codes: codes.split(',').map((c) => c.trim()).filter(Boolean),
      });
      toast.success('Salvo');
      aoSalvar();
    } catch {
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Janela
      titulo="Como ela usa este arquivo"
      descricao="O que você escrever aqui é o que ela lê na hora de decidir. Escreva como explicaria pra um corretor novo."
      aoFechar={aoFechar}
      rodape={(
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </>
      )}
    >
      <CampoTexto id="arq-nome" rotulo="Nome" valor={title} aoMudar={setTitle}
        placeholder="Ex.: Planta do 2 dormitórios - Residencial Exemplo"
        ajuda="É por este nome que ela se refere ao arquivo." />

      <LinhaComChave rotulo="Ela aprende com o conteúdo" descricao="Ela consulta o que está escrito pra responder."
        ligada={learnable} aoMudar={local(setLearnable)} genero="a" />
      {/* Arquivo íntegro, só sem texto: o envio funciona. Não é erro. */}
      {doc.status === 'no_text' && (
        <p className="-mt-3 text-sm text-amber-700 dark:text-amber-400">
          Este arquivo não tem texto pra aprender (parece escaneado ou é imagem). O envio funciona normalmente.
        </p>
      )}

      <LinhaComChave rotulo="Ela pode mandar pro lead" descricao="Desligado, o arquivo serve só pra ela aprender."
        ligada={sendable} aoMudar={local(setSendable)} genero="a">
        <CampoTextoLongo id="arq-quando" rotulo="Quando mandar" rows={2} valor={when} aoMudar={setWhen}
          placeholder="Ex.: quando o lead pedir a planta ou perguntar como são divididos os cômodos" />
        <CampoTextoLongo id="arq-quando-nao" rotulo="Quando não mandar" rows={2} valor={whenNot} aoMudar={setWhenNot}
          placeholder="Ex.: antes de o lead dizer o que procura; se ele só quer alugar" />
        <CampoTexto id="arq-mensagem" rotulo="Mensagem que vai junto" valor={caption} aoMudar={setCaption}
          placeholder="Ex.: segue a planta do 2 dormitórios, qualquer dúvida me chama" />

        <div className="space-y-2">
          <p id="arq-assunto" className="text-sm font-medium">Assunto</p>
          <div role="group" aria-labelledby="arq-assunto" className="flex flex-wrap gap-1.5">
            {DOCUMENT_TOPICS.map((t) => {
              const marcado = topics.includes(t.slug);
              return (
                <button
                  key={t.slug} type="button" aria-pressed={marcado} onClick={() => toggleTopic(t.slug)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors',
                    marcado ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <CampoTexto id="arq-imoveis" rotulo="Vale pra quais imóveis" valor={codes} aoMudar={setCodes}
          placeholder="Ex.: AP123, AP124"
          ajuda="Códigos separados por vírgula. Em branco, vale pra qualquer conversa." />

        <LinhaComChave rotulo="No máximo uma vez por conversa" descricao="Evita mandar o mesmo arquivo de novo."
          ligada={sendOnce} aoMudar={local(setSendOnce)} />

        {doc.send_mode === 'link' && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Arquivo grande ({doc.size_label}). Ela manda o link em vez do arquivo.
          </p>
        )}
        {doc.send_mode === 'blocked' && (
          <p className="text-sm text-red-700 dark:text-red-400">
            Arquivo grande demais ({doc.size_label}) e sem endereço público pra oferecer. Reduza o arquivo.
          </p>
        )}
        {/* "Ver como chega": manda ESTE arquivo pro WhatsApp do próprio dono,
            pela mesma rota do lead real — sem isso, só dá pra saber como ele
            chega esperando um lead de verdade pedir. Some quando o arquivo
            está BLOQUEADO (grande demais e sem link): não tem como sair,
            então não tem o que testar. */}
        {doc.send_mode !== 'blocked' && (
          <div className="space-y-1">
            <SendToMeButton
              label="Ver como chega no meu WhatsApp"
              onSend={(phone) => salesAgentsService.testSend(agentId, { phone, document_id: doc.id }).then((r) => r.message)}
            />
            <p className="text-xs text-muted-foreground">O teste usa o que está salvo. Salve antes pra ver a mensagem nova.</p>
          </div>
        )}
      </LinhaComChave>
    </Janela>
  );
}

/** "Escrever texto": Nome + Texto. Texto escrito sempre ensina (o servidor não tem como desligar na criação). */
export function JanelaDeTexto({ agentId, aoFechar, aoCriado }: { agentId: string; aoFechar: () => void; aoCriado: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving || !text.trim()) return;
    setSaving(true);
    try {
      await salesAgentsService.createTextDocument(agentId, title.trim() || 'Conhecimento', text.trim());
      toast.success('Texto guardado');
      aoCriado();
    } catch {
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Janela
      titulo="Escrever texto"
      descricao="Condições de pagamento, documentação, perguntas frequentes: o que não está no cadastro dos imóveis."
      aoFechar={aoFechar}
      rodape={(
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !text.trim()}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </>
      )}
    >
      <CampoTexto id="txt-nome" rotulo="Nome" valor={title} aoMudar={setTitle} placeholder="Ex.: Formas de pagamento" />
      <CampoTextoLongo id="txt-texto" rotulo="Texto" rows={8} valor={text} aoMudar={setText}
        placeholder="Escreva como explicaria pra um corretor novo." />
      <LinhaComChave rotulo="Ela aprende com o conteúdo" descricao="Ela consulta o que está escrito pra responder."
        ligada desabilitada aoMudar={() => Promise.resolve(false)} genero="a" />
    </Janela>
  );
}
