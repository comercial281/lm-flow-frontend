import { useMemo, useState } from 'react';
import { X, Star, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, GripVertical } from 'lucide-react';
import type { MenuItem } from '@/components/layout/config/menuItems';
import { loadMenuPrefs, saveMenuPrefs, resetMenuPrefs, type MenuPrefs } from '@/components/layout/config/menuPrefs';

interface Props {
  items: MenuItem[]; // itens já filtrados por permissão (todos os que o usuário pode ver)
  onClose: () => void;
}

// Ordena TODOS os itens (incl. escondidos, pro editor) por favorito + ordem manual.
function orderForEditor(items: MenuItem[], p: MenuPrefs): MenuItem[] {
  const oi = (h: string) => { const i = p.order.indexOf(h); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  const byOrder = (a: MenuItem, b: MenuItem) => oi(a.href) - oi(b.href);
  const fav = items.filter(i => p.favorites.includes(i.href)).sort(byOrder);
  const rest = items.filter(i => !p.favorites.includes(i.href)).sort(byOrder);
  return [...fav, ...rest];
}

export default function MenuCustomizer({ items, onClose }: Props) {
  const [prefs, setPrefs] = useState<MenuPrefs>(loadMenuPrefs());

  const list = useMemo(() => orderForEditor(items, prefs), [items, prefs]);

  const update = (next: MenuPrefs) => { setPrefs(next); saveMenuPrefs(next); };

  const toggleHidden = (href: string) =>
    update({ ...prefs, hidden: prefs.hidden.includes(href) ? prefs.hidden.filter(h => h !== href) : [...prefs.hidden, href] });

  const toggleFav = (href: string) =>
    update({ ...prefs, favorites: prefs.favorites.includes(href) ? prefs.favorites.filter(h => h !== href) : [...prefs.favorites, href] });

  const move = (href: string, dir: -1 | 1) => {
    const order = list.map(i => i.href);
    const idx = order.indexOf(href);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    update({ ...prefs, order });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: '#150a26', border: '1px solid rgba(124,58,237,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <div>
            <h3 className="text-white font-semibold text-sm">Personalizar menu</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Mover, favoritar e esconder do seu jeito</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {list.map((item, i) => {
            const hidden = prefs.hidden.includes(item.href);
            const fav = prefs.favorites.includes(item.href);
            return (
              <div key={item.href} className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', opacity: hidden ? 0.45 : 1 }}>
                <GripVertical className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span className="flex-1 text-sm text-white/85 truncate">{item.name}</span>

                <button onClick={() => move(item.href, -1)} disabled={i === 0} title="Subir"
                  className="text-white/35 hover:text-white/80 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => move(item.href, 1)} disabled={i === list.length - 1} title="Descer"
                  className="text-white/35 hover:text-white/80 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>

                <button onClick={() => toggleFav(item.href)} title="Favoritar"
                  className="transition-colors" style={{ color: fav ? '#facc15' : 'rgba(255,255,255,0.3)' }}>
                  <Star className="w-4 h-4" fill={fav ? '#facc15' : 'none'} />
                </button>

                <button onClick={() => toggleHidden(item.href)} title={hidden ? 'Mostrar' : 'Esconder'}
                  className="text-white/35 hover:text-white/80">
                  {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <button onClick={() => { resetMenuPrefs(); setPrefs({ hidden: [], favorites: [], order: [] }); }}
            className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white/80">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
          </button>
          <button onClick={onClose} className="lmf-btn-shimmer px-4 py-2 rounded-md text-sm font-semibold text-white">Pronto</button>
        </div>
      </div>
    </div>
  );
}
