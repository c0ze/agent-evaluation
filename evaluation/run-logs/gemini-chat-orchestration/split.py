import json, sys, re, pathlib
# usage: split.py <reply.json> <task-dir>
items = json.load(open(sys.argv[1]))
task = pathlib.Path(sys.argv[2])
pending = None
for it in items:
    if it["type"] == "code":
        if pending is None:
            print("WARN: code block without File: line"); continue
        p = (task / pending).resolve()
        assert str(p).startswith(str(task.resolve())), p
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(it["text"])
        print("wrote", pending, len(it["text"]))
        pending = None
    else:
        m = re.fullmatch(r"\s*File:\s*`?([^`\n]+?)`?\s*", it["text"])
        pending = m.group(1) if m else None
        if not m: print("TEXT:", it["text"][:300])
