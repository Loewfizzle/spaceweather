"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * DataUnderstanding
 * Expandable/collapsible "Understanding the Data" educational section.
 * Starts collapsed (default) per original design and requirements.
 * All explanatory text on Kp, Bz, OVATION, Solar, Viewing Tips for Michigan, and the disclaimer is copied verbatim.
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
              Helpful context for Michigan aurora chasers
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-[#64748b] transition-transform ${isDataInfoExpanded ? "rotate-180" : ""}`}
          />
        </button>

        {isDataInfoExpanded && (
          <div id="understanding-data-content" className="px-6 pb-6 text-sm text-[#cbd5e1] space-y-4 border-t border-[#1e2937] pt-4">
            <div>
              <div className="font-medium text-white mb-1">Kp Index</div>
              <p>
                The planetary K-index measures geomagnetic activity on a scale of 0–9. For Michigan, Kp 4+ can produce aurora in the Upper Peninsula under dark skies; Kp 5+ offers a good chance there and possible visibility in northern Lower Michigan. Higher values (6–9) increase the odds dramatically, even in southern parts of the state with clear, dark conditions.
              </p>
            </div>

            <div>
              <div className="font-medium text-white mb-1">Bz (IMF)</div>
              <p>
                Bz is the north-south component of the interplanetary magnetic field. Southward (negative) Bz is favorable for aurora because it allows solar wind energy to connect with Earth’s magnetic field. Strongly negative Bz (e.g., –5 nT or lower) combined with high solar wind speed significantly boosts chances for Michigan viewers.
              </p>
            </div>

            <div>
              <div className="font-medium text-white mb-1">OVATION Map</div>
              <p>
                The map displays modeled probability of visible aurora based on the OVATION Prime model using real-time solar wind data. It is a forecast, not live imagery of the aurora itself. Probabilities are highest near the auroral oval; even low percentages in the Great Lakes region can mean visible aurora if skies are dark and clear.
              </p>
            </div>

            <div>
              <div className="font-medium text-white mb-1">Solar Activity Section</div>
              <p>
                Flares indicate sudden energy releases that can precede geomagnetic disturbances. CMEs (coronal mass ejections) are large expulsions of plasma; Earth-directed ones with high speed are the main drivers of strong aurora displays 1–3 days later. Higher sunspot numbers generally mean more solar activity overall. Coronal holes produce high-speed solar wind streams that can create recurrent aurora opportunities, especially when combined with other factors.
              </p>
            </div>

            <div>
              <div className="font-medium text-white mb-1">Viewing Tips for Michigan</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Seek dark skies away from city lights (Upper Peninsula and northern Lower Peninsula are best).</li>
                <li>Best chances are typically between 10pm and 2am local time, though aurora can appear earlier or later.</li>
                <li>Watch for clear skies and a dark horizon to the north.</li>
                <li>Even moderate Kp or low OVATION probabilities can produce visible aurora if Bz is strongly southward.</li>
                <li>Be patient — displays can last minutes to hours and often come in waves.</li>
              </ul>
            </div>

            <div className="text-[10px] text-[#64748b] pt-2 border-t border-[#1e2937]">
              Data is provided by NOAA Space Weather Prediction Center (SWPC) for personal and educational use. This dashboard is not intended for navigation or safety-critical decisions. Conditions can change rapidly.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
