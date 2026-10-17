import hashlib, sys
print(hashlib.sha256(open(sys.argv[1]).read().rstrip('\n').encode()).hexdigest()[:16])
