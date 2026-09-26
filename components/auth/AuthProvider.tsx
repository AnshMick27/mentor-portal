"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchProfile } from "@/lib/auth/fetchProfile";
import type { AuthView } from "@/lib/auth/guards";
import type { UserProfile } from "@/lib/validation/user";
import { getClientAuth } from "@/lib/firebase/client";

type AuthContextValue = {
  view: AuthView;
  /** Why the last sign-in failed (e.g. wrong domain), shown on /login. */
  message: string | null;
  signIn: (allowedDomain: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads the profile from /api/me, e.g. after onboarding. */
  refreshProfile: () => Promise<void>;
  /** Fresh ID token for `Authorization: Bearer` API calls; null when signed out. */
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const IGNORED_SIGN_IN_ERRORS = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AuthView>({ status: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  // Ignores replies for an older user when auth changes while /api/me is in flight.
  const requestId = useRef(0);

  const loadProfile = useCallback(async (user: User) => {
    const id = ++requestId.current;
    const result = await fetchProfile(await user.getIdToken());
    if (id !== requestId.current) return;
    if (result.ok) {
      setMessage(null);
      setView({ status: "signedIn", profile: result.profile });
      return;
    }
    setMessage(result.message);
    await firebaseSignOut(getClientAuth());
  }, []);

  useEffect(() => {
    return onAuthStateChanged(getClientAuth(), (user) => {
      if (!user) {
        requestId.current++;
        setView({ status: "signedOut" });
        return;
      }
      setView({ status: "loading" });
      void loadProfile(user);
    });
  }, [loadProfile]);

  const signIn = useCallback(async (allowedDomain: string) => {
    setMessage(null);
    const provider = new GoogleAuthProvider();
    // `hd` only pre-filters Google's account chooser; the server still enforces the domain.
    provider.setCustomParameters({ hd: allowedDomain, prompt: "select_account" });
    try {
      await signInWithPopup(getClientAuth(), provider);
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : "";
      if (code === "auth/popup-blocked") return signInWithRedirect(getClientAuth(), provider);
      if (!IGNORED_SIGN_IN_ERRORS.has(code)) setMessage("Sign-in failed. Please try again.");
    }
  }, []);

  const signOut = useCallback(async () => {
    setMessage(null);
    await firebaseSignOut(getClientAuth());
  }, []);

  const refreshProfile = useCallback(async () => {
    const user = getClientAuth().currentUser;
    if (user) await loadProfile(user);
  }, [loadProfile]);

  const getIdToken = useCallback(async () => {
    const user = getClientAuth().currentUser;
    return user ? user.getIdToken() : null;
  }, []);

  const value = useMemo(
    () => ({ view, message, signIn, signOut, refreshProfile, getIdToken }),
    [view, message, signIn, signOut, refreshProfile, getIdToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** The signed-in user's profile. Only for components rendered inside a `RouteGuard`. */
export function useSignedInProfile(): UserProfile {
  const { view } = useAuth();
  if (view.status !== "signedIn") throw new Error("useSignedInProfile must be used inside <RouteGuard>");
  return view.profile;
}
