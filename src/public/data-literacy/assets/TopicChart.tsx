import { Image } from '@mantine/core';
import { useEffect, useMemo } from 'react';
import { StimulusParams } from '../../../store/types';
import { PREFIX } from '../../../utils/Prefix';
import { IsoTreemapChart } from './IsoTreemap';
import { InterestLevel, readTopicInterest, selectTopic } from './topicSelection';

type TopicChartParameters = {
  chart: 'treemap' | 'line';
  /** Show the participant's most ("high") or least ("low") interesting topic. */
  interest: InterestLevel;
  /** Name of the questionnaire component holding the topic ratings. */
  interestComponent?: string;
};

/** Shows a treemap or line chart for a topic chosen from the participant's interest ratings. */
export default function TopicChart({ parameters, answers, setAnswer }: StimulusParams<TopicChartParameters>) {
  const { chart, interest, interestComponent = 'topicInterest' } = parameters;
  const topicInterest = useMemo(() => readTopicInterest(answers, interestComponent), [answers, interestComponent]);
  const topic = useMemo(() => selectTopic(topicInterest, interest), [topicInterest, interest]);
  const rating = topicInterest.ratings[topic] ?? null;

  // Record which chart the participant actually saw alongside their responses.
  useEffect(() => {
    setAnswer({
      status: true,
      answers: {
        shownTopic: topic, shownChart: chart, interestLevel: interest, interestRating: rating,
      },
    });
  }, [chart, interest, rating, setAnswer, topic]);

  if (chart === 'treemap') {
    return <IsoTreemapChart dataset={topic} />;
  }
  return (
    <Image
      src={`${PREFIX}data-literacy/assets/linecharts/${topic}.png`}
      alt={`Line chart about ${topic}`}
      fit="contain"
      mah="100%"
      w="100%"
    />
  );
}
