"use client";

import { useState, useEffect } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "skyglow_ios_install_dismissed";

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIosSafari = /iPhone|iPad/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const isInstalled = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isDismissed = localStorage.getItem(DISMISSED_KEY) !== null;
    if (isIosSafari && !isInstalled && !isDismissed) setShow(true);
  }, []);

  function openModal() { setModalOpen(true); }
  function closeModal() { setModalOpen(false); }
  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
    setModalOpen(false);
  }

  useEffect(() => {
    if (!modalOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  if (!show) return null;

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-0.5 text-[#94a3b8] underline underline-offset-2 decoration-[#94a3b8]/40 ml-1"
        aria-label="Add SkyGlow to your Home Screen"
      >
        <Share className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        <span>Add to Home Screen</span>
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
        >
          <div
            className="bg-[#0d1425] border border-[#1e2937] rounded-t-2xl w-full max-w-sm px-6 pt-6 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div id="ios-install-title" className="text-sm font-semibold text-white">
                Add SkyGlow to Home Screen
              </div>
              <button
                onClick={closeModal}
                className="text-[#475569] hover:text-[#94a3b8] transition-colors p-1 -mr-1"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="space-y-4 mb-6">
              <li className="flex items-start gap-3">
                <span className="text-[#22c55e] font-semibold text-xs mt-0.5 shrink-0 w-4">1</span>
                <span className="text-sm text-[#94a3b8]">
                  Tap the <span className="text-white font-medium">Share</span>{" "}
                  <span className="text-[#64748b]">↑</span> button at the bottom of Safari
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#22c55e] font-semibold text-xs mt-0.5 shrink-0 w-4">2</span>
                <span className="text-sm text-[#94a3b8]">
                  Scroll down and tap{" "}
                  <span className="text-white font-medium">&ldquo;Add to Home Screen&rdquo;</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#22c55e] font-semibold text-xs mt-0.5 shrink-0 w-4">3</span>
                <span className="text-sm text-[#94a3b8]">
                  Tap <span className="text-white font-medium">&ldquo;Add&rdquo;</span> in the top right
                </span>
              </li>
            </ol>

            <button
              onClick={dismiss}
              className="w-full py-2.5 rounded-xl bg-[#1e2937] text-[#94a3b8] text-sm font-medium hover:bg-[#293548] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
