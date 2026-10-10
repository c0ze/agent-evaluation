# Plan: Offline Inspection Work and Sync

Status: draft for review. Source: `BRIEF.md` (the only product input). Anything
not stated in the brief is labelled as an assumption (`A#`) or an open decision
(`D#`). The plan contains no calendar dates or staffing numbers. Sizing should be
done by the implementing team after Milestone 0, once the decisions in section 3
are settled.

---

## 0. Problem statement and goals

**Problem.** Inspectors work in basements with no signal. If the connection drops
after an inspection is opened, notes can be lost. The mobile app uses SQLite only
as a read-through cache, so work in progress is never stored durably on the
device.

**Goals**

1. **No lost work.** Anything an inspector enters is saved on the device before
   the UI confirms it, and survives connection loss, app kill, reboot and low
   battery shutdown.
2. **Full offline task.** Inspectors can open an assigned inspection, fill in the
   form, take up to 40 photos, collect a signature and submit, all without a
   connection.
3. **Correct sync over intermittent connectivity.** Sync resumes on its own,
   applies each change exactly once, and handles concurrent supervisor edits from
   the web by a documented policy. It never loses data silently.
4. **Compliance.** Every change has a complete audit history. Local customer data
   is removed within 24 hours after an inspection is accepted.
5. **Safe delivery.** A pilot comes before broad rollout, with a kill switch that
   never strands unsynced work.

**Non-goals** (from the brief: "does not want a full collaborative editor"):
real-time co-editing, character-level merge of text, live cursors or presence,
and multi-user editing on the device.

---

## 1. Assumptions

Each assumption lists how it will be checked and what changes if it turns out
false. Assumptions marked **high risk** are covered in `RESPONSE.md`.

| # | Assumption | How to validate (M0 unless noted) | If false |
|---|---|---|---|
| A1 | **High risk.** The 24-hour removal rule is satisfied if local customer data is deleted once the server has confirmed full receipt of the submission, which happens *before* acceptance. It is also satisfied if a device that stays offline deletes the data on a local timer. The regulation does not require the device itself to prove deletion within 24 hours of acceptance. | Written interpretation from compliance/legal; confirm what counts as "customer data" and "local" (for example whether app-private encrypted storage and OS backups count). | If the device must prove deletion, add MDM-driven remote wipe and a compliance report of unconfirmed devices. The rule then also limits how long a device may stay offline. |
| A2 | **High risk.** Inspection forms have stable field identifiers. Repeating sections (defects, rooms) can be given stable row IDs, so merging field by field is meaningful. | Inventory the form template schema and the server record shape; check how the web editor saves (whole record or partial). | If forms are free-text blobs or positional arrays, the model must change (row UUIDs, template migration) before sync can merge safely. That makes M2 larger. |
| A3 | **High risk.** The server team can add an idempotent batch "changes" endpoint and audit writes alongside the existing REST API with integer versions. Web and other clients keep using the existing endpoints unchanged. | Review the server codebase and ownership; confirm that the web editor increments the same integer version on every write. | If the server cannot change, fall back to client-side rebase on the existing `PUT` + version (D1, option B). Idempotency and audit are weaker in that case, see D1. |
| A4 | Tablets are company-managed through MDM, which can enforce OS encryption and a screen lock and can push app updates and remote wipes. | Confirm the MDM product and policies with IT. | Add in-app encryption with an app PIN and our own wipe-on-command handling. |
| A5 | Inspectors know which inspections they will do before they lose signal, because the inspections are assigned in advance. | Interview pilot inspectors; look at assignment lead times in production data. | Add bulk "download today's route" and a background prefetch of assignments. Creating inspections offline stays out of scope. |
| A6 | A typical offline period lasts hours, not days, with signal between sites (vehicle, street level). | Pilot telemetry (longest offline period, age of oldest unsynced change); inspector interviews. | Raise the offline auth grace period (D4) and storage budget; review the purge timer (A1). |
| A7 | Tablets have enough free storage for at least a day's inspections with 40 photos each after on-device compression. | Inventory device models and free storage via MDM; measure compressed photo sizes. | Stricter compression, a per-inspection storage check before starting, and upload of photos early when signal appears. |
| A8 | Supervisors rarely edit the *same field* an inspector is editing at the same time. Most concurrent supervisor edits are to review, status or comment fields. | Analyse server edit history: how often the web and mobile clients write the same record within an inspection window, and which fields. | If same-field conflicts are common, a conflict review queue becomes pilot scope, not a follow-up. |
| A9 | Form templates change rarely, and an in-progress inspection may stay on the template version it was downloaded with. | Confirm the template versioning process with product/ops. | Add server-side template migration for submitted records. |
| A10 | The customer signature is a signature on the inspection *as captured at signing time*, not on later supervisor edits. | Compliance/legal and product. | Signature must be re-collected after material edits, which is not feasible offline and after the visit. This needs a product decision (D7). |
| A11 | Device clocks can be wrong. Server receive time is authoritative for ordering. Device time is recorded as evidence only. | Given. Verify skew in pilot telemetry. | None. The design already does not trust device time. |
| A12 | The existing mobile SQLite cache holds nothing that cannot be fetched again. No user-authored data lives only in the cache today (the brief says notes are discarded, which suggests they are held in memory). | Code review of the current app's persistence. | The migration must carry any drafts it finds across before dropping cache tables (see section 9). |

