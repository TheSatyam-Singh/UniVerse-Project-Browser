import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { resolveAssistantApproval, sendAssistantMessage, useAssistant, clearAssistantMessages } from "../../state/ai/assistant";
import { pageEvaluationWired } from "../../state/ai/aiBridge";
import { Button, Text, TextField, space } from "../ui";

export function AssistantPanel({ onClose }: { onClose?: () => void }) {
  const messages = useAssistant((s) => s.messages);
  const isLoading = useAssistant((s) => s.isLoading);
  const streamingText = useAssistant((s) => s.streamingText);
  const isExecutingTools = useAssistant((s) => s.isExecutingTools);
  const currentToolName = useAssistant((s) => s.currentToolName);
  const pendingApproval = useAssistant((s) => s.pendingApproval);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    void sendAssistantMessage(text);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text size="title" weight="semibold">Assistant</Text>
        <View style={styles.headerActions}>
          <Button title="Clear" onPress={clearAssistantMessages} />
          {onClose ? <Button variant="close" look="panel" onPress={onClose} /> : null}
        </View>
      </View>
      {!pageEvaluationWired() && (
        <Text size="caption" tone="textSecondary" style={styles.note}>
          Page tools (read, click, search) need the active tab's page view. Tab tools work now.
        </Text>
      )}
      <ScrollView style={styles.messages}>
        {messages.length === 0 && (
          <Text size="body" tone="textSecondary">
            Ask about the page you are viewing, or ask the assistant to do something in the browser.
          </Text>
        )}
        {messages.map((message, index) => (
          <View key={`${message.timestamp}-${index}`} style={message.role === "user" ? styles.userMessage : styles.assistantMessage}>
            <Text size="body">{message.content}</Text>
          </View>
        ))}
        {isLoading && streamingText ? (
          <View style={styles.assistantMessage}>
            <Text size="body">{streamingText}</Text>
          </View>
        ) : null}
        {isExecutingTools && currentToolName ? (
          <Text size="caption" tone="textSecondary">
            Running {currentToolName}…
          </Text>
        ) : null}
      </ScrollView>
      {pendingApproval && (
        <View style={styles.approval}>
          <Text size="body" weight="semibold">
            Allow the assistant to run {pendingApproval.toolName}?
          </Text>
          <Text size="caption" tone="textSecondary">
            {JSON.stringify(pendingApproval.args)}
          </Text>
          <View style={styles.approvalActions}>
            <Button title="Deny" onPress={() => resolveAssistantApproval("deny")} />
            <Button title="Allow" onPress={() => resolveAssistantApproval("allow")} />
            {pendingApproval.offerAllowAll ? <Button title="Allow all this chat" kind="primary" onPress={() => resolveAssistantApproval("allowAll")} /> : null}
          </View>
        </View>
      )}
      <View style={styles.composer}>
        <TextField value={draft} onChangeText={setDraft} placeholder="Ask the assistant…" onSubmit={send} multiline />
        <Button title="Send" kind="primary" disabled={isLoading || !draft.trim()} onPress={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: space.m, gap: space.m },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.s },
  note: { marginBottom: space.s },
  messages: { flex: 1 },
  userMessage: { alignSelf: "flex-end", marginBottom: space.s },
  assistantMessage: { alignSelf: "flex-start", marginBottom: space.s },
  approval: { gap: space.s, padding: space.m, borderWidth: StyleSheet.hairlineWidth },
  approvalActions: { flexDirection: "row", gap: space.s },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.s },
});
