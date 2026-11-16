'use strict';
/* ================= настройки баланса (крути под себя) ================= */
const CFG = {
  RS: 0.12,       // стоимость исследования = req_exp из War Thunder * RS (РИ)
  MS: 0.15,       // стоимость модификации = req_exp * MS (боевые РИ)
  GE: 0.10,       // цена премиума в Орлах = ge_cost из WT * GE
  REW: {daily:{easy:100, mid:200, hard:380}, weekly:{mid:700, hard:1300, epic:2500}},
  STREAK_BONUS: 0.01, // +1% к РИ за день стрика (макс 30 дней)
  PREM_MULT: 1.5, KILL_MOD_RP: 12, MINI_RP: 25,
  PREM_DAY_GE: 40
};
const NATS = {usa:'США', germany:'Германия', ussr:'СССР', britain:'Великобритания', japan:'Япония', china:'Китай', italy:'Италия', france:'Франция', sweden:'Швеция', israel:'Израиль'};
const CATN = {ground:'Наземная', air:'Авиация', heli:'Вертолёты', fleet:'Флот'};
const TYPEN = {light_tank:'Лёгкий танк', medium_tank:'Средний танк', heavy_tank:'Тяжёлый танк', tank_destroyer:'ПТ-САУ', spaa:'ЗСУ', fighter:'Истребитель', bomber:'Бомбардировщик', assault:'Штурмовик', attack_helicopter:'Ударный вертолёт', utility_helicopter:'Вертолёт', boat:'Катер', barge:'Баржа', heavy_boat:'Тяжёлый катер', frigate:'Фрегат', destroyer:'Эсминец', light_cruiser:'Лёгкий крейсер', heavy_cruiser:'Тяжёлый крейсер', battlecruiser:'Линейный крейсер', battleship:'Линкор'};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const CATICON = {ground:'🛡️', air:'✈️', heli:'🚁', fleet:'⚓'};
const MCLASS = {firepower:'Огневая мощь', mobility:'Подвижность', protection:'Защита'};

/* ================= состояние ================= */
const KEY = 'wtq_v1';
let S, D = {}, IMG = {icon: new Set(), render: new Set(), mods: new Set()}, QT = {daily: [], weekly: []};
let byId = {}, kids = {};
let ui = {tab: 'tree', nat: 'usa', cat: 'ground'};
let timers = [];

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dstr(new Date());
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
function weekKey() { const d = new Date(); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return dstr(d); }
function rng(seed) { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
function shuffle(arr, r = Math.random) { arr = arr.slice(); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

function fresh() { return {rp: 0, ge: 0, tickets: 1, crates: 0, premUntil: 0, boostUntil: 0, owned: {}, modsDone: {}, modRp: {}, streak: 0, best: 0, lastGood: '', freeDay: '',
  q: {day: '', week: '', daily: [], weekly: [], allDoneDay: ''}, custom: [], stats: {quests: 0, kills: 0, games: 0}}; }
function load() { try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); } }
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

/* ================= данные ================= */
const isTree = v => !v.prem && !v.squad && !v.event;
const hasImg = v => IMG.icon.has(v.id) || IMG.render.has(v.id);
const cost = v => Math.max(50, Math.round(v.xp * CFG.RS / 10) * 10);
const modCost = m => Math.max(10, Math.round(m.x * CFG.MS / 10) * 10);
const gePrice = v => Math.max(50, Math.round((v.ge > 0 ? v.ge : 300 + 200 * v.rank) * CFG.GE / 10) * 10);
const br = v => v.br[1].toFixed(1);
const premActive = () => S.premUntil > Date.now();
const boostActive = () => S.boostUntil > Date.now();
const mult = () => (1 + CFG.STREAK_BONUS * Math.min(S.streak, 30)) * (premActive() ? CFG.PREM_MULT : 1) * (boostActive() ? 1.5 : 1);

