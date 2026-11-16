#!/usr/bin/env python3
"""Собирает www/data/data.json из vehiclesdb.sqlite3 + ru.json.
Запуск: python tools/build_data.py --db vehiclesdb.sqlite3 --ru ru.json
(готовый data.json уже лежит в проекте; нужно только если обновишь базу)"""
import argparse, json, sqlite3, re, os

CATS = {
  'ground': ['light_tank','medium_tank','heavy_tank','tank_destroyer','spaa'],
  'air':    ['fighter','bomber','assault'],
  'heli':   ['attack_helicopter','utility_helicopter'],
  'fleet':  ['boat','barge','heavy_boat','frigate','destroyer','light_cruiser','heavy_cruiser','battlecruiser','battleship'],
}
T2C = {t: c for c, ts in CATS.items() for t in ts}

def pretty(i): return re.sub(r'[_-]+', ' ', i).strip().upper()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', default='vehiclesdb.sqlite3')
    ap.add_argument('--ru', default='ru.json')
    ap.add_argument('--out', default='www/data/data.json')
    a = ap.parse_args()
    ru = json.load(open(a.ru, encoding='utf-8-sig'))
    V, M = ru['vehicles'], ru['modifications']
    con = sqlite3.connect(f'file:{a.db}?mode=ro&immutable=1', uri=True)
    con.row_factory = sqlite3.Row
    out, mods_seen = [], {}
    for r in con.execute('select * from vehicle where is_pack=0'):
        if r['vehicle_type'] not in T2C: continue
        cat = T2C[r['vehicle_type']]
        i = r['identifier']
        ground = cat == 'ground'
        mods = []
        for m in json.loads(r['modifications'] or '[]'):
            n = m['name']
            mods.append({'n': n, 't': m['tier'], 'c': m['mod_class'], 'x': m['req_exp'],
                         'i': os.path.splitext(os.path.basename(m['icon'] or ''))[0],
                         'r': m['required_modification']})
            if n not in mods_seen:
                mods_seen[n] = [M.get(n) or M.get(n + '_short') or pretty(n), M.get(n + '_desc', '')]
        out.append({
            'id': i, 'nat': r['country'], 'cat': cat, 'type': r['vehicle_type'],
            'rank': r['era'],
            'br': [r['arcade_br'], r['realistic_ground_br'] if ground else r['realistic_br'],
                   r['simulator_ground_br'] if ground else r['simulator_br']],
            'prem': int(bool(r['is_premium'])), 'squad': int(bool(r['squadron_vehicle'])),
            'event': r['event'], 'ge': r['ge_cost'], 'xp': r['req_exp'],
            'par': r['required_vehicle'], 'mass': r['mass'], 'crew': r['crew_total_count'],
            'name': V.get(i + '_short') or pretty(i), 'full': V.get(i + '_extended') or V.get(i + '_short') or pretty(i),
            'mods': mods})
    ids = {v['id'] for v in out}
    for v in out:
        if v['par'] not in ids: v['par'] = None
    data = {'vehicles': out, 'mods': mods_seen}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(data, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'vehicles,', len(mods_seen), 'mods ->', a.out)

if __name__ == '__main__': main()
