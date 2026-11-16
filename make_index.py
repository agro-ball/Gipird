#!/usr/bin/env python3
"""Пересобирает www/data/images.json по тому, что реально лежит в www/img/."""
import json, os
r = {}
for k in ('icon', 'render', 'mods'):
    d = f'www/img/{k}'
    r[k] = sorted(os.path.splitext(f)[0] for f in os.listdir(d) if f.endswith('.webp')) if os.path.isdir(d) else []
json.dump(r, open('www/data/images.json', 'w'))
print({k: len(v) for k, v in r.items()})
