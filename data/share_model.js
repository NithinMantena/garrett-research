// Garrett share of global data-centre genset turbos.
// Source: ../../garrett_dc_genset_turbo_share.md (research note, Nov 2026).
// Hand-maintained: edit numbers here when the research changes.
window.GARRETT_DATA = window.GARRETT_DATA || {};
window.GARRETT_DATA.shareModel = {
  asOf: "2026-11",
  // Build-up rows. mkt = engine maker share of global DC genset MW (2026e).
  // gtx = Garrett share of that maker's turbos. low/high are the ranges in the note.
  rows: [
    { maker: "Caterpillar", mkt: 0.375, mktLow: 0.35, mktHigh: 0.40, gtx: 0.625, gtxLow: 0.50, gtxHigh: 0.75,
      source: "External: Garrett + BorgWarner",
      evidence: "Turbo specialists say Cat does not build its own turbos. Garrett-format OEM part (466610-xxxx) for 3512/3516 gensets. BorgWarner/Schwitzer mostly on small Cats (3406, 3126, C7). C175 supplier unconfirmed." },
    { maker: "Weichai / Baudouin", mkt: 0.125, mktLow: 0.10, mktHigh: 0.15, gtx: 0.425, gtxLow: 0.25, gtxHigh: 0.60,
      source: "External",
      evidence: "Garrett–Weichai MEG launch (Feb 2026) and Q2 data-centre MEG award; partnership since 1998. Jefferies: ~2,800 Weichai DC engines in 2026." },
    { maker: "Rehlko (Liebherr-built)", mkt: 0.045, mktLow: 0.03, mktHigh: 0.06, gtx: 0.125, gtxLow: 0.0, gtxHigh: 0.25,
      source: "External",
      evidence: "Older Liebherr turbo part numbers use KKK's 53xx-970 format (now BorgWarner)." },
    { maker: "Others (Volvo Penta, Perkins, Doosan, Yuchai)", mkt: 0.10, mktLow: 0.08, mktHigh: 0.12, gtx: 0.20, gtxLow: 0.10, gtxHigh: 0.30,
      source: "Mixed",
      evidence: "Perkins is Cat-owned; Chinese brands use local suppliers." },
    { maker: "Cummins", mkt: 0.225, mktLow: 0.22, mktHigh: 0.25, gtx: 0, gtxLow: 0, gtxHigh: 0,
      source: "Captive (Holset)", evidence: "Cummins owns Holset.", captive: true },
    { maker: "MTU (Rolls-Royce)", mkt: 0.125, mktLow: 0.12, mktHigh: 0.15, gtx: 0, gtxLow: 0, gtxHigh: 0,
      source: "Mostly in-house", evidence: "mtu develops and produces its own turbos for high-performance engines; Accelleron on gas engines.", captive: true },
    { maker: "Mitsubishi", mkt: 0.005, mktLow: 0.0, mktHigh: 0.02, gtx: 0, gtxLow: 0, gtxHigh: 0,
      source: "Captive", evidence: "Own turbo business.", captive: true }
  ],
  headline: { point: 0.31, low: 0.20, high: 0.45 },
  whichUseTurbos: [
    { source: "Diesel gensets, ~0.5–4+ MW (standard DC backup)", turbo: "Yes, always", notes: "Usually 2–4 per engine. Cummins QSK95 has four; Cat C175 two or four; Baudouin 16M55 turbocharged." },
    { source: "Gas reciprocating engines (prime power)", turbo: "Yes", notes: "Lean-burn gas engines are turbocharged." },
    { source: "Small diesels (<~50 kW)", turbo: "Often not", notes: "Irrelevant for data centres." },
    { source: "Gas turbines, fuel cells, batteries", turbo: "No", notes: "Not addressable. Part of the prime-power boom goes here (Cat turbines, BorgWarner turbine generator)." }
  ],
  contentPerMW: {
    revenue: 150, // $M, Garrett DC-related revenue 2026
    gwLow: 30, gwHigh: 35, share: 0.31,
    note: "Implies ~$14–16k turbo content per MW, above the ~$10k assumed earlier. Fits four-turbo C175s and large MEG frames."
  },
  nextSteps: [
    "Done (Garrett turbo share tab): engine data sheets in 78 filings show the 3516E 2,750 ekW, C175-16, C175-20 and 3516C use Garrett turbos and the 3516E 3,000 ekW uses an Accelleron TPX44.",
    "Track which 3516E rating new filings specify: the 3,000 ekW (Accelleron) rating is 33% of 2025–26 Cat MW in the five full state sets.",
    "Find the turbo suppliers for the prime-power gas engines: Cat G3520, Jenbacher J620/J920 and Wärtsilä 34SG/50SG.",
    "Fill maker gaps: Amazon/Google/Meta Ohio permits, the newest Phoenix campuses (Maricopa AQ Data Viewer, which needs its disclaimer accepted), Pinal County and ADEQ.",
    "Collect more full applications (Virginia, Georgia and Ohio post permits only) to test the rating-to-turbo mapping on more sites."
  ]
};
