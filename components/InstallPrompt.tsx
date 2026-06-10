"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

const INSTALLED_KEY = "aw_install_done";
const DISMISS_KEY   = "aw_install_dismissed";
const SUPPRESS_MS   = 14 * 24 * 60 * 60 * 1000; // 14 days

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptProps {
  accentColor?: string;
}

export function InstallPrompt({ accentColor = "#38bdf8" }: InstallPromptProps) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      // Already installed or user dismissed recently — stay silent
      if (localStorage.getItem(INSTALLED_KEY) === "1") return;
      const ts = localStorage.getItem(DISMISS_KEY);
      if (ts && Date.now() - parseInt(ts, 10) < SUPPRESS_MS) return;
      setPromptEvent(e as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      localStorage.setItem(INSTALLED_KEY, "1");
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const handleInstall = async () => {
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "1");
    }
    setPromptEvent(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setPromptEvent(null);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleInstall}
        style={{ color: accentColor }}
        className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
        title="Install SkyGlow on your device"
      >
        <Download className="h-3.5 w-3.5" />
        Install app
      </button>
      <button
        onClick={handleDismiss}
        className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-0.5"
        title="Dismiss"
        aria-label="Dismiss install prompt"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
