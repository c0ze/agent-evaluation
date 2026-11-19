# Offline Inspection Sync — Product & Engineering Plan

## 0. Status, inputs, and conventions

- **Only product input:** `BRIEF.md`. No other requirements, roadmaps, or stakeholder
  documents were used. Anything the brief does not state is recorded below as an
  **assumption (A\*)** or an **open decision (D\*)**; nothing is presented as a fact
  about the product beyond the brief.
- **No fake dates and no staffing estimates.** Milestones are dependency-gated
  (M0–M11) with exit/acceptance criteria, not calendar dates or headcounts. Where a
  numeric threshold appears, it is explicitly labelled a *proposed gate to be
  agreed*, not a measurement or a forecast.
- **Terminology.** *Server state* = the authoritative inspection record and status on
  the server. *Local state* = the device's working copy and its sync status. The two
  are deliberately kept distinct; a supervisor's "accepted" status is a server state,
  while "pending sync" is a local state.
- **Requirement vocabulary.** "Must" = derived from the brief or a regulation cited
  in it. "Should" = recommended engineering approach. "To confirm" = depends on an
  unresolved decision.

## 1. Problem, goal, and success condition

The brief states that today a lost connection after opening an inspection can discard
notes. Inspectors work on company-managed tablets in basements with no signal and
need to **open assigned inspections, fill forms, take up to 40 photos, and collect a
signature offline**, with connectivity returning only intermittently. Supervisors
can edit the same inspection from the web. Regulations require an **audit history**
and **removal of local customer data within 24 hours after an inspection is
accepted**. Existing server APIs are REST with **integer record versions**; the
mobile app's SQLite is currently a **read-through cache**; product wants a **pilot
before broad rollout** and **does not want a full collaborative editor**.

**Goal:** an inspection opened offline can be completed without any dependency on a
live connection, with every captured change durably recorded on the device, later
reconciled with concurrent supervisor edits without silent loss, uploaded in
resumable increments when connectivity appears, and with local customer data
provably gone within the required window after acceptance — all behind a reversible
pilot flag.

**Success condition (pilot):** zero confirmed loss of inspector work, zero purge
breaches, and a complete, immutable audit trail for every change, under real
no-signal conditions with intermittent reconnect. Detailed gates are in §12 and §13.

## 2. Assumptions (explicit)

Every row is an assumption, not a fact. "Validate" names the cheap check that should
happen in M0 before implementation; "If wrong" names the consequence. The three
riskiest are analysed in `RESPONSE.md` (R1–R3).

| ID | Assumption | Basis / why it is an assumption | Validate (M0) | If wrong |
| --- | --- | --- | --- | --- |
| A1 | The pilot fleet is a single tablet OS; company-managed implies MDM control. | Brief says "company-managed tablets" but gives no OS or fleet split. | Fleet inventory + MDM capability review. | Crypto, background execution, and file-storage code differ by OS; pilot scope and M2/M3 change. |
| A2 | One inspector uses a given device for a shift; devices are not concurrently shared. | Not stated. | Confirm device assignment policy. | Need per-user local partitioning and wipe-on-switch (D7), affecting §5 and §9. |
| A3 | All assigned inspections, pinned form templates, and last-known server state needed for a shift are present on the device **before** it goes offline; assignments are not created or reassigned during the offline window. | "Open assigned inspections" offline is impossible otherwise; brief does not describe prefetch or assignment timing. | Confirm assignment lifecycle and observe a real shift's sync opportunity. | Inspectors cannot open work offline, or open stale/wrong assignments — see R3. |
| A4 | Form templates are versioned, and an inspection pins the template version at open time. | Needed to validate offline answers; not stated. | Inspect template API. | Template drift makes offline answers unvalidatable; need pinning in M1/M2. |
| A5 | "Accepted" is a state transition performed by a supervisor on the **web**; inspectors cannot accept offline. | Brief says supervisors edit from the web and refers to acceptance, not who performs it. | Confirm workflow with supervisor-side owners. | Purge trigger and status model change (D4). |
| A6 | The server is the authoritative source of truth; audit history is server-side, append-only, and immutable. | Regulation implies an audit history; brief does not locate it. | Confirm audit store and retention. | Client-side audit mirror becomes authoritative, changing §7/§9 substantially. |
| A7 | REST endpoints return the full record with its integer version **and enforce** that version on writes (If-Match / 409), rather than treating it as advisory. | Brief says "REST with integer record versions" but not that writes are concurrency-checked. | API contract test against the real endpoints. | M1 must add optimistic-concurrency enforcement; otherwise concurrent edits can overwrite silently — core to R2. |
| A8 | The server can return a full current record for a client-side three-way merge; per-field change history from the audit log is not required in v1. | Not stated; keeps server work minimal. | Confirm GET payload completeness. | If only deltas are available, merge strategy and D2 change. |
| A9 | MDM can push builds, configuration, feature flags, and remote wipe. | "Company-managed" implies but does not guarantee it. | MDM capability review. | Rollback (§14), wipe (§9), and staged rollout (§12) need another mechanism. |
| A10 | Device clocks are untrustworthy for ordering and for compliance deadlines; server time is authoritative. | Standard for offline devices; not stated. | Check clock-skew distribution in fleet. | Audit ordering and purge deadlines would be wrong; mitigation = server timestamps only (§6, §9). |
| A11 | Connectivity returns at least intermittently in windows long enough to drain the sync queue, including up to 40 photos. | Brief says "may return intermittently" with no duration or bandwidth. | Measure real reconnect windows and uplink at the pilot site. | The queue never drains; acceptance and purge interact with unsynced data — see R3 and D5. |
| A12 | The 40-photo cap is per inspection, and photo payloads fit device storage and the available upload windows after on-device downscaling. | Brief says "up to 40 photos"; size is unstated. | Sample current photo sizes and device free space. | Need aggressive compression, fewer offline inspections, or a chunking/queue policy change (D9). |
| A13 | The existing SQLite read-through cache holds no authoritative unsaved inspector work, so **no local-note backfill** is needed. | Brief says a lost connection can discard notes, which implies notes were not durable; cache semantics imply non-authoritative. | Inspect the shipped schema and a sample device DB. | A data-preserving migration/backfill of in-flight notes is required (§10). |
| A14 | "Local customer data" = form answers, photos, signature, and any cached customer identifiers; opaque IDs, hashes, and sync metadata are not customer data. | The regulation is cited but not defined in the brief. | **Legal/compliance sign-off (D6).** | Purge scope, residue tests, and what telemetry may retain all change. |
| A15 | No push/WebSocket infrastructure exists or is required in v1; the client learns about acceptance by pulling on reconnect and in the foreground. | Brief describes REST only. | Confirm available server push capability. | D12 changes; acceptance notification may be faster. |
| A16 | Tablets have enough free storage and CPU for encrypted local storage, hashing, and downscaling 40 photos per offline inspection. | Not stated. | Device capacity check. | Caps, compression targets, and storage-full behaviour in §8 change. |
| A17 | Inspectors only open existing assignments; they cannot create, claim, or reassign inspections while offline. | "Open assigned inspections" implies this; brief does not say otherwise. | Confirm with product. | Offline creation/claiming would add a whole new conflict class and is out of scope. |
| A18 | Acceptance may occur while the device has been offline for longer than the 24-hour window, so the device may not learn of acceptance promptly. | Brief does not constrain acceptance timing relative to connectivity. | Confirm supervisor review timing. | Drives the purge design in §9 and is the single largest compliance risk (R1). |

