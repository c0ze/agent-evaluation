# Task 04 — Project maintenance: prepare a Python library release

Prepare this small library for a `0.4.0` release. Work from the supplied files
and do not use the network.

Requirements:

- The supported Python range is 3.10 through 3.13. Align metadata and CI.
- Replace deprecated `distutils` usage without changing `normalize_version`'s
  observable behavior for ordinary versions.
- Make the test/lint workflow coherent and least-privileged; pin GitHub Actions
  to the major versions already named in the fixture notes.
- Create `CHANGELOG.md` from `RELEASE_NOTES.txt`, separating user-visible changes
  from internal maintenance and avoiding invented claims.
- Create `MAINTENANCE.md` with a short release checklist, compatibility policy,
  and the next three prioritized maintenance items.
- Add or improve tests where the compatibility change warrants it.

Run all feasible local checks. Write `RESPONSE.md` with changed files, remaining
risks, and exact verification results. Work only in this directory.

