// Janela de criar/editar AULA (Leal Mídia). Junta o que eram dois formulários
// soltos (um espremido na lista lateral, outro empurrando o vídeo pra baixo).

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateLesson, useUploadLessonVideo, useUpdateLesson, useReplaceLessonVideo, type KnowledgeLesson } from '@/hooks/useKnowledge';
import { parseVideoUrl } from '@/pages/Customer/Tutorials/_internal/lib';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { GrupoDaJanela } from '@/components/base/janela';
import CoverPicker from '../CoverPicker';

type Video = 'manter' | 'link' | 'arquivo';

export default function JanelaDaAula({ moduleId, editing, onClose }: { moduleId: string; editing: KnowledgeLesson | null; onClose: () => void }) {
  const createLesson = useCreateLesson();
  const uploadLesson = useUploadLessonVideo();
  const update = useUpdateLesson();
  const replaceVideo = useReplaceLessonVideo();

  const [titulo, setTitulo] = useState(editing?.titulo ?? '');
  const [descricao, setDescricao] = useState(editing?.descricao_md ?? '');
  const [duracao, setDuracao] = useState(editing?.duracao_min ? String(editing.duracao_min) : '');
  const [capaUrl, setCapaUrl] = useState(editing?.capa_url ?? '');
  const [video, setVideo] = useState<Video>(editing ? 'manter' : 'link');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const busy = createLesson.isPending || uploadLesson.isPending || update.isPending || replaceVideo.isPending;

  const opcoesVideo = [
    ...(editing ? [{ valor: 'manter' as const, rotulo: 'Manter o atual' }] : []),
    { valor: 'link' as const, rotulo: 'Link do YouTube ou Vimeo' },
    { valor: 'arquivo' as const, rotulo: 'Enviar arquivo' },
  ];

  async function salvar() {
    if (!titulo.trim()) { toast.error('Dê um título à aula.'); return; }
    const dur = duracao ? parseInt(duracao, 10) : null;
    const parsed = video === 'link' ? parseVideoUrl(videoUrl) : null;
    if (video === 'link' && (!videoUrl.trim() || !parsed)) { toast.error('Cole um link válido do YouTube ou Vimeo.'); return; }
    if (video === 'arquivo' && !file) { toast.error('Selecione o arquivo de vídeo.'); return; }

    try {
      if (!editing) {
        if (video === 'link') await createLesson.mutateAsync({ module_id: moduleId, titulo: titulo.trim(), video_url: videoUrl.trim(), duracao_min: dur ?? undefined });
        else if (file) await uploadLesson.mutateAsync({ module_id: moduleId, titulo: titulo.trim(), file, duracao_min: dur ?? undefined });
        onClose();
        return;
      }
      if (video === 'arquivo' && file) await replaceVideo.mutateAsync({ id: editing.id, file });
      await update.mutateAsync({
        id: editing.id,
        titulo: titulo.trim(),
        descricao_md: descricao,
        duracao_min: dur,
        capa_url: capaUrl.trim() || null,
        ...(video === 'link' && parsed ? { video_url: videoUrl.trim(), video_provider: parsed.provider, video_id: parsed.id, storage_path: null } : {}),
      });
      onClose();
    } catch {
      /* o hook já avisa o erro; a janela continua aberta */
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-2xl"
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        onInteractOutside={(e) => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>{editing ? 'Editar aula' : 'Nova aula'}</DialogTitle></DialogHeader>
        <div className="grid gap-6">
          <GrupoDaJanela titulo="Aula">
            <CampoTexto id="aula-titulo" rotulo="Título da aula" valor={titulo} aoMudar={setTitulo} />
            <CampoTexto id="aula-duracao" rotulo="Duração em minutos (opcional)" valor={duracao} aoMudar={(v) => setDuracao(v.replace(/[^0-9]/g, ''))} />
            {editing && <CoverPicker value={capaUrl} onChange={setCapaUrl} />}
            {editing && <CampoTextoLongo id="aula-texto" rotulo="Texto da aula (aparece abaixo do vídeo)" valor={descricao} aoMudar={setDescricao} rows={5} />}
          </GrupoDaJanela>
          <GrupoDaJanela titulo="Vídeo">
            <BotoesDeEscolha rotulo="Vídeo" valor={video} opcoes={opcoesVideo} aoEscolher={setVideo} />
            {video === 'link' && (
              <CampoTexto id="aula-link" rotulo="Link do YouTube ou Vimeo" valor={videoUrl} aoMudar={setVideoUrl}
                placeholder="https://youtube.com/..." />
            )}
            {video === 'arquivo' && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <input type="file" accept="video/*" aria-label="Arquivo de vídeo" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </GrupoDaJanela>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={busy}>
            {busy ? (video === 'arquivo' && file ? 'Enviando vídeo...' : 'Salvando...') : editing ? 'Salvar' : 'Criar aula'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
