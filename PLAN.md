# Save Chats Feature — Implementation Plan

## What We're Building

We want students to be able to:
- Sign in to the app using their Google account
- Have their conversations automatically saved
- See a list of their past chats when they open the app
- Click on any past chat to reopen it and continue the conversation

---

## Step 1 — Professor: Set Up Supabase (Do This First)

Before any code changes can be made, the professor managing the Supabase project needs to complete the following steps.

---

### 1a. Enable Google Sign-In

1. Log in to your Supabase project at [https://supabase.com](https://supabase.com)
2. Go to **Authentication** → **Providers**
3. Find **Google** and click to enable it
4. You will need to create a Google OAuth app to get a Client ID and Client Secret:
   - Go to [https://console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project (or use an existing one)
   - Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Set the application type to **Web application**
   - Under **Authorized redirect URIs**, add your Supabase callback URL — it looks like:
     `https://<your-project-id>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret** back into the Supabase Google provider settings
5. Save the changes

---

### 1b. Create the Conversations Table

1. In Supabase, go to **Table Editor** → **New Table**
2. Name the table: `conversations`
3. Add the following columns:

| Column Name  | Type      | Notes                                      |
|--------------|-----------|--------------------------------------------|
| `id`         | `uuid`    | Primary key, default: `gen_random_uuid()`  |
| `user_id`    | `uuid`    | References `auth.users(id)` — links to the signed-in student |
| `title`      | `text`    | Short name for the chat (e.g. first message) |
| `messages`   | `jsonb`   | The full conversation stored as JSON       |
| `created_at` | `timestamp with time zone` | Default: `now()`            |
| `updated_at` | `timestamp with time zone` | Default: `now()`            |

4. Enable **Row Level Security (RLS)** on the table — this ensures students can only see their own chats, not each other's
5. Add the following RLS policies:

   **Policy 1 — Students can read their own chats:**
   - Policy name: `Users can view own conversations`
   - Operation: `SELECT`
   - Expression: `auth.uid() = user_id`

   **Policy 2 — Students can create new chats:**
   - Policy name: `Users can insert own conversations`
   - Operation: `INSERT`
   - Expression: `auth.uid() = user_id`

   **Policy 3 — Students can update their own chats:**
   - Policy name: `Users can update own conversations`
   - Operation: `UPDATE`
   - Expression: `auth.uid() = user_id`

   **Policy 4 — Students can delete their own chats:**
   - Policy name: `Users can delete own conversations`
   - Operation: `DELETE`
   - Expression: `auth.uid() = user_id`

---

### 1c. Share These Two Things With the Developer

Once the above is done, please share:

1. **Supabase Project URL** — found in **Project Settings** → **API** → `Project URL`
   - Looks like: `https://<your-project-id>.supabase.co`

2. **Supabase Anon/Public Key** — found in the same place, labeled `anon` `public`
   - This is safe to use in the front-end app — it is not a secret

---

## Step 2 — Developer: Code Changes

Once the professor has completed Step 1 and shared the URL and key, the following changes will be made to the app:

### 2a. Install Supabase
Add the Supabase JavaScript library to the project.

### 2b. Add Google Sign-In Button
- Show a "Sign in with Google" button when the student is not logged in
- After sign-in, show their name/avatar and a "Sign out" option

### 2c. Add a Conversations Sidebar
- When signed in, show a panel listing all the student's past conversations
- Each entry shows the title and date
- Clicking one loads that conversation into the chat

### 2d. Auto-Save Conversations
- When a student sends their first message, create a new conversation in Supabase
- After each AI response, update the saved conversation with the latest messages
- Generate a title automatically from the student's first message

### 2e. New Chat Button
- Add a "New Chat" button so students can start a fresh conversation at any time

---

## Order of Operations Summary

```
Professor sets up Supabase (Step 1)
        ↓
Professor shares URL + key with developer
        ↓
Developer installs Supabase in the app
        ↓
Developer adds Google sign-in
        ↓
Developer adds conversation saving
        ↓
Developer adds conversations sidebar
        ↓
Test with a few student accounts
        ↓
Merge to main and deploy
```

---

## Questions / Open Items

- [ ] Should conversations be given automatic titles (based on first message), or should students name them manually?
- [ ] Should there be a limit on how many saved chats a student can have?
- [ ] Should professors be able to see student conversations, or should they remain private?
