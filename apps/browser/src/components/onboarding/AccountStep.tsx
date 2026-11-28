import { View } from "react-native";
import { Box, Text } from "../ui";
import { space } from "../ui/tokens";
import { confirmAnswer, skipStep } from "../../state/onboarding/onboarding";
import { useAccount } from "../../state/account/account";
import { UniverseAccountForm } from "../account/UniverseAccountForm";
import { StepActions, StepLayout } from "./StepLayout";

export function AccountStep() {
  const account = useAccount((s) => s.account);
  const continueTitle = account ? "Continue" : "Sign in to continue";
  return (
    <StepLayout
      title="Sign in to UniVerse"
      subtitle="Your UniVerse Account syncs bookmarks, history, passwords and settings across your Macs. No Google account needed, and you can add more profiles for the people you share this Mac with."
      actions={
        <StepActions
          continueTitle={continueTitle}
          disabled={!account}
          onContinue={() => confirmAnswer("account", {}, account ? [`Signed in as ${account.name}`] : [])}
          onSkip={() => skipStep()}
        />
      }
      preview={<AccountPreview />}
      previewOptional
    >
      {account ? (
        <Box gap="m">
          <Text size="body" tone="textSecondary">
            You are signed in as {account.name} ({account.email}). You can switch accounts or sign out later from the account button in the toolbar.
          </Text>
        </Box>
      ) : (
        <UniverseAccountForm autoFocus />
      )}
    </StepLayout>
  );
}

function AccountPreview() {
  const account = useAccount((s) => s.account);
  if (!account) {
    return (
      <Box gap="m" pad="l">
        <Text size="title">UniVerse Account</Text>
        <Text size="body" tone="textSecondary">
          Not signed in yet. Your account keeps your bookmarks, history, passwords and settings in sync across your Macs.
        </Text>
      </Box>
    );
  }
  return (
    <Box gap="m" pad="l">
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#5b4bc4", alignItems: "center", justifyContent: "center" }}>
        <Text size="title" style={{ color: "#ffffff" }}>
          {(account.name.trim()[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <Text size="title">{account.name}</Text>
      <Text size="body" tone="textSecondary">
        {account.email}
      </Text>
      <Text size="body" tone="textSecondary">
        Sync is tied to this account.
      </Text>
    </Box>
  );
}