## 3. Scope boundaries

**In scope (v1 / pilot)**

- Offline open of **already-synced assigned inspections** with a visible "available
  offline" indicator (A3, A17).
- Offline form filling with durable local autosave; up to 40 photos and one
  signature per inspection (A12).
- A local outbox and sync engine over the existing REST/integer-version APIs, with
  idempotency, resumable attachment upload, and incremental pull.
- Asynchronous, client-side three-way merge and a lightweight **"review & resolve"
  screen** for conflicts with concurrent supervisor web edits (§7); explicitly *not*
  live co-editing.
- Server audit events for every applied change, merge, and resolution decision.
- Purge of local customer data within the required window after acceptance, with
  verification and a compliance log (§9).
- Migration from read-through-cache SQLite to a local-authoritative store (§10).
- Feature flag / kill switch, observability, pilot, rollback, and the test programme
  (§11–§15).
- Minimal, additive server and web-side changes needed for the above (M1).

**Out of scope (v1), with rationale**

- **Full collaborative editor**: live co-editing, presence, CRDT/OT, character-level
  merging, and concurrent multi-user editing on one device. Product explicitly does
  not want this (brief); §7 uses asynchronous merge instead.
- **Creating, claiming, or reassigning inspections offline**; changing assignments,
  status, or acceptance from the device (A5, A17).
- **Offline supervisor review or acceptance**, and offline deletion of already-synced
  attachments (tombstones/versioned attachment deletion deferred).
- **New push/WebSocket infrastructure** in v1 (A15, D12).
- **Server-side per-field versioning or field-level patch endpoints** in v1 (D2).
- **Arbitrary attachment types** beyond photos and signature; video, maps/GIS,
  annotation markup, printing/export, and bulk data export.
- **Multiple devices editing one inspection simultaneously for a single inspector**;
  cross-device session handoff.
- **Fabricating audit history** for pre-cutover records (D11); **backfilling** any
  unsaved local notes (A13).
- **Data-residency, multi-region, or retention-policy redesign** beyond what the
  cited regulation requires for local data.

Anything not listed as in scope is intentionally excluded, not forgotten; adding it
requires revisiting the decisions in §16.

## 4. User flow

**States.** Server status: `assigned → in_review → accepted` (supervisor-driven, A5).
Local sync state: `available_offline → in_progress_local → submitted_local →
syncing → synced | conflict → purged`. The UI always shows both: an inspector must
never believe a locally saved answer is already on the server.

**Pre-departure / while connected (A3)**

1. App pulls all currently assigned open inspections, their pinned template versions
   (A4), last-known supervisor edits, any pending conflict notices, and pending
   acceptance events; it also drains any leftover outbox from a previous shift.
2. Each inspection is stored locally with its `server_version`, a **base snapshot**
   of every field at that version, and an explicit "available offline" flag. The list
   shows how many inspections are ready offline and warns if a prefetch failed.
3. Feature flag and purge TTL configuration are refreshed (§12).

**Offline session (no signal)**

4. Inspector opens an available inspection. The app works entirely from the local
   copy; no network call is attempted (§3, A17).
5. Every field change is autosaved locally (debounced write plus immediate write on
   blur / app background), with a persistent "saved on this device" indicator.
   Crashing, reboot, or OS termination must not lose the last committed field.
6. Photos are captured into app-private storage (up to 40, A12), downscaled, hashed,
   and referenced by a client-generated ID. A storage-full or cap-reached condition
   blocks new captures without blocking form text (§8).
7. The signature is captured, bound to the inspection ID and a hash of the current
   form values, and stored locally; it is immutable once submitted (§7).
8. "Submit" marks the inspection `submitted_local` and enqueues ordered outbox
   operations. It does **not** require connectivity and does **not** claim the data
   is on the server. Work can continue on other inspections.

**Intermittent connectivity (A11, A15)**

9. On a reconnect signal, in the foreground, and periodically while online, the sync
   engine runs incrementally: pull first, then push in order, committing partial
   progress (§6). Brief windows are expected, so no step assumes a long session.
10. Each successful operation updates the indicator to "synced" with its new server
    version. Failed operations keep "pending sync" with a retry reason; the inspector
    is never asked to re-enter data.
11. If a supervisor edit arrives, the engine performs a three-way merge; fields that
    cannot be auto-merged produce a "review & resolve" screen (§7). The inspector
    sees a side-by-side diff, chooses, and confirms; nothing is silently discarded.
12. Attachments upload independently and resumably; form text sync is never gated on
    all 40 photos (D8).

**Acceptance and purge**

13. On learning of acceptance (pull, A15), the app verifies that all outbox
    operations for that inspection are confirmed committed and that attachments are
    linked, then purges local customer data and records a purge event (§9).
