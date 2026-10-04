/** Name and avatar shown for a profile (D-034). Off-chain only; never part of a credential or the chain. */
export function profileIdentity(
  profile: { id: string; displayName: string; avatarSeed: string | null } | null,
) {
  return {
    displayName: profile?.displayName ?? "",
    avatarSeed: profile ? (profile.avatarSeed ?? profile.id) : null,
  };
}
