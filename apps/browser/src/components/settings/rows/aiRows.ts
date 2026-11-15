import type { SettingSection } from "./types";

export const aiRows = {
  ai: [
    {
      section: "Assistant",
      rows: {
        showAIAssistant: { title: "Show AI Assistant", description: "Show the assistant panel beside the page.", keywords: ["ai", "assistant", "chat", "sidebar"] },
        aiProvider: { title: "Provider", description: "Which AI provider answers. Apple Intelligence runs on-device on macOS 26 and later.", keywords: ["ai", "provider", "gemini", "openrouter", "ollama", "openai", "apple intelligence", "model"] },
        aiModel: { title: "Model", description: "Model id for the chosen provider, for example gemini-2.5-flash.", keywords: ["ai", "model", "gemini"] },
        apiKey: { title: "API key", description: "Stored in the system credential store, never in settings or logs. Leave blank to remove the key.", keywords: ["ai", "api key", "secret", "gemini key", "openrouter key"] },
        ollamaEndpoint: { title: "Ollama endpoint", description: "Where a local Ollama server listens.", keywords: ["ai", "ollama", "localhost", "local model", "endpoint"] },
      },
    },
    {
      section: "Web search",
      rows: {
        aiWebSearchEnabled: { title: "Web search", description: "Let the provider search the web when the page does not answer the question.", keywords: ["ai", "web search", "search", "online"] },
        aiWebSearchEngine: { title: "AI provider search engine", description: "Which search engine the provider uses, or auto.", keywords: ["ai", "web search", "engine"] },
        aiWebSearchMaxResults: { title: "Maximum results", description: "How many search results the assistant may use.", keywords: ["ai", "web search", "results"] },
        aiWebSearchContextSize: { title: "Search context size", description: "How much search context the provider gets: low, medium or high.", keywords: ["ai", "web search", "context"] },
      },
    },
    {
      section: "Browser tools",
      rows: {
        aiToolExecutionMode: { title: "Browser tools", description: "Auto runs tools without asking. Ask prompts before a tool changes anything. Disabled turns browser tools off.", keywords: ["ai", "tools", "auto", "ask", "execute", "browser control"] },
      },
    },
    {
      section: "Tab Organizer",
      rows: {
        tabOrganizerEnabled: { title: "Organize tabs with AI", description: "Let the assistant group loose tabs into folders. On macOS 26 and later the on-device model classifies them; everywhere else grouping falls back to rules.", keywords: ["ai", "tab organizer", "organize", "groups", "folders"] },
      },
    },
    {
      section: "Developer",
      rows: {
        browserControlServerEnabled: { title: "Browser control server", description: "Start the local MCP server on 127.0.0.1:47823 so a coding agent can drive the browser. Off by default; the token lives in a 0600 file.", keywords: ["ai", "mcp", "developer", "coding agent", "control server", "claude"] },
      },
    },
  ],
} satisfies Record<string, SettingSection[]>;
