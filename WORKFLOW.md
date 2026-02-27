# Equilibrium -- Complete Application Workflow

Equilibrium is a mobile-first group expense management application built for Indian friend groups. It handles splitting bills, settling debts via Razorpay UPI payments, tracking honesty scores, and managing group dynamics with personality-driven notifications.

This document covers every user-facing workflow from first launch to advanced features.

---

## Table of Contents

1. [First Launch and Splash Screen](#1-first-launch-and-splash-screen)
2. [Authentication](#2-authentication)
3. [Profile Setup](#3-profile-setup)
4. [Dashboard](#4-dashboard)
5. [Group Creation](#5-group-creation)
6. [Joining a Group](#6-joining-a-group)
   - [Via Invite Code](#61-via-invite-code)
   - [Via In-App Invitation](#62-via-in-app-invitation)
   - [Via QR Code](#63-via-qr-code)
   - [Via Direct Add by a Friend](#64-via-direct-add-by-a-friend)
   - [Rejoining a Past Group](#65-rejoining-a-past-group)
   - [Join Request Mode](#66-join-request-mode)
7. [Group Detail and Tabs](#7-group-detail-and-tabs)
8. [Adding Expenses](#8-adding-expenses)
   - [Past Members & Past Groups](#past-members--past-groups)
9. [Expense Interactions](#9-expense-interactions)
10. [Balances and Debt Calculation](#10-balances-and-debt-calculation)
11. [Settlement and Payments](#11-settlement-and-payments)
12. [Group Lifecycle Rules](#12-group-lifecycle-rules)
13. [Trip Mode](#13-trip-mode)
14. [Friends System](#14-friends-system)
15. [Notifications and Reminders](#15-notifications-and-reminders)
16. [Honesty Score](#16-honesty-score)
17. [Badges](#17-badges)
18. [EquiPoints and Gamification](#18-equipoints-and-gamification)
19. [Settings](#19-settings)
20. [PWA and Native App](#20-pwa-and-native-app)

---

## 1. First Launch and Splash Screen

When a user opens Equilibrium for the first time:

1. A **video splash** plays (`Equilibrium.mp4`) -- a short branding animation.
2. After the video ends, the app logo (`frame.png`) stays displayed as the background.
3. Two buttons fade in over the logo:
   - **"Get Started -- It's Free"** -- navigates to the signup page.
   - **"I already have an account"** -- navigates to the login page.
4. When a button is clicked, a transition flag is set in the browser. On the destination page (login or signup), the logo image starts fullscreen and **shrinks down** into the small app logo position in the header, creating a smooth visual transition between the splash and the auth page.

If the user is already logged in, the landing page redirects straight to the dashboard.

---

## 2. Authentication

### 2.1 Email and Password Signup

1. User enters **Full Name**, **Email**, and **Password** (minimum 6 characters).
2. On submit, an account is created and a **confirmation email** is sent.
3. The user sees a confirmation screen: "Check your email -- We've sent you a confirmation link. Click it to activate your account." with a warning to check spam/junk folders.
4. After clicking the email link, the user is verified and can log in.

### 2.2 Email and Password Login

1. User enters email and password.
2. On success, they are redirected to the dashboard.
3. On failure, an error message is shown (e.g., "Invalid login credentials").

### 2.3 Google OAuth Login

1. User clicks "Continue with Google" on either the login or signup page.
2. They are redirected to Google's consent screen.
3. After granting access, Google redirects back to `/auth/callback` with an authorization code.
4. The server exchanges the code for a session and redirects to the dashboard.
5. If the user is new, a profile is automatically created using their Google name and avatar.

### 2.4 Native App Authentication

On the Android app (Capacitor), Google OAuth redirects to a custom URL scheme (`equilibrium://auth/callback`). The native callback page handles the code exchange on the client side and redirects to the dashboard.

### 2.5 Route Protection

- Unauthenticated users trying to access `/dashboard`, `/groups`, `/profile`, or any protected route are redirected to `/login`.
- Authenticated users trying to access `/login` or `/signup` are redirected to `/dashboard`.
- On logout, all sessions are cleared and the user is sent to `/login`.

---

## 3. Profile Setup

After first login, the user lands on the dashboard. However, their profile is incomplete until they provide:

- **UPI ID** (required) -- validated against the format `username@bankhandle` (e.g., `rahul@okaxis`).
- **Preferred Payment App** (required) -- one of: Google Pay, PhonePe, Paytm, FamPay, CRED, Amazon Pay.

### What happens if the profile is incomplete:

- The profile page shows a warning card: "Complete Your Profile -- Add your UPI ID & payment app to create or join groups."
- The edit form opens automatically. The Cancel button is hidden so the user must fill in the required fields.
- When a user tries to **create a group**, they are redirected to `/profile?return=/groups/new` to complete their profile first. After saving, they are redirected back to group creation.

### Additional profile fields:

- **Full Name** -- editable, pre-filled from signup or Google.
- **Phone Number** -- optional, with country code selector (16 country codes supported). Format: `+91 9876543210`.
- **Avatar** -- pulled from Google OAuth or default. Not directly editable on the profile page.

### Profile page also displays:

- **Honesty Score** -- a trust rating out of 100, with provisional indicator if fewer than 5 settlements.
- **Badges** -- earned trust/activity badges.
- **Push Notification controls** -- status check, re-register, test notification, cleanup of old subscriptions.
- **Activity History** -- link to full activity feed.
- **Logout** button.

---

## 4. Dashboard

The dashboard is the home screen after login. It displays:

### 4.1 Greeting Header
- Time-based greeting: "Good Morning", "Good Afternoon", or "Good Evening".
- User's first name.
- Count of active groups.
- Tappable avatar that opens a profile menu with links to Profile, Friends, and Settings.

### 4.2 Balance Card
- **Net Balance** -- the difference between what you're owed and what you owe.
- **"You're owed"** -- total amount others owe you across all active groups.
- **"You owe"** -- total amount you owe others across all active groups.
- Terminated groups are excluded from balance calculations.
- A **collapsible balance bar** appears at the top when the main balance card scrolls out of view.

### 4.3 Settlements Sidebar
- A vertical "SETTLEMENTS" label on the right side that links to the full settlements history page.

### 4.4 Pending Invites
- If the user has been invited to groups, each invite shows the group name, emoji/icon, and who invited them.
- Two action buttons per invite: Accept or Reject.
- Accepting an invite navigates to the group.

### 4.5 Groups Grid
- A 2-column grid showing up to 6 groups.
- Groups with custom images get a tall tile (row-span-2). Icon-based groups get a short horizontal tile.
- Each tile shows the group name and a small mode indicator icon (plane for trip, house for regular).
- Terminated groups are hidden from the grid.
- Groups with images are sorted first.
- "See all" link navigates to the full groups list.

### 4.6 Recent Activity
- Last 5 expenses across all groups.
- Each entry shows a category icon, expense title, who paid, and the amount.
- "See all" link navigates to the full activity feed.

---

## 5. Group Creation

Group creation is a 3-step wizard:

### Step 1 -- Basic Info
- **Group Icon**: Choose from 10 preset icons (Users, Home, Plane, GraduationCap, UtensilsCrossed, Briefcase, PartyPopper, Tent, Gamepad2, Dumbbell) or upload a **custom image**.
- **Group Name**: Required. Examples: "Flat 402", "Goa Trip Jan'26".
- **Description**: Optional.

### Step 2 -- Mode and Personality
- **Group Type**:
  - **Regular** -- for ongoing expenses like roommates, flat sharing. The group persists until manually terminated.
  - **Trip** -- for temporary groups. Has special features like day-wise timeline, trip recap, spend limits, and auto-close after settlement.
- **Notification Vibe** (personality):
  - **Chill** -- Hinglish, friendly, casual reminder tone.
  - **Formal** -- Professional, polite reminders.
  - **Roast** -- Savage but fun. Aggressive reminder language.

### Step 3 -- Invite Friends
- The group is created with a unique 6-character invite code (e.g., `A3F7KN`).
- The user's friends list is loaded. For each friend:
  - If the friend allows direct group addition: an **"Add"** button directly adds them to the group.
  - If the friend requires invite approval: an **"Invite"** button sends an in-app invitation.
- Invite code can be copied to clipboard.
- "Share via WhatsApp" button shares the invite code.
- "Go to Group" button navigates to the newly created group.

### Rules:
- The creator becomes the group **admin** (owner).
- Profile must be complete (UPI ID + payment app) before creating a group.

---

## 6. Joining a Group

There are three ways to join a group:

### 6.1 Via Invite Code
- On the group creation page, toggle to "Join Existing".
- Enter the invite code (minimum 4 characters, auto-uppercased).
- If valid: the user is added as a member.
- If already a member: redirected to the existing group.
- If invalid: error message shown.

### 6.2 Via In-App Invitation
- Someone invites the user from the group's invite friends modal.
- The invitation appears on the dashboard under "Pending Invites" and in the Notifications page.
- User can Accept or Reject.

### 6.3 Via QR Code
- Each group has a QR code accessible from the group detail page header (QR icon button).
- The QR code encodes the group invite code.
- Scanning is done from the **Scanner page** (center FAB on the bottom nav).
- The scanner uses the device camera with corner bracket overlay and scan line animation.
- Users can also upload a QR code image from their gallery.
- After scanning, a group preview modal shows group name, emoji, member count, and a "Join" button.
- If already a member, redirects to the existing group.
- **QR Code Expiry**: Invite codes expire **24 hours** after generation. Expired codes show a notice and the admin can regenerate the code with a "Refresh" button. Scanning an expired code shows an error message.

### 6.4 Via Direct Add by a Friend
- If the user's setting "Let friends add you to groups" is enabled, friends can add them directly without requiring acceptance.
- The user receives a notification: "Added to Group".

### 6.5 Rejoining a Past Group
- If a user previously left a group, they can rejoin via invite code or QR code.
- An amber hint is displayed: "You previously left this group. Rejoin to see all activity again."
- The "Join Group" button text changes to "Rejoin Group".
- On rejoin, the user's `left_at` timestamp is cleared (set to NULL), restoring them to active membership.
- All historical data (expenses, settlements, reactions) becomes visible again.
- The group moves from the "Past Groups" section back to the active groups list.

### 6.6 Join Request Mode
- Group admins can set the **join mode** to either **Open** (default) or **Request** from the group settings.
- **Open mode**: Anyone with the invite code or QR code can join directly.
- **Request mode**: Users who try to join see a "Request to Join" button instead of "Join Group".
  - Submitting a request creates a `group_join_requests` record with status `pending`.
  - All group admins are notified of the new join request.
  - Admins see pending requests in their notifications and can **Accept** or **Reject** each request.
  - On acceptance: the user is added as a member and notified.
  - On rejection: the user is notified that their request was declined.
  - If the user previously left the group and the group is in request mode, they still see a rejoin option.
- **Member Limit**: Groups have a configurable member limit (default 30, set by admin in group settings). When the limit is reached, new members cannot join. The limit is enforced on both direct joins and request approvals.

---

## 7. Group Detail and Tabs

The group detail page is the main workspace for a group. It has a header and three tabs.

### Header
- Group icon/image, name, trip badge (if applicable), terminated badge (if applicable), **LEFT** badge (if current user has left).
- Active member count (plus past member count if any, e.g. "3 members · 1 left") and personality label.
- Copy invite code button (hidden if user has left).
- Settings gear button (opens the settings modal).
- **"You left this group"** banner shown below the header when the current user is a past member, with the date they left.

### Three Tabs:

#### 7.1 Expenses Tab
- **Add Expense** button (hidden if the group is terminated **or user has left**).
- Lists all expenses ordered by date.
- **Past members** who left the group still see expense data, but **only expenses created on or before their `left_at` timestamp**. Anything added after they left is hidden.
- **Trip mode** uses a day-wise timeline view ("Day 1", "Day 2", etc.) with daily totals.
- **Regular mode** uses a flat list with category icons, expense title, payer name, relative date, amount, and split type label.
- Conflicted expenses (with open issues) show a yellow border, "Conflicted" badge, and a strikethrough on the amount.
- A **category pie chart** (trip mode) shows spending breakdown by category.

#### 7.2 Balances Tab
- Balance cards for each member showing their net position (green = gets back, red = owes, gray = settled).
- Current user's card is highlighted.
- Tapping a balance card opens details showing the itemized per-expense breakdown.
- **"Settle Up"** button if user owes money, leading to the settlement modal (hidden if user has left).
- **"Leave Group"** button for regular groups (not trip mode) (hidden if user has left).
- **"Close Trip & Exit"** button for trip mode when the trip is ended and the user has no debt (hidden if user has left).
- Pending settlements section with manual "Received" confirmation for the payee.
- For past members, settlements are filtered to only those created on or before their `left_at` timestamp.

#### 7.3 Members Tab
- List of **active members** with avatar, name, role badge (admin crown), UPI ID or email.
- Current user gets a "You" badge.
- Triple-dot menu on other members: View Profile, Add/Remove Friend.
- **Past Members** collapsible dropdown: shows members who left the group with reduced opacity, their name/avatar, and a "Left X ago" relative date. Collapsed by default; click to expand.
- **Add/Invite Friends** button (hidden if terminated **or user has left**).
- **Transfer Ownership** button (admin only, visible if other members exist; hidden if user has left).
- Invite code card with WhatsApp share and copy buttons.
- **View Trip Recap** button (trip mode groups).

---

## 8. Adding Expenses

Expense creation is a 2-step wizard:

### Step 1 -- Expense Details
- **Quick Presets**: 6 one-tap presets that auto-fill title and category:
  - Regular: Swiggy Order, Uber Cab, Rent, Electricity Bill, Groceries, Movie Tickets.
  - Trip: Uber/Ola, Hotel Room, Restaurant, Petrol/Diesel, Entry Tickets, Chai/Snacks.
- **Title**: Required. The name of the expense.
- **Amount**: Required. Numeric input with currency symbol. Must be greater than 0.
- **Currency** (Trip mode only): In trip groups, a currency picker appears below the amount field. Users can choose from 20 supported currencies (INR, USD, EUR, GBP, AUD, CAD, SGD, AED, THB, MYR, JPY, KRW, CHF, NZD, LKR, NPR, BDT, IDR, VND, PHP). Each currency shows its flag, full name, symbol, and code. When a foreign currency is selected, a live INR conversion preview appears below the amount. The amount is auto-converted to INR when saved, and the original currency and amount are stored for display. Defaults to INR.
- **Category**: 10 category icons. Regular groups: Food & Drinks, Groceries, Transport, Rent, Utilities, Entertainment, Shopping, Medical, Travel, Other. Trip groups: Food, Stay/Hotel, Cabs & Travel, Activities, Shopping, Tickets/Entry, Fuel, Snacks/Chai, Tips, Other.
- **Paid By**: Select which member paid. Defaults to the current user.
- **Proof**: Optional file upload (image or PDF, max 10MB). Attaching proof earns honesty points.

### Step 2 -- Split Configuration

Three split modes:

| Mode | How It Works | Validation |
|------|-------------|------------|
| **Equal** | Total divided equally among selected members. Shows per-person share. | At least 1 member must be selected. |
| **Percentage** | Each selected member is assigned a percentage. | Percentages must sum to exactly 100%. |
| **Exact** | Each selected member is assigned a fixed amount. | Amounts must sum to the total expense. |

- All members are selected by default. Members can be toggled off (minimum 1 must remain).
- A real-time indicator shows the current total vs. expected total for percentage and exact modes.

### Debt Limit Enforcement
- If the group has a debt limit set (e.g., 500), members whose existing debt exceeds that limit are **blocked** from being split participants. They appear grayed out with "Debt limit reached" text.
- The payer is never blocked (paying an expense reduces their debt).
- Blocked members are automatically removed from the split selection.

### After Saving
- The expense and all splits are inserted into the database.
- If proof was uploaded, it is stored in Supabase Storage and linked to the expense.
- All split participants (except the payer) receive a notification.
- If the expense is 2,000 INR or more, there is a 25% chance of earning EquiPoints.

---

## 9. Expense Interactions

Each expense on the group detail page supports:

### 9.1 Emoji Reactions
- 6 emoji options: thumbs up, laughing, skull, fire, angry, heart.
- Tap to toggle your reaction. Tap again to remove.
- Grouped reaction counts are shown below the expense.

### 9.2 Proof and Receipt
- If a proof file was attached, a "View Proof" link is shown.
- If a receipt URL exists, a "View Receipt" link is shown.

### 9.3 Raise Issue (Conflict)
- Any member except the expense creator can raise an issue on an expense.
- Opening the issue modal requires entering a description (examples: "wrong amount", "not part of this expense", "duplicate entry").
- Once raised, the expense becomes **conflicted**:
  - The expense is excluded from all balance calculations until the issue is resolved.
  - The amount shows with a strikethrough.
  - A yellow "Conflicted" badge appears.
- The expense creator is notified about the issue.

### 9.4 Resolve Issue
- Only the person who raised the issue can resolve it.
- On the issue detail modal, they tap "Resolve" to mark it resolved.
- If resolved within 1 hour: `dispute_creator_quick_fix` honesty event (smaller penalty).
- If resolved later: `dispute_valid` honesty event.

### 9.5 Edit or Delete Conflicted Expenses
- The expense creator can only edit or delete an expense **when it has open issues** (conflicts).
- Editing allows changing: title, amount, category, and proof file.
- After editing, all issue raisers are notified to review and potentially resolve their issues.
- Deleting removes the expense, its splits, reactions, and associated issues.

---

## 10. Balances and Debt Calculation

### How balances are calculated:

1. For every expense in the group, each split creates a debt edge: the split participant owes the payer their share.
2. Completed settlements offset these debts.
3. **Conflicted expenses** (with open issues) are completely excluded from balance calculations.
4. Net balance per member = (total owed to them) - (total they owe).
5. Positive net = gets money back. Negative net = owes money. Zero = all settled.

### Rounding:
- All amounts are calculated to 2 decimal places (paisa precision).
- Equal splits may have rounding differences of a few paisa.

### Balance Detail:
- Tapping a member's balance card shows an itemized per-expense breakdown of who owes whom and how much, with each individual expense listed (category icon, title, amount).

---

## 11. Settlement and Payments

### 11.1 Settlement Modal

Opened from the "Settle Up" button on the Balances tab. Shows:

- All debts the user owes, organized by creditor.
- Each debt shows the creditor's name, avatar, and amount.

Two modes:
- **Settle All**: Shows every debt with a "Pay" button next to each.
- **Custom**: Checkboxes to select specific debts. Shows selected count and total.

### 11.2 Razorpay Payment Flow

When the user taps "Pay" on a debt:

1. **Order Creation**: A Razorpay order is created server-side with the amount in paisa. No settlement record is created yet (prevents orphan records if the user cancels).
2. **Checkout Opens**: The Razorpay checkout modal opens with:
   - Prefilled user details (name, email, phone).
   - Prefilled UPI VPA (the creditor's UPI ID).
   - INR currency.
3. **Payment Options**: The user pays via UPI, card, net banking, or any Razorpay-supported method.
4. **On Success**:
   - The payment signature is verified server-side using HMAC-SHA256.
   - A settlement record is created with status `completed` and payment mode `razorpay`.
   - The creditor receives a push notification: "Payment Received -- {name} paid you X in {group}".
   - Honesty events logged: `settlement_ontime` and `clean_settlement`.
   - EquiPoints: 35% chance of earning 2-15 points.
5. **On Cancel**: Nothing happens. No settlement record is created.
6. **On Failure**: An error message is displayed. The user can retry.

### 11.3 Webhook Handling

Razorpay also sends a webhook for `payment.captured` and `payment.authorized` events. This acts as a backup:
- If the client-side verify call failed but the payment actually went through, the webhook creates or completes the settlement record.
- This prevents money being paid but settlement not being recorded.

### 11.4 Manual Settlement Confirmation

For settlements that appear as "pending":
- The **payee** (person who is owed) sees a "Received" button to manually confirm receipt.
- The **payer** sees a "Confirming..." label.
- Manual confirmation marks the settlement as completed.

### 11.5 Sending Reminders

For people who owe the current user:
- Each creditor entry in the settlement modal has:
  - A custom message text input.
  - A **"Remind"** button -- sends an in-app notification with personality-based text (chill/formal/roast tone based on group settings).
  - A **WhatsApp** button -- opens WhatsApp with a pre-filled message including the amount and group name.
  - A **"Remind All"** button if multiple people owe money.
- **Rate limiting**: A reminder can only be sent once every 12 hours to the same person for the same group. Attempting too soon returns the retry time.

### 11.6 Settlement Optimization

The app computes optimal settlements to minimize the number of transactions:

- **Fastest method**: Greedy algorithm that matches the largest debtor with the largest creditor. Reduces N*(N-1)/2 potential edges to at most N-1 transactions.
- **Cheapest method**: Filters out small recent debts (under 50 INR and less than 7 days old), carrying them forward. Older small debts are still included.

---

## 12. Group Lifecycle Rules

### 12.1 Leaving a Group (Regular Mode)

The Leave Group button is available on the Balances tab and in the Settings modal. The behavior depends on the user's situation:

| Scenario | What Happens |
|----------|-------------|
| **User is the only member** | A "Delete Group" modal appears instead of Leave. Confirming soft-deletes the membership (sets `left_at`) and terminates the group. |
| **User is the admin/owner with other members** | Must transfer ownership first. A modal lists all other members. After selecting a new owner, that member is promoted to admin and the `created_by` field is updated. Then the Leave confirmation appears. |
| **User is a regular member** | The standard Leave Group confirmation modal appears. |

**Leave Requirements:**
- Net balance must be approximately zero (within 0.50 INR tolerance).
- If the user **owes money**: "You still owe money in this group. Please settle your debts before leaving."
- If the user is **owed money**: "Other members still owe you money. Collect or forgive the dues before leaving."
- After leaving, remaining members are notified.

**Soft-Delete Behavior:**
- Leaving a group does **not** delete the `group_members` row. Instead, the `left_at` column is set to the current timestamp.
- The member's profile and name remain visible in expense details and balance breakdowns (no more "Unknown" names).
- The group moves from the user's active groups list to a **"Past Groups"** collapsible section on the groups page.
- When viewing a past group, the user sees a read-only snapshot: expenses and settlements are filtered to only those created on or before their `left_at` date.
- All action buttons (Add Expense, Settle Up, Leave Group, Close Trip, Add Friends, Transfer Ownership) are hidden for past members.
- RLS INSERT policies block past members from creating expenses, splits, settlements, or reactions.

### 12.2 Transfer Ownership

- Only the admin/owner can initiate.
- Available from the Members tab and the Settings modal.
- The transfer modal shows all members **except the current user**.
- After transfer: the selected member becomes admin, `created_by` is updated, and the original owner can then leave.

### 12.3 Terminating a Group

- Only the admin/owner can terminate.
- Available from the Settings modal.
- Requires typing the exact group name as confirmation.
- **Termination is permanent**: sets `terminated_at` timestamp and `is_active` to false.
- After termination:
  - No new expenses can be added.
  - No new members can join.
  - Existing data remains visible.
  - The group appears in the "Terminated" section on the groups list with a "Terminated" badge and reduced opacity.
  - The group is excluded from dashboard balance calculations.
  - All members are notified.

### 12.4 Debt Limit

- The admin can set a **debt limit** (in INR) for the group via Settings.
- When set, any member whose current debt in the group exceeds this limit **cannot be assigned new expense splits** (they are blocked in the split selection with "Debt limit reached").
- This does not prevent them from paying or settling.
- The limit can be updated or removed at any time.

---

## 13. Trip Mode

Trip mode groups have additional features beyond regular groups:

### 13.1 Day-Wise Timeline
- Expenses are grouped by date and displayed as "Day 1", "Day 2", etc.
- Each day shows its date and daily spending total.
- A vertical timeline UI with dots connects the days.

### 13.2 Category Pie Chart
- Visual breakdown of spending by category using a pie chart.
- Color-coded legend with top 5 categories, icons, and INR values.

### 13.3 Trip Spend Limit
- Each user can set a **personal** spend limit for the trip.
- The limit is private (only visible to the user who set it).
- A progress bar shows spending vs. limit:
  - Green: under 80%
  - Warning/amber: 80--99%
  - Red: 100% or over
- Spending is calculated from the user's own expense splits.

### 13.4 Multi-Currency Support
- In trip mode, users can add expenses in any of 20 supported currencies.
- A currency picker appears below the amount field with flag, name, and code for each currency.
- When a non-INR currency is selected:
  - The amount input prefix changes to the selected currency's symbol.
  - A live INR conversion preview appears below the amount (e.g., "≈ ₹275 INR").
  - On save, the `amount` field stores the INR-converted value, while `original_currency` and `original_amount` store the original values.
- In expense lists and detail modals, if the expense was in a foreign currency, the original amount is shown alongside the INR value (e.g., "₹275" with "A$5" below it).
- Balances and settlements always operate in INR.
- Exchange rates are approximate and built-in (no live API).

### 13.4 Closing a Trip

The trip close workflow:

1. The **admin marks the trip as ended** via a toggle in Settings.
2. Once ended, each member sees a **"Close Trip & Exit"** button on the Balances tab.
3. The button is only enabled if the member has **no outstanding debt** (zero or positive balance).
4. Tapping it:
   - Marks all pending settlements as done.
   - Soft-deletes the member (sets `left_at` timestamp) instead of removing them.
   - If no active members remain (all have `left_at` set), the group is deactivated.

If a member is still owed money, a caution is shown to send reminders first.

### 13.5 Trip Recap
- Available from the Members tab.
- Shows: total spent, per-person average, top spender (with crown icon and percentage of total), number of days, number of expenses, top 3 categories by count.
- "Share Recap" button to share via native share or clipboard.

---

## 14. Friends System

### 14.1 Adding Friends
- Navigate to the Friends page via the profile menu.
- Switch to the "Add" tab.
- Search by email address (minimum 3 characters, debounced).
- Results show the user's name, email, avatar, and friend status.
- Tap "Add" to send a friend request.

### 14.2 Friend Requests
- Incoming requests appear on the Friends tab with Accept and Reject buttons.
- Outgoing pending requests show a clock icon.
- Both sender and recipient receive push notifications.

### 14.3 Friend Interactions
- Friends appear in the group invite flow with direct "Add" or "Invite" buttons.
- Friends can be removed (unfriended) from the Friends page.
- On another user's profile page, the friend status is shown with an action button (Add / Request Sent / Accept / Friends).

### 14.4 Mutual Connections
- Viewing another user's profile shows:
  - Mutual groups (groups both users are in).
  - Mutual friends (friends both users share).

---

## 15. Notifications and Reminders

### 15.1 In-App Notifications
- Accessible from the Notifications page (bell icon on bottom nav).
- Types: reminder, payment, settlement, friend request, friend accepted, group invite, group added.
- Each notification has an icon, title, message, sender info, and timestamp.
- Unread notifications are highlighted.
- "Mark all read" button.
- Individual mark-as-read and delete.

### 15.2 Actionable Notifications
- **Group invite**: Accept/Decline buttons inline.
- **Friend request**: Accept/Decline buttons inline.
- **Group-related**: "View Group" link.
- **Friend-related**: "View Friends" link.

### 15.3 Push Notifications
- Supported on both web (VAPID/Web Push) and native Android (FCM via Firebase).
- Push notifications are sent for: expense added, settlement received, friend request, friend accepted, group invite, group added, reminders, badge earned/revoked.
- Tapping a push notification navigates to the relevant page.

### 15.4 Reminder System
- When someone owes you money, you can send a reminder from the settlement modal.
- Reminders use the group's personality setting for tone:
  - **Chill**: "Bro, {amount} ka scene hai {group} mein. Jab free ho bhej dena."
  - **Formal**: "Gentle reminder: you have an outstanding balance of {amount} in {group}."
  - **Roast**: "Still waiting for that {amount}? At this rate I'll collect it at your wedding."
- Rate limited to once per 12 hours per debtor per group.
- Each successive reminder counts up (Reminder #1, #2, #3...) and escalation is tracked.

---

## 16. Honesty Score

Every user has an Honesty Score (0--100) that reflects their trustworthiness in settling debts.

### Components and Weights:

| Component | Weight | What It Measures |
|-----------|--------|-----------------|
| On-Time Payment Rate | 40% | Percentage of settlements completed without reminders and within 48 hours. Near-on-time (within 24h even with reminder) counts at 80%. |
| Completion Rate | 30% | Ratio of completed to total settlements. Pending settlements older than 7 days count as a 0.5 penalty. |
| Dispute Factor | 15% | Starts at 1.0 (100%). Each valid dispute raised against you deducts 0.05 (0.02 if fixed within 1 hour). 3+ disputes incur a pattern penalty of 0.10. 6+ disputes: 0.15 penalty. Invalid disputes you raised: 0.03 deduction each (capped at 0.20). |
| Proof Rate | 15% | Percentage of your expenses that have proof/receipt attached. |

### Event Bonuses:
Specific actions log honesty events with point values that provide a bonus (capped at +/- 15 points):
- Settlement on time: +10
- Settlement within 24h: +5
- Settlement with proof: +3
- Clean settlement: +1
- Expense with proof: +2
- Late settlement: -8
- Valid dispute: -15
- Invalid dispute: -10
- Quick fix dispute: -5
- Partial unpaid: -5
- Dispute pattern: -20

### Display:
- Score shown on profile with a color-coded ring: green (85+), amber (70+), warning (50+), red (below 50).
- Labels: Excellent, Very Good, Good, Fair, Poor, Critical.
- Marked as "Provisional" if fewer than 5 settlements.
- New users start with a default score of 75.

---

## 17. Badges

Five badges that are evaluated based on rolling activity windows:

| Badge | Name | Requirements |
|-------|------|-------------|
| Backbone | Top contributor who covers the most expenses | 2+ expenses paid, paid for 30%+ of group's expenses, highest payer in at least 1 group |
| On-Time Legend | Consistently settles without reminders | 2+ completed settlements, 70%+ settled without reminders, no pending settlement older than 6 hours |
| Split Master | Active expense tracker | 3+ total expenses, 1+ active group, at least 1 expense in last 6 hours |
| Debt Destroyer | Settles debts quickly | 2+ completed settlements, average settlement time under 12 hours, no pending settlement older than 6 hours |
| Trusted | High honesty and low disputes | 2+ settlements, honesty score 75+, 2 or fewer disputes, no pattern penalties |

### Badge Lifecycle:
- Badges are **automatically evaluated** when the badges page is loaded or the profile page loads.
- New badges trigger a notification ("Badge Earned!").
- Badges can be **revoked** if the user no longer meets requirements. Revocation also triggers a notification.
- After revocation, there is a 1-hour cooldown before the badge can be re-earned.
- Badges are displayed on the user's profile and visible to others.

---

## 18. EquiPoints and Gamification

### Earning EquiPoints:

| Action | Chance | Points |
|--------|--------|--------|
| Settle a debt | 35% | 2--15 (random) |
| Add an expense of 2,000 INR or more | 25% | 5--25 (random) |
| Watch an ad | 100% | 10 (guaranteed) |

### EquiPoints Page Tabs:

- **Overview**: Points balance card, earn methods (watch ad button with 3-second loading simulation), recent earnings log.
- **Honesty**: Full honesty score breakdown with debug panel showing raw calculation values and formula breakdown.
- **Badges**: All 5 badges with progress bars, eligibility status, and score.
- **Shop** (coming soon): 6 goodies listed (Gold Theme 500 EP, OG Badge 200 EP, Whale Badge 1000 EP, etc.) but purchasing is not yet functional.

---

## 19. Settings

The Settings page contains:

- **"Let friends add you to groups"** toggle:
  - **Enabled** (default): Friends can add you directly to groups without your approval.
  - **Disabled**: Friends must send an invite. You approve from the Pending Invites section on the dashboard or the Notifications page before joining.

---

## 20. PWA and Native App

### 20.1 Progressive Web App
- Equilibrium is installable as a PWA on any device.
- Service worker caches key pages for offline access.
- HTML pages use a network-first strategy (always fetches fresh content, falls back to cache if offline).
- Static assets use cache-first with background refresh.
- PWA manifest provides: app name, icons (192px, 512px, SVG), shortcuts (Add Expense, View Groups, Notifications), standalone display mode, dark background.

### 20.2 Android Native App (Capacitor)
- Wraps the deployed Vercel web app in a native WebView.
- Push notifications use Firebase Cloud Messaging (FCM).
- The app registers for FCM on launch and stores the token server-side.
- Tapping a push notification navigates to the relevant in-app page.
- Google OAuth uses a custom URL scheme (`equilibrium://`) for redirect handling.

---

## Summary of Key Business Rules

0. **Video loading screen**: All pages (except login/signup) show a looping muted video (`loading.mp4`) as a loading indicator instead of gray skeleton placeholders. The video plays at 9:16 portrait ratio, fullscreen.

1. **Pull-to-refresh**: All pages (except the scanner) support pull-to-refresh. Swiping down from the top of a page triggers a rubber-band animation with a floating indicator pill. Releasing past the 80px threshold refreshes the page. Only activates when already scrolled to the top.

2. **Profile must be complete** (UPI ID + payment app) before creating a group.
2. **Cannot leave a group** if you owe money or are owed money (balance must be approximately zero).
3. **Admin must transfer ownership** before leaving if other members exist.
4. **Sole member leaving** triggers a group deletion.
5. **Conflicted expenses** are excluded from all balance calculations until issues are resolved.
6. **Only the expense creator** can edit or delete an expense, and only when it has open issues.
7. **Only the issue raiser** can resolve their own issue.
8. **Debt limit** blocks members from being assigned new splits when their debt exceeds the limit.
9. **Trip close** requires the admin to mark the trip as ended, and each member can only exit when they have no debt.
10. **Reminders** are rate-limited to once every 12 hours per debtor per group.
11. **Settlement records** are only created after successful payment (not on order creation), preventing orphan records.
12. **Razorpay webhook** acts as a backup to ensure settlements are recorded even if client-side verification fails.
13. **Honesty score** is affected by settlement speed, dispute history, proof attachment rate, and explicit honesty events.
14. **Badges** are automatically evaluated and can be revoked if requirements are no longer met.
15. **Group termination** is permanent and irreversible. All data is preserved but the group is frozen.
16. **Leaving a group** is a soft-delete (`left_at` timestamp). Past members retain read-only access to data up to the point they left. Their names remain visible in expense details instead of showing "Unknown".
17. **Past Groups** appear in a collapsible "Past Groups" section on the groups listing page. Past members cannot create new data (enforced by RLS).
18. **Past members can rejoin** a group via invite code or QR code. Rejoining clears `left_at` and restores full membership and data access.
19. **Join request mode** allows admins to require approval before new members can join. Admins are notified of pending requests.
20. **Member limit** (default 30) caps the maximum number of active members in a group, enforced on direct joins and request approvals.
21. **Invite code expiry**: QR codes and invite codes expire 24 hours after generation. Admins can refresh expired codes.
22. **Automated reminders**: A cron job sends personality-based auto-reminders to debtors in active groups (rate-limited to once per 12 hours per debtor per group).
