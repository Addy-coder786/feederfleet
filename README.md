# FeederFleet

**Turn distributed home batteries into feeder flexibility.**
Find the batteries that can safely help the grid — right where the network needs them.

FeederFleet is a concept-level **Virtual Power Plant (VPP)** demo, built for **Avartan '26 (IIT Gandhinagar), Track 8 — "The Feeder as a Power Plant"**.

> ⚠️ **Everything in this demo is simulated.**
> It models a *hypothetical* Gujarat 11 kV feeder. No number here was measured on a real feeder.
> Money values (₹/kWh) are *illustrative pilot rates*, not real tariffs.

---

## The problem, in one minute

Many Gujarat homes now have rooftop solar, and some also have a home battery.

```
 Midday   ☀  solar > home use  →  extra power flows BACK up the wires   (reverse power flow)
 Evening  🌙 no solar + ACs on →  everyone pulls power at the same time (evening peak)
```

The street transformer (called a **DT — distribution transformer**) feels both problems first.
At the evening peak, one DT can go **above 100 % of its rating**. It then overheats and ages faster,
and the usual fix is an expensive transformer upgrade.

Home batteries could help, but today each battery only looks after its own house.
Nobody asks the batteries *under the stressed DT* to help *at the right moment*.

## The idea

FeederFleet coordinates many home batteries like one small power plant — but only where and when the network needs it.

```
 TARGET  →  PROTECT  →  DISPATCH  →  VERIFY  →  PAY
```

| Step | What happens | Example |
|---|---|---|
| **1. Target** | Find the DT that will overload, and when | DT-10 forecast: 103 % at 21:45 |
| **2. Protect** | Use only energy *above* each owner's backup reserve | Owner keeps 30 % → that 30 % is never touched |
| **3. Dispatch** | Ask only batteries under *that* DT, best offers first | 5 homes matched for a 14 kW request |
| **4. Verify** | Measure what each home really delivered (actual − normal behaviour) | Home #137 delivered 2.06 kWh |
| **5. Pay** | Pay only for verified energy | 2.06 kWh × ₹12 = ₹24.72 *(illustrative rate)* |

**Important:** power always flows through the normal wires (home → street network → DT → feeder).
No home sends power to another home by its own cable, and the VPP cloud never carries power — it only sends signals.
The homeowner's normal solar export credit (net metering) stays separate and untouched.

## How it works (system view)

```
  Homes (solar + battery + hybrid inverter)
        │  readings / setpoints over 4G (gateway, Modbus or maker's cloud API)
        ▼
  ┌──────────────────────────┐        DT smart sensor + CT sensor
  │    FeederFleet VPP cloud │ ◄────── (DT loading, current, flow direction)
  │  forecast · match ·      │
  │  dispatch · verify · pay │
  └──────────────────────────┘
        │  "DT-10 will overload at 21:45 → homes 17, 41, 58, 137, 229 please discharge"
        ▼
  Batteries discharge into the local network → DT-10 stays at its 90 % target
```

Two simple rules decide how much a battery can give:

```
 Available energy:  E_avl = Capacity × (SoC − reserve) × efficiency
 Available power:   P_avl = min( inverter limit , E_avl ÷ event hours , what the DT needs )
```

*SoC = state of charge (how full the battery is).*
Example: 5 kWh battery, 95 % full, 30 % reserve → 5 × (0.95 − 0.30) × 0.95 ≈ **3.1 kWh** available.

## Simulated results (one clear, high-solar day)

| Measure | Without VPP | With FeederFleet |
|---|---|---|
| Feeder evening peak | 920 kW | **851 kW** (−7.5 %) |
| Reverse-flow peak at midday | −408 kW | **−369 kW** (−9.7 %) |
| Worst transformer (DT-10) | 103 % of rating | **90 %** |
| Battery below owner's reserve | — | **never** |

Model: 500 battery homes · 12 DTs · 103 VPP-controllable lithium batteries (a *scenario assumption* — there is no public data on the real share) · 15-minute steps · deterministic, so every run gives the same numbers.

## What you can do on the website

| Tab | What it shows |
|---|---|
| **Overview** | The idea, animated diagrams (one-way grid vs two-way local network, the system, the daily loop) and a live formula calculator |
| **Community** | A live map of homes and transformers with a 60-second story: problem → VPP finds batteries → evening event → result |
| **DISCOM** | The utility control room: transformer cards, matching engine, alerts, settlement ledger |
| **My Home** | One homeowner's view: solar, battery, reserve slider, payments |
| **Impact** | 24-hour feeder graph, without vs with VPP, with sources |
| **Roadmap** | A 3-month pilot plan (27 Sep → 27 Dec 2026) and funding route |

**Try this:** on the Community tab, open *"Try it · homeowner reserve"* and raise home #58's reserve to 80 %.
FeederFleet drops #58, calls the standby home #312 instead, DT-10 still stays at 90 %, and #58 is paid ₹0 — because it delivered nothing.

Handy links once it is running:
`?view=community&s=31` (jump to second 31 of the story) · `?view=discom` · `?view=home&home=312` · `?res=58:0.8` (preset a reserve)

## Run it on your computer

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install          # download the libraries (first time only)
npm run dev          # start with live reload → open the URL it prints
```

Or build and preview the final version:

```bash
npm run build
npx vite preview --port 4179     # → http://localhost:4179/
```

There is no backend and no API key. The whole simulation runs inside the browser.

## Project structure

```
src/
├── sim/
│   ├── engine.js        the simulation: homes, solar, load, batteries, matching, dispatch, settlement
│   └── model.js         helpers that read the simulation for the pages
├── pages/               one file per tab (Overview, Community, DISCOM, My Home, Impact, Roadmap)
├── components/          map, diagrams, ledger, small UI pieces
├── data/                economics, glossary, roadmap, sources
└── story.js             the 60-second demo timeline
```

**Built with:** Vite · React 18 · Tailwind CSS · Recharts.

## Honest limits

- The feeder, homes and all results are **simulated**. A real pilot would be needed to measure real numbers.
- The simulation knows the future perfectly (a perfect forecast). Real forecasts have errors.
- It models one clear summer-like day. Winter evenings have less stress.
- Voltage is not modelled; transformer loading is.
- ₹12 per verified kWh and the ₹400/year retainer are **illustrative pilot rates**, not approved tariffs.
- FeederFleet combines proven VPP and demand-response ideas for Indian feeders. It is not a new kind of VPP.

## Glossary

| Term | Meaning |
|---|---|
| **VPP** | Virtual Power Plant — many small batteries coordinated by software to act like one power source |
| **DT** | Distribution transformer — the street transformer that serves roughly 35–50 homes here |
| **11 kV feeder** | The medium-voltage line from the substation that feeds many DTs |
| **SoC** | State of charge — how full a battery is (0–100 %) |
| **Reserve** | Battery level the owner keeps for power cuts; the VPP never goes below it |
| **Reverse power flow** | Power flowing back from homes towards the substation (midday solar surplus) |
| **kW vs kWh** | kW = power (a rate, like speed). kWh = energy (an amount, like distance) |
| **DISCOM** | The electricity distribution company that owns the local network |
