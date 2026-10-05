import { Input, Label } from '@/components/ui/ds';
import { type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { Seletor } from '@/components/base/Seletor';
import { Toggle } from '../comum';

// ---------------- Áudio (voz) ----------------

const AUDIO_MODE_OPTIONS: { value: 'mirror' | 'always' | 'never'; label: string }[] = [
  { value: 'mirror', label: 'Espelhar o lead (recomendado) — voz só se ele mandou áudio' },
  { value: 'always', label: 'Sempre em áudio' },
  { value: 'never', label: 'Nunca (só texto)' },
];

export function AudioSection({ agent, onChange, onSave }: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const on = agent.audio_enabled;
  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Áudio (voz)</div>
          <div className="text-xs text-muted-foreground">
            A IA sempre ENTENDE os áudios do lead (transcrição automática). Ligue aqui pra ela também RESPONDER em voz.
          </div>
        </div>
        <Toggle on={!!on} onChange={(v) => onSave({ audio_enabled: v })} rotulo="responder em áudio" />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-1">
          <div>
            <Label htmlFor="audio_mode" className="text-xs">Quando responder por áudio</Label>
            <Seletor
              id="audio_mode"
              value={agent.audio_mode ?? 'mirror'}
              onChange={(e) => onSave({ audio_mode: e.target.value as 'mirror' | 'always' | 'never' })}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
            >
              {AUDIO_MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Seletor>
          </div>
          <div>
            <Label htmlFor="audio_voice" className="text-xs">Voz (ID do ElevenLabs)</Label>
            <Input
              id="audio_voice"
              placeholder="rnJZLKxtlBZt77uIED10 (Sergio, padrão)"
              value={agent.audio_voice_id ?? ''}
              onChange={(e) => onChange({ ...agent, audio_voice_id: e.target.value })}
              onBlur={() => onSave({ audio_voice_id: (agent.audio_voice_id ?? '').trim() || null })}
            />
            <p className="text-xs text-muted-foreground mt-1">A IA fala como homem — use uma voz masculina. Vazio = Sergio (padrão).</p>
          </div>
        </div>
      )}
    </div>
  );
}
