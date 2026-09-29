"""An HTTP readiness probe using only the Python standard library."""

import json
import sys
from urllib.error import URLError
from urllib.request import urlopen


def main():
    try:
        with urlopen("http://127.0.0.1:5000/health/ready", timeout=8) as response:
            payload = json.load(response)
            return int(response.status != 200 or payload != {"status": "ready"})
    except (URLError, OSError, ValueError):
        return 1


if __name__ == "__main__":
    sys.exit(main())
