# FIT Retail Index Chat

An advanced AI-powered financial analysis platform designed for retail industry benchmarking. This application provides a conversational interface side-by-side with an interactive financial dashboard, allowing users to analyze, compare, and visualize complex retail data through natural language.

## Key Features

### 📊 Conversational Benchmarking
Analyze the financial performance of 56 major retail companies across 10 industry segments. The AI understands the underlying financial data and can provide insights into margins, growth trends, and competitive positioning.

### 🕹️ Interactive Dashboard Control
The chat assistant doesn't just talk; it acts. You can ask the AI to:
- **Switch Companies:** "Compare Walmart and Target for 2023."
- **Change Years:** "Show me the data for 2019 through 2024."
- **Sync Views:** The assistant automatically updates the visual charts and tables to match your conversation.

### 🧠 Multi-Model Intelligence
Powered by OpenRouter, the app gives you access to the world's leading Large Language Models including **GPT-4o**, **Claude 3.5 Sonnet**, **Gemini 1.5 Pro**, and **Llama 3**. Choose the model that best fits your analytical needs.

### 🧪 Advanced Financial Tools
- **Direct Data Extraction:** The AI can "read" the live financial tables to perform custom calculations.
- **Math & LaTeX Support:** Complex formulas and financial ratios are rendered beautifully using KaTeX.
- **Reasoning Transparency:** View the AI's "thought process" as it executes multi-step financial analyses.

### 📂 Seamless Export
Download your entire research session as a formatted Markdown document, perfect for inclusion in reports or academic assignments.

---

## Capabilities & AI Tools

The chat assistant has direct access to the following capabilities:

| Feature | What the AI can do |
|---------|-------------------|
| **Get Selection** | Identify which companies and years are currently displayed. |
| **Set Selection** | Change the dropdowns for Company 1, Company 2, and their respective years. |
| **Extract Data** | Pull specific numbers and indicators from the financial comparison tables. |
| **External Knowledge** | Access broader retail industry data via the Model Context Protocol (MCP). |

---

## Technical Reference (For Developers)

The platform is built on a modern high-performance stack:

- **Frontend:** React 19, Vite 7, Tailwind CSS 4, and Radix UI.
- **AI Integration:** OpenRouter API with SSE streaming and tool-call chaining (up to 20 rounds).
- **Data Protocol:** Model Context Protocol (MCP) for remote database connectivity.
- **Architecture:** Monolithic wrapper with a secure `postMessage` bridge to the [BusMgmtBenchmarks](https://github.com/calvinw/BusMgmtBenchmarks) engine.

### Local Development
- `npm run dev` - Starts the chat wrapper.
- `npm run dev:busmgmt` - Starts the financial data engine.
- `npm run build` - Generates a production-ready integrated build in `/docs`.
- `npm run setup:integration` - Initializes the benchmark submodule.
