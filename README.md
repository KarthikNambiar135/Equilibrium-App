# Equilibrium -- Technical Documentation

Equilibrium is a full-stack group expense management application built with Next.js, Supabase, and Razorpay. This document explains how every part of the system works at a technical level.

For the user-facing workflow and feature documentation, see [WORKFLOW.md](WORKFLOW.md).

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Database Architecture](#3-database-architecture)
4. [Authentication System](#4-authentication-system)
5. [Supabase Client Architecture](#5-supabase-client-architecture)
6. [Razorpay Payment Integration](#6-razorpay-payment-integration)
7. [Settlement Algorithm](#7-settlement-algorithm)
8. [Honesty Score Engine](#8-honesty-score-engine)
9. [Badge Evaluation System](#9-badge-evaluation-system)
10. [Notification Pipeline](#10-notification-pipeline)
11. [Push Notification Infrastructure](#11-push-notification-infrastructure)
12. [Personality-Driven Text Generation](#12-personality-driven-text-generation)
13. [File Upload and Storage](#13-file-upload-and-storage)
14. [Service Worker and Caching](#14-service-worker-and-caching)
15. [PWA Configuration](#15-pwa-configuration)
16. [Capacitor Native App](#16-capacitor-native-app)
17. [API Route Reference](#17-api-route-reference)
18. [State Management](#18-state-management)
19. [Currency Formatting](#19-currency-formatting)
20. [Environment Variables](#20-environment-variables)
21. [Deployment](#21-deployment)

---

## 1. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | Server/client rendering, API routes, middleware |
| **Language** | TypeScript 5 | Type safety across the full stack |
| **UI** | React 19, Tailwind CSS 4 | Component rendering and utility-first styling |
| **Icons** | Lucide React | SVG icon library |
| **Charts** | Recharts | Pie charts for category spending breakdown |
| **Database** | Supabase (PostgreSQL) | Auth, database, storage, realtime, and RLS |
| **Auth** | Supabase Auth | Email/password, Google OAuth, session management |
| **Payments** | Razorpay | UPI payments, order management, webhook verification |
| **Push (Web)** | Web Push (VAPID) | Browser push notifications via `web-push` library |
| **Push (Native)** | Firebase Cloud Messaging | Android push notifications via `firebase-admin` |
| **Storage** | Supabase Storage | Expense proof/receipt file uploads |
| **State** | Zustand | Client-side global state store |
| **Date** | date-fns | Date formatting and relative time |
| **Native** | Capacitor (Android) | WebView wrapper for native Android distribution |
| **Deployment** | Vercel | Hosting, serverless functions, edge middleware |

### Dependencies (package.json)

**Runtime**: `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`, `razorpay`, `web-push`, `firebase-admin`, `lucide-react`, `recharts`, `date-fns`, `zustand`, `@capacitor/core`, `@capacitor/android`, `@capacitor/push-notifications`

**Dev**: `typescript`, `tailwindcss`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`, `sharp`

---

## 2. Project Structure

```
equilibrium/
├── app/
│   ├── layout.tsx                  # Root layout (metadata, PWA init, push init)
│   ├── page.tsx                    # Landing page (splash screen, auth redirect)
│   ├── login/page.tsx              # Login (email/password + Google OAuth)
│   ├── signup/page.tsx             # Signup (email/password + Google OAuth)
│   ├── auth/callback/route.ts      # OAuth callback (code → session exchange)
│   ├── native-callback/page.tsx    # Capacitor OAuth callback
│   ├── globals.css                 # Tailwind imports, CSS variables, custom styles
│   ├── (main)/                     # Protected route group (requires auth)
│   │   ├── layout.tsx              # Auth guard, bottom nav, sign-out listener
│   │   ├── dashboard/page.tsx      # Home screen (grid, balances, activity)
│   │   ├── groups/
│   │   │   ├── page.tsx            # Groups list (active + terminated)
│   │   │   ├── new/page.tsx        # Group creation wizard (3 steps)
│   │   │   └── [id]/page.tsx       # Group detail (expenses, balances, members)
│   │   ├── settlements/page.tsx    # Settlement history
│   │   ├── friends/page.tsx        # Friends management
│   │   ├── activity/page.tsx       # Activity feed (expenses + settlements)
│   │   ├── notifications/page.tsx  # Notification center
│   │   ├── profile/page.tsx        # Profile editor
│   │   ├── equipoints/page.tsx     # Gamification hub
│   │   ├── settings/page.tsx       # Privacy settings
│   │   └── users/[id]/page.tsx     # Public user profile view
│   └── api/
│       ├── payments/
│       │   ├── create-order/route.ts   # Razorpay order creation
│       │   ├── verify/route.ts         # Payment signature verification
│       │   └── webhook/route.ts        # Razorpay webhook handler
│       ├── expenses/
│       │   ├── notify/route.ts         # Expense added notification
│       │   ├── issues/route.ts         # Conflict/issue CRUD
│       │   ├── edit/route.ts           # Edit conflicted expense
│       │   └── proof/route.ts          # Attach proof to expense
│       ├── groups/notify/route.ts      # Group event notification
│       ├── group-invites/route.ts      # Invite management
│       ├── friends/route.ts            # Friend request CRUD
│       ├── notifications/route.ts      # In-app notification CRUD
│       ├── push/
│       │   ├── subscribe/route.ts      # Save push subscription
│       │   ├── send/route.ts           # Send push notification
│       │   └── status/route.ts         # Subscription status check
│       ├── reminders/route.ts          # Rate-limited debt reminders
│       ├── honesty/route.ts            # Honesty score calculation + event logging
│       ├── badges/route.ts             # Badge evaluation
│       ├── equipoints/route.ts         # Points awarding
│       ├── group-requests/route.ts      # Join request management
│       ├── notifications/send/route.ts # Send notification to group admins
│       ├── cron/reminders/route.ts     # Automated reminder cron job
│       ├── settings/route.ts           # User settings API
│       ├── upload/route.ts             # File upload to Supabase Storage
│       └── trip/spend-limit/route.ts   # Personal trip spending limit
├── components/
│   ├── SplashScreen.tsx            # Video splash + frame.png transition
│   ├── PWAInitializer.tsx          # SW registration, web push subscription
│   ├── NativePushInitializer.tsx   # Capacitor FCM registration
│   ├── icons/                      # Custom SVG icons
│   └── ui/
│       ├── Avatar.tsx              # User avatar with initials fallback
│       ├── BottomNav.tsx           # Mobile bottom navigation bar
│       ├── Button.tsx              # Styled button with loading state
│       ├── Card.tsx                # Card container
│       ├── CategoryIcon.tsx        # Expense category → Lucide icon mapper
│       ├── EmptyState.tsx          # Empty state placeholder
│       ├── Input.tsx               # Styled input with label and left icon
│       ├── Modal.tsx               # Bottom sheet modal
│       ├── VideoLoader.tsx         # Fullscreen video loading overlay
│       └── PullToRefresh.tsx       # Touch-based pull-to-refresh wrapper
├── lib/
│   ├── razorpay.ts                 # Razorpay server instance
│   ├── store.ts                    # Zustand global state
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Component Supabase client
│   │   ├── middleware.ts           # Middleware Supabase client + auth guard
│   │   └── admin.ts                # Service-role Supabase client
│   ├── types/
│   │   └── database.ts             # Full TypeScript DB schema types
│   ├── utils/
│   │   ├── settlement.ts           # Settlement algorithm + INR formatter
│   │   ├── notify.ts               # Push notification sender (Web Push + FCM)
│   │   ├── formatters.ts           # Date, currency, invite code, categories
│   │   ├── text-picker.ts          # Server-side personality text generator
│   │   └── text-picker-client.ts   # Client-side personality text generator
│   └── data/
│       ├── alert-texts.json        # Notification text templates per vibe
│       ├── reminder-texts.json     # Reminder text templates per vibe
│       └── group-contributor-texts.json  # Top contributor text templates
├── public/
│   ├── sw.js                       # Service worker
│   ├── manifest.json               # PWA manifest
│   ├── Equilibrium.mp4             # Splash video
│   ├── frame.png                   # App logo/frame image
│   └── icon-192.png, icon-512.png  # PWA icons
├── middleware.ts                    # Auth middleware entry point
├── capacitor.config.ts             # Capacitor native app config
└── supabase-*.sql                  # Database schema and migration files
```

---

## 3. Database Architecture

### Core Tables

The database runs on Supabase (PostgreSQL) with Row Level Security (RLS) enabled on all tables.

#### profiles
Extends `auth.users`. Auto-created via a database trigger (`handle_new_user`) on signup.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | FK to auth.users, cascades on delete |
| email | text | From auth provider |
| full_name | text | NOT NULL. From signup metadata or email prefix |
| avatar_url | text | From Google OAuth |
| phone | text | Optional. Format: "+91 9876543210" |
| upi_id | text | Required for group creation. Format: "user@bankhandle" |
| preferred_payment_app | text | Required. One of: gpay, phonepe, paytm, fampay, cred, amazonpay |
| honesty_score | integer | 0-100, default 100 |
| allow_friends_add_to_group | boolean | Default true |
| equipoints | integer | Default 0 |

#### groups

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| name | text | NOT NULL |
| description | text | Optional |
| emoji | text | Default 'users'. Can be icon name or image URL |
| mode | text | 'regular' or 'trip' |
| personality | text | 'chill', 'formal', or 'roast' |
| invite_code | text | UNIQUE, 6-char alphanumeric |
| is_active | boolean | Default true. Set false on termination |
| terminated_at | timestamptz | Null until terminated |
| trip_ended | boolean | Default false. Admin toggle for trip groups |
| debt_limit | integer | Optional. Max debt before blocking splits |
| member_limit | integer | Default 30. Max members allowed in the group |
| join_mode | text | 'open' or 'request'. Default 'open' |
| invite_code_expires_at | timestamptz | Expiry time for the invite code (24h after generation) |
| created_by | uuid | FK to profiles. The admin/owner |

#### group_members

| Column | Type | Notes |
|--------|------|-------|
| group_id | uuid | FK to groups (CASCADE) |
| user_id | uuid | FK to profiles (CASCADE) |
| role | text | 'admin' or 'member' |
| joined_at | timestamptz | Auto-set |
| left_at | timestamptz | NULL while active; set to timestamp when member leaves (soft-delete) |
| | | UNIQUE(group_id, user_id) |

#### expenses

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| group_id | uuid | FK to groups (CASCADE) |
| paid_by | uuid | FK to profiles |
| title | text | NOT NULL |
| amount | decimal(12,2) | NOT NULL, > 0. Stored in INR (auto-converted if foreign currency) |
| original_currency | text | Original currency code (e.g., 'AUD'). NULL if INR |
| original_amount | decimal(12,2) | Original amount in foreign currency. NULL if INR |
| category | text | Default 'other' |
| split_type | text | 'equal', 'percentage', 'exact', 'itemwise' |
| proof_url | text | URL in Supabase Storage |
| receipt_url | text | Optional alternative URL |
| date | date | Default current_date |

#### expense_splits

| Column | Type | Notes |
|--------|------|-------|
| expense_id | uuid | FK to expenses (CASCADE) |
| user_id | uuid | FK to profiles |
| amount | decimal(12,2) | The user's share |
| percentage | decimal(5,2) | Only for percentage splits |
| | | UNIQUE(expense_id, user_id) |

#### settlements

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| group_id | uuid | FK to groups (CASCADE) |
| from_user | uuid | FK to profiles (the payer) |
| to_user | uuid | FK to profiles (the creditor) |
| amount | decimal(12,2) | NOT NULL, > 0 |
| status | text | 'pending', 'completed', 'cancelled' |
| payment_mode | text | 'razorpay' or null |
| razorpay_order_id | text | From Razorpay order creation |
| razorpay_payment_id | text | From Razorpay payment capture |
| settled_at | timestamptz | When marked completed |

#### Additional Tables

- **expense_reactions**: Emoji reactions on expenses. UNIQUE(expense_id, user_id, emoji).
- **expense_issues**: Conflicts raised on expenses. Status: 'open'/'resolved'.
- **notifications**: In-app notifications with type, title, message, is_read flag.
- **friendships**: Friend relationships. Status: 'pending'/'accepted'.
- **group_invites**: Group invitations. Status: 'pending'/'accepted'/'rejected'.
- **push_subscriptions**: Web Push and FCM endpoints. Type: 'web'/'fcm'.
- **honesty_events**: Logged events affecting honesty score (settlement_ontime, dispute_valid, etc.).
- **user_badges**: Earned badges with active/revoked status and score.
- **trip_spend_limits**: Personal per-group spending limits.
- **equipoints_log**: EquiPoints earning history.
- **group_join_requests**: Join requests for groups in 'request' mode. Status: 'pending'/'accepted'/'rejected'. UNIQUE(group_id, user_id).

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- **Profiles**: Anyone can SELECT (public). Only own profile can UPDATE/INSERT.
- **Groups**: Any authenticated user can SELECT. Only the creator can INSERT. Only admins can UPDATE.
- **Group Members**: Any authenticated user can SELECT. Users can INSERT themselves. Existing members can add others.
- **Expenses**: Only group members can SELECT/INSERT. Only the payer can UPDATE. Additionally, the payer can always SELECT their own expenses even after leaving the group. INSERT is blocked for past members (`left_at IS NOT NULL`).
- **Expense Splits**: Only group members of the parent expense's group can SELECT/INSERT. Additionally, users can always SELECT their own splits even after leaving the group. INSERT is blocked for past members.
- **Settlements**: Only group members can SELECT/INSERT. Only from_user or to_user can UPDATE. Additionally, settlement parties (from_user or to_user) can always SELECT their own settlements even after leaving the group. INSERT is blocked for past members.
- **Expense Reactions**: Group members can SELECT/INSERT. Users can DELETE their own reactions. INSERT is blocked for past members.

### Realtime

Supabase Realtime is enabled on: `expenses`, `settlements`, `expense_reactions`.

### Database Trigger

`on_auth_user_created` fires AFTER INSERT on `auth.users`, calling `handle_new_user()` to auto-create a profiles row with id, email, full_name (from metadata or email prefix), and avatar_url.

---

## 4. Authentication System

### Architecture

Authentication uses Supabase Auth with cookie-based session management via `@supabase/ssr`.

Three Supabase client types are used depending on context:

| Client | File | Used In | Cookie Access |
|--------|------|---------|--------------|
| Browser | `lib/supabase/client.ts` | Client Components | Automatic (browser) |
| Server | `lib/supabase/server.ts` | Server Components, Route Handlers | Read via `cookies()` |
| Middleware | `lib/supabase/middleware.ts` | Middleware | Read/write on Request/Response |

### Middleware Auth Guard

`middleware.ts` runs on every request (except static assets). It:

1. Creates a middleware Supabase client with cookie read/write capability.
2. Calls `supabase.auth.getUser()` to refresh the session token.
3. Protected routes (`/dashboard`, `/groups`, `/profile`): redirects unauthenticated users to `/login`.
4. Auth routes (`/login`, `/signup`): redirects authenticated users to `/dashboard`.
5. Returns the response with updated session cookies.

### OAuth Flow

Google OAuth uses the PKCE flow:

1. Client calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with a `redirectTo` URL.
2. Supabase redirects to Google's consent screen.
3. Google redirects back to `/auth/callback` with a `code` parameter.
4. The callback route handler calls `supabase.auth.exchangeCodeForSession(code)`.
5. On success, redirects to `/dashboard`.

For native Android (Capacitor), the redirect URL uses the custom scheme `equilibrium://auth/callback`, handled by `app/native-callback/page.tsx` which exchanges the code on the client side.

### Session Management

- Sessions are stored in cookies (not localStorage) for SSR compatibility.
- The middleware refreshes tokens on every request.
- `onAuthStateChange` listener in the main layout redirects to `/login` on `SIGNED_OUT`.

---

## 5. Supabase Client Architecture

Four distinct Supabase clients exist, each for a different execution context:

### Browser Client (`lib/supabase/client.ts`)
```typescript
import { createBrowserClient } from '@supabase/ssr'
createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```
Used in all client components. Manages session cookies automatically via the browser.

### Server Client (`lib/supabase/server.ts`)
```typescript
import { createServerClient } from '@supabase/ssr'
// Uses Next.js cookies() for read, try/catch on write (fails in Server Components)
```
Used in Server Components and Route Handlers. Can read cookies but writing may silently fail in Server Components (middleware handles refresh).

### Middleware Client (`lib/supabase/middleware.ts`)
```typescript
// Custom cookie handler that reads/writes on both request and response
createServerClient(url, key, { cookies: { getAll, setAll } })
```
The only client that can both read and write cookies reliably. Used exclusively in middleware for session refresh.

### Admin Client (`lib/supabase/admin.ts`)
```typescript
import { createClient } from '@supabase/supabase-js'
createClient(url, SERVICE_ROLE_KEY)
```
Bypasses RLS. Used in webhooks and server-side operations that need unrestricted database access (e.g., Razorpay webhook creating settlements).

---

## 6. Razorpay Payment Integration

### Overview

Razorpay handles all monetary transactions in Equilibrium. The flow is designed to prevent orphan records: no settlement record is created until payment is confirmed.

### Server-Side Setup (`lib/razorpay.ts`)

```typescript
import Razorpay from 'razorpay'
const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})
```

### Payment Flow

#### Step 1: Order Creation (`POST /api/payments/create-order`)

Client sends: `{ amount, toUserId, groupId, fromName, toName, toUpiId }`

Server:
1. Authenticates the user via Supabase session.
2. Creates a Razorpay order with amount in paisa (amount * 100), receipt as `settlement_{timestamp}`, and notes containing group_id, from_user, to_user, from_name, to_name, amount.
3. Returns: `{ orderId, amount, currency, keyId, toUpiId, meta }`.
4. No database record is created at this point.

#### Step 2: Client-Side Checkout

The client loads the Razorpay checkout script and opens the payment modal with prefilled user details (name, email, phone, UPI VPA). The user completes payment via UPI, card, net banking, or any Razorpay-supported method.

#### Step 3: Verification (`POST /api/payments/verify`)

Client sends: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, groupId, toUserId, amount }`

Server:
1. Verifies the HMAC-SHA256 signature: generates expected signature from `order_id|payment_id` using the key secret, compares with received signature.
2. Checks if settlement already exists by razorpay_order_id (webhook may have already created it).
3. If exists: updates status to `completed`.
4. If not: creates new settlement record with status `completed`, payment mode `razorpay`.
5. Sends push notification to the payee.

#### Step 4: Webhook Backup (`POST /api/payments/webhook`)

Razorpay sends webhook events for `payment.captured` and `payment.authorized`:

1. Verifies webhook signature using `RAZORPAY_WEBHOOK_SECRET`.
2. Extracts order details from the payment entity's notes.
3. Creates or updates the settlement record.
4. Uses the admin Supabase client (no user session in webhooks).

This ensures that even if the client-side verify call fails (network issues, app crash), the settlement is still recorded.

### Why No Settlement on Order Creation

If a settlement record was created during order creation and the user canceled the payment, there would be an orphan "pending" settlement in the database. By deferring record creation to verification/webhook, only confirmed payments produce records.

---

## 7. Settlement Algorithm

Located in `lib/utils/settlement.ts`. Uses a graph-based approach to minimize the number of settlement transactions.

### Building Debt Edges (`buildDebtEdges`)

1. For each expense, each split creates a debt: the split participant owes the payer their share (skipping self-splits).
2. Debts are aggregated per directional pair (A to B combined).
3. Completed settlements reduce the corresponding debt edges.
4. Bidirectional netting: if A owes B 500 and B owes A 200, the net result is A owes B 300.
5. Tracks the age (in days) of the oldest expense contributing to each debt direction.

### Optimal Settlements (`getOptimalSettlements`)

Greedy algorithm:

1. Calculate net balance per user from all debt edges.
2. Separate into creditors (positive balance) and debtors (negative balance).
3. Sort both by descending absolute amount.
4. Match the largest debtor with the largest creditor, transfer the minimum of the two amounts, adjust balances, remove zeroed-out users.
5. This reduces a dense graph to at most N-1 transactions.

### Cheapest Settlements (`getCheapestSettlements`)

Extension that defers small recent debts:

1. For each debt edge under a threshold (default 50 INR) where the oldest contributing expense is less than 7 days old, the debt is carried forward.
2. Older small debts (7+ days) are still included.
3. Returns `{ settlements, carriedForward }`.

### INR Formatting (`formatINR`)

Custom Indian number system formatter: last 3 digits form one group, then every 2 digits form subsequent groups (e.g., 1234567 becomes 12,34,567).

### UPI Deep Link

Generates `upi://pay?pa={payeeUpiId}&pn={payeeName}&am={amount}&cu=INR&tn={note}` for direct UPI app launches.

---

## 8. Honesty Score Engine

Location: `GET /api/honesty` (calculation), `POST /api/honesty` (event logging).

### Composite Score Formula

The honesty score is a weighted composite from 0 to 100:

```
raw = 0.4 * onTimeRate + 0.3 * completionRate + 0.15 * disputeFactor + 0.15 * proofRate
final = clamp(raw * 100 + eventBonus, 0, 100)
```

### Component Calculations

**On-Time Rate (40%)**:
- On-time = settled within 48 hours with no reminders. Weight: 1.0.
- Near-on-time = settled within 24 hours (even with reminders). Weight: 0.8.
- Formula: (onTime * 1.0 + nearOnTime * 0.8) / totalSettlements.
- Default (no data): 0.5.

**Completion Rate (30%)**:
- completed / (total + oldPending * 0.5).
- Old pending = settlements pending more than 7 days.
- Default: 0.5.

**Dispute Factor (15%)**:
- Starts at 1.0.
- Each valid dispute against you: -0.05 (-0.02 if fixed under 1 hour).
- 3+ disputes: additional -0.10 pattern penalty. 6+: additional -0.15.
- Invalid disputes you raised: -0.03 each (capped at 0.20 total).

**Proof Rate (15%)**:
- expensesWithProof / totalExpenses.
- Default: 0.5.

### Event Bonus

Sum of all honesty_events points divided by a scale factor, multiplied by 15, capped at +/-15:

| Event | Points |
|-------|--------|
| settlement_ontime | +10 |
| settlement_within_24h | +5 |
| settlement_with_proof | +3 |
| clean_settlement | +1 |
| expense_with_proof | +2 |
| settlement_late | -8 |
| dispute_valid | -15 |
| dispute_invalid | -10 |
| dispute_creator_quick_fix | -5 |
| partial_unpaid | -5 |
| dispute_pattern | -20 |

### Deduplication

Same event_type + user + group within 1 hour is blocked (except settlement_ontime and settlement_within_24h).

### New User Default

If all data points are zero (brand new user), the score defaults to 75.

---

## 9. Badge Evaluation System

Location: `GET /api/badges?evaluate=true`.

### Badge Definitions

Five badges, each with multi-condition evaluation:

**Backbone** (top contributor):
- Conditions: 2+ expenses paid, 30%+ of group total, highest payer in at least 1 group.
- Score: (yourExpenses / totalExpenses) * 100. Threshold: >= 30.

**On-Time Legend** (punctual payer):
- Conditions: 2+ completed settlements, 70%+ without reminders, no pending > 6 hours.
- Score: onTimeRate * 100. Threshold: >= 70.

**Split Master** (active tracker):
- Conditions: 3+ total expenses, 1+ active group, 1+ expense in last 6 hours.
- Score: min(100, (total/3)*50 + (recent/1)*50). Threshold: >= 80.

**Debt Destroyer** (fast settler):
- Conditions: 2+ completed settlements, average settle time <= 12 hours, no pending > 6 hours.
- Score: max(0, 100 - avgHours*4). Threshold: >= 52.

**Trusted** (high integrity):
- Conditions: 2+ settlements, honesty >= 75, <= 2 disputes, no pattern penalties.
- Score: honesty score adjusted by disputes. Threshold: >= 75.

### Badge Lifecycle

```
Not Earned  -->  [meets criteria]  -->  Earned (active, notification sent)
Earned      -->  [still meets]     -->  Score updated
Earned      -->  [no longer meets] -->  Revoked (notification sent)
Revoked     -->  [1-hour cooldown] -->  Can re-earn
```

All evaluations use a rolling 2-day window (relaxed from 90 days for demo purposes).

---

## 10. Notification Pipeline

### Architecture

Notifications flow through a two-layer system:

1. **In-app notification**: Inserted into the `notifications` table (stored, persistent, read/unread state).
2. **Push notification**: Sent via Web Push or FCM (ephemeral, delivered to device).

Both are triggered by the `notifyUser()` utility function in `lib/utils/notify.ts`:

```typescript
async function notifyUser({ supabase, userId, fromUserId, type, title, message, groupId, url }) {
  // 1. Insert into notifications table
  await supabase.from('notifications').insert({...})
  // 2. Fire push notification (non-blocking, best-effort)
  sendPushToUser(userId, title, message, url).catch(() => {})
}
```

### Notification Types

| Type | Trigger |
|------|---------|
| reminder | Debt reminder sent |
| payment | Payment received via Razorpay |
| settlement | Settlement completed |
| friend_request | Friend request sent |
| friend_accepted | Friend request accepted |
| group_invite | Group invitation sent |
| group_added | Directly added to group |
| expense_added | New expense in group |
| badge_earned | Badge earned |
| badge_revoked | Badge revoked |
| equipoints | EquiPoints earned |

---

## 11. Push Notification Infrastructure

### Web Push (Browser)

Uses the `web-push` library with VAPID keys.

**Registration** (`components/PWAInitializer.tsx`):
1. Service worker registers and reaches `ready` state.
2. Checks for existing push subscription.
3. If none: requests notification permission, calls `registration.pushManager.subscribe()` with the VAPID public key.
4. Sends subscription (endpoint, p256dh, auth keys) to `POST /api/push/subscribe`.

**Sending** (`lib/utils/notify.ts`):
- Uses `webPush.sendNotification()` with VAPID credentials.
- Payload is JSON: `{ title, body, url }`.

**Receiving** (`public/sw.js`):
- Parses push event data as JSON.
- Shows notification with vibrate pattern, icon, and open/dismiss actions.
- On click: focuses existing window or opens new one, navigates to the payload URL.

### FCM (Native Android)

Uses `firebase-admin` SDK.

**Registration** (`components/NativePushInitializer.tsx`):
1. Detects Capacitor environment.
2. Requests push permissions via `@capacitor/push-notifications`.
3. On registration event: sends FCM token to `POST /api/push/subscribe` with `type: 'fcm'`.

**Sending** (`lib/utils/notify.ts`):
- Uses Firebase Admin `getMessaging().send()` with high priority and the `equilibrium_default` notification channel.

### Token Cleanup

Both Web Push and FCM handle expired/invalid tokens:
- 410 Gone, 404 Not Found, and token-expired errors trigger deletion of the push subscription from the database.
- This prevents repeated failed sends to stale endpoints.

---

## 12. Personality-Driven Text Generation

### Architecture

Each group has a `personality` field: `chill`, `formal`, or `roast`. This drives the tone of all system-generated text.

### Text Templates

Three JSON files in `lib/data/`:

- **alert-texts.json**: Notification messages for events (expense added, member joined, group terminated). Organized by event_type, then vibe, then array of templates.
- **reminder-texts.json**: Debt reminder messages organized by vibe.
- **group-contributor-texts.json**: Top contributor descriptions organized by vibe.

### Template Variables

Texts use `{variable}` placeholders: `{debtor}`, `{creditor}`, `{amount}`, `{group}`, `{reminder_count}`, `{days_pending}`.

### Weighted Random Selection

```typescript
function pickWeightedRandom(texts: string[], category: string): string
```

In-memory usage tracking per category. Less-used texts get higher selection weight. Auto-normalizes counts to prevent overflow. This ensures variety -- the same reminder text is not repeated back-to-back.

### Example Outputs

For a reminder where Rahul owes Priya 500 INR:

- **Chill**: "Bro Rahul, 500 ka scene hai Trip mein. Jab free ho bhej dena."
- **Formal**: "Hi Rahul, this is a gentle reminder about your outstanding balance of 500 in Trip."
- **Roast**: "Rahul still holding on to that 500? At this rate I'm charging interest."

---

## 13. File Upload and Storage

### Upload API (`POST /api/upload`)

1. Accepts `multipart/form-data` with a `file` field.
2. Validates file type: image/jpeg, image/png, image/webp, image/heic, application/pdf.
3. Validates file size: maximum 10 MB.
4. Generates storage path: `{userId}/{timestamp}.{extension}`.
5. Uploads to Supabase Storage bucket `proofs`.
6. Returns the public URL.

### Storage Bucket Configuration

The `proofs` bucket is public. RLS policies:
- **Upload**: Users can only upload to their own folder (`{userId}/`).
- **Read**: Anyone can read (public bucket).
- **Delete**: Users can only delete files in their own folder.

### Usage

- **Expense proof**: Uploaded during expense creation. URL stored in `expenses.proof_url`.
- **Group image**: Uploaded during group creation. URL stored in `groups.emoji`.

---

## 14. Service Worker and Caching

### File: `public/sw.js`

**Cache Name**: `equilibrium-v2` (bumped from v1 to force cache invalidation on deployments).

### Precached URLs

On install: `/`, `/dashboard`, `/groups`, `/notifications`, `/profile`, `/icon.svg`.

### Fetch Strategies

| Request Type | Strategy | Behavior |
|-------------|----------|----------|
| API routes (`/api/`) | Network only | Returns 503 with offline message if network fails |
| HTML/navigation | Network first | Fetches from network, caches on success. Falls back to cache, then `/` |
| Static assets | Cache first | Serves from cache immediately, fetches update in background (stale-while-revalidate) |

### Why Network-First for HTML

The app previously used cache-first for HTML, which caused stale UI issues -- users saw old versions of pages after deployments. Network-first ensures the latest HTML is always fetched, with cache as a fallback for offline scenarios only.

### Lifecycle

- **Install**: Caches precache list, calls `skipWaiting()`.
- **Activate**: Deletes old caches (anything not matching current cache name), calls `clients.claim()`.

---

## 15. PWA Configuration

### Manifest (`public/manifest.json`)

- **Name**: "Equilibrium - Group Expenses"
- **Start URL**: `/dashboard`
- **Display**: standalone
- **Theme**: #2563eb (blue)
- **Background**: #0a0a0a (dark)
- **Categories**: finance, utilities, productivity
- **Shortcuts**: "Add Expense" (/groups?action=add-expense), "View Groups" (/groups), "Notifications" (/notifications)
- **Icons**: 192px PNG, 512px PNG, SVG (all maskable)

### Root Layout Meta Tags

- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: black-translucent`
- `viewport: width=device-width, initial-scale=1, maximum-scale=1, user-scalable=false`
- `theme-color: #F07F3C` (orange)

---

## 16. Capacitor Native App

### Configuration (`capacitor.config.ts`)

- **App ID**: `com.equilibrium.app`
- **Server URL**: `https://equilibrium-app-three.vercel.app` (WebView points to deployed app)
- **Allowed Navigation**: Vercel domain + `*.supabase.co`
- **Push Plugin**: badge, sound, alert presentation options

### How It Works

The Android app is a WebView that loads the Vercel-deployed web app. This means:
- No local web build is needed in the APK.
- Updates are instant (deploy to Vercel, app shows new version).
- The native shell provides: FCM push notifications, custom URL scheme handling, and app store presence.

### OAuth in Native Context

Google OAuth redirects use the custom scheme `equilibrium://auth/callback`. The `native-callback` page handles the token exchange client-side since the server callback cannot redirect to a custom scheme.

### Release Signing

The APK is signed with `equilibrium-release.jks` for Play Store distribution.

---

## 17. API Route Reference

All API routes are located under `app/api/`. Every route authenticates the user via Supabase session (except the Razorpay webhook which uses signature verification).

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/payments/create-order` | POST | Create Razorpay order |
| `/api/payments/verify` | POST | Verify payment signature, create settlement |
| `/api/payments/webhook` | POST | Razorpay webhook handler |
| `/api/expenses/notify` | POST | Notify group of new expense |
| `/api/expenses/issues` | GET, POST, PATCH, DELETE | Expense conflict CRUD |
| `/api/expenses/edit` | PATCH | Edit conflicted expense |
| `/api/expenses/proof` | POST | Attach proof URL to expense |
| `/api/groups/notify` | POST | Notify group of events (terminate, leave, join) |
| `/api/group-invites` | GET, POST, PATCH | Invite management |
| `/api/friends` | GET, POST, PATCH, DELETE | Friend request CRUD + search |
| `/api/notifications` | GET, POST, PATCH | In-app notification CRUD |
| `/api/push/subscribe` | POST, DELETE | Save/remove push subscription |
| `/api/push/send` | POST | Send push notification |
| `/api/push/status` | GET, DELETE | Check/clean push subscriptions |
| `/api/reminders` | POST | Send rate-limited debt reminder |
| `/api/honesty` | GET, POST | Calculate honesty score / log event |
| `/api/badges` | GET | Evaluate and return badges |
| `/api/equipoints` | GET, POST | Get balance / award points |
| `/api/group-requests` | GET, PATCH | Join request management (list pending, accept/reject) |
| `/api/notifications/send` | POST | Send notification to group admins (for join requests) |
| `/api/cron/reminders` | GET | Automated cron job for debt reminders (secured via CRON_SECRET) |
| `/api/settings` | GET, PATCH | User privacy settings |
| `/api/upload` | POST | File upload to Supabase Storage |
| `/api/trip/spend-limit` | GET, POST, DELETE | Personal trip spend limit |

---

## 18. State Management

### Zustand Store (`lib/store.ts`)

A minimal global state store:

```typescript
interface AppState {
  user: Profile | null
  setUser: (user: Profile | null) => void
  groups: Group[]
  setGroups: (groups: Group[]) => void
  activeGroup: GroupWithMembers | null
  setActiveGroup: (group: GroupWithMembers | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}
```

Most pages fetch data directly from Supabase on mount rather than relying on the global store. The store is used for cross-component data sharing where prop drilling would be impractical.

---

## 19. Currency Formatting

All amounts are displayed in Indian Rupees (INR) using a custom formatter that follows the Indian number system:

```
1234       -->  1,234
12345      -->  12,345
123456     -->  1,23,456
1234567    -->  12,34,567
```

The pattern: last 3 digits form one group, then every 2 digits form subsequent groups. This is different from the Western system (groups of 3).

Amounts in the database use `decimal(12,2)` for paisa precision. Razorpay expects amounts in paisa (multiply by 100).

---

## 20. Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `NEXT_PUBLIC_SITE_URL` | Deployed app URL (for OAuth redirects) |
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | VAPID private key for Web Push |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK service account (JSON string) |

---

## 21. Deployment

### Vercel

The app is deployed on Vercel at `equilibrium-app-three.vercel.app`.

- **Build command**: `next build`
- **Framework**: Next.js (auto-detected)
- **Serverless functions**: All API routes run as Vercel Serverless Functions.
- **Edge middleware**: The auth middleware runs at the edge.
- **Environment variables**: All secrets configured in Vercel's environment settings.

### Supabase

- Hosted Supabase project for database, auth, storage, and realtime.
- Schema managed via SQL migration files (`supabase-*.sql`).
- Storage bucket `proofs` configured as public.

### Razorpay

- Webhook URL configured in the Razorpay dashboard pointing to the `/api/payments/webhook` endpoint.
- Test mode keys can be used for development.

### Android (Capacitor)

- APK built from the `android/` directory using Android Studio.
- WebView points to Vercel deployment.
- Push notifications require `google-services.json` from Firebase Console.
- Release signing uses `equilibrium-release.jks`.
