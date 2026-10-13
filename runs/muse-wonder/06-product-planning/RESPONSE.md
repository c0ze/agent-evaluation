# Three Riskiest Assumptions — Offline Inspection Sync

Full context, mitigations, and milestone gates are in `PLAN.md` (§2 assumptions table, §14–§16). This file is the short list to resolve first, in M0, before mobile implementation depends on them.

---

## 1. A-01 — Inspectors can pre-download assigned inspections before losing signal

**Assumption:** Inspectors know their assigned inspections ahead of entering a no-signal basement, and have a connected moment (depot Wi-Fi, start of shift) to download them.

**Why it is riskiest:** The entire offline design is "download → work offline → sync." If dispatch is ad hoc — inspections created or reassigned while the inspector is already underground, or the inspector goes straight from home to site with no depot stop — there is nothing on the tablet to open. No local data model or sync protocol can fix a workflow that never had a connected starting point, and the failure mode is total: the job cannot be done that day, not degraded.

**If wrong:** Inspectors either return to the old paper/online workaround for those jobs, or pressure builds to download far more than assigned work "just in case" — which expands the customer-data footprint on every device and enlarges the 24-hour purge surface (PLAN.md §9), trading a workflow problem for a compliance one.

**Early signal / validation (M0):** Interview dispatchers and inspectors and measure, from existing assignment data, the gap between assignment creation and site arrival, and how often assignments change inside that gap. If short-notice assignment is common, this is a dispatch-process decision, not an app feature.

**Mitigation in the plan:** the app shows an explicit per-inspection "Ready offline" state so an unprepared tablet is visible *before* the inspector leaves (§3.2), never discovered in the basement. **Contingency if false:** expand pre-download to a rolling window of likely/next inspections for the inspector's area (bounded by the purge implications above), or change dispatch lead time. Decision owner: product + dispatch operations, gate: M0.

---

## 2. A-02 — Tablets can hold and move up to 40 photos per inspection over intermittent links

**Assumption:** Managed-tablet storage and battery hold a day's assigned inspections with up to 40 photos each, and the photos as captured can actually be uploaded in the intermittent connectivity windows inspectors get.

**Why it is risky:** Forty photos is a hard requirement in the brief, but nothing in the brief states photo resolution, inspections per day, or how long a typical connection window lasts. At original camera resolution, a multi-inspection day can reach gigabytes; an intermittent link that is fine for form data may never drain a photo queue. This assumption couples three independent unknowns (device storage, capture size, link budget), and any one of them failing fails the whole upload.

**If wrong:** uploads stall or fail repeatedly, inspections sit in "syncing" limbo, supervisors cannot review or accept, and the acceptance that triggers the 24-hour purge (A-08) is delayed — so a performance problem becomes a schedule and compliance problem. Worse, storage-full failures can arrive mid-inspection, in the basement, when nothing can be offloaded.

**Early signal / validation (M0):** measure the actual photo-size distribution from the current app/devices, count assigned inspections per inspector-day, and log real connectivity windows from the field. Feed all three into one arithmetic check: bytes-per-day vs. bytes-uploadable-per-window. This is a measurement task, not a design debate — it must produce numbers before D-05 (photo resolution and chunked/resumable upload) can be set.

**Mitigation in the plan:** photo budget set from M0 measurements rather than assumed (§8, D-05), hash-first resumable upload so partial progress survives dropped connections (§6.3), storage-pressure warnings before capture blocks (§3.3), and attachment upload time/failure rate as a pilot exit criterion (§11–§12). **Contingency if false:** lower capture resolution with a documented quality exception for specific inspection types, require end-of-shift depot sync, or split "form accepted" from "photos complete" in supervisor review (a product decision, surfaced by pilot data — not silently built). Decision owner: mobile + product, gate: M0 measurement → D-05 before M2.

---

## 3. A-04 — Supervisor and inspector rarely edit the same field on the same inspection

**Assumption:** Same-inspection edit overlap between a supervisor (web) and an inspector (offline tablet) is rare, and when it happens it touches different fields — so a field-level auto-merge with manual resolution of the remainder is enough, and no collaborative editor is needed.

**Why it is risky:** The brief simultaneously states that supervisors *can* edit the same inspection from the web and that product does *not* want a full collaborative editor. Those two statements only coexist if same-field collisions are genuinely rare. This assumption is the load-bearing wall for the entire conflict design (§7): the data model (per-field change metadata), the sync protocol (field-level conditional writes), and the inspector UX (`Needs review`) are all sized for "conflicts are the exception."

**If wrong:** if supervisors routinely correct the same fields inspectors are editing in the field, inspectors hit manual conflict resolution daily — on a tablet, possibly under time pressure — and the resolution queue becomes the bottleneck the collaborative editor was avoided to prevent. The likely human response is worse than the queue: inspectors picking whichever value dismisses the dialog fastest, which quietly corrupts the record the audit history exists to protect.

**Early signal / validation (M0):** audit existing server edit history for temporal overlap: how often is an inspection edited by a supervisor while an inspector plausibly holds it open, and do those edits touch the same fields? The overlap *rate* and *field-collision rate* are both needed; a high overlap rate with disjoint fields still validates the plan, a modest overlap rate with concentrated same-field collisions does not.

**Mitigation in the plan:** conflicts are detected per field, different-field edits auto-merge with no user involvement, no value is ever silently overwritten in either direction, and every resolution lands in the audit history with both candidate values (§7.2–§7.3). **Pilot guardrail:** same-field conflict rate is a named pilot exit criterion (§12–§14): if it exceeds what the manual flow demonstrably handles, broad rollout stops and the scope decision is revisited with real numbers — that is a product decision made at the pilot gate, not an engineering surprise discovered after launch. Decision owner: product, informed by M0 audit → D-02 before M3.

---

## Summary

| # | Assumption | One-line test in M0 | Plan falls back to |
|---|---|---|---|
| A-01 | Assignments are known before signal is lost | Measure assignment-to-arrival gap and late-change rate | Wider pre-download window or dispatch lead-time change |
| A-02 | 40 photos/day fit the device and the link | Photo-size × inspections/day vs. measured connectivity windows | Lower capture budget (D-05/D-07), depot sync, split review states |
| A-04 | Same-field supervisor/inspector collisions are rare | Field-collision rate in existing edit history | Stop at pilot gate; revisit scope with measured rates |

All three are resolved with cheap measurements in M0, *before* the local data model (M1), attachment pipeline (M2), and sync/conflict work (M3) are built on top of them. That ordering — measure the risky assumptions first, build second — is the central recommendation of this plan.

