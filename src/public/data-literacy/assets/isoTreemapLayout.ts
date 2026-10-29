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
  /**
   * Left edge and first baseline of the text block. Leave both out to have the note placed automatically
   * in whichever open area around the slab gives the cleanest leader line.
   */
  x?: number;
  y?: number;
  /** Points the leader line passes through between the text and the target. */
  elbows?: Point[];
  /** Overrides the target node's centroid as the end of the leader line. */
  targetPoint?: Point;
}

export interface IsoTreemapData {
  title: string;
  legendTitle: string;
  /** Range of `change` the colors span; always shown centered on 0. */
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
/** How far inside a cell's outline a leader line stops. */
export const ANNOTATION_INSET = 14;
/** Depth of the blue label tab under a highlighted group. */
export const HIGHLIGHT_TAB = 34;
export const LEGEND_TOP = 1555;
export const LEGEND_ROW_HEIGHT = 37;
/** Left edge of the longest legend row label, which is right-aligned against the swatches. */
const LEGEND_TEXT_LEFT = 150;
/** Area the title and its underline can occupy. */
const TITLE_BOX: Box = [40, 25, 900, 125];

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

/** Widens a color domain so it is centered on 0, as in the original's −3% to 3% scale. */
export function centeredDomain([min, max]: [number, number]): [number, number] {
  const extent = Math.max(Math.abs(min), Math.abs(max));
  return [-extent, extent];
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
  /**
   * For groups that don't reach a side face: a tab in the top face's plane, just outside the slab along
   * the back edge the group touches, so it never covers cells. Null if the group touches neither.
   */
  backTab: (Rect & { vertical: boolean }) | null;
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

/** Screen-space outlines of a cell: its top face plus any side face it shows on the front of the slab. */
export function cellOutlines(rect: Rect): Point[][] {
  const {
    x0, y0, x1, y1,
  } = rect;
  const drop = ([x, y]: Point): Point => [x, y + SLAB];
  const outlines = [[projectTop(x0, y0), projectTop(x1, y0), projectTop(x1, y1), projectTop(x0, y1)]];
  const side = sideExtent(rect);
  if (side?.face === 'left') {
    const a = projectTop(x0, SIDE);
    const b = projectTop(x1, SIDE);
    outlines.push([a, b, drop(b), drop(a)]);
  } else if (side?.face === 'right') {
    const a = projectTop(SIDE, y1);
    const b = projectTop(SIDE, y0);
    outlines.push([a, b, drop(b), drop(a)]);
  }
  return outlines;
}

function closestOnSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): Point {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return [ax + t * dx, ay + t * dy];
}

/**
 * Where a leader line coming from `from` should end on a cell: the nearest point on the cell's outline,
 * nudged slightly inside so the line reads as pointing at that cell without running over its label.
 */
export function edgeTarget(rect: Rect, from: Point, inset = ANNOTATION_INSET): Point {
  let best: { point: Point, distance: number, center: Point } | null = null;
  const outlines = cellOutlines(rect);
  for (let o = 0; o < outlines.length; o += 1) {
    const outline = outlines[o];
    const center: Point = [d3.mean(outline, (p) => p[0]) ?? 0, d3.mean(outline, (p) => p[1]) ?? 0];
    for (let i = 0; i < outline.length; i += 1) {
      const point = closestOnSegment(from, outline[i], outline[(i + 1) % outline.length]);
      const distance = Math.hypot(point[0] - from[0], point[1] - from[1]);
      if (!best || distance < best.distance) best = { point, distance, center };
    }
  }
  if (!best) return from;
  const { point, center } = best;
  const towardCenter = Math.hypot(center[0] - point[0], center[1] - point[1]);
  // Small cells get a proportionally smaller nudge so the end stays inside them.
  const step = Math.min(inset, towardCenter / 2);
  return towardCenter === 0 ? point : [
    point[0] + ((center[0] - point[0]) / towardCenter) * step,
    point[1] + ((center[1] - point[1]) / towardCenter) * step,
  ];
}

/** x0, y0, x1, y1 in screen space. */
export type Box = [number, number, number, number];

const ANNOTATION_CHAR_WIDTH = 15.5;
// Relative costs used to pick a leader line route. Running over other cells dominates, so a line only
// crosses the slab when its target cannot be reached any other way.
const ROUTE_COST = {
  overCell: 1000, overText: 1000, lineCrossing: 3000, length: 1, bend: 60,
};
// How far past its text the vertical rule beside an annotation may extend before the line turns.
const RULE_REACH = [10, 40, 90, 160, 260, 380];
const VIA_SPACING = 90;

/** Outline of the whole slab (top face plus the two visible side faces). */
export function slabSilhouette(): Point[] {
  const drop = ([x, y]: Point): Point => [x, y + SLAB];
  return [
    projectTop(0, 0), projectTop(SIDE, 0), drop(projectTop(SIDE, 0)),
    drop(projectTop(SIDE, SIDE)), drop(projectTop(0, SIDE)), projectTop(0, SIDE),
  ];
}

/** An annotation whose text position is known, either from the data or from automatic placement. */
export type PlacedAnnotation = IsoTreemapAnnotation & { x: number, y: number };

/**
 * Open areas around the slab where notes can go: top left, top right (above the slab's back-right edge),
 * bottom left, bottom middle and bottom right.
 */
export const ANNOTATION_SLOTS: Point[] = [[70, 210], [1480, 110], [72, 1430], [505, 1430], [1580, 1245]];

export function annotationBox(annotation: Pick<PlacedAnnotation, 'text' | 'x' | 'y'>): Box {
  const longest = Math.max(...annotation.text.map((line) => line.length));
  return [
    annotation.x - 5,
    annotation.y - 30,
    annotation.x + longest * ANNOTATION_CHAR_WIDTH,
    annotation.y + (annotation.text.length - 1) * ANNOTATION_LINE_HEIGHT + 12,
  ];
}

function boxPolygon([x0, y0, x1, y1]: Box): Point[] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** Length of segment a-b that lies inside a convex polygon (Cyrus-Beck clipping). */
export function lengthInside(a: Point, b: Point, polygon: Point[]): number {
  const cx = d3.mean(polygon, (p) => p[0]) ?? 0;
  const cy = d3.mean(polygon, (p) => p[1]) ?? 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let enter = 0;
  let leave = 1;
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    let nx = q[1] - p[1];
    let ny = p[0] - q[0];
    // Make the edge normal point away from the polygon.
    if (nx * (cx - p[0]) + ny * (cy - p[1]) > 0) {
      nx = -nx;
      ny = -ny;
    }
    const offset = nx * (a[0] - p[0]) + ny * (a[1] - p[1]);
    const rate = nx * dx + ny * dy;
    if (rate === 0) {
      if (offset > 0) return 0;
    } else if (rate < 0) {
      enter = Math.max(enter, -offset / rate);
    } else {
      leave = Math.min(leave, -offset / rate);
    }
  }
  return leave > enter ? (leave - enter) * Math.hypot(dx, dy) : 0;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

interface RouteContext {
  silhouette: Point[];
  /** Text the lines should stay off: annotations, the title and the legend. */
  obstacles: Point[][];
  /** Segments of lines already routed. */
  placed: [Point, Point][];
  /** Open points around the slab a line may bend at. */
  vias: Point[];
  height: number;
}

function segmentCost(a: Point, b: Point, targetOutlines: Point[][], context: RouteContext) {
  const overSlab = lengthInside(a, b, context.silhouette)
    - d3.sum(targetOutlines, (outline) => lengthInside(a, b, outline));
  const overText = d3.sum(context.obstacles, (obstacle) => lengthInside(a, b, obstacle));
  const crossings = context.placed.filter(([c, d]) => segmentsCross(a, b, c, d)).length;
  return Math.max(0, overSlab) * ROUTE_COST.overCell
    + overText * ROUTE_COST.overText
    + crossings * ROUTE_COST.lineCrossing
    + Math.hypot(b[0] - a[0], b[1] - a[1]) * ROUTE_COST.length;
}

/** Points spread along a cell's outlines, each nudged inside the cell, where a line may end. */
function endCandidates(outlines: Point[][], inset = ANNOTATION_INSET): Point[] {
  return outlines.flatMap((outline) => {
    const center: Point = [d3.mean(outline, (p) => p[0]) ?? 0, d3.mean(outline, (p) => p[1]) ?? 0];
    return outline.flatMap((p, i) => {
      const q = outline[(i + 1) % outline.length];
      return [0.15, 0.35, 0.5, 0.65, 0.85].map((t): Point => {
        const point: Point = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        const distance = Math.hypot(center[0] - point[0], center[1] - point[1]);
        const step = Math.min(inset, distance / 2);
        return distance === 0 ? point : [
          point[0] + ((center[0] - point[0]) / distance) * step,
          point[1] + ((center[1] - point[1]) / distance) * step,
        ];
      });
    });
  });
}

/**
 * Finds a leader line from an annotation to a cell in the original's style: a vertical rule beside the
 * text, an optional bend outside the slab, then a straight run to the cell's edge. Picks the cheapest
 * route, which avoids passing over other cells, text and earlier lines wherever possible.
 */
export function routeLeader(
  annotation: Pick<PlacedAnnotation, 'text' | 'x' | 'y'>,
  rect: Rect | null,
  context: RouteContext,
  targetPoint?: Point,
): { points: Point[], cost: number } {
  const targetOutlines = rect ? cellOutlines(rect) : [];
  const ends = targetPoint ? [targetPoint] : endCandidates(targetOutlines);
  const lineX = annotation.x - 22;
  const textTop = annotation.y - 28;
  const textBottom = annotation.y + (annotation.text.length - 1) * ANNOTATION_LINE_HEIGHT + 10;
  let best = { cost: Infinity, points: [] as Point[] };

  [-1, 1].forEach((direction) => {
    const start: Point = [lineX, direction < 0 ? textBottom : textTop];
    RULE_REACH.forEach((reach) => {
      const ruleEnd: Point = [lineX, direction < 0 ? textTop - reach : textBottom + reach];
      if (ruleEnd[1] < 10 || ruleEnd[1] > context.height - 10) return;
      const ruleCost = segmentCost(start, ruleEnd, targetOutlines, context);
      [null, ...context.vias].forEach((via) => {
        const prefix = via
          ? ruleCost + segmentCost(ruleEnd, via, targetOutlines, context) + ROUTE_COST.bend
          : ruleCost;
        if (prefix >= best.cost) return;
        const from = via ?? ruleEnd;
        ends.forEach((end) => {
          const cost = prefix + segmentCost(from, end, targetOutlines, context);
          if (cost < best.cost) best = { cost, points: via ? [start, ruleEnd, via, end] : [start, ruleEnd, end] };
        });
      });
    });
  });
  return best;
}

function routeContext(silhouette: Point[], obstacles: Box[], height: number, tabs: Point[][]): RouteContext {
  // Bend points on a grid around the slab, plus the canvas margins so lines can run beside it.
  const xs = [10, ...d3.range(VIA_SPACING / 2, WIDTH, VIA_SPACING), WIDTH - 10];
  const ys = [10, ...d3.range(VIA_SPACING / 2, height, VIA_SPACING), height - 10];
  return {
    silhouette,
    obstacles: [...obstacles.map(boxPolygon), ...tabs],
    placed: [],
    vias: xs.flatMap((x) => ys.map((y): Point => [x, y]))
      .filter((via) => !d3.polygonContains(silhouette, via)
        && tabs.every((tab) => !d3.polygonContains(tab, via))
        && obstacles.every(([x0, y0, x1, y1]) => via[0] < x0 || via[0] > x1 || via[1] < y0 || via[1] > y1)),
    height,
  };
}

/**
 * Gives notes without a position the slots that make their leader lines cleanest overall, trying every
 * assignment. Notes beyond the number of free slots are dropped.
 */
function placeAnnotations(
  annotations: IsoTreemapAnnotation[],
  nodes: Map<string, Rect>,
  silhouette: Point[],
  baseObstacles: Box[],
  height: number,
  tabs: Point[][],
): PlacedAnnotation[] {
  const fixed = annotations.filter((a): a is PlacedAnnotation => a.x !== undefined && a.y !== undefined);
  const auto = annotations.filter((a) => a.x === undefined || a.y === undefined);
  const fixedBoxes = fixed.map(annotationBox);
  // A slot is free unless a typical note placed there would overlap a hand-placed note.
  const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const slots = ANNOTATION_SLOTS.filter(([x, y]) => {
    const typical = annotationBox({ text: Array(4).fill('x'.repeat(28)), x, y });
    return fixedBoxes.every((box) => !overlaps(typical, box));
  });
  const routes = auto.map((annotation) => slots.map(([x, y]) => {
    const placed = { ...annotation, x, y };
    const context = routeContext(silhouette, [...baseObstacles, ...fixedBoxes, annotationBox(placed)], height, tabs);
    return routeLeader(placed, nodes.get(annotation.target) ?? null, context, annotation.targetPoint);
  }));
  // Lines are routed one note at a time, so penalize slot combinations whose lines cross each other.
  const crossings = (a: Point[], b: Point[]) => d3.sum(a.slice(1), (p, i) => b.slice(1)
    .filter((q, j) => segmentsCross(a[i], p, b[j], q)).length);

  let best = { cost: Infinity, order: [] as number[] };
  const count = Math.min(auto.length, slots.length);
  const search = (i: number, order: number[], cost: number) => {
    if (cost >= best.cost) return;
    if (i === count) {
      best = { cost, order: [...order] };
      return;
    }
    slots.forEach((_, s) => {
      if (order.includes(s)) return;
      const route = routes[i][s];
      const crossingCost = d3.sum(order, (other, j) => crossings(route.points, routes[j][other].points))
        * ROUTE_COST.lineCrossing;
      search(i + 1, [...order, s], cost + route.cost + crossingCost);
    });
  };
  search(0, [], 0);

  const placedAuto = best.order.map((s, i) => ({ ...auto[i], x: slots[s][0], y: slots[s][1] }));
  // Keep the data's order so routing (and line crossing checks) are stable.
  return annotations.flatMap((annotation) => {
    if (annotation.x !== undefined && annotation.y !== undefined) return [annotation as PlacedAnnotation];
    const placed = placedAuto[auto.indexOf(annotation)];
    return placed ? [placed] : [];
  });
}

const ROUTING_PASSES = 3;

/**
 * Routes every leader line, then re-routes each one with all the others in place so an early line
 * can step aside for a later one instead of forcing it to cross.
 */
function routeAnnotations(
  annotations: PlacedAnnotation[],
  nodes: Map<string, Rect>,
  context: RouteContext,
): ResolvedAnnotation[] {
  const targeted = annotations.filter((annotation) => nodes.has(annotation.target) || annotation.targetPoint);
  const paths: Point[][] = targeted.map(() => []);
  const segments = (points: Point[]) => points.slice(1).map((point, i): [Point, Point] => [points[i], point]);
  for (let pass = 0; pass < ROUTING_PASSES; pass += 1) {
    targeted.forEach((annotation, i) => {
      const node = nodes.get(annotation.target) ?? null;
      if (annotation.elbows) {
        // Hand-placed routes are kept as given.
        const start: Point = [annotation.x - 22, annotation.y - 28];
        const last = annotation.elbows[annotation.elbows.length - 1] ?? start;
        paths[i] = [start, ...annotation.elbows, annotation.targetPoint ?? edgeTarget(node as Rect, last)];
        return;
      }
      context.placed = paths.filter((_, j) => j !== i).flatMap(segments);
      paths[i] = routeLeader(annotation, node, context, annotation.targetPoint).points;
    });
  }
  return targeted.map((annotation, i) => ({
    id: `${annotation.target}-${i}`,
    text: annotation.text,
    x: annotation.x,
    y: annotation.y,
    points: paths[i],
  }));
}

/** The tab beyond the slab's back edge for a highlighted group, on the longer back edge it touches. */
export function backTabFor({
  x0, y0, x1, y1,
}: Rect): (Rect & { vertical: boolean }) | null {
  const alongU = y0 <= EPSILON ? x1 - x0 : 0;
  const alongV = x0 <= EPSILON ? y1 - y0 : 0;
  if (!alongU && !alongV) return null;
  return alongU >= alongV
    ? {
      x0, x1, y0: -HIGHLIGHT_TAB, y1: 0, vertical: false,
    }
    : {
      x0: -HIGHLIGHT_TAB, x1: 0, y0, y1, vertical: true,
    };
}

export function computeIsoTreemap(data: IsoTreemapData): IsoTreemapLayout {
  const rootDatum: IsoTreemapBranch = { name: 'root', children: data.categories };
  const root = d3.hierarchy<IsoTreemapNode>(rootDatum, (d) => (isLeaf(d) ? undefined : d.children))
    .sum((d) => (isLeaf(d) ? d.value : 0))
    // Categories keep their data order so the dataset controls where each block sits on the slab.
    .sort((a, b) => (a.depth === 1 ? 0 : (b.value ?? 0) - (a.value ?? 0)));
  const treemap = d3.treemap<IsoTreemapNode>().size([SIDE, SIDE]).tile(d3.treemapSquarify)(root);

  const highlights: Highlight[] = treemap.descendants()
    .filter((node) => !isLeaf(node.data) && (node.data as IsoTreemapBranch).highlight)
    .map((node) => {
      const branch = node.data as IsoTreemapBranch;
      const side = sideExtent(node);
      return {
        name: branch.name,
        label: (branch.label ?? branch.name).toUpperCase(),
        x0: node.x0,
        y0: node.y0,
        x1: node.x1,
        y1: node.y1,
        side,
        backTab: side ? null : backTabFor(node),
      };
    });

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
      color: colorFor(category.palette, centeredDomain(data.colorDomain), datum.change),
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

  const nodesByName = new Map<string, Rect>();
  treemap.descendants().forEach((node) => {
    if (!nodesByName.has(node.data.name)) nodesByName.set(node.data.name, node);
  });
  const legend = data.categories.map((category) => ({
    name: category.name,
    label: (category.legendLabel ?? category.label ?? category.name).toUpperCase(),
    palette: category.palette,
  }));
  const height = LEGEND_TOP + 25 + legend.length * LEGEND_ROW_HEIGHT + 70;

  const silhouette = slabSilhouette();
  // Back tabs are slanted, so lines avoid their actual shape rather than a bounding box.
  const tabs = highlights.flatMap(({ backTab: tab }) => (tab
    ? [[projectTop(tab.x0, tab.y0), projectTop(tab.x1, tab.y0), projectTop(tab.x1, tab.y1), projectTop(tab.x0, tab.y1)]]
    : []));
  const baseObstacles: Box[] = [TITLE_BOX, [LEGEND_TEXT_LEFT, LEGEND_TOP - 30, WIDTH - 250, height]];
  const placed = placeAnnotations(data.annotations ?? [], nodesByName, silhouette, baseObstacles, height, tabs);
  const context = routeContext(silhouette, [...baseObstacles, ...placed.map(annotationBox)], height, tabs);
  const annotations = routeAnnotations(placed, nodesByName, context);

  return {
    leaves,
    leftFace,
    rightFace,
    categoryLabels,
    highlights,
    legend,
    annotations,
    height,
  };
}
