import { boostShareText, normalizeBoostHost, parseBoostShare, type Boost } from "@universe/core";
import { useState } from "react";
import { View } from "react-native";
import { copyText, readText } from "../../../platform/clipboard";
import { useSettings } from "../../../state/browser/hooks";
import { activeTab } from "../../../state/browser/model";
import { useBrowser } from "../../../state/browser/store";
import { addBoost, applyBoosts, removeBoost, setBoostEnabled, updateBoost } from "../../../state/boosts/boosts";
import { updateSettings } from "../../../state/settings/actions";
import { closeSettingsSheet, showSettingsSheet } from "../../../state/settings/sheet";
import { settingsBrowserWindow } from "../../../state/settings/settingsWindows";
import { Button, DialogActions, DialogTitle, Sheet, Text, TextField, Toggle } from "../../ui";
import { FormField, Group, Row, SectionHeader } from "../Form";

export function BoostsPane() {
  const boosts = useSettings((s) => s.boosts);
  return (
    <View>
      <SectionHeader
        title="Boosts"
        anchor="boosts.boosts"
        description="Custom CSS for a site. A boost matches the site and its subdomains, and applies whenever the page loads."
        action={<Button title="Add Boost…" icon="plus" onPress={() => showSettingsSheet(<BoostSheet />)} />}
      />
      <Group>
        {boosts.length === 0 ? (
          <Row title="No boosts yet" description="Add one to restyle a site with your own CSS, then share it as JSON." />
        ) : (
          boosts.map((boost) => <BoostRow key={boost.id} boost={boost} />)
        )}
      </Group>
      <SectionHeader
        title="Share"
        description="Copy a boost as JSON to share it, or paste shared JSON to import it."
        action={<Button title="Import…" icon="square.and.arrow.down" onPress={() => showSettingsSheet(<ImportSheet />)} />}
      />
    </View>
  );
}

function BoostRow({ boost }: { boost: Boost }) {
  const [copied, setCopied] = useState(false);
  return (
    <Row title={boost.name} description={boost.host}>
      <Toggle value={boost.enabled} onChange={(value) => setBoostEnabled(boost.id, value)} />
      <Button
        title={copied ? "Copied" : "Copy"}
        onPress={() => {
          copyText(boostShareText(boost));
          setCopied(true);
        }}
      />
      <Button title="Edit" onPress={() => showSettingsSheet(<BoostSheet boost={boost} />)} />
      <Button title="Delete" kind="destructive" onPress={() => removeBoost(boost.id)} />
    </Row>
  );
}

function reapplyToActiveTab() {
  const windowId = settingsBrowserWindow();
  if (!windowId) return;
  const tab = activeTab(useBrowser.getState(), windowId);
  if (tab?.url) applyBoosts(tab.id, tab.url, true);
}

function BoostSheet({ boost }: { boost?: Boost }) {
  const [name, setName] = useState(boost?.name ?? "");
  const [host, setHost] = useState(boost?.host ?? "");
  const [css, setCss] = useState(boost?.css ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const cleanHost = normalizeBoostHost(host);
    if (!name.trim()) return setError("Give the boost a name.");
    if (!cleanHost) return setError("Enter a site, like youtube.com.");
    if (!css.trim()) return setError("Enter the CSS to apply.");
    if (boost) updateBoost(boost.id, { name: name.trim(), host: cleanHost, css });
    else addBoost({ name: name.trim(), host: cleanHost, css, enabled: true });
    closeSettingsSheet();
    reapplyToActiveTab();
  };
  return (
    <Sheet onClose={closeSettingsSheet}>
      <DialogTitle subtitle="CSS runs on the site and its subdomains whenever the page loads.">{boost ? "Edit Boost" : "Add Boost"}</DialogTitle>
      <FormField label="Name">
        <TextField value={name} onChangeText={setName} placeholder="Dark YouTube" onSubmit={save} onEscape={closeSettingsSheet} />
      </FormField>
      <FormField label="Site">
        <TextField value={host} onChangeText={setHost} placeholder="youtube.com" onSubmit={save} onEscape={closeSettingsSheet} />
      </FormField>
      <FormField label="CSS">
        <TextField value={css} onChangeText={setCss} placeholder={"body {\n  background: #111;\n}"} multiline mono onEscape={closeSettingsSheet} />
      </FormField>
      {error && (
        <Text size="caption" tone="destructive">
          {error}
        </Text>
      )}
      <DialogActions
        leading={
          boost ? (
            <Button
              title="Remove"
              kind="destructive"
              onPress={() => {
                removeBoost(boost.id);
                closeSettingsSheet();
              }}
            />
          ) : null
        }
      >
        <Button title="Cancel" onPress={closeSettingsSheet} />
        <Button title={boost ? "Save" : "Add"} kind="primary" onPress={save} />
      </DialogActions>
    </Sheet>
  );
}

function ImportSheet() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const importText = (value: string) => {
    const parsed = parseBoostShare(value);
    if (!parsed) return setError("That JSON is not a boost. Paste the JSON copied from a boost.");
    updateSettings({ boosts: [...useBrowser.getState().settings.boosts, ...parsed] });
    closeSettingsSheet();
    reapplyToActiveTab();
  };
  return (
    <Sheet onClose={closeSettingsSheet}>
      <DialogTitle subtitle="Paste the JSON copied from a boost to add it here.">Import Boost</DialogTitle>
      <FormField label="Boost JSON">
        <TextField value={text} onChangeText={setText} placeholder='{"name": "Dark YouTube", "host": "youtube.com", "css": "..."}' multiline mono onEscape={closeSettingsSheet} />
      </FormField>
      {error && (
        <Text size="caption" tone="destructive">
          {error}
        </Text>
      )}
      <DialogActions>
        <Button
          title="Paste"
          onPress={() => {
            void readText().then((pasted) => {
              if (pasted) setText(pasted);
            });
          }}
        />
        <Button title="Cancel" onPress={closeSettingsSheet} />
        <Button title="Import" kind="primary" onPress={() => importText(text)} />
      </DialogActions>
    </Sheet>
  );
}