function indexData() {
  byId = {}; kids = {};
  D.vehicles.forEach(v => { byId[v.id] = v; });
  D.vehicles.forEach(v => { if (v.par && isTree(v)) (kids[v.par] = kids[v.par] || []).push(v); });
  if (!Object.keys(S.owned).length) D.vehicles.forEach(v => { if (isTree(v) && !v.par && v.rank === 1) S.owned[v.id] = 1; });
}
function rootGate(v) {
  if (v.rank <= 1) return true;
  const peers = D.vehicles.filter(x => isTree(x) && x.nat === v.nat && x.cat === v.cat && x.rank === v.rank - 1);
  const need = Math.min(3, peers.length);
  return peers.filter(x => S.owned[x.id]).length >= need;
}
function status(v) {
  if (S.owned[v.id]) return 'owned';
  if (!isTree(v)) return 'prem';
  if (v.par ? S.owned[v.par] : rootGate(v)) return 'avail';
  return 'locked';
}
function lockReason(v) {
  if (v.par) return 'Сначала исследуй: ' + byId[v.par].name;
  return `Нужно иметь ${Math.min(3, D.vehicles.filter(x => isTree(x) && x.nat === v.nat && x.cat === v.cat && x.rank === v.rank - 1).length)} машин(ы) ${ROMAN[v.rank - 1]} ранга этой ветки`;
}

/* ================= интерфейс: общее ================= */
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2200); }
function res() {
  $('#res').innerHTML = `<b>⭐${Math.floor(S.rp)}</b><b>🦅${S.ge}</b><b>🎫${S.tickets}</b><b>📦${S.crates}</b>${premActive() ? '<b>👑</b>' : ''}`;
}
function clearTimers() { timers.forEach(t => { clearInterval(t); clearTimeout(t); }); timers = []; }
function openSheet(html) {
  closeSheet();
  const b = document.createElement('div'); b.className = 'sheet-back'; b.id = 'back'; b.onclick = closeSheet; document.body.appendChild(b);
  const s = $('#sheet'); s.classList.remove('hidden'); s.innerHTML = `<div style="text-align:right"><button class="btn gray sm" id="cls">Закрыть</button></div>` + html;
  $('#cls').onclick = closeSheet;
}
function closeSheet() { const b = $('#back'); if (b) b.remove(); $('#sheet').classList.add('hidden'); }
function render() { clearTimers(); res(); save(); ({tree: viewTree, quests: viewQuests, games: viewGames, me: viewMe})[ui.tab](); }
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { ui.tab = b.dataset.t; document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('on', x === b)); closeSheet(); render(); $('#view').scrollTop = 0; });

