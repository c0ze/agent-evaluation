# Three Riskiest Assumptions — Offline Inspection Sync

Based on [BRIEF.md](BRIEF.md) and documented in [PLAN.md](PLAN.md), the three assumptions carrying the highest operational, architectural, and regulatory risk are summarized below.

---

## 1. Offline Enforceability & Forensic Completeness of the 24-Hour Post-Acceptance Purge (`A6` / Decision `D1`)

- **What we assumed:** When an inspection is marked `accepted` on the server, the tablet either learns of acceptance in time to purge local customer data within 24 hours—or proactive eviction immediately after submission sync plus device-sync-triggered cleanup satisfies the regulatory mandate—and local deletion across SQLite, attachments, and caches removes all recoverable customer data.
- **Why it is risky:** Acceptance typically happens asynchronously on the server (e.g., supervisor approval on the web) *after* the inspector leaves the site. If the tablet is turned off or disconnected over a weekend (> 24 hours), the device physically cannot receive the `accepted` signal within 24 hours. Conversely, enforcing a blind 24-hour local deletion timer regardless of sync state risks destroying *unsynced* basement notes and photos. On the technical side, ordinary SQLite `DELETE` leaves deleted PII inside SQLite freelist/WAL pages, OS photo galleries, or HTTP/crash caches unless explicitly scrubbed.
- **What breaks if wrong:** Either systemic regulatory compliance breaches (residual customer PII remaining on tablets > 24 hours after acceptance) or catastrophic field data loss if naive TTL timers purge unsynced drafts.
- **Validation & mitigation:** Lock regulatory interpretation with Legal/Compliance in `M0` (`D1`), proactively evict local customer data immediately once a `submitted` inspection reaches zero pending outbox items (closing the offline-at-acceptance exposure window), and verify `PRAGMA secure_delete=ON`, WAL truncation, private storage isolation, and crypto-shredding via forensic canary-PII scans in `M4`.

---

## 2. Backend Integer-Version Extensibility & Low Supervisor-Inspector Field Overlap (`A4`, `A3` / Decision `D2`)

- **What we assumed:** Existing REST APIs using integer record versions can be extended backward-compatibly with `Idempotency-Key` deduplication, field-level `PATCH`/3-way conflict context, resumable attachment uploads, and offline audit attribution—and supervisor web edits overlap with the *exact same* form fields an offline inspector edits rarely enough that a non-collaborative conflict model works smoothly.
- **Why it is risky:** With coarse whole-record integer versions alone, *any* routine supervisor web edit (such as updating schedule metadata or adding a review note) increments `version` from `N` to `N+1` and triggers a `409 Conflict` against the returning offline tablet. Without idempotency keys, intermittent stairwell connectivity timeouts *after* a server DB commit also produce spurious `409` errors or duplicate mutations/photos. Conversely, if supervisors frequently co-edit the same checklist fields simultaneously while inspectors are offline, excluding a collaborative editor will create heavy manual conflict friction or unsafe Last-Write-Wins overwrites that violate audit rules.
- **What breaks if wrong:** High `409` failure rates, duplicate/orphaned photo uploads, audit gaps lacking offline provenance, or unacceptable inspector/supervisor conflict fatigue that stalls the pilot.
- **Validation & mitigation:** Audit production inspection edit logs and REST backend constraints during `M0` to measure real web-vs-mobile field overlap; deliver server `Idempotency-Key`, field-level `PATCH`, resumable upload, and immutable conflict-audit endpoints in `M1` before building mobile sync; test post-commit network drops and dual-actor conflicts continuously in `M3`/`M4`.

---

## 3. Offline Authentication Continuity & Tablet Storage/Lifecycle Headroom (`A7`, `A1`, `A5` / Decisions `D4`, `D5`)

- **What we assumed:** Managed tablets preserve offline session access across multi-hour or multi-day offline shifts without expiring tokens blocking field work or triggering destructive cache wipes on `401`, and tablets have sufficient encrypted local storage and OS background reliability to queue multiple 40-photo inspections plus signatures reliably.
- **Why it is risky:** Enterprise SSO/IdP policies frequently enforce short access/refresh token lifetimes (or token rotation) and existing read-through-cache mobile apps commonly respond to `401 Unauthorized` by logging the user out and clearing local SQLite caches. If a tablet enters a basement, loses signal for several hours, and hits an expired token during background sync on reconnect, a naive `401` handler would erase unsynced inspection notes and up to 40 photos. Similarly, storing uncompressed 40-photo bursts across several queued inspections can exhaust tablet flash space or trigger OS OOM/background task kills mid-upload.
- **What breaks if wrong:** Silent destruction of unsynced regulatory records upon token expiry, mid-basement inspector lockouts, or stalled 40-photo uploads that miss submission and purge windows.
- **Validation & mitigation:** Inspect current MDM/IdP session policies and target tablet free-disk baselines in `M0` (`D4`, `D5`); decouple offline UI unlocks from network token checks and enforce non-destructive `401` outbox pausing; compress photos at capture (~1–2 MB max) with chunked resumable uploads and low-disk pre-flight guards validated on physical devices in `M3`–`M5`.
