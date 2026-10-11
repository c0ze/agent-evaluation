# Offline inspection brief

Inspectors use company-managed tablets in basements with no signal. Today, a
lost connection after opening an inspection can discard notes. They need to open
assigned inspections, fill forms, take up to 40 photos, and collect a signature
offline. Connectivity may return intermittently. Supervisors can edit the same
inspection from the web. Regulations require an audit history and removal of
local customer data within 24 hours after an inspection is accepted. Existing
server APIs use REST with integer record versions. The mobile app has SQLite but
currently treats it as a read-through cache. Product wants a pilot before broad
rollout and does not want a full collaborative editor.