---

## 2. Scope

**In scope (pilot and GA)**

- Download assigned inspections for offline use, with their form template version
  and any reference data the form needs (pick lists, prior findings if shown).
- Filling in forms offline, including repeating sections.
- Up to 40 photos per inspection, taken in the app, with captions and links to
  fields.
- Customer signature capture offline.
- Submitting offline: the submission is queued and completes when all data and
  attachments reach the server.
- Background sync that resumes when connectivity returns.
- A field-level conflict policy with supervisor web edits (section 6).
- An audit history of every change, both device-originated and web-originated.
- Local purge of customer data within the required window.
- A sync status UI: pending changes, pending photos, last successful sync, and
  errors that need attention.
- A feature flag, kill switch and telemetry.

**Out of scope** (candidates for later phases)

- A full collaborative editor, real-time co-editing, and merging inside a single
  text field.
- Creating new, unassigned inspections offline.
- Reassigning, cancelling or scheduling inspections on the device.
- Offline mode for the supervisor web app.
- Video, or audio notes.
- Photos imported from the device gallery. Camera capture in the app only, so
  customer photos never land in shared storage.
- Changing the form template in the middle of an inspection.
- A general conflict resolution UI on the tablet. Conflicts are shown to
  supervisors on the web. Inspectors see only a notice.

---

## 3. Decisions required before implementation

Each decision has options and a recommendation. Decisions D1 to D5 and D7 block
M2 or M5 and must be settled in M0.

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| D1 | **How writes reach the server** | A: New idempotent batch endpoint `POST /inspections/{id}/changes` that takes field-level operations with base values and does the merge on the server. B: Client-side rebase on the existing `PUT` with `version` (on 409, fetch, merge locally, retry). | **A.** Option B cannot tell "my earlier request was applied but the response was lost" apart from a real conflict. It also cannot record device time, operation IDs or conflict decisions in the audit trail, and every client would need merge logic. A is additive, so existing REST clients are unaffected. | M2, M3 |
| D2 | **Same-field conflict rule** | A: Last write at the server wins. B: Supervisor always wins. C: Rule set by field category, with the losing value kept and flagged. | **C.** Fields the inspector captures on site (observations, measurements, photos, signature) are decided by the inspector's value, because the inspector was on site. Supervisor-owned fields (status, review notes, assignment, due dates) are decided by the supervisor's value and cannot be edited on the device. The losing value is always kept in the audit record and raises a conflict flag on the web. Option A lets whoever syncs last win, which in practice is always the inspector coming out of a basement. That is arbitrary. | M3 |
| D3 | **When the device purges customer data** | A: When the device learns the inspection was accepted. B: Right after the server confirms full receipt of the submission (record plus all attachments), with a local timer as a backstop. | **B**, subject to A1. Under A, a device that stays offline after submitting cannot learn about acceptance, so it could break the 24-hour rule. Under B the device purges before acceptance could happen. If a supervisor returns the inspection for rework, the device downloads it again. | M5 |
| D4 | **Offline authentication** | A: Require a valid access token for every action. B: Allow offline work for a limited grace period after the last online login, with a device-bound refresh credential and an OS or app unlock. | **B**, with a grace period set by security (suggested as a question: "one working shift plus margin"). Unsynced work is never deleted when the grace period ends. The app locks and requires online re-authentication before continuing. | M5 |
| D5 | **Encryption at rest** | A: Rely on OS full-disk encryption managed by MDM. B: Also encrypt the database (SQLCipher or equivalent) and photo files with keys held in the Keystore/Keychain. | **B.** It protects data if the device is unlocked but the app sandbox is extracted. Crypto-erase (destroying the key) is also a quick backstop for purge. Measure the performance cost on the lowest-spec pilot tablet during M1. | M1, M5 |
| D6 | **Photo size and format** | Full-resolution originals, or compression on the device to a maximum dimension and quality. | Compress on the device to a resolution agreed with supervisors and compliance, as the smallest size that is still usable as evidence. Keep the EXIF capture time and strip GPS unless it is required. Record a SHA-256 hash after compression. | M4 |
| D7 | **What the signature attests** | A: The whole inspection as later accepted. B: A content snapshot at the moment of signing. | **B** (see A10). Compute a canonical hash of the inspector-captured content at signing and store it with the signature. Later edits by the supervisor are audited separately. If an inspector edits after signing, the app asks whether to collect the signature again. | M4 |
| D8 | **Server-side state changed while offline** (reassigned, cancelled, template retired, already accepted) | Reject the device's changes, or accept them into quarantine. | **Accept into quarantine**: never throw away field work. The server stores the incoming changes against the record in a `quarantined` state and flags the record to supervisors. The device is told the outcome, and purge goes ahead once the server has the data. | M3 |
| D9 | **How inspections are made available offline** | Manual "make available offline" per inspection, or automatic download of all assigned inspections for the next N days. | **Automatic download of assigned inspections for a limited window**, plus a manual option. Show the storage impact. This avoids relying on inspectors remembering (A5). | M3 |
| D10 | **Signalling to supervisors that an inspection is being worked offline** | No signal, an advisory "checked out on device" badge, or a hard lock. | **Advisory badge** showing the time of the last device sync. No hard lock, because a lock held by an offline device cannot be released and this is not a collaborative editor. | M3 |
| D11 | **Pilot cohort and exit criteria** | Choose a region or team, and success thresholds. | One team that regularly works below ground, on the lowest-spec device model in use. Exit criteria are in section 12. | M7, M8 |

