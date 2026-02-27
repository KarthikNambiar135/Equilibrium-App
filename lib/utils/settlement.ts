import type { SettlementSuggestion } from '@/lib/types/database'

/**
 * Graph-based settlement optimization engine.
 * Minimizes the number of transactions needed to settle all debts.
 * 
 * Algorithm: Net balance approach
 * 1. Calculate net balance for each user (total owed - total owes)
 * 2. Separate into creditors (positive) and debtors (negative)
 * 3. Greedily match largest debtor with largest creditor
 * 
 * This reduces N*(N-1)/2 possible edges to at most N-1 transactions.
 */

type DebtEdge = {
  from: string
  to: string
  amount: number
}

type UserInfo = {
  id: string
  name: string
}

/**
 * Calculate net balances from a list of debt edges
 */
export function calculateNetBalances(
  edges: DebtEdge[],
  users: UserInfo[]
): Map<string, number> {
  const balances = new Map<string, number>()

  // Initialize all users with 0 balance
  users.forEach((u) => balances.set(u.id, 0))

  // Process each edge
  edges.forEach(({ from, to, amount }) => {
    balances.set(from, (balances.get(from) || 0) - amount) // from owes, so negative
    balances.set(to, (balances.get(to) || 0) + amount) // to is owed, so positive
  })

  return balances
}

/**
 * Detect and eliminate cycles in debts (e.g., A→B→C→A cancels out)
 */
function detectAndEliminateCycles(edges: DebtEdge[]): DebtEdge[] {
  // Net balance approach inherently eliminates cycles
  // If A→B 100, B→C 100, C→A 100, net balances are all 0
  return edges
}

/**
 * FASTEST settlement: Minimize number of transactions
 * Uses greedy approach matching largest creditor with largest debtor
 */
export function getOptimalSettlements(
  edges: DebtEdge[],
  users: UserInfo[]
): SettlementSuggestion[] {
  const userMap = new Map(users.map((u) => [u.id, u.name]))
  const balances = calculateNetBalances(edges, users)

  // Separate into creditors and debtors
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  balances.forEach((balance, id) => {
    if (balance > 0.01) creditors.push({ id, amount: balance })
    if (balance < -0.01) debtors.push({ id, amount: -balance })
  })

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const settlements: SettlementSuggestion[] = []

  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const settleAmount = Math.min(creditors[i].amount, debtors[j].amount)

    if (settleAmount > 0.01) {
      settlements.push({
        from: debtors[j].id,
        fromName: userMap.get(debtors[j].id) || 'Unknown',
        to: creditors[i].id,
        toName: userMap.get(creditors[i].id) || 'Unknown',
        amount: Math.round(settleAmount * 100) / 100,
      })
    }

    creditors[i].amount -= settleAmount
    debtors[j].amount -= settleAmount

    if (creditors[i].amount < 0.01) i++
    if (debtors[j].amount < 0.01) j++
  }

  return settlements
}

/**
 * CHEAPEST settlement: Fewer transactions, may carry forward small amounts
 * Only carry forward debts that are newer than 7 days to avoid indefinite accumulation.
 * Older small debts must still be settled.
 */
export function getCheapestSettlements(
  edges: DebtEdge[],
  users: UserInfo[],
  threshold: number = 50,
  expenseAges?: Map<string, number> // key: "from->to", value: oldest expense age in days
): { settlements: SettlementSuggestion[]; carriedForward: number } {
  const all = getOptimalSettlements(edges, users)
  const MAX_CARRY_AGE_DAYS = 7

  const filtered: SettlementSuggestion[] = []
  let carriedForward = 0

  all.forEach((s) => {
    if (s.amount < threshold) {
      // Check age — only carry forward if the debt is newer than 7 days
      const key = `${s.from}->${s.to}`
      const ageDays = expenseAges?.get(key) ?? 999 // default to old (don't carry forward)

      if (ageDays <= MAX_CARRY_AGE_DAYS) {
        // Recent small debt — safe to carry forward
        carriedForward += s.amount
      } else {
        // Old small debt — must still be settled
        filtered.push(s)
      }
    } else {
      filtered.push(s)
    }
  })

  return {
    settlements: filtered,
    carriedForward: Math.round(carriedForward * 100) / 100,
  }
}

/**
 * Build debt edges from expenses and splits.
 * Also computes the oldest expense age (in days) for each debtor→creditor pair.
 */
export function buildDebtEdges(
  expenses: {
    paid_by: string
    amount: number
    splits: { user_id: string; amount: number }[]
    created_at?: string
  }[],
  settledPayments: {
    from_user: string
    to_user: string
    amount: number
    status: string
  }[]
): { edges: DebtEdge[]; expenseAges: Map<string, number> } {
  const edgeMap = new Map<string, number>()
  const ageMap = new Map<string, number>() // key -> oldest expense age in days
  const now = Date.now()

  // Process expenses
  expenses.forEach((expense) => {
    const ageDays = expense.created_at
      ? Math.floor((now - new Date(expense.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    expense.splits.forEach((split) => {
      if (split.user_id !== expense.paid_by) {
        const key = `${split.user_id}->${expense.paid_by}`
        edgeMap.set(key, (edgeMap.get(key) || 0) + split.amount)
        // Track the oldest expense age for this debt direction
        ageMap.set(key, Math.max(ageMap.get(key) || 0, ageDays))
      }
    })
  })

  // Subtract completed settlements
  settledPayments
    .filter((s) => s.status === 'completed')
    .forEach((settlement) => {
      const key = `${settlement.from_user}->${settlement.to_user}`
      edgeMap.set(key, (edgeMap.get(key) || 0) - settlement.amount)
    })

  // Convert to edges, handling net direction
  const edges: DebtEdge[] = []
  const expenseAges = new Map<string, number>()
  const processed = new Set<string>()

  edgeMap.forEach((amount, key) => {
    const [from, to] = key.split('->')
    const reverseKey = `${to}->${from}`

    if (processed.has(key)) return
    processed.add(key)
    processed.add(reverseKey)

    const reverseAmount = edgeMap.get(reverseKey) || 0
    const net = amount - reverseAmount

    if (net > 0.01) {
      edges.push({ from, to, amount: net })
      expenseAges.set(`${from}->${to}`, ageMap.get(key) || 0)
    } else if (net < -0.01) {
      edges.push({ from: to, to: from, amount: -net })
      expenseAges.set(`${to}->${from}`, ageMap.get(reverseKey) || 0)
    }
  })

  return { edges, expenseAges }
}

/**
 * Format currency for Indian Rupees
 * Manual implementation — avoids Intl.NumberFormat quirks on some mobile browsers
 */
export function formatINR(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(Math.round(amount))
  const str = abs.toString()

  // Indian number system: last 3 digits as-is, then groups of 2
  if (str.length <= 3) return `${sign}₹${str}`

  const last3 = str.slice(-3)
  const rest = str.slice(0, -3)
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${sign}₹${grouped},${last3}`
}

/**
 * Generate UPI deep link (demo mode)
 */
export function generateUPILink(
  payeeUpiId: string,
  payeeName: string,
  amount: number,
  note: string
): string {
  const params = new URLSearchParams({
    pa: payeeUpiId,
    pn: payeeName,
    am: amount.toString(),
    cu: 'INR',
    tn: note,
  })
  return `upi://pay?${params.toString()}`
}
