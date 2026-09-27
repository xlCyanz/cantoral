import { useEffect } from "react";
import { isTauri, toAssetUrl, updateTrackDuration } from "./api";
import { fmt } from "./covers";
import { useStore } from "../store";

/** Reads metadata only; this element never plays or joins the transport. */
export async function videoDuration(path: string, signal: AbortSignal): Promise<number | null> {
  const url = await toAssetUrl(path);
  if (signal.aborted) return null;
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const finish = (duration: number | null) => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      video.onloadedmetadata = null;
      video.ondurationchange = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve(duration);
    };
    const abort = () => finish(null);
    const metadata = () => {
      const duration = Math.round(video.duration);
      if (Number.isFinite(duration) && duration > 0) finish(duration);
    };
    const timeout = setTimeout(abort, 15000);
    signal.addEventListener("abort", abort, { once: true });
    video.onloadedmetadata = metadata;
    video.ondurationchange = metadata;
    video.onerror = abort;
    video.src = url;
    video.load();
  });
}

/** Backfills old and newly scanned videos whose tags provided no duration. */
export function useVideoDurations() {
  const pending = useStore((s) => s.tracks
    .filter((t) => t.video && t.path && !t.missing && t.durSec === 0)
    .map((t) => `${t.id}:${t.path}`).join("\0"));

  useEffect(() => {
    if (!isTauri() || !pending) return;
    const controller = new AbortController();
    const tracks = useStore.getState().tracks.filter((t) => t.video && t.path && !t.missing && t.durSec === 0);
    void (async () => {
      for (const track of tracks) {
        if (controller.signal.aborted || !track.path) break;
        try {
          const duration = await videoDuration(track.path, controller.signal);
          if (controller.signal.aborted) break;
          if (duration === null) continue;
          await updateTrackDuration(track.id, track.path, duration);
          if (controller.signal.aborted) break;
          useStore.setState((s) => ({
            tracks: s.tracks.map((t) => t.id === track.id && t.path === track.path
              ? { ...t, durSec: duration, dur: fmt(duration) } : t),
          }));
        } catch (error) {
          console.error("video duration failed", error);
        }
      }
    })();
    return () => controller.abort();
  }, [pending]);
}
