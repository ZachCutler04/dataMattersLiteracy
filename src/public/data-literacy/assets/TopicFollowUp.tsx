import {
  Box, Group, Radio, Stack, Text, Textarea, Title,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { StimulusParams } from '../../../store/types';
import { readSeenCharts, TOPIC_DATA_NAMES } from './topicSelection';

const SCALE = ['1', '2', '3', '4', '5', '6', '7'];
const CHART_NAMES = { treemap: '3D treemap', line: 'line chart' };
const PENDING_MESSAGE = 'Please answer both questions.';

/** Asks how interested the participant was in each of the two datasets they just critiqued, naming them. */
export default function TopicFollowUp({ answers, setAnswer }: StimulusParams<Record<string, never>>) {
  const seen = useMemo(() => readSeenCharts(answers).slice(0, 2), [answers]);
  const [ratings, setRatings] = useState<Record<number, string>>({});
  const [details, setDetails] = useState<Record<number, string>>({});

  useEffect(() => {
    const complete = seen.length > 0 && seen.every((_, i) => ratings[i]);
    const recorded: Record<string, string> = {};
    seen.forEach((chart, i) => {
      recorded[`chart${i + 1}Topic`] = chart.topic;
      recorded[`chart${i + 1}Type`] = chart.chart;
      if (ratings[i]) recorded[`chart${i + 1}Interest`] = ratings[i];
      recorded[`chart${i + 1}Details`] = details[i] ?? '';
    });
    setAnswer(complete
      ? { status: true, answers: recorded }
      : {
        status: false, answers: recorded, reason: 'customPending', message: PENDING_MESSAGE,
      });
  }, [details, ratings, seen, setAnswer]);

  return (
    <Box p="md" maw={900} mx="auto">
      <Title order={2} mb="lg">Your interest in the data</Title>
      <Stack gap="xl">
        {seen.map((chart, i) => (
          <Box key={`${chart.topic}-${chart.chart}`}>
            <Text fw={500} mb="sm">
              {`${i + 1}. How interested were you in the `}
              <b>{TOPIC_DATA_NAMES[chart.topic]}</b>
              {` data shown in the ${i === 0 ? 'first' : 'second'} chart (the ${CHART_NAMES[chart.chart]})?`}
            </Text>
            <Radio.Group value={ratings[i] ?? null} onChange={(value) => setRatings((prev) => ({ ...prev, [i]: value }))}>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Text size="sm" c="dimmed" w={110}>Not at all interested</Text>
                {SCALE.map((value) => (
                  <Radio key={value} value={value} label={value} styles={{ body: { flexDirection: 'column', alignItems: 'center', gap: 4 } }} />
                ))}
                <Text size="sm" c="dimmed" w={110} ta="right">Extremely interested</Text>
              </Group>
            </Radio.Group>
            <Textarea
              mt="md"
              placeholder="Optional: tell us more about why"
              autosize
              minRows={2}
              value={details[i] ?? ''}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setDetails((prev) => ({ ...prev, [i]: value }));
              }}
            />
          </Box>
        ))}
        {seen.length === 0 && <Text c="dimmed">No charts recorded.</Text>}
      </Stack>
    </Box>
  );
}
