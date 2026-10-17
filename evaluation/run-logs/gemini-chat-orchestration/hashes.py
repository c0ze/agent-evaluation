import json, sys, hashlib
for it in json.load(open(sys.argv[1])):
    print(hashlib.sha256(it["text"].encode()).hexdigest()[:16])
