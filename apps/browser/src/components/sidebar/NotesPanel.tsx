import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { layout, useTheme } from "../ui/theme";
import { Box, space, Symbol, Text, TextField } from "../ui";
import { useActiveTab } from "../../state/browser/hooks";
import { noteHostsOf, useNotes } from "../../state/notes/notes";
import { noteHost } from "../../state/notes/noteDocument";
import { setSidebarUi, useSidebarUi } from "../../state/sidebar/sidebarUi";
import { capture } from "../../state/telemetry/client";
import { SectionLabel } from "./SectionLabel";
import { SidebarListRow, SidebarRowLabel } from "./SidebarRow";

const SAVE_DELAY_MS = 400;

export function NotesPanel({ windowId }: { windowId: string }) {
  const open = useSidebarUi((u) => u.notes === windowId);
  const activeTab = useActiveTab();
  const currentHost = noteHost(activeTab?.url);
  const notes = useNotes((s) => s.notes);
  const loadNotes = useNotes((s) => s.loadNotes);
  const setNote = useNotes((s) => s.setNote);
  const deleteNote = useNotes((s) => s.deleteNote);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) {
      void loadNotes();
      capture("notes_opened", {});
    }
  }, [open]);

  const host = selected ?? currentHost;
  const saved = host ? (notes[host]?.text ?? "") : "";

  useEffect(() => {
    setDraft(saved);
  }, [host]);

  useEffect(() => {
    if (!host) return;
    const timer = setTimeout(() => {
      if (draft !== saved) setNote(host, draft);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, host, saved, setNote]);

  if (!open) return null;
  const hosts = noteHostsOf(notes);
  return (
    <View style={{ position: "absolute", left: layout.sidebarInset, right: layout.sidebarInset, top: layout.sidebarHeader, bottom: 0 }}>
      <NotesCard
        host={host}
        currentHost={currentHost}
        draft={draft}
        setDraft={setDraft}
        hosts={hosts}
        selected={selected}
        setSelected={setSelected}
        deleteNote={deleteNote}
      />
    </View>
  );
}

function NotesCard({
  host,
  currentHost,
  draft,
  setDraft,
  hosts,
  selected,
  setSelected,
  deleteNote,
}: {
  host: string;
  currentHost: string;
  draft: string;
  setDraft: (text: string) => void;
  hosts: string[];
  selected: string | null;
  setSelected: (host: string | null) => void;
  deleteNote: (host: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: theme.panelBorder, padding: space.m, gap: space.m }}>
      <Box row style={{ alignItems: "center" }}>
        <Text weight="semibold" style={{ flex: 1 }}>
          Notes
        </Text>
        <Pressable onPress={() => setSidebarUi({ notes: null })} accessibilityRole="button" accessibilityLabel="Close notes">
          <Symbol name="xmark" size={12} color={theme.textSecondary} />
        </Pressable>
      </Box>
      {host ? (
        <>
          <Text size="small" tone="textSecondary" lines={1}>
            {host}
          </Text>
          <TextField value={draft} onChangeText={setDraft} placeholder={`Note for ${host}…`} multiline autoFocus />
          {selected && selected !== currentHost ? (
            <Pressable onPress={() => setSelected(null)}>
              <Text size="small" tone="textSecondary">
                Back to {currentHost || "this site"}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text size="small" tone="textSecondary">
          Open a website to take a note for it.
        </Text>
      )}
      {hosts.length > 0 ? (
        <View style={{ flex: 1 }}>
          <SectionLabel title="All notes" inset={0} top={space.xs} bottom={space.xs} />
          <ScrollView style={{ flex: 1 }}>
            {hosts.map((h) => (
              <HostRow key={h} host={h} active={h === host} onPress={() => setSelected(h)} onDelete={() => deleteNote(h)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function HostRow({ host, active, onPress, onDelete }: { host: string; active: boolean; onPress: () => void; onDelete: () => void }) {
  const theme = useTheme();
  return (
    <SidebarListRow height={layout.rowHeight} fill={active ? theme.pinnedSelectedFill : undefined}>
      <Pressable onPress={onPress} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <SidebarRowLabel text={host} color={active ? theme.textPrimary : theme.textTab} />
        </View>
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Delete note for ${host}`}>
          <Symbol name="xmark" size={10} color={theme.textTertiary} />
        </Pressable>
      </Pressable>
    </SidebarListRow>
  );
}
