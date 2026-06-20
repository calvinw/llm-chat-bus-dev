**Repository:** `calvinw/llm-chat-bus-dev` · **Branch:** `catie-test` · **Date:** June 20, 2026 · **By:** Catie

---

# Skills System for FIT Retail Index Chat — Technical Report

---

## 1. Executive Summary

The FIT Retail Index Chat previously offered students a fixed set of scenarios (Basic Financials, ROA Analysis, Flashcard, etc.) selectable from a dropdown menu. While functional, this design required every new mode to be hardcoded into the application's build — meaning adding a new learning activity required a developer to modify source code, rebuild the app, and redeploy.

This report documents the design and implementation of a **Skills System**: a lightweight, file-based framework that allows new AI-driven learning activities ("skills") to be added to the chatbox by simply uploading a Markdown file — no code changes required. Skills are invoked by students using a `/command` syntax directly in the chat input, with an autocomplete popup that appears automatically to guide them.

---

## 2. Architecture Overview

### How the existing app works

The chat application is a React single-page app that sends student messages to the **OpenRouter API**, which forwards them to an LLM (e.g., GPT-4o, Gemini). Each API call includes a **system prompt** — a set of hidden instructions that defines the AI's role and behavior for that conversation. Currently, system prompts are loaded from `prompts/*.md` files at **build time** by Vite and baked into the JavaScript bundle.

```
Student → Browser (React app) → OpenRouter API → LLM → Response
                    ↑
             system prompt
          (baked in at build time)
```

### Where the skills system fits

The skills system introduces a **runtime** layer on top of this. Instead of every prompt being fixed at build time, a skill file can be fetched from the server on demand — at the moment a student types a `/command`.

```
Student types /roa-analysis-quiz WMT TGT
        ↓
ChatApp.jsx detects the / prefix
        ↓
fetch('./skills/roa-analysis-quiz/roa-analysis-quiz.md')
        ↓
Skill content becomes the system prompt for this conversation
        ↓
OpenRouter API → LLM runs the quiz
```

The skill remains active for the entire conversation, and is cleared when the student clicks "New Chat."

---

## 3. File Structure

All skills live under `public/skills/`, which is served as static files by the app (both in development and in production on GitHub Pages).

```
public/
└── skills/
    ├── index.json                          ← manifest listing all available skills
    └── roa-analysis-quiz/
        └── roa-analysis-quiz.md            ← the skill instruction file
```

### Design decisions

**Per-skill subdirectory:** Each skill gets its own folder rather than a flat file. This is intentional — future skills may include reference images, data tables, or other supporting files alongside the `.md` instruction file.

**`index.json` manifest:** The browser cannot list the contents of a directory on a static file server. The manifest solves this: it is a single JSON file that tells the app what skills exist, what their commands are, and what to show in the autocomplete popup. Adding a new skill requires adding one entry to this file.

---

## 4. New Code Written

### 4a. `public/skills/index.json`

A JSON array where each entry describes one skill. The app loads this file on startup to power the autocomplete.

```json
[
  {
    "command": "roa-analysis-quiz",
    "label": "ROA Analysis Quiz",
    "description": "Interactive quiz on Return on Assets and the Strategic Profit Model",
    "usage": "/roa-analysis-quiz TICKER1 [YEAR1] TICKER2 [YEAR2]",
    "example": "/roa-analysis-quiz WMT TGT"
  }
]
```

| Field | Purpose |
|---|---|
| `command` | The name after `/` — also maps to the folder and `.md` filename |
| `label` | Human-readable name shown in the UI |
| `description` | Short description shown in the autocomplete popup |
| `usage` | Full syntax with optional arguments |
| `example` | Concrete example shown in the popup |

### 4b. `public/skills/roa-analysis-quiz/roa-analysis-quiz.md`

This is the skill instruction file — a detailed Markdown document written as instructions for the AI. It contains:

- **Input parsing rules** — how to interpret `TICKER1 YEAR1 TICKER2 YEAR2` arguments, with fallback defaults for missing years
- **Step 1–4: Data retrieval** — SQL queries against the BusMgmt Dolt database via MCP to look up company info, determine fiscal years, and fetch income statement and balance sheet data
- **Display format** — two formatted tables (Income Statement, Balance Sheet) shown to the student before the quiz begins; ratio columns are intentionally hidden so students must calculate them
- **Quiz question pool** — 5 tiers of questions (foundational → component calculation → ROA calculation → comparison → what-if reasoning), with rules for rotating correct answer positions to avoid AI position bias
- **Question format rules** — strict bullet-list formatting for answer choices to prevent markdown rendering issues
- **Communication style** — one question at a time, hint before revealing answer, encouraging tone
- **Key formulas** — ROA = Net Profit Margin % × Asset Turnover, rendered as LaTeX via KaTeX
- **Database reference table** — mapping of table/view names to their purpose

The file is 337 lines and is only loaded into the AI's context when the student explicitly triggers the skill — it does not add to the system prompt for other scenarios.

### 4c. `ChatApp.jsx` — Skill Loading Logic

Three additions were made to `ChatApp.jsx`:

**`activeSkillPrompt` state**

```javascript
const [activeSkillPrompt, setActiveSkillPrompt] = useState(null);
```

Holds the content of the currently active skill file. Starts as `null` (no skill active). Set when a `/command` is successfully fetched. Cleared when the student clicks "New Chat" or switches scenario.

**`resolveSkillPrompt()` function**

