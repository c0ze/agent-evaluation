# RESPONSE.md — Three riskiest assumptions

1. **Intermittent connectivity is sufficient for eventual sync before the 24h
   purge deadline (A2).** The whole design assumes photos, signatures, and
   records leave the device within hours of acceptance, but basements have no
   signal and "intermittent" could mean a device sits offline for days. If
   sync lags past the purge deadline, we face a direct conflict between "sync
   everything" and "remove local customer data within 24 hours." The plan
   mitigates by making purge local and unconditional (compliance wins) and by
   alerting on purge-ack lag, but the residual risk is unsynced inspection data
   being purged before it ever reaches the server, which would be data loss.

2. **Field-level last-writer-wins is acceptable for a regulated audit context
   (A7 + conflict policy).** The plan assumes supervisors and inspectors will
   accept LWW with an audit trail rather than a collaborative editor, and that
   regulators accept merge decisions as auditable history. If either party
   rejects this — e.g., a supervisor's edit silently losing to an inspector's
   stale-timestamp write, or compliance requiring both conflicting values to be
   preserved as first-class records — the conflict policy becomes a redesign,
   not a tweak, and the pilot will surface it late.

3. **The 24-hour local purge is enforceable and verifiable on managed tablets
   (A1 + A5).** The plan assumes MDM gives us encryption, wipe, and enough
   control to guarantee local deletion within 24h of server-side acceptance,
   including when the device is offline, asleep, or the app is not running at
   the deadline. If background execution is unreliable or "accepted" cannot be
   defined precisely server-side, we cannot prove compliance — and the fallback
   (server-triggered purge on next sync) reintroduces the connectivity risk from
   assumption 1.
