"use client";

import { useState } from "react";
import { Share2, Check, AlertCircle } from "lucide-react";
import type { CityAuroraProb } from "../lib/noaa";

interface ShareButtonProps {
  status: string;
  kp: number | null;
  cityProbs?: CityAuroraProb[];
  accentColor?: string;
  userLocationLabel?: string | null;
}

export function ShareButton({ status, kp, cityProbs = [], accentColor = "#38bdf8", userLocationLabel }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function handleShare() {
    const kpText = kp != null ? ` (Kp ${kp.toFixed(1)})` : "";
    const place = userLocationLabel ?? "the northern US";
    const cityLine = cityProbs
      .slice(0, 3)
      .map((c) => `${c.name} ${c.state}: ${c.prob > 0 ? `${c.prob}%` : "<1%"}`)
      .join(" · ");
    const body = [
      `Aurora forecast for ${place} tonight: ${status}${kpText}`,
      cityLine,
      "space.loewfizzle.com",
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "AuroraWatch",
          text: body,
          url: "https://space.loewfizzle.com",
        });
      } catch {
        // user cancelled — no-op
      }
      return;
    }

    // Desktop: try modern clipboard API first
    const fullText = body + "\nhttps://space.loewfizzle.com";
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch { /* fall through to legacy */ }

    // Legacy fallback for private browsing / HTTP origins that block the async API
    try {
      const el = document.createElement("textarea");
      el.value = fullText;
      el.setAttribute("readonly", "");
      el.style.cssText = "position:absolute;left:-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{ color: accentColor }}
      className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
      title="Share tonight's forecast"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-[#22c55e]" />
          <span className="text-[#22c55e]">Copied!</span>
        </>
      ) : copyFailed ? (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-amber-400">Couldn&apos;t copy</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          <span>Share forecast</span>
        </>
      )}
    </button>
  );
}
