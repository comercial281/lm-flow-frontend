import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, LogOut, Loader2, Check } from 'lucide-react';
import { useClientModeStore } from '@/store/clientModeStore';
import {
  listPooledTenants,
  mintClientToken,
  tenantToClientMode,
  type PooledTenant,
} from '@/services/clientMode/clientModeService';
import { toast } from 'sonner';

// Barra fixa global do MODO CLIENTE. Só aparece quando o super-admin está
// operando dentro de um cliente. Mostra em QUEM ele está mexendo, deixa trocar
// de cliente na hora e sair do modo.
export default function ClientModeBar() {
  const { active, tenant, enter, exit } = useClientModeStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<PooledTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const loadTenants = useCallback(async () => {
    if (tenants.length > 0) return;
    setLoading(true);
    try {
      setTenants(await listPooledTenants());
    } catch {
      toast.error('Falha ao listar clientes.');
    } finally {
      setLoading(false);
    }
  }, [tenants.length]);

  if (!active || !tenant) return null;

  const openMenu = () => {
    setOpen(o => !o);
    if (!open) loadTenants();
  };

  const switchTo = async (t: PooledTenant) => {
    if (t.slug === tenant.slug) {
      setOpen(false);
      return;
    }
    setSwitchingId(t.id);
    try {
      const token = await mintClientToken(t.id);
      enter(tenantToClientMode(t), token);
      setOpen(false);
      toast.success(`Modo cliente: ${t.name}`);
      // Recarrega a tela atual já no contexto do novo cliente.
      window.location.reload();
    } catch {
      toast.error('Não consegui entrar nesse cliente.');
    } finally {
      setSwitchingId(null);
    }
  };

  const leave = () => {
    exit();
    toast.message('Você saiu do modo cliente.');
    navigate('/admin/modo-cliente');
  };

  return (
    <div className="w-full bg-violet-600 text-white shadow-md">
      <div className="flex items-center gap-3 px-4 py-1.5 text-sm">
        <Building2 className="h-4 w-4 shrink-0 opacity-90" />
        <span className="opacity-90">Editando como cliente:</span>

        {/* Seletor de cliente */}
        <div className="relative" ref={boxRef}>
          <button
            onClick={openMenu}
            className="flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25 transition-colors"
          >
            {tenant.name}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-white/10 bg-[#1A0A2E] text-white shadow-xl z-[60] overflow-hidden">
              <div className="px-3 py-2 text-xs uppercase tracking-wide text-violet-300/80 border-b border-white/10">
                Trocar de cliente
              </div>
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-violet-200/80">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <ul className="max-h-72 overflow-auto py-1">
                  {tenants.map(t => (
                    <li key={t.id}>
                      <button
                        onClick={() => switchTo(t)}
                        disabled={switchingId === t.id}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-60"
                      >
                        <span className="truncate">{t.name}</span>
                        {switchingId === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : t.slug === tenant.slug ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-white/70">
            Tudo que você editar aqui é do cliente, não seu.
          </span>
          <button
            onClick={leave}
            className="flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 font-medium hover:bg-white/25 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair do modo cliente
          </button>
        </div>
      </div>
    </div>
  );
}
