import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  computeLineChart, labelWidth, LineChartData, linearFit, PLOT, projectTrend, SERIES_COLORS,
} from '../lineChartLayout';
import { IsoTreemapData } from '../isoTreemapLayout';

const topic = (name: string): IsoTreemapData => JSON.parse(readFileSync(`public/data-literacy/assets/treemaps/${name}.json`, 'utf8'));

const sample: LineChartData = {
  title: 'Test',
  yLabel: 'Count',
  scale: 'log',
  series: [
    { name: 'All', points: [[2000, 1000], [2001, 1100], [2002, 1210], [2003, 1331]] },
    { name: 'Gap', points: [[2000, 10], [2001, null], [2002, 30], [2003, 40]] },
  ],
};

describe('linearFit', () => {
  it('recovers a straight line', () => {
    const { slope, intercept } = linearFit([[0, 1], [1, 3], [2, 5]]);
    expect(slope).toBeCloseTo(2);
    expect(intercept).toBeCloseTo(1);
  });
});

describe('projectTrend', () => {
  it('continues constant growth on a log scale', () => {
    const projection = projectTrend(sample.series[0].points, 2005, true, 2);
    expect(projection[0].x).toBe(2003);
    expect(projection[0].y).toBeCloseTo(1331);
    expect(projection[2].y).toBeCloseTo(1331 * 1.1 ** 2, 0);
  });

  it('needs at least two known points', () => {
    expect(projectTrend([[2000, 5], [2001, null]], 2005, false)).toEqual([]);
  });
});

describe('computeLineChart', () => {
  const layout = computeLineChart(sample);

  it('draws the overall series in black and splits lines at gaps', () => {
    expect(layout.series[0].color).toBe(SERIES_COLORS[0]);
    expect(layout.series[1].segments.map((segment) => segment.length)).toEqual([1, 2]);
  });

  it('keeps every line, trend and label inside the plot', () => {
    layout.series.forEach((s) => {
      [...s.segments.flat(), ...(s.trend?.band ?? [])].forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(PLOT.left);
        expect(x).toBeLessThanOrEqual(PLOT.right);
        expect(y).toBeGreaterThanOrEqual(PLOT.top);
        expect(y).toBeLessThanOrEqual(PLOT.bottom);
      });
      expect(s.label.x - labelWidth(s.name) / 2).toBeGreaterThanOrEqual(PLOT.left);
    });
  });

  it('labels log axes with powers of ten', () => {
    expect(layout.yTicks.every((tick) => tick.exponent !== undefined || tick.text)).toBe(true);
  });
});

describe('topic line charts', () => {
  ['sports', 'technology', 'geography', 'stocks', 'music'].forEach((name) => {
    it(`${name} has a matching line chart whose labels do not overlap`, () => {
      const { line } = topic(name);
      expect(line?.series.length).toBe(4);
      const chart = computeLineChart(line as LineChartData);
      const boxes = chart.series.map((s) => ({
        x0: s.label.x - labelWidth(s.name) / 2, x1: s.label.x + labelWidth(s.name) / 2, y0: s.label.y - 30, y1: s.label.y + 5,
      }));
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
        expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1).toBe(false);
      }));
    });
  });
});
