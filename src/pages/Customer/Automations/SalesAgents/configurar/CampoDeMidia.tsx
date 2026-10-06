// Imagem ou áudio da primeira mensagem. Sobe o arquivo na hora (o servidor guarda e
// devolve o endereço) e só grava o endereço na IA no Salvar do passo.
import { useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Campo } from '@/components/base/Campo';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';

export function CampoDeMidia({ id, agentId, tipo, rotulo, valor, aoMudar }: {
  id: string;
  agentId: string;
  tipo: 'image' | 'audio';
  rotulo: string;
  valor: string | null | undefined;
  aoMudar: (url: string | null) => void;
}) {
  const [progresso, setProgresso] = useState<number | null>(null);
  const [falhou, setFalhou] = useState(false);
  const aceita = tipo === 'image' ? '.jpg,.jpeg,.png,.webp' : '.mp3,.ogg,.m4a,.wav';

  const enviar = async (arquivo: File) => {
    setProgresso(0);
    setFalhou(false);
    try {
      const { url } = await salesAgentsService.uploadMedia(agentId, arquivo, tipo, setProgresso);
      aoMudar(url);
    } catch {
      setFalhou(true);
    } finally {
      setProgresso(null);
    }
  };

  return (
    <Campo id={id} rotulo={rotulo} ajuda={`${tipo === 'image' ? 'JPG, PNG ou WEBP' : 'MP3, OGG, M4A ou WAV'}, até 25 MB.`}
      aviso={falhou ? 'Não deu pra enviar o arquivo. Tente de novo.' : undefined}>
      <div className="flex flex-wrap items-center gap-3">
        {valor && tipo === 'image' && <img src={valor} alt="" className="h-14 w-14 rounded border border-border object-cover" />}
        {valor && tipo === 'audio' && <audio src={valor} controls className="h-9 max-w-[220px]" />}
        <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary/50">
          {valor ? 'Trocar' : 'Escolher arquivo'}
          <input id={id} type="file" className="sr-only" accept={aceita}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void enviar(f); e.target.value = ''; }} />
        </label>
        {valor && <Button type="button" variant="ghost" size="sm" onClick={() => aoMudar(null)}>Tirar</Button>}
        {progresso !== null && <span className="text-sm text-muted-foreground">Enviando… {progresso}%</span>}
      </div>
    </Campo>
  );
}
