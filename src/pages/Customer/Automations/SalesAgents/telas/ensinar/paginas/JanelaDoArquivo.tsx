// Ensinar · Arquivos: a janela "Como ela usa este arquivo" (era o FileConfigDialog da
// Base de conhecimento) e a "Escrever texto". Janela grande da casa (Dialog do ds):
// topo e rodapé fixos, só o meio rola; no celular sobe de baixo com a largura inteira.
//
// As chaves aqui dentro NÃO gravam na hora (exceção da janela, decisão 6 do spec):
// são estado local até o Salvar. Desde a Tarefa 75 (01/11/2026) o ENVIO pro lead (quando mandar, mensagem
// junto, assunto, uma vez só) mora em Materiais; aqui ficam o nome, o "aprende" e o "ligado a imóveis".
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import LinhaComChave from '@/components/base/LinhaComChave';
import { salesAgentsService, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';

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

/** O que a IA aprende deste arquivo e a que imóveis ele está ligado (o "quando mandar" é de Materiais). */
export default function JanelaDoArquivo({ agentId, doc, aoFechar, aoSalvar }: {
  agentId: string; doc: SalesAgentDocument; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [learnable, setLearnable] = useState(doc.learnable);
  const [codes, setCodes] = useState((doc.property_codes ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await salesAgentsService.updateDocument(agentId, doc.id, {
        title: title.trim() || doc.title,
        learnable,
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

      <GrupoDaJanela titulo="Imóveis">
        <CampoDaJanela rotulo="Ligado a imóveis" htmlFor="arq-imoveis"
          ajuda="Códigos separados por vírgula. Ligado, o arquivo só entra com um desses imóveis na conversa. Em branco, vale pra qualquer conversa.">
          <Input id="arq-imoveis" className="w-full" value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="Ex.: AP123, AP124" />
        </CampoDaJanela>
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