---

## 4. User flow

### Inspector (tablet)

1. **Before going offline** (at the office, in the vehicle or on street-level
   signal): the app syncs in the background. Assigned inspections within the
   download window (D9) are downloaded together with their template and
   reference data. Each inspection card shows its offline readiness: ✓ ready,
   downloading, or not available offline.
2. **Open an inspection** without a connection. It opens from the local database.
   If an inspection was not downloaded, the app says so clearly instead of
   showing a spinner.
3. **Fill in the form.** Every field change is written to SQLite in a transaction
   before the UI acknowledges it. The app autosaves continuously and has no
   "save" button.
4. **Take photos**, up to 40. Each photo is compressed, encrypted, hashed and
   saved before the next shot is allowed. The counter shows "n / 40". The app
   checks free storage when an inspection starts and warns early.
5. **Collect the signature.** The customer signs. The app stores the signature
   image and vector strokes together with the content hash (D7).
6. **Submit.** Validation runs locally against the template rules. If validation
   passes, the inspection moves to `submitted_pending_sync` and becomes read-only
   on the device. The inspector can move on to the next site.
7. **Connectivity returns**, even briefly: the outbox drains in order and photos
   upload in resumable chunks. The status bar shows "Syncing 12 changes, 18
   photos", then "All changes saved to server".
8. **Server confirms full receipt.** The device receives a receipt for the
   operations and all attachment hashes, then purges the customer data (D3) and
   keeps only a non-identifying stub (inspection ID and "submitted at").
9. **Conflicts or quarantine.** The inspector sees a non-blocking notice such as
   "A supervisor also edited 2 fields; they will review". The inspector has no
   decisions to make on the device.

### Supervisor (web)

- Sees an advisory "checked out on device, last synced …" badge (D10).
- Can edit as today. Edits to supervisor-owned fields always apply. Edits to
  fields the inspector captures apply, but may be superseded when the inspector's
  offline change syncs. The superseded value stays visible in the conflict panel.
- Reviews flagged conflicts and quarantined submissions, then accepts or returns
  the inspection. Acceptance is recorded in the audit trail and starts the purge
  timer on the server side.

### Edge flows

- **App killed or tablet rebooted mid-form:** the inspector reopens to exactly the
  last saved state.
- **Grace period expired while offline:** the app locks. Unsynced data stays
  encrypted on the device, and re-authentication starts the sync.
- **Storage full:** the app blocks further photo capture with an explanation.
  Form entry keeps working.
