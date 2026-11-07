import { useEffect, useMemo } from 'react';
import { StimulusParams } from '../../../store/types';
import { IsoTreemapChart } from './IsoTreemap';
import { LineChartChart } from './LineChart';
import { InterestLevel, readTopicInterest, selectTopic } from './topicSelection';

type TopicChartParameters = {
  chart: 'treemap' | 'line';
  /** Show the participant's most ("high") or least ("low") interesting topic. */
  interest: InterestLevel;
  /** Name of the questionnaire component holding the topic ranking. */
  interestComponent?: string;
};

/** Shows a treemap or line chart for a topic chosen from the participant's topic ranking. */
export default function TopicChart({ parameters, answers, setAnswer }: StimulusParams<TopicChartParameters>) {
  const { chart, interest, interestComponent = 'topicInterest' } = parameters;
  const topicInterest = useMemo(() => readTopicInterest(answers, interestComponent), [answers, interestComponent]);
  const topic = useMemo(() => selectTopic(topicInterest, interest), [topicInterest, interest]);
  const rank = topicInterest.ranks[topic] ?? null;

  // Record which chart the participant actually saw alongside their responses.
  useEffect(() => {
    setAnswer({
      status: true,
      answers: {
        shownTopic: topic, shownChart: chart, interestLevel: interest, interestRank: rank,
      },
    });
  }, [chart, interest, rank, setAnswer, topic]);

  if (chart === 'treemap') {
    return <IsoTreemapChart dataset={topic} />;
  }
  return <LineChartChart dataset={topic} />;
}
