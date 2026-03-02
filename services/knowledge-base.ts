/**
 * Survival Knowledge Base Service
 *
 * Loads and searches the survival knowledge base JSON data.
 * Provides full-text search across questions, answers, and tags
 * with relevance-based scoring.
 */

import knowledgeData from '@/data/survival-knowledge.json';

export type KnowledgeEntry = {
  q: string;
  a: string;
  tags: string[];
  category: string;
};

// Flatten the category-keyed JSON into a flat array with category field
const rawData = knowledgeData as Record<string, { q: string; a: string; tags: string[] }[]>;
const entries: KnowledgeEntry[] = Object.entries(rawData).flatMap(
  ([category, items]) => items.map((item) => ({ ...item, category }))
);

/**
 * Search the knowledge base by matching query words against tags and question text.
 * Returns the top 5 results scored by relevance.
 *
 * Scoring:
 * - Exact tag match: 3 points per matching tag
 * - Partial tag match (tag contains query word): 2 points
 * - Question text contains query word: 1 point per occurrence
 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1);

  if (queryWords.length === 0) {
    return [];
  }

  const scored = entries.map((entry) => {
    let score = 0;
    const questionLower = entry.q.toLowerCase();
    const answerLower = entry.a.toLowerCase();

    for (const word of queryWords) {
      // Check tags for exact match (highest relevance)
      for (const tag of entry.tags) {
        const tagLower = tag.toLowerCase();
        if (tagLower === word) {
          score += 3;
        } else if (tagLower.includes(word)) {
          score += 2;
        }
      }

      // Check question text
      if (questionLower.includes(word)) {
        score += 1;
      }

      // Check answer text (lower weight)
      if (answerLower.includes(word)) {
        score += 0.5;
      }
    }

    return { entry, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.entry);
}

/**
 * Get all knowledge entries in a specific category.
 */
export function getCategory(category: string): KnowledgeEntry[] {
  return entries.filter(
    (entry) => entry.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get a list of all unique categories in the knowledge base.
 */
export function getCategories(): string[] {
  const categorySet = new Set(entries.map((entry) => entry.category));
  return Array.from(categorySet).sort();
}
