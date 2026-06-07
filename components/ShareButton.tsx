"use client";

import { useState } from "react";
import { Share2, Check, AlertCircle } from "lucide-react";

const SHARE_URL = "https://space.loewfizzle.com";

interface ShareButtonProps {
  accentColor?: string;
}

export function ShareButton({ accentColor = "#38bdf8" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: SHARE_URL });
      } catch {
        // user cancelled — no-op
      }
      return;
    }

    // Desktop: try modern clipboard API first
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch { /* fall through to legacy */ }

    // Legacy fallback for private browsing / HTTP origins that block the async API
    try {
      const el = document.createElement("textarea");
      el.value = SHARE_URL;
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