/* ================= ветка техники ================= */
function card(v) {
  const st = status(v);
  const im = IMG.icon.has(v.id) ? `img/icon/${v.id}.webp` : IMG.render.has(v.id) ? `img/render/${v.id}.webp` : '';
  return `<div class="v ${v.prem || !isTree(v) ? 'prem' : ''} ${st === 'prem' ? 'locked' : st}" data-id="${esc(v.id)}">${im ? `<img src="${im}" loading="lazy">` : `<span class="ph">${esc(TYPEN[v.type] || '')}</span>`}${st === 'owned' ? '<span class="tick">✔</span>' : ''}<span class="nm">${esc(v.name)}</span><span class="br">${br(v)}</span></div>`;
}
function viewTree() {
  const nats = Object.keys(NATS).filter(n => D.vehicles.some(v => v.nat === n));
  const cats = Object.keys(CATN).filter(c => D.vehicles.some(v => v.nat === ui.nat && v.cat === c && isTree(v)));
  if (!cats.includes(ui.cat)) ui.cat = cats[0];
  const list = D.vehicles.filter(v => v.nat === ui.nat && v.cat === ui.cat);
  const tree = list.filter(isTree), prem = list.filter(v => !isTree(v));
  /* раскладка по колонкам */
  const roots = tree.filter(v => !v.par).sort((a, b) => a.rank - b.rank || a.br[1] - b.br[1]);
  const col = {}; let nc = 0;
  const place = (v, c) => { col[v.id] = c; (kids[v.id] || []).filter(k => k.nat === v.nat && k.cat === v.cat).sort((a, b) => a.rank - b.rank || a.br[1] - b.br[1]).forEach((k, i) => place(k, i === 0 ? c : nc++)); };
  roots.forEach(r => place(r, nc++));
  const ranks = [...new Set(tree.map(v => v.rank))].sort((a, b) => a - b);
  let h = `<div class="banner"><b>${CATN[ui.cat]} техника</b></div><div class="tabs">${nats.map(n => `<button data-n="${n}" class="${n === ui.nat ? 'on' : ''}">${NATS[n]}</button>`).join('')}</div>
  <div class="tabs sub">${cats.map(c => `<button data-c="${c}" class="${c === ui.cat ? 'on' : ''}">${CATICON[c]} ${CATN[c]}</button>`).join('')}</div>
  <div class="colhead">Исследуемая техника</div><div class="scroll"><div style="min-width:${Math.max(nc, 2) * 162 + 20}px">`;
  ranks.forEach(r => {
    h += `<div class="rank">${ROMAN[r]} ранг</div><div class="row">`;
    for (let c = 0; c < nc; c++) {
      const vs = tree.filter(v => col[v.id] === c && v.rank === r).sort((a, b) => a.br[1] - b.br[1]);
      h += `<div class="col">` + vs.map((v, i) => (i && v.par === vs[i - 1].id ? '<div class="arrow">⬇</div>' : i ? '<div style="height:8px"></div>' : '') + card(v)).join('') + `</div>`;
    }
    h += '</div>';
  });
  h += `</div></div><div class="colhead" style="margin-top:14px">Премиумная и особая техника</div>`;
  const pr = [...new Set(prem.map(v => v.rank))].sort((a, b) => a - b);
  pr.forEach(r => { h += `<div class="rank">${ROMAN[r]} ранг</div><div class="prem-grid">${prem.filter(v => v.rank === r).sort((a, b) => a.br[1] - b.br[1]).map(card).join('')}</div>`; });
  if (!IMG.icon.size && !IMG.render.size) h = `<div class="card">Картинок техники пока нет — положи их в <b>raw_images</b> (см. README). Всё остальное уже работает.</div>` + h;
  $('#view').innerHTML = h;
  document.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { ui.nat = b.dataset.n; render(); });
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { ui.cat = b.dataset.c; render(); });
  document.querySelectorAll('.v').forEach(b => b.onclick = () => openVehicle(b.dataset.id));
}

