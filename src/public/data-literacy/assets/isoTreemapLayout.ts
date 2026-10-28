import * as d3 from 'd3';

export interface IsoTreemapLeaf {
  name: string;
  value: number;
  change: number;
}

export interface IsoTreemapBranch {
  name: string;
  /** Text drawn on the side of the slab; defaults to name. */
  label?: string;
  /** Outline this group on the slab and add a tab with its label (like "Cancer"). */
  highlight?: boolean;
  children: IsoTreemapNode[];
}

export type IsoTreemapNode = IsoTreemapLeaf | IsoTreemapBranch;

export interface IsoTreemapCategory extends IsoTreemapBranch {
  /** Colors from lowest to highest change, one per legend bin. */
  palette: string[];
  /** Text for the legend row; defaults to label, then name. */
  legendLabel?: string;
}

export interface IsoTreemapAnnotation {
  /** Name of the node the leader line points to. */
  target: string;
  text: string[];
  /** Left edge and first baseline of the text block. */
  x: number;
  y: number;
  /** Points the leader line passes through between the text and the target. */
  elbows?: Point[];
  /** Overrides the target node's centroid as the end of the leader line. */
  targetPoint?: Point;
}

export interface IsoTreemapData {
  title: string;
  legendTitle: string;
  colorDomain: [number, number];
  unit?: string;
  /** Where the figures came from; not rendered. */
  source?: string;
  categories: IsoTreemapCategory[];
  annotations?: IsoTreemapAnnotation[];
}

export type Point = [number, number];
export type Face = 'left' | 'right';

export const WIDTH = 2000;
export const SIDE = 1114;
export const SLAB = 200;
export const SHADOW_DROP = 325;
export const ORIGIN = { x: 1010, y: 25 };
export const ANNOTATION_LINE_HEIGHT = 37;
export const LEGEND_TOP = 1555;
export const LEGEND_ROW_HEIGHT = 37;

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const EPSILON = 0.5;

/** Maps a point on the square treemap (u along the top-right edge, v along the top-left edge) onto the isometric top face. */
export function projectTop(u: number, v: number): Point {
  return [ORIGIN.x + (u - v) * COS, ORIGIN.y + (u + v) * SIN];
}

const LEFT_CORNER = projectTop(0, SIDE);
const FRONT_CORNER = projectTop(SIDE, SIDE);

export const TOP_TRANSFORM = `matrix(${COS} ${SIN} ${-COS} ${SIN} ${ORIGIN.x} ${ORIGIN.y})`;
// Side faces are drawn in (distance along the edge, depth) coordinates so text reads left to right.
export const LEFT_FACE_TRANSFORM = `matrix(${COS} ${SIN} 0 1 ${LEFT_CORNER[0]} ${LEFT_CORNER[1]})`;
export const RIGHT_FACE_TRANSFORM = `matrix(${COS} ${-SIN} 0 1 ${FRONT_CORNER[0]} ${FRONT_CORNER[1]})`;

export function shadowPoints(): Point[] {
  return [projectTop(0, 0), projectTop(SIDE, 0), projectTop(SIDE, SIDE), projectTop(0, SIDE)]
    .map(([x, y]) => [x, y + SHADOW_DROP]);
}

export function isLeaf(node: IsoTreemapNode): node is IsoTreemapLeaf {
  return !('children' in node);
}

export function colorFor(palette: string[], domain: [number, number], value: number) {
  return d3.scaleQuantize<string>().domain(domain).range(palette)(value);
}

export function faceShade(color: string, face: Face) {
  const shade = d3.hsl(color);
  shade.l *= face === 'left' ? 0.82 : 0.72;
  return shade.formatHex();
}

export interface LabelFit {
  lines: string[];
  fontSize: number;
  /** Text runs along the v axis (reading up and to the right) instead of the u axis. */
  vertical: boolean;
}

interface FitOptions {
  minFontSize?: number;
  maxFontSize?: number;
  charWidth?: number;
  lineHeight?: number;
  maxLines?: number;
}

