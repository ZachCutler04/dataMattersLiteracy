import { ParticipantData } from '../../../parser/types';

export const TOPICS = ['sports', 'technology', 'geography', 'stocks', 'music'] as const;
export type Topic = typeof TOPICS[number];
export type InterestLevel = 'high' | 'low';

/** Response id of the ranking widget on the topic interest questionnaire. Its option values are the topics. */
export const RANKING_RESPONSE_ID = 'topicRanking';

export interface TopicInterest {
  /** 1 for the participant's top-ranked topic; topics they left unranked are missing. */
  ranks: Partial<Record<Topic, number>>;
  /** Stable per participant, used to order topics the participant left unranked. */
  seed: number;
}

/** Reads the participant's topic ranking from the answers of the given questionnaire component. */
export function readTopicInterest(answers: ParticipantData['answers'], componentName: string): TopicInterest {
  const stored = Object.values(answers ?? {}).find((answer) => answer.componentName === componentName);
  const ranking = stored?.answer?.[RANKING_RESPONSE_ID];
  const ranks: Partial<Record<Topic, number>> = {};
  if (ranking && typeof ranking === 'object' && !Array.isArray(ranking)) {
    // The ranking widget stores each ranked option's 0-based position as a string.
    TOPICS.forEach((topic) => {
      const position = Number((ranking as Record<string, unknown>)[topic]);
      if (Number.isInteger(position) && position >= 0) ranks[topic] = position + 1;
    });
  }
  return { ranks, seed: stored?.startTime ?? 0 };
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

/** Topics ordered from most to least interesting; unranked topics come last in a seeded random order. */
export function rankTopics({ ranks, seed }: TopicInterest): Topic[] {
  const random = seededRandom(seed);
  const shuffled = [...TOPICS];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Array.prototype.sort is stable, so unranked topics keep their shuffled order.
  return shuffled.sort((a, b) => (ranks[a] ?? Infinity) - (ranks[b] ?? Infinity));
}

/** The top-ranked topic for "high" and the bottom-ranked for "low"; never the same topic. */
export function selectTopic(interest: TopicInterest, level: InterestLevel): Topic {
  const ranked = rankTopics(interest);
  return level === 'high' ? ranked[0] : ranked[ranked.length - 1];
}