- **Returned for rework after purge:** the inspection downloads again as a new
  offline copy.

---

## 5. Local data model (SQLite)

SQLite changes from read-through cache to **local source of truth for drafts**.
Server-derived data and local changes are kept apart, so the device can always
rebuild from the server and replay its own changes on top.

```
inspection
  id                 TEXT PK      -- server id
  template_id        TEXT
  template_version   INTEGER      -- pinned at download (A9)
  server_version     INTEGER      -- last integer version seen from server
  server_snapshot    BLOB         -- last server copy (JSON, encrypted); base for 3-way compare
  local_state        TEXT         -- downloaded | in_progress | submitted_pending_sync
                                  -- | synced_awaiting_receipt | purged | quarantined
  downloaded_at, last_synced_at   INTEGER (device ms) + server timestamps where known
  purge_after        INTEGER      -- backstop deadline (A1/D3)

field_value
  inspection_id, field_path TEXT  -- stable path, e.g. "roof.condition" or "defects[<row_uuid>].severity"
  value              BLOB         -- encrypted JSON
  base_value         BLOB         -- server value this edit was based on (for merge)
  dirty              INTEGER      -- has un-acknowledged local edit
  updated_at_device  INTEGER
  PK (inspection_id, field_path)

repeat_row
  inspection_id, section, row_id TEXT (client UUIDv4/v7), deleted INTEGER (tombstone), sort_key

outbox_op                          -- append-only, ordered
  op_id              TEXT PK       -- client UUID; idempotency key
  inspection_id      TEXT
  seq                INTEGER       -- per-inspection monotonic
  kind               TEXT          -- set_field | add_row | delete_row | attach | detach | sign | submit
  payload            BLOB          -- encrypted; includes base_value
  created_at_device  INTEGER
  state              TEXT          -- pending | in_flight | acked | rejected
  attempts, last_error

attachment
  id                 TEXT PK       -- client UUID
  inspection_id, field_path, caption
  file_path          TEXT          -- app-private, encrypted file
  sha256, byte_size, mime, captured_at_device
  upload_state       TEXT          -- pending | uploading | uploaded | verified
  upload_session_id  TEXT, bytes_confirmed INTEGER

signature
  inspection_id PK, image_attachment_id, strokes BLOB, content_hash, signed_at_device, signer_name

sync_meta                          -- per device
  device_id, last_pull_cursor, last_successful_sync, auth_grace_expires_at

local_audit                        -- device-side events not implied by ops (opened, viewed, purge executed)
  id, inspection_id, event, at_device, uploaded INTEGER
```

Rules:

- Each UI edit makes **one transaction** that writes `field_value` and appends an
  `outbox_op`. If either write fails, the edit is not acknowledged.
- Repeated edits to the same field *may* be coalesced in the outbox while still
  `pending`, which keeps backlogs small. The audit then records the final value
  plus device timestamps. Whether each keystroke-level intermediate value must be
  audited is a compliance question. The recommendation is no: audit per committed
  field value (on blur, or after a debounce).
- WAL mode, `synchronous=FULL` for outbox writes, and foreign keys on.
- Customer data columns and files are encrypted (D5). `sync_meta`, and stubs with
  no customer data, do not need to be.

---

## 6. Sync protocol

### 6.1 Pull (server to device)

- `GET /me/assignments?since=<cursor>` returns assigned inspection IDs with their
  `version`, `state` and `template_version`. The cursor makes the call
  incremental.
- For each inspection that is new or changed, `GET /inspections/{id}` (existing
  endpoint) returns the full record, and it is stored as `server_snapshot`.
- Local fields that are **not dirty** are refreshed from the snapshot. Dirty
  fields keep the local value, and the new snapshot becomes the base for the
  compare on the server.
- Templates and reference data are fetched by version and are immutable, so they
  can be cached indefinitely.

### 6.2 Push (device to server), recommended option D1-A

```
POST /inspections/{id}/changes
Idempotency: each op has op_id; the batch has batch_id
Body: {
  device_id, base_version,            // integer version the device last saw
  ops: [ { op_id, seq, kind, field_path, base_value, value, created_at_device }, ... ]
}
Response 200: {
  new_version,
  results: [ { op_id, status: applied | applied_with_conflict | superseded | quarantined | duplicate,
               server_value, conflict_id? } ],
  receipt_hash                        // hash of applied content for this inspection
}
```

