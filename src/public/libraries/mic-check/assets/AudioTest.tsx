import {
  Alert, Box, Title,
} from '@mantine/core';
import {
  useEffect, useState,
} from 'react';
import { StimulusParams } from '../../../../store/types';
import { RecordingAudioWaveform } from '../../../../components/interface/RecordingAudioWaveform';

const PENDING_MESSAGE = 'Please allow microphone access and speak so we can confirm your microphone is working.';
// Frames with sound above the analyser floor needed before we accept the microphone works (~0.5s at 60fps),
// so a single click or burst of noise does not pass the check.
const FRAMES_REQUIRED = 30;

export function AudioTest({ setAnswer }: StimulusParams<undefined>) {
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    // React component stimuli start out valid, so block Continue until we actually hear sound.
    setAnswer({
      status: false,
      answers: {},
      reason: 'customPending',
      message: PENDING_MESSAGE,
    });

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let frame = 0;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.minDecibels = -45;
        audioContext.createMediaStreamSource(mediaStream).connect(analyser);

        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        let framesWithSound = 0;

        const detectSound = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(frequencyData);
          if (frequencyData.some((value) => value > 0)) framesWithSound += 1;

          if (framesWithSound >= FRAMES_REQUIRED) {
            setAnswer({
              status: true,
              answers: { audioTest: true },
            });
            return;
          }
          frame = window.requestAnimationFrame(detectSound);
        };
        frame = window.requestAnimationFrame(detectSound);
      })
      .catch(() => {
        if (!cancelled) {
          setMicError('We could not access your microphone. Please allow microphone access in your browser and make sure a microphone is connected, then reload this page.');
        }
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
    };
  }, [setAnswer]);

  return (
    <Box p="md">
      <Title order={1} size="h2">
        Audio Recording Permission
      </Title>

      <p>
        This study requires recording of your
        {' '}
        <strong>audio</strong>
        . If you&apos;re not comfortable, you may exit and return the study.
      </p>
      <p>Follow the steps below to grant microphone access and confirm that your audio is working.</p>

      {micError && (
        <Alert color="red" mb="md">{micError}</Alert>
      )}

      <ol>
        <li>
          <strong>Please allow us to access your microphone.</strong>
          {' '}
          There may be a popup in your browser window asking for access. Click allow to continue.
        </li>
        <li>
          <strong>Speak</strong>
          {' '}
          into your microphone to check if audio is working.
          <Box h={200} w={400} bd="1px solid #ccc" mt="sm">
            <RecordingAudioWaveform height={200} width={400} />
          </Box>
        </li>
      </ol>

      <strong>Note:</strong>
      <ul>
        <li>
          Once we can confirm that your microphone is on and we hear you say something, the
          {' '}
          <b>Continue</b>
          {' '}
          button will become available.
        </li>
        <li>If you are not comfortable or able to speak English during this study, please return the study.</li>
      </ul>
    </Box>
  );
}

export default AudioTest;