function openVehicle(id, selMod) {
  const v = byId[id], st = status(v), owned = !!S.owned[id];
  const hero = IMG.render.has(id) ? `<img src="img/render/${id}.webp">` : IMG.icon.has(id) ? `<img src="img/icon/${id}.webp" style="width:70%">` : `<div class="big">${CATICON[v.cat]}</div>`;
  let act = '';
  if (st === 'owned') act = '<div class="sub" style="color:var(--ok)">✔ В ангаре</div>';
  else if (st === 'avail') act = `<button class="btn blue" id="buy" ${S.rp < cost(v) ? 'disabled' : ''}>Исследовать · ⭐${cost(v)}</button><div class="sub">У тебя ⭐${Math.floor(S.rp)}</div>`;
  else if (st === 'prem') act = `<button class="btn" id="buy" ${S.ge < gePrice(v) ? 'disabled' : ''}>Купить · 🦅${gePrice(v)}</button><div class="sub">Премиум/особая техника. У тебя 🦅${S.ge}</div>`;
  else act = `<div class="sub">🔒 ${esc(lockReason(v))}</div>`;
  const done = S.modsDone[id] || {};
  const tiers = [...v.mods].sort((a, b) => a.t - b.t);
  const sel = selMod && v.mods.find(m => m.n === selMod);
  let mh = '';
  if (v.mods.length) {
    mh = `<h3>Модификации</h3><div class="sub">Боевые очки этой машины: ⭐${Math.floor(S.modRp[id] || 0)} (набираются в «Бою»)</div><div class="mods" style="margin-top:8px">` + tiers.map(m => {
      const nm = (D.mods[m.n] || [m.n])[0];
      const ok = !!done[m.n], lock = m.r && !done[m.r];
      const ic = IMG.mods.has(m.i) ? `<img src="img/mods/${m.i}.webp">` : `<div class="mi">⚙</div>`;
      return `<div class="mod ${ok ? 'done' : lock ? 'lock' : ''}" data-m="${esc(m.n)}">${ic}<span>${esc(nm)}</span><span class="sub">ур. ${m.t} · ${ok ? '✔' : '⭐' + modCost(m)}</span></div>`;
    }).join('') + '</div>';
    if (sel) {
      const info = D.mods[sel.n] || [sel.n, ''];
      const lock = sel.r && !done[sel.r];
      mh += `<div class="card" style="margin:12px 0"><b>${esc(info[0])}</b><div class="sub">${MCLASS[sel.c] || sel.c}</div><p style="font-size:14px">${esc(info[1] || 'Описания нет')}</p>` +
        (done[sel.n] ? '<div style="color:var(--ok)">✔ Изучено</div>' : !owned ? '<div class="sub">Сначала получи технику</div>' : lock ? `<div class="sub">Сначала: ${esc((D.mods[sel.r] || [sel.r])[0])}</div>` : `<button class="btn blue" id="rm" ${(S.modRp[id] || 0) < modCost(sel) ? 'disabled' : ''}>Изучить · ⭐${modCost(sel)}</button>`) + '</div>';
    }
  }
  openSheet(`<h2>${esc(v.full)}</h2><div class="sub">${NATS[v.nat]} · ${ROMAN[v.rank]} ранг · ${TYPEN[v.type] || ''}${v.prem ? ' · премиум' : ''}${v.squad ? ' · полковая' : ''}</div>
  <div class="hero">${hero}</div>
  <div class="sub">БР: АБ ${v.br[0].toFixed(1)} · РБ ${v.br[1].toFixed(1)} · СБ ${v.br[2].toFixed(1)} · масса ${v.mass} т · экипаж ${v.crew}</div>
  <div style="margin:10px 0">${act}</div>${mh}`);
  const b = $('#buy'); if (b) b.onclick = () => {
    if (st === 'avail') { S.rp -= cost(v); } else { S.ge -= gePrice(v); }
    S.owned[id] = 1; toast('Получено: ' + v.name); render(); openVehicle(id);
  };
  document.querySelectorAll('.mod').forEach(m => m.onclick = () => openVehicle(id, m.dataset.m));
  const rm = $('#rm'); if (rm) rm.onclick = () => { S.modRp[id] -= modCost(sel); (S.modsDone[id] = S.modsDone[id] || {})[sel.n] = 1; toast('Модификация изучена'); render(); openVehicle(id, sel.n); };
}