- **Ordering:** each inspection's ops are sent in `seq` order, and batches are
  capped by size. Different inspections sync independently, so one stuck
  inspection does not block the others.
- **Exactly-once effect:** the server stores `op_id` in a dedup table in the same
  transaction as the change. A replayed op returns `duplicate` with the original
  result. This covers the "committed, but the response was lost" case, which is
  common with intermittent signal.
- **Merge on the server:** for each op the server compares `base_value` with the
  current server value.
  - Equal: nobody else changed the field. Apply the op. `version` increases once
    per batch.
  - Different: a concurrent edit. Apply the D2 category rule, write a conflict
    record, and return `applied_with_conflict` or `superseded`.
  - The record-level `base_version` is used for diagnostics and fast paths. The
    merge decision is made per field. **No backfill of per-field versions is
    needed.**
- **Rows:** `add_row` with a client UUID is idempotent. `delete_row` is a
  tombstone. An edit to a row another party deleted resurrects it and is
  flagged.
- **Submit:** the `submit` op is only accepted once every attachment named in the
  inspection's manifest has status `verified`. Otherwise the server returns
  `pending_attachments` with a list of what is missing, and the client retries
  after uploading.
- **Retries:** exponential backoff with jitter, capped. Sync is triggered by
  connectivity change, app foreground, the OS background-task scheduler and a
  manual "Sync now". Only 4xx responses that cannot be retried mark an op
  `rejected`, and a rejected op is surfaced in telemetry and on the web. It is
  never deleted.
- **Receipt:** after everything is applied and the attachments are verified, the
  server returns a `receipt_hash`. The device compares it with its own
  calculation and only then marks the inspection `synced`, which makes it
  eligible for purge.

### 6.3 Web supervisor writes

The existing web endpoints stay as they are, but must (a) increment `version`,
(b) write audit entries through the same audit service, and (c) populate the
field categories used by D2. The web editor shows conflict flags and the
"checked out on device" badge.

### 6.4 Compatibility

- The server supports clients with and without offline support at the same time.
  Endpoints are additive and nothing existing is removed.
- The client sends `X-Client-Capabilities: offline-sync/1`. The server can refuse
  a protocol version it no longer supports with a clear upgrade error, and never
  silently drops ops.

---

## 7. Conflict policy (summary of D2, D8, D10)

| Situation | Outcome | Visibility |
|---|---|---|
| Inspector and supervisor edit different fields | Both applied | Audit only |
| Same field, and the field is inspector-captured | Inspector value applied; supervisor value kept | Conflict flag on web; audit |
| Same field, and the field is supervisor-owned | Supervisor value kept (device cannot edit these fields; defensive) | Audit |
| Inspector edits a repeating row the supervisor deleted | Row restored with the inspector's edit | Conflict flag |
| Inspection reassigned or cancelled while offline | Changes accepted into `quarantined` | Supervisor queue; device notice |
| Inspection already accepted when the device syncs | Changes accepted into `quarantined`, and the accepted content is not modified | Supervisor queue; audit |
| Template retired while offline | Stored against the pinned template version | Flag if the template can no longer be rendered |
| Edit after signing | Allowed with a prompt to collect the signature again; signature content hash mismatch recorded | Web shows "signed content differs" |

Principle: **the system never silently discards a value.** Every losing value is
kept in the audit and in the conflict record.

---

## 8. Attachments and signature

- **Capture:** photos are taken in the app's camera, compressed (D6), encrypted,
  and written to app-private storage. The SHA-256 hash is computed over
  the compressed image before encryption, so the server can check the same bytes
  it receives. The attachment row and its `attach` op are written
  in one transaction after the file is fsynced.
- **Limit:** 40 photos per inspection, enforced on both client and server.
  Storage is checked before the inspection starts (A7).
- **Upload:** photos go through a separate queue from the field ops, so a few
  kilobytes of form data are never blocked behind megabytes of photos. Uploads
  are resumable and chunked:
  `POST /attachments/sessions` creates a session and is idempotent by attachment
  ID. `PUT` chunks with offsets. `POST .../complete` makes the server verify the
  hash, and the attachment becomes `verified`.
- **Order:** form ops are uploaded first, then photos in capture order. Upload
  runs in the OS background-transfer service where the platform allows it.
- **Integrity:** the server rejects a hash mismatch, and the client uploads the
  file again from the start.
- **Signature:** stored as vector strokes and a rendered PNG attachment, plus the
  `content_hash` (D7). The signer's name is a captured field.
