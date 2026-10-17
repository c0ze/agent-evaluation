# Offline inspection sync — product and engineering plan

## 1. Purpose and input

This plan covers adding offline work to the tablet-based building inspection
app so inspectors can complete assigned work with no signal (for example in
basements) without losing notes, then sync safely when connectivity returns.

Sole product input: `BRIEF.md` in this directory. Facts taken from it:

- Inspectors use company-managed tablets; today a lost connection after
  opening an inspection can discard notes.
- Offline, an inspector must be able to open assigned inspections, fill
  forms, take up to 40 photos, and collect a signature.
- Connectivity may return intermittently, not as one clean reconnection.
- Supervisors can edit the same inspection from the web.
- Regulations require an audit history and removal of local customer data
  within 24 hours after an inspection is accepted.
- Server APIs are REST with integer record versions.
- The mobile app has SQLite, currently used as a read-through cache.
- Product wants a pilot before broad rollout and does not want a full
  collaborative editor.

Anything beyond those facts is labelled below as an **assumption** (A#),
a **decision still to be made** (D#), or a **recommendation**. This plan
deliberately contains no calendar dates and no staffing or effort estimates:
sequencing is expressed only as dependencies and exit criteria, because
nothing in the brief justifies dates, team sizes, or durations.

## 2. Goals and success criteria

Goals:

1. No data loss: work captured offline survives app kill, device restart,
   and intermittent connectivity until the server has acknowledged it.
2. Predictable convergence: after sync, tablet, server, and web agree on
   one inspection state, or the disagreement is surfaced to a human —
   never silently resolved by discarding someone's edit.
3. Regulatory compliance: complete server-side audit history; local
   customer data removed within 24 hours of acceptance.
4. Incremental delivery: build on the existing REST APIs, integer record
   versions, and SQLite rather than replacing them.
5. Pilotable: the feature can be enabled for a small group, measured,
   paused, and rolled back without stranding offline work.

Success is measured by the acceptance criteria in §16 (per milestone) and
by pilot exit gates (§13), not by shipping code alone.

## 3. Assumptions (explicit)

Each assumption states what breaks if it is wrong and how to validate it
early. Assumptions A1, A3, and A4 are the riskiest; see `RESPONSE.md`.

| ID | Assumption | If wrong | Validate by |
|---|---|---|---|
| A1 | Assigned inspections (including their form definition version) are known before signal is lost and can be fully downloaded in advance. | Inspectors arrive on site unable to open work; pre-download design fails. | Inspect assignment workflow and timing with operations; check how often assignments change on the day. |
| A2 | One inspector on one tablet is the offline editor of a given inspection; the only concurrent editor is a supervisor on the web. Two tablets do not edit the same inspection offline. | Conflict model must handle multi-device offline divergence, which is materially harder. | Confirm assignment rules; check server data for multi-device edits per inspection. |
| A3 | When a supervisor edits from the web while an inspector is offline, same-field collisions are uncommon enough that manual resolution of those fields is acceptable; edits to different fields can be merged safely. | Inspectors face frequent conflict-resolution work; auto-merge rules may be unsafe for interdependent fields. | Analyse web edit patterns per field; interview supervisors about which fields they change and why. |
| A4 | The integer record version is server-assigned, increases monotonically per record, is returned on every read, and can be enforced on write as an optimistic-concurrency check (reject or flag a write based on a stale version). | Reliable conflict detection on the existing API is impossible; a different versioning/change-tracking design is required first. | Read the API contract and server code; test stale-write behaviour against a staging server. |
| A5 | REST APIs can be extended additively (new endpoints, headers, fields) without breaking the web app or older tablets. | Sync must be squeezed into existing endpoints, limiting idempotency and partial-failure handling. | Confirm API versioning/compatibility policy with the server team. |
| A6 | Tablets are company-managed (MDM or equivalent): full-device encryption is on, remote wipe exists, and app/OS updates can be controlled. | App must carry more of the device-security burden; lost-device and purge guarantees weaken. | Confirm MDM capabilities and enrolment coverage with IT. |
| A7 | A tablet has enough free storage and battery to hold all offline work between syncs, including up to 40 photos per inspection at original quality until the server acknowledges each one. | Photo capture must be capped, compressed, or streamed differently; storage-full failures appear in the field. | Measure fleet free space; measure typical/max photo size from current uploads. |
| A8 | Connectivity does eventually return for long enough to finish sync; no peer-to-peer, removable-media, or "sync via another device" path is required. | A class of inspections can never sync through the designed path. | Confirm with operations; review any sites with permanent no-signal plus no return-to-base pattern. |
| A9 | Device clocks are approximately correct offline. Server time is authoritative once synced; client capture times are recorded but treated as reported, not trusted. | Audit ordering, signature timing, and the 24-hour purge deadline become unreliable. | Sample device clock drift from the fleet; confirm NTP behaviour when online. |
| A10 | A signature captured as an image plus metadata (as today, see D6/D9) remains legally acceptable; no cryptographic/PKI signing ceremony is being introduced. | Signature capture needs a different legal/technical design. | Confirm with compliance/legal owner before implementation. |
| A11 | Form definitions are versioned, and an inspection downloaded under one form version may be completed and submitted against that version even if a newer version is published meanwhile. | Offline work can be invalidated by a form change made while the inspector had no signal. | Confirm form-versioning behaviour and server acceptance rules (D7). |
| A12 | "Accepted" is an explicit server-side status reached after submission/review, and the acceptance event reaches the tablet on a subsequent sync. | The 24-hour local purge cannot be triggered or evidenced reliably. | Confirm the inspection lifecycle states and who/what sets "accepted". |
| A13 | Inspections worked offline already exist on the server with stable IDs at download time; creating brand-new, unassigned inspections fully offline is not required (see scope, §5). | Client must mint IDs and handle offline-create reconciliation. | Confirm with product; this is a scope boundary, not a technical fact. |
| A14 | Audit history must record who changed what, from which surface (web/tablet), the before/after values, and both client-reported capture time and server receipt time; it is retained server-side after local purge. | Audit design may under- or over-collect against the actual regulation. | Confirm exact regulatory wording with compliance before locking the audit schema. |
| A15 | The inspector's authenticated session is established while online before offline work begins; some form of local unlock (device credential/biometric/PIN) is acceptable offline, subject to security sign-off (D6). | Inspectors could be locked out mid-inspection with no signal, recreating today's data-loss problem in a new form. | Security review of token lifetimes and offline unlock policy. |

## 4. Decisions required before implementation

These must be settled (or explicitly accepted as risks by their owners)
before the milestone that depends on them starts. Each has a
recommendation; none is silently assumed away.

### D1. Is SQLite the local source of truth while offline?

- Options: (a) keep SQLite as a cache and queue edits separately;
  (b) once downloaded, SQLite is authoritative locally and the server is
  reconciled from it via an outbox.
- **Recommendation: (b).** A cache can be evicted and cannot promise "no
  lost notes"; a source-of-truth store with an append-only outbox can.
  This is the core architectural change of the project.
- Blocks: M1 (§16). Owner: mobile engineering with product agreement.

### D2. Conflict granularity and winner

- Options: (a) record-level last-writer-wins; (b) record-level manual
  choice ("mine or theirs"); (c) field-level detection — auto-merge edits
  to different fields, manual choice only where both sides changed the
  same field to different values.
- **Recommendation: (c), never silent last-writer-wins for form data.**
  Option (a) discards supervisor or inspector work without a trace in the
  UI (audit may retain it, but the inspection itself loses it), which
  contradicts the "no discarded notes" problem statement. Option (c)
  matches "no full collaborative editor": it is a bounded merge with a
  human decision only on true collisions. Attachments are append-only
  (§9) and do not conflict; deletes of photos by the other party are
  shown, not silently applied (detail in §8).
- Depends on A3 and on whether fields are semantically independent;
  any field group that must change atomically (for example a value plus
  its unit) must be declared a single conflict unit in the form schema.
- Blocks: M2/M4. Owner: product + engineering, with supervisor input.

### D3. Sync protocol shape on top of existing REST + integer versions

- Options: (a) reuse plain CRUD endpoints with client retries;
  (b) additive sync endpoints: push mutations carrying a client-generated
  idempotency key and the base integer version they were made against,
  pull changes via a server-issued cursor; (c) adopt a CRDT/real-time
  collaboration framework.
- **Recommendation: (b).** (a) cannot distinguish "retry of a write the
  server already applied" from a new write, so intermittent connectivity
  produces duplicates. (c) is the full collaborative editor product
  explicitly does not want, and does not fit integer-version REST.
  Option (b) keeps the integer version as the optimistic-concurrency
  token and adds only what sync needs: idempotency, per-item
  acknowledgement, and an incremental pull cursor (including deletions/
  cancellations as tombstones).
- Blocks: M2. Owner: server + mobile engineering. Depends on A4/A5.

### D4. Draft sync vs. submission semantics

- Options: (a) nothing leaves the tablet until the inspector submits;
  (b) drafts sync opportunistically whenever connectivity allows, and
  "submit" is a separate explicit state transition; (c) submit succeeds
  with photos still pending upload.
- **Recommendation: (b), and submit is only confirmed by the server when
  the form and all required attachments are acknowledged.** Offline, the
  inspector can mark "ready to submit"; that intent is queued and the UI
  must show "waiting to submit — not yet received" until the server
  confirms. Option (a) wastes intermittent connectivity and maximises
  data at risk on a lost tablet; option (c) creates accepted inspections
  whose evidence may never arrive.
- Blocks: M2/M3. Owner: product (inspector/supervisor expectations).

### D5. Attachment transfer mechanism

- Options: (a) one request per photo (simple, restart-from-zero on
  failure); (b) resumable/chunked upload per photo with a content hash,
  so an interrupted transfer continues and a retry of a completed photo
  is a no-op; (c) bundle all photos into one archive per inspection.
- **Recommendation: (b).** Intermittent connectivity (brief fact) makes
  restart-from-zero the common case at 40 photos; bundling makes one bad
  photo block all of them. Exact mechanism (server-managed chunks vs.
  object-storage multipart with pre-signed URLs) depends on current
  server storage — unknown from the brief, to be confirmed in M0 — but
  the required properties are fixed: resumable, hash-verified,
  idempotent per attachment, independently acknowledged.
- Blocks: M3. Owner: server + mobile engineering.

### D6. Offline authentication and session lifetime

- Options: (a) hard token expiry even offline (safest, can lock an
  inspector out in a basement); (b) offline work may continue under a
  local unlock (device credential/biometric/PIN) after an online login,
  with server re-authentication required on reconnect before queued
  submissions are accepted; (c) long-lived offline tokens.
- **Recommendation: (b), conditional on security sign-off.** Draft
  capture must never be blocked by token expiry — that recreates today's
  data loss. Submission and download of new customer data may require a
  fresh server session. Token lifetimes, unlock method, and maximum
  offline duration are security-policy values this plan does not invent.
- Blocks: M1 (capture path) and M2 (submit path). Owner: security.

### D7. Form version pinning

- Options: (a) an inspection is completed against the form version
  downloaded with it, and the server accepts that version; (b) the
  server may reject a stale form version at submit, forcing re-entry.
- **Recommendation: (a).** Option (b) punishes the inspector for being
  offline. If a form change is ever legally mandatory mid-flight, handle
  it as an explicit server rejection with a supervisor-led remediation
  flow, not silent data invalidation — and record it in the audit log.
- Blocks: M2. Owner: product + compliance.

### D8. Purge trigger and proof for the 24-hour rule

- Options: (a) purge only when the tablet next syncs and learns of
  acceptance; (b) purge on the acceptance acknowledgement **and** run an
  independent local retention job so data cannot outlive its deadline
  merely because the app is not opened; (c) rely on MDM wipe.
- **Recommendation: (b), with (c) as backstop only.** Under (a), a tablet
  left in a drawer after acceptance retains customer data past 24 hours.
  The deadline must be computed from the server acceptance timestamp
  learned at sync, stored locally, and enforced by a scheduled job that
  also runs on app start and device boot. Each purge writes a local
  receipt (inspection ID, acceptance time, purge time) uploaded on next
  connection as compliance evidence. Edge case to settle with
  compliance: an inspection accepted on the server while the tablet
  never reconnects cannot learn its deadline — the control for that case
  is a maximum local retention for all downloaded customer data,
  independent of acceptance, whose length compliance must set.
- Blocks: M4. Owner: compliance + mobile engineering.

### D9. Photo quality, metadata, and the 40-photo cap

- Options: keep originals vs. recompress on capture; keep vs. strip
  EXIF/location metadata; enforce the 40 cap in UI only vs. UI + local
  DB + server.
- **Recommendation: keep the original file until server acknowledgement;
  generate thumbnails locally for display; do not lossily recompress
  evidence photos unless compliance/product explicitly approve a quality
  floor; decide EXIF/location retention with compliance (location may be
  evidence or may be unnecessary personal data — the brief does not say);
  enforce 40 at UI, DB, and server so no layer can exceed it.**
- Blocks: M3. Owner: product + compliance.

### D10. Pilot cohort, exit gates, and rollback authority

- Options are organisational, not technical: who pilots, what measured
  thresholds permit expansion, who can halt or roll back.
- **Recommendation: pilot with inspectors whose routes include known
  no-signal sites (the population the feature exists for), behind a
  server-controlled feature flag; product and operations set numeric
  gates on the metrics in §12 before the pilot starts — this plan does
  not invent those thresholds; name one rollback decision-maker and
  publish the support runbook before the first pilot device is enabled.**
- Blocks: M6. Owner: product + operations.

## 5. Scope boundaries

In scope (first broad release):

- Download assigned inspections (with form version and reference data
  needed to complete them) for offline use.
- Offline form filling, photo capture/attachment (up to 40), signature
  capture, and offline "ready to submit".
- Automatic, resumable sync over intermittent connectivity, plus a
  manual "sync now" with visible per-inspection status.
- Field-level conflict detection and resolution against supervisor web
  edits (D2).
- Server-side audit history covering web and offline-originated changes.
- Automatic local purge ≤24 hours after acceptance, with receipts (D8).
- Feature-flagged pilot, observability, and rollback path (§§12–14).

Out of scope (explicitly not in this plan):

- A full collaborative editor: no real-time co-editing, presence, or
  character-level merging (per brief).
- Creating brand-new unassigned inspections fully offline (A13).
- Offline editing of the same inspection from two tablets (A2).
- Supervisor offline capability on the web app.
- Peer-to-peer or removable-media sync (A8).
- Changes to what "accepted" means or to the review workflow itself;
  this plan consumes that status, it does not redesign it.
- Replacing REST or the integer-version scheme with a new API style.

Later / only if pilot evidence demands it:

- Offline creation of inspections; background pre-download of likely
  future assignments; server-side image processing (for example OCR);
  richer merge rules for specific field types. Each needs its own plan
  amendment — none is smuggled into the milestones below.

## 6. User flow

Primary flow (inspector):

1. **Prepare (online).** App shows assigned inspections and downloads
   each one the inspector may need, with its form version and reference
   data. Download completeness is explicit per inspection ("ready
   offline" vs. "not downloaded") — never inferred from cache state.
   The inspector can see, before leaving coverage, exactly what is safe.
2. **Open offline.** A downloaded inspection opens from SQLite with no
   network attempt blocking the UI. Its state is visibly "offline —
   changes saved on this tablet".
3. **Work offline.** Every form edit, photo, and the signature is written
   to SQLite/files immediately (no in-memory-only state; see §7). App
   kill or reboot loses nothing already entered. The 40-photo cap and
   required-field validation that can be evaluated locally are enforced
   locally, with the same messages as online where feasible.
4. **Mark ready / wait.** The inspector may mark the inspection "ready
   to submit". Offline, this is queued intent, displayed as "waiting
   for connection — not yet received by the office", never as submitted.
5. **Sync (automatic + manual).** When connectivity appears, sync runs
   per §8: uploads drain in order, server changes are pulled, and each
   inspection shows one of: synced, syncing (with attachment progress),
   waiting (no connection), conflict needs review (§8.3), or failed
   (with a retry and a human-readable reason). Sync tolerates the
   connection dropping mid-flight and resumes.
6. **Resolve conflicts if any.** Only same-field collisions need the
   inspector (or supervisor, per product's choice of resolver — D2
   follow-up) to pick a value, field by field, showing both values,
   who changed them, and capture times. Disjoint edits merge silently
   and are visible in history.
7. **Submitted → accepted → purged.** Server confirmation flips the
   inspection to "submitted". When a later sync reports "accepted",
   the purge countdown starts; after purge the inspection disappears
   from the tablet (or remains as a non-customer-data stub such as ID +
   "accepted/purged" marker, if product wants a record — the stub must
   contain no customer data).

Supervisor flow (web): unchanged editing experience, plus (a) visibility
that an inspection has offline work in flight once any draft sync has
occurred, (b) the same conflict-resolution surface when their edit
collides with synced offline work, and (c) the audit history view (§10).

Failure/edge flows that must be designed, not improvised:

- Storage full during photo capture: block capture with a clear message
  before data is taken that cannot be stored; never drop existing work.
- Token expired on reconnect: drafts remain safe locally; re-auth is
  requested; queued submissions proceed after re-auth (D6).
- Inspection cancelled/reassigned on the server while offline: on sync,
  local work is preserved and shown to a supervisor for disposition —
  never auto-deleted (it may contain evidence already gathered).
- App updated while an outbox is non-empty: migration must preserve the
  outbox (§11); sync resumes after update.
- Tablet lost/stolen: MDM wipe; server flags inspections whose only copy
  of recent work may have been on that device (knowable from last-sync
  state) for operational follow-up.

Local inspection state machine (per inspection):
`not_downloaded → ready_offline → in_progress_offline → ready_to_submit
→ syncing → submitted → accepted → purge_pending → purged`, with
`conflict` and `sync_failed` as interrupt states reachable from
`syncing`, both returning to `syncing` after resolution/retry.

## 7. Local data model

SQLite becomes the local source of truth for downloaded work (D1).
Binary files (photos, signature image) live in app-private file storage;
SQLite stores their metadata and file references. Proposed tables
(names illustrative; column detail is an implementation task, but the
invariants below are requirements):

- `inspections` — server ID, server integer version last synced
  (`base_version`), local state (§6), form version, assignment and
  customer fields needed offline (minimised per §10), `accepted_at`
  (server time, once known), `purge_deadline`, last-sync timestamps.
- `form_values` — per inspection, per field: current local value, value
  as of `base_version` (needed to compute field-level diffs for D2),
  dirty flag, client capture timestamp, editor identity.
- `form_definitions` — versioned form schema as downloaded, including
  which field groups form atomic conflict units (D2).
- `attachments` — client-generated attachment ID, inspection ID, kind
  (photo/signature), file path, content hash, byte size, capture
  timestamp, upload state (`pending/uploading/acked/failed`), server ID
  once acknowledged, per-attachment idempotency key.
- `outbox` — ordered queue of unsynced mutations: client mutation ID
  (idempotency key), inspection ID, mutation type and payload (field
  changes vs. `base_version`, ready-to-submit intent, attachment
  references), attempt count, last error. Rows are deleted only on
  server acknowledgement.
- `sync_state` — per-inspection and global pull cursors, last successful
  push/pull times, server clock offset observed at last sync.
- `local_audit` — append-only record of local edits (field, before/
  after, capture time) retained until the server audit has acknowledged
  them; supports reconstructing exactly what happened offline.
- `purge_receipts` — inspection ID, server acceptance time, local purge
  time, purge trigger; uploaded on next connection (D8).
- `session` — tokens/keys references only, stored via the platform
  keystore/keychain, never as plain SQLite values.

Invariants:

- A user-visible edit is not "saved" until its SQLite transaction and
  any referenced file write are both durable (write file first, then
  commit the row referencing it; orphan files are reconciled on start).
- The outbox is append-and-acknowledge: nothing leaves it except by
  server ack or by a human conflict decision recorded in `local_audit`.
- `base_version` only advances to a server-confirmed version.
- No customer data outside these tables/files: thumbnails, caches,
  logs, and OS backups are part of the purge surface (§10).
- All schema changes ship as forward migrations with the app (§11);
  the DB is never assumed disposable once offline data exists — this is
  the key behavioural change from today's read-through cache.

## 8. Sync protocol

Builds on D3 (additive sync endpoints over REST + integer versions).
Exact URLs/payloads are an M2 design task; the protocol properties are:

### 8.1 Download (pull-to-prepare)

- Fetch assigned inspections with their full offline payload and form
  version; store atomically (an inspection is either fully "ready
  offline" or still "not downloaded" — no half-downloaded state).
- Record `base_version` and a snapshot of field values at that version.

### 8.2 Push (tablet → server)

- Drain the outbox per inspection in capture order; inspections are
  independent of each other.
- Each mutation carries: client mutation ID (idempotency key — safe to
  retry verbatim after a dropped connection), inspection ID,
  `base_version` it was made against, field-level changes (field,
  new value, base value), client capture timestamps, and editor/device
  identity for audit.
- Server applies a mutation only if it can reconcile it against the
  current version (see §8.3); it then increments the integer version,
  writes audit entries (§10), and acknowledges that mutation ID.
  Acknowledgements are per mutation (and per attachment, §9), so a
  connection drop mid-batch loses no confirmed progress.
- Ready-to-submit is a terminal mutation in the queue: the server
  confirms "submitted" only when the form is complete per its rules
  and every required attachment is acked (D4). Until then the server
  state remains a synced draft.

### 8.3 Conflict detection and policy

- If `base_version` equals the server's current version: no conflict;
  apply directly.
- If the server version has advanced (supervisor web edit): the server
  compares, per field, base value vs. current server value vs. incoming
  value. Fields changed by only one side merge automatically. A field
  changed by both sides to different values is a conflict: that field
  is not applied, the rest of the mutation is, and a conflict record
  (both values, both editors, both times) is created for human
  resolution in the UI (§6 step 6). A field changed by both sides to
  the same value converges without human input.
- Resolution itself is a new mutation with its own mutation ID and
  audit entry; the losing value remains in audit history.
- Deletes/cancellations from the web arrive as tombstones on pull and
  follow the §6 "preserve and escalate" rule, never silent deletion.
- No silent last-writer-wins anywhere for form data (D2). Timestamps
  never decide a winner; they are display/audit data (A9).

### 8.4 Pull (server → tablet)

- Incremental: the tablet presents its cursor; the server returns
  changes since then for inspections relevant to this inspector —
  supervisor edits, status changes (including "accepted" with its
  server timestamp), cancellations/reassignments (tombstones), and new
  assignments. Cursor advances only after all returned changes are
  applied locally in one transaction.
- Pull never overwrites un-synced local edits: incoming changes merge
  against `base_version` using the same per-field rules; a collision
  with dirty local fields creates a conflict instead of overwriting.

### 8.5 Intermittency, retries, ordering

- Every request is safe to retry: pushes by idempotency key, pulls and
  attachment chunks by cursor/offset + hash (§9).
- Retries use backoff with jitter and respect connectivity/battery
  signals from the OS; a manual "sync now" bypasses backoff once.
  (Backoff parameters are operational tuning, set during M5 and tuned
  from pilot data in M6 — not invented here.)
- Ordering guarantees are per inspection, not global; the server must
  not require cross-inspection ordering.
- Server time returned with sync responses is recorded to estimate
  device clock offset for display and purge scheduling (A9); audit
  ordering uses server receipt order per inspection plus recorded
  client capture times, not client clock order alone.

## 9. Attachments (photos and signature)

- Capture writes the file to app-private storage, computes a content
  hash, and inserts an `attachments` row in `pending` (§7) before the
  UI confirms the photo. The signature is an attachment of a distinct
  kind, with its own capture metadata (signer name/role as the form
  requires, capture time, inspection ID binding so a signature file
  can never be re-associated with a different inspection).
- Upload (D5): each attachment uploads independently, resumably, keyed
  by its content hash + client attachment ID. Server verifies the hash
  before ack. A retry after ack is a no-op success. Attachment acks are
  independent of form-mutation acks, but submission requires all
  required acks (D4).
- Ordering: photo display order is data (capture sequence number), not
  upload completion order.
- The 40-photo cap is enforced at capture (UI), in the local DB, and on
  the server (D9). Deleting a local photo before upload deletes file +
  row and records the deletion in `local_audit`; deleting after upload
  is a synced mutation, subject to §8.3's no-silent-delete rule against
  the other party's copies.
- Storage management: the app tracks bytes held by un-acked attachments
  and warns before the device is full (§6 edge flow). Acked originals
  may be reduced to thumbnails locally after server ack if storage
  pressure requires it — but only after ack, and full purge still
  follows acceptance (§10).
- Failures are per attachment and visible ("3 of 17 photos waiting"),
  with retry; one corrupt file fails loudly for that photo (hash
  mismatch) and never blocks the rest of the inspection's sync.

## 10. Security, privacy, and compliance

- **Data minimisation:** download only assigned inspections and only the
  fields needed to work offline. The offline dataset is the exposure
  surface on a lost tablet.
- **Encryption at rest:** rely on managed-device full-device encryption
  (A6) plus platform app-sandbox storage; whether SQLite/files need
  additional app-layer encryption (with keys in the platform keystore)
  is a security decision to record in M0 — required if A6 does not hold
  for the whole fleet. Tokens/keys never in plain SQLite (§7).
- **In transit:** TLS for all sync endpoints; certificate handling
  follows the app's existing policy (brief is silent — confirm, do not
  invent, in M0).
- **Identity offline:** per D6. Every mutation carries the authenticated
  inspector identity established online; the server re-validates
  authorisation on push (an inspection reassigned away mid-flight must
  not accept further edits silently — §6 edge flow).
- **Audit history (regulatory):** server-side, append-only, one entry
  per applied field change/attachment event/submission/acceptance/
  conflict resolution: inspection ID, actor and surface (web/tablet +
  device), field, before/after, client capture time, server receipt
  time, mutation ID. Audit survives local purge (A14) and is the record
  that makes "the losing value in a conflict" and "what was entered
  offline, when" answerable after the fact.
- **Purge (regulatory, ≤24h after acceptance):** per D8. Purge deletes
  the inspection's rows, originals, thumbnails, cached renders, and any
  temporary files, and excludes app data from OS cloud backup (or
  ensures backups cannot resurrect purged customer data — to confirm
  per platform in M4). Purge runs on schedule, on app start, and on
  boot; each purge emits a receipt (§7). A compliance-visible report
  lists acceptances without a matching purge receipt past deadline.
- **Photo metadata:** EXIF/location handling decided under D9; whichever
  way it is decided, apply it at capture consistently and note it in
  the audit/attachment metadata.
- **Lost device:** MDM remote wipe (A6); server-side, sessions for that
  device are revoked so a found tablet cannot push under the old
  session. Local data at risk is bounded by minimisation + purge.
- **Logging hygiene:** client and server logs/metrics (§12) must not
  contain customer field values, photo content, or signature data —
  IDs, counts, states, and error codes only.

## 11. Migration and backfill

Client migration (cache → source of truth):

- Ship a versioned SQLite schema migration from the current cache
  schema to §7. Existing cache rows are treated as untrusted hints:
  on first run of the offline build, cached inspections are revalidated
  against the server when online, or marked "not downloaded" — they
  must never silently become "ready offline" baselines, because a
  read-through cache may be stale or partial and has no `base_version`
  snapshot semantics.
- The dangerous window is an app update while inspections are open.
  Because today's app can discard notes on connection loss (brief), the
  migration communication to inspectors is: finish/submit in-flight
  work before updating, or accept that pre-offline-feature in-memory
  state is outside this plan's guarantee. From the first offline build
  onward, all upgrades must preserve the outbox, attachments, and
  `base_version` snapshots (tested per §15/M5; downgrading the app
  across a schema migration is not supported — rollback uses the
  feature flag, §14, not an app downgrade).
- Feature-flag the offline behaviour inside the new build so the
  migration can ship dark before any inspector relies on it (§13).

Server migration/backfill:

- Add sync endpoints, idempotency-key storage, per-inspection change
  tracking sufficient to serve the pull cursor (including tombstones),
  conflict records, and audit writes for tablet-originated changes —
  all additive (A5); web and old-client behaviour unchanged.
- Backfill: existing inspections need a defined starting cursor
  position ("changes before the feature launches are delivered as a
  full download, not as deltas"). Historical audit backfill is limited
  to whatever the current system already records; this plan does not
  promise reconstructing pre-existing history that was never captured
  (A14 applies from launch of the audit writes).
- Data check before pilot: verify integer versions are present and
  monotonic for all in-flight inspections (validates A4 on real data);
  quarantine/repair exceptions before those inspections can be
  downloaded offline.

## 12. Observability

All telemetry respects §10 logging hygiene (no customer content).

Client (queued locally, uploaded when online — telemetry itself must be
offline-tolerant and must never block or be mistaken for inspection
sync):

- Per inspection sync attempts, successes, failures by error class,
  bytes/mutations/attachments pending, outbox age (oldest un-acked
  mutation), conflict count, purge executions vs. deadlines.
- Download readiness ("ready offline" successes/failures), storage
  headroom at capture, app-kill-during-edit recovery events.
- A support-visible on-device sync status screen (per inspection state,
  last error, mutation IDs) so an inspector can read it to support
  without sending customer data.

Server:

- Push/pull request rates, per-mutation outcomes (applied / merged /
  conflicted / rejected-stale / duplicate-idempotent), attachment ack
  rates and hash mismatches, pull cursor lag, submission confirmations,
  purge receipts received vs. acceptances issued.
- Correlation by mutation ID / attachment ID across client and server
  logs for end-to-end tracing of one inspection's journey.

Alerting and dashboards: sync failure rate, outbox-age outliers
(inspections stuck un-synced), conflict rate per inspection, and
overdue-purge list. Numeric alert thresholds are set by operations
from pilot baselines (D10) — this plan requires the signals, and does
not invent the thresholds.

## 13. Staged rollout

Rollout is gated by evidence, not by calendar (no dates are proposed).

1. **Dark launch:** server sync endpoints live; new app build with
   offline flag off completes the §11 migration in the fleet. Exit:
   migration success observed; no regression in online behaviour.
2. **Internal dogfood:** flag on for staff devices against production-
   like data. Exit: §15 test matrix passes in the field, including
   genuine no-signal sites; support runbook drafted.
3. **Pilot:** flag on for the D10 cohort (inspectors with known
   no-signal work). Exit gates (thresholds set under D10 before the
   pilot starts, measured via §12): zero confirmed data-loss incidents;
   sync success and stuck-outbox rates within gate; conflict rate and
   median resolution effort within gate (validates A3 in production);
   100% of accepted pilot inspections purged within 24h with receipts;
   support issues triaged with runbook updates.
4. **Broad rollout:** flag expanded in cohorts by team/region (exact
   grouping is an operations choice), pausing between cohorts to watch
   the same signals. Old app versions remain unable to work offline —
   acceptable because offline is additive; nobody loses the previous
   online behaviour.
5. **Steady state:** flag becomes the default; remove the flag only
   after a full rollout cycle with no rollback (§14) invoked.

Training/support: inspectors need the §6 state language ("ready
offline", "waiting — not yet received", "needs review") in training
material; supervisors need conflict-resolution and audit-view guidance.
This is a rollout dependency, not an afterthought.

## 14. Rollback

- **Primary mechanism: feature flag off.** Stops new offline downloads
  and new offline editing. It must **not** delete or ignore existing
  outboxes: devices with un-synced work keep a read/sync-only path to
  drain their outbox to the server (or a supervised manual recovery
  procedure) until every pre-rollback mutation is acked or formally
  dispositioned by a supervisor. A rollback that strands offline work
  recreates the original data-loss bug at larger scale.
- **Server:** sync endpoints stay up during rollback (they are the drain
  path). Server changes are additive, so the web app and online flow
  are unaffected; conflict records and audit entries already written
  remain valid history.
- **Client:** no app downgrade across the §11 schema migration. If the
  new build itself is faulty, ship a forward fix with the flag off.
- **Data:** inspections already submitted/accepted/purged are unaffected
  by rollback. Inspections mid-flight return to supervised handling:
  their server state is the last acked draft plus any conflict records.
- **Decision and comms:** one named decision-maker (D10), pre-agreed
  rollback triggers tied to §12 signals (for example any confirmed
  data-loss incident), and an inspector-facing message that says
  exactly what happens to work already on their tablet. The triggers
  and message are written before the pilot, not during an incident.

## 15. Testing strategy

Testing is organised by the failures this feature exists to prevent.
Each milestone (§16) names the subset that gates it.

- **Unit:** field-diff/merge rules (§8.3) over a conflict matrix
  (neither/one/both changed × same/different value × atomic field
  groups); outbox ordering and ack handling; purge deadline arithmetic
  including clock-offset cases; cap-of-40 enforcement.
- **Local durability:** kill the app / reboot the device mid-edit,
  mid-capture, and mid-sync; assert zero loss of anything the UI had
  confirmed as saved, and correct orphan-file reconciliation (§7).
- **Sync integration (client + real server contract):** idempotent
  retry after response loss (server applied, ack never arrived);
  partial batch ack; stale `base_version` (A4); pull cursor resume;
  tombstone handling; authorisation revoked mid-flight.
- **Intermittent-network harness:** scripted flaky connectivity
  (connect/drop patterns, captive-portal-style failures, very slow
  links) in automated tests, plus genuine airplane-mode field tests.
  "Works on office Wi-Fi with one toggle" is not sufficient evidence.
- **Attachments:** 40-photo inspection end-to-end; interrupted and
  resumed uploads; hash mismatch; storage-full at capture and during
  upload; signature binding to the correct inspection.
- **Conflict UX:** supervisor-edit scenarios from real field analysis
  (A3 validation output feeds the test cases); resolution audit trail.
- **Security/compliance:** purge completeness sweep (rows, files,
  thumbnails, temps, backups) verified on-device after purge; purge
  deadline enforcement when the app is not opened; lost-device session
  revocation; log/telemetry content review (§10).
- **Migration:** upgrade from the current cache-schema build with
  representative cached data; upgrade with a non-empty outbox (from
  the first offline build onward); server backfill/cursor seeding on
  a production-like dataset (§11).
- **Pilot field testing:** real no-signal sites (basements per brief),
  real assignment patterns, supervisor concurrently editing — the
  pilot itself is a test stage with §13 exit gates, not just a launch.

## 16. Milestone sequence

Order is by dependency. No dates or staffing are attached (§1); a
milestone is done when its acceptance criteria are met, and the next
milestone that depends on it may then start. Milestones that do not
depend on each other may overlap.

### M0 — Decisions and assumption validation

- Scope: close or explicitly risk-accept D1–D10 with their owners;
  run the validation checks for A1, A3, A4 (assignment-timing review,
  web field-edit analysis, API version-behaviour tests) and the fleet
  checks for A6/A7/A9; confirm regulatory wording (A10/A14) and server
  storage facts needed by D5.
- Depends on: nothing.
- Acceptance criteria: every decision in §4 has a recorded answer or a
  named owner + accepted-risk note; A1/A3/A4 each have written evidence
  (not opinion) for or against; if evidence refutes an assumption,
  this plan is amended before M1 builds on it.

### M1 — Local-first foundation (tablet)

- Scope: §7 schema and migrations; download-to-"ready offline";
  offline open/edit with immediate durability; local audit; offline
  unlock per D6; on-device sync status screen skeleton (§12).
- Depends on: M0 (D1, D6, D7 at minimum).
- Acceptance criteria: with networking disabled, a downloaded
  inspection can be opened and fully edited; app kill/reboot mid-edit
  loses nothing confirmed as saved (durability tests, §15); an
  inspection never downloaded cannot be opened offline and says so.

### M2 — Sync protocol for form data (server + tablet)

- Scope: additive sync endpoints (D3); push with idempotency keys and
  `base_version`; pull with cursor and tombstones; server audit writes
  for tablet changes; draft sync + queued ready-to-submit (D4),
  without final submission acceptance until M3 attachments exist (or
  submission enabled only for inspections with no required attachments
  — an explicit M2 scope choice to record).
- Depends on: M1; M0 outcomes for D2/D3/D4/D7 and A4/A5.
- Acceptance criteria: intermittent-network harness passes (§15);
  lost-ack retries produce no duplicates; supervisor edit to a
  different field merges automatically with audit entries for both
  sides; server state after sync equals tablet state for all
  non-conflicting cases.

### M3 — Attachments and signature

- Scope: §9 end-to-end; resumable hash-verified uploads (D5); cap
  enforcement (D9); submission confirmation gated on attachment acks
  (D4).
- Depends on: M2 (mutation/ack machinery); D5/D9 from M0.
- Acceptance criteria: 40-photo inspection syncs correctly over the
  flaky-network harness with interruptions; interrupted uploads resume
  without re-sending acked data; submit cannot be server-confirmed
  while a required attachment is un-acked; storage-full is handled
  per §6 without losing prior work.

### M4 — Conflict resolution UX, audit view, and purge

- Scope: same-field resolution UI for inspector/supervisor (§6/§8.3);
  audit history surfacing; acceptance handling and the full D8 purge
  mechanism with receipts and overdue-purge reporting.
- Depends on: M2 (conflict records), M3 (complete submissions to
  accept); D2/D8 from M0.
- Acceptance criteria: a same-field collision produces a resolvable
  conflict showing both values/editors/times, and resolution is
  audited; no test scenario silently discards an edit; accepted
  inspections are purged ≤24h (including app-not-opened and reboot
  cases) with the §15 completeness sweep passing; compliance can list
  any acceptance lacking a purge receipt.

### M5 — Hardening: migration, observability, rollback readiness

- Scope: §11 client/server migration on production-like data; §12
  dashboards/alerts and support runbook; feature-flag and §14 rollback
  path including outbox-drain mode; training material (§13).
- Depends on: M1–M4.
- Acceptance criteria: upgrade tests pass from the current production
  build and between offline builds with non-empty outboxes; every §12
  signal is visible in a dashboard or report; a rehearsed rollback
  (flag off with live outboxes on test devices) drains all work with
  zero loss; support can diagnose a stuck inspection from mutation IDs
  alone.

### M6 — Pilot

- Scope: §13 stages 1–3 (dark launch, dogfood, pilot cohort per D10).
- Depends on: M5; D10 gates and rollback triggers written and agreed
  before the cohort is enabled.
- Acceptance criteria (pilot exit): the D10 gates are met on §12
  measurements, including zero confirmed data loss and 100% on-time
  purges for accepted pilot inspections; A3 is re-evaluated on pilot
  conflict data; open support issues are triaged into fix-or-accept
  decisions. If gates are not met, the outcome is iterate-or-rollback
  (§14), not silent expansion.

### M7 — Broad rollout

- Scope: §13 stages 4–5, cohort by cohort with pauses.
- Depends on: M6 exit.
- Acceptance criteria: each expansion cohort holds the same gates as
  the pilot on its own measurements; rollback remains rehearsed and
  available until the flag is retired per §13 stage 5.

## 17. Principal risks (summary)

- **Data loss through a new path** (migration, rollback, purge bug):
  mitigated by outbox invariants (§7), migration/rollback rehearsals
  (M5), and purge acting only on server-accepted inspections (D8).
- **Conflict overload:** if A3 is wrong, manual resolution becomes
  daily friction. Mitigated by M0 evidence-gathering and pilot gates.
- **API mismatch:** if A4 is wrong, M2's design cannot stand.
  Mitigated by validating A4 in M0 before building on it.
- **Compliance failure on purge:** mitigated by D8's independent local
  enforcement + receipts + overdue reporting (M4).
- **Field reality mismatch** (assignment timing A1, storage A7, clock
  A9): mitigated by M0 fleet/workflow checks and genuine no-signal
  pilot sites, not office testing alone.

The three riskiest assumptions are expanded in `RESPONSE.md`.
