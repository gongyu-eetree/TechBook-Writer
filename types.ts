
export interface EbookStructure {
  title: string;
  chapters: Array<{
    title: string;
    description: string;
  }>;
  coverPrompt: string;
}

export type TargetAudience = 'Novice' | 'Intermediate' | 'Expert';

export interface EbookProject {
  description: string;
  materials: string;
  language: string;
  outputLanguage: 'Chinese' | 'English';
  writingStyle: string;
  targetAudience: TargetAudience;
  referenceLinks: string[];
  targetLength: string;
  chapterCount: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_STRUCTURE = 'GENERATING_STRUCTURE',
  REVIEW_STRUCTURE = 'REVIEW_STRUCTURE',
  GENERATING_CONTENT = 'GENERATING_CONTENT',
  GENERATING_COVER = 'GENERATING_COVER',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: string;
  description: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'trial', name: '免费体验', credits: 10000, price: '¥0', description: '新用户注册礼包，可生成约 5-8 个精简章节' },
  { id: 'standard', name: '进阶包', credits: 100000, price: '¥29.9', description: '适合生成 2-3 本标准长度的技术图书', popular: true },
  { id: 'pro', name: '专业包', credits: 500000, price: '¥99.0', description: '适合长期创作，单字成本大幅降低' },
  { id: 'unlimited', name: '创作者包', credits: 2000000, price: '¥299.0', description: '海量点数，适合高产技术博主或工作室' },
];
