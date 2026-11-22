export type Question = {
  id: number;
  difficulty?: 'unrated' | 'easy' | 'medium' | 'hard';
  status?: 'draft' | 'published' | 'archived';
  setId?: number | null;
  setName?: string;
  explanation?: string;
  source?: string;
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
