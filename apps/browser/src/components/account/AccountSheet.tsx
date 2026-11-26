import { useState } from "react";
import { Image, View } from "react-native";
import { Box, Button, Checkbox, DialogActions, DialogTitle, Sheet, Text, TextField } from "../ui";
import { FormField } from "../settings/Form";
import { closeSettingsSheet, showSettingsSheet } from "../../state/settings/sheet";
import { openSettings } from "../../state/settings/settingsWindows";
import { DATA_TYPES } from "../../state/sync/syncDoc";
import { refreshSyncNow, setClientId, signIn, signOut, useAccount, type BrowserAccount } from "../../state/account/account";
import { useSync } from "../../state/sync/engine";
import { ago } from "../../lib/time";

export function showAccountSheet(windowId: string): void {
  showSettingsSheet(<AccountSheet windowId={windowId} />);
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

export function AccountSheet({ windowId }: { windowId: string }) {
  const account = useAccount((s) => s.account);
  const clientId = useAccount((s) => s.clientId);
  const status = useAccount((s) => s.status);
  const error = useAccount((s) => s.error);
  return (
    <Sheet size="m" onClose={closeSettingsSheet}>
      {account ? <SignedIn account={account} /> : <SignedOut windowId={windowId} clientId={clientId} status={status} error={error} />}
    </Sheet>
  );
}

function SignedOut({ windowId, clientId, status, error }: { windowId: string; clientId: string; status: string; error: string | null }) {
  const [draft, setDraft] = useState(clientId);
  const signingIn = status === "signingIn";
  return (
    <View>
      <DialogTitle subtitle="Sign in with your Google account to sync bookmarks, history, passwords and settings across your Macs — just like Chrome.">
        Sign in to UniVerse
      </DialogTitle>
      <Box gap="m">
        <FormField label="Google client ID">
          <TextField
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setClientId(value);
            }}
            placeholder="123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com"
          />
        </FormField>
        <Text size="caption" tone="textTertiary">
          Create a Desktop app OAuth client in Google Cloud Console (APIs &amp; Services › Credentials), then paste its client ID here. The app never sees a client secret.
        </Text>
        {error ? (
          <Text size="caption" tone="destructive">
            {error}
          </Text>
        ) : null}
      </Box>
      <DialogActions>
        <Button title="Cancel" onPress={closeSettingsSheet} />
        <Button title={signingIn ? "Signing In…" : "Sign in with Google"} kind="primary" disabled={signingIn || !draft.trim()} onPress={() => void signIn(windowId)} />
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
