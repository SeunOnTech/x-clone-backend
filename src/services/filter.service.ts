// ============================================================================
// FILE 2: src/services/filter.service.ts
// Fuzzy matching for stream rules
// ============================================================================

import Fuse from "fuse.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function findMatchingRules(content: string) {
  const rules = await prisma.streamRule.findMany();
  if (rules.length === 0) return [];

  // Flatten all keywords with their parent rules
  const allKeywords = rules.flatMap(r => 
    r.keywords.map(k => ({ rule: r, keyword: k }))
  );

  // Fuzzy search across all keywords
  const fuse = new Fuse(allKeywords, {
    keys: ["keyword"],
    includeScore: true,
    threshold: 0.4, // 0 = exact, 1 = very fuzzy (adjust as needed)
  });

  const matches = fuse.search(content);
  const matchedRuleIds = new Set(matches.map(m => m.item.rule.id));

  return rules.filter(r => matchedRuleIds.has(r.id));
}