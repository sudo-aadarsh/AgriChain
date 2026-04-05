import { useEffect, useState } from "react";

const KEY = "agrichain_refresh_seconds";
const EVENT_NAME = "agrichain:refresh";

export const REFRESH_OPTIONS = [0, 15, 30, 60];

export function getRefreshSeconds() {
  const raw = Number(localStorage.getItem(KEY));
  if (REFRESH_OPTIONS.includes(raw)) return raw;
  return 30;
}

export function setRefreshSeconds(seconds) {
  const safe = REFRESH_OPTIONS.includes(seconds) ? seconds : 30;
  localStorage.setItem(KEY, String(safe));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: safe }));
}

export function useRefreshSeconds() {
  const [seconds, setSeconds] = useState(getRefreshSeconds());

  useEffect(() => {
    const onCustom = (e) => setSeconds(e.detail);
    const onStorage = (e) => {
      if (e.key === KEY) setSeconds(getRefreshSeconds());
    };
    window.addEventListener(EVENT_NAME, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return seconds;
}
