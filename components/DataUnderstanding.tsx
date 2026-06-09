"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * DataUnderstanding
 * Expandable/collapsible section covering solar activity, how the indicators work together,
 * and viewing tips. Per-metric explanations live in the card info modals.
 * Button uses aria-expanded + aria-controls for a11y.
 */
export function DataUnderstanding() {
  const [isDataInfoExpanded, setIsDataInfoExpanded] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="card">
        <button
          onClick={() => setIsDataInfoExpanded(!isDataInfoExpanded)}
          className="w-full flex items-center justify-between p-6 text-left"
          aria-expanded={isDataInfoExpanded}
          aria-controls="understanding-data-content"
        >
          <div>
            <div className="section-title mb-1">Understanding the Data</div>
            <div className="text-sm text-[#94a3b8]">
              Solar activity, reading the indicators, and viewing tips
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-[#64748b] transition-transform ${isDataInfoExpanded ? "rotate-180" : ""}`}
          />
        </button>

        <div
          id="understanding-data-content"
          className="px-6 pb-6 text-sm text-[#cbd5e1] space-y-4 border-t border-[#1e2937] pt-4"
          hidden={!isDataInfoExpanded}
        >
          <div>
            <div className="font-medium text-white mb-1">Solar Activity</div>
            <p>
              Solar flares are sudden bursts of radiation that can disturb the ionosphere but typically do not directly cause visible aurora. Coronal mass ejections (CMEs) are the main drivers of strong geomagnetic storms — large clouds of magnetized plasma that take 1–3 days to reach Earth. Earth-directed CMEs with high speed and southward magnetic field are the most impactful. Elevated sunspot counts and active coronal holes indicate an overall more active sun and increase the likelihood of recurrent solar wind disturbances.
            </p>
          </div>

          <div>
            <div className="font-medium text-white mb-1">How the Indicators Work Together</div>
            <p>
              No single number tells the full story. The strongest aurora nights combine several favorable factors at once: Kp rising above 4 or 5, a sustained negative Bz, elevated solar wind speed (above 500–600 km/s), and rising OVATION probabilities across northern latitudes. When all of these align, conditions can evolve quickly — sometimes within an hour.
            </p>
            <p className="mt-2">
              A useful mental model: Kp and OVATION probabilities tell you where the night is headed, while Bz and solar wind speed tell you what is happening right now. Strong Bz and high wind speed with a modest Kp reading often means conditions are improving; high Kp with Bz drifting back toward zero often means the display is winding down.
            </p>
          </div>

          <div>
            <div className="font-medium text-white mb-1">Viewing Tips</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dark skies are essential. Move well away from city and suburban light pollution and allow 15–20 minutes for your eyes to adjust.</li>
              <li>The peak window is generally between 10 pm and 2 am local time, though significant displays can occur outside those hours.</li>
              <li>Face north and look for a clear, unobstructed horizon. Aurora typically appears low in the sky first and rises with intensity.</li>
              <li>Check current Bz and solar wind speed alongside Kp — a strong negative Bz can elevate an otherwise quiet night quickly.</li>
              <li>Displays vary in duration from a few minutes to several hours and often come in pulses. Patience is rewarded.</li>
            </ul>
          </div>

          <div className="text-[10px] text-[#64748b] pt-2 border-t border-[#1e2937]">
            Data is provided by NOAA Space Weather Prediction Center (SWPC) for personal and educational use. This dashboard is not intended for navigation or safety-critical decisions. Conditions can change rapidly.
          </div>
        </div>
      </div>
    </div>
  );
}
