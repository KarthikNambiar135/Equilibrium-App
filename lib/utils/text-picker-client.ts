/**
 * Client-side weighted random text selection.
 * Uses localStorage to track usage counts for variety.
 */

import contributorTexts from '@/lib/data/group-contributor-texts.json'

// In-memory usage tracking (resets on page reload — that's fine)
const usageCounts = new Map<string, Map<number, number>>()

function pickWeightedRandom(texts: string[], category: string): string {
  if (texts.length === 0) return ''
  if (texts.length === 1) return texts[0]

  if (!usageCounts.has(category)) {
    usageCounts.set(category, new Map())
  }
  const counts = usageCounts.get(category)!

  const maxUsage = Math.max(1, ...Array.from(counts.values()))
  const weights = texts.map((_, i) => {
    const usage = counts.get(i) || 0
    return Math.max(1, maxUsage + 1 - usage)
  })

  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let random = Math.random() * totalWeight
  let selectedIndex = 0

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i]
    if (random <= 0) {
      selectedIndex = i
      break
    }
  }

  counts.set(selectedIndex, (counts.get(selectedIndex) || 0) + 1)

  // Normalize counts
  const minUsage = Math.min(...texts.map((_, i) => counts.get(i) || 0))
  if (minUsage > 0 && counts.size >= texts.length) {
    for (const [key, val] of counts.entries()) {
      counts.set(key, val - minUsage)
    }
  }

  return texts[selectedIndex]
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, String(value))
  }
  return result
}

/**
 * Get a random contributor text for display in the group page.
 */
export function getContributorText(
  vibe: 'chill' | 'formal' | 'roast',
  vars: { name: string; amount: string }
): string {
  const texts = contributorTexts[vibe] || contributorTexts.chill
  const template = pickWeightedRandom(texts, `contributor_${vibe}`)
  return fillTemplate(template, vars)
}
