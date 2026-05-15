# Save Chat Feature — Plan

## What We're Building

Students will be able to:
- Sign in to the app using their Google account
- Have their conversations automatically saved as they chat
- Click a **History** button to see a list of all their past chats
- Click any past chat to reopen it and continue the conversation
- Start a fresh conversation with a **New Chat** button

---

## What's Already Done

### Mock History Panel (completed)
A working preview of the History panel has been built using fake data so the design can be reviewed before Supabase is connected. It includes:
- A **History** button in the top-right header (sits next to the Settings button)
- A slide-out panel from the right showing mock past conversations
- Conversations grouped by **Today**, **Yesterday**, and **Last Week**
- A **New Chat** button at the top of the panel
- A user profile (name + initials avatar) and sign-out button at the bottom
- Clicking a conversation closes the panel (loading real data comes later)

---

## What the Panel Looks Like

```
Header:  [ New Chat ]  [ Save PDF ]  [ Scenario ]  [ History ]  [ Settings ]

History panel (slides in from right):
┌─────────────────────────────────────────────┐
│  Chat History                          ✕    │
│  ─────────────────────────────────────────  │
│  [ + New Chat ]                             │
│                                             │
│  Today                                      │
│  > Nike vs Gap Analysis         2:30pm      │
│  > H&M Financial Overview       1:15pm      │
│                                             │
│  Yesterday                                  │
│  > Target Q3 Review             4:00pm      │
│  > Zara vs Uniqlo               11:20am     │
│                                             │
│  Last Week                                  │
│  > Retail Segment Trends        Mon         │
│  > Gross Margin Comparison      Sun         │
│                                             │
│  ─────────────────────────────────────────  │
│  [CH]  Catie He                  [ ← out ] │
└─────────────────────────────────────────────┘
```

---

## What the Professor Needs to Do First

Before any real sign-in or saving can be built, the professor managing the Supabase project must complete these steps:

### Step 1 — Enable Google Sign-In in Supabase
1. Log in to Supabase → **Authentication** → **Providers** → enable **Google**
2. Create a Google OAuth app at [console.cloud.google.com](https://console.cloud.google.com):
   - Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Add the Supabase redirect URI: `https://<your-project-id>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret** back into Supabase
3. Save

### Step 2 — Create the Conversations Table
In Supabase → **Table Editor** → **New Table**, create a table named `conversations` with these columns:

| Column       | Type                       | Notes                              |
|--------------|----------------------------|------------------------------------|
| `id`         | `uuid`                     | Primary key, default: `gen_random_uuid()` |
| `user_id`    | `uuid`                     | References `auth.users(id)`        |
| `title`      | `text`                     | Auto-generated from first message  |
| `messages`   | `jsonb`                    | Full conversation stored as JSON   |
| `created_at` | `timestamp with time zone` | Default: `now()`                   |
| `updated_at` | `timestamp with time zone` | Default: `now()`                   |

Enable **Row Level Security (RLS)** and add these four policies so students only see their own chats:

| Policy Name                        | Operation | Expression                  |
|------------------------------------|-----------|-----------------------------|
| Users can view own conversations   | SELECT    | `auth.uid() = user_id`      |
| Users can insert own conversations | INSERT    | `auth.uid() = user_id`      |
| Users can update own conversations | UPDATE    | `auth.uid() = user_id`      |
| Users can delete own conversations | DELETE    | `auth.uid() = user_id`      |

### Step 3 — Share These Two Things
Once done, share with the developer:
1. **Supabase Project URL** — found in Project Settings → API → `Project URL`
   - Looks like: `https://<your-project-id>.supabase.co`
2. **Supabase Anon/Public Key** — same page, labeled `anon public`
   - This is safe to use in the front-end — it is not a secret

---

## What Gets Built Next (after Supabase is ready)

### Step A — Install Supabase in the app
Add the Supabase JavaScript package and create a connection file using the URL and key from the professor.

### Step B — Replace mock user with real Google Sign-In
- Show a "Sign in with Google" button when no one is logged in
- After sign-in, show the student's real name and Google profile photo
- Sign-out button clears the session

### Step C — Auto-save conversations
- When a student sends their first message, create a new row in the `conversations` table
- After every AI reply, update the saved row with the latest messages
- Generate the conversation title automatically from the student's first message

### Step D — Replace mock history with real data
- Load the signed-in student's conversations from Supabase when they open the History panel
- Group them by date (Today, Yesterday, Last Week)
- Clicking a conversation loads it into the chat

### Step E — Test
- Sign in with a few test Google accounts
- Check that each student only sees their own chats
- Verify conversations save and reload correctly

### Step F — Merge to main and deploy

---

## Order of Operations Summary

```
Professor sets up Supabase + Google Auth
            ↓
Professor shares URL + key with developer
            ↓
Install Supabase in the app (Step A)
            ↓
Add real Google Sign-In (Step B)
            ↓
Auto-save conversations (Step C)
            ↓
Replace mock history with real data (Step D)
            ↓
Test with real student accounts (Step E)
            ↓
Merge to main + deploy (Step F)
```

---

## Open Questions

- [ ] Should conversation titles be auto-generated from the first message, or should students name them manually?
- [ ] Should there be a limit on how many saved chats a student can have?
- [ ] Should professors be able to view student conversations, or should they stay private?
- [ ] Should students be able to delete their own past chats?
