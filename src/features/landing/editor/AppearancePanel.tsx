import {
  BRAND_MODE_LABELS,
  DEFAULT_LANDING_THEME,
  type BrandMode,
  type LandingTheme,
} from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';

const COLOR_FIELDS: { key: keyof LandingTheme; label: string }[] = [
  { key: 'primary', label: 'Primária' },
  { key: 'accent', label: 'Destaque' },
  { key: 'bgStart', label: 'Fundo (início)' },
  { key: 'bgEnd', label: 'Fundo (fim)' },
  { key: 'blockBg', label: 'Fundo dos blocos' },
  { key: 'text', label: 'Texto' },
];

const FONTS = ['Inter', 'Space Grotesk', 'Lato', 'Poppins', 'Montserrat', 'Roboto'];

const BRAND_MODES: BrandMode[] = ['client', 'development', 'both'];

/** Per-page appearance: branding source, colors and font. */
export function AppearancePanel() {
  const theme = useLandingEditorStore((s) => s.theme);
  const brandMode = useLandingEditorStore((s) => s.brandMode);
  const setTheme = useLandingEditorStore((s) => s.setTheme);
  const setBrandMode = useLandingEditorStore((s) => s.setBrandMode);

  const currentFont = (theme.fontFamily ?? DEFAULT_LANDING_THEME.fontFamily).split(',')[0].trim();

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-xs text-neutral-400">Fonte da marca</span>
        <select
          value={brandMode}
          onChange={(e) => setBrandMode(e.target.value as BrandMode)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500"
        >
          {BRAND_MODES.map((m) => (
            <option key={m} value={m}>
              {BRAND_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="mb-1 block text-xs text-neutral-400">Fonte</span>
        <select
          value={currentFont}
          onChange={(e) => setTheme({ fontFamily: `${e.target.value}, sans-serif` })}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COLOR_FIELDS.map((f) => {
          const value = (theme[f.key] as string) ?? DEFAULT_LANDING_THEME[f.key];
          return (
            <label key={f.key} className="flex items-center gap-2">
              <input
                type="color"
                value={value}
                onChange={(e) => setTheme({ [f.key]: e.target.value })}
                className="h-7 w-9 flex-none cursor-pointer rounded border border-neutral-700 bg-transparent"
              />
              <span className="text-xs text-neutral-300">{f.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
