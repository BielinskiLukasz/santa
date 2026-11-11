"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/firebase";
import type { DrawRepository, Snapshot } from "@/shared/types";

export function useRepository(): DrawRepository | null {
  const [repo, setRepo] = useState<DrawRepository | null>(null);
  useEffect(() => {
    let active = true;
    void getRepository().then((value) => {
      if (active) setRepo(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return repo;
}

export function useSnapshot(
  repo: DrawRepository | null,
  drawId: string,
  token: string | null,
  adminToken: string | null,
) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repo || !drawId) return;
    setLoading(true);
    const unsubscribe = repo.subscribe(
      drawId,
      token,
      adminToken,
      (value) => {
        setSnapshot(value);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [repo, drawId, token, adminToken]);

  return { snapshot, error, loading };
}
