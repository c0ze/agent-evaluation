# Haiku 5.5: first launch, stopped by the orchestrator

The first launch of the Haiku 5.5 run (2026-10-11 14:31:17 JST) was stopped after about 30 seconds,
before any task had finished. In headless mode, Bash commands that started with an environment-variable
prefix (for example `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest`) hit permission prompts that
nobody could answer, so they were refused. The other runs didn't have that friction. The run repository
was reset to the template commit, a rule allowing Bash (still inside Claude Code's sandbox) was added,
and all thirteen tasks were relaunched from scratch at 14:32:46. These are the partial event logs from
the stopped launch, kept for the record. None of the stopped launch's work was used.
