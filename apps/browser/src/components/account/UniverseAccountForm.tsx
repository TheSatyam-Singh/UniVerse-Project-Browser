import { useState } from "react";
import { View } from "react-native";
import { Box, Button, Text, TextField } from "../ui";
import { space } from "../ui/tokens";
import { FormField } from "../settings/Form";
import { signIn, signUp, useAccount } from "../../state/account/account";

export function UniverseAccountForm({ autoFocus }: { autoFocus?: boolean }) {
  const status = useAccount((s) => s.status);
  const error = useAccount((s) => s.error);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const busy = status === "signingIn";
  const submit = () => {
    if (mode === "signUp") void signUp({ name, email, password });
    else void signIn({ email, password });
  };
  return (
    <Box gap="m">
      {mode === "signUp" ? (
        <FormField label="Your name">
          <TextField value={name} onChangeText={setName} placeholder="Satyam Singh" autoFocus={autoFocus} onSubmit={submit} />
        </FormField>
      ) : null}
      <FormField label="Email">
        <TextField value={email} onChangeText={setEmail} placeholder="you@example.com" autoFocus={autoFocus && mode === "signIn"} onSubmit={submit} />
      </FormField>
      <FormField label="Password">
        <TextField value={password} onChangeText={setPassword} placeholder={mode === "signUp" ? "At least 8 characters" : "Your password"} secure onSubmit={submit} />
      </FormField>
      {error ? (
        <Text size="caption" tone="destructive">
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
        <Button title={busy ? "Please wait…" : mode === "signUp" ? "Create UniVerse Account" : "Sign in"} kind="primary" disabled={busy} onPress={submit} />
        <Button
          title={mode === "signUp" ? "I already have one" : "Create an account"}
          kind="plain"
          disabled={busy}
          onPress={() => setMode(mode === "signUp" ? "signIn" : "signUp")}
        />
      </View>
      <Text size="caption" tone="textTertiary">
        Your UniVerse Account lives on this Mac. Your password is stored as a salted hash in the keychain, never in plain text, and nothing is sent to a server.
      </Text>
    </Box>
  );
}
