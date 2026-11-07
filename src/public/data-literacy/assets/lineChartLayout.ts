import * as d3 from 'd3';

export type LinePoint = [number, number | null];

export interface LineSeries {
  name: string;
  points: LinePoint[];
}

export interface LineChartData {
  title: string;
  yLabel: string;
  xLabel?: string;
  scale: 'log' | 'linear';
  /** Fixed y domain for linear charts, e.g. [0, 100] for percentages. */
  yDomain?: [number, number];
  /** Suffix for linear tick labels, e.g. '%'. */
  unit?: string;
  /** The first series is drawn in black as the overall line; the rest get the accent colors. */
  series: LineSeries[];
  note?: string[];
}

export const LINE_WIDTH = 1900;
export const LINE_HEIGHT = 1160;
export const PLOT = {
  left: 180, right: 1870, top: 90, bottom: 1015,
};
export const SERIES_COLORS = ['#000000', '#3b7d23', '#d7191c', '#8e71e2'];
export const LABEL_FONT_SIZE = 34;
const TREND_POINTS = 8;
const BAND_FRACTION = 0.05;

type Pixel = [number, number];

export interface TrendLayout {
  /** Dashed projection from the last data point. */
  line: Pixel[];
  /** Shaded band around the projection, as a closed polygon. */
  band: Pixel[];
}

export interface SeriesLayout {
  name: string;
  color: string;
  /** Runs of consecutive data points; gaps in the data split the line. */
  segments: Pixel[][];
  trend: TrendLayout | null;
  label: { x: number; y: number };
}

export interface Tick {
  value: number;
  position: number;
  /** For log charts: the power of ten, drawn as 10 with a superscript. */
  exponent?: number;
  text?: string;
}

export interface LineChartLayout {
  series: SeriesLayout[];
  yTicks: Tick[];
  xTicks: Tick[];
}

/** Least-squares slope and intercept of y on x. */
export function linearFit(points: [number, number][]): { slope: number; intercept: number } {
  const n = points.length;
  const meanX = d3.mean(points, (p) => p[0]) ?? 0;
  const meanY = d3.mean(points, (p) => p[1]) ?? 0;
  const sxx = d3.sum(points, (p) => (p[0] - meanX) ** 2);
  const slope = n > 1 && sxx > 0 ? d3.sum(points, (p) => (p[0] - meanX) * (p[1] - meanY)) / sxx : 0;
  return { slope, intercept: meanY - slope * meanX };
}

/** Values of the projection from the last data point to `end`, following the fitted trend of the last points. */
export function projectTrend(
  points: LinePoint[],
  end: number,
  log: boolean,
  steps = 20,
): { x: number; y: number }[] {
  const known = points.filter((p): p is [number, number] => p[1] != null && (!log || p[1] > 0));
  if (known.length < 2) return [];
  const recent = known.slice(-TREND_POINTS).map(([x, y]) => [x, log ? Math.log10(y) : y] as [number, number]);
  const { slope } = linearFit(recent);
  const [x0, y0] = known[known.length - 1];
  const start = log ? Math.log10(y0) : y0;
  return d3.range(steps + 1).map((i) => {
    const x = x0 + ((end - x0) * i) / steps;
    const value = start + slope * (x - x0);
    return { x, y: log ? 10 ** value : value };
  });
}

/**
 * A log domain padded a little beyond the data, so no whole empty decade is left at either end, then
 * widened to the nearest powers of ten until it holds at least three, so the axis reads as logarithmic.
 */
function niceLogDomain(values: number[]): [number, number] {
  let lo = Math.log10(d3.min(values) ?? 1);
  let hi = Math.log10(d3.max(values) ?? 10);
  const pad = Math.max(0.12, (hi - lo) * 0.06);
  lo -= pad;
  hi += pad;
  while (Math.floor(hi) - Math.ceil(lo) + 1 < 3) {
    const below = lo - Math.floor(lo);
    const above = Math.ceil(hi) - hi;
    if (below <= above || above === 0) lo = Math.floor(lo === Math.floor(lo) ? lo - 1 : lo);
    else hi = Math.ceil(hi);
  }
  return [10 ** lo, 10 ** hi];
}

