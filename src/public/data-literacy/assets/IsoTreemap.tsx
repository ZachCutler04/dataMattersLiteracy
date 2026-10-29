import { Center, Loader } from '@mantine/core';
import * as d3 from 'd3';
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { StimulusParams } from '../../../store/types';
import { PREFIX } from '../../../utils/Prefix';
import {
  ANNOTATION_LINE_HEIGHT, centeredDomain, computeIsoTreemap, HIGHLIGHT_TAB, FaceSegment, IsoTreemapData, LabelFit,
  LEFT_FACE_TRANSFORM, LEGEND_ROW_HEIGHT, LEGEND_TOP, RIGHT_FACE_TRANSFORM, shadowPoints,
  SLAB, TOP_TRANSFORM, WIDTH,
} from './isoTreemapLayout';

type IsoTreemapParameters = {
  /** File name (without .json) in public/data-literacy/assets/treemaps/. */
  dataset: string;
};

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500&family=League+Gothic&display=swap');";
// Closest Google Fonts to the original's Brandon Grotesque-style labels and condensed title.
const BODY_FONT = "Outfit, 'Brandon Grotesque', sans-serif";
const TITLE_FONT = "'League Gothic', 'Arial Narrow', sans-serif";
const BACKGROUND = '#fbf8f3';
const SHADOW = '#d7d0bb';
const HIGHLIGHT = '#29abe2';
const LABEL_COLOR = '#3d3030';
const ANNOTATION_COLOR = '#8b8b8b';
const INK = '#222222';
const LEGEND_X = 780;
const SWATCH_WIDTH = 145;
const SWATCH_HEIGHT = 26;
const TITLE_FONT_SIZE = 56;
// Keeps the title left of the slab's top corner.
const TITLE_MAX_WIDTH = 820;

function formatTick(value: number, unit: string) {
  return `${value < 0 ? '−' : ''}${Math.abs(value)}${unit}`;
}

/** Multi-line text centered on the origin of the current coordinate system. */
function CenteredLines({ fit, lineHeight }: { fit: LabelFit, lineHeight: number }) {
  const offset = ((fit.lines.length - 1) / 2) * lineHeight * fit.fontSize;
  return (
    <>
      {fit.lines.map((line, i) => (
        <tspan key={line} x={0} y={i * lineHeight * fit.fontSize - offset}>{line}</tspan>
      ))}
    </>
  );
}

function FaceCells({ segments }: { segments: FaceSegment[] }) {
  return (
    <>
      {segments.map((segment) => (
        <rect
          key={segment.id}
          x={segment.start}
          y={0}
          width={segment.end - segment.start}
          height={SLAB}
          fill={segment.color}
          stroke={d3.hsl(segment.color).darker(0.25).formatHex()}
          strokeWidth={1}
        />
      ))}
    </>
  );
}

