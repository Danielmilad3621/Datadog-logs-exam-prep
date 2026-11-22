export type Question = {
  id: number;
  prompt: string;
  options: { key: string; text: string }[];
  answers: string[];
  type: 'single' | 'multi' | 'truefalse';
  domain: string;
  topic: string;
  topicCode: string;
  sourcePage: number;
  flags: string[];
};