- **Server storage:** objects are stored under non-guessable keys. Access goes
  through the API's authorisation, never through public URLs.

---

## 9. Migration and backfill

**Mobile**

1. A forward-only SQLite migration adds the new tables. The old read-through
   cache tables are dropped and fetched again (A12). Before dropping them, the
   migration scans for any user-authored draft data and turns it into
   `field_value` rows plus outbox ops if it finds any.
2. The migration runs on first launch after the update, inside a transaction, and
   is tested from every app version still installed (MDM inventory).
3. **Downgrade guard:** an older app build would not understand the new schema.
   The rollback runbook (section 13) requires the outbox to be drained before any
   downgrade is pushed through MDM. The new build writes a `schema_version`
   marker, and a downgrade-safe hotfix build (if one is needed) must refuse to
   drop a database whose outbox is not empty.

**Server**

1. Additive schema: an `op_dedup` table (`op_id`, `inspection_id`, result, and a
   TTL well beyond the maximum offline period), a `conflict` table, an
   `attachment_upload_session` table, the device registry and purge receipts,
   field category metadata on templates, and a `quarantined` record state.
2. **Audit backfill:** existing inspections get a single "baseline" audit event
   that captures their current state and version, so each audit chain has a
   start. Historical changes are not reconstructed unless compliance requires
   it. That is an open question for M0 and must not be guessed.
3. **Field categories:** templates are annotated as inspector-captured or
   supervisor-owned. Where a field is ambiguous, the default is
   inspector-captured, and product reviews the list.
4. **Repeating rows:** if the server stores repeating sections as positional
   arrays (A2), existing records get stable row IDs in a one-off backfill. The
   backfill is idempotent and verified by comparing record hashes before and
   after, apart from the ID fields.
5. Existing web clients are not affected. All migrations can be deployed before
   any client uses them.

---

## 10. Security and data retention

- **Encryption at rest:** database and photos are encrypted with keys in the
  hardware-backed Keystore/Keychain (D5), in addition to MDM full-disk
  encryption.
- **Authentication offline:** a grace period (D4) and an app lock that requires a
  device unlock or app PIN to resume. The refresh credential is bound to the
  device (A4).
- **Transport:** TLS only, with certificate pinning if the organisation's policy
  allows it and MDM proxies do not break it.
- **Authorisation:** the server re-checks on every sync that the user may still
  write to this inspection. Changes from a user who is no longer assigned go to
  quarantine (D8) and are not applied.
- **Purge** (D3 and A1):
  - Primary trigger: server receipt confirmed. The device deletes field values,
    snapshots, photos and the signature for that inspection, then destroys the
    per-inspection data key (crypto-erase) and keeps only a stub.
  - Backstop: a `purge_after` deadline on every downloaded inspection. It is set
    from the server's acceptance time when known. Otherwise it is set to a
    maximum retention since the last server contact that compliance agrees to.
    The backstop never deletes **unsynced** data on its own. If the deadline and
    the unsynced state collide, the device raises an alert and the case is
    escalated. Compliance has to decide how that edge case is handled.
  - The device sends a **purge receipt** (inspection ID, time purged) on its next
    sync. The server reports every accepted inspection without a purge receipt
    after 24 hours, and MDM remote wipe is the last resort.
  - Checks run on app start, on sync, and in a scheduled background task.
- **Leakage controls:** app data excluded from OS and cloud backups; no photos in
  the shared gallery; screenshots and the recent-apps preview blocked on
  inspection screens; no customer data in logs, crash reports or analytics (IDs
  only); clipboard use limited.
- **Audit:** every server change records the actor, device ID, `op_id`, device
  time, server time, old value, new value, the conflict outcome, and the base
  version. Device-only events (open, purge) are uploaded from `local_audit`.
  Audit records are append-only.
- **Threat review:** a security review of the offline design is required before
  pilot (M5 exit).

---

## 11. Observability

Telemetry contains no customer data and is keyed by device ID, inspection ID and
app version.

**Client metrics:** outbox depth and age of the oldest pending op; attachment
queue depth and bytes; how long sync takes after connectivity returns; sync
attempts and outcomes by error class; conflict counts by field category; local
validation failures; database size and free storage; migration success or
failure; time from submit to server receipt; purge executed or overdue; crashes
tied to the sync state.

**Server metrics:** changes endpoint latency and error rate; duplicate op rate
(this shows how often retries happen); conflict and quarantine rates; attachment
hash mismatches; inspections accepted without a purge receipt after 24 hours
(**compliance alert**); age of the oldest unacknowledged conflict.

