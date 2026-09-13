/**
 * TypeScript declarations for v3/template-exchange.js (opt-in — Q4 2026 #5).
 */

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  text: string;
  tags: string[];
  author: string;
  stars: number;
  ratingCount: number;
}

export interface TemplateStats {
  total: number;
  byCategory: Record<string, number>;
  topRated: TemplateRecord[];
  mostRated: TemplateRecord[];
}

export declare class TemplateExchange {
  constructor();
  add(t: { id?: string; name: string; description?: string; category?: string; text: string; tags?: string[]; author?: string }): TemplateRecord;
  get(id: string): TemplateRecord | null;
  search(query?: string, opts?: { category?: string }): TemplateRecord[];
  rate(id: string, stars: number, userId?: string): { id: string; stars: number; ratingCount: number };
  importJson(text: string): TemplateRecord[];
  exportJson(ids?: string[]): string;
  share(id: string): string;
  feed(): Array<{ id: string; name: string; category: string; author: string; stars: number; ratingCount: number }>;
  catalogStats(): TemplateStats;
}

export const SEED_TEMPLATES: readonly Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  text: string;
  tags: string[];
  author: string;
}>;