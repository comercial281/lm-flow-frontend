// Materiais (Tarefa 74): as janelas da página. Janela com Salvar (como a do arquivo no Ensinar): as chaves
// de dentro são estado local até o Salvar. A janela do material NÃO manda `send_topics`: o assunto continua
// gravado no servidor e saiu da tela (spec da fase 6, §Materiais).
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from '@/components/ui/ds';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import Chave from '@/components/base/Chave';
import { salesAgentsService, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';

function Janela({ titulo, descricao, aoFechar, rodape, children }: {
  titulo: string; descricao: string; aoFechar: () => void; rodape: ReactNode; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
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

const ERRO = 'Não deu pra salvar. Tente de novo.';

/** O "quando mandar" de um material: quando, quando não, a mensagem que vai junto e se é uma vez só. */
export default function JanelaDoMaterial({ agentId, doc, aoFechar, aoSalvo }: {
  agentId: string; doc: SalesAgentDocument; aoFechar: () => void; aoSalvo: () => void;
}) {
  const [quando, setQuando] = useState(doc.send_when ?? '');
  const [quandoNao, setQuandoNao] = useState(doc.send_when_not ?? '');
  const [mensagem, setMensagem] = useState(doc.send_caption ?? '');
  const [umaVez, setUmaVez] = useState(doc.send_once ?? true); // indefinido = padrão do servidor (uma vez só)
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      await salesAgentsService.updateDocument(agentId, doc.id, {
        send_when: quando.trim(), send_when_not: quandoNao.trim(), send_caption: mensagem.trim(), send_once: umaVez,
      });
      toast.success('Salvo');
      aoSalvo();
    } catch {
      toast.error(ERRO);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Janela titulo="Quando ela manda" descricao={`${doc.title}. O que você escrever aqui é o que ela lê na hora de decidir. Escreva como explicaria pra um corretor novo.`}
      aoFechar={aoFechar}
      rodape={(
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </>
      )}>
      <GrupoDaJanela titulo="Momento">
        <CampoDaJanela rotulo="Quando mandar" htmlFor="mat-quando">
          <Textarea id="mat-quando" className="w-full" rows={2} value={quando} onChange={(e) => setQuando(e.target.value)}
            placeholder="Ex.: quando o lead pedir a planta ou perguntar como são divididos os cômodos" />
        </CampoDaJanela>
        <CampoDaJanela rotulo="Quando não mandar" htmlFor="mat-quando-nao">
          <Textarea id="mat-quando-nao" className="w-full" rows={2} value={quandoNao} onChange={(e) => setQuandoNao(e.target.value)}
            placeholder="Ex.: antes de o lead dizer o que procura; se ele só quer alugar" />
        </CampoDaJanela>
        <CampoDaJanela rotulo="Mensagem junto" htmlFor="mat-mensagem">
          <Input id="mat-mensagem" className="w-full" value={mensagem} onChange={(e) => setMensagem(e.target.value)}
            placeholder="Ex.: segue a planta do 2 dormitórios, qualquer dúvida me chama" />
        </CampoDaJanela>
        <Chave rotulo="Uma vez só" descricao="Não manda o mesmo material de novo na mesma conversa." ligada={umaVez} semAviso
          aoMudar={(v) => { setUmaVez(v); return Promise.resolve(true); }} />
      </GrupoDaJanela>
    </Janela>
  );
}

/** A regra do book: uma só, vale pro book de qualquer imóvel. Grava no agente (pelo `gravar` da página). */
export function JanelaDaRegraDoBook({ regra, gravar, aoFechar }: {
  regra: string; gravar: (regra: string | null) => Promise<boolean | void>; aoFechar: () => void;
}) {
  const [texto, setTexto] = useState(regra);
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      if ((await gravar(texto.trim() || null)) !== false) aoFechar();
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Janela titulo="Quando ela manda o book" descricao="A mesma regra vale pro book de qualquer imóvel. O book vem do cadastro do imóvel."
      aoFechar={aoFechar}
      rodape={(
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </>
      )}>
      <GrupoDaJanela titulo="Momento">
        <CampoDaJanela rotulo="Quando mandar" htmlFor="book-quando">
          <Textarea id="book-quando" className="w-full" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: quando o lead pedir plantas, fotos ou mais detalhes do empreendimento" />
        </CampoDaJanela>
      </GrupoDaJanela>
    </Janela>
  );
}

/** "Colar um link": nome e endereço. Depois de criar, a página abre a janela do "quando mandar". */
export function JanelaDoLink({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (link: { title: string; url: string }) => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [criando, setCriando] = useState(false);
  const pronto = nome.trim() !== '' && /^https?:\/\/\S+$/i.test(endereco.trim());
  const criar = async () => {
    if (criando || !pronto) return;
    setCriando(true);
    try {
      await aoCriar({ title: nome.trim(), url: endereco.trim() });
    } catch {
      toast.error('Não deu pra criar o link. Tente de novo.');
    } finally {
      setCriando(false);
    }
  };
  return (
    <Janela titulo="Novo link" descricao="Um endereço que ela pode mandar pro lead, como o site ou um tour."
      aoFechar={aoFechar}
      rodape={(
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void criar()} disabled={criando || !pronto}>{criando ? 'Criando...' : 'Criar'}</Button>
        </>
      )}>
      <GrupoDaJanela titulo="Link">
        <CampoDaJanela rotulo="Nome" htmlFor="link-nome" ajuda="É por este nome que ela se refere ao link.">
          <Input id="link-nome" className="w-full" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Site da imobiliária" />
        </CampoDaJanela>
        <CampoDaJanela rotulo="Endereço do link" htmlFor="link-url" ajuda="Começa com http:// ou https://.">
          <Input id="link-url" className="w-full" inputMode="url" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="https://" />
        </CampoDaJanela>
      </GrupoDaJanela>
    </Janela>
  );
}
