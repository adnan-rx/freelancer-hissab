"use client";

import * as React from "react";
import { cn, formatCompactPKR, formatPKR } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Shared chart furniture.
   Palette is the validated categorical order in globals.css (chart-1…5); it is
   assigned by series identity and never cycled or reordered by rank.
--------------------------------------------------------------------------- */

export interface Series {
  key: string;
  label: string;
  /** Tailwind colour class, e.g. "bg-chart-1" / "text-chart-1". */
  color: string;
}

/** A legend is present whenever there are two or more series. */
function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className={cn("size-2 shrink-0 rounded-[2px]", s.color)} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Screen-reader table so the data is never colour- or vision-dependent.
 *
 * The `sr-only` class MUST sit on a wrapping div, never on the <table> itself:
 * `height: 1px` is a *minimum* on a table box and `overflow: hidden` doesn't
 * clip it, so an sr-only table renders at full natural size — invisible thanks
 * to `clip`, but still absolutely positioned against the initial containing
 * block, which stretches document.scrollHeight and leaves a tall band of empty
 * space under the app. A div honours both properties.
 */
function DataTableFallback({
  caption,
  categoryLabel,
  categories,
  series,
  values,
}: {
  caption: string;
  categoryLabel: string;
  categories: string[];
  series: Series[];
  values: number[][];
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{categoryLabel}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((c, i) => (
            <tr key={c}>
              <th scope="row">{c}</th>
              {series.map((s, si) => (
                <td key={s.key}>{formatPKR(values[i]?.[si] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Axis maximum that divides evenly by the gridline count, so every tick label
 * is a round number. Picking a "nice" max alone isn't enough: 5M across four
 * gridlines prints 3.8M and 1.3M.
 */
function niceMax(value: number, divisions = 4) {
  if (value <= 0) return divisions;
  const rough = value / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return step * magnitude * divisions;
}

/* ---------------------------------------------------------------------------
   Grouped bar chart — magnitude comparison across a time axis.
   CSS-driven so it reflows at any width without measuring the container.
--------------------------------------------------------------------------- */

export interface GroupedBarChartProps {
  data: { label: string; values: number[] }[];
  series: Series[];
  caption: string;
  /** Rows are dropped from the left on narrow screens rather than squashed. */
  className?: string;
  height?: number;
}

export function GroupedBarChart({ data, series, caption, className, height = 240 }: GroupedBarChartProps) {
  const [active, setActive] = React.useState<number | null>(null);

  const max = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className={cn("space-y-4", className)}>
      <Legend series={series} />

      <div className="flex gap-3">
        {/* Y axis */}
        <div
          className="flex shrink-0 flex-col justify-between py-0 text-right text-2xs tabular text-subtle"
          style={{ height }}
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:-translate-y-full">
              {formatCompactPKR(max * t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {/* Plot */}
          <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
            {/* Recessive gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className={cn("h-px w-full", t === 0 ? "bg-border-strong" : "bg-chart-grid")} />
              ))}
            </div>

            <div className="relative flex h-full items-end gap-1 sm:gap-2">
              {data.map((d, i) => (
                <div
                  key={d.label}
                  className="group relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm transition-colors duration-150 hover:bg-muted/60"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${series
                    .map((s, si) => `${s.label} ${formatPKR(d.values[si] ?? 0)}`)
                    .join(", ")}`}
                >
                  {series.map((s, si) => {
                    const value = d.values[si] ?? 0;
                    const pct = max > 0 ? (value / max) * 100 : 0;
                    return (
                      <span
                        key={s.key}
                        className={cn(
                          "w-full max-w-[18px] origin-bottom rounded-t-[4px] animate-grow-y",
                          s.color,
                          active !== null && active !== i && "opacity-40",
                          "transition-opacity duration-150"
                        )}
                        style={{ height: `${Math.max(pct, value > 0 ? 1.5 : 0)}%` }}
                      />
                    );
                  })}

                  {active === i && (
                    <div
                      className={cn(
                        "pointer-events-none absolute bottom-full z-20 mb-2 w-max min-w-[9rem] rounded-md border border-border bg-card p-2.5 shadow-pop animate-fade-in",
                        i > data.length - 3 ? "right-0" : i < 2 ? "left-0" : "left-1/2 -translate-x-1/2"
                      )}
                    >
                      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        {d.label}
                      </p>
                      <ul className="space-y-1">
                        {series.map((s, si) => (
                          <li key={s.key} className="flex items-center justify-between gap-4 text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className={cn("size-2 rounded-[2px]", s.color)} />
                              {s.label}
                            </span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {formatPKR(d.values[si] ?? 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* X axis */}
          <div className="mt-2 flex gap-1 sm:gap-2" aria-hidden="true">
            {data.map((d, i) => (
              <span
                key={d.label}
                className={cn(
                  "flex-1 text-center text-2xs tabular transition-colors duration-150",
                  active === i ? "font-semibold text-foreground" : "text-subtle"
                )}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <DataTableFallback
        caption={caption}
        categoryLabel="Month"
        categories={data.map((d) => d.label)}
        series={series}
        values={data.map((d) => d.values)}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Trend chart — one measure over time, area + line + crosshair.
   The SVG scales non-uniformly; the stroke is pinned with vector-effect and
   the markers are HTML positioned in percentages, so nothing distorts.
--------------------------------------------------------------------------- */

export interface TrendChartProps {
  data: { label: string; value: number }[];
  caption: string;
  /** Series colour as Tailwind classes for the stroke and fill. */
  tone?: "brand" | "expense";
  height?: number;
  className?: string;
}

export function TrendChart({ data, caption, tone = "brand", height = 200, className }: TrendChartProps) {
  const [active, setActive] = React.useState<number | null>(null);

  const values = data.map((d) => d.value);
  const rawMax = Math.max(0, ...values);
  const rawMin = Math.min(0, ...values);
  const max = niceMax(rawMax || 1);
  const min = rawMin < 0 ? -niceMax(Math.abs(rawMin)) : 0;
  const span = max - min || 1;

  const W = 100;
  const H = 100;
  const x = (i: number) => (data.length <= 1 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v: number) => H - ((v - min) / span) * H;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(d.value).toFixed(2)}`).join(" ");
  const area = `${line} L${W},${y(min)} L0,${y(min)} Z`;
  const zeroY = y(0);

  const stroke = tone === "brand" ? "stroke-chart-1" : "stroke-chart-2";
  const fill = tone === "brand" ? "text-chart-1" : "text-chart-2";
  const dot = tone === "brand" ? "bg-chart-1" : "bg-chart-2";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-3">
        <div
          className="flex shrink-0 flex-col justify-between text-right text-2xs tabular text-subtle"
          style={{ height }}
          aria-hidden="true"
        >
          <span>{formatCompactPKR(max)}</span>
          <span>{formatCompactPKR(min + span / 2)}</span>
          <span>{formatCompactPKR(min)}</span>
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }} onMouseLeave={() => setActive(null)}>
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            <span className="h-px w-full bg-chart-grid" />
            <span className="h-px w-full bg-chart-grid" />
            <span className="h-px w-full bg-border-strong" />
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`trend-fill-${tone}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#trend-fill-${tone})`} className={fill} />
            {min < 0 && (
              <line x1="0" y1={zeroY} x2={W} y2={zeroY} className="stroke-border-strong" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            )}
            <path
              d={line}
              fill="none"
              className={stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Markers + hit targets, positioned in percentages so they stay round. */}
          {data.map((d, i) => (
            <button
              key={d.label}
              type="button"
              className="absolute top-0 h-full -translate-x-1/2 focus-visible:outline-none"
              style={{ left: `${x(i)}%`, width: `${Math.max(100 / data.length, 8)}%` }}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${d.label}: ${formatPKR(d.value)}`}
            >
              <span
                className={cn(
                  "absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card transition-[opacity,transform] duration-150",
                  dot,
                  active === i ? "scale-125 opacity-100" : "opacity-0"
                )}
                style={{ top: `${y(d.value)}%` }}
              />
              {active === i && (
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border-strong" aria-hidden="true" />
              )}
            </button>
          ))}

          {active !== null && (
            <div
              className={cn(
                "pointer-events-none absolute z-20 w-max rounded-md border border-border bg-card px-2.5 py-2 shadow-pop animate-fade-in",
                active > data.length - 3 ? "-translate-x-full" : active < 2 ? "" : "-translate-x-1/2"
              )}
              style={{ left: `${x(active)}%`, top: 0 }}
            >
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {data[active].label}
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {formatPKR(data[active].value)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="ml-[3.25rem] flex" aria-hidden="true">
        {data.map((d, i) => (
          <span
            key={d.label}
            className={cn(
              "flex-1 text-center text-2xs tabular transition-colors duration-150",
              active === i ? "font-semibold text-foreground" : "text-subtle"
            )}
          >
            {d.label}
          </span>
        ))}
      </div>

      {/* sr-only lives on the wrapper, not the table — see DataTableFallback. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{formatPKR(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Breakdown bars — share of a whole, one row per entity.
   Always direct-labelled, which is what lets slots 4/5 of the palette sit in
   the tritan floor band.
--------------------------------------------------------------------------- */

export interface BreakdownItem {
  label: string;
  value: number;
  percentage: number;
}

const BREAKDOWN_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const;

export function BreakdownBars({
  items,
  className,
  valueFormatter = formatPKR,
}: {
  items: BreakdownItem[];
  className?: string;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <ul className={cn("space-y-3.5", className)}>
      {items.map((item, i) => (
        <li key={item.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn("size-2 shrink-0 rounded-[2px]", BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length])}
                aria-hidden="true"
              />
              <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {valueFormatter(item.value)}
              </span>
              <span className="w-10 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                {item.percentage}%
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full origin-left rounded-full animate-grow-x", BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length])}
              style={{ width: `${Math.min(100, Math.max(item.percentage, 1))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
