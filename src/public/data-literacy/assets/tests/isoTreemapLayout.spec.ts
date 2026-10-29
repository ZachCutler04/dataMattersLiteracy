import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  annotationBox, backTabFor, balanceLines, cellOutlines, centeredDomain, HIGHLIGHT_TAB, colorFor, computeIsoTreemap, edgeTarget, faceShade, fitLabel,
  IsoTreemapData, lengthInside, ORIGIN, Point, projectTop, SIDE, sideExtent, slabSilhouette, SLAB,
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

describe('centeredDomain', () => {
  it('centers the color scale on 0', () => {
    expect(centeredDomain([-6, 18])).toEqual([-18, 18]);
    expect(centeredDomain([-20, 10])).toEqual([-20, 20]);
    expect(centeredDomain([-3, 3])).toEqual([-3, 3]);
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

describe('edgeTarget', () => {
  const cell = {
    x0: 100, y0: 100, x1: 300, y1: 300,
  };

  it('ends just inside the edge nearest the approaching line, not at the centroid', () => {
    const centroid = projectTop(200, 200);
    const from: Point = [projectTop(300, 100)[0] + 400, projectTop(300, 100)[1]];
    const end = edgeTarget(cell, from, 10);
    const [outline] = cellOutlines(cell);
    const nearestCorner = Math.min(...outline.map(([x, y]) => Math.hypot(x - end[0], y - end[1])));
    expect(Math.hypot(end[0] - centroid[0], end[1] - centroid[1])).toBeGreaterThan(50);
    expect(nearestCorner).toBeLessThan(20);
  });

  it('can end on the side face of a cell at the front of the slab', () => {
    const front = {
      x0: 100, y0: 900, x1: 300, y1: SIDE,
    };
    expect(cellOutlines(front)).toHaveLength(2);
    const below: Point = [projectTop(200, SIDE)[0], projectTop(200, SIDE)[1] + SLAB + 300];
    const end = edgeTarget(front, below, 10);
    expect(end[1]).toBeGreaterThan(projectTop(200, SIDE)[1]);
  });
});

describe('lengthInside', () => {
  const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it('measures the part of a segment inside a convex polygon', () => {
    expect(lengthInside([-5, 5], [15, 5], square)).toBeCloseTo(10);
    expect(lengthInside([5, 5], [15, 5], square)).toBeCloseTo(5);
    expect(lengthInside([-5, -5], [-1, 20], square)).toBe(0);
  });
});

describe('leader line routing', () => {
  // Total length of a route that runs over cells other than its target.
  const overOtherCells = (points: Point[], target: { x0: number, y0: number, x1: number, y1: number }) => {
    const silhouette = slabSilhouette();
    const outlines = cellOutlines(target);
    return points.slice(1).reduce((sum, point, i) => sum + lengthInside(points[i], point, silhouette)
      - outlines.reduce((inside, outline) => inside + lengthInside(points[i], point, outline), 0), 0);
  };

  it('reaches cells on the edge of the slab without crossing other cells', () => {
    const layout = computeIsoTreemap({
      ...data,
      annotations: [{
        target: 'Alpha', text: ['Note'], x: 1580, y: 1245,
      }],
    });
    const alpha = layout.leaves.find((leaf) => leaf.name === 'Alpha');
    const { points } = layout.annotations[0];
    expect(overOtherCells(points, alpha as NonNullable<typeof alpha>)).toBeLessThan(1);
  });

  it('places notes without a position in distinct open slots', () => {
    const layout = computeIsoTreemap({
      ...data,
      annotations: [
        { target: 'Alpha', text: ['First'] },
        { target: 'Gamma', text: ['Second'] },
        { target: 'Beta', text: ['Fixed'], x: 70, y: 210 },
      ],
    });
    const positions = layout.annotations.map(({ x, y }) => `${x},${y}`);
    expect(layout.annotations).toHaveLength(3);
    expect(new Set(positions).size).toBe(3);
    // The hand-placed note keeps its spot and no automatic note is put on top of it.
    expect(layout.annotations[2]).toMatchObject({ x: 70, y: 210 });
    expect(positions.slice(0, 2)).not.toContain('70,210');
  });

  it('keeps lines off other annotations', () => {
    const layout = computeIsoTreemap({
      ...data,
      annotations: [
        { target: 'Alpha', text: ['First note'], x: 70, y: 1430 },
        { target: 'Beta', text: ['Second note in the way'], x: 505, y: 1430 },
      ],
    });
    const box = annotationBox({ text: ['Second note in the way'], x: 505, y: 1430 });
    const { points } = layout.annotations[0];
    const overBox = points.slice(1).reduce((sum, point, i) => sum + lengthInside(points[i], point, [
      [box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]), 0);
    expect(overBox).toBe(0);
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

  it('hangs back-of-slab highlight labels outside the slab, off the cells', () => {
    // East Asia sits at the back of the geography slab, away from both side faces.
    const geography = JSON.parse(readFileSync('public/data-literacy/assets/treemaps/geography.json', 'utf8'));
    geography.categories[0].children.find((child: { name: string }) => child.name === 'East Asia').highlight = true;
    const layout = computeIsoTreemap(geography);
    const [highlight] = layout.highlights;
    expect(highlight.side).toBeNull();
    const tab = highlight.backTab as NonNullable<typeof highlight.backTab>;
    // Entirely beyond a back edge, so it covers no part of the treemap square.
    expect(tab.y1 <= 0 || tab.x1 <= 0).toBe(true);
  });

  it('only puts a back tab where a group touches a back edge', () => {
    expect(backTabFor({
      x0: 100, y0: 0, x1: 400, y1: 200,
    })).toMatchObject({ y0: -HIGHLIGHT_TAB, y1: 0, vertical: false });
    expect(backTabFor({
      x0: 0, y0: 100, x1: 200, y1: 600,
    })).toMatchObject({ x0: -HIGHLIGHT_TAB, x1: 0, vertical: true });
    expect(backTabFor({
      x0: 100, y0: 100, x1: 200, y1: 200,
    })).toBeNull();
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
