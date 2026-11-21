(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- state (persisted per browser so the demo survives reloads) ----------
  const DEFAULT = { quitAt: Date.now() - (3 * 86400 + 151) * 1000, xp: 50, shields: 1, plant: 48, slips: 0, best: 3, cpd: 20, price: 3.37, read: [], notifRead: [], checkin: '', watch: true, prefs: { remind: true, daily: true } };
  let st;
  try { st = { ...DEFAULT, ...JSON.parse(localStorage.getItem('quit-demo') || '{}') }; } catch (e) { st = { ...DEFAULT }; }
  const save = () => { try { localStorage.setItem('quit-demo', JSON.stringify(st)); } catch (e) {} };

  // keep the 393×852 frame from the design; scale it down as a whole in short windows
  const fit = () => {
    const s = innerWidth <= 500 ? 1 : Math.min(1, (innerHeight - 48) / 852, (innerWidth - 48) / 393);
    document.documentElement.style.setProperty('--fit', s.toFixed(4));
  };
  fit(); addEventListener('resize', fit);
  // the frame itself must never scroll (browsers may scroll it to reveal a focused off-screen sheet)
  const phoneEl = document.getElementById('phone');
  phoneEl.addEventListener('scroll', () => { if (phoneEl.scrollTop || phoneEl.scrollLeft) { phoneEl.scrollTop = 0; phoneEl.scrollLeft = 0; } });

  // ---------- shared chrome ----------
  const statusBar = `
    <img class="sb-time" src="assets/sb-time.svg" alt="">
    <img class="sb-signal" src="assets/sb-signal.svg" alt="">
    <img class="sb-wifi" src="assets/sb-wifi.svg" alt="">
    <img class="sb-battery" src="assets/sb-battery.svg" alt="">
    <img class="sb-battery-cap" src="assets/sb-battery-cap.svg" alt="">
    <img class="sb-battery-fill" src="assets/sb-battery-fill.svg" alt="">`;
  $$('[data-sb]').forEach(el => { el.innerHTML = statusBar; el.setAttribute('aria-hidden', 'true'); });
  const hdrIcons = `
    <span class="streak" aria-label="Streak in days"><img src="assets/fire.svg" alt=""><span data-bind="streak">3</span></span>
    <button class="bell" data-go="notifications" aria-label="Notifications"><img src="assets/bell.svg" alt=""></button>`;
  $$('[data-hdr-icons]').forEach(el => { el.innerHTML = hdrIcons; });

  // ---------- week calendar ----------
  const week = [['Mo', 2, 'done'], ['Tu', 3, 'done'], ['We', 3, 'today'], ['Th', 4], ['Fr', 5], ['Sa', 6], ['Su', 7]];
  $('#week').innerHTML = week.map(([d, n, s]) => `
    <div class="day ${s || ''}" ${s === 'today' ? 'aria-current="date"' : ''}>
      <span class="day-lbl">${d}</span>
      <span class="day-num">${n}<img src="assets/${s === 'done' ? 'dot-done' : 'dot-future'}.svg" alt=""></span>
    </div>`).join('');

  // ---------- health timeline ----------
  const timeline = [
    [20 * 60, '20 minutes', 'Heart rate normalizes', 'Heart rate and blood pressure drop to their resting baseline.'],
    [8 * 3600, '8 hours', 'Oxygen begins returning', 'Carbon monoxide in blood starts dropping; oxygen levels begin rising back to normal.'],
    [12 * 3600, '12 hours', 'Carbon monoxide clears', 'Carbon monoxide level in the blood fully normalizes.'],
    [24 * 3600, '24 hours', 'Heart attack risk drops', 'Risk of a heart attack begins to decrease.'],
    [48 * 3600, '48 hours', 'Senses sharpen', 'Nerve endings start to regrow; sense of smell and taste noticeably improve.'],
    [72 * 3600, '72 hours', 'Nicotine fully gone', 'Nicotine is fully out of the body; breathing starts to feel easier.'],
    [14 * 86400, '2 weeks', 'Circulation improves', 'Risk of a heart attack begins to decrease.']
  ];
  function renderTimeline(sec) {
    $('#timeline').innerHTML = timeline.map(([t, when, title, sub], i) => {
      const last = i === timeline.length - 1, future = sec < t;
      const line = last ? '' : `<span class="tl-line"><img src="assets/${i === 3 ? 'tl-line-short' : 'tl-line'}.svg" alt=""></span>`;
      return `<div class="tl ${future ? 'future' : ''}">
        <div class="tl-ic" style="${last ? 'gap:0' : ''}"><span class="tl-dot"><i></i></span>${line}</div>
        <div class="tl-t"><p class="t-xs c-primary tl-when">${when}</p><div><p class="t-m tl-title">${title}</p><p class="t-xsr c-500 tl-sub">${sub}</p></div></div>
      </div>`;
    }).join('');
  }

  // ---------- journey stages ----------
  const stages = [
    ['flush', 'Flush', 'Nicotine starts leaving your system', 'Day 0 - 1', 0, 1],
    ['detox', 'Detox', 'Body clears nicotine, cravings peak', 'Day 1 - 7', 1, 7],
    ['repair', 'Repair', 'Senses and circulation improve', 'Day 7 - 21', 7, 21],
    ['stabilize', 'Stabilize', 'New habits take hold', 'Day 21 - 60', 21, 60],
    ['freedom', 'Freedom', 'Nicotine-free for good', 'Day 60+', 60, Infinity]
  ];
  function renderStages(days) {
    $('#stages').innerHTML = stages.map(([k, name, sub, range, a, b]) => {
      const s = days >= b ? 'done' : days >= a ? 'now' : '';
      const label = s === 'done' ? 'Completed' : s === 'now' ? 'In progress' : '';
      return `<div class="stage ${s}">
        <div class="stage-l"><img src="assets/stage-${k}.png" alt=""><div><p class="t-m">${name}</p><p class="t-xsr c-500">${sub}</p></div></div>
        <div class="stage-r"><span class="pill">${range}</span>${label ? `<span class="stage-st">${label}</span>` : ''}</div>
      </div>`;
    }).join('');
  }

  // ---------- live numbers ----------
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    const sec = Math.max(0, Math.floor((Date.now() - st.quitAt) / 1000));
    const days = Math.floor(sec / 86400), rem = sec % 86400;
    const set = (k, v) => $$(`[data-bind="${k}"]`).forEach(e => { if (e.textContent !== String(v)) e.textContent = v; });
    set('days', days);
    set('streak', days);
    set('clock', `${pad(Math.floor(rem / 3600))}:${pad(Math.floor(rem % 3600 / 60))}:${pad(rem % 60)}`);
    // 20 cigarettes/day, $3.37 a pack, 11 min of life per cigarette (values from the design)
    const cigs = Math.round(sec / 86400 * 41.3 * st.cpd / 20);
    set('notSmoked', cigs);
    set('saved', '$' + Math.round(cigs / 20 * st.price * 2.01));
    set('lifeBack', Math.round(cigs * 5.5 / 60) + 'h');
    set('xp', st.xp + ' XP');
    set('xpNum', st.xp);
    set('best', Math.max(st.best, days));
    set('cpd', st.cpd);
    set('price', '$' + st.price.toFixed(2).replace('.', ','));
    set('since', 'Smoke-free since ' + new Date(st.quitAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    set('shields', st.shields);
    const untilRepair = Math.max(0, 7 - days);
    set('untilRepair', days < 7 ? `${untilRepair} day${untilRepair === 1 ? '' : 's'} until Repair` : 'Repair reached');
    return { sec, days };
  }
  let renderAll = function () {
    const { sec, days } = tick();
    renderTimeline(sec);
    renderStages(days);
    $$('[data-bind-width="plant"]').forEach(e => e.style.width = Math.min(100, st.plant / 3.2) + '%');
    $$('[data-bind-width="reward"]').forEach(e => e.style.width = Math.min(100, st.xp / 3.33) + '%');
    $$('[data-bind="achieved"]').forEach(e => e.textContent = Math.min(100, Math.round(st.xp / 3.125)) + '%');
  };
  renderAll();
  setInterval(tick, 1000);

  // ---------- navigation ----------
  const nav = $('#nav');
  const tabs = { home: 'home', progress: 'chart', pause: 'pause', library: 'book', profile: 'user' };
  const iconSrc = (k, on) => `assets/nav-${k}${on ? '-active' : ''}.svg`;
  const history = [];
  let current = 'home';
  function go(id, opts = {}) {
    const target = $('#' + id); if (!target) return;
    closeSheets();
    if (!opts.back && id !== current) history.push(current);
    if (tabs[id]) history.length = 0;
    current = id;
    $$('.screen').forEach(s => { s.hidden = s.id !== id; });
    target.scrollTop = 0;
    const detail = target.classList.contains('detail');
    nav.hidden = detail;
    $('#aiFab').hidden = !['home', 'progress', 'library'].includes(id);
    const activeTab = tabs[id] || null;
    Object.values(tabs).forEach(k => { const im = $(`[data-icon="${k}"]`); if (im) im.src = iconSrc(k, k === activeTab); });
    nav.classList.toggle('on-pause', id === 'pause');
    $$('.nav [data-go]').forEach(b => b.toggleAttribute('aria-current', b.dataset.go === id));
    if (id !== 'pause') stopBreath();
    if (id === 'chat') startChat();
  }
  function back() { go(history.pop() || 'home', { back: true }); }

  // ---------- toast ----------
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- bottom sheets ----------
  const scrim = $('#scrim');
  let lastFocus = null;
  function openSheet(name) {
    $$('.sheet.open').forEach(s => { s.classList.remove('open'); s.hidden = true; });
    const sh = $('#sheet-' + name);
    if (!sh) return;
    if (!lastFocus) lastFocus = document.activeElement;
    scrim.hidden = false; sh.hidden = false;
    requestAnimationFrame(() => { scrim.classList.add('open'); sh.classList.add('open'); sh.querySelector('[data-close]').focus({ focusVisible: false }); });
  }
  function closeSheets() {
    scrim.classList.remove('open');
    $$('.sheet').forEach(s => s.classList.remove('open'));
    setTimeout(() => { if (!scrim.classList.contains('open')) { scrim.hidden = true; $$('.sheet').forEach(s => { if (!s.classList.contains('open')) s.hidden = true; }); } }, 300);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
    resetTriggers();
  }
  scrim.addEventListener('click', closeSheets);
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (scrim.classList.contains('open')) closeSheets(); else if ($('#' + current).classList.contains('detail')) back(); });

  // triggers: Continue becomes active once something is chosen (as in the design)
  const trigBtn = $('#trigContinue');
  function resetTriggers() { $$('.trig').forEach(b => b.setAttribute('aria-pressed', 'false')); trigBtn.disabled = true; }
  $('#triggers').addEventListener('click', e => {
    const b = e.target.closest('.trig'); if (!b) return;
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    trigBtn.disabled = !$$('.trig[aria-pressed="true"]').length;
  });
  trigBtn.addEventListener('click', () => {
    st.lastTriggers = $$('.trig[aria-pressed="true"]').map(b => b.textContent);
    if (st.shields > 0) openSheet('shield'); else resetStreak();
  });

  function resetStreak() {
    st.best = Math.max(st.best, Math.floor((Date.now() - st.quitAt) / 86400000));
    st.quitAt = Date.now(); st.slips++;
    st.journal.unshift({ t: Date.now(), type: 'slip', text: 'Slip · streak reset · ' + (st.lastTriggers || []).join(', '), triggers: st.lastTriggers || [] }); save();
    renderAll(); go('home');
    toast('Streak reset. Your history is saved — day one starts now.');
  }

  // ---------- breathing exercise ----------
  const patterns = {
    box: { steps: [['Breathe in', 4, 1.12], ['Hold', 4, 1.12], ['Breathe out', 4, .9], ['Hold', 4, .9]], idle: '4 seconds' },
    '478': { steps: [['Breathe in', 4, 1.12], ['Hold', 7, 1.12], ['Breathe out', 8, .9]], idle: '4 · 7 · 8 seconds' },
    meditate: { steps: [['Notice your breath', 6, 1.05], ['Let it go', 6, .95]], idle: 'Close your eyes' }
  };
  let mode = 'box', timer = null, left = 180, stepI = 0, stepLeft = 0;
  const breath = $('#breath'), orb = $('#orb');
  const fmt = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  function setMode(m) {
    mode = patterns[m] ? m : 'box';
    $$('#breathTabs .tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
    stopBreath();
  }
  function stopBreath() {
    clearInterval(timer); timer = null; left = 180;
    breath.classList.remove('running');
    orb.style.transform = '';
    $('#tTime').textContent = fmt(left);
    $('#tPhase').textContent = patterns[mode].idle;
  }
  function applyStep() {
    const [label, dur, scale] = patterns[mode].steps[stepI];
    stepLeft = dur;
    orb.style.transitionDuration = dur + 's';
    orb.style.transform = `scale(${scale})`;
    $('#tPhase').textContent = `${label} · ${dur} seconds`;
  }
  function startBreath() {
    breath.classList.add('running'); stepI = 0; applyStep();
    timer = setInterval(() => {
      left--; stepLeft--;
      $('#tTime').textContent = fmt(left);
      if (left <= 0) { stopBreath(); toast('3 minutes done — the craving wave usually passes by now.'); return; }
      if (stepLeft <= 0) { stepI = (stepI + 1) % patterns[mode].steps.length; applyStep(); }
    }, 1000);
  }
  $('#play').addEventListener('click', startBreath);
  orb.addEventListener('click', () => { if (timer) stopBreath(); });
  $('#breathTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setMode(t.dataset.mode); });

  // companion carousel: swipe / trackpad scroll, mouse drag, dots
  const mTrack = $('#mTrack'), mDots = $$('#mDots button');
  const mIndex = () => Math.round(mTrack.scrollLeft / mTrack.clientWidth);
  const mGo = i => mTrack.scrollTo({ left: i * mTrack.clientWidth, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
  mTrack.addEventListener('scroll', () => { const i = mIndex(); mDots.forEach((d, k) => d.classList.toggle('on', k === i)); }, { passive: true });
  mDots.forEach((d, k) => d.addEventListener('click', () => mGo(k)));
  mTrack.addEventListener('keydown', e => { if (e.key === 'ArrowRight') mGo(Math.min(2, mIndex() + 1)); if (e.key === 'ArrowLeft') mGo(Math.max(0, mIndex() - 1)); });
  let dragX = null, dragS = 0, dragged = false;
  mTrack.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; e.preventDefault(); dragX = e.clientX; dragS = mTrack.scrollLeft; dragged = false; });
  window.addEventListener('pointermove', e => { if (dragX === null) return; const dx = e.clientX - dragX; if (Math.abs(dx) > 4) { dragged = true; mTrack.classList.add('drag'); } mTrack.scrollLeft = dragS - dx; });
  window.addEventListener('pointerup', () => { if (dragX === null) return; dragX = null; mTrack.classList.remove('drag'); mGo(mIndex()); });
  mTrack.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);

  // chart tabs (visual state only — the design has one chart)
  $('#chartTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    $$('#chartTabs .tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
  });

  // ---------- global click routing ----------
  document.addEventListener('click', e => {
    if (e.target.closest('[data-back]')) { back(); return; }
    const story = e.target.closest('[data-story]');
    if (story) { openStory(+story.dataset.story); return; }
    const fr = e.target.closest('[data-friend]');
    if (fr) { closeSheets(); toast(`In the app this opens your chat with ${fr.dataset.friend}, message ready to send.`); return; }
    const stp = e.target.closest('[data-step]');
    if (stp) { const k = stp.dataset.step, d = +stp.dataset.d; st[k] = k === 'cpd' ? Math.max(1, Math.min(60, st[k] + d)) : Math.max(1, Math.round((st[k] + d) * 100) / 100); save(); renderAll(); return; }
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { go(goBtn.dataset.go); if (goBtn.dataset.mode) setMode(goBtn.dataset.mode); return; }
    const sh = e.target.closest('[data-sheet]');
    if (sh) { openSheet(sh.dataset.sheet); return; }
    if (e.target.closest('[data-close]')) { closeSheets(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
      case 'madeit':
        st.xp += 10; log('craving', 'Craving passed · ' + ({ box: 'Box breathing', '478': '4-7-8 breathing', meditate: 'Meditation' }[mode])); save(); renderAll(); stopBreath();
        openSheet('success');
        break;
      case 'useShield':
        st.shields = Math.max(0, st.shields - 1); st.slips++;
        st.journal.unshift({ t: Date.now(), type: 'slip', text: 'Slip · shield used · ' + (st.lastTriggers || []).join(', '), triggers: st.lastTriggers || [] }); save(); renderAll(); go('home');
        toast('Shield applied — your streak stays.');
        break;
      case 'resetStreak': resetStreak(); break;
      case 'companion': go('progress'); break;
      case 'water': st.plant = Math.min(320, st.plant + 16); st.xp += 2; save(); renderAll(); toast('Watered! Your succulent is growing · +2 XP'); break;
      case 'editProfile': openProfileEdit(); break;
      case 'photo': toast('Photo upload isn’t part of this prototype.'); break;
      case 'watch': st.watch = !st.watch; save(); renderAll(); toast(st.watch ? 'Watch connected — heart rate and steps show on Home.' : 'Watch disconnected.'); break;
      case 'resetDemo': try { localStorage.removeItem('quit-demo'); } catch (err) {} location.reload(); break;
      case 'grow': toast('Add a companion — coming soon.'); break;
      default: toast('This section isn’t in the test task yet.');
    }
  });

  // ================= journal (auto-logged by every flow) =================
  st.journal = st.journal || [
    { t: Date.now() - 26 * 3600e3, type: 'craving', text: 'Craving passed · Box breathing' },
    { t: Date.now() - 50 * 3600e3, type: 'checkin', text: 'Check-in · Okay · craving 6/10 · Restless' }
  ];
  function log(type, text) { st.journal.unshift({ t: Date.now(), type, text }); st.journal = st.journal.slice(0, 60); save(); }
  const jIcon = { craving: 'ic-wind', slip: 'fire', checkin: 'heart', shield: 'ic-reward', story: 'ic-book' };
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d === 1 ? 'Yesterday' : d + ' days ago'; };
  function renderJournal() {
    const passed = st.journal.filter(j => j.type === 'craving').length;
    const trig = {}; st.journal.filter(j => j.type === 'slip').forEach(j => (j.triggers || []).forEach(x => trig[x] = (trig[x] || 0) + 1));
    const top = Object.entries(trig).sort((a, b) => b[1] - a[1])[0];
    $$('[data-bind="jPassed"]').forEach(e => e.textContent = passed);
    $$('[data-bind="jTrigger"]').forEach(e => e.textContent = top ? top[0] : '—');
    $('#journalList').innerHTML = st.journal.length ? st.journal.map(j => `
      <div class="card j-i"><span class="n-ic ${j.type === 'slip' ? 'amber' : ''}"><img src="assets/${jIcon[j.type] || 'heart'}.svg" alt=""></span>
        <div class="n-t"><p class="t-m">${esc(j.text)}</p><p class="t-xsr c-500">${ago(j.t)}</p></div></div>`).join('')
      : '<p class="empty t-sr">Nothing here yet. Cravings you get through are saved automatically.</p>';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ================= notifications =================
  const notifs = [
    ['n1', 'Today', 'fire', '', '3 days smoke-free', 'Nicotine is now out of your body. Breathing gets easier from here.', '2 h ago', 'progress'],
    ['n2', 'Today', 'ic-water', '', 'Your succulent is thirsty', 'Water it on Progress to keep it growing.', '5 h ago', 'progress'],
    ['n3', 'Yesterday', 'ic-reward', 'amber', '+50 XP earned', 'You got through 5 cravings. 50 more XP unlocks a Streak Shield.', 'Yesterday', 'rewards'],
    ['n4', 'Yesterday', 'heart', '', 'Daily Check-In', 'How are you feeling today? It takes 30 seconds.', 'Yesterday', 'checkin'],
    ['n5', 'Earlier', 'heart', '', 'Heart attack risk drops', 'You passed the 24-hour milestone on your Health Timeline.', '2 days ago', 'progress'],
    ['n6', 'Earlier', 'ic-companion', '', 'Welcome to your quit journey', 'Sprout will grow with you. Tap Pause whenever a craving hits.', '3 days ago', 'home']
  ];
  function renderNotifs() {
    const unread = notifs.filter(n => !st.notifRead.includes(n[0])).length;
    $$('.bell').forEach(b => { b.classList.toggle('has-new', unread > 0); b.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications'); });
    const groups = [...new Set(notifs.map(n => n[1]))];
    $('#notifList').innerHTML = groups.map(g => `<div class="n-group"><p class="t-s c-500">${g}</p>${notifs.filter(n => n[1] === g).map(([id, , ic, tone, t, d, when]) => `
      <button class="card notif ${st.notifRead.includes(id) ? 'read' : ''}" data-notif="${id}">
        <span class="n-ic ${tone}"><img src="assets/${ic}.svg" alt=""></span>
        <span class="n-t"><span class="t-m c-ink">${t}</span><span class="t-xsr c-500">${d}</span></span>
        <span class="n-meta"><span class="t-xsr c-500" style="white-space:nowrap">${when}</span><span class="n-dot" aria-label="${st.notifRead.includes(id) ? '' : 'unread'}"></span></span>
      </button>`).join('')}</div>`).join('');
  }
  $('#notifList').addEventListener('click', e => {
    const b = e.target.closest('[data-notif]'); if (!b) return;
    const n = notifs.find(x => x[0] === b.dataset.notif);
    if (!st.notifRead.includes(n[0])) st.notifRead.push(n[0]); save(); renderNotifs();
    if (n[7] === 'checkin') { go('home'); openSheet('checkin'); } else go(n[7]);
  });
  $('#markAll').addEventListener('click', () => { st.notifRead = notifs.map(n => n[0]); save(); renderNotifs(); });

  // ================= library =================
  const stories = [
    { cat: 'Cravings', img: 'stage-flush', min: 2, title: 'The 3-minute wave', lead: 'A craving feels like it will grow until you give in. It won’t. It rises, peaks and fades — usually within a few minutes.',
      body: ['Picture the urge as a wave. You don’t have to fight it or make it disappear; you only have to stay on the board until it breaks.', 'Notice where you feel it — throat, hands, chest. Name it: “this is a craving, it is peaking now.” Naming an urge puts a little distance between you and it.', 'Breathe slowly while it passes. Box breathing on the Pause screen lasts exactly as long as a typical wave.'], tip: 'Next time, start the 3-minute timer the moment you notice the urge, not when it’s already at its peak.' },
    { cat: 'Mindset', img: 'stage-detox', min: 3, title: 'Why the first week feels hardest', lead: 'Irritability, poor sleep and strong urges in the first days are signs that your body is adjusting — not signs that you’re failing.',
      body: ['Withdrawal is usually strongest in the first few days and eases over the following weeks. Every day you get through makes the next one a little easier.', 'Plan small comforts for these days: early nights, a walk after meals, cold water within reach.', 'If symptoms feel overwhelming, talk to a doctor or pharmacist — there are proven treatments that make quitting easier.'], tip: 'Mark the evenings on your calendar. They’re often the hardest part of the day early on.' },
    { cat: 'Habits', img: 'stage-repair', min: 2, title: 'Keep the break, swap the ritual', lead: 'For many people the cigarette was the excuse for a pause. You can keep the pause.',
      body: ['Write down the three moments you used to smoke most — after coffee, after meals, on the way home.', 'Give each one a replacement with the same rhythm: five minutes outside, a glass of water, a call to a friend.', 'Change one small detail of the setting, like where you sit or which cup you use, so the old cue loses its pull.'], tip: 'Habits change faster when the replacement is easy. Keep it ready before the moment arrives.' },
    { cat: 'Mindset', img: 'stage-stabilize', min: 2, title: 'A slip is not a relapse', lead: 'One cigarette doesn’t erase the days you built. What matters is what you do in the next hour.',
      body: ['Be curious instead of harsh: where were you, who were you with, how did you feel? That’s exactly what the trigger question after a slip is for.', 'Get rid of what’s left and return to your plan straight away. Many people need several attempts before quitting for good, and each one teaches something.', 'Your Streak Shield exists for this moment. Use it, and keep going.'], tip: 'Tell one person from your support circle. Saying it out loud takes away the shame.' },
    { cat: 'Habits', img: 'stage-freedom', min: 2, title: 'What to say when someone offers', lead: 'Offers often come at the worst moment — a party, a break at work. Decide your line now.',
      body: ['Keep it short and certain: “No thanks, I’ve quit.” You don’t owe anyone a long explanation.', 'Have something in your hands — a drink, your phone, keys — and step away from the smoking spot for a few minutes.', 'Ask friends who smoke not to offer. Most people respect a clear request.'], tip: 'Practise the sentence out loud once. It’s much easier to say the second time.' }
  ];
  let libCat = 'all';
  function renderLibrary() {
    $('#storyList').innerHTML = stories.map((s, i) => (libCat !== 'all' && s.cat !== libCat) ? '' : `
      <button class="card story-i" data-story="${i}">
        <span class="cover"><img src="assets/${s.img}.png" alt=""></span>
        <span class="s-t"><span class="t-m c-ink">${s.title}</span><span class="s-meta"><span class="chip">${s.cat}</span><span class="t-xsr c-500">${s.min} min</span>${st.read.includes(i) ? '<span class="done-tag">Read · +5 XP</span>' : ''}</span></span>
        <img class="li-arrow" src="assets/ic-arrow-right.svg" alt="">
      </button>`).join('');
  }
  $('#libTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; libCat = t.dataset.cat; $$('#libTabs .tab').forEach(x => x.setAttribute('aria-selected', String(x === t))); renderLibrary(); });
  function openStory(i) {
    const s = stories[i]; if (!s) return;
    const done = st.read.includes(i);
    $('#storyBody').innerHTML = `
      <div class="story-hero"><img src="assets/${s.img}.png" alt=""></div>
      <div class="s-meta"><span class="chip">${s.cat}</span><span class="t-xsr c-500">${s.min} min read</span></div>
      <p class="t-h5 c-ink">${s.title}</p>
      <p class="t-l" style="font-weight:400">${s.lead}</p>
      ${s.body.map(p => `<p class="body">${p}</p>`).join('')}
      <div class="tip-box"><b>Try this:</b> ${s.tip}</div>
      <button class="btn ${done ? 'btn-secondary' : 'btn-primary'} btn-lg btn-block" data-read="${i}">${done ? 'Read ✓' : 'Mark as read · +5 XP'}</button>`;
    go('story');
  }
  $('#storyBody').addEventListener('click', e => {
    const b = e.target.closest('[data-read]'); if (!b) return;
    const i = +b.dataset.read;
    if (!st.read.includes(i)) { st.read.push(i); st.xp += 5; log('story', 'Read · ' + stories[i].title); save(); renderAll(); toast('+5 XP for reading'); }
    back();
  });

  // ================= rewards shop =================
  const shop = [
    { id: 'shield', cost: 100, title: 'Streak Shield', sub: 'Protects your streak after one slip', img: 'shield' },
    { id: 'cactus', cost: 200, title: 'New companion: Cactus', sub: 'A second plant to grow', img: 'pot' },
    { id: 'theme', cost: 150, title: 'Terracotta pot skin', sub: 'Dress up your succulent', img: 'pot' }
  ];
  function renderShop() {
    $('#shop').innerHTML = shop.map(s => {
      const owned = s.id !== 'shield' && (st.owned || []).includes(s.id), can = st.xp >= s.cost;
      const cover = s.img === 'shield' ? '<span class="shield-ic"><img src="assets/shield.png" alt=""></span>' : `<img src="assets/${s.img}.png" alt="">`;
      return `<div class="card shop-i"><span class="cover">${cover}</span><span class="s-t"><span class="t-m c-ink">${s.title}</span><span class="t-xsr c-500">${s.sub}</span></span>
        <button class="btn ${can && !owned ? 'btn-primary' : 'btn-secondary'} btn-sm" data-buy="${s.id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : s.cost + ' XP'}</button></div>`;
    }).join('');
  }
  $('#shop').addEventListener('click', e => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const s = shop.find(x => x.id === b.dataset.buy);
    if (st.xp < s.cost) { toast(`You need ${s.cost - st.xp} more XP.`); return; }
    st.xp -= s.cost;
    if (s.id === 'shield') st.shields++; else st.owned = [...(st.owned || []), s.id];
    log('shield', 'Redeemed · ' + s.title); save(); renderAll(); toast(s.title + ' unlocked');
  });

  // ================= daily check-in =================
  const face = m => {
    const mouth = ['M10 21q4-4 8 0', 'M10 20q4-2 8 0', 'M10 19h8', 'M10 18q4 3 8 0', 'M9 17q5 5 10 0'][m - 1];
    const tone = m <= 2 ? ['#fff7ed', '#ff8904'] : ['#daffed', '#00bc7d'];
    return `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.5" fill="${tone[0]}" stroke="${tone[1]}" stroke-width="1.5"/><circle cx="10" cy="11.5" r="1.4" fill="#262626"/><circle cx="18" cy="11.5" r="1.4" fill="#262626"/><path d="${mouth}" stroke="#262626" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
  };
  const moodNames = ['Rough', 'Low', 'Okay', 'Good', 'Great'];
  $('#moods').innerHTML = moodNames.map((n, i) => `<button role="radio" aria-checked="false" data-mood="${i + 1}">${face(i + 1)}${n}</button>`).join('');
  let mood = 0;
  $('#moods').addEventListener('click', e => { const b = e.target.closest('[data-mood]'); if (!b) return; mood = +b.dataset.mood; $$('#moods button').forEach(x => x.setAttribute('aria-checked', String(x === b))); $('#ciSave').disabled = false; });
  $('#cravRange').addEventListener('input', e => { $('#cravVal').textContent = e.target.value; });
  $('#symptoms').addEventListener('click', e => { const b = e.target.closest('.trig'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
  const today = () => new Date().toDateString();
  function renderCheckin() {
    const done = st.checkin === today(), b = $('#checkinBtn');
    b.textContent = done ? 'Done ✓' : 'Check-in';
    b.classList.toggle('checked-in', done);
  }
  $('#ciSave').addEventListener('click', () => {
    const sym = $$('#symptoms .trig[aria-pressed="true"]').map(b => b.textContent);
    const first = st.checkin !== today();
    st.checkin = today(); if (first) st.xp += 10;
    log('checkin', `Check-in · ${moodNames[mood - 1]} · craving ${$('#cravRange').value}/10${sym.length ? ' · ' + sym.join(', ') : ''}`);
    save(); renderAll(); closeSheets(); toast(first ? 'Check-in saved · +10 XP' : 'Check-in updated');
    mood = 0; $$('#moods button').forEach(x => x.setAttribute('aria-checked', 'false')); $$('#symptoms .trig').forEach(x => x.setAttribute('aria-pressed', 'false')); $('#ciSave').disabled = true;
  });

  // ================= AI chat (scripted demo) =================
  const chatLog = $('#chatLog'), quick = ['I’m craving right now', 'I feel irritable', 'How long does this last?', 'I slipped'];
  let chatStarted = false;
  function say(who, html) { const d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = html; chatLog.appendChild(d); chatLog.scrollTop = chatLog.scrollHeight; return d; }
  function reply(text) {
    const q = text.toLowerCase();
    if (/crav|urge|want|smoke|хоч|тяг/.test(q)) return 'That’s hard — and it will pass. Most cravings fade within a few minutes. Want to breathe through it together?<br><button class="btn btn-primary btn-sm" data-go="pause">Start 3-min breathing</button>';
    if (/irrit|angry|anx|stress|nerv|зл|трив/.test(q)) return 'Feeling on edge is very common in the first weeks — it’s your body adjusting. A short walk, cold water or slow breathing can take the edge off. What usually helps you calm down?';
    if (/long|last|how many|скільки/.test(q)) return 'A single craving usually peaks and fades within minutes. Withdrawal overall is strongest in the first days and eases over the next few weeks. You’re on day ' + Math.floor((Date.now() - st.quitAt) / 86400000) + ' — the hardest stretch is already behind you.';
    if (/slip|smoked|relapse|зірв|закур/.test(q)) return 'One slip doesn’t erase your progress. Let’s note what triggered it so next time is easier.<br><button class="btn btn-primary btn-sm" data-sheet="reset">Log the slip</button>';
    return 'Thanks for telling me. I’m here for the hard moments — you can also message someone from your support circle.<br><button class="btn btn-secondary btn-sm" data-sheet="friend">Message a friend</button>';
  }
  function send(text) {
    if (!text.trim()) return;
    say('me', esc(text));
    const t = say('bot typing', 'Sprout is typing…');
    setTimeout(() => { t.classList.remove('typing'); t.innerHTML = reply(text); chatLog.scrollTop = chatLog.scrollHeight; }, 700);
  }
  function startChat() {
    if (chatStarted) return; chatStarted = true;
    chatLog.innerHTML = '<p class="chat-note">Demo replies for the prototype. Not medical advice.</p>';
    say('bot', 'Hi ' + esc(st.name || 'Emma') + '! I’m Sprout. How are you doing right now?');
    $('#chatQuick').innerHTML = quick.map(q => `<button type="button">${q}</button>`).join('');
  }
  $('#chatQuick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.textContent); });
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#chatInput'); send(i.value); i.value = ''; });

  // ================= settings =================
  $$('[data-pref]').forEach(s => { s.checked = st.prefs[s.dataset.pref] !== false; s.addEventListener('change', () => { st.prefs[s.dataset.pref] = s.checked; save(); toast(s.checked ? 'Reminder on' : 'Reminder off'); }); });
  function renderWatch() {
    $('#watchState').textContent = st.watch ? 'Connected · heart rate and steps on Home' : 'Not connected';
    $$('.vital').forEach(v => { v.style.visibility = st.watch ? '' : 'hidden'; });
  }

  // ================= onboarding: welcome → 3 questions → building → ready → Home =================
  let onbStep = 0, buildT = null;
  const onbNext = $('#onbNext'), onbLogin = $('#onbLogin'), onbTop = $('.onb-top'), onbActions = $('#onbActions');
  function showOnb(i) {
    onbStep = i;
    $$('.onb-step').forEach(s => { s.hidden = +s.dataset.step !== i; });
    $$('#onbDots i').forEach((d, k) => d.classList.toggle('on', k === i - 1));
    onbTop.classList.toggle('hide-top', i === 0 || i >= 4);
    onbLogin.hidden = i !== 0;
    onbActions.hidden = i === 4;
    onbNext.textContent = ['Get started', 'Continue', 'Continue', 'Build my plan', '', 'Go to Home'][i];
    $('#onboarding').scrollTop = 0;
    if (i === 4) runBuild();
    if (i === 5) renderReady();
  }
  function applyOnb() {
    const name = $('#onbName').value.trim(); if (name) st.name = name;
    const when = +($('#onbWhen [aria-checked="true"]') || { dataset: { when: 3 } }).dataset.when;
    st.quitAt = Date.now() - (when * 86400 + 151) * 1000;
    st.reasons = $$('#onbWhy .trig[aria-pressed="true"]').map(b => b.textContent);
    save(); renderAll();
  }
  function runBuild() {
    applyOnb();
    const items = $$('#buildList li'), arc = $('#buildArc'), pct = $('#buildPct');
    items.forEach(li => li.className = '');
    const total = matchMedia('(prefers-reduced-motion:reduce)').matches ? 800 : 3600, t0 = performance.now();
    clearInterval(buildT);
    buildT = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / total);
      arc.style.strokeDashoffset = (452.4 * (1 - p)).toFixed(1);
      pct.textContent = Math.round(p * 100) + '%';
      const step = Math.min(items.length, Math.floor(p * items.length));
      items.forEach((li, k) => li.className = k < step ? 'done' : k === step ? 'active' : '');
      if (p >= 1) { clearInterval(buildT); items.forEach(li => li.className = 'done'); setTimeout(() => showOnb(5), 450); }
    }, 80);
  }
  function renderReady() {
    $('#readyTitle').textContent = `Your plan is ready, ${st.name || 'Emma'}!`;
    $('#readyMoney').textContent = '$' + Math.round(st.cpd / 20 * st.price * 30);
    $('#readyCigs').textContent = st.cpd * 7;
    const r = st.reasons || [];
    const recs = [
      ['ic-wind', 'Box breathing for cravings', 'Tap Pause — most cravings pass in 3 minutes'],
      ['heart', 'Daily check-in at 20:00', 'Spot patterns in your mood and cravings'],
      ['ic-book', 'Read “The 3-minute wave”', 'A 2-minute read for your first week'],
      r.includes('My family') ? ['ic-user', 'Add your support circle', 'Message someone when it gets hard'] : ['ic-companion', 'Water your companion daily', 'Sprout grows with every smoke-free day']
    ];
    $('#readyRecs').innerHTML = recs.map(([ic, t, d]) => `<div class="li"><span class="li-ic"><img src="assets/${ic}.svg" alt=""></span><div class="li-t"><p class="t-m">${t}</p><p class="t-xsr c-500">${d}</p></div></div>`).join('');
  }
  $('#onbWhen').addEventListener('click', e => { const b = e.target.closest('[data-when]'); if (!b) return; $$('#onbWhen .trig').forEach(x => x.setAttribute('aria-checked', String(x === b))); });
  $('#onbWhy').addEventListener('click', e => { const b = e.target.closest('.trig'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
  function finishOnb() {
    clearInterval(buildT);
    st.onboarded = true; save(); renderAll();
    go('home'); showOnb(0);
    toast(`Welcome, ${st.name || 'Emma'}! Tap Pause whenever a craving hits.`);
  }
  onbNext.addEventListener('click', () => onbStep < 5 ? showOnb(onbStep + 1) : finishOnb());
  onbLogin.addEventListener('click', () => { toast('Sign-in isn’t part of this prototype — opening the demo account.'); st.onboarded = true; save(); go('home'); });
  document.addEventListener('click', e => { if (e.target.closest('[data-onb="skip"]')) showOnb(4); });
  showOnb(0);

  // ================= edit profile =================
  const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  function openProfileEdit() {
    $('#peFirst').value = st.name || 'Emma';
    $('#peLast').value = st.last ?? 'Wilson';
    $('#peDate').value = ymd(st.quitAt); $('#peDate').max = ymd(Date.now());
    $('#peReason').value = st.reason || 'To run with my daughter without stopping.';
    $('#peErr').textContent = ''; $('#peFirst').removeAttribute('aria-invalid');
    openSheet('profile');
  }
  $('#profileForm').addEventListener('submit', e => {
    e.preventDefault();
    const first = $('#peFirst').value.trim();
    if (!first) { $('#peFirst').setAttribute('aria-invalid', 'true'); $('#peErr').textContent = 'Enter your first name.'; $('#peFirst').focus(); return; }
    const dv = $('#peDate').value;
    if (dv) {
      const d = new Date(dv + 'T00:00');
      if (d > new Date()) { $('#peErr').textContent = 'Quit date can’t be in the future.'; return; }
      const old = new Date(ymd(st.quitAt) + 'T00:00');
      if (+d !== +old) st.quitAt = Math.min(Date.now(), +d + (st.quitAt - +old));
    }
    st.name = first; st.last = $('#peLast').value.trim(); st.reason = $('#peReason').value.trim();
    save(); renderAll(); closeSheets(); toast('Profile updated');
  });

  // ================= extra rendering hooked into renderAll =================
  const baseRender = renderAll;
  renderAll = function () {
    baseRender();
    renderJournal(); renderNotifs(); renderLibrary(); renderShop(); renderCheckin(); renderWatch();
    $$('#home .greet-name').forEach(n => { n.textContent = st.name || 'Emma'; });
    $('#profName').textContent = [st.name || 'Emma', st.last ?? 'Wilson'].filter(Boolean).join(' ');
    $('#profReason').textContent = '“' + (st.reason || 'To run with my daughter without stopping.') + '”';
  };
  renderAll();
  const qs = new URLSearchParams(location.search).get('screen');
  if (qs && document.getElementById(qs) && qs !== 'onboarding') { st.onboarded = true; renderAll(); go(qs); }
  else go(st.onboarded ? 'home' : 'onboarding');
})();
