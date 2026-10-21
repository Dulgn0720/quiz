export const SUPPORTED_LOCALES = ['mn', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'mn';

/** Length of the numeric room PIN players type to join. */
export const PIN_LENGTH = 6;

/** Hard limits enforced by validation on both the client and the server. */
export const LIMITS = {
  idMax: 64,
  titleMax: 120,
  descriptionMax: 1000,
  roundNameMax: 80,
  promptMax: 300,
  optionTextMax: 120,
  explanationMax: 500,
  urlMax: 2048,
  roundsMax: 20,
  questionsPerRoundMax: 100,
  optionsMin: 2,
  optionsMax: 6,
  acceptedAnswersMax: 10,
  acceptedAnswerMax: 100,
  orderingItemsMin: 2,
  orderingItemsMax: 6,
  /** Seconds a question may be shown for. */
  timeMin: 5,
  timeMax: 240,
  multiplierMin: 0.5,
  multiplierMax: 5,
  basePointsMax: 5000,
  nicknameMin: 1,
  nicknameMax: 20,
  imageMaxBytes: 5 * 1024 * 1024,
} as const;

export const DEFAULTS = {
  timePerQuestion: 20,
  pointsMultiplier: 1,
  basePoints: 1000,
} as const;

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
