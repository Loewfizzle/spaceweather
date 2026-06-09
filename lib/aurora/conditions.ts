// Pure blurb-text helpers shared by the three condition modals.
// All functions are stateless and side-effect free — safe to unit-test directly.

// ── CurrentConditionsModal blurbs ─────────────────────────────────────────────

export function windBlurb(speed: number | null): { status: string; body: string } {
  if (speed === null) return { status: "no data", body: "Solar wind readings aren't available right now." };
  const s = Math.round(speed);
  if (speed >= 800) return { status: `${s} km/s — very fast`, body: `At ${s} km/s the solar wind is screaming — this is storm-level activity. Massive amounts of energy are being delivered to Earth's magnetosphere. Combined with a southward Bz, aurora conditions are as good as it gets.` };
  if (speed >= 600) return { status: `${s} km/s — fast`, body: `At ${s} km/s the solar wind is well above normal. It's delivering more energy than usual to Earth's magnetosphere, making aurora more likely — especially if Bz dips southward.` };
  if (speed >= 450) return { status: `${s} km/s — elevated`, body: `At ${s} km/s the solar wind is slightly above the quiet baseline. Not dramatic on its own, but if Bz tips southward this could contribute to activity.` };
  if (speed >= 300) return { status: `${s} km/s — normal`, body: `At ${s} km/s the solar wind is flowing at a typical background speed. This alone won't trigger aurora — it's the direction of the magnetic field (Bz) and the Kp index that will tell the real story.` };
  return { status: `${s} km/s — slow`, body: `At ${s} km/s the solar wind is unusually slow. Very little energy is reaching Earth's magnetosphere right now.` };
}

export function bzBlurb(bz: number | null): { status: string; body: string } {
  if (bz === null) return { status: "no data", body: "Bz readings aren't available right now." };
  const v = bz.toFixed(1);
  if (bz <= -15) return { status: `${v} nT — strongly southward`, body: `Bz is strongly southward at ${v} nT — about as favorable as it gets. The interplanetary magnetic field has swung south, which essentially opens a door between the solar wind and Earth's magnetosphere. Energy is pouring in and fueling aurora.` };
  if (bz <= -5)  return { status: `${v} nT — southward`, body: `Bz is southward at ${v} nT — a genuinely favorable condition. The magnetic door is partially open, solar wind energy is entering the magnetosphere, and geomagnetic activity is ticking up.` };
  if (bz <= -2)  return { status: `${v} nT — mildly southward`, body: `Bz is mildly southward at ${v} nT — slightly favorable but not strongly so. A deeper southward dip and a longer hold would meaningfully improve aurora chances.` };
  if (bz <= 2)   return { status: `${v} nT — near neutral`, body: `Bz is hovering near zero at ${v} nT — not helping, not hurting. All eyes on which direction it tips next. If it drops southward and holds, conditions can improve quickly.` };
  if (bz <= 10)  return { status: `${v} nT — northward`, body: `Bz is northward at ${v} nT and actively suppressing aurora. Even if solar wind speed is elevated, a northward Bz acts like a closed door — solar wind energy can't enter the magnetosphere efficiently.` };
  return { status: `${v} nT — strongly northward`, body: `Bz is strongly northward at ${v} nT — a significant blocker. Aurora activity is mostly shut down while this holds. Watch for it to flip.` };
}

export function liveKpBlurb(kp: number | null): { status: string; body: string } {
  if (kp === null) return { status: "no data", body: "Kp readings aren't available right now." };
  const v = kp.toFixed(1);
  if (kp >= 8) return { status: `Kp ${v} — extreme storm (G4/G5)`, body: `This is a major geomagnetic event. Aurora is potentially visible across most of the US, including states that almost never see it. If you can get outside right now, do it.` };
  if (kp >= 7) return { status: `Kp ${v} — strong storm (G3)`, body: `Strong geomagnetic storm underway. Aurora is likely visible well into the mid-US and possibly as far south as the mid-Atlantic under dark skies.` };
  if (kp >= 6) return { status: `Kp ${v} — moderate storm (G2)`, body: `A moderate geomagnetic storm. Aurora should be visible across the northern US — upper Midwest, Great Lakes, Northeast, Pacific Northwest. Even somewhat light-polluted skies might work.` };
  if (kp >= 5) return { status: `Kp ${v} — minor storm (G1)`, body: `A minor storm — the threshold where aurora becomes reliably visible across the northern tier of the US. Get away from city lights and look north.` };
  if (kp >= 4) return { status: `Kp ${v} — enhanced`, body: `Above the quiet threshold. Aurora is possible in the far northern US and southern Canada, but you'll need genuinely dark rural skies to see it.` };
  if (kp >= 3) return { status: `Kp ${v} — mild activity`, body: `Mild geomagnetic activity. Aurora is reliably visible in Alaska and northern Canada. The very northern fringe of the lower 48 is borderline — patience and dark skies required.` };
  if (kp >= 1) return { status: `Kp ${v} — quiet`, body: `Conditions are quiet. Aurora is visible in Alaska and the high Arctic, but unlikely to make it further south at this level.` };
  return { status: `Kp ${v} — very quiet`, body: `Geomagnetically very quiet. Very little aurora activity anywhere on Earth right now.` };
}

