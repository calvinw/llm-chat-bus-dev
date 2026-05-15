# How to Merge Your Branch into Main

This guide walks you through the steps to take changes from your branch (`Elenenewusers`) and bring them into the `main` branch — which is the "official" version of the app that gets published live.

Think of it like this: your branch is a draft, and `main` is the published version. Merging is the process of saying "my draft is ready — let's make it official."

---

## Step 1 — Make sure all your changes are committed and pushed

Before merging, your branch needs to be fully saved to GitHub. You already did this, but in the future always make sure:

- All your changes are committed (`git add` + `git commit`)
- You have pushed to your branch (`git push`)

---

## Step 2 — Open a Pull Request on GitHub

A **Pull Request** (also called a PR) is how you ask for your branch to be merged into `main`. It gives everyone a chance to review the changes before they go live.

1. Go to the repo on GitHub: [https://github.com/calvinw/llm-chat-bus-dev](https://github.com/calvinw/llm-chat-bus-dev)
2. You should see a yellow banner saying **"Elenenewusers had recent pushes"** — click **"Compare & pull request"**
3. On the pull request page:
   - Make sure the **base** branch is set to `main`
   - Make sure the **compare** branch is set to `Elenenewusers`
   - Add a title and short description of what you changed
4. Click **"Create pull request"**

---

## Step 3 — Merge the Pull Request

Once the pull request is open:

1. Scroll down and click **"Merge pull request"**
2. Click **"Confirm merge"**

Your changes are now in `main`!

---

## Step 4 — Wait for the app to publish

Every time something is pushed to `main`, GitHub automatically rebuilds and republishes the live app. This takes about 1–2 minutes.

To check the status:
1. Go to the repo on GitHub
2. Click the **Actions** tab
3. You'll see a workflow running — wait for the green checkmark

Once it's green, the live app at [https://calvinw.github.io/llm-chat-bus-dev/](https://calvinw.github.io/llm-chat-bus-dev/) will have your changes.

---

## Step 5 — Whitelist the live URL for Google sign-in (one-time setup)

Because the app is now published on GitHub Pages, Google and Supabase need to know that URL is allowed. You only need to do this once.

**In Google Cloud Console** (Credentials → your OAuth 2.0 Client ID):
- Under **Authorized JavaScript origins**, add:
  ```
  https://calvinw.github.io
  ```

**In Supabase** (Authentication → URL Configuration → Redirect URLs), add:
```
https://calvinw.github.io/llm-chat-bus-dev/
```

After this, Google sign-in will work on the live published app.

---

## Summary

| Step | What you do |
|---|---|
| 1 | Commit and push your branch |
| 2 | Open a Pull Request on GitHub |
| 3 | Merge the Pull Request into `main` |
| 4 | Wait for GitHub Actions to redeploy (1–2 min) |
| 5 | Add the live URL to Google and Supabase (one-time only) |
