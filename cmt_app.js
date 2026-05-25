// Part Assessment ↔ 1st Screen 연결
const PART_PARENT = {
  part_shoulder_upper:'shoulder_upper',
  part_shoulder_lower:'shoulder_lower',
  part_spine_flex:'spine_flex',
  part_spine_ext:'spine_ext',
  part_spine_rot:'spine_rot',
  part_deep_squat:'deep_squat',
};

function getParentScreen(screen) {
  const pid = PART_PARENT[screen.id];
  return pid ? SCREENS.find(s => s.id === pid) : null;
}

/** GitHub Pages(/eva/)·로컬 모두 동작하도록 상대 경로 → 절대 URL */
function assetUrl(rel) {
  if (!rel || /^https?:\/\//i.test(rel)) return rel;
  const path = location.pathname || '/';
  const dir = path.endsWith('.html')
    ? path.replace(/[^/]+$/, '')
    : (path.endsWith('/') ? path : `${path}/`);
  return new URL(rel, `${location.origin}${dir}`).href;
}

function getScreenPhotos(screen) {
  let photos = [];
  if (screen.photos && screen.photos.length) photos = screen.photos;
  else {
    const parent = getParentScreen(screen);
    if (parent && parent.photos) photos = parent.photos;
  }
  return photos.map((p) => ({ ...p, src: assetUrl(p.src) }));
}

function blockTitle(num, text) {
  return `<div class="block-title"><span class="num">${num}</span>${text}</div>`;
}

// 좌·우 분리 기록 (1st Screen)
const BILATERAL_IDS = new Set(['shoulder_upper', 'shoulder_lower', 'spine_rot']);

function isBilateral(screen) {
  return screen && (screen.bilateral || BILATERAL_IDS.has(screen.id));
}

const SIDE_LABELS = { L: '왼쪽', R: '오른쪽' };
const SIDE_TAGS = { L: 'Lt', R: 'Rt' };

// ─── STATE ─────────────────────────────────────────────────────────────
const state = {
  results: {},
  parts: {},
  visibleSteps: ['shoulder_upper'],
  completed: new Set(),
  currentPageId: 'home',
};

const PAGE_LABELS = () => {
  const m = { home: '🏠 평가 홈', summary: '📋 평가 요약' };
  SCREENS.forEach((s) => { m[s.id] = s.label; });
  return m;
};

function ensureScreenResult(sid) {
  if (!state.results[sid]) state.results[sid] = {};
  if (isBilateral(SCREENS.find((s) => s.id === sid))) {
    if (!state.results[sid].sides) state.results[sid].sides = { L: {}, R: {} };
  }
}

function mergeBilateralResult(sid) {
  const res = state.results[sid];
  if (!res || !res.sides) return;
  let worst = 'normal';
  ['L', 'R'].forEach((side) => {
    const r = res.sides[side]?.result;
    if (r === 'pain') worst = 'pain';
    else if (r === 'dysfunc' && worst !== 'pain') worst = 'dysfunc';
  });
  res.result = worst;
}

function bothSidesRecorded(sid) {
  const s = state.results[sid]?.sides;
  return !!(s && s.L?.result && s.R?.result);
}

function goHome() {
  state.currentPageId = 'home';
  location.hash = 'home';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('assessDate').valueAsDate = new Date();

function goToPage(id) {
  if (id !== 'home' && id !== 'summary' && !state.visibleSteps.includes(id)) return;
  state.currentPageId = id;
  location.hash = id;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateHeader(screen) {
  const el = document.getElementById('hdrPageTitle');
  if (!el) return;
  if (state.currentPageId === 'home') el.textContent = '평가 홈 — 항목 선택';
  else if (state.currentPageId === 'summary') el.textContent = '평가 요약';
  else el.textContent = screen ? screen.label : '평가 진행';
}

function updatePageSelect() {
  const sel = document.getElementById('pageSelect');
  if (!sel) return;
  const labels = PAGE_LABELS();
  sel.innerHTML = '';
  const homeOpt = document.createElement('option');
  homeOpt.value = 'home';
  homeOpt.textContent = labels.home;
  if (state.currentPageId === 'home') homeOpt.selected = true;
  sel.appendChild(homeOpt);
  state.visibleSteps.forEach((id) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = labels[id] || id;
    if (id === state.currentPageId) o.selected = true;
    sel.appendChild(o);
  });
  const allDone = state.visibleSteps.every((sid) => state.completed.has(sid));
  if (allDone && state.visibleSteps.length > 0) {
    const o = document.createElement('option');
    o.value = 'summary';
    o.textContent = labels.summary;
    if (state.currentPageId === 'summary') o.selected = true;
    sel.appendChild(o);
  }
}

function updateNavButtons() {
  const prev = document.getElementById('navPrev');
  const next = document.getElementById('navNext');
  if (state.currentPageId === 'home') {
    if (prev) prev.disabled = true;
    if (next) next.disabled = state.visibleSteps.length === 0;
    return;
  }
  if (state.currentPageId === 'summary') {
    if (prev) prev.disabled = false;
    if (next) next.disabled = true;
    return;
  }
  const idx = state.visibleSteps.indexOf(state.currentPageId);
  if (prev) prev.disabled = idx <= 0;
  if (next) {
    const allDone = state.visibleSteps.every((sid) => state.completed.has(sid));
    next.disabled = idx >= state.visibleSteps.length - 1 && !allDone;
  }
}

function advanceFlow(sid) {
  const screen = SCREENS.find((s) => s.id === sid);
  if (!screen) return;
  let nextId = null;
  if (screen.isPartAssessment) {
    nextId = screen.next || null;
  } else {
    const res = state.results[sid];
    nextId = res && res.result === 'normal' ? screen.next_if_normal : screen.next_if_issue;
  }
  if (nextId && !state.visibleSteps.includes(nextId)) state.visibleSteps.push(nextId);
  if (nextId) goToPage(nextId);
  else {
    const allDone = state.visibleSteps.every((s) => state.completed.has(s));
    if (allDone) goToPage('summary');
    else render();
  }
}

function buildHome() {
  const wrap = document.createElement('div');
  wrap.className = 'home-wrap';
  const txtMap = { normal: '정상', dysfunc: '기능장애', pain: '통증', done: '완료' };

  let cards = '';
  state.visibleSteps.forEach((id) => {
    const s = SCREENS.find((x) => x.id === id);
    if (!s) return;
    const done = state.completed.has(id);
    const res = state.results[id];
    let status = '미완료';
    let statusCls = 'pending';
    if (done && res) {
      if (isBilateral(s) && res.sides) {
        const l = txtMap[res.sides.L?.result] || '—';
        const r = txtMap[res.sides.R?.result] || '—';
        status = `${SIDE_TAGS.L} ${l} · ${SIDE_TAGS.R} ${r}`;
      } else {
        status = txtMap[res.result] || res.result;
      }
      statusCls = res.result === 'normal' || res.result === 'done' ? 'ok' : 'ng';
    }
    const cardCls = done ? (statusCls === 'ok' ? ' done-ok' : ' done-ng') : '';
    cards += `<button type="button" class="home-card${cardCls}" onclick="goToPage('${id}')">
      <span class="home-card-num">${s.num}</span>
      <span class="home-card-body">
        <div class="home-card-label">${s.label}</div>
        <div class="home-card-sub">${s.badge || ''}</div>
      </span>
      <span class="home-card-status ${statusCls}">${status}</span>
    </button>`;
  });

  const allDone = state.visibleSteps.every((sid) => state.completed.has(sid));
  wrap.innerHTML = `
    <div class="step-card active">
      <div class="card-head">
        <div class="step-num">⌂</div>
        <div class="card-head-title">Movement Screen 평가 홈</div>
      </div>
      <div class="card-body">
        <div class="home-title">평가 항목</div>
        <p class="home-desc">진행 중인 항목을 선택하세요. 어깨·회전은 <strong>왼쪽 / 오른쪽</strong>을 각각 기록합니다.</p>
        <div class="home-grid">${cards}</div>
        ${allDone ? '<button type="button" class="next-btn" style="margin-top:14px" onclick="goToPage(\'summary\')">📋 평가 요약 보기 <span class="arrow">→</span></button>' : ''}
      </div>
    </div>`;
  return wrap;
}

// ─── BUILD FLOW (단일 페이지) ───────────────────────────────────────────
function render() {
  const wrap = document.getElementById('pageView');
  wrap.innerHTML = '';
  updatePageSelect();
  updateNavButtons();

  if (state.currentPageId === 'home') {
    wrap.appendChild(buildHome());
    updateHeader(null);
    updateProgress();
    return;
  }

  if (state.currentPageId === 'summary') {
    wrap.appendChild(buildSummary());
    updateHeader(null);
    updateProgress();
    return;
  }

  const screen = SCREENS.find((s) => s.id === state.currentPageId);
  if (!screen) return;
  wrap.appendChild(buildCard(screen));
  updateHeader(screen);
  updateProgress();

  if (screen.isPartAssessment && screen.keyItems) {
    screen.keyItems.forEach((item) => checkPassiveUnlock(item.id));
  }
}

function buildCriteriaBlock(screen) {
  const parent = getParentScreen(screen);
  const normalTxt = screen.normal_txt || (parent && parent.normal_txt) || '';
  const normalTags = screen.normal_tags || (parent && parent.normal_tags) || [];
  const compensations = screen.compensations || (parent && parent.compensations) || [];
  const inherited = screen.isPartAssessment && parent && !screen.normal_txt;

  let html = blockTitle(2, '정상 / 이상 기준');

  if (screen.isPartAssessment && screen.keyItems) {
    html += `<p class="part-criteria-hint">각 항목별 <strong>정상</strong>: 통증 없이 목표 범위 달성 · <strong>이상</strong>: 통증, 가동 제한, 보상작용 관찰${inherited ? ' (아래 1st Screen 기준 참고)' : ''}</p>`;
    screen.keyItems.forEach(item => {
      const crit = item.criteria || 'Active 시행 — 통증·제한·보상 없음 / Passive — 보조 하 가동 범위 내';
      html += `<div class="key-criteria-row"><span class="pos-tag pos-${item.pos}">${item.pos}</span> <strong>${item.name}</strong> — ${crit}</div>`;
      if (item.passives) {
        item.passives.forEach(p => {
          const pc = p.criteria || 'Passive — 이상 Active 시 추가 감별';
          html += `<div class="key-criteria-row" style="padding-left:12px;"><span class="pos-tag pos-${p.pos}">${p.pos}</span> ${p.name} — ${pc}</div>`;
        });
      }
    });
    if (inherited && normalTxt) {
      html += `<div class="info-section" style="margin-top:10px;"><div class="info-label"><span class="dot green"></span>1st Screen 정상 기준</div><div class="info-body">${normalTxt}<br>${normalTags.map(t=>`<span class="normal-tag">${t}</span>`).join('')}</div></div>`;
      if (compensations.length) {
        html += `<div class="info-section"><div class="info-label"><span class="dot red"></span>보상 작용 (이상 소견)</div><div class="info-body">${compensations.map(c=>`<span class="comp-tag">${c}</span>`).join('')}</div></div>`;
      }
    }
  } else if (normalTxt) {
    html += `<div class="info-section"><div class="info-label"><span class="dot green"></span>정상</div><div class="info-body">${normalTxt}<br>${normalTags.map(t=>`<span class="normal-tag">${t}</span>`).join('')}</div></div>`;
    if (compensations.length) {
      html += `<div class="info-section"><div class="info-label"><span class="dot red"></span>이상 (보상 작용)</div><div class="info-body">${compensations.map(c=>`<span class="comp-tag">${c}</span>`).join('')}</div></div>`;
    }
  }
  return html;
}

function buildCmInputBlock(screenId, side) {
  ensureScreenResult(screenId);
  const saved = side
    ? (state.results[screenId].sides[side]?.cm || '')
    : (state.results[screenId].cm || '');
  const inputId = side ? `cm-${screenId}-${side}` : `cm-${screenId}`;
  const keys = ['1','2','3','4','5','6','7','8','9','+','0','.'];
  const keypad = keys.map(k => {
    const cls = k === '+' || k === '.' ? 'cm-key cm-key-accent' : 'cm-key';
    const args = side ? `'${screenId}','${k}','${side}'` : `'${screenId}','${k}'`;
    return `<button type="button" class="${cls}" onclick="cmKey(${args})">${k}</button>`;
  }).join('');
  const delArgs = side ? `'${screenId}','⌫','${side}'` : `'${screenId}','⌫'`;
  return `<div class="cm-block">
    <div class="cm-row">
      <span class="cm-label-txt">Cm (주먹 사이 거리)</span>
      <input type="text" inputmode="none" class="cm-input" id="${inputId}" value="${saved}" placeholder="—" readonly>
      <span class="cm-label-txt">cm</span>
      <button type="button" class="cm-del" onclick="cmKey(${delArgs})">⌫</button>
    </div>
    <div class="cm-keypad" aria-label="Cm 숫자 입력">${keypad}</div>
  </div>`;
}

function cmKey(sid, key, side) {
  const el = document.getElementById(side ? `cm-${sid}-${side}` : `cm-${sid}`);
  if (!el) return;
  let v = el.value;

  if (key === '⌫') {
    v = v.slice(0, -1);
  } else if (key === '+') {
    const n = parseFloat(v) || 0;
    v = n + 0.5 <= 60 ? String(+(n + 0.5).toFixed(1)) : v;
  } else if (key === '.') {
    if (!v.includes('.')) v = v ? v + '.' : '0.';
  } else {
    if (v === '0') v = key;
    else if (!v || v === '—') v = key;
    else v += key;
    const n = parseFloat(v);
    if (!isNaN(n) && n > 60) v = '60';
    if (v.includes('.') && v.split('.')[1].length > 1) v = parseFloat(v).toFixed(1);
  }

  el.value = v;
  saveCm(sid, v, side);
}

function buildSideResultButtons(sid, side) {
  ensureScreenResult(sid);
  const r = state.results[sid].sides[side]?.result;
  return `<div class="btn-group" id="btns-${sid}-${side}">
    <button type="button" class="r-btn${r === 'normal' ? ' sel-ok' : ''}" id="btn-normal-${sid}-${side}" onclick="setSideResult('${sid}','${side}','normal')">✓ 정상</button>
    <button type="button" class="r-btn${r === 'dysfunc' ? ' sel-ng' : ''}" id="btn-dysfunc-${sid}-${side}" onclick="setSideResult('${sid}','${side}','dysfunc')">⚠ 기능장애</button>
    <button type="button" class="r-btn${r === 'pain' ? ' sel-pain' : ''}" id="btn-pain-${sid}-${side}" onclick="setSideResult('${sid}','${side}','pain')">✕ 통증</button>
  </div>
  <div id="vas-wrap-${sid}-${side}" style="display:${r === 'pain' ? 'block' : 'none'};margin-top:8px;">
    <div class="vas-row"><span class="vas-label-txt">VAS</span>
    <input type="range" min="0" max="10" step="1" value="${state.results[sid].sides[side]?.vas || 0}"
      oninput="document.getElementById('vas-val-${sid}-${side}').textContent=this.value;saveVas('${sid}',this.value,'${side}')">
    <span class="vas-val" id="vas-val-${sid}-${side}">${state.results[sid].sides[side]?.vas || 0}</span></div>
  </div>`;
}

function buildBilateralCheck(screen, isDone) {
  const sid = screen.id;
  const txtMap = { normal: '✓ 정상', dysfunc: '⚠ 기능장애', pain: '✕ 통증' };

  if (isDone) {
    const res = state.results[sid];
    let html = '';
    ['L', 'R'].forEach((side) => {
      const s = res?.sides?.[side];
      const extra = s?.cm ? ` · ${s.cm}cm` : '';
      const vas = s?.result === 'pain' && s?.vas ? ` · VAS ${s.vas}` : '';
      html += `<p class="part-criteria-hint"><strong>${SIDE_LABELS[side]} (${SIDE_TAGS[side]})</strong>: ${txtMap[s.result] || '—'}${extra}${vas}</p>`;
    });
    return html;
  }

  let panels = '';
  ['L', 'R'].forEach((side) => {
    panels += `<div class="side-panel">
      <div class="side-panel-head"><span class="side-tag">${SIDE_TAGS[side]}</span>${SIDE_LABELS[side]}</div>`;
    if (screen.hasCm) panels += buildCmInputBlock(sid, side);
    panels += buildSideResultButtons(sid, side);
    panels += '</div>';
  });

  const ready = bothSidesRecorded(sid);
  return `<div class="result-label-row">1st Movement Screen — 왼쪽·오른쪽 각각 기록</div>
    <div class="side-panels">${panels}</div>
    ${buildNoteSection(screen, false, { hidePartBtn: true })}
    <div class="confirm-row">
      <p class="confirm-hint">${ready ? '양쪽 기록 완료. 다음 단계로 이동하세요.' : '왼쪽·오른쪽 모두 결과를 선택해 주세요.'}</p>
      <button type="button" class="next-btn" ${ready ? '' : 'disabled style="opacity:.45;cursor:not-allowed"'}
        onclick="confirmBilateral('${sid}')">기록 완료 · 다음 <span class="arrow">→</span></button>
    </div>`;
}

function buildNoteSection(screen, isDone, opts = {}) {
  if (isDone) {
    const note = state.results[screen.id]?.note;
    if (!note) return '';
    return `<div class="check-note-block check-note-readonly">
      <div class="info-label">메모</div>
      <div class="info-body">${note}</div>
    </div>`;
  }
  const noteVal = (state.results[screen.id] && state.results[screen.id].note) || '';
  let html = `<div class="check-note-block">
    <textarea class="note-area" id="note-${screen.id}" placeholder="${screen.notes_placeholder || 'Note — 보상작용, 특이사항...'}" oninput="saveNoteDraft('${screen.id}',this.value)">${noteVal}</textarea>`;
  if (screen.isPartAssessment && !opts.hidePartBtn) {
    html += `<button type="button" class="next-btn" onclick="completePart('${screen.id}')">Part Assessment 완료 <span class="arrow">→</span></button>`;
  }
  html += '</div>';
  return html;
}

function buildCheckBlock(screen, isDone) {
  let html = blockTitle(3, '정상 / 이상 체크');
  if (isDone) {
    const res = state.results[screen.id];
    if (screen.isPartAssessment) {
      const ngCount = countPartNg(screen.id);
      html += `<p class="part-criteria-hint">Part Assessment 완료 · 이상 항목 ${ngCount}건 기록</p>`;
    } else if (res) {
      const txtMap = {normal:'✓ 정상', dysfunc:'⚠ 기능장애', pain:'✕ 통증', done:'완료'};
      if (isBilateral(screen) && res.sides) {
        ['L', 'R'].forEach((side) => {
          const s = res.sides[side];
          const extra = s?.cm ? ` · ${s.cm}cm` : '';
          const vas = s?.result === 'pain' && s?.vas ? ` · VAS ${s.vas}` : '';
          html += `<p class="part-criteria-hint"><strong>${SIDE_LABELS[side]} (${SIDE_TAGS[side]})</strong>: ${txtMap[s.result] || '—'}${extra}${vas}</p>`;
        });
      } else {
        html += `<p class="part-criteria-hint">${txtMap[res.result] || res.result}${res.cm ? ' · '+res.cm+'cm' : ''}${res.vas ? ' · VAS '+res.vas : ''}</p>`;
      }
    }
    html += buildNoteSection(screen, true);
    return html;
  }

  if (screen.isPartAssessment && screen.keyItems) {
    screen.keyItems.forEach(item => {
      html += buildKeyItem(item, screen.id);
    });
    html += buildNoteSection(screen, false);
  } else if (isBilateral(screen)) {
    html += buildBilateralCheck(screen, isDone);
  } else {
    html += `<div class="result-label-row">1st Movement Screen 결과 선택</div>`;
    if (screen.hasCm) {
      html += buildCmInputBlock(screen.id);
    }
    if (screen.hasImpossible) {
      html += `<div style="margin:8px 0 4px;font-size:12px;display:flex;align-items:center;gap:6px;"><label><input type="checkbox" id="imp-${screen.id}" onchange="saveImpossible('${screen.id}',this.checked)"> 수행 불가능</label></div>`;
    }
    html += `<div class="btn-group" style="margin-top:8px;" id="btns-${screen.id}">
      <button class="r-btn" id="btn-normal-${screen.id}" onclick="setResult('${screen.id}','normal')">✓ 정상</button>
      <button class="r-btn" id="btn-dysfunc-${screen.id}" onclick="setResult('${screen.id}','dysfunc')">⚠ 기능장애</button>
      <button class="r-btn" id="btn-pain-${screen.id}" onclick="setResult('${screen.id}','pain')">✕ 통증</button>
    </div>
    <div id="vas-wrap-${screen.id}" style="display:none;margin-top:8px;">
      <div class="vas-row"><span class="vas-label-txt">VAS</span>
      <input type="range" min="0" max="10" step="1" value="0" oninput="document.getElementById('vas-val-${screen.id}').textContent=this.value;saveVas('${screen.id}',this.value)">
      <span class="vas-val" id="vas-val-${screen.id}">0</span></div>
    </div>`;
    html += buildNoteSection(screen, false);
  }
  return html;
}

function buildExerciseBlock(screen) {
  if (!screen.isPartAssessment || !screen.exercises || !screen.exercises.length) return '';
  let html = blockTitle(4, '개선을 위한 운동 방법');
  html += `<div class="exercise-card"><div class="exercise-title">권장 운동 프로그램</div>`;
  html += screen.exercises.map(e=>`<div class="exercise-item"><div class="ex-num">${e.n}</div><div class="ex-text">${e.txt}</div></div>`).join('');
  html += '</div>';
  return html;
}

function buildMetaBlock(screen, isDone, metaNum) {
  let inner = '';
  if (screen.purpose) {
    inner += `<div class="info-section"><div class="info-label"><span class="dot blue"></span>목적</div><div class="info-body">${screen.purpose}</div></div>`;
  }
  const howto = screen.howto || (getParentScreen(screen) && getParentScreen(screen).howto);
  if (screen.cautions && screen.cautions.length) {
    inner += `<div class="info-section"><div class="info-label"><span class="dot"></span>주의사항</div><div class="info-body"><ul>${screen.cautions.map(c=>`<li>${c}</li>`).join('')}</ul></div></div>`;
  }
  if (howto && howto.length) {
    const steps = howto.map(h => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:.5px solid var(--border);">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--teal);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;font-family:'DM Mono',monospace;">${h.n}</div>
        <div style="font-size:13px;flex:1;line-height:1.7;"><strong>${h.t}:</strong> ${h.txt}</div>
      </div>`).join('');
    inner += `<div class="info-section"><div class="info-label"><span class="dot blue"></span>검사 방법</div><div class="info-body">${steps}</div></div>`;
  }
  return `<details class="meta-collapse">
    <summary class="meta-collapse-summary">
      <span class="num">${metaNum}</span>
      <span class="meta-collapse-label">평가법 외 정보</span>
      <span class="meta-collapse-icon" aria-hidden="true"></span>
    </summary>
    <div class="meta-collapse-body">${inner || '<p class="part-criteria-hint">추가 정보 없음</p>'}</div>
  </details>`;
}

function photoRowClass(n) {
  if (n >= 4) return 'grid';
  if (n >= 2) return 'double';
  return 'single';
}

function buildCard(screen) {
  const isDone = state.completed.has(screen.id);
  const res = state.results[screen.id];
  const photos = getScreenPhotos(screen);
  const metaNum = screen.isPartAssessment ? 5 : 4;

  const card = document.createElement('div');
  const doneOk = res && (res.result === 'normal' || res.result === 'done');
  card.className = 'step-card active' + (isDone ? (doneOk ? ' done-ok' : ' done-ng') : '');
  card.id = 'card-' + screen.id;

  let statusBadgeHtml = '';
  if (isDone && res) {
    const cls = res.result === 'normal' ? 'badge-ok' : res.result === 'pain' ? 'badge-pain' : 'badge-ng';
    let txt = res.result === 'normal' ? '✓ 정상' : res.result === 'dysfunc' ? '⚠ 기능장애' : res.result === 'done' ? '✓ 완료' : '✕ 통증';
    if (isBilateral(screen) && res.sides) {
      const tl = res.sides.L?.result === 'normal' ? '정' : res.sides.L?.result === 'pain' ? '통' : '이';
      const tr = res.sides.R?.result === 'normal' ? '정' : res.sides.R?.result === 'pain' ? '통' : '이';
      txt = `${SIDE_TAGS.L}:${tl} ${SIDE_TAGS.R}:${tr}`;
    }
    statusBadgeHtml = `<span class="status-badge ${cls}">${txt}</span>`;
  } else {
    const cls = screen.isPartAssessment ? 'badge-part' : 'badge-screen';
    statusBadgeHtml = `<span class="status-badge ${cls}">${screen.badge}</span>`;
  }

  card.innerHTML = `
    <div class="card-head">
      <div class="step-num">${screen.num}</div>
      <div class="card-head-title">${screen.label}</div>
      ${statusBadgeHtml}
    </div>
  `;

  // ① 평가 동작 사진
  const photoBlock = document.createElement('div');
  photoBlock.className = 'block-photo';
  photoBlock.innerHTML = blockTitle(1, '평가 동작');
  if (photos.length) {
    const pr = document.createElement('div');
    pr.className = 'photo-row ' + photoRowClass(photos.length);
    photos.forEach(p => {
      pr.innerHTML += `<div class="photo-card"><div class="photo-frame"><img src="${p.src}" alt="평가 사진" loading="lazy" decoding="async"></div><div class="photo-caption">${p.cap}</div></div>`;
    });
    photoBlock.appendChild(pr);
  } else {
    photoBlock.innerHTML += '<div class="photo-empty">이 단계는 세부 동작 사진 없음 — 아래 체크 항목으로 평가합니다.</div>';
  }
  card.appendChild(photoBlock);

  const body = document.createElement('div');
  body.className = 'card-body';

  const secCriteria = document.createElement('div');
  secCriteria.className = 'block-section block-criteria';
  secCriteria.innerHTML = buildCriteriaBlock(screen);
  body.appendChild(secCriteria);

  const secCheck = document.createElement('div');
  secCheck.className = 'block-section block-check result-section';
  secCheck.innerHTML = buildCheckBlock(screen, isDone);
  body.appendChild(secCheck);

  if (screen.isPartAssessment) {
    const secEx = document.createElement('div');
    secEx.className = 'block-section block-exercise';
    secEx.innerHTML = buildExerciseBlock(screen);
    if (secEx.innerHTML) body.appendChild(secEx);
  }

  const secMeta = document.createElement('div');
  secMeta.className = 'block-section block-meta';
  secMeta.innerHTML = buildMetaBlock(screen, isDone, metaNum);
  body.appendChild(secMeta);

  card.appendChild(body);
  return card;
}

function buildKeyItem(item, screenId) {
  const posClass = 'pos-' + item.pos;
  const saved = state.parts;

  function lrBtns(id, mode) {
    if (!item.hasLR) {
      // Center only
      const k = id+'_C_'+mode;
      const v = saved[k];
      return `<div class="lr-side"><span class="lr-side-label">결과</span><div class="lr-btns">
        <button class="lr-btn${v==='ok'?' ok':''}" onclick="setPart('${k}','ok',this,'${id}','${screenId}')">정상</button>
        <button class="lr-btn${v==='ng'?' ng':''}" onclick="setPart('${k}','ng',this,'${id}','${screenId}')">이상</button>
      </div></div>`;
    }
    return ['L','R'].map(side => {
      const k = id+'_'+side+'_'+mode;
      const v = saved[k];
      return `<div class="lr-side"><span class="lr-side-label">${SIDE_LABELS[side]} (${SIDE_TAGS[side]})</span><div class="lr-btns">
        <button type="button" class="lr-btn${v==='ok'?' ok':''}" onclick="setPart('${k}','ok',this,'${id}','${screenId}')">정상</button>
        <button type="button" class="lr-btn${v==='ng'?' ng':''}" onclick="setPart('${k}','ng',this,'${id}','${screenId}')">이상</button>
      </div></div>`;
    }).join('');
  }

  let html = `<div class="key-item-row" id="ki-${item.id}">
    <span class="pos-tag ${posClass}">${item.pos}</span>
    <span class="item-name"><strong>${item.name}</strong> (Active)</span>
    <div class="lr-check-grid">${lrBtns(item.id, 'A')}</div>
  </div>`;

  // Passive same item
  html += `<div class="normal-item-row" id="kip-${item.id}" style="opacity:0.4;pointer-events:none;">
    <span class="pos-tag ${posClass}">${item.pos}</span>
    <span class="item-name passive-label">${item.name} — Passive</span>
    <div class="lr-check-grid">${lrBtns(item.id+'_p', 'P')}</div>
  </div>`;

  // Sub passives (if any)
  if (item.passives) {
    html += `<div id="sub-passives-${item.id}" style="opacity:0.4;pointer-events:none;">`;
    item.passives.forEach(p => {
      const pc = 'pos-' + p.pos;
      html += `<div class="normal-item-row" id="ki-${p.id}">
        <span class="pos-tag ${pc}">${p.pos}</span>
        <span class="item-name passive-label">${p.name}</span>
        <div class="lr-check-grid">${lrBtns(p.id, 'P')}</div>
      </div>`;
    });
    html += '</div>';
  }

  return html;
}

// ─── INTERACTIONS ──────────────────────────────────────────────────────
function setSideResult(sid, side, result) {
  ensureScreenResult(sid);
  state.results[sid].sides[side].result = result;
  ['normal', 'dysfunc', 'pain'].forEach((r) => {
    const btn = document.getElementById(`btn-${r}-${sid}-${side}`);
    if (btn) btn.className = 'r-btn' + (r === result ? ` sel-${r}` : '');
  });
  const vasWrap = document.getElementById(`vas-wrap-${sid}-${side}`);
  if (vasWrap) vasWrap.style.display = result === 'pain' ? 'block' : 'none';
  mergeBilateralResult(sid);
  render();
}

function confirmBilateral(sid) {
  if (!bothSidesRecorded(sid)) return;
  ensureScreenResult(sid);
  mergeBilateralResult(sid);
  const note = document.getElementById('note-' + sid);
  if (note) state.results[sid].note = note.value;
  state.completed.add(sid);
  advanceFlow(sid);
}

function setResult(sid, result) {
  if (isBilateral(SCREENS.find((s) => s.id === sid))) return;
  ensureScreenResult(sid);
  state.results[sid].result = result;

  // Update button styles
  ['normal','dysfunc','pain'].forEach(r => {
    const btn = document.getElementById('btn-'+r+'-'+sid);
    if (btn) btn.className = 'r-btn' + (r === result ? ' sel-'+r : '');
  });

  // Show VAS if pain
  const vasWrap = document.getElementById('vas-wrap-'+sid);
  if (vasWrap) vasWrap.style.display = result === 'pain' ? 'block' : 'none';

  // Auto-advance: show next card
  const screen = SCREENS.find(s => s.id === sid);
  if (!screen) return;

  const note = document.getElementById('note-'+sid);
  if (note) { state.results[sid].note = note.value; }

  state.completed.add(sid);
  advanceFlow(sid);
}

function completePart(sid) {
  const note = document.getElementById('note-'+sid);
  if (!state.results[sid]) state.results[sid] = {};
  state.results[sid].result = 'done';
  if (note) state.results[sid].note = note.value;
  state.completed.add(sid);
  advanceFlow(sid);
}

function saveCm(sid, val, side) {
  ensureScreenResult(sid);
  if (side) state.results[sid].sides[side].cm = val;
  else state.results[sid].cm = val;
}
function saveVas(sid, val, side) {
  ensureScreenResult(sid);
  if (side) state.results[sid].sides[side].vas = val;
  else state.results[sid].vas = val;
}
function saveImpossible(sid, val) {
  ensureScreenResult(sid);
  state.results[sid].impossible = val;
}

function saveNoteDraft(sid, val) {
  ensureScreenResult(sid);
  state.results[sid].note = val;
}

function setPart(key, val, btn, itemId, screenId) {
  // Toggle
  if (state.parts[key] === val) {
    state.parts[key] = null;
    btn.className = 'lr-btn';
  } else {
    state.parts[key] = val;
    // Reset siblings in same item+side+mode
    const [id, side, mode] = key.split('_');
    // find other btn
    const parent = btn.closest('.lr-btns');
    if (parent) parent.querySelectorAll('.lr-btn').forEach(b => b.className = 'lr-btn');
    btn.className = 'lr-btn ' + val;
  }

  // If any active key item has NG → unlock passive
  checkPassiveUnlock(itemId);
}

function checkPassiveUnlock(itemId) {
  const hasNgActive = ['L','R','C'].some(s => state.parts[itemId+'_'+s+'_A'] === 'ng');

  const passRow = document.getElementById('kip-'+itemId);
  if (passRow) {
    passRow.style.opacity = hasNgActive ? '1' : '0.4';
    passRow.style.pointerEvents = hasNgActive ? 'auto' : 'none';
  }
  const subPassives = document.getElementById('sub-passives-'+itemId);
  if (subPassives) {
    subPassives.style.opacity = hasNgActive ? '1' : '0.4';
    subPassives.style.pointerEvents = hasNgActive ? 'auto' : 'none';
  }
}

function updateProgress() {
  const total = state.visibleSteps.length;
  const done = [...state.completed].filter(id => state.visibleSteps.includes(id)).length;
  const pct = total > 0 ? Math.round(done / Math.max(total,1) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
}

function countPartNg(screenId) {
  const scr = SCREENS.find(s => s.id === screenId);
  if (!scr || !scr.keyItems) return 0;
  let n = 0;
  function sides(hasLR) { return hasLR ? ['L','R'] : ['C']; }
  function countItem(item) {
    sides(item.hasLR).forEach(s => {
      if (state.parts[item.id+'_'+s+'_A'] === 'ng') n++;
      if (state.parts[item.id+'_p_'+s+'_P'] === 'ng') n++;
    });
    if (item.passives) item.passives.forEach(p => {
      sides(p.hasLR !== false ? (p.hasLR ?? item.hasLR) : false).forEach(s => {
        if (state.parts[p.id+'_'+s+'_P'] === 'ng') n++;
      });
    });
  }
  scr.keyItems.forEach(countItem);
  return n;
}

function buildSummary() {
  const wrap = document.createElement('div');
  wrap.className = 'summary-wrap';

  const screenIds = ['shoulder_upper','shoulder_lower','spine_flex','spine_ext','spine_rot','deep_squat'];
  const labels = {
    shoulder_upper:'어깨 위 패턴', shoulder_lower:'어깨 아래 패턴',
    spine_flex:'척추·엉덩 굴곡', spine_ext:'척추·엉덩 신전',
    spine_rot:'척추·엉덩 회전', deep_squat:'딥 스쿼트'
  };
  const partLabels = {
    part_shoulder_upper:'Part — 위 패턴', part_shoulder_lower:'Part — 아래 패턴',
    part_spine_flex:'Part — 굴곡', part_spine_ext:'Part — 신전',
    part_spine_rot:'Part — 회전', part_deep_squat:'Part — 딥 스쿼트'
  };
  const txtMap = {normal:'정상', dysfunc:'기능장애', pain:'통증', done:'완료'};
  const clsMap = {normal:'ok', dysfunc:'ng', pain:'pain', done:'ok'};

  let gridHtml = '';
  let findings = [];
  let doneCount = 0;

  state.visibleSteps.forEach(id => {
    const res = state.results[id];
    if (!res) return;
    doneCount++;
    const lbl = labels[id] || partLabels[id] || id;
    const val = res.result;
    let extra = '';
    if (isBilateral(SCREENS.find((s) => s.id === id)) && res.sides) {
      const l = res.sides.L;
      const r = res.sides.R;
      extra = ` · ${SIDE_TAGS.L}:${txtMap[l?.result] || '—'}`;
      if (l?.cm) extra += ` ${l.cm}cm`;
      extra += ` / ${SIDE_TAGS.R}:${txtMap[r?.result] || '—'}`;
      if (r?.cm) extra += ` ${r.cm}cm`;
    } else {
      if (res.cm) extra += ` · ${res.cm}cm`;
      if (val === 'pain' && res.vas) extra += ` · VAS ${res.vas}`;
    }
    if (partLabels[id]) {
      const ng = countPartNg(id);
      if (ng) extra += ` · 이상 ${ng}건`;
    }
    gridHtml += `<div class="sum-item"><div class="sum-item-label">${lbl}</div><div class="sum-item-val ${clsMap[val]||''}">${txtMap[val]||val}${extra}</div></div>`;
    if (val !== 'normal' && val !== 'done') findings.push(lbl);
    else if (partLabels[id] && countPartNg(id) > 0) findings.push(lbl + ` (이상 ${countPartNg(id)})`);
  });

  let findingsHtml = '';
  if (findings.length) {
    findingsHtml = `<div class="findings-row"><div class="findings-lbl">이상 소견</div>${findings.map(f=>`<span class="f-tag">${f}</span>`).join('')}</div>`;
  }

  const pct = state.visibleSteps.length ? Math.round(doneCount / state.visibleSteps.length * 100) : 0;

  wrap.innerHTML = `
    <div class="summary-title">📋 평가 요약
      <button class="copy-btn" onclick="copySummary()">결과 복사</button>
    </div>
    <div class="summary-grid">${gridHtml}</div>
    ${findingsHtml}
    <div class="progress-foot"><div class="progress-foot-fill" style="width:${pct}%"></div></div>`;
  return wrap;
}

function copySummary() {
  const name = document.getElementById('patientName').value || '(미입력)';
  const date = document.getElementById('assessDate').value || '';
  const allLabels = {
    shoulder_upper:'어깨 위 패턴', shoulder_lower:'어깨 아래 패턴',
    spine_flex:'척추·엉덩 굴곡', spine_ext:'척추·엉덩 신전',
    spine_rot:'척추·엉덩 회전', deep_squat:'딥 스쿼트',
    part_shoulder_upper:'Part — 위 패턴', part_shoulder_lower:'Part — 아래 패턴',
    part_spine_flex:'Part — 굴곡', part_spine_ext:'Part — 신전',
    part_spine_rot:'Part — 회전', part_deep_squat:'Part — 딥 스쿼트'
  };
  const txtMap = {normal:'정상', dysfunc:'기능장애', pain:'통증', done:'완료'};
  let lines = [`[CMT Movement Screen] ${name} / ${date}`, ''];
  state.visibleSteps.forEach(id => {
    const lbl = allLabels[id];
    const res = state.results[id];
    if (!res || !lbl) return;
    let line = `${lbl}: ${txtMap[res.result]||res.result}`;
    if (isBilateral(SCREENS.find((s) => s.id === id)) && res.sides) {
      ['L', 'R'].forEach((side) => {
        const s = res.sides[side];
        line += `\n  ${SIDE_LABELS[side]}(${SIDE_TAGS[side]}): ${txtMap[s?.result]||'—'}`;
        if (s?.cm) line += ` ${s.cm}cm`;
        if (s?.result === 'pain' && s?.vas) line += ` VAS ${s.vas}`;
      });
    } else {
      if (res.cm) line += ` (${res.cm}cm)`;
      if (res.result === 'pain' && res.vas) line += ` VAS ${res.vas}`;
    }
    if (id.startsWith('part_')) {
      const ng = countPartNg(id);
      if (ng) line += ` · 이상 항목 ${ng}건`;
    }
    if (res.note) line += `\n  └ ${res.note}`;
    lines.push(line);
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = event.target;
    btn.textContent = '복사 완료!';
    setTimeout(() => btn.textContent = '결과 복사', 2000);
  });
}

function navPrev() {
  if (state.currentPageId === 'summary') {
    goToPage(state.visibleSteps[state.visibleSteps.length - 1]);
    return;
  }
  if (state.currentPageId === 'home') return;
  const idx = state.visibleSteps.indexOf(state.currentPageId);
  if (idx <= 0) goHome();
  else goToPage(state.visibleSteps[idx - 1]);
}

function navNext() {
  if (state.currentPageId === 'home') {
    const next = state.visibleSteps.find((id) => !state.completed.has(id)) || state.visibleSteps[0];
    if (next) goToPage(next);
    return;
  }
  if (state.currentPageId === 'summary') return;
  const idx = state.visibleSteps.indexOf(state.currentPageId);
  const allDone = state.visibleSteps.every((sid) => state.completed.has(sid));
  if (idx < state.visibleSteps.length - 1) goToPage(state.visibleSteps[idx + 1]);
  else if (allDone) goToPage('summary');
  else goHome();
}

function initFromHash() {
  const h = (location.hash || '').replace('#', '');
  if (h === 'home' || h === 'summary' || state.visibleSteps.includes(h)) state.currentPageId = h;
  render();
}

initFromHash();
window.addEventListener('hashchange', initFromHash);
