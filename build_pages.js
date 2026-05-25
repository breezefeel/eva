const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const json = JSON.parse(fs.readFileSync(path.join(BASE, 'pptx_extract.json'), 'utf8').replace(/^\uFEFF/, ''));
const slide = (n) => json.find((s) => s.slide === n);

function imgs(n, caps = []) {
  const s = slide(n);
  if (!s) return [];
  return s.images.map((file, i) => ({
    src: `pptx_assets/cropped/${file}`,
    cap: caps[i] || caps[caps.length - 1] || `▲ 평가 동작 ${i + 1}`,
  }));
}

function joinTexts(n, fromIdx = 0) {
  const s = slide(n);
  if (!s) return '';
  const t = s.texts;
  if (typeof t === 'string') return t;
  return t.slice(fromIdx).join(' ').replace(/\s+/g, ' ').trim();
}

function parseHowto(n) {
  const s = slide(n);
  if (!s || typeof s.texts === 'string') return [];
  const t = s.texts;
  const start = t.findIndex((x) => x === '검사방법' || x.includes('검사방법'));
  const end = t.findIndex((x) => x === '정상범주' || x === '정상');
  const slice = start >= 0 ? t.slice(start + 1, end > start ? end : start + 30) : [];
  const steps = [];
  let buf = [];
  const flush = () => {
    if (buf.length) {
      const line = buf.join(' ').replace(/\s+/g, ' ').trim();
      if (line.length > 8) steps.push(line);
      buf = [];
    }
  };
  for (const piece of slice) {
    if (piece === '[' || piece === ']') continue;
    if (/^\d+\.?$/.test(piece) && buf.length) flush();
    buf.push(piece);
    if (piece.endsWith('.') && buf.join('').length > 20) flush();
  }
  flush();
  return steps.slice(0, 8).map((txt, i) => ({ n: i + 1, t: `단계 ${i + 1}`, txt }));
}

function parseCautions(n) {
  const s = slide(n);
  if (!s || typeof s.texts === 'string') return [];
  const t = s.texts;
  const i0 = t.indexOf('주의사항');
  const i1 = t.indexOf('보상작용');
  if (i0 < 0) return [];
  const raw = t.slice(i0 + 1, i1 > i0 ? i1 : i0 + 12).join(' ').replace(/\s+/g, ' ');
  return raw.split(/\.(?=\s|$)/).map((x) => x.trim()).filter((x) => x.length > 5);
}

function parseNormal(n) {
  const s = slide(n);
  if (!s) return { normal_txt: '', normal_tags: [], compensations: [] };
  const t = typeof s.texts === 'string' ? [s.texts] : s.texts;
  const i0 = t.findIndex((x) => x === '정상범주' || x.startsWith('정상'));
  const i1 = t.findIndex((x) => x === '주의사항');
  const i2 = t.findIndex((x) => x === '보상작용');
  const normal = i0 >= 0 ? t.slice(i0 + 1, i1 > i0 ? i1 : i0 + 25).join(' ').replace(/\s+/g, ' ') : '';
  let comp = [];
  if (i2 >= 0) {
    const raw = t.slice(i2 + 1).join(' ').replace(/\s+/g, ' ');
    comp = raw.split(/(?<=\.)\s+/).map((s) => s.replace(/\.$/, '').trim()).filter((s) => s.length > 3);
  }
  const tags = [];
  if (normal.includes('견갑')) tags.push('견갑극/하각 닿음');
  if (normal.includes('턱')) tags.push('턱이 몸통');
  if (normal.includes('70')) tags.push('천추각 70°');
  if (normal.includes('ASIS')) tags.push('ASIS=발끝', '견갑극=뒤꿈치');
  if (normal.includes('50')) tags.push('흉부·골반 50°');
  if (normal.includes('뒤꿈치')) tags.push('뒤꿈치 접지');
  return { normal_txt: normal, normal_tags: tags, compensations: comp.slice(0, 8) };
}

