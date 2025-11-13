#!/usr/bin/env python3
import os
import sys
import json
import urllib.parse
from typing import Any, Dict

try:
    import requests
except ImportError:  # lightweight guidance if missing
    print("Missing dependency: requests. Install with: pip install requests", file=sys.stderr)
    sys.exit(2)


def load_payload(path: str) -> Dict[str, Any]:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, list):
        # allow plain array of rows for convenience
        return {"source_format": "json", "rows": data}
    if isinstance(data, dict) and "rows" in data:
        return data
    raise SystemExit("Input must be an array of rows or an object with a 'rows' array")


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/ingest_era_rows.py <path-to-json>")
        return 1

    base_url = os.getenv("BASE_URL", "http://localhost:5000")
    token = os.getenv("TOKEN")
    era_file_id = os.getenv("ERA_FILE_ID")

    if not token:
        print("TOKEN env var required (JWT)", file=sys.stderr)
        return 2
    if not era_file_id:
        print("ERA_FILE_ID env var required", file=sys.stderr)
        return 2

    payload = load_payload(sys.argv[1])

    url = urllib.parse.urljoin(base_url.rstrip('/') + '/', f"api/era/era-files/{era_file_id}/parse")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code >= 400:
        print(f"Error {resp.status_code}: {resp.text}", file=sys.stderr)
        return 3

    print(json.dumps(resp.json(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
