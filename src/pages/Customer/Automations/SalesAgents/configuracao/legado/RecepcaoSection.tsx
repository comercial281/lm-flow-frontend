import { useState } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { salesAgentsService, type SalesAgent, type SalesAgentOpening } from '@/services/salesAgents/salesAgentsService';
import { CheckRow } from '../comum';

// ---------------- Print / áudio: subir arquivo ou colar link ----------------

/**
 * O campo continua guardando uma URL — o que muda é de onde ela vem. Antes só dava
 * pra colar link, o que na prática significava ter que hospedar a imagem em algum
 * lugar antes; quem tinha o print no computador ficava sem saída e não usava o
 * recurso. O campo de colar link segue disponível pra quem já usa.
 */
function MediaField({
  agentId, kind, label, value, onChange, onSave,
}: {
  agentId: string;
  kind: 'image' | 'audio';
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const accept = kind === 'image' ? '.jpg,.jpeg,.png,.webp' : '.mp3,.ogg,.m4a,.wav';
  const hint = kind === 'image' ? 'JPG, PNG ou WebP' : 'MP3, OGG, M4A ou WAV';

  const upload = async (file: File) => {
    setProgress(0);
    try {
      const { url } = await salesAgentsService.uploadMedia(agentId, file, kind, setProgress);
      onChange(url);
      onSave(url);
      toast.success('Arquivo enviado');
    } catch {
      toast.error('Não consegui enviar o arquivo');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-3">
        {value && kind === 'image' && (
          <img src={value} alt="" className="h-14 w-14 rounded object-cover border border-sidebar-border" />
        )}
        {value && kind === 'audio' && (
          <audio src={value} controls className="h-9 max-w-[220px]" />
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs px-2 py-1 rounded border border-sidebar-border cursor-pointer hover:border-primary/50">
            {value ? 'Trocar' : 'Escolher arquivo'}
            <input
              type="file" className="hidden" accept={accept}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
            />
          </label>
          {value && (
            <button type="button" className="text-xs text-red-500 hover:underline"
                    onClick={() => { onChange(''); onSave(''); }}>
              Remover
            </button>
          )}
          <button type="button" className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setShowUrl((v) => !v)}>
            ou colar um link
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{hint}, até 25 MB.</p>
      {progress !== null && (
        <div className="mt-2 h-1.5 bg-sidebar-border rounded overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {showUrl && (
        <Input
          className="mt-2"
          placeholder={kind === 'image' ? 'https://...jpg' : 'https://...ogg'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onSave(value.trim())}
        />
      )}
    </div>
  );
}

// ---------------- Recepção inicial (primeiro contato) ----------------

export function RecepcaoSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const openings = agent.openings ?? [];

  const patchOpening = (i: number, patch: Partial<SalesAgentOpening>) => {
    const next = openings.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onChange({ ...agent, openings: next });
  };
  const commitOpenings = (next: SalesAgentOpening[]) => onSave({ openings: next });
  const addOpening = () =>
    commitOpenings([...openings, { label: 'Nova campanha', origins: [], form_ids: [], keywords: [] }]);
  const removeOpening = (i: number) => commitOpenings(openings.filter((_, idx) => idx !== i));

  const list = (arr?: string[]) => (arr ?? []).join(', ');
  const toArr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="pt-2 border-t border-sidebar-border space-y-5">
      <div>
        <div className="text-sm font-medium">Recepção inicial (primeiro contato)</div>
        <div className="text-xs text-muted-foreground">
          A abertura padrão da IA: nome do lead, apresentação, de onde ele veio e a pergunta que segmenta a intenção.
          Print e áudio são opcionais. Sem eles, a IA manda só os textos.
        </div>
      </div>

      <div>
        <Label htmlFor="default_origin">De onde o lead veio (origem)</Label>
        <Input
          id="default_origin"
          placeholder="Ex: nosso anúncio do Instagram"
          value={agent.default_origin ?? ''}
          onChange={(e) => onChange({ ...agent, default_origin: e.target.value })}
          onBlur={() => onSave({ default_origin: (agent.default_origin ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">A IA cita isso na abertura quando o lead não traz a origem do anúncio.</p>
      </div>

      <div>
        <Label htmlFor="intent_question">Pergunta de intenção (fecha a abertura)</Label>
        <Textarea
          id="intent_question"
          rows={2}
          placeholder="Ex: seu foco é moradia, investimento ou ainda tá só sondando?"
          value={agent.intent_question ?? ''}
          onChange={(e) => onChange({ ...agent, intent_question: e.target.value })}
          onBlur={() => onSave({ intent_question: (agent.intent_question ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">É a pergunta que gera diálogo e segmenta o lead. A IA sempre fecha a abertura com ela.</p>
      </div>

      <div>
        <Label htmlFor="reply_delay">Tempo de espera antes de responder (segundos)</Label>
        <Input
          id="reply_delay"
          type="number"
          min={0}
          max={120}
          placeholder="10"
          value={agent.reply_delay_seconds ?? ''}
          onChange={(e) => onChange({ ...agent, reply_delay_seconds: e.target.value === '' ? 0 : Number(e.target.value) })}
          onBlur={() => onSave({ reply_delay_seconds: Math.max(0, Number(agent.reply_delay_seconds) || 0) })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          A IA espera esse tempo pra juntar mensagens antes de responder. Se o lead manda 2-3 mensagens seguidas, ela lê todas e responde uma vez, com contexto. Vazio/0 = padrão de 10s.
        </p>
      </div>

      {/*
        Fica colado no campo acima de propósito: os dois falam do ritmo da conversa.
        Aquele é o tempo de ESPERA (juntar o que o lead mandou); este é o ritmo da
        RESPOSTA (espalhar o que a IA vai mandar). Separá-los faria procurar em
        dois lugares a mesma coisa.
      */}
      <div className="rounded-md border p-3 space-y-3">
        <CheckRow
          checked={agent.message_split_enabled !== false}
          onChange={(v) => { onChange({ ...agent, message_split_enabled: v }); onSave({ message_split_enabled: v }); }}
          title="Responder em várias mensagens"
          desc="A IA divide a resposta em mensagens curtas, com 'digitando...' entre elas, como um corretor no WhatsApp. Desligada, ela manda tudo numa mensagem só."
        />
        {agent.message_split_enabled !== false && (
          <div>
            <Label htmlFor="message_split_max_parts">No máximo quantas mensagens por resposta</Label>
            <Input
              id="message_split_max_parts"
              type="number"
              min={2}
              max={4}
              placeholder="3"
              value={agent.message_split_max_parts ?? ''}
              onChange={(e) => onChange({ ...agent, message_split_max_parts: e.target.value === '' ? 0 : Number(e.target.value) })}
              onBlur={() => onSave({ message_split_max_parts: Math.min(4, Math.max(2, Number(agent.message_split_max_parts) || 3)) })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              É teto, não meta: resposta curta continua saindo numa mensagem só. O limite de 4 existe porque
              rajada de mensagens é o que mais faz o WhatsApp tratar um número como robô.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <MediaField
          agentId={agent.id} kind="image" label="Print de abertura (opcional)"
          value={agent.opening_image_url ?? ''}
          onChange={(v) => onChange({ ...agent, opening_image_url: v })}
          onSave={(v) => onSave({ opening_image_url: v || null })}
        />
        <MediaField
          agentId={agent.id} kind="audio" label="Áudio de abertura (opcional)"
          value={agent.opening_audio_url ?? ''}
          onChange={(v) => onChange({ ...agent, opening_audio_url: v })}
          onSave={(v) => onSave({ opening_audio_url: v || null })}
        />
      </div>

      {/* Recepções por campanha */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium">Recepções por campanha</div>
          <Button variant="outline" size="sm" onClick={addOpening}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          Abertura, pergunta, print e áudio diferentes por origem, formulário do Meta ou palavra-chave. A IA usa a 1ª que combinar; senão, a recepção padrão acima.
        </div>

        {openings.length === 0 && (
          <div className="text-xs text-muted-foreground italic">Nenhuma. A IA usa a recepção padrão pra todos.</div>
        )}

        <div className="space-y-4">
          {openings.map((o, i) => (
            <div key={i} className="rounded-lg border border-sidebar-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Input
                  className="font-medium"
                  placeholder="Nome (ex: Alma Panamby - Instagram)"
                  value={o.label ?? ''}
                  onChange={(e) => patchOpening(i, { label: e.target.value })}
                  onBlur={() => commitOpenings(openings)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeOpening(i)} title="Remover">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Origens (vírgula)</Label>
                  <Input placeholder="instagram, alma, campanha X"
                    value={list(o.origins)}
                    onChange={(e) => patchOpening(i, { origins: toArr(e.target.value) })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
                <div>
                  <Label className="text-xs">IDs de formulário Meta (vírgula)</Label>
                  <Input placeholder="123456789"
                    value={list(o.form_ids)}
                    onChange={(e) => patchOpening(i, { form_ids: toArr(e.target.value) })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
                <div>
                  <Label className="text-xs">Palavras-chave (vírgula)</Label>
                  <Input placeholder="alma, torre 2"
                    value={list(o.keywords)}
                    onChange={(e) => patchOpening(i, { keywords: toArr(e.target.value) })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Abertura desta campanha</Label>
                <Textarea rows={2} placeholder="Deixe vazio pra usar a padrão"
                  value={o.greeting ?? ''}
                  onChange={(e) => patchOpening(i, { greeting: e.target.value })}
                  onBlur={() => commitOpenings(openings)} />
              </div>
              <div>
                <Label className="text-xs">Pergunta de intenção desta campanha</Label>
                <Textarea rows={2} placeholder="Deixe vazio pra usar a padrão"
                  value={o.intent_question ?? ''}
                  onChange={(e) => patchOpening(i, { intent_question: e.target.value })}
                  onBlur={() => commitOpenings(openings)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <MediaField
                  agentId={agent.id} kind="image" label="Print desta campanha"
                  value={o.image_url ?? ''}
                  onChange={(v) => patchOpening(i, { image_url: v })}
                  onSave={(v) => commitOpenings(openings.map((op, idx) => (idx === i ? { ...op, image_url: v } : op)))}
                />
                <MediaField
                  agentId={agent.id} kind="audio" label="Áudio desta campanha"
                  value={o.audio_url ?? ''}
                  onChange={(v) => patchOpening(i, { audio_url: v })}
                  onSave={(v) => commitOpenings(openings.map((op, idx) => (idx === i ? { ...op, audio_url: v } : op)))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
