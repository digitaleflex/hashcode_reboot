/**
 * Helper pour charger les données complètes d'un compte membre.
 * Utilisé par :
 *   - /api/account/me (API)
 *   - /account/page.tsx (page)
 *
 * Centralise la logique pour éviter la duplication entre API et UI.
 */

import { generateProfile } from "@/lib/profiling/engine";
import type {
  AccountMember,
  AccountProfile,
  AccountStatus,
} from "@/app/account/_components/types";

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string;
  city: string | null;
  gender: string | null;
  primaryDomain: string;
  secondaryDomains: string;
  domainSpecialty: string | null;
  level: string;
  goal: string;
  goalProjectStage: string | null;
  goalSituation: string | null;
  availability: string;
  availabilityTimes: string | null;
  learningStyle: string;
  mentoringInterest: string | null;
  mentoringMaybeReason: string | null;
  mentoringTypes: string;
  mentoringFrequency: string | null;
  mentoringDomain: string | null;
  budgetRange: string | null;
  threeMonthGoal: string | null;
  profileStatus: string;
  communityStatus: string;
  accessLane: string;
  createdAt: Date;
}

export interface AccountData {
  member: AccountMember;
  profile: AccountProfile | null;
  status: AccountStatus;
}

export function buildAccountData(m: MemberRow): AccountData {
  // Reconstruit le GeneratedProfile (côté serveur) à partir des champs DB.
  // Si pas de profil générable (member incomplet), retourne null.
  let profile: AccountProfile | null = null;
  try {
    if (m.primaryDomain) {
      const generated = generateProfile({
        firstName: m.firstName,
        lastName: m.lastName ?? "",
        email: m.email,
        phone: m.phone ?? "",
        country: m.country,
        city: m.city ?? "",
        gender: (m.gender as "male" | "female" | "other" | "prefer_not_say" | undefined) ?? undefined,
        primaryDomain: m.primaryDomain as "web" | "cybersecurity" | "ai",
        level: m.level as "beginner" | "practicing" | "autonomous" | "advanced",
        goal: m.goal as "project" | "employment" | "freelance" | "upskill" | "business" | "career" | "other",
        goalProjectStage: m.goalProjectStage ?? undefined,
        goalSituation: m.goalSituation ?? undefined,
        availability: m.availability as "<2h" | "2-5h" | "5-10h" | "10-15h" | "15h+",
        learningStyle: m.learningStyle as "practice" | "path" | "group" | "mentor" | "project",
        mentoringInterest: (m.mentoringInterest as "no" | "maybe" | "yes" | null) ?? undefined,
      });
      profile = {
        archetype: generated.archetype,
        archetypeEmoji: generated.archetypeEmoji,
        domainLabel: generated.domainLabel,
        levelLabel: generated.levelLabel,
        goalLabel: generated.goalLabel,
        availabilityLabel: generated.availabilityLabel,
        styleLabel: generated.styleLabel,
        mentoringLabel: generated.mentoringLabel,
        tags: generated.tags,
        genderLabel: generated.genderLabel,
      };
    }
  } catch {
    profile = null;
  }

  return {
    member: {
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName ?? "",
      email: m.email,
      phone: m.phone ?? "",
      country: m.country,
      city: m.city ?? "",
      gender: m.gender,
      threeMonthGoal: m.threeMonthGoal,
      createdAt: m.createdAt.toISOString(),
    },
    profile,
    status: {
      profileStatus: m.profileStatus as AccountStatus["profileStatus"],
      communityStatus: m.communityStatus,
      accessLane: m.accessLane,
    },
  };
}
