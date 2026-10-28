import { describe, expect, it } from 'vitest';
import { ParticipantData } from '../../../../parser/types';
import {
  rankTopics, readTopicInterest, selectTopic, TOPICS,
} from '../topicSelection';

function answersWith(answer: Record<string, string>, startTime = 1234): ParticipantData['answers'] {
  return {
    introduction_0: { componentName: 'introduction', answer: { prolificId: 'abc' }, startTime: 1 },
    topicInterest_2: { componentName: 'topicInterest', answer, startTime },
  } as unknown as ParticipantData['answers'];
}

const ratings = {
  interestSports: '7',
  interestTechnology: '3',
  interestGeography: '5',
  interestStocks: '1',
  interestMusic: '4',
};

describe('readTopicInterest', () => {
  it('reads Likert ratings from the named questionnaire', () => {
    expect(readTopicInterest(answersWith(ratings), 'topicInterest')).toEqual({
      ratings: {
        sports: 7, technology: 3, geography: 5, stocks: 1, music: 4,
      },
      seed: 1234,
    });
  });

  it('returns no ratings when the questionnaire has not been answered', () => {
    expect(readTopicInterest({}, 'topicInterest')).toEqual({ ratings: {}, seed: 0 });
    expect(readTopicInterest(answersWith({ interestSports: '' }), 'topicInterest').ratings).toEqual({});
  });
});

describe('selectTopic', () => {
  it('picks the highest and lowest rated topics', () => {
    const interest = readTopicInterest(answersWith(ratings), 'topicInterest');
    expect(selectTopic(interest, 'high')).toBe('sports');
    expect(selectTopic(interest, 'low')).toBe('stocks');
  });

  it('breaks ties the same way every time for a participant', () => {
    const tied = readTopicInterest(answersWith({ ...ratings, interestGeography: '7' }), 'topicInterest');
    const first = selectTopic(tied, 'high');
    expect(['sports', 'geography']).toContain(first);
    expect(selectTopic(tied, 'high')).toBe(first);
  });

  it('spreads ties across participants', () => {
    const picks = new Set(Array.from({ length: 50 }, (_, seed) => selectTopic({ ratings: {}, seed }, 'high')));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('never shows the same topic for high and low, even when all ratings match', () => {
    Array.from({ length: 50 }, (_, seed) => seed).forEach((seed) => {
      const interest = {
        ratings: {
          sports: 4, technology: 4, geography: 4, stocks: 4, music: 4,
        },
        seed,
      };
      expect(selectTopic(interest, 'high')).not.toBe(selectTopic(interest, 'low'));
    });
  });
});

describe('rankTopics', () => {
  it('returns every topic once', () => {
    expect([...rankTopics({ ratings: {}, seed: 99 })].sort()).toEqual([...TOPICS].sort());
  });
});
