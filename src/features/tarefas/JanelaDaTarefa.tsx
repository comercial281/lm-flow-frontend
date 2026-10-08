import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { visitsService, type LeadPickerItem, type PersonRef } from '@/services/visits/visitsService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { CATEGORIAS_INICIAIS, TEXTOS_DE_TAREFAS as T } from './textos';
import { juntarDataEHora, proximaHoraCheia, separarDataEHora } from './prazos';
import { motivoDoErro, tarefasService } from './tarefasService';
import type { TarefaAtividade } from './tipos';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  aoSalvar: (t: TarefaAtividade) => void;
  /** Edição: a tarefa como veio da lista. */
  tarefa?: TarefaAtividade | null;
  /** Criar num card conhecido (aba do card, seção da Conversa). */
  pipelineItemId?: string | null;
  /** Atividades: escolher o lead antes (o servidor acha o card dele). */
  escolherLead?: boolean;
  categoriaInicial?: string;
}

/**
 * Criar ou editar tarefa (Frente 2, 07/10/2026). Data e hora livres, no passado
 * ou no futuro. Responsável vazio = o responsável do lead (o servidor decide);
 * a lista de pessoas é a mesma da Agenda, então o corretor isolado só vê ele.
 */
export default function JanelaDaTarefa({ aberta, aoFechar, aoSalvar, tarefa, pipelineItemId, escolherLead, categoriaInicial }: Props) {
  const sugestao = proximaHoraCheia();
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState(categoriaInicial ?? CATEGORIAS_INICIAIS[0]);
  const [data, setData] = useState(sugestao.data);
  const [hora, setHora] = useState(sugestao.hora);
  const [responsavel, setResponsavel] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pessoas, setPessoas] = useState<PersonRef[]>([]);
  const [busca, setBusca] = useState('');
  const [leads, setLeads] = useState<LeadPickerItem[]>([]);
  const [lead, setLead] = useState<LeadPickerItem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const base = tarefa?.due_at ? separarDataEHora(tarefa.due_at) : proximaHoraCheia();
    setTitulo(tarefa?.title ?? '');
    setCategoria(tarefa?.category ?? categoriaInicial ?? CATEGORIAS_INICIAIS[0]);
    setData(base.data);
    setHora(base.hora);
    setResponsavel(tarefa?.assignee?.id ?? '');
    setDescricao(tarefa?.description ?? '');
    setLead(null);
    setBusca('');
    setErro(null);
    visitsService.realtors().then(setPessoas).catch(() => setPessoas([]));
  }, [aberta, tarefa, categoriaInicial]);

  useEffect(() => {
    if (!aberta || !escolherLead || lead) return;
    const id = window.setTimeout(() => {
      visitsService.leadPickerPage(busca, 1, 8).then(r => setLeads(r.data)).catch(() => setLeads([]));
    }, 300);
    return () => window.clearTimeout(id);
  }, [aberta, escolherLead, busca, lead]);

  const salvar = async () => {
    if (!titulo.trim()) return setErro(T.faltaTitulo);
    if (!data) return setErro(T.faltaData);
    if (escolherLead && !lead && !tarefa) return setErro(T.faltaLead);
    setErro(null);
    setSalvando(true);
    const dados = {
      title: titulo.trim(),
      category: categoria,
      due_date: juntarDataEHora(data, hora),
      description: descricao.trim() || undefined,
      ...(responsavel ? { assigned_to_id: responsavel } : {}),
    };
    try {
      const salva = tarefa
        ? await tarefasService.editar(tarefa.id, dados)
        : await tarefasService.criar({ ...dados, ...(lead ? { contact_id: lead.id } : { pipeline_item_id: pipelineItemId ?? undefined }) });
      toast.success(tarefa ? T.salva : T.criada);
      aoSalvar(salva);
      aoFechar();
    } catch (e) {
      toast.error(motivoDoErro(e) === 'lead_sem_card' ? T.semCardAtividades : apiErrorMessage(e, T.erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={v => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tarefa ? T.editarTarefa : T.novaTarefa}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {escolherLead && !tarefa && (
            <div className="grid gap-1">
              <Label htmlFor="tarefa-lead">{T.lead}</Label>
              {lead ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{lead.name}</span>
                  <button type="button" className="text-xs text-primary" onClick={() => setLead(null)}>{T.editar}</button>
                </div>
              ) : (
                <>
                  <Input id="tarefa-lead" value={busca} onChange={e => setBusca(e.target.value)} placeholder={T.buscarLead} />
                  <ul className="max-h-40 overflow-y-auto">
                    {leads.map(l => (
                      <li key={l.id}>
                        <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setLead(l)}>
                          {l.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="tarefa-categoria">{T.categoria}</Label>
            <Seletor id="tarefa-categoria" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {CATEGORIAS_INICIAIS.map(c => <option key={c} value={c}>{c}</option>)}
            </Seletor>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tarefa-titulo">{T.tituloDoCampo}</Label>
            <Input id="tarefa-titulo" value={titulo} maxLength={255} onChange={e => setTitulo(e.target.value)} placeholder={T.exemploDeTitulo} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="tarefa-data">{T.data}</Label>
              <Input id="tarefa-data" type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="tarefa-hora">{T.hora}</Label>
              <Input id="tarefa-hora" type="time" value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>
          {pessoas.length > 1 && (
            <div className="grid gap-1">
              <Label htmlFor="tarefa-responsavel">{T.responsavel}</Label>
              <Seletor id="tarefa-responsavel" value={responsavel} onChange={e => setResponsavel(e.target.value)}>
                <option value="">{T.responsavelDoLead}</option>
                {pessoas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Seletor>
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="tarefa-descricao">{T.descricao}</Label>
            <Textarea id="tarefa-descricao" rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>{T.cancelar}</Button>
          <Button onClick={salvar} disabled={salvando}>{tarefa ? T.salvar : T.criar}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
