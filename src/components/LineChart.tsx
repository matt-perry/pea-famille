/**
 * Graphique en courbes, dessiné en SVG, avec lecture au doigt (glisser sur le graphique).
 * Aucune donnée n'est calculée ici : le graphique affiche ce qu'on lui donne.
 */
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  id: string;
  label: string;
  points: ChartPoint[];
  color: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
  area?: boolean;
}

export interface TooltipContent {
  title: string;
  lines: { label?: string; value: string; color?: string }[];
}

interface Props {
  series: ChartSeries[];
  height?: number;
  yFromZero?: boolean;
  xTicks?: { x: number; label: string }[];
  yTicks?: number;
  formatY?: (v: number) => string;
  hLines?: { y: number; label: string; color?: string }[];
  vLines?: { x: number; label: string }[];
  markers?: ChartPoint[];
  ariaLabel: string;
  tooltip: (x: number) => TooltipContent | null;
  idle?: TooltipContent | null;
}

const PAD_TOP = 10;
const AXIS_H = 20;

function niceStep(range: number, count: number): number {
  const raw = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export function LineChart(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const gradientId = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const height = props.height ?? 180;
  const plotH = height - AXIS_H;
  const labelW = props.yTicks ? 54 : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.max(200, entries[0].contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => {
    const xs = props.series.flatMap((s) => s.points.map((p) => p.x));
    const ys = props.series.flatMap((s) => s.points.map((p) => p.y)).concat((props.hLines ?? []).map((h) => h.y));
    if (xs.length === 0) return null;
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    let yMin = props.yFromZero ? 0 : Math.min(...ys);
    let yMax = Math.max(...ys);
    if (yMax === yMin) {
      yMax += Math.abs(yMax) * 0.05 || 1;
      yMin -= props.yFromZero ? 0 : Math.abs(yMin) * 0.05 || 1;
    }
    const pad = (yMax - yMin) * 0.06;
    if (!props.yFromZero) yMin -= pad;
    yMax += pad;
    const plotW = width - labelW;
    const X = (x: number) => (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
    const Y = (y: number) => PAD_TOP + (1 - (y - yMin) / (yMax - yMin)) * (plotH - PAD_TOP);
    const invX = (px: number) => xMin + (px / plotW) * (xMax - xMin);
    let ticks: number[] = [];
    if (props.yTicks) {
      const step = niceStep(yMax - yMin, props.yTicks);
      const start = Math.ceil(yMin / step) * step;
      for (let v = start; v <= yMax; v += step) ticks.push(v);
      if (ticks.length > props.yTicks + 2) ticks = ticks.filter((_, i) => i % 2 === 0);
    }
    return { X, Y, invX, plotW, ticks, xMin, xMax };
  }, [props.series, props.hLines, props.yFromZero, props.yTicks, width, labelW, plotH]);

  const nearest = (points: ChartPoint[], x: number): ChartPoint | null => {
    let best: ChartPoint | null = null;
    for (const p of points) if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best;
  };

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!scale) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(scale.plotW, event.clientX - rect.left));
    const primary = props.series[0]?.points ?? [];
    const snap = nearest(primary, scale.invX(px));
    setScrubX(snap ? snap.x : scale.invX(px));
  };

  const content = scrubX !== null ? props.tooltip(scrubX) : props.idle ?? null;

  return (
    <div className="chart" ref={ref}>
      <div className="chart-tooltip" aria-live="polite">
        {content && (
          <>
            <div className="title">{content.title}</div>
            {content.lines.map((l, i) => (
              <div key={i} className="line" style={l.color ? { color: l.color } : undefined}>
                {l.label ? `${l.label} : ` : ''}
                {l.value}
              </div>
            ))}
          </>
        )}
      </div>
      {scale ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={props.ariaLabel}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch' || scrubX !== null) onPointer(e);
          }}
          onPointerUp={() => setScrubX(null)}
          onPointerCancel={() => setScrubX(null)}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setScrubX(null);
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={props.series[0]?.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={props.series[0]?.color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={scale.plotW} y1={scale.Y(t)} y2={scale.Y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={width - 2} y={scale.Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--secondary)">
                {props.formatY ? props.formatY(t) : t}
              </text>
            </g>
          ))}

          {props.series.map((s) => {
            if (s.points.length === 0) return null;
            const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${scale.X(p.x).toFixed(1)} ${scale.Y(p.y).toFixed(1)}`).join('');
            return (
              <g key={s.id}>
                {s.area && s.points.length > 1 && (
                  <path
                    d={`${d}L${scale.X(s.points[s.points.length - 1].x).toFixed(1)} ${plotH}L${scale.X(s.points[0].x).toFixed(1)} ${plotH}Z`}
                    fill={`url(#${gradientId})`}
                  />
                )}
                {s.points.length === 1 ? (
                  <circle cx={scale.X(s.points[0].x)} cy={scale.Y(s.points[0].y)} r={3} fill={s.color} />
                ) : (
                  <path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width ?? 2}
                    strokeOpacity={s.opacity ?? 1}
                    strokeDasharray={s.dashed ? '5 4' : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}

          {(props.hLines ?? []).map((h) => (
            <g key={h.label}>
              <line x1={0} x2={scale.plotW} y1={scale.Y(h.y)} y2={scale.Y(h.y)} stroke={h.color ?? 'var(--chart-muted)'} strokeDasharray="3 4" strokeWidth={1.2} />
              <text x={4} y={scale.Y(h.y) - 5} fontSize={11} fill={h.color ?? 'var(--secondary)'}>
                {h.label}
              </text>
            </g>
          ))}

          {(props.vLines ?? []).map((v) => (
            <g key={v.label}>
              <line x1={scale.X(v.x)} x2={scale.X(v.x)} y1={PAD_TOP} y2={plotH} stroke="var(--chart-muted)" strokeDasharray="3 4" strokeWidth={1.2} />
              <text x={scale.X(v.x) - 4} y={PAD_TOP + 10} textAnchor="end" fontSize={11} fill="var(--secondary)">
                {v.label}
              </text>
            </g>
          ))}

          {(props.markers ?? []).map((m, i) => (
            <circle key={i} cx={scale.X(m.x)} cy={scale.Y(m.y)} r={4} fill="var(--accent)" stroke="var(--card)" strokeWidth={1.5} />
          ))}

          {(props.xTicks ?? []).map((t) => (
            <text
              key={t.label}
              x={Math.min(scale.plotW - 2, Math.max(2, scale.X(t.x)))}
              y={height - 4}
              textAnchor={scale.X(t.x) < 20 ? 'start' : scale.X(t.x) > scale.plotW - 20 ? 'end' : 'middle'}
              fontSize={11}
              fill="var(--secondary)"
            >
              {t.label}
            </text>
          ))}

          {scrubX !== null && (
            <g>
              <line x1={scale.X(scrubX)} x2={scale.X(scrubX)} y1={PAD_TOP - 6} y2={plotH} stroke="var(--secondary)" strokeWidth={1} />
              {props.series.map((s) => {
                const p = nearest(s.points, scrubX);
                return p ? <circle key={s.id} cx={scale.X(p.x)} cy={scale.Y(p.y)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} /> : null;
              })}
            </g>
          )}
        </svg>
      ) : (
        <div className="empty" style={{ height }}>
          Pas encore de données à afficher.
        </div>
      )}
    </div>
  );
}
