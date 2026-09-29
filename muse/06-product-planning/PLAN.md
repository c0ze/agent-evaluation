# PLAN.md — Offline inspection sync (tablet)

## 0. Assumptions (explicit)

1. **Single active editor in the field.** One inspector owns an inspection at a time; supervisor web edits are occasional corrections, not simultaneous co-editing. (Per brief: no full collaborative editor.)
2. **Company-managed tablets.** MDM exists; OS-level encryption and remote wipe available. App does not need to solve device provisioning.
3. **Server is source of truth.** REST + integer record versions (`version` increments on every accepted write; stale-version write → `409 Conflict`). No server rewrite to UUIDs/CRDTs.
4. **SQLite already on device**, currently read-through cache. We will promote it to a durable offline store with a write queue — no new storage engine.
5. **Up to 40 photos per inspection**, tablet camera, ~3–5 MB each before compression. Basement = zero signal; outside = intermittent/flaky signal.
6. **Audit history is append-only and server-side.** Local audit events must survive until acknowledged by server; local deletion (24 h rule) never deletes server audit trail.
7. **"Accepted" is a server-side state transition.** The 24 h local-data-removal clock starts at the server's `acceptedAt` timestamp, not the device clock.
8. **Auth sessions outlast offline periods.** Offline work happens under a previously authenticated session; token refresh occurs when online. No offline login for a new user.
9. **Pilot scope:** one team / small set of inspection types, existing REST API can gain a small number of additive endpoints/fields without breaking web client.

If any assumption is wrong (esp. 1, 2, 8), the decisions in §12 must be revisited.

## 1. User flow (inspector, offline-first)

1. **While online — assignment sync.** Inspector opens "My work"; app downloads assigned inspections + form schemas + reference data, stores in SQLite with `syncedVersion`. Shows "Ready for offline" badge per inspection.
2. **Go offline (basement).** Banner: "Offline — changes saved on this device." Opening an assigned inspection always works from local store. Previously the lost-connection-after-open data-loss bug is fixed by rendering exclusively from SQLite, never from in-memory network response.
3. **Fill forms offline.** Every keystroke/field change writes to SQLite immediately (debounced persist) + appends to local op log. Draft survives app kill / reboot.
4. **Photos offline (up to 40).** Capture → compress + thumbnail → queue for background upload. Counter shows `12/40`, queued bytes, and per-photo state (queued / uploading / uploaded / failed).
5. **Signature offline.** Captured as a photo-class attachment with signer name + device timestamp; flagged "unverified time" until server stamps receipt.
6. **Reconnect (intermittent).** Sync engine runs automatically with backoff; inspector can also tap "Sync now." Progress UI per inspection: pending ops count, attachments remaining.
7. **Conflicts.** If a supervisor edited the same inspection on the web, inspector sees a non-blocking "Review changes" screen at sync time (see §5), never silent overwrite.
8. **Submit / accept.** Inspector submits when complete; supervisor accepts on web. Within 24 h of server `acceptedAt`, app wipes local customer payload for that inspection (see §7).

**Supervisor (web) flow:** unchanged, plus a conflict-resolution view showing field-level inspector vs. supervisor values and the merged result.

## 2. Scope boundaries

**In scope (pilot):**
- Offline open, form fill, 40 photos, signature for *assigned* inspections.
- Op-log sync over existing REST + versions; last-writer-loses-per-field merge for form fields (see §5).
- Background attachment upload with resume; local encryption at rest; 24 h post-accept wipe.
- Audit trail capture and server reconciliation; pilot instrumentation and staged rollout.

**Explicitly out of scope:**
- Full collaborative/real-time co-editing (no OT/CRDT, no live cursors).
- Offline access for unassigned or historical inspections; offline search across all records.
- Cross-device handoff mid-inspection (one device per inspection per assignment).
- New offline login / new-user provisioning while offline.
- Video attachments, offline map tiles, or >40-photo inspections in pilot.

## 3. Local data model (SQLite)

Keep existing cached tables; add:

- `inspections(id PK, serverVersion INT, localDirty BOOL, status, schemaVersion, syncedAt, acceptedAt NULL)`
- `field_values(inspectionId, fieldKey, value, updatedAt, updatedBy, baseVersion)` — one row per field; `baseVersion` = server version the edit was made against.
- `op_log(seq INTEGER PK AUTOINCREMENT, inspectionId, type, payload JSON, baseVersion, createdAt, state: pending/sent/acked/failed)` — the write queue. Never delete until server acks.
- `attachments(id PK, inspectionId, kind: photo|signature, localPath, thumbPath, bytes, hash SHA-256, state, uploadId NULL, attempts)` — binary in files, metadata in DB.
- `audit_events(seq PK, inspectionId, actor, action, detail JSON, deviceTime, state: pending/acked)` — local audit buffer.
- `sync_state(inspectionId PK, lastAckedOpSeq, lastServerVersion, attachmentsDone BOOL)`

