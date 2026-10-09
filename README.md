# FeederFleet

**Turn distributed home batteries into transformer-level flexibility.**
Find the batteries that can safely help the grid — right where the network needs them.

FeederFleet is a concept-level **Virtual Power Plant (VPP)** demo, built for **Avartan '26 (IIT Gandhinagar), Track 8 — "The Feeder as a Power Plant"**.

**Proposed pilot area: Wakad–Tathawade, Pimpri-Chinchwad, Pune, Maharashtra.**
Utility: **MSEDCL** (Maharashtra State Electricity Distribution Company Limited) — a *proposed* stakeholder.
Regulator: **MERC** (Maharashtra Electricity Regulatory Commission).

> ⚠️ **Everything in this demo is simulated.**
> The feeder, the 12 transformers and the 500 homes are **synthetic**. No number here was measured on an MSEDCL feeder.
> FeederFleet has **no** MSEDCL agreement, data access, or control of any real equipment.
> Money values (₹/kWh) are *illustrative pilot rates*, not tariffs.
> The Track 8 brief describes Gujarat feeders; this team proposes Wakad–Tathawade as its pilot area.

### 🔗 Live demo: **[feederfleet.vercel.app](https://feederfleet.vercel.app)** · made by **Team BIT FLARE**

---

## The problem, in one minute

```
 Midday   ☀  solar > home use  →  extra power flows BACK up the wires   (reverse power flow)
 Evening  🌙 no solar + ACs on →  everyone pulls power at the same time (evening peak)
```

The street transformer (a **DT — distribution transformer**) feels both first. At the evening peak one DT can go
**above 100 % of its kVA rating**. It then overheats and ages faster; the usual fix is a costly DT upgrade
(MSEDCL cost data: 100 → 200 kVA ≈ ₹4.2–5.9 lakh).

Home batteries could help, but today each one only looks after its own house.

## The idea

```
 TARGET  →  PROTECT  →  DISPATCH  →  REPLAN  →  VERIFY  →  PAY
```

| Step | What happens | Example (simulated) |
|---|---|---|
| **1. Target** | Forecast which DT will overload, and when | DT-10 forecast: 115 % of its kVA rating, needs 26 kW for 2 h |
| **2. Protect** | Use only energy *above* each owner's backup reserve | Home #141 keeps 85 % → never asked |
| **3. Dispatch** | Ask only enrolled batteries under *that* DT, biggest safe offer first | 6 homes matched, 12.1 kW |
| **4. Replan** | A home stops responding → re-match on the *current* battery state | #229 drops out at 21:30 → no eligible home left → shortfall reported |
| **5. Verify** | Delivered = actual − baseline; telemetry gaps count as zero | Home #137 delivered 2.43 kWh |
| **6. Pay** | Pay only for verified kWh | 2.43 kWh × ₹12 = ₹29.16 *(illustrative rate)* |

Power always flows through the normal wires (home → street network → DT → feeder). The VPP cloud only sends signals.
VPP discharge is capped at each home's own load, so no VPP kWh is ever exported — the homeowner's net-metering
credit and the VPP payment can never pay for the same kWh.

## Simulated results — pre-monsoon hot day (15 May, synthetic)

| Measure | Without VPP | With FeederFleet |
|---|---|---|
| Feeder evening peak | 922 kW | **836 kW** (−9.4 %) |
| Reverse-flow peak at midday | −384 kW | **−360 kW** |
| Worst transformer (DT-10), % of kVA rating | 115 % | **103 %** — target 90 % **not** reached |
| DT-10 request vs matched | 26 kW | 12.1 kW (shortfall 13.9 kW, shown in the UI) |
| Battery below owner's reserve | — | **never** |

**Honest result:** with 8 enrolled batteries on DT-10 (2 of them unavailable) there is not enough energy above the owners'
reserves to hold the DT at 90 %. The demo shows the shortfall instead of hiding it. Enrolment is one config line
(`DT_CFG[9].li` in `src/config/scenario.js`); even 18 enrolled homes only reach ≈ 92 % with the no-export rule.

The **Impact** tab compares three synthetic Pune days. Only the hot pre-monsoon evening overloads a DT.
Winter has the largest midday reverse flow; the monsoon day has little of either.

## What is real and what is synthetic

| Input | Value in the demo | Status |
|---|---|---|
| Solar yield | PVGIS model for Wakad (approx. 18.60 N, 73.76 E): May 4.71, Jul 2.32, Dec 4.51 kWh/kWp/day | model output (PUNE-L-001) |
| Sunrise / sunset | Pune, from timeanddate | fact (PUNE-L-004) |
| Feeder voltage | 22 kV (labels only; some 22/11 kV substations nearby) | news quoting MSEDCL (PUNE-L-007), fact-checked |
| Feeder, DTs, homes, batteries, loads | 12 DTs, 500 homes, 103 controllable batteries | **synthetic / assumption** |
| DT loading | kW ÷ (kVA × power factor 0.9) | **assumption** |
| Evening load | stressed AC-heavy colony | **assumption** — measured Pune homes are lower and peak later (SUR-033) |
| Building type | independent houses | **assumption** — news examples from Wakad are large housing societies; the real mix is unknown |
| Rules | MERC net metering, 70 % DT cap, ToD rebate, DF & DSM Regulations 2024 | primary sources (PUNE-R-*) |

Ledger ids point to `../research/sources/ledger_pune_*.csv`; notes in `../research/pune/`. The Impact tab lists every
dataset the pilot still needs, what public sources give, and how to obtain it.