14. A local hard-cap deadline, started when the inspection's outbox drained (or at
    submission, per D5), guarantees purge even if the device never learns of
    acceptance (A18). Purge is verified by scanning storage; the result is logged
    locally and reported to the server when next connected for a compliance proof.
15. **Never purge unsynced customer data.** If a deadline passes with unsynced
    operations, the app raises a highest-severity compliance alert, blocks new
    offline captures, and requires a check-in; it does not silently delete (D5).

**Edge cases handled explicitly:** app killed or device rebooted mid-form (step 5);
token expiry while offline (continue local work, queue sync until re-auth, D10);
storage exhaustion (step 6); 40-photo cap (step 6); device reassigned or shared
(D7, A2); template changed on server mid-offline (A4 pinning); supervisor reopens a
previously accepted inspection (new signature revision, §7); battery death during an
attachment upload (resume by chunk, §8); duplicate or missing server responses
(idempotency, §6).

## 5. Local data model

**Storage split**

- **SQLite (encrypted, app-private):** structured records, merge state, outbox,
  conflicts, sync metadata, purge log. No customer payloads in plaintext.
- **File store (app-private, excluded from OS backup/gallery/cloud):** photo bytes,
  thumbnails, signature; referenced by ID, never by a user-visible path.
- **Platform keystore:** encryption keys and auth tokens (§9).

**Tables (key columns; illustrative, not full DDL)**

| Table | Key columns | Purpose |
| --- | --- | --- |
| `inspection` | `server_id`, `server_version`, `server_status`, `form_schema_version`, `assignment_snapshot`, `base_snapshot_json`, `local_values_json`, `dirty_fields`, `local_state`, `accepted_at_server`, `purge_deadline` | Authoritative local working copy. `base_snapshot_json` is the value of **every field at `server_version`** and is required for the three-way merge in §7. |
| `attachment` | `client_id` (UUID), `inspection_id`, `kind` (photo/signature), `file_path`, `byte_size`, `sha256`, `mime`, `created_at`, `upload_state`, `server_id`, `chunk_cursor`, `retry_count` | Client-generated IDs make attachments additive and conflict-free (§7). |
| `outbox` | `op_id` (UUID), `idempotency_key`, `inspection_id`, `seq`, `kind`, `base_version`, `payload_ref`, `state`, `attempts`, `next_retry_at`, `created_at`, `depends_on` | Ordered, durable, at-least-once command log. Ordered per inspection; never truncated until confirmed committed. |
| `audit_mirror` | `event_id`, `inspection_id`, `actor`, `op_id`, `base_version`, `resulting_version`, `server_time`, `summary` | **Read-only** local view for display; server is authoritative (A6). |
| `conflict` | `inspection_id`, `field_path`, `base_value`, `local_value`, `remote_value`, `policy`, `resolution`, `resolved_at` | Pending "review & resolve" items (§7). |
| `sync_meta` | `last_cursor`, `server_time_offset`, `schema_version`, `feature_flags`, `purge_ttl_config`, `last_pull_at` | Cursor for incremental pull; flags and TTL from server. |
| `purge_log` | `inspection_id`, `deadline`, `trigger`, `outcome`, `verified_at`, `reported_at`, `verification_hash` | Compliance proof; retained locally (non-customer metadata) and reported to server. |

**Invariants**

1. A local write is only visible to the UI after its SQLite transaction commits.
2. `outbox` rows are append-only until the server confirms the operation; no purge
   may delete an inspection with `state != committed` rows.
3. `base_snapshot_json` is captured at pull time and refreshed only after a
   successful write returns a new `server_version`.
4. Attachments and their `sha256` are written before the referencing outbox op.
5. `purge_log` and `audit_mirror` contain no customer payload values, only opaque
   identifiers, hashes, and summaries (A14).

**Migration from read-through cache (A13, details in §10).** The new `local_*`
tables are the authority for offline work; legacy cache tables are ignored on read
and dropped only after a verified first rehydration from the server. Schema changes
are versioned, idempotent, and tested from the shipped build, including an upgrade
performed mid-inspection. A downgrade path ("flush then reset", §14) exists so a
previous binary cannot crash on new tables.

## 6. Sync protocol

**Principles.** Offline-first local writes; at-least-once delivery with idempotent
server operations; incremental and resumable; partial progress committed; no
all-or-nothing batch across the whole queue (A11). Server time is authoritative
(A10); client timestamps travel as metadata only and never order audit events.

**Pull (incremental)**

- `GET /inspections?assigned_to=me&since=<last_cursor>` returning current records
  with `server_version` (integer), status, `accepted_at_server`, template version,
  attachment lists, and conflict-relevant supervisor changes (A7, A8, M1).
- Runs on reconnect, on app foreground, and periodically while online (A15).
- Response updates `base_snapshot_json` **only** for records with no pending local
  outbox ops; records with pending ops go through the merge in §7.
- Cursor, not a full re-download, so brief connectivity windows suffice.

**Push (ordered, idempotent, concurrency-checked)**

For each outbox op in `seq` order per inspection:

1. `PUT`/`POST` the record with `If-Match: <base_version>` and an
   `Idempotency-Key: <op_id>`; payload is the full local record plus the list of
   attachment `client_id`s it references (§7, D8). Every op carries its `op_id`,
   actor (inspector identity), device ID, and client timestamp as **metadata**; the
   server assigns the authoritative event time (A10).
2. **2xx:** mark the op `committed`, store the returned `server_version`, refresh
   `base_snapshot_json`, clear the corresponding `dirty_fields`, prune any
   superseded payload, and advance the cursor.
3. **409 / 412 (version mismatch):** pull the current record, run the three-way
   merge (§7), auto-merge what is safe, enqueue a `conflict` row for the rest,
   and re-enqueue the op with the new `base_version` after resolution. Retry the
   merge loop if the server version moves again.
4. **Timeout / 5xx / connection drop:** persist `next_retry_at` with exponential
   backoff and jitter; **treat "no response" as unknown, not failed** — the retry
   reuses the same `idempotency_key`, so a server that already committed the op
   returns the original result instead of applying it twice.