function chooseXTicks(domain: [number, number]): number[] {
  const span = domain[1] - domain[0];
  const step = span > 30 ? 10 : span > 12 ? 5 : 2;
  return d3.range(Math.ceil(domain[0] / step) * step, domain[1] + 1e-9, step);
}

interface Box { x0: number; y0: number; x1: number; y1: number }

function distanceToSegment([px, py]: Pixel, [ax, ay]: Pixel, [bx, by]: Pixel) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Smallest distance from a box to any of the polylines (0 if it overlaps one). */
function clearance(box: Box, polylines: Pixel[][]) {
  let best = Infinity;
  const corners: Pixel[] = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1], [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2]];
  polylines.forEach((line) => {
    for (let i = 1; i < line.length; i += 1) {
      const [a, b] = [line[i - 1], line[i]];
      const crossesX = Math.max(a[0], b[0]) >= box.x0 && Math.min(a[0], b[0]) <= box.x1;
      const crossesY = Math.max(a[1], b[1]) >= box.y0 && Math.min(a[1], b[1]) <= box.y1;
      if (crossesX && crossesY) {
        // Sample the segment to see whether it actually enters the box.
        for (let s = 0; s <= 10; s += 1) {
          const x = a[0] + ((b[0] - a[0]) * s) / 10;
          const y = a[1] + ((b[1] - a[1]) * s) / 10;
          if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) return 0;
        }
      }
      corners.forEach((corner) => { best = Math.min(best, distanceToSegment(corner, a, b)); });
    }
  });
  return best;
}

export function labelWidth(text: string) {
  return text.length * LABEL_FONT_SIZE * 0.62;
}

