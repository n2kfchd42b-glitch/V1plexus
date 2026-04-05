/**
 * Document version diff utilities
 * Provides paragraph-level and word-level diffing for document content
 */

export interface DiffBlock {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  paragraphIndex: number;
}

/**
 * Extract paragraphs from Tiptap/JSONB document content
 */
export function extractParagraphs(content: Record<string, unknown> | null): string[] {
  if (!content || typeof content !== 'object') return [];

  const paragraphs: string[] = [];

  function traverse(node: any): void {
    if (!node) return;

    if (node.type === 'paragraph' && node.content) {
      const text = extractTextFromNode(node);
      if (text.trim()) paragraphs.push(text.trim());
    }

    if (node.type === 'heading' && node.content) {
      const text = extractTextFromNode(node);
      if (text.trim()) paragraphs.push(text.trim());
    }

    if (Array.isArray(node.content)) {
      node.content.forEach((child: any) => traverse(child));
    }
  }

  traverse(content);
  return paragraphs;
}

/**
 * Extract plain text from a Tiptap node
 */
function extractTextFromNode(node: any): string {
  if (!node) return '';

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

  let text = '';
  if (Array.isArray(node.content)) {
    node.content.forEach((child: any) => {
      text += extractTextFromNode(child);
    });
  }

  return text;
}

/**
 * Simple line-based diff using longest common subsequence
 * Returns blocks showing what was added, removed, or unchanged
 */
export function diffParagraphs(before: string[], after: string[]): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  const lcs = longestCommonSubsequence(before, after);

  let beforeIdx = 0;
  let afterIdx = 0;

  for (const item of lcs) {
    // Items removed from 'before'
    while (beforeIdx < before.length && before[beforeIdx] !== item) {
      blocks.push({
        type: 'removed',
        content: before[beforeIdx],
        paragraphIndex: beforeIdx,
      });
      beforeIdx++;
    }

    // Items added in 'after'
    while (afterIdx < after.length && after[afterIdx] !== item) {
      blocks.push({
        type: 'added',
        content: after[afterIdx],
        paragraphIndex: afterIdx,
      });
      afterIdx++;
    }

    // Unchanged item
    if (beforeIdx < before.length && afterIdx < after.length) {
      blocks.push({
        type: 'unchanged',
        content: item,
        paragraphIndex: beforeIdx,
      });
      beforeIdx++;
      afterIdx++;
    }
  }

  // Remaining items
  while (beforeIdx < before.length) {
    blocks.push({
      type: 'removed',
      content: before[beforeIdx],
      paragraphIndex: beforeIdx,
    });
    beforeIdx++;
  }

  while (afterIdx < after.length) {
    blocks.push({
      type: 'added',
      content: after[afterIdx],
      paragraphIndex: afterIdx,
    });
    afterIdx++;
  }

  return blocks;
}

/**
 * Longest Common Subsequence using dynamic programming
 * Used to find the longest sequence of unchanged lines between two versions
 */
function longestCommonSubsequence<T>(arr1: T[], arr2: T[]): T[] {
  const m = arr1.length;
  const n = arr2.length;

  // Create DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: T[] = [];
  let i = m,
    j = n;

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Word-level diff for detailed comparison
 */
export interface WordDiff {
  type: 'added' | 'removed' | 'unchanged';
  word: string;
}

export function diffWords(before: string, after: string): WordDiff[] {
  const beforeWords = before.split(/\s+/).filter(Boolean);
  const afterWords = after.split(/\s+/).filter(Boolean);

  const diffs: WordDiff[] = [];
  const lcs = longestCommonSubsequence(beforeWords, afterWords);

  let beforeIdx = 0;
  let afterIdx = 0;

  for (const word of lcs) {
    while (beforeIdx < beforeWords.length && beforeWords[beforeIdx] !== word) {
      diffs.push({
        type: 'removed',
        word: beforeWords[beforeIdx],
      });
      beforeIdx++;
    }

    while (afterIdx < afterWords.length && afterWords[afterIdx] !== word) {
      diffs.push({
        type: 'added',
        word: afterWords[afterIdx],
      });
      afterIdx++;
    }

    if (beforeIdx < beforeWords.length && afterIdx < afterWords.length) {
      diffs.push({
        type: 'unchanged',
        word: word,
      });
      beforeIdx++;
      afterIdx++;
    }
  }

  while (beforeIdx < beforeWords.length) {
    diffs.push({
      type: 'removed',
      word: beforeWords[beforeIdx],
    });
    beforeIdx++;
  }

  while (afterIdx < afterWords.length) {
    diffs.push({
      type: 'added',
      word: afterWords[afterIdx],
    });
    afterIdx++;
  }

  return diffs;
}

/**
 * Calculate statistics about the diff
 */
export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
  changedPct: number;
}

export function calculateDiffStats(blocks: DiffBlock[]): DiffStats {
  const stats = {
    added: 0,
    removed: 0,
    unchanged: 0,
    changedPct: 0,
  };

  for (const block of blocks) {
    if (block.type === 'added') stats.added++;
    else if (block.type === 'removed') stats.removed++;
    else stats.unchanged++;
  }

  const total = blocks.length;
  if (total > 0) {
    stats.changedPct = Math.round(((stats.added + stats.removed) / total) * 100);
  }

  return stats;
}