/* ================= квесты ================= */
function genQuests() {
  const t = today(), w = weekKey();
  if (S.lastGood && daysBetween(S.lastGood, t) > 1) S.streak = 0;
  if (S.q.day !== t) {
    const r = rng('d' + t), pool = QT.daily.concat(S.custom.filter(c => c.period === 'daily'));
    const take = (tier, n) => shuffle(pool.filter(q => q.tier === tier), r).slice(0, n);
    S.q.daily = [...take('easy', 2), ...take('mid', 2), ...take('hard', 1)].map(q => ({...q, done: false}));
    S.q.day = t;
  }
  if (S.q.week !== w) {
    const r = rng('w' + w), pool = QT.weekly.concat(S.custom.filter(c => c.period === 'weekly'));
    const take = (tier, n) => shuffle(pool.filter(q => q.tier === tier), r).slice(0, n);
    S.q.weekly = [...take('mid', 1), ...take('hard', 1), ...take('epic', 1)].map(q => ({...q, done: false}));
    S.q.week = w;
  }
  if (S.freeDay !== t) { S.freeDay = t; S.tickets += 1; }
}
function reward(q, period) {
  const base = CFG.REW[period][q.tier] || 100, rp = Math.round(base * mult());
  S.rp += rp; let extra = '';
  if (period === 'daily' && q.tier === 'hard') { S.tickets++; extra += ' +🎫'; }
  if (period === 'weekly' && q.tier === 'hard') { S.ge += 10; extra += ' +🦅10'; }
  if (period === 'weekly' && q.tier === 'epic') { S.ge += 25; S.crates++; extra += ' +🦅25 +📦'; }
  S.stats.quests++;
  toast(`+⭐${rp}${extra}`);
  if (period === 'daily') afterDaily();
}
function afterDaily() {
  const t = today(), n = S.q.daily.filter(q => q.done).length;
  if (n >= 2 && S.lastGood !== t) {
    S.streak = S.lastGood && daysBetween(S.lastGood, t) === 1 ? S.streak + 1 : 1;
    S.lastGood = t; S.best = Math.max(S.best, S.streak);
    const m = {3: ['📦', 'crates', 1], 7: ['📦+🦅20', 'crates', 1], 14: ['📦📦+🦅40', 'crates', 2], 30: ['👑 3 дня + 🦅100', 'crates', 3]}[S.streak];
    if (m) {
      S.crates += m[2];
      if (S.streak === 7) S.ge += 20; if (S.streak === 14) S.ge += 40;
      if (S.streak === 30) { S.ge += 100; S.premUntil = Math.max(S.premUntil, Date.now()) + 3 * 864e5; }
      setTimeout(() => toast(`Стрик ${S.streak} дней! Награда: ${m[0]}`), 2300);
    }
  }
  if (S.q.daily.every(q => q.done) && S.q.allDoneDay !== t) { S.q.allDoneDay = t; S.crates++; setTimeout(() => toast('Все ежедневки! +📦'), 2300); }
}
function qrow(q, period, i) {
  const base = CFG.REW[period][q.tier] || 100;
  return `<div class="q ${q.done ? 'done' : ''}" data-p="${period}" data-i="${i}"><div class="chk">${q.done ? '✔' : ''}</div><div><div class="t">${esc(q.text)}<span class="tier ${q.tier}">${{easy: 'лёгкий', mid: 'средний', hard: 'сложный', epic: 'эпик'}[q.tier]}</span></div><div class="r">⭐${Math.round(base * mult())}${period === 'daily' && q.tier === 'hard' ? ' · 🎫' : ''}${period === 'weekly' && q.tier === 'hard' ? ' · 🦅10' : ''}${period === 'weekly' && q.tier === 'epic' ? ' · 🦅25 · 📦' : ''}</div></div></div>`;
}
function viewQuests() {
  genQuests(); save();
  const nd = S.q.daily.filter(q => q.done).length;
  $('#view').innerHTML = `<div class="grid2" style="margin-top:12px"><div class="stat"><b>🔥 ${S.streak}</b><span>стрик (рекорд ${S.best})</span></div><div class="stat"><b>×${mult().toFixed(2)}</b><span>множитель РИ</span></div></div>
  <div class="h">Ежедневные <span class="sub">(${nd}/${S.q.daily.length}) — для стрика нужно минимум 2</span></div>${S.q.daily.map((q, i) => qrow(q, 'daily', i)).join('')}
  <div class="h">Еженедельные</div>${S.q.weekly.map((q, i) => qrow(q, 'weekly', i)).join('')}
  <div class="card"><b>Свой квест</b><input id="nq" placeholder="Например: помыть машину"><select id="np"><option value="daily">Ежедневный (в пул)</option><option value="weekly">Еженедельный (в пул)</option></select><select id="nt"><option value="easy">Лёгкий</option><option value="mid">Средний</option><option value="hard">Сложный</option><option value="epic">Эпик (только для недели)</option></select><label class="sub"><input type="checkbox" id="now" style="width:auto"> Добавить сразу в текущий список</label><br><button class="btn blue" id="addq">Добавить</button></div>`;
  document.querySelectorAll('.q').forEach(e => e.onclick = () => {
    const q = S.q[e.dataset.p][e.dataset.i]; if (q.done) return toast('Уже выполнено');
    q.done = true; reward(q, e.dataset.p); render();
  });
  $('#addq').onclick = () => {
    const text = $('#nq').value.trim(); if (!text) return toast('Впиши текст');
    const q = {id: 'c' + Date.now(), text, tier: $('#nt').value, period: $('#np').value};
    S.custom.push(q); if ($('#now').checked) S.q[q.period === 'daily' ? 'daily' : 'weekly'].push({...q, done: false});
    toast('Добавлено'); render();
  };
}

