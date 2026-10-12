# Offline Inspection Sync — PLAN.md

## 1. User Flow

**Inspector (tablet, offline-first)**
1. App launches → loads assigned inspections from local SQLite (pre-synced when online)
2. Opens inspection → all form sections, existing notes, and thumbnails available locally
3. Fills form fields, adds notes, captures up to 40 photos (stored as local files + DB records)
4. Collects customer signature via on-screen canvas → stored as PNG locally
5. Taps "Complete" → inspection moves to `pending_sync` state; local UI shows sync status badge
6. When connectivity returns → background sync uploads changes, downloads supervisor edits
7. Server accepts → inspection marked `synced`; local customer data purged within 24h

**Supervisor (web, online)**
1. Views inspections in dashboard (real-time from server)
2. Edits form fields or adds annotations → creates new server version
3. Changes propagate to inspector's tablet on next sync

**Conflict scenario**: Inspector edited field X offline; supervisor edited same field X online. Sync detects version mismatch → applies conflict policy (see §5).

---

## 2. Scope Boundaries

| In Scope | Out of Scope |
|----------|--------------|
| Offline create/edit of assigned inspections | Real-time collaborative editing (Google Docs style) |
| Photo capture (≤40/inspection) + signature capture | Offline supervisor editing |
| Background sync with retry/backoff | Cross-inspection dependencies |
| Audit log (server-authoritative) | Offline mode for unassigned inspections |
| 24h local data purge after server accept | Multi-device inspector sessions |
| Pilot with 1 team (~10 inspectors) | Full migration of historical inspections to new schema |

Assumptions:
- Tablets are company-managed (MDM enrolled), Android 10+, 64GB+ storage
- Inspectors work solo per inspection; no handoff mid-inspection
- Server remains REST + integer versions; no GraphQL/WebSocket investment
- Pilot validates architecture before broad rollout

---

## 3. Local Data Model (SQLite)

```sql
-- Core tables
CREATE TABLE inspections (
  id INTEGER PRIMARY KEY,              -- server ID
  local_id TEXT UNIQUE NOT NULL,       -- UUID for offline-created
  server_version INTEGER NOT NULL,     -- last known server version
  status TEXT NOT NULL,                -- 'draft' | 'pending_sync' | 'synced' | 'conflict'
  assigned_inspector_id INTEGER NOT NULL,
  form_data_json TEXT NOT NULL,        -- JSON blob of all form fields
  created_at INTEGER NOT NULL,         -- unix ms
  updated_at INTEGER NOT NULL,
  synced_at INTEGER,                   -- null until server accepts
  purge_after INTEGER                  -- synced_at + 24h (ms)
);

CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL REFERENCES inspections(id),
  local_path TEXT NOT NULL,            -- file:// path in app sandbox
  server_id INTEGER,                   -- null until uploaded
  caption TEXT,
  sort_order INTEGER NOT NULL,
  uploaded_at INTEGER
);

CREATE TABLE signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL REFERENCES inspections(id),
  local_path TEXT NOT NULL,
  server_id INTEGER,
  signer_name TEXT,
  signed_at INTEGER NOT NULL,
  uploaded_at INTEGER
);

-- Sync metadata
CREATE TABLE sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
); -- e.g., 'last_full_sync_ms', 'pending_count'

-- Audit trail (append-only, mirrors server)
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL,
  actor_type TEXT NOT NULL,            -- 'inspector' | 'supervisor' | 'system'
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,                -- 'created' | 'field_changed' | 'photo_added' | 'signed' | 'synced' | 'purged'
  field_name TEXT,                     -- null for non-field actions
  old_value TEXT,
  new_value TEXT,
  timestamp INTEGER NOT NULL,
  server_version INTEGER NOT NULL
);
```

**Key invariants**
- `inspections.local_id` generated on first offline create; `server_id` assigned on first successful sync
- `server_version` monotonic; used for optimistic concurrency
- `purge_after` set only after `synced_at` confirmed; enforced by daily background job
- Photos/signatures stored as files; DB holds metadata only (avoids SQLite bloat)

