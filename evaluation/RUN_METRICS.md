# Cloud run metrics

Times are JST (GMT+9). Each cloud account has its own "Included credit" balance
($250, expires 2026-11-05 16:59 JST). Balances are read from screenshots of the
usage page in `billing/`. The screenshots don't show the account; the account
for each one is as Arda identified it.

- **Account A:** Sonnet 5.5, then Opus 5.5.
- **Account B:** Fable 5.1.

## Runs

| Model | Account | Started | Finished (push) | Duration | Credit before | Credit after | Cost | Tasks completed | Result branch |
|---|---|---|---|---|---|---|---|---|---|
| Sonnet 5.5 | A | ~01:15 | 01:43:38 | ~28 min | $94 | $79 | **$15** | 13 / 13 | `claude/optimistic-dirac-o4m2z9` in `c0ze/agent-eval-sonnet-5.5` |
| Fable 5.1 | B | ~01:17 | running | | $79 | | | | |
| Opus 5.5 | A | starting after 01:44 | | | $79 (last reading) | | | | |

## Credit balance readings

| Time | Account | Balance | Context | Screenshot |
|---|---|---|---|---|
| 01:15:30 | A | $94 of $250 | Sonnet starting | `billing/2026-09-30_0115_accountA_sonnet-start_94.png` |
| 01:17:34 | B | $79 of $250 | Fable starting | `billing/2026-09-30_0117_accountB_fable-start_79.png` |
| 01:44:30 | A | $79 of $250 | Sonnet done | `billing/2026-09-30_0144_accountA_sonnet-end_79.png` |

## Notes

- The page shows whole dollars, so each cost is accurate to about ±$1.
- Account A's $79 after Sonnet is the same figure as account B's $79 before
  Fable. That's a coincidence of the two balances, not the same reading.
- Opus's "credit before" is the 01:44:30 reading. A screenshot taken just
  before Opus starts would rule out any late-posted Sonnet usage being counted
  against Opus.
