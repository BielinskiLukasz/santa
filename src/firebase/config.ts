/**
 * Klucze webowe Firebase nie są sekretami. Dla wygody przyjmujemy jedną zmienną
 * JSON (obiekt konfiguracji aplikacji webowej prosto z konsoli Firebase).
 * Starsze, pojedyncze zmienne NEXT_PUBLIC_FIREBASE_* są nadal obsługiwane.
 */
type FirebaseWebConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  messagingSenderId?: string;
};

function readJsonConfig(): FirebaseWebConfig {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as FirebaseWebConfig) : {};
  } catch {
    return {};
  }
}

const single = readJsonConfig();

export const firebaseConfig = {
  apiKey: single.apiKey ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain:
    single.authDomain ?? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId:
    single.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: single.appId ?? process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  messagingSenderId:
    single.messagingSenderId ??
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    "",
};

/** Bez konfiguracji aplikacja działa w trybie demo na lokalnym backendzie. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";