export function ovationNABlurb(prob: number | null, processed?: boolean): string {
  if (!processed || prob === null) return "OVATION data isn't available right now.";
  if (prob <= 0)  return "The OVATION model is showing essentially no aurora signal over North America. The oval is sitting well north of the US.";
  if (prob < 5)   return `At ${Math.round(prob)}%, the OVATION signal is very faint. The aurora oval is mostly above Canada — very little reaching the lower 48 right now.`;
  if (prob < 15)  return `At ${Math.round(prob)}%, there's a weak aurora signal over parts of North America. Activity is mainly confined to Alaska and the northern fringe of the US.`;
  if (prob < 30)  return `At ${Math.round(prob)}%, the OVATION model is showing a meaningful aurora signal over North America. Activity is reaching toward the northern US.`;
  if (prob < 50)  return `At ${Math.round(prob)}%, OVATION is showing significant aurora activity over North America. Conditions are favorable for the northern US.`;
  return `At ${Math.round(prob)}%, OVATION is showing a very active aurora oval. This is a strong aurora event.`;
}

export function ovationUserBlurb(
  prob: number | null,
  label?: string | null
): { first: string; rest: string | null } | null {
  if (prob === null) return null;
  const name = label ?? "Your location";
  if (prob <= 1)  return { first: `${name} is showing less than 1% on the OVATION model — the aurora oval isn't reaching your area right now.`, rest: null };
  if (prob < 10)  return { first: `${name} is showing ${Math.round(prob)}% — a faint signal at your latitude.`, rest: `Aurora could be present but would be very faint and hard to see.` };
  if (prob < 25)  return { first: `${name} is showing ${Math.round(prob)}% — a marginal but real signal.`, rest: `Dark skies and patience could be rewarded tonight.` };
  if (prob < 50)  return { first: `${name} is showing ${Math.round(prob)}% — a solid reading.`, rest: `Aurora is plausibly visible from your location right now. Worth going outside.` };
  return { first: `${name} is showing ${Math.round(prob)}% — a strong OVATION signal directly over your location.`, rest: `Aurora overhead right now.` };
}

// ── ViewingWindowModal blurbs ─────────────────────────────────────────────────

export function forecastKpBlurb(kp: number): string {
  if (kp >= 8) return `Kp ${kp.toFixed(1)} is an extreme geomagnetic storm — one of the strongest on record. Aurora may be visible as far south as Florida and Texas. Get outside right now if skies are clear.`;
  if (kp >= 7) return `Kp ${kp.toFixed(1)} is a major storm. Aurora should be visible well into the southern US. This kind of event is rare — don't miss it.`;
  if (kp >= 6) return `Kp ${kp.toFixed(1)} is a strong storm. Aurora should be visible across most of the upper Midwest, the Northeast, and the Pacific Northwest — even from a suburban backyard.`;
  if (kp >= 5) return `Kp ${kp.toFixed(1)} is a moderate storm. This is the level where aurora becomes reliably visible across the northern US. Get somewhere dark and look north.`;
  if (kp >= 4) return `Kp ${kp.toFixed(1)} is slightly elevated above quiet. Aurora is possible in the far northern states but you'll need very dark, rural skies — city light pollution will wash it out.`;
  if (kp >= 3) return `Kp ${kp.toFixed(1)} is quiet-to-borderline. Aurora is mostly limited to Alaska and the very northern fringe of the lower 48.`;
  return `Kp ${kp.toFixed(1)} means conditions are quiet. Aurora activity is minimal and only visible in Alaska and northern Canada right now.`;
}

export function viewingWindowLocationBlurb(
  userLat: number,
  kp: number,
  label?: string | null
): { first: string; rest: string | null } {
  const minLat = Math.max(30, 67 - kp * 3);
  const diff = userLat - minLat;
  const name = label ?? "Your location";
  if (diff >= 5)   return { first: `${name} is comfortably within the viewing zone at this activity level — good conditions for you tonight.`, rest: null };
  if (diff >= 0)   return { first: `${name} is just inside the viewing zone tonight.`, rest: `Dark skies away from city lights will make a real difference.` };
  if (diff >= -3)  return { first: `${name} is just outside the typical viewing zone.`, rest: `Conditions would need to tick up slightly for aurora to reach you.` };
  const needed = Math.min(9, Math.floor(Math.max(0, (67 - userLat) / 3)));
  if (diff >= -8)  return { first: `${name} is outside the viewing zone at this Kp level.`, rest: `Activity would need to reach around Kp ${needed} for aurora to be likely from your area.` };
  return { first: `${name} is well south of the aurora oval right now.`, rest: `Aurora reaching your area would require a very strong storm — Kp ${needed} or higher.` };
}

// ── AuroraMapModal blurbs ─────────────────────────────────────────────────────

export function mapLocationBlurb(
  prob: number,
  label: string | null
): { first: string; rest: string | null } {
  const name = label ?? "Your location";
  if (prob <= 0)  return { first: `${name} is showing no OVATION signal right now.`, rest: `The aurora oval isn't reaching your area.` };
  if (prob < 5)   return { first: `${name} is showing less than 5% on the OVATION model.`, rest: `The aurora oval is close but not quite overhead — very faint activity at best.` };
  if (prob < 15)  return { first: `${name} is showing ${Math.round(prob)}% — a faint but real signal.`, rest: `Aurora is present in your region, though it would be subtle. Dark skies and patience required.` };
  if (prob < 30)  return { first: `${name} is showing ${Math.round(prob)}% — a meaningful reading.`, rest: `There is aurora above your area right now. If skies are clear, it's worth going outside.` };
  if (prob < 50)  return { first: `${name} is showing ${Math.round(prob)}% — a solid signal.`, rest: `Aurora should be visible from your location under dark skies. Get away from city lights and look north.` };
  return { first: `${name} is showing ${Math.round(prob)}% — a strong OVATION signal directly over your location.`, rest: `This is an active aurora event at your latitude.` };
}