**Rules:** all field writes go through `field_values` + `op_log` in one SQLite transaction. Schema migrations via versioned `PRAGMA user_version` scripts, tested up/down.

## 4. Sync protocol (additive on REST + integer versions)

- **Upload order:** `op_log` in `seq` order per inspection, then attachments, then submit. Each op carries `baseVersion` (the `serverVersion` the client last saw).
- **Happy path:** `POST /inspections/{id}/ops {baseVersion, ops[]}` → server applies if `baseVersion == currentVersion`, bumps version, returns `{newVersion, ackedSeq}`. Client sets `serverVersion = newVersion`, marks ops acked.
- **Stale write:** server returns `409 {currentVersion, currentFields}`. Client stores server snapshot, runs conflict policy (§5), replays merged ops with new `baseVersion`. No op is dropped without user-visible resolution.
- **Attachments:** separate resumable upload — `POST /uploads {hash, bytes}` returns `uploadId`; `PUT /uploads/{id}/chunk {offset}` with `Content-Range`; `POST /inspections/{id}/attachments {uploadId, hash, kind}` links after bytes complete. Idempotency key = content hash, so retries after signal loss never duplicate. Photos upload in the background even before form submit; link step is idempotent.
- **Download:** `GET /inspections/assigned?sinceVersion=` delta + `GET /inspections/{id}` full; form-schema versioned (`schemaVersion`) so an old app refuses to open a newer schema offline rather than corrupting data.
- **Intermittent connectivity:** exponential backoff with jitter, only on Wi-Fi/cellular-unmetered for bulk photo bytes (configurable); small ops sync on any connection. "Sync now" forces one attempt.

## 5. Conflict policy (no silent loss)

- **Granularity: per field.** Each form field merges independently; whole-record last-write-wins is forbidden.
- **Rule:** if supervisor changed field F on the web (version advanced) and inspector also changed F offline against an older `baseVersion` → conflict on F. Fields changed on only one side auto-merge.
- **Resolution UX:** inspector sees conflict screen listing only conflicting fields: "Yours (offline)" vs. "Supervisor (web)" vs. recommended merge. Default recommendation: supervisor wins on administrative fields (status, assignee, priority); inspector wins on field-observation fields (notes, measurements, photos, signature) — but inspector must confirm each conflicted field. Unconfirmed conflicts block submit, not further editing.
- **Attachments/signatures never auto-merge-conflict:** both sides' photos are kept (union by hash); duplicate signatures kept with timestamps; supervisor picks authoritative signature on web.
- **Audit:** every conflict + resolution recorded as an audit event with both values and the decider.

## 6. Attachments

- Cap enforced locally: 40 photos + 1 signature per inspection (server re-validates; 41st rejected with clear error).
- Pipeline: capture → downscale/compress (target ≤1 MB/photo pilot default, tunable) → thumbnail → SHA-256 → queue. Original kept until upload acked, then eligible for 24 h-wipe.
- Upload order: oldest first, one-at-a-time on cellular, up to 3 parallel on Wi-Fi; resume via `uploadId` + offset; retry budget per photo (e.g., 10 attempts) then surface "failed — retry" without blocking form-op sync.
- Signature: stored as `kind=signature` with signer name + role; device time marked unverified; server stamps `receivedAt` on link; acceptance requires a linked signature.

## 7. Security and 24 h removal

- **At rest:** SQLite encrypted (SQLCipher or platform keystore-backed key); photo files in app-private sandbox, encrypted on devices without file-level encryption. Keys in Android Keystore / iOS Keychain, never in the DB.
- **In transit:** TLS only; cert pinning for pilot endpoints; auth tokens in secure storage; attach token per request, refresh when online.
- **24 h rule:** server sends `acceptedAt` on sync/push. A per-inspection deadline `acceptedAt + 24 h` (server clock) triggers a wipe worker: delete `field_values` payload, photo/signature files, and op payloads for that inspection; keep only `{inspectionId, acceptedAt, wipedAt}` tombstone + already-acked audit refs. Wipe runs even if app is backgrounded (WorkManager/BGTask) and reports `wipedAt` on next sync. If the device stays offline past the deadline, wipe executes immediately on local schedule using last-known `acceptedAt`, then confirms with server when online — overdue local data is never retained waiting for connectivity.
- **MDM:** remote wipe/lock via existing MDM; rooted/jailbroken devices blocked at login.

## 8. Migration / backfill

- **Client:** versioned SQLite migration promoting cache tables to the §3 schema; existing cached rows become `serverVersion`-stamped clean rows with empty op log. Users with unsaved in-memory drafts (the current data-loss case): on first launch after update, attempt one best-effort submit if online, else discard with an explicit notice — no silent carryover.
- **Server (additive only):** add `POST .../ops` (or accept `If-Match: version` on existing `PUT` if preferred), resumable upload endpoints, `acceptedAt` field, conflict payload on `409`. Old app versions keep working against old endpoints; new endpoints ignore unknown fields.
- **Backfill:** none required for historical inspections (out of scope). Pilot seeds only currently assigned inspections.