export function IsoTreemapChart({ dataset }: IsoTreemapParameters) {
  const [data, setData] = useState<IsoTreemapData | null>(null);
  const titleRef = useRef<SVGTextElement>(null);
  const [title, setTitle] = useState({ width: 0, fontSize: TITLE_FONT_SIZE });

  useEffect(() => {
    let cancelled = false;
    d3.json<IsoTreemapData>(`${PREFIX}data-literacy/assets/treemaps/${dataset}.json`).then((loaded) => {
      if (!cancelled && loaded) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [dataset]);

  const layout = useMemo(() => (data ? computeIsoTreemap(data) : null), [data]);

  // The title shrinks to stay clear of the slab, and its underline matches the rendered width,
  // both of which change once the web font loads.
  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      const element = titleRef.current;
      if (cancelled || !element) return;
      const renderedSize = Number(element.getAttribute('font-size')) || TITLE_FONT_SIZE;
      const naturalWidth = (element.getBBox().width * TITLE_FONT_SIZE) / renderedSize;
      const fontSize = Math.min(TITLE_FONT_SIZE, (TITLE_FONT_SIZE * TITLE_MAX_WIDTH) / naturalWidth);
      setTitle({ width: (naturalWidth * fontSize) / TITLE_FONT_SIZE, fontSize });
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, [layout]);

  if (!data || !layout) {
    return <Center h={400}><Loader /></Center>;
  }

  const unit = data.unit ?? '%';
  const [domainMin, domainMax] = centeredDomain(data.colorDomain);
  const binCount = layout.legend[0]?.palette.length ?? 0;
  const ticks = d3.range(binCount + 1).map((i) => domainMin + ((domainMax - domainMin) * i) / binCount);
  const legendRowsTop = LEGEND_TOP + 25;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${layout.height}`}
      style={{
        width: '100%', maxHeight: '100%', display: 'block', fontFamily: BODY_FONT,
      }}
      role="img"
      aria-label={data.title}
    >
      <style>{FONT_IMPORT}</style>
      <rect width={WIDTH} height={layout.height} fill={BACKGROUND} />

      <text ref={titleRef} x={62} y={95} fontFamily={TITLE_FONT} fontSize={title.fontSize} letterSpacing={5} fill={INK}>
        {data.title.toUpperCase()}
      </text>
      <rect x={62} y={108} width={title.width} height={5} fill={INK} />

      <polygon points={shadowPoints().join(' ')} fill={SHADOW} />

      <g transform={LEFT_FACE_TRANSFORM}>
        <FaceCells segments={layout.leftFace} />
      </g>
      <g transform={RIGHT_FACE_TRANSFORM}>
        <FaceCells segments={layout.rightFace} />
      </g>

      {layout.categoryLabels.map((label) => (
        <g key={label.name} transform={label.face === 'left' ? LEFT_FACE_TRANSFORM : RIGHT_FACE_TRANSFORM}>
          <text
            transform={`translate(${(label.start + label.end) / 2} ${SLAB / 2})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={label.fit.fontSize}
            fontWeight={500}
            letterSpacing={label.fit.fontSize * 0.14}
            fill="#ffffff"
          >
            <CenteredLines fit={label.fit} lineHeight={1.15} />
          </text>
        </g>
      ))}

      <g transform={TOP_TRANSFORM}>
        {layout.leaves.map((leaf) => (
          <rect
            key={leaf.id}
            x={leaf.x0}
            y={leaf.y0}
            width={leaf.x1 - leaf.x0}
            height={leaf.y1 - leaf.y0}
            fill={leaf.color}
            stroke={d3.hsl(leaf.color).darker(0.25).formatHex()}
            strokeWidth={1.2}
          />
        ))}
        {layout.leaves.map((leaf) => leaf.label && (
          <text
            key={leaf.id}
            transform={`translate(${(leaf.x0 + leaf.x1) / 2} ${(leaf.y0 + leaf.y1) / 2})${leaf.label.vertical ? ' rotate(-90)' : ''}`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={leaf.label.fontSize}
            fontWeight={300}
            fill={LABEL_COLOR}
          >
            <CenteredLines fit={leaf.label} lineHeight={1.1} />
          </text>
        ))}
        {layout.highlights.map((highlight) => (
          <rect
            key={highlight.name}
            x={highlight.x0}
            y={highlight.y0}
            width={highlight.x1 - highlight.x0}
            height={highlight.y1 - highlight.y0}
            fill="none"
            stroke={HIGHLIGHT}
            strokeWidth={6}
          />
        ))}
        {/* Groups away from the side faces hang their tab just beyond the slab's back edge. */}
        {layout.highlights.map(({ name, label, backTab: tab }) => tab && (
          <g key={name}>
            <rect x={tab.x0} y={tab.y0} width={tab.x1 - tab.x0} height={tab.y1 - tab.y0} fill={HIGHLIGHT} />
            <text
              transform={`translate(${(tab.x0 + tab.x1) / 2} ${(tab.y0 + tab.y1) / 2})${tab.vertical ? ' rotate(-90)' : ''}`}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={20}
              fontWeight={500}
              letterSpacing={2}
              fill="#ffffff"
            >
              {label}
            </text>
          </g>
        ))}
      </g>

      {layout.highlights.map(({ name, label, side }) => side && (
        <g key={name} transform={side.face === 'left' ? LEFT_FACE_TRANSFORM : RIGHT_FACE_TRANSFORM}>
          <rect x={side.start} y={0} width={side.end - side.start} height={SLAB} fill="none" stroke={HIGHLIGHT} strokeWidth={6} />
          <rect x={side.start - 3} y={SLAB} width={side.end - side.start + 6} height={HIGHLIGHT_TAB} fill={HIGHLIGHT} />
          <text
            x={(side.start + side.end) / 2}
            y={SLAB + HIGHLIGHT_TAB / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={20}
            fontWeight={500}
            letterSpacing={2}
            fill="#ffffff"
          >
            {label}
          </text>
        </g>
      ))}

      {layout.annotations.map((annotation) => (
        <g key={annotation.id}>
          <polyline points={annotation.points.join(' ')} fill="none" stroke={INK} strokeWidth={2} />
          <text x={annotation.x} y={annotation.y} fontSize={31} fontWeight={400} fill={ANNOTATION_COLOR}>
            {annotation.text.map((line, i) => (
              <tspan key={line} x={annotation.x} y={annotation.y + i * ANNOTATION_LINE_HEIGHT}>{line}</tspan>
            ))}
          </text>
        </g>
      ))}

      <text x={LEGEND_X} y={LEGEND_TOP} fontSize={25} fontWeight={500} letterSpacing={2.5} fill={INK}>
        {data.legendTitle.toUpperCase()}
      </text>
      {layout.legend.map((row, rowIndex) => {
        const y = legendRowsTop + rowIndex * LEGEND_ROW_HEIGHT;
        return (
          <g key={row.name}>
            <text x={LEGEND_X - 20} y={y + SWATCH_HEIGHT / 2} textAnchor="end" dominantBaseline="central" fontSize={24} fontWeight={500} letterSpacing={2.5} fill={INK}>
              {row.label}
            </text>
            {row.palette.map((color, i) => (
              <rect key={color} x={LEGEND_X + i * SWATCH_WIDTH} y={y} width={SWATCH_WIDTH} height={SWATCH_HEIGHT} fill={color} />
            ))}
          </g>
        );
      })}
      {ticks.map((tick, i) => (
        <text
          key={tick}
          x={LEGEND_X + i * SWATCH_WIDTH}
          y={legendRowsTop + layout.legend.length * LEGEND_ROW_HEIGHT + 30}
          textAnchor="middle"
          fontSize={24}
          letterSpacing={1}
          fill={INK}
        >
          {formatTick(tick, unit)}
        </text>
      ))}
    </svg>
  );
}

export default function IsoTreemap({ parameters }: StimulusParams<IsoTreemapParameters>) {
  return <IsoTreemapChart dataset={parameters.dataset} />;
}