**Integrity canary:** each client reports how many ops it has generated and
acknowledged per inspection. The server compares that with the ops it has
applied. Any gap that lasts longer than a threshold triggers an alert, because it
points to lost data.

**Dashboards and alerts:** a pilot dashboard per cohort. Alerts go to the owning
team for the compliance purge breach, integrity canary gaps, rejected ops, and
spikes in the changes endpoint error rate.

**Support tooling:** a support view showing a device's sync state (queue depths,
last error) with no customer content. A "Send diagnostics" action in the app
uploads the same data.

---

## 12. Staged rollout

Offline mode is gated by a server-side feature flag per user and device. There
are two separate switches: **offline capture** (downloading and editing offline)
and **offline sync** (draining the outbox). The sync switch is never turned off
for devices that hold unsynced data.

| Stage | Cohort | Entry criteria | Exit criteria (to advance) |
|---|---|---|---|
| S0 Internal | Engineering/QA devices, test data only | M1 to M6 done | All test plan suites green; offline chaos run with zero lost ops |
| S1 Dogfood | Internal staff doing mock inspections in real basements, on the pilot device model | S0 exit; security review passed | Zero integrity canary gaps; purge receipts for 100% of accepted inspections within 24h |
| S2 Pilot | One field team (D11) | S1 exit; compliance sign-off on A1/D3; support runbook ready | Across a pilot period agreed with product and compliance: no confirmed data loss; zero purge breaches; conflict rate and quarantine rate within the thresholds agreed in M0; inspector satisfaction ≥ baseline; no severity-1 incidents open |
| S3 Expansion | Further teams in increments, lowest-connectivity teams first | S2 exit; any pilot fixes shipped | Same metrics hold at each increment; server capacity headroom confirmed |
| S4 GA | All inspectors | S3 exit | Old online-only code path scheduled for removal after a stable period |