## 9. Observability

- Client events (buffered, uploaded with sync): sync attempt/success/fail, `409` count, per-field conflict count, attachment attempts/bytes/resumed, time-to-first-offline-open, wipe executed/overdue.
- Server metrics: ops accepted vs. `409` rate, attachment dedup-by-hash rate, accept-to-wipe-confirmation lag (must be <24 h + tolerance).
- Pilot dashboard minimum: offline open success rate, sync success within 1 h of reconnect, conflict rate, photo upload completion, wipe-compliance %. Crash reporting must tag offline vs. online sessions.
- Logs carry `inspectionId + opSeq range + baseVersion → newVersion` for every sync; no customer PII in analytics events.

## 10. Staged rollout

- **Stage 0 — internal:** team-only dogfood with forced-offline test scripts; gate: zero data-loss events, wipe verified on test devices.
- **Stage 1 — pilot:** one inspection team, feature flag per team + app version gate; offline capability advertised only for assigned inspections. Gate: §9 metrics meet acceptance (§11 M1–M3) for two consecutive weeks.
- **Stage 2 — broad:** enable per team cohort; keep kill switch (server flag forces client to read-only-online mode). No full fleet flip in one step.

## 11. Rollback

- **Client:** feature flag disables new offline writes (falls back to current online behavior); already-queued ops remain in `op_log` and sync normally — queued data is never discarded by rollback. If a build must be pulled, the SQLite schema migration is forward-compatible: newer DB opens read-only on older build for assigned inspections already synced.
- **Server:** additive endpoints stay deployed (old clients ignore them); if `/ops` misbehaves, revert to version-checked `PUT` path via flag. Rollback never deletes server audit history or accepted records.

## 12. Testing

- **Unit:** op-log ordering, per-field merge matrix (clean / one-sided / both-sided), hash-dedup idempotency, wipe scheduler math (server-clock based).
- **Integration:** flaky-network harness (drop after open, kill mid-upload, 409 injection); kill-app-mid-edit durability; reboot-mid-queue recovery; schema-version mismatch refusal.
- **Field simulation:** airplane-mode basement walkthrough for full 40-photo + signature inspection; intermittent-signal replay (proxy with 1–5 min outages).
- **Security/compliance:** verify encrypted DB/files, token handling, 24 h wipe including the stays-offline-past-deadline case, MDM wipe.
- **Acceptance (pilot exit):** zero silent data loss; 100% of conflicts surface in UI; photo completion ≥99% within 24 h of reconnect; wipe confirmations 100% within deadline; `409` handling covered by automated tests.

## 13. Milestones (no dates; dependency-ordered)

- **M0 — Decisions (§14) signed off.** Dependency: none. Acceptance: each decision recorded with owner.
- **M1 — Durable local draft.** SQLite write queue + render-from-DB (fixes data-loss bug); unit + kill-app tests. Acceptance: airplane-mode edit → kill → reopen shows all data.
- **M2 — Op sync + conflicts.** `POST /ops`, 409 handling, per-field merge UI. Depends on M1. Acceptance: supervisor+inspector concurrent edit → conflict screen, no silent overwrite, audit entry written.
- **M3 — Attachments offline.** Resumable photo/signature upload, 40-cap, hash dedup. Depends on M1. Acceptance: 40-photo inspection completes over intermittent link; duplicate retry creates one server copy.
- **M4 — Compliance + hardening.** Encryption at rest, 24 h wipe worker, MDM posture. Depends on M1–M3. Acceptance: wipe verified on-device and server-confirmed within deadline, including offline-past-deadline case.
- **M5 — Pilot + instrumentation.** Flags, dashboard (§9), staged rollout runbook. Depends on M2–M4. Acceptance: pilot gates in §10 met before broad rollout.

M2 and M3 can proceed in parallel after M1.

## 14. Decisions required before implementation (with recommendations)

1. **Conflict default per field class.** *Recommendation:* supervisor-wins admin fields, inspector-wins observation fields, inspector confirms all true conflicts (see §5). Keeps pilot simple without a merge-rules engine.
2. **Reuse `PUT` + `If-Match` vs. new `POST /ops` endpoint.** *Recommendation:* new `POST /ops` accepting a batch with `baseVersion`; preserves existing `PUT` for web, gives clean 409-with-snapshot semantics and ordered replay.
3. **Photo size/quality target.** *Recommendation:* compress to ≤1 MB/photo pilot default with server-side retention of compressed + thumbnail; revisit if regulation demands originals.
4. **24 h clock source.** *Recommendation:* server `acceptedAt` exclusively; device clock never starts the clock (prevents timezone/tamper skew).
5. **Offline scope limit.** *Recommendation:* assigned inspections only for pilot; historical archive stays online-only (bounds storage, wipe surface, and backfill work).
6. **Minimum app/schema version gate.** *Recommendation:* block offline open when `schemaVersion` mismatches; force update rather than risk corrupt submissions.
