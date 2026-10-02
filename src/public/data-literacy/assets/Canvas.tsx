import {
  PointerEvent, useCallback, useEffect, useRef, useState,
} from 'react';
import { StimulusParams } from '../../../store/types';

type DrawingParameters = {
  responseId?: string;
};

const COLORS = ['#d92d20', '#1f9d55', '#2563eb', '#f59e0b', '#111827'];
const SIZES = [2, 5, 9];

export default function Canvas({
  parameters, setAnswer,
}: StimulusParams<DrawingParameters>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const storageKey = `data-literacy-drawing-${parameters.responseId || 'practice'}`;

  const saveDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawing = canvas.toDataURL('image/png');
    localStorage.setItem(storageKey, drawing);
    setAnswer({
      status: true,
      answers: parameters.responseId ? { [parameters.responseId]: drawing } : {},
    });
  }, [parameters.responseId, setAnswer, storageKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resizeCanvas = () => {
      const drawing = localStorage.getItem(storageKey);
      const bounds = canvas.getBoundingClientRect();
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(bounds.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(bounds.height * devicePixelRatio));
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(devicePixelRatio, devicePixelRatio);
      context.lineCap = 'round';
      context.lineJoin = 'round';

      if (drawing) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height);
        image.src = drawing;
      }
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [storageKey]);

  const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const drawTo = (point: { x: number, y: number }) => {
    const canvas = canvasRef.current;
    const lastPoint = lastPointRef.current;
    if (!canvas || !lastPoint) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    context.strokeStyle = color;
    context.lineWidth = eraser ? size * 4 : size;
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
  };

  const continueDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawTo(getPoint(event));
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    saveDrawing();
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem(storageKey);
    setAnswer({ status: true, answers: {} });
  };

  return (
    <div style={{ display: 'grid', gap: 12, height: '100%', minHeight: 500 }}>
      <div aria-label="Drawing controls" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => setEraser(false)} aria-pressed={!eraser}>Pencil</button>
        <button type="button" onClick={() => setEraser(true)} aria-pressed={eraser}>Eraser</button>
        {SIZES.map((lineSize) => (
          <button type="button" key={lineSize} onClick={() => setSize(lineSize)} aria-pressed={size === lineSize}>
            Size {lineSize}
          </button>
        ))}
        {COLORS.map((lineColor) => (
          <button
            type="button"
            key={lineColor}
            onClick={() => { setColor(lineColor); setEraser(false); }}
            aria-label={`Use ${lineColor} pencil`}
            aria-pressed={!eraser && color === lineColor}
            style={{ background: lineColor, border: '1px solid #1f2937', borderRadius: '50%', height: 24, width: 24 }}
          />
        ))}
        <button type="button" onClick={clearDrawing}>Clear all</button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label="Drawing canvas"
        onPointerDown={startDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
        style={{ background: 'white', border: '1px solid #9ca3af', cursor: eraser ? 'cell' : 'crosshair', height: '100%', touchAction: 'none', width: '100%' }}
      />
    </div>
  );
}
