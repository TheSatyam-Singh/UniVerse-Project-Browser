import { Image, Pressable, View } from "react-native";
import { Button, Text } from "../ui";
import { useAccount } from "../../state/account/account";
import { showAccountSheet } from "./AccountSheet";

export function AccountButton({ windowId, top, size }: { windowId: string; top: number; size: number }) {
  const account = useAccount((s) => s.account);
  const open = () => showAccountSheet(windowId);
  if (!account) {
    return (
      <Button
        variant="icon"
        toolbar
        icon="person.crop.circle"
        look="row"
        onPress={open}
        tooltip="Sign in to UniVerse"
        style={{ position: "absolute", top, right: 8 }}
      />
    );
  }
  const inner = account.picture ? (
    <Image source={{ uri: account.picture }} style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }} />
  ) : (
    <View style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2, backgroundColor: "#5b4bc4", alignItems: "center", justifyContent: "center" }}>
      <Text size="body" style={{ color: "#ffffff" }}>
        {(account.name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Signed in as ${account.name}`}
      style={{ position: "absolute", top, right: 8, width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {inner}
    </Pressable>
  );
}
