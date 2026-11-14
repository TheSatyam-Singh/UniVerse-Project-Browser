import type { Profile } from "../browser/types";

export type LoginGroup = { dataId: string; name: string; profileIds: string[] };

export const dataIdOfProfile = (profile: Pick<Profile, "id" | "dataId">): string => profile.dataId ?? profile.id;

export function loginGroups(
  profiles: Record<string, Profile>,
  profileOrder: string[],
): LoginGroup[] {
  const order: string[] = [];
  const members = new Map<string, Profile[]>();
  for (const id of profileOrder) {
    const profile = profiles[id];
    if (!profile) continue;
    const dataId = dataIdOfProfile(profile);
    if (!members.has(dataId)) {
      order.push(dataId);
      members.set(dataId, []);
    }
    members.get(dataId)!.push(profile);
  }
  return order.map((dataId) => {
    const group = members.get(dataId)!;
    const named = group.find((p) => p.dataName);
    return { dataId, name: named?.dataName ?? group[0]!.name, profileIds: group.map((p) => p.id) };
  });
}

export function profileLoginGroup(
  profiles: Record<string, Profile>,
  profileOrder: string[],
  profileId: string,
): LoginGroup | null {
  const profile = profiles[profileId];
  if (!profile) return null;
  return loginGroups(profiles, profileOrder).find((g) => g.dataId === dataIdOfProfile(profile)) ?? null;
}

export type ProfileDataHandle = {
  profiles: Record<string, Profile>;
  profileOrder: string[];
  setProfileData(id: string, patch: { dataId?: string | null; dataName?: string | null }): void;
};

export function shareProfileLogins(handle: ProfileDataHandle, profileId: string, withProfileId: string): boolean {
  const source = handle.profiles[profileId];
  const other = handle.profiles[withProfileId];
  if (!source || !other || profileId === withProfileId) return false;
  if (dataIdOfProfile(source) === dataIdOfProfile(other)) return false;
  handle.setProfileData(profileId, { dataId: dataIdOfProfile(other), dataName: null });
  return true;
}

export function unshareProfileLogins(handle: ProfileDataHandle, profileId: string): boolean {
  const profile = handle.profiles[profileId];
  if (!profile) return false;
  const group = profileLoginGroup(handle.profiles, handle.profileOrder, profileId);
  if (!group || group.profileIds.length < 2) return false;
  handle.setProfileData(profileId, { dataId: null, dataName: null });
  return true;
}

export function renameLoginGroup(handle: ProfileDataHandle, dataId: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const group = loginGroups(handle.profiles, handle.profileOrder).find((g) => g.dataId === dataId);
  if (!group) return false;
  for (const id of group.profileIds) handle.setProfileData(id, { dataName: trimmed });
  return true;
}
