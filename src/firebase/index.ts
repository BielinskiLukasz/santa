import type { DrawRepository } from "@/shared/types";
import { isFirebaseConfigured } from "./config";
import { localRepository } from "./local";

let firebaseRepo: Promise<DrawRepository> | null = null;

/**
 * Warstwa /firebase odseparowana od reszty kodu:
 * - skonfigurowany projekt Firebase (Spark) => Firestore + Anonymous Auth,
 * - brak konfiguracji => lokalny backend demonstracyjny o identycznym kontrakcie.
 */
export function getRepository(): Promise<DrawRepository> {
  if (!isFirebaseConfigured) return Promise.resolve(localRepository);
  if (!firebaseRepo) {
    firebaseRepo = import("./firestore").then(
      (module) => module.firebaseRepository,
    );
  }
  return firebaseRepo;
}

export { isFirebaseConfigured };