/* ================= мини-игры ================= */
function viewGames() {
  const withImg = D.vehicles.filter(hasImg);
  $('#view').innerHTML = `<div class="card"><b>Билеты 🎫 ${S.tickets}</b><div class="sub">+1 каждый день, плюс за сложные ежедневки и ящики. Одна игра = 1 билет.</div></div>
  <div class="card"><b>🌑 Угадай по силуэту</b><div class="sub">Видишь тень — выбери название из 3. 5 раундов, за верный +⭐${CFG.MINI_RP}</div><button class="btn blue" id="g1">Играть</button></div>
  <div class="card"><b>🌍 Нация и название</b><div class="sub">Сначала нация, потом название. Любая техника: танки, авиация, флот. Полный балл — +⭐${CFG.MINI_RP + 10}</div><button class="btn blue" id="g2">Играть</button></div>
  <div class="card"><b>💥 Бой (модификации)</b><div class="sub">Тапай по мишеням, не дай им добежать. Убийства дают боевые очки твоей машине — на них изучаются модификации. Погиб — выбери другую машину.</div><button class="btn" id="g3">В бой</button></div>
  ${withImg.length < 8 ? '<div class="card sub">Для игр на картинках нужны минимум 8 картинок техники (положи в raw_images).</div>' : ''}`;
  const need = () => { if (S.tickets < 1) { toast('Нет билетов 🎫'); return false; } return true; };
  $('#g1').onclick = () => { if (withImg.length < 8) return toast('Мало картинок'); if (need()) { S.tickets--; guess({shadow: true, nation: false}); } };
  $('#g2').onclick = () => { if (withImg.length < 8) return toast('Мало картинок'); if (need()) { S.tickets--; guess({shadow: false, nation: true}); } };
  $('#g3').onclick = () => { if (need()) battlePick(); };
}
function guess(o) {
  const pool = D.vehicles.filter(hasImg), rounds = shuffle(pool).slice(0, 5); let i = 0, pts = 0, perfect = 0;
  res();
  const next = () => {
    if (i >= rounds.length) {
      const rp = pts; S.rp += rp; S.stats.games++;
      if (perfect === rounds.length) { S.crates++; }
      $('#view').innerHTML = `<div class="card"><h2>Итог: ${perfect}/${rounds.length}</h2><p>+⭐${rp}${perfect === rounds.length ? ' и +📦 за идеал!' : ''}</p><button class="btn blue" id="back2">Назад</button></div>`;
      $('#back2').onclick = () => { ui.tab = 'games'; render(); }; res(); save(); return;
    }
    const v = rounds[i], src = IMG.render.has(v.id) ? `img/render/${v.id}.webp` : `img/icon/${v.id}.webp`;
    const sameCat = pool.filter(x => x.id !== v.id && x.cat === v.cat && x.name !== v.name);
    const names = shuffle([v, ...shuffle(sameCat.length > 5 ? sameCat : pool.filter(x => x.id !== v.id && x.name !== v.name)).slice(0, 2)]);
    const nats = shuffle([v.nat, ...shuffle(Object.keys(NATS).filter(n => n !== v.nat)).slice(0, 3)]);
    let stage = o.nation ? 'nat' : 'name', score = 0;
    const draw = () => {
      const opts = stage === 'nat' ? nats.map(n => [n, NATS[n]]) : names.map(x => [x.id, x.name]);
      $('#view').innerHTML = `<div class="card"><div class="sub">Раунд ${i + 1}/${rounds.length} · верно ${perfect}</div><div class="bar"><i style="width:${i / rounds.length * 100}%"></i></div><div class="sil"><img class="${o.shadow ? 'sh' : ''}" id="gi" src="${src}"></div><b>${stage === 'nat' ? 'Какая нация?' : 'Как называется?'}</b><div class="opts">${opts.map(x => `<button class="opt" data-k="${esc(x[0])}">${esc(x[1])}</button>`).join('')}</div></div>`;
      document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const right = stage === 'nat' ? v.nat : v.id, good = b.dataset.k === right;
        document.querySelectorAll('.opt').forEach(x => { x.onclick = null; if (x.dataset.k === right) x.classList.add('good'); });
        if (!good) b.classList.add('bad'); else score += 1;
        if (o.shadow) $('#gi').classList.remove('sh');
        const t = setTimeout(() => {
          if (stage === 'nat') { stage = 'name'; draw(); return; }
          const total = o.nation ? 2 : 1;
          pts += Math.round(score / total * (CFG.MINI_RP + (o.nation ? 10 : 0)));
          if (score === total) perfect++;
          i++; next();
        }, 900); timers.push(t);
      });
    };
    draw();
  };
  next();
}
function battlePick(lost) {
  const owned = D.vehicles.filter(v => S.owned[v.id]);
  const opts = shuffle(owned).slice(0, 6);
  $('#view').innerHTML = `<div class="card"><b>${lost ? 'Машина уничтожена. Выбери другую:' : 'Выбери машину для боя'}</b><div class="opts">${opts.map(v => `<button class="opt" data-id="${esc(v.id)}">${esc(v.name)} <span class="sub">${ROMAN[v.rank]} · ${br(v)}</span></button>`).join('')}</div></div>`;
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => battle(b.dataset.id));
  if (!lost) { battle.state = {spawns: 3, kills: 0, time: 45}; }
}
function battle(id) {
  const B = battle.state, v = byId[id]; let hp = 100, over = false;
  $('#view').innerHTML = `<div class="card" style="margin-bottom:0"><b>${esc(v.name)}</b> <span class="sub" id="bs"></span><div class="bar"><i id="hp" style="width:100%;background:var(--ok)"></i></div></div><div class="arena" id="ar"></div>`;
  const ar = $('#ar'), upd = () => { $('#bs').textContent = `Убийств: ${B.kills} · время ${B.time}с · жизней ${B.spawns}`; $('#hp').style.width = Math.max(hp, 0) + '%'; };
  upd();
  const end = () => {
    over = true; clearTimers();
    const rp = B.kills * CFG.KILL_MOD_RP; S.modRp[id] = (S.modRp[id] || 0) + rp; S.stats.kills += B.kills; S.stats.games++;
    $('#view').innerHTML = `<div class="card"><h2>Бой окончен</h2><p>Убийств: ${B.kills}<br>Боевые очки для ${esc(v.name)}: +⭐${rp}</p><button class="btn blue" id="b2">Назад</button></div>`;
    $('#b2').onclick = () => { ui.tab = 'games'; render(); }; save();
  };
  timers.push(setInterval(() => { if (over) return; B.time--; upd(); if (B.time <= 0) end(); }, 1000));
  const spawn = () => {
    if (over) return;
    const t = document.createElement('div'); t.className = 'tg'; t.textContent = '🎯';
    t.style.left = Math.random() * (ar.clientWidth - 60) + 'px'; t.style.top = Math.random() * (ar.clientHeight - 50) + 'px';
    let alive = true;
    t.onclick = e => { e.stopPropagation(); if (!alive || over) return; alive = false; B.kills++; t.remove(); upd(); };
    ar.appendChild(t);
    timers.push(setTimeout(() => { if (!alive || over) return; alive = false; t.remove(); hp -= 20; upd();
      if (hp <= 0) { B.spawns--; clearTimers(); if (B.spawns <= 0) { end(); } else battlePick(true); } }, 1800));
  };
  timers.push(setInterval(spawn, 850));
}

