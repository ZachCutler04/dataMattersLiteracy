import { ParticipantData } from '../../../parser/types';

export const TOPICS = ['sports', 'technology', 'geography', 'stocks', 'music'] as const;
export type Topic = typeof TOPICS[number];
export type InterestLevel = 'high' | 'low';

/** Response ids on the topic interest questionnaire, by topic. */
export const INTEREST_RESPONSE_IDS: Record<Topic, string> = {
  sports: 'interestSports',
  technology: 'interestTechnology',
  geography: 'interestGeography',
  stocks: 'interestStocks',
  music: 'interestMusic',
};

export interface TopicInterest {
  ratings: Partial<Record<Topic, number>>;
  /** Stable per participant, used to break ties between equal ratings. */
  seed: number;
}

/** Reads the participant's Likert ratings from the answers of the given questionnaire component. */
export function readTopicInterest(answers: ParticipantData['answers'], componentName: string): TopicInterest {
  const stored = Object.values(answers ?? {}).find((answer) => answer.componentName === componentName);
  const ratings: Partial<Record<Topic, number>> = {};
  TOPICS.forEach((topic) => {
    const rating = Number(stored?.answer?.[INTEREST_RESPONSE_IDS[topic]]);
    if (Number.isFinite(rating) && rating > 0) ratings[topic] = rating;
  });
  return { ratings, seed: stored?.startTime ?? 0 };
}

// mulberry32: small deterministic PRNG so tie-breaking is repeatable for a participant.
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Topics ordered from most to least interesting, with ties in a seeded random order. */
export function rankTopics({ ratings, seed }: TopicInterest): Topic[] {
  const random = seededRandom(seed);
  const shuffled = [...TOPICS];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Array.prototype.sort is stable, so equal ratings keep their shuffled order.
  return shuffled.sort((a, b) => (ratings[b] ?? 0) - (ratings[a] ?? 0));
}

/** The highest-rated topic for "high" and the lowest-rated for "low"; never the same topic. */
export function selectTopic(interest: TopicInterest, level: InterestLevel): Topic {
  const ranked = rankTopics(interest);
  return level === 'high' ? ranked[0] : ranked[ranked.length - 1];
}