```javascript
const resolveSkillPrompt = async (text) => {
  if (!text.startsWith('/')) return null;
  const commandName = text.trim().split(/\s+/)[0].slice(1);
  try {
    const res = await fetch(`./skills/${commandName}/${commandName}.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};
```

Called inside `handleSubmit` before every message send. If the message starts with `/`, it extracts the command name (the first word minus the slash), constructs a path, and attempts to fetch the corresponding `.md` file. Returns `null` silently if no file is found — the message is then sent normally with the active scenario prompt instead.

**`effectiveSystemPrompt` — priority chain**

```javascript
const effectiveSystemPrompt = activeSkillPrompt ?? activeSystemPrompt;
```

A single line that defines the priority order: an active skill overrides the selected scenario, which overrides nothing. This is used in `handleSubmit` and `handleSuggestedPrompt`.

### 4d. `ChatApp.jsx` — Autocomplete UI

Four additions power the slash command popup:

**Skills loading on mount**

```javascript
const [skills, setSkills] = useState([]);

useEffect(() => {
  fetch('./skills/index.json')
    .then(r => r.ok ? r.json() : [])
    .then(setSkills)
    .catch(() => {});
}, []);
```

Fetches `index.json` once when the app loads. Stored in state, used to populate the autocomplete list.

**`filteredSkills` memo**

```javascript
const filteredSkills = useMemo(() => {
  if (!inputValue.startsWith('/')) return [];
  const query = inputValue.slice(1).toLowerCase();
  if (query.includes(' ')) return [];
  return skills.filter(s =>
    s.command.toLowerCase().includes(query) ||
    s.label.toLowerCase().includes(query)
  );
}, [inputValue, skills]);
```

Recomputes whenever the student types. Returns matching skills only when: the input starts with `/`, and no space has been typed yet (once the student starts adding arguments, the list closes). Matches against both the command name and the human-readable label.

**`selectSkill()` — fills the textarea**

```javascript
const selectSkill = (skill) => {
  const newValue = `/${skill.command} `;
  setInputValue(newValue);
  if (textareaRef.current) {
    textareaRef.current.value = newValue;
    textareaRef.current.focus();
  }
};
```

When a student clicks a suggestion, this fills the textarea with the full command name followed by a space, ready for the student to type the ticker symbols. Uses a ref to directly set the DOM textarea value (the component is uncontrolled).

**Popup UI**

Rendered as an absolutely-positioned container sitting directly above the input box:

```jsx
{showSuggestions && (
  <div className="absolute bottom-full mb-2 left-0 right-0 bg-background border rounded-lg shadow-lg overflow-hidden z-50">
    {filteredSkills.map((skill) => (
      <button
        key={skill.command}
        className="w-full text-left px-4 py-2.5 hover:bg-muted flex items-center gap-3 border-b last:border-b-0"
        onMouseDown={(e) => { e.preventDefault(); selectSkill(skill); }}
        type="button"
      >
        <span className="font-mono text-sm text-primary shrink-0">/{skill.command}</span>
        <span className="text-sm text-muted-foreground truncate">{skill.description}</span>
        <span className="font-mono text-xs text-muted-foreground/50 ml-auto shrink-0">{skill.example}</span>
      </button>
    ))}
  </div>
)}
```

`onMouseDown` with `e.preventDefault()` is used instead of `onClick` to prevent the textarea from losing focus before the value is written.

---

## 5. How It Works End-to-End (Student Flow)

1. Student opens the chat app in their browser and selects a scenario from the dropdown
2. Student types `/` in the chat input
3. The app immediately shows the autocomplete popup listing all available skills (loaded from `index.json` on mount)
4. As the student continues typing (e.g., `/roa`), the list filters in real time to matching skills
5. Student clicks `roa-analysis-quiz` — the textarea is filled with `/roa-analysis-quiz ` and focus returns to the input
6. Student appends the tickers and year: `/roa-analysis-quiz WMT 2024 TGT 2023` and presses Enter
7. `handleSubmit` detects the `/` prefix and calls `resolveSkillPrompt()`
8. The app fetches `./skills/roa-analysis-quiz/roa-analysis-quiz.md` — the 337-line instruction file
9. The skill content is stored in `activeSkillPrompt` state and sent as the system prompt for this API call
10. The LLM receives the full skill instructions plus the student's message, executes the MCP database queries, displays the financial tables, and begins the quiz
11. All subsequent messages in this conversation use the same skill as the system prompt
12. When the student clicks "New Chat," `activeSkillPrompt` is cleared and the conversation resets

---

## 6. How to Add New Skills (No Code Required)

Adding a new skill to the app requires three steps and no changes to any source code:

**Step 1 — Create the skill folder**

Under `public/skills/`, create a new folder named after the slash command:
```
public/skills/my-new-skill/
```

**Step 2 — Write the skill `.md` file**

Inside that folder, create a Markdown file with the same name as the folder:
```
public/skills/my-new-skill/my-new-skill.md
```

Write the AI instructions in this file. The file becomes the system prompt when the student triggers the command — it can include any instructions, SQL queries, question banks, formatting rules, or reference data.

**Step 3 — Register in `index.json`**

Add an entry to `public/skills/index.json`:
```json
{
  "command": "my-new-skill",
  "label": "My New Skill",
  "description": "One-line description shown in the autocomplete popup",
  "usage": "/my-new-skill ARG1 ARG2",
  "example": "/my-new-skill WMT TGT"
}
```

The new skill will appear in the autocomplete list the next time the app is loaded — no rebuild, no deployment, no code changes.
