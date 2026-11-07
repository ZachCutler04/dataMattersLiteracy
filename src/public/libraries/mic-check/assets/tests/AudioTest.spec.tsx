import { ReactNode } from 'react';
import {
  act, cleanup, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AudioTest } from '../AudioTest';
import { StimulusParams } from '../../../../../store/types';

vi.mock('@mantine/core', () => ({
  Alert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

vi.mock('../../../../../components/interface/RecordingAudioWaveform', () => ({
  RecordingAudioWaveform: () => null,
}));

// Whether the fake microphone currently picks up sound.
let soundLevel = 0;
let frameCallbacks: FrameRequestCallback[] = [];
const stopTrack = vi.fn();
const closeContext = vi.fn();

class FakeAudioContext {
  createAnalyser() {
    return {
      minDecibels: 0,
      frequencyBinCount: 4,
      getByteFrequencyData: (data: Uint8Array) => data.fill(soundLevel),
    };
  }

  createMediaStreamSource() {
    return { connect: () => undefined };
  }

  close = closeContext;
}

function runFrames(count: number) {
  for (let i = 0; i < count; i += 1) {
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    callbacks.forEach((callback) => callback(0));
  }
}

function renderAudioTest(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  const setAnswer = vi.fn();
  const view = render(<AudioTest {...({ setAnswer } as unknown as StimulusParams<undefined>)} />);
  return { setAnswer, ...view };
}

const grantedMic = () => Promise.resolve({ getTracks: () => [{ stop: stopTrack }] });

beforeEach(() => {
  soundLevel = 0;
  frameCallbacks = [];
  stopTrack.mockClear();
  closeContext.mockClear();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AudioTest', () => {
  test('blocks Continue until sound is heard', async () => {
    const { setAnswer } = renderAudioTest(grantedMic);
    expect(setAnswer).toHaveBeenCalledWith(expect.objectContaining({ status: false }));

    await waitFor(() => expect(frameCallbacks.length).toBe(1));
    act(() => runFrames(60));
    expect(setAnswer).not.toHaveBeenCalledWith(expect.objectContaining({ status: true }));
  });

  test('allows Continue after sustained sound', async () => {
    const { setAnswer } = renderAudioTest(grantedMic);
    await waitFor(() => expect(frameCallbacks.length).toBe(1));

    soundLevel = 120;
    act(() => runFrames(5));
    expect(setAnswer).not.toHaveBeenCalledWith(expect.objectContaining({ status: true }));

    act(() => runFrames(40));
    expect(setAnswer).toHaveBeenCalledWith({ status: true, answers: { audioTest: true } });
  });

  test('stays blocked and explains when microphone access is denied', async () => {
    const { setAnswer } = renderAudioTest(() => Promise.reject(new Error('denied')));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not access your microphone/i);
    expect(setAnswer).not.toHaveBeenCalledWith(expect.objectContaining({ status: true }));
  });

  test('releases the microphone when the page unmounts', async () => {
    const { unmount } = renderAudioTest(grantedMic);
    await waitFor(() => expect(frameCallbacks.length).toBe(1));

    unmount();
    expect(stopTrack).toHaveBeenCalled();
    expect(closeContext).toHaveBeenCalled();
  });
});
