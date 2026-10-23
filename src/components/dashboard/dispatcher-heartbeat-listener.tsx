"use client";

import { useDispatcherHeartbeat } from "@/lib/hooks/use-dispatcher-heartbeat";

export function DispatcherHeartbeatListener() {
  useDispatcherHeartbeat();
  return null;
}