const pages = [
  {
    id: 'shoulder_upper',
    num: 1,
    label: '1. Shoulder Pattern — 위 패턴',
    badge: '1st Screen',
    purpose: '어깨의 Mobility 정도와 통증을 살펴본다.',
    photos: imgs(15, ['▲ 위 패턴 — 측면/후면 관찰']),
    howto: [
      { n: 1, t: '준비', txt: '바르게 선 자세, 발 붙이고 발가락 정면.' },
      { n: 2, t: '위 패턴 (Rt)', txt: '오른팔을 빗질하듯 머리 위로 지나 왼쪽 견갑극에 닿도록. 반대팔은 아래로 반대쪽 견갑골 하각에 닿도록.' },
      { n: 3, t: '아래 패턴', txt: '반대로도 시행 (Rt 아래 패턴).' },
    ],
    ...parseNormal(15),
    cautions: parseCautions(15),
    bilateral: true,
    hasCm: true,
    notes_placeholder: 'Note — 보상작용, 특이사항...',
    next_if_normal: 'shoulder_lower',
    next_if_issue: 'part_shoulder_upper',
  },
  {
    id: 'shoulder_lower',
    num: 2,
    label: '1. Shoulder Pattern — 아래 패턴',
    badge: '1st Screen',
    purpose: '어깨 Mobility — 아래 패턴 평가.',
    photos: imgs(15, ['▲ 아래 패턴 시행']),
    howto: parseHowto(15).length ? parseHowto(15) : [{ n: 1, t: '시행', txt: '위 패턴과 반대 방향으로 아래 패턴 시행.' }],
    normal_txt: '반대편 견갑골 하각에 손이 닿으면.',
    normal_tags: ['하각 닿음'],
    compensations: ['머리 위치 변화 — 굽힘, 회전', '반대 측 어깨 올림', '흉부 회전, 과도한 흉추 신전', '요측 변위', '익상 견갑골'],
    bilateral: true,
    hasCm: true,
    notes_placeholder: 'Note...',
    next_if_normal: 'spine_flex',
    next_if_issue: 'part_shoulder_lower',
  },
  {
    id: 'spine_flex',
    num: 3,
    label: '2. Multi-Segmental Flexion',
    badge: '1st Screen',
    purpose: '척추와 엉덩 관절의 굴곡 정도와 통증을 살펴본다.',
    photos: imgs(16, ['▲ 경추 굴곡', '▲ 흉추-골반 굴곡']),
    howto: [
      { n: 1, t: '경추', txt: '바른 자세, 체간 유지, 턱을 몸통까지 붙인다.' },
      { n: 2, t: '흉추-골반', txt: '무릎 구부리지 않고 봉이 바닥에 닿을 때까지 천천히 굽힌 후 복귀 (시선 발끝).' },
    ],
    ...parseNormal(16),
    cautions: parseCautions(16),
    hasCm: false,
    notes_placeholder: 'Note...',
    next_if_normal: 'spine_ext',
    next_if_issue: 'part_spine_flex',
  },
  {
    id: 'spine_ext',
    num: 4,
    label: '3. Multi-Segmental Extension',
    badge: '1st Screen',
    purpose: '척추와 엉덩 관절의 신전 정도와 통증을 살펴본다.',
    photos: imgs(17, ['▲ 경추 신전', '▲ 흉추-골반 신전']),
    howto: [
      { n: 1, t: '경추', txt: '고개를 들어 시선 천장, 얼굴이 천정과 수평.' },
      { n: 2, t: '흉추-골반', txt: '봉을 하늘로, 팔꿈치 신전·귀 선 유지. 엉덩 앞으로 밀며 척추 최대 신전.' },
    ],
    ...parseNormal(17),
    hasCm: false,
    notes_placeholder: 'Note...',
    next_if_normal: 'spine_rot',
    next_if_issue: 'part_spine_ext',
  },
  {
    id: 'spine_rot',
    num: 5,
    label: '4. Multi-Segmental Rotation',
    badge: '1st Screen',
    purpose: '척추, 엉덩관절, 무릎 및 발의 회전 정도와 통증을 살펴본다.',
    photos: imgs(18, ['▲ 경추 회전', '▲ 흉추-골반 회전']),
    howto: [
      { n: 1, t: '경추', txt: '봉을 어깨에 걸치고 팔꿈치 수직, 고개만 좌/우 끝까지.' },
      { n: 2, t: '흉추-골반', txt: '몸통 전체를 좌·우 끝까지 회전.' },
    ],
    ...parseNormal(18),
    cautions: parseCautions(18),
    bilateral: true,
    hasCm: false,
    hasImpossible: false,
    notes_placeholder: 'Note...',
    next_if_normal: 'deep_squat',
    next_if_issue: 'part_spine_rot',
  },
  {
    id: 'deep_squat',
    num: 6,
    label: '5. Deep Squat',
    badge: '1st Screen',
    purpose: '골반, 엉덩관절, 무릎, 발목의 대칭적 가동성과 통증을 살펴본다.',
    photos: imgs(19, ['▲ 딥 스쿼트 — 봉 위로, 최대 깊이']),
    howto: [
      { n: 1, t: '준비', txt: '발 어깨 너비, 봉을 하늘로 들어 팔꿈치 신전·귀 선 유지.' },
      { n: 2, t: '시행', txt: '시선 정면, 깊숙이 스쿼트 자세.' },
    ],
    ...parseNormal(19),
    cautions: parseCautions(19),
    hasCm: false,
    hasImpossible: true,
    notes_placeholder: 'Note...',
    next_if_normal: null,
    next_if_issue: 'part_deep_squat',
  },
  {
    id: 'part_shoulder_upper',
    num: '1-P',
    label: 'Part — 위 패턴 (Shoulder)',
    badge: 'Part Assessment',
    isPartAssessment: true,
    purpose: '위 패턴 이상 시 선택적 ROM — 원인 감별.',
    photos: imgs(23, ['흉추 신전/회전', '위 패턴', '외회전', '외전/굴곡', '외전·굴곡 & 팔꿈치 굴곡']),
    keyItems: [
      { id: 'k_tho_upper', pos: 'K', name: '흉추 신전/회전', hasLR: true },
      {
        id: 'upper_pattern',
        pos: 'P',
        name: '위 패턴',
        hasLR: true,
        passives: [
          { id: 'upper_pat_p', pos: 'P', name: '위 패턴 — Passive', hasLR: true },
          { id: 'ext_rot_p', pos: 'P', name: '외회전 — Passive', hasLR: true },
          { id: 'abd_p', pos: 'P', name: '외전/굴곡 — Passive', hasLR: true },
          { id: 'abd_elb_p', pos: 'P', name: '외전/굴곡 & 팔꿈치 굴곡 — Passive', hasLR: true },
        ],
      },
    ],
    exercises: [
      { n: 1, txt: '흉추 모빌리티 (사이드 라잉 로테이션)' },
      { n: 2, txt: '어깨 외회전 스트레칭' },
      { n: 3, txt: '도어웨이 스트레칭 (외전/굴곡)' },
    ],
    notes_placeholder: 'Note...',
    next: 'shoulder_lower',
  },
  {
    id: 'part_shoulder_lower',
    num: '2-P',
    label: 'Part — 아래 패턴 (Shoulder)',
    badge: 'Part Assessment',
    isPartAssessment: true,
    purpose: '아래 패턴 이상 시 선택적 ROM.',
    photos: imgs(22, ['흉추 신전/회전', '아래 패턴', '내회전', '신전', '신전 & 팔꿈치 굴곡']),
    keyItems: [
      { id: 'lk_tho', pos: 'K', name: '흉추 신전/회전', hasLR: true },
      {
        id: 'lower_pattern',
        pos: 'P',
        name: '아래 패턴',
        hasLR: true,
        passives: [
          { id: 'lower_pat_p', pos: 'P', name: '아래 패턴 — Passive', hasLR: true },
          { id: 'inner_rot_p', pos: 'P', name: '내회전 — Passive', hasLR: true },
          { id: 'ext_p', pos: 'P', name: '신전 — Passive', hasLR: true },
          { id: 'ext_elb_p', pos: 'P', name: '신전 & 팔꿈치 굴곡 — Passive', hasLR: true },
        ],
      },
    ],
    exercises: [
      { n: 1, txt: '흉추 모빌리티 운동' },
      { n: 2, txt: '어깨 내회전 스트레칭' },
      { n: 3, txt: '어깨 신전 스트레칭 (도어웨이)' },
    ],
    notes_placeholder: 'Note...',
    next: 'spine_flex',
  },
  {
    id: 'part_spine_flex',
    num: '3-P',
    label: 'Part — Multi-Segmental Flexion',
    badge: 'Part Assessment',
    isPartAssessment: true,
    purpose: '굴곡 이상 시 선택적 ROM (VAS 0~4 운동 전).',
    photos: [...imgs(24), ...imgs(25)],
    keyItems: [
      { id: 'cer_flex', pos: 'S', name: '경추 굴곡', hasLR: false },
      { id: 'c0c1', pos: 'S', name: 'C0-C1 굴곡', hasLR: false },
      { id: 'tft', pos: 'Sit', name: '발끝 닿기 — 요추·엉덩 굴곡', hasLR: false },
      { id: 'slr', pos: 'S', name: 'SLR — 엉덩관절 굴곡', hasLR: true },
      { id: 'slr_core', pos: 'S', name: '안정 SLR — Core', hasLR: false },
      { id: 'ktc_shin', pos: 'S', name: '무릎가슴(정강이) — 엉덩·무릎 굴곡', hasLR: true },
      { id: 'ktc_thigh', pos: 'S', name: '무릎가슴(허벅지) — 엉덩관절 굴곡', hasLR: true },
      { id: 'rocking', pos: 'K', name: '록킹 — 척추 굴곡', hasLR: false },
    ],
    exercises: [
      { n: 1, txt: '경추·흉추 모빌리티 드릴' },
      { n: 2, txt: '힙 플렉스 스트레칭' },
      { n: 3, txt: '코어 안정화 (Dead Bug)' },
    ],
    notes_placeholder: 'Note...',
    next: 'spine_ext',
  },
  {
    id: 'part_spine_ext',
    num: '4-P',
    label: 'Part — Multi-Segmental Extension',
    badge: 'Part Assessment',
    isPartAssessment: true,
    purpose: '신전 이상 시 선택적 ROM.',
    photos: [...imgs(26), ...imgs(27)],
    keyItems: [
      { id: 'cer_ext', pos: 'S', name: '경추 신전', hasLR: false },
      { id: 'pressup', pos: 'P', name: '프레스업 — 척추 신전', hasLR: false },
      { id: 'k_tho_ext', pos: 'K', name: '흉추 신전/회전', hasLR: true },
      { id: 'lum_ext', pos: 'P', name: '요추 신전/회전', hasLR: true },
      { id: 'shou_fl', pos: 'P', name: '어깨대굴곡', hasLR: true },
      { id: 'faber', pos: 'S', name: 'FABER — 엉덩 굴곡/외전/외회전', hasLR: true },
      { id: 'thomas', pos: 'S', name: '변형 토마스 — 장요근, 대퇴직근', hasLR: true },
      { id: 'hip_ext', pos: 'P', name: '엉덩관절 신전', hasLR: true },
    ],
    exercises: [
      { n: 1, txt: '프레스업 / 코브라 모빌리티' },
      { n: 2, txt: '힙 플렉서 스트레칭' },
      { n: 3, txt: '어깨대굴곡 강화' },
    ],
    notes_placeholder: 'Note...',
    next: 'spine_rot',
  },
  {
    id: 'part_spine_rot',
    num: '5-P',
    label: 'Part — Multi-Segmental Rotation',
    badge: 'Part Assessment',
    isPartAssessment: true,
    purpose: '회전 이상 시 선택적 ROM.',
    photos: [...imgs(28), ...imgs(29), ...imgs(30)],
    keyItems: [
      { id: 'cer_rot', pos: 'S', name: '경추 회전', hasLR: true },
      { id: 'c1c2', pos: 'S', name: 'C1-C2 회전', hasLR: true },
      { id: 'tho_rot', pos: 'Sit', name: '흉부 회전', hasLR: true },
      { id: 'k_tho_rot', pos: 'K', name: '흉추 신전/회전', hasLR: true },
      { id: 'lum_rot', pos: 'P', name: '요추 신전/회전', hasLR: true },
      { id: 'hip_ir', pos: 'P', name: '엉덩관절 내회전', hasLR: true },
      { id: 'hip_er', pos: 'P', name: '엉덩관절 외회전', hasLR: true },
    ],
    exercises: [
      { n: 1, txt: '척추 회전 모빌리티' },
      { n: 2, txt: '힙 IR/ER 스트레칭' },
    ],
    notes_placeholder: 'Note...',
    next: 'deep_squat',
  },
  {
    id: 'part_deep_squat',
    num: '6-P',
    label: 'Part — Deep Squat',
    badge: 'Part Assessment',
    isPartAssessment: true,
    purpose: '딥 스쿼트 이상 시 하지 선택적 ROM.',
    photos: [...imgs(31), ...imgs(32)],
    keyItems: [
      { id: 'sq_shin', pos: 'S', name: '무릎가슴(정강이) — Hip & Knee Flexion', hasLR: true },
      { id: 'sq_thigh', pos: 'S', name: '무릎가슴(허벅지) — Hip Flexion', hasLR: true },
      { id: 'ank_df', pos: 'S', name: '텐덤 발목 배측굴곡', hasLR: true },
      { id: 'ank_inv', pos: 'Sit', name: '발목 내반/외반', hasLR: true },
      { id: 'hip_ir_sq', pos: 'Sit', name: '엉덩관절 내회전', hasLR: true },
      { id: 'hip_er_sq', pos: 'Sit', name: '엉덩관절 외회전', hasLR: true },
    ],
    exercises: [
      { n: 1, txt: '발목 배측굴곡 (Calf Stretch / Band DF)' },
      { n: 2, txt: '엉덩관절 굴곡 스트레칭' },
      { n: 3, txt: 'Goblet Squat Hold' },
    ],
    notes_placeholder: 'Note...',
    next: null,
  },
];

fs.writeFileSync(
  path.join(BASE, 'pages_data.json'),
  JSON.stringify(pages, null, 2),
  'utf8'
);
console.log('Wrote', pages.length, 'pages');
