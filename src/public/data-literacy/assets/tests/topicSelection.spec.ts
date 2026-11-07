import { describe, expect, it } from 'vitest';
import { ParticipantData } from '../../../../parser/types';
import {
  rankTopics, readTopicInterest, selectTopic, TOPICS,
} from '../topicSelection';

function answersWith(topicRanking: unknown, startTime = 1234): ParticipantData['answers'] {
  return {
    introduction_0: { componentName: 'introduction', answer: { prolificId: 'abc' }, startTime: 1 },
    topicInterest_2: { componentName: 'topicInterest', answer: { topicRanking }, startTime },
  } as unknown as ParticipantData['answers'];
}

// The ranking widget stores each option's 0-based position as a string.
const fullRanking = {
  sports: '0', geography: '1', music: '2', technology: '3', stocks: '4',
};

describe('readTopicInterest', () => {
  it('reads the ranking as 1-based ranks', () => {
    expect(readTopicInterest(answersWith(fullRanking), 'topicInterest')).toEqual({
      ranks: {
        sports: 1, geography: 2, music: 3, technology: 4, stocks: 5,
      },
      seed: 1234,
    });
  });

  it('returns no ranks when the ranking is missing or empty', () => {
    expect(readTopicInterest({}, 'topicInterest')).toEqual({ ranks: {}, seed: 0 });
    expect(readTopicInterest(answersWith([]), 'topicInterest').ranks).toEqual({});
    expect(readTopicInterest(answersWith({}), 'topicInterest').ranks).toEqual({});
  });
});

describe('selectTopic', () => {
  it('picks the top- and bottom-ranked topics', () => {
    const interest = readTopicInterest(answersWith(fullRanking), 'topicInterest');
    expect(selectTopic(interest, 'high')).toBe('sports');
    expect(selectTopic(interest, 'low')).toBe('stocks');
  });

  it('puts unranked topics last, choosing among them the same way every time', () => {
    const partial = readTopicInterest(answersWith({ music: '0', sports: '1' }), 'topicInterest');
    expect(selectTopic(partial, 'high')).toBe('music');
    const low = selectTopic(partial, 'low');
    expect(['technology', 'geography', 'stocks']).toContain(low);
    expect(selectTopic(partial, 'low')).toBe(low);
  });

  it('spreads unranked topics across participants', () => {
    const picks = new Set(Array.from({ length: 50 }, (_, seed) => selectTopic({ ranks: {}, seed }, 'low')));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('never shows the same topic for high and low', () => {
    Array.from({ length: 50 }, (_, seed) => seed).forEach((seed) => {
      const interest = { ranks: { geography: 1 }, seed };
      expect(selectTopic(interest, 'high')).toBe('geography');
      expect(selectTopic(interest, 'low')).not.toBe('geography');
    });
  });
});

describe('rankTopics', () => {
  it('returns every topic once', () => {
    expect([...rankTopics({ ranks: {}, seed: 99 })].sort()).toEqual([...TOPICS].sort());
  });
});
