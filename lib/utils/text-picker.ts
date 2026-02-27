/**
 * Weighted Random Text Selection
 *
 * Selects a random text from a list, where texts that have been used
 * more often have LOWER probability of being selected.
 *
 * Uses an in-memory usage map that resets on server restart.
 * This ensures variety without needing a database.
 */

// Track usage counts per category+vibe
const usageCounts = new Map<string, Map<number, number>>()

/**
 * Pick a random text with weighted selection.
 * More-used texts have lower probability.
 *
 * @param texts Array of text templates
 * @param category A key like "reminder_chill" or "contributor_formal"
 * @returns The selected text template
 */
export function pickWeightedRandom(texts: string[], category: string): string {
  if (texts.length === 0) return ''
  if (texts.length === 1) return texts[0]

  // Get or create usage map for this category
  if (!usageCounts.has(category)) {
    usageCounts.set(category, new Map())
  }
  const counts = usageCounts.get(category)!

  // Calculate weights: less-used texts get higher weight
  const maxUsage = Math.max(1, ...Array.from(counts.values()))
  const weights = texts.map((_, i) => {
    const usage = counts.get(i) || 0
    // Weight = maxUsage + 1 - usage (so unused items have highest weight)
    return Math.max(1, maxUsage + 1 - usage)
  })

  // Weighted random selection
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

  // Update usage count
  counts.set(selectedIndex, (counts.get(selectedIndex) || 0) + 1)

  // Reset counts if all texts have been used at least once
  // (prevents unbounded growth)
  const minUsage = Math.min(...texts.map((_, i) => counts.get(i) || 0))
  if (minUsage > 0 && counts.size >= texts.length) {
    // Subtract minUsage from all to keep relative weights but prevent overflow
    for (const [key, val] of counts.entries()) {
      counts.set(key, val - minUsage)
    }
  }

  return texts[selectedIndex]
}

/**
 * Fill in template variables like {debtor}, {amount}, etc.
 */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, String(value))
  }
  return result
}

/**
 * Get a random reminder text for a specific vibe, with variables filled in.
 */
export function getRandomReminderText(
  vibe: 'chill' | 'formal' | 'roast',
  vars: Record<string, string | number>
): string {
  // Dynamic import would be cleaner but we need synchronous access
  const reminderTexts = require('@/lib/data/reminder-texts.json')
  const texts: string[] = reminderTexts[vibe] || reminderTexts.chill
  const template = pickWeightedRandom(texts, `reminder_${vibe}`)
  return fillTemplate(template, vars)
}

/**
 * Get a random group contributor text for a specific vibe.
 */
export function getRandomContributorText(
  vibe: 'chill' | 'formal' | 'roast',
  vars: Record<string, string | number>
): string {
  const contributorTexts = require('@/lib/data/group-contributor-texts.json')
  const texts: string[] = contributorTexts[vibe] || contributorTexts.chill
  const template = pickWeightedRandom(texts, `contributor_${vibe}`)
  return fillTemplate(template, vars)
}

/**
 * Get a random alert text for a notification type and vibe.
 */
export function getRandomAlertText(
  type: string,
  vibe: 'chill' | 'formal' | 'roast',
  vars: Record<string, string | number>
): string {
  const alertTexts = require('@/lib/data/alert-texts.json')
  const typeTexts = alertTexts[type]
  if (!typeTexts) return ''
  const texts: string[] = typeTexts[vibe] || typeTexts.chill || []
  if (texts.length === 0) return ''
  const template = pickWeightedRandom(texts, `alert_${type}_${vibe}`)
  return fillTemplate(template, vars)
}