---

## 4. Sync Protocol

**Transport**: HTTPS POST to existing REST endpoints; multipart/form-data for attachments.

**Endpoints (extend existing)**
| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/inspections/sync` | Bidirectional sync: upload pending, download changes |
| `POST /api/v1/inspections/{id}/photos` | Upload photo (returns server_id) |
| `POST /api/v1/inspections/{id}/signature` | Upload signature |
| `GET /api/v1/inspections/{id}/audit` | Fetch audit history (for compliance view) |

**Request/Response (sync endpoint)**
```json
// Request
{
  "device_id": "tablet-uuid",
  "inspector_id": 123,
  "since_version": 456,                 // client's last known server version
  "inspections": [                      // only inspections with local changes
    {
      "local_id": "uuid",
      "server_id": 789,                 // null if never synced
      "base_version": 450,              // version client last saw
      "form_data": { ... },
      "photos": [ { "local_id": 1, "caption": "..." } ],
      "signature": { "local_id": 1, "signer_name": "John" }
    }
  ]
}

// Response
{
  "server_version": 472,
  "inspections": [
    {
      "server_id": 789,
      "local_id": "uuid",
      "version": 472,
      "form_data": { ... },             // merged result
      "conflicts": [                    // empty if auto-merged
        { "field": "roof_condition", "server_value": "OK", "local_value": "Damaged" }
      ]
    }
  ],
  "deleted_inspection_ids": [999],      // supervisor deleted
  "audit_entries": [ ... ]              // new audit rows since since_version
}
```

**Retry/Backoff**
- Exponential backoff: 5s, 15s, 45s, 2m, 5m, 15m (max)
- Max 3 retries per inspection before marking `conflict` requiring manual review
- Sync runs: on app foreground, every 15min when online, on connectivity change broadcast

**Idempotency**
- Client includes `base_version`; server rejects if version mismatch (409)
- Photo/signature uploads use content-hash dedupe; safe to retry

---

## 5. Conflict Policy

**Default: Last-Writer-Wins (LWW) per field with audit trail**
- Server compares `base_version` → if match, accepts; if mismatch, computes field-level diff
- For each conflicting field: server value wins; local value stored in `conflicts` array in response
- Inspector sees conflict banner on next app open; can view diff and manually override
- Supervisor edits always win on server (authoritative); inspector cannot force-push

**Exceptions (require manual resolution)**
- Signature mismatch (two signatures captured) → flag for compliance review
- Photo count exceeds 40 after merge → reject sync, require inspector to delete

**Decision required**: Is LWW acceptable for all fields, or do regulated fields (e.g., "pass/fail") need mandatory manual resolution? → Recommend LWW for all but signature; add config flag per field type.

---

## 6. Attachments

**Photos**
- Max 40 per inspection; max 8MB each (tablet camera default ~3-5MB)
- Stored in app-private directory: `files/inspections/{inspection_local_id}/photos/{uuid}.jpg`
- EXIF stripped on capture (privacy); GPS retained if permission granted
- Upload: multipart, sequential, parallelism=2; progress shown per photo
- Thumbnail (300px) generated locally for offline gallery; not uploaded

**Signatures**
- Single PNG per inspection; vector path stored as JSON for potential re-render
- Max 500KB; stored alongside photos
- Uploaded with inspection sync payload (not separate endpoint)

**Storage budget**: ~40 photos × 8MB + signature ≈ 320MB worst case; well within 64GB.

**Cleanup**: Files deleted when inspection purged (24h post-sync); orphan sweep weekly.

---

## 7. Security

**Data at rest (tablet)**
- Full-disk encryption (Android FBE) + app-level SQLCipher for SQLite
- Photos/signatures encrypted via `EncryptedFile` (Jetpack Security)
- Keys derived from hardware-backed keystore + inspector PIN (biometric unlock)

**Data in transit**
- TLS 1.3 only; certificate pinning to company CA
- Mutual TLS for device auth (client cert provisioned via MDM)

**Authentication**
- Inspector: PIN + biometric; session token (JWT, 8h expiry) refreshed on sync
- Supervisor: SSO (SAML/OIDC) on web; no offline access

**Audit compliance**
- Server audit log immutable (append-only DB, WORM storage)
- Tablet audit log mirrors server; tamper-evident via hash chain (each row includes hash of previous)
- 24h purge: secure delete (overwrite + fsync) for customer PII fields (name, address, signature image)

**Device trust**
- Attestation via Play Integrity API on each sync; reject rooted/compromised devices
- Remote wipe via MDM if tablet lost

---

## 8. Migration / Backfill

**Schema migration (tablet)**
- Use Room migrations (SQLite) for additive changes
- New columns: `local_id`, `server_version`, `status`, `purge_after`, `audit_log` table
- Backfill `server_version` from last successful API call timestamp
- One-time migration script runs on first app launch after update

**Server migration**
- Add `version` column to inspections table (integer, default 1)
- Add audit_log table
- Backfill version=1 for all existing inspections
- Deploy behind feature flag; enable after tablet fleet updated

**Historical data**
- Do NOT migrate pre-existing completed inspections to new offline schema
- Read-only access via existing API; pilot only covers inspections created after launch

---

## 9. Observability

**Client-side (tablet)**
- Structured logs (JSON) to local file; uploaded on sync
- Metrics: sync_duration_ms, sync_result (success/conflict/error), pending_count, photo_upload_latency_p95, storage_used_mb
- Crash/error reporting via existing Sentry/Play Console
- Health check endpoint for MDM: `GET /health` → { last_sync_ms, pending, conflicts }

**Server-side**
- Sync endpoint latency, error rates by code
- Conflict rate by field, by inspector
- Audit log write latency
- Purge job success/failure count
- Dashboard: "Inspections pending sync > 24h" alert

**Correlation**
- `device_id` + `inspection_id` + `sync_session_id` (UUID per sync cycle) across client/server logs

---

## 10. Staged Rollout

| Stage | Audience | Criteria to Advance |
|-------|----------|---------------------|
| 1. Internal dogfood | 3 QA engineers + 2 inspectors (1 week) | Zero data loss; sync success > 99%; conflict UX validated |
| 2. Pilot team | 10 inspectors, 2 supervisors (2 weeks) | < 2% conflict rate; purge job 100% reliable; supervisor workflow accepted |
| 3. Regional expansion | 50 inspectors across 3 regions (4 weeks) | Sync success > 99.5% at scale; MDM rollout smooth; support load manageable |
| 4. General availability | All inspectors | Pilot metrics sustained; rollback tested; documentation complete |

**Gating**: Each stage requires sign-off from Engineering Lead, Product, and Compliance.

---

## 11. Rollback Plan

**Tablet app**
- Previous version remains in Play Console (track: internal → pilot → production)
- Rollback = promote previous build to current track; users auto-update
- Local DB forward-compatible: new columns nullable; old app ignores them
- If schema migration ran: provide downgrade migration (drop new tables/columns) in rollback build

**Server**
- Feature flag `offline_sync_enabled` (default false)
- Rollback = flip flag false; existing sync endpoints return 503
- Audit log and version columns retained (no data loss)
- Database migration reversible (drop column) if needed

**Data consistency on rollback**
- Inspections in `pending_sync` on tablet: user sees "sync unavailable" banner; data preserved locally
- No server-side partial writes (sync is transactional per inspection)

---

## 12. Testing Strategy

**Unit (CI, every PR)**
- Sync merge logic (LWW, conflict detection) — 100+ cases
- Purge job (time boundaries, error handling)
- Audit log hash chain verification
- Photo dedupe by hash

**Integration (nightly)**
- Full sync cycle against test server (Docker Compose)
- Offline → online → offline transitions
- Concurrent supervisor edit + inspector edit
- Large payload (40 photos + signature) upload/download
- Network flake simulation (Chaos Mesh)

**Device lab (weekly)**
- 5 tablet models (various Android versions, storage tiers)
- Cold start with 500 inspections cached
- Battery drain during background sync
- MDM policy enforcement (pinning, wipe)

**Pilot UAT (manual)**
- Inspector completes 5 inspections offline in basement
- Supervisor edits same inspection mid-flight
- 24h purge verification (audit + file deletion)
- Conflict resolution UI walkthrough

**Compliance validation**
- Pen test on encrypted storage
- Audit log immutability proof
- 24h purge certification (third-party)

---

## 13. Milestone Sequence

| Milestone | Dependencies | Acceptance Criteria |
|-----------|--------------|---------------------|
| M1: Local data model + schema migration | BRIEF.md approved | Room migration passes; `inspections` CRUD works offline; unit tests > 90% |
| M2: Photo/signature capture + storage | M1 | 40 photos + signature captured, stored encrypted, thumbnails render |
| M3: Sync protocol (upload only) | M2 | Pending inspections upload to test server; server returns version; idempotent retry works |
| M4: Sync protocol (download + merge) | M3 | Supervisor edits download; LWW merge produces correct result; conflicts surfaced |
| M5: Conflict UI + manual resolution | M4 | Inspector sees conflict banner; can view diff; override persists |
| M6: Audit log + 24h purge | M3 | Audit entries written on every change; purge job deletes PII + files at 24h+1m |
| M7: Security hardening | M1-M6 | SQLCipher + EncryptedFile; TLS pinning; Play Integrity attestation; pen test pass |
| M8: Observability + dashboards | M3, M6 | Metrics flowing; alerts firing on thresholds; correlation IDs work |
| M9: Pilot build + internal dogfood | M7 | Build distributed via Play Internal; dogfood team completes 10 inspections offline |
| M10: Pilot launch | M9 sign-off | 10 inspectors active; < 2% conflict rate; zero data loss in 2 weeks |
| M11: Regional expansion | M10 sign-off | 50 inspectors; sync success > 99.5%; support tickets < 5/week |
| M12: GA release | M11 sign-off | Rollback tested; docs complete; compliance sign-off |

---

## 14. Decisions Required Before Implementation

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Conflict resolution: LWW vs. mandatory manual for regulated fields** | LWW for all fields except signature; add per-field-type config for future regulatory changes | Simpler UX; audit trail captures both values; signature is legally sensitive |
| **Photo upload: inline in sync payload vs. separate endpoints** | Separate endpoints (multipart) | Allows parallel upload, resume, progress UI; keeps sync payload small |
| **Local ID strategy: UUID vs. negative integers** | UUID (v4) | Globally unique without coordination; works across devices if handoff ever added |
| **Purge trigger: server-acknowledged `synced_at` vs. local timer** | Server-acknowledged `synced_at` | Guarantees server has data before local delete; survives clock skew |
| **Audit log storage: mirror on tablet vs. server-only** | Mirror on tablet (hash-chained) | Offline compliance view; tamper evidence; server remains source of truth |
| **Sync frequency: fixed interval vs. connectivity-driven + foreground** | Hybrid: foreground + connectivity change + 15min interval | Balances battery, freshness, and "basement" reality |
| **Device trust: Play Integrity only vs. + hardware attestation** | Play Integrity (BASIC) for pilot; evaluate STRONG for GA | BASIC covers root/unlocked; STRONG requires newer hardware |
| **Backfill historical inspections to new schema** | No — read-only via legacy API | Avoids risky mass migration; pilot validates new flow on new inspections only |
| **Supervisor offline editing** | Out of scope (per brief) | Low ROI; supervisors have reliable connectivity |
| **Maximum photo size / compression** | 8MB max, no client-side compression (preserve quality for compliance) | Regulatory may require original resolution; storage budget allows it |

---

## 15. Open Questions for Product

1. Should inspectors be able to start a *new* inspection offline (not pre-assigned)?
2. What happens if supervisor deletes an inspection that inspector has pending locally?
3. Is 24h purge from `synced_at` or from "inspection accepted by supervisor"?
4. Do we need to support inspector switching tablets mid-inspection?
5. What is the exact PII field list for purge? (name, address, signature, photo EXIF?)