5. **Duplicate or out-of-order responses:** dedup by `op_id`; ops are applied in
   `seq` order, so a later op never overtakes an earlier one for the same record.

**Server-side requirements (additive, M1; derived from the brief, not new product
features):** enforce integer-version optimistic concurrency on writes (A7); an
idempotency-key store with a dedup response cache; an append-only audit event per
applied op including merge/resolution decisions; attachment records addressable by
`client_id` and `sha256`; an `accepted_at_server` timestamp on acceptance; a cursor
endpoint; and a feature-flag / kill-switch endpoint. If these cannot be added, D2
and D12 must be revisited before implementation.

**Attachments in the protocol (D8).** Photos and the signature upload independently
via resumable, hash-verified chunks with a persisted `chunk_cursor`. The record PUT
lists attachment `client_id`s and the server **tolerates references to not-yet-uploaded
attachments** as pending placeholders, so form text is never held hostage by 40
photos. Server-side orphan cleanup removes uploaded-but-unlinked chunks. Dedup is
by `(client_id, sha256)`, making retries and duplicate responses harmless.

**Typical conflicted sync (ordered):** pull → supervisor's version N+1 detected →
three-way merge against base N → auto-merge disjoint fields → enqueue conflict row
for double-changed fields → inspector resolves → PUT with `If-Match: N+1` → server
appends audit event → version N+2 → attachments finish uploading → record links →
`committed` → acceptance arrives → purge eligibility check → purge.

## 7. Conflict policy