The thresholds are placeholders to be set in M0 using the baseline measurements
(for example today's rate of lost notes from support tickets). This plan does not
invent them.

---

## 13. Rollback

- **Kill switch:** turning off **offline capture** stops new offline downloads
  and edits. Devices go back to online-only editing, but **keep draining their
  existing outbox and photo queue**. Nothing on the device is deleted by a flag
  change.
- **Server:** the new endpoints are additive. Rolling back server code means
  disabling the changes endpoint only after telemetry shows every outbox is
  empty. Records written through the endpoint are ordinary records with
  ordinary versions, so the web and old clients read them normally.
- **Client downgrade:** only through MDM, and only after the outbox is drained
  (see section 9). If a client defect blocks draining, ship a forward fix. Do
  not downgrade. Before pilot, prepare an emergency "export unsynced data"
  support path: an encrypted bundle uploaded through a separate endpoint.
- **Data repair:** because the audit is append-only and records old and new
  values, a faulty merge rule can be corrected by replaying the audit. A replay
  tool is built in M3 and tested before pilot.
- **Decision rights:** the runbook names who can pull the kill switch, which
  metric levels trigger it (integrity canary gap, purge breach, crash spike), and
  how pilot users are told.

---

## 14. Testing strategy

| Layer | What | Notes |
|---|---|---|
| Unit | Merge function (every row of section 7), outbox coalescing, state machine transitions, purge rules, content hashing | **Property-based tests**: arbitrary interleavings of device and web edits never lose a value (it is either applied or recorded as superseded) |
| Server integration | Idempotency (replay of every op and batch), concurrent web and device writes, quarantine paths, submit gated on attachments, audit completeness | Includes the "commit succeeded, response dropped" case |
| Client integration | Real SQLite + encrypted storage with a fake server | Kill the app at every step of the sync loop and assert on the recovered state |
| Network chaos | Airplane mode toggling, flaky proxy (drops, delays, truncated uploads, 5xx), very slow links | Automated in CI with a fault-injecting proxy |
| Device / performance | 40 photos on the lowest-spec tablet; backlog of several inspections; battery use during background sync; database size | Encryption overhead measured (D5) |
| Clock and time | Device clock skewed forwards and backwards; timezone change; long offline period beyond the grace period | Ordering must never depend on device time |
| Migration | Upgrade from every installed version (MDM inventory), with and without cached data; server backfill idempotency | Test downgrade guard behaviour |
| Security | Forensic inspection of the device after purge (no customer data in the DB, files, WAL or logs); backup exclusion; screenshot blocking; token expiry offline | External or internal security review |
| Compliance | End-to-end acceptance followed by a purge receipt in under 24h, including a device that goes offline right after submitting; audit trail completeness report | Compliance signs off on test evidence |
| Field | Dogfood and pilot in real basements; structured feedback from inspectors | Compare lost-work reports with the baseline |

---

## 15. Milestones

Milestones are ordered by dependency, not by date. Each milestone ends with a
demo and a check against its acceptance criteria.

```
M0 ─┬─> M1 ──┬──────────────> M3 ──> M4 ──┐
    │        │                 ^            ├─> M6 ──> M7 ──> M8 ──> M9
    └─> M2 ──┴─────────────────┘            │
             └──────────> M5 ───────────────┘
```

| Milestone | Content | Depends on | Acceptance criteria |
|---|---|---|---|
| **M0 Discovery and decisions** | Validate A1–A12; decide D1–D11; baseline metrics (lost-work tickets, concurrent-edit frequency); compliance interpretation in writing; team sizing | – | Every decision recorded with an owner; A1, A2 and A3 confirmed or the plan revised; baseline numbers captured; S2 thresholds agreed |
| **M1 Durable local drafts** | New SQLite schema, encryption (D5), migration from the cache, transactional autosave, outbox recording (no push yet; while online the existing save path is still used) | M0 | Killing the app or rebooting at any point loses zero committed edits (automated test); migration passes from all installed versions; encryption overhead within the agreed budget on the lowest-spec device. *This already fixes the "lost notes" symptom when online and can ship behind a flag.* |
| **M2 Server changes API and audit** | `/changes` endpoint, op dedup, field-level merge with D2 categories, conflict and quarantine records, audit service, baseline audit backfill, row ID backfill if needed, web conflict flags | M0 | Idempotency suite passes (every op replayed N times gives the same result); audit entries for 100% of writes from web and device; existing web and client regression suite green; backfill verified by hashes |
| **M3 Offline sync engine** | Pull with cursor, push outbox, retries and backoff, auto-download window (D9), sync status UI, "checked out" badge (D10), audit replay tool | M1, M2 | Chaos suite: zero lost or duplicated ops over a long randomised run; conflicts resolved according to section 7 in end-to-end tests; offline open, edit and submit works in airplane mode |
| **M4 Attachments and signature** | Camera capture, compression (D6), encrypted storage, resumable uploads, submit gated on attachments, signature with content hash (D7) | M3 | 40 photos captured and uploaded over a flaky link with no hash mismatches left unresolved; upload resumes after app kill; submit is blocked until all attachments are verified; signature hash mismatch shown after an edit |
| **M5 Security and purge** | Offline auth grace period (D4), app lock, purge on receipt plus backstop, crypto-erase, purge receipts, compliance report, leakage controls | M1, M2 (and M4 for photo purge) | Forensic test finds no customer data after purge; purge receipts arrive for a device that went offline right after submitting; security review passed; compliance signs off on the purge design |
| **M6 Observability and operations** | Metrics, integrity canary, dashboards, alerts, support view, runbooks (kill switch, rollback, unsynced export) | M3, M4, M5 | Every metric in section 11 visible on a dashboard for test devices; alerts fire in a staged drill; the rollback drill completes without data loss |
| **M7 Internal and dogfood (S0–S1)** | Run S0 and S1 | M6 | S0 and S1 exit criteria met |
| **M8 Pilot (S2)** | One field team, with weekly reviews of the metrics and feedback | M7, D11 | S2 exit criteria met; go/no-go recorded |
| **M9 Expansion and GA (S3–S4)** | Incremental rollout, then plan removal of the old path | M8 | S3 and S4 exit criteria met |

M1 and M2 can proceed in parallel after M0. M5 can start once M1 and M2 exist,
running in parallel with M3 and M4.

---

## 16. Open questions to take into M0

1. What exactly is "local customer data" under the regulation, and does it cover
   device logs, OS backups or stubs holding only an ID? (A1)
2. Must the audit history include intermediate values before commit, and must it
   reconstruct historical changes from before launch? (sections 5 and 9)
3. What is the maximum time a device may keep unsynced customer data, and what
   happens when that conflicts with the purge rule? (section 10)
4. Which template fields are supervisor-owned? (D2)
5. What photo resolution is acceptable as evidence? (D6)
6. How long should the offline auth grace period be? (D4)
