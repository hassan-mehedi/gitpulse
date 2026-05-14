import type { CommitIdentity, UserInfo } from "../types/git";
import type { CommitIdentityProfile } from "../stores/settings";

export type EffectiveCommitIdentity =
  | {
      source: "gitpulse";
      profile: CommitIdentityProfile;
      identity: CommitIdentity;
      label: string;
    }
  | {
      source: "git-config";
      identity: CommitIdentity;
      label: string;
    }
  | {
      source: "missing";
      identity: null;
      label: string;
    };

export function resolveCommitIdentity(
  repoPath: string | null | undefined,
  identities: CommitIdentityProfile[],
  assignments: Record<string, string>,
  gitUser?: UserInfo | null
): EffectiveCommitIdentity {
  const assignedId = repoPath ? assignments[repoPath] : undefined;
  const profile = identities.find((identity) => identity.id === assignedId);
  if (profile) {
    return {
      source: "gitpulse",
      profile,
      identity: { name: profile.name, email: profile.email },
      label: formatIdentity(profile.name, profile.email)
    };
  }

  if (gitUser?.name && gitUser.email) {
    return {
      source: "git-config",
      identity: { name: gitUser.name, email: gitUser.email },
      label: formatIdentity(gitUser.name, gitUser.email)
    };
  }

  return {
    source: "missing",
    identity: null,
    label: "No commit identity"
  };
}

export function formatIdentity(name: string, email: string) {
  return `${name} <${email}>`;
}

export function validateIdentityFields(label: string, name: string, email: string) {
  const normalizedLabel = label.trim();
  const normalizedName = name.trim();
  const normalizedEmail = email.trim();
  if (!normalizedLabel || !normalizedName || !normalizedEmail) {
    return "Label, name, and email are required.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }
  return null;
}
