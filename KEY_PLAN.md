# OpenRouter Key Provisioning Plan

## Goal
Remove the manual "Enter API key" step for users. Instead, each user who signs in with Google automatically gets their own OpenRouter API key provisioned with a $0.50/month spending cap. OpenRouter enforces the cap automatically.

## What Already Exists
- Supabase client configured in `src/utils/supabaseClient.js`
- Google OAuth sign-in fully working in `src/ChatApp.jsx`
- `users` table in Supabase with columns: `id`, `user_id`, `email`, `display_name`, `created_at`
- `@supabase/supabase-js` already installed

## What Needs to Be Built

---

### Step 1 — Add column to `users` table
**File to create:** `scripts/add-openrouter-key-column.sql`

Run this once in the Supabase SQL Editor:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS openrouter_key TEXT;
```

No RLS changes needed — the Edge Function uses the service role key to write, and the React app reads via the authenticated user's session.

---

### Step 2 — Create the Edge Function
**File to create:** `supabase/functions/provision-key/index.ts`

This function runs **once per user** (at first login). It:
1. Verifies the user's Supabase JWT
2. Checks if the user already has an `openrouter_key` in the `users` table
3. If yes: returns the existing key (idempotent — safe to call multiple times)
4. If no: calls `POST https://openrouter.ai/api/v1/keys` with the Management API key to create a capped sub-key ($0.50/month, resets monthly, named after the user's ID)
5. Saves the new key to the `users` table using the service role
6. Returns the key to the app

**Secrets required in Supabase dashboard:**
- `OPENROUTER_MANAGEMENT_KEY` — the Management API key from OpenRouter (separate from the regular API key, created at openrouter.ai/settings/keys)

**Deploy command:**
```bash
npx supabase functions deploy provision-key
```

---

### Step 3 — Change the default model
**File to modify:** `src/ChatApp.jsx` line 677

Change:
```js
return localStorage.getItem('openrouter_model') || 'deepseek/deepseek-v4-flash';
```
To:
```js
return localStorage.getItem('openrouter_model') || 'google/gemini-2.5-flash';
```

---

### Step 4 — Update `useOpenRouterChat.jsx`
**File to modify:** `src/hooks/useOpenRouterChat.jsx`

Currently the hook reads the API key from `localStorage` on line 86. Change it to accept the key as a prop instead:

```js
// Before (line 86):
const apiKey = localStorage.getItem('openrouter_api_key');

// After:
// apiKey is passed in as a parameter to the hook
```

The hook signature changes from:
```js
export function useOpenRouterChat(tools, toolHandlers)
```
To:
```js
export function useOpenRouterChat(tools, toolHandlers, apiKey)
```

---

### Step 5 — Update `ChatApp.jsx`
**File to modify:** `src/ChatApp.jsx`

#### 5a — Add provisioned key state
```js
const [provisionedKey, setProvisionedKey] = useState(null);
const [keyLoading, setKeyLoading] = useState(false);
const [capReached, setCapReached] = useState(false);
```

#### 5b — Provision key after login
Add a `useEffect` that runs when `user` is set:
```js
useEffect(() => {
  if (!user) return;
  setKeyLoading(true);
  supabase.functions.invoke('provision-key')
    .then(({ data, error }) => {
      if (data?.key) setProvisionedKey(data.key);
    })
    .finally(() => setKeyLoading(false));
}, [user]);
```

#### 5c — Pass the provisioned key to the hook
```js
// The provisioned key takes precedence over any manually stored key
const effectiveApiKey = provisionedKey || apiKey;
```
Pass `effectiveApiKey` into `useOpenRouterChat`.

#### 5d — Handle 429 (cap reached)
In the error handler, detect the 429 status and set `capReached = true`, which shows a friendly banner:
> "You've reached your monthly usage limit. Check back next month or add your own OpenRouter key in settings."

#### 5e — Hide the API key dialog for provisioned users
If `provisionedKey` is set, don't show the "Enter API key" dialog on load. The manual key input in Settings can remain as a power-user override.

#### 5f — Show a loading state while key is being provisioned
Between login and key ready, show a brief "Setting up your account..." screen instead of the chat UI.

---

## Deployment Steps (in order)

1. Run `scripts/add-openrouter-key-column.sql` in the Supabase SQL Editor
2. Create the `OPENROUTER_MANAGEMENT_KEY` secret in the Supabase dashboard (Project Settings → Edge Functions → Secrets)
3. Deploy the Edge Function: `npx supabase functions deploy provision-key`
4. Deploy the updated React app to GitHub Pages via the normal push-to-main workflow

---

## Model Choice
Default model: `google/gemini-2.5-flash`
- Input: $0.30/million tokens
- Output: $2.50/million tokens
- At $0.50/month cap: ~320 message exchanges per user per month

## Cap Hit Flow
When a user hits their $0.50 cap:
- OpenRouter returns HTTP 429
- App detects it and shows a friendly "monthly limit reached" message
- Settings panel still allows the user to enter their own OpenRouter key as a fallback
