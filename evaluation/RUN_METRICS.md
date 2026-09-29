# Cloud run metrics

Times are JST (GMT+9). All three cloud runs draw on one shared "Included credit"
balance ($250, expires 2026-11-05 16:59 JST), read from screenshots of the usage
page in `billing/`.

## Runs

| Model | Started | Finished (push) | Duration | Tasks completed | Result branch |
|---|---|---|---|---|---|
| Sonnet 5.5 | ~01:15 | 01:43:38 | ~28 min (reported by Arda) | 13 / 13 | `claude/optimistic-dirac-o4m2z9` in `c0ze/agent-eval-sonnet-5.5` |
| Fable 5.1 | ~01:17 | running | | | |
| Opus 5.5 | not started | | | | |

## Credit balance readings

| Time | Balance | Context | Screenshot |
|---|---|---|---|
| 01:15:30 | $94 of $250 | Sonnet starting | `billing/2026-09-30_0115_sonnet-start_94.png` |
| 01:17:34 | $79 of $250 | Fable starting; Sonnet running for ~2 min | `billing/2026-09-30_0117_fable-start_79.png` |
| 01:44:30 | $79 of $250 | Sonnet done; Fable running | `billing/2026-09-30_0144_after-sonnet_79.png` |

## Cost: what the readings do and don't show

- Observed: the balance fell $15 between 01:15:30 and 01:17:34, then did not
  move from 01:17:34 to 01:44:30 while Sonnet worked for ~26 more minutes and
  Fable ran alongside it.
- Inference: the page reports usage late and in batches, so the $15 drop most
  likely includes usage from before this run and does not measure Sonnet's
  run. Sonnet's cost is **not yet known**.
- Because Sonnet and Fable overlapped, the balance can only give their
  combined cost: $94 minus a reading taken once both are done and the page has
  caught up, minus any other usage in that window.
- For a clean per-model figure, run Opus alone and read the balance before it
  starts and again after the page has caught up.
