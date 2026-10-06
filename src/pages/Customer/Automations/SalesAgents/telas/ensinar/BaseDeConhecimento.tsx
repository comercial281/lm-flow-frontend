import { useEffect, useState, useCallback } from 'react';
import { Button, Input, Label, Textarea, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Trash2, FileText, Upload, RefreshCw, Loader2, SlidersHorizontal, ImageIcon, Film } from 'lucide-react';
import SendToMeButton from '../../SendToMeButton';
import { DOC_ACCEPT, docUploadError } from '../../docUpload';
import { salesAgentsService, type SalesAgent, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import { DOCUMENT_TOPICS } from '@/features/salesAgents/documentTopics';
import { processingLabel, processingWarning } from '@/features/salesAgents/documentStatus';
import { CheckRow } from '../../configuracao/comum';

// De quanto em quanto tempo re-buscar a lista enquanto algum arquivo estiver
// "Processando". A extração leva segundos; 4s é o mesmo ritmo da importação de imóveis.
const DOC_POLL_MS = 4000;

export function KnowledgeTab({ agent, onCountChange }: { agent: SalesAgent; onCountChange: () => void }) {
  const [docs, setDocs] = useState<SalesAgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Arquivo em edição na ficha "Como a IA deve usar este arquivo".
  const [editing, setEditing] = useState<SalesAgentDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await salesAgentsService.listDocuments(agent.id));
    } catch {
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { load(); }, [load]);

  // Enquanto houver arquivo em "Processando", re-busca sozinha. Sem isto a lista era
  // carregada uma vez e nunca mais: o upload chama load() milissegundos após criar o
  // item, quando ele AINDA está pendente por definição — então ficava escrito
  // "Processando..." para sempre na tela, mesmo com o servidor já tendo terminado.
  // Mesmo padrão da importação de imóveis (PropertyImportDialog).
  const temPendente = docs.some(d => d.status === 'pending');
  useEffect(() => {
    if (!temPendente) return;
    const id = setInterval(() => {
      salesAgentsService.listDocuments(agent.id).then(setDocs).catch(() => { /* silencioso: é atualização de fundo */ });
    }, DOC_POLL_MS);
    return () => clearInterval(id);
  }, [temPendente, agent.id]);

  const addText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await salesAgentsService.createTextDocument(agent.id, title.trim() || 'Conhecimento', text.trim());
      setTitle(''); setText('');
      toast.success('Adicionado à base');
      await load(); onCountChange();
    } catch {
      toast.error('Erro ao adicionar');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    const erro = docUploadError(file);
    if (erro) {
      toast.error(erro);
      return;
    }
    setBusy(true); setProgress(0);
    try {
      const doc = await salesAgentsService.uploadFileDocument(agent.id, file, undefined, setProgress);
      toast.success('Arquivo enviado. Diga agora como a IA deve usar ele.');
      await load(); onCountChange();
      // Abre a ficha na sequência: subir sem responder "quando enviar" deixa o
      // arquivo mudo, e ninguém volta depois pra preencher.
      setEditing(doc);
    } catch {
      toast.error('Erro no upload');
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const remove = async (doc: SalesAgentDocument) => {
    try {
      await salesAgentsService.destroyDocument(agent.id, doc.id);
      await load(); onCountChange();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="space-y-5">
      {/* O texto antigo mandava "suba a tabela de imóveis" e dizia que a IA
          respondia SÓ com base nisto. Deixou de ser verdade quando a busca no
          catálogo entrou: ela consulta os imóveis cadastrados a cada mensagem.
          Pior que desatualizado, o conselho era ruim — uma tabela colada aqui
          envelhece e passa a contradizer o preço real do cadastro. */}
      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          O mesmo arquivo serve pras <strong>duas coisas</strong>: a IA aprende com ele e, se você deixar,
          manda ele pro lead no WhatsApp. Sobe uma vez só.
        </p>
        <p>
          Os <strong>imóveis já estão conectados</strong>: a IA consulta o cadastro do cliente a cada mensagem e
          usa preço e características de lá, sempre atualizados. Não precisa subir tabela de imóveis aqui.
        </p>
        <p>
          Use esta base para o que <strong>não</strong> está no cadastro: condições de pagamento, documentação,
          FAQ, argumentário, política da imobiliária, diferenciais do bairro.
        </p>
        <p className="text-amber-600 dark:text-amber-500">
          Evite colar tabela de preços: ela não se atualiza junto com o cadastro e vira uma segunda versão da
          verdade — a IA passa a ter duas respostas diferentes para o mesmo imóvel.
        </p>
      </div>

      <div className="border border-sidebar-border rounded-md p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Colar texto</div>
        <Input placeholder="Título (ex: Tabela de imóveis)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={4} placeholder="Cole aqui o texto do conhecimento..." value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" onClick={addText} disabled={busy || !text.trim()}>Adicionar</Button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-sidebar-border'
        }`}
      >
        <label className="flex flex-col items-center gap-1 cursor-pointer">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Arraste um arquivo aqui ou clique para escolher</span>
          <span className="text-xs text-muted-foreground">PDF, DOCX, XLSX, CSV, TXT, JPG, PNG — até 25 MB</span>
          <input
            type="file"
            className="hidden"
            accept={DOC_ACCEPT}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
        </label>
        {progress !== null && (
          <div className="mt-3 h-1.5 bg-sidebar-border rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum arquivo ainda.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between border border-sidebar-border rounded-md px-3 py-2 gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {d.media_kind === 'image' ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : d.media_kind === 'video' ? <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{d.title}</span>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                  {d.sendable && <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">Envia</span>}
                  {d.learnable && d.status === 'ready' && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">Aprende</span>
                  )}
                  {d.send_mode === 'link' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Vai como link</span>
                  )}
                  {d.send_mode === 'blocked' && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Grande demais</span>
                  )}
                  {d.size_label && <span>{d.size_label}</span>}
                  {d.status === 'ready' && <span>{d.char_count} caracteres</span>}
                  {d.status === 'pending' && <span>{processingLabel(d.created_at)}</span>}
                  {/* Arquivo íntegro, só sem texto: o envio funciona. Pintar de
                      vermelho aqui fazia o dono apagar e subir de novo. */}
                  {d.status === 'no_text' && (
                    <span className="text-amber-600 dark:text-amber-500">Sem texto pra aprender</span>
                  )}
                  {d.status === 'failed' && <span className="text-red-500">Falhou: {d.error_message}</span>}
                </div>
                {/* Espera que passou do normal DIZ isso, em vez de continuar igual.
                    Sem esta linha, o único desfecho visível de um arquivo travado era
                    a pessoa concluir que o CRM quebrou. */}
                {d.status === 'pending' && processingWarning(d.created_at) && (
                  <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    {processingWarning(d.created_at)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Também em "Processando", não só em falha: um arquivo cujo
                    processamento se perdeu num deploy fica pendente sem nenhuma
                    alavanca — era preciso apagar e subir de novo pra destravar. */}
                {(d.status === 'failed' || d.status === 'pending') && (
                  <Button variant="ghost" size="sm" title="Tentar de novo" onClick={() => salesAgentsService.reprocessDocument(agent.id, d.id).then(load)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" title="Como a IA usa este arquivo" onClick={() => setEditing(d)}>
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Remover" onClick={() => remove(d)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <FileConfigDialog
          agentId={agent.id}
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ---------------- Ficha "Como a IA deve usar este arquivo" ----------------

/**
 * As perguntas de uso do arquivo. Escritas em português, elas são o que ensina a IA
 * a hora certa de mandar — não existe lista de palavra-chave por trás.
 */
function FileConfigDialog({
  agentId, doc, onClose, onSaved,
}: {
  agentId: string; doc: SalesAgentDocument; onClose: () => void; onSaved: () => void;
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
      onSaved();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como a IA deve usar este arquivo</DialogTitle>
          <DialogDescription>
            O que você escrever aqui é o que ela lê na hora de decidir. Escreva como explicaria pra um corretor novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="doc_title">Nome do arquivo</Label>
            <Input id="doc_title" value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="Ex: Planta do 2 dormitórios - Residencial Exemplo" />
            <p className="text-xs text-muted-foreground mt-1">É por este nome que ela se refere ao arquivo.</p>
          </div>

          <div className="border-t border-sidebar-border pt-3 space-y-2">
            <CheckRow
              checked={sendable} onChange={setSendable}
              title="A IA pode enviar este arquivo pro lead"
              desc="Desligado, ele serve só pra ela aprender."
            />
            {sendable && doc.send_mode === 'link' && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Arquivo grande ({doc.size_label}). A IA manda o link em vez do arquivo.
              </p>
            )}
            {sendable && doc.send_mode === 'blocked' && (
              <p className="text-xs text-red-500">
                Arquivo grande demais ({doc.size_label}) e sem endereço público pra oferecer. Reduza o arquivo.
              </p>
            )}
            {/* "Ver como chega": manda ESTE arquivo pro WhatsApp do próprio dono,
                pela mesma rota do lead real — sem isso, só dá pra saber como ele
                chega esperando um lead de verdade pedir. Some quando o arquivo
                está BLOQUEADO (grande demais e sem link): não tem como sair,
                então não tem o que testar. */}
            {sendable && doc.send_mode !== 'blocked' && (
              <div className="pt-1">
                <p className="text-xs font-medium">Ver como chega</p>
                <SendToMeButton
                  onSend={(phone) => salesAgentsService.testSend(agentId, { phone, document_id: doc.id }).then((r) => r.message)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  O teste usa o que está salvo. Salve antes para ver a legenda nova.
                </p>
              </div>
            )}
          </div>

          {sendable && (
            <div className="space-y-4 border-l-2 border-primary/30 pl-3">
              <div>
                <Label>Assunto do arquivo</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DOCUMENT_TOPICS.map((t) => (
                    <button
                      key={t.slug} type="button" onClick={() => toggleTopic(t.slug)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        topics.includes(t.slug)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-sidebar-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="doc_when">Quando enviar</Label>
                <Textarea id="doc_when" rows={2} value={when} onChange={(e) => setWhen(e.target.value)}
                          placeholder="Ex: quando o lead pedir a planta ou perguntar como são divididos os cômodos" />
              </div>

              <div>
                <Label htmlFor="doc_when_not">Quando NÃO enviar</Label>
                <Textarea id="doc_when_not" rows={2} value={whenNot} onChange={(e) => setWhenNot(e.target.value)}
                          placeholder="Ex: antes de o lead dizer o que procura; se ele só quer alugar" />
              </div>

              <div>
                <Label htmlFor="doc_caption">Mensagem que vai junto</Label>
                <Input id="doc_caption" value={caption} onChange={(e) => setCaption(e.target.value)}
                       placeholder="Ex: segue a planta do 2 dormitórios, qualquer dúvida me chama" />
              </div>

              <div>
                <Label htmlFor="doc_codes">Vale para quais imóveis</Label>
                <Input id="doc_codes" value={codes} onChange={(e) => setCodes(e.target.value)}
                       placeholder="Ex: AP123, AP124" />
                <p className="text-xs text-muted-foreground mt-1">
                  Códigos separados por vírgula. Em branco, vale pra qualquer conversa.
                </p>
              </div>

              <CheckRow
                checked={sendOnce} onChange={setSendOnce}
                title="Enviar no máximo uma vez por conversa"
                desc="Evita repetir o mesmo arquivo pro lead."
              />
            </div>
          )}

          <div className="border-t border-sidebar-border pt-3">
            <CheckRow
              checked={learnable} onChange={setLearnable}
              title="Usar o conteúdo deste arquivo na base de conhecimento"
              desc="Desligue em arquivo que é só pra enviar."
            />
            {doc.status === 'no_text' && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Este arquivo não tem texto pra aprender (parece escaneado ou é imagem). O envio funciona normalmente.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
