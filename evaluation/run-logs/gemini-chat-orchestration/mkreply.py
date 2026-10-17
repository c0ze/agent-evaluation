import json, sys, pathlib
# mkreply.py <out.json> <taskdir> <summary-file> <file1> [file2...]  (rebuild reply record from verified files)
out, task, summ, *files = sys.argv[1:]
items = []
for f in files:
    items += [{"type": "P", "text": f"File: {f}"}, {"type": "code", "text": (pathlib.Path(task) / f).read_text()}]
items.append({"type": "P", "text": pathlib.Path(summ).read_text().rstrip("\n")})
json.dump(items, open(out, "w"), ensure_ascii=False)
