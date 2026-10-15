// Ensinar · Arquivos: a janela "Como ela usa este arquivo" (era o FileConfigDialog da
// Base de conhecimento) e a "Escrever texto". Janela grande da casa (Dialog do ds):
// topo e rodapé fixos, só o meio rola; no celular sobe de baixo com a largura inteira.
//
// As chaves aqui dentro NÃO gravam na hora (exceção da janela, decisão 6 do spec):
// são estado local até o Salvar, que manda tudo de uma vez no mesmo pacote de antes.
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { CampoDaJanela, ESCOLHA, GrupoDaJanela } from '@/components/base/janela';
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
      {/* Janela grande (672 px) da casa: o ajuste (ds.tsx) já prende o topo (com o X
          "Fechar") e o rodapé, rola só o meio e, no celular, sobe de baixo. */}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">{children}</div>
        <DialogFooter>{rodape}</DialogFooter>
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
      <GrupoDaJanela titulo="Arquivo">
        <CampoDaJanela rotulo="Nome" htmlFor="arq-nome" ajuda="É por este nome que ela se refere ao arquivo.">
          <Input id="arq-nome" className="w-full" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Planta do 2 dormitórios - Residencial Exemplo" />
        </CampoDaJanela>

        <LinhaComChave rotulo="Ela aprende com o conteúdo" descricao="Ela consulta o que está escrito pra responder."
          ligada={learnable} aoMudar={local(setLearnable)} genero="a" />
        {/* Arquivo íntegro, só sem texto: o envio funciona. Não é erro. */}
        {doc.status === 'no_text' && (
          <Aviso tom="info" compacto>
            Este arquivo não tem texto pra aprender (parece escaneado ou é imagem). O envio funciona normalmente.
          </Aviso>
        )}
      </GrupoDaJanela>

      <GrupoDaJanela titulo="Envio">
        <LinhaComChave rotulo="Ela pode mandar pro lead" descricao="Desligado, o arquivo serve só pra ela aprender."
          ligada={sendable} aoMudar={local(setSendable)} genero="a">
          <CampoDaJanela rotulo="Quando mandar" htmlFor="arq-quando">
            <Textarea id="arq-quando" className="w-full" rows={2} value={when} onChange={(e) => setWhen(e.target.value)}
              placeholder="Ex.: quando o lead pedir a planta ou perguntar como são divididos os cômodos" />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Quando não mandar" htmlFor="arq-quando-nao">
            <Textarea id="arq-quando-nao" className="w-full" rows={2} value={whenNot} onChange={(e) => setWhenNot(e.target.value)}
              placeholder="Ex.: antes de o lead dizer o que procura; se ele só quer alugar" />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Mensagem que vai junto" htmlFor="arq-mensagem">
            <Input id="arq-mensagem" className="w-full" value={caption} onChange={(e) => setCaption(e.target.value)}
              placeholder="Ex.: segue a planta do 2 dormitórios, qualquer dúvida me chama" />
          </CampoDaJanela>

          <CampoDaJanela rotulo="Assunto">
            <div role="group" aria-label="Assunto" className="flex flex-wrap gap-1.5">
              {DOCUMENT_TOPICS.map((t) => {
                const marcado = topics.includes(t.slug);
                return (
                  <Button
                    key={t.slug} type="button" variant="outline" size="sm" aria-pressed={marcado}
                    className={cn('rounded-full', ESCOLHA)} onClick={() => toggleTopic(t.slug)}
                  >
                    {t.label}
                  </Button>
                );
              })}
            </div>
          </CampoDaJanela>

          <CampoDaJanela rotulo="Vale pra quais imóveis" htmlFor="arq-imoveis"
            ajuda="Códigos separados por vírgula. Em branco, vale pra qualquer conversa.">
            <Input id="arq-imoveis" className="w-full" value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="Ex.: AP123, AP124" />
          </CampoDaJanela>

          <LinhaComChave rotulo="No máximo uma vez por conversa" descricao="Evita mandar o mesmo arquivo de novo."
            ligada={sendOnce} aoMudar={local(setSendOnce)} />

          {doc.send_mode === 'link' && (
            <Aviso tom="atencao" compacto>
              Arquivo grande ({doc.size_label}). Ela manda o link em vez do arquivo.
            </Aviso>
          )}
          {doc.send_mode === 'blocked' && (
            <Aviso tom="erro" compacto>
              Arquivo grande demais ({doc.size_label}) e sem endereço público pra oferecer. Reduza o arquivo.
            </Aviso>
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
      </GrupoDaJanela>
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
      <GrupoDaJanela titulo="Conteúdo">
        <CampoDaJanela rotulo="Nome" htmlFor="txt-nome">
          <Input id="txt-nome" className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Formas de pagamento" />
        </CampoDaJanela>
        <CampoDaJanela rotulo="Texto" htmlFor="txt-texto">
          <Textarea id="txt-texto" className="w-full" rows={8} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Escreva como explicaria pra um corretor novo." />
        </CampoDaJanela>
        <LinhaComChave rotulo="Ela aprende com o conteúdo" descricao="Ela consulta o que está escrito pra responder."
          ligada desabilitada aoMudar={() => Promise.resolve(false)} genero="a" />
      </GrupoDaJanela>
    </Janela>
  );
}
