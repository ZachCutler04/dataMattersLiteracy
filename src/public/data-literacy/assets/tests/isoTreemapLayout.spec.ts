import { describe, expect, it } from 'vitest';
import {
  balanceLines, colorFor, computeIsoTreemap, faceShade, fitLabel, IsoTreemapData, ORIGIN,
  projectTop, SIDE, sideExtent,
} from '../isoTreemapLayout';

const palette = ['#000001', '#000002', '#000003'];

const data: IsoTreemapData = {
  title: 'Test',
  legendTitle: 'Change',
  colorDomain: [-3, 3],
  categories: [
    {
      name: 'Small first',
      palette,
      children: [{ name: 'Alpha', value: 10, change: -3 }],
    },
    {
      name: 'Big second',
      label: 'Big',
      palette,
      children: [
        { name: 'Beta', value: 40, change: 0 },
        {
          name: 'Group',
          highlight: true,
          children: [
            { name: 'Gamma', value: 20, change: 3 },
            { name: 'Delta', value: 30, change: 1 },
          ],
        },
      ],
    },
  ],
  annotations: [
    {
      target: 'Beta', text: ['Note'], x: 100, y: 1500,
    },
    {
      target: 'Missing', text: ['Dropped'], x: 100, y: 100,
    },
  ],
};

describe('projectTop', () => {
  it('maps the square corners onto an isometric diamond', () => {
    const [topX, topY] = projectTop(0, 0);
    const [leftX, leftY] = projectTop(0, SIDE);
    const [rightX, rightY] = projectTop(SIDE, 0);
    const [frontX, frontY] = projectTop(SIDE, SIDE);
    expect([topX, topY]).toEqual([ORIGIN.x, ORIGIN.y]);
    expect(frontX).toBeCloseTo(ORIGIN.x);
    expect(frontY).toBeCloseTo(ORIGIN.y + SIDE);
    expect(leftY).toBeCloseTo(rightY);
    expect(ORIGIN.x - leftX).toBeCloseTo(rightX - ORIGIN.x);
  });
});

describe('colorFor', () => {
  it('bins values across the domain', () => {
    expect(colorFor(palette, [-3, 3], -3)).toBe('#000001');
    expect(colorFor(palette, [-3, 3], 0)).toBe('#000002');
    expect(colorFor(palette, [-3, 3], 3)).toBe('#000003');
  });
});

describe('faceShade', () => {
  it('darkens the right face more than the left face', () => {
    const left = faceShade('#88cc88', 'left');
    const right = faceShade('#88cc88', 'right');
    expect(left).not.toBe('#88cc88');
    expect(parseInt(right.slice(3, 5), 16)).toBeLessThan(parseInt(left.slice(3, 5), 16));
  });
});

describe('balanceLines', () => {
  it('keeps a single line when one line is requested', () => {
    expect(balanceLines(['a', 'b'], 1)).toEqual(['a b']);
  });

  it('minimizes the longest line', () => {
    expect(balanceLines(['Lower', 'respiratory', 'infections'], 2)).toEqual(['Lower respiratory', 'infections']);
    expect(balanceLines(['Lower', 'respiratory', 'infections'], 3)).toEqual(['Lower', 'respiratory', 'infections']);
  });
});

describe('fitLabel', () => {
  it('runs text along the longer side of the cell', () => {
    expect(fitLabel('Malaria', 300, 60)?.vertical).toBe(false);
    expect(fitLabel('Malaria', 60, 300)?.vertical).toBe(true);
  });

  it('caps the font size and wraps long labels', () => {
    const fit = fitLabel('Lower respiratory infections', 200, 200);
    expect(fit?.lines.length).toBeGreaterThan(1);
    expect(fitLabel('TB', 1000, 1000, { maxFontSize: 40 })?.fontSize).toBe(40);
  });

  it('drops labels that would be too small', () => {
    expect(fitLabel('Pancreatic', 10, 10)).toBeNull();
  });
});

describe('sideExtent', () => {
  it('finds the visible side faces a rectangle touches', () => {
    expect(sideExtent({
      x0: 0, y0: 0, x1: 10, y1: 10,
    })).toBeNull();
    expect(sideExtent({
      x0: 100, y0: 500, x1: 300, y1: SIDE,
    })).toEqual({ face: 'left', start: 100, end: 300 });
    expect(sideExtent({
      x0: 900, y0: 100, x1: SIDE, y1: 200,
    })).toEqual({ face: 'right', start: SIDE - 200, end: SIDE - 100 });
  });
});

describe('computeIsoTreemap', () => {
  const layout = computeIsoTreemap(data);

  it('lays out every leaf and fills the square', () => {
    expect(layout.leaves.map((leaf) => leaf.name).sort()).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
    const area = layout.leaves.reduce((sum, leaf) => sum + (leaf.x1 - leaf.x0) * (leaf.y1 - leaf.y0), 0);
    expect(area).toBeCloseTo(SIDE * SIDE);
  });

  it('keeps categories in data order', () => {
    const alpha = layout.leaves.find((leaf) => leaf.name === 'Alpha');
    expect(alpha?.x0).toBe(0);
    expect(alpha?.y0).toBe(0);
  });

  it('colors leaves by change', () => {
    expect(layout.leaves.find((leaf) => leaf.name === 'Gamma')?.color).toBe('#000003');
    expect(layout.leaves.find((leaf) => leaf.name === 'Alpha')?.color).toBe('#000001');
  });

  it('builds side faces spanning each edge', () => {
    const span = (segments: { start: number, end: number }[]) => segments.reduce((sum, s) => sum + s.end - s.start, 0);
    expect(span(layout.leftFace)).toBeCloseTo(SIDE);
    expect(span(layout.rightFace)).toBeCloseTo(SIDE);
  });

  it('collects highlights, legend rows and resolvable annotations', () => {
    expect(layout.highlights.map((highlight) => highlight.label)).toEqual(['GROUP']);
    expect(layout.legend.map((row) => row.label)).toEqual(['SMALL FIRST', 'BIG']);
    expect(layout.annotations).toHaveLength(1);
    const { points } = layout.annotations[0];
    expect(points[0][0]).toBe(78);
    expect(points[points.length - 1][1]).toBeLessThan(1500);
  });
});
