import { View } from "react-native";
import { Box, Button, Text } from "../ui";
import { space } from "../ui/tokens";
import { confirmAnswer, skipStep } from "../../state/onboarding/onboarding";
import { useProfileOrder, useProfileRecords } from "../../state/profiles/hooks";
import { requestCreateProfile } from "../../state/profiles/createProfileRequest";
import { ProfileBadge } from "../profiles/ProfileIcons";
import { StepActions, StepLayout } from "./StepLayout";

export function ProfilesStep() {
  const order = useProfileOrder();
  const profiles = useProfileRecords();
  const names = order.map((id) => profiles[id]?.name ?? "").filter(Boolean);
  return (
    <StepLayout
      title="Who uses this Mac?"
      subtitle="Profiles keep browsing separate. Each one has its own history, logins, cookies and extensions. Add one for each person, or one for work and one for personal."
      actions={
        <StepActions
          continueTitle="Continue"
          onContinue={() => confirmAnswer("profiles", {}, names.length ? [`${names.length} profile${names.length === 1 ? "" : "s"}: ${names.join(", ")}`] : ["One profile"])}
          onSkip={() => skipStep()}
        />
      }
      preview={<ProfilesPreview />}
      previewOptional
    >
      <Box gap="m">
        {order.map((id) => {
          const profile = profiles[id];
          if (!profile) return null;
          return (
            <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
              <ProfileBadge profile={profile} size={28} />
              <Text size="body">{profile.name}</Text>
            </View>
          );
        })}
        <Button title="Create a Profile" icon="plus" onPress={() => void requestCreateProfile()} />
        <Text size="caption" tone="textTertiary">
          You can add, rename and remove profiles any time in Settings › Profiles.
        </Text>
      </Box>
    </StepLayout>
  );
}

function ProfilesPreview() {
  const order = useProfileOrder();
  const profiles = useProfileRecords();
  return (
    <Box gap="m" pad="l">
      <Text size="title">Separate profiles</Text>
      <Text size="body" tone="textSecondary">
        {order.length === 1
          ? "One profile so far. Add another for work, for family, or for anyone else who uses this Mac."
          : `${order.length} profiles on this Mac, each with its own history, logins and cookies.`}
      </Text>
      <View style={{ flexDirection: "row", gap: space.m }}>
        {order.map((id) => {
          const profile = profiles[id];
          if (!profile) return null;
          return <ProfileBadge key={id} profile={profile} size={36} />;
        })}
      </View>
    </Box>
  );
}