**Unit of conflict.** The server's concurrency unit is the **record-level integer
version** (A7, D2). The client therefore performs a **per-field three-way merge**
using `base_snapshot_json` (values at the fetched version B), `local_values_json`
(inspector's L), and the newly pulled record (remote R). For each field:

| Change pattern | Policy |
| --- | --- |
| Only L differs from B | Keep L; include in the next PUT. |
| Only R differs from B | Take R (auto-merge); notify the inspector that a supervisor change arrived. |
| L == R | No conflict. |
| Both changed, same value | No conflict; converge. |
| **Both changed, different values** | Apply the field-class policy below; never silent last-writer-wins. |

**Field classes**

- **Server/authority-owned fields** (status, assignment, review outcome, acceptance,
  audit fields): **R always wins**. The inspector cannot modify these offline; a
  local attempt is rejected with an explicit notice rather than merged.
- **Inspector form answers:** disjoint changes auto-merge. Double-changed fields go
  to the **"review & resolve" screen** with base/local/remote shown side by side;
  default selection is "keep my answer", but the inspector must explicitly confirm
  (keep local / take remote / edit a merged value). This is asynchronous review, not
  a collaborative editor (§3).
- **Free-text notes:** append both versions with attribution where the field permits;
  otherwise route to review & resolve. No text is truncated silently.
- **Attachments and signature:** **additive, never conflicting.** Client-generated
  UUIDs (§5) mean two writers add distinct items; dedup by `(client_id, sha256)`.
  Offline deletion of already-synced attachments is out of scope (§3).
- **Signature:** immutable once submitted. If a supervisor reopens or voids an
  inspection, the device captures a **new signature revision** bound to the new
  form-value hash; it never overwrites the prior one, and the audit records both.

**"No full collaborative editor" interpretation (D3).** No live co-editing,
presence, CRDT/OT, or character-level merge; a single lightweight asynchronous
merge-resolution screen is in scope. Confirm with product that this satisfies the
constraint before M5.

**Audit of decisions.** Every auto-merge, rejected local change, double-changed
field, and resolution choice is sent to the server as part of the op and appended as
an immutable audit event with actor, `op_id`, `base_version`, resulting version,
field path, and winning value source (A6). This is what makes the merge defensible
under the regulation: the history must show *who decided what*, not merely the final
value. Idempotency keys prevent retries from creating duplicate audit events.

**False-conflict avoidance.** Because a timed-out but committed PUT is retried with
the same `idempotency_key`, and `base_version` is refreshed after every success,
retries do not manufacture conflicts. A 409 always triggers a fresh pull-and-merge,
never a blind overwrite.

## 8. Attachments

- **Capture:** up to 40 photos + one signature per inspection (A12, A17). On capture,
  downscale/compress to a configurable capped resolution, hash (`sha256`), store in
  app-private storage with OS-backup/gallery/cloud-sync exclusion flags, and create
  the `attachment` row before any referencing outbox op (§5).
- **Storage budget:** derived from A12/A16 — 40 photos × capped size × number of
  offline-open inspections per shift. On nearing the cap: warn; at the cap: block
  new captures, allow form text, and surface "sync to free space". Never drop an
  already-captured photo to make room.
- **Upload:** independent, resumable chunks with persisted `chunk_cursor`,
  hash-verified on completion, dedup by `(client_id, sha256)`, server-side orphan
  cleanup for unlinked chunks (§6). Throttling and the cellular-vs-Wi-Fi policy are
  D9; regardless of that decision, upload progress must survive app kill, reboot,
  and intermittent disconnects.
- **Signature integrity:** bind the signature image to the inspection ID and a hash
  of the submitted form values, include the server-assigned timestamp, and store it
  server-side; client timestamps are metadata only (A10). Legal form is D15.
- **Binding to record:** the record PUT lists attachment `client_id`s; the server
  tolerates pending references (D8) so text is never gated on 40 photos. Acceptance
  requires that referenced attachments be uploaded and linked, or that a documented
  exception is recorded (this interacts with the purge rule in §9).
- **No network means no upload**, but never a blocked form. Local thumbnails and
  temp render files are treated as customer data and included in purge (§9, A14).

## 9. Security and compliance

**At rest.** Encrypt SQLite (e.g., SQLCipher or platform-equivalent) and attachment
files; hold keys in the platform keystore tied to device + user authentication; use
app-private storage with backup/gallery/cloud exclusion (A1, A9). Enable
SQLite secure-delete / VACUUM behaviour so freed pages do not retain payloads after
purge. Treat thumbnails, temp files, clipboards, crash logs, and any diagnostics
buffers as customer data (A14).

**Transport and auth.** TLS for all REST calls; certificate pinning is D9-adjacent
and to confirm. Tokens live in the keystore. **Offline session policy (D10):**
allow continued local work through a shift even if the token expires; queue sync and
re-authenticate on reconnect; never lock an inspector out of an in-progress form.
Server-side authorization is enforced on every write — the client is never trusted
for assignment or status scope (A17).

**Lost / shared devices.** MDM remote wipe (A9) as a backstop; if devices are shared
(D7), partition local data per user and wipe on user switch. Metrics and logs carry
only opaque IDs, hashes, and version numbers — no form answers, photo bytes, or
customer identifiers (A14).

**Audit history (A6).** Server-side, append-only, immutable: one event per applied
op, including merges and resolution decisions (§7), with actor, device, `op_id`,
`base_version`, resulting version, field path, and server-assigned time (A10).
Clients can only read `audit_mirror`, never write the audit. Consider a hash chain
over events for tamper evidence; confirm retention with compliance (D11).

**24-hour purge — the critical design (A18, D5, D6).** The requirement is *removal
of local customer data within 24 hours after an inspection is accepted*. A device
that is offline for days cannot be guaranteed to learn of acceptance promptly, so
two triggers are used:

1. **Acceptance-driven:** on learning `accepted_at_server` (pull), purge promptly,
   after verifying the outbox is fully `committed` and attachments are linked.
2. **Local hard cap:** a deadline of **at most 24 hours, starting when the
   inspection's outbox drained (or at submission — D5)**. Because purge then occurs
   no later than `sync-completion + 24h`, it also occurs no later than
   `acceptance + 24h` for any acceptance that happens after sync, so compliance
   holds **even if the device never learns of acceptance**. Deleting earlier than
   acceptance is acceptable under the conservative reading "by 24h after
   acceptance, no local customer data remains" — **this reading requires explicit
   legal sign-off (D5/D6)**.

**Hard rule:** never purge unsynced customer data. If a deadline passes with
uncommitted outbox rows, the app (a) raises a highest-severity compliance alert,
(b) blocks new offline captures, (c) forces a check-in / sync attempt, and (d)
records the exception in `purge_log` for compliance review. This is a real tension
between the regulation and data preservation; it is a decision, not an implementation
detail (D5).

**Purge execution and verification.** Delete SQLite rows, freed pages, attachment
files, thumbnails, temp files, caches, and any backup-excluded artefacts; verify by
scanning the app container and DB pages; record `verification_hash` and `outcome` in
`purge_log`; report the signed event to the server on next connect as proof (A10
server time). Retain only non-customer metadata (IDs, hashes, sync state, purge
log). Residue scanning is a compliance test in §15, not a best-effort cleanup.

## 10. Migration and backfill

**Client (A13).** Convert from read-through cache to a local-authoritative store:

- Versioned, idempotent schema migrations; legacy cache tables are read-ignored and
  dropped only after a successful first rehydration from the server.
- **No backfill of unsaved local notes** (A13): the current defect is precisely that
  such notes were not durable. Confirm against the shipped schema in M0; if durable
  in-flight data exists, add a preserving migration before this assumption is used.
- Handle upgrade mid-inspection, fresh install, and re-upgrade; pin the template
  version at open time (A4) so offline validation targets the correct schema.
- Downgrade safety: previous binaries must not crash on new tables; provide the
  "flush then reset" path in §14.

**Server (additive, backward compatible, M1).** Add: idempotency-key store and dedup
cache; enforcement of integer-version optimistic concurrency (A7); append-only
audit events; `client_id`/`sha256` columns and records for attachments;
`accepted_at_server` on acceptance; cursor support on pull; feature-flag/kill-switch
and TTL config endpoints. Backfill existing rows with safe defaults: versions
already exist (brief); legacy attachments get null `client_id`; audit history begins
at a **documented cutover boundary** — **do not fabricate history for pre-cutover
records (D11)**. Keep existing REST endpoints and the web supervisor flow working
unchanged during rollout; dual-read where needed. The audit, acceptance, and purge
tables are never truncated by a rollback (§14).

**Form templates (A4).** Version templates and pin the version on each inspection at
open time; template changes during an offline window do not retroactively invalidate
saved answers. A supervisor-side template edit is a separate, auditable change.

## 11. Observability

No fabricated baselines or invented numbers: every threshold below is a **proposed
gate to be agreed in M0**, and the pilot (§12) is where real baselines are measured.

| Surface | Signals (no PII — IDs, hashes, counts, versions only) |
| --- | --- |
| Client | Outbox depth and age of oldest pending op; sync attempts/successes; 409 rate and auto-merge vs review counts; retry/backoff counts; attachment upload state and failures; purge outcomes, deadline breaches, and residue-scan results; local storage used/free; schema version; offline-duration distribution; migration/crash events. |
| Server | Version-conflict (409) rate by inspection; idempotency dedup hits; audit append completeness (events per applied op); acceptance→purge latency; orphan attachment count; pull cursor lag; API errors. |
| Compliance | Per-inspection "accepted → purge verified" record, breach alerts, and an audit-completeness check (every applied op has exactly one event). A purge breach or an unsynced-data-at-deadline exception is **highest severity**. |
| Diagnostics | Opt-in, redacted sync-log upload for support on reconnect; never includes form answers, photo bytes, or customer identifiers (A14). |

Dashboards, alerts, and a daily pilot review are deliverables of M7. Alerts must be
actionable by a named on-call role (no staffing estimate implied), with a linked
runbook (§14).

## 12. Staged rollout

Stages are **gated by exit criteria, not dates**. No stage begins until its
predecessor's criteria are met and the relevant M0 decisions are signed off.

| Stage | Scope | Entry | Exit criteria |
| --- | --- | --- | --- |
| **P0 Internal dogfood** | Synthetic data; internal staff; forced no-signal and scripted intermittent reconnect. | M3–M7 complete and verified (M8). | End-to-end offline completion with radio off; all M3–M7 exit criteria reconfirmed; rollback rehearsed successfully. |
| **P1 Pilot** | Small group of inspectors on a real no-signal site, company-managed tablets, feature-flagged, with the existing online-only flow available as fallback (product wants a pilot first). | M8 + M0 compliance sign-off. | All pilot exit criteria below met; inspector feedback triaged; every open issue has a gate before the next stage. |
| **P2 Expanded rollout** | More teams/sites, same flags, support runbook proven. | P1 exit criteria met. | P1 criteria continue to hold at larger scale; conflict/409 rates within agreed gates; rollback path re-tested. |
| **P3 Broad rollout** | General availability; retire legacy online-only path. | P2 exit criteria met. | Gates hold; legacy path removed only after a rollback-capable release remains available; audit and purge logs retained. |

**Proposed pilot exit criteria (to be agreed in M0, not asserted as facts):**

1. **Zero confirmed loss** of inspector work in any offline scenario tested or
   observed (the defect described in the brief must not recur).
2. **Zero purge breaches**: every accepted inspection has a verified purge within
   the required window, including the prolonged-offline acceptance case (A18);
   any unsynced-data-at-deadline exception is resolved and documented.
3. **Audit completeness**: every applied change, merge, and resolution has exactly
   one immutable server event; no client-written audit entries.
4. No silent last-writer-wins: every double-changed field produced an explicit
   resolution (§7).
5. Sync completes under scripted intermittent connectivity with up to 40 photos,
   with no duplicate records and no lost outbox ops.
6. Inspector task completion is not degraded versus the current flow (measured in
   the pilot; no target invented here).
7. No unresolved high-severity incidents; security review (§9) passed.

## 13. Milestones, dependencies, and acceptance criteria

Sequencing is dependency-driven. **No calendar dates or staffing estimates** are
given; duration emerges from meeting each milestone's exit criteria.

| ID | Milestone | Depends on | Exit / acceptance criteria |
| --- | --- | --- | --- |
| **M0** | Decisions, assumption validation, compliance sign-off | — | All D\* in §16 resolved and recorded; A1/A3/A7/A11/A13/A14 checked against the real fleet, APIs, and legal interpretation; written sign-off on purge clock, "customer data" definition, and audit cutover; pilot scope and §12 exit criteria agreed. **Blocks all implementation.** |
| **M1** | Server primitives | M0 | Idempotency dedup, version enforcement on writes (A7), audit append, acceptance timestamp, attachment client IDs, cursor pull, flags/TTL endpoints; contract tests pass; existing REST + web supervisor clients still work unchanged. |
| **M2** | Local data model, encryption, migration | M0 | §5 schema implemented; migrations tested from the shipped cache-only build (fresh install, upgrade, upgrade mid-inspection); at-rest encryption verified; "flush then reset" downgrade path works (§14). |
| **M3** | Offline capture & autosave | M2 | With radio off: open a prefetched inspection, fill forms, autosave survives app kill/reboot, capture 40 photos + signature, correct cap and storage-full behaviour; zero network calls. |
| **M4** | Sync engine | M1, M3 | Pull/push, ordered outbox, idempotent retries, resumable chunked uploads, partial-progress commits; intermittent-network chaos suite passes with no lost ops and no duplicate records (§6, §15). |
| **M5** | Conflict detection, resolution, audit integration | M4 | Full three-way merge matrix unit tests; concurrent supervisor-web scenario passes; no silent last-writer-wins; every merge/resolution recorded in immutable audit; web supervisor regression passes. |
| **M6** | Purge, security hardening, compliance reporting | M1, M2, M4 | Purge within the required window including prolonged-offline acceptance; residue scan clean (DB pages, files, thumbnails, temp, backups); purge proof reported; no PII in telemetry; at-rest/transport/token/MDM review passed. |
| **M7** | Observability, kill switch, runbooks | M4, M6 | Dashboards and alerts live (purge breach = highest severity); §11 signals emitted; rollback/drain runbook reviewed; kill switch tested end-to-end; on-call dry run. |
| **M8** | Internal dogfood (P0) | M3, M4, M5, M6, M7 | P0 exit criteria (§12) met; rollback rehearsed; all prior exit criteria reconfirmed with synthetic data. |
| **M9** | Pilot (P1) | M8, M0 | All §12 pilot exit criteria met over the agreed observation window; zero data loss; zero purge breaches; feedback triaged. |
| **M10** | Expanded rollout (P2) | M9 | P2 exit criteria (§12) met; conflict/409 rates within agreed gates; support runbook proven. |
| **M11** | Broad rollout & retire legacy flow (P3) | M10 | P3 exit criteria met; legacy path removed with a rollback-capable release retained; audit and purge logs retained. |

## 14. Rollback

**Triggers:** confirmed data loss; purge breach or near-breach; conflict/409 rate
above the agreed gate; migration or crash regression; compliance objection; or any
high-severity incident in the pilot.

**Kill-switch semantics — "drain, then disable" (never just switch off).** The
server-side `offline_write_enabled` flag (and TTL config) is owned by operations
(D14). Disabling it must: (1) block **new** offline edits and captures; (2) **keep
the sync service and M1 endpoints running** so pending outbox rows drain; (3) force
a check-in/sync before any acceptance or purge action; (4) only after the queue is
verified drained may the app revert to online-only read-through behaviour. Turning
the flag off while unsynced work remains would strand data and could collide with a
purge deadline — the exact failure the plan must avoid.

**Server rollback.** All changes are additive (§10), so rollback is flag-based and
old endpoints remain. **Never roll back, truncate, or rewrite the audit, acceptance,
idempotency, or purge-log tables**: the audit history is a regulatory requirement,
and the idempotency store must persist across a rollback window so replays are not
applied twice.

**Client rollback.** MDM (A9) pushes the previous binary, which must ignore new
tables rather than crash. Provide a "safe mode": flush outbox → verify server state →
wipe local customer data → reset to the cache-only schema. Downgrade must never
silently delete unsynced work; if it cannot flush, it blocks and alerts.

**Re-enable** requires root-cause fix, a fresh M8 dogfood pass, and reconfirmation of
the M0 compliance sign-off. Rollback is rehearsed in M8 and re-tested in P2.

## 15. Testing strategy

| Level | What is tested | Acceptance |
| --- | --- | --- |
| Unit | Three-way merge matrix (all L/B/R change combinations), field-class policies, version/If-Match handling, idempotency dedup, purge-clock arithmetic (including acceptance-while-offline), encryption helpers, cap/storage logic. | Every matrix case has an expected outcome; no silent last-writer-wins; deterministic. M5. |
| Integration / contract | Sync protocol against a test server implementing M1: cursor pull, ordered outbox, 409 loops, duplicate responses, attachment linking with pending references, audit event per applied op. | M1/M4 contract suites pass; backward compatibility with web clients proven. |
| Network chaos | Connectivity toggling, drops mid-request and mid-response, duplicate/out-of-order responses, 409 storms, brief windows, resumable 40-photo upload across many interruptions, timeouts where the server actually committed. | No lost ops, no duplicate records, no duplicate audit events; partial progress durable. M4. |
| Concurrency | Inspector offline + supervisor editing the same inspection from the web, version races, repeated acceptance/reopen, multiple reconnect cycles. | No silent overwrites; every double-changed field surfaced; audit complete. M5. |
| Compliance | Purge within the required window including prolonged-offline acceptance; residue scan of SQLite pages, files, thumbnails, temp, backups; audit immutability; **no PII in telemetry/logs**; purge proof reported. | Zero residue, zero breaches, complete audit. M6. |
| Migration | Upgrade from shipped cache-only build: fresh install, upgrade, upgrade mid-inspection, re-upgrade, downgrade/rollback "flush then reset". | No crash, no data loss, legacy cache safely retired. M2/M8. |
| Security | At-rest extraction attempts, keystore handling, token expiry offline, lost-device/MDM wipe, shared-device switch (D7), signature tamper detection, server-side authorization on every write. | Security review passed. M6. |
| Device / manual | Real no-signal basement, intermittent return, app kill, reboot, battery death mid-upload, OS killing background work, storage full, 40-photo cap, token expiry, MDM push. | P0/P1 field checklist passed. |
| Regression | Existing online-only inspection flow and the web supervisor edit flow. | Unchanged behaviour for non-flagged users. M1/M5. |

Synthetic data is used everywhere except the pilot, where any real customer data is
handled under the compliance controls in §9. Thresholds are gates agreed in M0, not
invented baselines.

## 16. Decisions required before implementation (with recommendations)

Each row **blocks M0**; implementation should not start until it is resolved and
recorded. "If rejected" names the main consequence.

| ID | Decision | Why blocking | Options | **Recommendation** | If rejected |
| --- | --- | --- | --- | --- | --- |
| **D1** | Which tablet OS(es) are in the pilot? | A1; crypto, background sync, keystore, and file APIs differ. | One OS, or both. | **Pilot on the single dominant fleet OS**, then port; confirm with fleet inventory. | Scope and M2/M3 effort change; sequencing of P1/P2 changes. |
| **D2** | Version granularity and where merging happens. | A7/A8: "REST with integer record versions" may be record-level only; determines the entire conflict design (R2). | (a) Record-level If-Match + client-side three-way merge; (b) add server-side per-field patch/version map. | **(a)** for v1 — smallest server change, fits "no collaborative editor"; add (b) only if pilot conflict rates justify it. | Requires M1 server work and a revised §6/§7 before M4. |
| **D3** | Is an asynchronous "review & resolve" screen acceptable under "no full collaborative editor"? | §3/§7 interpretation of a product constraint. | Allow it, or forbid any resolution UI (which forces a last-writer-wins policy). | **Allow it** — it is asynchronous, not co-editing; get explicit product confirmation. | A last-writer-wins policy would risk silent data loss, i.e. reproduce the brief's defect; conflict design must change. |
| **D4** | Who/what performs "accepted", and must the device confirm it? | A5; defines the purge trigger. | Supervisor web action; supervisor + device ack; automatic. | **Supervisor web action; device learns via pull; no device confirmation required** (A15). | Status model, audit, and purge triggers change. |
| **D5** | Purge-clock definition and the unsynced-data rule. | A18/A10: the 24h requirement may be unsatisfiable as literally written on a long-offline device; legal exposure (R1). | Server-acceptance-based only; local hard cap from submission/sync; hybrid; plus what to do with unsynced data at deadline. | **Hybrid**: immediate purge on learning acceptance **plus** a local hard cap of ≤24h from outbox drain (or submission), so compliance holds without check-in; **never silently purge unsynced data** — alert, block new captures, force check-in, log the exception. Requires **legal sign-off** on the "earlier deletion is compliant" reading. | A different interpretation changes §9, M6, and possibly requires an MDM check-in SLA (D12). |
| **D6** | Definition of "local customer data" and what residue may remain. | A14; determines purge scope and telemetry. | Narrow (payloads only) vs conservative (payloads + thumbnails + temp + SQLite pages + identifiers). | **Conservative**: purge all payloads and derived artefacts; retain only opaque IDs, hashes, sync state, and `purge_log`; legal confirmation. | Residue tests and telemetry design change. |
| **D7** | Are tablets shared between inspectors? | A2; affects partitioning and wipe. | One user/device/shift, or shared. | **Assume one inspector per device per shift for the pilot**; if shared, add per-user partitioning and wipe-on-switch before P1. | §5/§9 and M2/M6 change. |
| **D8** | Attachment association model. | Determines whether 40 photos block form sync (§6/§8). | Gate record PUT on all uploads, or independent uploads with pending references. | **Client-generated IDs, independent resumable uploads, server tolerates pending references**; record PUT never gated on photos. | Sync ordering and acceptance eligibility change. |
| **D9** | Photo encoding/size cap and upload network policy. | A12/A16; determines whether queues drain in brief windows (A11). | Resolution/format cap; Wi-Fi-only vs any connection; configurable. | **On-device downscale to a capped resolution, hash, allow cellular within an MDM-configurable cap**; never block form text. | Storage budget and A11 feasibility change. |
| **D10** | Offline auth/session policy. | Token expiry must not lock out an in-progress form (§9). | Hard re-auth, or continue offline + queue sync. | **Continue local work through the shift; queue sync and re-auth on reconnect**; never block an in-progress inspection. | §4/§9 flow changes. |
| **D11** | Audit backfill / grandfathering for pre-cutover records. | A6 + regulation; affects compliance story. | Fabricate history, or forward-only cutover. | **Forward-only cutover with a documented boundary and compliance sign-off; never fabricate history.** | Compliance evidence and M1 change. |
| **D12** | Acceptance notification mechanism and check-in SLA. | A15/A18; if the device cannot learn of acceptance, D5's hard cap must carry compliance. | Pull only; add push; MDM-forced check-in policy. | **Pull on reconnect + foreground polling in v1, no new push infra**; revisit only if D5's hard cap is rejected by legal. | New infrastructure in M1/M7; rollout sequencing changes. |
| **D13** | Prefetch scope/window for assignments and templates. | A3/A4/A17: "open assigned inspections offline" depends entirely on this. | All currently assigned open inspections; time-boxed window; on-demand. | **All currently assigned open inspections + pinned templates + last-known server state**, with a visible "available offline" count; confirm whether reassignment mid-window is possible. | Offline open may fail; §4 and R3 change. |
| **D14** | Kill-switch and rollback authority. | §14 reversible pilot. | Server flag owned by ops; client-only flag. | **Server-side flag owned by operations, with the documented "drain then disable" runbook**; rollback never touches audit/purge logs. | Rollback procedure and M7 change. |
| **D15** | Legal form of the captured signature. | Signature is compliance-sensitive (§8/§9). | Image only; image + hash binding; third-party e-sign. | **Image bound to inspection ID + form-value hash + server timestamp, stored server-side**; legal confirmation. | §8 and M6 compliance tests change. |

**Also to confirm in M0 (not full decisions):** available reconnect window length and
uplink at the pilot site (A11), photo sizes and device free space (A12/A16), that
version numbers are enforced on writes (A7), and that the shipped cache holds no
durable in-flight notes (A13).

## 17. Risk register (summary)

| ID | Risk | Early signal | Mitigation | Owner role |
| --- | --- | --- | --- | --- |
| **R1** | 24h purge cannot be met on a device offline past the window, or unsynced data collides with the deadline. | Acceptance timestamps vs device check-in gaps. | D5 hybrid clock, hard rule against purging unsynced data, highest-severity alerts, legal sign-off. Detailed in `RESPONSE.md`. | Compliance + mobile lead |
| **R2** | Record-level integer versions + concurrent supervisor edits cause silent data loss — the brief's original defect. | 409 rates, double-changed field counts in dogfood. | D2 client-side three-way merge, D3 resolution UI, full merge-matrix tests, audit of decisions. Detailed in `RESPONSE.md`. | Server + mobile lead |
| **R3** | Prefetch is incomplete/stale, or 40 photos cannot drain in brief intermittent windows. | "Available offline" count, outbox age, upload failure rate. | D13 prefetch, D8 independent uploads, D9 compression, chaos tests, storage caps. Detailed in `RESPONSE.md`. | Mobile + ops lead |
| R4 | Template drift during an offline window. | Template version mismatches on pull. | Pin schema version at open (A4, §10). | Server lead |
| R5 | Token expiry offline locks out an inspector. | Re-auth failures in field tests. | D10 queue-and-reauth policy. | Mobile lead |
| R6 | Lost or shared device exposes customer data. | MDM/wipe drill results. | Encryption, MDM wipe (A9), D7 partitioning. | Security lead |
| R7 | Clock skew corrupts audit order or purge deadlines. | Client/server time divergence. | Server-authoritative timestamps (A10). | Server lead |
| R8 | Storage exhaustion drops captured photos. | Free-space telemetry. | Caps, warn/block behaviour, never drop captured files (§8). | Mobile lead |
| R9 | 409 storm or duplicate responses duplicate records/audit events. | Dedup-hit and 409 metrics. | Idempotency keys, ordered outbox, dedup cache (§6). | Server lead |
| R10 | Migration corrupts or strands data on upgrade/downgrade. | Migration/crash telemetry in dogfood. | Versioned migrations, downgrade "flush then reset", M2 tests. | Mobile lead |

## Appendix A — Requirement traceability

| TASK.md required topic | Section |
| --- | --- |
| Explicit assumptions | §2 (+ R1–R3 in `RESPONSE.md`) |
| User flow | §4 |
| Scope boundaries | §3 |
| Local data model | §5 |
| Sync protocol | §6 |
| Conflict policy | §7 |
| Attachments | §8 |
| Security | §9 |
| Migration / backfill | §10 |
| Observability | §11 |
| Staged rollout | §12 |
| Rollback | §14 |
| Testing | §15 |
| Milestone sequence with dependencies and acceptance criteria | §13 (gates in §12) |
| Decisions before implementation, each with a recommendation | §16 |
| No fake dates / no unjustified staffing estimates | §0 convention; dependency-gated M0–M11 |

| BRIEF.md fact | Where addressed |
| --- | --- |
| Company-managed tablets, basements, no signal | A1, A9, §4, §15 |
| Lost connection can discard notes | §1, §4 step 5, §7, §12 criterion 1 |
| Open assigned inspections offline | A3, A17, D13, §3, §4 |
| Fill forms offline | §4, §5, §7 |
| Up to 40 photos | A12, §8, D9 |
| Collect a signature offline | §7, §8, D15 |
| Intermittent connectivity | A11, §6, §15 chaos tests |
| Supervisors edit the same inspection from the web | §6, §7, §16 D2/D3 |
| Audit history required | A6, §7, §9, §10, D11 |
| Remove local customer data within 24h of acceptance | A14, A18, §9, §16 D5/D6, R1 |
| REST with integer record versions | A7, A8, §6, §7, D2 |
| SQLite currently a read-through cache | A13, §5, §10 |
| Pilot before broad rollout | §12 P0–P3, §13 M9–M11 |
| No full collaborative editor | §3, §7, D3 |
