// Campos de configuração de bloqueio + CTA — compartilhado por curso e módulo.

import type { KnowledgeAccess, LockCtaType } from '@/hooks/useKnowledge';

export interface LockConfig {
  access: KnowledgeAccess;
  lock_cta_type: LockCtaType;
  lock_cta_label: string;
  lock_cta_value: string;
  lock_message: string;
}

interface Props {
  value: LockConfig;
  onChange: (patch: Partial<LockConfig>) => void;
}

const CTA_TABS: { key: LockCtaType; label: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'link', label: 'Link' },
  { key: 'text', label: 'Só texto' },
  { key: 'none', label: 'Sem botão' },
];

export default function LockConfigFields({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Acesso</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ access: 'free' })}
            className={`px-3 py-1.5 text-[11px] rounded-lg border ${
              value.access === 'free' ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground'
            }`}
          >
            Livre (todos abrem)
          </button>
          <button
            type="button"
            onClick={() => onChange({ access: 'restricted' })}
            className={`px-3 py-1.5 text-[11px] rounded-lg border ${
              value.access === 'restricted' ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground'
            }`}
          >
            Restrito (bloqueado com cadeado)
          </button>
        </div>
      </div>

      {value.access === 'restricted' && (
        <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Ação do cadeado (CTA)</p>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
              {CTA_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onChange({ lock_cta_type: t.key })}
                  className={`px-2.5 py-1 text-[11px] rounded-md ${
                    value.lock_cta_type === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {(value.lock_cta_type === 'whatsapp' || value.lock_cta_type === 'link') && (
            <input
              value={value.lock_cta_value}
              onChange={(e) => onChange({ lock_cta_value: e.target.value })}
              placeholder={
                value.lock_cta_type === 'whatsapp'
                  ? 'WhatsApp com DDI (ex.: 5511999998888)'
                  : 'URL de destino (checkout, página de venda...)'
              }
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          )}
          {value.lock_cta_type !== 'none' && (
            <input
              value={value.lock_cta_label}
              onChange={(e) => onChange({ lock_cta_label: e.target.value })}
              placeholder='Texto do botão (ex.: "Quero liberar")'
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          )}
          <textarea
            value={value.lock_message}
            onChange={(e) => onChange({ lock_message: e.target.value })}
            placeholder="Mensagem do bloqueio (opcional) — aparece pra quem não tem acesso"
            rows={2}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm resize-y"
          />
        </div>
      )}
    </div>
  );
}
