export interface InboxOption {
  id: string | number;
  name: string;
}

// Toggle liga/desliga reutilizável. `rotulo` é o nome da chave (ex.: "curtir
// mensagens do cliente") — sem ele, o leitor de tela só ouve "Ligar"/"Desligar"
// e, com 13 chaves na mesma tela, ninguém distingue uma da outra.
export function Toggle({ on, onChange, rotulo }: { on: boolean; onChange: (v: boolean) => void; rotulo?: string }) {
  const nome = rotulo ? `${on ? 'Desligar' : 'Ligar'} ${rotulo}` : (on ? 'Desligar' : 'Ligar');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      aria-label={nome}
      title={nome}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/40'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ---------------- Inteligência, limites e escopo (Fase 3) ----------------

export function CheckRow({ checked, onChange, title, desc }: {
  checked: boolean; onChange: (v: boolean) => void; title: string; desc?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <div className="text-sm font-medium">{title}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
    </label>
  );
}

export interface PipelineOpt { id: string; name: string }
export interface StageOpt { id: string; name: string }
