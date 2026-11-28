import { useState } from "react";
import { Image, View } from "react-native";
import { Box, Button, Checkbox, DialogActions, DialogTitle, Sheet, Text } from "../ui";
import { closeSettingsSheet, showSettingsSheet } from "../../state/settings/sheet";
import { openSettings } from "../../state/settings/settingsWindows";
import { DATA_TYPES } from "../../state/sync/syncDoc";
import { refreshSyncNow, signOut, useAccount, type BrowserAccount } from "../../state/account/account";
import { useSync } from "../../state/sync/engine";
import { ago } from "../../lib/time";
import { UniverseAccountForm } from "./UniverseAccountForm";

export function showAccountSheet(): void {
  showSettingsSheet(<AccountSheet />);
}

function Avatar({ name, picture, size }: { name: string; picture: string | null; size: number }) {
  if (picture) {
    return <Image source={{ uri: picture }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#5b4bc4", alignItems: "center", justifyContent: "center" }}>
      <Text size="title" style={{ color: "#ffffff" }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

export function AccountSheet() {
  const account = useAccount((s) => s.account);
  return (
    <Sheet size="m" onClose={closeSettingsSheet}>
      {account ? <SignedIn account={account} /> : <SignedOut />}
    </Sheet>
  );
}

function SignedOut() {
  return (
    <View>
      <DialogTitle subtitle="Sign in with your UniVerse Account to sync bookmarks, history, passwords and settings across your Macs. No Google account needed.">
        Sign in to UniVerse
      </DialogTitle>
      <UniverseAccountForm autoFocus />
      <DialogActions>
        <Button title="Cancel" onPress={closeSettingsSheet} />
      </DialogActions>
    </View>
  );
}

function SignedIn({ account }: { account: BrowserAccount }) {
  const syncEnabled = useSync((s) => s.enabled);
  const syncStatus = useSync((s) => s.status);
  const lastSyncedAt = useSync((s) => s.lastSyncedAt);
  const pending = useSync((s) => s.pending);
  const types = useSync((s) => s.types);
  const [confirming, setConfirming] = useState(false);
  const [deleteData, setDeleteData] = useState(false);
  const [busy, setBusy] = useState(false);
  const syncingCount = DATA_TYPES.filter((t) => types[t.id]).length;
  const statusLine = !syncEnabled
    ? "Sync is off"
    : syncStatus === "updated" || syncStatus === "starting"
      ? lastSyncedAt
        ? `Synced ${ago(lastSyncedAt)}${pending ? ` · ${pending} file${pending === 1 ? "" : "s"} waiting` : ""}`
        : "Syncing…"
      : `Not syncing · ${lastSyncedAt ? `last synced ${ago(lastSyncedAt)}` : "never synced"}`;
  return (
    <View>
      <DialogTitle subtitle={account.email}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={account.name} picture={account.picture} size={40} />
          <Text size="title">{account.name}</Text>
        </View>
      </DialogTitle>
      <Box gap="m">
        <Text size="body" tone="textSecondary">
          {statusLine}
        </Text>
        <Text size="body" tone="textSecondary">
          Syncing {syncingCount} of {DATA_TYPES.length} data types: {DATA_TYPES.filter((t) => types[t.id]).map((t) => t.title).join(", ") || "none"}.
        </Text>
        {confirming ? (
          <Box gap="s">
            <Checkbox value={deleteData} onChange={setDeleteData} label="Also delete synced data from this Mac" />
            <Text size="caption" tone="textTertiary">
              Signing out stops syncing on this Mac. Your data stays on your other devices.
            </Text>
          </Box>
        ) : null}
      </Box>
      <DialogActions
        leading={<Button title="Manage Sync" onPress={() => openSettings("sync")} />}
      >
        {confirming ? (
          <>
            <Button title="Cancel" onPress={() => setConfirming(false)} />
            <Button
              title={busy ? "Signing Out…" : "Sign Out"}
              kind="destructive"
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void signOut({ deleteSyncedData: deleteData }).then(() => {
                  setBusy(false);
                  closeSettingsSheet();
                });
              }}
            />
          </>
        ) : (
          <>
            <Button title="Sync Now" disabled={!syncEnabled} onPress={() => void refreshSyncNow()} />
            <Button title="Sign Out" kind="destructive" onPress={() => setConfirming(true)} />
          </>
        )}
      </DialogActions>
    </View>
  );
}
