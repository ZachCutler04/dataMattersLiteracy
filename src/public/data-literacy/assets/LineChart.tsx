import { Center, Loader } from '@mantine/core';
import * as d3 from 'd3';
import { useEffect, useMemo, useState } from 'react';
import { StimulusParams } from '../../../store/types';
import { PREFIX } from '../../../utils/Prefix';
import { IsoTreemapData } from './isoTreemapLayout';
import {
  computeLineChart, LABEL_FONT_SIZE, LINE_HEIGHT, LINE_WIDTH, LineChartData, PLOT,
} from './lineChartLayout';

type LineChartParameters = {
  /** File name (without .json) in public/data-literacy/assets/treemaps/; its `line` section is drawn. */
  dataset: string;
};

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const GRID = '#e5e5e5';
const NOTE = '#6f6f6f';
const toPath = (points: [number, number][]) => d3.line()(points) ?? '';

export function LineChartFromData({ data }: { data: LineChartData }) {
  const layout = useMemo(() => computeLineChart(data), [data]);
  const noteTop = PLOT.bottom + 150;

  return (
    <svg
      viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`}
      style={{
        width: '100%', maxHeight: '100%', display: 'block', fontFamily: FONT, background: '#ffffff',
      }}
      role="img"
      aria-label={data.title}
    >
      <rect width={LINE_WIDTH} height={LINE_HEIGHT} fill="#ffffff" />
      <text x={(PLOT.left + PLOT.right) / 2} y={55} textAnchor="middle" fontSize={42} fontWeight={700}>{data.title}</text>

      {layout.yTicks.map((tick) => (
        <g key={tick.value}>
          <line x1={PLOT.left} x2={PLOT.right} y1={tick.position} y2={tick.position} stroke={GRID} strokeWidth={3} />
          <line x1={PLOT.left - 10} x2={PLOT.left} y1={tick.position} y2={tick.position} stroke="#000" strokeWidth={3} />
          <text x={PLOT.left - 18} y={tick.position} textAnchor="end" dominantBaseline="central" fontSize={36}>
            {tick.exponent !== undefined ? (
              <>
                10
                <tspan dy={-16} fontSize={24}>{tick.exponent}</tspan>
              </>
            ) : tick.text}
          </text>
        </g>
      ))}
      {layout.xTicks.map((tick) => (
        <g key={tick.value}>
          <line x1={tick.position} x2={tick.position} y1={PLOT.bottom} y2={PLOT.bottom + 10} stroke="#000" strokeWidth={3} />
          <text x={tick.position} y={PLOT.bottom + 50} textAnchor="middle" fontSize={36}>{tick.text}</text>
        </g>
      ))}

      {layout.series.map((s) => s.trend && (
        <g key={`${s.name}-trend`}>
          <path d={`${toPath(s.trend.band)}Z`} fill={s.color} fillOpacity={s.color === '#000000' ? 0.25 : 0.22} stroke="none" />
          <path d={toPath(s.trend.line)} fill="none" stroke={s.color} strokeWidth={7} strokeDasharray="20 14" />
        </g>
      ))}
      {layout.series.map((s) => s.segments.map((segment) => (
        <path
          key={`${s.name}-${segment[0].join(',')}`}
          d={toPath(segment)}
          fill="none"
          stroke={s.color}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      )))}
      {layout.series.map((s) => (
        <text key={`${s.name}-label`} x={s.label.x} y={s.label.y} textAnchor="middle" fontSize={LABEL_FONT_SIZE} fontWeight={700} fill={s.color}>
          {s.name}
        </text>
      ))}

      <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={PLOT.bottom} stroke="#000" strokeWidth={6} />
      <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} stroke="#000" strokeWidth={6} />
      <text x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 110} textAnchor="middle" fontSize={46} fontWeight={700}>
        {data.xLabel ?? 'Year'}
      </text>
      <text
        transform={`translate(62 ${(PLOT.top + PLOT.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={46}
        fontWeight={700}
      >
        {data.yLabel}
      </text>

      {(data.note ?? []).map((line, i) => (
        <text key={line} x={PLOT.left} y={noteTop + i * 36} fontSize={25} fill={NOTE}>{line}</text>
      ))}
    </svg>
  );
}

/** Loads a topic dataset and draws its line chart. */
export function LineChartChart({ dataset }: LineChartParameters) {
  const [data, setData] = useState<LineChartData | null>(null);

  useEffect(() => {
    let cancelled = false;
    d3.json<IsoTreemapData>(`${PREFIX}data-literacy/assets/treemaps/${dataset}.json`).then((loaded) => {
      if (!cancelled && loaded?.line) setData(loaded.line);
    });
    return () => {
      cancelled = true;
    };
  }, [dataset]);

  if (!data) return <Center h={400}><Loader /></Center>;
  return <LineChartFromData data={data} />;
}

export default function LineChart({ parameters }: StimulusParams<LineChartParameters>) {
  return <LineChartChart dataset={parameters.dataset} />;
}
