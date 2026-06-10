"use client";
import dynamic from "next/dynamic";

export const IosInstallPromptLoader = dynamic(
  () => import("./IosInstallPrompt").then((m) => ({ default: m.IosInstallPrompt })),
  { ssr: false }
);
