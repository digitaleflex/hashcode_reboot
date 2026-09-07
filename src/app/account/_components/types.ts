/**
 * Types et helpers partagés par les composants de la page /account.
 */

export type MemberStatus = "PENDING" | "APPROVED" | "WAITLIST" | "REJECTED";

export interface AccountMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  threeMonthGoal: string | null;
  createdAt: string;
}

export interface AccountProfile {
  archetype: string;
  archetypeEmoji: string;
  domainLabel: string;
  levelLabel: string;
  goalLabel: string;
  availabilityLabel: string;
  styleLabel: string;
  mentoringLabel: string;
  tags: string[];
  genderLabel?: string;
}

export interface AccountStatus {
  profileStatus: MemberStatus;
  communityStatus: string;
  accessLane: string;
}

/** Couleurs et libellés par statut (cohérent avec l'admin dashboard). */
export const STATUS_STYLES: Record<
  MemberStatus,
  { dot: string; badge: string; label: string }
> = {
  APPROVED: {
    dot: "bg-lime",
    badge: "bg-lime/15 text-lime border-lime/30",
    label: "Validé",
  },
  PENDING: {
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    label: "En attente",
  },
  WAITLIST: {
    dot: "bg-blue-400",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    label: "Liste d'attente",
  },
  REJECTED: {
    dot: "bg-red-400",
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
    label: "Non retenu",
  },
};