## What you can do on the website

| Tab | What it shows |
|---|---|
| **Overview** | The idea, animated diagrams, a formula calculator, and the **hardware ↔ software connection (feasibility)**: inverter → Modbus gateway → 4G → cloud, DT sensors → 4G → cloud, and a 4G IoT kit fallback |
| **Community** | A stylised (fictional) neighbourhood map with a 60-second story: problem → match → dispatch → replan → result |
| **DISCOM** | Control room: DT cards (% of kVA), matching engine, replan log, alerts, settlement ledger, value per DT |
| **My Home** | One homeowner's view: solar, battery, reserve slider, payments (example rows are marked EXAMPLE) |
| **Impact** | 24-hour graphs, three Pune days compared, calibration sources, **local data status** |
| **Roadmap** | A 3-month pilot plan (Feb → Apr 2027) and the MERC funding route |

The **Synthetic day** selector in the header switches between pre-monsoon, monsoon and winter days. Days without a DT
event show an explanation instead of the story.

**Try this:** on the Community tab, open *"Try it · homeowner reserve"* and raise home #58's reserve to 80 %.
FeederFleet drops #58, the day re-runs, DT-10 ends higher (≈ 107 %), and #58 is paid ₹0 — it delivered nothing.

URL options (local or deployed): `?view=community&s=31` (second 31 of the story) · `?view=discom` ·
`?view=home&home=312` · `?res=58:0.8` (preset a reserve) · `?scenario=pune-winter`

## Run it on your computer

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install          # download the libraries (first time only)
npm run dev          # start with live reload → open the URL it prints
npm test             # run the test suite (Vitest, ~1 minute)
npm run build        # production build into dist/
npx vite preview --port 4179     # → http://localhost:4179/
```

There is no backend, no database and no API key. The whole simulation runs inside the browser.

## Project structure

```
src/
├── config/
│   ├── pilot.js         pilot area, utility, regulator, labels, local data status   ← change location here
│   └── scenario.js      every simulation number: topology, devices, thresholds, failures, Pune days
├── sim/
│   ├── engine.js        simulation: fleet, solar, load, matching, dispatch, replan, verification
│   └── model.js         read-side helpers for the pages
├── pages/               one file per tab
├── components/          map, diagrams, ledger, small UI pieces
├── data/                economics, glossary, roadmap, funding, why-now (with sources)
└── story.js             the 60-second demo timeline
tests/
├── engine.test.js       units, SoC / energy balance, eligibility, no-export, failures, replan, settlement
├── migration.test.js    Gujarat → Pune regression checks; every cited ledger id must exist
└── pages.smoke.test.jsx every page renders (incl. days with no event)
```

**Built with:** Vite · React 18 · Tailwind CSS · Recharts · Vitest (tests only).

## Units

kW = power (a rate). kWh = energy (an amount). kVA = apparent power (DT ratings). One step = 15 min = 0.25 h,
so energy (kWh) = power (kW) × 0.25. SoC and reserve are stored as fractions (0–1) and shown as %.

## Honest limits

- The feeder, DTs, homes and all results are **simulated**. Only a real pilot can measure real numbers.
- The event is planned from a forecast with a seeded ±5 % error; the feeder-head cap is found with hindsight (optimistic).
- The verification baseline is the simulator's exact "no VPP" run. A real pilot must estimate it (e.g. from similar non-event days).
- Power factor 0.9 is assumed. Voltage is not modelled; transformer loading is.
- The load model is a stressed AC-heavy colony with an evening peak; measured Pune homes peak later (12–1 am in May) and lower.
- The neighbourhood is modelled as independent houses; news examples from Wakad–Tathawade are large housing societies (their shared solar runs common areas), where a society battery may fit better.
- ₹12 per verified kWh and the ₹400/year retainer are **illustrative pilot rates**.
- FeederFleet combines proven VPP and demand-response ideas. It is not a new kind of VPP.

## Next steps to get authorised MSEDCL data

1. MSEDCL "Feeder/DTC information" portal (DT-wise rooftop-solar capacity; needs a guest login).
2. RTI to MSEDCL (Pimpri division): DT list for Wakad and Tathawade — code, kVA, location, DT meter yes/no, quarterly peak load.
3. MoU with MSEDCL for 15-min DT-meter data on 1–3 stressed DTs.
4. Opt-in survey of homes and housing societies (inverter brand, battery, remote-control support) with written consent (DPDP).
5. Ask MSEDCL how a DT-level pilot could count toward its MERC demand-flexibility obligation.

## Glossary

| Term | Meaning |
|---|---|
| **VPP** | Virtual Power Plant — many small batteries coordinated by software to act like one power source |
| **DT** | Distribution transformer — the street transformer (35–50 homes in this synthetic feeder) |
| **Feeder** | The medium-voltage line (22 kV here) from the substation that feeds many DTs |
| **kVA, power factor** | DT ratings are in kVA. kVA = kW ÷ power factor; motors and ACs make the power factor less than 1 |
| **SoC** | State of charge — how full a battery is (0–100 %) |
| **Reserve** | Battery level the owner keeps for power cuts; the VPP never goes below it |
| **Reverse power flow** | Power flowing back from homes towards the substation (midday solar surplus) |
| **DISCOM** | The electricity distribution company (MSEDCL in Pune) |
| **DFPO** | MERC's Demand Flexibility Portfolio Obligation — share of peak demand MSEDCL must be able to shift |
