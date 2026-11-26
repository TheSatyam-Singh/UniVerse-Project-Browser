import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { newTab } from "../../state/tabs/actions";
import { updateSettings } from "../../state/settings/actions";
import { useSettings, useWindowId } from "../../state/browser/hooks";
import { experimentOn } from "../../platform/killSwitches";
import { normalizeSearchUrl, useAiSidebar, type AiMessage } from "../../state/ai/aiSidebar";
import { Badge, Button, space, Symbol, Text, TextField, useTheme } from "../ui";

export function AiSidebar({ windowId }: { windowId: string }) {
  const open = useAiSidebar((s) => s.open);
  if (!experimentOn("universeAiSidebar") || !open) return null;
  return <Panel windowId={windowId} />;
}

export function AiSidebarRow({ windowId }: { windowId: string }) {
  const theme = useTheme();
  const openAi = useAiSidebar((s) => s.openAi);
  if (!experimentOn("universeAiSidebar")) return null;
  return (
    <Pressable onPress={openAi} accessibilityRole="button" accessibilityLabel="Ask UniVerse AI, experimental" style={{ flexDirection: "row", alignItems: "center", gap: space.s, paddingVertical: space.xs }}>
      <Symbol name="sparkles" size={14} weight="semibold" color={theme.textPrimary} style={{ width: 16, height: 16 }} />
      <Text weight="semibold">Ask UniVerse AI</Text>
      <Badge text="Experimental" tone="accent" size="s" />
    </Pressable>
  );
}

function Panel({ windowId }: { windowId: string }) {
  const theme = useTheme();
  const messages = useAiSidebar((s) => s.messages);
  const asking = useAiSidebar((s) => s.asking);
  const error = useAiSidebar((s) => s.error);
  const closeAi = useAiSidebar((s) => s.closeAi);
  const askAi = useAiSidebar((s) => s.askAi);
  const clearAi = useAiSidebar((s) => s.clearAi);
  const backendUrl = useSettings((s) => s.aiSearchUrl);
  const [input, setInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const configured = !!normalizeSearchUrl(backendUrl ?? "");
  const send = () => {
    if (!input.trim()) return;
    const question = input;
    setInput("");
    void askAi(question);
  };
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: theme.panel, zIndex: 10, paddingHorizontal: space.m, paddingTop: space.m, paddingBottom: space.m }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
        <Symbol name="sparkles" size={16} weight="semibold" color={theme.textPrimary} style={{ width: 18, height: 18 }} />
        <Text weight="semibold">UniVerse AI</Text>
        <Badge text="Experimental" tone="accent" size="s" />
        <View style={{ flex: 1 }} />
        <Button variant="close" look="panel" onPress={closeAi} />
      </View>
      <Text size="caption" tone="textSecondary" style={{ marginTop: space.xs }}>
        Experimental — answers may be wrong. Verify important facts.
      </Text>
      {!configured ? (
        <SetupView urlInput={urlInput} setUrlInput={setUrlInput} />
      ) : (
        <>
          <ScrollView style={{ flex: 1, marginTop: space.m }} showsVerticalScrollIndicator={false}>
            {messages.length === 0 ? (
              <Text tone="textSecondary">Ask anything — UniVerse searches the web and answers without leaving this page.</Text>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} windowId={windowId} asking={asking} />)
            )}
            {error === "failed" ? (
              <Text tone="textSecondary" style={{ marginTop: space.s }}>
                That search failed. Check the connection and try again.
              </Text>
            ) : null}
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, marginTop: space.m }}>
            <TextField value={input} onChangeText={setInput} placeholder="Ask UniVerse…" onSubmit={send} style={{ flex: 1 }} />
            <Button variant="pill" title="Ask" onPress={send} />
          </View>
          {messages.length > 0 ? (
            <Pressable onPress={clearAi} style={{ marginTop: space.s, alignSelf: "flex-start" }}>
              <Text size="caption" tone="textSecondary">Clear chat</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

function SetupView({ urlInput, setUrlInput }: { urlInput: string; setUrlInput: (v: string) => void }) {
  const save = () => {
    const url = normalizeSearchUrl(urlInput);
    if (url) updateSettings({ aiSearchUrl: url });
  };
  return (
    <View style={{ marginTop: space.m, gap: space.s }}>
      <Text tone="textSecondary">
        Connect your deployed UniVerse search engine to answer questions here. Paste its URL below — for example the Vercel address of your search app.
      </Text>
      <TextField value={urlInput} onChangeText={setUrlInput} placeholder="https://your-search-app.vercel.app" onSubmit={save} />
      <Button variant="pill" title="Connect search" onPress={save} />
    </View>
  );
}

function MessageBubble({ message, windowId, asking }: { message: AiMessage; windowId: string; asking: boolean }) {
  const theme = useTheme();
  const isUser = message.role === "user";
  const pending = !isUser && asking && !message.text;
  return (
    <View style={{ marginBottom: space.m }}>
      <Text size="caption" weight="semibold" tone="textSecondary">{isUser ? "You" : "UniVerse AI"}</Text>
      {pending ? (
        <Text tone="textSecondary" style={{ marginTop: space.xxs }}>Thinking…</Text>
      ) : (
        <Text style={{ marginTop: space.xxs }}>{message.text}</Text>
      )}
      {message.sources && message.sources.length > 0 ? (
        <View style={{ marginTop: space.s, gap: space.xxs }}>
          <Text size="caption" weight="semibold" tone="textSecondary">Sources</Text>
          {message.sources.map((s, i) => (
            <Pressable key={s.url} onPress={() => newTab(windowId, { url: s.url })}>
              <Text size="caption" color={theme.accent}>{`${i + 1}. ${s.title}`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
