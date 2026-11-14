import { useState } from "react";
import { View } from "react-native";
import { useSettings } from "../../../state/browser/hooks";
import { updateSettings } from "../../../state/settings/actions";
import { hasAiApiKey, setAiApiKey } from "../../../state/ai/keyStore";
import { Button, PopUp, Text, TextField } from "../../ui";
import { Group, Row, SectionHeader, SettingToggle } from "../Form";
import type { Settings } from "../../../state/settings/settings";

const PROVIDERS: { value: Settings["aiProvider"]; title: string }[] = [
  { value: "gemini", title: "Google Gemini" },
  { value: "openrouter", title: "OpenRouter" },
  { value: "ollama", title: "Ollama (Local)" },
  { value: "openai_compatible", title: "OpenAI Compatible" },
  { value: "apple_intelligence", title: "Apple Intelligence" },
];

const TOOL_MODES: { value: Settings["aiToolExecutionMode"]; title: string }[] = [
  { value: "auto", title: "Auto" },
  { value: "ask", title: "Ask before executing" },
  { value: "disabled", title: "Disabled" },
];

const SEARCH_CONTEXT: { value: Settings["aiWebSearchContextSize"]; title: string }[] = [
  { value: "low", title: "Low" },
  { value: "medium", title: "Medium" },
  { value: "high", title: "High" },
];

export function AIPane() {
  const provider = useSettings((s) => s.aiProvider);
  const model = useSettings((s) => s.aiModel);
  const ollamaEndpoint = useSettings((s) => s.ollamaEndpoint);
  const webSearchEnabled = useSettings((s) => s.aiWebSearchEnabled);
  const webSearchEngine = useSettings((s) => s.aiWebSearchEngine);
  const webSearchMaxResults = useSettings((s) => s.aiWebSearchMaxResults);
  const webSearchContextSize = useSettings((s) => s.aiWebSearchContextSize);
  const toolMode = useSettings((s) => s.aiToolExecutionMode);
  const [keyDraft, setKeyDraft] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const keySet = provider === "apple_intelligence" ? false : hasAiApiKey(provider);

  const saveKey = () => {
    if (provider === "apple_intelligence") return;
    setAiApiKey(provider, keyDraft);
    setKeyDraft("");
    setKeySaved(true);
  };

  return (
    <View>
      <SectionHeader title="Assistant" />
      <Group>
        <SettingToggle anchor="ai.showAIAssistant" />
        <Row anchor="ai.aiProvider">
          <PopUp value={provider} options={PROVIDERS} onChange={(aiProvider) => updateSettings({ aiProvider })} />
        </Row>
        <Row anchor="ai.aiModel">
          <TextField value={model} onChangeText={(aiModel) => updateSettings({ aiModel })} placeholder="gemini-2.5-flash" mono width={220} />
        </Row>
        <Row anchor="ai.apiKey" description={keySet ? "A key is set for this provider." : "No key is set for this provider."}>
          <TextField value={keyDraft} onChangeText={(text) => { setKeyDraft(text); setKeySaved(false); }} placeholder="Paste a key…" secure mono width={220} />
          <Button title={keyDraft ? "Save key" : "Remove key"} kind="primary" onPress={saveKey} />
        </Row>
        {keySaved ? (
          <Text size="caption" tone="textSecondary">
            Saved to the credential store. Keys are never written to settings or logs.
          </Text>
        ) : null}
        {provider === "apple_intelligence" ? (
          <Text size="caption" tone="textSecondary">
            Apple Intelligence needs macOS 26 or later and Apple Intelligence turned on in System Settings. It uses no key.
          </Text>
        ) : null}
        <Row anchor="ai.ollamaEndpoint">
          <TextField value={ollamaEndpoint} onChangeText={(ollamaEndpoint) => updateSettings({ ollamaEndpoint })} placeholder="http://localhost:11434" mono width={220} />
        </Row>
      </Group>

      <SectionHeader title="Web search" />
      <Group>
        <SettingToggle anchor="ai.aiWebSearchEnabled" />
        {webSearchEnabled ? (
          <>
            <Row anchor="ai.aiWebSearchEngine">
              <TextField value={webSearchEngine} onChangeText={(aiWebSearchEngine) => updateSettings({ aiWebSearchEngine })} placeholder="auto" mono width={140} />
            </Row>
            <Row anchor="ai.aiWebSearchMaxResults">
              <TextField
                value={String(webSearchMaxResults)}
                onChangeText={(text) => {
                  const next = Number(text);
                  if (Number.isInteger(next) && next >= 0 && next <= 20) updateSettings({ aiWebSearchMaxResults: next });
                }}
                mono
                width={80}
              />
            </Row>
            <Row anchor="ai.aiWebSearchContextSize">
              <PopUp value={webSearchContextSize} options={SEARCH_CONTEXT} onChange={(aiWebSearchContextSize) => updateSettings({ aiWebSearchContextSize })} />
            </Row>
          </>
        ) : null}
      </Group>

      <SectionHeader title="Browser tools" />
      <Group>
        <Row anchor="ai.aiToolExecutionMode">
          <PopUp value={toolMode} options={TOOL_MODES} onChange={(aiToolExecutionMode) => updateSettings({ aiToolExecutionMode })} />
        </Row>
        <Text size="caption" tone="textSecondary">
          Read-only tools run without asking. Tools that change a page or tab ask first, and running JavaScript always asks. Nothing runs in a private window.
        </Text>
      </Group>

      <SectionHeader title="Tab Organizer" />
      <Group>
        <SettingToggle anchor="ai.tabOrganizerEnabled" />
      </Group>

      <SectionHeader title="Developer" />
      <Group>
        <SettingToggle anchor="ai.browserControlServerEnabled" />
        <Text size="caption" tone="textSecondary">
          The control server listens on 127.0.0.1:47823 and needs the bearer token from the 0600 token file. The Windows shell does not start it yet.
        </Text>
      </Group>
    </View>
  );
}
