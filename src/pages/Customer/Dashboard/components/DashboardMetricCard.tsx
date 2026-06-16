import { useRef, useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@evoapi/design-system';
import { TooltipInfo } from '@/components/base/TooltipInfo';
import { useInView, animate } from 'framer-motion';

type CardTone = 'good' | 'warning' | 'critical' | 'neutral';
type CardImportance = 'primary' | 'secondary';

interface DashboardMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accentClassName: string;
  importance?: CardImportance;
  status?: { label: string; tone: CardTone };
  tooltip?: { title: string; content: string };
}

const toneClasses: Record<CardTone, string> = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  warning: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

const toneGlow: Record<CardTone, string> = {
  good: 'rgba(16,185,129,0.55)',
  warning: 'rgba(245,158,11,0.55)',
  critical: 'rgba(239,68,68,0.55)',
  neutral: 'rgba(124,58,237,0.45)',
};

function AnimatedNumber({ target, className }: { target: number; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, target, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1] as any,
      onUpdate(v: number) { setDisplayed(Math.round(v)); },
    });
    return () => controls.stop();
  }, [isInView, target]);

  return <span ref={ref} className={className}>{displayed.toLocaleString('pt-BR')}</span>;
}

const DashboardMetricCard = ({
  title, value, subtitle, icon: Icon, accentClassName,
  importance = 'secondary', status, tooltip,
}: DashboardMetricCardProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const valueClassName = importance === 'primary' ? 'text-3xl font-semibold' : 'text-2xl font-semibold';
  const numericValue =
    typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+$/.test(value.replace(/[.,\s]/g, ''))
    ? Number(value.replace(/[.,\s]/g, ''))
    : null;

  const glowColor = status ? toneGlow[status.tone] : 'rgba(124,58,237,0.45)';
  const isPrimary = importance === 'primary';

  // 3D tilt — direct DOM, zero React re-renders on mousemove
  useEffect(() => {
    const el = wrapRef.current;
    const shine = shineRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      el.style.transform = `perspective(900px) rotateY(${dx * 10}deg) rotateX(${-dy * 7}deg) scale3d(1.03,1.03,1.03)`;
      if (shine) {
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        shine.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.10) 0%, transparent 60%)`;
      }
    };

    const onEnter = () => {
      el.style.transition = 'transform 0.1s ease-out';
    };

    const onLeave = () => {
      el.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)';
      if (shine) shine.style.background = 'transparent';
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="h-full"
      style={{ transformStyle: 'preserve-3d', position: 'relative', willChange: 'transform' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Rotating border glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 'calc(var(--radius) + 2px)',
          background: `conic-gradient(from 180deg at 50% 50%, ${glowColor}, transparent 60%, ${glowColor})`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.35s ease',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Card
        className="h-full relative overflow-hidden"
        style={{
          zIndex: 1,
          transition: 'box-shadow 0.35s ease, border-color 0.35s ease',
          boxShadow: isHovered
            ? `0 0 0 1px ${glowColor}, 0 12px 40px ${glowColor.replace(/[\d.]+\)$/, '0.18)')}, 0 2px 8px rgba(0,0,0,0.25)`
            : isPrimary
            ? '0 0 0 1px rgba(124,58,237,0.2)'
            : '0 0 0 1px transparent',
          ...(isPrimary ? { borderColor: 'transparent', background: 'rgba(124,58,237,0.03)' } : { borderColor: 'transparent' }),
        }}
      >
        {/* Radial light follow cursor */}
        <div
          ref={shineRef}
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            pointerEvents: 'none', zIndex: 2,
            borderRadius: 'inherit',
            transition: 'background 0.05s',
          }}
        />

        {/* Diagonal shine sweep on enter */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.055) 50%, transparent 75%)',
            backgroundSize: '250% 100%',
            backgroundPosition: isHovered ? '-10% 0' : '150% 0',
            transition: 'background-position 0.65s ease',
            pointerEvents: 'none', zIndex: 3,
            borderRadius: 'inherit',
          }}
        />

        <CardHeader
          className="flex flex-row items-start justify-between pb-2 gap-3"
          style={{ position: 'relative', zIndex: 4 }}
        >
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <span className="truncate">{title}</span>
              {tooltip && <TooltipInfo title={tooltip.title} content={tooltip.content} />}
            </CardTitle>
            {status && (
              <Badge variant="outline" className={`mt-2 ${toneClasses[status.tone]}`}>
                {status.label}
              </Badge>
            )}
          </div>

          {/* Icon with tone-matched glow */}
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${accentClassName}`}
            style={{
              transition: 'box-shadow 0.35s ease, transform 0.35s ease',
              boxShadow: isHovered ? `0 0 18px ${glowColor}, 0 0 6px ${glowColor}` : 'none',
              transform: isHovered ? 'scale(1.12)' : 'scale(1)',
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>

        <CardContent style={{ position: 'relative', zIndex: 4 }}>
          {numericValue !== null ? (
            <AnimatedNumber target={numericValue} className={valueClassName} />
          ) : (
            <div className={valueClassName}>{value}</div>
          )}
          {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardMetricCard;
