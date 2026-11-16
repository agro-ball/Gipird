#!/usr/bin/env python3
"""Берёт ВСЕ картинки из raw_images/ (папки и .zip внутри, любая вложенность),
сопоставляет с техникой по имени файла и кладёт в www/img/ в правильном виде:
  www/img/icon/<id>.webp    маленькая иконка в ветке
  www/img/render/<id>.webp  большая картинка в осмотре
  www/img/mods/<имя>.webp   иконки модификаций
и пишет www/data/images.json (какие картинки реально найдены).
Имя файла = идентификатор техники (a_109_eoa2.png -> вертолёт A-109). Названия
для людей берутся из data.json (русские, из ru.json), а не из имён файлов.
Тип картинки определяется по папке (icon/tree/ветка, render/inspect/осмотр, mod)
или, если по папке не ясно, по ширине: >=250px = render, иначе icon."""
import json, os, sys, zipfile, tempfile, shutil
from PIL import Image

RAW = sys.argv[1] if len(sys.argv) > 1 else 'raw_images'
OUT = 'www/img'
EXT = {'.png', '.jpg', '.jpeg', '.webp'}
KIND_HINTS = {'icon': ['icon', 'tree', 'ветк', 'small', 'tile'],
              'render': ['render', 'inspect', 'осмотр', 'big', 'large', 'view'],
              'mods': ['mod', 'модиф']}

def walk(root):
    for d, _, fs in os.walk(root):
        for f in fs: yield os.path.join(d, f)

def main():
    data = json.load(open('www/data/data.json', encoding='utf-8'))
    vids = {v['id'].lower(): v['id'] for v in data['vehicles']}
    modstems = {m['i'].lower(): m['i'] for v in data['vehicles'] for m in v['mods'] if m['i']}
    tmp = tempfile.mkdtemp()
    n = 0
    for p in list(walk(RAW)):   # распаковать все zip (и zip внутри zip)
        if p.lower().endswith('.zip') and not os.path.basename(p).startswith('pack_'):
            try: zipfile.ZipFile(p).extractall(os.path.join(tmp, str(n))); n += 1
            except Exception as e: print('zip fail', p, e)
    for p in list(walk(tmp)):
        if p.lower().endswith('.zip'):
            try: zipfile.ZipFile(p).extractall(os.path.join(tmp, str(n))); n += 1
            except Exception: pass
    found = {'icon': set(), 'render': set(), 'mods': set()}
    unknown = []
    for root in (RAW, tmp):
        for p in walk(root):
            stem, ext = os.path.splitext(os.path.basename(p))
            if ext.lower() not in EXT: continue
            key = stem.lower()
            path_l = p.lower().replace('\\', '/')
            kind = next((k for k, hs in KIND_HINTS.items() if any(h in path_l for h in hs)), None)
            try: im = Image.open(p)
            except Exception: continue
            if key in vids and kind != 'mods':
                vid = vids[key]
                kind = kind or ('render' if im.width >= 250 else 'icon')
                name = vid
            elif key in modstems and kind in (None, 'mods'):
                kind, name = 'mods', modstems[key]
            else:
                unknown.append(p); continue
            im = im.convert('RGBA')
            if kind == 'render' and im.width > 420:
                im = im.resize((420, round(im.height * 420 / im.width)), Image.LANCZOS)
            dst = os.path.join(OUT, kind, name + '.webp')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst, 'WEBP', quality=76, method=3)
            found[kind].add(name)
    shutil.rmtree(tmp, ignore_errors=True)
    json.dump({k: sorted(v) for k, v in found.items()}, open('www/data/images.json', 'w'))
    print({k: len(v) for k, v in found.items()}, 'не опознано файлов:', len(unknown))
    if unknown: print('примеры не опознанных:', [os.path.basename(u) for u in unknown[:10]])

if __name__ == '__main__': main()
