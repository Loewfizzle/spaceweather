"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import type { CityAuroraProb } from "../lib/noaa";

interface ShareButtonProps {
  status: string;
  kp: number | null;
  cityProbs?: CityAuroraProb[];
}

export function ShareButton({ status, kp, cityProbs = [] }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const kpText = kp != null ? ` (Kp ${kp.toFixed(1)})` : "";
    const cityLine = cityProbs
      .slice(0, 3)
      .map((c) => `${c.name} ${c.state}: ${c.prob > 0 ? `${c.prob}%` : "<1%"}`)
      .join(" · ");
    const body = [
      `Aurora forecast for Michigan tonight: ${status}${kpText}`,
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

    // Desktop fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(body + "\nhttps://space.loewfizzle.com");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
      title="Share tonight's forecast"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-[#22c55e]" />
          <span className="text-[#22c55e]">Copied!</span>
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
