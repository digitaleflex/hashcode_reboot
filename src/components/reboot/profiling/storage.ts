import type { ProfileAnswers } from "@/lib/profiling/types";

export const STORAGE_KEY = "hashcode:reboot:profiling";

export interface PersistedState {
  answers: ProfileAnswers;
  answeredIds: string[];
  step: number; // index within visible list at save time
}

/** Réponses vierges (objet frais à chaque appel — jamais partagé). */
export function initialAnswers(): ProfileAnswers {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    city: "",
  };
}