export function computeLineChart(data: LineChartData): LineChartLayout {
  const log = data.scale === 'log';
  const allPoints = data.series.flatMap((s) => s.points.filter((p): p is [number, number] => p[1] != null));
  const xMin = d3.min(allPoints, (p) => p[0]) ?? 0;
  const xMax = d3.max(allPoints, (p) => p[0]) ?? 1;
  const projectTo = Math.ceil(xMax + Math.max(3, (xMax - xMin) * 0.4));

  const trends = data.series.map((s) => projectTrend(s.points, projectTo, log));
  const trendValues = trends.flat().map((p) => p.y);
  const values = [...allPoints.map((p) => p[1]), ...trendValues].filter((v) => !log || v > 0);
  const yDomain: [number, number] = data.yDomain
    ?? (log ? niceLogDomain(values) : (d3.scaleLinear().domain(d3.extent(values) as [number, number]).nice().domain() as [number, number]));
  const y = (log ? d3.scaleLog() : d3.scaleLinear()).domain(yDomain).range([PLOT.bottom - 20, PLOT.top + 20]);
  const x = d3.scaleLinear().domain([xMin - 0.3, projectTo]).range([PLOT.left + 20, PLOT.right - 20]);
  const clampY = (v: number) => Math.min(PLOT.bottom, Math.max(PLOT.top, y(v)));

  // The band widens linearly to a fixed fraction of the axis height at the end of the projection.
  const bandHalf = BAND_FRACTION * (log ? Math.log10(yDomain[1] / yDomain[0]) : yDomain[1] - yDomain[0]);
  const shift = (v: number, amount: number) => (log ? v * 10 ** amount : v + amount);

  const seriesLayouts = data.series.map((s, i) => {
    const segments: Pixel[][] = [];
    let current: Pixel[] = [];
    s.points.forEach(([px, py]) => {
      if (py == null || (log && py <= 0)) {
        if (current.length) segments.push(current);
        current = [];
      } else current.push([x(px), clampY(py)]);
    });
    if (current.length) segments.push(current);

    const trendPoints = trends[i];
    let trend: TrendLayout | null = null;
    if (trendPoints.length) {
      const x0 = trendPoints[0].x;
      const width = (px: number) => (bandHalf * (px - x0)) / (projectTo - x0);
      const upper = trendPoints.map((p): Pixel => [x(p.x), clampY(shift(p.y, width(p.x)))]);
      const lower = trendPoints.map((p): Pixel => [x(p.x), clampY(shift(p.y, -width(p.x)))]);
      trend = {
        line: trendPoints.map((p): Pixel => [x(p.x), clampY(p.y)]),
        band: [...upper, ...lower.reverse()],
      };
    }
    return {
      name: s.name, color: SERIES_COLORS[i % SERIES_COLORS.length], segments, trend, label: { x: 0, y: 0 },
    };
  });

  // Place each label just above or below its own line, clear of every line, keeping it as close to its own as possible.
  const obstacles = seriesLayouts.flatMap((s) => [...s.segments, ...(s.trend ? [s.trend.line] : [])]);
  const placed: Box[] = [];
  seriesLayouts.forEach((s, seriesIndex) => {
    const others = seriesLayouts.filter((_, j) => j !== seriesIndex).flatMap((o) => o.segments);
    const width = labelWidth(s.name);
    const own = s.segments.flat();
    const ownLine = (cx: number) => {
      // The line's height at cx, interpolated between its points.
      const after = own.findIndex(([px]) => px >= cx);
      if (after <= 0) return own[Math.max(after, 0)]?.[1] ?? 0;
      const [ax, ay] = own[after - 1];
      const [bx, by] = own[after];
      return ay + ((by - ay) * (cx - ax)) / (bx - ax || 1);
    };
    let best: { score: number; x: number; y: number } | null = null;
    const first = own[0]?.[0] ?? PLOT.left;
    const last = own[own.length - 1]?.[0] ?? PLOT.right;
    d3.range(0, 21).forEach((step) => {
      const cx = Math.min(Math.max(first + ((last - first) * step) / 20, PLOT.left + 30 + width / 2), x(xMax) - width / 2);
      // Highest and lowest points of the line under the label, so the label clears the whole span.
      const under = d3.range(0, 9).map((k) => ownLine(cx - width / 2 + (width * k) / 8));
      const top = Math.min(...under);
      const bottom = Math.max(...under);
      [-1, 1].forEach((side) => {
        [22, 40, 65, 95].forEach((gap) => {
          const cy = side < 0 ? top - gap : bottom + gap + LABEL_FONT_SIZE * 0.75;
          const box: Box = {
            x0: cx - width / 2, x1: cx + width / 2, y0: cy - LABEL_FONT_SIZE * 0.75, y1: cy + LABEL_FONT_SIZE * 0.25,
          };
          if (box.y0 < PLOT.top || box.y1 > PLOT.bottom - 10) return;
          if (placed.some((p) => p.x0 < box.x1 + 10 && box.x0 - 10 < p.x1 && p.y0 < box.y1 + 6 && box.y0 - 6 < p.y1)) return;
          const free = clearance(box, obstacles);
          if (free < 8) return;
          // A label must sit clearly nearer its own line than any other, or readers attach it to the wrong one.
          const toOwn = clearance(box, s.segments);
          const toOther = clearance(box, others);
          if (toOther < toOwn * 1.6 + 15) return;
          // Prefer labels close to their own line, then ones with room around them.
          const score = Math.min(free, 60) - gap * 1.2;
          if (!best || score > best.score) best = { score, x: cx, y: cy };
        });
      });
    });
    const chosen = best as { x: number; y: number } | null;
    const fallback = own[Math.floor(own.length / 2)] ?? [PLOT.left + 100, PLOT.top + 60];
    const label = chosen ?? { x: fallback[0], y: fallback[1] - 55 };
    s.label = label;
    placed.push({
      x0: label.x - width / 2, x1: label.x + width / 2, y0: label.y - LABEL_FONT_SIZE, y1: label.y + 8,
    });
  });

  const powers = d3.range(Math.ceil(Math.log10(yDomain[0])), Math.floor(Math.log10(yDomain[1])) + 1);
  const yTicks: Tick[] = log
    ? powers.map((exponent) => ({ value: 10 ** exponent, position: y(10 ** exponent), exponent }))
    : y.ticks(6).map((value) => ({ value, position: y(value), text: `${value}${data.unit ?? ''}` }));
  const xTicks: Tick[] = chooseXTicks(x.domain() as [number, number])
    .map((value) => ({ value, position: x(value), text: String(value) }));

  return { series: seriesLayouts, yTicks, xTicks };
}