/** Splits words into at most `count` lines, minimizing the longest line. */
export function balanceLines(words: string[], count: number): string[] {
  if (count <= 1 || words.length <= 1) return [words.join(' ')];
  let best = [words.join(' ')];
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const lines = [words.slice(0, i).join(' '), ...balanceLines(words.slice(i), count - 1)];
    const width = Math.max(...lines.map((line) => line.length));
    if (width < bestWidth) {
      best = lines;
      bestWidth = width;
    }
  }
  return best;
}

/** Finds the largest font size, orientation and line wrapping that fits text in a width x height cell. */
export function fitLabel(text: string, width: number, height: number, {
  minFontSize = 11, maxFontSize = 56, charWidth = 0.56, lineHeight = 1.1, maxLines = 3,
}: FitOptions = {}): LabelFit | null {
  const words = text.split(/\s+/).filter(Boolean);
  let best: LabelFit | null = null;
  for (let orientation = 0; orientation < 2; orientation += 1) {
    const vertical = orientation === 1;
    const along = (vertical ? height : width) * 0.88;
    const across = (vertical ? width : height) * 0.8;
    for (let count = 1; count <= Math.min(maxLines, words.length); count += 1) {
      const lines = balanceLines(words, count);
      const longest = Math.max(...lines.map((line) => line.length));
      const fontSize = Math.min(maxFontSize, along / (longest * charWidth), across / (lines.length * lineHeight));
      // Prefer horizontal, single-line labels unless another layout is clearly larger.
      if (fontSize >= minFontSize && (!best || fontSize > best.fontSize + 0.5)) {
        best = { lines, fontSize, vertical };
      }
    }
  }
  return best;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LeafCell extends Rect {
  id: string;
  name: string;
  color: string;
  label: LabelFit | null;
}

export interface FaceSegment {
  id: string;
  start: number;
  end: number;
  color: string;
}

export interface FaceExtent {
  face: Face;
  start: number;
  end: number;
}

export interface CategoryLabel extends FaceExtent {
  name: string;
  fit: LabelFit;
}

export interface Highlight extends Rect {
  name: string;
  label: string;
  side: FaceExtent | null;
}

export interface LegendRow {
  name: string;
  label: string;
  palette: string[];
}

export interface ResolvedAnnotation {
  id: string;
  text: string[];
  x: number;
  y: number;
  points: Point[];
}

export interface IsoTreemapLayout {
  leaves: LeafCell[];
  leftFace: FaceSegment[];
  rightFace: FaceSegment[];
  categoryLabels: CategoryLabel[];
  highlights: Highlight[];
  legend: LegendRow[];
  annotations: ResolvedAnnotation[];
  height: number;
}

/** Returns the longest stretch of the visible side faces the rectangle touches, if any. */
export function sideExtent({
  x0, y0, x1, y1,
}: Rect): FaceExtent | null {
  const left: FaceExtent | null = y1 >= SIDE - EPSILON ? { face: 'left', start: x0, end: x1 } : null;
  const right: FaceExtent | null = x1 >= SIDE - EPSILON ? { face: 'right', start: SIDE - y1, end: SIDE - y0 } : null;
  if (left && right) return left.end - left.start > right.end - right.start ? left : right;
  return left || right;
}

function resolveAnnotation(
  annotation: IsoTreemapAnnotation,
  index: number,
  nodes: Map<string, Rect>,
): ResolvedAnnotation | null {
  const node = nodes.get(annotation.target);
  if (!node && !annotation.targetPoint) return null;
  const target = annotation.targetPoint
    ?? projectTop(((node as Rect).x0 + (node as Rect).x1) / 2, ((node as Rect).y0 + (node as Rect).y1) / 2);
  const textTop = annotation.y - 28;
  const textBottom = annotation.y + (annotation.text.length - 1) * ANNOTATION_LINE_HEIGHT + 10;
  const targetAbove = target[1] < annotation.y;
  const lineX = annotation.x - 22;
  const start: Point = [lineX, targetAbove ? textBottom : textTop];
  const elbows = annotation.elbows ?? [[lineX, targetAbove ? textTop - 40 : textBottom + 40]];
  return {
    id: `${annotation.target}-${index}`,
    text: annotation.text,
    x: annotation.x,
    y: annotation.y,
    points: [start, ...elbows, target],
  };
}

export function computeIsoTreemap(data: IsoTreemapData): IsoTreemapLayout {
  const rootDatum: IsoTreemapBranch = { name: 'root', children: data.categories };
  const root = d3.hierarchy<IsoTreemapNode>(rootDatum, (d) => (isLeaf(d) ? undefined : d.children))
    .sum((d) => (isLeaf(d) ? d.value : 0))
    // Categories keep their data order so the dataset controls where each block sits on the slab.
    .sort((a, b) => (a.depth === 1 ? 0 : (b.value ?? 0) - (a.value ?? 0)));
  const treemap = d3.treemap<IsoTreemapNode>().size([SIDE, SIDE]).tile(d3.treemapSquarify)(root);

  const leaves: LeafCell[] = treemap.leaves().map((node, i) => {
    const category = node.ancestors().find((ancestor) => ancestor.depth === 1)?.data as IsoTreemapCategory;
    const datum = node.data as IsoTreemapLeaf;
    return {
      id: `${category.name}-${datum.name}-${i}`,
      name: datum.name,
      x0: node.x0,
      y0: node.y0,
      x1: node.x1,
      y1: node.y1,
      color: colorFor(category.palette, data.colorDomain, datum.change),
      label: fitLabel(datum.name, node.x1 - node.x0, node.y1 - node.y0),
    };
  });

  const leftFace: FaceSegment[] = [];
  const rightFace: FaceSegment[] = [];
  leaves.forEach((leaf) => {
    if (leaf.y1 >= SIDE - EPSILON) {
      leftFace.push({
        id: leaf.id, start: leaf.x0, end: leaf.x1, color: faceShade(leaf.color, 'left'),
      });
    }
    if (leaf.x1 >= SIDE - EPSILON) {
      rightFace.push({
        id: leaf.id, start: SIDE - leaf.y1, end: SIDE - leaf.y0, color: faceShade(leaf.color, 'right'),
      });
    }
  });

  const categoryLabels: CategoryLabel[] = (treemap.children ?? []).flatMap((node) => {
    const category = node.data as IsoTreemapCategory;
    const extent = sideExtent(node);
    if (!extent) return [];
    const fit = fitLabel((category.label ?? category.name).toUpperCase(), extent.end - extent.start, SLAB, {
      minFontSize: 14, maxFontSize: 42, charWidth: 0.78, lineHeight: 1.15, maxLines: 2,
    });
    return fit && !fit.vertical ? [{ ...extent, name: category.name, fit }] : [];
  });

  const highlights: Highlight[] = treemap.descendants()
    .filter((node) => !isLeaf(node.data) && (node.data as IsoTreemapBranch).highlight)
    .map((node) => {
      const branch = node.data as IsoTreemapBranch;
      return {
        name: branch.name,
        label: (branch.label ?? branch.name).toUpperCase(),
        x0: node.x0,
        y0: node.y0,
        x1: node.x1,
        y1: node.y1,
        side: sideExtent(node),
      };
    });

  const nodesByName = new Map<string, Rect>();
  treemap.descendants().forEach((node) => {
    if (!nodesByName.has(node.data.name)) nodesByName.set(node.data.name, node);
  });
  const annotations = (data.annotations ?? [])
    .map((annotation, i) => resolveAnnotation(annotation, i, nodesByName))
    .filter((annotation): annotation is ResolvedAnnotation => annotation !== null);

  const legend = data.categories.map((category) => ({
    name: category.name,
    label: (category.legendLabel ?? category.label ?? category.name).toUpperCase(),
    palette: category.palette,
  }));

  return {
    leaves,
    leftFace,
    rightFace,
    categoryLabels,
    highlights,
    legend,
    annotations,
    height: LEGEND_TOP + 25 + legend.length * LEGEND_ROW_HEIGHT + 70,
  };
}
