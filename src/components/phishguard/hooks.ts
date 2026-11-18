"use client";

// PhishGuard — data-fetching hooks (plain useEffect + useState).
// Each hook exposes { data, loading, error, refresh } where `refresh` is a
// silent re-fetch (keeps current data on screen, no skeleton flicker).

import { useCallback, useEffect, useRef, useState } from "react";


import { api, apiErrorMessage } from "./api";
import type {
  AnalyticsReport,
  CampaignDetail,
  CampaignListItem,
  ComplianceResponse,
  EventType,
  HealthResponse,
  InboxResponse,
  LeaderboardResponse,
  Participant,
  PhishTemplate,
  Stats,
  StatsEvent,
  TrainingResponse,
} from "./api";

interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useApiData<T>(path: string | null): ApiDataState<T> {
  const [state, setState] = useState<{path: string | null; data: T | null; loading: boolean; error: string | null}>({path, data:null, loading:!!path, error:null});
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const gen = ++generation.current;
    await Promise.resolve();
    if (!path) return;
    setState(previous => previous.path === path ? {...previous, loading: previous.data === null} : {path,data:null,loading:true,error:null});
    try {
      const data = await api<T>(path);
      if (gen === generation.current) setState({path,data,loading:false,error:null});
    } catch (error) {
      if (gen === generation.current) setState(previous => ({path,data:previous.path===path?previous.data:null,loading:false,error:apiErrorMessage(error)}));
    }
  }, [path]);
  useEffect(() => { void refresh(); return () => { generation.current += 1; }; }, [refresh]);
  return {data: state.path===path?state.data:null, loading: state.path===path?state.loading:!!path, error:state.path===path?state.error:null, refresh};
}

/* --------------------------- typed endpoints --------------------------- */

export function useStats() {
  return useApiData<Stats>("/api/stats");
}

export function useCampaigns() {
  return useApiData<{ campaigns: CampaignListItem[] }>("/api/campaigns");
}

export function useCampaignDetail(id: string | null) {
  // GET /api/campaigns/:id returns { campaign: {...} } — unwrap so callers
  // receive the campaign object (with `participants`) directly.
  const state = useApiData<{ campaign: CampaignDetail }>(id ? `/api/campaigns/${id}` : null);
  return { data: state.data?.campaign ?? null, loading: state.loading, error: state.error, refresh: state.refresh };
}

export function useTemplates() {
  return useApiData<{ templates: PhishTemplate[] }>("/api/templates");
}

export function useParticipants() {
  return useApiData<{ participants: Participant[] }>("/api/participants");
}

export function useInbox(participantId: string | null) {
  return useApiData<InboxResponse>(
    participantId ? `/api/inbox?participantId=${encodeURIComponent(participantId)}` : null
  );
}

export function useTraining() {
  return useApiData<TrainingResponse>("/api/training");
}

export function useCompliance() {
  return useApiData<ComplianceResponse>("/api/compliance");
}

export function useAnalyticsReport() {
  // GET /api/analytics/report returns { report: {...} } — unwrap for callers.
  const state = useApiData<{ report: AnalyticsReport }>("/api/analytics/report");
  return { data: state.data?.report ?? null, loading: state.loading, error: state.error, refresh: state.refresh };
}

export function useLeaderboard() {
  return useApiData<LeaderboardResponse>("/api/leaderboard");
}

export function useHealth() {
  return useApiData<HealthResponse>("/api/health");
}

/* ------------------------------ live feed ------------------------------ */

/** Connection state of the live-event socket. */
export type LiveFeedStatus = "connecting" | "connected" | "disconnected";

/**
 * A single simulated engagement event streamed over the live feed socket.
 * Mirrors StatsEvent with optional fields so partial payloads stay renderable.
 */
export interface LiveEvent {
  id: string;
  type: EventType;
  participant: string;
  department?: string;
  campaign?: string;
  template?: string;
  createdAt: string;
}

const LIVE_FEED_MAX = 30;

/**
 * Live event stream for the Overview view. Connects to the platform's
 * socket.io feed service (proxied via XTransformPort — never a bare port or
 * absolute URL), backfills from `recent-events` and applies `live-event`
 * pushes. SSR-safe and cleans up the socket on unmount.
 */
export function useLiveFeed(): {
  events: LiveEvent[];
  status: LiveFeedStatus;
} {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<LiveFeedStatus>("connecting");

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const data = await api<{events: LiveEvent[]}>("/api/live");
        if (active) { setEvents(data.events); setStatus("connected"); }
      } catch { if (active) setStatus("disconnected"); }
    };
    void poll();
    const timer = setInterval(() => void poll(), 3000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return { events, status };
}

/** Map a stats recentEvent into the LiveEvent shape used by the feed UI. */
export function statsEventToLive(ev: StatsEvent): LiveEvent {
  return {
    id: ev.id,
    type: ev.type,
    participant: ev.participant,
    campaign: ev.campaign,
    template: ev.template,
    createdAt: ev.createdAt,
  };
}