/* ================= склад / профиль ================= */
function openCrate() {
  if (S.crates < 1) return toast('Нет ящиков');
  S.crates--; const r = Math.random(); let msg;
  if (r < 0.03) {
    const av = D.vehicles.filter(v => isTree(v) && status(v) === 'avail');
    if (av.length) { const v = pick(av); S.owned[v.id] = 1; msg = '🎉 Техника: ' + v.name + '!'; } else { S.rp += 500; msg = '+⭐500'; }
  } else if (r < 0.10) { const g = 5 + Math.floor(Math.random() * 11); S.ge += g; msg = `+🦅${g}`; }
  else if (r < 0.20) { S.boostUntil = Math.max(S.boostUntil, Date.now()) + 864e5; msg = '⚡ Буст ×1.5 РИ на 24 часа'; }
  else if (r < 0.40) { const t = 1 + Math.floor(Math.random() * 2); S.tickets += t; msg = `+🎫${t}`; }
  else { const p = 200 + Math.floor(Math.random() * 400); S.rp += p; msg = `+⭐${p}`; }
  toast(msg); render();
}
function viewMe() {
  const own = D.vehicles.filter(v => S.owned[v.id]).length, tot = D.vehicles.length;
  const left = ms => ms > 0 ? `${Math.ceil(ms / 36e5)} ч` : 'нет';
  $('#view').innerHTML = `<div class="grid2" style="margin-top:12px"><div class="stat"><b>${own}</b><span>техники из ${tot}</span></div><div class="stat"><b>🔥 ${S.streak}</b><span>стрик</span></div><div class="stat"><b>${S.stats.quests}</b><span>квестов</span></div><div class="stat"><b>${S.stats.kills}</b><span>убийств в боях</span></div></div>
  <div class="card"><b>📦 Ящики: ${S.crates}</b><div class="sub">Награды за стрик и квесты. Внутри: РИ, билеты, орлы, буст и очень редко техника.</div><button class="btn" id="oc">Открыть ящик</button></div>
  <div class="card"><b>👑 Премиум: ${left(S.premUntil - Date.now())}</b> · <b>⚡ Буст: ${left(S.boostUntil - Date.now())}</b><div class="sub">Премиум даёт ×${CFG.PREM_MULT} к РИ с квестов.</div><button class="btn blue" id="pd" ${S.ge < CFG.PREM_DAY_GE ? 'disabled' : ''}>Премиум на 1 день · 🦅${CFG.PREM_DAY_GE}</button></div>
  <div class="card"><b>Сохранение</b><div class="sub">Прогресс хранится в телефоне. Скопируй код, чтобы перенести.</div><button class="btn gray sm" id="ex">Скопировать код</button><textarea id="im" rows="2" placeholder="Вставь код сюда для загрузки"></textarea><button class="btn gray sm" id="imb">Загрузить</button> <button class="btn gray sm" id="rs">Сброс</button></div>`;
  $('#oc').onclick = openCrate;
  $('#pd').onclick = () => { S.ge -= CFG.PREM_DAY_GE; S.premUntil = Math.max(S.premUntil, Date.now()) + 864e5; render(); };
  $('#ex').onclick = () => { const t = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); navigator.clipboard && navigator.clipboard.writeText(t); toast('Код скопирован'); };
  $('#imb').onclick = () => { try { S = Object.assign(fresh(), JSON.parse(decodeURIComponent(escape(atob($('#im').value.trim()))))); toast('Загружено'); render(); } catch (e) { toast('Неверный код'); } };
  $('#rs').onclick = () => { if (confirm('Стереть весь прогресс?')) { S = fresh(); indexData(); render(); } };
}

/* ================= запуск ================= */
async function init() {
  load();
  const j = async u => { try { return await (await fetch(u)).json(); } catch (e) { return null; } };
  D = await j('data/data.json'); const im = await j('data/images.json'); const q = await j('data/quests.json');
  if (!D) { $('#view').innerHTML = '<div class="card">Нет data/data.json</div>'; return; }
  if (im) IMG = {icon: new Set(im.icon), render: new Set(im.render), mods: new Set(im.mods)};
  if (q) QT = q;
  indexData(); genQuests(); render();
}
init();
