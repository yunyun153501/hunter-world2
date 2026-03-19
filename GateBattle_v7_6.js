//@name Gate Battle Prototype v7.7
//@display-name ⚔️ 게이트 전투 프로토타입 v7.7
//@api 3.0
//@version 7.7.0
//@author OpenAI
//@arg gate_v21_db string "" "v2.1 DB 저장"
//@arg gate_v21_state string "" "v2.1 UI/전투 상태 저장"

(async () => {
try {
  const PLUGIN_NAME = '[Gate Battle Prototype v7.6.0]';
  const UI_ID = 'gate-battle-v22-root';
  const STYLE_ID = 'gate-battle-v22-style';
  const KEY_DB = 'GateBattleV21::db';
  const KEY_STATE = 'GateBattleV21::state';
  const KEY_VISIBLE = 'GateBattleV21::visible';
  const MAX_PARTY = 8;
  const MAX_ENEMIES = 10;
  const GRADE_ORDER = ['E','D','C','B','A','S'];
  // 등급별 주스탯 상한선
  const STAT_CAP_BY_RANK = { E:25, D:40, C:60, B:80, A:100, S:150 };
  const DAMAGE_ELEMENTS = ['none', 'water', 'fire', 'ice', 'earth', 'wind', 'electric', 'dark', 'light'];
  const STATUS_KEYS = ['stun', 'bind', 'sleep', 'poison', 'bleed', 'burn', 'curse', 'silence', 'slow', 'blind', 'freeze', 'paralyze'];
  const STATUS_DOT_KEYS = ['poison', 'burn'];
  const ELEMENT_CHAIN = ['dark', 'light', 'ice', 'fire', 'water', 'earth', 'wind', 'electric'];
  const ELEMENT_STATUS_MAP = { light:'blind', dark:'curse', fire:'burn', water:'slow', earth:'stun', wind:'bleed', ice:'freeze', electric:'paralyze' };

  // ── 희귀도 (Rarity) ──
  const RARITY_LIST = ['Normal','Rare','Unique','Legendary'];
  const RARITY_COLORS = { Normal:'#ffffff', Rare:'#4488ff', Unique:'#ff69b4', Legendary:'#ffd700' };
  const RARITY_LABELS = { Normal:'Normal', Rare:'Rare', Unique:'Unique', Legendary:'Legendary' };
  function rarityColor(rarity) { return RARITY_COLORS[rarity] || RARITY_COLORS.Normal; }
  function rarityStyle(rarity) { const c = rarityColor(rarity); return rarity && rarity !== 'Normal' ? `color:${c};font-weight:600;` : ''; }
  // 특성 → 가격 티어 매핑 (rare_material_catalog 기준)
  const TRAIT_TIER_MAP = {
    crit_chance:1, crit_damage:1, physical_damage:1, magic_damage:1,
    stun_apply:1, freeze_apply:1, paralyze_apply:1, sleep_apply:1,
    bleed_apply:2, burn_apply:2, curse_apply:2, poison_apply:2,
    bind_apply:2, silence_apply:2, blind_apply:2,
    fire_damage:2, water_damage:2, ice_damage:2, earth_damage:2,
    wind_damage:2, lightning_damage:2, light_damage:2, dark_damage:2,
    stat_str_up:2, stat_con_up:2, stat_int_up:2, stat_agi_up:2, stat_sense_up:2,
    healing_done:3, magic_defense:3, physical_defense:3, shield_effect:3,
    pdef_flat:3, mdef_flat:3, slow_apply:3,
    stun_resist:3, freeze_resist:3, paralyze_resist:3, sleep_resist:3,
    healing_received:4, bleed_resist:4, burn_resist:4, curse_resist:4,
    bind_resist:4, silence_resist:4, blind_resist:4, slow_resist:4,
    fire_resist:4, water_resist:4, ice_resist:4, earth_resist:4,
    wind_resist:4, lightning_resist:4, light_resist:4, dark_resist:4,
    poison_resist:4, threat_up:4, threat_down:4,
  };
  // 디버프 가능 특성 매핑 (10종 — 피해 증가 계열만 디버프로 전환 가능)
  const TRAIT_CAN_DEBUFF = {
    physical_damage:true, magic_damage:true,
    fire_damage:true, water_damage:true, ice_damage:true, earth_damage:true,
    wind_damage:true, lightning_damage:true, light_damage:true, dark_damage:true,
  };
  // 장비 희귀도 자동 판정: weapon/armor → 특성 유무, subweapon/accessory → 실제 특성 티어
  function assignEquipRarity(part, traitId) {
    if (part === 'subweapon' || part === 'accessory') {
      const tier = TRAIT_TIER_MAP[traitId] || 3;
      return { rarity: tier <= 2 ? 'Rare' : 'Normal', traitTier: tier };
    }
    return { rarity: traitId ? 'Rare' : 'Normal', traitTier: 0 };
  }

  // ── 통합 특성 시스템 (Unified Trait System) ──
  // SPECIAL_MATERIAL_EFFECTS는 EQUIP_TRAIT_LABELS + TRAIT_CAN_DEBUFF 기반으로 자동 생성
  // 스킬 특수효과 / 장비 주입 / 장비 특성이 모두 동일한 특성 ID 사용
  const TRAIT_DEBUFF_DESC = {
    physical_damage:'+N% 받는 물리 피해 증가', magic_damage:'+N% 받는 마법 피해 증가',
    fire_damage:'+N% 받는 화염 피해 증가', water_damage:'+N% 받는 물 피해 증가',
    ice_damage:'+N% 받는 빙결 피해 증가', earth_damage:'+N% 받는 대지 피해 증가',
    wind_damage:'+N% 받는 바람 피해 증가', lightning_damage:'+N% 받는 번개 피해 증가',
    light_damage:'+N% 받는 빛 피해 증가', dark_damage:'+N% 받는 암흑 피해 증가',
  };
  const TRAIT_BUFF_DESC = {
    physical_damage:'+N% 물리 피해', magic_damage:'+N% 마법 피해',
    fire_damage:'+N% 화염 피해', water_damage:'+N% 물 피해',
    ice_damage:'+N% 빙결 피해', earth_damage:'+N% 대지 피해',
    wind_damage:'+N% 바람 피해', lightning_damage:'+N% 번개 피해',
    light_damage:'+N% 빛 피해', dark_damage:'+N% 암흑 피해',
    crit_chance:'+N% 치확', crit_damage:'+N% 치피',
    physical_defense:'+N% 물리 방어', magic_defense:'+N% 마법 방어',
    pdef_flat:'물리방어력 +N', mdef_flat:'마법방어력 +N',
    fire_resist:'+N% 불 저항', water_resist:'+N% 물 저항',
    ice_resist:'+N% 얼음 저항', earth_resist:'+N% 대지 저항',
    wind_resist:'+N% 바람 저항', lightning_resist:'+N% 전기 저항',
    light_resist:'+N% 빛 저항', dark_resist:'+N% 암흑 저항',
    poison_apply:'독 부여 +N%', bleed_apply:'출혈 부여 +N%',
    burn_apply:'화상 부여 +N%', curse_apply:'저주 부여 +N%',
    stun_apply:'기절 부여 +N%', bind_apply:'속박 부여 +N%',
    sleep_apply:'수면 부여 +N%', silence_apply:'침묵 부여 +N%',
    slow_apply:'둔화 부여 +N%', blind_apply:'실명 부여 +N%',
    freeze_apply:'빙결 부여 +N%', paralyze_apply:'마비 부여 +N%',
    poison_resist:'독 저항 +N%', bleed_resist:'출혈 저항 +N%',
    burn_resist:'화상 저항 +N%', curse_resist:'저주 저항 +N%',
    stun_resist:'기절 저항 +N%', bind_resist:'속박 저항 +N%',
    sleep_resist:'수면 저항 +N%', silence_resist:'침묵 저항 +N%',
    slow_resist:'둔화 저항 +N%', blind_resist:'실명 저항 +N%',
    freeze_resist:'빙결 저항 +N%', paralyze_resist:'마비 저항 +N%',
    healing_done:'+N% 치유량', healing_received:'+N% 받는 치유량',
    shield_effect:'+N% 보호막 효과',
    threat_up:'+N% 위협 증가', threat_down:'+N% 위협 감소',
    stat_str_up:'STR +N', stat_con_up:'CON +N', stat_int_up:'INT +N',
    stat_agi_up:'AGI +N', stat_sense_up:'SENSE +N',
  };
  // 하위호환: SPECIAL_MATERIAL_EFFECTS 구조 유지 (스킬/장비 에디터 UI 등에서 사용)
  const SPECIAL_MATERIAL_EFFECTS = (function() {
    // 이전 _up 접미사 ID → 통합 trait ID 매핑
    const legacyMap = {
      physical_damage_up:'physical_damage', magic_damage_up:'magic_damage',
      fire_damage_up:'fire_damage', ice_damage_up:'ice_damage',
      lightning_damage_up:'lightning_damage', dark_damage_up:'dark_damage',
      water_damage_up:'water_damage', earth_damage_up:'earth_damage',
      wind_damage_up:'wind_damage', light_damage_up:'light_damage',
      crit_chance_up:'crit_chance', crit_damage_up:'crit_damage',
      physical_defense_up:'physical_defense', magic_defense_up:'magic_defense',
      healing_up:'healing_done', shield_up:'shield_effect',
    };
    // 통합 특성 목록에서 자동 생성 (장비특성 58종 전체를 특수효과로 사용 가능)
    const result = [];
    // 기존 EQUIP_TRAIT_TYPES에서 참조할 수 있도록 lazy init (EQUIP_TRAIT_TYPES는 아래에 정의됨)
    // → 58종 전부를 특수효과 선택지로 제공
    return { _legacyMap: legacyMap, _result: result, _init: false };
  })();
  // lazy init: EQUIP_TRAIT_TYPES 정의 후 호출
  function initSpecialMaterialEffects() {
    if (SPECIAL_MATERIAL_EFFECTS._init) return;
    SPECIAL_MATERIAL_EFFECTS._init = true;
    const arr = SPECIAL_MATERIAL_EFFECTS._result;
    arr.length = 0;
    (typeof EQUIP_TRAIT_TYPES !== 'undefined' ? EQUIP_TRAIT_TYPES : []).forEach(tid => {
      const label = (typeof EQUIP_TRAIT_LABELS !== 'undefined' ? EQUIP_TRAIT_LABELS[tid] : tid) || tid;
      const entry = { id:tid, label:label, buffDesc: TRAIT_BUFF_DESC[tid] || ('+N% ' + label), category:'offense' };
      if (TRAIT_CAN_DEBUFF[tid]) { entry.canDebuff = true; entry.debuffDesc = TRAIT_DEBUFF_DESC[tid] || ('+N% 받는 ' + label); }
      arr.push(entry);
    });
  }
  // ID 변환: 레거시 _up ID → 통합 trait ID
  function normalizeTraitId(id) {
    if (!id) return id;
    const m = SPECIAL_MATERIAL_EFFECTS._legacyMap;
    return m[id] || id;
  }
  function getSpecialMaterialEffectById(id) {
    initSpecialMaterialEffects();
    const nid = normalizeTraitId(id);
    return SPECIAL_MATERIAL_EFFECTS._result.find(e => e.id === nid) || SPECIAL_MATERIAL_EFFECTS._result.find(e => e.id === id);
  }
  function smeOptionsHtml(selectedId, type) {
    initSpecialMaterialEffects();
    const list = type === 'debuff' ? SPECIAL_MATERIAL_EFFECTS._result.filter(e => e.canDebuff) : SPECIAL_MATERIAL_EFFECTS._result;
    const nid = normalizeTraitId(selectedId);
    return '<option value="" ' + (!nid ? 'selected' : '') + '>(선택)</option>' +
      list.map(e => '<option value="' + e.id + '"' + (nid === e.id ? ' selected' : '') + '>' + escapeHtml(e.label + (type === 'debuff' && e.canDebuff ? ' → 받는 ' + e.label : '')) + '</option>').join('');
  }

const ELEMENTS = DAMAGE_ELEMENTS;
const SPECIES_LABELS = { undead:'언데드', ghost:'고스트', beast:'야수', plant:'식물', slime:'슬라임', construct:'구조체', elemental:'정령', demon:'악마', frost:'빙정', celestial:'천사체' };
const SPECIES_KEY_BY_LABEL = Object.fromEntries(Object.entries(SPECIES_LABELS).map(([k,v]) => [v, k]));
const PICKAXE_WEIGHT_G = 2500;
const EQUIP_WEIGHT_G = { weapon:1000, subweapon:1000, armor:1000, accessory:200 };
const GATE_SIZE_META = {
  small:{ key:'small', label:'소형', nodes:[7,10], normal:[20,25], elite:[1,1], boss:[1,1], veins:[0,2], previewNormal:[4,5], previewElite:[0,1], previewBossChance:0.02, options:4 },
  medium:{ key:'medium', label:'중형', nodes:[11,15], normal:[50,60], elite:[2,3], boss:[1,1], veins:[1,3], previewNormal:[5,7], previewElite:[1,1], previewBossChance:0.05, options:4 },
  large:{ key:'large', label:'대형', nodes:[18,23], normal:[100,125], elite:[4,6], boss:[1,2], veins:[2,5], previewNormal:[6,8], previewElite:[1,2], previewBossChance:0.1, options:4 }
};
const GATE_SIZE_WEIGHTS = [['small',55],['medium',35],['large',10]];
const GATE_RANK_WEIGHTS = {
  small:[['E',50],['D',26],['C',13],['B',5],['A',3],['S',3]],
  medium:[['E',5],['D',30],['C',33],['B',18],['A',9],['S',5]],
  large:[['E',2],['D',5],['C',25],['B',30],['A',24],['S',14]]
};
const GATE_SPECIES_COMPAT = {
  undead:['ghost','elemental','demon'],
  ghost:['undead','elemental','demon','celestial'],
  beast:['elemental','plant'],
  plant:['slime','elemental','beast'],
  slime:['plant','elemental'],
  construct:['elemental','frost'],
  elemental:['construct','beast','plant','slime','ghost','undead','demon','frost','celestial'],
  demon:['undead','ghost','elemental'],
  frost:['elemental','construct'],
  celestial:['elemental','ghost']
};
const GATE_NAME_PARTS = {
  undead:{ adjectives:['썩은','장송의','침잠한','무너진','흑빛의'], places:['골목','묘역','회랑','납골당','안치소'] },
  ghost:{ adjectives:['울부짖는','희미한','찢어진','속삭이는','식어붙은'], places:['골목','영안실','장막','회랑','빈터'] },
  beast:{ adjectives:['포효하는','사나운','피비린내 나는','굶주린','거친'], places:['수렵장','초원','폐허','능선','사냥터'] },
  plant:{ adjectives:['뒤틀린','뿌리내린','가시돋친','포자 낀','메마른'], places:['온실','정원','수림','회랑','습지'] },
  slime:{ adjectives:['끈적한','젖은','출렁이는','탁한','미끌거리는'], places:['수로','늪지','웅덩이','습지','저수실'] },
  construct:{ adjectives:['과충전된','녹슨','경보 울리는','비정상 가동의','벼락 새긴'], places:['송전실','정거장','격납고','기계묘지','철탑군'] },
  elemental:{ adjectives:['갈라진','타오르는','서리 맺힌','범람하는','번쩍이는'], places:['균열','핵심부','심장부','파편역','층계'] },
  demon:{ adjectives:['타락한','암흑의','불타는','저주받은','사악한'], places:['화염구','지옥문','마계','암흑사원','불의제단'] },
  frost:{ adjectives:['얼어붙은','냉혹한','동결된','서리내린','극한의'], places:['빙궁','동토','설산','빙하','냉기굴'] },
  celestial:{ adjectives:['성스러운','빛나는','정화의','축복받은','신성한'], places:['신전','광명탑','성역','천상문','빛의성소'] }
};
const GATE_COMBO_PLACES = {
  'ghost+undead':['썩은 골목','영곡 회랑','침잠한 안치소','묘역 틈새'],
  'plant+slime':['잠긴 온실','수액 정원','포자 습지','출렁이는 화단'],
  'construct+elemental':['깨진 송전소','과부하 격납고','벼락 파편역','방전 심장부'],
  'beast+elemental':['울부짖는 초원','폭풍 수렵장','갈라진 능선','재해 사냥터'],
  'beast+plant':['가시 수렵장','피비린내 나는 수림','뒤틀린 초원','뿌리 돋은 사냥터'],
  'elemental+ghost':['얼어붙은 예배당','비명 핵심부','그림자 파편역','서리 장막'],
  'elemental+slime':['범람하는 수로','청람의 습지','미끌거리는 균열','출렁이는 핵실'],
  'demon+undead':['타락한 묘역','지옥의 안치소','불타는 골목','암흑 납골당'],
  'demon+ghost':['사악한 장막','불타는 영안실','저주의 회랑','암흑 빈터'],
  'demon+elemental':['불타는 핵심부','마염의 균열','타락한 심장부','화염 파편역'],
  'elemental+frost':['서리 균열','냉기 핵심부','동결된 파편역','빙하 심장부'],
  'construct+frost':['얼어붙은 격납고','냉기 송전실','동결 기계묘지','서리 철탑군'],
  'celestial+elemental':['빛나는 균열','성광 핵심부','신성한 파편역','축복의 심장부'],
  'celestial+ghost':['정화의 장막','빛의 영안실','성스러운 회랑','신성한 빈터']
};
const ROOM_UNIT_LIMITS = { small:[3,5], medium:[4,7], large:[6,10] };
const GATE_STAGE_TEMPLATES = {
  small:[
    { kind:'room', type:'passage' },
    { kind:'room', type:'combat' },
    { kind:'choice', options:['combat','puzzle','trap'] },
    { kind:'room', type:'combat' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'elite' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'boss' }
  ],
  medium:[
    { kind:'room', type:'passage' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'combat' },
    { kind:'choice', options:['elite','puzzle'] },
    { kind:'room', type:'combat' },
    { kind:'room', type:'camp' },
    { kind:'room', type:'elite' },
    { kind:'room', type:'combat' },
    { kind:'choice', options:['elite','trap','puzzle'] },
    { kind:'room', type:'combat' },
    { kind:'room', type:'elite' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'boss' }
  ],
  large:[
    { kind:'room', type:'passage' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'combat' },
    { kind:'choice', options:['elite','puzzle'] },
    { kind:'room', type:'combat' },
    { kind:'room', type:'elite' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'camp' },
    { kind:'choice', options:['elite','trap','puzzle'] },
    { kind:'room', type:'combat' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'elite' },
    { kind:'room', type:'combat' },
    { kind:'choice', options:['elite','combat','puzzle'] },
    { kind:'room', type:'combat' },
    { kind:'room', type:'elite' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'combat' },
    { kind:'room', type:'passage' },
    { kind:'room', type:'boss' }
  ]
};
// ── 주거 보관함 평수 티어 ──────────────────────────────────────────────────
const HOME_STORAGE_TIERS = [
  { maxPyeong: 10, storages: [
    { name:'2도어냉장고', type:'식량', maxSlots:8,  maxWeightKg:20 },
    { name:'장비거치대',   type:'장비', maxSlots:4 },
    { name:'재료보관함',   type:'재료', maxSlots:10 },
    { name:'기타보관함',   type:'기타', maxSlots:10 }
  ]},
  { maxPyeong: 20, storages: [
    { name:'4도어냉장고', type:'식량', maxSlots:16, maxWeightKg:40 },
    { name:'장비진열대',   type:'장비', maxSlots:8 },
    { name:'재료수납함',   type:'재료', maxSlots:20 },
    { name:'기타수납함',   type:'기타', maxSlots:20 }
  ]},
  { maxPyeong: 30, storages: [
    { name:'800L대형냉장고', type:'식량', maxSlots:26, maxWeightKg:80 },
    { name:'장비전용미니방',   type:'장비', maxSlots:16 },
    { name:'작은창고방(재료)', type:'재료', maxSlots:40 },
    { name:'다락방(기타)',     type:'기타', maxSlots:40 }
  ]},
  { maxPyeong: Infinity, storages: [
    { name:'1200L초대형냉장고', type:'식량', maxSlots:40, maxWeightKg:120 },
    { name:'장비방',             type:'장비', maxSlots:30 },
    { name:'창고방(재료)',       type:'재료', maxSlots:40 },
    { name:'창고방(기타)',       type:'기타', maxSlots:40 }
  ]}
];
function parseAreaPyeong(areaStr) {
  const m = String(areaStr || '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
function getStorageTier(pyeong) {
  if (pyeong <= 0) pyeong = 10;
  for (const tier of HOME_STORAGE_TIERS) { if (pyeong <= tier.maxPyeong) return tier; }
  return HOME_STORAGE_TIERS[HOME_STORAGE_TIERS.length - 1];
}
function buildDefaultStoragesForArea(areaStr) {
  const pyeong = parseAreaPyeong(areaStr);
  const tier = getStorageTier(pyeong);
  return tier.storages.map(s => ({
    id: `storage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    name: s.name, type: s.type, maxSlots: s.maxSlots || 99,
    maxWeightKg: s.maxWeightKg || 0, items: []
  }));
}
// ── 주거 월세 헬퍼 ─────────────────────────────────────────────────────────
function formatYM(y, m) { return `${y}-${String(m).padStart(2,'0')}`; }
function prevMonth(y, m) { return m <= 1 ? { year: y-1, month: 12 } : { year: y, month: m-1 }; }
function monthDiff(y1,m1,y2,m2) { return (y2 - y1) * 12 + (m2 - m1); }
const GATE_SECRET_DISCOVER_CHANCE = 0.30;
const GATE_PUZZLE_ELITE_REWARD_CHANCE = 0.50;
const RARE_TRAIT_LABELS = {
  // ── snake_case IDs (재료 JSON 기준 35개) ──────────────────────────────
  physical_damage:'물리 피해 증가', magic_damage:'마법 피해 증가',
  fire_damage:'불 속성 피해 증가', water_damage:'물 속성 피해 증가',
  ice_damage:'얼음 속성 피해 증가', earth_damage:'대지 속성 피해 증가',
  wind_damage:'바람 속성 피해 증가', lightning_damage:'전기 속성 피해 증가',
  light_damage:'빛 속성 피해 증가', dark_damage:'어둠 속성 피해 증가',
  crit_chance:'치명타 확률 증가', crit_damage:'치명타 피해 증가',
  physical_defense:'물리피해감소 증가', magic_defense:'마법피해감소 증가',
  fire_resist:'불 속성 저항', water_resist:'물 속성 저항',
  ice_resist:'얼음 속성 저항', earth_resist:'대지 속성 저항',
  wind_resist:'바람 속성 저항', lightning_resist:'전기 속성 저항',
  light_resist:'빛 속성 저항', dark_resist:'어둠 속성 저항',
  poison_apply:'독 부여 확률 증가', bleed_apply:'출혈 부여 확률 증가',
  burn_apply:'화상 부여 확률 증가', curse_apply:'저주 부여 확률 증가',
  poison_resist:'독 저항', bleed_resist:'출혈 저항',
  burn_resist:'화상 저항', curse_resist:'저주 저항',
  healing_done:'치유량 증가', healing_received:'받는 치유량 증가',
  shield_effect:'보호막 효과 증가',
  threat_up:'위협 수치 증가', threat_down:'위협 수치 감소',
  // ── 구버전 camelCase 패밀리 (하위 호환) ─────────────────────────────
  physicalDamage:'물리 피해 증가', magicDamage:'마법 피해 증가',
  elementalDamage:'속성 피해 증가', physicalDefense:'물리피해감소 증가',
  magicDefense:'마법피해감소 증가', elementalDefense:'속성 저항',
  increasedHealing:'치유 증가',
};
const MANA_STONE_LABELS = { E:'최하급 마정석', D:'하급 마정석', C:'중급 마정석', B:'중상급 마정석', A:'상급 마정석', S:'최상급 마정석' };
// Settlement price tables ─────────────────────────────────────────────────────
// 마정석: 1% 순도당 원화 가치
const MANA_STONE_WON_PER_PCT = { E:1000, D:6000, C:60000, B:900000, A:25000000, S:1000000000 };
// 일반재료 가격 범위 — 랜덤 설정
const NORMAL_MATERIAL_WON_RANGE = { E:[2000,4000], D:[10000,20000], C:[100000,200000], B:[1500000,3000000], A:[40000000,80000000], S:[1750000000,3250000000] };
function normalMaterialBaseWon(rank) { const r = String(rank||'E').toUpperCase(); const range = NORMAL_MATERIAL_WON_RANGE[r] || NORMAL_MATERIAL_WON_RANGE.E; return randInt(range[0], range[1]); }
const NORMAL_MATERIAL_BASE_WON = { E:3000, D:15000, C:150000, B:2250000, A:60000000, S:2500000000 }; // legacy fallback
// 희귀재료 등급·티어별 기준가 (JSON suggestedPrice를 런타임에 덮어씀)
// E:6.25만~18.75만 / D:37.5만~112.5만 / C:375만~1,125만 / B:5,500만~1.7억 / A:13.75억~45억 / S:62.5억~1,875억
const RARE_PRICE_BY_RANK_TIER = {
  E: { tier1:187500,        tier2:150000,        tier3:100000,        tier4:62500        },
  D: { tier1:1125000,       tier2:900000,        tier3:600000,        tier4:375000       },
  C: { tier1:11250000,      tier2:9000000,       tier3:6000000,       tier4:3750000      },
  B: { tier1:170000000,     tier2:130000000,     tier3:85000000,      tier4:55000000     },
  A: { tier1:4500000000,    tier2:3500000000,    tier3:2250000000,    tier4:1375000000   },
  S: { tier1:187500000000,  tier2:100000000000,  tier3:37500000000,   tier4:6250000000   },
};
// fallback (tier3 중앙값)
const RARE_MATERIAL_BASE_WON = { E:100000, D:600000, C:6000000, B:85000000, A:2250000000, S:37500000000 };
// 희귀재료 티어별 가격 조회 헬퍼
function getRareMatTierPrice(rank, traitId) {
  const tier = TRAIT_TIER_MAP[traitId] || 3;
  const tierKey = `tier${tier}`;
  const tierPrices = RARE_PRICE_BY_RANK_TIER[String(rank||'E').toUpperCase()] || RARE_PRICE_BY_RANK_TIER.E;
  return tierPrices[tierKey] || (RARE_MATERIAL_BASE_WON[rank] || RARE_MATERIAL_BASE_WON.E);
}
// 세금 및 수수료 (협회 정산 기준)
const ASSOC_TAX_RATE      = 0.033; // 원천세 3.3%
const ASSOC_FEE_RATE      = 0.017; // 협회 수수료 1.7%
const ASSOC_TOTAL_RATE    = ASSOC_TAX_RATE + ASSOC_FEE_RATE; // 5.0%
const GUILD_TAX_RATE      = 0.033; // 원천세 3.3% (길드가 법인세로 대신 납부)
// 장비 바이아웃 비율
const GEAR_BUYOUT_ASSOC   = 0.85;
const GEAR_BUYOUT_GUILD   = 0.90;
// 월 소득세 구간 (누진공제 포함)
const MONTHLY_INCOME_TAX_BRACKETS = [
  { limit: 1000000,    rate: 0.06,  deduction: 0         },
  { limit: 4000000,    rate: 0.15,  deduction: 90000     },
  { limit: 7500000,    rate: 0.24,  deduction: 450000    },
  { limit: 12500000,   rate: 0.35,  deduction: 1275000   },
  { limit: 25000000,   rate: 0.38,  deduction: 1650000   },
  { limit: 42000000,   rate: 0.40,  deduction: 2150000   },
  { limit: 85000000,   rate: 0.42,  deduction: 2990000   },
  { limit: Infinity,   rate: 0.45,  deduction: 5540000   },
];

// ── EXP / Level System ────────────────────────────────────────────────────────
// EXP needed to reach next level: (level^2 * 10) + 100
const EXP_BASE_BY_RANK = { E:2, D:10, C:40, B:120, A:250, S:400 };
// Elite: ×20~40, Boss: ×100~200 (random roll applied per kill)
const EXP_KIND_MULT_RANGE = {
  Normal:  [1,  1  ],
  Elite:   [20, 40 ],
  Boss:    [100,200],
};
const EXP_MAX_LEVEL = 120;
const MAX_LEVEL_BY_RANK = { E:15, D:25, C:40, B:60, A:80, S:120 };

// ── Equipment System ──────────────────────────────────────────────────────────
// Equipment part types
const EQUIP_PARTS = ['weapon','subweapon','armor','accessory'];
const ALL_EQUIP_SLOTS = ['weapon','subweapon','armor','accessory','bag'];
const EQUIP_PART_LABELS = { weapon:'무기', subweapon:'보조무기', armor:'방어구', accessory:'악세서리', bag:'가방' };

// Base price range [min, max] by rank at +0 (₩)
const EQUIP_PRICE_RANGE = {
  E: [250000,    750000     ],
  D: [1500000,   4500000    ],
  C: [15000000,  45000000   ],
  B: [225000000, 675000000  ],
  A: [5500000000,18000000000],
  S: [250000000000, 750000000000],
};
// Price multiplier range by part [min, max] — 드랍/경매 생성시 범위 내 랜덤, 참조가격은 max 사용
const EQUIP_PART_PRICE_MUL = { weapon:[0.8,1.0], armor:[0.6,0.75], subweapon:[0.4,0.55], accessory:[0.25,0.40] };
// Skill book: ×5 equipment price
const SKILL_BOOK_PRICE_MUL = 5;
// Skill book tier assignment by category (T1=best performance, T4=utility)
// T1: aoeAttack, aoeCC — game-changing AoE skills
// T2: singleAttack, singleCC — strong single-target combat
// T3: aoeHeal, buff — team support skills
// T4: singleHeal, passive, utility — utility/passive skills
const SKILL_BOOK_TIERS = {
  aoeAttack: 1, aoeCC: 1,
  singleAttack: 2, singleCC: 2,
  aoeHeal: 3, buff: 3,
  singleHeal: 4, passive: 4, utility: 4
};
// Skillbook price = reference equipment price × SKILL_BOOK_PRICE_MUL
// Tier determines which part's price to use: T1=weapon, T2=armor, T3=subweapon, T4=accessory
const SKILL_BOOK_TIER_PART = { 1:'weapon', 2:'armor', 3:'subweapon', 4:'accessory' };
function calcSkillBookPrice(rank, tier) {
  const part = SKILL_BOOK_TIER_PART[tier] || 'accessory';
  return Math.round(calcEquipBasePrice(rank, part) * SKILL_BOOK_PRICE_MUL);
}

// Max enhancement by part
const EQUIP_MAX_ENHANCE = { weapon:5, subweapon:0, armor:5, accessory:5 };
// Enhancement ATK bonus per level by rank (weapons)
const WEAPON_ENHANCE_ATK = { E:1, D:1, C:2, B:3, A:4, S:5 };
// Base weapon ATK by rank
const WEAPON_BASE_ATK = { E:5, D:15, C:25, B:45, A:70, S:100 };
// Armor base stats (main stat per enhance, armor 물리방어/마법방어 range, resistance → 물리피해감소/마법피해감소)
const ARMOR_STAT_BY_RANK = {
  E: { totalStatSum:0,  defRange:[0,5],   resistance:1, enhanceStat:1 },
  D: { totalStatSum:2,  defRange:[0,15],  resistance:2, enhanceStat:2 },
  C: { totalStatSum:5,  defRange:[0,40],  resistance:3, enhanceStat:3 },
  B: { totalStatSum:8,  defRange:[0,75],  resistance:5, enhanceStat:4 },
  A: { totalStatSum:11, defRange:[0,100], resistance:7, enhanceStat:5 },
  S: { totalStatSum:16, defRange:[0,200], resistance:10,enhanceStat:6 },
};
// Armor subtypes: different defense multipliers, stat pools, and stat bonus modifiers
const ARMOR_SUBTYPES = {
  heavy:   { label:'중갑',   defMul:[0.90,1.00], statPool:['con','str'], atkMul:-0.10, statBonusMul:0 },
  light:   { label:'경갑',   defMul:[0.70,0.80], statPool:['con','str','agi'], atkMul:0, statBonusMul:0 },
  leather: { label:'가죽갑', defMul:[0.50,0.60], statPool:['str','agi','int','sense'], atkMul:0, statBonusMul:0.10 },
  robe:    { label:'로브',   defMul:[0.40,0.50], statPool:['agi','int','sense'], atkMul:0, statBonusMul:0.20 }
};
const ARMOR_SUBTYPE_KEYS = ['heavy','light','leather','robe'];

// ── 장비 이름 생성 테이블 ──────────────────────────────────────────────────────
const EQUIP_RANK_PREFIX = {
  E: ['낡은','조악한','투박한','해진','흠집난','허름한'],
  D: ['평범한','실용적인','손질된','무난한','균형잡힌'],
  C: ['정교한','견고한','세련된','숙련된','우수한'],
  B: ['희귀한','탁월한','고급','뛰어난','정예의'],
  A: ['영웅의','고결한','위엄의','찬란한','축복받은'],
  S: ['전설의','신화의','초월한','불멸의','천상의']
};
const EQUIP_NAME_SUFFIXES = {
  weapon: ['검','대검','창','활','대궁','석궁','완드','지팡이','로드','도끼','쌍검','단검','레이피어','총','저격총','권갑','스파이크','투창','투척단검'],
  subweapon: ['방패','화살','수정구','예비단검','신발','장갑','보호대'],
  accessory: ['귀걸이','반지','목걸이','벨트','표식'],
  armor_heavy: ['강철갑옷','판금갑옷','백은중갑','중갑'],
  armor_light: ['사슬갑옷','전술경갑','백은경갑','경갑'],
  armor_leather: ['기동조끼','가죽외피','사냥꾼조끼','가죽갑옷'],
  armor_robe: ['로브','예복','법의','마도복']
};
function generateEquipName(rank, part, armorSubtypeKey, traitLabel, forcedSuffix) {
  const prefixes = EQUIP_RANK_PREFIX[rank] || EQUIP_RANK_PREFIX.E;
  let prefix;
  if (part === 'weapon' && rank === 'E') {
    prefix = '협회지급';
  } else {
    prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  }
  let suff;
  if (forcedSuffix) {
    suff = forcedSuffix;
  } else {
    let suffKey = part;
    if (part === 'armor' && armorSubtypeKey) suffKey = 'armor_' + armorSubtypeKey;
    const suffArr = EQUIP_NAME_SUFFIXES[suffKey] || EQUIP_NAME_SUFFIXES[part] || [part];
    suff = suffArr[Math.floor(Math.random() * suffArr.length)];
  }
  return `${prefix} ${suff}${traitLabel ? ` [${traitLabel}]` : ''}`;
}

// Accessory base stats by rank
const ACCESSORY_STAT_BY_RANK = {
  E: { totalStatSum:0,   traits:1, enhanceStat:1 },
  D: { totalStatSum:1,   traits:1, enhanceStat:2 },
  C: { totalStatSum:3,   traits:1, enhanceStat:3 },
  B: { totalStatSum:5,   traits:1, enhanceStat:4 },
  A: { totalStatSum:8,   traits:1, enhanceStat:5 },
  S: { totalStatSum:12,  traits:1, enhanceStat:6 },
};
// Shield: 물리방어 = half armor value; ATK = -(물리방어/2)
const SUBWEAPON_DEF_RATIO = 0.5;
// Max infusion by part
const EQUIP_MAX_INFUSE = { weapon:2, subweapon:2, armor:2, accessory:1 };

// Repair fee base price per 1% durability lost (₩) — Weapon is ×2
const REPAIR_FEE_BASE = { E:0, D:10000, C:100000, B:1000000, A:20000000, S:750000000 };

// ── 전투 내구도 소모량 ──────────────────────────────────────────────────────────
const DURABILITY_COST = {
  weaponBasicAttack: 0.3,
  weaponSkillAttack: 0.6,
  armorHit: 0.4,
  shieldHit: 0.5,
  subweaponAttack: 0.3,
  subweaponSkill: 0.6,
  accessoryAction: 0.3
};

// ── 대장간 강화 시스템 ──────────────────────────────────────────────────────────
// 강화 재료: 같은 등급 마정석 순도 80~100%
// 순도별 성공률 (80%→70%, 85%→77.5%, 90%→85%, 95%→90%, 100%→95%)
// 수수료: 마정석 시세 × 25%
function calcForgeSuccessRate(purity) {
  const p = Math.max(80, Math.min(100, Number(purity || 80)));
  // 선형 보간: purity 80→70%, 90→85%, 100→95%
  // 80~90 구간: 70~85 (slope: 1.5%/%purity), 90~100 구간: 85~95 (slope: 1.0%/%purity)
  if (p <= 90) return (70 + (p - 80) * 1.5) / 100;
  return (85 + (p - 90) * 1.0) / 100;
}
function calcForgeFee(rank, purity) {
  const wonPerPct = MANA_STONE_WON_PER_PCT[rank] || MANA_STONE_WON_PER_PCT.E;
  const stoneValue = wonPerPct * Number(purity || 80);
  return Math.round(stoneValue * 0.25);
}
function calcForgeEnhancedUsedPrice(basePrice, enhance, part, rank) {
  // 강화된 장비의 중고 판매가:
  // 강화 보정된 기준가에서 "사용된 강화 장비" 할인 (최대내구도 99, 현재내구도 99 가정 → ~68.6%)
  const enhanced = calcEquipEnhancedPrice(basePrice, enhance, rank || 'E');
  return Math.round(enhanced * calcUsedEquipConditionMul(99, 99));
}

// 통합 특성 목록 (58종 = 기존 37종 + 스탯 5종 + 상태이상 부여/저항 16종)
const EQUIP_TRAIT_TYPES = [
  // 공격
  'physical_damage','magic_damage',
  'fire_damage','water_damage','ice_damage','earth_damage',
  'wind_damage','lightning_damage','light_damage','dark_damage',
  'crit_chance','crit_damage',
  // 방어
  'physical_defense','magic_defense',
  'pdef_flat','mdef_flat',
  'fire_resist','water_resist','ice_resist','earth_resist',
  'wind_resist','lightning_resist','light_resist','dark_resist',
  // 상태이상 부여 (12종)
  'poison_apply','bleed_apply','burn_apply','curse_apply',
  'stun_apply','bind_apply','sleep_apply','silence_apply',
  'slow_apply','blind_apply','freeze_apply','paralyze_apply',
  // 상태이상 저항 (12종)
  'poison_resist','bleed_resist','burn_resist','curse_resist',
  'stun_resist','bind_resist','sleep_resist','silence_resist',
  'slow_resist','blind_resist','freeze_resist','paralyze_resist',
  // 지원
  'healing_done','healing_received','shield_effect','threat_up','threat_down',
  // 스탯
  'stat_str_up','stat_con_up','stat_int_up','stat_agi_up','stat_sense_up',
];
// 희귀(tier1-2) / 일반(tier3-4) 특성 풀 — 경매장 80/20 비율 제어용
const RARE_TRAIT_POOL = EQUIP_TRAIT_TYPES.filter(t => (TRAIT_TIER_MAP[t] || 3) <= 2);
const NORMAL_TRAIT_POOL = EQUIP_TRAIT_TYPES.filter(t => (TRAIT_TIER_MAP[t] || 3) > 2);
const EQUIP_TRAIT_LABELS = {
  // snake_case (58종 전체)
  physical_damage:'물리 피해 증가', magic_damage:'마법 피해 증가',
  fire_damage:'불 속성 피해 증가', water_damage:'물 속성 피해 증가',
  ice_damage:'얼음 속성 피해 증가', earth_damage:'대지 속성 피해 증가',
  wind_damage:'바람 속성 피해 증가', lightning_damage:'전기 속성 피해 증가',
  light_damage:'빛 속성 피해 증가', dark_damage:'어둠 속성 피해 증가',
  crit_chance:'치명타 확률 증가', crit_damage:'치명타 피해 증가',
  physical_defense:'물리피해감소 증가', magic_defense:'마법피해감소 증가',
  pdef_flat:'물리방어력 증가', mdef_flat:'마법방어력 증가',
  fire_resist:'불 속성 저항', water_resist:'물 속성 저항',
  ice_resist:'얼음 속성 저항', earth_resist:'대지 속성 저항',
  wind_resist:'바람 속성 저항', lightning_resist:'전기 속성 저항',
  light_resist:'빛 속성 저항', dark_resist:'어둠 속성 저항',
  poison_apply:'독 부여 확률 증가', bleed_apply:'출혈 부여 확률 증가',
  burn_apply:'화상 부여 확률 증가', curse_apply:'저주 부여 확률 증가',
  stun_apply:'기절 부여 확률 증가', bind_apply:'속박 부여 확률 증가',
  sleep_apply:'수면 부여 확률 증가', silence_apply:'침묵 부여 확률 증가',
  slow_apply:'둔화 부여 확률 증가', blind_apply:'실명 부여 확률 증가',
  freeze_apply:'빙결 부여 확률 증가', paralyze_apply:'마비 부여 확률 증가',
  poison_resist:'독 저항', bleed_resist:'출혈 저항',
  burn_resist:'화상 저항', curse_resist:'저주 저항',
  stun_resist:'기절 저항', bind_resist:'속박 저항',
  sleep_resist:'수면 저항', silence_resist:'침묵 저항',
  slow_resist:'둔화 저항', blind_resist:'실명 저항',
  freeze_resist:'빙결 저항', paralyze_resist:'마비 저항',
  healing_done:'치유량 증가', healing_received:'받는 치유량 증가',
  shield_effect:'보호막 효과 증가',
  threat_up:'위협 수치 증가', threat_down:'위협 수치 감소',
  stat_str_up:'STR 증가', stat_con_up:'CON 증가', stat_int_up:'INT 증가',
  stat_agi_up:'AGI 증가', stat_sense_up:'SENSE 증가',
  // 구버전 camelCase (하위 호환)
  physicalDamage:'물리 피해', magicDamage:'마법 피해', elementalDamage:'속성 피해',
  physicalDefense:'물리피해감소', magicDefense:'마법피해감소', elementalDefense:'속성 저항',
  increasedHealing:'치유 증가'
};
// SPECIAL_MATERIAL_EFFECTS lazy init 트리거
initSpecialMaterialEffects();
// Trait effect % by rank — fallback for legacy camelCase traits not in the pack
const EQUIP_TRAIT_EFFECT_PCT = {
  E: 3, D: 5, C: 8, B: 12, A: 18, S: 25
};
// Helper: get trait display string with % effect for a given rank.
// Uses per-scale values from DEFAULT_RARE_MATERIAL_PACK when available (snake_case IDs),
// falls back to flat EQUIP_TRAIT_EFFECT_PCT for legacy camelCase traits.
function equipTraitDisplay(traitId, rank) {
  const label = EQUIP_TRAIT_LABELS[traitId] || traitId;
  // Try pack scale values (snake_case IDs)
  const traitDef = (DEFAULT_RARE_MATERIAL_PACK.traits || []).find(t => t.id === traitId);
  if (traitDef && traitDef.scale) {
    const scaleTable = (DEFAULT_RARE_MATERIAL_PACK.valueScales || {})[traitDef.scale];
    const val = scaleTable && scaleTable[String(rank || 'E').toUpperCase()];
    if (val != null) {
      // defenseFlat은 고정값이므로 % 대신 + 표시
      if (traitDef.scale === 'defenseFlat') return `${label} +${val}`;
      return `${label} +${val}%`;
    }
  }
  // Fallback for camelCase legacy traits
  const pct = EQUIP_TRAIT_EFFECT_PCT[rank] || 0;
  return pct > 0 ? `${label} +${pct}%` : label;
}

// Helper: calculate reference base price for an equipment entry (max price — used by editor, shop, settlement fallback)
function calcEquipBasePrice(rank, part) {
  const range = EQUIP_PRICE_RANGE[rank] || EQUIP_PRICE_RANGE.E;
  const maxPrice = range[1];
  const mulRange = EQUIP_PART_PRICE_MUL[part] || [0.4, 0.55];
  return Math.round(maxPrice * mulRange[1]);
}
// Helper: calculate random base price for generated equipment (drop/auction/used — range 내 랜덤)
function calcEquipRandomPrice(rank, part) {
  const range = EQUIP_PRICE_RANGE[rank] || EQUIP_PRICE_RANGE.E;
  const maxPrice = range[1];
  const mulRange = EQUIP_PART_PRICE_MUL[part] || [0.4, 0.55];
  const mul = mulRange[0] + Math.random() * (mulRange[1] - mulRange[0]);
  return Math.round(maxPrice * mul);
}
// Helper: calculate enhanced item market price (new item sold at auction)
// formula: basePrice + enhance × (same-rank 100%-purity mana stone price × 1.30)
function calcEquipEnhancedPrice(basePrice, enhance, rank) {
  if (enhance <= 0) return basePrice;
  const wonPerPct = MANA_STONE_WON_PER_PCT[String(rank || 'E').toUpperCase()] || MANA_STONE_WON_PER_PCT.E;
  const stone100 = wonPerPct * 100; // value of a 100%-purity stone
  return Math.round(basePrice + enhance * stone100 * 1.30);
}
// Helper: used-equipment price multiplier based on maxDurability and current durability.
// maxDur=100(or 초기) → base 70%, maxDur=80(최저) → base 50%, 그 사이는 선형 보간.
// 그 기본 배율에서 현재내구도 비율(dur/maxDur)에 따라 최대 ×0 ~ ×1 범위로 추가 할인.
// 결과: conditionMul ∈ [~0.17, 0.70]
function calcUsedEquipConditionMul(dur, maxDur) {
  const md = Math.max(EQUIP_MAX_DURABILITY_FLOOR, Math.min(100, Number(maxDur ?? 100)));
  // base 배율: maxDur 100→0.70, maxDur 80→0.50 (선형)
  const baseMul = 0.50 + (md - EQUIP_MAX_DURABILITY_FLOOR) / (100 - EQUIP_MAX_DURABILITY_FLOOR) * 0.20;
  // 현재내구도 비율 (0~1)
  const durRatio = md > 0 ? Math.max(0, Math.min(1, Number(dur ?? md) / md)) : 0;
  // durRatio에 따라 base의 60%~100% 사이에서 최종 결정 (완파 시 40% 추가 할인)
  return baseMul * (0.60 + durRatio * 0.40);
}
// Helper: repair fee for a given % durability loss (maxDurability cap applies)
function calcRepairFee(rank, part, lostPct) {
  const base = REPAIR_FEE_BASE[rank] || 0;
  const mul = part === 'weapon' ? 2 : 1;
  return Math.round(base * mul * Math.max(0, lostPct));
}
// Max durability constants
const EQUIP_MAX_DURABILITY_FLOOR = 80; // minimum max durability after many repairs
const EQUIP_MAX_DURABILITY_START = 100;
// Helper: apply "first equip" maxDurability decay (100→99)
function applyFirstEquip(item) {
  if (!item) return item;
  if (item.maxDurability == null) item.maxDurability = EQUIP_MAX_DURABILITY_START;
  if (!item.isUsed) { item.isUsed = true; item.maxDurability = Math.max(EQUIP_MAX_DURABILITY_FLOOR, item.maxDurability - 1); }
  return item;
}
// Helper: apply repair (decrement maxDurability, restore durability to target)
function applyRepair(item, targetDurability) {
  if (!item) return item;
  if (item.maxDurability == null) item.maxDurability = EQUIP_MAX_DURABILITY_START;
  // Each repair reduces max durability by 1 (min 80)
  item.maxDurability = Math.max(EQUIP_MAX_DURABILITY_FLOOR, item.maxDurability - 1);
  item.isUsed = true;
  item.durability = Math.min(item.maxDurability, Math.max(0, Number(targetDurability || item.maxDurability)));
  return item;
}

// Helper: calculate sell price for an inventory item (used in settlement calculator)
// isGuild = true for guild settlement, false for association
function calcInventorySellPrice(it, isGuild) {
  if (!it) return 0;
  if (it.category === 'equipment') {
    const b = Number(it.price || calcEquipBasePrice(it.rank||'E', it.part||'weapon'));
    return Math.floor((it.enhance > 0 ? calcEquipEnhancedPrice(b, it.enhance, it.rank||'E') : b) * (isGuild ? GEAR_BUYOUT_GUILD : GEAR_BUYOUT_ASSOC));
  }
  if (it.category === 'rareMaterial') {
    const r = (it.rank||'E').toUpperCase();
    return (Number(it.suggestedPrice||0) || RARE_MATERIAL_BASE_WON[r] || RARE_MATERIAL_BASE_WON.E) * Number(it.count||1);
  }
  if (it.category === 'manaStone') {
    // rank is it.rank; purity % is stored in it.note (set by manaStoneBucketToInventoryItems)
    const r = (it.rank||'E').toUpperCase();
    const purity = parseInt(it.note||'0', 10);
    return (MANA_STONE_WON_PER_PCT[r] || MANA_STONE_WON_PER_PCT.E) * purity * Number(it.count||1);
  }
  // normalMaterial and everything else
  const r = (it.rank||'E').toUpperCase();
  return (Number(it.suggestedPrice||0) || NORMAL_MATERIAL_BASE_WON[r] || NORMAL_MATERIAL_BASE_WON.E) * Number(it.count||1);
}

const PARTY_BAGS = {
  none:  { id:'none',  name:'가방 없음',         rank:'',  slotBonus:0,  weightMul:1.00, maxWeightBonusG:0 },
  bag_E: { id:'bag_E', name:'E급 기본가방',       rank:'E', slotBonus:8,  weightMul:1.00, maxWeightBonusG:7000 },
  bag_D: { id:'bag_D', name:'D급 멀티백',         rank:'D', slotBonus:12, weightMul:0.95, maxWeightBonusG:10000 },
  bag_C: { id:'bag_C', name:'C급 마정백팩',       rank:'C', slotBonus:16, weightMul:0.90, maxWeightBonusG:15000 },
  bag_B: { id:'bag_B', name:'B급 원정필드백',     rank:'B', slotBonus:20, weightMul:0.85, maxWeightBonusG:20000 },
  bag_A: { id:'bag_A', name:'A급 게이트백팩',     rank:'A', slotBonus:24, weightMul:0.80, maxWeightBonusG:25000 },
  bag_S: { id:'bag_S', name:'S급 마정공간백팩',   rank:'S', slotBonus:28, weightMul:0.70, maxWeightBonusG:30000 },
};
const INVENTORY_BASE_SLOTS = 4;
const INVENTORY_BASE_MAX_WEIGHT_G = 3000;
const PERSONAL_INV_BASE_SLOTS = 8;
const PERSONAL_INV_BASE_MAX_WEIGHT_G = 6000;
const SHARED_INV_BAG_RATIO = 0.20; // 가방 보너스의 20%만 공용인벤에 적용
const NORMAL_MATERIAL_WEIGHT_G = { E:20, D:25, C:30, B:35, A:40, S:50 };
const RARE_MATERIAL_WEIGHT_G = 100;
const MANA_STONE_WEIGHT_G = { E:50, D:80, C:120, B:180, A:300, S:500 };
const CONSUMABLE_WEIGHT_G = { tent:10000, ration:300, water:500, potion:200, convFood:300 };

// ── 물약 카탈로그 (42종) ─────────────────────────────────────────────────────
const POTION_CATALOG = [
  // HP 포션
  { id:'lowest_hp_potion',  name:'최하급 HP 포션',  type:'hp', grade:'최하급', price:10000,       effectValue:50,   effectDuration:0, targetRank:'', weight:200, note:'HP +50' },
  { id:'low_hp_potion',     name:'하급 HP 포션',    type:'hp', grade:'하급',   price:50000,       effectValue:100,  effectDuration:0, targetRank:'', weight:200, note:'HP +100' },
  { id:'mid_hp_potion',     name:'중급 HP 포션',    type:'hp', grade:'중급',   price:500000,      effectValue:150,  effectDuration:0, targetRank:'', weight:200, note:'HP +150' },
  { id:'midhigh_hp_potion', name:'중상급 HP 포션',  type:'hp', grade:'중상급', price:7500000,     effectValue:250,  effectDuration:0, targetRank:'', weight:200, note:'HP +250' },
  { id:'high_hp_potion',    name:'상급 HP 포션',    type:'hp', grade:'상급',   price:200000000,   effectValue:500,  effectDuration:0, targetRank:'', weight:200, note:'HP +500' },
  { id:'highest_hp_potion', name:'최상급 HP 포션',  type:'hp', grade:'최상급', price:5000000000,  effectValue:1000, effectDuration:0, targetRank:'', weight:200, note:'HP +1000' },
  // MP 포션
  { id:'lowest_mp_potion',  name:'최하급 MP 포션',  type:'mp', grade:'최하급', price:10000,       effectValue:50,   effectDuration:0, targetRank:'', weight:200, note:'MP +50' },
  { id:'low_mp_potion',     name:'하급 MP 포션',    type:'mp', grade:'하급',   price:50000,       effectValue:100,  effectDuration:0, targetRank:'', weight:200, note:'MP +100' },
  { id:'mid_mp_potion',     name:'중급 MP 포션',    type:'mp', grade:'중급',   price:500000,      effectValue:150,  effectDuration:0, targetRank:'', weight:200, note:'MP +150' },
  { id:'midhigh_mp_potion', name:'중상급 MP 포션',  type:'mp', grade:'중상급', price:7500000,     effectValue:250,  effectDuration:0, targetRank:'', weight:200, note:'MP +250' },
  { id:'high_mp_potion',    name:'상급 MP 포션',    type:'mp', grade:'상급',   price:200000000,   effectValue:500,  effectDuration:0, targetRank:'', weight:200, note:'MP +500' },
  { id:'highest_mp_potion', name:'최상급 MP 포션',  type:'mp', grade:'최상급', price:5000000000,  effectValue:1000, effectDuration:0, targetRank:'', weight:200, note:'MP +1000' },
  // SP 포션
  { id:'lowest_sp_potion',  name:'최하급 SP 포션',  type:'sp', grade:'최하급', price:10000,       effectValue:50,   effectDuration:0, targetRank:'', weight:200, note:'SP +50' },
  { id:'low_sp_potion',     name:'하급 SP 포션',    type:'sp', grade:'하급',   price:50000,       effectValue:100,  effectDuration:0, targetRank:'', weight:200, note:'SP +100' },
  { id:'mid_sp_potion',     name:'중급 SP 포션',    type:'sp', grade:'중급',   price:500000,      effectValue:150,  effectDuration:0, targetRank:'', weight:200, note:'SP +150' },
  { id:'midhigh_sp_potion', name:'중상급 SP 포션',  type:'sp', grade:'중상급', price:7500000,     effectValue:250,  effectDuration:0, targetRank:'', weight:200, note:'SP +250' },
  { id:'high_sp_potion',    name:'상급 SP 포션',    type:'sp', grade:'상급',   price:200000000,   effectValue:500,  effectDuration:0, targetRank:'', weight:200, note:'SP +500' },
  { id:'highest_sp_potion', name:'최상급 SP 포션',  type:'sp', grade:'최상급', price:5000000000,  effectValue:1000, effectDuration:0, targetRank:'', weight:200, note:'SP +1000' },
  // 해독 포션
  { id:'lowest_antidote',  name:'최하급 해독포션',  type:'antidote', grade:'최하급', price:100000,        effectValue:0, effectDuration:0, targetRank:'E', weight:200, note:'E급 독 해제' },
  { id:'low_antidote',     name:'하급 해독포션',    type:'antidote', grade:'하급',   price:500000,        effectValue:0, effectDuration:0, targetRank:'D', weight:200, note:'D급 독 해제' },
  { id:'mid_antidote',     name:'중급 해독포션',    type:'antidote', grade:'중급',   price:5000000,       effectValue:0, effectDuration:0, targetRank:'C', weight:200, note:'C급 독 해제' },
  { id:'midhigh_antidote', name:'중상급 해독포션',  type:'antidote', grade:'중상급', price:75000000,      effectValue:0, effectDuration:0, targetRank:'B', weight:200, note:'B급 독 해제' },
  { id:'high_antidote',    name:'상급 해독포션',    type:'antidote', grade:'상급',   price:2000000000,    effectValue:0, effectDuration:0, targetRank:'A', weight:200, note:'A급 독 해제' },
  { id:'highest_antidote', name:'최상급 해독포션',  type:'antidote', grade:'최상급', price:50000000000,   effectValue:0, effectDuration:0, targetRank:'S', weight:200, note:'S급 독 해제' },
  // CC 회복 포션
  { id:'lowest_cc_cure',  name:'최하급 CC회복포션',  type:'cc_cure', grade:'최하급', price:150000,        effectValue:0, effectDuration:0, targetRank:'E', weight:200, note:'E급 CC 해제' },
  { id:'low_cc_cure',     name:'하급 CC회복포션',    type:'cc_cure', grade:'하급',   price:750000,        effectValue:0, effectDuration:0, targetRank:'D', weight:200, note:'D급 CC 해제' },
  { id:'mid_cc_cure',     name:'중급 CC회복포션',    type:'cc_cure', grade:'중급',   price:7500000,       effectValue:0, effectDuration:0, targetRank:'C', weight:200, note:'C급 CC 해제' },
  { id:'midhigh_cc_cure', name:'중상급 CC회복포션',  type:'cc_cure', grade:'중상급', price:112500000,     effectValue:0, effectDuration:0, targetRank:'B', weight:200, note:'B급 CC 해제' },
  { id:'high_cc_cure',    name:'상급 CC회복포션',    type:'cc_cure', grade:'상급',   price:3000000000,    effectValue:0, effectDuration:0, targetRank:'A', weight:200, note:'A급 CC 해제' },
  { id:'highest_cc_cure', name:'최상급 CC회복포션',  type:'cc_cure', grade:'최상급', price:75000000000,   effectValue:0, effectDuration:0, targetRank:'S', weight:200, note:'S급 CC 해제' },
  // 저주 해제 포션
  { id:'lowest_curse_cure',  name:'최하급 저주해제포션',  type:'curse_cure', grade:'최하급', price:200000,        effectValue:0, effectDuration:0, targetRank:'E', weight:200, note:'E급 저주 해제' },
  { id:'low_curse_cure',     name:'하급 저주해제포션',    type:'curse_cure', grade:'하급',   price:1000000,       effectValue:0, effectDuration:0, targetRank:'D', weight:200, note:'D급 저주 해제' },
  { id:'mid_curse_cure',     name:'중급 저주해제포션',    type:'curse_cure', grade:'중급',   price:10000000,      effectValue:0, effectDuration:0, targetRank:'C', weight:200, note:'C급 저주 해제' },
  { id:'midhigh_curse_cure', name:'중상급 저주해제포션',  type:'curse_cure', grade:'중상급', price:150000000,     effectValue:0, effectDuration:0, targetRank:'B', weight:200, note:'B급 저주 해제' },
  { id:'high_curse_cure',    name:'상급 저주해제포션',    type:'curse_cure', grade:'상급',   price:4000000000,    effectValue:0, effectDuration:0, targetRank:'A', weight:200, note:'A급 저주 해제' },
  { id:'highest_curse_cure', name:'최상급 저주해제포션',  type:'curse_cure', grade:'최상급', price:100000000000,  effectValue:0, effectDuration:0, targetRank:'S', weight:200, note:'S급 저주 해제' },
  // 버프 포션
  { id:'lowest_buff',  name:'최하급 버프포션',  type:'buff', grade:'최하급', price:100000,        effectValue:2,  effectDuration:3,  targetRank:'', weight:200, note:'주스탯 +2 / 3턴' },
  { id:'low_buff',     name:'하급 버프포션',    type:'buff', grade:'하급',   price:500000,        effectValue:4,  effectDuration:3,  targetRank:'', weight:200, note:'주스탯 +4 / 3턴' },
  { id:'mid_buff',     name:'중급 버프포션',    type:'buff', grade:'중급',   price:5000000,       effectValue:6,  effectDuration:3,  targetRank:'', weight:200, note:'주스탯 +6 / 3턴' },
  { id:'midhigh_buff', name:'중상급 버프포션',  type:'buff', grade:'중상급', price:75000000,      effectValue:8,  effectDuration:6,  targetRank:'', weight:200, note:'주스탯 +8 / 6턴' },
  { id:'high_buff',    name:'상급 버프포션',    type:'buff', grade:'상급',   price:2000000000,    effectValue:10, effectDuration:9,  targetRank:'', weight:200, note:'주스탯 +10 / 9턴' },
  { id:'highest_buff', name:'최상급 버프포션',  type:'buff', grade:'최상급', price:50000000000,   effectValue:15, effectDuration:18, targetRank:'', weight:200, note:'주스탯 +15 / 18턴' },
];

function buildPotionItem(potionDef, count=1) {
  return { id: potionDef.id, name: potionDef.name, category:'potion', type: potionDef.type, grade: potionDef.grade, rank: potionDef.targetRank || '', count:Math.max(1,Number(count||1)), unitWeightG:potionDef.weight||200, stackable:true, stackKey:`potion:${potionDef.id}`, note: potionDef.note||'', effectValue: potionDef.effectValue||0, effectDuration: potionDef.effectDuration||0, targetRank: potionDef.targetRank||'', price: potionDef.price||0 };
}

const POTION_DAILY_MAX_RECOVERY = 5;  // 일반 회복포션 (HP/MP/SP) 일일 제한
const POTION_DAILY_MAX_BUFF = 3;      // 버프포션 일일 제한
// 해제포션 (antidote, cc_cure, curse_cure)은 사용 제한 없음

function getPotionUsesToday() {
  const gd = model.db.gameDate || { year:2026, month:1, day:1 };
  const key = `${gd.year}-${gd.month}-${gd.day}`;
  if (!model.db.potionDailyUse || model.db.potionDailyUse.dateKey !== key) {
    model.db.potionDailyUse = { dateKey: key, count: 0, recovery: 0, buff: 0 };
  }
  // 이전 데이터 호환: recovery/buff 필드가 없으면 추가
  if (model.db.potionDailyUse.recovery == null) model.db.potionDailyUse.recovery = model.db.potionDailyUse.count || 0;
  if (model.db.potionDailyUse.buff == null) model.db.potionDailyUse.buff = 0;
  return model.db.potionDailyUse;
}

function usePotionOnUnit(potionItem, targetUnit) {
  const daily = getPotionUsesToday();
  const type = potionItem.type;
  const isRecovery = ['hp', 'mp', 'sp'].includes(type);
  const isBuff = type === 'buff';
  const isCure = ['antidote', 'cc_cure', 'curse_cure'].includes(type);

  // 일일 제한 확인
  if (isRecovery && daily.recovery > POTION_DAILY_MAX_RECOVERY) throw new Error('오늘은 더 이상 회복 물약을 사용할 수 없다. (일일 한도 초과)');
  if (isBuff && daily.buff >= POTION_DAILY_MAX_BUFF) throw new Error('오늘은 더 이상 버프 물약을 사용할 수 없다. (일일 한도 초과)');
  // 해제포션은 제한 없음

  let efficiency = 1.0;
  // 일반 회복포션: 6회째 사용 시 20% 효율
  if (isRecovery && daily.recovery === POTION_DAILY_MAX_RECOVERY) efficiency = 0.2;

  const isPartyState = targetUnit.currentHp !== undefined;
  let resultMsg = '';

  if (type === 'hp') {
    const heal = Math.floor((potionItem.effectValue || 0) * efficiency);
    if (isPartyState) {
      const maxHp = Number(targetUnit.hp || targetUnit.maxHp || 999);
      targetUnit.currentHp = Math.min(maxHp, Number(targetUnit.currentHp || 0) + heal);
    } else {
      const maxHp = Number(targetUnit.maxHp || targetUnit.hp || 999);
      targetUnit.hp = Math.min(maxHp, Number(targetUnit.hp || 0) + heal);
    }
    resultMsg = `${targetUnit.name}: HP +${heal}` + (efficiency < 1 ? ' (부작용: 효율 20%)' : '');
  } else if (type === 'mp') {
    const heal = Math.floor((potionItem.effectValue || 0) * efficiency);
    if (isPartyState) {
      const maxMp = Number(targetUnit.mp || targetUnit.maxMp || 999);
      targetUnit.currentMp = Math.min(maxMp, Number(targetUnit.currentMp || 0) + heal);
    } else {
      const maxMp = Number(targetUnit.maxMp || targetUnit.mp || 999);
      targetUnit.mp = Math.min(maxMp, Number(targetUnit.mp || 0) + heal);
    }
    resultMsg = `${targetUnit.name}: MP +${heal}` + (efficiency < 1 ? ' (부작용: 효율 20%)' : '');
  } else if (type === 'sp') {
    const heal = Math.floor((potionItem.effectValue || 0) * efficiency);
    if (isPartyState) {
      const maxSp = Number(targetUnit.sp || targetUnit.maxSp || 999);
      targetUnit.currentSp = Math.min(maxSp, Number(targetUnit.currentSp || 0) + heal);
    } else {
      const maxSp = Number(targetUnit.maxSp || targetUnit.sp || 999);
      targetUnit.sp = Math.min(maxSp, Number(targetUnit.sp || 0) + heal);
    }
    resultMsg = `${targetUnit.name}: SP +${heal}` + (efficiency < 1 ? ' (부작용: 효율 20%)' : '');
  } else if (type === 'antidote') {
    if (targetUnit.debuffs) targetUnit.debuffs = targetUnit.debuffs.filter(d => d.type !== 'poison');
    if (targetUnit.statusEffects) targetUnit.statusEffects = targetUnit.statusEffects.filter(s => s.type !== 'poison');
    resultMsg = `${targetUnit.name}: 독 해제`;
  } else if (type === 'cc_cure') {
    if (targetUnit.debuffs) targetUnit.debuffs = targetUnit.debuffs.filter(d => !['stun','sleep','bind','freeze','paralyze'].includes(d.type));
    if (targetUnit.statusEffects) targetUnit.statusEffects = targetUnit.statusEffects.filter(s => !['stun','sleep','bind','freeze','paralyze'].includes(s.type));
    if (targetUnit.cc) targetUnit.cc = null;
    resultMsg = `${targetUnit.name}: CC 해제`;
  } else if (type === 'curse_cure') {
    if (targetUnit.debuffs) targetUnit.debuffs = targetUnit.debuffs.filter(d => d.type !== 'curse');
    if (targetUnit.statusEffects) targetUnit.statusEffects = targetUnit.statusEffects.filter(s => s.type !== 'curse');
    resultMsg = `${targetUnit.name}: 저주 해제`;
  } else if (type === 'buff') {
    const statBoost = Math.floor((potionItem.effectValue || 0) * efficiency);
    const duration = potionItem.effectDuration || 3;
    if (!targetUnit.buffs) targetUnit.buffs = {};
    targetUnit.buffs.potionBuff = { statBoost, turnsLeft: duration, from: potionItem.name };
    resultMsg = `${targetUnit.name}: 주스탯 +${statBoost} (${duration}턴)`;
  }

  // 사용 횟수 증가
  daily.count++;
  if (isRecovery) {
    daily.recovery++;
    if (daily.recovery > POTION_DAILY_MAX_RECOVERY) {
      resultMsg += ' ⚠️ 오늘은 더 이상 회복 물약을 사용할 수 없다!';
    }
  }
  if (isBuff) {
    daily.buff++;
    if (daily.buff >= POTION_DAILY_MAX_BUFF) {
      resultMsg += ' ⚠️ 오늘의 버프 물약 사용 한도에 도달했다!';
    }
  }
  return resultMsg;
}

function consumePotionFromInventory(potionStackKey) {
  const inv = getActiveInventory();
  const idx = inv.items.findIndex(it => it.stackKey === potionStackKey);
  if (idx < 0) throw new Error('해당 물약을 찾을 수 없다.');
  const item = inv.items[idx];
  if (item.count > 1) { item.count--; } else { inv.items.splice(idx, 1); }
  return item;
}

// ── 편의점 식량 기본 DB ──────────────────────────────────────────────────────
const DEFAULT_CONV_FOOD_DB = [
  { id:'conv_ration',     name:'전투식량',          price:5000,  weightG:300, note:'야영 보급용 (야영지에서 소비)' },
  { id:'conv_water',      name:'물 500ml',          price:1000,  weightG:500, note:'야영 보급용 (야영지에서 소비)' },
  { id:'conv_dosirak1',   name:'제육도시락',         price:4900,  weightG:300, note:'편의점 도시락. 식사 시 소모.' },
  { id:'conv_dosirak2',   name:'돈까스파스타도시락', price:5400,  weightG:300, note:'편의점 도시락. 식사 시 소모.' },
  { id:'conv_pepsi',      name:'펩시제로',           price:2000,  weightG:250, note:'편의점 음료. 식사 시 소모.' },
  { id:'conv_soda',       name:'칠성사이다',         price:2000,  weightG:250, note:'편의점 음료. 식사 시 소모.' },
  { id:'pot_lowest_hp',   name:'최하급 HP 포션',     price:10000, weightG:200, note:'HP +50 (물약)' },
  { id:'pot_lowest_mp',   name:'최하급 MP 포션',     price:10000, weightG:200, note:'MP +50 (물약)' },
  { id:'pot_lowest_sp',   name:'최하급 SP 포션',     price:10000, weightG:200, note:'SP +50 (물약)' },
];
function getConvFoodDb() {
  if (!Array.isArray(model.db.convFoodDb) || model.db.convFoodDb.length === 0) {
    model.db.convFoodDb = DEFAULT_CONV_FOOD_DB.map(f => ({ ...f }));
  }
  return model.db.convFoodDb;
}
function buildConvFoodItem(foodDef, count=1) {
  return { id: foodDef.id, name: foodDef.name, category:'convFood', rank:'', count:Math.max(1,Number(count||1)), unitWeightG:foodDef.weightG||300, stackable:true, stackKey:`convFood:${foodDef.id}`, note: foodDef.note||'' };
}

const DEFAULT_RARE_MATERIAL_PACK = {
  "version": 3,
  "note": "GateBattle v7.8 — unified trait system (58 traits), statFlat scale added for 5 stat traits, SPECIAL_MATERIAL_EFFECTS auto-derived from EQUIP_TRAIT_TYPES.",
  "valueScales": {
    "percentSmall": {
      "E": 1,
      "D": 2,
      "C": 3,
      "B": 5,
      "A": 7,
      "S": 10
    },
    "statusPercent": {
      "E": 2,
      "D": 4,
      "C": 6,
      "B": 8,
      "A": 10,
      "S": 12
    },
    "critChance": {
      "E": 1,
      "D": 2,
      "C": 3,
      "B": 4,
      "A": 5,
      "S": 7
    },
    "critDamage": {
      "E": 5,
      "D": 10,
      "C": 15,
      "B": 20,
      "A": 25,
      "S": 35
    },
    "threatPercent": {
      "E": 10,
      "D": 20,
      "C": 30,
      "B": 40,
      "A": 50,
      "S": 60
    },
    "defenseFlat": {
      "E": 3,
      "D": 8,
      "C": 20,
      "B": 35,
      "A": 50,
      "S": 70
    },
    "statFlat": {
      "E": 2,
      "D": 4,
      "C": 6,
      "B": 8,
      "A": 11,
      "S": 14
    }
  },
  "traits": [
    {
      "id": "physical_damage",
      "name": "물리 피해 증가",
      "category": "offense",
      "scale": "percentSmall"
    },
    {
      "id": "magic_damage",
      "name": "마법 피해 증가",
      "category": "offense",
      "scale": "percentSmall"
    },
    {
      "id": "fire_damage",
      "name": "불 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "fire"
    },
    {
      "id": "water_damage",
      "name": "물 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "water"
    },
    {
      "id": "ice_damage",
      "name": "얼음 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "ice"
    },
    {
      "id": "earth_damage",
      "name": "대지 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "earth"
    },
    {
      "id": "wind_damage",
      "name": "바람 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "wind"
    },
    {
      "id": "lightning_damage",
      "name": "전기 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "lightning"
    },
    {
      "id": "light_damage",
      "name": "빛 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "light"
    },
    {
      "id": "dark_damage",
      "name": "어둠 속성 피해 증가",
      "category": "offense",
      "scale": "statusPercent",
      "element": "dark"
    },
    {
      "id": "crit_chance",
      "name": "치명타 확률 증가",
      "category": "offense",
      "scale": "critChance"
    },
    {
      "id": "crit_damage",
      "name": "치명타 피해 증가",
      "category": "offense",
      "scale": "critDamage"
    },
    {
      "id": "physical_defense",
      "name": "물리피해감소 증가",
      "category": "defense",
      "scale": "percentSmall"
    },
    {
      "id": "magic_defense",
      "name": "마법피해감소 증가",
      "category": "defense",
      "scale": "percentSmall"
    },
    {
      "id": "pdef_flat",
      "name": "물리방어력 증가",
      "category": "defense",
      "scale": "defenseFlat"
    },
    {
      "id": "mdef_flat",
      "name": "마법방어력 증가",
      "category": "defense",
      "scale": "defenseFlat"
    },
    {
      "id": "fire_resist",
      "name": "불 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "fire"
    },
    {
      "id": "water_resist",
      "name": "물 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "water"
    },
    {
      "id": "ice_resist",
      "name": "얼음 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "ice"
    },
    {
      "id": "earth_resist",
      "name": "대지 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "earth"
    },
    {
      "id": "wind_resist",
      "name": "바람 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "wind"
    },
    {
      "id": "lightning_resist",
      "name": "전기 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "lightning"
    },
    {
      "id": "light_resist",
      "name": "빛 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "light"
    },
    {
      "id": "dark_resist",
      "name": "어둠 속성 저항",
      "category": "defense",
      "scale": "statusPercent",
      "element": "dark"
    },
    {
      "id": "poison_apply",
      "name": "독 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "poison"
    },
    {
      "id": "bleed_apply",
      "name": "출혈 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "bleed"
    },
    {
      "id": "burn_apply",
      "name": "화상 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "burn"
    },
    {
      "id": "curse_apply",
      "name": "저주 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "curse"
    },
    {
      "id": "poison_resist",
      "name": "독 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "poison"
    },
    {
      "id": "bleed_resist",
      "name": "출혈 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "bleed"
    },
    {
      "id": "burn_resist",
      "name": "화상 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "burn"
    },
    {
      "id": "curse_resist",
      "name": "저주 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "curse"
    },
    {
      "id": "stun_apply",
      "name": "기절 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "stun"
    },
    {
      "id": "bind_apply",
      "name": "속박 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "bind"
    },
    {
      "id": "sleep_apply",
      "name": "수면 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "sleep"
    },
    {
      "id": "silence_apply",
      "name": "침묵 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "silence"
    },
    {
      "id": "slow_apply",
      "name": "둔화 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "slow"
    },
    {
      "id": "blind_apply",
      "name": "실명 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "blind"
    },
    {
      "id": "freeze_apply",
      "name": "빙결 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "freeze"
    },
    {
      "id": "paralyze_apply",
      "name": "마비 부여 확률 증가",
      "category": "status_apply",
      "scale": "statusPercent",
      "status": "paralyze"
    },
    {
      "id": "stun_resist",
      "name": "기절 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "stun"
    },
    {
      "id": "bind_resist",
      "name": "속박 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "bind"
    },
    {
      "id": "sleep_resist",
      "name": "수면 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "sleep"
    },
    {
      "id": "silence_resist",
      "name": "침묵 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "silence"
    },
    {
      "id": "slow_resist",
      "name": "둔화 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "slow"
    },
    {
      "id": "blind_resist",
      "name": "실명 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "blind"
    },
    {
      "id": "freeze_resist",
      "name": "빙결 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "freeze"
    },
    {
      "id": "paralyze_resist",
      "name": "마비 저항",
      "category": "status_resist",
      "scale": "statusPercent",
      "status": "paralyze"
    },
    {
      "id": "healing_done",
      "name": "치유량 증가",
      "category": "support",
      "scale": "percentSmall"
    },
    {
      "id": "healing_received",
      "name": "받는 치유량 증가",
      "category": "support",
      "scale": "percentSmall"
    },
    {
      "id": "shield_effect",
      "name": "보호막 효과 증가",
      "category": "support",
      "scale": "statusPercent"
    },
    {
      "id": "threat_up",
      "name": "위협 수치 증가",
      "category": "support",
      "scale": "threatPercent"
    },
    {
      "id": "threat_down",
      "name": "위협 수치 감소",
      "category": "support",
      "scale": "threatPercent"
    },
    {
      "id": "stat_str_up",
      "name": "STR 증가",
      "category": "stat",
      "scale": "statFlat"
    },
    {
      "id": "stat_con_up",
      "name": "CON 증가",
      "category": "stat",
      "scale": "statFlat"
    },
    {
      "id": "stat_int_up",
      "name": "INT 증가",
      "category": "stat",
      "scale": "statFlat"
    },
    {
      "id": "stat_agi_up",
      "name": "AGI 증가",
      "category": "stat",
      "scale": "statFlat"
    },
    {
      "id": "stat_sense_up",
      "name": "SENSE 증가",
      "category": "stat",
      "scale": "statFlat"
    }
  ]
};
const RARE_TRAIT_LEGACY_ALIASES = {
  '물리피해':'physical_damage',
  '마법피해':'magic_damage',
  '물리방어':'physical_defense',
  '마법방어':'magic_defense',
  '물리방어력':'pdef_flat',
  '마법방어력':'mdef_flat',
  '치유증가':'healing_done'
};
const RARE_FAMILY_PRESETS = {
  increasedHealing:['healing_done','healing_received','shield_effect'],
  elementalDefense:['fire_resist','water_resist','ice_resist','earth_resist','wind_resist','lightning_resist','light_resist','dark_resist','poison_resist','bleed_resist','burn_resist','curse_resist','stun_resist','bind_resist','sleep_resist','silence_resist','slow_resist','blind_resist','freeze_resist','paralyze_resist'],
  physicalDefense:['physical_defense','threat_up'],
  magicDefense:['magic_defense','threat_down'],
  elementalDamage:['fire_damage','water_damage','ice_damage','earth_damage','wind_damage','lightning_damage','light_damage','dark_damage','poison_apply','bleed_apply','burn_apply','curse_apply','stun_apply','bind_apply','sleep_apply','silence_apply','slow_apply','blind_apply','freeze_apply','paralyze_apply'],
  physicalDamage:['physical_damage','crit_chance','crit_damage'],
  magicDamage:['magic_damage','healing_done']
};


  const _hasRisu = (typeof Risuai !== 'undefined');
  const _ls = _hasRisu && Risuai.safeLocalStorage ? Risuai.safeLocalStorage : null;

  async function lsGet(key) {
    try {
      if (_ls) return await _ls.getItem(key);
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(PLUGIN_NAME, 'lsGet error', e);
      return null;
    }
  }
  async function lsSet(key, val) {
    try {
      if (_ls) await _ls.setItem(key, String(val));
      else localStorage.setItem(key, String(val));
    } catch (e) {
      console.warn(PLUGIN_NAME, 'lsSet error', e);
    }
  }
  async function argGet(key) {
    try {
      if (_hasRisu && Risuai.getArgument) return await Risuai.getArgument(key);
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(PLUGIN_NAME, 'argGet error', e);
      return null;
    }
  }
  async function argSet(key, val) {
    try {
      if (_hasRisu && Risuai.setArgument) await Risuai.setArgument(key, String(val));
      else localStorage.setItem(key, String(val));
    } catch (e) {
      console.warn(PLUGIN_NAME, 'argSet error', e);
    }
  }

  function deepClone(v) { return JSON.parse(JSON.stringify(v)); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function round3(n) { return Math.round(n * 1000) / 1000; }
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function slugify(str) {
    return String(str || '').trim().toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '_')
      .replace(/^_+|_+$/g, '') || ('id_' + Date.now());
  }
  function gradeIndex(rank) {
    const idx = GRADE_ORDER.indexOf(String(rank || 'E').toUpperCase());
    return idx < 0 ? 0 : idx;
  }
  function defaultAtkByRank(rank) {
    const table = { E:5, D:15, C:25, B:45, A:70, S:100 };
    return table[String(rank || 'E').toUpperCase()] || 5;
  }
  function rankBonus(rank) {
    const table = { E:0, D:30, C:90, B:180, A:320, S:520 };
    return table[String(rank || 'E').toUpperCase()] || 0;
  }

  const MONSTER_COMBAT_TABLE = {
    E:{ normal:{ hp:[50,90], dmg:[7,10], skill:1.0 }, elite:{ hp:[200,360], dmg:[15,20], skill:1.1 }, boss:{ hp:[500,900], dmg:[35,40], skill:1.25 } },
    D:{ normal:{ hp:[175,275], dmg:[15,20], skill:1.0 }, elite:{ hp:[700,1100], dmg:[35,40], skill:1.2 }, boss:{ hp:[1750,2750], dmg:[55,60], skill:1.5 } },
    C:{ normal:{ hp:[400,700], dmg:[20,25], skill:1.0 }, elite:{ hp:[1800,3150], dmg:[45,50], skill:1.2 }, boss:{ hp:[5000,8750], dmg:[70,80], skill:1.5 } },
    B:{ normal:{ hp:[1250,1750], dmg:[30,35], skill:1.0 }, elite:{ hp:[5500,8000], dmg:[60,65], skill:1.25 }, boss:{ hp:[15000,22500], dmg:[90,100], skill:1.6 } },
    A:{ normal:{ hp:[3000,4500], dmg:[35,40], skill:1.0 }, elite:{ hp:[15000,22500], dmg:[80,90], skill:1.4 }, boss:{ hp:[45000,67500], dmg:[110,120], skill:1.75 } },
    S:{ normal:{ hp:[7500,10000], dmg:[50,60], skill:1.0 }, elite:{ hp:[37500,50000], dmg:[100,110], skill:1.5 }, boss:{ hp:[112500,150000], dmg:[130,150], skill:1.8 } }
  };
  const MONSTER_RESOURCE_TABLE = {
    physical:{ mp:[0,0,0,0,0,0], sp:[20,30,40,55,70,90] },
    magic:{ mp:[20,35,50,70,90,120], sp:[10,15,20,25,30,40] }
  };

  function monsterKindKey(v) {
    const s = String(v || 'Normal').trim().toLowerCase();
    if (s.includes('boss')) return 'boss';
    if (s.includes('elite')) return 'elite';
    return 'normal';
  }
  function hash32(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function hash01(str) { return hash32(str) / 4294967295; }
  function rangeValue(min, max, t) { return min + ((max - min) * clamp(t, 0, 1)); }
  function monsterProfileForEntry(entry) {
    const rank = String(entry && entry.rank || 'E').toUpperCase();
    const kind = monsterKindKey(entry && entry.kind);
    const table = (MONSTER_COMBAT_TABLE[rank] || MONSTER_COMBAT_TABLE.E)[kind] || MONSTER_COMBAT_TABLE.E.normal;
    const row = normRow((entry && entry.row) || inferRow(entry && entry.position, entry && entry.job));
    const position = String((entry && (entry.position || entry.role || '')) || '');
    const seedBase = `${entry && (entry.id || entry.name || '')}|${rank}|${kind}|${position}|${row}`;
    let hpT = hash01(seedBase + '|hp');
    let dmgT = hash01(seedBase + '|dmg');
    if (row === 'front') { hpT += 0.12; dmgT += 0.08; }
    else if (row === 'mid') { hpT += 0.03; dmgT += 0.02; }
    else if (row === 'back') { hpT -= 0.10; dmgT -= 0.04; }
    if (position.includes('원거리')) { hpT -= 0.03; dmgT -= 0.01; }
    if (position.includes('마법')) { hpT -= 0.04; dmgT -= 0.02; }
    if (position.includes('근거리')) { dmgT += 0.04; }
    const hp = Math.round(rangeValue(table.hp[0], table.hp[1], hpT));
    const dmg = Math.round(rangeValue(table.dmg[0], table.dmg[1], dmgT));
    return {
      kind,
      hp,
      damage:dmg,
      skillMul:Number(table.skill || 1),
      mp:0,
      sp:0,
      tableHp:table.hp.slice(),
      tableDmg:table.dmg.slice()
    };
  }
  function splitCsv(str) {
    return String(str || '').split(',').map(v => v.trim()).filter(Boolean);
  }
  function koToElement(v) {
    const s = String(v || '').trim().toLowerCase();
    const map = {
      '없음':'none', 'none':'none',
      '물':'water', 'water':'water',
      '불':'fire', 'fire':'fire',
      '얼음':'ice', 'ice':'ice',
      '대지':'earth', 'earth':'earth',
      '바람':'wind', 'wind':'wind',
      '전기':'electric', 'electric':'electric', 'lightning':'electric',
      '어둠':'dark', 'dark':'dark',
      '빛':'light', 'light':'light'
    };
    return map[s] || 'none';
  }
  function koToStatus(v) {
    const s = String(v || '').trim().toLowerCase();
    const map = {
      '독':'poison', 'poison':'poison',
      '출혈':'bleed', 'bleed':'bleed', 'bleeding':'bleed',
      '기절':'stun', 'stun':'stun',
      '속박':'bind', 'bind':'bind',
      '수면':'sleep', 'sleep':'sleep',
      '화상':'burn', 'burn':'burn',
      '저주':'curse', 'curse':'curse',
      '침묵':'silence', 'silence':'silence',
      '둔화':'slow', 'slow':'slow',
      '실명':'blind', 'blind':'blind',
      '빙결':'freeze', 'freeze':'freeze',
      '마비':'paralyze', 'paralyze':'paralyze'
    };
    return map[s] || '';
  }
  function normElement(v) {
    return koToElement(v);
  }
  function normStatus(v) {
    const s = koToStatus(v);
    return STATUS_KEYS.includes(s) ? s : '';
  }
  function elementLabel(v) {
    const map = { none:'무속성', water:'물', fire:'불', ice:'얼음', earth:'대지', wind:'바람', electric:'전기', dark:'어둠', light:'빛' };
    return map[normElement(v)] || '무속성';
  }
  function normRow(v) {
    const s = String(v || '').trim().toLowerCase();
    if (['front', '전열', 'f'].includes(s)) return 'front';
    if (['mid', 'middle', '중열', 'm'].includes(s)) return 'mid';
    if (['back', 'rear', '후열', 'b'].includes(s)) return 'back';
    return '';
  }
  function rowLabel(row) {
    return row === 'front' ? '전열' : row === 'mid' ? '중열' : row === 'back' ? '후열' : '-';
  }
  function inferDamageType(position, job) {
    const t = ((position || '') + ' ' + (job || '')).toLowerCase();
    if (t.includes('마법') || t.includes('법사') || t.includes('정령') || t.includes('cleric') || t.includes('클레릭') || t.includes('소환')) return 'magic';
    return 'physical';
  }
  function inferAttackStat(position, job) {
    const t = ((position || '') + ' ' + (job || '')).toLowerCase();
    if (t.includes('힐러') || t.includes('서포터') || t.includes('마법') || t.includes('법사') || t.includes('클레릭') || t.includes('정령')) return 'int';
    if (t.includes('원거리') || t.includes('투척') || t.includes('궁수')) return 'agi';
    if (t.includes('탱커')) return 'con';
    return 'str';
  }
  function inferRow(position, job) {
    const t = ((position || '') + ' ' + (job || '')).toLowerCase();
    if (t.includes('탱커') || t.includes('근거리')) return 'front';
    if (t.includes('투척')) return 'mid';
    if (t.includes('원거리') || t.includes('궁수') || t.includes('힐러') || t.includes('서포터') || t.includes('마법') || t.includes('법사') || t.includes('정령') || t.includes('소환')) return 'back';
    return 'mid';
  }
  function inferThreatBase(position, row) {
    const t = String(position || '').toLowerCase();
    if (t.includes('탱커')) return 5;
    if (t.includes('근거리')) return 2;
    if (row === 'front') return 2;
    return 1;
  }
  function weightedPick(items) {
    const list = items.filter(x => x && x.weight > 0);
    if (!list.length) return null;
    const total = list.reduce((s, x) => s + x.weight, 0);
    let roll = Math.random() * total;
    for (const item of list) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return list[list.length - 1].value;
  }
  function getDefaultResists() {
    return { water:1, fire:1, ice:1, earth:1, wind:1, electric:1, dark:1, light:1 };
  }
  function normResists(raw) {
    const base = getDefaultResists();
    const src = raw && typeof raw === 'object' ? raw : {};
    Object.keys(base).forEach(k => {
      const v = Number(src[k]);
      if (Number.isFinite(v) && v > 0) base[k] = v;
    });
    return base;
  }
  const SPECIES_DEFAULTS = {
    undead: { speciesLabel:'언데드', defaultElement:'dark', immunities:['poison','bleed','curse'], damageTakenMods:{ physical:1.10 } },
    ghost: { speciesLabel:'고스트', defaultElement:'dark', immunities:['poison','bleed','curse'], damageTakenMods:{ physical:0.50, magic:1.25 } },
    beast: { speciesLabel:'야수', defaultElement:'wind', immunities:['slow'], bonusVsBleeding:1.20, aloneDamageTaken:1.10 },
    plant: { speciesLabel:'식물', defaultElement:'earth', immunities:['bleed'], regenPct:0.03, regenBlockedBy:['burn'] },
    slime: { speciesLabel:'슬라임', defaultElement:'water', immunities:['slow'], damageTakenMods:{ physical:0.70, magic:1.10 } },
    construct: { speciesLabel:'구조체', defaultElement:'electric', immunities:['poison','bleed','sleep'], damageTakenMods:{ magic:0.80, physical:1.15 } },
    elemental: { speciesLabel:'정령', defaultElement:'none' },
    demon: { speciesLabel:'악마', defaultElement:'fire', immunities:['burn'], damageTakenMods:{ dark:0.70 } },
    frost: { speciesLabel:'빙정', defaultElement:'ice', immunities:['sleep'], damageTakenMods:{ physical:0.80 } },
    celestial: { speciesLabel:'천사체', defaultElement:'light', immunities:['curse'], damageTakenMods:{ magic:0.80 } }
  };
  function inferSpecies(raw) {
    const s = String(raw || '').toLowerCase();
    if (!s) return '';
    if (s.includes('언데드') || s.includes('undead')) return 'undead';
    if (s.includes('고스트') || s.includes('ghost')) return 'ghost';
    if (s.includes('야수') || s.includes('beast')) return 'beast';
    if (s.includes('식물') || s.includes('plant')) return 'plant';
    if (s.includes('슬라임') || s.includes('slime')) return 'slime';
    if (s.includes('구조체') || s.includes('construct')) return 'construct';
    if (s.includes('정령') || s.includes('elemental')) return 'elemental';
    if (s.includes('악마') || s.includes('demon')) return 'demon';
    if (s.includes('빙정') || s.includes('frost') || s.includes('얼음아인')) return 'frost';
    if (s.includes('천사체') || s.includes('celestial')) return 'celestial';
    return '';
  }
  function createDefaultMeta() {
    return {
      species:'', speciesLabel:'', baseElement:'none', immunities:[], damageTakenMods:{}, bonusVsBleeding:1, aloneDamageTaken:1, regenPct:0, regenBlockedBy:[], onHitStatus:'', onHitChance:0, onHitTurns:0
    };
  }
  function mergeMeta(base, patch) {
    const out = Object.assign(createDefaultMeta(), base || {});
    const p = patch || {};
    if (p.species) out.species = p.species;
    if (p.speciesLabel) out.speciesLabel = p.speciesLabel;
    if (p.baseElement && p.baseElement !== 'none') out.baseElement = normElement(p.baseElement);
    if (Array.isArray(p.immunities)) out.immunities = Array.from(new Set(out.immunities.concat(p.immunities.map(normStatus).filter(Boolean))));
    if (p.damageTakenMods && typeof p.damageTakenMods === 'object') out.damageTakenMods = Object.assign({}, out.damageTakenMods, p.damageTakenMods);
    if (p.bonusVsBleeding && p.bonusVsBleeding !== 1) out.bonusVsBleeding = Number(p.bonusVsBleeding);
    if (p.aloneDamageTaken && p.aloneDamageTaken !== 1) out.aloneDamageTaken = Number(p.aloneDamageTaken);
    if (p.regenPct) out.regenPct = Number(p.regenPct);
    if (Array.isArray(p.regenBlockedBy)) out.regenBlockedBy = Array.from(new Set(out.regenBlockedBy.concat(p.regenBlockedBy.map(normStatus).filter(Boolean))));
    if (p.onHitStatus) out.onHitStatus = normStatus(p.onHitStatus);
    if (p.onHitChance != null) out.onHitChance = Number(p.onHitChance);
    if (p.onHitTurns != null) out.onHitTurns = Number(p.onHitTurns);
    return out;
  }
  function parseMonsterMeta(entry) {
    const item = entry || {};
    const note = String(item.note || '');
    let meta = createDefaultMeta();
    const inferredSpecies = inferSpecies(item.species || note || item.id || item.name);
    if (inferredSpecies && SPECIES_DEFAULTS[inferredSpecies]) meta = mergeMeta(meta, Object.assign({ species:inferredSpecies }, SPECIES_DEFAULTS[inferredSpecies]));
    const speciesMatch = note.match(/종족\s*:\s*([^/]+)/);
    if (speciesMatch) {
      const sp = inferSpecies(speciesMatch[1]);
      if (sp && SPECIES_DEFAULTS[sp]) meta = mergeMeta(meta, Object.assign({ species:sp }, SPECIES_DEFAULTS[sp]));
    }
    const elMatch = note.match(/기본속성\s*:\s*([^/]+)/);
    if (elMatch) meta.baseElement = normElement(elMatch[1]);
    if (!meta.baseElement || meta.baseElement === 'none') meta.baseElement = normElement(item.baseElement || item.element || meta.baseElement || 'none');
    const prefixMatch = note.match(/접두효과\s*:\s*([^/]+)/);
    if (prefixMatch) {
      const st = normStatus(prefixMatch[1]);
      if (st) {
        const hardCcTypes = ['stun','bind','sleep','freeze','paralyze','curse'];
        const dotTypes = ['poison','bleed','burn'];
        const defaultChance = hardCcTypes.includes(st) ? 0.18 : dotTypes.includes(st) ? 0.23 : 0.28;
        const turnsByStatus = { stun:2, bind:2, sleep:3, freeze:2, paralyze:2, curse:3, poison:3, bleed:3, burn:5, silence:2, slow:3, blind:3 };
        const defaultTurns = turnsByStatus[st] || 2;
        // 정령은 30% 확률로만 상태이상 부여 능력 보유
        const isElemental = meta.species === 'elemental';
        if (!isElemental || Math.random() < 0.3) {
          meta.onHitStatus = st; meta.onHitChance = defaultChance; meta.onHitTurns = defaultTurns;
        }
      }
    }
    // 보스/엘리트: 접두효과 없어도 기본속성 기반 상태이상 부여 (ELEMENT_STATUS_MAP)
    const kind = String(item.kind || '').toLowerCase();
    if (!meta.onHitStatus && (kind === 'boss' || kind === 'elite') && meta.baseElement && meta.baseElement !== 'none') {
      const elSt = ELEMENT_STATUS_MAP[meta.baseElement];
      if (elSt && normStatus(elSt)) {
        const hardCcTypes = ['stun','bind','sleep','freeze','paralyze','curse'];
        const dotTypes = ['poison','bleed','burn'];
        const turnsByStatus = { stun:2, bind:2, sleep:3, freeze:2, paralyze:2, curse:3, poison:3, bleed:3, burn:5, silence:2, slow:3, blind:3 };
        meta.onHitStatus = elSt;
        meta.onHitChance = hardCcTypes.includes(elSt) ? 0.18 : dotTypes.includes(elSt) ? 0.23 : 0.28;
        meta.onHitTurns = turnsByStatus[elSt] || 2;
      }
    }
    // 정령 보스/엘리트: baseElement가 없으면(variable) 랜덤 속성 배정 후 상태이상 부여
    if (!meta.onHitStatus && (kind === 'boss' || kind === 'elite') && meta.species === 'elemental') {
      const elKeys = Object.keys(ELEMENT_STATUS_MAP);
      const randEl = elKeys[Math.floor(Math.random() * elKeys.length)];
      const elSt = ELEMENT_STATUS_MAP[randEl];
      if (elSt && normStatus(elSt)) {
        meta.baseElement = randEl;
        const hardCcTypes = ['stun','bind','sleep','freeze','paralyze','curse'];
        const dotTypes = ['poison','bleed','burn'];
        const turnsByStatus = { stun:2, bind:2, sleep:3, freeze:2, paralyze:2, curse:3, poison:3, bleed:3, burn:5, silence:2, slow:3, blind:3 };
        meta.onHitStatus = elSt;
        meta.onHitChance = hardCcTypes.includes(elSt) ? 0.18 : dotTypes.includes(elSt) ? 0.23 : 0.28;
        meta.onHitTurns = turnsByStatus[elSt] || 2;
      }
    }
    if (Array.isArray(item.immunities)) meta = mergeMeta(meta, { immunities:item.immunities });
    if (item.damageTakenMods) meta = mergeMeta(meta, { damageTakenMods:item.damageTakenMods });
    if (item.bonusVsBleeding) meta = mergeMeta(meta, { bonusVsBleeding:item.bonusVsBleeding });
    if (item.aloneDamageTaken) meta = mergeMeta(meta, { aloneDamageTaken:item.aloneDamageTaken });
    if (item.regenPct) meta = mergeMeta(meta, { regenPct:item.regenPct });
    if (item.regenBlockedBy) meta = mergeMeta(meta, { regenBlockedBy:item.regenBlockedBy });
    if (item.onHitStatus) meta = mergeMeta(meta, { onHitStatus:item.onHitStatus, onHitChance:item.onHitChance, onHitTurns:item.onHitTurns });

    const immRe = /(독|출혈|기절|속박|수면|화상|저주|실명|빙결|마비)\s*면역/g;
    let m;
    while ((m = immRe.exec(note))) {
      const st = normStatus(m[1]);
      if (st) meta.immunities = Array.from(new Set(meta.immunities.concat([st])));
    }
    const extraRe = /(물리|마법)\s*피해\s*(\d+)%\s*추가로\s*받음/g;
    while ((m = extraRe.exec(note))) {
      meta.damageTakenMods[m[1] === '물리' ? 'physical' : 'magic'] = 1 + (Number(m[2]) / 100);
    }
    const reduceRe = /(물리|마법)\s*피해\s*(\d+)%\s*반감/g;
    while ((m = reduceRe.exec(note))) {
      meta.damageTakenMods[m[1] === '물리' ? 'physical' : 'magic'] = 1 - (Number(m[2]) / 100);
    }
    // 속성별 받는데미지 반감 (예: 어둠속성 받는데미지 30%반감)
    const elemReduceRe = /(어둠|빛|불|물|얼음|대지|바람|전기)\s*속성\s*받는\s*데미지\s*(\d+)%\s*반감/g;
    const elemNameMap = {'어둠':'dark','빛':'light','불':'fire','물':'water','얼음':'ice','대지':'earth','바람':'wind','전기':'electric'};
    while ((m = elemReduceRe.exec(note))) {
      const eKey = elemNameMap[m[1]];
      if (eKey) meta.damageTakenMods[eKey] = 1 - (Number(m[2]) / 100);
    }
    const bleedBonus = note.match(/출혈\s*상태의\s*적\s*공격\s*시\s*(\d+)%\s*피해\s*증가/);
    if (bleedBonus) meta.bonusVsBleeding = 1 + (Number(bleedBonus[1]) / 100);
    const aloneInc = note.match(/혼자\s*남았을\s*때\s*받는\s*피해\s*(\d+)%\s*증가/);
    if (aloneInc) meta.aloneDamageTaken = 1 + (Number(aloneInc[1]) / 100);
    const regenMatch = note.match(/HP\s*(\d+)%\s*회복/);
    if (regenMatch) meta.regenPct = Number(regenMatch[1]) / 100;
    if (/화상\s*상태일\s*때\s*재생\s*비활성화/.test(note)) meta.regenBlockedBy = Array.from(new Set(meta.regenBlockedBy.concat(['burn'])));
    return meta;
  }
  function unitHasImmunity(unit, statusType) {
    const st = normStatus(statusType);
    if (!st) return false;
    return Array.isArray(unit.immunities) && unit.immunities.includes(st);
  }
  function getStatusDefaultProfile(type) {
    const st = normStatus(type);
    const map = {
      poison:{ turns:3, chance:0.23, power:0 },
      bleed:{ turns:3, chance:0.23, power:0 },
      burn:{ turns:5, chance:0.23, power:0 },
      curse:{ turns:3, chance:0.18, power:0 },
      bind:{ turns:2, chance:0.18, power:0 },
      sleep:{ turns:3, chance:0.16, power:0 },
      stun:{ turns:2, chance:0.16, power:0 },
      silence:{ turns:2, chance:0.20, power:0 },
      slow:{ turns:3, chance:0.25, power:0 },
      blind:{ turns:3, chance:0.20, power:0 },
      freeze:{ turns:2, chance:0.16, power:0 },
      paralyze:{ turns:2, chance:0.16, power:0 }
    };
    return Object.assign({ turns:2, chance:0.2, power:0 }, map[st] || {});
  }
  function getElementAdvantageMult(attackElement, targetElement) {
    const atk = normElement(attackElement);
    const tgt = normElement(targetElement);
    if (atk === 'none' || tgt === 'none' || atk === tgt) return 1;
    const idx = ELEMENT_CHAIN.indexOf(atk);
    if (idx < 0) return 1;
    const prev = ELEMENT_CHAIN[(idx - 1 + ELEMENT_CHAIN.length) % ELEMENT_CHAIN.length];
    const next = ELEMENT_CHAIN[(idx + 1) % ELEMENT_CHAIN.length];
    if (tgt === prev) return 1.25;
    if (tgt === next) return 0.75;
    return 1;
  }

  const BUILTIN_SKILLS = {
    "singleAttackPhysE":{"id":"singleAttackPhysE","name":"타격","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":0,"sp":20},"coef":1.2,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 단일 공격 (E랭크)","cooldown":0},
    "singleAttackMagE":{"id":"singleAttackMagE","name":"마탄","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 단일 공격 (E랭크)","cooldown":0},
    "aoeAttackPhysE":{"id":"aoeAttackPhysE","name":"연타","grade":"E","category":"aoeAttack","target":"allEnemies","costs":{"mp":0,"sp":40},"coef":0.7,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 광역 공격 (E랭크)","cooldown":0},
    "aoeAttackMagE":{"id":"aoeAttackMagE","name":"마력파","grade":"E","category":"aoeAttack","target":"allEnemies","costs":{"mp":40,"sp":0},"coef":0.7,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 광역 공격 (E랭크)","cooldown":0},
    "elemAttackFireE":{"id":"elemAttackFireE","name":"화염탄","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"fire","desc":"화염 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "elemAttackIceE":{"id":"elemAttackIceE","name":"빙침","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"ice","desc":"빙결 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "elemAttackWaterE":{"id":"elemAttackWaterE","name":"수류탄","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"water","desc":"수류 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "elemAttackWindE":{"id":"elemAttackWindE","name":"풍인","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"wind","desc":"질풍 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "elemAttackEarthE":{"id":"elemAttackEarthE","name":"암석탄","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"earth","desc":"대지 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "elemAttackElectricE":{"id":"elemAttackElectricE","name":"전격","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"electric","desc":"전격 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "elemAttackLightE":{"id":"elemAttackLightE","name":"섬광탄","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"light","desc":"성광 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "elemAttackDarkE":{"id":"elemAttackDarkE","name":"암영탄","grade":"E","category":"singleAttack","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"dark","desc":"암흑 속성 마법 단일 공격 (E랭크)","cooldown":0},
    "singleCcStunE":{"id":"singleCcStunE","name":"타격파","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":20},"coef":0.96,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"단일 대상 기절 타격 (E랭크)","cooldown":0},
    "singleCcFreezeE":{"id":"singleCcFreezeE","name":"냉기술","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"단일 대상 빙결 마법 (E랭크)","cooldown":0},
    "singleCcParalyzeE":{"id":"singleCcParalyzeE","name":"감전","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"electric","cc":{"type":"paralyze","turns":2,"chance":0.16},"desc":"단일 대상 마비 전격 (E랭크)","cooldown":0},
    "singleCcSleepE":{"id":"singleCcSleepE","name":"졸음","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"sleep","turns":3,"chance":0.16},"desc":"단일 대상 수면 마법 (E랭크)","cooldown":0},
    "singleCcBindE":{"id":"singleCcBindE","name":"올가미","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":20},"coef":0.96,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bind","turns":2,"chance":0.18},"desc":"단일 대상 속박 타격 (E랭크)","cooldown":0},
    "singleCcCurseE":{"id":"singleCcCurseE","name":"주술","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"dark","cc":{"type":"curse","turns":3,"chance":0.18},"desc":"단일 대상 저주 마법 (E랭크)","cooldown":0},
    "singleCcSilenceE":{"id":"singleCcSilenceE","name":"침묵","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"silence","turns":2,"chance":0.2},"desc":"단일 대상 침묵 마법 (E랭크)","cooldown":0},
    "singleCcSlowE":{"id":"singleCcSlowE","name":"감속","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":20},"coef":0.96,"statTypes":["agi"],"damageType":"physical","element":"none","cc":{"type":"slow","turns":3,"chance":0.25},"desc":"단일 대상 둔화 타격 (E랭크)","cooldown":0},
    "singleCcBlindE":{"id":"singleCcBlindE","name":"눈부심","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"blind","turns":3,"chance":0.2},"desc":"단일 대상 실명 마법 (E랭크)","cooldown":0},
    "singleCcPoisonE":{"id":"singleCcPoisonE","name":"독침","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"단일 대상 독 마법 (E랭크)","cooldown":0},
    "singleCcBleedE":{"id":"singleCcBleedE","name":"할퀴기","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":20},"coef":0.96,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bleed","turns":3,"chance":0.23},"desc":"단일 대상 출혈 타격 (E랭크)","cooldown":0},
    "singleCcBurnE":{"id":"singleCcBurnE","name":"불씨","grade":"E","category":"singleCC","target":"singleEnemy","costs":{"mp":20,"sp":0},"coef":0.96,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"단일 대상 화상 마법 (E랭크)","cooldown":0},
    "aoeCcStunE":{"id":"aoeCcStunE","name":"대지진동","grade":"E","category":"aoeCC","target":"allEnemies","costs":{"mp":0,"sp":40},"coef":0.56,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"광역 대상 광역 기절 (E랭크)","cooldown":0},
    "aoeCcFreezeE":{"id":"aoeCcFreezeE","name":"냉기방출","grade":"E","category":"aoeCC","target":"allEnemies","costs":{"mp":40,"sp":0},"coef":0.56,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"광역 대상 광역 빙결 (E랭크)","cooldown":0},
    "aoeCcPoisonE":{"id":"aoeCcPoisonE","name":"독연기","grade":"E","category":"aoeCC","target":"allEnemies","costs":{"mp":40,"sp":0},"coef":0.56,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"광역 대상 광역 독 (E랭크)","cooldown":0},
    "aoeCcBurnE":{"id":"aoeCcBurnE","name":"불꽃비","grade":"E","category":"aoeCC","target":"allEnemies","costs":{"mp":40,"sp":0},"coef":0.56,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"광역 대상 광역 화상 (E랭크)","cooldown":0},
    "singleHealE":{"id":"singleHealE","name":"응급치료","grade":"E","category":"singleHeal","target":"singleAlly","costs":{"mp":20,"sp":0},"coef":1.2,"statTypes":["int"],"damageType":"magic","element":"none","desc":"단일 대상 회복 (E랭크)","cooldown":0},
    "aoeHealE":{"id":"aoeHealE","name":"치유의 바람","grade":"E","category":"aoeHeal","target":"allAllies","costs":{"mp":40,"sp":0},"coef":0.7,"statTypes":["int"],"damageType":"magic","element":"none","desc":"광역 회복 (E랭크)","cooldown":0},
    "buffStrE":{"id":"buffStrE","name":"힘 강화","grade":"E","category":"buff","target":"self","costs":{"mp":20,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","buff":{"stats":{"str":2}},"duration":3,"desc":"STR 강화 버프 3턴 (E랭크)","cooldown":0},
    "buffConE":{"id":"buffConE","name":"체력 강화","grade":"E","category":"buff","target":"self","costs":{"mp":20,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","buff":{"stats":{"con":2}},"duration":3,"desc":"CON 강화 버프 3턴 (E랭크)","cooldown":0},
    "buffIntE":{"id":"buffIntE","name":"지력 강화","grade":"E","category":"buff","target":"self","costs":{"mp":20,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","buff":{"stats":{"int":2}},"duration":3,"desc":"INT 강화 버프 3턴 (E랭크)","cooldown":0},
    "buffAgiE":{"id":"buffAgiE","name":"민첩 강화","grade":"E","category":"buff","target":"self","costs":{"mp":20,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","buff":{"stats":{"agi":2}},"duration":3,"desc":"AGI 강화 버프 3턴 (E랭크)","cooldown":0},
    "buffSenseE":{"id":"buffSenseE","name":"감각 강화","grade":"E","category":"buff","target":"self","costs":{"mp":20,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","buff":{"stats":{"sense":2}},"duration":3,"desc":"SENSE 강화 버프 3턴 (E랭크)","cooldown":0},
    "buffPdefE":{"id":"buffPdefE","name":"방어 강화","grade":"E","category":"buff","target":"self","costs":{"mp":20,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","buff":{"stats":{"pdef":2}},"duration":3,"desc":"PDEF 강화 버프 3턴 (E랭크)","cooldown":0},
    "buffMdefE":{"id":"buffMdefE","name":"마방 강화","grade":"E","category":"buff","target":"self","costs":{"mp":20,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","buff":{"stats":{"mdef":2}},"duration":3,"desc":"MDEF 강화 버프 3턴 (E랭크)","cooldown":0},
    "buffTauntE":{"id":"buffTauntE","name":"위협","grade":"E","category":"buff","target":"self","costs":{"mp":0,"sp":20},"coef":0,"statTypes":["con"],"damageType":"physical","element":"none","buff":{"stats":{},"threatBonus":3},"duration":3,"desc":"도발 버프 3턴, 위협 +3 (E랭크)","cooldown":0},
    "passiveStrE":{"id":"passiveStrE","name":"기초 근력","grade":"E","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","duration":0,"desc":"STR 패시브 영구 보너스 (E랭크)","cooldown":0,"passiveBonuses":{"str":2}},
    "passiveConE":{"id":"passiveConE","name":"기초 체력","grade":"E","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","duration":0,"desc":"CON 패시브 영구 보너스 (E랭크)","cooldown":0,"passiveBonuses":{"con":2}},
    "passiveIntE":{"id":"passiveIntE","name":"기초 지력","grade":"E","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","duration":0,"desc":"INT 패시브 영구 보너스 (E랭크)","cooldown":0,"passiveBonuses":{"int":2}},
    "passiveAgiE":{"id":"passiveAgiE","name":"기초 민첩","grade":"E","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","duration":0,"desc":"AGI 패시브 영구 보너스 (E랭크)","cooldown":0,"passiveBonuses":{"agi":2}},
    "passiveSenseE":{"id":"passiveSenseE","name":"기초 감각","grade":"E","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","duration":0,"desc":"SENSE 패시브 영구 보너스 (E랭크)","cooldown":0,"passiveBonuses":{"sense":2}},
    "passivePdefE":{"id":"passivePdefE","name":"기초 방어","grade":"E","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","duration":0,"desc":"PDEF 패시브 영구 보너스 (E랭크)","cooldown":0,"passiveBonuses":{"pdef":2}},
    "passiveMdefE":{"id":"passiveMdefE","name":"기초 마방","grade":"E","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","duration":0,"desc":"MDEF 패시브 영구 보너스 (E랭크)","cooldown":0,"passiveBonuses":{"mdef":2}},
    "singleAttackPhysD":{"id":"singleAttackPhysD","name":"강타","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":0,"sp":25},"coef":1.92,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 단일 공격 (D랭크)","cooldown":0},
    "singleAttackMagD":{"id":"singleAttackMagD","name":"마력탄","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 단일 공격 (D랭크)","cooldown":0},
    "aoeAttackPhysD":{"id":"aoeAttackPhysD","name":"난무","grade":"D","category":"aoeAttack","target":"allEnemies","costs":{"mp":0,"sp":50},"coef":1.11,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 광역 공격 (D랭크)","cooldown":0},
    "aoeAttackMagD":{"id":"aoeAttackMagD","name":"마력진","grade":"D","category":"aoeAttack","target":"allEnemies","costs":{"mp":50,"sp":0},"coef":1.11,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 광역 공격 (D랭크)","cooldown":0},
    "elemAttackFireD":{"id":"elemAttackFireD","name":"화염구","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"fire","desc":"화염 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "elemAttackIceD":{"id":"elemAttackIceD","name":"빙결탄","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"ice","desc":"빙결 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "elemAttackWaterD":{"id":"elemAttackWaterD","name":"수압포","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"water","desc":"수류 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "elemAttackWindD":{"id":"elemAttackWindD","name":"질풍타","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"wind","desc":"질풍 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "elemAttackEarthD":{"id":"elemAttackEarthD","name":"지진격","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"earth","desc":"대지 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "elemAttackElectricD":{"id":"elemAttackElectricD","name":"방전","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"electric","desc":"전격 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "elemAttackLightD":{"id":"elemAttackLightD","name":"성광격","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"light","desc":"성광 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "elemAttackDarkD":{"id":"elemAttackDarkD","name":"명침","grade":"D","category":"singleAttack","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.92,"statTypes":["int"],"damageType":"magic","element":"dark","desc":"암흑 속성 마법 단일 공격 (D랭크)","cooldown":0},
    "singleCcStunD":{"id":"singleCcStunD","name":"충격파","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":25},"coef":1.54,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"단일 대상 기절 타격 (D랭크)","cooldown":0},
    "singleCcFreezeD":{"id":"singleCcFreezeD","name":"동결술","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"단일 대상 빙결 마법 (D랭크)","cooldown":0},
    "singleCcParalyzeD":{"id":"singleCcParalyzeD","name":"전류속박","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"electric","cc":{"type":"paralyze","turns":2,"chance":0.16},"desc":"단일 대상 마비 전격 (D랭크)","cooldown":0},
    "singleCcSleepD":{"id":"singleCcSleepD","name":"수면술","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"sleep","turns":3,"chance":0.16},"desc":"단일 대상 수면 마법 (D랭크)","cooldown":0},
    "singleCcBindD":{"id":"singleCcBindD","name":"사슬결박","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":25},"coef":1.54,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bind","turns":2,"chance":0.18},"desc":"단일 대상 속박 타격 (D랭크)","cooldown":0},
    "singleCcCurseD":{"id":"singleCcCurseD","name":"저주술","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"dark","cc":{"type":"curse","turns":3,"chance":0.18},"desc":"단일 대상 저주 마법 (D랭크)","cooldown":0},
    "singleCcSilenceD":{"id":"singleCcSilenceD","name":"봉인술","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"silence","turns":2,"chance":0.2},"desc":"단일 대상 침묵 마법 (D랭크)","cooldown":0},
    "singleCcSlowD":{"id":"singleCcSlowD","name":"둔중술","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":25},"coef":1.54,"statTypes":["agi"],"damageType":"physical","element":"none","cc":{"type":"slow","turns":3,"chance":0.25},"desc":"단일 대상 둔화 타격 (D랭크)","cooldown":0},
    "singleCcBlindD":{"id":"singleCcBlindD","name":"암막술","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"blind","turns":3,"chance":0.2},"desc":"단일 대상 실명 마법 (D랭크)","cooldown":0},
    "singleCcPoisonD":{"id":"singleCcPoisonD","name":"독안개","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"단일 대상 독 마법 (D랭크)","cooldown":0},
    "singleCcBleedD":{"id":"singleCcBleedD","name":"열상격","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":25},"coef":1.54,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bleed","turns":3,"chance":0.23},"desc":"단일 대상 출혈 타격 (D랭크)","cooldown":0},
    "singleCcBurnD":{"id":"singleCcBurnD","name":"점화술","grade":"D","category":"singleCC","target":"singleEnemy","costs":{"mp":25,"sp":0},"coef":1.54,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"단일 대상 화상 마법 (D랭크)","cooldown":0},
    "aoeCcStunD":{"id":"aoeCcStunD","name":"지진파","grade":"D","category":"aoeCC","target":"allEnemies","costs":{"mp":0,"sp":50},"coef":0.89,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"광역 대상 광역 기절 (D랭크)","cooldown":0},
    "aoeCcFreezeD":{"id":"aoeCcFreezeD","name":"동결진","grade":"D","category":"aoeCC","target":"allEnemies","costs":{"mp":50,"sp":0},"coef":0.89,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"광역 대상 광역 빙결 (D랭크)","cooldown":0},
    "aoeCcPoisonD":{"id":"aoeCcPoisonD","name":"독무","grade":"D","category":"aoeCC","target":"allEnemies","costs":{"mp":50,"sp":0},"coef":0.89,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"광역 대상 광역 독 (D랭크)","cooldown":0},
    "aoeCcBurnD":{"id":"aoeCcBurnD","name":"화염비","grade":"D","category":"aoeCC","target":"allEnemies","costs":{"mp":50,"sp":0},"coef":0.89,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"광역 대상 광역 화상 (D랭크)","cooldown":0},
    "singleHealD":{"id":"singleHealD","name":"치유의 빛","grade":"D","category":"singleHeal","target":"singleAlly","costs":{"mp":25,"sp":0},"coef":1.4,"statTypes":["int"],"damageType":"magic","element":"none","desc":"단일 대상 회복 (D랭크)","cooldown":0},
    "aoeHealD":{"id":"aoeHealD","name":"생명의 노래","grade":"D","category":"aoeHeal","target":"allAllies","costs":{"mp":50,"sp":0},"coef":0.81,"statTypes":["int"],"damageType":"magic","element":"none","desc":"광역 회복 (D랭크)","cooldown":0},
    "buffStrD":{"id":"buffStrD","name":"투사의 함성","grade":"D","category":"buff","target":"self","costs":{"mp":25,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","buff":{"stats":{"str":4}},"duration":3,"desc":"STR 강화 버프 3턴 (D랭크)","cooldown":0},
    "buffConD":{"id":"buffConD","name":"강철 의지","grade":"D","category":"buff","target":"self","costs":{"mp":25,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","buff":{"stats":{"con":4}},"duration":3,"desc":"CON 강화 버프 3턴 (D랭크)","cooldown":0},
    "buffIntD":{"id":"buffIntD","name":"명석의 비전","grade":"D","category":"buff","target":"self","costs":{"mp":25,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","buff":{"stats":{"int":4}},"duration":3,"desc":"INT 강화 버프 3턴 (D랭크)","cooldown":0},
    "buffAgiD":{"id":"buffAgiD","name":"질풍 보법","grade":"D","category":"buff","target":"self","costs":{"mp":25,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","buff":{"stats":{"agi":4}},"duration":3,"desc":"AGI 강화 버프 3턴 (D랭크)","cooldown":0},
    "buffSenseD":{"id":"buffSenseD","name":"매의 눈","grade":"D","category":"buff","target":"self","costs":{"mp":25,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","buff":{"stats":{"sense":4}},"duration":3,"desc":"SENSE 강화 버프 3턴 (D랭크)","cooldown":0},
    "buffPdefD":{"id":"buffPdefD","name":"석갑 부여","grade":"D","category":"buff","target":"self","costs":{"mp":25,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","buff":{"stats":{"pdef":4}},"duration":3,"desc":"PDEF 강화 버프 3턴 (D랭크)","cooldown":0},
    "buffMdefD":{"id":"buffMdefD","name":"마력 방벽","grade":"D","category":"buff","target":"self","costs":{"mp":25,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","buff":{"stats":{"mdef":4}},"duration":3,"desc":"MDEF 강화 버프 3턴 (D랭크)","cooldown":0},
    "buffTauntD":{"id":"buffTauntD","name":"도발","grade":"D","category":"buff","target":"self","costs":{"mp":0,"sp":25},"coef":0,"statTypes":["con"],"damageType":"physical","element":"none","buff":{"stats":{},"threatBonus":5},"duration":3,"desc":"도발 버프 3턴, 위협 +5 (D랭크)","cooldown":0},
    "passiveStrD":{"id":"passiveStrD","name":"근력 단련","grade":"D","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","duration":0,"desc":"STR 패시브 영구 보너스 (D랭크)","cooldown":0,"passiveBonuses":{"str":4}},
    "passiveConD":{"id":"passiveConD","name":"체력 단련","grade":"D","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","duration":0,"desc":"CON 패시브 영구 보너스 (D랭크)","cooldown":0,"passiveBonuses":{"con":4}},
    "passiveIntD":{"id":"passiveIntD","name":"지력 수련","grade":"D","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","duration":0,"desc":"INT 패시브 영구 보너스 (D랭크)","cooldown":0,"passiveBonuses":{"int":4}},
    "passiveAgiD":{"id":"passiveAgiD","name":"신속 수련","grade":"D","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","duration":0,"desc":"AGI 패시브 영구 보너스 (D랭크)","cooldown":0,"passiveBonuses":{"agi":4}},
    "passiveSenseD":{"id":"passiveSenseD","name":"감각 연마","grade":"D","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","duration":0,"desc":"SENSE 패시브 영구 보너스 (D랭크)","cooldown":0,"passiveBonuses":{"sense":4}},
    "passivePdefD":{"id":"passivePdefD","name":"방어 숙련","grade":"D","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","duration":0,"desc":"PDEF 패시브 영구 보너스 (D랭크)","cooldown":0,"passiveBonuses":{"pdef":4}},
    "passiveMdefD":{"id":"passiveMdefD","name":"마법 내성","grade":"D","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","duration":0,"desc":"MDEF 패시브 영구 보너스 (D랭크)","cooldown":0,"passiveBonuses":{"mdef":4}},
    "singleAttackPhysC":{"id":"singleAttackPhysC","name":"분쇄격","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":0,"sp":30},"coef":2.88,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 단일 공격 (C랭크)","cooldown":0},
    "singleAttackMagC":{"id":"singleAttackMagC","name":"마력포","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 단일 공격 (C랭크)","cooldown":0},
    "aoeAttackPhysC":{"id":"aoeAttackPhysC","name":"질풍연타","grade":"C","category":"aoeAttack","target":"allEnemies","costs":{"mp":0,"sp":60},"coef":1.67,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 광역 공격 (C랭크)","cooldown":0},
    "aoeAttackMagC":{"id":"aoeAttackMagC","name":"마력폭발","grade":"C","category":"aoeAttack","target":"allEnemies","costs":{"mp":60,"sp":0},"coef":1.67,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 광역 공격 (C랭크)","cooldown":0},
    "elemAttackFireC":{"id":"elemAttackFireC","name":"폭염","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"fire","desc":"화염 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "elemAttackIceC":{"id":"elemAttackIceC","name":"동결파","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"ice","desc":"빙결 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "elemAttackWaterC":{"id":"elemAttackWaterC","name":"해류격","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"water","desc":"수류 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "elemAttackWindC":{"id":"elemAttackWindC","name":"열풍격","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"wind","desc":"질풍 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "elemAttackEarthC":{"id":"elemAttackEarthC","name":"암쇄","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"earth","desc":"대지 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "elemAttackElectricC":{"id":"elemAttackElectricC","name":"낙뢰","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"electric","desc":"전격 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "elemAttackLightC":{"id":"elemAttackLightC","name":"광명격","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"light","desc":"성광 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "elemAttackDarkC":{"id":"elemAttackDarkC","name":"암흑파","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.88,"statTypes":["int"],"damageType":"magic","element":"dark","desc":"암흑 속성 마법 단일 공격 (C랭크)","cooldown":0},
    "singleCcStunC":{"id":"singleCcStunC","name":"지축격","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":30},"coef":2.3,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"단일 대상 기절 타격 (C랭크)","cooldown":0},
    "singleCcFreezeC":{"id":"singleCcFreezeC","name":"빙쇄파","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"단일 대상 빙결 마법 (C랭크)","cooldown":0},
    "singleCcParalyzeC":{"id":"singleCcParalyzeC","name":"마비전류","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"electric","cc":{"type":"paralyze","turns":2,"chance":0.16},"desc":"단일 대상 마비 전격 (C랭크)","cooldown":0},
    "singleCcSleepC":{"id":"singleCcSleepC","name":"자장가","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"sleep","turns":3,"chance":0.16},"desc":"단일 대상 수면 마법 (C랭크)","cooldown":0},
    "singleCcBindC":{"id":"singleCcBindC","name":"속박진","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":30},"coef":2.3,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bind","turns":2,"chance":0.18},"desc":"단일 대상 속박 타격 (C랭크)","cooldown":0},
    "singleCcCurseC":{"id":"singleCcCurseC","name":"원혼의 저주","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"dark","cc":{"type":"curse","turns":3,"chance":0.18},"desc":"단일 대상 저주 마법 (C랭크)","cooldown":0},
    "singleCcSilenceC":{"id":"singleCcSilenceC","name":"마력봉인","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"silence","turns":2,"chance":0.2},"desc":"단일 대상 침묵 마법 (C랭크)","cooldown":0},
    "singleCcSlowC":{"id":"singleCcSlowC","name":"시간지연","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":30},"coef":2.3,"statTypes":["agi"],"damageType":"physical","element":"none","cc":{"type":"slow","turns":3,"chance":0.25},"desc":"단일 대상 둔화 타격 (C랭크)","cooldown":0},
    "singleCcBlindC":{"id":"singleCcBlindC","name":"시야차단","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"blind","turns":3,"chance":0.2},"desc":"단일 대상 실명 마법 (C랭크)","cooldown":0},
    "singleCcPoisonC":{"id":"singleCcPoisonC","name":"맹독술","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"단일 대상 독 마법 (C랭크)","cooldown":0},
    "singleCcBleedC":{"id":"singleCcBleedC","name":"출혈참","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":30},"coef":2.3,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bleed","turns":3,"chance":0.23},"desc":"단일 대상 출혈 타격 (C랭크)","cooldown":0},
    "singleCcBurnC":{"id":"singleCcBurnC","name":"발화","grade":"C","category":"singleCC","target":"singleEnemy","costs":{"mp":30,"sp":0},"coef":2.3,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"단일 대상 화상 마법 (C랭크)","cooldown":0},
    "aoeCcStunC":{"id":"aoeCcStunC","name":"파쇄충격","grade":"C","category":"aoeCC","target":"allEnemies","costs":{"mp":0,"sp":60},"coef":1.33,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"광역 대상 광역 기절 (C랭크)","cooldown":0},
    "aoeCcFreezeC":{"id":"aoeCcFreezeC","name":"빙결의 파동","grade":"C","category":"aoeCC","target":"allEnemies","costs":{"mp":60,"sp":0},"coef":1.33,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"광역 대상 광역 빙결 (C랭크)","cooldown":0},
    "aoeCcPoisonC":{"id":"aoeCcPoisonC","name":"독안개진","grade":"C","category":"aoeCC","target":"allEnemies","costs":{"mp":60,"sp":0},"coef":1.33,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"광역 대상 광역 독 (C랭크)","cooldown":0},
    "aoeCcBurnC":{"id":"aoeCcBurnC","name":"업화","grade":"C","category":"aoeCC","target":"allEnemies","costs":{"mp":60,"sp":0},"coef":1.33,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"광역 대상 광역 화상 (C랭크)","cooldown":0},
    "singleHealC":{"id":"singleHealC","name":"생명의 손길","grade":"C","category":"singleHeal","target":"singleAlly","costs":{"mp":30,"sp":0},"coef":1.6,"statTypes":["int"],"damageType":"magic","element":"none","desc":"단일 대상 회복 (C랭크)","cooldown":0},
    "aoeHealC":{"id":"aoeHealC","name":"대지의 은혜","grade":"C","category":"aoeHeal","target":"allAllies","costs":{"mp":60,"sp":0},"coef":0.93,"statTypes":["int"],"damageType":"magic","element":"none","desc":"광역 회복 (C랭크)","cooldown":0},
    "buffStrC":{"id":"buffStrC","name":"전투격려","grade":"C","category":"buff","target":"self","costs":{"mp":30,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","buff":{"stats":{"str":6}},"duration":3,"desc":"STR 강화 버프 3턴 (C랭크)","cooldown":0},
    "buffConC":{"id":"buffConC","name":"견고한 방벽","grade":"C","category":"buff","target":"self","costs":{"mp":30,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","buff":{"stats":{"con":6}},"duration":3,"desc":"CON 강화 버프 3턴 (C랭크)","cooldown":0},
    "buffIntC":{"id":"buffIntC","name":"지혜의 각성","grade":"C","category":"buff","target":"self","costs":{"mp":30,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","buff":{"stats":{"int":6}},"duration":3,"desc":"INT 강화 버프 3턴 (C랭크)","cooldown":0},
    "buffAgiC":{"id":"buffAgiC","name":"그림자 걸음","grade":"C","category":"buff","target":"self","costs":{"mp":30,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","buff":{"stats":{"agi":6}},"duration":3,"desc":"AGI 강화 버프 3턴 (C랭크)","cooldown":0},
    "buffSenseC":{"id":"buffSenseC","name":"천리안","grade":"C","category":"buff","target":"self","costs":{"mp":30,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","buff":{"stats":{"sense":6}},"duration":3,"desc":"SENSE 강화 버프 3턴 (C랭크)","cooldown":0},
    "buffPdefC":{"id":"buffPdefC","name":"철벽방어","grade":"C","category":"buff","target":"self","costs":{"mp":30,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","buff":{"stats":{"pdef":6}},"duration":3,"desc":"PDEF 강화 버프 3턴 (C랭크)","cooldown":0},
    "buffMdefC":{"id":"buffMdefC","name":"마법저항","grade":"C","category":"buff","target":"self","costs":{"mp":30,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","buff":{"stats":{"mdef":6}},"duration":3,"desc":"MDEF 강화 버프 3턴 (C랭크)","cooldown":0},
    "buffTauntC":{"id":"buffTauntC","name":"전장의 포효","grade":"C","category":"buff","target":"self","costs":{"mp":0,"sp":30},"coef":0,"statTypes":["con"],"damageType":"physical","element":"none","buff":{"stats":{},"threatBonus":7},"duration":3,"desc":"도발 버프 3턴, 위협 +7 (C랭크)","cooldown":0},
    "passiveStrC":{"id":"passiveStrC","name":"전사의 힘","grade":"C","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","duration":0,"desc":"STR 패시브 영구 보너스 (C랭크)","cooldown":0,"passiveBonuses":{"str":6}},
    "passiveConC":{"id":"passiveConC","name":"전사의 체력","grade":"C","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","duration":0,"desc":"CON 패시브 영구 보너스 (C랭크)","cooldown":0,"passiveBonuses":{"con":6}},
    "passiveIntC":{"id":"passiveIntC","name":"학자의 지식","grade":"C","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","duration":0,"desc":"INT 패시브 영구 보너스 (C랭크)","cooldown":0,"passiveBonuses":{"int":6}},
    "passiveAgiC":{"id":"passiveAgiC","name":"암살자의 발걸음","grade":"C","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","duration":0,"desc":"AGI 패시브 영구 보너스 (C랭크)","cooldown":0,"passiveBonuses":{"agi":6}},
    "passiveSenseC":{"id":"passiveSenseC","name":"사냥꾼의 감각","grade":"C","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","duration":0,"desc":"SENSE 패시브 영구 보너스 (C랭크)","cooldown":0,"passiveBonuses":{"sense":6}},
    "passivePdefC":{"id":"passivePdefC","name":"철벽 수호","grade":"C","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","duration":0,"desc":"PDEF 패시브 영구 보너스 (C랭크)","cooldown":0,"passiveBonuses":{"pdef":6}},
    "passiveMdefC":{"id":"passiveMdefC","name":"마력 차단","grade":"C","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","duration":0,"desc":"MDEF 패시브 영구 보너스 (C랭크)","cooldown":0,"passiveBonuses":{"mdef":6}},
    "singleAttackPhysB":{"id":"singleAttackPhysB","name":"파쇄일섬","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":0,"sp":40},"coef":4.8,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 단일 공격 (B랭크)","cooldown":0},
    "singleAttackMagB":{"id":"singleAttackMagB","name":"섬멸의 탄환","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 단일 공격 (B랭크)","cooldown":0},
    "aoeAttackPhysB":{"id":"aoeAttackPhysB","name":"광풍난무","grade":"B","category":"aoeAttack","target":"allEnemies","costs":{"mp":0,"sp":80},"coef":2.78,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 광역 공격 (B랭크)","cooldown":0},
    "aoeAttackMagB":{"id":"aoeAttackMagB","name":"마기의 폭류","grade":"B","category":"aoeAttack","target":"allEnemies","costs":{"mp":80,"sp":0},"coef":2.78,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 광역 공격 (B랭크)","cooldown":0},
    "elemAttackFireB":{"id":"elemAttackFireB","name":"업화격","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"fire","desc":"화염 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "elemAttackIceB":{"id":"elemAttackIceB","name":"빙폭","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"ice","desc":"빙결 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "elemAttackWaterB":{"id":"elemAttackWaterB","name":"격류","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"water","desc":"수류 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "elemAttackWindB":{"id":"elemAttackWindB","name":"폭풍참","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"wind","desc":"질풍 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "elemAttackEarthB":{"id":"elemAttackEarthB","name":"지각붕괴","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"earth","desc":"대지 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "elemAttackElectricB":{"id":"elemAttackElectricB","name":"뇌전","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"electric","desc":"전격 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "elemAttackLightB":{"id":"elemAttackLightB","name":"성스러운 빛","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"light","desc":"성광 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "elemAttackDarkB":{"id":"elemAttackDarkB","name":"심연의 손길","grade":"B","category":"singleAttack","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":4.8,"statTypes":["int"],"damageType":"magic","element":"dark","desc":"암흑 속성 마법 단일 공격 (B랭크)","cooldown":0},
    "singleCcStunB":{"id":"singleCcStunB","name":"뇌진격","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":40},"coef":3.84,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"단일 대상 기절 타격 (B랭크)","cooldown":0},
    "singleCcFreezeB":{"id":"singleCcFreezeB","name":"극한동파","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"단일 대상 빙결 마법 (B랭크)","cooldown":0},
    "singleCcParalyzeB":{"id":"singleCcParalyzeB","name":"신경차단","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"electric","cc":{"type":"paralyze","turns":2,"chance":0.16},"desc":"단일 대상 마비 전격 (B랭크)","cooldown":0},
    "singleCcSleepB":{"id":"singleCcSleepB","name":"깊은 잠","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"sleep","turns":3,"chance":0.16},"desc":"단일 대상 수면 마법 (B랭크)","cooldown":0},
    "singleCcBindB":{"id":"singleCcBindB","name":"구속쇄","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":40},"coef":3.84,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bind","turns":2,"chance":0.18},"desc":"단일 대상 속박 타격 (B랭크)","cooldown":0},
    "singleCcCurseB":{"id":"singleCcCurseB","name":"파멸의 저주","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"dark","cc":{"type":"curse","turns":3,"chance":0.18},"desc":"단일 대상 저주 마법 (B랭크)","cooldown":0},
    "singleCcSilenceB":{"id":"singleCcSilenceB","name":"정신쇄","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"silence","turns":2,"chance":0.2},"desc":"단일 대상 침묵 마법 (B랭크)","cooldown":0},
    "singleCcSlowB":{"id":"singleCcSlowB","name":"중력구속","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":40},"coef":3.84,"statTypes":["agi"],"damageType":"physical","element":"none","cc":{"type":"slow","turns":3,"chance":0.25},"desc":"단일 대상 둔화 타격 (B랭크)","cooldown":0},
    "singleCcBlindB":{"id":"singleCcBlindB","name":"암흑안개","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"blind","turns":3,"chance":0.2},"desc":"단일 대상 실명 마법 (B랭크)","cooldown":0},
    "singleCcPoisonB":{"id":"singleCcPoisonB","name":"독사의 이빨","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"단일 대상 독 마법 (B랭크)","cooldown":0},
    "singleCcBleedB":{"id":"singleCcBleedB","name":"혈풍참","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":40},"coef":3.84,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bleed","turns":3,"chance":0.23},"desc":"단일 대상 출혈 타격 (B랭크)","cooldown":0},
    "singleCcBurnB":{"id":"singleCcBurnB","name":"화염방사","grade":"B","category":"singleCC","target":"singleEnemy","costs":{"mp":40,"sp":0},"coef":3.84,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"단일 대상 화상 마법 (B랭크)","cooldown":0},
    "aoeCcStunB":{"id":"aoeCcStunB","name":"충격파동","grade":"B","category":"aoeCC","target":"allEnemies","costs":{"mp":0,"sp":80},"coef":2.23,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"광역 대상 광역 기절 (B랭크)","cooldown":0},
    "aoeCcFreezeB":{"id":"aoeCcFreezeB","name":"빙하의 포효","grade":"B","category":"aoeCC","target":"allEnemies","costs":{"mp":80,"sp":0},"coef":2.23,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"광역 대상 광역 빙결 (B랭크)","cooldown":0},
    "aoeCcPoisonB":{"id":"aoeCcPoisonB","name":"역병의 숨결","grade":"B","category":"aoeCC","target":"allEnemies","costs":{"mp":80,"sp":0},"coef":2.23,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"광역 대상 광역 독 (B랭크)","cooldown":0},
    "aoeCcBurnB":{"id":"aoeCcBurnB","name":"화염폭풍","grade":"B","category":"aoeCC","target":"allEnemies","costs":{"mp":80,"sp":0},"coef":2.23,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"광역 대상 광역 화상 (B랭크)","cooldown":0},
    "singleHealB":{"id":"singleHealB","name":"신성한 치유","grade":"B","category":"singleHeal","target":"singleAlly","costs":{"mp":40,"sp":0},"coef":1.8,"statTypes":["int"],"damageType":"magic","element":"none","desc":"단일 대상 회복 (B랭크)","cooldown":0},
    "aoeHealB":{"id":"aoeHealB","name":"성스러운 비","grade":"B","category":"aoeHeal","target":"allAllies","costs":{"mp":80,"sp":0},"coef":1.04,"statTypes":["int"],"damageType":"magic","element":"none","desc":"광역 회복 (B랭크)","cooldown":0},
    "buffStrB":{"id":"buffStrB","name":"광전사의 분노","grade":"B","category":"buff","target":"self","costs":{"mp":40,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","buff":{"stats":{"str":8}},"duration":3,"desc":"STR 강화 버프 3턴 (B랭크)","cooldown":0},
    "buffConB":{"id":"buffConB","name":"불굴의 의지","grade":"B","category":"buff","target":"self","costs":{"mp":40,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","buff":{"stats":{"con":8}},"duration":3,"desc":"CON 강화 버프 3턴 (B랭크)","cooldown":0},
    "buffIntB":{"id":"buffIntB","name":"마력 해방","grade":"B","category":"buff","target":"self","costs":{"mp":40,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","buff":{"stats":{"int":8}},"duration":3,"desc":"INT 강화 버프 3턴 (B랭크)","cooldown":0},
    "buffAgiB":{"id":"buffAgiB","name":"번개 발걸음","grade":"B","category":"buff","target":"self","costs":{"mp":40,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","buff":{"stats":{"agi":8}},"duration":3,"desc":"AGI 강화 버프 3턴 (B랭크)","cooldown":0},
    "buffSenseB":{"id":"buffSenseB","name":"예지의 눈","grade":"B","category":"buff","target":"self","costs":{"mp":40,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","buff":{"stats":{"sense":8}},"duration":3,"desc":"SENSE 강화 버프 3턴 (B랭크)","cooldown":0},
    "buffPdefB":{"id":"buffPdefB","name":"난공불락","grade":"B","category":"buff","target":"self","costs":{"mp":40,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","buff":{"stats":{"pdef":8}},"duration":3,"desc":"PDEF 강화 버프 3턴 (B랭크)","cooldown":0},
    "buffMdefB":{"id":"buffMdefB","name":"마법반사","grade":"B","category":"buff","target":"self","costs":{"mp":40,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","buff":{"stats":{"mdef":8}},"duration":3,"desc":"MDEF 강화 버프 3턴 (B랭크)","cooldown":0},
    "buffTauntB":{"id":"buffTauntB","name":"왕의 위엄","grade":"B","category":"buff","target":"self","costs":{"mp":0,"sp":40},"coef":0,"statTypes":["con"],"damageType":"physical","element":"none","buff":{"stats":{},"threatBonus":10},"duration":3,"desc":"도발 버프 3턴, 위협 +10 (B랭크)","cooldown":0},
    "passiveStrB":{"id":"passiveStrB","name":"강인한 근력","grade":"B","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","duration":0,"desc":"STR 패시브 영구 보너스 (B랭크)","cooldown":0,"passiveBonuses":{"str":8}},
    "passiveConB":{"id":"passiveConB","name":"강인한 체력","grade":"B","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","duration":0,"desc":"CON 패시브 영구 보너스 (B랭크)","cooldown":0,"passiveBonuses":{"con":8}},
    "passiveIntB":{"id":"passiveIntB","name":"현자의 지혜","grade":"B","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","duration":0,"desc":"INT 패시브 영구 보너스 (B랭크)","cooldown":0,"passiveBonuses":{"int":8}},
    "passiveAgiB":{"id":"passiveAgiB","name":"바람의 민첩","grade":"B","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","duration":0,"desc":"AGI 패시브 영구 보너스 (B랭크)","cooldown":0,"passiveBonuses":{"agi":8}},
    "passiveSenseB":{"id":"passiveSenseB","name":"예리한 감각","grade":"B","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","duration":0,"desc":"SENSE 패시브 영구 보너스 (B랭크)","cooldown":0,"passiveBonuses":{"sense":8}},
    "passivePdefB":{"id":"passivePdefB","name":"요새의 몸","grade":"B","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","duration":0,"desc":"PDEF 패시브 영구 보너스 (B랭크)","cooldown":0,"passiveBonuses":{"pdef":8}},
    "passiveMdefB":{"id":"passiveMdefB","name":"마법저항 체질","grade":"B","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","duration":0,"desc":"MDEF 패시브 영구 보너스 (B랭크)","cooldown":0,"passiveBonuses":{"mdef":8}},
    "singleAttackPhysA":{"id":"singleAttackPhysA","name":"멸살참","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":0,"sp":55},"coef":7.68,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 단일 공격 (A랭크)","cooldown":0},
    "singleAttackMagA":{"id":"singleAttackMagA","name":"마멸포","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 단일 공격 (A랭크)","cooldown":0},
    "aoeAttackPhysA":{"id":"aoeAttackPhysA","name":"천격연무","grade":"A","category":"aoeAttack","target":"allEnemies","costs":{"mp":0,"sp":110},"coef":4.45,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 광역 공격 (A랭크)","cooldown":0},
    "aoeAttackMagA":{"id":"aoeAttackMagA","name":"성마의 진","grade":"A","category":"aoeAttack","target":"allEnemies","costs":{"mp":110,"sp":0},"coef":4.45,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 광역 공격 (A랭크)","cooldown":0},
    "elemAttackFireA":{"id":"elemAttackFireA","name":"홍련의 불꽃","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"fire","desc":"화염 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "elemAttackIceA":{"id":"elemAttackIceA","name":"영겁의 서리","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"ice","desc":"빙결 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "elemAttackWaterA":{"id":"elemAttackWaterA","name":"폭류의 파도","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"water","desc":"수류 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "elemAttackWindA":{"id":"elemAttackWindA","name":"진공의 칼날","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"wind","desc":"질풍 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "elemAttackEarthA":{"id":"elemAttackEarthA","name":"산악의 진노","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"earth","desc":"대지 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "elemAttackElectricA":{"id":"elemAttackElectricA","name":"뇌신의 번개","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"electric","desc":"전격 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "elemAttackLightA":{"id":"elemAttackLightA","name":"천광의 창","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"light","desc":"성광 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "elemAttackDarkA":{"id":"elemAttackDarkA","name":"황혼의 칼날","grade":"A","category":"singleAttack","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":7.68,"statTypes":["int"],"damageType":"magic","element":"dark","desc":"암흑 속성 마법 단일 공격 (A랭크)","cooldown":0},
    "singleCcStunA":{"id":"singleCcStunA","name":"공명파괴","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":55},"coef":6.14,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"단일 대상 기절 타격 (A랭크)","cooldown":0},
    "singleCcFreezeA":{"id":"singleCcFreezeA","name":"빙하의 감옥","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"단일 대상 빙결 마법 (A랭크)","cooldown":0},
    "singleCcParalyzeA":{"id":"singleCcParalyzeA","name":"전신마비","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"electric","cc":{"type":"paralyze","turns":2,"chance":0.16},"desc":"단일 대상 마비 전격 (A랭크)","cooldown":0},
    "singleCcSleepA":{"id":"singleCcSleepA","name":"천년의 안식","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"sleep","turns":3,"chance":0.16},"desc":"단일 대상 수면 마법 (A랭크)","cooldown":0},
    "singleCcBindA":{"id":"singleCcBindA","name":"천쇄의 감옥","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":55},"coef":6.14,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bind","turns":2,"chance":0.18},"desc":"단일 대상 속박 타격 (A랭크)","cooldown":0},
    "singleCcCurseA":{"id":"singleCcCurseA","name":"사신의 낙인","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"dark","cc":{"type":"curse","turns":3,"chance":0.18},"desc":"단일 대상 저주 마법 (A랭크)","cooldown":0},
    "singleCcSilenceA":{"id":"singleCcSilenceA","name":"영혼봉인","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"silence","turns":2,"chance":0.2},"desc":"단일 대상 침묵 마법 (A랭크)","cooldown":0},
    "singleCcSlowA":{"id":"singleCcSlowA","name":"시간왜곡","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":55},"coef":6.14,"statTypes":["agi"],"damageType":"physical","element":"none","cc":{"type":"slow","turns":3,"chance":0.25},"desc":"단일 대상 둔화 타격 (A랭크)","cooldown":0},
    "singleCcBlindA":{"id":"singleCcBlindA","name":"무한어둠","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"blind","turns":3,"chance":0.2},"desc":"단일 대상 실명 마법 (A랭크)","cooldown":0},
    "singleCcPoisonA":{"id":"singleCcPoisonA","name":"치명독","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"단일 대상 독 마법 (A랭크)","cooldown":0},
    "singleCcBleedA":{"id":"singleCcBleedA","name":"피의 광풍","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":55},"coef":6.14,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bleed","turns":3,"chance":0.23},"desc":"단일 대상 출혈 타격 (A랭크)","cooldown":0},
    "singleCcBurnA":{"id":"singleCcBurnA","name":"홍련격","grade":"A","category":"singleCC","target":"singleEnemy","costs":{"mp":55,"sp":0},"coef":6.14,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"단일 대상 화상 마법 (A랭크)","cooldown":0},
    "aoeCcStunA":{"id":"aoeCcStunA","name":"천둥의 진","grade":"A","category":"aoeCC","target":"allEnemies","costs":{"mp":0,"sp":110},"coef":3.56,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"광역 대상 광역 기절 (A랭크)","cooldown":0},
    "aoeCcFreezeA":{"id":"aoeCcFreezeA","name":"동토의 결계","grade":"A","category":"aoeCC","target":"allEnemies","costs":{"mp":110,"sp":0},"coef":3.56,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"광역 대상 광역 빙결 (A랭크)","cooldown":0},
    "aoeCcPoisonA":{"id":"aoeCcPoisonA","name":"만독의 진","grade":"A","category":"aoeCC","target":"allEnemies","costs":{"mp":110,"sp":0},"coef":3.56,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"광역 대상 광역 독 (A랭크)","cooldown":0},
    "aoeCcBurnA":{"id":"aoeCcBurnA","name":"불꽃지옥","grade":"A","category":"aoeCC","target":"allEnemies","costs":{"mp":110,"sp":0},"coef":3.56,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"광역 대상 광역 화상 (A랭크)","cooldown":0},
    "singleHealA":{"id":"singleHealA","name":"천사의 가호","grade":"A","category":"singleHeal","target":"singleAlly","costs":{"mp":55,"sp":0},"coef":2.1,"statTypes":["int"],"damageType":"magic","element":"none","desc":"단일 대상 회복 (A랭크)","cooldown":0},
    "aoeHealA":{"id":"aoeHealA","name":"천사의 찬가","grade":"A","category":"aoeHeal","target":"allAllies","costs":{"mp":110,"sp":0},"coef":1.22,"statTypes":["int"],"damageType":"magic","element":"none","desc":"광역 회복 (A랭크)","cooldown":0},
    "buffStrA":{"id":"buffStrA","name":"영웅의 함성","grade":"A","category":"buff","target":"self","costs":{"mp":55,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","buff":{"stats":{"str":11}},"duration":3,"desc":"STR 강화 버프 3턴 (A랭크)","cooldown":0},
    "buffConA":{"id":"buffConA","name":"불사의 육체","grade":"A","category":"buff","target":"self","costs":{"mp":55,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","buff":{"stats":{"con":11}},"duration":3,"desc":"CON 강화 버프 3턴 (A랭크)","cooldown":0},
    "buffIntA":{"id":"buffIntA","name":"대현자의 지혜","grade":"A","category":"buff","target":"self","costs":{"mp":55,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","buff":{"stats":{"int":11}},"duration":3,"desc":"INT 강화 버프 3턴 (A랭크)","cooldown":0},
    "buffAgiA":{"id":"buffAgiA","name":"잔상보법","grade":"A","category":"buff","target":"self","costs":{"mp":55,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","buff":{"stats":{"agi":11}},"duration":3,"desc":"AGI 강화 버프 3턴 (A랭크)","cooldown":0},
    "buffSenseA":{"id":"buffSenseA","name":"만물감지","grade":"A","category":"buff","target":"self","costs":{"mp":55,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","buff":{"stats":{"sense":11}},"duration":3,"desc":"SENSE 강화 버프 3턴 (A랭크)","cooldown":0},
    "buffPdefA":{"id":"buffPdefA","name":"무적의 방패","grade":"A","category":"buff","target":"self","costs":{"mp":55,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","buff":{"stats":{"pdef":11}},"duration":3,"desc":"PDEF 강화 버프 3턴 (A랭크)","cooldown":0},
    "buffMdefA":{"id":"buffMdefA","name":"마력무효화","grade":"A","category":"buff","target":"self","costs":{"mp":55,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","buff":{"stats":{"mdef":11}},"duration":3,"desc":"MDEF 강화 버프 3턴 (A랭크)","cooldown":0},
    "buffTauntA":{"id":"buffTauntA","name":"공포의 기운","grade":"A","category":"buff","target":"self","costs":{"mp":0,"sp":55},"coef":0,"statTypes":["con"],"damageType":"physical","element":"none","buff":{"stats":{},"threatBonus":13},"duration":3,"desc":"도발 버프 3턴, 위협 +13 (A랭크)","cooldown":0},
    "passiveStrA":{"id":"passiveStrA","name":"초인의 힘","grade":"A","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","duration":0,"desc":"STR 패시브 영구 보너스 (A랭크)","cooldown":0,"passiveBonuses":{"str":11}},
    "passiveConA":{"id":"passiveConA","name":"초인의 체력","grade":"A","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","duration":0,"desc":"CON 패시브 영구 보너스 (A랭크)","cooldown":0,"passiveBonuses":{"con":11}},
    "passiveIntA":{"id":"passiveIntA","name":"대마도사의 지력","grade":"A","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","duration":0,"desc":"INT 패시브 영구 보너스 (A랭크)","cooldown":0,"passiveBonuses":{"int":11}},
    "passiveAgiA":{"id":"passiveAgiA","name":"번개의 몸놀림","grade":"A","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","duration":0,"desc":"AGI 패시브 영구 보너스 (A랭크)","cooldown":0,"passiveBonuses":{"agi":11}},
    "passiveSenseA":{"id":"passiveSenseA","name":"초감각","grade":"A","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","duration":0,"desc":"SENSE 패시브 영구 보너스 (A랭크)","cooldown":0,"passiveBonuses":{"sense":11}},
    "passivePdefA":{"id":"passivePdefA","name":"강철 피부","grade":"A","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","duration":0,"desc":"PDEF 패시브 영구 보너스 (A랭크)","cooldown":0,"passiveBonuses":{"pdef":11}},
    "passiveMdefA":{"id":"passiveMdefA","name":"마력 면역","grade":"A","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","duration":0,"desc":"MDEF 패시브 영구 보너스 (A랭크)","cooldown":0,"passiveBonuses":{"mdef":11}},
    "singleAttackPhysS":{"id":"singleAttackPhysS","name":"천벌의 일격","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":0,"sp":70},"coef":11.52,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 단일 공격 (S랭크)","cooldown":0},
    "singleAttackMagS":{"id":"singleAttackMagS","name":"성천의 마탄","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 단일 공격 (S랭크)","cooldown":0},
    "aoeAttackPhysS":{"id":"aoeAttackPhysS","name":"멸살의 광풍","grade":"S","category":"aoeAttack","target":"allEnemies","costs":{"mp":0,"sp":140},"coef":6.68,"statTypes":["str"],"damageType":"physical","element":"none","desc":"무속성 물리 광역 공격 (S랭크)","cooldown":0},
    "aoeAttackMagS":{"id":"aoeAttackMagS","name":"궁극의 마력진","grade":"S","category":"aoeAttack","target":"allEnemies","costs":{"mp":140,"sp":0},"coef":6.68,"statTypes":["int"],"damageType":"magic","element":"none","desc":"무속성 마법 광역 공격 (S랭크)","cooldown":0},
    "elemAttackFireS":{"id":"elemAttackFireS","name":"멸화의 극염","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"fire","desc":"화염 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "elemAttackIceS":{"id":"elemAttackIceS","name":"극한빙결","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"ice","desc":"빙결 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "elemAttackWaterS":{"id":"elemAttackWaterS","name":"심해의 포효","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"water","desc":"수류 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "elemAttackWindS":{"id":"elemAttackWindS","name":"천공의 폭풍","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"wind","desc":"질풍 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "elemAttackEarthS":{"id":"elemAttackEarthS","name":"대지의 심판","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"earth","desc":"대지 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "elemAttackElectricS":{"id":"elemAttackElectricS","name":"만뢰의 심판","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"electric","desc":"전격 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "elemAttackLightS":{"id":"elemAttackLightS","name":"성천의 심판","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"light","desc":"성광 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "elemAttackDarkS":{"id":"elemAttackDarkS","name":"나락의 심판","grade":"S","category":"singleAttack","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":11.52,"statTypes":["int"],"damageType":"magic","element":"dark","desc":"암흑 속성 마법 단일 공격 (S랭크)","cooldown":0},
    "singleCcStunS":{"id":"singleCcStunS","name":"천둥의 일격","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":70},"coef":9.22,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"단일 대상 기절 타격 (S랭크)","cooldown":0},
    "singleCcFreezeS":{"id":"singleCcFreezeS","name":"시간동결","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"단일 대상 빙결 마법 (S랭크)","cooldown":0},
    "singleCcParalyzeS":{"id":"singleCcParalyzeS","name":"절대속박","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"electric","cc":{"type":"paralyze","turns":2,"chance":0.16},"desc":"단일 대상 마비 전격 (S랭크)","cooldown":0},
    "singleCcSleepS":{"id":"singleCcSleepS","name":"영겁의 잠","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"sleep","turns":3,"chance":0.16},"desc":"단일 대상 수면 마법 (S랭크)","cooldown":0},
    "singleCcBindS":{"id":"singleCcBindS","name":"차원봉인","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":70},"coef":9.22,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bind","turns":2,"chance":0.18},"desc":"단일 대상 속박 타격 (S랭크)","cooldown":0},
    "singleCcCurseS":{"id":"singleCcCurseS","name":"천벌의 저주","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"dark","cc":{"type":"curse","turns":3,"chance":0.18},"desc":"단일 대상 저주 마법 (S랭크)","cooldown":0},
    "singleCcSilenceS":{"id":"singleCcSilenceS","name":"절대침묵","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"silence","turns":2,"chance":0.2},"desc":"단일 대상 침묵 마법 (S랭크)","cooldown":0},
    "singleCcSlowS":{"id":"singleCcSlowS","name":"시공정지","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":70},"coef":9.22,"statTypes":["agi"],"damageType":"physical","element":"none","cc":{"type":"slow","turns":3,"chance":0.25},"desc":"단일 대상 둔화 타격 (S랭크)","cooldown":0},
    "singleCcBlindS":{"id":"singleCcBlindS","name":"심연의 눈","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"blind","turns":3,"chance":0.2},"desc":"단일 대상 실명 마법 (S랭크)","cooldown":0},
    "singleCcPoisonS":{"id":"singleCcPoisonS","name":"멸독의 비수","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"단일 대상 독 마법 (S랭크)","cooldown":0},
    "singleCcBleedS":{"id":"singleCcBleedS","name":"혈계의 참격","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":0,"sp":70},"coef":9.22,"statTypes":["str"],"damageType":"physical","element":"none","cc":{"type":"bleed","turns":3,"chance":0.23},"desc":"단일 대상 출혈 타격 (S랭크)","cooldown":0},
    "singleCcBurnS":{"id":"singleCcBurnS","name":"지옥의 업화","grade":"S","category":"singleCC","target":"singleEnemy","costs":{"mp":70,"sp":0},"coef":9.22,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"단일 대상 화상 마법 (S랭크)","cooldown":0},
    "aoeCcStunS":{"id":"aoeCcStunS","name":"신벌의 지진","grade":"S","category":"aoeCC","target":"allEnemies","costs":{"mp":0,"sp":140},"coef":5.35,"statTypes":["con"],"damageType":"physical","element":"none","cc":{"type":"stun","turns":2,"chance":0.16},"desc":"광역 대상 광역 기절 (S랭크)","cooldown":0},
    "aoeCcFreezeS":{"id":"aoeCcFreezeS","name":"빙결의 종말","grade":"S","category":"aoeCC","target":"allEnemies","costs":{"mp":140,"sp":0},"coef":5.35,"statTypes":["int"],"damageType":"magic","element":"ice","cc":{"type":"freeze","turns":2,"chance":0.16},"desc":"광역 대상 광역 빙결 (S랭크)","cooldown":0},
    "aoeCcPoisonS":{"id":"aoeCcPoisonS","name":"멸독의 안개","grade":"S","category":"aoeCC","target":"allEnemies","costs":{"mp":140,"sp":0},"coef":5.35,"statTypes":["int"],"damageType":"magic","element":"none","cc":{"type":"poison","turns":3,"chance":0.23},"desc":"광역 대상 광역 독 (S랭크)","cooldown":0},
    "aoeCcBurnS":{"id":"aoeCcBurnS","name":"종말의 화염","grade":"S","category":"aoeCC","target":"allEnemies","costs":{"mp":140,"sp":0},"coef":5.35,"statTypes":["int"],"damageType":"magic","element":"fire","cc":{"type":"burn","turns":5,"chance":0.23},"desc":"광역 대상 광역 화상 (S랭크)","cooldown":0},
    "singleHealS":{"id":"singleHealS","name":"기적의 치유","grade":"S","category":"singleHeal","target":"singleAlly","costs":{"mp":70,"sp":0},"coef":2.4,"statTypes":["int"],"damageType":"magic","element":"none","desc":"단일 대상 회복 (S랭크)","cooldown":0},
    "aoeHealS":{"id":"aoeHealS","name":"기적의 성가","grade":"S","category":"aoeHeal","target":"allAllies","costs":{"mp":140,"sp":0},"coef":1.39,"statTypes":["int"],"damageType":"magic","element":"none","desc":"광역 회복 (S랭크)","cooldown":0},
    "buffStrS":{"id":"buffStrS","name":"전쟁신의 축복","grade":"S","category":"buff","target":"self","costs":{"mp":70,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","buff":{"stats":{"str":14}},"duration":3,"desc":"STR 강화 버프 3턴 (S랭크)","cooldown":0},
    "buffConS":{"id":"buffConS","name":"신체의 축복","grade":"S","category":"buff","target":"self","costs":{"mp":70,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","buff":{"stats":{"con":14}},"duration":3,"desc":"CON 강화 버프 3턴 (S랭크)","cooldown":0},
    "buffIntS":{"id":"buffIntS","name":"전지의 축복","grade":"S","category":"buff","target":"self","costs":{"mp":70,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","buff":{"stats":{"int":14}},"duration":3,"desc":"INT 강화 버프 3턴 (S랭크)","cooldown":0},
    "buffAgiS":{"id":"buffAgiS","name":"시공의 축복","grade":"S","category":"buff","target":"self","costs":{"mp":70,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","buff":{"stats":{"agi":14}},"duration":3,"desc":"AGI 강화 버프 3턴 (S랭크)","cooldown":0},
    "buffSenseS":{"id":"buffSenseS","name":"전지전능의 눈","grade":"S","category":"buff","target":"self","costs":{"mp":70,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","buff":{"stats":{"sense":14}},"duration":3,"desc":"SENSE 강화 버프 3턴 (S랭크)","cooldown":0},
    "buffPdefS":{"id":"buffPdefS","name":"절대방어","grade":"S","category":"buff","target":"self","costs":{"mp":70,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","buff":{"stats":{"pdef":14}},"duration":3,"desc":"PDEF 강화 버프 3턴 (S랭크)","cooldown":0},
    "buffMdefS":{"id":"buffMdefS","name":"절대마방","grade":"S","category":"buff","target":"self","costs":{"mp":70,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","buff":{"stats":{"mdef":14}},"duration":3,"desc":"MDEF 강화 버프 3턴 (S랭크)","cooldown":0},
    "buffTauntS":{"id":"buffTauntS","name":"절대지배","grade":"S","category":"buff","target":"self","costs":{"mp":0,"sp":70},"coef":0,"statTypes":["con"],"damageType":"physical","element":"none","buff":{"stats":{},"threatBonus":16},"duration":3,"desc":"도발 버프 3턴, 위협 +16 (S랭크)","cooldown":0},
    "passiveStrS":{"id":"passiveStrS","name":"신의 근력","grade":"S","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["str"],"damageType":"magic","element":"none","duration":0,"desc":"STR 패시브 영구 보너스 (S랭크)","cooldown":0,"passiveBonuses":{"str":14}},
    "passiveConS":{"id":"passiveConS","name":"신의 체력","grade":"S","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["con"],"damageType":"magic","element":"none","duration":0,"desc":"CON 패시브 영구 보너스 (S랭크)","cooldown":0,"passiveBonuses":{"con":14}},
    "passiveIntS":{"id":"passiveIntS","name":"신의 지력","grade":"S","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["int"],"damageType":"magic","element":"none","duration":0,"desc":"INT 패시브 영구 보너스 (S랭크)","cooldown":0,"passiveBonuses":{"int":14}},
    "passiveAgiS":{"id":"passiveAgiS","name":"신의 민첩","grade":"S","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["agi"],"damageType":"magic","element":"none","duration":0,"desc":"AGI 패시브 영구 보너스 (S랭크)","cooldown":0,"passiveBonuses":{"agi":14}},
    "passiveSenseS":{"id":"passiveSenseS","name":"신의 감각","grade":"S","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["sense"],"damageType":"magic","element":"none","duration":0,"desc":"SENSE 패시브 영구 보너스 (S랭크)","cooldown":0,"passiveBonuses":{"sense":14}},
    "passivePdefS":{"id":"passivePdefS","name":"신의 갑옷","grade":"S","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["pDef"],"damageType":"magic","element":"none","duration":0,"desc":"PDEF 패시브 영구 보너스 (S랭크)","cooldown":0,"passiveBonuses":{"pdef":14}},
    "passiveMdefS":{"id":"passiveMdefS","name":"신의 마력","grade":"S","category":"passive","target":"self","costs":{"mp":0,"sp":0},"coef":0,"statTypes":["mDef"],"damageType":"magic","element":"none","duration":0,"desc":"MDEF 패시브 영구 보너스 (S랭크)","cooldown":0,"passiveBonuses":{"mdef":14}}
  };

  function buildSampleCharacters() {
    return [
    ];
  }
  function buildSampleMonsters() {
    return [
      { id:'mon_hound', name:'왜곡 사냥개', kind:'Normal', role:'skirmisher', position:'근거리물리', row:'front', rank:'E', stats:{ str:10, con:9, int:2, agi:11, sense:8 }, hp:80, mp:0, sp:40, atk:7, pdef:3, mdef:1, skills:[] },
      { id:'mon_lancer', name:'공허 창병', kind:'Normal', role:'fighter', position:'근거리물리', row:'front', rank:'E', stats:{ str:12, con:10, int:2, agi:9, sense:7 }, hp:90, mp:0, sp:55, atk:8, pdef:4, mdef:1, skills:[] },
      { id:'mon_echo_mage', name:'반향 주술체', kind:'Elite', role:'caster', position:'원거리마법', row:'back', rank:'D', stats:{ str:4, con:10, int:15, agi:8, sense:11 }, hp:220, mp:120, sp:40, atk:16, pdef:5, mdef:8, damageType:'magic', attackStat:'int', skills:['energyBolt','energyShower','shockwave'] },
      { id:'mon_gate_apex', name:'문턱의 포식자', kind:'Boss', role:'boss', position:'근거리물리', row:'front', rank:'D', stats:{ str:16, con:15, int:8, agi:10, sense:10 }, hp:520, mp:90, sp:120, atk:18, pdef:14, mdef:10, skills:['shieldBash','shockwave','fistStrike','taunt'] }
    ];
  }

  function buildDefaultInventory() {
    return { gold:0, bagId:'none', items:[], overflow:[], recent:[] };
  }

  function buildSampleEquipments() {
    const items = [];
    const SHOP_RANKS = ['E','D','C'];
    let idx = 0;
    for (const rank of SHOP_RANKS) {
      const baseAtk = WEAPON_BASE_ATK[rank] || 5;
      const armorBase = ARMOR_STAT_BY_RANK[rank] || { defRange:[0,5], resistance:1 };
      const maxDef = armorBase.defRange[1];
      // ── 무기 5종 ──
      const weaponSuffixes = ['검','대검','단검','지팡이','활'];
      for (let w = 0; w < 5; w++) {
        const isAssoc = (rank === 'E');
        const prefix = isAssoc ? '협회지급' : EQUIP_RANK_PREFIX[rank][w % EQUIP_RANK_PREFIX[rank].length];
        const suff = weaponSuffixes[w];
        const atk = isAssoc ? baseAtk : Math.max(1, Math.round(baseAtk * (0.85 + Math.random() * 0.10)));
        const price = isAssoc ? 0 : Math.round(calcEquipBasePrice(rank, 'weapon') * (0.85 + Math.random() * 0.10));
        const mainStats = ['str','str','agi','int','agi'];
        items.push({
          id: `eq_${rank.toLowerCase()}_weapon_${String(++idx).padStart(2,'0')}`,
          name: `${prefix} ${suff}`,
          part: 'weapon', rank, rarity: 'Normal',
          enhance: 0, infuse: 0, maxInfuse: 2, traits: [],
          durability: 100, maxDurability: 100,
          atk, pdef: 0, mdef: 0,
          mainStat: mainStats[w], resistType: '', resistPct: 0,
          price,
          note: isAssoc ? '협회에서 신규 헌터에게 지급하는 표준 규격 무기.' : `${rank}급 표준 ${suff}.`
        });
      }
      // ── 보조무기 3종 (기본 특성 1개, 주입 최대 2 — 특수효과는 주입이 아님) ──
      const subSuffixes = ['방패','장갑','보호대'];
      for (let s = 0; s < 3; s++) {
        const prefix = EQUIP_RANK_PREFIX[rank][s % EQUIP_RANK_PREFIX[rank].length];
        const suff = subSuffixes[s];
        const isShield = (suff === '방패');
        const pdef = isShield ? Math.max(1, Math.round(maxDef * 0.25 * (0.85 + Math.random() * 0.10))) : 0;
        const price = Math.round(calcEquipBasePrice(rank, 'subweapon') * (0.85 + Math.random() * 0.10));
        const subTrait = NORMAL_TRAIT_POOL[Math.floor(Math.random() * NORMAL_TRAIT_POOL.length)];
        items.push({
          id: `eq_${rank.toLowerCase()}_subweapon_${String(++idx).padStart(2,'0')}`,
          name: `${prefix} ${suff}`,
          part: 'subweapon', rank, rarity: 'Normal',
          enhance: 0, infuse: 0, maxInfuse: 2, traits: [subTrait],
          durability: 100, maxDurability: 100,
          atk: 0, pdef, mdef: 0,
          mainStat: isShield ? 'con' : '', resistType: '', resistPct: 0,
          price,
          note: `${rank}급 보조무기.`
        });
      }
      // ── 방어구: 종류별 2개씩 ──
      for (const subKey of ARMOR_SUBTYPE_KEYS) {
        const sub = ARMOR_SUBTYPES[subKey];
        for (let a = 0; a < 2; a++) {
          const prefix = EQUIP_RANK_PREFIX[rank][(a + ARMOR_SUBTYPE_KEYS.indexOf(subKey)) % EQUIP_RANK_PREFIX[rank].length];
          const suffArr = EQUIP_NAME_SUFFIXES['armor_' + subKey] || [sub.label];
          const suff = suffArr[a % suffArr.length];
          const defMul = sub.defMul[0] + Math.random() * (sub.defMul[1] - sub.defMul[0]);
          const pdef = Math.max(1, Math.round(maxDef * defMul * (0.85 + Math.random() * 0.10)));
          const mdef = Math.max(1, Math.round(maxDef * defMul * (0.85 + Math.random() * 0.10)));
          const atkPenalty = sub.atkMul ? Math.round(baseAtk * sub.atkMul) : 0;
          const mainStat = sub.statPool[a % sub.statPool.length];
          const price = Math.round(calcEquipBasePrice(rank, 'armor') * (0.85 + Math.random() * 0.10));
          items.push({
            id: `eq_${rank.toLowerCase()}_armor_${subKey}_${String(++idx).padStart(2,'0')}`,
            name: `${prefix} ${suff}`,
            part: 'armor', rank, rarity: 'Normal',
            armorSubtype: subKey, armorStatBonusMul: sub.statBonusMul,
            enhance: 0, infuse: 0, maxInfuse: 2, traits: [],
            durability: 100, maxDurability: 100,
            atk: atkPenalty, pdef, mdef,
            mainStat, resistType: '', resistPct: armorBase.resistance || 0,
            price,
            note: `${rank}급 ${sub.label}.`
          });
        }
      }
      // ── 악세서리 8종 (기본 특성 1개, 주입 최대 1 — 특수효과는 주입이 아님) ──
      const accSuffixes = ['귀걸이','반지','목걸이','벨트','표식','귀걸이','반지','목걸이'];
      const accMainStats = ['str','int','agi','con','sense','str','int','agi'];
      for (let ac = 0; ac < 8; ac++) {
        const prefix = EQUIP_RANK_PREFIX[rank][ac % EQUIP_RANK_PREFIX[rank].length];
        const suff = accSuffixes[ac];
        const price = Math.round(calcEquipBasePrice(rank, 'accessory') * (0.85 + Math.random() * 0.10));
        const accTrait = NORMAL_TRAIT_POOL[Math.floor(Math.random() * NORMAL_TRAIT_POOL.length)];
        items.push({
          id: `eq_${rank.toLowerCase()}_acc_${String(++idx).padStart(2,'0')}`,
          name: `${prefix} ${suff}`,
          part: 'accessory', rank, rarity: 'Normal',
          enhance: 0, infuse: 0, maxInfuse: 1, traits: [accTrait],
          durability: 100, maxDurability: 100,
          atk: 0, pdef: 0, mdef: 0,
          mainStat: accMainStats[ac], resistType: '', resistPct: 0,
          price,
          note: `${rank}급 악세서리.`
        });
      }
    }
    return items;
  }

  function buildDefaultDb() {
    return {
      inventory: buildDefaultInventory(),
      characters: [
        { id:'char_guide', name:'⭐ 캐릭터 가이드', job:'무직업', position:'전열탱커', row:'front', rank:'E', level:1,
          stats:{ str:10, con:10, int:10, agi:10, sense:10 },
          hp:100, mp:100, sp:100, atk:0, pdef:0, mdef:0,
          damageType:'physical', attackStat:'str', skills:[],
          note:'【캐릭터 만드는 법】\n1. "새 캐릭터" 클릭 → ID/이름/직업/포지션 입력\n2. 스탯 최소값=10. 모든 스탯 10일 때 HP=MP=SP=100\n3. HP=100+(CON-10)×10+(STR-10)×3\n4. MP=100+(INT-10)×10+(SEN-10)×3\n5. SP=100+(AGI-10)×10+(SEN-10)×3\n6. ATK/물방/마방은 기본 0 (장비·스킬로 증가)\n7. HP/MP/SP를 0으로 두면 스탯 기반 자동 계산\n8. 전열: front(탱커/근접) / mid(투척) / back(원거리/궁수/마법/힐러)\n9. 등급별 스탯합 기준: E:~70 / D:70~90 / C:90~120 / B:120~160 / A:160~200 / S:200~\n\n이 캐릭터는 삭제해도 됩니다.' }
      ],
      monsters: buildSampleMonsters(),
      personas: [
        { id:'persona_main', name:'기본 페르소나', text:'헌터 세계관용 기본 페르소나 메모.' }
      ],
      customSkills: [
        { id:'skill_guide', name:'⭐ 스킬가이드', grade:'E', category:'singleAttack', target:'singleEnemy',
          costs:{ mp:0, sp:0 }, coef:1.0, damageType:'physical', element:'none', statTypes:['str'], duration:0,
          desc:'【스킬 만드는 법】\n1. "새 스킬" 클릭 → ID/이름 입력\n2. 각 항목을 설정 후 저장\n\n【카테고리 설명】\nsingleAttack = 단일 공격 (적 1체)\naoeAttack = 광역 공격 (전체 적)\nsingleCC = 단일 CC (적 1체 + 행동방해)\naoeCC = 광역 CC (전체 적 + 행동방해)\nsingleHeal = 단일 회복 (아군 1체)\naoeHeal = 광역 회복 (전체 아군)\nbuff = 버프 (자신/아군 강화)\nutility = 유틸리티 (자원/상태 관리)\n\n【은신(stealth) 버프 만드는 법】\n은신은 buff 카테고리 스킬로 만듭니다.\n1. 카테고리: buff\n2. 대상: self (자기 자신)\n3. 버프 스탯: 원하는 스탯 (예: agi +5)\n4. 지속 턴: 원하는 턴수 (예: 3)\n5. 은신 체크박스: 체크 ✓\n효과: 은신 중에는 모든 공격 대상에서 제외됩니다.\n  보스를 포함한 모든 적의 공격에서 은신이 적용됩니다.\n  은신 상태에서 공격하면 즉시 은신이 해제됩니다.\n  지속 턴이 끝나도 자동 해제됩니다.\n\n【특수효과 설정법】\n장비와 스킬에 특수효과를 추가할 수 있습니다.\n1. 효과 종류: 버프(자신/아군 강화) 또는 디버프(적에게 받는 피해 증가)\n2. 발동확률: 0~100% (장비는 피격/공격 시, 스킬은 사용 시)\n3. 효과 선택: 버프는 다양한 효과, 디버프는 받는 피해 증가만 선택 가능\n4. 효과 수치: 효과의 크기 (%, 절대값 등)\n버프: 자신이나 아군의 해당 효과 증가\n디버프: 적에게 받는 피해 증가 적용 (물리/마법/속성별 받는 피해 증가)\n\n【대상 설명】\nsingleEnemy = 적 1체\nallEnemies = 전체 적 (광역)\nrowFront = 전열 적만 (전열 광역)\nrowMid = 중열 적만\nrowBack = 후열 적만\nrowFrontMid = 전열+중열 적\nrowMidBack = 중열+후열 적\nsingleAlly = 아군 1체\nallAllies = 전체 아군\nself = 자기 자신\n※ 열 공격: 해당 열이 비면 가장 앞 열의 적을 공격\n\n【CC 종류 설명】\nstun = 기절 (행동불가, 2턴, 이후 5턴 면역)\nbind = 속박 (감각-50%, 명중률-50%, 이후 5턴 면역)\nsleep = 수면 (행동불가, 3턴, 피격 시 해제, 이후 5턴 면역)\nsilence = 침묵 (스킬 사용불가)\nslow = 둔화 (명중률-30%, 회피율-50%)\nblind = 실명 (명중률-50%)\nfreeze = 빙결 (행동불가, 2턴, 이후 5턴 면역)\nparalyze = 마비 (행동불가, 2턴, 이후 5턴 면역)\n※ CC 확률: 비우면 100%. 0~1 사이 소수로 입력 (예: 0.3=30%)\n\n【속성-상태이상 매칭】\n빛→실명, 어둠→저주, 불→화상, 물→둔화, 대지→기절, 바람→출혈, 얼음→빙결, 전기→마비\n\n【상태이상 설명 및 기본 확률/턴수】\npoison = 독 — 확률23%, 3턴, 최대3중첩\n  효과: 매턴 방어무시 DoT (기본값×계수×0.2×중첩수)\nbleed = 출혈 — 확률23%, 3턴\n  효과: 발동 시 해당 공격 피해의 30% 추가피해(1회)\n  + 3턴간 받는 회복량 50% 감소\nburn = 화상 — 확률23%, 5턴, 최대5중첩\n  효과: 매턴 방어무시 DoT (기본값×계수×0.12×중첩수)\n  + 받는 데미지 +10% (중첩 무관)\ncurse = 저주 — 확률18%, 3턴 (하드CC, 이후 5턴 면역)\n  효과: 등급별 공격력 감소 + 받는 피해 증가 (E:10%~S:30%)\nsilence = 침묵 — 확률20%, 2턴\n  효과: 스킬 사용불가 (기본공격만 가능)\nslow = 둔화 — 확률25%, 3턴\n  효과: 명중률 -30%, 회피율 -50%\nbind = 속박 — 확률18%, 2턴 (하드CC, 이후 5턴 면역)\n  효과: 감각(SENSE) -50%, 명중률 -50% (크리율도 함께 감소)\n  둔화보다 명중 감소폭이 크고, 감각 감소로 크리티컬률도 하락\n\n※ 상태이상 확률: 비우면 위 기본값 자동 적용\n0~1 사이 소수로 입력 (예: 0.5=50%)\n\n【등급별 계수 — 순수 공격 (단일 기준)】\n하한 → 상한\nE: 1.2 → 1.5\nD: 1.92 → 2.4\nC: 2.88 → 3.6\nB: 4.8 → 6.0\nA: 7.68 → 9.6\nS: 11.52 → 14.4\n광역/열공격 = 단일 × 0.58\n\n【CC/상태이상 스킬 추천 계수】\n상태이상이 붙는 스킬은 직접 데미지를 낮추는 대신\n상태이상 효과로 총 가치를 보상하는 구조.\n추천: 순수공격 하한값 × 0.8 (20% 약화)\n\n단일 CC/상태이상 추천계수 (기본확률일 경우):\nE: 0.96 / D: 1.54 / C: 2.30\nB: 3.84 / A: 6.14 / S: 9.22\n\n광역 CC/상태이상 추천계수 (단일×0.58):\nE: 0.56 / D: 0.89 / C: 1.33\nB: 2.23 / A: 3.56 / S: 5.35\n\n※ 밸런스 기준:\n직접피해 + 상태이상 효과(DoT/추가피해/디버프)\n총합이 최소 상한계수급 이상이면 적절.\n독/화상: 총합≈상한의 102%\n출혈: 직접+즉시추가≈상한의 83% + 회복량50%감소 유틸\n상태이상이 강할수록 계수를 더 낮춰도 됨.\n\n【데미지 공식】\n데미지 기본값 = (2 × 주스탯) + (3 × ATK)\n회복 기본값 = 주스탯 × 0.5\n힐 전용 계수: E:1.2~1.3 / D:1.4~1.5 / C:1.6~1.7 / B:1.8~2.0 / A:2.1~2.3 / S:2.4~2.6\n광역힐 = 단일힐 계수 × 0.58\n최종데미지 = 기본값 × 계수 × 크리배율 × 속성배율\n※ 크리티컬: ×1.5 / 속성유리: ×1.25 / 속성불리: ×0.75\n\n【상태이상 효과 공식】\n독(DoT): 매턴 기본값 × 계수 × 0.2 × 중첩수 (최대3)\n화상(DoT): 매턴 기본값 × 계수 × 0.12 × 중첩수 (최대5)\n  + 받는 데미지 +10% (중첩 무관)\n출혈: 발동 시 해당 공격 피해의 30% 추가피해(1회)\n  + 3턴간 받는 회복량 50% 감소\n저주: 등급별 공격력 감소 + 받는 피해 증가 (E:10%~S:30%)\n\n【E급 예시 (주스탯15, ATK5)】\n기본값 = (2×15)+(3×5) = 45\n상한 직접피해 = 45×1.5 = 67.5\n\n■ 순수 단일공격 (계수1.35): 45×1.35 = 60.75\n■ 순수 광역공격 (계수0.78): 45×0.78 = 35.10\n\n■ 단일CC/상태이상 (추천계수0.96):\n  직접피해: 45×0.96 = 43.20\n  독1중첩 3턴합: 45×0.96×0.2×3 = 25.92\n  → 총합: 43.20+25.92 = 69.12 (상한의 102%) ✓\n  화상1중첩 5턴합: 45×0.96×0.12×5 = 25.92\n  → 총합: 43.20+25.92 = 69.12 + 피격+10% ✓\n  출혈 즉시추가: 43.20×0.3 = 12.96\n  → 총합: 43.20+12.96 = 56.16 (상한83%) + 회복량50%감소 ✓\n\n■ 광역CC/상태이상 (추천계수0.56):\n  직접피해: 45×0.56 = 25.20 (각 적)\n  독1중첩 3턴합: 45×0.56×0.2×3 = 15.12\n  → 총합: 25.20+15.12 = 40.32/적\n  출혈 즉시추가: 25.20×0.3 = 7.56\n  → 총합: 25.20+7.56 = 32.76/적 + 회복량50%감소\n\n이 스킬은 삭제해도 됩니다.' }
      ],
      rareMaterialPack: deepClone(DEFAULT_RARE_MATERIAL_PACK),
      rareMaterialCatalog: [],
      normalMaterialCatalog: [],
      equipments: buildSampleEquipments(),  // { id, name, part, rank, enhance, infuse, maxInfuse, traits, durability, maxDurability, price, atk, pdef, mdef, mainStat, resistType, resistPct, note }
      auctionListings: [],  // { id, item, askPrice, priceRatio, isNpc, listedAt }
      hmUsedListings: [],   // { id, item, usedPrice, conditionPct, isNpc, listedAt }
      team: [],             // [{ charId, ratio }] 팀원 + 정산 비율
      guildId: '',
      customGuildName: '',
      customGuildDesc: '',
      incomeLog: [],
      guildTaxLog: [],
      homeRegions: [],   // [{id, name, homes:[{id, name, area, houseType, deposit, monthlyRent, maintenanceFee, purchasePrice, brokerFee, desc, features:[], storages:[{id,name,type,maxSlots,maxWeightKg,items:[]}]}]}]
      ownedHomes: {},    // { [activeCharId]: [ { regionId, homeId, moveInDate:'2026-01-01', lastRentPaidMonth:'2026-01', rentLog:[{month,amount,paidDate}] }, ... ] }
      gameDate: { year: 2026, month: 1, day: 1 },
      battleSetup: {
        partySlots: Array(MAX_PARTY).fill(''),
        enemySlots: ['mon_hound', 'mon_hound', 'mon_hound', 'mon_lancer', 'mon_lancer', 'mon_echo_mage', 'mon_gate_apex', '', '', '']
      }
    };
  }

function buildDefaultRuntime() {
  return {
    started:false, finished:false, outcome:'', round:0,
    party:[], enemies:[], queue:[], roundSummaries:[], llmBlock:'', logs:[],
    pendingActions:{},
    totals:{ partyDamage:0, enemyDamage:0, partyHealing:0, enemyHealing:0, partyKills:0, enemyKills:0 },
    warnings:[],
    expGained: 0,    // total EXP earned this battle
    expLog: []       // [{ name, rank, kind, exp, round }]
  };
}
function buildDefaultGateState() {
  return {
    rank:'E',
    size:'small',
    generated:[],
    selectedId:'',
    current:null,
    run:null
  };
}
function buildDefaultState() {
  return {
    visible:false,
    view:'hub',
    dbTab:'characters',
    selected:{ characters:'', monsters:'', personas:'', skills:'', materials:'', equipment:'' },
    runtime: buildDefaultRuntime(),
    gate: buildDefaultGateState(),
    assocFloor: '1',
    shopSub: '',
    shopHunterSub: '',
    shopMatQuery: '',
    shopMatRank: '',
    shopMatTier: '',
    shopMatPage: 0,
    shopBmTab: 'rare',
    guildSub: '',
    settlePartyCount: '3',
    settleType: 'association',
    settleGuildPct: '40',
    settleDate: '',
    settleGearItems: [],
    taxIncome: '',
    taxPayMonth: '',
    equipPartFilter: '',
    shopEquipRank: '',
    shopEquipPart: '',
    shopRepairSel: '',
    shopHmTab: 'sell',
    shopHmRank: '',
    shopHmPart: '',
    auctionTab: 'browse',
    auctionRankFilter: '',
    auctionSearchQ: '',
    auctionSellSel: '',
    auctionBid: null,
    auctionSell: null,
    charInvTab: 'equip',   // 'equip' | 'items'
    personaInvTab: 'equip', // 'equip' | 'items'
    gatePartyDetailId: '',  // 게이트 파티탭 상세보기 선택 유닛 uid
    teamView: 'members',   // 'members' | 'settle'
    settleItemSel: {},     // { key: true/false } 판매할 아이템 선택
    settleDistMode: 'equal' // 'equal' | 'ratio'
  };
}

  const model = {
    db: buildDefaultDb(),
    state: buildDefaultState(),
    root:null
  };

  // 판매 경매 단계별 공개 타이머
  let _sellAuctionTimerId = null;
  function _startSellAuctionTimer() {
    if (_sellAuctionTimerId) clearInterval(_sellAuctionTimerId);
    _sellAuctionTimerId = setInterval(async () => {
      const ss = model.state.auctionSell;
      if (!ss || ss.done !== false) { clearInterval(_sellAuctionTimerId); _sellAuctionTimerId = null; return; }
      const total = (ss.fullLog || []).length;
      const next = (ss.revealedCount || 0) + 1;
      if (next >= total) {
        ss.revealedCount = total;
        clearInterval(_sellAuctionTimerId); _sellAuctionTimerId = null;
        await saveState(); renderApp();
        // 로그 div 스크롤 하단
        setTimeout(() => { const el = document.getElementById('gb-sell-auction-log'); if (el) el.scrollTop = el.scrollHeight; }, 50);
      } else {
        ss.revealedCount = next;
        await saveState(); renderApp();
        setTimeout(() => { const el = document.getElementById('gb-sell-auction-log'); if (el) el.scrollTop = el.scrollHeight; }, 50);
      }
    }, 2500);
  }

  function getCustomSkillMap() {
    const map = {};
    (model.db.customSkills || []).forEach(sk => { if (sk && sk.id) map[sk.id] = deepClone(sk); });
    return map;
  }
  function getAllSkillMap() {
    return Object.assign({}, deepClone(BUILTIN_SKILLS), getCustomSkillMap());
  }
  function resolveSkillForUnit(unit, skillId) {
    const def = getAllSkillMap()[skillId];
    if (!def) return null;
    const skill = deepClone(def);
    const rank = String(unit.rank || skill.grade || 'E').toUpperCase();
    if (skill.byRank && skill.byRank[rank]) {
      const patch = skill.byRank[rank];
      Object.keys(patch).forEach((key) => {
        if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
          skill[key] = Object.assign({}, skill[key] || {}, patch[key]);
        } else {
          skill[key] = patch[key];
        }
      });
    }
    if (skill.category === 'aoeCC' && skill.baseSingleCoef != null) {
      skill.coef = round3(skill.baseSingleCoef * 0.5);
      skill.costs = skill.costs || { mp:0, sp:0 };
      skill.costs.mp = Math.ceil((skill.costs.mp || 0) * 2);
      skill.costs.sp = Math.ceil((skill.costs.sp || 0) * 2);
    }
    skill.target = skill.target || (skill.category === 'aoeAttack' || skill.category === 'aoeCC' ? 'allEnemies' : 'singleEnemy');
    skill.damageType = skill.damageType || unit.damageType || 'physical';
    skill.element = normElement(skill.element || 'none');
    return skill;
  }
  function listKnownSkillDefs(unit) {
    return (unit.skills || []).map(id => resolveSkillForUnit(unit, id)).filter(Boolean);
  }
  function normaliseStats(raw) {
    const s = raw || {};
    return { str:Number(s.str || 5), con:Number(s.con || 5), int:Number(s.int || 5), agi:Number(s.agi || 5), sense:Number(s.sense || 5) };
  }
  function applyPassiveInitialization(unit) {
    unit.passiveBonuses = { str:0, con:0, int:0, agi:0, sense:0, pdef:0, mdef:0 };
    unit.passiveMods = { shieldSpMul:1, daggerSpMul:1 };
    (unit.skills || []).forEach(skillId => {
      const skill = resolveSkillForUnit(unit, skillId);
      if (!skill || skill.category !== 'passive') return;
      if (skill.passiveBonuses) {
        Object.keys(skill.passiveBonuses).forEach(key => {
          unit.passiveBonuses[key] = (unit.passiveBonuses[key] || 0) + Number(skill.passiveBonuses[key] || 0);
        });
      }
      if (skill.passiveMods) {
        Object.keys(skill.passiveMods).forEach(key => {
          const cur = unit.passiveMods[key] == null ? 1 : unit.passiveMods[key];
          unit.passiveMods[key] = round3(cur * Number(skill.passiveMods[key]));
        });
      }
    });
  }
  // 장비 특성 전투 보너스 계산 (장착 장비의 traits 배열 기반)
  function calcEquipTraitBonuses(entry) {
    const bonuses = {};
    if (!entry || !entry.inventory || !entry.inventory.equipped) return bonuses;
    const equipped = entry.inventory.equipped;
    const pack = DEFAULT_RARE_MATERIAL_PACK;
    const valueScales = pack.valueScales || {};
    const traitDefs = pack.traits || [];
    EQUIP_PARTS.forEach(part => {
      const eq = equipped[part];
      if (!eq || !Array.isArray(eq.traits)) return;
      const eqRank = String(eq.rank || entry.rank || 'E').toUpperCase();
      eq.traits.forEach(traitId => {
        const def = traitDefs.find(t => t.id === traitId);
        if (!def || !def.scale) return;
        const scaleTable = valueScales[def.scale];
        if (!scaleTable) return;
        const val = Number(scaleTable[eqRank] || 0);
        bonuses[traitId] = (bonuses[traitId] || 0) + val;
      });
    });
    return bonuses;
  }
  function buildUnit(entry, side, slotIndex) {
    const rank = String(entry.rank || 'E').toUpperCase();
    const row = normRow(entry.row) || inferRow(entry.position, entry.job);
    const meta = parseMonsterMeta(entry);
    const isMonster = side === 'enemies';
    const monsterProfile = isMonster ? monsterProfileForEntry(entry) : null;
    // 몬스터: 개별 스탯 없음, HP/ATK만 프로필 테이블에서 가져옴
    const stats = isMonster ? { str:0, con:0, int:0, agi:0, sense:0 } : normaliseStats(entry.stats);
    const lvlBonus = isMonster ? 0 : (Math.max(1, Number(entry.level || 1)) - 1) * 2;
    const baseHp = Number(isMonster ? monsterProfile.hp : (entry.hp || (100 + (stats.con - 10) * 10 + (stats.str - 10) * 3 + lvlBonus)));
    const defaultMp = isMonster ? monsterProfile.mp : (100 + (stats.int - 10) * 10 + (stats.sense - 10) * 3 + lvlBonus);
    const defaultSp = isMonster ? monsterProfile.sp : (100 + (stats.agi - 10) * 10 + (stats.sense - 10) * 3 + lvlBonus);
    const allSkillMap = getAllSkillMap();
    const hasMagicSkill = Array.isArray(entry.skills) && entry.skills.some(id => {
      const sk = allSkillMap[String(id || '').trim()];
      return sk && ((sk.damageType || '') === 'magic' || (Array.isArray(sk.statTypes) && sk.statTypes.includes('int')) || String(sk.category || '').includes('heal') || String(sk.category || '').includes('buff'));
    });
    const baseMp = Number(entry.mp != null && !isMonster ? entry.mp : (isMonster ? Math.max(Number(entry.mp || 0), hasMagicSkill || entry.damageType === 'magic' ? defaultMp : Math.floor(defaultMp * 0.25)) : defaultMp));
    const baseSp = Number(entry.sp != null && !isMonster ? entry.sp : (isMonster ? Math.max(Number(entry.sp || 0), entry.damageType !== 'magic' || !hasMagicSkill ? defaultSp : Math.floor(defaultSp * 0.7)) : defaultSp));
    const unit = {
      uid: `${side}_${entry.id}_${slotIndex}_${Date.now()}_${Math.floor(Math.random()*9999)}`,
      baseId: entry.id,
      sourceId: entry.id,  // tracks original DB character/monster id for EXP flush
      name: entry.name || entry.id || '유닛',
      side,
      isMonster,
      monsterProfile,
      monsterBaseDamage: isMonster ? Number(monsterProfile.damage || 0) : 0,
      monsterSkillMul: isMonster ? Number(monsterProfile.skillMul || 1) : 1,
      job: entry.job || '',
      position: entry.position || entry.role || '',
      role: entry.role || '',
      row,
      kind: entry.kind || (side === 'party' ? 'Hunter' : 'Normal'),
      rank,
      stats,
      hp: Number(entry.currentHp != null ? entry.currentHp : baseHp), maxHp: baseHp,
      mp: Number(entry.currentMp != null ? entry.currentMp : baseMp), maxMp: baseMp,
      sp: Number(entry.currentSp != null ? entry.currentSp : baseSp), maxSp: baseSp,
      // 몬스터: ATK = 프로필 damage, pdef/mdef = 0 (개별 스탯 없음)
      atk: Number(isMonster ? monsterProfile.damage : (entry.atk != null ? entry.atk : 0)),
      pdef: Number(isMonster ? 0 : (entry.pdef != null ? entry.pdef : 0)),
      mdef: Number(isMonster ? 0 : (entry.mdef != null ? entry.mdef : 0)),
      damageType: entry.damageType || inferDamageType(entry.position, entry.job),
      attackStat: entry.attackStat || inferAttackStat(entry.position, entry.job),
      skills: Array.isArray(entry.skills) ? entry.skills.slice() : [],
      ai: entry.ai || null,
      buffs: Array.isArray(entry.buffs) ? deepClone(entry.buffs) : [],
      statuses: Object.assign({ stun:0, bind:0, sleep:0, poison:0, bleed:0, burn:0, curse:0, blind:0, freeze:0, paralyze:0, poisonStacks:0, poisonPower:0, bleedPower:0, burnStacks:0, burnPower:0, stunResistTimer:0, sleepResistTimer:0, freezeResistTimer:0, paralyzeResistTimer:0, bindResistTimer:0, curseResistTimer:0, bleedHealReduction:0 }, deepClone(entry.statuses || {})),
      cooldowns: {},
      lastAction:'',
      dead:false,
      threatBase: Number(entry.threatBase != null ? entry.threatBase : inferThreatBase(entry.position, row)),
      threatBonus:0,
      note: entry.note || '',
      resists: normResists(entry.resists),
      species: meta.species || '',
      speciesLabel: meta.speciesLabel || '',
      baseElement: normElement(meta.baseElement || entry.baseElement || entry.element || 'none'),
      immunities: Array.isArray(meta.immunities) ? meta.immunities.slice() : [],
      damageTakenMods: Object.assign({}, meta.damageTakenMods || {}),
      bonusVsBleeding: Number(meta.bonusVsBleeding || 1),
      aloneDamageTaken: Number(meta.aloneDamageTaken || 1),
      regenPct: Number(meta.regenPct || 0),
      regenBlockedBy: Array.isArray(meta.regenBlockedBy) ? meta.regenBlockedBy.slice() : [],
      onHitStatus: normStatus(meta.onHitStatus || ''),
      onHitChance: Number(meta.onHitChance || 0),
      onHitTurns: Number(meta.onHitTurns || 0)
    };
    applyPassiveInitialization(unit);
    // 장비 특성 전투 적용: 장착 장비 traits → 전투 보너스
    unit.traitBonuses = isMonster ? {} : calcEquipTraitBonuses(entry);
    // 스탯 특성 적용: stat_str_up, stat_con_up, stat_int_up, stat_agi_up, stat_sense_up
    if (!isMonster && unit.traitBonuses) {
      const statMap = { stat_str_up:'str', stat_con_up:'con', stat_int_up:'int', stat_agi_up:'agi', stat_sense_up:'sense' };
      Object.entries(statMap).forEach(([traitId, statKey]) => {
        const val = Number(unit.traitBonuses[traitId] || 0);
        if (val > 0) unit.stats[statKey] = (unit.stats[statKey] || 0) + val;
      });
    }
    return unit;
  }

  function getCharById(id) { return (model.db.characters || []).find(x => x.id === id) || null; }
  function getMonsterById(id) { return (model.db.monsters || []).find(x => x.id === id) || null; }
  function getPersonaById(id) { return (model.db.personas || []).find(x => x.id === id) || null; }
  function getCustomSkillById(id) { return (model.db.customSkills || []).find(x => x.id === id) || null; }
  function getRareMaterialPack() {
    if (!model.db.rareMaterialPack || typeof model.db.rareMaterialPack !== 'object') model.db.rareMaterialPack = deepClone(DEFAULT_RARE_MATERIAL_PACK);
    if (!model.db.rareMaterialPack.valueScales) model.db.rareMaterialPack.valueScales = deepClone(DEFAULT_RARE_MATERIAL_PACK.valueScales || {});
    if (!Array.isArray(model.db.rareMaterialPack.traits)) model.db.rareMaterialPack.traits = deepClone(DEFAULT_RARE_MATERIAL_PACK.traits || []);
    if (model.db.rareMaterialPack.version == null) model.db.rareMaterialPack.version = DEFAULT_RARE_MATERIAL_PACK.version || 1;
    if (model.db.rareMaterialPack.note == null) model.db.rareMaterialPack.note = DEFAULT_RARE_MATERIAL_PACK.note || '';
    return model.db.rareMaterialPack;
  }
  function getMaterialTraitById(id) { return (getRareMaterialPack().traits || []).find(x => x.id === id) || null; }
  function getRareMaterialCatalog() {
    if (!Array.isArray(model.db.rareMaterialCatalog)) model.db.rareMaterialCatalog = [];
    // Apply RARE_PRICE_BY_RANK_TIER overrides — replaces baked-in JSON suggestedPrice
    return model.db.rareMaterialCatalog.map(it => {
      const tbl = RARE_PRICE_BY_RANK_TIER[String(it.rank || 'E').toUpperCase()] || RARE_PRICE_BY_RANK_TIER.E;
      const override = (it.priceTier && tbl[it.priceTier]) ? tbl[it.priceTier] : (tbl.tier3 || 0);
      return override ? Object.assign({}, it, { suggestedPrice: override }) : it;
    });
  }
  function getNormalMaterialCatalog() {
    if (!Array.isArray(model.db.normalMaterialCatalog)) model.db.normalMaterialCatalog = [];
    return model.db.normalMaterialCatalog;
  }
  function normalizeRank(rank) { return String(rank || 'E').toUpperCase(); }
  function rankIndex(rank) { return Math.max(0, GRADE_ORDER.indexOf(normalizeRank(rank))); }
  function rankAtLeast(candidate, minimum) { return rankIndex(candidate) >= rankIndex(minimum); }
  function normalizeSpeciesId(species) {
    const raw = String(species || '').trim();
    if (!raw) return '';
    if (SPECIES_KEY_BY_LABEL[raw]) return SPECIES_KEY_BY_LABEL[raw];
    const lowered = raw.toLowerCase();
    if (SPECIES_LABELS[lowered]) return lowered;
    return lowered;
  }
  function normalizeMonsterKind(kind) {
    const k = String(kind || 'Normal').toLowerCase();
    if (k.includes('boss')) return 'Boss';
    if (k.includes('elite')) return 'Elite';
    return 'Normal';
  }
  function safeMaterialKey(base) { return slugify(String(base || 'mat_unknown')); }
  function weightedDropOption(options) {
    const list = Array.isArray(options) ? options.map(opt => ({ value:opt, weight:Number(opt.weight || 0) || 1 })) : [];
    return weightedPick(list) || (Array.isArray(options) && options[0]) || null;
  }
  function findNormalCatalogEntryForSource(sourceRef, rank) {
    const catalog = getNormalMaterialCatalog();
    const wantedRank = normalizeRank(rank);
    if (!catalog.length) return null;
    const sourceId = sourceRef && sourceRef.id ? String(sourceRef.id) : '';
    const byId = sourceId ? catalog.find(it => (String(it.sourceMonsterId || '') === sourceId || slugify(it.sourceMonsterId || '') === slugify(sourceId)) && normalizeRank(it.rank) === wantedRank) : null;
    if (byId) return byId;
    const sourceName = sourceRef && sourceRef.name ? String(sourceRef.name) : '';
    const byName = sourceName ? catalog.find(it => (String(it.sourceMonsterName || '') === sourceName || slugify(it.sourceMonsterName || '') === slugify(sourceName)) && normalizeRank(it.rank) === wantedRank) : null;
    if (byName) return byName;
    const speciesKey = normalizeSpeciesId(sourceRef && sourceRef.species ? sourceRef.species : '');
    const bySpecies = speciesKey ? catalog.find(it => normalizeSpeciesId(it.species || '') === speciesKey && normalizeRank(it.rank) === wantedRank) : null;
    if (bySpecies) return bySpecies;
    return catalog.find(it => normalizeRank(it.rank) === wantedRank && (!speciesKey || normalizeSpeciesId(it.species || '') === speciesKey)) || catalog.find(it => normalizeRank(it.rank) === wantedRank) || null;
  }
  function findRareCatalogItemForSource(sourceRef, rank, traitId) {
    const catalog = getRareMaterialCatalog();
    const wantedRank = normalizeRank(rank);
    if (!catalog.length) return null;
    let pool = catalog.filter(it => normalizeRank(it.rank) === wantedRank);
    if (sourceRef && sourceRef.id) {
      const byId = pool.filter(it => String(it.sourceMonsterId || '') === String(sourceRef.id));
      if (byId.length) pool = byId;
    } else if (sourceRef && sourceRef.name) {
      const byName = pool.filter(it => String(it.sourceMonsterName || '') === String(sourceRef.name));
      if (byName.length) pool = byName;
    }
    if (traitId) {
      const byTrait = pool.filter(it => String(it.traitId || '') === String(traitId));
      if (byTrait.length) pool = byTrait;
    }
    return sampleOne(pool) || null;
  }
  function upsertRewardItem(store, key, payload, count) {
    const safeKey = safeMaterialKey(key || payload.id || payload.name);
    if (!store[safeKey] || typeof store[safeKey] !== 'object') {
      // {count:0} is placed LAST so it always overrides any count in payload.
      // Without this, deepClone(payload) would overwrite the initial {count:0}
      // and the += count below would double-count (e.g., x1 → x2 → x4 across merges).
      store[safeKey] = Object.assign({}, deepClone(payload || {}), { count: 0 });
    }
    store[safeKey].count = Number(store[safeKey].count || 0) + Number(count || 1);
    return store[safeKey];
  }


function ensureSelections() {
  const sel = model.state.selected;
  // '' means "user wants blank form (new item)" — do NOT auto-select.
  // undefined/null means "never initialized" — auto-select first item.
  if (sel.characters === undefined || sel.characters === null) { if (model.db.characters[0]) sel.characters = model.db.characters[0].id; else sel.characters = ''; }
  if (sel.characters && !getCharById(sel.characters) && model.db.characters[0]) sel.characters = model.db.characters[0].id;
  if (sel.monsters === undefined || sel.monsters === null) { if (model.db.monsters[0]) sel.monsters = model.db.monsters[0].id; else sel.monsters = ''; }
  if (sel.monsters && !getMonsterById(sel.monsters) && model.db.monsters[0]) sel.monsters = model.db.monsters[0].id;
  if (sel.personas === undefined || sel.personas === null) { if (model.db.personas[0]) sel.personas = model.db.personas[0].id; else sel.personas = ''; }
  if (sel.personas && !getPersonaById(sel.personas) && model.db.personas[0]) sel.personas = model.db.personas[0].id;
  if (sel.skills === undefined || sel.skills === null) { if (model.db.customSkills[0]) sel.skills = model.db.customSkills[0].id; else sel.skills = ''; }
  if (sel.skills && !getCustomSkillById(sel.skills) && !BUILTIN_SKILLS[sel.skills] && model.db.customSkills[0]) sel.skills = model.db.customSkills[0].id;
  const matPack = getRareMaterialPack();
  if (sel.materials === undefined || sel.materials === null) { if (matPack.traits[0]) sel.materials = matPack.traits[0].id; else sel.materials = ''; }
  if (sel.materials && !getMaterialTraitById(sel.materials) && matPack.traits[0]) sel.materials = matPack.traits[0].id;
  const eqs = model.db.equipments || [];
  if (sel.equipment === undefined || sel.equipment === null) { if (eqs[0]) sel.equipment = eqs[0].id; else sel.equipment = ''; }
  if (sel.equipment && !eqs.find(e => e.id === sel.equipment) && eqs[0]) sel.equipment = eqs[0].id;
}

function weightedChoice(list) {
  const total = list.reduce((acc, row) => acc + Number(row[1] || 0), 0);
  let roll = Math.random() * total;
  for (const row of list) {
    roll -= Number(row[1] || 0);
    if (roll <= 0) return row[0];
  }
  return list.length ? list[list.length - 1][0] : null;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sampleOne(arr) { return arr && arr.length ? arr[randInt(0, arr.length - 1)] : null; }
function chance(prob) { return Math.random() < prob; }
function normGateSize(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('large') || s.includes('대')) return 'large';
  if (s.includes('medium') || s.includes('중')) return 'medium';
  return 'small';
}
function getSpeciesLabel(code) { return SPECIES_LABELS[code] || code || '미상'; }
function gateComboKey(a, b) { return [String(a || ''), String(b || '')].sort().join('+'); }

// ── EXP helper functions ──────────────────────────────────────────────────────
function expNeededForLevel(level) {
  const lv = Math.max(1, Math.floor(level));
  return (lv * lv * 10) + 100;
}
function expForLevelRange(fromLevel, toLevel) {
  let total = 0;
  for (let lv = Math.max(1, fromLevel); lv < toLevel; lv++) total += expNeededForLevel(lv);
  return total;
}
function rollKillExp(rank, kind) {
  const base = EXP_BASE_BY_RANK[String(rank || 'E').toUpperCase()] || EXP_BASE_BY_RANK.E;
  const normKind = normalizeMonsterKind ? normalizeMonsterKind(kind || 'Normal') : String(kind || 'Normal');
  const range = EXP_KIND_MULT_RANGE[normKind] || EXP_KIND_MULT_RANGE.Normal;
  const mult = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
  return base * mult;
}
// Award exp to a character DB entry; returns { levelsGained, newLevel, oldLevel, messages }
function applyExpToCharacter(charEntry, expGained) {
  if (!charEntry || expGained <= 0) return { levelsGained:0, newLevel:charEntry ? (charEntry.level || 1) : 1, oldLevel:charEntry ? (charEntry.level || 1) : 1, messages:[] };
  if (!charEntry.level || charEntry.level < 1) charEntry.level = 1;
  if (charEntry.exp == null) charEntry.exp = 0;
  if (charEntry.totalExp == null) charEntry.totalExp = 0;
  if (charEntry.freeStatPoints == null) charEntry.freeStatPoints = 0;
  charEntry.exp = Number(charEntry.exp) + expGained;
  charEntry.totalExp = Number(charEntry.totalExp) + expGained;
  const oldLevel = charEntry.level;
  const messages = [];
  const maxLv = MAX_LEVEL_BY_RANK[String(charEntry.rank||'E').toUpperCase()] || EXP_MAX_LEVEL;
  while (charEntry.level < maxLv) {
    const needed = expNeededForLevel(charEntry.level);
    if (charEntry.exp < needed) break;
    charEntry.exp -= needed;
    charEntry.level += 1;
    charEntry.freeStatPoints = (charEntry.freeStatPoints || 0) + 2;
    // 레벨업 보상: HP+2, MP+2, SP+2
    charEntry.hp = (Number(charEntry.hp) || 0) + 2;
    charEntry.mp = (Number(charEntry.mp) || 0) + 2;
    charEntry.sp = (Number(charEntry.sp) || 0) + 2;
    messages.push(`${charEntry.name} Lv${charEntry.level - 1} → Lv${charEntry.level} (레벨업! 스탯포인트 +2)`);
  }
  if (charEntry.level >= maxLv) { charEntry.exp = 0; }
  return { levelsGained: charEntry.level - oldLevel, newLevel: charEntry.level, oldLevel, messages };
}


function gateStateSafe() {
  if (!model.state.gate || typeof model.state.gate !== 'object') model.state.gate = buildDefaultGateState();
  return model.state.gate;
}
// Record a kill EXP event in the runtime (call whenever a monster dies by party action)
function recordKillExp(runtime, deadUnit) {
  if (!deadUnit || !deadUnit.isMonster) return;
  const exp = rollKillExp(deadUnit.rank || 'E', deadUnit.kind || 'Normal');
  if (!runtime.expLog) runtime.expLog = [];
  if (runtime.expGained == null) runtime.expGained = 0;
  runtime.expGained += exp;
  runtime.expLog.push({ name: deadUnit.name, rank: deadUnit.rank || 'E', kind: deadUnit.kind || 'Normal', exp, round: runtime.round });
}
// Apply accumulated runtime EXP to all DB party characters (call on Victory)
function flushExpToDb(runtime) {
  const totalExp = runtime.expGained || 0;
  if (totalExp <= 0) return [];
  const results = [];
  (runtime.party || []).forEach(unit => {
    if (!unit.sourceId) return;
    const charEntry = (model.db.characters || []).find(c => c.id === unit.sourceId);
    if (!charEntry) return;
    const r = applyExpToCharacter(charEntry, totalExp);
    results.push({ name: charEntry.name, exp: totalExp, ...r });
  });
  return results;
}

function getAvailableSpeciesFromDb() {
  const set = new Set();
  (model.db.monsters || []).forEach(mon => {
    const meta = parseMonsterMeta(mon);
    const sp = meta.species || inferSpecies(mon.species || mon.note || mon.id || mon.name);
    if (sp) set.add(sp);
  });
  const arr = Array.from(set);
  return arr.length ? arr : ['undead','ghost','beast','plant','slime','construct','elemental','demon','frost','celestial'];
}
function pickGateSpeciesPair() {
  const available = getAvailableSpeciesFromDb();
  const primary = sampleOne(available) || 'undead';
  const compat = (GATE_SPECIES_COMPAT[primary] || []).filter(sp => available.includes(sp) && sp !== primary);
  const secondary = compat.length ? sampleOne(compat) : sampleOne(available.filter(sp => sp !== primary)) || primary;
  return [primary, secondary];
}
function gateNameFor(primary, secondary) {
  const combo = GATE_COMBO_PLACES[gateComboKey(primary, secondary)] || GATE_COMBO_PLACES[gateComboKey(secondary, primary)];
  if (combo && combo.length) return sampleOne(combo);
  const adj = sampleOne((GATE_NAME_PARTS[primary] || {}).adjectives || ['기이한']);
  const placeSrc = ((GATE_NAME_PARTS[secondary] || {}).places || []).concat((GATE_NAME_PARTS[primary] || {}).places || []);
  const place = sampleOne(placeSrc) || '균열';
  return `${adj} ${place}`;
}
function inferMonsterSpecies(mon) {
  const meta = parseMonsterMeta(mon);
  return meta.species || inferSpecies(mon.species || mon.note || mon.id || mon.name);
}
function normaliseKind(kind) {
  const s = String(kind || 'Normal').toLowerCase();
  if (s.includes('boss')) return 'Boss';
  if (s.includes('elite')) return 'Elite';
  return 'Normal';
}
function filterMonsterPool({ speciesList, rank, kind }) {
  const allowed = new Set((speciesList || []).filter(Boolean));
  return (model.db.monsters || []).filter(mon => {
    const species = inferMonsterSpecies(mon);
    const monKind = normaliseKind(mon.kind);
    return (!allowed.size || allowed.has(species)) && (!rank || String(mon.rank || 'E').toUpperCase() === String(rank || 'E').toUpperCase()) && (!kind || monKind === kind);
  });
}
function findMonsterCandidates(speciesList, rank, kind) {
  const exact = filterMonsterPool({ speciesList, rank, kind });
  if (exact.length) return exact;
  const idx = gradeIndex(rank);
  const around = [];
  if (idx > 0) around.push(GRADE_ORDER[idx - 1]);
  if (idx < GRADE_ORDER.length - 1) around.push(GRADE_ORDER[idx + 1]);
  for (const r of around) {
    const pool = filterMonsterPool({ speciesList, rank:r, kind });
    if (pool.length) return pool;
  }
  const sameSpeciesAnyRank = filterMonsterPool({ speciesList, rank:'', kind });
  if (sameSpeciesAnyRank.length) return sameSpeciesAnyRank;
  const sameKindAny = (model.db.monsters || []).filter(mon => normaliseKind(mon.kind) === kind);
  if (sameKindAny.length) return sameKindAny;
  return (model.db.monsters || []).slice();
}
function chooseSpeciesWeighted(primary, secondary, majorBias) {
  return chance(majorBias == null ? 0.7 : majorBias) ? primary : (secondary || primary);
}
function buildGatePreviewEncounter(gate) {
  const sizeMeta = GATE_SIZE_META[gate.size] || GATE_SIZE_META.small;
  const enemyIds = [];
  const preview = [];
  const normalCount = randInt(sizeMeta.previewNormal[0], sizeMeta.previewNormal[1]);
  const eliteCount = randInt(sizeMeta.previewElite[0], sizeMeta.previewElite[1]);
  // 보스는 게이트 마지막방에 무조건 등장
  const bossCount = randInt(sizeMeta.boss[0], sizeMeta.boss[1]);
  for (let i = 0; i < normalCount; i += 1) {
    const species = chooseSpeciesWeighted(gate.primarySpecies, gate.secondarySpecies, 0.7);
    const pool = findMonsterCandidates([species], gate.rank, 'Normal');
    const chosen = sampleOne(pool);
    if (chosen) {
      enemyIds.push(chosen.id);
      preview.push(`${chosen.name} [${chosen.rank}/${chosen.kind || 'Normal'}]`);
    }
  }
  for (let i = 0; i < eliteCount; i += 1) {
    const species = chooseSpeciesWeighted(gate.primarySpecies, gate.secondarySpecies, 0.8);
    const pool = findMonsterCandidates([species], gate.rank, 'Elite');
    const chosen = sampleOne(pool);
    if (chosen) {
      enemyIds.push(chosen.id);
      preview.push(`${chosen.name} [${chosen.rank}/${chosen.kind || 'Elite'}]`);
    }
  }
  for (let i = 0; i < bossCount; i += 1) {
    const pool = findMonsterCandidates([gate.primarySpecies], gate.rank, 'Boss');
    const chosen = sampleOne(pool);
    if (chosen) {
      enemyIds.push(chosen.id);
      preview.push(`${chosen.name} [${chosen.rank}/${chosen.kind || 'Boss'}]`);
    }
  }
  while (enemyIds.length < MAX_ENEMIES) enemyIds.push('');
  return { enemySlots: enemyIds.slice(0, MAX_ENEMIES), preview };
}
// 광맥 주사위 시스템
function rollVeinCount(sizeKey) {
  const roll = randInt(1, 100);
  if (sizeKey === 'small') {
    if (roll <= 20) return 0;
    if (roll <= 70) return 1;
    return 2;
  }
  if (sizeKey === 'medium') {
    if (roll <= 20) return 1;
    if (roll <= 70) return 2;
    return 3;
  }
  // large
  if (roll <= 15) return 2;
  if (roll <= 55) return 3;
  if (roll <= 85) return 4;
  return 5;
}
function generateGateOption(size, idx, forcedRank) {
  const sizeKey = normGateSize(size);
  const sizeMeta = GATE_SIZE_META[sizeKey] || GATE_SIZE_META.small;
  const [primarySpecies, secondarySpecies] = pickGateSpeciesPair();
  const rank = String(forcedRank || weightedChoice(GATE_RANK_WEIGHTS[sizeKey] || GATE_RANK_WEIGHTS.small) || 'E').toUpperCase();
  const normalCount = randInt(sizeMeta.normal[0], sizeMeta.normal[1]);
  const eliteCount = randInt(sizeMeta.elite[0], sizeMeta.elite[1]);
  const bossCount = randInt(sizeMeta.boss[0], sizeMeta.boss[1]);
  const veinCount = rollVeinCount(sizeKey);
  const nodeCount = randInt(sizeMeta.nodes[0], sizeMeta.nodes[1]);
  const title = gateNameFor(primarySpecies, secondarySpecies);
  const preview = buildGatePreviewEncounter({ size:sizeKey, rank, primarySpecies, secondarySpecies });
  return {
    id: slugify(`${sizeKey}_${rank}_${title}_${Date.now()}_${idx}_${Math.floor(Math.random()*1000)}`),
    title,
    rank,
    size:sizeKey,
    sizeLabel:sizeMeta.label,
    primarySpecies,
    primarySpeciesLabel:getSpeciesLabel(primarySpecies),
    secondarySpecies,
    secondarySpeciesLabel:getSpeciesLabel(secondarySpecies),
    normalCount,
    eliteCount,
    bossCount,
    veinCount,
    nodeCount,
    previewEnemySlots:preview.enemySlots,
    previewLines:preview.preview,
    description:`${sizeMeta.label} ${rank} 게이트. ${getSpeciesLabel(primarySpecies)} 중심, ${getSpeciesLabel(secondarySpecies)} 변이 동반.`
  };
}
function generateGateOptions(size, rank) {
  const sizeKey = normGateSize(size);
  const sizeMeta = GATE_SIZE_META[sizeKey] || GATE_SIZE_META.small;
  const forcedRank = String(rank || gateStateSafe().rank || 'E').toUpperCase();
  const list = [];
  for (let i = 0; i < sizeMeta.options; i += 1) list.push(generateGateOption(sizeKey, i, forcedRank));
  const gs = gateStateSafe();
  gs.rank = forcedRank;
  gs.size = sizeKey;
  gs.generated = list;
  gs.selectedId = list[0] ? list[0].id : '';
  if (!gs.current || gs.current.size !== sizeKey || gs.current.rank !== forcedRank) gs.current = null;
}
function getSelectedGeneratedGate() {
  const gs = gateStateSafe();
  return (gs.generated || []).find(g => g.id === gs.selectedId) || null;
}

function lowerGrade(rank) {
  const idx = gradeIndex(rank);
  return idx > 0 ? GRADE_ORDER[idx - 1] : '';
}

function getRareMaterialScaleKeys() {
  return Object.keys((getRareMaterialPack().valueScales || {}));
}
function resolveMaterialTraitRef(ref) {
  const key = String(ref || '').trim();
  if (!key) return null;
  const pack = getRareMaterialPack();
  const traits = pack.traits || [];
  const byId = traits.find(t => t.id === key);
  if (byId) return byId;
  const alias = RARE_TRAIT_LEGACY_ALIASES[key];
  if (alias) {
    const aliased = traits.find(t => t.id === alias);
    if (aliased) return aliased;
  }
  return traits.find(t => String(t.name || '').trim() === key) || null;
}
function traitScaleValue(trait, rank) {
  if (!trait || !trait.scale) return null;
  const scale = (getRareMaterialPack().valueScales || {})[trait.scale];
  if (!scale) return null;
  const val = scale[String(rank || 'E').toUpperCase()];
  return val == null ? null : Number(val);
}
function traitScaleValueText(trait, rank) {
  const val = traitScaleValue(trait, rank);
  if (val == null || Number.isNaN(val)) return '';
  return '+' + val + '%';
}
function rareTraitDisplayLabel(ref, rank) {
  const trait = resolveMaterialTraitRef(ref);
  if (!trait) return String(ref || '');
  const valText = traitScaleValueText(trait, rank);
  return trait.name + (valText ? ' ' + valText : '');
}
function pickRareTraitByFamily(family) {
  const ids = RARE_FAMILY_PRESETS[family] || [];
  const pack = getRareMaterialPack();
  const pool = (pack.traits || []).filter(t => ids.includes(t.id));
  if (pool.length) return sampleOne(pool).id;
  return RARE_TRAIT_LABELS[family] || family;
}
function createRewardBucket() {
  return { normalMaterials:{}, rareMaterials:{}, manaStones:{}, notes:[] };
}
function mergeRewardBucket(dst, src) {
  ['normalMaterials','rareMaterials'].forEach(key => {
    Object.keys(src[key] || {}).forEach(k => {
      const row = src[key][k];
      if (row && typeof row === 'object') upsertRewardItem(dst[key], k, row, Number(row.count || 0));
      else dst[key][k] = (dst[key][k] || 0) + Number(row || 0);
    });
  });
  Object.keys(src.manaStones || {}).forEach(k => { dst.manaStones[k] = (dst.manaStones[k] || 0) + Number(src.manaStones[k] || 0); });
  if (Array.isArray(src.notes) && src.notes.length) dst.notes = (dst.notes || []).concat(src.notes);
  return dst;
}

function fallbackNormalMaterialName(sourceRef, rank) {
  const speciesKey = normalizeSpeciesId(sourceRef && sourceRef.species ? sourceRef.species : '');
  const name = String((sourceRef && sourceRef.name) || '').trim();
  if (name) {
    const trimmed = name.replace(/^(썩은|부패한|핏빛의|역병 걸린|검게 마른|식어버린|무너진|저주받은|혼탁한|메마른|울부짖는|떠도는|희미한|원한 맺힌|속삭이는|찢어진|비틀린|새하얀|검푸른|식어붙은|굶주린|광폭한|바람 가른|포효하는|검은갈기|돌진하는|피비린내 나는|재빠른|사나운|번개 물린|가시돋친|포자낀|뒤틀린|탐욕의|질긴|뿌리박힌|젖은|끈적한|독기 어린|거품 낀|응고된|차가운|검은|출렁이는|미끌거리는|탁한|과충전된|녹슨|파열된|경보 울리는|비정상 가동의|벼락 새긴|깨진|검게 그을린|마력주입된|타오르는|서리 맺힌|범람하는|갈라진|소용돌이치는|번쩍이는|성광의|그림자 스민)\s+/,'');
    return `${trimmed}의 잔해`;
  }
  const fallbackMap = {
    undead:'뼛조각',
    ghost:'혼령 파편',
    beast:'야수 가죽조각',
    plant:'포자 덩어리',
    slime:'점액 핵편',
    construct:'철편',
    elemental:'원소 파편'
  };
  return fallbackMap[speciesKey] || `${normalizeRank(rank)} 일반재료`;
}
function addNormalMaterial(bucket, rank, count, sourceRef) {
  const wantedRank = normalizeRank(rank);
  for (let i = 0; i < Number(count || 1); i += 1) {
    const entry = findNormalCatalogEntryForSource(sourceRef, wantedRank);
    const picked = entry ? weightedDropOption(entry.dropOptions || []) : null;
if (picked) {
  // [CHANGED] 드랍 옵션에 이름이 있으면 그 이름을 '정답'으로 고정 저장한다.
  const dropName = String(picked.name || '').trim();
  const materialId = String(picked.materialId || '').trim();

  upsertRewardItem(
    bucket.normalMaterials,
    // 스택 키도 이름 우선으로 안정적으로(같은 이름은 같은 더미로 쌓이게)
    `${wantedRank}:${safeMaterialKey(dropName || materialId || 'normal')}`,
    {
      // id도 가능하면 materialId를 쓰고, 없으면 dropName 기반으로 고정
      id: materialId ? materialId : `${wantedRank.toLowerCase()}_${safeMaterialKey(dropName || 'normal')}`,
      // name은 드랍 표시명 그대로 유지 (중요)
      name: dropName || '일반재료',
      rank: wantedRank,
      suggestedPrice: Number(picked.suggestedPrice || 0),
      sourceMonsterName: sourceRef ? String(sourceRef.name || '') : '',
      sourceSpecies: sourceRef ? String(sourceRef.species || '') : '',
      tag: 'normal'
    },
    1
  );
} else {
  const fb = fallbackNormalMaterialName(sourceRef, wantedRank);
  upsertRewardItem(bucket.normalMaterials, `${wantedRank}:${safeMaterialKey(fb)}`, {
    id: `${wantedRank.toLowerCase()}_${safeMaterialKey(fb)}`,
    name: fb,
    rank: wantedRank,
    sourceMonsterName: sourceRef ? String(sourceRef.name || '') : '',
    sourceSpecies: sourceRef ? String(sourceRef.species || '') : '',
    tag: 'normal'
  }, 1);
}
  }
}
function addRareMaterial(bucket, rank, trait, count, sourceRef) {
  const wantedRank = normalizeRank(rank);
  const traitId = typeof trait === 'string' ? trait : (trait && trait.id) || '';
  for (let i = 0; i < Number(count || 1); i += 1) {
    const item = findRareCatalogItemForSource(sourceRef, wantedRank, traitId);
    if (item) {
      upsertRewardItem(bucket.rareMaterials, item.id || `${wantedRank}:${item.name}`, {
        id: item.id || safeMaterialKey(item.name || 'rare_material'),
        name: String(item.name || '희귀재료'),
        rank: wantedRank,
        suggestedPrice: Number(item.suggestedPrice || 0),
        traitId: String(item.traitId || traitId || ''),
        traitName: String(item.traitName || ''),
        note: String(item.note || ''),
        sourceMonsterName: String(item.sourceMonsterName || (sourceRef && sourceRef.name) || ''),
        tag: 'Rare'
      }, 1);
    } else {
      upsertRewardItem(bucket.rareMaterials, `${wantedRank}:${traitId || 'unknown_rare'}`, {
        id: `${wantedRank.toLowerCase()}_${safeMaterialKey(traitId || 'rare')}`,
        name: `${(sourceRef && sourceRef.name) || '미확인 존재'}의 잔핵`,
        rank: wantedRank,
        traitId: traitId,
        note: rareTraitDisplayLabel(traitId || trait, wantedRank),
        sourceMonsterName: sourceRef ? String(sourceRef.name || '') : '',
        tag: 'Rare'
      }, 1);
    }
  }
}
function addManaStone(bucket, rank, purity, count) {
  const key = `${String(rank || 'E').toUpperCase()}:${Number(purity || 1)}%`;
  bucket.manaStones[key] = (bucket.manaStones[key] || 0) + Number(count || 1);
}

// ── Settlement calculator ─────────────────────────────────────────────────────
// Returns { title, lines[], subtotal, fee, feeLabel, net, perPerson, guildShare, final }
// type: 'association' | 'guild'
// guildSharePct: 0~100 (길드 지분 %)
function calcStashSettlement(stash, partyCount, type, guildSharePct, runTitle, gearBuyoutItems) {
  const n = Math.max(1, Math.floor(Number(partyCount) || 1));
  const isGuild = type === 'guild';
  const lines = [];
  let subtotal = 0;

  // Mana stones — rank base × purity%
  Object.keys(stash.manaStones || {}).sort().forEach(key => {
    const count = Number(stash.manaStones[key] || 0);
    if (!count) return;
    const [rank, purityStr] = key.split(':');
    const purity = parseInt(purityStr || '0', 10);
    const wonPerPct = MANA_STONE_WON_PER_PCT[rank] || MANA_STONE_WON_PER_PCT.E;
    const unitValue = wonPerPct * purity;
    const total = unitValue * count;
    subtotal += total;
    const label = MANA_STONE_LABELS[rank] || (rank + ' 마정석');
    if (count > 1) lines.push(`[${rank}] ${label}(${purity}%) x${count} = ${unitValue.toLocaleString('en-US')} x ${count} = ${total.toLocaleString('en-US')}`);
    else           lines.push(`[${rank}] ${label}(${purity}%) = ${total.toLocaleString('en-US')}`);
  });

  // Normal materials — base price per rank
  Object.values(stash.normalMaterials || {}).sort((a,b)=> `${a.rank||''}${a.name||''}`.localeCompare(`${b.rank||''}${b.name||''}`, 'ko')).forEach(row => {
    if (!row || typeof row !== 'object') return;
    const count = Number(row.count || 1);
    const rank = String(row.rank || 'E').toUpperCase();
    const baseWon = Number(row.suggestedPrice || 0) || (NORMAL_MATERIAL_BASE_WON[rank] || NORMAL_MATERIAL_BASE_WON.E);
    const total = baseWon * count;
    subtotal += total;
    const label = row.name || '일반재료';
    if (count > 1) lines.push(`[${rank}] ${label} x${count} = ${baseWon.toLocaleString('en-US')} x ${count} = ${total.toLocaleString('en-US')}`);
    else           lines.push(`[${rank}] ${label} = ${total.toLocaleString('en-US')}`);
  });

  // Rare materials — base price per rank (use suggestedPrice when available)
  Object.values(stash.rareMaterials || {}).sort((a,b)=> `${a.rank||''}${a.name||''}`.localeCompare(`${b.rank||''}${b.name||''}`, 'ko')).forEach(row => {
    if (!row || typeof row !== 'object') return;
    const count = Number(row.count || 1);
    const rank = String(row.rank || 'E').toUpperCase();
    const baseWon = Number(row.suggestedPrice || 0) || (RARE_MATERIAL_BASE_WON[rank] || RARE_MATERIAL_BASE_WON.E);
    const total = baseWon * count;
    subtotal += total;
    const label = row.name || '희귀재료';
    if (count > 1) lines.push(`[${rank}] ${label}(Rare) x${count} = ${baseWon.toLocaleString('en-US')} x ${count} = ${total.toLocaleString('en-US')}`);
    else           lines.push(`[${rank}] ${label}(Rare) = ${total.toLocaleString('en-US')}`);
  });

  // Gear buyout items (optional separate list)
  const gearBuyoutRate = isGuild ? GEAR_BUYOUT_GUILD : GEAR_BUYOUT_ASSOC;
  let gearLines = [];
  (gearBuyoutItems || []).forEach(g => {
    const marketPrice = Number(g.marketPrice || 0);
    if (!marketPrice) return;
    const buyout = Math.floor(marketPrice * gearBuyoutRate);
    subtotal += buyout;
    const pctLabel = isGuild ? '90%' : '85%';
    lines.push(`[${g.rank || '?'}] ${escapeHtml(g.name || '장비')} (시장가 ${marketPrice.toLocaleString('en-US')} / ${pctLabel}) = ${buyout.toLocaleString('en-US')}`);
    gearLines.push({ name: g.name, rank: g.rank, marketPrice, buyout, n });
  });

  // Fees
  const feeRate = isGuild ? GUILD_TAX_RATE : ASSOC_TOTAL_RATE;
  const feeLabel = isGuild ? '세액' : '세액&협회 수수료';
  const fee = Math.floor(subtotal * feeRate);
  const net = subtotal - fee;
  const perPerson = Math.floor(net / n);
  const guildPct = Math.max(0, Math.min(100, Number(guildSharePct) || 0));
  const guildShare = isGuild ? Math.floor(perPerson * (guildPct / 100)) : 0;
  const final = perPerson - guildShare;

  return { lines, subtotal, fee, feeLabel, net, perPerson, guildShare, guildPct, final, n, isGuild, gearLines };
}

function calcMonthlyIncomeTax(totalIncome) {
  const amount = Math.max(0, Number(totalIncome) || 0);
  const bracket = MONTHLY_INCOME_TAX_BRACKETS.find(b => amount <= b.limit) || MONTHLY_INCOME_TAX_BRACKETS[MONTHLY_INCOME_TAX_BRACKETS.length - 1];
  return Math.max(0, Math.floor(amount * bracket.rate) - bracket.deduction);
}

function formatWon(n) {
  return Number(Math.floor(Number(n) || 0)).toLocaleString('en-US');
}
function rewardBucketLines(bucket) {
  const lines = [];
  Object.values(bucket.normalMaterials || {}).sort((a,b)=> `${a.rank||''}${a.name||''}`.localeCompare(`${b.rank||''}${b.name||''}`, 'ko')).forEach(row => {
    if (row && typeof row === 'object') {
      const label = (!row.name || row.name === '일반재료') ? fallbackNormalMaterialName({ name:row.sourceMonsterName || '', species:row.sourceSpecies || '' }, row.rank) : row.name;
      lines.push(`${row.rank || 'E'} ${label || '일반재료'} normal x${row.count || 0}`);
    }
  });
  Object.values(bucket.rareMaterials || {}).sort((a,b)=> `${a.rank||''}${a.name||''}`.localeCompare(`${b.rank||''}${b.name||''}`, 'ko')).forEach(row => {
    if (row && typeof row === 'object') lines.push(`${row.rank || 'E'} ${row.name || '희귀재료'} Rare${row.note ? ' (' + row.note + ')' : ''} x${row.count || 0}`);
  });
  Object.keys(bucket.manaStones || {}).sort().forEach(key => {
    const [rank, purity] = key.split(':');
    lines.push(`${MANA_STONE_LABELS[rank] || (rank + ' 마정석')}(${purity}) x${bucket.manaStones[key]}`);
  });
  (bucket.notes || []).forEach(t => lines.push(t));
  return lines;
}
// [ADD] 드랍 결과만 짧게 출력(없으면 빈 배열). notes/인벤로그/드랍없음 문구 없음.
function rewardBucketDropLines(bucket) {
  const lines = [];

  // normal materials
  Object.values(bucket.normalMaterials || {}).forEach(row => {
    if (!row || typeof row !== 'object') return;
    const count = Number(row.count || 0);
    if (count <= 0) return;

    let label = String(row.name || '').trim();
    if (!label || label === '일반재료') {
      label = fallbackNormalMaterialName(
        { name: row.sourceMonsterName || '', species: row.sourceSpecies || '' },
        row.rank
      );
    }
    const rankLabel = row.rank ? `[${row.rank}] ` : '';
    lines.push(`${rankLabel}[Normal] ${label} x${count}`);
  });

  // rare materials
  Object.values(bucket.rareMaterials || {}).forEach(row => {
    if (!row || typeof row !== 'object') return;
    const count = Number(row.count || 0);
    if (count <= 0) return;

    // note(특성 표기)는 유지 (원하면 여기 포맷도 더 예쁘게 다듬을 수 있음)
    const note = row.note ? ` (${row.note})` : '';
    const rankLabel = row.rank ? `[${row.rank}] ` : '';
    lines.push(`${rankLabel}[Rare] ${row.name || '희귀재료'}${note} x${count}`);
  });

  // mana stones (순도별로 분리 유지)
  Object.keys(bucket.manaStones || {}).sort().forEach(key => {
    const count = Number(bucket.manaStones[key] || 0);
    if (count <= 0) return;

    const [rank, purity] = String(key).split(':');
    lines.push(`${MANA_STONE_LABELS[rank] || (rank + ' 마정석')}(${purity}) x${count}`);
  });

  return lines;
}
// [ADD] 몬스터별 드랍 표시용: rank prefix 없이 아이템만 출력.
function rewardBucketDropLinesCompact(bucket) {
  // rewardBucketDropLines와 비슷하지만, 몬스터별 표시가 목적이라 더 짧게
  const lines = [];

  Object.values(bucket.normalMaterials || {}).forEach(row => {
    if (!row || typeof row !== 'object') return;
    const count = Number(row.count || 0);
    if (count <= 0) return;

    let label = String(row.name || '').trim();
    if (!label || label === '일반재료') {
      label = fallbackNormalMaterialName(
        { name: row.sourceMonsterName || '', species: row.sourceSpecies || '' },
        row.rank
      );
    }
    lines.push(`${label} x${count}`);
  });

  Object.values(bucket.rareMaterials || {}).forEach(row => {
    if (!row || typeof row !== 'object') return;
    const count = Number(row.count || 0);
    if (count <= 0) return;
    const note = row.note ? ` (${row.note})` : '';
    lines.push(`${row.name || '희귀재료'}${note} x${count}`);
  });

  Object.keys(bucket.manaStones || {}).sort().forEach(key => {
    const count = Number(bucket.manaStones[key] || 0);
    if (count <= 0) return;
    const [rank, purity] = String(key).split(':');
    lines.push(`${MANA_STONE_LABELS[rank] || (rank + ' 마정석')}(${purity}) x${count}`);
  });

  return lines;
}
function getInventory() {
  if (!model.db.inventory || typeof model.db.inventory !== 'object') model.db.inventory = buildDefaultInventory();
  if (!Array.isArray(model.db.inventory.items)) model.db.inventory.items = [];
  if (!Array.isArray(model.db.inventory.overflow)) model.db.inventory.overflow = [];
  if (!Array.isArray(model.db.inventory.recent)) model.db.inventory.recent = [];
  if (model.db.inventory.gold == null || Number.isNaN(Number(model.db.inventory.gold))) model.db.inventory.gold = 0;
  // Migrate: ensure equipment items have unitWeightG
  (model.db.inventory.items || []).forEach(it => {
    if (it.category === 'equipment' && !it.unitWeightG) it.unitWeightG = EQUIP_WEIGHT_G[it.part] || 1000;
  });
  return model.db.inventory;
}
function getActiveCharacter() {
  const raw = model.state.activeCharId || '';
  if (!raw) return null;
  if (raw.startsWith('persona:')) {
    const pid = raw.substring(8);
    return (model.db.personas || []).find(c => c.id === pid) || null;
  }
  if (raw.startsWith('char:')) {
    const cid = raw.substring(5);
    return (model.db.characters || []).find(c => c.id === cid) || null;
  }
  return (model.db.characters || []).find(c => c.id === raw) || null;
}
function getActiveInventory() {
  const char = getActiveCharacter();
  if (!char) return getInventory();
  if (!char.inventory) char.inventory = { gold: 0, items: [], equipped: { weapon:'', armor:'', subweapon:'', accessory:'', bag:'' } };
  if (!Array.isArray(char.inventory.items)) char.inventory.items = [];
  if (char.inventory.gold == null || Number.isNaN(Number(char.inventory.gold))) char.inventory.gold = 0;
  return char.inventory;
}
function getActiveGold() {
  return Number(getActiveInventory().gold || 0);
}
function getActiveLabel() {
  const char = getActiveCharacter();
  return char ? char.name : '공용';
}
function getLabelForCharKey(charKey) {
  if (!charKey) return '공용';
  if (charKey.startsWith('persona:')) {
    const pid = charKey.substring(8);
    const p = (model.db.personas || []).find(c => c.id === pid);
    return p ? p.name : charKey;
  }
  if (charKey.startsWith('char:')) {
    const cid = charKey.substring(5);
    const c = (model.db.characters || []).find(ch => ch.id === cid);
    return c ? c.name : charKey;
  }
  return charKey || '공용';
}
function findHomeOccupant(regionId, homeId) {
  migrateOwnedHomes();
  for (const [charKey, arr] of Object.entries(model.db.ownedHomes)) {
    if (!Array.isArray(arr)) continue;
    for (const owned of arr) {
      if (owned && owned.regionId === regionId && owned.homeId === homeId) {
        return { charKey, label: getLabelForCharKey(charKey) };
      }
    }
  }
  return null;
}
// ── Per-character/persona owned home helpers ──────────────────────────────
function migrateOwnedHomes() {
  // Migrate old ownedHome (single) to ownedHomes map
  if (model.db.ownedHome && typeof model.db.ownedHome === 'object' && !model.db.ownedHomes) {
    model.db.ownedHomes = { '': [model.db.ownedHome] };
    delete model.db.ownedHome;
  }
  if (model.db.ownedHome && typeof model.db.ownedHome === 'object' && model.db.ownedHomes) {
    if (!model.db.ownedHomes['']) model.db.ownedHomes[''] = [model.db.ownedHome];
    delete model.db.ownedHome;
  }
  if (!model.db.ownedHomes || typeof model.db.ownedHomes !== 'object') model.db.ownedHomes = {};
  // Migrate old single-object entries to arrays
  for (const [key, val] of Object.entries(model.db.ownedHomes)) {
    if (val && !Array.isArray(val) && typeof val === 'object' && val.regionId) {
      model.db.ownedHomes[key] = [val];
    }
  }
}
function getActiveOwnedHomes() {
  migrateOwnedHomes();
  const key = model.state.activeCharId || '';
  return model.db.ownedHomes[key] || [];
}
function getActiveOwnedHome() {
  // Returns first owned home for backward compat / convenience
  const arr = getActiveOwnedHomes();
  return arr.length > 0 ? arr[0] : null;
}
function getActiveOwnedHomeByLocation(regionId, homeId) {
  const arr = getActiveOwnedHomes();
  return arr.find(o => o.regionId === regionId && o.homeId === homeId) || null;
}
function addActiveOwnedHome(val) {
  migrateOwnedHomes();
  const key = model.state.activeCharId || '';
  if (!Array.isArray(model.db.ownedHomes[key])) model.db.ownedHomes[key] = [];
  model.db.ownedHomes[key].push(val);
}
function removeActiveOwnedHome(regionId, homeId) {
  migrateOwnedHomes();
  const key = model.state.activeCharId || '';
  const arr = model.db.ownedHomes[key];
  if (!Array.isArray(arr)) return;
  const idx = arr.findIndex(o => o.regionId === regionId && o.homeId === homeId);
  if (idx >= 0) arr.splice(idx, 1);
  if (arr.length === 0) delete model.db.ownedHomes[key];
}
function setActiveOwnedHome(val) {
  // Legacy compat: replaces ALL homes with a single entry (or clears)
  migrateOwnedHomes();
  const key = model.state.activeCharId || '';
  if (val) model.db.ownedHomes[key] = [val];
  else delete model.db.ownedHomes[key];
}
function getOwnedHomeData(ownedEntry) {
  if (!ownedEntry) return null;
  const region = (model.db.homeRegions || []).find(r => r.id === ownedEntry.regionId);
  const home = region ? (region.homes || []).find(h => h.id === ownedEntry.homeId) : null;
  return home ? { region, home } : null;
}
function calcRentDue(owned, home, gd) {
  // Returns { dueAmount, overdueMonths, interestPerDay, totalDebt, isOverdue, canPay, monthLabel, rent, maint }
  if (!owned || !home) return null;
  const isRent = home.houseType === 'rent';
  const isPurchase = home.houseType === 'purchase';
  if (!isRent && !isPurchase) return null;
  const rent = isRent ? Number(home.monthlyRent || 0) : 0;
  const maint = Number(home.maintenanceFee || 0);
  const monthlyTotal = rent + maint;
  if (monthlyTotal <= 0) return null;
  const lastPaid = owned.lastRentPaidMonth || '';
  const curYM = formatYM(gd.year, gd.month);
  const prev = prevMonth(gd.year, gd.month);
  const prevYM = formatYM(prev.year, prev.month);
  // How many months unpaid?
  let unpaidMonths = 0;
  if (!lastPaid) {
    // Never paid: count from move-in
    const mid = owned.moveInDate || `${gd.year}-${String(gd.month).padStart(2,'0')}-01`;
    const parts = mid.split('-').map(Number);
    unpaidMonths = Math.max(0, monthDiff(parts[0], parts[1], gd.year, gd.month));
  } else {
    const lp = lastPaid.split('-').map(Number);
    unpaidMonths = Math.max(0, monthDiff(lp[0], lp[1], gd.year, gd.month));
  }
  if (unpaidMonths <= 0) return { dueAmount: 0, overdueMonths: 0, interestPerDay: 0, totalDebt: 0, isOverdue: false, canPay: false, monthLabel: curYM, rent, maint, storageLocked: false };
  // Target month to pay = the month after lastPaid (or move-in month)
  const dueAmount = monthlyTotal * unpaidMonths;
  // Interest: if day > 10, add daily interest at 10%/year on overdue base (rent for rental, maint for purchase)
  let interest = 0;
  const interestBase = isRent ? rent : maint;
  if (gd.day > 10 && unpaidMonths >= 1) {
    const overdueDays = gd.day - 10;
    const dailyRate = 0.10 / 365;
    interest = Math.floor((interestBase * unpaidMonths) * dailyRate * overdueDays);
  }
  const canPay = gd.day >= 1; // Can always attempt to pay
  // For purchased homes: lock storage after 2 months unpaid
  const storageLocked = isPurchase && unpaidMonths >= 2;
  return {
    dueAmount, overdueMonths: unpaidMonths, interestPerDay: Math.floor(interestBase * (0.10/365)),
    totalDebt: dueAmount + interest, interest, isOverdue: gd.day > 10 && unpaidMonths >= 1,
    canPay, monthLabel: prevYM, rent, maint, storageLocked
  };
}
function processRentOnDateAdvance(gd) {
  // Called when date advances - check all owned homes for eviction (rental only)
  migrateOwnedHomes();
  const toEvict = []; // { charKey, entryIdx }
  for (const [charKey, arr] of Object.entries(model.db.ownedHomes)) {
    if (!Array.isArray(arr)) continue;
    for (let ei = 0; ei < arr.length; ei++) {
      const owned = arr[ei];
      const data = getOwnedHomeData(owned);
      if (!data || data.home.houseType !== 'rent') continue;
      const rent = Number(data.home.monthlyRent || 0);
      const maint = Number(data.home.maintenanceFee || 0);
      if ((rent + maint) <= 0) continue;
      const lastPaid = owned.lastRentPaidMonth || '';
      let unpaidMonths = 0;
      if (!lastPaid) {
        const mid = owned.moveInDate || `${gd.year}-${String(gd.month).padStart(2,'0')}-01`;
        const parts = mid.split('-').map(Number);
        unpaidMonths = monthDiff(parts[0], parts[1], gd.year, gd.month);
      } else {
        const lp = lastPaid.split('-').map(Number);
        unpaidMonths = monthDiff(lp[0], lp[1], gd.year, gd.month);
      }
      if (unpaidMonths >= 3) {
        toEvict.push({ charKey, regionId: owned.regionId, homeId: owned.homeId });
      }
    }
  }
  const messages = [];
  for (const ev of toEvict) {
    const arr = model.db.ownedHomes[ev.charKey];
    if (!Array.isArray(arr)) continue;
    const idx = arr.findIndex(o => o.regionId === ev.regionId && o.homeId === ev.homeId);
    if (idx < 0) continue;
    const owned = arr[idx];
    const data = getOwnedHomeData(owned);
    if (data && data.home) {
      // Calculate: deduct unpaid rent+maint from deposit, refund remainder
      const deposit = Number(data.home.deposit || 0);
      const rent = Number(data.home.monthlyRent || 0);
      const maint = Number(data.home.maintenanceFee || 0);
      const lastPaid = owned.lastRentPaidMonth || '';
      let unpaid = 0;
      if (!lastPaid) {
        const mid = owned.moveInDate || `${gd.year}-${String(gd.month).padStart(2,'0')}-01`;
        const parts = mid.split('-').map(Number);
        unpaid = Math.max(0, monthDiff(parts[0], parts[1], gd.year, gd.month));
      } else {
        const lp = lastPaid.split('-').map(Number);
        unpaid = Math.max(0, monthDiff(lp[0], lp[1], gd.year, gd.month));
      }
      const totalDebt = (rent + maint) * unpaid;
      const refund = Math.max(0, deposit - totalDebt);
      // Move all storage items to shared inventory
      if (Array.isArray(data.home.storages)) {
        for (const storage of data.home.storages) {
          for (const item of (storage.items || [])) {
            grantInventoryItem(item);
          }
          storage.items = [];
        }
      }
      // Refund remainder to shared inventory
      if (refund > 0) {
        const sharedInv = getInventory();
        sharedInv.gold = Number(sharedInv.gold || 0) + refund;
      }
      const label = getLabelForCharKey(ev.charKey);
      const deductStr = totalDebt > 0 ? ` 미납금 ₩${totalDebt.toLocaleString('en-US')} 보증금에서 차감.` : '';
      const refundStr = refund > 0 ? ` 보증금 잔여 ₩${refund.toLocaleString('en-US')} 환불.` : (deposit > 0 ? ' 보증금 전액 차감.' : '');
      messages.push(`${label} 월세 2개월 미납으로 ${data.home.name} 퇴거 처리됨.${deductStr}${refundStr} 보관함 아이템은 공용 인벤토리로 이동.`);
    }
    arr.splice(idx, 1);
    if (arr.length === 0) delete model.db.ownedHomes[ev.charKey];
  }
  return messages;
}
function syncTeamToPartySlots() {
  if (!Array.isArray(model.db.team)) return;
  if (!model.db.battleSetup) model.db.battleSetup = { partySlots:[], enemySlots:[] };
  if (!model.db.battleSetup.partySlots) model.db.battleSetup.partySlots = [];
  const teamCharIds = model.db.team.map(m => m.charId).filter(id => id && id !== '__shared__');
  for (let i = 0; i < MAX_PARTY; i++) {
    model.db.battleSetup.partySlots[i] = teamCharIds[i] || '';
  }
}
function getPartyCharBags() {
  // Returns array of PARTY_BAGS entries for each character in the party (battleSetup.partySlots)
  // Priority: equipped.bag (장비창 가방 슬롯) → bagId (DB 직접 설정)
  const partySlots = (model.db.battleSetup && Array.isArray(model.db.battleSetup.partySlots)) ? model.db.battleSetup.partySlots : [];
  const chars = model.db.characters || [];
  const bags = [];
  partySlots.forEach(cid => {
    if (!cid) return;
    const c = chars.find(x => x.id === cid);
    if (!c) return;
    // Check equipped bag slot first
    const equippedBagId = (c.inventory && c.inventory.equipped && c.inventory.equipped.bag && c.inventory.equipped.bag.bagId) || null;
    const bagId = equippedBagId || c.bagId || 'none';
    const bag = PARTY_BAGS[bagId] || PARTY_BAGS.none;
    bags.push(bag);
  });
  return bags;
}
function inventoryCapacity() {
  const bags = getPartyCharBags();
  // 공용인벤은 가방 보너스의 20%만 적용 (나머지 80%는 개인 짐)
  const totalSlotBonus = Math.floor(bags.reduce((s, b) => s + Number(b.slotBonus || 0), 0) * SHARED_INV_BAG_RATIO);
  const totalWeightBonus = Math.floor(bags.reduce((s, b) => s + Number(b.maxWeightBonusG || 0), 0) * SHARED_INV_BAG_RATIO);
  const bestWeightMul = bags.length > 0 ? Math.min(...bags.map(b => Number(b.weightMul || 1))) : 1.0;
  return { slots: INVENTORY_BASE_SLOTS + totalSlotBonus, maxWeightG: INVENTORY_BASE_MAX_WEIGHT_G + totalWeightBonus, weightMul: bestWeightMul, bags };
}
function inventoryItemKey(item) {
  if (!item) return '';
  return String(item.stackKey || `${item.category||'misc'}:${item.id||item.name||'item'}:${item.rank||''}:${item.note||''}`);
}
function inventoryConsumesSlot(item) {
  // 모든 아이템이 슬롯을 소비한다. (stackable 아이템은 스택 단위로 1칸)
  return true;
}
function inventoryUsedSlots(inv) {
  return (inv && Array.isArray(inv.items) ? inv.items.filter(it => inventoryConsumesSlot(it)).length : 0);
}
function inventoryBaseWeightG(item) { return Math.max(0, Number(item.unitWeightG || 0)) * Math.max(1, Number(item.count || 1)); }
function inventoryUsedWeightG(inv) {
  const cap = inventoryCapacity();
  return Math.round((Array.isArray(inv.items) ? inv.items : []).reduce((s, it) => s + inventoryBaseWeightG(it), 0) * cap.weightMul);
}
function formatWeightG(g) {
  const n = Math.round(Number(g || 0));
  return n >= 1000 ? `${(n/1000).toFixed(2).replace(/\.00$/,'')}kg` : `${n}g`;
}

function buildSupplyItem(kind, count=1) {
  const meta = {
    tent:{ id:'supply_tent', name:'텐트', unitWeightG:CONSUMABLE_WEIGHT_G.tent },
    ration:{ id:'supply_ration', name:'전투식량', unitWeightG:CONSUMABLE_WEIGHT_G.ration },
    water:{ id:'supply_water', name:'물', unitWeightG:CONSUMABLE_WEIGHT_G.water }
  }[String(kind || '')];
  if (!meta) return null;
  return { id:meta.id, name:meta.name, category:'campSupply', rank:'', count:Math.max(1, Number(count || 1)), unitWeightG:meta.unitWeightG, stackable:true, stackKey:`campSupply:${meta.id}` };
}
function buildPickaxeItem(rank='E', count=1) {
  const g = normalizeRank(rank);
  return { id:`pickaxe_${g}`, name:`${g}급 곡괭이`, category:'tool', rank:g, count:Math.max(1, Number(count || 1)), unitWeightG:PICKAXE_WEIGHT_G, stackable:true, stackKey:`tool:pickaxe:${g}` };
}
const TENT_WEIGHT_G = { E:3000, D:6000, C:9000, B:12000, A:15000, S:20000 };
const TENT_CAMP_BONUS = { E:0, D:5, C:10, B:15, A:20, S:30 };
function buildBagItem(bagId='bag_E', count=1) {
  const bag = PARTY_BAGS[bagId] || PARTY_BAGS.bag_E;
  return { id:bag.id, name:bag.name, category:'bag', rank:bag.rank, count:Math.max(1, Number(count||1)), unitWeightG:500, stackable:false, stackKey:`bag:${bag.id}:${Date.now().toString(36)}`, note:`+${bag.slotBonus}칸/무게+${bag.maxWeightBonusG/1000}kg${bag.weightMul < 1 ? `/무게효율${Math.round((1-bag.weightMul)*100)}%` : ''}`, bagId:bag.id };
}
function buildTentItem(rank='E', count=1) {
  const g = normalizeRank(rank);
  const wg = TENT_WEIGHT_G[g] || 3000;
  const bonus = TENT_CAMP_BONUS[g] || 0;
  const note = bonus > 0 ? `야영효율+${bonus}% (${wg/1000}kg)` : `효과없음 (${wg/1000}kg)`;
  return { id:`tent_${g}`, name:`${g}급 텐트`, category:'campSupply', rank:g, count:Math.max(1, Number(count||1)), unitWeightG:wg, stackable:false, stackKey:`tent:${g}:${Date.now().toString(36)}`, note, campBonus:bonus, tentRank:g };
}
function getPickaxeCount(rank='E') {
  const item = findInventoryItemById(`pickaxe_${normalizeRank(rank)}`);
  return item ? Math.max(0, Number(item.count || 0)) : 0;
}
function addPickaxeToInventory(rank='E', count=1) {
  return addInventoryItem(buildPickaxeItem(rank, count));
}
function getBestUsablePickaxeRank(rank='E') {
  const wanted = rankIndex(rank);
  for (let i = GRADE_ORDER.length - 1; i >= wanted; i -= 1) {
    const g = GRADE_ORDER[i];
    if (getPickaxeCount(g) > 0) return g;
  }
  return '';
}
function hasMatchingPickaxe(rank='E') {
  return !!getBestUsablePickaxeRank(rank);
}
function findInventoryItemById(id) {
  const inv = getInventory();
  return (inv.items || []).find(it => String(it.id || '') === String(id || '')) || (inv.overflow || []).find(it => String(it.id || '') === String(id || '')) || null;
}
function getSupplyCount(kind) {
  const item = findInventoryItemById(`supply_${String(kind || '')}`);
  return item ? Math.max(0, Number(item.count || 0)) : 0;
}
function addSupplyToInventory(kind, count=1) {
  const item = buildSupplyItem(kind, count);
  if (!item) return { ok:false, reason:'invalid' };
  return addInventoryItem(item);
}
function grantInventoryItem(raw) {
  const inv = getInventory();
  const item = deepClone(raw || {});
  item.count = Math.max(1, Number(item.count || 1));
  item.stackable = item.stackable !== false;
  item.unitWeightG = Math.max(0, Number(item.unitWeightG || 0));
  const key = inventoryItemKey(item);
  const existing = inv.items.find(x => inventoryItemKey(x) === key);
  if (existing && item.stackable) existing.count = Number(existing.count || 0) + Number(item.count || 0);
  else inv.items.push(item);
  pushInventoryRecent(`${item.name} x${item.count}`);
  return { ok:true, forced:true, item };
}
function grantActiveInventoryItem(raw) {
  const char = getActiveCharacter();
  if (!char) return grantInventoryItem(raw);
  const inv = getActiveInventory();
  const item = deepClone(raw || {});
  item.count = Math.max(1, Number(item.count || 1));
  item.stackable = item.stackable !== false;
  item.unitWeightG = Math.max(0, Number(item.unitWeightG || 0));
  const key = inventoryItemKey(item);
  const existing = inv.items.find(x => inventoryItemKey(x) === key);
  if (existing && item.stackable) existing.count = Number(existing.count || 0) + Number(item.count || 0);
  else inv.items.push(item);
  pushInventoryRecent(`${item.name} x${item.count} → ${char.name}`);
  return { ok:true, forced:true, item };
}
function consumeInventoryById(id, count=1) {
  const inv = getInventory();
  let need = Math.max(0, Number(count || 0));
  if (!need) return true;
  const pools = [inv.items || [], inv.overflow || []];
  for (const pool of pools) {
    const idx = pool.findIndex(it => String(it.id || '') === String(id || ''));
    if (idx < 0) continue;
    const item = pool[idx];
    const cur = Math.max(0, Number(item.count || 0));
    if (cur < need) return false;
    if (cur === need || item.stackable === false) pool.splice(idx, 1);
    else item.count = cur - need;
    return true;
  }
  return false;
}
function activeGateRun() {
  const run = getGateRun();
  return (run && !run.completed && !run.failed) ? run : null;
}
function normalMaterialUnitWeight(rank) { return Number(NORMAL_MATERIAL_WEIGHT_G[String(rank || 'E').toUpperCase()] || 30); }
function rareMaterialUnitWeight() { return RARE_MATERIAL_WEIGHT_G; }
function manaStoneUnitWeight(purity) { const n = Math.max(1, Math.min(100, Number(String(purity || '').replace(/[^0-9]/g, '')) || 1)); return n * 3; }
function pushInventoryRecent(text) {
  const inv = getInventory();
  inv.recent.unshift(String(text || ''));
  inv.recent = inv.recent.slice(0, 20);
}
function pushInventoryOverflow(item) {
  const inv = getInventory();
  const key = inventoryItemKey(item);
  let existing = inv.overflow.find(x => inventoryItemKey(x) === key);
  if (existing && item.stackable !== false) existing.count = Number(existing.count || 0) + Number(item.count || 0);
  else inv.overflow.push(deepClone(item));
}
function addInventoryItem(raw) {
  const inv = getInventory();
  const item = deepClone(raw || {});
  item.count = Math.max(1, Number(item.count || 1));
  item.stackable = item.stackable !== false;
  item.unitWeightG = Math.max(0, Number(item.unitWeightG || 0));
  const key = inventoryItemKey(item);
  const cap = inventoryCapacity();
  const existing = inv.items.find(x => inventoryItemKey(x) === key);
  const slotAdd = (existing && item.stackable) ? 0 : (inventoryConsumesSlot(item) ? 1 : 0);
  const nextSlots = inventoryUsedSlots(inv) + slotAdd;
  const nextWeight = inventoryUsedWeightG(inv) + Math.round(inventoryBaseWeightG(item) * cap.weightMul);
  if (nextSlots > cap.slots) return { ok:false, reason:'slot', item };
  if (nextWeight > cap.maxWeightG) return { ok:false, reason:'weight', item };
  if (existing && item.stackable) existing.count = Number(existing.count || 0) + Number(item.count || 0);
  else inv.items.push(item);
  pushInventoryRecent(`${item.name} x${item.count}`);
  return { ok:true, item };
}
function removeInventoryItem(key, countMode) {
  const inv = getInventory();
  const idx = inv.items.findIndex(x => inventoryItemKey(x) === key || String(x.iid || '') === String(key));
  if (idx < 0) return false;
  const item = inv.items[idx];
  if (countMode === 'one' && item.stackable && Number(item.count || 0) > 1) item.count = Number(item.count || 0) - 1;
  else inv.items.splice(idx, 1);
  return true;
}
function collectOverflowToInventory() {
  const inv = getInventory();
  const old = (inv.overflow || []).slice();
  inv.overflow = [];
  let moved = 0;
  old.forEach(item => {
    const res = addInventoryItem(item);
    if (res.ok) moved += Number(item.count || 1);
    else pushInventoryOverflow(item);
  });
  return moved;
}
function clearInventoryOverflow() { const inv = getInventory(); inv.overflow = []; }
function rewardRowToInventoryItem(row, kind) {
  if (!row) return null;
if (kind === 'normal') {
  // [CHANGED] 드랍에서 확정된 이름(row.name)을 최우선으로 사용.
  // fallback은 정말 이름이 비어있을 때만 사용(이름 치환으로 다른 아이템처럼 보이는 문제 방지).
  let baseName = String(row.name || '').trim();
  if (!baseName) {
    baseName = fallbackNormalMaterialName(
      { name: row.sourceMonsterName || '', species: row.sourceSpecies || '' },
      row.rank
    );
  }

  return {
    id: row.id || safeMaterialKey(baseName || 'normal_material'),
    name: `${baseName || '일반재료'} [normal]`,
    category: 'normalMaterial',
    rank: String(row.rank || 'E').toUpperCase(),
    count: Number(row.count || 1),
    unitWeightG: normalMaterialUnitWeight(row.rank),
    stackable: true,

    // [IMPORTANT] stackKey도 이름 기반으로 고정해서 같은 이름은 같은 스택으로 쌓이게
    stackKey: `normalMaterial:${String(row.rank || 'E').toUpperCase()}:${safeMaterialKey(baseName)}`,

    suggestedPrice: Number(row.suggestedPrice || 0),
    sourceMonsterName: String(row.sourceMonsterName || ''),
    sourceSpecies: String(row.sourceSpecies || '')
  };
}
  if (kind === 'rare') return { id:row.id || safeMaterialKey(row.name || 'rare_material'), name:`${row.name || '희귀재료'} [Rare]`, category:'rareMaterial', rank:String(row.rank || 'E').toUpperCase(), count:Number(row.count || 1), unitWeightG:rareMaterialUnitWeight(), stackable:true, note:String(row.note || ''), traitId:String(row.traitId || ''), suggestedPrice:Number(row.suggestedPrice || 0), sourceMonsterName:String(row.sourceMonsterName || '') };
  return null;
}
function manaStoneBucketToInventoryItems(bucket) {
  const out = [];
  Object.keys(bucket.manaStones || {}).forEach(key => {
    const [rank, purity] = String(key).split(':');
    out.push({ id:`mana_${rank}_${purity}`, name:`${MANA_STONE_LABELS[rank] || (rank + ' 마정석')}(${purity})`, category:'manaStone', rank:String(rank || 'E').toUpperCase(), count:Number(bucket.manaStones[key] || 0), unitWeightG:manaStoneUnitWeight(purity), stackable:true, note:`${purity}` });
  });
  return out;
}
function depositRewardBucketToInventory(bucket) {
  // [CHANGED] 인벤에 넣는 동작은 유지하되, 로그(인벤 보관/초과)를 반환/출력하지 않는다.
  Object.values(bucket.normalMaterials || {}).forEach(row => {
    const item = rewardRowToInventoryItem(row, 'normal');
    if (!item) return;
    const res = addInventoryItem(item);
    if (!res.ok) pushInventoryOverflow(item);
  });

  Object.values(bucket.rareMaterials || {}).forEach(row => {
    const item = rewardRowToInventoryItem(row, 'rare');
    if (!item) return;
    const res = addInventoryItem(item);
    if (!res.ok) pushInventoryOverflow(item);
  });

  manaStoneBucketToInventoryItems(bucket).forEach(item => {
    const res = addInventoryItem(item);
    if (!res.ok) pushInventoryOverflow(item);
  });

  return [];
}
function seedDefaultInventoryMigration() { getInventory(); }
function roomLabel(type) {
  const map = { passage:'통로', combat:'전투', elite:'엘리트', puzzle:'퍼즐', trap:'함정', boss:'보스', secret:'비밀방', camp:'야영지', damage:'피해', bleed:'출혈', burn:'화상', curse:'저주', bind:'속박' };
  return map[type] || type || '?';
}
function roomHasMineableVeins(room) {
  return !!(room && Number(room.veins || 0) > 0 && !room.mineResolved && !room.mined);
}
function roomDisplayLabel(room, known=true) {
  if (!room) return '?';
  let text = roomLabel(room.type);
  if (known && Number(room.veins || 0) > 0) text += '/광맥';
  return text;
}
function ensureGateLogContainers(run) {
  if (!run) return;
  if (!Array.isArray(run.logs)) run.logs = [];
  if (!Array.isArray(run.fullLogs)) run.fullLogs = run.logs.slice().reverse();
}
function pushGateLog(run, text) {
  if (!run || !text) return;
  ensureGateLogContainers(run);
  run.logs.unshift(String(text));
  if (run.logs.length > 400) run.logs = run.logs.slice(0, 400);
  run.fullLogs.push(String(text));
  if (run.fullLogs.length > 4000) run.fullLogs = run.fullLogs.slice(-4000);
}
function pushBattleLog(runtime, text) {
  if (!runtime || !text) return;
  runtime.logs.push(String(text));
  if (runtime.logs.length > 2500) runtime.logs = runtime.logs.slice(-2500);
}
function battleUnitLabel(unit) {
  if (!unit) return '대상';
  if (unit.isMonster) return `(${normalizeRank(unit.rank || 'E')}) [${normalizeMonsterKind(unit.kind || 'Normal')}] ${unit.name}`;
  return unit.name;
}
function pushHpShiftLog(runtime, unit, beforeHp) {
  if (!runtime || !unit) return;
  const maxHp = Math.max(0, Number(unit.maxHp || unit.hp || 0));
  pushBattleLog(runtime, `${battleUnitLabel(unit)} [${Math.max(0, Number(beforeHp || 0))}/${maxHp}] > [${Math.max(0, Number(unit.hp || 0))}/${maxHp}]`);
}
function pushDamageEventLog(runtime, actor, target, skillName, dmg, crit=false, killed=false) {
  if (!runtime || !actor || !target) return;
  pushBattleLog(runtime, `${actor.name}의 ${skillName} ${target.name}에게${crit ? ' 치명타' : ''} 적중 (피해 ${dmg})${killed ? ' [처치]' : ''}`);
}
function pushHealEventLog(runtime, actor, target, skillName, amount, beforeHp) {
  if (!runtime || !actor || !target) return;
  const maxHp = Math.max(0, Number(target.maxHp || target.hp || 0));
  pushBattleLog(runtime, `${actor.name}의 ${skillName} ${target.name} 회복 (+${amount})`);
  pushBattleLog(runtime, `${battleUnitLabel(target)} [${Math.max(0, Number(beforeHp || 0))}/${maxHp}] > [${Math.max(0, Number(target.hp || 0))}/${maxHp}]`);
}
function applyRoomTraversalMinutes(run, room, minutes=30) {
  if (!run || !room) return;
  if (!room.timeApplied) {
    run.elapsedMinutes = Number(run.elapsedMinutes || 0) + Number(minutes || 0);
    room.timeApplied = true;
  }
}
function markSkippedVeinIfNeeded(run, room) {
  if (roomHasMineableVeins(room)) {
    room.mined = true;
    room.mineResolved = true;
    room.mineSkipped = true;
    pushGateLog(run, `${roomDisplayLabel(room, true)}: 광맥을 채굴하지 않고 이동했다.`);
  }
}
function roomAftermathPrompt(room) {
  const text = roomDisplayLabel(room, true);
  const canMine = roomHasMineableVeins(room);
  return `
    <div class="gb-panel">
      <div class="gb-section-title">방 정리</div>
      <div class="gb-sub">${escapeHtml(text)} 처리 후 다음 행동을 고를 수 있다.</div>
      ${room.rewardLines && room.rewardLines.length ? `<div class="gb-log">${room.rewardLines.map(t => `<div>• ${escapeHtml(t)}</div>`).join('')}</div>` : ''}
      <div class="gb-btn-row">
        ${canMine ? '<button class="gb-btn" id="gb-room-mine">광맥 채굴</button>' : ''}
        <button class="gb-btn primary" id="gb-room-next">다음방 진입</button>
        <button class="gb-btn danger" id="gb-room-retreat">후퇴</button>
      </div>
    </div>`;
}
function rollSingleOreVein(rank) {
  const roll = randInt(1, 100);
  const amount = roll <= 40 ? 2 : (roll <= 80 ? 3 : 4);
  const purityRoll = randInt(1, 100);
  let purity = 15;
  if (purityRoll <= 20) purity = randInt(15, 29);
  else if (purityRoll <= 40) purity = randInt(30, 44);
  else if (purityRoll <= 60) purity = randInt(45, 59);
  else if (purityRoll <= 80) purity = randInt(60, 74);
  else purity = 75;
  return { amount, purity };
}
function mineGateRoom(run, room) {
  if (!run || !room) throw new Error('채굴할 방이 없다.');
  if (!roomHasMineableVeins(room)) throw new Error('채굴할 광맥이 없다.');
  room.mineResolved = true;
  const bundle = createRewardBucket();
  const usablePickaxe = getBestUsablePickaxeRank(run.rank);
  const hasTool = !!usablePickaxe;
  const lines = [];
  for (let i = 0; i < Number(room.veins || 0); i += 1) {
    const base = rollSingleOreVein(run.rank);
    if (hasTool) {
      addManaStone(bundle, run.rank, base.purity, base.amount);
      lines.push(`광맥 ${i+1}: ${usablePickaxe}급 곡괭이 사용 — 마정석 ${base.amount}개 / 순도 ${base.purity}%`);
    } else {
      const roll = randInt(1, 100);
      if (roll <= 33) {
        lines.push(`광맥 ${i+1}: 곡괭이 없음 — 채굴 실패(0개)`);
        continue;
      }
      const factor = roll <= 66 ? (1/3) : (1/2);
      const amount = Math.floor(base.amount * factor);
      const purity = Math.floor(base.purity * factor);
      if (amount <= 0 || purity <= 0) {
        lines.push(`광맥 ${i+1}: 곡괭이 없음 — 채굴 실패(0개)`);
        continue;
      }
      addManaStone(bundle, run.rank, purity, amount);
      lines.push(`광맥 ${i+1}: 곡괭이 없음 — 감산 채굴 ${amount}개 / 순도 ${purity}%`);
    }
  }
  room.mined = true;
  room.mineResolved = true;
  room.mineSkipped = false;
  mergeRewardBucket(run.stash, bundle);
  const invLogs = depositRewardBucketToInventory(bundle);
  const outLines = lines.concat(rewardBucketLines(bundle)).concat(invLogs);
  room.rewardLines = (room.rewardLines || []).concat(outLines);
  outLines.forEach(line => pushGateLog(run, `[채굴] ${line}`));
  return outLines;
}

function stageToken(stage, idx, run) {
  const current = !run.sideRoomActive && idx === run.currentStage;
  if (stage.kind === 'choice' && !stage.chosen && !stage.cleared) {
    return current ? `<span class="gb-badge" style="background:#1d4ed8;">[${stage.options.map(o=>o.key).join('/')}]</span>` : `<span class="gb-badge">[${stage.options.map(o=>o.key).join('/')}]</span>`;
  }
  const room = stage.kind === 'room' ? stage.room : ((stage.options || []).find(o => o.key === stage.chosen) || {}).room;
  if (!room) return '<span class="gb-badge">?</span>';
  const text = (stage.cleared || room.discovered || current) ? roomDisplayLabel(room, true) : '?';
  return `<span class="gb-badge"${current ? ' style="background:#1d4ed8;"' : ''}>${escapeHtml(text)}</span>`;
}
function makeStageRoom(gate, type, key) {
  return {
    id: slugify(`${gate.id}_${key}_${type}_${Math.floor(Math.random()*9999)}`),
    type,
    discovered:false,
    cleared:false,
    encounter:null,
    rewardLines:[],
    notes:[],
    veins:0,
    mined:false,
    mineResolved:false,
    mineSkipped:false,
    timeApplied:false,
    preview:''
  };
}
function stageTemplateForSize(size) {
  const tpl = deepClone(GATE_STAGE_TEMPLATES[normGateSize(size)] || GATE_STAGE_TEMPLATES.small);
  return tpl;
}
function buildPartyEntriesFromSetup() {
  return (model.db.battleSetup.partySlots || []).map(id => getCharById(id) || getPersonaById(id)).filter(Boolean).map(base => {
    const e = deepClone(base);
    // 장비 보너스를 반영하여 ATK 등 재계산
    recalcCharDerivedStats(e);
    // 현재 HP/MP/SP: 영구 저장된 값이 있으면 사용, 없으면 최대치
    const maxHp = Number(e.hp || 0);
    const maxMp = Number(e.mp || 0);
    const maxSp = Number(e.sp || 0);
    const savedCurHp = Number(base.currentHp);
    const savedCurMp = Number(base.currentMp);
    const savedCurSp = Number(base.currentSp);
    e.currentHp = (savedCurHp > 0 && savedCurHp <= maxHp) ? savedCurHp : maxHp;
    e.currentMp = (savedCurMp > 0 && savedCurMp <= maxMp) ? savedCurMp : maxMp;
    e.currentSp = (savedCurSp > 0 && savedCurSp <= maxSp) ? savedCurSp : maxSp;
    e.buffs = [];
    e.statuses = { stun:0, bind:0, sleep:0, poison:0, bleed:0, burn:0, curse:0, poisonPower:0, bleedPower:0, burnPower:0 };
    return e;
  });
}
function serializeUnitState(unit) {
  const keepStatuses = Object.assign({ stun:0, bind:0, sleep:0, poison:0, bleed:0, burn:0, curse:0, poisonPower:0, bleedPower:0, burnPower:0 }, deepClone(unit.statuses || {}));
  return {
    id: unit.baseId || unit.uid,
    name: unit.name,
    job: unit.job,
    role: unit.role,
    position: unit.position,
    row: unit.row,
    rank: unit.rank,
    stats: deepClone(unit.stats || {}),
    hp: unit.maxHp,
    mp: unit.maxMp,
    sp: unit.maxSp,
    currentHp: unit.hp,
    currentMp: unit.mp,
    currentSp: unit.sp,
    atk: unit.atk,
    pdef: unit.pdef,
    mdef: unit.mdef,
    damageType: unit.damageType,
    attackStat: unit.attackStat,
    threatBase: unit.threatBase,
    skills: deepClone(unit.skills || []),
    note: unit.note || '',
    resists: deepClone(unit.resists || {}),
    species: unit.species || '',
    baseElement: unit.baseElement || 'none',
    buffs: [],
    statuses: keepStatuses,
    immunities: deepClone(unit.immunities || []),
    damageTakenMods: deepClone(unit.damageTakenMods || {}),
    bonusVsBleeding: Number(unit.bonusVsBleeding || 1),
    aloneDamageTaken: Number(unit.aloneDamageTaken || 1),
    regenPct: Number(unit.regenPct || 0),
    regenBlockedBy: deepClone(unit.regenBlockedBy || []),
    onHitStatus: unit.onHitStatus || '',
    onHitChance: Number(unit.onHitChance || 0),
    onHitTurns: Number(unit.onHitTurns || 0)
  };
}
function createDefaultGateRun(gate) {
  const partyEntries = buildPartyEntriesFromSetup();
  const partyCount = partyEntries.length;
  const stages = stageTemplateForSize(gate.size).map((step, idx) => {
    if (step.kind === 'choice') {
      return {
        kind:'choice',
        id:`stage_${idx}`,
        chosen:'',
        cleared:false,
        options:(step.options || []).map((type, oi) => ({ key:String.fromCharCode(65 + oi), room:makeStageRoom(gate, type, `s${idx}_${oi}`) }))
      };
    }
    return { kind:'room', id:`stage_${idx}`, cleared:false, room:makeStageRoom(gate, step.type, `s${idx}`) };
  });
  const secretEnabled = gate.size === 'large' ? true : (gate.size === 'medium' ? chance(0.6) : chance(0.35));
  const hostCandidates = stages.map((st, idx) => ({ st, idx })).filter(row => row.idx > 1 && row.idx < stages.length - 1 && (row.st.kind !== 'room' || (row.st.kind === 'room' && !['boss','camp'].includes(row.st.room.type))));
  const host = hostCandidates.length ? sampleOne(hostCandidates) : null;
  const campSupplies = { used:false, legacyMigrated:false };
  const run = {
    id: slugify(`${gate.id}_run_${Date.now()}`),
    title: gate.title,
    rank: gate.rank,
    size: gate.size,
    sizeLabel: gate.sizeLabel,
    primarySpecies: gate.primarySpecies,
    primarySpeciesLabel: gate.primarySpeciesLabel,
    secondarySpecies: gate.secondarySpecies,
    secondarySpeciesLabel: gate.secondarySpeciesLabel,
    normalCount: gate.normalCount,
    eliteCount: gate.eliteCount,
    bossCount: gate.bossCount,
    veinCount: gate.veinCount,
    nodeCount: gate.nodeCount,
    stages,
    currentStage:0,
    completed:false,
    failed:false,
    partyState: partyEntries,
    partyStartCount: partyCount,
    campSupplies,
    stash: createRewardBucket(),
    logs:[`게이트 시작: ${gate.title} (${gate.rank}/${gate.sizeLabel})`],
    fullLogs:[`게이트 시작: ${gate.title} (${gate.rank}/${gate.sizeLabel})`],
    pendingBattleRoomId:'',
    sideRoomActive:false,
    elapsedMinutes:0,
    postBattle:null,
    secretPlan: secretEnabled ? { hostStageIndex: host ? host.idx : 2, discovered:false, offered:false, resolved:false, room: makeStageRoom(gate, 'secret', 'secret') } : null
  };
  distributeGateRunContents(run);
  if (run.stages[0] && run.stages[0].kind === 'room') run.stages[0].room.discovered = true;
  return run;
}
function flattenCombatRooms(run) {
  const rooms = [];
  (run.stages || []).forEach(stage => {
    if (stage.kind === 'room') {
      if (['combat','elite','boss'].includes(stage.room.type)) rooms.push(stage.room);
    } else {
      (stage.options || []).forEach(opt => { if (['combat','elite','boss'].includes(opt.room.type)) rooms.push(opt.room); });
    }
  });
  return rooms;
}
function flattenVeinEligibleRooms(run) {
  const rooms = [];
  (run.stages || []).forEach(stage => {
    if (stage.kind === 'room') rooms.push(stage.room);
    else (stage.options || []).forEach(opt => rooms.push(opt.room));
  });
  if (run.secretPlan && run.secretPlan.room) rooms.push(run.secretPlan.room);
  return rooms.filter(room => room && !['camp','passage'].includes(room.type));
}
// Pre-select up to 4 unique Normal monster types for the whole gate.
// Keeps all rooms thematically consistent: ~3 from primary species, 1 slot for secondary.
function buildGateNormalPool(run) {
  const primaries = shuffle(findMonsterCandidates([run.primarySpecies], run.rank, 'Normal').slice());
  const secondaries = (run.secondarySpecies && run.secondarySpecies !== run.primarySpecies)
    ? shuffle(findMonsterCandidates([run.secondarySpecies], run.rank, 'Normal').slice())
    : [];
  const seen = new Set();
  const pool = [];
  // Fill up to 3 slots from primary species first
  for (const m of primaries) {
    if (pool.length >= 3) break;
    if (!seen.has(m.id)) { seen.add(m.id); pool.push(m); }
  }
  // Fill one slot from secondary species
  for (const m of secondaries) {
    if (pool.length >= 4) break;
    if (!seen.has(m.id)) { seen.add(m.id); pool.push(m); }
  }
  // Back-fill remaining slots from primary if secondary didn't fill them
  for (const m of primaries) {
    if (pool.length >= 4) break;
    if (!seen.has(m.id)) { seen.add(m.id); pool.push(m); }
  }
  return pool;
}
function distributeGateRunContents(run) {
  const [minUnits, maxUnits] = ROOM_UNIT_LIMITS[run.size] || ROOM_UNIT_LIMITS.small;
  // Pre-select the fixed Normal monster pool for this gate run (max 4 unique types).
  run.gateNormalPool = buildGateNormalPool(run);
  const combatRooms = flattenCombatRooms(run);
  combatRooms.forEach(room => {
    room.encounter = { normal:0, elite:0, boss:0, waves:1, visibleNormal:0, visibleElite:0, visibleBoss:0, enemySlots:[], previewLines:[] };
    room.minUnits = minUnits;
    room.maxUnits = maxUnits;
    if (room.type === 'elite') room.encounter.elite = 1;
    if (room.type === 'boss') room.encounter.boss = run.bossCount;
  });
  let eliteRemain = Math.max(0, run.eliteCount - combatRooms.reduce((s, room) => s + room.encounter.elite, 0));
  const eliteTargets = shuffle(combatRooms.filter(room => room.type === 'elite' || room.type === 'combat' || room.type === 'boss'));
  while (eliteRemain > 0 && eliteTargets.length) {
    const room = eliteTargets[eliteRemain % eliteTargets.length];
    const used = room.encounter.normal + room.encounter.elite + room.encounter.boss;
    if (used < room.maxUnits) {
      room.encounter.elite += 1;
      eliteRemain -= 1;
    } else {
      eliteTargets.shift();
    }
  }
  let normalRemain = run.normalCount;
  combatRooms.forEach(room => {
    const special = room.encounter.elite + room.encounter.boss;
    const need = Math.max(0, room.minUnits - special);
    const give = Math.min(need, normalRemain);
    room.encounter.normal += give;
    normalRemain -= give;
  });
  let safety = 4000;
  while (normalRemain > 0 && safety-- > 0) {
    const room = sampleOne(combatRooms);
    if (!room) break;
    const total = room.encounter.normal + room.encounter.elite + room.encounter.boss;
    if (total < room.maxUnits) {
      room.encounter.normal += 1;
      normalRemain -= 1;
    } else {
      room.encounter.waves = Math.max(2, room.encounter.waves || 1);
      room.encounter.normal += 1;
      normalRemain -= 1;
    }
  }
  combatRooms.forEach(room => finalizeRoomEncounter(run, room));
  let veinsRemain = run.veinCount;
  const veinRooms = shuffle(flattenVeinEligibleRooms(run));
  while (veinsRemain > 0 && veinRooms.length) {
    const room = veinRooms[veinsRemain % veinRooms.length];
    room.veins = (room.veins || 0) + 1;
    veinsRemain -= 1;
  }
}
function finalizeRoomEncounter(run, room) {
  const total = room.encounter.normal + room.encounter.elite + room.encounter.boss;
  const visibleCap = room.maxUnits;
  let overflow = Math.max(0, total - visibleCap);
  room.encounter.visibleBoss = Math.min(room.encounter.boss, visibleCap);
  let remainingCap = visibleCap - room.encounter.visibleBoss;
  room.encounter.visibleElite = Math.min(room.encounter.elite, remainingCap);
  remainingCap -= room.encounter.visibleElite;
  room.encounter.visibleNormal = Math.min(room.encounter.normal, remainingCap);
  room.encounter.overflow = overflow;
  const enemyIds = [];
  const preview = [];
  for (let i = 0; i < room.encounter.visibleNormal; i += 1) {
    const normalPool = (run.gateNormalPool && run.gateNormalPool.length)
      ? run.gateNormalPool
      : findMonsterCandidates([run.primarySpecies], run.rank, 'Normal');
    const chosen = sampleOne(normalPool);
    if (chosen) { enemyIds.push(chosen.id); preview.push(`${chosen.name} [${chosen.rank}/Normal]`); }
  }
  for (let i = 0; i < room.encounter.visibleElite; i += 1) {
    const species = chooseSpeciesWeighted(run.primarySpecies, run.secondarySpecies, 0.8);
    const chosen = sampleOne(findMonsterCandidates([species], run.rank, 'Elite'));
    if (chosen) { enemyIds.push(chosen.id); preview.push(`${chosen.name} [${chosen.rank}/Elite]`); }
  }
  for (let i = 0; i < room.encounter.visibleBoss; i += 1) {
    const chosen = sampleOne(findMonsterCandidates([run.primarySpecies], run.rank, 'Boss'));
    if (chosen) { enemyIds.push(chosen.id); preview.push(`${chosen.name} [${chosen.rank}/Boss]`); }
  }
  while (enemyIds.length < MAX_ENEMIES) enemyIds.push('');
  room.encounter.enemySlots = enemyIds.slice(0, MAX_ENEMIES);
  room.encounter.previewLines = preview;
  room.preview = `${room.encounter.normal}N / ${room.encounter.elite}E / ${room.encounter.boss}B` + (room.encounter.overflow > 0 ? ` / 잔당 ${room.encounter.overflow}` : '');
}
function getGateRun() {
  const gs = gateStateSafe();
  return gs.run || null;
}
function getCurrentStage(run) {
  if (!run || run.completed || run.failed) return null;
  return run.stages[run.currentStage] || null;
}
function getActiveRoom(run) {
  if (!run) return null;
  if (run.sideRoomActive && run.secretPlan && run.secretPlan.room) return run.secretPlan.room;
  const stage = getCurrentStage(run);
  if (!stage) return null;
  if (stage.kind === 'room') return stage.room;
  if (!stage.chosen) return null;
  const picked = (stage.options || []).find(o => o.key === stage.chosen);
  return picked ? picked.room : null;
}
function getRoomById(run, roomId) {
  if (!run || !roomId) return null;
  if (run.secretPlan && run.secretPlan.room && run.secretPlan.room.id === roomId) return run.secretPlan.room;
  for (const stage of (run.stages || [])) {
    if (stage.kind === 'room' && stage.room.id === roomId) return stage.room;
    if (stage.kind === 'choice') {
      const opt = (stage.options || []).find(o => o.room.id === roomId);
      if (opt) return opt.room;
    }
  }
  return null;
}
function advanceGateRunAfterMainRoom(run, stageIndex, room) {
  const stage = run.stages[stageIndex];
  if (stage) stage.cleared = true;
  applyRoomTraversalMinutes(run, room, 30);
  // 방 이동 시 파티원 SP 6 소모
  deductPartySp(run, 6);
  if (run.secretPlan && !run.secretPlan.discovered && !run.secretPlan.resolved && run.secretPlan.hostStageIndex === stageIndex) {
    if (Math.random() < GATE_SECRET_DISCOVER_CHANCE) {
      run.secretPlan.discovered = true;
      run.secretPlan.offered = true;
      pushGateLog(run, '비밀방의 흔적을 발견했다.');
    }
  }
  run.currentStage = Math.min(run.stages.length, stageIndex + 1);
  if (run.currentStage >= run.stages.length) {
    run.completed = true;
    // 게이트 완료 시에도 현재 HP 상태를 캐릭터 DB에 저장
    syncPartyHpToDb(run);
    pushGateLog(run, '게이트의 마지막 방을 넘었다.');
  }
}
function beginGateRunFromSelectedGate() {
  if (activeGateRun()) return false;
  // 전멸 상태 확인: 같은 날이면 게이트 진입 불가
  const gd = model.db.gameDate || { year:2026, month:1, day:1 };
  const wd = model.db.lastWipeDate;
  if (wd && wd.year === gd.year && wd.month === gd.month && wd.day === gd.day) {
    throw new Error('오늘 전멸한 상태입니다. 집에서 하루 휴식 후 다시 도전할 수 있습니다.');
  }
  const gate = getSelectedGeneratedGate();
  if (!gate) throw new Error('선택된 게이트가 없다.');
  const party = buildPartyEntriesFromSetup();
  if (!party.length) throw new Error('게이트에 투입할 파티가 비어 있다. 전투 탭에서 파티 편성을 먼저 확인해.');
  const gs = gateStateSafe();
  gs.current = deepClone(gate);
  gs.run = createDefaultGateRun(gate);
  model.state.view = 'gate';
  return true;
}
// ── 동명 유닛 구분용 (A, B, C …) ──
function numberDuplicateUnits(units) {
  if (!Array.isArray(units)) return;
  const nameCount = {};
  units.forEach(u => { nameCount[u.name] = (nameCount[u.name] || 0) + 1; });
  const nameIdx = {};
  const SUFFIX = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  units.forEach(u => {
    if (nameCount[u.name] > 1) {
      const i = nameIdx[u.name] = (nameIdx[u.name] || 0);
      u.name = `${u.name} ${SUFFIX[i] || (i+1)}`;
      nameIdx[u.name.split(' ').slice(0,-1).join(' ')] = i + 1;
    }
  });
}
function buildBattleFromEntries(partyEntries, enemyEntries) {
  const runtime = buildDefaultRuntime();
  runtime.party = (partyEntries || []).map((e, idx) => buildUnit(e, 'party', idx)).slice(0, MAX_PARTY);
  runtime.enemies = (enemyEntries || []).map((e, idx) => buildUnit(e, 'enemies', idx)).slice(0, MAX_ENEMIES);
  if (!runtime.party.length) throw new Error('파티가 비어 있다.');
  if (!runtime.enemies.length) throw new Error('적이 비어 있다.');
  numberDuplicateUnits(runtime.enemies);
  runtime.started = true;
  model.state.runtime = runtime;
}
function buildEnemyEntriesFromSlots(slots) {
  return (slots || []).map(id => getMonsterById(id)).filter(Boolean).map(mon => deepClone(mon));
}
function enterGateRoom(run) {
  const room = getActiveRoom(run);
  if (!room) throw new Error('현재 진입할 방이 없다.');
  room.discovered = true;
  if (room.type === 'passage') {
    room.notes = ['이상한 공간감만이 이어진다.'];
    room.cleared = true;
    pushGateLog(run, '통로를 통과했다.');
    if (run.sideRoomActive) {
      run.sideRoomActive = false;
      run.secretPlan.offered = false;
      run.secretPlan.resolved = true;
    } else {
      advanceGateRunAfterMainRoom(run, run.currentStage, room);
    }
    return;
  }
  if (room.type === 'camp') {
    room.notes = ['장시간 체류할 수 있는 비교적 안정된 공간이다. 야영하거나 그냥 지나칠 수 있다.'];
    return;
  }
  if (room.type === 'trap') {
    resolveTrapRoom(run, room);
    return;
  }
  if (room.type === 'puzzle') {
    room.notes = ['퍼즐의 기작이 드러났다. 해결 시도를 해야 한다.'];
    return;
  }
  if (room.type === 'secret') {
    room.notes = ['숨겨진 공간이 열린다. 안쪽에서 보상의 기척이 느껴진다.'];
    return;
  }
  if (['combat','elite','boss'].includes(room.type)) {
    const enemyEntries = buildEnemyEntriesFromSlots(room.encounter.enemySlots);
    buildBattleFromEntries(run.partyState, enemyEntries);
    run.pendingBattleRoomId = room.id;
    model.state.view = 'battle';
    pushGateLog(run, `${roomDisplayLabel(room, true)} 방에 진입했다.`);
  }
}
function randomAlivePartyIndices(run) {
  return (run.partyState || []).map((u, idx) => ({ u, idx })).filter(row => Number(row.u.currentHp || row.u.hp || 0) > 0);
}
const SENSE_CHECK_BY_RANK = { E:15, D:30, C:50, B:65, A:80, S:100 };
function resolveTrapRoom(run, room) {
  room.discovered = true;
  const alive = randomAlivePartyIndices(run);
  const lines = [];
  // 파티원 중 최고 감각 기준 함정 무력화 판정
  const maxSense = Math.max(0, ...alive.map(row => Number((row.u.stats && row.u.stats.sense) || row.u.sense || 0)));
  const threshold = SENSE_CHECK_BY_RANK[String(run.rank||'E').toUpperCase()] || 15;
  if (maxSense > threshold) {
    lines.push(`감각 ${maxSense} > ${threshold}: 함정 무력화 성공!`);
  } else {
    // 실패: 전원 최대 HP의 10~40% 피해
    alive.forEach(row => {
      const unit = row.u;
      const maxHp = Number(unit.hp || unit.maxHp || 1);
      const pct = randInt(10, 40);
      const dmg = Math.max(1, Math.floor(maxHp * pct / 100));
      unit.currentHp = Math.max(1, Number(unit.currentHp != null ? unit.currentHp : unit.hp) - dmg);
      lines.push(`${unit.name} HP -${dmg} (${pct}%)`);
    });
  }
  room.rewardLines = lines;
  room.cleared = true;
  pushGateLog(run, `함정 발동: ${lines.join(' / ')}`);
  if (roomHasMineableVeins(room)) {
    model.state.view = 'gate';
    return;
  }
  if (run.sideRoomActive) {
    applyRoomTraversalMinutes(run, room, 30);
    run.sideRoomActive = false;
    run.secretPlan.offered = false;
    run.secretPlan.resolved = true;
  } else {
    advanceGateRunAfterMainRoom(run, run.currentStage, room);
  }
}
function pickRareTraitForRoll(roll, bossLike) {
  if (bossLike) {
    if (roll >= 86) return pickRareTraitByFamily(chance(0.5) ? 'physicalDamage' : 'magicDamage');
    if (roll >= 71) return pickRareTraitByFamily('elementalDamage');
    if (roll >= 56) return pickRareTraitByFamily(chance(0.5) ? 'physicalDefense' : 'magicDefense');
    if (roll >= 41) return pickRareTraitByFamily('elementalDefense');
    return pickRareTraitByFamily('increasedHealing');
  }
  if (roll >= 96) return pickRareTraitByFamily(chance(0.5) ? 'physicalDamage' : 'magicDamage');
  if (roll >= 91) return pickRareTraitByFamily('elementalDamage');
  if (roll >= 86) return pickRareTraitByFamily(chance(0.5) ? 'physicalDefense' : 'magicDefense');
  if (roll >= 81) return pickRareTraitByFamily('elementalDefense');
  return pickRareTraitByFamily('increasedHealing');
}
// 드랍 장비 생성: 게이트 보스/엘리트 보상으로 드랍되는 장비
// 보조무기·악세서리는 내장 특성 1개(별도 비용 없음), 그 외 20% 확률(희귀재료 비용 반영)
// 장비 드랍: part 지정 버전 (드랍테이블 결과로 부위 결정 후 호출)
function buildDropEquipment(rank, forcePart) {
  const r = String(rank || 'E').toUpperCase();
  const part = forcePart || EQUIP_PARTS[Math.floor(Math.random() * EQUIP_PARTS.length)];
  const maxInfuseBase = EQUIP_MAX_INFUSE[part] || 1;
  // 보조무기·악세서리는 기본 특성 1개 보유; 그 외 장비는 20% 확률
  const builtInTrait = (part === 'subweapon' || part === 'accessory');
  const hasTrait = builtInTrait ? true : (Math.random() < 0.20);
  const traits = [];
  let maxInfuse = maxInfuseBase;
  let traitName = '';
  if (hasTrait) {
    const traitId = builtInTrait
      ? (Math.random() < 0.20 ? RARE_TRAIT_POOL : NORMAL_TRAIT_POOL)[Math.floor(Math.random() * (Math.random() < 0.20 ? RARE_TRAIT_POOL : NORMAL_TRAIT_POOL).length)]
      : EQUIP_TRAIT_TYPES[Math.floor(Math.random() * EQUIP_TRAIT_TYPES.length)];
    traits.push(traitId);
    // 특수효과는 주입이 아니므로 maxInfuse를 늘리지 않음
    traitName = EQUIP_TRAIT_LABELS[traitId] || traitId;
  }
  // 특수효과(내장 특성)는 주입 횟수를 사용하지 않음
  const infuseCount = builtInTrait ? 0 : traits.length;
  // 보조무기 서브타입 결정 (방패 여부)
  let subSuffix = null;
  let isShield = false;
  if (part === 'subweapon') {
    const subSuffArr = EQUIP_NAME_SUFFIXES.subweapon || ['방패'];
    subSuffix = subSuffArr[Math.floor(Math.random() * subSuffArr.length)];
    isShield = (subSuffix === '방패');
  }
  const basePrice = calcEquipRandomPrice(r, part);
  // 무기·방어구 특성: 희귀재료 기준가 × 1.25
  // 보조무기·악세서리 내장 특성: 티어별 희귀재료 가격 차등 적용
  let traitBonus = 0;
  if (hasTrait && !builtInTrait) {
    traitBonus = Math.round((RARE_MATERIAL_BASE_WON[r] || RARE_MATERIAL_BASE_WON.E) * 1.25);
  } else if (hasTrait && builtInTrait) {
    const tier = TRAIT_TIER_MAP[traits[0]] || 3;
    const tierPrices = RARE_PRICE_BY_RANK_TIER[r] || RARE_PRICE_BY_RANK_TIER.E;
    const tier4Price = tierPrices.tier4;
    const tierPrice = tierPrices[`tier${tier}`] || tier4Price;
    traitBonus = tierPrice - tier4Price;
  }
  const price = basePrice + traitBonus;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const partLabel = EQUIP_PART_LABELS[part] || part;
  // Armor subtype selection
  let armorSubtype = null;
  if (part === 'armor') {
    const subKey = ARMOR_SUBTYPE_KEYS[Math.floor(Math.random() * ARMOR_SUBTYPE_KEYS.length)];
    armorSubtype = { key: subKey, ...ARMOR_SUBTYPES[subKey] };
  }
  // 희귀도 자동 판정
  const { rarity: autoRarity, traitTier: autoTier } = assignEquipRarity(part, traits[0] || '');
  const name = generateEquipName(r, part, armorSubtype ? armorSubtype.key : null, hasTrait ? traitName : '', subSuffix);
  return {
    id: `drop_equip_${r.toLowerCase()}_${part}_${uid}`,
    name,
    part,
    rank: r,
    rarity: autoRarity,
    traitTier: autoTier,
    enhance: 0,
    infuse: infuseCount,
    maxInfuse,
    traits,
    durability: 100,
    maxDurability: 100,
    price,
    category: 'equipment',
    isDropped: true,
    stackable: false,
    unitWeightG: EQUIP_WEIGHT_G[part] || 1000,
    stackKey: `equipment:drop_${r}_${part}_${uid}`,
    note: hasTrait ? `게이트 드랍. 특성: ${traitName} | 특성주입 최대 ${maxInfuse}회` : `게이트 드랍. 특성주입 최대 ${maxInfuse}회`,
    atk: part === 'weapon' ? (WEAPON_BASE_ATK[r] || 5) : (part === 'armor' && armorSubtype && armorSubtype.atkMul ? Math.round((WEAPON_BASE_ATK[r] || 5) * armorSubtype.atkMul) : 0),
    pdef: part === 'armor' ? (() => { const base = (ARMOR_STAT_BY_RANK[r]||{defRange:[0,5]}).defRange[1]; const [lo,hi] = armorSubtype ? armorSubtype.defMul : [0.5,0.5]; const mul = lo + Math.random()*(hi-lo); return Math.round(base * mul); })() : (part === 'subweapon' && isShield ? Math.round((ARMOR_STAT_BY_RANK[r]||{defRange:[0,5]}).defRange[1] * 0.25) : 0),
    mdef: part === 'armor' ? (() => { const base = (ARMOR_STAT_BY_RANK[r]||{defRange:[0,5]}).defRange[1]; const [lo,hi] = armorSubtype ? armorSubtype.defMul : [0.5,0.5]; const mul = lo + Math.random()*(hi-lo); return Math.round(base * mul); })() : 0,
    mainStat: part === 'weapon' ? (Math.random() < 0.5 ? 'str' : 'int') : (part === 'armor' && armorSubtype ? armorSubtype.statPool[Math.floor(Math.random() * armorSubtype.statPool.length)] : (part === 'subweapon' && isShield ? 'con' : (part === 'armor' ? 'con' : ''))),
    armorSubtype: armorSubtype ? armorSubtype.key : undefined,
    armorStatBonusMul: armorSubtype ? armorSubtype.statBonusMul : undefined,
    resistType: '',
    resistPct: 0
  };
}
// 엘리트 장비 드랍 테이블 (롤 기반)
// 1~90=없음, 91~93=악세, 94~96=보조무기, 97~100=방어구
function rollEliteEquipDrop(roll) {
  if (roll <= 90) return null;
  if (roll <= 93) return 'accessory';
  if (roll <= 96) return 'subweapon';
  return 'armor';
}
// 보스 장비 드랍 테이블 (롤 기반)
// 1~50=없음, 51~60=악세, 61~80=보조무기, 81~90=방어구, 91~100=무기
function rollBossEquipDrop(roll) {
  if (roll <= 50) return null;
  if (roll <= 60) return 'accessory';
  if (roll <= 80) return 'subweapon';
  if (roll <= 90) return 'armor';
  return 'weapon';
}
// 레드게이트 보스 장비 드랍 테이블
// 1~20=없음, 21~36=악세, 37~68=보조무기, 69~84=방어구, 85~100=무기
function rollRedGateBossEquipDrop(roll) {
  if (roll <= 20) return null;
  if (roll <= 36) return 'accessory';
  if (roll <= 68) return 'subweapon';
  if (roll <= 84) return 'armor';
  return 'weapon';
}
// 보스 스킬북 드랍 레이블 (98=치유/버프, 99=단일공격/CC, 100=광역공격/CC)
function rollBossSkillBookDrop(roll) {
  if (roll <= 97) return null;
  if (roll === 98) return '치유·버프형';
  if (roll === 99) return '단일 공격·CC형';
  return '광역 공격·CC형';
}
// 레드게이트 보스 스킬북 드랍 (94~95=치유/버프, 96~97=단일, 98~100=광역)
function rollRedGateSkillBookDrop(roll) {
  if (roll <= 93) return null;
  if (roll <= 95) return '치유·버프형';
  if (roll <= 97) return '단일 공격·CC형';
  return '광역 공격·CC형';
}
function addNormalRollLoot(bucket, rank, roll, sourceRef) {
  if (!rank) return;
  if (roll <= 50) return;
  if (roll <= 80) { addNormalMaterial(bucket, rank, 1, sourceRef); return; }
  let purity = 10;
  if (roll <= 84) purity = randInt(10, 19);
  else if (roll <= 90) purity = randInt(20, 29);
  else if (roll <= 92) purity = randInt(30, 39);
  else if (roll <= 94) purity = randInt(40, 49);
  else purity = 50;
  addManaStone(bucket, rank, purity, 1);
}
function addEliteLoot(bundle, rank, sourceRef) {
  const own = randInt(1, 100);
  let purity = 55;
  if (own <= 20) purity = randInt(55, 59);
  else if (own <= 40) purity = randInt(60, 64);
  else if (own <= 60) purity = randInt(65, 69);
  else if (own <= 80) purity = randInt(70, 74);
  else purity = 75;
  addManaStone(bundle, rank, purity, 1);
  if (own >= 76) addRareMaterial(bundle, rank, pickRareTraitForRoll(own, false), 1, sourceRef);
  const low = lowerGrade(rank);
  if (low) addNormalRollLoot(bundle, low, randInt(1, 100), sourceRef);
  // 엘리트 장비 드랍 (독립 롤: 91~93=악세, 94~96=보조무기, 97~100=방어구)
  const equipRoll = randInt(1, 100);
  const equipPart = rollEliteEquipDrop(equipRoll);
  if (equipPart) {
    const eq = buildDropEquipment(rank, equipPart);
    grantInventoryItem(eq);
    bundle.notes.push(`⚔️ 장비 드랍: ${eq.name}${eq.traits.length ? ` [특성: ${eq.traits.map(t=>equipTraitDisplay(t, eq.rank)).join(', ')}]` : ''} (롤: ${equipRoll})`);
  }
}
function addBossLoot(bundle, rank, sourceRef) {
  const own = randInt(1, 100);
  let purity = 80;
  if (own <= 20) purity = randInt(80, 84);
  else if (own <= 40) purity = randInt(85, 89);
  else if (own <= 60) purity = randInt(90, 94);
  else if (own <= 80) purity = randInt(95, 99);
  else purity = 100;
  addManaStone(bundle, rank, purity, 1);
  if (own >= 26) addRareMaterial(bundle, rank, pickRareTraitForRoll(own, true), 1, sourceRef);
  const low = lowerGrade(rank);
  if (low) addNormalRollLoot(bundle, low, randInt(1, 100), sourceRef);
  // 보스 장비 드랍 (독립 롤: 51~60=악세, 61~80=보조무기, 81~90=방어구, 91~100=무기)
  const equipRoll = randInt(1, 100);
  const equipPart = rollBossEquipDrop(equipRoll);
  if (equipPart) {
    const eq = buildDropEquipment(rank, equipPart);
    grantInventoryItem(eq);
    bundle.notes.push(`⚔️ 장비 드랍: ${eq.name}${eq.traits.length ? ` [특성: ${eq.traits.map(t=>equipTraitDisplay(t, eq.rank)).join(', ')}]` : ''} (롤: ${equipRoll})`);
  }
  // 보스 스킬북 드랍 (독립 롤: 98=치유/버프, 99=단일공격/CC, 100=광역공격/CC)
  const sbRoll = randInt(1, 100);
  const sbType = rollBossSkillBookDrop(sbRoll);
  if (sbType) {
    bundle.notes.push(`📖 스킬북 드랍: ${rank}급 [${sbType}] (롤: ${sbRoll}) — 추후 스킬북 시스템 연동 예정`);
  }
}
function addOreVeinLoot(bundle, rank, count) {
  for (let i = 0; i < count; i += 1) {
    const roll = randInt(1, 100);
    const amount = roll <= 40 ? 2 : (roll <= 80 ? 3 : 4);
    let purityRoll = randInt(1, 100);
    let purity = 15;
    if (purityRoll <= 20) purity = randInt(15, 29);
    else if (purityRoll <= 40) purity = randInt(30, 44);
    else if (purityRoll <= 60) purity = randInt(45, 59);
    else if (purityRoll <= 80) purity = randInt(60, 74);
    else purity = 75;
    addManaStone(bundle, rank, purity, amount);
  }
}
// 전투 로그 배열에서 특정 몬스터의 마지막 처치 로그 위치를 찾는다.
// 처치 라인은 두 가지 형태: "/ 처치: 몬스터명" 또는 "몬스터명에게 적중 ... [처치]"
function findLastKillLineIndex(logs, monName) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i];
    if ((line.includes('처치: ') && line.includes(monName)) ||
        (line.includes(monName + '에게') && line.endsWith('[처치]'))) {
      return i;
    }
  }
  return -1;
}

function resolveCombatRoomRewards(run, room) {
  const bundle = createRewardBucket();
  const rt = model.state.runtime;
  const refs = ((room && room.encounter && room.encounter.enemySlots) || [])
    .map(id => getMonsterById(id))
    .filter(Boolean);

  // 몬스터별 드랍 라인(표시용, [전투] 접두 없음)
  const perMonsterDropLines = [];

  if (refs.length) {
    refs.forEach(mon => {
      const one = createRewardBucket();
      const kind = normalizeMonsterKind(mon.kind || 'Normal');
      const monRank = normalizeRank(mon.rank || run.rank);

      if (kind === 'Normal') {
        const own = randInt(1, 100);
        addNormalRollLoot(one, monRank, own, mon);
        const low = lowerGrade(monRank);
        if (low) addNormalRollLoot(one, low, randInt(1, 100), mon);
      } else if (kind === 'Elite') {
        addEliteLoot(one, monRank, mon);
      } else {
        addBossLoot(one, monRank, mon);
      }

      // 드랍이 있을 때만 표시. [전투] 접두 없이 "몬스터명 드랍: ..." 형태로 저장.
      const got = rewardBucketDropLinesCompact(one);
      if (got.length) {
        const dropLine = `${mon.name} 드랍: ${got.join(' / ')}`;
        perMonsterDropLines.push(dropLine);
        // 전투 로그에 처치 직후 위치에 드랍 라인을 삽입한다.
        if (rt && Array.isArray(rt.logs)) {
          const killIdx = findLastKillLineIndex(rt.logs, mon.name);
          if (killIdx >= 0) {
            rt.logs.splice(killIdx + 1, 0, dropLine);
          } else {
            rt.logs.push(dropLine);
          }
        }
      }

      mergeRewardBucket(bundle, one);
    });
  } else {
    const enc = room.encounter || { normal:0, elite:0, boss:0 };
    for (let i = 0; i < Number(enc.normal || 0); i += 1) {
      const own = randInt(1, 100);
      addNormalRollLoot(bundle, run.rank, own, null);
      const low = lowerGrade(run.rank);
      if (low) addNormalRollLoot(bundle, low, randInt(1, 100), null);
    }
    for (let i = 0; i < Number(enc.elite || 0); i += 1) addEliteLoot(bundle, run.rank, null);
    for (let i = 0; i < Number(enc.boss || 0); i += 1) addBossLoot(bundle, run.rank, null);
  }

  mergeRewardBucket(run.stash, bundle);
  depositRewardBucketToInventory(bundle);

  // 합산 요약 라인(summaryLines)은 반환하지 않는다 — 중복 집계 방지.
  // 몬스터별 드랍 라인만 반환해 postBattle UI에 표시한다.
  return perMonsterDropLines;
}
function resolvePuzzleRoom(run, room) {
  room.discovered = true;
  const bundle = createRewardBucket();
  // 파티원 중 최고 감각 기준 퍼즐 판정
  const alive = randomAlivePartyIndices(run);
  const maxSense = Math.max(0, ...alive.map(row => Number((row.u.stats && row.u.stats.sense) || row.u.sense || 0)));
  const threshold = SENSE_CHECK_BY_RANK[String(run.rank||'E').toUpperCase()] || 15;
  if (maxSense > threshold) {
    // 감각 통과: 70% 엘리트, 30% 일반재료
    if (Math.random() < 0.70) {
      addEliteLoot(bundle, run.rank);
      bundle.notes.push(`퍼즐 보상 판정 (감각 ${maxSense} > ${threshold}): 엘리트급 보상`);
    } else {
      addNormalMaterial(bundle, run.rank, randInt(2, 4));
      bundle.notes.push(`퍼즐 보상 판정 (감각 ${maxSense} > ${threshold}): 일반재료`);
    }
  } else {
    // 감각 미달: 일반재료만
    addNormalMaterial(bundle, run.rank, randInt(2, 4));
    bundle.notes.push(`퍼즐 보상 판정 (감각 ${maxSense} ≤ ${threshold}): 일반재료`);
  }
  mergeRewardBucket(run.stash, bundle);
  const invLogs = depositRewardBucketToInventory(bundle);
  if (invLogs.length) bundle.notes = (bundle.notes || []).concat(invLogs);
  room.cleared = true;
  pushGateLog(run, `퍼즐 해결: ${room.rewardLines.join(' / ') || '보상 없음'}`);
  if (roomHasMineableVeins(room)) {
    model.state.view = 'gate';
    return;
  }
  if (run.sideRoomActive) {
    applyRoomTraversalMinutes(run, room, 30);
    run.sideRoomActive = false;
    run.secretPlan.offered = false;
    run.secretPlan.resolved = true;
  } else {
    advanceGateRunAfterMainRoom(run, run.currentStage, room);
  }
}
function resolveSecretRoom(run, room) {
  room.discovered = true;
  const bundle = createRewardBucket();
  addBossLoot(bundle, run.rank);
  mergeRewardBucket(run.stash, bundle);
  const invLogs = depositRewardBucketToInventory(bundle);
  if (invLogs.length) bundle.notes = (bundle.notes || []).concat(invLogs);
  room.rewardLines = rewardBucketLines(bundle);
  room.cleared = true;
  pushGateLog(run, `비밀방 정산: ${room.rewardLines.join(' / ') || '보상 없음'}`);
  if (roomHasMineableVeins(room)) {
    return;
  }
  applyRoomTraversalMinutes(run, room, 30);
  run.sideRoomActive = false;
  if (run.secretPlan) {
    run.secretPlan.offered = false;
    run.secretPlan.resolved = true;
  }
}
function resolveGateBattleAftermath(victory) {
  const run = getGateRun();
  if (!run || !run.pendingBattleRoomId) throw new Error('게이트 전투 상태가 없다.');
  const room = getRoomById(run, run.pendingBattleRoomId);
  if (!room) throw new Error('현재 방을 찾지 못했다.');
  const rt = model.state.runtime;
  if (!rt.started || !rt.finished) throw new Error('전투가 아직 끝나지 않았다.');
  if (!victory) {
    // 전멸 시 HP 상태를 캐릭터 DB에 저장 + 전멸 날짜 기록
    syncPartyHpToDb(run);
    const gd = model.db.gameDate || { year:2026, month:1, day:1 };
    model.db.lastWipeDate = { year: gd.year, month: gd.month, day: gd.day };
    run.failed = true;
    run.postBattle = null;
    run.pendingBattleRoomId = '';
    pushGateLog(run, `게이트 실패: ${roomDisplayLabel(room, true)} 방에서 패퇴.`);
    model.state.view = 'gate';
    model.state.runtime = buildDefaultRuntime();
    return;
  }
  run.partyState = getAlive(rt.party).map(serializeUnitState);
  room.discovered = true;
  room.cleared = true;
  // resolveCombatRoomRewards가 rt.logs에 드랍 라인을 처치 직후에 삽입하므로
  // 반드시 rt.logs를 pushGateLog에 넘기기 전에 먼저 호출해야 한다.
  room.rewardLines = resolveCombatRoomRewards(run, room);
  // 전투 로그를 게이트 로그로 이관. 드랍 라인(" 드랍:")은 [전투] 접두 없이 그대로 표시.
  (rt.logs || []).forEach(line => {
    const prefix = line.includes(' 드랍:') ? '' : '[전투] ';
    pushGateLog(run, `${prefix}${line}`);
  });
  // 승리 라인은 보상 텍스트 없이 단독으로 출력한다 (중복/이중집계 방지).
  pushGateLog(run, `${roomDisplayLabel(room, true)} 방 승리`);
  run.pendingBattleRoomId = '';
  run.postBattle = {
    roomId: room.id,
    roomType: room.type,
    stageIndex: run.currentStage,
    restUsed:false,
    allowRest:true,
    rewardLines: deepClone(room.rewardLines || []),
    sideRoom: !!run.sideRoomActive,
    llmBlock: String(rt.llmBlock || ''),
    outcome: String(rt.outcome || 'Victory')
  };
  model.state.runtime = buildDefaultRuntime();
  model.state.view = 'gate';
}
function continueAfterGateBattle(run) {
  if (!run || !run.postBattle) return;
  const pb = run.postBattle;
  const room = getRoomById(run, pb.roomId);
  if (room) markSkippedVeinIfNeeded(run, room);
  if (pb.sideRoom) {
    if (room) applyRoomTraversalMinutes(run, room, 30);
    run.sideRoomActive = false;
    if (run.secretPlan) {
      run.secretPlan.offered = false;
      run.secretPlan.resolved = true;
    }
  } else if (room) {
    advanceGateRunAfterMainRoom(run, Number(pb.stageIndex || run.currentStage || 0), room);
  }
  run.postBattle = null;
}

function continueAfterClearedRoom(run) {
  if (!run) return;
  const room = getActiveRoom(run);
  if (!room || !room.cleared) return;
  markSkippedVeinIfNeeded(run, room);
  if (run.sideRoomActive) {
    applyRoomTraversalMinutes(run, room, 30);
    run.sideRoomActive = false;
    if (run.secretPlan) {
      run.secretPlan.offered = false;
      run.secretPlan.resolved = true;
    }
  } else {
    advanceGateRunAfterMainRoom(run, run.currentStage, room);
  }
}
function restGateParty(run) {
  if (!run || !run.postBattle) throw new Error('휴식 가능한 시점이 아니다.');
  if (run.postBattle.restUsed) throw new Error('이 방에서는 이미 휴식했다.');
  let lines = [];
  (run.partyState || []).forEach(unit => {
    const maxHp = Number(unit.hp || unit.maxHp || 0);
    const maxMp = Number(unit.mp || unit.maxMp || 0);
    const maxSp = Number(unit.sp || unit.maxSp || 0);
    const hpGain = Math.max(1, Math.floor(maxHp * 0.02));
    const mpGain = Math.max(0, Math.floor(maxMp * 0.02));
    const spGain = Math.max(0, Math.floor(maxSp * 0.02));
    unit.currentHp = clamp(Number(unit.currentHp || 0) + hpGain, 0, maxHp);
    unit.currentMp = clamp(Number(unit.currentMp || 0) + mpGain, 0, maxMp);
    unit.currentSp = clamp(Number(unit.currentSp || 0) + spGain, 0, maxSp);
    lines.push(`${unit.name} HP+${hpGain}${mpGain ? ` / MP+${mpGain}` : ''}${spGain ? ` / SP+${spGain}` : ''}`);
  });
  run.elapsedMinutes = Number(run.elapsedMinutes || 0) + 30;
  run.postBattle.restUsed = true;
  pushGateLog(run, `휴식(30분): ${lines.join(' / ')}`);
  return lines;
}
function campRequirement(run) {
  const n = Math.max(1, Number(run && run.partyStartCount || (run && run.partyState && run.partyState.length) || 1));
  return { tent:1, ration:n, water:n };
}
function campSupplyStock() {
  // Count old supply_tent items and new grade-based tent items
  const tentCount = getSupplyCount('tent') + GRADE_ORDER.reduce((s, g) => {
    const it = findInventoryItemById(`tent_${g}`);
    return s + (it ? Math.max(0, Number(it.count || 0)) : 0);
  }, 0);
  return { tent: tentCount, ration:getSupplyCount('ration'), water:getSupplyCount('water') };
}
function canUseCamp(run) {
  if (!run || !run.campSupplies || run.size === 'small') return false;
  if (run.campSupplies.used) return false;
  const req = campRequirement(run);
  const stock = campSupplyStock();
  return stock.tent >= req.tent && stock.ration >= req.ration && stock.water >= req.water;
}
function campGateParty(run) {
  if (!run) throw new Error('진행 중인 게이트가 없다.');
  const room = getActiveRoom(run);
  if (!room || room.type !== 'camp') throw new Error('야영 가능한 장소가 아니다.');
  if (room.cleared) throw new Error('이 야영지는 이미 처리되었다.');
  if (!canUseCamp(run)) throw new Error('야영에 필요한 보급품이 부족하거나 이미 야영을 사용했다.');
  const req = campRequirement(run);
  if (campSupplyStock().tent < req.tent) throw new Error('텐트가 부족하다.');
  if (!consumeInventoryById('supply_ration', req.ration) || !consumeInventoryById('supply_water', req.water)) throw new Error('야영 보급품이 부족하다.');
  run.campSupplies.used = true;
  const lines = [];
  (run.partyState || []).forEach(unit => {
    const maxHp = Number(unit.hp || unit.maxHp || 0);
    const maxMp = Number(unit.mp || unit.maxMp || 0);
    const maxSp = Number(unit.sp || unit.maxSp || 0);
    const hpGain = Math.max(1, Math.floor(maxHp * 0.60));
    const mpGain = Math.max(0, Math.floor(maxMp * 0.60));
    const spGain = Math.max(0, Math.floor(maxSp * 0.60));
    unit.currentHp = clamp(Number(unit.currentHp || 0) + hpGain, 0, maxHp);
    unit.currentMp = clamp(Number(unit.currentMp || 0) + mpGain, 0, maxMp);
    unit.currentSp = clamp(Number(unit.currentSp || 0) + spGain, 0, maxSp);
    if (unit.statuses) {
      ['poison','bleed','burn','curse','bind','stun','sleep'].forEach(k => { if (Number(unit.statuses[k] || 0) > 0) unit.statuses[k] = 0; });
      ['poisonPower','bleedPower','burnPower'].forEach(k => { if (unit.statuses[k]) unit.statuses[k] = 0; });
    }
    lines.push(`${unit.name} HP+${hpGain}${mpGain ? ` / MP+${mpGain}` : ''}${spGain ? ` / SP+${spGain}` : ''}`);
  });
  room.cleared = true;
  room.rewardLines = lines;
  run.elapsedMinutes = Number(run.elapsedMinutes || 0) + 360;
  pushGateLog(run, `야영(6시간): ${lines.join(' / ')}`);
  if (run.sideRoomActive) {
    run.sideRoomActive = false;
    if (run.secretPlan) { run.secretPlan.offered = false; run.secretPlan.resolved = true; }
  } else {
    advanceGateRunAfterMainRoom(run, run.currentStage, room);
  }
  return lines;
}
function skipCampRoom(run) {
  if (!run) throw new Error('진행 중인 게이트가 없다.');
  const room = getActiveRoom(run);
  if (!room || room.type !== 'camp') throw new Error('야영지가 아니다.');
  room.cleared = true;
  room.rewardLines = ['야영을 하지 않고 지나쳤다.'];
  pushGateLog(run, '야영지를 지나쳤다.');
  if (run.sideRoomActive) {
    run.sideRoomActive = false;
    if (run.secretPlan) { run.secretPlan.offered = false; run.secretPlan.resolved = true; }
  } else {
    advanceGateRunAfterMainRoom(run, run.currentStage, room);
  }
}
function retreatFromGateRun(run) {
  if (!run) return;
  // 후퇴 시 현재 HP/MP/SP를 캐릭터 DB에 저장 (풀피 복구 안함)
  syncPartyHpToDb(run);
  run.failed = true;
  run.postBattle = null;
  run.pendingBattleRoomId = '';
  pushGateLog(run, '게이트에서 후퇴했다.');
  // 게이트 진행 상태를 완전히 해제하여 후퇴 후 즉시 게이트에서 나올 수 있게 함
  const gs = gateStateSafe();
  gs.run = null;
  model.state.view = 'gate';
  model.state.runtime = buildDefaultRuntime();
}

// 게이트 파티 상태의 현재 HP/MP/SP를 캐릭터 DB에 저장
function syncPartyHpToDb(run) {
  if (!run || !run.partyState) return;
  const chars = model.db.characters || [];
  const personas = model.db.personas || [];
  (run.partyState || []).forEach(u => {
    const id = u.baseId || u.id;
    if (!id) return;
    const dbChar = chars.find(c => c.id === id) || personas.find(p => p.id === id);
    if (!dbChar) return;
    dbChar.currentHp = Math.max(0, Math.floor(Number(u.currentHp || 0)));
    dbChar.currentMp = Math.max(0, Math.floor(Number(u.currentMp || 0)));
    dbChar.currentSp = Math.max(0, Math.floor(Number(u.currentSp || 0)));
  });
}

function migrateLegacyCampSupplies(run) {
  if (!run || !run.campSupplies || run.campSupplies.legacyMigrated) return;
  const legacy = run.campSupplies;
  ['tent','ration','water'].forEach(kind => {
    const count = Math.max(0, Number(legacy[kind] || 0));
    if (!count) return;
    const res = addSupplyToInventory(kind, count);
    if (!res.ok) pushInventoryOverflow(buildSupplyItem(kind, count));
    legacy[kind] = 0;
  });
  legacy.legacyMigrated = true;
}
function autoHandleFinishedGateBattle() {
  const run = getGateRun();
  const rt = model.state.runtime;
  if (!run || !run.pendingBattleRoomId || !rt || !rt.started || !rt.finished) return false;
  resolveGateBattleAftermath(String(rt.outcome || '') === 'Victory');
  return true;
}
function currentGatePrompt(run) {
  if (!run) return '';
  if (run.completed) return '<div class="gb-sub">게이트 공략 완료. 허브로 돌아가거나 새 게이트를 생성해.</div>';
  if (run.failed) return '<div class="gb-sub" style="color:#fca5a5;">게이트 공략 종료/후퇴. 새 게이트를 고르거나 파티를 재정비해.</div>';
  if (run.postBattle) {
    const afterRoom = getRoomById(run, run.postBattle.roomId);
    const nextLabel = run.postBattle.roomType === 'boss' ? '게이트 종료' : '다음방 진입';
    const canMine = roomHasMineableVeins(afterRoom);
    const allowRest = run.postBattle.allowRest !== false;
    return `
      <div class="gb-panel">
        <div class="gb-section-title">${allowRest ? '전투 후 선택' : '방 정리'}</div>
        <div class="gb-sub">${allowRest ? '전투가 끝났다. 다음 행동을 고를 수 있다.' : '방을 정리했다. 다음 행동을 고를 수 있다.'}</div>
        ${run.postBattle.rewardLines && run.postBattle.rewardLines.length ? `<div class="gb-log">${run.postBattle.rewardLines.map(t => `<div>• ${escapeHtml(t)}</div>`).join('')}</div>` : ''}
        ${allowRest ? (run.postBattle.restUsed ? '<div class="gb-sub">이 방에서는 이미 휴식을 사용했다.</div>' : '<div class="gb-sub">휴식: 30분 경과 / 생존 파티 HP·MP·SP 2% 회복</div>') : ''}
        ${run.postBattle.llmBlock ? `<textarea class="gb-textarea short" readonly>${escapeHtml(run.postBattle.llmBlock)}</textarea>` : ''}
        <div class="gb-btn-row">
          <button class="gb-btn primary" id="gb-postbattle-next">${nextLabel}</button>
          ${allowRest ? `<button class="gb-btn" id="gb-postbattle-rest" ${run.postBattle.restUsed ? 'disabled' : ''}>휴식</button>` : ''}
          ${canMine ? '<button class="gb-btn" id="gb-postbattle-mine">광맥 채굴</button>' : ''}
          <button class="gb-btn" id="gb-postbattle-potion">🧪 물약</button>
          <button class="gb-btn danger" id="gb-postbattle-retreat">후퇴</button>
          ${run.postBattle.llmBlock ? '<button class="gb-btn" id="gb-postbattle-copy-llm">결과 블록 복사</button>' : ''}
        </div>
      </div>
      ${run.showPotionPanel ? renderPostBattlePotionPanel(run) : ''}`;
  }
  function renderPostBattlePotionPanel(run) {
    const inv = getActiveInventory();
    const potions = inv.items.filter(it => it.category === 'potion');
    if (!potions.length) return '<div class="gb-panel"><div class="gb-sub">소지 중인 물약이 없다.</div><div class="gb-btn-row"><button class="gb-btn" id="gb-pb-potion-close">닫기</button></div></div>';
    const daily = getPotionUsesToday();
    const remaining = Math.max(0, POTION_DAILY_MAX_RECOVERY - daily.recovery);
    const party = (run.partyState || []).filter(u => Number(u.currentHp || u.hp || 0) > 0);
    const potionOpts = potions.map(p => `<option value="${escapeHtml(p.stackKey)}">${escapeHtml(p.name)} x${p.count} — ${escapeHtml(p.note||'')}</option>`).join('');
    const targetOpts = party.map((u, i) => `<option value="${i}">${escapeHtml(u.name)} (HP ${Math.floor(Number(u.currentHp||0))}/${Math.floor(Number(u.hp||0))})</option>`).join('');
    return `
      <div class="gb-panel">
        <div class="gb-section-title">🧪 물약 사용 (전투 후)</div>
        <div class="gb-sub">회복포션: ${remaining}/${POTION_DAILY_MAX_RECOVERY + 1}회 남음${daily.recovery >= POTION_DAILY_MAX_RECOVERY ? ' ⚠️ 다음 사용 시 효율 20%' : ''}${daily.recovery > POTION_DAILY_MAX_RECOVERY ? ' (한도초과)' : ''} | 버프포션: ${Math.max(0, POTION_DAILY_MAX_BUFF - daily.buff)}/${POTION_DAILY_MAX_BUFF}회 | 해제포션: 무제한</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;">
          <select class="gb-input" id="gb-pb-potion-select">${potionOpts}</select>
          <span style="color:#94a3b8;">→</span>
          <select class="gb-input" id="gb-pb-potion-target">${targetOpts}</select>
          <button class="gb-btn primary" id="gb-pb-potion-apply">사용</button>
        </div>
        <div class="gb-btn-row"><button class="gb-btn" id="gb-pb-potion-close">닫기</button></div>
      </div>`;
  }

  if (run.secretPlan && run.secretPlan.offered && !run.sideRoomActive && !run.secretPlan.resolved) {
    return `
      <div class="gb-panel">
        <div class="gb-section-title">비밀방 발견</div>
        <div class="gb-sub">벽 너머에 숨겨진 공간이 열렸다. 진입할지, 그냥 진행할지 고를 수 있다.</div>
        <div class="gb-btn-row"><button class="gb-btn primary" id="gb-secret-enter">비밀방 진입</button><button class="gb-btn" id="gb-secret-skip">그냥 진행</button></div>
      </div>`;
  }
  const room = getActiveRoom(run);
  if (run.sideRoomActive && room) {
    // choice prompt보다 비밀방/사이드룸 우선
  } else {
    const stage = getCurrentStage(run);
    if (!stage) return '<div class="gb-sub">진행할 단계가 없다.</div>';
    if (stage.kind === 'choice' && !stage.chosen) {
      return `
        <div class="gb-panel">
          <div class="gb-section-title">갈림길</div>
          <div class="gb-sub">앞쪽 방의 정체는 알 수 없다. 경로만 선택할 수 있다.</div>
          <div class="gb-btn-row">${(stage.options || []).map(opt => `<button class="gb-btn primary" data-stage-choice="${escapeHtml(opt.key)}">경로 ${escapeHtml(opt.key)}</button>`).join('')}</div>
        </div>`;
    }
  }
  if (!room) return '<div class="gb-sub">현재 방 정보를 찾지 못했다.</div>';
  let actions = '';
  if (room.type === 'camp' && !room.cleared) {
    const req = campRequirement(run);
    const ok = canUseCamp(run);
    const sup = campSupplyStock();
    const used = !!(run.campSupplies && run.campSupplies.used);
    actions = `
      <div class="gb-sub">야영 필요: 텐트 ${sup.tent}/${req.tent} · 식량 ${sup.ration}/${req.ration} · 물 ${sup.water}/${req.water}</div>
      <div class="gb-sub">텐트는 보유만 확인하고 소모하지 않는다. 식량/물만 소비한다.</div>
      <div class="gb-sub">야영: 6시간 경과 / 생존 파티 HP·MP·SP 60% 회복 / 상태이상 일부 완화</div>
      ${used ? '<div class="gb-sub">이 게이트에서는 이미 야영을 사용했다.</div>' : ''}
      <button class="gb-btn primary" id="gb-room-camp" ${ok ? '' : 'disabled'}>야영</button>
      <button class="gb-btn" id="gb-room-skip-camp">그냥 지나가기</button>`;
  } else if (room.type === 'puzzle' && !room.cleared) actions = '<button class="gb-btn primary" id="gb-room-solve-puzzle">퍼즐 해결</button>';
  else if (room.type === 'secret' && !room.cleared) actions = '<button class="gb-btn primary" id="gb-room-open-secret">비밀방 탐색</button>';
  else if (['combat','elite','boss'].includes(room.type) && !room.cleared) actions = '<button class="gb-btn primary" id="gb-room-enter">전투 시작</button>';
  else if (!room.cleared) actions = '<button class="gb-btn primary" id="gb-room-enter">방 진입</button>';
  else if (room.cleared) actions = `${roomHasMineableVeins(room) ? '<button class="gb-btn" id="gb-room-mine">광맥 채굴</button>' : ''}<button class="gb-btn primary" id="gb-room-next">다음방 진입</button><button class="gb-btn danger" id="gb-room-retreat">후퇴</button>`;
  return `
    <div class="gb-panel">
      <div class="gb-section-title">현재 방</div>
      <div><strong>${escapeHtml(room.discovered || room.cleared ? roomDisplayLabel(room, true) : '미확인 방')}</strong></div>
      <div class="gb-sub">${escapeHtml(room.discovered || room.cleared ? ('유형: ' + roomDisplayLabel(room, true)) : '정체를 알 수 없다.')}</div>
      ${room.notes && room.notes.length ? `<div class="gb-log">${room.notes.map(t => `<div>• ${escapeHtml(t)}</div>`).join('')}</div>` : ''}
      ${room.rewardLines && room.rewardLines.length ? `<div class="gb-log">${room.rewardLines.map(t => `<div>• ${escapeHtml(t)}</div>`).join('')}</div>` : ''}
      <div class="gb-btn-row">${actions}</div>
    </div>`;
}
function renderGateRunPanel(run) {
  const tokens = (run.stages || []).map((stage, idx) => stageToken(stage, idx, run)).join(' <span class="gb-sub">→</span> ');
  const stashLines = rewardBucketDropLines(run.stash);
  const sup = campSupplyStock();
  const used = !!(run.campSupplies && run.campSupplies.used);
  const gateTab = model.state.gateRunTab || 'main';

  // ── Party status cards (compact) ──
  const alive = (run.partyState || []).filter(u => Number(u.currentHp || u.hp || 0) > 0);
  const dead = (run.partyState || []).filter(u => Number(u.currentHp || u.hp || 0) <= 0);
  function gatePartyCard(u) {
    const hp = Number(u.currentHp || u.hp || 0);
    const maxHp = Number(u.hp || 1);
    const mp = Number(u.currentMp || u.mp || 0);
    const maxMp = Number(u.mp || 1);
    const sp = Number(u.currentSp || u.sp || 0);
    const maxSp = Number(u.sp || 1);
    const hpPct = maxHp > 0 ? Math.round(hp / maxHp * 100) : 0;
    const mpPct = maxMp > 0 ? Math.round(mp / maxMp * 100) : 0;
    const spPct = maxSp > 0 ? Math.round(sp / maxSp * 100) : 0;
    const isDead = hp <= 0;
    const statusTags = [];
    const st = u.statuses || {};
    if (st.poison > 0) statusTags.push('<span style="color:#22c55e;font-size:10px;">독</span>');
    if (st.bleed > 0) statusTags.push('<span style="color:#ef4444;font-size:10px;">출혈</span>');
    if (st.burn > 0) statusTags.push('<span style="color:#f97316;font-size:10px;">화상</span>');
    if (st.curse > 0) statusTags.push('<span style="color:#a855f7;font-size:10px;">저주</span>');
    if (st.stun > 0) statusTags.push('<span style="color:#fbbf24;font-size:10px;">기절</span>');
    return `<div class="gb-unit${isDead ? ' is-dead' : ''}" style="padding:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong style="font-size:13px;">${escapeHtml(u.name)}</strong> <span class="gb-badge">${escapeHtml(u.rank||'')}</span></div>
        <div style="font-size:10px;color:#94a3b8;">${escapeHtml(u.job || '')} / ${escapeHtml(u.row || '')}</div>
      </div>
      ${statusTags.length ? `<div style="margin-top:2px;">${statusTags.join(' ')}</div>` : ''}
      <div class="gb-bar-wrap" style="margin-top:4px;"><span style="font-size:10px;">HP ${Math.floor(hp)}/${Math.floor(maxHp)}</span><div class="gb-bar"><div class="gb-bar-fill hp" style="width:${hpPct}%"></div></div></div>
      <div class="gb-bar-wrap"><span style="font-size:10px;">MP ${Math.floor(mp)}/${Math.floor(maxMp)}</span><div class="gb-bar"><div class="gb-bar-fill mp" style="width:${mpPct}%"></div></div></div>
      <div class="gb-bar-wrap"><span style="font-size:10px;">SP ${Math.floor(sp)}/${Math.floor(maxSp)}</span><div class="gb-bar"><div class="gb-bar-fill sp" style="width:${spPct}%"></div></div></div>
    </div>`;
  }

  // ── Current room encounter enemies ──
  const room = getActiveRoom(run);
  const encounter = room && room.encounter ? room.encounter : null;
  const enemyCards = encounter && Array.isArray(encounter.enemies)
    ? encounter.enemies.map(e => {
        const hp = Number(e.currentHp || e.hp || 0);
        const maxHp = Number(e.hp || 1);
        const hpPct = maxHp > 0 ? Math.round(hp / maxHp * 100) : 0;
        const isDead = hp <= 0;
        return `<div class="gb-unit${isDead ? ' is-dead' : ''}" style="padding:8px;">
          <div><strong style="font-size:13px;">${escapeHtml(e.name || e.id || '???')}</strong> <span class="gb-badge">${escapeHtml(e.rank || '')}</span> <span class="gb-badge" style="background:rgba(239,68,68,0.18);color:#fca5a5;">${escapeHtml(e.kind || '')}</span></div>
          <div class="gb-bar-wrap" style="margin-top:4px;"><span style="font-size:10px;">HP ${Math.floor(hp)}/${Math.floor(maxHp)}</span><div class="gb-bar"><div class="gb-bar-fill hp" style="width:${hpPct}%"></div></div></div>
        </div>`;
      }).join('')
    : '<div class="gb-sub">현재 조우한 적이 없다.</div>';

  // ── Tab content ──
  let tabContent = '';
  if (gateTab === 'party') {
    // 파티 관리 탭: 클릭 시 장비/스킬/인벤 상세 보기
    const detailId = model.state.gatePartyDetailId || '';
    const skillMap = getAllSkillMap();
    const catLabel = { singleAttack:'단일공격', aoeAttack:'광역공격', singleCC:'단일CC', aoeCC:'광역CC', buff:'버프', singleHeal:'힐', aoeHeal:'광역힐', passive:'패시브', utility:'유틸' };
    tabContent = `
      <div class="gb-panel">
        <div class="gb-section-title">👥 파티원 상세 <span class="gb-sub" style="font-size:11px;">(클릭하면 상세정보)</span></div>
        ${(run.partyState || []).map(u => {
          const hp = Number(u.currentHp || u.hp || 0);
          const maxHp = Number(u.hp || 1);
          const mp = Number(u.currentMp || u.mp || 0);
          const maxMp = Number(u.mp || 1);
          const sp = Number(u.currentSp || u.sp || 0);
          const maxSp = Number(u.sp || 1);
          const isDead = hp <= 0;
          const stats = u.stats || {};
          const uid = u.uid || u.id || u.baseId || '';
          const isOpen = (detailId === uid);
          // 장비 정보
          let equipHtml = '';
          let invHtml = '';
          if (isOpen) {
            const dbId = u.baseId || u.id;
            const dbChar = (model.db.characters || []).find(c => c.id === dbId) || (model.db.personas || []).find(p => p.id === dbId);
            if (dbChar) {
              const inv = getPersonalInv(
                (model.db.characters || []).find(c => c.id === dbId) ? 'character' : 'persona',
                dbId
              );
              if (inv) {
                const eqParts = EQUIP_PARTS.map(p => {
                  const eq = inv.equipped[p];
                  if (!eq) return `<div class="gb-sub" style="padding:2px 0;">${EQUIP_PART_LABELS[p]}: <span style="color:#64748b;">없음</span></div>`;
                  const traitStr = (eq.traits || []).map(t => escapeHtml(t.label || t.id)).join(', ');
                  const enhStr = eq.enhance > 0 ? ` +${eq.enhance}` : '';
                  const rarStr = eq.rarity && eq.rarity !== 'Normal' ? ` <span class="gb-badge" style="background:${rarityColor(eq.rarity)};color:#000;font-size:9px;">${escapeHtml(eq.rarity)}</span>` : '';
                  const statStr = [];
                  if (eq.atk) statStr.push('ATK:' + eq.atk);
                  if (eq.pdef) statStr.push('물방:' + eq.pdef);
                  if (eq.mdef) statStr.push('마방:' + eq.mdef);
                  return `<div class="gb-sub" style="padding:2px 0;">${EQUIP_PART_LABELS[p]}: <strong style="${rarityStyle(eq.rarity)}">${escapeHtml(eq.name||eq.id)}${enhStr}</strong>${rarStr}${statStr.length ? ' <span style="font-size:10px;color:#94a3b8;">[' + statStr.join('/') + ']</span>' : ''}${traitStr ? ' <span style="font-size:10px;color:#a78bfa;">(' + escapeHtml(traitStr) + ')</span>' : ''}</div>`;
                });
                equipHtml = `<div style="margin-top:6px;"><div style="font-weight:600;font-size:12px;margin-bottom:4px;">🛡️ 장착 장비</div>${eqParts.join('')}</div>`;
                // 개인 인벤토리 아이템 수
                const itemCount = Array.isArray(inv.items) ? inv.items.length : 0;
                if (itemCount > 0) {
                  const itemLines = inv.items.slice(0, 8).map(it => `<span class="gb-badge" style="font-size:9px;margin:1px;">${escapeHtml(it.name||it.id)}</span>`).join('');
                  const moreStr = itemCount > 8 ? ` <span class="gb-sub" style="font-size:10px;">외 ${itemCount - 8}개</span>` : '';
                  invHtml = `<div style="margin-top:6px;"><div style="font-weight:600;font-size:12px;margin-bottom:4px;">🎒 개인 인벤토리 (${itemCount}개)</div><div style="display:flex;flex-wrap:wrap;gap:2px;">${itemLines}${moreStr}</div></div>`;
                }
              }
            }
            // 스킬 상세
            const skillDetails = (u.skills || []).map(sId => {
              const sk = skillMap[sId];
              if (!sk) return `<div class="gb-sub" style="padding:1px 0;font-size:11px;">• ${escapeHtml(sId)}</div>`;
              const costStr = sk.costs ? [sk.costs.mp ? 'MP:'+sk.costs.mp : '', sk.costs.sp ? 'SP:'+sk.costs.sp : ''].filter(Boolean).join('/') : '';
              const coefStr = sk.coef != null ? '계수:' + sk.coef : '';
              const cat = catLabel[sk.category] || sk.category;
              return `<div class="gb-sub" style="padding:1px 0;font-size:11px;">• <strong>${escapeHtml(sk.name)}</strong> <span class="gb-badge" style="font-size:9px;">${cat}</span>${coefStr ? ' <span class="gb-badge" style="font-size:9px;">'+coefStr+'</span>' : ''}${costStr ? ' <span style="font-size:10px;color:#94a3b8;">['+costStr+']</span>' : ''}${sk.desc ? ' — '+escapeHtml(sk.desc) : ''}</div>`;
            }).join('') || '<div class="gb-sub" style="font-size:11px;">스킬 없음</div>';
          }
          return `<div class="gb-unit${isDead ? ' is-dead' : ''}" data-gate-party-detail="${escapeHtml(uid)}" style="cursor:pointer;">
            <div class="gb-unit-top">
              <div><strong>${escapeHtml(u.name)}</strong> <span class="gb-badge">${escapeHtml(u.rank||'')}</span> <span class="gb-badge">${escapeHtml(u.row || '')}</span> ${isOpen ? '▲' : '▼'}</div>
              <div class="gb-sub">${escapeHtml(u.job || '')} / ${escapeHtml(u.position || '')} / ${escapeHtml(u.damageType || '')}</div>
            </div>
            <div class="gb-bar-wrap"><span>HP ${Math.floor(hp)}/${Math.floor(maxHp)}</span><div class="gb-bar"><div class="gb-bar-fill hp" style="width:${maxHp>0?Math.round(hp/maxHp*100):0}%"></div></div></div>
            <div class="gb-bar-wrap"><span>MP ${Math.floor(mp)}/${Math.floor(maxMp)}</span><div class="gb-bar"><div class="gb-bar-fill mp" style="width:${maxMp>0?Math.round(mp/maxMp*100):0}%"></div></div></div>
            <div class="gb-bar-wrap"><span>SP ${Math.floor(sp)}/${Math.floor(maxSp)}</span><div class="gb-bar"><div class="gb-bar-fill sp" style="width:${maxSp>0?Math.round(sp/maxSp*100):0}%"></div></div></div>
            <div class="gb-sub" style="margin-top:4px;">STR ${stats.str||0} CON ${stats.con||0} INT ${stats.int||0} AGI ${stats.agi||0} SEN ${stats.sense||0} | ATK ${u.atk||0} PDEF ${u.pdef||0} MDEF ${u.mdef||0}</div>
            ${isOpen ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.2);">
              <div style="font-weight:600;font-size:12px;margin-bottom:4px;">📜 스킬 상세</div>
              ${(u.skills || []).map(sId => {
                const sk = skillMap[sId];
                if (!sk) return '<div class="gb-sub" style="padding:1px 0;font-size:11px;">• ' + escapeHtml(sId) + '</div>';
                const costStr = sk.costs ? [sk.costs.mp ? 'MP:'+sk.costs.mp : '', sk.costs.sp ? 'SP:'+sk.costs.sp : ''].filter(Boolean).join('/') : '';
                const coefStr = sk.coef != null ? '계수:' + sk.coef : '';
                const cat = catLabel[sk.category] || sk.category;
                return '<div class="gb-sub" style="padding:1px 0;font-size:11px;">• <strong>' + escapeHtml(sk.name) + '</strong> <span class="gb-badge" style="font-size:9px;">' + cat + '</span>' + (coefStr ? ' <span class="gb-badge" style="font-size:9px;">'+coefStr+'</span>' : '') + (costStr ? ' <span style="font-size:10px;color:#94a3b8;">['+costStr+']</span>' : '') + (sk.desc ? ' — '+escapeHtml(sk.desc) : '') + '</div>';
              }).join('') || '<div class="gb-sub" style="font-size:11px;">스킬 없음</div>'}
              ${equipHtml}
              ${invHtml}
            </div>` : `<div class="gb-sub">스킬: ${(u.skills||[]).length ? (u.skills||[]).map(s => { const sk = skillMap[s]; return sk ? escapeHtml(sk.name) : escapeHtml(s); }).join(', ') : '없음'}</div>`}
          </div>`;
        }).join('')}
      </div>`;
  } else if (gateTab === 'inventory') {
    // 공용 인벤토리 빠른 보기
    const inv = getInventory();
    const cap = inventoryCapacity();
    const usedSlots = inventoryUsedSlots(inv);
    const usedWeight = inventoryUsedWeightG(inv);
    const invItems = (inv.items || []);
    tabContent = `
      <div class="gb-panel">
        <div class="gb-section-title">📦 공용 인벤토리</div>
        <div class="gb-sub">슬롯 <strong>${usedSlots}/${cap.slots}</strong> / 무게 ${formatWeightG(usedWeight)} / ${formatWeightG(cap.maxWeightG)}</div>
        <div style="max-height:300px;overflow:auto;margin-top:8px;">
          ${invItems.length ? invItems.map(it => {
            const isEq = it.category === 'equipment';
            return `<div style="font-size:12px;padding:3px 0;border-bottom:1px solid rgba(148,163,184,0.08);">
              ${escapeHtml(it.name||it.id)}${it.rank ? ` <span class="gb-badge">${it.rank}</span>` : ''}${isEq && it.part ? ` <span class="gb-badge">${EQUIP_PART_LABELS[it.part]||it.part}</span>` : ''}${it.count > 1 ? ` ×${it.count}` : ''}
            </div>`;
          }).join('') : '<div class="gb-sub">인벤토리가 비어있다.</div>'}
        </div>
      </div>`;
  } else if (gateTab === 'logs') {
    tabContent = `
      <div class="gb-panel">
        <div class="gb-section-title">📜 게이트 전체 로그</div>
        <textarea class="gb-textarea" readonly>${escapeHtml(((run.fullLogs || []).slice(-1200)).join('\n'))}</textarea>
      </div>`;
  } else {
    // main tab: prompt + rewards + recent logs
    tabContent = `
      ${currentGatePrompt(run)}
      <div class="gb-grid two">
        <div class="gb-panel">
          <div class="gb-section-title">최근 로그</div>
          <div class="gb-log" style="max-height:240px;">${(run.logs || []).slice(0, 80).map(t => `<div>• ${escapeHtml(t)}</div>`).join('') || '<div>아직 로그가 없다.</div>'}</div>
        </div>
        <div class="gb-panel">
          <div class="gb-section-title">현재 정산</div>
          <div class="gb-log" style="max-height:240px;">${stashLines.length ? stashLines.map(t => `<div>• ${escapeHtml(t)}</div>`).join('') : '<div>아직 획득한 보상이 없다.</div>'}</div>
        </div>
      </div>`;
  }

  // ── Full immersive layout ──
  return `
    <div style="border:2px solid rgba(37,99,235,0.4);border-radius:16px;padding:14px;background:linear-gradient(180deg,#0d1020 0%,#0f1117 100%);">
      <!-- Header bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div>
          <strong style="font-size:16px;">⚔️ ${escapeHtml(run.title)}</strong>
          <span class="gb-badge">${escapeHtml(run.rank)}</span>
          <span class="gb-badge">${escapeHtml(run.sizeLabel)}</span>
          <span class="gb-sub" style="margin-left:8px;">${escapeHtml(run.primarySpeciesLabel)} + ${escapeHtml(run.secondarySpeciesLabel)}</span>
        </div>
        <button class="gb-btn tiny" id="gb-gate-fullscreen-close" style="font-size:12px;">✕ 게이트 선택으로</button>
      </div>

      <!-- Stage progress -->
      <div class="gb-panel" style="padding:8px 12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:700;color:#60a5fa;">노드 진행:</span>
          ${tokens}
        </div>
        <div class="gb-sub" style="margin-top:4px;">생존 ${alive.length}명${dead.length ? ` / 사망 ${dead.length}명` : ''} / 단계 ${Math.min(run.currentStage + 1, run.stages.length)}/${run.stages.length} / 경과 ${Math.floor((run.elapsedMinutes || 0)/60)}h ${(run.elapsedMinutes || 0)%60}m / 보급: 텐트${sup.tent||0} 식량${sup.ration||0} 물${sup.water||0}${used ? ' (야영완료)' : ''}</div>
      </div>

      <!-- Main 2-column: Party (left) vs Enemies (right) -->
      <div class="gb-grid two" style="align-items:start;margin-bottom:10px;">
        <div class="gb-panel" style="max-height:420px;overflow:auto;">
          <div class="gb-section-title" style="color:#60a5fa;">👥 파티 (${alive.length}/${run.partyState.length})</div>
          ${(run.partyState || []).map(u => gatePartyCard(u)).join('')}
        </div>
        <div class="gb-panel" style="max-height:420px;overflow:auto;">
          <div class="gb-section-title" style="color:#fca5a5;">👹 적</div>
          ${enemyCards}
        </div>
      </div>

      <!-- Tab navigation -->
      <div class="gb-btn-row" style="margin-bottom:8px;">
        <button class="gb-btn${gateTab==='main'?' primary':''}" data-gate-run-tab="main">🗺️ 행동/정산</button>
        <button class="gb-btn${gateTab==='party'?' primary':''}" data-gate-run-tab="party">👥 파티 상세</button>
        <button class="gb-btn${gateTab==='inventory'?' primary':''}" data-gate-run-tab="inventory">📦 인벤토리</button>
        <button class="gb-btn${gateTab==='logs'?' primary':''}" data-gate-run-tab="logs">📜 전체 로그</button>
      </div>

      ${tabContent}
    </div>`;
}
async function applyGateSelectionToBattle(goBattle) {
  const gate = getSelectedGeneratedGate();
  if (!gate) throw new Error('선택된 게이트가 없다.');
  model.state.gate.current = deepClone(gate);
  model.db.battleSetup.enemySlots = (gate.previewEnemySlots || []).slice(0, MAX_ENEMIES);
  while (model.db.battleSetup.enemySlots.length < MAX_ENEMIES) model.db.battleSetup.enemySlots.push('');
  model.state.runtime = buildDefaultRuntime();
  if (goBattle) model.state.view = 'battle';
  await saveDb();
  await saveState();
}

function getBuffedStat(unit, statKey) {
    let value = Number((unit.stats && unit.stats[statKey]) || 0) + Number((unit.passiveBonuses && unit.passiveBonuses[statKey]) || 0);
    (unit.buffs || []).forEach(buff => {
      if (buff && buff.stats && buff.stats[statKey]) value += Number(buff.stats[statKey]);
    });
    return value;
  }
  const CURSE_PERCENT_BY_RANK = { E:0.10, D:0.12, C:0.15, B:0.20, A:0.25, S:0.30 };
  function getCursePenalty(unit) {
    if (Number(unit.statuses.curse || 0) <= 0) return 0;
    const rank = normalizeRank(unit.rank);
    return CURSE_PERCENT_BY_RANK[rank] || 0.10;
  }
  function getIncomingDamageMul(unit) {
    let mul = (unit.buffs || []).reduce((acc, buff) => acc * Number(buff.damageTakenMul || 1), 1);
    if (unit && unit.damageTakenMods) {
      // applied later by damage type
    }
    if (Number(unit.aloneDamageTaken || 1) !== 1) {
      const sideUnits = unit.side === 'party' ? model.state.runtime.party : model.state.runtime.enemies;
      if (getAlive(sideUnits).length === 1) mul *= Number(unit.aloneDamageTaken || 1);
    }
    // Curse: rank-based incoming damage increase
    const cursePct = getCursePenalty(unit);
    if (cursePct > 0) mul *= (1 + cursePct);
    // Burn: +10% incoming damage (does not stack)
    if (Number(unit.statuses.burn || 0) > 0) mul *= 1.10;
    // 패시브: 진형 지휘 (전투 시작 2턴 피해감소)
    if (unit.passiveMods && Number(unit.passiveMods.formationDmgReduce || 0) > 0) {
      const runtime = (typeof model !== 'undefined' && model.state && model.state.runtime) ? model.state.runtime : null;
      if (runtime && runtime.round <= 2 && unit.row === 'front') {
        mul *= (1 - unit.passiveMods.formationDmgReduce);
      }
    }
    return mul;
  }
  function getOutgoingMul(unit, target, skill) {
    let mul = 1;
    // Curse: rank-based attack decrease
    const cursePct = getCursePenalty(unit);
    if (cursePct > 0) mul *= (1 - cursePct);
    if (unit.species === 'beast' && target && Number(target.statuses.bleed || 0) > 0) mul *= Number(unit.bonusVsBleeding || 1.2);
    return mul;
  }
  function getEffectiveDefense(unit, kind) {
    const base = Number(kind === 'magic' ? unit.mdef : unit.pdef);
    const passive = Number((unit.passiveBonuses && unit.passiveBonuses[kind === 'magic' ? 'mdef' : 'pdef']) || 0);
    // 장비 특성: 물리방어력/마법방어력 고정값 보너스
    const traitFlat = Number((unit.traitBonuses && unit.traitBonuses[kind === 'magic' ? 'mdef_flat' : 'pdef_flat']) || 0);
    return Math.max(0, base + passive + traitFlat);
  }
  function getStatPower(unit, skill) {
    const types = (skill && skill.statTypes && skill.statTypes.length > 0) ? skill.statTypes : [unit.attackStat || 'str'];
    const values = types.map(key => getBuffedStat(unit, key));
    return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
  }
  function getSkillCost(unit, skill) {
    const base = Object.assign({ mp:0, sp:0 }, (skill && skill.costs) || {});
    let mp = base.mp || 0;
    let sp = base.sp || 0;
    // 방패숙련: 방패 계열 SP 감소
    if ((skill.id === 'shieldBash' || skill.id === 'shockwave' || skill.id === 'shieldSmash') && unit.passiveMods && unit.passiveMods.shieldSpMul) {
      sp = Math.ceil(sp * (unit.passiveMods.shieldSpMul || 1));
    }
    // 단검숙련: 단검/투척 계열 SP 감소
    if ((skill.id === 'quickThrow' || skill.id === 'knifeRecall') && unit.passiveMods && unit.passiveMods.daggerSpMul) {
      sp = Math.ceil(sp * (unit.passiveMods.daggerSpMul || 1));
    }
    // 사기관리: 전투 시작 2턴 전 아군 MP/SP -12%
    if (unit.passiveMods && Number(unit.passiveMods.moraleCostReduce || 0) > 0) {
      const runtime = (typeof model !== 'undefined' && model.state && model.state.runtime) ? model.state.runtime : null;
      if (runtime && runtime.round <= 2) {
        const reduce = unit.passiveMods.moraleCostReduce;
        mp = Math.ceil(mp * (1 - reduce));
        sp = Math.ceil(sp * (1 - reduce));
      }
    }
    // 심판자의 기운: 적 스킬 비용 +10% (아군 패시브가 적에게 영향)
    if (typeof model !== 'undefined' && model.state && model.state.runtime) {
      const runtime = model.state.runtime;
      const enemySide = unit.side === 'party' ? runtime.enemies : runtime.party;
      const costMul = getAlive(enemySide).reduce((acc, u) => {
        return acc * Number((u.passiveMods && u.passiveMods.enemySkillCostMul) || 1);
      }, 1);
      if (costMul > 1) {
        mp = Math.ceil(mp * costMul);
        sp = Math.ceil(sp * costMul);
      }
    }
    return { mp, sp };
  }
  function canUseSkill(unit, skill) {
    if (!skill || skill.category === 'passive') return false;
    if (Number(unit.cooldowns && unit.cooldowns[skill.id] || 0) > 0) return false;
    // 침묵: 스킬 사용 불가 (기본 공격만 가능)
    if (Number(unit.statuses && unit.statuses.silence || 0) > 0) return false;
    // 몬스터는 MP/SP 비용 무시 (쿨타임만 적용)
    if (unit.isMonster) return true;
    const cost = getSkillCost(unit, skill);
    return unit.mp >= cost.mp && unit.sp >= cost.sp;
  }
  // 몬스터 스킬 쿨타임 결정: 일반=기본공격1/스킬2, 엘리트·보스=기본공격1/스킬2/광역3
  function getMonsterSkillCooldown(unit, skill) {
    const cat = skill.category || '';
    if (cat === 'aoeAttack' || cat === 'aoeCC' || cat === 'aoeHeal') return 3;
    if (cat !== 'passive') return 2;  // 단일공격/CC/힐/버프/유틸리티 = 2턴 쿨타임
    return 0;
  }
  function paySkillCost(unit, skill) {
    const cost = getSkillCost(unit, skill);
    if (!unit.isMonster) {
      unit.mp = Math.max(0, unit.mp - cost.mp);
      unit.sp = Math.max(0, unit.sp - cost.sp);
    }
    // 몬스터: 쿨타임 적용 (MP/SP 소모 없음)
    if (unit.isMonster) {
      const cd = getMonsterSkillCooldown(unit, skill);
      if (cd > 0) unit.cooldowns[skill.id] = cd;
    } else {
      if (skill.cooldown) unit.cooldowns[skill.id] = Number(skill.cooldown);
    }
    return cost;
  }
  function critChance(unit) {
    let bonus = 0;
    (unit.buffs || []).forEach(b => { if (b.critChanceBonus) bonus += Number(b.critChanceBonus); });
    // 장비 특성: 치명타 확률 증가
    bonus += Number((unit.traitBonuses && unit.traitBonuses.crit_chance) || 0);
    let sense = getBuffedStat(unit, 'sense');
    // Bind: 속박된헌터 감각 -50%
    if (!unit.isMonster && Number(unit.statuses.bind || 0) > 0) sense = Math.floor(sense * 0.5);
    return clamp(0.25 * (getBuffedStat(unit, 'agi') + sense) + bonus, 3, 35) / 100;
  }
  const EVASION_BY_RANK = { E:0.03, D:0.05, C:0.07, B:0.10, A:0.12, S:0.15 };

  function getBaseEvasion(unit) {
    const rank = normalizeRank(unit.rank);
    return EVASION_BY_RANK[rank] || 0.03;
  }
  function hitChance(attacker, target, skill) {
    let accuracy;
    if (attacker.isMonster) {
      // 몬스터 기본명중률 100%
      accuracy = 1.0;
      // 속박된 몬스터: 명중률 -50%
      if (Number(attacker.statuses.bind || 0) > 0) accuracy *= 0.5;
      // 둔화된 몬스터: 명중률 -30%
      if (Number(attacker.statuses.slow || 0) > 0) accuracy *= 0.7;
      // 실명된 몬스터: 명중률 -50%
      if (Number(attacker.statuses.blind || 0) > 0) accuracy *= 0.5;
    } else {
      // 헌터 명중률 = 70 + 감각 * 0.5
      let sense = getBuffedStat(attacker, 'sense');
      // 속박된 헌터: 감각 -50%, 명중률 -50%
      if (Number(attacker.statuses.bind || 0) > 0) sense = Math.floor(sense * 0.5);
      accuracy = (70 + sense * 0.5) / 100;
      if (Number(attacker.statuses.bind || 0) > 0) accuracy *= 0.5;
      // 둔화된 헌터: 명중률 -30%
      if (Number(attacker.statuses.slow || 0) > 0) accuracy *= 0.7;
      // 실명된 헌터: 명중률 -50%
      if (Number(attacker.statuses.blind || 0) > 0) accuracy *= 0.5;
    }
    // 대상 회피율 계산 (등급별, 헌터·몬스터 모두 적용)
    let evasion = getBaseEvasion(target);
    // 패시브 회피 보너스 (통찰, 본능 읽기 등)
    if (target.passiveMods && Number(target.passiveMods.evasionBonus || 0) > 0) {
      evasion += Number(target.passiveMods.evasionBonus);
    }
    // 공격자 등급 > 대상 등급 → 대상 회피율 0%
    if (rankIndex(attacker.rank) > rankIndex(target.rank)) {
      evasion = 0;
    }
    // 같은 등급 몬스터가 헌터 공격 시: 회피율 50% 감소
    if (attacker.isMonster && !target.isMonster && rankIndex(attacker.rank) === rankIndex(target.rank)) {
      evasion *= 0.5;
    }
    // 둔화된 대상: 회피율 -50%
    if (Number(target.statuses.slow || 0) > 0) {
      evasion *= 0.5;
    }
    // 최종 적중률 = 명중률 - 대상 회피율, 100% 이상 → 무조건 적중
    return accuracy - evasion;
  }
  function performHit(attacker, target, skill) {
    // 긴급회피: 다음 1회 공격 100% 회피
    const evasionBuff = (target.buffs || []).find(b => b && b.evasionNext && b.turns > 0);
    if (evasionBuff) {
      evasionBuff.turns = 0; // 1회 소모
      return { hit:false, crit:false };
    }
    const hitRate = hitChance(attacker, target, skill);
    const hit = hitRate >= 1.0 || Math.random() <= hitRate;
    const crit = hit && Math.random() <= critChance(attacker);
    return { hit, crit };
  }
  function computeDamage(attacker, target, skill, crit) {
    const coef = Number(skill && skill.coef != null ? skill.coef : 1.0);
    const damageType = (skill && skill.damageType) || attacker.damageType || 'physical';
    const def = getEffectiveDefense(target, damageType === 'magic' ? 'magic' : 'physical');
    // 장비 특성: 치명타 피해 증가
    const critDmgTraitBonus = Number((attacker.traitBonuses && attacker.traitBonuses.crit_damage) || 0) / 100;
    const critMult = crit ? (1.5 + critDmgTraitBonus) : 1.0;
    const element = normElement((skill && skill.element && skill.element !== 'none') ? skill.element : (attacker.baseElement || 'none'));
    const resistMult = element !== 'none' ? Number((target.resists || {})[element] || 1) : 1;
    const elementMul = getElementAdvantageMult(element, target.baseElement || 'none');
    const typeMul = Number((target.damageTakenMods || {})[damageType] || 1);
    const incomingMul = getIncomingDamageMul(target);
    const outgoingMul = getOutgoingMul(attacker, target, skill);
    let rawBase = 0;
    if (attacker && attacker.isMonster && Number(attacker.monsterBaseDamage || 0) > 0) {
      const isSkill = !!(skill && skill.id && skill.id !== 'basicAttack');
      rawBase = Number(attacker.monsterBaseDamage || 1) * (isSkill ? Number(attacker.monsterSkillMul || 1) : 1);
      // 몬스터 광역 스킬: 대상당 데미지 ×0.58 감소 (헌터 광역 계수와 동일)
      if (skill && (skill.category === 'aoeAttack' || skill.category === 'aoeCC')) rawBase *= 0.58;
    } else {
      const mainStat = getStatPower(attacker, skill);
      rawBase = (2 * mainStat) + (3 * Number(attacker.atk || 0));
    }
    // 장비 특성: 물리/마법 피해 증가 + 속성 피해 증가
    let traitOutMul = 1;
    if (attacker.traitBonuses) {
      const dmgKey = damageType === 'magic' ? 'magic_damage' : 'physical_damage';
      traitOutMul += Number(attacker.traitBonuses[dmgKey] || 0) / 100;
      if (element !== 'none') {
        traitOutMul += Number(attacker.traitBonuses[`${element}_damage`] || 0) / 100;
      }
    }
    // 장비 특성: 물리/마법 피해감소 + 속성 저항 (대상)
    let traitDefMul = 1;
    if (target.traitBonuses) {
      const defKey = damageType === 'magic' ? 'magic_defense' : 'physical_defense';
      traitDefMul -= Number(target.traitBonuses[defKey] || 0) / 100;
      if (element !== 'none') {
        traitDefMul -= Number(target.traitBonuses[`${element}_resist`] || 0) / 100;
      }
      traitDefMul = Math.max(0, traitDefMul);
    }
    // 방어 전 피해량 (rawDamage)
    const rawDamage = rawBase * coef * critMult * resistMult * elementMul * typeMul * incomingMul * outgoingMul * traitOutMul;
    // 물리/마법 피해감소 공식: 피해감소율 = DEF / (DEF + 1.5 × rawDamage)
    const defReduction = (def > 0 && rawDamage > 0) ? def / (def + 1.5 * rawDamage) : 0;
    let afterStatDef = rawDamage * (1 - defReduction) * traitDefMul;
    // 패시브: 물리 피해 감소 (충격 감소 등)
    if (damageType === 'physical' && target.passiveMods && Number(target.passiveMods.physicalDmgReduce || 0) > 0) {
      afterStatDef *= (1 - target.passiveMods.physicalDmgReduce);
    }
    // 보너스 피해 (관통탄 등 — 최종 피해에 곱연산)
    let bonusMul = 1;
    if (skill && skill.passiveMods && Number(skill.passiveMods.bonusDamage || 0) > 0) {
      bonusMul += skill.passiveMods.bonusDamage;
    }
    if (attacker.passiveMods && Number(attacker.passiveMods.bonusDamage || 0) > 0) {
      bonusMul += attacker.passiveMods.bonusDamage;
    }
    afterStatDef *= bonusMul;
    return Math.max(1, Math.round(afterStatDef));
  }
  function computeHeal(caster, skill) {
    const mainStat = getStatPower(caster, skill);
    const ss = mainStat * 0.5;
    const coef = Number(skill && skill.coef != null ? skill.coef : 1.0);
    // 장비 특성: 치유량 증가
    const healDoneBonus = 1 + Number((caster.traitBonuses && caster.traitBonuses.healing_done) || 0) / 100;
    return Math.max(1, Math.round(ss * coef * healDoneBonus));
  }
  function getAlive(units) { return units.filter(u => !u.dead && u.hp > 0); }
  function findUnitByUid(runtime, uid) {
    return runtime.party.concat(runtime.enemies).find(u => u.uid === uid) || null;
  }
  function rowsWithAlive(units) {
    const out = { front:[], mid:[], back:[] };
    getAlive(units).forEach(u => { (out[u.row] || out.mid).push(u); });
    return out;
  }
  function getAccessibleRows(attacker, skill, foes) {
    const aliveRows = rowsWithAlive(foes);
    const anyAlive = ['front','mid','back'].filter(r => aliveRows[r].length > 0);
    if (!anyAlive.length) return [];
    if (skill && (skill.target === 'allEnemies' || skill.category === 'aoeAttack' || skill.category === 'aoeCC')) return anyAlive;
    const t = ((attacker.position || '') + ' ' + (attacker.job || '')).toLowerCase();
    const ranged = t.includes('원거리') || t.includes('궁수') || t.includes('투척') || t.includes('마법') || t.includes('법사') || t.includes('정령') || t.includes('클레릭') || t.includes('힐러') || t.includes('서포터') || (skill && skill.damageType === 'magic');
    if (ranged) return anyAlive;
    if (aliveRows.front.length) return ['front'];
    if (aliveRows.mid.length) return ['mid'];
    return ['back'];
  }
  function choosePriorityTarget(attacker, foes, skill) {
    const alive = getAlive(foes);
    if (!alive.length) return null;
    const allowedRows = getAccessibleRows(attacker, skill, foes);
    const filtered = alive.filter(u => allowedRows.includes(u.row));
    const list = filtered.length ? filtered : alive;
    if (attacker.side === 'party') {
      const boss = list.find(u => String(u.kind || '').toLowerCase() === 'boss');
      if (boss) return boss;
      const elite = list.find(u => String(u.kind || '').toLowerCase() === 'elite');
      if (elite) return elite;
      return list.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
    }
    const healer = list.find(u => (u.position || '').includes('힐러'));
    if (healer) return healer;
    const support = list.find(u => (u.position || '').includes('서포터'));
    if (support) return support;
    return list.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
  }
  function chooseWeightedTarget(attacker, foes, skill, explicitUid) {
    const alive = getAlive(foes);
    if (!alive.length) return null;
    // 은신(stealth): 은신 중인 유닛은 대상에서 제외
    const visible = alive.filter(u => !(u.buffs || []).some(b => b && b.stealth && b.turns > 0));
    if (!visible.length) return null; // 모두 은신이면 공격 불가 (보스 광역기만 가능)
    // 강제 도발: 도발 버프가 있으면 도발 시전자를 우선 공격
    const tauntBuff = (attacker.buffs || []).find(b => b && b.forcedTaunt && b.turns > 0);
    if (tauntBuff) {
      const taunter = visible.find(u => u.uid === tauntBuff.source);
      if (taunter && !taunter.dead) return taunter;
    }
    const allowedRows = getAccessibleRows(attacker, skill, foes);
    if (explicitUid) {
      const explicit = visible.find(u => u.uid === explicitUid);
      if (explicit && allowedRows.includes(explicit.row)) return explicit;
    }
    const buckets = {};
    visible.forEach(u => { const r = u.row || 'front'; if (!buckets[r]) buckets[r] = []; buckets[r].push(u); });
    const rowBase = { front:70, mid:20, back:10 };
    const rowChoices = allowedRows.map(row => ({ value:row, weight:(buckets[row] || []).length ? rowBase[row] : 0 }));
    const pickedRow = weightedPick(rowChoices);
    const rowUnits = (buckets[pickedRow] || []);
    if (!rowUnits.length) return choosePriorityTarget(attacker, foes, skill);
    const unitChoices = rowUnits.map(u => {
      const baseThreat = Math.max(1, Number(u.threatBase || 1) + Number(u.threatBonus || 0));
      let threatMul = 1;
      if (u.traitBonuses && u.traitBonuses.threat_up) threatMul += Number(u.traitBonuses.threat_up) / 100;
      if (u.traitBonuses && u.traitBonuses.threat_down) threatMul -= Number(u.traitBonuses.threat_down) / 100;
      return { value:u, weight:Math.max(1, Math.round(baseThreat * Math.max(0.1, threatMul))) };
    });
    return weightedPick(unitChoices) || choosePriorityTarget(attacker, foes, skill);
  }
  function chooseHealTarget(allies) {
    const injured = getAlive(allies).filter(u => u.hp < u.maxHp);
    if (!injured.length) return null;
    return injured.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
  }
  function hasBuff(unit, skillId) {
    return (unit.buffs || []).some(b => b && b.sourceSkill === skillId && b.turns > 0);
  }
  function hasSummonBuff(unit, summonName) {
    return (unit.buffs || []).some(b => b && b.summon === summonName && b.turns > 0);
  }

  function addRoundHighlight(summary, text) {
    if (!text) return;
    if (!summary.highlights.includes(text) && summary.highlights.length < 8) summary.highlights.push(text);
  }
  function applyDamage(target, dmg) {
    let remaining = dmg;
    if (remaining > 0) {
      target.hp = Math.max(0, target.hp - remaining);
    }
    if (target.hp <= 0) target.dead = true;
  }

  // ── 내구도 소모 헬퍼 ──
  function applyDurabilityLoss(unit, slot, amount) {
    if (!unit || !unit.inventory || !unit.inventory.equipped) return;
    const eq = unit.inventory.equipped[slot];
    if (!eq || eq.durability == null) return;
    eq.durability = Math.max(0, Number(eq.durability) - amount);
  }
  function applyDurabilityOnAttack(runtime, actor, isSkill) {
    if (!actor || actor.isMonster) return;
    const baseId = actor.baseId || actor.id;
    const dbChar = (model.db.characters || []).find(c => c.id === baseId) || (model.db.personas || []).find(p => p.id === baseId);
    if (!dbChar) return;
    // 무기 내구도
    applyDurabilityLoss(dbChar, 'weapon', isSkill ? DURABILITY_COST.weaponSkillAttack : DURABILITY_COST.weaponBasicAttack);
    // 보조무기 (방패가 아닌 경우)
    const sub = dbChar.inventory && dbChar.inventory.equipped && dbChar.inventory.equipped.subweapon;
    if (sub && sub.subtype !== 'shield' && !(sub.name && sub.name.includes('방패'))) {
      applyDurabilityLoss(dbChar, 'subweapon', isSkill ? DURABILITY_COST.subweaponSkill : DURABILITY_COST.subweaponAttack);
    }
    // 악세서리 내구도
    applyDurabilityLoss(dbChar, 'accessory', DURABILITY_COST.accessoryAction);
  }
  function applyDurabilityOnHit(runtime, target) {
    if (!target || target.isMonster) return;
    const baseId = target.baseId || target.id;
    const dbChar = (model.db.characters || []).find(c => c.id === baseId) || (model.db.personas || []).find(p => p.id === baseId);
    if (!dbChar) return;
    // 방어구 내구도
    applyDurabilityLoss(dbChar, 'armor', DURABILITY_COST.armorHit);
    // 방패 (보조무기 중 shield) 내구도
    const sub = dbChar.inventory && dbChar.inventory.equipped && dbChar.inventory.equipped.subweapon;
    if (sub && (sub.subtype === 'shield' || (sub.name && sub.name.includes('방패')))) {
      applyDurabilityLoss(dbChar, 'subweapon', DURABILITY_COST.shieldHit);
    }
  }

  // ── 파티 SP 소모 헬퍼 ──
  function deductPartySp(run, amount) {
    if (!run || !run.partyState) return;
    run.partyState.forEach(u => {
      if (Number(u.currentHp || 0) > 0) {
        u.currentSp = Math.max(0, Number(u.currentSp || 0) - amount);
      }
    });
  }

  function applyHeal(target, heal) {
    // Bleed reduces healing received by 50%
    let effectiveHeal = heal;
    if (Number(target.statuses.bleedHealReduction || 0) > 0) {
      effectiveHeal = Math.max(1, Math.round(heal * 0.5));
    }
    // 장비 특성: 받는 치유량 증가
    const healRecvBonus = Number((target.traitBonuses && target.traitBonuses.healing_received) || 0) / 100;
    if (healRecvBonus > 0) {
      effectiveHeal = Math.max(1, Math.round(effectiveHeal * (1 + healRecvBonus)));
    }
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + effectiveHeal);
    return target.hp - before;
  }
  function applyBuff(targets, skill, sourceUnit) {
    const turns = Number(skill.duration || 0);
    if (turns <= 0 || !skill.buff) return [];
    const changed = [];
    targets.forEach(target => {
      // 도발 면역 체크: tauntResistTimer > 0이면 강제 도발 무효
      if (skill.buff.forcedTaunt && Number(target.statuses && target.statuses.tauntResistTimer || 0) > 0) {
        return; // 면역 — 스킵
      }
      target.buffs = target.buffs || [];
      const buffEntry = {
        sourceSkill:skill.id, name:skill.name, turns,
        stats:Object.assign({}, skill.buff.stats || {}),
        threatBonus:Number(skill.buff.threatBonus || 0),
        damageTakenMul:Number(skill.buff.damageTakenMul || 1),
        source:sourceUnit.uid
      };
      // 특수 버프 속성 복사
      if (skill.buff.ccImmunity) buffEntry.ccImmunity = true;
      if (skill.buff.forcedTaunt) buffEntry.forcedTaunt = true;
      if (skill.buff.evasionNext) buffEntry.evasionNext = Number(skill.buff.evasionNext);
      if (skill.buff.summon) buffEntry.summon = skill.buff.summon;
      if (skill.buff.immobile) buffEntry.immobile = true;
      if (skill.buff.parryStance) { buffEntry.parryStance = true; buffEntry.parryCoef = Number(skill.buff.parryCoef || 1); }
      if (skill.buff.onContactStun) buffEntry.onContactStun = Object.assign({}, skill.buff.onContactStun);
      if (skill.buff.stealth) buffEntry.stealth = true;
      target.buffs.push(buffEntry);
      if (skill.buff.threatBonus) target.threatBonus += Number(skill.buff.threatBonus || 0);
      changed.push(target.name);
    });
    return changed;
  }
  function removeExpiredBuffEffects(unit, expired) {
    expired.forEach(buff => {
      if (buff.threatBonus) unit.threatBonus = Math.max(0, unit.threatBonus - Number(buff.threatBonus || 0));
      // 도발 해제 시 3턴 면역 부여
      if (buff.forcedTaunt) {
        unit.statuses = unit.statuses || {};
        unit.statuses.tauntResistTimer = 3;
      }
    });
  }
  function applyCc(targets, skill, summary, sourceName, runtime) {
    if (!skill.cc) return;
    targets.forEach(target => {
      if (target.dead) return;
      // CC 면역 버프 확인
      if ((target.buffs || []).some(b => b && b.ccImmunity && b.turns > 0)) {
        addRoundHighlight(summary, `${target.name}은(는) CC 면역 상태`);
        pushBattleLog(runtime, `${target.name}은(는) CC 면역 상태`);
        return;
      }
      const type = normStatus(skill.cc.type);
      if (!type) return;
      // CC 확률 판정
      let ccChance = skill.cc.chance != null ? Number(skill.cc.chance) : 1.0;
      if (ccChance < 1.0 && Math.random() > ccChance) return;
      if (unitHasImmunity(target, type)) {
        addRoundHighlight(summary, `${target.name}은(는) ${type} 면역`);
        pushBattleLog(runtime, `${target.name}은(는) ${type} 면역`);
        return;
      }
      if (type === 'stun') {
        // Stun resistance: immune for 5 turns after being stunned
        if (Number(target.statuses.stunResistTimer || 0) > 0) {
          addRoundHighlight(summary, `${target.name} 기절 저항 (면역 상태)`);
          pushBattleLog(runtime, `${target.name} 기절 저항 활성 중`);
          return;
        }
        let turns = Number(skill.cc.turns || 1);
        const kind = String(target.kind || '').toLowerCase();
        if (kind === 'boss') turns = Math.min(turns, 1);
        else if (kind === 'elite') turns = Math.min(turns, 2);
        target.statuses.stun = Math.max(Number(target.statuses.stun || 0), turns);
        target.statuses.stunResistTimer = 5; // 5-turn immunity after stun
        addRoundHighlight(summary, `${sourceName}의 ${skill.name} → ${target.name} 기절`);
        pushBattleLog(runtime, `${sourceName} 사용: ${skill.name} → ${target.name} 기절`);
      } else if (type === 'sleep') {
        // Sleep resistance: immune for 5 turns after being slept
        if (Number(target.statuses.sleepResistTimer || 0) > 0) {
          addRoundHighlight(summary, `${target.name} 수면 저항 (면역 상태)`);
          pushBattleLog(runtime, `${target.name} 수면 저항 활성 중`);
          return;
        }
        let turns = Number(skill.cc.turns || 2);
        const kind = String(target.kind || '').toLowerCase();
        if (kind === 'boss' || kind === 'elite') turns = Math.min(turns, 2);
        target.statuses.sleep = Math.max(Number(target.statuses.sleep || 0), turns);
        target.statuses.sleepResistTimer = 5; // 5-turn immunity after sleep
        addRoundHighlight(summary, `${sourceName}의 ${skill.name} → ${target.name} 수면`);
        pushBattleLog(runtime, `${sourceName} 사용: ${skill.name} → ${target.name} 수면`);
      } else if (type === 'silence') {
        let turns = Number(skill.cc.turns || 3);
        const kind = String(target.kind || '').toLowerCase();
        if (kind === 'boss') turns = Math.min(turns, 1);
        else if (kind === 'elite') turns = Math.min(turns, 2);
        target.statuses.silence = Math.max(Number(target.statuses.silence || 0), turns);
        addRoundHighlight(summary, `${sourceName}의 ${skill.name} → ${target.name} 침묵`);
        pushBattleLog(runtime, `${sourceName} 사용: ${skill.name} → ${target.name} 침묵`);
      } else {
        target.statuses[type] = Math.max(Number(target.statuses[type] || 0), Number(skill.cc.turns || 1));
        addRoundHighlight(summary, `${sourceName}의 ${skill.name} → ${target.name} ${type}`);
        pushBattleLog(runtime, `${sourceName} 사용: ${skill.name} → ${target.name} ${type}`);
      }
    });
  }
  function applyStatus(target, skill, summary, sourceName, forcedStatus, runtime, sourceUnit, damageDealt) {
    const srcStatus = forcedStatus ? { type: forcedStatus } : (skill && skill.status);
    if (!srcStatus || !srcStatus.type || target.dead) return false;
    const type = normStatus(srcStatus.type);
    if (!type) return false;
    // CC 면역 버프 확인
    if ((target.buffs || []).some(b => b && b.ccImmunity && b.turns > 0)) {
      addRoundHighlight(summary, `${target.name}은(는) CC 면역 상태`);
      pushBattleLog(runtime, `${target.name}은(는) CC 면역 상태`);
      return false;
    }
    if (unitHasImmunity(target, type)) {
      addRoundHighlight(summary, `${target.name}은(는) ${type} 면역`);
      pushBattleLog(runtime, `${target.name}은(는) ${type} 면역`);
      return false;
    }
    const profile = getStatusDefaultProfile(type);
    let chance = srcStatus.chance == null ? profile.chance : Number(srcStatus.chance);
    // 장비 특성: 상태이상 부여 확률 증가 (공격자)
    if (sourceUnit && sourceUnit.traitBonuses) {
      chance += Number(sourceUnit.traitBonuses[`${type}_apply`] || 0) / 100;
    }
    // 장비 특성: 상태이상 저항 (대상)
    if (target.traitBonuses) {
      chance -= Number(target.traitBonuses[`${type}_resist`] || 0) / 100;
    }
    chance = Math.max(0, Math.min(1, chance));
    if (Math.random() > chance) return false;
    const turns = Number(srcStatus.turns || profile.turns);

    if (type === 'stun') {
      if (Number(target.statuses.stunResistTimer || 0) > 0) return false;
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss' || kind === 'elite') t = Math.min(t, 1);
      target.statuses.stun = Math.max(Number(target.statuses.stun || 0), t);
      target.statuses.stunResistTimer = 5;
    } else if (type === 'sleep') {
      if (Number(target.statuses.sleepResistTimer || 0) > 0) return false;
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss' || kind === 'elite') t = Math.min(t, 2);
      target.statuses.sleep = Math.max(Number(target.statuses.sleep || 0), t);
      target.statuses.sleepResistTimer = 5;
    } else if (type === 'bind') {
      if (Number(target.statuses.bindResistTimer || 0) > 0) return false;
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss') t = Math.min(t, 1);
      else if (kind === 'elite') t = Math.min(t, 2);
      target.statuses.bind = Math.max(Number(target.statuses.bind || 0), t);
      target.statuses.bindResistTimer = 5;
    } else if (type === 'curse') {
      if (Number(target.statuses.curseResistTimer || 0) > 0) return false;
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss') t = Math.min(t, 1);
      else if (kind === 'elite') t = Math.min(t, 2);
      target.statuses.curse = Math.max(Number(target.statuses.curse || 0), t);
      target.statuses.curseResistTimer = 5;
    } else if (type === 'poison') {
      // Stack-based: max 3 stacks, 3 turns
      const curStacks = Number(target.statuses.poisonStacks || 0);
      if (curStacks < 3) {
        target.statuses.poisonStacks = curStacks + 1;
      }
      target.statuses.poison = 3; // always reset to 3 turns
      // Calculate poison power per stack from source
      if (sourceUnit) {
        if (sourceUnit.isMonster) {
          // Monster poison: monsterDamage * 40%
          target.statuses.poisonPower = Number(sourceUnit.monsterBaseDamage || 0) * 0.4;
        } else {
          // Hunter poison: (2*MainStat + 3*ATK) * skillCoef * 0.2
          const mainStat = getStatPower(sourceUnit, skill);
          const coef = Number(skill && skill.coef != null ? skill.coef : 1.0);
          target.statuses.poisonPower = (2 * mainStat + 3 * Number(sourceUnit.atk || 0)) * coef * 0.2;
        }
      }
    } else if (type === 'bleed') {
      // Bleed: 출혈 발동 시 해당 공격 데미지의 30% 추가피해(1회) + 3턴 회복 -50%
      target.statuses.bleed = Math.max(Number(target.statuses.bleed || 0), 3);
      target.statuses.bleedHealReduction = 3; // 3 turns of 50% healing reduction
      // 출혈 발동 시 즉시 30% 추가피해 (1회성)
      if (damageDealt && damageDealt > 0 && !target.dead) {
        const bleedExtra = Math.max(1, Math.round(damageDealt * 0.3));
        applyDamage(target, bleedExtra);
        addRoundHighlight(summary, `${target.name} 출혈 추가피해 ${bleedExtra}`);
        pushBattleLog(runtime, `${target.name} 출혈 추가피해 ${bleedExtra}`);
      }
    } else if (type === 'burn') {
      // Stack-based: max 5 stacks, 5 turns
      const curStacks = Number(target.statuses.burnStacks || 0);
      if (curStacks < 5) {
        target.statuses.burnStacks = curStacks + 1;
      }
      target.statuses.burn = 5; // always reset to 5 turns
      // Calculate burn power per stack from source
      if (sourceUnit) {
        if (sourceUnit.isMonster) {
          // Monster burn: monsterDamage * 20%
          target.statuses.burnPower = Number(sourceUnit.monsterBaseDamage || 0) * 0.2;
        } else {
          // Hunter burn: (2*MainStat + 3*ATK) * skillCoef * 0.12
          const mainStat = getStatPower(sourceUnit, skill);
          const coef = Number(skill && skill.coef != null ? skill.coef : 1.0);
          target.statuses.burnPower = (2 * mainStat + 3 * Number(sourceUnit.atk || 0)) * coef * 0.12;
        }
      }
    } else if (type === 'silence') {
      // 침묵: 스킬 사용 불가
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss') t = Math.min(t, 1);
      else if (kind === 'elite') t = Math.min(t, 2);
      target.statuses.silence = Math.max(Number(target.statuses.silence || 0), t);
    } else if (type === 'slow') {
      // 둔화: 명중률 -30%, 회피율 -50%
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss') t = Math.min(t, 2);
      else if (kind === 'elite') t = Math.min(t, 3);
      target.statuses.slow = Math.max(Number(target.statuses.slow || 0), t);
    } else if (type === 'blind') {
      // 실명: 명중률 대폭 감소
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss') t = Math.min(t, 1);
      else if (kind === 'elite') t = Math.min(t, 2);
      target.statuses.blind = Math.max(Number(target.statuses.blind || 0), t);
    } else if (type === 'freeze') {
      // 빙결: 행동불가, 5턴 면역
      if (Number(target.statuses.freezeResistTimer || 0) > 0) return false;
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss' || kind === 'elite') t = Math.min(t, 1);
      target.statuses.freeze = Math.max(Number(target.statuses.freeze || 0), t);
      target.statuses.freezeResistTimer = 5;
    } else if (type === 'paralyze') {
      // 마비: 행동불가, 5턴 면역
      if (Number(target.statuses.paralyzeResistTimer || 0) > 0) return false;
      let t = turns;
      const kind = String(target.kind || '').toLowerCase();
      if (kind === 'boss' || kind === 'elite') t = Math.min(t, 1);
      target.statuses.paralyze = Math.max(Number(target.statuses.paralyze || 0), t);
      target.statuses.paralyzeResistTimer = 5;
    }
    addRoundHighlight(summary, `${sourceName}의 ${skill?.name || '공격'} → ${target.name} ${type}`);
    pushBattleLog(runtime, `${sourceName} 사용: ${skill?.name || '공격'} → ${target.name} ${type}`);
    return true;
  }

  // 열 전진 함수: 앞 열이 전멸하면 생존 유닛을 앞으로 끌어온다
  function shiftRowsForward(units, runtime, summary) {
    const alive = units.filter(u => !u.dead);
    if (!alive.length) return;
    const ROW_ORDER = ['front', 'mid', 'back'];
    const hasAlive = r => alive.some(u => u.row === r);
    // 전열 전멸 → 중열을 전열로, 후열을 중열로
    if (!hasAlive('front') && (hasAlive('mid') || hasAlive('back'))) {
      alive.forEach(u => {
        if (u.row === 'mid') { u.row = 'front'; pushBattleLog(runtime, `${u.name} 전열로 전진`); }
      });
      alive.forEach(u => {
        if (u.row === 'back' && !hasAlive('mid')) { u.row = 'mid'; pushBattleLog(runtime, `${u.name} 중열로 전진`); }
      });
      // 중열도 비었으면 후열→전열
      if (!hasAlive('front')) {
        alive.forEach(u => {
          if (u.row === 'mid') { u.row = 'front'; pushBattleLog(runtime, `${u.name} 전열로 전진`); }
        });
      }
    }
    // 중열 전멸 (전열은 있으나 중열 없음) → 후열을 중열로
    if (hasAlive('front') && !hasAlive('mid') && hasAlive('back')) {
      alive.forEach(u => {
        if (u.row === 'back') { u.row = 'mid'; pushBattleLog(runtime, `${u.name} 중열로 전진`); }
      });
    }
  }

  // 열 기반 폴백: 대상 열이 비면 가장 앞 열의 생존자를 반환
  function getRowFallback(alive) {
    const ROW_ORDER = ['front', 'mid', 'back'];
    for (const r of ROW_ORDER) {
      const inRow = alive.filter(u => u.row === r);
      if (inRow.length) return inRow;
    }
    return alive; // 최종 폴백
  }

  function getTargetListForAction(runtime, actor, action, skill) {
    const allies = actor.side === 'party' ? runtime.party : runtime.enemies;
    const foes = actor.side === 'party' ? runtime.enemies : runtime.party;
    if (!skill) return [];
    // 은신 필터: 은신 유닛은 공격 대상에서 제외 (보스 포함 모든 적에게 적용)
    const filterStealth = (list) => {
      const visible = list.filter(u => !(u.buffs || []).some(b => b && b.stealth && b.turns > 0));
      return visible.length ? visible : []; // 모두 은신이면 빈 배열 (미스)
    };
    if (skill.target === 'allEnemies') return filterStealth(getAlive(foes));
    if (skill.target === 'allAllies') return getAlive(allies);
    if (skill.target === 'self') return [actor];
    if (skill.target === 'singleAlly') return [findUnitByUid(runtime, action.target) || chooseHealTarget(allies) || actor].filter(Boolean);
    if (skill.target === 'singleEnemy') return [chooseWeightedTarget(actor, foes, skill, action.target)].filter(Boolean);
    // 열 기반 광역 타겟 (row-based AoE) — 대상 열이 비면 가장 앞 열 폴백
    if (skill.target === 'rowFront') { const t = getAlive(foes).filter(u => u.row === 'front'); return filterStealth(t.length ? t : getRowFallback(getAlive(foes))); }
    if (skill.target === 'rowMid') { const t = getAlive(foes).filter(u => u.row === 'mid'); return filterStealth(t.length ? t : getRowFallback(getAlive(foes))); }
    if (skill.target === 'rowBack') { const t = getAlive(foes).filter(u => u.row === 'back'); return filterStealth(t.length ? t : getRowFallback(getAlive(foes))); }
    // 2열 공격 타겟 (dual-row) — 비면 가장 앞 열 폴백
    if (skill.target === 'rowFrontMid') { const t = getAlive(foes).filter(u => u.row === 'front' || u.row === 'mid'); return filterStealth(t.length ? t : getRowFallback(getAlive(foes))); }
    if (skill.target === 'rowMidBack') { const t = getAlive(foes).filter(u => u.row === 'mid' || u.row === 'back'); return filterStealth(t.length ? t : getRowFallback(getAlive(foes))); }
    return [];
  }

  function resolvePartyAction(runtime, actor, allies, foes) {
    const cmd = (runtime.pendingActions && runtime.pendingActions[actor.uid]) || null;
    if (!cmd || cmd.mode === 'auto') return chooseEnemyAction(actor, allies, foes, true);
    if (cmd.mode === 'basic') return { type:'basic', target:cmd.target || null };
    if (cmd.mode === 'skill') return { type:'skill', skillId:cmd.skillId || '', target:cmd.target || null };
    if (cmd.mode === 'defend') return { type:'defend' };
    if (cmd.mode === 'wait') return { type:'wait' };
    return chooseEnemyAction(actor, allies, foes, true);
  }

  function chooseEnemyAction(unit, allies, foes, isPartyAuto) {
    const aliveAllies = getAlive(allies);
    const aliveFoes = getAlive(foes);
    const skillPool = listKnownSkillDefs(unit).filter(sk => sk.category !== 'passive' && canUseSkill(unit, sk));
    const lowAlly = chooseHealTarget(allies);
    const injuredCount = aliveAllies.filter(u => u.hp < u.maxHp).length;
    const enemyBoss = aliveFoes.find(u => String(u.kind || '').toLowerCase() === 'boss');
    const enemyElite = aliveFoes.find(u => String(u.kind || '').toLowerCase() === 'elite');
    const pos = unit.position || '';

    if ((pos.includes('힐러') || pos.includes('서포터') || unit.job.includes('클레릭')) && lowAlly) {
      const aoeHeal = skillPool.find(sk => sk.category === 'aoeHeal');
      if (aoeHeal && injuredCount >= 3) return { type:'skill', skillId:aoeHeal.id, target:'allAllies' };
      const bestHeal = skillPool.filter(sk => sk.category === 'singleHeal').sort((a,b)=>(b.coef||0)-(a.coef||0))[0];
      if (bestHeal && lowAlly.hp / lowAlly.maxHp <= 0.75) return { type:'skill', skillId:bestHeal.id, target:lowAlly.uid };
    }
    const tauntSkill = skillPool.find(sk => sk.id === 'taunt');
    if (tauntSkill && (pos.includes('탱커') || unit.job.includes('크루세이더')) && !hasBuff(unit, 'taunt') && Math.random() < 0.65) return { type:'skill', skillId:'taunt', target:unit.uid };

    // CC 면역 버프 (방어선 유지)
    const ccImmunitySkill = skillPool.find(sk => sk.buff && sk.buff.ccImmunity && !hasBuff(unit, sk.id));
    if (ccImmunitySkill && pos.includes('탱커') && unit.hp / unit.maxHp <= 0.7) {
      return { type:'skill', skillId:ccImmunitySkill.id, target:unit.uid };
    }
    // 강제 도발 (신성한 도발)
    const tauntEnemy = skillPool.find(sk => sk.buff && sk.buff.forcedTaunt);
    if (tauntEnemy && (enemyBoss || enemyElite)) {
      const target = enemyBoss || enemyElite;
      if (!target.dead) return { type:'skill', skillId:tauntEnemy.id, target:target.uid };
    }
    const buffSkill = skillPool.find(sk => sk.category === 'buff' && sk.id !== 'taunt' && !hasBuff(unit, sk.id) && !(sk.buff && sk.buff.forcedTaunt));
    if (buffSkill && (pos.includes('서포터') || pos.includes('원거리') || pos.includes('힐러') || Math.random() < 0.2)) {
      return { type:'skill', skillId:buffSkill.id, target:buffSkill.target === 'allAllies' ? 'allAllies' : unit.uid };
    }
    const singleCC = skillPool.find(sk => sk.category === 'singleCC');
    if (singleCC && (enemyBoss || enemyElite)) {
      const target = enemyBoss || enemyElite;
      if (!target.dead && Number(target.statuses.stun || 0) <= 0) return { type:'skill', skillId:singleCC.id, target:target.uid };
    }
    const aoeCC = skillPool.find(sk => sk.category === 'aoeCC');
    if (aoeCC && aliveFoes.length >= 4 && Math.random() < 0.5) return { type:'skill', skillId:aoeCC.id, target:'allEnemies' };
    const aoeAtk = skillPool.filter(sk => sk.category === 'aoeAttack').sort((a,b)=>(b.coef||0)-(a.coef||0))[0];
    if (aoeAtk && aliveFoes.length >= 3 && !pos.includes('힐러')) return { type:'skill', skillId:aoeAtk.id, target:'allEnemies' };
    // 유틸리티: 자원 회복 또는 자기 버프 유틸리티
    const utilityRestore = skillPool.find(sk => sk.category === 'utility' && sk.resourceRestore);
    if (utilityRestore && unit.sp <= unit.maxSp * 0.3) return { type:'skill', skillId:utilityRestore.id, target:utilityRestore.target === 'self' ? unit.uid : (choosePriorityTarget(unit, foes, utilityRestore) || {}).uid };
    const utilityBuff = skillPool.find(sk => sk.category === 'utility' && sk.buff && !hasBuff(unit, sk.id));
    if (utilityBuff && unit.hp / unit.maxHp <= 0.5 && Math.random() < 0.6) return { type:'skill', skillId:utilityBuff.id, target:unit.uid };
    const singleAtk = skillPool.filter(sk => sk.category === 'singleAttack').sort((a,b)=>(b.coef||0)-(a.coef||0))[0];
    // 몬스터: 기본공격 쿨타임 중이면 스킬 사용, 스킬 쿨타임 중이면 기본공격
    const basicOnCooldown = unit.isMonster && Number(unit.cooldowns && unit.cooldowns['basicAttack'] || 0) > 0;
    if (basicOnCooldown && singleAtk) return { type:'skill', skillId:singleAtk.id, target:(choosePriorityTarget(unit, foes, singleAtk) || {}).uid };
    if (!basicOnCooldown && unit.isMonster) return { type:'basic', target:(choosePriorityTarget(unit, foes, null) || {}).uid };
    if (singleAtk) return { type:'skill', skillId:singleAtk.id, target:(choosePriorityTarget(unit, foes, singleAtk) || {}).uid };
    return { type:'basic', target:(choosePriorityTarget(unit, foes, null) || {}).uid };
  }

  function resolveSkillOrBasic(runtime, actor, action, summary) {
    if (!actor || actor.dead) return;
    const allies = actor.side === 'party' ? runtime.party : runtime.enemies;
    const foes = actor.side === 'party' ? runtime.enemies : runtime.party;
    if (!getAlive(allies).length || !getAlive(foes).length) return;

    // 은신 해제: 공격 행동 시 은신 버프 즉시 제거 (대기/방어 제외)
    if (action.type !== 'wait' && action.type !== 'defend') {
      const stealthIdx = (actor.buffs || []).findIndex(b => b && b.stealth && b.turns > 0);
      if (stealthIdx >= 0) {
        actor.buffs.splice(stealthIdx, 1);
        pushBattleLog(runtime, `${actor.name}의 은신이 해제되었다!`);
      }
    }

    if (action.type === 'wait') {
      actor.lastAction = '대기';
      addRoundHighlight(summary, `${actor.name} 대기`);
      pushBattleLog(runtime, `${actor.name} 대기`);
      return;
    }

    if (action.type === 'defend') {
      actor.buffs = actor.buffs || [];
      actor.buffs.push({ sourceSkill:'defend', name:'방어', turns:1, stats:{}, threatBonus:1, damageTakenMul:0.65, source:actor.uid });
      actor.threatBonus += 1;
      actor.lastAction = '방어';
      addRoundHighlight(summary, `${actor.name} 방어 태세`);
      pushBattleLog(runtime, `${actor.name} 방어 태세`);
      return;
    }

    if (action.type === 'basic') {
      const skill = { id:'basicAttack', name:'기본 공격', category:'singleAttack', target:'singleEnemy', coef:1.0, statTypes:[actor.attackStat || 'str'], damageType:actor.damageType || 'physical', element:'none', costs:{ mp:0, sp:0 } };
      const target = chooseWeightedTarget(actor, foes, skill, action.target);
      if (!target) return;
      const hit = performHit(actor, target, skill);
      if (!hit.hit) {
        actor.lastAction = `기본 공격 → ${target.name} 빗나감`;
        addRoundHighlight(summary, `${actor.name}의 공격이 빗나갔다`);
        pushBattleLog(runtime, `${actor.name}의 기본 공격이 ${target.name}에게 빗나감`);
        // 몬스터 기본공격 쿨타임 1턴
        if (actor.isMonster) actor.cooldowns['basicAttack'] = 1;
        return;
      }
      const dmg = computeDamage(actor, target, skill, hit.crit);
      const hpBefore = Number(target.hp || 0);
      applyDamage(target, dmg);
      applyDurabilityOnAttack(runtime, actor, false);
      applyDurabilityOnHit(runtime, target);
      if (actor.side === 'party') { actor.sp = Math.max(0, (actor.sp || 0) - 1); }
      if (Number(target.statuses.sleep || 0) > 0) target.statuses.sleep = 0;
      if (actor.onHitStatus) applyStatus(target, { name:'기본 공격', status:{ type:actor.onHitStatus, chance:actor.onHitChance, turns:actor.onHitTurns } }, summary, actor.name, null, runtime, actor, dmg);
      actor.lastAction = `기본 공격 → ${target.name} ${dmg}`;
      if (actor.side === 'party') summary.partyDamage += dmg; else summary.enemyDamage += dmg;
      if (target.dead) {
        if (actor.side === 'party') { summary.partyKills += 1; recordKillExp(runtime, target); } else summary.enemyKills += 1;
        addRoundHighlight(summary, `${actor.name}이(가) ${target.name} 처치`);
      }
      if (hit.crit) addRoundHighlight(summary, `${actor.name} 치명타`);
      pushDamageEventLog(runtime, actor, target, '기본 공격', dmg, hit.crit, target.dead);
      pushHpShiftLog(runtime, target, hpBefore);
      // 몬스터 기본공격 쿨타임 1턴
      if (actor.isMonster) actor.cooldowns['basicAttack'] = 1;
      return;
    }

    const skill = resolveSkillForUnit(actor, action.skillId);
    if (!skill || !canUseSkill(actor, skill)) return resolveSkillOrBasic(runtime, actor, { type:'basic', target:action.target || null }, summary);
    const cost = paySkillCost(actor, skill);
    actor.lastAction = skill.name;
    // 스킬 사용 시 무기/보조무기/악세서리 내구도 소모
    applyDurabilityOnAttack(runtime, actor, true);

    if (skill.category === 'buff') {
      const targets = getTargetListForAction(runtime, actor, action, skill);
      const names = applyBuff(targets, skill, actor);
      addRoundHighlight(summary, `${actor.name}의 ${skill.name}${names.length ? ' (' + names.join(', ') + ')' : ''}`);
      pushBattleLog(runtime, `${actor.name} 사용: ${skill.name}${names.length ? ' → ' + names.join(', ') : ''}`);
      actor.lastAction = `${skill.name} (MP-${cost.mp} / SP-${cost.sp})`;
      return;
    }

    if (skill.category === 'singleHeal') {
      const targets = getTargetListForAction(runtime, actor, action, skill);
      const target = targets[0];
      if (!target) return;
      const heal = computeHeal(actor, skill);
      const hpBefore = Number(target.hp || 0);
      const actual = applyHeal(target, heal);
      if (actor.side === 'party') summary.partyHealing += actual; else summary.enemyHealing += actual;
      addRoundHighlight(summary, `${actor.name}의 ${skill.name} → ${target.name} 회복 ${actual}`);
      pushHealEventLog(runtime, actor, target, skill.name, actual, hpBefore);
      actor.lastAction = `${skill.name} (MP-${cost.mp} / SP-${cost.sp})`;
      return;
    }

    if (skill.category === 'aoeHeal') {
      const targets = getTargetListForAction(runtime, actor, action, skill).filter(u => u.hp < u.maxHp);
      if (!targets.length) return;
      const healPerTarget = computeHeal(actor, skill);
      let actualSum = 0;
      targets.forEach(t => { const before = Number(t.hp || 0); const actual = applyHeal(t, healPerTarget); actualSum += actual; pushHealEventLog(runtime, actor, t, skill.name, actual, before); });
      if (actor.side === 'party') summary.partyHealing += actualSum; else summary.enemyHealing += actualSum;
      addRoundHighlight(summary, `${actor.name}의 ${skill.name} → ${targets.length}명 총 회복 ${actualSum}`);
      pushBattleLog(runtime, `${actor.name}의 ${skill.name} 총 회복 ${actualSum} (${targets.length}명)`);
      actor.lastAction = `${skill.name} (MP-${cost.mp} / SP-${cost.sp})`;
      return;
    }

    if (skill.category === 'utility') {
      const targets = getTargetListForAction(runtime, actor, action, skill);
      const procOk = skill.procChance == null || Math.random() < skill.procChance;
      if (procOk && skill.coef && targets[0] && skill.target !== 'self') {
        const target = targets[0];
        const hit = performHit(actor, target, skill);
        if (hit.hit) {
          const dmg = computeDamage(actor, target, skill, hit.crit);
          const hpBefore = Number(target.hp || 0);
          applyDamage(target, dmg);
          if (Number(target.statuses.sleep || 0) > 0) target.statuses.sleep = 0;
          if (actor.onHitStatus) applyStatus(target, { name:skill.name, status:{ type:actor.onHitStatus, chance:actor.onHitChance, turns:actor.onHitTurns } }, summary, actor.name, null, runtime, actor, dmg);
          if (actor.side === 'party') summary.partyDamage += dmg; else summary.enemyDamage += dmg;
          if (target.dead) {
            if (actor.side === 'party') { summary.partyKills += 1; recordKillExp(runtime, target); } else summary.enemyKills += 1;
            addRoundHighlight(summary, `${actor.name}이(가) ${target.name} 처치`);
          }
          pushDamageEventLog(runtime, actor, target, skill.name, dmg, hit.crit, target.dead);
          pushHpShiftLog(runtime, target, hpBefore);
        }
      }
      if (skill.resourceRestore) {
        actor.mp = Math.min(actor.maxMp, actor.mp + Number(skill.resourceRestore.mp || 0));
        actor.sp = Math.min(actor.maxSp, actor.sp + Number(skill.resourceRestore.sp || 0));
      }
      // 유틸리티 스킬의 버프 속성 적용 (긴급회피, 받아치기 등)
      if (skill.buff && skill.duration) {
        applyBuff([actor], skill, actor);
      } else if (skill.buff && !skill.duration) {
        // duration 없는 버프: 1턴 임시 적용
        const tempSkill = Object.assign({}, skill, { duration:1 });
        applyBuff([actor], tempSkill, actor);
      }
      addRoundHighlight(summary, `${actor.name}의 ${skill.name}`);
      pushBattleLog(runtime, `${actor.name} 사용: ${skill.name}`);
      actor.lastAction = `${skill.name} (MP-${cost.mp} / SP-${cost.sp})`;
      return;
    }

    const targets = getTargetListForAction(runtime, actor, action, skill);
    let hitCount = 0, totalDamage = 0;
    const killedNames = [];
    const ccTargets = [];
    targets.forEach(target => {
      const hit = performHit(actor, target, skill);
      if (!hit.hit) {
        // 받아치기: 회피 성공 시 반격
        const parryBuff = (target.buffs || []).find(b => b && b.parryStance && b.turns > 0);
        if (parryBuff && !actor.dead) {
          parryBuff.turns = 0; // 1회 소모
          const parrySkill = { id:'parryCounter', name:'받아치기 반격', coef:Number(parryBuff.parryCoef || 1), statTypes:[target.attackStat || 'agi'], damageType:target.damageType || 'physical', element:'none' };
          const parryDmg = computeDamage(target, actor, parrySkill, false);
          applyDamage(actor, parryDmg);
          totalDamage -= parryDmg; // 반격 피해는 별도 기록
          addRoundHighlight(summary, `${target.name} 받아치기 반격 → ${actor.name} ${parryDmg}`);
          pushBattleLog(runtime, `${target.name} 받아치기 반격 → ${actor.name} ${parryDmg}`);
        }
        return;
      }
      hitCount += 1;
      const dmg = computeDamage(actor, target, skill, hit.crit);
      totalDamage += dmg;
      const hpBefore = Number(target.hp || 0);
      applyDamage(target, dmg);
      applyDurabilityOnHit(runtime, target);
      if (Number(target.statuses.sleep || 0) > 0) target.statuses.sleep = 0;
      if (skill.cc) ccTargets.push(target);
      applyStatus(target, skill, summary, actor.name, null, runtime, actor, dmg);
      if (actor.onHitStatus) applyStatus(target, { name:skill.name, status:{ type:actor.onHitStatus, chance:actor.onHitChance, turns:actor.onHitTurns } }, summary, actor.name, null, runtime, actor, dmg);
      // 접촉 기절: 근접 공격 시 대상의 벽력장 버프로 공격자 기절
      if (!actor.dead && (skill.damageType === 'physical' || !skill.damageType)) {
        const contactBuff = (target.buffs || []).find(b => b && b.onContactStun && b.turns > 0);
        if (contactBuff) {
          const stunChance = Number(contactBuff.onContactStun.chance || 0.25);
          const stunTurns = Number(contactBuff.onContactStun.turns || 1);
          if (Math.random() < stunChance && Number(actor.statuses.stun || 0) <= 0) {
            actor.statuses.stun = stunTurns;
            addRoundHighlight(summary, `${target.name} 벽력장 → ${actor.name} 접촉 기절`);
            pushBattleLog(runtime, `${target.name}의 벽력장으로 ${actor.name} 기절 ${stunTurns}턴`);
          }
        }
      }
      if (target.dead) { killedNames.push(target.name); if (actor.side === 'party') recordKillExp(runtime, target); }
      if (hit.crit) addRoundHighlight(summary, `${actor.name} 치명타`);
      // 흡혈 (피식자의 단검 등): 피해량의 일정% HP 회복
      let lifestealPct = Number((skill.passiveMods && skill.passiveMods.lifesteal) || 0);
      // 흡혈 본능: MP 10% 이하 시 다음 공격이 대상 HP 5% 흡수
      const vampiricDrain = Number((actor.passiveMods && actor.passiveMods.vampiricDrain) || 0);
      if (vampiricDrain > 0 && actor.mp <= actor.maxMp * 0.1) {
        lifestealPct = Math.max(lifestealPct, vampiricDrain);
      }
      if (lifestealPct > 0 && dmg > 0 && !actor.dead) {
        const stolen = Math.max(1, Math.round(dmg * lifestealPct));
        applyHeal(actor, stolen);
        // 흡혈 본능 발동 시 INT -3 3턴 디버프
        if (vampiricDrain > 0 && actor.mp <= actor.maxMp * 0.1) {
          actor.buffs = actor.buffs || [];
          actor.buffs.push({ sourceSkill:'vampiricInstinct', name:'흡혈 후유증', turns:3, stats:{ int:-3 }, threatBonus:0, damageTakenMul:1, source:actor.uid });
        }
      }
      pushDamageEventLog(runtime, actor, target, skill.name, dmg, hit.crit, target.dead);
      pushHpShiftLog(runtime, target, hpBefore);
    });
    if (actor.side === 'party') summary.partyDamage += totalDamage; else summary.enemyDamage += totalDamage;
    if (actor.side === 'party') summary.partyKills += killedNames.length; else summary.enemyKills += killedNames.length;
    if (!hitCount) {
      addRoundHighlight(summary, `${actor.name}의 ${skill.name} 빗나감`);
      actor.lastAction = `${skill.name} 빗나감`;
      pushBattleLog(runtime, `${actor.name}의 ${skill.name}이(가) 빗나감`);
      return;
    }
    applyCc(ccTargets, skill, summary, actor.name, runtime);
    // CC/공격 스킬에 버프 속성이 있으면 적용 (시간 감속 등: 적에게 CC + 아군에게 버프)
    if (skill.buff && skill.duration) {
      if (skill.buff.stats) {
        // 음수 스탯은 적에게, 양수 스탯은 아군에게 적용
        const hasNeg = Object.values(skill.buff.stats).some(v => v < 0);
        const hasPos = Object.values(skill.buff.stats).some(v => v > 0);
        if (hasNeg) {
          const debuffSkill = Object.assign({}, skill, { buff:{ stats:Object.fromEntries(Object.entries(skill.buff.stats).filter(([,v]) => v < 0)) } });
          applyBuff(getAlive(foes), debuffSkill, actor);
        }
        if (hasPos) {
          const buffOnlySkill = Object.assign({}, skill, { buff:{ stats:Object.fromEntries(Object.entries(skill.buff.stats).filter(([,v]) => v > 0)) } });
          applyBuff(getAlive(allies), buffOnlySkill, actor);
        }
        if (!hasNeg && !hasPos) {
          applyBuff(getAlive(foes), skill, actor);
        }
      } else {
        applyBuff(targets, skill, actor);
      }
    }
    if (killedNames.length) addRoundHighlight(summary, `${actor.name}의 ${skill.name} → ${killedNames.join(', ')} 처치`);
    else addRoundHighlight(summary, `${actor.name}의 ${skill.name} → 피해 ${totalDamage}`);
    pushBattleLog(runtime, `${actor.name}의 ${skill.name} 총 피해 ${totalDamage}${killedNames.length ? ' / 처치: ' + killedNames.join(', ') : ''}`);
    actor.lastAction = `${skill.name} (MP-${cost.mp} / SP-${cost.sp})`;
  }

  function endRoundMaintenance(runtime, units, summary) {
    units.forEach(unit => {
      if (unit.dead) return;
      const expired = [];
      unit.buffs = (unit.buffs || []).map(buff => Object.assign({}, buff, { turns:Number(buff.turns || 0) - 1 })).filter(buff => {
        const alive = buff.turns > 0;
        if (!alive) expired.push(buff);
        return alive;
      });
      removeExpiredBuffEffects(unit, expired);

      // 독: 방어무시 절대데미지, 스택당 poisonPower 피해
      if (Number(unit.statuses.poison || 0) > 0) {
        const stacks = Math.min(3, Number(unit.statuses.poisonStacks || 1));
        const perStack = Math.max(1, Math.round(Number(unit.statuses.poisonPower || 0)));
        const dmg = perStack * stacks;
        if (dmg > 0) {
          applyDamage(unit, dmg);
          addRoundHighlight(summary, `${unit.name} 독 피해 ${dmg} (${stacks}중첩)`);
          pushBattleLog(runtime, `${unit.name} 독 피해 ${dmg} (${stacks}중첩)`);
        }
      }
      // 출혈: 발동 시 1회 30% 추가피해 (applyStatus에서 처리됨, 턴종료 DoT 아님)
      // 화상: 방어무시 절대데미지, 스택당 burnPower 피해
      if (!unit.dead && Number(unit.statuses.burn || 0) > 0) {
        const stacks = Math.min(5, Number(unit.statuses.burnStacks || 1));
        const perStack = Math.max(1, Math.round(Number(unit.statuses.burnPower || 0)));
        const dmg = perStack * stacks;
        if (dmg > 0) {
          applyDamage(unit, dmg);
          addRoundHighlight(summary, `${unit.name} 화상 피해 ${dmg} (${stacks}중첩)`);
          pushBattleLog(runtime, `${unit.name} 화상 피해 ${dmg} (${stacks}중첩)`);
        }
      }
      if (!unit.dead && Number(unit.regenPct || 0) > 0) {
        const blocked = (unit.regenBlockedBy || []).some(key => Number(unit.statuses[key] || 0) > 0);
        if (!blocked) {
          const heal = Math.max(1, Math.round(unit.maxHp * Number(unit.regenPct || 0)));
          const actual = applyHeal(unit, heal);
          if (actual > 0) { addRoundHighlight(summary, `${unit.name} 재생 ${actual}`); pushBattleLog(runtime, `${unit.name} 재생 ${actual}`); }
        }
      }
      // 패시브: SP 자연회복 (스태미나 회복)
      if (!unit.dead && !unit.isMonster && unit.passiveMods && Number(unit.passiveMods.spRegenPct || 0) > 0) {
        const spRegen = Math.max(1, Math.round(unit.maxSp * unit.passiveMods.spRegenPct));
        unit.sp = Math.min(unit.maxSp, unit.sp + spRegen);
      }

      // 상태이상 턴 감소
      ['stun','bind','sleep','poison','bleed','burn','curse','silence','slow','blind','freeze','paralyze'].forEach(key => {
        unit.statuses[key] = Math.max(0, Number(unit.statuses[key] || 0) - 1);
      });
      // 독/화상: 턴이 0이 되면 스택 초기화
      if (Number(unit.statuses.poison || 0) <= 0) unit.statuses.poisonStacks = 0;
      if (Number(unit.statuses.burn || 0) <= 0) unit.statuses.burnStacks = 0;
      // 출혈 치유량 감소 타이머
      if (Number(unit.statuses.bleedHealReduction || 0) > 0) {
        unit.statuses.bleedHealReduction = Math.max(0, unit.statuses.bleedHealReduction - 1);
      }
      // 기절/수면/빙결/마비/속박/저주/도발 저항 타이머 감소
      if (Number(unit.statuses.stunResistTimer || 0) > 0) {
        unit.statuses.stunResistTimer = Math.max(0, unit.statuses.stunResistTimer - 1);
      }
      if (Number(unit.statuses.sleepResistTimer || 0) > 0) {
        unit.statuses.sleepResistTimer = Math.max(0, unit.statuses.sleepResistTimer - 1);
      }
      if (Number(unit.statuses.freezeResistTimer || 0) > 0) {
        unit.statuses.freezeResistTimer = Math.max(0, unit.statuses.freezeResistTimer - 1);
      }
      if (Number(unit.statuses.paralyzeResistTimer || 0) > 0) {
        unit.statuses.paralyzeResistTimer = Math.max(0, unit.statuses.paralyzeResistTimer - 1);
      }
      if (Number(unit.statuses.bindResistTimer || 0) > 0) {
        unit.statuses.bindResistTimer = Math.max(0, unit.statuses.bindResistTimer - 1);
      }
      if (Number(unit.statuses.curseResistTimer || 0) > 0) {
        unit.statuses.curseResistTimer = Math.max(0, unit.statuses.curseResistTimer - 1);
      }
      if (Number(unit.statuses.tauntResistTimer || 0) > 0) {
        unit.statuses.tauntResistTimer = Math.max(0, unit.statuses.tauntResistTimer - 1);
      }
      Object.keys(unit.cooldowns || {}).forEach(key => {
        unit.cooldowns[key] = Math.max(0, Number(unit.cooldowns[key] || 0) - 1);
      });
      if (unit.dead) { addRoundHighlight(summary, `${unit.name} 쓰러짐`); pushBattleLog(runtime, `${unit.name} 쓰러짐`); if (unit.isMonster) recordKillExp(runtime, unit); }
    });
    // 열 전진: 앞 열이 전멸하면 생존자를 앞으로 끌어오기
    shiftRowsForward(runtime.enemies, runtime, summary);
    shiftRowsForward(runtime.party, runtime, summary);
    // 지형 전환 턴 감소
    if (runtime.terrain && runtime.terrain.turnsLeft > 0) {
      runtime.terrain.turnsLeft -= 1;
      if (runtime.terrain.turnsLeft <= 0) {
        pushBattleLog(runtime, '지형 전환 효과 종료');
        runtime.terrain = null;
      }
    }
  }

  function buildRoundQueue(runtime) {
    const alive = getAlive(runtime.party).concat(getAlive(runtime.enemies));
    return alive.map(unit => ({
      uid: unit.uid,
      init: (getBuffedStat(unit, 'agi') * 2) + getBuffedStat(unit, 'sense') + randInt(1, 10)
    })).sort((a,b)=>b.init-a.init).map(r=>r.uid);
  }
  function buildRoundSummaryText(summary, runtime) {
    const partyAlive = getAlive(runtime.party).length;
    const enemyAlive = getAlive(runtime.enemies).length;
    const head = `${summary.round}라운드 — 아군 피해 ${summary.enemyDamage}, 적 피해 ${summary.partyDamage}, 아군 처치 ${summary.partyKills}, 적 처치 ${summary.enemyKills}.`;
    const healPart = (summary.partyHealing || summary.enemyHealing) ? ` 회복: 아군 ${summary.partyHealing}, 적 ${summary.enemyHealing}.` : '';
    const tail = summary.highlights.length ? ` 핵심: ${summary.highlights.slice(0, 5).join(' / ')}.` : '';
    return `${head}${healPart} 생존: 아군 ${partyAlive}, 적 ${enemyAlive}.${tail}`;
  }
  function checkBattleEnd(runtime) {
    const partyAlive = getAlive(runtime.party).length;
    const enemyAlive = getAlive(runtime.enemies).length;
    if (partyAlive <= 0 && enemyAlive <= 0) { runtime.finished = true; runtime.outcome = 'Draw'; return true; }
    if (partyAlive <= 0) { runtime.finished = true; runtime.outcome = 'Defeat'; return true; }
    if (enemyAlive <= 0) { runtime.finished = true; runtime.outcome = 'Victory'; return true; }
    return false;
  }
  function buildLlmBlock() {
    const runtime = model.state.runtime;
    const partyAlive = getAlive(runtime.party);
    const enemyAlive = getAlive(runtime.enemies);
    const partyHpNow = runtime.party.reduce((s,u)=>s+Math.max(0,u.hp),0);
    const partyHpMax = runtime.party.reduce((s,u)=>s+Number(u.maxHp||0),0);
    const enemyHpNow = runtime.enemies.reduce((s,u)=>s+Math.max(0,u.hp),0);
    const enemyHpMax = runtime.enemies.reduce((s,u)=>s+Number(u.maxHp||0),0);
    const lines = [];
    lines.push('[Battle Result]');
    lines.push(`Outcome: ${runtime.outcome || 'In Progress'}`);
    lines.push(`Rounds: ${runtime.round}`);
    lines.push(`Party Survivors: ${partyAlive.length}/${runtime.party.length}`);
    lines.push(`Enemy Survivors: ${enemyAlive.length}/${runtime.enemies.length}`);
    lines.push(`Party HP Sum: ${partyHpNow}/${partyHpMax}`);
    lines.push(`Enemy HP Sum: ${enemyHpNow}/${enemyHpMax}`);
    lines.push('');
    lines.push('[Round Summaries]');
    runtime.roundSummaries.forEach(row => lines.push(`- ${row.text}`));
    lines.push('');
    lines.push('[Current State]');
    partyAlive.forEach(u => {
      const buffs = (u.buffs || []).map(b => `${b.name}(${b.turns})`).join(', ');
      const states = [];
      ['stun','bind','sleep','poison','bleed','burn','curse','silence','slow'].forEach(k => { if (u.statuses[k] > 0) states.push(`${k}:${u.statuses[k]}`); });
      if (buffs) states.push(`buff:${buffs}`);
      lines.push(`- ${u.name} [${rowLabel(u.row)}]: HP ${u.hp}/${u.maxHp}, MP ${u.mp}/${u.maxMp}, SP ${u.sp}/${u.maxSp}${states.length ? ' ['+states.join(' | ')+']' : ''}`);
    });
    if (enemyAlive.length) {
      lines.push('');
      lines.push('[Remaining Enemies]');
      enemyAlive.forEach(u => lines.push(`- ${u.name} [${rowLabel(u.row)}]: HP ${u.hp}/${u.maxHp}`));
    }
    lines.push('');
    lines.push('[Detailed Log]');
    (runtime.logs || []).forEach(row => lines.push(`- ${row}`));
    lines.push('');
    lines.push('[Note]');
    lines.push('Use these numbers as fixed outcomes. Add narrative without changing numeric results.');
    return lines.join('\n');
  }

  function resolveOneRound() {
    const runtime = model.state.runtime;
    if (!runtime.started || runtime.finished) return;
    runtime.round += 1;
    runtime.queue = buildRoundQueue(runtime);
    const summary = { round:runtime.round, partyDamage:0, enemyDamage:0, partyHealing:0, enemyHealing:0, partyKills:0, enemyKills:0, highlights:[] };
    for (const uid of runtime.queue) {
      if (runtime.finished) break;
      const actor = findUnitByUid(runtime, uid);
      if (!actor || actor.dead) continue;
      const allies = actor.side === 'party' ? runtime.party : runtime.enemies;
      const foes = actor.side === 'party' ? runtime.enemies : runtime.party;
      if (checkBattleEnd(runtime)) break;
      if (Number(actor.statuses.stun || 0) > 0) {
        addRoundHighlight(summary, `${actor.name} 기절로 행동 불가`);
        continue;
      }
      if (Number(actor.statuses.sleep || 0) > 0) {
        addRoundHighlight(summary, `${actor.name} 수면으로 행동 불가`);
        continue;
      }
      if (Number(actor.statuses.freeze || 0) > 0) {
        addRoundHighlight(summary, `${actor.name} 빙결로 행동 불가`);
        continue;
      }
      if (Number(actor.statuses.paralyze || 0) > 0) {
        addRoundHighlight(summary, `${actor.name} 마비로 행동 불가`);
        continue;
      }
      const action = actor.side === 'party' ? resolvePartyAction(runtime, actor, allies, foes) : chooseEnemyAction(actor, allies, foes, false);
      resolveSkillOrBasic(runtime, actor, action, summary);
      if (checkBattleEnd(runtime)) break;
    }
    endRoundMaintenance(runtime, runtime.party.concat(runtime.enemies), summary);
    const text = buildRoundSummaryText(summary, runtime);
    runtime.roundSummaries.push({ round:summary.round, text, raw:summary });
    pushBattleLog(runtime, `[라운드요약] ${text}`);
    runtime.totals.partyDamage += summary.partyDamage;
    runtime.totals.enemyDamage += summary.enemyDamage;
    runtime.totals.partyHealing += summary.partyHealing;
    runtime.totals.enemyHealing += summary.enemyHealing;
    runtime.totals.partyKills += summary.partyKills;
    runtime.totals.enemyKills += summary.enemyKills;
    runtime.pendingActions = {};
    if (!runtime.finished && runtime.round >= 30) {
      runtime.finished = true;
      runtime.outcome = 'Draw';
      runtime.roundSummaries.push({ round:runtime.round, text:'30라운드 제한 도달 — 무승부 처리.', raw:null });
    }
    if (runtime.finished) {
      runtime.llmBlock = buildLlmBlock();
      // Award EXP to DB characters on Victory (only once, guarded by expFlushed flag)
      if (runtime.outcome === 'Victory' && !runtime.expFlushed) {
        runtime.expFlushed = true;
        runtime.expResults = flushExpToDb(runtime);
        if (runtime.expResults.length) {
          const expLines = runtime.expResults.map(r => {
            let s = `${r.name} +${r.exp}EXP (Lv${r.newLevel})`;
            if (r.levelsGained > 0) s += ` ⬆️레벨업 x${r.levelsGained}`;
            return s;
          });
          pushBattleLog(runtime, '[EXP] ' + expLines.join(' / '));
        }
      }
    }
  }
  function autoResolveBattle(maxRounds) {
    const runtime = model.state.runtime;
    let loops = 0;
    while (runtime.started && !runtime.finished && loops < maxRounds) {
      const aliveParty = getAlive(runtime.party);
      const pending = {};
      aliveParty.forEach(u => { pending[u.uid] = { mode:'auto' }; });
      runtime.pendingActions = pending;
      resolveOneRound();
      loops += 1;
    }
  }

  function buildBattleFromSetup() {
    const runtime = buildDefaultRuntime();
    const party = [];
    const enemies = [];
    (model.db.battleSetup.partySlots || []).forEach((id, idx) => {
      if (!id) return;
      const base = getCharById(id);
      if (base) party.push(buildUnit(base, 'party', idx));
    });
    (model.db.battleSetup.enemySlots || []).forEach((id, idx) => {
      if (!id) return;
      const base = getMonsterById(id);
      if (base) enemies.push(buildUnit(base, 'enemies', idx));
    });
    runtime.party = party.slice(0, MAX_PARTY);
    runtime.enemies = enemies.slice(0, MAX_ENEMIES);
    if (!runtime.party.length) throw new Error('파티 슬롯이 비어 있다.');
    if (!runtime.enemies.length) throw new Error('적 슬롯이 비어 있다.');
    numberDuplicateUnits(runtime.enemies);
    runtime.started = true;
    runtime.finished = false;
    model.state.runtime = runtime;
  }

  async function saveDb() { await argSet(KEY_DB, JSON.stringify(model.db)); }
  async function saveState() { await argSet(KEY_STATE, JSON.stringify(model.state)); }
  async function loadAll() {
    let rawDb = await argGet(KEY_DB);
    let rawState = await argGet(KEY_STATE);
    if (!rawDb) rawDb = await argGet('GateBattleV20::db');
    if (!rawDb) rawDb = await argGet('GateBattleV19::db');
    if (!rawDb) rawDb = await argGet('GateBattleV18::db');
    if (!rawDb) rawDb = await argGet('GateBattleV17::db');
    if (!rawDb) rawDb = await argGet('GateBattleV16::db');
    if (!rawDb) rawDb = await argGet('GateBattleV15::db');
    if (!rawDb) rawDb = await argGet('GateBattleV14::db');
    if (!rawDb) rawDb = await argGet('GateBattleV13::db');
    if (!rawDb) rawDb = await argGet('GateBattleV12::db');
    if (!rawState) rawState = await argGet('GateBattleV20::state');
    if (!rawState) rawState = await argGet('GateBattleV19::state');
    if (!rawState) rawState = await argGet('GateBattleV18::state');
    if (!rawState) rawState = await argGet('GateBattleV17::state');
    if (!rawState) rawState = await argGet('GateBattleV16::state');
    if (!rawState) rawState = await argGet('GateBattleV15::state');
    if (!rawState) rawState = await argGet('GateBattleV14::state');
    if (!rawState) rawState = await argGet('GateBattleV13::state');
    if (!rawState) rawState = await argGet('GateBattleV12::state');
    if (!rawDb) rawDb = await argGet('GateBattleV11::db');
    if (!rawState) rawState = await argGet('GateBattleV11::state');
    if (rawDb) {
      try { model.db = Object.assign(buildDefaultDb(), JSON.parse(rawDb)); }
      catch (e) { console.warn(PLUGIN_NAME, 'db parse error', e); model.db = buildDefaultDb(); }
    }
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState);
        if (parsed && typeof parsed === 'object') {
          const next = buildDefaultState();
          model.state = Object.assign(next, parsed);
          model.state.runtime = Object.assign(buildDefaultRuntime(), parsed.runtime || {});
          model.state.gate = Object.assign(buildDefaultGateState(), parsed.gate || {});
          if (model.state.gate && model.state.gate.run && typeof model.state.gate.run === 'object') {
            if (model.state.gate.run.elapsedMinutes == null) model.state.gate.run.elapsedMinutes = 0;
            if (!('postBattle' in model.state.gate.run)) model.state.gate.run.postBattle = null;
            try { (model.state.gate.run.stages || []).forEach(st => { const rooms = []; if (st.kind === 'room' && st.room) rooms.push(st.room); if (st.kind === 'choice') (st.options || []).forEach(o => o && o.room && rooms.push(o.room)); rooms.forEach(r => { if (r.mineResolved == null) r.mineResolved = !!(r.mined || r.mineSkipped); }); }); if (model.state.gate.run.secretPlan && model.state.gate.run.secretPlan.room && model.state.gate.run.secretPlan.room.mineResolved == null) model.state.gate.run.secretPlan.room.mineResolved = !!(model.state.gate.run.secretPlan.room.mined || model.state.gate.run.secretPlan.room.mineSkipped); } catch {}
            if (model.state.gate.run.partyStartCount == null) model.state.gate.run.partyStartCount = Array.isArray(model.state.gate.run.partyState) ? model.state.gate.run.partyState.length : 0;
            if (!model.state.gate.run.campSupplies) { model.state.gate.run.campSupplies = { used:false, legacyMigrated:false }; }
            ensureGateLogContainers(model.state.gate.run);
          }
        }
      } catch (e) {
        console.warn(PLUGIN_NAME, 'state parse error', e);
        model.state = buildDefaultState();
      }
    }
    let vis = await lsGet(KEY_VISIBLE);
    if (vis == null) vis = await lsGet('GateBattleV20::visible');
    if (vis == null) vis = await lsGet('GateBattleV19::visible');
    if (vis == null) vis = await lsGet('GateBattleV18::visible');
    if (vis == null) vis = await lsGet('GateBattleV17::visible');
    if (vis == null) vis = await lsGet('GateBattleV16::visible');
    if (vis == null) vis = await lsGet('GateBattleV15::visible');
    if (vis == null) vis = await lsGet('GateBattleV14::visible');
    if (vis == null) vis = await lsGet('GateBattleV13::visible');
    if (vis == null) vis = await lsGet('GateBattleV12::visible');
    if (vis == null) vis = await lsGet('GateBattleV11::visible');
    model.state.visible = vis === 'true';
    getInventory();
    if (!Array.isArray(model.db.auctionListings)) model.db.auctionListings = [];
    if (!Array.isArray(model.db.hmUsedListings)) model.db.hmUsedListings = [];
    if (!model.state.gate || typeof model.state.gate !== 'object') model.state.gate = buildDefaultGateState();
    if (!Array.isArray(model.state.gate.generated) || !model.state.gate.generated.length) generateGateOptions(model.state.gate.size || 'small', model.state.gate.rank || 'E');
    seedDefaultInventoryMigration();
    // 저장된 캐릭터/페르소나의 파생 스탯(HP/MP/SP/ATK/PDEF/MDEF)을 현재 공식으로 재계산
    (model.db.characters || []).forEach(c => { if (c.stats) recalcCharDerivedStats(c); });
    (model.db.personas || []).forEach(p => { if (p.stats) recalcCharDerivedStats(p); });
    ensureSelections();
  }

  function toast(msg, isErr) {
    console[isErr ? 'warn' : 'log'](PLUGIN_NAME, msg);
    const root = model.root;
    if (!root) return;
    let bar = root.querySelector('.gb-toast');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'gb-toast';
      root.appendChild(bar);
    }
    bar.textContent = String(msg);
    bar.classList.toggle('err', !!isErr);
    bar.classList.add('show');
    setTimeout(() => { if (bar) bar.classList.remove('show'); }, 2200);
  }

  function fieldValue(id) {
    const el = model.root && model.root.querySelector(id);
    return el ? el.value : '';
  }
  function checkedValue(id) {
    const el = model.root && model.root.querySelector(id);
    return !!(el && el.checked);
  }

  function unitTagHtml(unit) {
    const tags = [];
    if (unit.dead) tags.push('<span class="gb-dead">DEAD</span>');
    ['stun','bind','sleep','poison','bleed','burn','curse'].forEach(k => { if (unit.statuses[k] > 0) tags.push(`<span class=\"${k==='stun'||k==='sleep'?'gb-stun':'gb-debuff'}\">${k} ${unit.statuses[k]}</span>`); });
    if (unit.baseElement && unit.baseElement !== 'none') tags.push(`<span class="gb-tag">${escapeHtml(elementLabel(unit.baseElement))}</span>`);
    if (unit.speciesLabel) tags.push(`<span class="gb-tag">${escapeHtml(unit.speciesLabel)}</span>`);
    (unit.buffs || []).forEach(b => {
      if (b.stealth) tags.push(`<span class="gb-buff" style="background:#6b21a8;color:#e9d5ff;">🥷 은신 ${b.turns}T</span>`);
      else tags.push(`<span class="gb-buff">${escapeHtml(b.name)} ${b.turns}T</span>`);
    });
    return tags.join(' ');
  }
  function unitRowHtml(unit) {
    const hpPct = unit.maxHp > 0 ? Math.round((unit.hp / unit.maxHp) * 100) : 0;
    const mpPct = unit.maxMp > 0 ? Math.round((unit.mp / unit.maxMp) * 100) : 0;
    const spPct = unit.maxSp > 0 ? Math.round((unit.sp / unit.maxSp) * 100) : 0;
    return `
      <div class="gb-unit ${unit.dead ? 'is-dead' : ''}">
        <div class="gb-unit-top">
          <div><strong>${escapeHtml(unit.name)}</strong> <span class="gb-badge">${escapeHtml(unit.rank)}</span> <span class="gb-badge">${escapeHtml(rowLabel(unit.row))}</span> <span class="gb-badge">${escapeHtml(unit.kind || '')}</span></div>
          <div>${unitTagHtml(unit)}</div>
        </div>
        <div class="gb-sub">${escapeHtml(unit.job || '')} / ${escapeHtml(unit.position || '')} / ${escapeHtml(unit.damageType)} / Threat ${Number(unit.threatBase || 0) + Number(unit.threatBonus || 0)}</div>
        <div class="gb-bar-wrap"><span>HP ${unit.hp}/${unit.maxHp}</span><div class="gb-bar"><div class="gb-bar-fill hp" style="width:${hpPct}%"></div></div></div>
        <div class="gb-bar-wrap"><span>MP ${unit.mp}/${unit.maxMp}</span><div class="gb-bar"><div class="gb-bar-fill mp" style="width:${mpPct}%"></div></div></div>
        <div class="gb-bar-wrap"><span>SP ${unit.sp}/${unit.maxSp}</span><div class="gb-bar"><div class="gb-bar-fill sp" style="width:${spPct}%"></div></div></div>
        <div class="gb-sub">${escapeHtml(unit.lastAction || '')}</div>
      </div>
    `;
  }


// ── 팀 패널 렌더 ──────────────────────────────────────────────────────────────
function renderTeamPanel() {
  if (!Array.isArray(model.db.team)) model.db.team = [];
  const team = model.db.team;
  const allChars = model.db.characters || [];
  const allPersonas = model.db.personas || [];
  const teamView = model.state.teamView || 'members';
  const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 10000 ? `${Math.round(n/10000)}만` : n.toLocaleString('en-US');

  // 팀에 없는 캐릭터 목록 (추가 가능)
  const inTeamIds = new Set(team.map(m => m.charId));
  const addableChars = allChars.filter(c => !inTeamIds.has(c.id));
  const addablePersonas = allPersonas.filter(p => !inTeamIds.has(p.id));
  const sharedAlreadyIn = inTeamIds.has('__shared__');

  const memberRows = team.length === 0
    ? '<div class="gb-sub">팀원이 없다. 아래에서 추가하라.</div>'
    : team.map((m, idx) => {
        const isShared = m.charId === '__shared__';
        const char = isShared ? null : (allChars.find(c => c.id === m.charId) || allPersonas.find(p => p.id === m.charId));
        const name = isShared ? '🏛️ 공용 인벤' : (char ? (char.name || m.charId) : m.charId);
        const rank = char ? (char.rank || '') : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(148,163,184,0.1);">
          <span style="flex:1;font-size:13px;"><strong>${escapeHtml(name)}</strong>${rank ? ` <span class="gb-badge">${escapeHtml(rank)}</span>` : ''}</span>
          <label style="font-size:12px;margin:0;display:flex;align-items:center;gap:4px;">비율
            <input type="number" min="0" max="100" style="width:55px;" class="gb-input" data-team-ratio="${idx}" value="${Number(m.ratio||10)}">%
          </label>
          <button class="gb-btn tiny danger" data-team-remove="${idx}">제거</button>
        </div>`;
      }).join('');

  const totalRatio = team.reduce((s, m) => s + Number(m.ratio||10), 0);
  const ratioWarn = team.length > 0 && totalRatio !== 100
    ? `<div class="gb-sub" style="color:#fbbf24;">⚠️ 비율 합계: ${totalRatio}% (100%가 되어야 정산 가능)</div>` : '';

  const addOptions = [
    ...addableChars.map(c => `<option value="${escapeHtml(c.id)}">[캐릭터] ${escapeHtml(c.name||c.id)}</option>`),
    ...addablePersonas.map(p => `<option value="${escapeHtml(p.id)}">[페르소나] ${escapeHtml(p.name||p.id)}</option>`)
  ].join('');

  return `<div class="gb-panel">
    <div class="gb-section-title">👥 팀</div>
    <div class="gb-sub" style="margin-bottom:8px;">게이트 파티 구성원과 정산 비율을 관리한다. 협회 정산 시 이 비율대로 각자 인벤에 분배된다. <strong>공용 인벤</strong>도 팀원으로 추가하면 공용비 분배 가능.</div>
    ${memberRows}
    ${ratioWarn}
    <div class="gb-btn-row" style="margin-top:8px;">
      ${addOptions ? `<select class="gb-input" id="gb-team-add-sel" style="max-width:200px;">
        <option value="">— 추가할 인물 선택 —</option>
        ${addOptions}
      </select>
      <button class="gb-btn" id="gb-team-add-btn">팀에 추가</button>` : ''}
      ${!sharedAlreadyIn ? `<button class="gb-btn" id="gb-team-add-shared">🏛️ 공용 인벤 추가</button>` : ''}
    </div>
  </div>`;
}

function renderHub() {
  const currentGate = gateStateSafe().current;
  const run = getGateRun();
  const currentInfo = currentGate ? `
    <div class="gb-panel">
      <div class="gb-section-title">현재 선택된 게이트</div>
      <div><strong>${escapeHtml(currentGate.title)}</strong> <span class="gb-badge">${escapeHtml(currentGate.rank)}</span> <span class="gb-badge">${escapeHtml(currentGate.sizeLabel || '')}</span></div>
      <div class="gb-sub">${escapeHtml(currentGate.primarySpeciesLabel)} + ${escapeHtml(currentGate.secondarySpeciesLabel)} / 내부 수치 비공개</div>
    </div>` : '';
  const runInfo = run ? `
    <div class="gb-panel">
      <div class="gb-section-title">진행 중인 게이트 공략</div>
      <div><strong>${escapeHtml(run.title)}</strong> <span class="gb-badge">${escapeHtml(run.rank)}</span> <span class="gb-badge">${escapeHtml(run.sizeLabel || '')}</span></div>
      <div class="gb-sub">단계 ${Math.min(run.currentStage + 1, run.stages.length)}/${run.stages.length} / 생존 파티 ${run.partyState.length}명 / ${run.completed ? '완료 — 협회에서 정산 필요' : run.failed ? '실패 — 협회에서 정산 가능' : '진행 중'}</div>
      <div class="gb-btn-row"><button class="gb-btn primary" data-go="gate">게이트 화면으로</button>${(run.completed || run.failed) ? ' <button class="gb-btn" data-go="association">협회에서 정산하기</button>' : ''}</div>
    </div>` : '';
  return `
    <div class="gb-grid four">
      <button class="gb-card-nav" data-go="gate">
        <div class="gb-card-title">⚔️ 게이트</div>
        <div class="gb-sub">소형 / 중형 / 대형 게이트 생성, 선택, 방 단위 진행.</div>
      </button>
      <button class="gb-card-nav" data-go="battle">
        <div class="gb-card-title">🗡️ 전투</div>
        <div class="gb-sub">파티/적 편성, 전열/중열/후열, 수동 행동 선택.</div>
      </button>
      <button class="gb-card-nav" data-go="party">
        <div class="gb-card-title">👥 파티</div>
        <div class="gb-sub">파티 편성, 스탯포인트 배분, 전투 출격 관리.</div>
      </button>
      <button class="gb-card-nav" data-go="character">
        <div class="gb-card-title">🧑 캐릭터</div>
        <div class="gb-sub">페르소나 관리, 장비, 스킬, 레벨 확인.</div>
      </button>
    </div>
    <div class="gb-grid four">
      <button class="gb-card-nav" data-go="inventory">
        <div class="gb-card-title">🎒 공용인벤</div>
        <div class="gb-sub">페르소나 공용 인벤, 가방, 무게, 돈 편집.</div>
      </button>
      <button class="gb-card-nav" data-go="db">
        <div class="gb-card-title">🗂️ DB</div>
        <div class="gb-sub">캐릭터, 페르소나, 스킬, 몬스터를 직접 입력/수정.</div>
      </button>
      <button class="gb-card-nav" data-go="association">
        <div class="gb-card-title">🏛️ 협회</div>
        <div class="gb-sub">게이트 신청·정산, 경매장, 브리핑룸. 정산은 이곳에서.</div>
      </button>
      <button class="gb-card-nav" data-go="shop">
        <div class="gb-card-title">🛒 상점</div>
        <div class="gb-sub">편의점, 백화점, 헌터거리 (수리점·대장간·물약·소모품·재료).</div>
      </button>
    </div>
    <div class="gb-grid four">
      <button class="gb-card-nav" data-go="home">
        <div class="gb-card-title">🏠 집</div>
        <div class="gb-sub">구매 또는 임대 가능한 주거 매물 목록. 계약금·월세 정보 포함.</div>
      </button>
      <button class="gb-card-nav" data-go="guild">
        <div class="gb-card-title">⚜️ 길드</div>
        <div class="gb-sub">길드 가입, 창설, 탈퇴.</div>
      </button>
    </div>
    ${renderTeamPanel()}
    ${runInfo}
    ${currentInfo}
    <div class="gb-panel">
      <div class="gb-section-title">💾 데이터 관리</div>
      <div class="gb-sub">플러그인 업데이트 전 반드시 데이터를 내보내기(백업) 해두세요. 불러오기로 이전 데이터를 복원할 수 있습니다.</div>
      <div class="gb-btn-row" style="margin-top:8px;">
        <button class="gb-btn primary" id="gb-data-export">📥 데이터 내보내기 (백업)</button>
        <button class="gb-btn" id="gb-data-import">📤 데이터 불러오기 (복원)</button>
        <button class="gb-btn" id="gb-data-clear" style="background:rgba(239,68,68,0.15);color:#fca5a5;">🗑️ 저장 데이터 전체 삭제</button>
      </div>
      <input type="file" id="gb-data-import-file" accept=".json" style="display:none;">
    </div>
    <div class="gb-panel">
      <div class="gb-section-title">v7.2 범위</div>
      <div class="gb-sub">허브 / 게이트 / 전투 / 파티 / 캐릭터 / 공용인벤 / DB / 협회(정산·경매) / 상점 / 주거 / 길드 / 가방·무게 / 게이트 자동 생성 / 방 단위 진행 / 광맥 채굴.</div>
      <div class="gb-rule">광역CC = 단일CC의 1/2 계수 + 자원 소모 2배</div>
    </div>
  `;
}

// ── 협회 (Association) ───────────────────────────────────────────────────────
const ASSOC_FLOORS = [
  { id: '1F',  label: '1층 — 메인 로비 / 랭킹 센터 / 정산 카운터' },
  { id: '2F',  label: '2층 — 중앙 경매장' },
  { id: '4F',  label: '4층 — 인사부 (측정·등록·평가)' },
  { id: '7F',  label: '7층 — 엔지니어 로비' },
  { id: 'B5F', label: 'B5층 — 특수 연구 시설' },
];
const ASSOC_LORE = `위치: 서울 종로 | 외관: 도심의 거대한 유리 고층 빌딩. 헌터들이 주도하는 경제 규모를 반영하는 위압적인 규모. 내부: 웅장하고 현대적인 로비. 높은 천장, 형광등 조명, 광택 대리석 바닥. 1층 정산 카운터와 2층 경매장은 직접 연결.`;

function buildSettlementSheet(run, state) {
  if (!run) return null;
  const partyCount = Math.max(1, parseInt(state.settlePartyCount || '3', 10));
  const type = state.settleType || 'association';
  const guildPct = Math.max(0, Math.min(100, parseInt(state.settleGuildPct || '40', 10)));
  const gearItems = state.settleGearItems || [];
  return calcStashSettlement(run.stash, partyCount, type, guildPct, run.title, gearItems);
}

function renderSettlementSheet(result, runTitle) {
  if (!result) return '';
  const { lines, subtotal, fee, feeLabel, net, perPerson, guildShare, guildPct, final, n, isGuild } = result;
  const titleLine = runTitle ? `<div style="font-weight:700;margin-bottom:4px;">${escapeHtml(runTitle)}</div>` : '';
  const itemLines = lines.length
    ? lines.map(l => `<div style="font-family:monospace;font-size:12px;">• ${escapeHtml(l)}</div>`).join('')
    : '<div class="gb-sub">집계된 보상이 없다.</div>';
  return `
    ${titleLine}
    <div style="font-weight:600;margin:6px 0 2px;">[게이트 클리어 정산 내역]</div>
    <div style="background:#0b0d12;border:1px solid rgba(148,163,184,0.14);border-radius:8px;padding:8px;margin-bottom:8px;">${itemLines}</div>
    <div style="font-weight:600;margin-bottom:2px;">[총액]</div>
    <div class="gb-sub">▶ 총합 = ₩${formatWon(subtotal)}</div>
    <div class="gb-sub">▶ ${escapeHtml(feeLabel)} = ₩${formatWon(fee)}</div>
    <div class="gb-sub">▶ 세후 정산액 = ₩${formatWon(net)}</div>
    <div style="font-weight:600;margin:6px 0 2px;">[개인 정산액]</div>
    <div class="gb-sub">▶ 개인 정산액 = ₩${formatWon(net)} × 1/${n} = ₩${formatWon(perPerson)}</div>
    ${isGuild && guildShare > 0 ? `<div class="gb-sub">▶ 길드 지분(${guildPct}%) = ₩${formatWon(guildShare)}</div>` : ''}
    <div class="gb-sub" style="font-weight:700;color:#fbbf24;">▶ 최종 정산액 = ₩${formatWon(final)}</div>
  `;
}

// ── 협회 중앙 경매장 (2F) ────────────────────────────────────────────────────
// NPC 목록 최대 수
const AUCTION_NPC_MAX = 20;
// 경매장 가격 범위: 시장가 85~200%
const AUCTION_PRICE_MIN_RATIO = 0.85;
const AUCTION_PRICE_MAX_RATIO = 2.00;
// 구매 경매 최대 경쟁 상한선
const AUCTION_BUY_MAX_RATIO = 1.80;

function randomAuctionRatio() {
  return AUCTION_PRICE_MIN_RATIO + Math.random() * (AUCTION_PRICE_MAX_RATIO - AUCTION_PRICE_MIN_RATIO);
}

function seedNpcAuctionListings() {
  if (!Array.isArray(model.db.auctionListings)) model.db.auctionListings = [];
  const npcCount = model.db.auctionListings.filter(l => l.isNpc).length;
  const needed = AUCTION_NPC_MAX - npcCount;
  if (needed <= 0) return;

  // 등급 분배: D50% C40% B8% A1.9% S0.1% (E급 제외)
  function pickAuctionRank() {
    const r = Math.random() * 100;
    if (r < 50) return 'D';
    if (r < 90) return 'C';
    if (r < 98) return 'B';
    if (r < 99.9) return 'A';
    return 'S';
  }
  // 부위 분배 가중치: weapon30 armor50 subweapon24 accessory24 skillbook2
  const PART_WEIGHTS = [
    { part:'weapon', w:30 }, { part:'armor', w:50 },
    { part:'subweapon', w:24 }, { part:'accessory', w:24 },
    { part:'skillbook', w:2 }
  ];
  const PART_TOTAL = PART_WEIGHTS.reduce((s,p)=>s+p.w,0);
  function pickAuctionPart() {
    let r = Math.random() * PART_TOTAL;
    for (const p of PART_WEIGHTS) { r -= p.w; if (r <= 0) return p.part; }
    return 'weapon';
  }

  for (let i = 0; i < needed; i++) {
    const rank = pickAuctionRank();
    const partType = pickAuctionPart();
    const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i;

    if (partType === 'skillbook') {
      // ── 스킬북 매물 ──
      const skillKeys = Object.keys(BUILTIN_SKILLS || {});
      const matchingSkills = skillKeys.filter(k => {
        const sk = BUILTIN_SKILLS[k];
        return sk && sk.grade === rank;
      });
      if (matchingSkills.length === 0) continue; // no skills for this rank, skip
      const pickedKey = matchingSkills[Math.floor(Math.random() * matchingSkills.length)];
      const skill = BUILTIN_SKILLS[pickedKey];
      const cat = skill.category || 'utility';
      const tier = SKILL_BOOK_TIERS[cat] || 4;
      const bookPrice = calcSkillBookPrice(rank, tier);
      const ratio = randomAuctionRatio();
      const askPrice = Math.round(bookPrice * ratio);
      const item = {
        id: `npc_skillbook_${rank.toLowerCase()}_${uid}`,
        name: `📖 ${skill.name || pickedKey} 스킬북`,
        category: 'skillbook', rank, skillId: pickedKey,
        skillCategory: cat, skillTier: tier,
        price: bookPrice, stackable: false,
        unitWeightG: 200,
        note: `${rank}급 T${tier} 스킬북 [${cat}]`
      };
      model.db.auctionListings.push({ id: `auc_npc_${uid}`, item, askPrice, marketPrice: bookPrice, priceRatio: ratio, isNpc: true, listedAt: Date.now() });
      continue;
    }

    const part = partType;
    // 희귀도: Normal 80% / Rare 20%
    const isRare = Math.random() < 0.20;
    const maxInfuseBase = EQUIP_MAX_INFUSE[part] || 1;
    const builtInTrait = (part === 'subweapon' || part === 'accessory');

    // 특성 결정: Rare면 항상 특성 보유, Normal이면 보조무기/악세는 80%확률 내장특성, 무기/방어구는 특성 없음
    let hasTrait = false;
    if (isRare) {
      hasTrait = true;
    } else if (builtInTrait) {
      hasTrait = Math.random() < 0.80;
    }

    let traitId = '';
    if (hasTrait) {
      if (builtInTrait) {
        const pool = Math.random() < 0.20 ? RARE_TRAIT_POOL : NORMAL_TRAIT_POOL;
        traitId = pool[Math.floor(Math.random() * pool.length)];
      } else {
        traitId = EQUIP_TRAIT_TYPES[Math.floor(Math.random() * EQUIP_TRAIT_TYPES.length)];
      }
    }
    const traitName = hasTrait ? (EQUIP_TRAIT_LABELS[traitId] || traitId) : '';
    // 특수효과는 주입이 아니므로 maxInfuse를 늘리지 않음
    const maxInfuse = maxInfuseBase;
    const basePrice = calcEquipRandomPrice(rank, part);
    let traitBonus = 0;
    if (hasTrait && !builtInTrait) {
      traitBonus = Math.round((RARE_MATERIAL_BASE_WON[rank] || RARE_MATERIAL_BASE_WON.E) * 1.25);
    } else if (hasTrait && builtInTrait) {
      const tier = TRAIT_TIER_MAP[traitId] || 3;
      const tierPrices = RARE_PRICE_BY_RANK_TIER[rank] || RARE_PRICE_BY_RANK_TIER.E;
      const tier4Price = tierPrices.tier4;
      const tierPrice = tierPrices[`tier${tier}`] || tier4Price;
      traitBonus = tierPrice - tier4Price;
    }
    const marketPrice = basePrice + traitBonus;
    const ratio = randomAuctionRatio();
    const askPrice = Math.round(marketPrice * ratio);
    const _armorSub = part === 'armor' ? (() => { const k = ARMOR_SUBTYPE_KEYS[Math.floor(Math.random()*ARMOR_SUBTYPE_KEYS.length)]; return {key:k,...ARMOR_SUBTYPES[k]}; })() : null;
    // 보조무기 서브타입 결정 (방패 여부)
    let _subSuffix = null;
    let _isShield = false;
    if (part === 'subweapon') {
      const subSuffArr = EQUIP_NAME_SUFFIXES.subweapon || ['방패'];
      _subSuffix = subSuffArr[Math.floor(Math.random() * subSuffArr.length)];
      _isShield = (_subSuffix === '방패');
    }
    const { rarity: npcRarity, traitTier: npcTier } = hasTrait ? assignEquipRarity(part, traitId) : { rarity: 'Normal', traitTier: 0 };
    const equipNameStr = generateEquipName(rank, part, _armorSub ? _armorSub.key : null, hasTrait ? traitName : '', _subSuffix);
    // 특수효과(내장 특성)는 주입 횟수를 사용하지 않음
    const infuseCount = (hasTrait && builtInTrait) ? 0 : (hasTrait ? 1 : 0);
    const item = {
      id: `npc_drop_equip_${rank.toLowerCase()}_${part}_${uid}`,
      name: equipNameStr,
      part, rank, rarity: isRare ? npcRarity : 'Normal', traitTier: npcTier,
      enhance: 0, infuse: infuseCount, maxInfuse, traits: hasTrait ? [traitId] : [],
      durability: 100, maxDurability: 100, price: marketPrice,
      category: 'equipment', isDropped: true, stackable: false,
      unitWeightG: EQUIP_WEIGHT_G[part] || 1000,
      stackKey: `equipment:npc_${uid}`, note: `NPC 경매 등록${hasTrait ? `. 특성: ${traitName}` : ''}`,
      atk: part === 'weapon' ? (WEAPON_BASE_ATK[rank] || 5) : (part === 'armor' && _armorSub && _armorSub.atkMul ? Math.round((WEAPON_BASE_ATK[rank] || 5) * _armorSub.atkMul) : 0),
      pdef: part === 'armor' ? (() => { const base = (ARMOR_STAT_BY_RANK[rank]||{defRange:[0,5]}).defRange[1]; const [lo,hi] = _armorSub ? _armorSub.defMul : [0.5,0.5]; const mul = lo + Math.random()*(hi-lo); return Math.round(base * mul); })() : (part === 'subweapon' && _isShield ? Math.round((ARMOR_STAT_BY_RANK[rank]||{defRange:[0,5]}).defRange[1] * 0.25) : 0),
      mdef: part === 'armor' ? (() => { const base = (ARMOR_STAT_BY_RANK[rank]||{defRange:[0,5]}).defRange[1]; const [lo,hi] = _armorSub ? _armorSub.defMul : [0.5,0.5]; const mul = lo + Math.random()*(hi-lo); return Math.round(base * mul); })() : 0,
      mainStat: part === 'weapon' ? (Math.random() < 0.5 ? 'str' : 'int') : (part === 'armor' && _armorSub ? _armorSub.statPool[Math.floor(Math.random() * _armorSub.statPool.length)] : (part === 'subweapon' && _isShield ? 'con' : (part === 'armor' ? 'con' : ''))),
      armorSubtype: _armorSub ? _armorSub.key : undefined,
      armorStatBonusMul: _armorSub ? _armorSub.statBonusMul : undefined,
      resistType: '', resistPct: 0
    };
    model.db.auctionListings.push({ id: `auc_npc_${uid}`, item, askPrice, marketPrice, priceRatio: ratio, isNpc: true, listedAt: Date.now() });
  }

  // ── 희귀재료 매물 ──
  if (!Array.isArray(model.db.auctionRareMats)) model.db.auctionRareMats = [];
  const rareMatCount = model.db.auctionRareMats.filter(l => l.isNpc).length;
  const rareMatNeeded = 15 - rareMatCount;
  if (rareMatNeeded > 0) {
    function pickRareMatRank() {
      const r = Math.random() * 100;
      if (r < 30) return 'E';
      if (r < 60) return 'D';
      if (r < 80) return 'C';
      if (r < 98) return 'B';
      if (r < 99.9) return 'A';
      return 'S';
    }
    const rareMatCatalog = (model.db.rareMaterialCatalog || []);
    for (let rm = 0; rm < rareMatNeeded; rm++) {
      const rank = pickRareMatRank();
      const uid2 = Date.now().toString(36) + Math.random().toString(36).slice(2,6) + 'rm' + rm;
      const matchMats = rareMatCatalog.filter(m => m.rank === rank);
      let matItem;
      if (matchMats.length > 0) {
        const picked = matchMats[Math.floor(Math.random() * matchMats.length)];
        // 티어별 가격 적용
        const tier = TRAIT_TIER_MAP[picked.traitId] || 3;
        const tierPrices = RARE_PRICE_BY_RANK_TIER[rank] || RARE_PRICE_BY_RANK_TIER.E;
        const baseWon = tierPrices[`tier${tier}`] || RARE_MATERIAL_BASE_WON[rank] || RARE_MATERIAL_BASE_WON.E;
        const ratio2 = 0.85 + Math.random() * 0.30;
        const askP = Math.round(baseWon * ratio2);
        // 효과 설명 추가
        const traitLabel = picked.traitId ? (EQUIP_TRAIT_LABELS[picked.traitId] || picked.traitId) : '';
        const effectNote = traitLabel ? `[${traitLabel}] ${picked.note || `${rank}급 희귀재료`}` : (picked.note || `${rank}급 희귀재료`);
        matItem = { id: `auc_rmat_${uid2}`, item: { id: `rmat_${rank.toLowerCase()}_${uid2}`, name: picked.name || `${rank}급 희귀재료`, category: 'rareMaterial', rank, traitId: picked.traitId || '', suggestedPrice: baseWon, stackable: false, unitWeightG: 200, note: effectNote }, askPrice: askP, marketPrice: baseWon, priceRatio: ratio2, isNpc: true, listedAt: Date.now() };
      } else {
        const baseWon = RARE_MATERIAL_BASE_WON[rank] || RARE_MATERIAL_BASE_WON.E;
        const ratio2 = 0.85 + Math.random() * 0.30;
        const askP = Math.round(baseWon * ratio2);
        matItem = { id: `auc_rmat_${uid2}`, item: { id: `rmat_${rank.toLowerCase()}_${uid2}`, name: `${rank}급 희귀재료`, category: 'rareMaterial', rank, traitId: '', suggestedPrice: baseWon, stackable: false, unitWeightG: 200, note: `${rank}급 희귀재료` }, askPrice: askP, marketPrice: baseWon, priceRatio: ratio2, isNpc: true, listedAt: Date.now() };
      }
      model.db.auctionRareMats.push(matItem);
    }
  }
}

// 구매 경매 — 경쟁자 즉석 판정 (단계별 인터랙티브용)
function rollBuyCompetitor(currentRatio, step) {
  const COMPETITOR_CHANCE = 0.45;
  const MAX_RATIO = AUCTION_BUY_MAX_RATIO;
  const STEP = 0.10;
  const competitorNames = ['익명 헌터 A','익명 헌터 B','익명 헌터 C','딜러 ??','수집가 #?'];
  if (currentRatio >= MAX_RATIO) return null;
  const roll = Math.random();
  if (roll < COMPETITOR_CHANCE) {
    return {
      name: competitorNames[Math.floor(Math.random() * competitorNames.length)],
      ratio: Math.min(currentRatio + STEP, MAX_RATIO)
    };
  }
  return null;
}

// 판매 경매 시뮬레이션: 85%에서 시작, 60% 확률로 10%씩 상승, 최대 200%
// fullLog: 전체 로그 (단계별로 공개), revealedCount로 애니메이션
function simulateSellAuction(marketPrice) {
  const STEP = 0.10;
  const MAX_RATIO = AUCTION_PRICE_MAX_RATIO;
  const BID_CHANCE_BASE = 0.60; // 기본 입찰 확률
  const bidderNames = ['수집가 A','헌터 마켓 딜러','길드 구매자','무명 헌터','경매 참여자'];
  const fullLog = [];
  let ratio = AUCTION_PRICE_MIN_RATIO;
  let lastBidRatio = null;
  let step = 0;
  fullLog.push(`[경매 시작] 시작가: 시장가 85% = ₩${Math.round(marketPrice*ratio).toLocaleString('en-US')}`);
  while (ratio <= MAX_RATIO) {
    step++;
    const bidChance = BID_CHANCE_BASE * Math.pow(0.88, step - 1); // 단계가 오를수록 입찰 확률 감소
    const roll = Math.random();
    if (roll < bidChance) {
      const bname = bidderNames[Math.floor(Math.random() * bidderNames.length)];
      fullLog.push(`<em>${bname}</em> — 시장가 ${Math.round(ratio*100)}% 입찰 (₩${Math.round(marketPrice*ratio).toLocaleString('en-US')})`);
      lastBidRatio = ratio;
      const nextRatio = ratio + STEP;
      if (nextRatio > MAX_RATIO) { fullLog.push(`[종료] 최대 가격(200%) 도달. 경쟁 종료.`); break; }
      ratio = nextRatio;
    } else {
      fullLog.push(`[경매 종료] 추가 입찰 없음.`);
      break;
    }
  }
  const finalRatio = lastBidRatio !== null ? lastBidRatio : AUCTION_PRICE_MIN_RATIO;
  const finalPrice = Math.round(marketPrice * finalRatio);
  if (lastBidRatio === null) fullLog.push(`[유찰 주의] 입찰자 없음. 시작가 85%로 낙찰.`);
  fullLog.push(`[🔨 낙찰] 최종 낙찰가: 시장가 <strong>${Math.round(finalRatio*100)}%</strong> = ₩${finalPrice.toLocaleString('en-US')}`);
  return { fullLog, finalRatio, finalPrice };
}

function renderAuctionHouseHtml() {
  if (!Array.isArray(model.db.auctionListings)) model.db.auctionListings = [];
  seedNpcAuctionListings();

  const inv = getActiveInventory();
  const gold = Number(inv.gold || 0);
  const tab = model.state.auctionTab || 'browse';
  const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억원` : n >= 10000 ? `${Math.round(n/10000)}만원` : `${n.toLocaleString('en-US')}원`;

  const tabBar = `<div class="gb-btn-row">
    <button class="gb-btn${tab==='browse'?' primary':''}" data-auction-tab="browse">🔍 구매</button>
    <button class="gb-btn${tab==='sell'?' primary':''}" data-auction-tab="sell">📦 판매 등록</button>
    <button class="gb-btn${tab==='manastone'?' primary':''}" data-auction-tab="manastone">💎 마정석 거래</button>
  </div>`;

  let content = '';

  if (tab === 'browse') {
    // 구매 탭: 검색 → 결과 → 단계별 입찰
    const bidState = model.state.auctionBid;
    if (bidState && bidState.done === false) {
      // 경매 진행 중 (단계별 인터랙티브)
      const listing = (model.db.auctionListings||[]).find(l => l.id === bidState.listingId);
      const it = listing ? listing.item : null;
      const logHtml = (bidState.log||[]).map(l => `<div style="font-size:0.85em;margin-bottom:2px;">${l}</div>`).join('');
      const canAfford = gold >= Math.round(bidState.marketPrice * bidState.currentRatio);
      const myPrice = Math.round(bidState.marketPrice * bidState.currentRatio);
      const fmt2 = fmt;

      let actionArea = '';
      if (bidState.won) {
        // 낙찰 완료 대기
        const canAffordFinal = gold >= bidState.finalPrice;
        actionArea = `
          <div class="gb-sub" style="color:#fbbf24;margin-top:6px;">🏆 낙찰가: <strong>${fmt2(bidState.finalPrice)}</strong> (소지금: ${fmt2(gold)})</div>
          <div class="gb-btn-row">
            ${canAffordFinal ? `<button class="gb-btn primary" data-auction-confirm>✅ 낙찰 확정 (-${fmt2(bidState.finalPrice)})</button>` : `<button class="gb-btn" disabled>소지금 부족</button>`}
            <button class="gb-btn" data-auction-bid-cancel>❌ 포기</button>
          </div>`;
      } else if (bidState.pendingCompetitor) {
        // 경쟁자가 입찰 — 재입찰 또는 포기
        const rePrice = Math.round(bidState.marketPrice * bidState.pendingRatio);
        actionArea = `
          <div class="gb-sub" style="color:#ef4444;margin-top:6px;">⚠️ <strong>${escapeHtml(bidState.pendingCompetitor)}</strong>이(가) ${Math.round(bidState.pendingRatio*100)}% (${fmt2(rePrice)})에 입찰!</div>
          <div class="gb-btn-row">
            ${gold >= rePrice ? `<button class="gb-btn primary" data-auction-rebid>🔄 재입찰 (${fmt2(rePrice)})</button>` : `<button class="gb-btn" disabled>소지금 부족 — 재입찰 불가</button>`}
            <button class="gb-btn danger" data-auction-bid-cancel>❌ 포기</button>
          </div>`;
      } else {
        // 초기 입찰 대기
        actionArea = `
          <div class="gb-sub" style="margin-top:6px;">시작가: <strong>${fmt2(myPrice)}</strong> (시장가 ${Math.round(bidState.currentRatio*100)}%) | 소지금: ${fmt2(gold)}</div>
          <div class="gb-btn-row">
            ${canAfford ? `<button class="gb-btn primary" data-auction-place-bid>🔨 입찰하기 (${fmt2(myPrice)})</button>` : `<button class="gb-btn" disabled>소지금 부족</button>`}
            <button class="gb-btn" data-auction-bid-cancel>❌ 취소</button>
          </div>`;
      }

      content = `
        <div class="gb-panel" style="border:1px solid rgba(251,191,36,0.4);">
          <div class="gb-section-title">🔨 경매 참여 중</div>
          ${it ? `<div class="gb-sub"><strong>${escapeHtml(it.name||it.id)}</strong> <span class="gb-badge">${escapeHtml(it.rank||'E')}</span> 시장가: ${fmt(bidState.marketPrice)}</div>` : ''}
          <div style="background:#0b0d12;border:1px solid rgba(148,163,184,0.1);border-radius:6px;padding:8px;margin:8px 0;max-height:200px;overflow-y:auto;" id="gb-auction-log">${logHtml}</div>
          ${actionArea}
        </div>`;
    } else {
      const browseType = model.state.auctionBrowseType || 'equip';
      const browseSubTabs = `<div class="gb-btn-row" style="margin-bottom:6px;">
        <button class="gb-btn${browseType==='equip'?' primary':''}" data-auction-browse-type="equip">⚔️ 장비 & 스킬북</button>
        <button class="gb-btn${browseType==='raremat'?' primary':''}" data-auction-browse-type="raremat">💎 희귀재료</button>
      </div>`;
      const rankFilter = model.state.auctionRankFilter || '';
      const searchQ = (model.state.auctionSearchQ || '').trim().toLowerCase();

      const rankBtns = ['','E','D','C','B','A','S'].map(r =>
        `<button class="gb-btn${rankFilter===r?' primary':''}" data-auction-rank="${escapeHtml(r)}">${r||'전체'}</button>`
      ).join('');

      let listingsHtml = '';
      let totalCount = 0;

      if (browseType === 'raremat') {
        // 희귀재료 매물
        const rareMatListings = (model.db.auctionRareMats || []);
        const filteredMats = rareMatListings.filter(l => {
          const it = l.item;
          const rankOk = !rankFilter || (it.rank||'E') === rankFilter;
          const searchOk = !searchQ || (it.name||it.id||'').toLowerCase().includes(searchQ) || (it.note||'').toLowerCase().includes(searchQ) || (it.traitId && (EQUIP_TRAIT_LABELS[it.traitId]||it.traitId).toLowerCase().includes(searchQ));
          return rankOk && searchOk;
        });
        totalCount = filteredMats.length;
        listingsHtml = filteredMats.length === 0
          ? '<div class="gb-sub">검색 결과 없음.</div>'
          : filteredMats.map(l => {
              const it = l.item;
              const mktPrice = l.marketPrice || it.suggestedPrice || 0;
              const traitTxt = it.traitId ? `<span class="gb-badge" style="background:#7c3aed;">${escapeHtml(equipTraitDisplay(it.traitId, it.rank))}</span>` : '';
              const npcBadge = l.isNpc ? '<span class="gb-badge">NPC</span>' : '<span class="gb-badge" style="background:#0284c7;">플레이어</span>';
              return `<div class="gb-unit" style="margin-bottom:6px;padding:8px;border:1px solid rgba(148,163,184,0.15);border-radius:6px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                  <div>
                    <strong>${escapeHtml(it.name||it.id)}</strong>
                    <span class="gb-badge">${escapeHtml(it.rank||'E')}</span>
                    <span class="gb-badge">희귀재료</span>
                    ${npcBadge} ${traitTxt}
                    <div class="gb-sub">${escapeHtml(it.note||'')}</div>
                    <div class="gb-sub">시장가: ${fmt(mktPrice)}</div>
                  </div>
                  <button class="gb-btn primary" data-auction-bid-raremat="${escapeHtml(l.id)}" data-auction-bid-mkt="${mktPrice}" style="white-space:nowrap;">🔨 경매 참여</button>
                </div>
              </div>`;
            }).join('');
      } else {
        // 장비 & 스킬북 매물
        const listings = model.db.auctionListings;
        const filtered = listings.filter(l => {
          const it = l.item;
          const rankOk = !rankFilter || (it.rank||'E') === rankFilter;
          const searchOk = !searchQ || (it.name||it.id||'').toLowerCase().includes(searchQ) ||
            (it.note||'').toLowerCase().includes(searchQ) ||
            ((it.traits||[]).some(t => (EQUIP_TRAIT_LABELS[t]||t).includes(searchQ)));
          const rarityOk = !it.rarity || (it.rarity !== 'Unique' && it.rarity !== 'Legendary');
          return rankOk && searchOk && rarityOk;
        });
        totalCount = filtered.length;
        listingsHtml = filtered.length === 0
          ? '<div class="gb-sub">검색 결과 없음.</div>'
          : filtered.map(l => {
              const it = l.item;
              const mktPrice = l.marketPrice || it.price || it.suggestedPrice || 0;
              const isEquip = it.category === 'equipment';
              const isSkillbook = it.category === 'skillbook';
              const traitTxt = isEquip && (it.traits||[]).length ? `<span class="gb-badge" style="background:#7c3aed;">${(it.traits||[]).map(t=>equipTraitDisplay(t, it.rank)).join(', ')}</span>` : (!isEquip && !isSkillbook && it.traitId ? `<span class="gb-badge" style="background:#7c3aed;">${escapeHtml(equipTraitDisplay(it.traitId, it.rank))}</span>` : '');
              const npcBadge = l.isNpc ? '<span class="gb-badge">NPC</span>' : '<span class="gb-badge" style="background:#0284c7;">플레이어</span>';
              const catBadge = isEquip ? `<span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part]||it.part||'')}</span>` : isSkillbook ? `<span class="gb-badge" style="background:#d97706;">📖 스킬북 T${it.skillTier||'?'}</span>` : '<span class="gb-badge">희귀재료</span>';
              return `<div class="gb-unit" style="margin-bottom:6px;padding:8px;border:1px solid rgba(148,163,184,0.15);border-radius:6px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                  <div>
                    <strong style="${rarityStyle(it.rarity)}">${escapeHtml(it.name||it.id)}</strong>
                    <span class="gb-badge">${escapeHtml(it.rank||'E')}</span>
                    ${catBadge}
                    ${isEquip && it.rarity && it.rarity !== 'Normal' ? `<span class="gb-badge" style="background:${rarityColor(it.rarity)};color:#000;">${escapeHtml(it.rarity)}</span>` : ''}
                    ${npcBadge} ${traitTxt}
                    ${isEquip ? `<div class="gb-sub">${it.part === 'armor' && it.armorSubtype && ARMOR_SUBTYPES[it.armorSubtype] ? '['+ARMOR_SUBTYPES[it.armorSubtype].label+'] ' : ''}${it.atk ? 'ATK+'+it.atk+' | ' : ''}${it.pdef ? 'PDEF+'+it.pdef+' | ' : ''}${it.mdef ? 'MDEF+'+it.mdef+' | ' : ''}주입 최대 ${it.maxInfuse||1}회 | 내구 ${it.durability||100}/${it.maxDurability||100}</div>` : ''}
                    ${isSkillbook ? `<div class="gb-sub">${escapeHtml(it.note||'')}</div>` : ''}
                    <div class="gb-sub">시장가: ${fmt(mktPrice)}</div>
                  </div>
                  <button class="gb-btn primary" data-auction-bid="${escapeHtml(l.id)}" data-auction-bid-mkt="${mktPrice}" style="white-space:nowrap;">🔨 경매 참여</button>
                </div>
              </div>`;
            }).join('');
      }

      content = `
        ${browseSubTabs}
        <div class="gb-sub" style="margin-bottom:6px;">소지금: ${fmt(gold)} | 총 ${totalCount}개 항목</div>
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <input class="gb-input" id="gb-auction-search" type="text" placeholder="이름·특성 검색..." value="${escapeHtml(model.state.auctionSearchQ||'')}" style="flex:1;">
        </div>
        <div class="gb-btn-row">${rankBtns}</div>
        <button class="gb-btn" data-auction-refresh style="margin-bottom:8px;">🔄 NPC 목록 갱신 (${(() => { const today = new Date().toISOString().slice(0,10); const cnt = (model.state.auctionRefreshDate === today) ? (model.state.auctionRefreshCount || 0) : 0; return `${3 - cnt}/3`; })()})</button>
        <div>${listingsHtml}</div>`;
    }

  } else if (tab === 'manastone') {
    // 마정석 거래 탭 — 등급별 카테고리, 순도 91~100 모두 표시
    const fmt2 = fmt;
    const MANA_RANKS = ['E','D','C','B','A','S'];
    let manaHtml = '<div style="display:grid;gap:12px;">';
    for (const r of MANA_RANKS) {
      const wonPer = MANA_STONE_WON_PER_PCT[r] || 1000;
      const label = MANA_STONE_LABELS[r] || (r + '급 마정석');
      manaHtml += `<details open style="border:1px solid rgba(148,163,184,0.15);border-radius:6px;padding:6px;">
        <summary style="cursor:pointer;font-weight:bold;padding:4px;">💎 ${escapeHtml(label)} <span class="gb-badge">${r}급</span></summary>
        <div style="display:grid;gap:4px;padding:4px 0;">`;
      for (let pur = 100; pur >= 91; pur--) {
        const baseVal = wonPer * pur;
        const sellPrice = Math.round(baseVal * 1.20);
        const canAfford = gold >= sellPrice;
        manaHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;background:rgba(15,23,42,0.4);border-radius:4px;">
            <div>
              <span style="font-size:0.9em;">${escapeHtml(label)} <span class="gb-badge" style="font-size:0.75em;">순도 ${pur}%</span></span>
              <span class="gb-sub" style="margin-left:6px;">시세: ${fmt2(baseVal)} → 판매가: ${fmt2(sellPrice)}</span>
            </div>
            <button class="gb-btn tiny${canAfford?'':' danger'}" data-buy-manastone="${r}" data-ms-purity="${pur}" data-ms-price="${sellPrice}" ${canAfford?'':'disabled'} style="font-size:0.8em;">
              ₩${fmt2(sellPrice)}
            </button>
          </div>`;
      }
      manaHtml += '</div></details>';
    }
    manaHtml += '</div>';
    content = `
      <div class="gb-sub" style="margin-bottom:6px;">💎 마정석 거래소 — 등급별 마정석을 시세의 120% 가격에 구매할 수 있다. (순도 91~100%)</div>
      <div class="gb-sub" style="margin-bottom:8px;">소지금: ${fmt(gold)}</div>
      ${manaHtml}`;

  } else {
    // 판매 등록 탭
    const sellState = model.state.auctionSell;
    if (sellState && sellState.done === false) {
      // 판매 경매 진행 중 — 단계별 공개 (revealedCount)
      const fullLog = sellState.fullLog || sellState.log || [];
      const revealed = Math.min(sellState.revealedCount ?? fullLog.length, fullLog.length);
      const isDone = revealed >= fullLog.length;
      const logHtml = fullLog.slice(0, revealed).map(l => `<div style="font-size:0.85em;margin-bottom:2px;">${l}</div>`).join('');
      content = `
        <div class="gb-panel" style="border:1px solid rgba(34,197,94,0.4);">
          <div class="gb-section-title">🔨 판매 경매 진행 중</div>
          <div class="gb-sub"><strong>${escapeHtml(sellState.itemName||'')}</strong> — 시장가: ${fmt(sellState.marketPrice)}</div>
          <div style="background:#0b0d12;border:1px solid rgba(148,163,184,0.1);border-radius:6px;padding:8px;margin:8px 0;max-height:200px;overflow-y:auto;" id="gb-sell-auction-log">${logHtml}${!isDone ? '<div style="color:#94a3b8;font-size:0.8em;animation:gb-blink 1s infinite;">⏳ 입찰 대기 중...</div>' : ''}</div>
          ${isDone ? `
          <div class="gb-sub" style="color:#22c55e;">최종 낙찰가: <strong>${fmt(sellState.finalPrice)}</strong></div>
          <div class="gb-btn-row">
            <button class="gb-btn primary" data-auction-sell-confirm>✅ 판매 완료 (+${fmt(sellState.finalPrice)})</button>
          </div>` : ''}
        </div>`;
    } else {
      const myListings = (model.db.auctionListings||[]).filter(l => !l.isNpc);
      const selKey = model.state.auctionSellSel || '';
      const listableItems = (inv.items||[]).filter(it =>
        (it.category === 'equipment') || (it.category === 'rareMaterial' && Number(it.suggestedPrice||0) > 0)
      );

      const itemListHtml = listableItems.length === 0
        ? '<div class="gb-sub">등록할 수 있는 장비나 희귀재료가 없다.</div>'
        : listableItems.map(it => {
            const ikey = inventoryItemKey(it);
            const isEq = it.category === 'equipment';
            const mktPrice = isEq ? Number(it.price || calcEquipBasePrice(it.rank||'E', it.part||'weapon')) : Number(it.suggestedPrice||0);
            const traitTxt = isEq && (it.traits||[]).length ? ` [${(it.traits||[]).map(t=>equipTraitDisplay(t, it.rank)).join(', ')}]` : '';
            return `<button class="gb-list-item ${ikey===selKey?'is-active':''}" data-auction-sell-sel="${escapeHtml(ikey)}">
              <strong>${escapeHtml(it.name||it.id)}</strong>${escapeHtml(traitTxt)}
              <span class="gb-badge">${escapeHtml(it.rank||'E')}</span>
              ${isEq ? `<span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part]||it.part||'')}</span>` : '<span class="gb-badge">희귀재료</span>'}
              <div class="gb-sub">시장가: ${fmt(mktPrice)}</div>
            </button>`;
          }).join('');

      let listActionHtml = '';
      if (selKey) {
        const it = listableItems.find(x => inventoryItemKey(x) === selKey);
        if (it) {
          const isEq = it.category === 'equipment';
          const mktPrice = isEq ? Number(it.price || calcEquipBasePrice(it.rank||'E', it.part||'weapon')) : Number(it.suggestedPrice||0);
          listActionHtml = `
            <div style="margin-top:10px;padding:10px;border:1px solid rgba(34,197,94,0.25);border-radius:6px;">
              <div class="gb-sub">📋 경매 등록: <strong>${escapeHtml(it.name||it.id)}</strong></div>
              <div class="gb-sub">시장가: ${fmt(mktPrice)} | 시작가 85% ~ 최대 200%</div>
              <div class="gb-sub" style="color:#94a3b8;font-size:0.8em;">85%에서 시작해 확률적으로 10%씩 상승합니다.</div>
              <div class="gb-btn-row" style="margin-top:8px;">
                <button class="gb-btn primary" data-auction-sell-start="${escapeHtml(selKey)}" data-auction-sell-mkt="${mktPrice}">🔨 경매 시작</button>
              </div>
            </div>`;
        }
      }

      const myListHtml = myListings.length === 0
        ? '<div class="gb-sub" style="margin-top:8px;">등록된 물품 없음.</div>'
        : myListings.map(l => `<div class="gb-unit" style="display:flex;align-items:center;justify-content:space-between;padding:6px;border:1px solid rgba(148,163,184,0.1);border-radius:4px;margin-bottom:4px;">
            <span>${escapeHtml(l.item.name||l.item.id)} — <strong>${fmt(l.askPrice)}</strong></span>
            <button class="gb-btn" data-auction-cancel="${escapeHtml(l.id)}">취소</button>
          </div>`).join('');

      content = `
        <div class="gb-grid db">
          <div class="gb-panel">
            <div class="gb-section-title">인벤토리 (장비·희귀재료)</div>
            <div class="gb-sub">소지금: ${fmt(gold)}</div>
            <div style="margin-top:8px;">${itemListHtml}</div>
            ${listActionHtml}
          </div>
          <div class="gb-panel">
            <div class="gb-section-title">등록한 물품</div>
            ${myListHtml}
          </div>
        </div>`;
    }
  }

  return `
    <div class="gb-panel">
      <div class="gb-section-title">🏷️ 중앙 경매장 (2F)</div>
      <div class="gb-sub">희귀 드랍 장비·희귀재료 거래. 검색 후 경매 참여 가능.</div>
      ${tabBar}
      <div style="margin-top:10px;">${content}</div>
    </div>`;
}

function renderAssociationView() {
  const floor = model.state.assocFloor || '1F';
  const gs = gateStateSafe();
  const run = gs.run;
  const floorButtons = ASSOC_FLOORS.map(f =>
    `<button class="gb-btn ${floor === f.id ? 'primary' : ''}" data-assoc-floor="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`
  ).join('');

  const lorePanel = `
    <div class="gb-panel">
      <div class="gb-section-title">🏛️ 헌터 협회 (서울 종로 본부)</div>
      <div class="gb-sub">${escapeHtml(ASSOC_LORE)}</div>
      <div class="gb-btn-row">${floorButtons}</div>
    </div>`;

  let floorContent = '';

  if (floor === '1F') {
    // ── 1F: 정산 카운터 ────────────────────────────────────────────────────────
    const st = model.state;
    const partyCount = st.settlePartyCount || '3';
    const settleType = st.settleType || 'association';
    const guildPct  = st.settleGuildPct  || '40';
    const settleDate = st.settleDate || '';
    const isGuild   = settleType === 'guild';

    // 판매할 아이템 선택 UI (항상 표시)
    const inv = getInventory();
    const fmtS = n => { const v = Math.floor((n||0) / 10) * 10; return v >= 1e8 ? `${(v/1e8).toFixed(2)}억원` : `${v.toLocaleString('en-US')}원`; };
    // ── 아이템 단가 계산 헬퍼 ────────────────────────────────────────────────
    const calcSellPrice = (it, guild) => calcInventorySellPrice(it, guild);
    const sellableItems = (inv.items||[]).filter(it => {
      if (it.category === 'equipment') {
        // 중고 장비(사용 이력 있음)는 협회에서 판매 불가 — 헌터마켓 이용
        const isUsed = it.isUsed || Number(it.maxDurability ?? 100) < 100 || Number(it.durability ?? 100) < Number(it.maxDurability ?? 100);
        return !isUsed;
      }
      return it.category === 'rareMaterial' || it.category === 'normalMaterial' || it.category === 'manaStone';
    });
    const settleItemSel = st.settleItemSel || {};
    const selectedTotal = sellableItems.reduce((sum, it) => {
      const key = inventoryItemKey(it);
      if (!settleItemSel[key]) return sum;
      return sum + calcSellPrice(it, isGuild);
    }, 0);
    const team = Array.isArray(model.db.team) ? model.db.team : [];
    const totalRatio = team.reduce((s, m) => s + Number(m.ratio||10), 0);

    const sellItemsHtml = sellableItems.length === 0
      ? '<div class="gb-sub">인벤토리에 판매 가능한 아이템이 없다.</div>'
      : sellableItems.map(it => {
          const key = inventoryItemKey(it);
          const sel = !!settleItemSel[key];
          const price = calcSellPrice(it, isGuild);
          return `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.08);cursor:pointer;">
            <input type="checkbox" data-settle-item-sel="${escapeHtml(key)}" ${sel?'checked':''}>
            <span style="flex:1;font-size:12px;"><strong>${escapeHtml(it.name||it.id)}</strong> <span class="gb-badge">${escapeHtml(it.rank||'')}</span>${it.count>1?` ×${it.count}`:''}</span>
            <span style="font-size:11px;color:#94a3b8;">${fmtS(price)}</span>
          </label>`;
        }).join('');

    // ── 아이템 선택 기반 정산 계산 (게이트 무관) ──────────────────────────────
    const ASSOC_FEE = 0.05; // 5%
    const GUILD_FEE = 0.05; // 5% (간단화)
    const feeRate = isGuild ? GUILD_FEE : ASSOC_FEE;
    const feeLabel2 = isGuild ? '세액' : '세액&협회 수수료';
    const partyN = Math.max(1, team.length > 0 ? team.length : parseInt(partyCount, 10));

    // 팀 인원 기반 계산
    const itemFee = Math.floor(selectedTotal * feeRate);
    const itemNet = selectedTotal - itemFee;
    const itemPerPerson = Math.floor(itemNet / partyN);
    const guildShareAmt = isGuild ? Math.floor(itemPerPerson * (parseInt(guildPct,10)/100)) : 0;
    const itemFinal = itemPerPerson - guildShareAmt;

    // 팀 배분 미리보기 (파티원 개인별)
    const teamDistHtml = (team.length > 0 && totalRatio === 100 && selectedTotal > 0) ? team.map(m => {
      const share = Math.floor(itemNet * (m.ratio||10) / 100);
      const allChars = model.db.characters || [];
      const allPersonas = model.db.personas || [];
      const char = allChars.find(c => c.id === m.charId) || allPersonas.find(p => p.id === m.charId);
      const charName = m.charId === '__shared__' ? '공용 인벤' : (char ? (char.name||m.charId) : m.charId);
      return `<div class="gb-sub">• ${escapeHtml(charName)} (${m.ratio||10}%) → <strong>${fmtS(share)}</strong></div>`;
    }).join('') : '';

    // 선택된 아이템 목록 (체크된 것만)
    const selectedItemLines = sellableItems.filter(it => settleItemSel[inventoryItemKey(it)]).map(it => {
      const price = calcSellPrice(it, isGuild);
      const countTxt = it.count > 1 ? ` ×${it.count}` : '';
      return `<div class="gb-sub">• [${escapeHtml(it.rank||'E')}] ${escapeHtml(it.name||it.id)}${countTxt} = ${fmtS(price)}</div>`;
    }).join('');

    const calcSheetHtml = selectedTotal > 0 ? `
    <div style="background:#0b0d12;border:1px solid rgba(148,163,184,0.14);border-radius:8px;padding:8px;margin-top:8px;">
      ${selectedItemLines ? `<div style="font-weight:600;margin-bottom:4px;">[원하는 아이템만 체크]</div>${selectedItemLines}<div class="gb-rule" style="margin:6px 0;"></div>` : ''}
      <div style="font-weight:600;margin-bottom:4px;">[총액]</div>
      <div class="gb-sub">▶ 총합 = ${fmtS(selectedTotal)}</div>
      <div class="gb-sub">▶ ${feeLabel2} = ${fmtS(itemFee)}</div>
      <div class="gb-sub">▶ 세후 정산액 = ${fmtS(itemNet)}</div>
      ${teamDistHtml ? `<div class="gb-rule" style="margin:6px 0;"></div><div style="font-weight:600;margin-bottom:4px;">팀 배분 미리보기</div>${teamDistHtml}` : `<div style="font-weight:600;margin:6px 0 2px;">[개인 정산액] (${partyN}인 기준)</div><div class="gb-sub">▶ 개인 정산액 = ${fmtS(itemNet)} × 1/${partyN} = ${fmtS(itemPerPerson)}</div>${isGuild && guildShareAmt > 0 ? `<div class="gb-sub">▶ 길드 지분(${guildPct}%) = ${fmtS(guildShareAmt)}</div>` : ''}<div class="gb-sub" style="font-weight:700;color:#fbbf24;">▶ 최종 정산액 = ${fmtS(itemFinal)}</div>`}
    </div>` : '';

    // 통합 정산 패널 (아이템 선택 판매)
    const settleFormPanel = `
      <div class="gb-panel">
        <div class="gb-section-title">📋 정산 카운터</div>
        <div class="gb-grid two" style="margin-top:4px;">
          <label>정산 방식
            <select class="gb-input" id="gb-settle-type">
              ${['association','guild'].map(v => `<option value="${v}"${settleType===v?' selected':''}>${v==='association'?'협회 정산':'길드 정산'}</option>`).join('')}
            </select>
          </label>
          <label>정산 날짜 <span class="gb-sub">(소득 기록용)</span>
            <input class="gb-input" id="gb-settle-date" type="text" placeholder="예: 2026-03-14" value="${escapeHtml(settleDate)}" style="width:130px;">
          </label>
          ${team.length === 0 ? `<label>파티 인원 (팀 없을 때)<input class="gb-input" id="gb-settle-party-manual" type="number" min="1" max="20" value="${escapeHtml(partyCount)}" style="width:70px;"></label>` : ''}
          ${isGuild ? `<label>길드 지분 %<input class="gb-input" id="gb-settle-guild-pct" type="number" min="0" max="100" value="${escapeHtml(guildPct)}"></label>` : ''}
        </div>
        <div class="gb-rule" style="margin-top:12px;margin-bottom:8px;"></div>
        <div class="gb-section-title">💰 판매할 아이템 선택</div>
        <div class="gb-sub" style="margin-bottom:6px;">원하는 아이템만 체크. 팔기 전 아래 계산 확인 후 정산하라. <span style="color:#f97316;">⚠️ 중고 장비(사용 이력 있음)는 헌터마켓에서만 판매 가능.</span></div>
        <div style="max-height:220px;overflow-y:auto;border:1px solid rgba(148,163,184,0.15);border-radius:6px;padding:6px;">${sellItemsHtml}</div>
        <div class="gb-btn-row" style="margin-top:6px;">
          <button class="gb-btn tiny" id="gb-settle-item-sel-all">전체 선택</button>
          <button class="gb-btn tiny" id="gb-settle-item-sel-none">전체 해제</button>
        </div>
        ${calcSheetHtml}
        ${selectedTotal > 0 ? `
        ${team.length > 0 && totalRatio !== 100 ? `<div class="gb-sub" style="color:#ef4444;margin-top:4px;">팀 비율 합계 ${totalRatio}% (100% 필요)</div>` : ''}
        <div class="gb-btn-row" style="margin-top:8px;">
          ${team.length > 0 && totalRatio === 100 ? `<button class="gb-btn primary" id="gb-direct-sell-team">✅ 팀 비율로 분배 정산</button>` : `<button class="gb-btn primary" id="gb-direct-sell-single">✅ 공용 인벤으로 정산</button>`}
        </div>` : ''}
      </div>`;

    // ── 소득 기록 로그 ─────────────────────────────────────────────────────────
    const incomeLog = Array.isArray(model.db.incomeLog) ? model.db.incomeLog : [];
    const incomeLogHtml = incomeLog.length
      ? incomeLog.slice().reverse().map((r, idx) => {
          const isGuildEntry = r.type === 'guild';
          return `<div class="gb-unit" style="border-bottom:1px solid rgba(148,163,184,0.1);padding-bottom:6px;margin-bottom:6px;">
            <div class="gb-unit-top">
              <div>
                <strong>${escapeHtml(r.date || '날짜 미입력')}</strong>
                <span class="gb-badge">${isGuildEntry ? '길드' : '협회'}</span>
                <span class="gb-sub"> — ${escapeHtml(r.runTitle || '?')}</span>
                ${r.participant ? `<span class="gb-sub"> / <strong>${escapeHtml(r.participant)}</strong>${r.ratio ? ` ${r.ratio}%` : ''}</span>` : ''}
              </div>
              <button class="gb-btn tiny danger" data-income-log-del="${incomeLog.length - 1 - idx}">삭제</button>
            </div>
            <div class="gb-sub">총합 ₩${formatWon(r.gross)} / ${isGuildEntry ? `법인세 ₩${formatWon(r.corpTax||0)}` : `수수료 ₩${formatWon(r.fee||0)}`} / 지급액 <strong style="color:#fbbf24;">₩${formatWon(r.final||0)}</strong></div>
            ${isGuildEntry && r.guildShare ? `<div class="gb-sub">길드 공금 적립 ₩${formatWon(r.guildShare)}</div>` : ''}
          </div>`;
        }).join('')
      : '<div class="gb-sub">— 기록된 정산 내역이 없다. 정산 시 날짜를 입력하면 자동 기록됨. —</div>';

    const logPanel = `
      <div class="gb-panel">
        <div class="gb-section-title">📜 소득 기록 (세금 신고용)</div>
        <div class="gb-sub" style="margin-bottom:6px;">협회 및 길드 정산 이력. 개인 소득세 신고 참고용. 블랙마켓 거래는 기록되지 않는다.</div>
        ${incomeLogHtml}
      </div>`;

    // Monthly income tax calculator + pay button
    const taxIncome  = st.taxIncome || '';
    const taxMonth   = st.taxPayMonth || '';
    const taxResult  = taxIncome ? calcMonthlyIncomeTax(Number(taxIncome)) : null;
    // Count records matching taxPayMonth
    const incomeLogAll = Array.isArray(model.db.incomeLog) ? model.db.incomeLog : [];
    const matchCount   = taxMonth ? incomeLogAll.filter(r => (r.date || '').startsWith(taxMonth)).length : 0;
    const taxPanel = `
      <div class="gb-panel">
        <div class="gb-section-title">🧾 월 소득세 계산기 (개인)</div>
        <div class="gb-sub">기준: 월 총 소득 / 공식: (총소득 × 세율) − 누진공제액</div>
        <label>월 총 소득 (원)
          <input class="gb-input" id="gb-tax-income" type="number" value="${escapeHtml(taxIncome)}" placeholder="예: 3000000">
        </label>
        <div class="gb-btn-row"><button class="gb-btn" id="gb-tax-calc">세액 계산</button></div>
        ${taxResult !== null ? `<div class="gb-sub" style="color:#fbbf24;font-weight:700;margin-top:8px;">▶ 예상 소득세 = ₩${formatWon(taxResult)}</div><div class="gb-sub">▶ 세후 실수령 = ₩${formatWon(Number(taxIncome) - taxResult)}</div>` : ''}
        <div class="gb-sub" style="margin-top:8px;">세율 구간: 1백만 이하 6% / ~4백만 15% / ~750만 24% / ~1250만 35% / ~2500만 38% / ~4200만 40% / ~8500만 42% / 초과 45%</div>
        <div style="margin-top:10px;border-top:1px solid rgba(148,163,184,0.2);padding-top:8px;">
          <div class="gb-sub" style="font-weight:600;margin-bottom:4px;">💸 납부 완료 처리 — 해당 월 기록 삭제</div>
          <div class="gb-sub">납부한 달을 입력하면 그 달의 소득 기록이 삭제된다 (날짜 앞 7자리 기준, 예: 2026-03).</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap;">
            <input class="gb-input" id="gb-tax-pay-month" type="text" placeholder="예: 2026-03" value="${escapeHtml(taxMonth)}" style="width:110px;">
            <button class="gb-btn" id="gb-tax-pay-preview">미리보기 (${matchCount}건)</button>
            <button class="gb-btn danger" id="gb-tax-pay-confirm" ${!taxMonth ? 'disabled' : ''}>✅ 납부 완료 — 기록 삭제</button>
          </div>
        </div>
      </div>`;

    const applicationPanel = `
      <div class="gb-panel">
        <div class="gb-section-title">📝 게이트 신청 창구</div>
        <div class="gb-sub">공식 게이트 신청 및 등급 심사. 게이트 탭에서 생성 후 여기서 공식 등록 가능. (기능 확장 예정)</div>
      </div>`;

    floorContent = settleFormPanel + logPanel + taxPanel + applicationPanel;

  } else if (floor === '2F') {
    floorContent = renderAuctionHouseHtml();
  } else if (floor === '4F') {
    floorContent = `
      <div class="gb-panel">
        <div class="gb-section-title">📊 인사부 (4F) — 측정·등록·평가팀</div>
        <div class="gb-sub">첨단 하이테크 장비를 이용한 마나 측정 및 공식 랭크 부여. 헌터 등록 및 재측정도 이 층에서 진행된다.</div>
        <div class="gb-sub" style="margin-top:8px;">— 랭크 판정 기능 확장 예정. —</div>
      </div>`;
  } else if (floor === '7F') {
    floorContent = `
      <div class="gb-panel">
        <div class="gb-section-title">🔧 엔지니어 로비 (7F)</div>
        <div class="gb-sub">게이트 감지 시스템, 분석 장비, 기술 연구팀이 운영하는 층. 게이트 구조 분석 및 예측 보고서를 발행한다.</div>
        <div class="gb-sub" style="margin-top:8px;">— 게이트 분석 기능 확장 예정. —</div>
      </div>`;
  } else if (floor === 'B5F') {
    floorContent = `
      <div class="gb-panel">
        <div class="gb-section-title">🔬 특수 연구 시설 (B5F)</div>
        <div class="gb-sub">비공개 구역. 희귀 마법 현상 연구, 격리된 마수 표본 보관, 고위험 실험 시설이 위치한다. S랭크 헌터 및 특별 허가자만 출입 가능.</div>
      </div>`;
  }

  return `
    ${lorePanel}
    ${floorContent}
    <div class="gb-btn-row"><button class="gb-btn" data-go="hub">← 허브로</button></div>`;
}

// ── 상점 (Shop) ──────────────────────────────────────────────────────────────
const SHOP_ITEMS = {
  convenience: [], // 편의점 식량은 getConvFoodDb()에서 동적으로 로드
  consumable: [
    { id:'pickaxe_E',  name:'E급 곡괭이',  price:70000,      unit:'개', note:'E등급 광맥 채굴용 (2.5kg)', buildFn: () => buildPickaxeItem('E', 1) },
    { id:'pickaxe_D',  name:'D급 곡괭이',  price:300000,     unit:'개', note:'D등급 광맥 채굴용 (2.5kg)', buildFn: () => buildPickaxeItem('D', 1) },
    { id:'pickaxe_C',  name:'C급 곡괭이',  price:2000000,    unit:'개', note:'C등급 광맥 채굴용 (2.5kg)', buildFn: () => buildPickaxeItem('C', 1) },
    { id:'pickaxe_B',  name:'B급 곡괭이',  price:10000000,   unit:'개', note:'B등급 광맥 채굴용 (2.5kg)', buildFn: () => buildPickaxeItem('B', 1) },
    { id:'pickaxe_A',  name:'A급 곡괭이',  price:70000000,   unit:'개', note:'A등급 광맥 채굴용 (2.5kg)', buildFn: () => buildPickaxeItem('A', 1) },
    { id:'pickaxe_S',  name:'S급 곡괭이',  price:250000000,  unit:'개', note:'S등급 광맥 채굴용 (2.5kg)', buildFn: () => buildPickaxeItem('S', 1) },
    { id:'bag_E', name:'E급 기본가방',     price:30000,      unit:'개', note:'+8칸/무게+7kg', buildFn: () => buildBagItem('bag_E', 1) },
    { id:'bag_D', name:'D급 멀티백',       price:70000,      unit:'개', note:'+12칸/무게+10kg/무게효율5%', buildFn: () => buildBagItem('bag_D', 1) },
    { id:'bag_C', name:'C급 마정백팩',     price:270000,     unit:'개', note:'+16칸/무게+15kg/무게효율10%', buildFn: () => buildBagItem('bag_C', 1) },
    { id:'bag_B', name:'B급 원정필드백',   price:750000,     unit:'개', note:'+20칸/무게+20kg/무게효율15%', buildFn: () => buildBagItem('bag_B', 1) },
    { id:'bag_A', name:'A급 게이트백팩',   price:2300000,    unit:'개', note:'+24칸/무게+25kg/무게효율20%', buildFn: () => buildBagItem('bag_A', 1) },
    { id:'bag_S', name:'S급 마정공간백팩', price:7500000,    unit:'개', note:'+28칸/무게+30kg/무게효율30%', buildFn: () => buildBagItem('bag_S', 1) },
    { id:'tent_E', name:'E급 기본원터치텐트',   price:130000,    unit:'개', note:'효과없음 (3kg)', buildFn: () => buildTentItem('E', 1) },
    { id:'tent_D', name:'D급 필드원터치텐트',   price:350000,    unit:'개', note:'야영효율+5% (6kg)', buildFn: () => buildTentItem('D', 1) },
    { id:'tent_C', name:'C급 게이트필드텐트',   price:870000,    unit:'개', note:'야영효율+10% (9kg)', buildFn: () => buildTentItem('C', 1) },
    { id:'tent_B', name:'B급 럭셔리야영텐트',   price:2300000,   unit:'개', note:'야영효율+15% (12kg)', buildFn: () => buildTentItem('B', 1) },
    { id:'tent_A', name:'A급 스타야영지',       price:7200000,   unit:'개', note:'야영효율+20% (15kg)', buildFn: () => buildTentItem('A', 1) },
    { id:'tent_S', name:'S급 게이트펜션야영지', price:38000000,  unit:'개', note:'야영효율+30% (20kg)', buildFn: () => buildTentItem('S', 1) },
  ],
};
SHOP_ITEMS.potion = POTION_CATALOG.map(p => ({
  id: p.id, name: p.name, price: p.price, unit:'개',
  note: p.note || '',
  buildFn: () => buildPotionItem(p, 1)
}));
const SHOP_CATEGORIES = [
  { id:'convenience',  label:'🏪 편의점',    desc:'식료품, 음료, 기본 보급품.' },
  { id:'department',   label:'🏬 백화점',    desc:'의류, 생활용품, 일반 장비.' },
  { id:'hunterstreet', label:'🗡️ 헌터거리',  desc:'헌터 전용 상점가. 수리점·대장간·소모품 등.' },
  { id:'huntermarket', label:'🏷️ 헌터마켓',  desc:'헌터 간 중고장비 거래 플랫폼. 스킬북은 협회 중앙 경매장 전용.' },
  { id:'blackmarket',  label:'🖤 블랙마켓',  desc:'불법 거래소. 수수료 0%·세금 0%. 적발 위험 있음.' },
];
const HUNTER_STREET_SUBS = [
  { id:'vehicle',    label:'헌터 차량 판매점', desc:'전술 차량, 오토바이, 장갑차 등. (예정)' },
  { id:'equip',      label:'⚔️ 장비상점',     desc:'무기, 방어구, 헌터 전용 장비 구매·판매.' },
  { id:'repair',     label:'수리점',           desc:'무기/방어구 내구도 회복. E등급 무료. 수리마다 최대내구도 -1 (최소 80).' },
  { id:'forge',      label:'대장간',           desc:'같은 등급 마정석(순도 80~100%)으로 장비 강화. 실패 시 마정석 소멸, 장비 유지.' },
  { id:'potion',     label:'물약 상점',        desc:'회복약, 마나포션, 해독제, CC회복, 저주해제, 버프 아이템.' },
  { id:'consumable', label:'소모품 상점',      desc:'곡괭이, 야영 보급품, 기타 소모품.' },
  { id:'material',   label:'재료 상점',        desc:'일반·희귀 재료 구매 및 판매. 검색·필터 지원.' },
];
function shopItemsHtml(items, cat) {
  if (!items || !items.length) return '<div class="gb-sub">현재 판매 중인 상품이 없다.</div>';
  const inv = getActiveInventory();
  return items.map(it => {
    const canAfford = Number(inv.gold || 0) >= it.price;
    return `<div class="gb-unit">
      <div class="gb-unit-top">
        <div><strong>${escapeHtml(it.name)}</strong> ${it.note ? `<span class="gb-sub">${escapeHtml(it.note)}</span>` : ''}</div>
        <div><button class="gb-btn tiny${canAfford ? '' : ' danger'}" data-shop-buy="${escapeHtml(cat)}:${escapeHtml(it.id)}" ${canAfford ? '' : 'disabled'}>₩${Number(it.price).toLocaleString('en-US')} / ${escapeHtml(it.unit)}</button></div>
      </div>
    </div>`;
  }).join('');
}

const MAT_SHOP_BUY_MARKUP  = 1.2;   // 상점 판매가 = suggestedPrice × 1.2 (매입 없음)
const MAT_SHOP_PAGE_SIZE   = 20;

function renderMaterialShopHtml() {
  const inv      = getActiveInventory();
  const gold     = Number(inv.gold || 0);
  const query    = String(model.state.shopMatQuery || '').trim().toLowerCase();
  const rankF    = String(model.state.shopMatRank  || '');
  const tierF    = String(model.state.shopMatTier  || '');
  const page     = Number(model.state.shopMatPage  || 0);

  // ── BUY tab (희귀재료 전용, 120% 가격) ──────────────────────────────────
  const rareCatalog = getRareMaterialCatalog();

  let buyPool = rareCatalog.map(it => ({
    _item: it,
    name:  it.name || it.id || '',
    rank:  String(it.rank || 'E').toUpperCase(),
    tier:  it.priceTier || '',
    trait: it.traitName || '',
    price: Math.ceil((it.suggestedPrice || 0) * MAT_SHOP_BUY_MARKUP),
    suggestedPrice: it.suggestedPrice || 0,
  }));

  // Apply filters
  if (query) {
    buyPool = buyPool.filter(b => {
      const traitKo = (b._item.traitName || RARE_TRAIT_LABELS[b._item.traitId || ''] || '').toLowerCase();
      const noteLo  = (b._item.note || '').toLowerCase();
      return (
        b.name.toLowerCase().includes(query) ||
        b.trait.toLowerCase().includes(query) ||
        traitKo.includes(query) ||
        noteLo.includes(query) ||
        (b._item.sourceMonsterName || '').toLowerCase().includes(query) ||
        (b._item.species || '').toLowerCase().includes(query)
      );
    });
  }
  if (rankF) buyPool = buyPool.filter(b => b.rank === rankF);
  if (tierF) buyPool = buyPool.filter(b => b.tier === tierF);

  const total    = buyPool.length;
  const pages    = Math.ceil(total / MAT_SHOP_PAGE_SIZE) || 1;
  const safePage = Math.max(0, Math.min(page, pages - 1));
  const slice    = buyPool.slice(safePage * MAT_SHOP_PAGE_SIZE, (safePage + 1) * MAT_SHOP_PAGE_SIZE);

  const rankOptions = ['','E','D','C','B','A','S'].map(r =>
    `<option value="${r}" ${rankF === r ? 'selected' : ''}>${r || '전체 등급'}</option>`).join('');
  const tierOptions = [['','전체 티어'],['tier1','tier1 — 공격핵심'],['tier2','tier2 — 속성/상태'],['tier3','tier3 — 방어/치유'],['tier4','tier4 — 저항/유틸']].map(([v,l]) =>
    `<option value="${v}" ${tierF === v ? 'selected' : ''}>${l}</option>`).join('');

  const searchBar = `
    <div class="gb-panel">
      <div id="gb-mat-search-form" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        <input id="gb-mat-query" class="gb-input" type="text" placeholder="이름·특성·종족 검색…" value="${escapeHtml(query)}" style="flex:1;min-width:140px;">
        <select id="gb-mat-rank" class="gb-input" style="width:110px;">${rankOptions}</select>
        <select id="gb-mat-tier" class="gb-input" style="width:160px;">${tierOptions}</select>
        <button type="button" id="gb-mat-search-btn" class="gb-btn tiny">🔍 검색</button>
      </div>
      <div class="gb-sub" style="margin-top:4px;">희귀재료 전용 · 결과: ${total}개 / ${pages}페이지 | 구매가 = 기준가 × ${Math.round(MAT_SHOP_BUY_MARKUP * 100)}%</div>
    </div>`;

  let itemsHtml = '';
  if (!slice.length) {
    itemsHtml = '<div class="gb-panel"><div class="gb-sub">검색 결과가 없다.</div></div>';
  } else {
    const rows = slice.map(b => {
      const canAfford = gold >= b.price;
      const tierBadge  = b.tier  ? ` <span class="gb-badge">${escapeHtml(b.tier)}</span>` : '';
      const traitBadge = b.trait ? ` <span class="gb-sub">${escapeHtml(b.trait)}</span>` : '';
      const key = `rare:${escapeHtml(b._item.id || '')}`;
      return `<div class="gb-unit">
        <div class="gb-unit-top">
          <div>
            <strong>${escapeHtml(b.name)}</strong>
            <span class="gb-badge">${escapeHtml(b.rank)}</span>
            <span class="gb-badge">희귀</span>${tierBadge}${traitBadge}
          </div>
          <div>
            <button class="gb-btn tiny${canAfford ? '' : ' danger'}" data-mat-buy="${key}" ${canAfford ? '' : 'disabled'}>
              ₩${b.price.toLocaleString('en-US')}
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
    itemsHtml = `<div class="gb-panel">${rows}</div>`;
  }

  const pageBar = pages > 1 ? `
    <div class="gb-btn-row">
      <button class="gb-btn tiny" data-mat-page="${safePage - 1}" ${safePage <= 0 ? 'disabled' : ''}>◀ 이전</button>
      <span class="gb-sub"> ${safePage + 1} / ${pages} </span>
      <button class="gb-btn tiny" data-mat-page="${safePage + 1}" ${safePage >= pages - 1 ? 'disabled' : ''}>다음 ▶</button>
    </div>` : '';

  return searchBar + itemsHtml + pageBar;
}

// ── 장비상점 ─────────────────────────────────────────────────────────────────
function renderEquipShopHtml() {
  const inv = getActiveInventory();
  const gold = Number(inv.gold || 0);
  const eqs = model.db.equipments || [];
  const selRank = model.state.shopEquipRank || '';
  const selPart = model.state.shopEquipPart || '';

  const rankBtns = ['', 'E', 'D', 'C'].map(r =>
    `<button class="gb-btn ${selRank===r?'primary':''}" data-equip-shop-rank="${escapeHtml(r)}">${r||'전체'}</button>`
  ).join('');
  const partBtns = ['', ...EQUIP_PARTS].map(p =>
    `<button class="gb-btn ${selPart===p?'primary':''}" data-equip-shop-part="${escapeHtml(p)}">${p ? EQUIP_PART_LABELS[p] : '전체'}</button>`
  ).join('');

  // 장비상점: 노말 아이템만, E~C급만 판매
  const SHOP_ALLOWED_RANKS = ['E','D','C'];
  const filtered = eqs.filter(e =>
    (!selRank || e.rank === selRank) && (!selPart || e.part === selPart) && !e.statusType &&
    (!e.rarity || e.rarity === 'Normal') &&
    SHOP_ALLOWED_RANKS.includes(e.rank)
  );

  const itemsHtml = filtered.length === 0
    ? '<div class="gb-sub">조건에 맞는 장비가 없다.</div>'
    : filtered.map(e => {
        const price = (e.price != null && e.price !== '' && Number(e.price) >= 0) ? Number(e.price) : calcEquipEnhancedPrice(calcEquipBasePrice(e.rank, e.part), e.enhance||0, e.rank);
        const canAfford = price === 0 || gold >= price;
        const traitTags = (e.traits||[]).map(t => `<span class="gb-badge">${escapeHtml(equipTraitDisplay(t, e.rank))}</span>`).join(' ');
        const atkLine = e.part==='weapon' ? `ATK+${e.atk||WEAPON_BASE_ATK[e.rank]||0}` : e.part==='subweapon' ? (Number(e.pdef||0)>0 ? `물리방어+${e.pdef} / ATK${-Math.ceil(e.pdef/2)}` : '특수효과 전용') : e.part==='armor' ? `${e.armorSubtype && ARMOR_SUBTYPES[e.armorSubtype] ? '['+ARMOR_SUBTYPES[e.armorSubtype].label+'] ' : ''}물리방어+${e.pdef||0} / 마법방어+${e.mdef||0}${e.resistType?` / ${escapeHtml(EQUIP_TRAIT_LABELS[''+e.resistType]||e.resistType)} 저항 ${e.resistPct||0}%`:''}` : e.part==='accessory' ? (e.traits&&e.traits.length ? `특성: ${(e.traits||[]).map(t=>equipTraitDisplay(t,e.rank)).join(', ')}` : '특성 없음') : '';
        const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 10000 ? `${Math.round(n/10000)}만` : n.toLocaleString('en-US');
        return `<div class="gb-unit">
          <div class="gb-unit-top">
            <div>
              <strong style="${rarityStyle(e.rarity)}">${escapeHtml(e.name)}</strong>
              <span class="gb-badge">${escapeHtml(e.rank)}</span>
              <span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[e.part]||e.part)}</span>
              ${e.rarity && e.rarity !== 'Normal' ? `<span class="gb-badge" style="background:${rarityColor(e.rarity)};color:#000;">${escapeHtml(e.rarity)}</span>` : ''}
              ${e.enhance>0?`<span class="gb-badge">+${e.enhance}</span>`:''}
              ${traitTags}
              <div class="gb-sub">${escapeHtml(atkLine)} | 내구도 ${e.durability??100}/${e.maxDurability??100}</div>
              <div class="gb-sub">${escapeHtml(e.note||'')}</div>
            </div>
            <div>
              <button class="gb-btn tiny${canAfford?'':' danger'}" data-equip-shop-buy="${escapeHtml(e.id)}" ${canAfford?'':'disabled'}>
                ${price === 0 ? '🆓 무료' : `₩${fmt(price)}`}
              </button>
            </div>
          </div>
        </div>`;
      }).join('');

  return `
    <div class="gb-panel">
      <div class="gb-section-title">⚔️ 장비상점</div>
      <div class="gb-sub">E~C급 노말 장비 판매 (협회지급 E급 무기는 무료)</div>
      <div class="gb-sub">소지금: ₩${gold.toLocaleString('en-US')}</div>
      <div class="gb-btn-row" style="margin-top:6px;flex-wrap:wrap;">
        <span class="gb-sub" style="align-self:center;">등급:</span> ${rankBtns}
      </div>
      <div class="gb-btn-row" style="flex-wrap:wrap;">
        <span class="gb-sub" style="align-self:center;">부위:</span> ${partBtns}
      </div>
    </div>
    <div class="gb-panel">${itemsHtml}</div>`;
}

// ── 헌터마켓 (중고장비 거래소) ───────────────────────────────────────────────
const HM_NPC_MAX = 16;

// NPC 중고장비 씨딩: 다양한 등급·부위·내구도로 16개 채움
function seedNpcUsedListings() {
  if (!Array.isArray(model.db.hmUsedListings)) model.db.hmUsedListings = [];
  const npcCount = model.db.hmUsedListings.filter(l => l.isNpc).length;
  const needed = HM_NPC_MAX - npcCount;
  if (needed <= 0) return;
  const grades = ['E','E','E','D','D','D','C','C','B'];
  const parts = EQUIP_PARTS;
  for (let i = 0; i < needed; i++) {
    const rank = grades[Math.floor(Math.random() * grades.length)];
    const part = parts[Math.floor(Math.random() * parts.length)];
    // 현재 내구도: 사용감 있는 중고장비 (40~95 범위)
    const dur = Math.floor(Math.random() * 56) + 40;      // 40~95
    // 최대내구도: 게임 규칙상 최소 80 (EQUIP_MAX_DURABILITY_FLOOR), 최대 99 (100은 새 장비라 헌터마켓 등록 불가)
    const maxDur = Math.max(80, Math.min(99, dur + Math.floor(Math.random() * 10))); // 80~99
    // 강화: 가끔 +1~+3
    const enhance = Math.random() < 0.3 ? Math.floor(Math.random() * 3) + 1 : 0;
    // 특성: 보조무기·악세서리는 항상 1개(내장), 그 외 30% 확률로 1개
    const builtInTraitPart = (part === 'subweapon' || part === 'accessory');
    const hasTrait = builtInTraitPart ? true : (Math.random() < 0.30);
    const traits = hasTrait ? [EQUIP_TRAIT_TYPES[Math.floor(Math.random() * EQUIP_TRAIT_TYPES.length)]] : [];
    const maxInfuseBase = EQUIP_MAX_INFUSE[part] || 1;
    const maxInfuse = (hasTrait && !builtInTraitPart) ? maxInfuseBase + 1 : maxInfuseBase;
    const traitName = hasTrait ? (EQUIP_TRAIT_LABELS[traits[0]] || traits[0]) : '';
    const basePrice = calcEquipRandomPrice(rank, part);
    const enhancedBase = enhance > 0 ? calcEquipEnhancedPrice(basePrice, enhance, rank) : basePrice;
    // 무기·방어구 특성: 희귀재료 기준가 × 1.25
    // 보조무기·악세서리 내장 특성: 티어별 희귀재료 가격 차등 적용
    const builtInTrait = (part === 'subweapon' || part === 'accessory');
    let traitBonus = 0;
    if (hasTrait && !builtInTrait) {
      traitBonus = Math.round((RARE_MATERIAL_BASE_WON[rank] || RARE_MATERIAL_BASE_WON.E) * 1.25);
    } else if (hasTrait && builtInTrait) {
      const tier = TRAIT_TIER_MAP[traits[0]] || 3;
      const tierPrices = RARE_PRICE_BY_RANK_TIER[rank] || RARE_PRICE_BY_RANK_TIER.E;
      const tier4Price = tierPrices.tier4;
      const tierPrice = tierPrices[`tier${tier}`] || tier4Price;
      traitBonus = tierPrice - tier4Price;
    }
    const marketPrice = enhancedBase + traitBonus;
    const conditionMul = calcUsedEquipConditionMul(dur, maxDur);
    const usedPrice = Math.round(marketPrice * conditionMul);
    const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i;
    const _armorSub = part === 'armor' ? (() => { const k = ARMOR_SUBTYPE_KEYS[Math.floor(Math.random()*ARMOR_SUBTYPE_KEYS.length)]; return {key:k,...ARMOR_SUBTYPES[k]}; })() : null;
    const enhLabel = enhance > 0 ? ` +${enhance}` : '';
    // 희귀도 자동 판정
    const { rarity: usedRarity, traitTier: usedTier } = assignEquipRarity(part, traits[0] || '');
    const equipNameStr = generateEquipName(rank, part, _armorSub ? _armorSub.key : null, hasTrait ? traitName : '') + enhLabel;
    const item = {
      id: `npc_used_${rank.toLowerCase()}_${part}_${uid}`,
      name: equipNameStr,
      part, rank, rarity: usedRarity, traitTier: usedTier, enhance, infuse: traits.length, maxInfuse, traits,
      durability: dur, maxDurability: maxDur, price: marketPrice,
      category: 'equipment', isDropped: true, stackable: false,
      unitWeightG: EQUIP_WEIGHT_G[part] || 1000,
      stackKey: `equipment:npc_used_${uid}`,
      note: `NPC 중고 등록${hasTrait ? `. 특성: ${traitName}` : ''}`,
      atk: part === 'weapon' ? (WEAPON_BASE_ATK[rank] || 5) : (part === 'armor' && _armorSub && _armorSub.atkMul ? Math.round((WEAPON_BASE_ATK[rank] || 5) * _armorSub.atkMul) : 0),
      pdef: part === 'armor' ? (() => { const base = (ARMOR_STAT_BY_RANK[rank]||{defRange:[0,5]}).defRange[1]; const [lo,hi] = _armorSub ? _armorSub.defMul : [0.5,0.5]; const mul = lo + Math.random()*(hi-lo); return Math.round(base * mul); })() : (part === 'subweapon' ? Math.round((ARMOR_STAT_BY_RANK[rank]||{defRange:[0,5]}).defRange[1] * 0.25) : 0),
      mdef: part === 'armor' ? (() => { const base = (ARMOR_STAT_BY_RANK[rank]||{defRange:[0,5]}).defRange[1]; const [lo,hi] = _armorSub ? _armorSub.defMul : [0.5,0.5]; const mul = lo + Math.random()*(hi-lo); return Math.round(base * mul); })() : 0,
      mainStat: part === 'weapon' ? (Math.random() < 0.5 ? 'str' : 'int') : (part === 'armor' && _armorSub ? _armorSub.statPool[Math.floor(Math.random() * _armorSub.statPool.length)] : (part === 'armor' ? 'con' : 'str')),
      armorSubtype: _armorSub ? _armorSub.key : undefined,
      armorStatBonusMul: _armorSub ? _armorSub.statBonusMul : undefined,
      resistType: '', resistPct: 0
    };
    model.db.hmUsedListings.push({
      id: `hm_npc_${uid}`, item, usedPrice, conditionPct: Math.round(conditionMul * 100), isNpc: true, listedAt: Date.now()
    });
  }
}

function renderHunterMarketHtml() {
  const inv = getActiveInventory();
  const gold = Number(inv.gold || 0);
  const tab = model.state.shopHmTab || 'sell';
  const selRank = model.state.shopHmRank || '';
  const selPart = model.state.shopHmPart || '';

  const tabBar = `
    <div class="gb-btn-row">
      <button class="gb-btn${tab==='sell'?' primary':''}" data-hm-tab="sell">🔁 내 장비 판매</button>
      <button class="gb-btn${tab==='browse'?' primary':''}" data-hm-tab="browse">🔍 중고 장비 검색</button>
    </div>`;

  const notice = `<div class="gb-panel" style="border-color:#6366f1;">
    <div style="color:#6366f1;font-weight:700;">🏷️ 헌터마켓 — 중고장비 전용</div>
    <div class="gb-sub">헌터 간 직거래 플랫폼. 사용/수리된 장비를 등록·거래할 수 있다.</div>
    <div class="gb-sub" style="color:#94a3b8;">⚠️ 스킬북은 헌터마켓에서 거래 불가. <strong>협회 중앙 경매장</strong>에서만 구매·판매 가능.</div>
    <div class="gb-sub">소지금: ₩${gold.toLocaleString('en-US')}</div>
  </div>`;

  if (tab === 'sell') {
    // Show player's owned equipment in inventory — 내구도 100짜리 (새 것)는 중고 등록 불가
    const ownedEquip = (inv.items||[]).filter(it => it.category === 'equipment');
    const usedEquip = ownedEquip.filter(it => {
      const dur = Number(it.durability ?? 100);
      const maxDur = Number(it.maxDurability ?? 100);
      return !(dur === 100 && maxDur === 100);
    });
    if (!ownedEquip.length) {
      return notice + tabBar + '<div class="gb-panel"><div class="gb-sub">인벤토리에 장비가 없다. 장비상점에서 구매하거나 게이트 보상으로 획득하자.</div></div>';
    }
    if (!usedEquip.length) {
      return notice + tabBar + '<div class="gb-panel"><div class="gb-sub">내구도 100%의 새 장비는 헌터마켓에 올릴 수 없다. 사용·수리 이력이 있는 장비만 등록 가능.</div></div>';
    }
    const rows = usedEquip.map(it => {
      const dur = Number(it.durability ?? 100);
      const maxDur = Number(it.maxDurability ?? 100);
      const basePrice = Number(it.price || calcEquipBasePrice(it.rank||'E', it.part||'weapon'));
      // 강화된 장비면 강화 프리미엄 포함
      const enhancedBase = it.enhance > 0 ? calcEquipEnhancedPrice(basePrice, it.enhance, it.rank||'E') : basePrice;
      const conditionMul = calcUsedEquipConditionMul(dur, maxDur);
      const sellPrice = Math.round(enhancedBase * conditionMul);
      const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 10000 ? `${Math.round(n/10000)}만` : n.toLocaleString('en-US');
      const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f97316' : '#22c55e';
      const statParts = [];
      if (Number(it.atk||0) > 0)  statParts.push(`⚔️ ATK +${it.atk}`);
      if (Number(it.pdef||0) > 0) statParts.push(`🛡️ 물리방어 +${it.pdef}`);
      if (Number(it.mdef||0) > 0) statParts.push(`✨ 마법방어 +${it.mdef}`);
      if (it.mainStat)             statParts.push(`주스탯: ${it.mainStat.toUpperCase()}`);
      if ((it.traits||[]).length)  statParts.push(`특성: ${(it.traits||[]).map(t=>equipTraitDisplay(t, it.rank)).join(', ')}`);
      const statsLine = statParts.length
        ? `<div class="gb-sub" style="color:#93c5fd;margin-top:2px;">${escapeHtml(statParts.join('  ·  '))}</div>`
        : '';
      const tooltipText = escapeHtml(hmItemTooltip(it));
      return `<div class="gb-unit gb-inv-tooltip-wrap" style="position:relative;overflow:visible;">
        <div class="gb-unit-top">
          <div>
            <strong>${escapeHtml(it.name||it.id)}</strong>
            <span class="gb-badge">${escapeHtml(it.rank||'E')}</span>
            <span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part||'weapon']||it.part||'')}</span>
            ${it.enhance>0?`<span class="gb-badge">+${it.enhance}</span>`:''}
            <div class="gb-sub">내구도 <span style="color:${durColor};font-weight:700;">${dur}</span>/${maxDur} | 최대내구도 이력: ${100-maxDur}회 수리</div>
            ${statsLine}
            <div class="gb-sub">예상 판매가: ₩${fmt(sellPrice)} (시세 ${Math.round(conditionMul*100)}%)</div>
          </div>
          <div>
            <button class="gb-btn tiny" data-hm-sell="${escapeHtml(inventoryItemKey(it))}:${sellPrice}">판매 ₩${fmt(sellPrice)}</button>
          </div>
        </div>
        <div class="gb-inv-slot-tooltip" style="white-space:pre-line;z-index:300;">${tooltipText}</div>
      </div>`;
    }).join('');
    return notice + tabBar + `<div class="gb-panel">${rows}</div>`;
  }

  // browse tab: hmUsedListings (NPC + player) 기반 중고 매물
  if (!Array.isArray(model.db.hmUsedListings)) model.db.hmUsedListings = [];
  seedNpcUsedListings();
  const allListings = model.db.hmUsedListings;
  const rankBtns = ['', ...GRADE_ORDER].map(r => `<button class="gb-btn ${selRank===r?'primary':''}" data-hm-rank="${escapeHtml(r)}">${r||'전체'}</button>`).join('');
  const partBtns = ['', ...EQUIP_PARTS].map(p => `<button class="gb-btn ${selPart===p?'primary':''}" data-hm-part="${escapeHtml(p)}">${p ? EQUIP_PART_LABELS[p] : '전체'}</button>`).join('');
  const filtered = allListings.filter(l => {
    const it = l.item;
    const maxDur = Number(it.maxDurability ?? 100);
    // 헌터마켓에는 최대내구도 100 (새 장비)는 등록 불가 — 80~99만 허용
    // 유니크/전설 아이템은 헌터마켓에 표시하지 않음
    const rarityOk = !it.rarity || (it.rarity !== 'Unique' && it.rarity !== 'Legendary');
    return maxDur >= 80 && maxDur < 100 && (!selRank || (it.rank||'E') === selRank) && (!selPart || it.part === selPart) && rarityOk;
  });
  const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 10000 ? `${Math.round(n/10000)}만` : n.toLocaleString('en-US');
  // 장비 상세 툴팁 헬퍼
  function hmItemTooltip(e) {
    const lines = [`${e.name}${e.rank ? ` [${e.rank}급]` : ''}`, `부위: ${EQUIP_PART_LABELS[e.part||'weapon']||e.part||''}  |  내구도: ${Number(e.durability??100)}/${Number(e.maxDurability??100)}`];
    if (e.part === 'armor' && e.armorSubtype && ARMOR_SUBTYPES[e.armorSubtype]) lines.push(`종류: ${ARMOR_SUBTYPES[e.armorSubtype].label}`);
    if (e.enhance > 0) lines.push(`강화: +${e.enhance}`);
    if (Number(e.atk||0) > 0) lines.push(`ATK: +${e.atk}`);
    if (Number(e.pdef||0) > 0) lines.push(`물리방어: +${e.pdef}`);
    if (Number(e.mdef||0) > 0) lines.push(`마법방어: +${e.mdef}`);
    if (e.mainStat) lines.push(`주 스탯: ${e.mainStat.toUpperCase()}`);
    if (Array.isArray(e.traits) && e.traits.length) lines.push(`특성: ${e.traits.map(t=>equipTraitDisplay(t, e.rank)).join(', ')}`);
    if (e.resistType && e.resistPct) lines.push(`${EQUIP_TRAIT_LABELS[e.resistType]||e.resistType} 저항 ${e.resistPct}%`);
    if (e.maxInfuse) lines.push(`주입 최대 ${e.maxInfuse}회 (현재 ${e.infuse||0}회)`);
    if (e.note) lines.push(`메모: ${e.note}`);
    return lines.join('\n');
  }
  const browseHtml = filtered.length === 0
    ? '<div class="gb-sub">등록된 중고 장비 없음.</div>'
    : filtered.map(l => {
        const e = l.item;
        const dur = Number(e.durability ?? 100);
        const maxDur = Number(e.maxDurability ?? 100);
        const usedPrice = l.usedPrice;
        const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f97316' : '#22c55e';
        const canAfford = gold >= usedPrice;
        const npcBadge = l.isNpc ? '<span class="gb-badge">NPC</span>' : '<span class="gb-badge" style="background:#0284c7;">플레이어</span>';
        const traitTxt = (e.traits||[]).length ? `<span class="gb-badge" style="background:#7c3aed;">${(e.traits||[]).map(t=>equipTraitDisplay(t, e.rank)).join(', ')}</span>` : '';
        // 스탯 항상 표시
        const statParts = [];
        if (Number(e.atk||0) > 0)  statParts.push(`⚔️ ATK +${e.atk}`);
        if (Number(e.pdef||0) > 0) statParts.push(`🛡️ 물리방어 +${e.pdef}`);
        if (Number(e.mdef||0) > 0) statParts.push(`✨ 마법방어 +${e.mdef}`);
        if (e.mainStat)             statParts.push(`주스탯: ${e.mainStat.toUpperCase()}`);
        if (e.enhance > 0)          statParts.push(`강화: +${e.enhance}`);
        if (e.maxInfuse)            statParts.push(`주입: ${e.infuse||0}/${e.maxInfuse}회`);
        const statsLine = statParts.length
          ? `<div class="gb-sub" style="color:#93c5fd;margin-top:2px;">${escapeHtml(statParts.join('  ·  '))}</div>`
          : '';
        const tooltipText = escapeHtml(hmItemTooltip(e));
        return `<div class="gb-unit gb-inv-tooltip-wrap" style="position:relative;overflow:visible;"><div class="gb-unit-top">
          <div>
            <strong style="${rarityStyle(e.rarity)}">${escapeHtml(e.name)}</strong>
            <span class="gb-badge">${escapeHtml(e.rank||'E')}</span>
            <span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[e.part]||e.part||'')}</span>
            ${e.rarity && e.rarity !== 'Normal' ? `<span class="gb-badge" style="background:${rarityColor(e.rarity)};color:#000;">${escapeHtml(e.rarity)}</span>` : ''}
            ${npcBadge} ${traitTxt}
            <span style="color:${durColor};font-size:0.85em;"> 내구도 ${dur}/${maxDur}</span>
            ${statsLine}
            <div class="gb-sub">중고가 ${l.conditionPct||Math.round(calcUsedEquipConditionMul(dur,maxDur)*100)}% (기준가 ₩${fmt(Number(e.price||0))})</div>
          </div>
          <button class="gb-btn tiny${canAfford?'':' danger'}" data-hm-browse-buy="${escapeHtml(l.id)}:${usedPrice}" ${canAfford?'':'disabled'}>
            중고 ₩${fmt(usedPrice)}
          </button>
        </div>
        <div class="gb-inv-slot-tooltip" style="white-space:pre-line;z-index:300;">${tooltipText}</div>
        </div>`;
      }).join('');
  return notice + tabBar + `
    <div class="gb-panel">
      <button class="gb-btn" data-hm-refresh style="margin-bottom:6px;">🔄 NPC 목록 갱신</button>
      <div class="gb-btn-row" style="flex-wrap:wrap;">
        <span class="gb-sub" style="align-self:center;">등급:</span> ${rankBtns}
      </div>
      <div class="gb-btn-row" style="flex-wrap:wrap;">
        <span class="gb-sub" style="align-self:center;">부위:</span> ${partBtns}
      </div>
    </div>
    <div class="gb-panel">${browseHtml}</div>`;
}

// ── 블랙마켓 ─────────────────────────────────────────────────────────────────
const BM_DETECT_RATE = 0.02;   // 아이템 1개당 적발 확률 2%
const BM_FINE_RATE   = 0.50;   // 적발 시 벌금 = 거래액 × 50% (아이템은 압수·거래 무효)

function renderBlackMarketHtml() {
  const inv  = getInventory();
  const gold = Number(inv.gold || 0);
  const tab  = model.state.shopBmTab || 'rare';

  const tabBar = `
    <div class="gb-btn-row">
      <button class="gb-btn${tab === 'rare' ? ' active' : ''}" data-bm-tab="rare">💎 희귀재료</button>
      <button class="gb-btn${tab === 'gear' ? ' active' : ''}" data-bm-tab="gear">⚔️ 장비 매입</button>
    </div>`;

  const warning = `
    <div class="gb-panel" style="border-color:#f97316;">
      <div style="color:#f97316;font-weight:700;">🚫 불법 거래소 — 협회 신고 없이 처분</div>
      <div class="gb-sub" style="margin-top:4px;">수수료 0% · 세금 0% · 시장가 100% 보장 · 기록 없음</div>
      <div class="gb-sub" style="color:#ef4444;">아이템 1개당 ${(BM_DETECT_RATE * 100).toFixed(0)}% 적발 · 적발 시 아이템 압수·거래 무효 + 벌금 거래액 ${(BM_FINE_RATE * 100).toFixed(0)}%</div>
      <div class="gb-sub">소지금: ₩${gold.toLocaleString('en-US')}</div>
    </div>`;

  if (tab === 'rare') {
    const rareItems = (inv.items || []).filter(it => it.category === 'rareMaterial' && Number(it.suggestedPrice || 0) > 0);
    if (!rareItems.length) {
      return warning + tabBar + '<div class="gb-panel"><div class="gb-sub">판매 가능한 희귀재료가 없다. (기준가 있는 희귀재료만 판매 가능)</div></div>';
    }
    const rows = rareItems.map(it => {
      const sp  = Number(it.suggestedPrice || 0);
      const cnt = Number(it.count || 1);
      const val = sp * cnt;
      const pDetect = (1 - Math.pow(1 - BM_DETECT_RATE, cnt)) * 100;
      const fine    = Math.floor(val * BM_FINE_RATE);
      const ikey    = inventoryItemKey(it);
      return `<div class="gb-unit">
        <div class="gb-unit-top">
          <div>
            <strong>${escapeHtml(it.name || '희귀재료')}</strong>
            <span class="gb-badge">${escapeHtml(it.rank || '')}</span>
            <span class="gb-sub"> ×${cnt} | ₩${sp.toLocaleString('en-US')}/개 → 총 ₩${val.toLocaleString('en-US')}</span>
            <div class="gb-sub" style="color:#f97316;">적발 확률 ${pDetect.toFixed(1)}% | 적발 시 압수·무효 + 벌금 -₩${fine.toLocaleString('en-US')}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="gb-btn tiny" data-bm-sell="${escapeHtml(ikey)}:one">1개</button>
            <button class="gb-btn tiny danger" data-bm-sell="${escapeHtml(ikey)}:all">전부</button>
          </div>
        </div>
      </div>`;
    }).join('');
    return warning + tabBar + `<div class="gb-panel">${rows}</div>`;
  }

  // gear tab — 공용 인벤에서 새 장비 선택 (최대내구도 100 & isUsed 없는 것만)
  const newGearItems = (inv.items || []).filter(it =>
    it.category === 'equipment' &&
    Number(it.maxDurability ?? 100) === 100 &&
    !it.isUsed
  );
  if (!newGearItems.length) {
    return warning + tabBar + `<div class="gb-panel"><div class="gb-sub">공용 인벤에 블랙마켓 매입 가능한 새 장비가 없다. (최대내구도 100 & 미사용 장비만 매입 가능. 중고 장비는 매입 불가.)</div></div>`;
  }
  const gearRows = newGearItems.map(it => {
    const ikey = inventoryItemKey(it);
    const mktPrice = Number(it.price || calcEquipBasePrice(it.rank||'E', it.part||'weapon'));
    const enhPrice = it.enhance > 0 ? calcEquipEnhancedPrice(mktPrice, it.enhance, it.rank||'E') : mktPrice;
    const pDetect = (1 - Math.pow(1 - BM_DETECT_RATE, 1)) * 100;
    const fine = Math.floor(enhPrice * BM_FINE_RATE);
    const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 10000 ? `${Math.round(n/10000)}만` : n.toLocaleString('en-US');
    return `<div class="gb-unit">
      <div class="gb-unit-top">
        <div>
          <strong>${escapeHtml(it.name||it.id)}</strong>
          <span class="gb-badge">${escapeHtml(it.rank||'E')}</span>
          <span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part||'weapon']||it.part||'')}</span>
          ${it.enhance>0?`<span class="gb-badge">+${it.enhance}</span>`:''}
          <div class="gb-sub">시장가 ₩${fmt(enhPrice)} | 내구도 ${Number(it.durability??100)}/${Number(it.maxDurability??100)}</div>
          <div class="gb-sub" style="color:#f97316;">적발 확률 ${pDetect.toFixed(1)}% | 적발 시 압수·무효 + 벌금 -₩${fine.toLocaleString('en-US')}</div>
        </div>
        <button class="gb-btn tiny danger" data-bm-gear-inv="${escapeHtml(ikey)}:${enhPrice}">⚠️ 매입 ₩${fmt(enhPrice)}</button>
      </div>
    </div>`;
  }).join('');
  return warning + tabBar + `<div class="gb-panel">
    <div class="gb-sub" style="margin-bottom:6px;">공용 인벤의 새 장비(미사용)를 시장가 100%에 매입. 소득세 기록 없음. <span style="color:#ef4444;">중고 장비(최대내구도 깎인 것) 매입 불가.</span></div>
    ${gearRows}
  </div>`;
}

// ── 수리점 ────────────────────────────────────────────────────────────────────
function renderRepairShopHtml() {
  const inv = getActiveInventory();
  const gold = Number(inv.gold || 0);
  const ownedEquip = (inv.items || []).filter(it => it.category === 'equipment');
  const selKey = model.state.shopRepairSel || '';

  const listHtml = ownedEquip.length === 0
    ? '<div class="gb-sub">수리 가능한 장비가 없다. 장비상점에서 구매하거나 게이트 보상으로 획득하자.</div>'
    : ownedEquip.map(it => {
        const ikey = inventoryItemKey(it);
        const dur = Number(it.durability ?? 100);
        const maxDur = Number(it.maxDurability ?? 100);
        const isSelected = selKey === ikey;
        const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f97316' : '#22c55e';
        return `<button class="gb-list-item ${isSelected?'is-active':''}" data-repair-sel="${escapeHtml(ikey)}">
          <strong>${escapeHtml(it.name||it.id)}</strong>
          <span class="gb-badge">${escapeHtml(it.rank||'E')}</span>
          <span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part||'weapon']||it.part||'')}</span>
          <span class="gb-sub"> 내구도 <span style="color:${durColor};">${dur}</span>/${maxDur}</span>
        </button>`;
      }).join('');

  // Detail panel for selected item
  let detailHtml = '<div class="gb-sub">왼쪽 목록에서 수리할 장비를 선택하세요.</div>';
  if (selKey) {
    const it = ownedEquip.find(x => inventoryItemKey(x) === selKey);
    if (it) {
      const dur = Number(it.durability ?? 100);
      const maxDur = Number(it.maxDurability ?? 100);
      const rank = it.rank || 'E';
      const part = it.part || 'weapon';
      const lostToMax = maxDur - dur;
      const feeToFull = calcRepairFee(rank, part, lostToMax);
      const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억원` : n >= 10000 ? `${Math.round(n/10000)}만원` : `${n.toLocaleString('en-US')}원`;
      const canAfford = gold >= feeToFull;
      const maxDurAfter = Math.max(EQUIP_MAX_DURABILITY_FLOOR, maxDur - 1);
      detailHtml = `
        <div class="gb-section-title">🔧 ${escapeHtml(it.name||it.id)} 수리</div>
        <div class="gb-sub">등급: <strong>${escapeHtml(rank)}</strong> | 부위: <strong>${escapeHtml(EQUIP_PART_LABELS[part]||part)}</strong></div>
        <div class="gb-sub">현재 내구도: <strong>${dur} / ${maxDur}</strong></div>
        <div class="gb-sub">수리 후 최대내구도 예상: <strong>${maxDurAfter}</strong> (매 수리마다 -1, 최소 ${EQUIP_MAX_DURABILITY_FLOOR})</div>
        <div class="gb-sub" style="margin-top:4px;">E등급 수리: 무료 (훈련 장려) | 무기: 기본 수리비 ×2</div>

        <div style="margin-top:8px;">
          <div class="gb-sub">최대내구도(${maxDur})까지 전체 수리:</div>
          <div style="margin-top:4px;">
            <strong>수리비: ${feeToFull === 0 ? '무료' : fmt(feeToFull)}</strong>
            <span class="gb-sub"> (${lostToMax}% 회복 필요)</span>
          </div>
          <div class="gb-btn-row" style="margin-top:8px;">
            <button class="gb-btn primary" id="gb-repair-full" ${canAfford || feeToFull===0 ? '' : 'disabled'}>
              ${feeToFull === 0 ? '무료 수리' : `₩${fmt(feeToFull)} 지불하고 수리`}
            </button>
          </div>
          ${!canAfford && feeToFull > 0 ? `<div class="gb-sub" style="color:#ef4444;">소지금 부족 (₩${gold.toLocaleString('en-US')} / 필요 ₩${fmt(feeToFull)})</div>` : ''}
        </div>

        <div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.15);">
          <div class="gb-sub">부분 수리 (목표 내구도 직접 입력):</div>
          <div class="gb-grid two" style="margin-top:4px;">
            <label>목표 내구도<input class="gb-input" id="gb-repair-target-dur" type="number" min="${dur}" max="${maxDur}" value="${maxDur}" /></label>
            <label style="display:flex;align-items:flex-end;"><button class="gb-btn" id="gb-repair-partial">부분 수리 계산·실행</button></label>
          </div>
          <div id="gb-repair-partial-result" class="gb-sub"></div>
        </div>`;
    }
  }

  return `
    <div class="gb-grid db">
      <div class="gb-panel">
        <div class="gb-section-title">보유 장비</div>
        <div class="gb-sub">소지금: ₩${gold.toLocaleString('en-US')}</div>
        <div style="margin-top:8px;">${listHtml}</div>
      </div>
      <div class="gb-panel">${detailHtml}</div>
    </div>`;
}


function renderForgeShopHtml() {
  const inv = getActiveInventory();
  const gold = Number(inv.gold || 0);
  const ownedEquip = (inv.items||[]).filter(it => it.category === 'equipment');
  const selKey = model.state.shopForgeSel || '';
  const forgeTab = model.state.shopForgeTab || 'enhance';
  const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억원` : n >= 10000 ? `${Math.round(n/10000)}만원` : `${n.toLocaleString('en-US')}원`;

  const tabBar = `<div class="gb-btn-row">
    <button class="gb-btn${forgeTab==='enhance'?' primary':''}" data-forge-tab="enhance">⚒️ 강화</button>
    <button class="gb-btn${forgeTab==='infuse'?' primary':''}" data-forge-tab="infuse">💎 특성주입</button>
  </div>`;

  const listHtml = ownedEquip.length === 0
    ? `<div class="gb-sub">${forgeTab==='infuse'?'특성주입':'강화'}할 장비가 없다.</div>`
    : ownedEquip.map(it => {
        const ikey = inventoryItemKey(it);
        const isSelected = ikey === selKey;
        const dur = Number(it.durability ?? 100);
        const maxDur = Number(it.maxDurability ?? 100);
        const maxEnh = EQUIP_MAX_ENHANCE[it.part||'weapon'] || 3;
        const maxInf = it.maxInfuse ?? EQUIP_MAX_INFUSE[it.part||'weapon'] ?? 1;
        const isFull = forgeTab === 'enhance' ? (it.enhance || 0) >= maxEnh : (it.infuse || 0) >= maxInf;
        const badgeText = forgeTab === 'infuse' ? `특성 ${(it.traits||[]).length}/${maxInf}` : `+${it.enhance||0}`;
        return `<button class="gb-list-item ${isSelected?'is-active':''}" data-forge-sel="${escapeHtml(ikey)}">
          <strong>${escapeHtml(it.name||it.id)}</strong>
          <span class="gb-badge">${escapeHtml(it.rank||'E')}</span>
          <span class="gb-badge">${badgeText}</span>
          <div class="gb-sub">내구도 ${dur}/${maxDur}${isFull ? ' | <span style="color:#f97316;">최대</span>' : ''}</div>
        </button>`;
      }).join('');

  let detailHtml = `<div class="gb-sub">왼쪽 목록에서 ${forgeTab==='infuse'?'특성주입':'강화'}할 장비를 선택하세요.</div>`;

  if (selKey) {
    const it = ownedEquip.find(x => inventoryItemKey(x) === selKey);
    if (it) {
      const rank = it.rank || 'E';
      const part = it.part || 'weapon';

      if (forgeTab === 'enhance') {
        // ── 강화 탭 ─────────────────────────────────────────────────────────
        const curEnh = it.enhance || 0;
        const maxEnh = EQUIP_MAX_ENHANCE[part] || 3;
        const baseP = Number(it.price || calcEquipBasePrice(rank, part));
        const wonPerPct100 = (MANA_STONE_WON_PER_PCT[rank] || MANA_STONE_WON_PER_PCT.E) * 100;

        if (curEnh >= maxEnh) {
          detailHtml = `
            <div class="gb-section-title">⚒️ ${escapeHtml(it.name||it.id)}</div>
            <div class="gb-sub" style="color:#f97316;">이미 최대 강화 단계(+${maxEnh})에 도달했다. 더 이상 강화 불가.</div>`;
        } else {
          const stones = (inv.items||[]).filter(si =>
            si.category === 'manaStone' &&
            String(si.rank||'').toUpperCase() === rank.toUpperCase() &&
            Number(si.note || 0) >= 80
          );
          const selStone = model.state.shopForgeStone || '';

          const stoneOptions = stones.length === 0
            ? `<div class="gb-sub" style="color:#ef4444;">${rank}등급 마정석(순도 80% 이상)이 없다. 게이트 공략으로 획득하거나 재료 상점에서 구매하자.</div>`
            : stones.map(si => {
                const skey = inventoryItemKey(si);
                const purity = Number(si.note || 0);
                const rate = calcForgeSuccessRate(purity);
                const fee = calcForgeFee(rank, purity);
                const stoneVal = (MANA_STONE_WON_PER_PCT[rank] || MANA_STONE_WON_PER_PCT.E) * purity;
                return `<button class="gb-list-item ${skey===selStone?'is-active':''}" data-forge-stone="${escapeHtml(skey)}">
                  ${escapeHtml(si.name||si.id)} (순도 ${purity}%) ×${si.count||1}
                  <div class="gb-sub">성공률 <strong>${Math.round(rate*100)}%</strong> | 수수료 ${fmt(fee)} | 마정석 가치 ${fmt(stoneVal)}</div>
                </button>`;
              }).join('');

          let enhanceAction = '';
          if (selStone && stones.find(si => inventoryItemKey(si) === selStone)) {
            const si = stones.find(si => inventoryItemKey(si) === selStone);
            const purity = Number(si.note || 0);
            const rate = calcForgeSuccessRate(purity);
            const fee = calcForgeFee(rank, purity);
            const canAfford = gold >= fee;
            const afterMarketPrice = calcEquipEnhancedPrice(baseP, curEnh + 1, rank);
            const afterUsedPrice = calcForgeEnhancedUsedPrice(baseP, curEnh + 1, part, rank);
            enhanceAction = `
              <div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.15);">
                <div class="gb-sub">🔮 강화 +${curEnh} → +${curEnh+1}</div>
                <div class="gb-sub">성공 확률: <strong style="color:#22c55e;">${Math.round(rate*100)}%</strong></div>
                <div class="gb-sub">실패 시: 장비 유지, 마정석 소멸, 수수료 부과</div>
                <div class="gb-sub">수수료: <strong>${fmt(fee)}</strong> (마정석 가치의 25%)</div>
                <div class="gb-sub">성공 시 경매장 시장가: <strong style="color:#6366f1;">₩${fmt(afterMarketPrice)}</strong></div>
                <div class="gb-sub">성공 시 중고 판매가: ₩${fmt(afterUsedPrice)}</div>
                <div class="gb-sub" style="color:#94a3b8;font-size:0.8em;">강화가 = 기본가 + 단계 × ${rank}등급 100%마정석가(${fmt(wonPerPct100)}) × 1.30</div>
                <div class="gb-btn-row" style="margin-top:8px;">
                  <button class="gb-btn primary" id="gb-forge-do" ${canAfford ? '' : 'disabled'}
                    data-forge-equip="${escapeHtml(inventoryItemKey(it))}"
                    data-forge-stone-key="${escapeHtml(selStone)}"
                    data-forge-fee="${fee}"
                    data-forge-rate="${rate}"
                    data-forge-rank="${escapeHtml(rank)}">
                    강화 실행 (수수료 ${fmt(fee)})
                  </button>
                </div>
                ${!canAfford ? `<div class="gb-sub" style="color:#ef4444;">소지금 부족 (₩${gold.toLocaleString('en-US')} / 필요 ${fmt(fee)})</div>` : ''}
              </div>`;
          }

          detailHtml = `
            <div class="gb-section-title">⚒️ ${escapeHtml(it.name||it.id)} 강화</div>
            <div class="gb-sub">등급: <strong>${escapeHtml(rank)}</strong> | 부위: <strong>${escapeHtml(EQUIP_PART_LABELS[part]||part)}</strong> | 현재 강화: <strong>+${curEnh}</strong> / 최대 +${maxEnh}</div>
            <div class="gb-sub" style="margin-top:4px;color:#a78bfa;">재료: ${rank}등급 마정석 순도 80~100% (소멸) | 수수료: 마정석 가치 ×25%</div>
            <div style="margin-top:8px;">
              <div class="gb-sub">보유 중인 ${rank}등급 마정석 (순도 80% 이상):</div>
              <div style="margin-top:4px;">${stoneOptions}</div>
            </div>
            ${enhanceAction}`;
        }

      } else {
        // ── 특성주입 탭 ──────────────────────────────────────────────────────
        const curInfuse = it.infuse || 0;
        const maxInfuse = it.maxInfuse ?? EQUIP_MAX_INFUSE[part] ?? 1;
        const existingTraits = it.traits || [];

        if (curInfuse >= maxInfuse) {
          detailHtml = `
            <div class="gb-section-title">💎 ${escapeHtml(it.name||it.id)} 특성주입</div>
            <div class="gb-sub">현재 특성: ${existingTraits.map(t => escapeHtml(equipTraitDisplay(t, it.rank))).join(', ') || '없음'}</div>
            <div class="gb-sub" style="color:#f97316;">최대 특성 수(${maxInfuse})에 도달했다. 더 이상 주입 불가.</div>`;
        } else {
          const rareMats = (inv.items||[]).filter(mi =>
            mi.category === 'rareMaterial' &&
            mi.traitId &&
            Number(mi.suggestedPrice || 0) > 0 &&
            !existingTraits.includes(mi.traitId)
          );
          const selMat = model.state.shopForgeInfuseMat || '';

          const matOptions = rareMats.length === 0
            ? `<div class="gb-sub" style="color:#ef4444;">주입 가능한 희귀재료가 없다. (traitId 있고, 기준가 있는 재료만 가능) 게이트 보상으로 획득하자.</div>`
            : rareMats.map(mi => {
                const mkey = inventoryItemKey(mi);
                const sp = Number(mi.suggestedPrice || 0);
                const fee = Math.round(sp * 0.25);
                const total = sp + fee;
                const traitLabel = equipTraitDisplay(mi.traitId, mi.rank);
                return `<button class="gb-list-item ${mkey===selMat?'is-active':''}" data-forge-infuse-mat="${escapeHtml(mkey)}">
                  <strong>${escapeHtml(mi.name||mi.id)}</strong>
                  <span class="gb-badge">${escapeHtml(mi.rank||'E')}</span> ×${mi.count||1}
                  <div class="gb-sub">주입 특성: <strong>${escapeHtml(traitLabel)}</strong> | 재료가 ${fmt(sp)} + 수수료 ${fmt(fee)} = 총 ${fmt(total)}</div>
                </button>`;
              }).join('');

          let infuseAction = '';
          if (selMat && rareMats.find(mi => inventoryItemKey(mi) === selMat)) {
            const mi = rareMats.find(mi => inventoryItemKey(mi) === selMat);
            const sp = Number(mi.suggestedPrice || 0);
            const fee = Math.round(sp * 0.25);
            const total = sp + fee;
            const canAfford = gold >= total;
            const traitLabel = equipTraitDisplay(mi.traitId, mi.rank);
            infuseAction = `
              <div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.15);">
                <div class="gb-sub">💎 특성 주입: <strong>${escapeHtml(traitLabel)}</strong></div>
                <div class="gb-sub" style="color:#22c55e;">성공률: <strong>100%</strong> (실패 없음)</div>
                <div class="gb-sub">재료비: ${fmt(sp)} | 수수료 (25%): ${fmt(fee)} | <strong>합계: ${fmt(total)}</strong></div>
                <div class="gb-sub" style="color:#94a3b8;font-size:0.8em;">희귀재료 1개 소멸 + 수수료 = 재료가 ×1.25</div>
                <div class="gb-btn-row" style="margin-top:8px;">
                  <button class="gb-btn primary" id="gb-forge-infuse-do" ${canAfford ? '' : 'disabled'}
                    data-forge-equip="${escapeHtml(inventoryItemKey(it))}"
                    data-forge-mat-key="${escapeHtml(selMat)}"
                    data-forge-infuse-fee="${total}"
                    data-forge-trait-id="${escapeHtml(mi.traitId||'')}">
                    특성주입 실행 (합계 ${fmt(total)})
                  </button>
                </div>
                ${!canAfford ? `<div class="gb-sub" style="color:#ef4444;">소지금 부족 (₩${gold.toLocaleString('en-US')} / 필요 ${fmt(total)})</div>` : ''}
              </div>`;
          }

          detailHtml = `
            <div class="gb-section-title">💎 ${escapeHtml(it.name||it.id)} 특성주입</div>
            <div class="gb-sub">등급: <strong>${escapeHtml(rank)}</strong> | 부위: <strong>${escapeHtml(EQUIP_PART_LABELS[part]||part)}</strong> | 특성 ${curInfuse}/${maxInfuse}</div>
            <div class="gb-sub">현재 특성: ${existingTraits.length ? existingTraits.map(t => `<span class="gb-badge">${escapeHtml(equipTraitDisplay(t, it.rank))}</span>`).join(' ') : '없음'}</div>
            <div class="gb-sub" style="margin-top:4px;color:#a78bfa;">재료: 희귀재료(traitId 있는 것) 1개 소멸 | 수수료: 재료가 ×25% | 100% 성공</div>
            <div style="margin-top:8px;">
              <div class="gb-sub">보유 희귀재료 (주입 가능한 것):</div>
              <div style="margin-top:4px;">${matOptions}</div>
            </div>
            ${infuseAction}`;
        }
      }
    }
  }

  return `
    ${tabBar}
    <div class="gb-grid db">
      <div class="gb-panel">
        <div class="gb-section-title">보유 장비</div>
        <div class="gb-sub">소지금: ₩${gold.toLocaleString('en-US')}</div>
        <div style="margin-top:8px;">${listHtml}</div>
      </div>
      <div class="gb-panel">${detailHtml}</div>
    </div>`;
}


function renderShopView() {
  const sub = model.state.shopSub || '';
  const hunterSub = model.state.shopHunterSub || '';
  const inv = getActiveInventory();
  const goldLine = `<div class="gb-sub">소지금 (${escapeHtml(getActiveLabel())}): ₩${Number(inv.gold || 0).toLocaleString('en-US')}</div>`;

  if (!sub) {
    const catCards = SHOP_CATEGORIES.map(c =>
      `<button class="gb-card-nav" data-shop-sub="${escapeHtml(c.id)}">
         <div class="gb-card-title">${escapeHtml(c.label)}</div>
         <div class="gb-sub">${escapeHtml(c.desc)}</div>
       </button>`
    ).join('');
    return `
      <div class="gb-panel">
        <div class="gb-section-title">🛒 상점가</div>
        <div class="gb-sub">다양한 상점들이 모여 있다.</div>
        ${goldLine}
      </div>
      <div class="gb-grid three">${catCards}</div>
      <div class="gb-btn-row"><button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  if (sub === 'convenience') {
    const db = getConvFoodDb();
    const inv2 = getActiveInventory();
    const convItemsHtml = db.map(f => {
      const canAfford2 = Number(inv2.gold||0) >= f.price;
      const isCampSupply = f.id === 'conv_ration' || f.id === 'conv_water';
      const isPotion = f.id && f.id.startsWith('pot_');
      return `<div class="gb-unit">
        <div class="gb-unit-top">
          <div><strong>${escapeHtml(f.name)}</strong> ${isCampSupply ? '<span class="gb-badge" style="background:#15803d44;">야영용</span>' : isPotion ? '<span class="gb-badge" style="background:#7c3aed44;">물약</span>' : '<span class="gb-badge">식품</span>'} ${f.note ? `<span class="gb-sub">${escapeHtml(f.note)}</span>` : ''}</div>
          <div><button class="gb-btn tiny${canAfford2 ? '' : ' danger'}" data-conv-food-buy="${escapeHtml(f.id)}" ${canAfford2 ? '' : 'disabled'}>₩${Number(f.price).toLocaleString('en-US')} / 개</button></div>
        </div>
      </div>`;
    }).join('');
    const editRows = db.map((f, idx) => `<div style="display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.08);">
      <input type="text" class="gb-input" style="flex:2;" value="${escapeHtml(f.name)}" data-convdb-name="${idx}">
      <input type="number" class="gb-input" style="width:80px;" value="${f.price}" data-convdb-price="${idx}">
      <input type="number" class="gb-input" style="width:70px;" value="${f.weightG||300}" data-convdb-weight="${idx}">
      <button class="gb-btn tiny danger" data-convdb-del="${idx}">삭제</button>
    </div>`).join('');
    return `
      <div class="gb-panel">
        <div class="gb-section-title">🏪 편의점</div>
        <div class="gb-sub">식료품, 음료, 야영 보급품. 식품은 사용하기로 소모. 야영용은 야영지에서 소비.</div>
        ${goldLine}
      </div>
      <div class="gb-panel">${convItemsHtml || '<div class="gb-sub">상품 없음.</div>'}</div>
      <div class="gb-panel">
        <div class="gb-section-title">📝 편의점 식량 DB 관리</div>
        <div class="gb-sub" style="margin-bottom:6px;">이름 / 가격(원) / 무게(g) 순서. 저장 버튼을 눌러야 적용됨.</div>
        <div style="max-height:220px;overflow-y:auto;">${editRows}</div>
        <div class="gb-btn-row" style="margin-top:8px;">
          <button class="gb-btn" id="gb-convdb-add">+ 항목 추가</button>
          <button class="gb-btn primary" id="gb-convdb-save">💾 저장</button>
          <button class="gb-btn danger" id="gb-convdb-reset">기본값 복원</button>
        </div>
      </div>
      <div class="gb-btn-row"><button class="gb-btn" data-shop-sub="">← 상점가로</button> <button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  if (sub === 'department') {
    return `
      <div class="gb-panel">
        <div class="gb-section-title">백화점</div>
        <div class="gb-sub">의류, 생활용품, 일반 가전. (상품 목록 예정)</div>
        ${goldLine}
      </div>
      <div class="gb-btn-row"><button class="gb-btn" data-shop-sub="">← 상점가로</button> <button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  if (sub === 'equip') {
    return `
      <div class="gb-panel">
        <div class="gb-section-title">⚔️ 장비상점</div>
        ${goldLine}
      </div>
      ${renderEquipShopHtml()}
      <div class="gb-btn-row"><button class="gb-btn" data-shop-sub="">← 상점가로</button> <button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  if (sub === 'huntermarket') {
    return `
      <div class="gb-panel">
        <div class="gb-section-title">🏷️ 헌터마켓</div>
        ${goldLine}
      </div>
      ${renderHunterMarketHtml()}
      <div class="gb-btn-row"><button class="gb-btn" data-shop-sub="">← 상점가로</button> <button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  if (sub === 'blackmarket') {
    return `
      ${renderBlackMarketHtml()}
      <div class="gb-btn-row"><button class="gb-btn" data-shop-sub="">← 상점가로</button> <button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  if (sub === 'hunterstreet') {
    if (!hunterSub) {
      const subCards = HUNTER_STREET_SUBS.map(s =>
        `<button class="gb-card-nav" data-shop-hunter-sub="${escapeHtml(s.id)}">
           <div class="gb-card-title">${escapeHtml(s.label)}</div>
           <div class="gb-sub">${escapeHtml(s.desc)}</div>
         </button>`
      ).join('');
      return `
        <div class="gb-panel">
          <div class="gb-section-title">헌터거리</div>
          <div class="gb-sub">헌터 전용 상점들이 모여 있는 거리.</div>
          ${goldLine}
        </div>
        <div class="gb-grid three">${subCards}</div>
        <div class="gb-btn-row"><button class="gb-btn" data-shop-sub="">← 상점가로</button> <button class="gb-btn" data-go="hub">← 허브로</button></div>`;
    }
    const found = HUNTER_STREET_SUBS.find(s => s.id === hunterSub);
    const title = found ? found.label : '헌터거리';
    let itemsHtml = '<div class="gb-sub">상품 목록 준비 중. (예정)</div>';
    if (hunterSub === 'consumable') itemsHtml = shopItemsHtml(SHOP_ITEMS.consumable, 'consumable');
    if (hunterSub === 'potion') itemsHtml = shopItemsHtml(SHOP_ITEMS.potion, 'potion');
    if (hunterSub === 'material')   itemsHtml = renderMaterialShopHtml();
    if (hunterSub === 'repair')     itemsHtml = renderRepairShopHtml();
    if (hunterSub === 'forge')      itemsHtml = renderForgeShopHtml();
    if (hunterSub === 'equip')      itemsHtml = renderEquipShopHtml();
    return `
      <div class="gb-panel">
        <div class="gb-section-title">${escapeHtml(title)}</div>
        ${goldLine}
      </div>
      ${(hunterSub === 'material' || hunterSub === 'repair' || hunterSub === 'forge' || hunterSub === 'equip') ? itemsHtml : `<div class="gb-panel">${itemsHtml}</div>`}
      <div class="gb-btn-row"><button class="gb-btn" data-shop-hunter-sub="">← 헌터거리로</button> <button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  return `<div class="gb-panel"><div class="gb-sub">알 수 없는 상점 카테고리.</div></div>
    <div class="gb-btn-row"><button class="gb-btn" data-go="hub">← 허브로</button></div>`;
}

// ── 집 (Home) ────────────────────────────────────────────────────────────────
function renderHomeView() {
  const db = model.db;
  if (!Array.isArray(db.homeRegions)) db.homeRegions = [];
  migrateOwnedHomes();
  const homeSub = model.state.homeSub || '';
  const ownedHomes = getActiveOwnedHomes();
  const gd = db.gameDate || { year:2026, month:1, day:1 };
  const charLabel = getActiveLabel();
  // Helper: find owned entry for a specific home from active char's list
  const hvt = model.state.homeViewTarget || {};
  const viewOwned = ownedHomes.find(o => o.regionId === hvt.regionId && o.homeId === hvt.homeId) || null;

  // ── Rent/maintenance log sub-view ──────────────────────────────────────
  if (homeSub === 'rentLog' && viewOwned) {
    const data = getOwnedHomeData(viewOwned);
    if (!data) { model.state.homeSub = 'interior'; return renderHomeView(); }
    const { home } = data;
    const rentLog = Array.isArray(viewOwned.rentLog) ? viewOwned.rentLog : [];
    const moveInDate = viewOwned.moveInDate || '—';
    const logRows = rentLog.slice(-2).reverse().map(r =>
      `<div class="gb-unit-top" style="border-bottom:1px solid rgba(148,163,184,0.1);padding:4px 0;">
        <div><span class="gb-badge">${escapeHtml(r.month)}</span> ₩${Number(r.amount||0).toLocaleString('en-US')}${r.interest ? ` (이자 ₩${Number(r.interest).toLocaleString('en-US')} 포함)` : ''}</div>
        <div class="gb-sub">${escapeHtml(r.paidDate || '—')}</div>
      </div>`
    ).join('') || '<div class="gb-sub">납부 기록이 없다.</div>';
    const maintFee = Number(home.maintenanceFee || 0);
    const rentFee = Number(home.monthlyRent || 0);
    const isRent = home.houseType === 'rent';
    const monthlyInfo = isRent
      ? `월세 ₩${rentFee.toLocaleString('en-US')}${maintFee > 0 ? ` + 관리비 ₩${maintFee.toLocaleString('en-US')}` : ''}`
      : `관리비 ₩${maintFee.toLocaleString('en-US')}`;
    return `
      <div class="gb-panel" style="border-color:#2563eb;">
        <div class="gb-section-title">📋 납부 기록 — ${escapeHtml(home.name)}</div>
        <div class="gb-sub">입주일: <strong>${escapeHtml(moveInDate)}</strong></div>
        <div class="gb-sub">거주자: <strong>${escapeHtml(charLabel)}</strong></div>
        <div class="gb-sub">${monthlyInfo}</div>
      </div>
      <div class="gb-panel">
        <div class="gb-section-title">최근 납부 기록 (최대 2건)</div>
        ${logRows}
      </div>
      <div class="gb-btn-row">
        <button class="gb-btn" data-home-sub="interior">← 집 내부로</button>
      </div>`;
  }

  // ── Interior view (inside a home) ────────────────────────────────────
  if (homeSub === 'interior' && viewOwned) {
    const data = getOwnedHomeData(viewOwned);
    if (!data) { model.state.homeSub = ''; return renderHomeView(); }
    const { region, home } = data;
    if (!Array.isArray(home.storages)) home.storages = [];
    // Check for maintenance/rent lock
    const feeInfo = calcRentDue(viewOwned, home, gd);
    const isStorageLocked = feeInfo && feeInfo.storageLocked;
    const storageList = home.storages.map((s, idx) => {
      const itemCount = Array.isArray(s.items) ? s.items.length : 0;
      const limitInfo = s.maxSlots ? `${itemCount}/${s.maxSlots}칸` : `${itemCount}개`;
      const weightInfo = s.maxWeightKg ? ` · 무게제한 ${s.maxWeightKg}kg` : '';
      return `
        <div class="gb-panel">
          <div class="gb-unit-top">
            <div><strong>${escapeHtml(s.name)}</strong> <span class="gb-badge">${escapeHtml(s.type || '기타')}</span> <span class="gb-sub">(${limitInfo}${weightInfo})</span></div>
            <div>
              <button class="gb-btn tiny" data-home-storage-view="${idx}">열기</button>
              <button class="gb-btn tiny danger" data-home-storage-del="${idx}">삭제</button>
            </div>
          </div>
        </div>`;
    }).join('') || '<div class="gb-sub">보관함이 없다.</div>';
    // ── Fee section (rent or maintenance) ──
    let feeSection = '';
    const hasRent = home.houseType === 'rent' && (Number(home.monthlyRent || 0) + Number(home.maintenanceFee || 0)) > 0;
    const hasMaint = home.houseType === 'purchase' && Number(home.maintenanceFee || 0) > 0;
    if ((hasRent || hasMaint) && feeInfo) {
      const isRent = home.houseType === 'rent';
      const feeStatus = feeInfo.totalDebt > 0
        ? `<span style="color:#ef4444;">미납 ₩${feeInfo.totalDebt.toLocaleString('en-US')} (${feeInfo.overdueMonths}개월분${feeInfo.interest > 0 ? ` + 이자 ₩${feeInfo.interest.toLocaleString('en-US')}` : ''})</span>`
        : '<span style="color:#22c55e;">납부 완료</span>';
      const maintLabel = feeInfo.maint > 0 ? (isRent ? ` + 관리비 ₩${feeInfo.maint.toLocaleString('en-US')}` : '') : '';
      const feeTitle = isRent ? '💰 월세 관리' : '💰 관리비';
      const feeDesc = isRent
        ? `월세: ₩${Number(home.monthlyRent||0).toLocaleString('en-US')}${maintLabel} / 상태: ${feeStatus}`
        : `관리비: ₩${Number(home.maintenanceFee||0).toLocaleString('en-US')} / 상태: ${feeStatus}`;
      const payLabel = isRent ? '💳 월세내기' : '💳 관리비 납부';
      feeSection = `
        <div class="gb-panel" style="border-color:#f59e0b;">
          <div class="gb-section-title">${feeTitle}</div>
          <div class="gb-sub">${feeDesc}</div>
          ${feeInfo.isOverdue ? `<div class="gb-sub" style="color:#ef4444;">⚠ 10일 초과! 일 이자 ₩${feeInfo.interestPerDay.toLocaleString('en-US')} 부과 중 (연 10%)</div>` : ''}
          ${isRent && feeInfo.overdueMonths >= 2 ? `<div class="gb-sub" style="color:#ef4444;">⚠ 2개월 이상 미납 — 다음날 강제 퇴거 예정!</div>` : ''}
          ${isStorageLocked ? `<div class="gb-sub" style="color:#ef4444;">🔒 관리비 2개월 미납 — 보관함 아이템 반출 불가!</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:6px;">
            ${feeInfo.totalDebt > 0 ? `<button class="gb-btn primary" data-home-pay-rent="">${payLabel} (₩${feeInfo.totalDebt.toLocaleString('en-US')})</button>` : ''}
            <button class="gb-btn tiny" data-home-sub="rentLog">📋 납부기록</button>
          </div>
        </div>`;
    }
    return `
      <div class="gb-panel" style="border-color:#2563eb;">
        <div class="gb-section-title">🏠 ${escapeHtml(home.name)} — 내부</div>
        <div class="gb-sub">${escapeHtml(region.name)} · ${escapeHtml(home.area)} · ${home.houseType === 'rent' ? '임대' : home.houseType === 'purchase' ? '매매' : escapeHtml(home.houseType || '임대')} · 거주자: ${escapeHtml(charLabel)}</div>
        ${home.desc ? `<div class="gb-sub" style="margin-top:4px;">${escapeHtml(home.desc)}</div>` : ''}
      </div>
      ${feeSection}
      <div class="gb-panel" style="border-color:#34d399;">
        <div class="gb-section-title">🛏️ 휴식</div>
        <div class="gb-sub">하루 휴식을 취하면 다음 날로 넘어가며 모든 파티원의 HP/MP/SP가 완전히 회복됩니다.</div>
        <div style="margin-top:6px;">
          <button class="gb-btn primary" id="gb-home-rest">🛏️ 하루 휴식 (다음 날로)</button>
        </div>
      </div>
      <div class="gb-panel">
        <div class="gb-section-title">📦 보관함 목록</div>
        ${storageList}
      </div>
      <div class="gb-btn-row">
        <button class="gb-btn" data-home-sub="">← 매물 목록</button>
        <button class="gb-btn" data-go="hub">← 허브로</button>
      </div>`;
  }

  // ── Storage detail view ────────────────────────────────────────────────
  if (homeSub.startsWith('storage:') && viewOwned) {
    const sIdx = parseInt(homeSub.split(':')[1], 10);
    const data = getOwnedHomeData(viewOwned);
    if (!data) { model.state.homeSub = 'interior'; return renderHomeView(); }
    const { home } = data;
    if (!home.storages || !home.storages[sIdx]) { model.state.homeSub = 'interior'; return renderHomeView(); }
    const storage = home.storages[sIdx];
    if (!Array.isArray(storage.items)) storage.items = [];
    const limitInfo = storage.maxSlots ? `${storage.items.length}/${storage.maxSlots}칸` : `${storage.items.length}개`;
    const weightInfo = storage.maxWeightKg ? ` · 무게제한 ${storage.maxWeightKg}kg` : '';
    // Check if storage is locked due to unpaid maintenance
    const feeInfo = calcRentDue(viewOwned, home, gd);
    const isStorageLocked = feeInfo && feeInfo.storageLocked;
    const itemRows = storage.items.map((it, iIdx) => `
      <div class="gb-unit-top" style="border-bottom:1px solid rgba(148,163,184,0.1);padding:4px 0;">
        <div><span class="gb-badge">${escapeHtml(it.category || '기타')}</span> <strong>${escapeHtml(it.name || '아이템')}</strong> ${it.rank ? `<span class="gb-badge">${escapeHtml(it.rank)}</span>` : ''} x${Number(it.count || 1)}</div>
        ${isStorageLocked ? `<span class="gb-badge" style="background:#ef4444;">🔒 반출 불가</span>` : `<button class="gb-btn tiny" data-home-storage-item-take="${sIdx}:${iIdx}">꺼내기</button>`}
      </div>`).join('') || '<div class="gb-sub">보관함이 비어있다.</div>';
    return `
      <div class="gb-panel" style="border-color:#2563eb;">
        <div class="gb-section-title">📦 ${escapeHtml(storage.name)} <span class="gb-badge">${escapeHtml(storage.type || '기타')}</span></div>
        <div class="gb-sub">${limitInfo}${weightInfo}</div>
      </div>
      <div class="gb-panel">${itemRows}</div>
      <div class="gb-panel">
        <div class="gb-section-title">➕ 아이템 넣기</div>
        <div class="gb-sub">현재 인벤토리에서 보관함으로 옮길 아이템을 선택하라.</div>
        <div id="gb-home-storage-item-store" style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end;margin-top:6px;">
          <select id="gb-storage-store-item" class="gb-input" style="min-width:200px;">
            ${(getActiveInventory().items || []).map((it, i) => `<option value="${i}">${escapeHtml(it.name || '아이템')} ${it.rank ? `[${it.rank}]` : ''} x${Number(it.count || 1)}</option>`).join('')}
          </select>
          <input id="gb-storage-store-count" class="gb-input" type="number" min="1" value="1" style="width:60px;" placeholder="수량">
          <button type="button" id="gb-home-storage-item-store-btn" class="gb-btn tiny primary">넣기</button>
        </div>
      </div>
      <div class="gb-btn-row">
        <button class="gb-btn" data-home-sub="interior">← 집 내부로</button>
        <button class="gb-btn" data-go="hub">← 허브로</button>
      </div>`;
  }

  // ── Add region form ────────────────────────────────────────────────────
  if (homeSub === 'addRegion') {
    return `
      <div class="gb-panel">
        <div class="gb-section-title">🗺️ 새 지역 추가</div>
        <div id="gb-home-region-add" style="display:flex;gap:6px;align-items:flex-end;">
          <label>지역 이름<input id="gb-region-name" class="gb-input" type="text" placeholder="예: 종로, 헌터구역" style="margin-left:4px;width:200px;"></label>
          <button type="button" id="gb-home-region-add-btn" class="gb-btn tiny primary">추가</button>
        </div>
      </div>
      <div class="gb-btn-row"><button class="gb-btn" data-home-sub="">← 취소</button></div>`;
  }

  // ── Add home form ──────────────────────────────────────────────────────
  if (homeSub.startsWith('addHome:')) {
    const regionId = homeSub.split(':')[1];
    const region = db.homeRegions.find(r => r.id === regionId);
    if (!region) { model.state.homeSub = ''; return renderHomeView(); }
    return `
      <div class="gb-panel">
        <div class="gb-section-title">🏠 새 집 추가 — ${escapeHtml(region.name)}</div>
        <div class="gb-sub">평수에 따라 보관함이 자동 생성됩니다 (≤10평/11~20평/21~30평/31평~).</div>
        <div id="gb-home-add" style="display:flex;flex-direction:column;gap:8px;">
          <input type="hidden" id="gb-home-add-region" value="${escapeHtml(regionId)}">
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <label>집 이름<input id="gb-home-name" class="gb-input" type="text" placeholder="예: 원룸 A동" style="margin-left:4px;width:160px;"></label>
            <label>평수<input id="gb-home-area" class="gb-input" type="text" placeholder="예: 20평" style="margin-left:4px;width:80px;"></label>
            <label>주거종류<select id="gb-home-type" class="gb-input" style="margin-left:4px;">
              <option value="rent">임대</option><option value="purchase">매매</option>
            </select></label>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <label>보증금<input id="gb-home-deposit" class="gb-input" type="number" min="0" value="0" style="margin-left:4px;width:130px;"></label>
            <label>월세<input id="gb-home-rent" class="gb-input" type="number" min="0" value="0" style="margin-left:4px;width:130px;"></label>
            <label>관리비<input id="gb-home-maint" class="gb-input" type="number" min="0" value="0" style="margin-left:4px;width:130px;"></label>
            <label>매매가<input id="gb-home-purchase" class="gb-input" type="number" min="0" value="0" style="margin-left:4px;width:130px;"></label>
            <label>복비<input id="gb-home-broker" class="gb-input" type="number" min="0" value="0" style="margin-left:4px;width:130px;"></label>
          </div>
          <label>설명<input id="gb-home-desc" class="gb-input" type="text" placeholder="집 설명 (선택)" style="margin-left:4px;width:100%;"></label>
          <label>특징 (쉼표 구분)<input id="gb-home-features" class="gb-input" type="text" placeholder="예: 방음처리,에어컨,복층" style="margin-left:4px;width:100%;"></label>
          <div class="gb-btn-row" style="margin-top:4px;">
            <button type="button" id="gb-home-add-btn" class="gb-btn primary">🏠 집 추가</button>
            <button type="button" class="gb-btn" data-home-sub="">← 취소</button>
          </div>
        </div>
      </div>`;
  }

  // ── Main listing view ──────────────────────────────────────────────────
  const ownedInfo = ownedHomes.length > 0 ? ownedHomes.map(oh => {
    const data = getOwnedHomeData(oh);
    if (!data) return '';
    const { region: r, home: h } = data;
    const typeStr = h.houseType === 'rent' ? `월세 ₩${Number(h.monthlyRent||0).toLocaleString('en-US')}${Number(h.maintenanceFee||0) > 0 ? ` + 관리비 ₩${Number(h.maintenanceFee).toLocaleString('en-US')}` : ''}` : `자가${Number(h.maintenanceFee||0) > 0 ? ` / 관리비 ₩${Number(h.maintenanceFee).toLocaleString('en-US')}` : ''}`;
    return `<div class="gb-sub">거주 (${escapeHtml(charLabel)}): <strong>${escapeHtml(h.name)}</strong> (${escapeHtml(r.name)} / ${escapeHtml(h.area)} / ${typeStr})</div>`;
  }).filter(Boolean).join('') || `<div class="gb-sub">${escapeHtml(charLabel)} — 현재 거주 중인 집이 없다.</div>` : `<div class="gb-sub">${escapeHtml(charLabel)} — 현재 거주 중인 집이 없다.</div>`;

  const regionPanels = db.homeRegions.map(region => {
    const homes = (region.homes || []).map(h => {
      const isOwned = ownedHomes.some(o => o.regionId === region.id && o.homeId === h.id);
      const occupant = findHomeOccupant(region.id, h.id);
      const occupiedByOther = occupant && !isOwned;
      const maintStr = Number(h.maintenanceFee||0) > 0 ? ` + 관리비 ₩${Number(h.maintenanceFee).toLocaleString('en-US')}` : '';
      const priceInfo = h.houseType === 'purchase'
        ? `매매가 ₩${Number(h.purchasePrice||0).toLocaleString('en-US')}${maintStr}`
        : `보증금 ₩${Number(h.deposit||0).toLocaleString('en-US')} / 월세 ₩${Number(h.monthlyRent||0).toLocaleString('en-US')}${maintStr}`;
      const brokerInfo = h.brokerFee ? ` / 복비 ₩${Number(h.brokerFee).toLocaleString('en-US')}` : '';
      const featureHtml = h.features && h.features.length ? `<div class="gb-sub" style="margin-top:4px;">${h.features.map(f => `<span class="gb-badge">${escapeHtml(f)}</span>`).join(' ')}</div>` : '';
      // Show storage tier preview
      const pyeong = parseAreaPyeong(h.area);
      const tier = getStorageTier(pyeong);
      const tierLabel = tier.storages.map(s => `${s.name}(${s.maxSlots}칸)`).join(', ');
      // Determine occupancy badge and action buttons
      const occupantBadge = isOwned
        ? `<span class="gb-badge" style="background:#16a34a;color:#dcfce7;">현재 거주 중 (${escapeHtml(charLabel)})</span>`
        : occupiedByOther
          ? `<span class="gb-badge" style="background:#f59e0b;color:#451a03;">거주 중: ${escapeHtml(occupant.label)}</span>`
          : '';
      const actionBtns = isOwned
        ? `<button class="gb-btn tiny primary" data-home-enter="${escapeHtml(region.id)}:${escapeHtml(h.id)}">들어가기</button><button class="gb-btn tiny danger" data-home-moveout="${escapeHtml(region.id)}:${escapeHtml(h.id)}">퇴거</button>`
        : occupiedByOther
          ? ''
          : `<button class="gb-btn tiny primary" data-home-movein="${escapeHtml(region.id)}:${escapeHtml(h.id)}">입주</button>`;
      return `
        <div class="gb-panel${isOwned ? '" style="border-color:#2563eb;' : occupiedByOther ? '" style="border-color:#f59e0b;' : ''}">
          <div class="gb-unit-top">
            <div>
              <strong>${escapeHtml(h.name)}</strong>
              <span class="gb-badge">${escapeHtml(h.area || '')}</span>
              <span class="gb-badge">${h.houseType === 'rent' ? '임대' : h.houseType === 'purchase' ? '매매' : escapeHtml(h.houseType||'')}</span>
              ${occupantBadge}
            </div>
            <div style="display:flex;gap:4px;">
              ${actionBtns}
              <button class="gb-btn tiny danger" data-home-del="${escapeHtml(region.id)}:${escapeHtml(h.id)}">삭제</button>
            </div>
          </div>
          ${h.desc ? `<div class="gb-sub" style="margin-top:6px;">${escapeHtml(h.desc)}</div>` : ''}
          ${featureHtml}
          <div class="gb-sub" style="margin-top:4px;color:#94a3b8;">📦 ${escapeHtml(tierLabel)}</div>
          <div class="gb-sub" style="margin-top:6px;color:#fbbf24;">💰 ${escapeHtml(priceInfo)}${escapeHtml(brokerInfo)}</div>
        </div>`;
    }).join('');
    return `
      <div class="gb-panel">
        <div class="gb-unit-top">
          <div><div class="gb-section-title">🗺️ ${escapeHtml(region.name)}</div></div>
          <div style="display:flex;gap:4px;">
            <button class="gb-btn tiny primary" data-home-sub="addHome:${escapeHtml(region.id)}">🏠 집 추가</button>
            <button class="gb-btn tiny danger" data-home-region-del="${escapeHtml(region.id)}">지역 삭제</button>
          </div>
        </div>
        ${homes || '<div class="gb-sub">이 지역에 등록된 집이 없다.</div>'}
      </div>`;
  }).join('') || '<div class="gb-sub" style="padding:12px;">등록된 지역이 없다. 아래에서 지역을 추가하라.</div>';

  return `
    <div class="gb-panel">
      <div class="gb-section-title">🏠 주거</div>
      <div class="gb-sub">지역을 만들고 그 안에 집을 추가할 수 있다. 입주 시 보증금+복비가 차감된다.</div>
      <div class="gb-sub">평수에 따라 보관함이 자동 배치된다 (≤10평/11~20평/21~30평/31평~).</div>
      ${ownedInfo}
    </div>
    ${regionPanels}
    <div class="gb-btn-row">
      <button class="gb-btn primary" data-home-sub="addRegion">🗺️ 새 지역 추가</button>
      <button class="gb-btn" data-go="hub">← 허브로</button>
    </div>`;
}

// ── 길드 (Guild) ─────────────────────────────────────────────────────────────
const PRESET_GUILDS = [
  { id:'baeknyeon', name:'백련길드', emoji:'🌸', color:'#818cf8' },
  { id:'eunrang',   name:'은랑길드', emoji:'🐺', color:'#94a3b8' },
  { id:'jeokho',    name:'적호길드', emoji:'🔥', color:'#f97316' },
  { id:'heuksa',    name:'흑사길드', emoji:'🕷️', color:'#a78bfa' },
];

function renderGuildView() {
  const db      = model.db;
  const sub     = model.state.guildSub || '';
  const guildId = String(db.guildId || '');
  const isCustom   = guildId === 'custom';
  const presetGuild = PRESET_GUILDS.find(g => g.id === guildId) || null;
  const currentGuild = isCustom
    ? { name: db.customGuildName || '내 길드', emoji: '⚜️' }
    : presetGuild;

  // ── If NOT in a guild ─────────────────────────────────────────────────
  if (!guildId) {
    if (sub === 'create') {
      return `
        <div class="gb-panel">
          <div class="gb-section-title">⚜️ 길드 생성</div>
          <div class="gb-sub">자신만의 길드를 만든다. 이름을 입력하라.</div>
        </div>
        <div class="gb-panel">
          <div id="gb-guild-create-form" style="display:flex;flex-direction:column;gap:8px;">
            <label>길드 이름<input id="gb-guild-name-input" class="gb-input" type="text" placeholder="길드 이름 (최대 20자)" maxlength="20" style="margin-left:8px;width:200px;"></label>
            <label>길드 소개<input id="gb-guild-desc-input" class="gb-input" type="text" placeholder="소개 (선택)" style="margin-left:8px;width:100%;flex:1;"></label>
            <div class="gb-btn-row" style="margin-top:4px;">
              <button type="button" id="gb-guild-create-btn" class="gb-btn primary">⚜️ 길드 창설</button>
              <button type="button" class="gb-btn" data-guild-sub="">← 취소</button>
            </div>
          </div>
        </div>
        <div class="gb-btn-row"><button class="gb-btn" data-go="hub">← 허브로</button></div>`;
    }
    // Show guild list — name + emoji + join button only
    const guildCards = PRESET_GUILDS.map(g => `
      <div class="gb-panel" style="border-color:${g.color}20;">
        <div class="gb-unit-top">
          <div>
            <span style="font-size:18px;">${escapeHtml(g.emoji)}</span>
            <strong style="margin-left:6px;">${escapeHtml(g.name)}</strong>
          </div>
          <button class="gb-btn tiny primary" data-guild-join="${escapeHtml(g.id)}">가입</button>
        </div>
      </div>`).join('');
    return `
      <div class="gb-panel">
        <div class="gb-section-title">⚜️ 길드</div>
        <div class="gb-sub">가입할 길드를 선택하거나 직접 만들 수 있다.</div>
      </div>
      ${guildCards}
      <div class="gb-panel" style="border-color:#2563eb20;">
        <div class="gb-unit-top">
          <div><span style="font-size:18px;">⚜️</span> <strong style="margin-left:6px;">사용자 정의 길드</strong></div>
          <button class="gb-btn tiny" data-guild-sub="create">길드 창설</button>
        </div>
      </div>
      <div class="gb-btn-row"><button class="gb-btn" data-go="hub">← 허브로</button></div>`;
  }

  // ── Already in a guild: show name + emoji + leave ─────────────────────
  return `
    <div class="gb-panel" style="border-color:${presetGuild ? presetGuild.color : '#2563eb'};">
      <div class="gb-section-title">${escapeHtml(currentGuild.emoji)} ${escapeHtml(currentGuild.name)}</div>
      ${isCustom ? '<span class="gb-badge">사용자 정의 길드</span>' : ''}
    </div>
    <div class="gb-btn-row">
      <button class="gb-btn danger" data-guild-leave="">탈퇴</button>
      <button class="gb-btn" data-go="hub">← 허브로</button>
    </div>`;
}

function renderGateView() {
  const gs = gateStateSafe();
  const size = String(gs.size || 'small');
  const rank = String(gs.rank || 'E').toUpperCase();
  const selected = getSelectedGeneratedGate();
  const list = (gs.generated || []);
  const run = getGateRun();

  // Active gate run → show immersive full-screen layout only
  if (run && !run.completed && !run.failed) {
    return renderGateRunPanel(run);
  }

  const rankButtons = GRADE_ORDER.map(r => `<button class="gb-btn ${rank===r?'primary':''}" data-gate-rank="${r}">${escapeHtml(r)}</button>`).join('');
  const sizeButtons = ['small','medium','large'].map(k => `<button class="gb-btn ${size===k?'primary':''}" data-gate-size="${k}">${escapeHtml(GATE_SIZE_META[k].label)}</button>`).join('');
  const cards = list.length ? list.map(g => `
    <button class="gb-card-nav ${g.id===gs.selectedId?'is-selected':''}" data-gate-select="${escapeHtml(g.id)}">
      <div class="gb-card-title">${escapeHtml(g.title)}</div>
      <div class="gb-sub">${escapeHtml(g.rank)} / ${escapeHtml(g.sizeLabel)} / ${escapeHtml(g.primarySpeciesLabel)} + ${escapeHtml(g.secondarySpeciesLabel)}</div>
      <div class="gb-sub">내부 수치와 몬스터 배치는 진입 전 비공개</div>
    </button>
  `).join('') : '<div class="gb-sub">아직 생성된 게이트가 없다. 등급을 고르고 크기를 눌러 생성해.</div>';
  const detail = selected ? `
    <div class="gb-panel">
      <div class="gb-section-title">선택된 게이트</div>
      <div><strong>${escapeHtml(selected.title)}</strong> <span class="gb-badge">${escapeHtml(selected.rank)}</span> <span class="gb-badge">${escapeHtml(selected.sizeLabel)}</span></div>
      <div class="gb-sub">${escapeHtml(selected.description || '')}</div>
      <div class="gb-sub">종족 조합: ${escapeHtml(selected.primarySpeciesLabel)} + ${escapeHtml(selected.secondarySpeciesLabel)}</div>
      <div class="gb-sub">내부 몬스터 수, 광맥, 노드 수는 저장되지만 화면에는 숨김 처리된다.</div>
      <div class="gb-btn-row">
        <button class="gb-btn primary" id="gb-gate-run-start" ${activeGateRun() ? 'disabled' : ''}>${activeGateRun() ? '진행 중인 게이트가 있음' : '이 게이트로 진입'}</button>
        <button class="gb-btn" id="gb-gate-apply">이 게이트를 적 편성에 반영</button>
        <button class="gb-btn" id="gb-gate-apply-go">반영 후 전투 화면으로</button>
        <button class="gb-btn" id="gb-gate-reroll-one">선택 게이트만 다시 굴리기</button>
      </div>
    </div>
  ` : '<div class="gb-panel"><div class="gb-sub">생성된 게이트를 하나 선택해.</div></div>';
  return `
    <div class="gb-panel">
      <div class="gb-section-title">게이트 자동 생성</div>
      <div class="gb-sub">먼저 게이트 등급(E~S)을 고르고, 그 다음 소형/중형/대형을 선택해 생성한다. 내부 몬스터 수·광맥 수·노드 수는 저장되지만 화면에는 숨겨진다.</div>
      <div class="gb-sub">생성 시 게이트 등급/규모/종족 조합에 맞춰 몬스터가 자동 배치된다.</div>
      <div class="gb-btn-row">${rankButtons}</div>
      <div class="gb-btn-row">${sizeButtons}<button class="gb-btn" id="gb-gate-reroll">현재 등급/크기 다시 생성</button></div>
    </div>
    <div class="gb-grid two" style="align-items:start;">
      <div class="gb-grid">${cards}</div>
      <div>${detail}</div>
    </div>
    ${run ? renderGateRunPanel(run) : ''}
  `;
}

function optionHtml(value, label, selected) {
    return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }
  function characterOptions(selected, allowBlank) {
    const opts = [];
    if (allowBlank) opts.push(optionHtml('', '(비움)', !selected));
    (model.db.characters || []).forEach(c => opts.push(optionHtml(c.id, `${c.name} [${c.job}]`, selected === c.id)));
    (model.db.personas || []).forEach(p => opts.push(optionHtml(p.id, `${p.name} [페르소나]`, selected === p.id)));
    return opts.join('');
  }
  function monsterOptions(selected, allowBlank) {
    const opts = [];
    if (allowBlank) opts.push(optionHtml('', '(비움)', !selected));
    (model.db.monsters || []).forEach(c => opts.push(optionHtml(c.id, `${c.name} [${c.kind || 'Normal'}]`, selected === c.id)));
    return opts.join('');
  }
  function targetOptions(runtime, actor, selected) {
    const foes = actor.side === 'party' ? getAlive(runtime.enemies) : getAlive(runtime.party);
    const allies = actor.side === 'party' ? getAlive(runtime.party) : getAlive(runtime.enemies);
    const out = ['<option value="">(자동/기본)</option>'];
    out.push('<optgroup label="적">');
    foes.forEach(u => out.push(optionHtml(u.uid, `${u.name} [${rowLabel(u.row)}]`, selected === u.uid)));
    out.push('</optgroup><optgroup label="아군">');
    allies.forEach(u => out.push(optionHtml(u.uid, `${u.name} [${rowLabel(u.row)}]`, selected === u.uid)));
    out.push('</optgroup>');
    return out.join('');
  }
  function skillOptions(unit, selected) {
    const out = ['<option value="">(스킬 없음)</option>'];
    listKnownSkillDefs(unit).filter(sk => sk.category !== 'passive').forEach(sk => {
      out.push(optionHtml(sk.id, `${sk.name} [${sk.category}]`, selected === sk.id));
    });
    return out.join('');
  }


// ── 골드 이동 패널 ────────────────────────────────────────────────────────────
function renderGoldTransferPanel() {
  const inv = getInventory();
  const sharedGold = Number(inv.gold || 0);
  const allChars = model.db.characters || [];
  const allPersonas = model.db.personas || [];
  const fmtG = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억원` : n >= 10000 ? `${Math.round(n/10000)}만원` : `${n.toLocaleString('en-US')}원`;

  // 파티에 편성된 캐릭터만 표시
  const partySlotIds = ((model.db.battleSetup || {}).partySlots || []).filter(Boolean);
  const allUnits = [...allChars.map(c => ({ ...c, _type:'char' })), ...allPersonas.map(p => ({ ...p, _type:'persona' }))];
  const partyMembers = partySlotIds.map(id => allUnits.find(u => u.id === id)).filter(Boolean);

  const charRows = partyMembers.map(m => {
    const g = Number((m.inventory && m.inventory.gold) || m.gold || 0);
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.08);">
      <span style="flex:1;font-size:12px;"><strong>${escapeHtml(m.name||m.id)}</strong> <span class="gb-badge">${m._type === 'char' ? '캐릭터' : '페르소나'}</span> ${fmtG(g)}</span>
      <input type="number" min="1" placeholder="금액" style="width:90px;" class="gb-input" id="gb-gold-xfer-amt-${escapeHtml(m.id)}" value="">
      <button class="gb-btn tiny" data-gold-to-shared="${escapeHtml(m.id)}" data-gold-xfer-type="${m._type}">→공용</button>
      <button class="gb-btn tiny" data-gold-from-shared="${escapeHtml(m.id)}" data-gold-xfer-type="${m._type}">공용→</button>
    </div>`;
  }).join('');

  return `<div class="gb-panel">
    <div class="gb-section-title">💸 골드 이동</div>
    <div class="gb-sub" style="margin-bottom:6px;">공용 인벤 ↔ 파티원 사이에 골드를 이동한다. <strong>공용: ${fmtG(sharedGold)}</strong></div>
    ${charRows || '<div class="gb-sub">파티에 편성된 캐릭터가 없습니다. 파티 탭에서 먼저 편성하세요.</div>'}
  </div>`;
}

function renderInventoryView() {
  const inv = getInventory();
  const cap = inventoryCapacity();
  const usedSlots = inventoryUsedSlots(inv);
  const usedWeight = inventoryUsedWeightG(inv);
  const items = (inv.items || []).slice().sort((a,b) => `${a.category||''}${a.rank||''}${a.name||''}`.localeCompare(`${b.category||''}${b.rank||''}${b.name||''}`, 'ko'));
  const slotItems = items.filter(it => inventoryConsumesSlot(it));
  const stackItems = items.filter(it => !inventoryConsumesSlot(it));
  const overflow = (inv.overflow || []).slice();
  const recent = (inv.recent || []).slice(0, 12);
  const partyBagSummary = cap.bags && cap.bags.length > 0
    ? cap.bags.map(b => b.name).join(', ')
    : '파티에 가방 없음';
  const supply = campSupplyStock();
  const overflowRows = overflow.length ? overflow.map(it => `<div class="gb-sub">- ${escapeHtml(it.name)} x${Number(it.count||1)}</div>`).join('') : '<div class="gb-sub">없음</div>';

  // ── Slot grid ──────────────────────────────────────────────────────────────
  // Each slot-consuming item occupies one tile; remaining tiles are empty
  const totalSlots = cap.slots;
  const CATEGORY_COLORS = {
    gear:          '#1d4ed8',
    equipment:     '#1d4ed8',
    consumable:    '#15803d',
    supply:        '#15803d',
    potion:        '#7c3aed',
    other:         '#475569',
  };
  function slotColor(it) {
    const c = String(it.category || '').toLowerCase();
    return CATEGORY_COLORS[c] || CATEGORY_COLORS.other;
  }
  const slotTiles = [];
  function buildItemTooltip(it) {
    const lines = [
      it.name + (it.rank ? ` [${it.rank}]` : ''),
      `분류: ${it.category || '기타'} | 수량: ${Number(it.count||1)} | 무게: ${formatWeightG(Math.round(inventoryBaseWeightG(it) * cap.weightMul))}`
    ];
    if (it.part) lines.push(`부위: ${EQUIP_PART_LABELS[it.part] || it.part}`);
    if (it.part === 'armor' && it.armorSubtype && ARMOR_SUBTYPES[it.armorSubtype]) lines.push(`갑옷 종류: ${ARMOR_SUBTYPES[it.armorSubtype].label}`);
    if (it.enhance > 0) lines.push(`강화: +${it.enhance}`);
    if (it.durability != null) lines.push(`내구도: ${it.durability}/${it.maxDurability||it.durability}`);
    if (it.category === 'equipment') {
      const atkVal = Number(it.atk || 0);
      const pdefVal = Number(it.pdef || 0);
      const mdefVal = Number(it.mdef || 0);
      const combatLines = [];
      if (it.part === 'weapon') combatLines.push(`ATK: +${atkVal}`);
      if (it.part === 'subweapon') { combatLines.push(`물리방어: +${pdefVal}`); combatLines.push(`ATK: ${-Math.ceil(pdefVal/2)}`); }
      if (it.part === 'armor') { combatLines.push(`물리방어: +${pdefVal}`); combatLines.push(`마법방어: +${mdefVal}`); }
      if (it.part === 'accessory') combatLines.push(it.traits && it.traits.length ? `특성: ${it.traits.map(t=>equipTraitDisplay(t, it.rank)).join(', ')}` : '특성 없음');
      if (combatLines.length) lines.push(combatLines.join(' / '));
      if (it.mainStat) lines.push(`주 스탯: ${it.mainStat.toUpperCase()}`);
      if (it.resistType && it.resistPct) lines.push(`${EQUIP_TRAIT_LABELS[it.resistType]||it.resistType} 저항 ${it.resistPct}%`);
    }
    if (it.stats && typeof it.stats === 'object') {
      const statStrs = Object.entries(it.stats).filter(([,v])=>Number(v)!==0).map(([k,v])=>`${k.toUpperCase()}+${v}`);
      if (statStrs.length) lines.push('스탯: ' + statStrs.join(' / '));
    }
    if (Array.isArray(it.traits) && it.traits.length && it.category !== 'equipment') lines.push('특성: ' + it.traits.map(t => EQUIP_TRAIT_LABELS[t] || t).join(', '));
    if (it.effect) lines.push('효과: ' + it.effect);
    if (it.note) lines.push('메모: ' + it.note);
    if (it.suggestedPrice) lines.push(`기준가: ₩${Number(it.suggestedPrice).toLocaleString('en-US')}`);
    return lines.join('\n');
  }
  const isConvFood = it => it && it.category === 'convFood';
  const INV_COLLAPSE_THRESHOLD = 40;
  const invCollapsed = model.state.invGridCollapsed !== false; // default collapsed when > threshold
  for (let i = 0; i < totalSlots; i++) {
    const it = slotItems[i];
    if (it) {
      const key = inventoryItemKey(it);
      const bg = slotColor(it);
      const canUse = isConvFood(it) || it.category === 'campSupply';
      slotTiles.push(`
        <div class="gb-inv-slot filled gb-inv-tooltip-wrap" style="background:${bg}22;border-color:${bg}66;">
          <div class="gb-inv-slot-name">${escapeHtml(it.name)}</div>
          <div class="gb-inv-slot-meta">${escapeHtml(it.rank || '')} · ×${Number(it.count||1)}</div>
          <div class="gb-inv-slot-tooltip">${escapeHtml(buildItemTooltip(it))}</div>
          <div class="gb-inv-slot-btns">
            ${canUse ? `<button class="gb-btn tiny" data-inv-use="${escapeHtml(key)}" title="사용하기">사용</button>` : `<button class="gb-btn tiny" data-inv-drop-one="${escapeHtml(key)}" title="1개 버리기">−1</button>`}
            <button class="gb-btn tiny danger" data-inv-drop-all="${escapeHtml(key)}" title="전체 ${canUse ? '사용' : '버리기'}">${canUse ? '전체사용' : '全버리기'}</button>
          </div>
        </div>`);
    } else {
      slotTiles.push(`<div class="gb-inv-slot empty"><div class="gb-inv-slot-empty-label">${i < usedSlots ? '' : '빈 슬롯'}</div></div>`);
    }
  }
  // collapse: when totalSlots > threshold and state is collapsed, trim trailing empty slots
  const needsCollapse = totalSlots > INV_COLLAPSE_THRESHOLD;
  let visibleTiles = slotTiles;
  let hiddenCount = 0;
  if (needsCollapse && invCollapsed) {
    // show all filled tiles + up to INV_COLLAPSE_THRESHOLD total
    const filledCount = slotItems.length;
    const showCount = Math.max(filledCount, INV_COLLAPSE_THRESHOLD);
    visibleTiles = slotTiles.slice(0, showCount);
    hiddenCount = slotTiles.length - visibleTiles.length;
  }

  // ── Stackable rows (materials, mana stones, consumables that don't use slots)
  const stackRows = stackItems.length ? stackItems.map(it => {
    const key = inventoryItemKey(it);
    const effWeight = Math.round(inventoryBaseWeightG(it) * cap.weightMul);
    return `<div class="gb-unit"><div class="gb-unit-top"><div><strong>${escapeHtml(it.name)}</strong> <span class="gb-badge">${escapeHtml(it.rank || '')}</span> <span class="gb-badge">${escapeHtml(it.category || '')}</span></div><div><button class="gb-btn tiny" data-inv-drop-one="${escapeHtml(key)}">1개 버리기</button> <button class="gb-btn tiny danger" data-inv-drop-all="${escapeHtml(key)}">전체 버리기</button></div></div><div class="gb-sub">수량 ${Number(it.count||1)} / 무게 ${formatWeightG(effWeight)}${it.note ? ` / ${escapeHtml(it.note)}` : ''}${it.suggestedPrice ? ` / 기준가 ₩${Number(it.suggestedPrice).toLocaleString('en-US')}` : ''}</div></div>`;
  }).join('') : '';

  return `
    <div class="gb-grid two">
      <div class="gb-panel">
        <div class="gb-section-title">🎒 공용 인벤토리</div>
        <label>소지금<input class="gb-input" id="gb-inv-gold" type="number" value="${Number(inv.gold||0)}"></label>
        <div class="gb-sub">파티 가방: ${escapeHtml(partyBagSummary)}</div>
        <div class="gb-sub">기본 ${INVENTORY_BASE_SLOTS}칸 / ${formatWeightG(INVENTORY_BASE_MAX_WEIGHT_G)}. 파티원 가방 보너스의 <strong>20%</strong>만 공용인벤에 적용 (나머지는 개인 짐).</div>
        <div class="gb-sub">모든 아이템이 슬롯을 차지한다. 같은 종류(stackable)는 1칸에 합산된다.</div>
        <div class="gb-sub">사용 슬롯 <strong>${usedSlots}/${cap.slots}</strong> / 사용 무게 ${formatWeightG(usedWeight)} / 최대 ${formatWeightG(cap.maxWeightG)}</div>
        <div class="gb-sub">야영 보급: 텐트 ${supply.tent} / 식량 ${supply.ration} / 물 ${supply.water}</div>
        <div class="gb-sub">곡괭이: ${GRADE_ORDER.map(g => `${g}:${getPickaxeCount(g)}`).join(' / ')}</div>
        <div class="gb-btn-row">
          <button class="gb-btn primary" id="gb-inv-save">설정 저장</button>
          <button class="gb-btn" id="gb-inv-collect-overflow">오버플로우 회수</button>
          <button class="gb-btn danger" id="gb-inv-clear-overflow">오버플로우 삭제</button>
        </div>
      </div>
      <div class="gb-panel">
        <div class="gb-section-title">최근 획득</div>
        <div class="gb-log">${recent.length ? recent.map(t => `<div>• ${escapeHtml(t)}</div>`).join('') : '<div>아직 획득 기록이 없다.</div>'}</div>
        <div class="gb-section-title" style="margin-top:12px;">오버플로우</div>
        <div class="gb-log">${overflowRows}</div>
      </div>
    </div>
    <div class="gb-panel">
      <div class="gb-section-title">슬롯 아이템 (${usedSlots}/${cap.slots}칸 사용)</div>
      <div class="gb-inv-grid">${visibleTiles.join('')}</div>
      ${needsCollapse ? `<div class="gb-btn-row" style="margin-top:8px;"><button class="gb-btn tiny" id="gb-inv-grid-toggle">${invCollapsed ? `▼ 빈 슬롯 펼치기 (${hiddenCount}칸 숨김)` : '▲ 빈 슬롯 접기'}</button></div>` : ''}
      ${slotItems.length === 0 ? '<div class="gb-sub" style="margin-top:8px;">슬롯을 차지하는 아이템이 없다. (장비·소모품 등)</div>' : ''}
    </div>
    ${stackItems.length ? `
    <div class="gb-panel">
      <div class="gb-section-title">스택 아이템 (슬롯 내 합산)</div>
      <div>${stackRows}</div>
    </div>` : ''}
    ${renderGoldTransferPanel()}
  `;
}

// ── 파티 관리 뷰 ─────────────────────────────────────────────────────────────
function renderPartyView() {
  const setup = model.db.battleSetup || { partySlots:[], enemySlots:[] };
  const allChars = (model.db.characters || []);
  const allPersonas = (model.db.personas || []);
  const allUnits = allChars.concat(allPersonas);

  // 허브 팀 연동 — 팀이 결성되어 있으면 팀원만 파티에 표시
  const team = Array.isArray(model.db.team) ? model.db.team : [];
  const teamCharIds = team.map(m => m.charId).filter(id => id && id !== '__shared__');

  // 팀이 없으면 빈 화면
  if (teamCharIds.length === 0) {
    return `
      <div class="gb-panel">
        <div class="gb-section-title">👥 파티 관리</div>
        <div class="gb-sub" style="margin:16px 0;">팀이 결성되지 않았습니다. 허브 → 팀 패널에서 먼저 팀을 구성하세요.</div>
        <div class="gb-btn-row"><button class="gb-btn" data-go="hub">허브로 이동</button></div>
      </div>
    `;
  }

  // 팀원을 파티 슬롯에 자동 연동 (battleSetup.partySlots를 팀원 기반으로 갱신)
  if (!model.db.battleSetup) model.db.battleSetup = { partySlots:[], enemySlots:[] };
  if (!model.db.battleSetup.partySlots) model.db.battleSetup.partySlots = [];
  for (let i = 0; i < MAX_PARTY; i++) {
    model.db.battleSetup.partySlots[i] = teamCharIds[i] || '';
  }

  // 현재 파티에 들어있는 캐릭터 (팀 기반)
  const partySlots = [];
  for (let i = 0; i < teamCharIds.length && i < MAX_PARTY; i++) {
    const slotId = teamCharIds[i];
    const unit = allUnits.find(u => u.id === slotId);
    partySlots.push({ index: i, id: slotId, unit });
  }

  // 파티 멤버 카드 렌더
  const partyCards = partySlots.map((slot, i) => {
    if (!slot.unit) {
      return `<div class="gb-panel" style="min-height:120px;display:flex;align-items:center;justify-content:center;opacity:0.5;">
        <div class="gb-sub">슬롯 ${i + 1} — 팀원 (DB에 미등록: ${escapeHtml(slot.id)})</div>
      </div>`;
    }
    const u = slot.unit;
    const stats = u.stats || { str:0, con:0, int:0, agi:0, sense:0 };
    const freePoints = Number(u.freeStatPoints || 0);
    const lv = Number(u.level || 1);
    const curExp = Number(u.exp || 0);
    const needed = expNeededForLevel(lv);
    const expPct = Math.min(100, Math.round((curExp / needed) * 100));
    const statCap = STAT_CAP_BY_RANK[u.rank || 'E'] || STAT_CAP_BY_RANK.E;

    const statNames = { str:'근력', con:'체력', int:'지능', agi:'민첩', sense:'감각' };
    const statRows = Object.entries(statNames).map(([key, label]) => {
      const val = Number(stats[key] || 0);
      const atCap = val >= statCap;
      return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
        <span style="width:40px;font-size:12px;">${label}</span>
        <span style="width:30px;text-align:right;font-weight:600;${atCap?'color:#ef4444;':''}">${val}</span>
        <span class="gb-sub" style="font-size:10px;">/${statCap}</span>
        ${freePoints > 0 && !atCap ? `<button class="gb-btn tiny" data-party-statup="${escapeHtml(u.id)}:${key}" style="padding:1px 6px;font-size:11px;">+1</button>` : ''}
      </div>`;
    }).join('');

    // 장비 요약
    const pInv = getPersonalInv(allChars.find(c=>c.id===u.id) ? 'character' : 'persona', u.id);
    const eqSummary = pInv ? EQUIP_PARTS.map(p => {
      const eq = pInv.equipped[p];
      return eq ? `${EQUIP_PART_LABELS[p]}: <span style="${rarityStyle(eq.rarity)}">${escapeHtml(eq.name||eq.id)}${eq.enhance>0?` +${eq.enhance}`:''}</span>` : null;
    }).filter(Boolean).join(' / ') || '장착 장비 없음' : '장비정보 없음';
    const personalGold = Number(u.gold || 0);
    const fmtG = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 10000 ? `${Math.round(n/10000)}만` : n.toLocaleString('en-US');

    return `<div class="gb-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>${escapeHtml(u.name)}</strong> <span class="gb-badge">${escapeHtml(u.rank || 'E')}</span>
          <div class="gb-sub">${escapeHtml(u.job || '직업없음')} / ${escapeHtml(rowLabel(u.row))} / Lv${lv}</div>
        </div>
      </div>
      <div style="margin:6px 0;">
        <div class="gb-sub">EXP: ${curExp}/${needed} (${expPct}%)</div>
        <div style="background:rgba(100,100,100,0.3);height:6px;border-radius:3px;margin-top:3px;">
          <div style="width:${expPct}%;height:100%;background:#3b82f6;border-radius:3px;"></div>
        </div>
      </div>
      <div class="gb-sub" style="margin:4px 0;">
        <div class="gb-bar-wrap"><span>HP ${Number(u.currentHp ?? u.hp ?? 0)}/${Number(u.hp||0)}</span><div class="gb-bar"><div class="gb-bar-fill hp" style="width:${Number(u.hp||0)>0?Math.round(Number(u.currentHp ?? u.hp ?? 0)/Number(u.hp||1)*100):0}%"></div></div></div>
        <div class="gb-bar-wrap"><span>MP ${Number(u.currentMp ?? u.mp ?? 0)}/${Number(u.mp||0)}</span><div class="gb-bar"><div class="gb-bar-fill mp" style="width:${Number(u.mp||0)>0?Math.round(Number(u.currentMp ?? u.mp ?? 0)/Number(u.mp||1)*100):0}%"></div></div></div>
        <div class="gb-bar-wrap"><span>SP ${Number(u.currentSp ?? u.sp ?? 0)}/${Number(u.sp||0)}</span><div class="gb-bar"><div class="gb-bar-fill sp" style="width:${Number(u.sp||0)>0?Math.round(Number(u.currentSp ?? u.sp ?? 0)/Number(u.sp||1)*100):0}%"></div></div></div>
        <div class="gb-sub" style="font-size:11px;margin-top:2px;">ATK:${Number(u.atk||0)} PDEF:${Number(u.pdef||0)} MDEF:${Number(u.mdef||0)}</div>
      </div>
      <div class="gb-sub" style="margin:2px 0;">💰 소지금: ${fmtG(personalGold)}원</div>
      ${freePoints > 0 ? `<div style="color:#34d399;font-weight:600;font-size:13px;margin:4px 0;">🌟 배분 가능 스탯포인트: ${freePoints}</div>` : ''}
      <div class="gb-sub" style="font-size:11px;margin:2px 0;">스탯 상한: ${statCap} (${u.rank || 'E'}등급)</div>
      <div style="margin-top:4px;">${statRows}</div>
      <div class="gb-sub" style="margin-top:4px;font-size:11px;">⚔️ ${eqSummary}</div>
      <div class="gb-sub" style="margin-top:4px;">스킬: ${(u.skills || []).map(s => {
        const sk = getAllSkillMap()[s];
        if (!sk) return escapeHtml(s);
        const costStr = sk.costs ? [sk.costs.mp ? `MP:${sk.costs.mp}` : '', sk.costs.sp ? `SP:${sk.costs.sp}` : ''].filter(Boolean).join('/') : '';
        const coefStr = sk.coef ? `계수:${sk.coef}` : '';
        const catLabel = { singleAttack:'단일공격', aoeAttack:'광역공격', singleCC:'단일CC', aoeCC:'광역CC', buff:'버프', singleHeal:'힐', aoeHeal:'광역힐', passive:'패시브', utility:'유틸' }[sk.category] || sk.category;
        const tooltip = [catLabel, coefStr, costStr, sk.desc || ''].filter(Boolean).join(' | ');
        return `<span class="gb-skill-tag" title="${escapeHtml(tooltip)}" style="cursor:help;border-bottom:1px dashed rgba(148,163,184,0.4);">${escapeHtml(sk.name)}</span>`;
      }).join(', ') || '없음'}</div>
      <div class="gb-btn-row" style="margin-top:6px;">
        <button class="gb-btn tiny" data-party-inv="${escapeHtml(u.id)}">🎒 인벤토리</button>
      </div>
    </div>`;
  }).join('');

  // 파티 인벤토리 관리 (선택된 파티원)
  const partyInvTarget = model.state.partyInvTarget || '';
  const partyInvUnit = partyInvTarget ? allUnits.find(u => u.id === partyInvTarget) : null;
  const partyInvSection = partyInvUnit ? (() => {
    const type = allChars.find(c => c.id === partyInvUnit.id) ? 'character' : 'persona';
    return `<div class="gb-panel" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="gb-section-title">🎒 ${escapeHtml(partyInvUnit.name)} 인벤토리 관리</div>
        <button class="gb-btn tiny" data-party-inv-close>✕ 닫기</button>
      </div>
      ${renderPersonalInventoryHtml(type, partyInvUnit.id)}
    </div>`;
  })() : '';

  // 파티 골드 이동 패널 (파티원만 표시)
  const partyGoldSection = (() => {
    const inv = getInventory();
    const sharedGold = Number(inv.gold || 0);
    const fmtGG = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억원` : n >= 10000 ? `${Math.round(n/10000)}만원` : `${n.toLocaleString('en-US')}원`;
    const partyMembers = partySlots.filter(s => s.unit).map(s => s.unit);
    if (!partyMembers.length) return '';
    const rows = partyMembers.map(m => {
      const type = allChars.find(c => c.id === m.id) ? 'char' : 'persona';
      const g = Number((m.inventory && m.inventory.gold) || m.gold || 0);
      return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.08);">
        <span style="flex:1;font-size:12px;"><strong>${escapeHtml(m.name||m.id)}</strong> ${fmtGG(g)}</span>
        <input type="number" min="1" placeholder="금액" style="width:90px;" class="gb-input" id="gb-gold-xfer-amt-${escapeHtml(m.id)}" value="">
        <button class="gb-btn tiny" data-gold-to-shared="${escapeHtml(m.id)}" data-gold-xfer-type="${type}">→공용</button>
        <button class="gb-btn tiny" data-gold-from-shared="${escapeHtml(m.id)}" data-gold-xfer-type="${type}">공용→</button>
      </div>`;
    }).join('');
    return `<div class="gb-panel" style="margin-top:12px;">
      <div class="gb-section-title">💸 파티 골드 이동</div>
      <div class="gb-sub" style="margin-bottom:6px;">파티원 ↔ 공용인벤 골드 이동. <strong>공용: ${fmtGG(sharedGold)}</strong></div>
      ${rows}
    </div>`;
  })();

  return `
    <div class="gb-panel">
      <div class="gb-section-title">👥 파티 관리</div>
      <div class="gb-sub" style="margin-bottom:8px;">허브에서 편성한 팀원이 파티로 자동 연동됩니다. 스탯포인트 배분, 인벤토리 관리, 골드 이동이 가능합니다.</div>
    </div>
    <div class="gb-grid two">${partyCards}</div>
    ${partyInvSection}
    ${partyGoldSection}
    <div class="gb-panel" style="margin-top:12px;">
      <div class="gb-btn-row">
        <button class="gb-btn primary" id="gb-party-save-all">파티 저장</button>
        <button class="gb-btn" data-go="hub">허브 (팀 편성)</button>
        <button class="gb-btn" data-go="battle">전투 화면으로</button>
      </div>
    </div>
  `;
}

// ── 캐릭터 관리 뷰 (페르소나 중심) ──────────────────────────────────────────
function renderCharacterView() {
  const charTab = model.state.charViewTab || 'personas';
  const allPersonas = model.db.personas || [];
  const allChars = model.db.characters || [];
  const items = charTab === 'characters' ? allChars : allPersonas;
  const selectedId = model.state.charViewSelected || '';
  const selected = items.find(c => c.id === selectedId) || null;

  const listHtml = items.length === 0
    ? '<div class="gb-sub">등록된 항목이 없습니다. DB에서 추가해주세요.</div>'
    : items.map(c => {
        const isActive = c.id === selectedId;
        const lv = Number(c.level || 1);
        const freeP = Number(c.freeStatPoints || 0);
        return `<button class="gb-list-item ${isActive ? 'is-active' : ''}" data-charview-select="${escapeHtml(c.id)}">
          ${escapeHtml(c.name)} <span class="gb-sub">[${escapeHtml(c.job || '?')}] Lv${lv}</span>
          ${freeP > 0 ? ` <span style="color:#34d399;">🌟${freeP}</span>` : ''}
        </button>`;
      }).join('');

  let detailHtml = '<div class="gb-sub">좌측에서 캐릭터를 선택하세요.</div>';
  if (selected) {
    const u = selected;
    const stats = u.stats || { str:0, con:0, int:0, agi:0, sense:0 };
    const freePoints = Number(u.freeStatPoints || 0);
    const lv = Number(u.level || 1);
    const curExp = Number(u.exp || 0);
    const needed = expNeededForLevel(lv);
    const expPct = Math.min(100, Math.round((curExp / needed) * 100));

    const statNames = { str:'근력(STR)', con:'체력(CON)', int:'지능(INT)', agi:'민첩(AGI)', sense:'감각(SENSE)' };
    const statEffects = {
      str: '물리공격력 +0.2, HP +3',
      con: 'HP +10',
      agi: '물리공격력 +0.2, SP +10',
      int: '마법공격력 +0.3, MP +10',
      sense: 'SP +3, MP +3'
    };
    const statCap = STAT_CAP_BY_RANK[u.rank || 'E'] || STAT_CAP_BY_RANK.E;
    const statRows = Object.entries(statNames).map(([key, label]) => {
      const val = Number(stats[key] || 0);
      const atCap = val >= statCap;
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.1);">
        <span style="width:100px;font-size:13px;font-weight:600;">${label}</span>
        <span style="width:35px;text-align:right;font-size:15px;font-weight:700;${atCap?'color:#ef4444;':''}">${val}</span>
        <span class="gb-sub" style="font-size:10px;">/${statCap}</span>
        <span class="gb-sub" style="flex:1;font-size:11px;">(${statEffects[key]})</span>
        ${freePoints > 0 && !atCap ? `<button class="gb-btn tiny" data-charview-statup="${escapeHtml(u.id)}:${key}" style="padding:2px 8px;">+1</button>` : ''}
      </div>`;
    }).join('');

    const skillMap = getAllSkillMap();
    const skillList = (u.skills || []).map(sId => {
      const sk = skillMap[sId];
      if (!sk) return `<div class="gb-sub" style="padding:2px 0;">• ${escapeHtml(sId)}</div>`;
      const costStr = sk.costs ? [sk.costs.mp ? `MP:${sk.costs.mp}` : '', sk.costs.sp ? `SP:${sk.costs.sp}` : ''].filter(Boolean).join(' / ') : '비용 없음';
      const coefStr = sk.coef != null ? `계수: ${sk.coef}` : '';
      const catLabel = { singleAttack:'단일공격', aoeAttack:'광역공격', singleCC:'단일CC', aoeCC:'광역CC', buff:'버프', singleHeal:'힐', aoeHeal:'광역힐', passive:'패시브', utility:'유틸' }[sk.category] || sk.category;
      const elemStr = sk.element && sk.element !== 'none' ? `속성:${sk.element}` : '';
      const dmgTypeStr = sk.damageType ? `타입:${sk.damageType}` : '';
      const statTypeStr = (sk.statTypes||[]).length ? `스탯:${sk.statTypes.join('/')}` : '';
      const durationStr = sk.duration ? `${sk.duration}턴` : '';
      const ccStr = sk.cc ? `CC:${sk.cc.type}(${sk.cc.turns}턴)` : '';
      const buffStr = sk.buff && sk.buff.stats ? `버프:${Object.entries(sk.buff.stats).map(([k,v])=>`${k}+${v}`).join(',')}` : '';
      const passiveStr = sk.passiveBonuses ? `패시브:${Object.entries(sk.passiveBonuses).map(([k,v])=>`${k}+${v}`).join(',')}` : '';
      const byRankStr = sk.byRank ? '(등급별 성장)' : '';
      const details = [catLabel, coefStr, costStr, dmgTypeStr, elemStr, statTypeStr, durationStr, ccStr, buffStr, passiveStr, byRankStr].filter(Boolean).join(' | ');
      return `<div class="gb-sub" style="padding:2px 0;cursor:help;" title="${escapeHtml(details)}">• <strong>${escapeHtml(sk.name)}</strong> <span class="gb-badge">${escapeHtml(catLabel)}</span> ${coefStr ? `<span class="gb-badge">${coefStr}</span>` : ''} ${costStr ? `<span class="gb-sub" style="font-size:10px;">[${escapeHtml(costStr)}]</span>` : ''} ${sk.desc ? '— ' + escapeHtml(sk.desc) : ''}</div>`;
    }).join('') || '<div class="gb-sub">스킬 없음</div>';

    detailHtml = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div>
          <div style="font-size:18px;font-weight:700;">${escapeHtml(u.name)}</div>
          <div class="gb-sub">${escapeHtml(u.job || '직업없음')} / ${escapeHtml(u.rank || 'E')}등급 / ${escapeHtml(rowLabel(u.row))} / Lv${lv}</div>
        </div>
        <span class="gb-badge" style="font-size:14px;">${escapeHtml(u.rank || 'E')}</span>
      </div>
      <div style="margin:8px 0;">
        <div class="gb-sub">EXP: ${curExp} / ${needed} (${expPct}%)</div>
        <div style="background:rgba(100,100,100,0.3);height:8px;border-radius:4px;margin-top:4px;">
          <div style="width:${expPct}%;height:100%;background:#3b82f6;border-radius:4px;transition:width 0.3s;"></div>
        </div>
      </div>
      <div class="gb-grid two" style="margin:8px 0;">
        <div class="gb-sub">❤️ HP: <strong>${Number(u.currentHp ?? u.hp ?? 0)}</strong> / ${Number(u.hp||0)}</div>
        <div class="gb-sub">💧 MP: <strong>${Number(u.currentMp ?? u.mp ?? 0)}</strong> / ${Number(u.mp||0)}</div>
        <div class="gb-sub">⚡ SP: <strong>${Number(u.currentSp ?? u.sp ?? 0)}</strong> / ${Number(u.sp||0)}</div>
        <div class="gb-sub">⚔️ ATK: <strong>${Number(u.atk||0)}</strong></div>
        <div class="gb-sub">🛡️ 물리방어: <strong>${Number(u.pdef||0)}</strong></div>
        <div class="gb-sub">🔮 마법방어: <strong>${Number(u.mdef||0)}</strong></div>
      </div>
      ${freePoints > 0 ? `<div style="color:#34d399;font-weight:700;font-size:14px;margin:8px 0;padding:6px;background:rgba(52,211,153,0.1);border-radius:6px;">🌟 배분 가능 스탯포인트: ${freePoints}</div>` : ''}
      <div style="margin:8px 0;">
        <div class="gb-section-title" style="font-size:13px;">스탯 <span class="gb-sub" style="font-size:11px;">(상한: ${statCap} / ${u.rank || 'E'}등급)</span></div>
        ${statRows}
      </div>
      <div style="margin:8px 0;">
        <div class="gb-section-title" style="font-size:13px;">스킬</div>
        ${skillList}
      </div>
      ${u.note ? `<div class="gb-sub" style="margin-top:8px;">📝 ${escapeHtml(u.note)}</div>` : ''}
      ${u.id ? renderEquippedStatSection(u, charTab === 'characters' ? 'character' : 'persona') : ''}
    `;
  }

  return `
    <div class="gb-btn-row" style="margin-bottom:8px;">
      <button class="gb-btn ${charTab==='personas'?'primary':''}" data-charview-tab="personas">페르소나</button>
      <button class="gb-btn ${charTab==='characters'?'primary':''}" data-charview-tab="characters">캐릭터</button>
    </div>
    <div class="gb-grid db">
      <div class="gb-panel">
        <div class="gb-section-title">${charTab === 'characters' ? '캐릭터' : '페르소나'} 목록</div>
        ${listHtml}
      </div>
      <div class="gb-panel">
        <div class="gb-section-title">상세 정보</div>
        ${detailHtml}
      </div>
    </div>
    ${selected && selected.id ? renderPersonalInventoryHtml(charTab === 'characters' ? 'character' : 'persona', selected.id) : ''}
  `;
}

function renderBattleSetup() {
  const setup = model.db.battleSetup || { partySlots:[], enemySlots:[] };
  const currentGate = gateStateSafe().current;
  const partyRows = [];
  const enemyRows = [];
  for (let i = 0; i < MAX_PARTY; i += 1) {
    partyRows.push(`<label>파티 ${i+1}<select class="gb-input" id="gb-party-slot-${i}">${characterOptions(setup.partySlots[i] || '', true)}</select></label>`);
  }
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    enemyRows.push(`<label>적 ${i+1}<select class="gb-input" id="gb-enemy-slot-${i}">${monsterOptions(setup.enemySlots[i] || '', true)}</select></label>`);
  }
  const gateInfo = currentGate ? `
    <div class="gb-panel">
      <div class="gb-section-title">현재 연결된 게이트</div>
      <div><strong>${escapeHtml(currentGate.title)}</strong> <span class="gb-badge">${escapeHtml(currentGate.rank)}</span> <span class="gb-badge">${escapeHtml(currentGate.sizeLabel)}</span></div>
      <div class="gb-sub">${escapeHtml(currentGate.primarySpeciesLabel)} + ${escapeHtml(currentGate.secondarySpeciesLabel)} / 내부 배치 정보 비공개</div>
    </div>` : '';
  return `
    ${gateInfo}
    <div class="gb-grid two">
      <div class="gb-panel"><div class="gb-section-title">파티 편성 (최대 8)</div>${partyRows.join('')}</div>
      <div class="gb-panel"><div class="gb-section-title">적 편성 (최대 10)</div>${enemyRows.join('')}</div>
    </div>
    <div class="gb-btn-row">
      <button class="gb-btn" id="gb-save-setup">편성 저장</button>
      <button class="gb-btn primary" id="gb-start-battle">전투 시작</button>
    </div>
    <div class="gb-panel">
      <div class="gb-sub">적 타깃 규칙: 전열 70 / 중열 20 / 후열 10. 전열 안에서는 탱커 기본 위협 5, 근딜 2로 분배된다. 도발은 위협 +5.</div>
    </div>
  `;
}

function renderCommandPanel(runtime) {
    const rows = getAlive(runtime.party).map(unit => {
      const pending = (runtime.pendingActions && runtime.pendingActions[unit.uid]) || {};
      return `
        <div class="gb-command-row">
          <div><strong>${escapeHtml(unit.name)}</strong><div class="gb-sub">${escapeHtml(rowLabel(unit.row))} / ${escapeHtml(unit.position || '')}</div></div>
          <select class="gb-input" id="gb-act-mode-${unit.uid}">
            ${optionHtml('basic', '기본 공격', (pending.mode || 'basic') === 'basic')}
            ${optionHtml('skill', '스킬', pending.mode === 'skill')}
            ${optionHtml('defend', '방어', pending.mode === 'defend')}
            ${optionHtml('wait', '대기', pending.mode === 'wait')}
            ${optionHtml('auto', '자동', pending.mode === 'auto')}
          </select>
          <select class="gb-input" id="gb-act-skill-${unit.uid}">
            ${skillOptions(unit, pending.skillId || '')}
          </select>
          <select class="gb-input" id="gb-act-target-${unit.uid}">
            ${targetOptions(runtime, unit, pending.target || '')}
          </select>
        </div>
      `;
    });
    return `
      <div class="gb-panel">
        <div class="gb-section-title">이번 라운드 행동 지정</div>
        <div class="gb-sub">스킬/대상 지정 후 라운드 실행. 지정하지 않으면 기본 공격 또는 자동으로 보정된다.</div>
        <div class="gb-command-list">${rows.join('') || '<div class="gb-sub">행동 지정 대상 없음.</div>'}</div>
        <div class="gb-btn-row">
          <button class="gb-btn primary" id="gb-run-round">라운드 실행</button>
          <button class="gb-btn" id="gb-auto-one">1라운드 자동</button>
          <button class="gb-btn" id="gb-auto-battle">끝까지 자동</button>
          <button class="gb-btn" id="gb-battle-potion">🧪 물약</button>
          <button class="gb-btn" id="gb-reset-battle">전투 종료/리셋</button>
        </div>
      </div>
    `;
  }

  function renderBattlePotionPanel(runtime) {
    const inv = getActiveInventory();
    const potions = inv.items.filter(it => it.category === 'potion');
    if (!potions.length) return '<div class="gb-panel"><div class="gb-sub">소지 중인 물약이 없다.</div><div class="gb-btn-row"><button class="gb-btn" id="gb-battle-potion-close">닫기</button></div></div>';
    const daily = getPotionUsesToday();
    const remaining = Math.max(0, POTION_DAILY_MAX_RECOVERY - daily.recovery);
    const partyAlive = getAlive(runtime.party);
    const potionOpts = potions.map(p => `<option value="${escapeHtml(p.stackKey)}">${escapeHtml(p.name)} x${p.count} — ${escapeHtml(p.note||'')}</option>`).join('');
    const targetOpts = partyAlive.map(u => `<option value="${escapeHtml(u.uid)}">${escapeHtml(u.name)} (HP ${Math.floor(u.hp)}/${Math.floor(u.maxHp)})</option>`).join('');
    return `
      <div class="gb-panel">
        <div class="gb-section-title">🧪 물약 사용 (전투 중)</div>
        <div class="gb-sub">회복포션: ${remaining}/${POTION_DAILY_MAX_RECOVERY + 1}회 남음${daily.recovery >= POTION_DAILY_MAX_RECOVERY ? ' ⚠️ 다음 사용 시 효율 20%' : ''}${daily.recovery > POTION_DAILY_MAX_RECOVERY ? ' (한도초과)' : ''} | 버프포션: ${Math.max(0, POTION_DAILY_MAX_BUFF - daily.buff)}/${POTION_DAILY_MAX_BUFF}회 | 해제포션: 무제한</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;">
          <select class="gb-input" id="gb-battle-potion-select">${potionOpts}</select>
          <span style="color:#94a3b8;">→</span>
          <select class="gb-input" id="gb-battle-potion-target">${targetOpts}</select>
          <button class="gb-btn primary" id="gb-battle-potion-apply">사용</button>
        </div>
        <div class="gb-btn-row"><button class="gb-btn" id="gb-battle-potion-close">닫기</button></div>
      </div>`;
  }

  function renderBattleRuntime() {
    const rt = model.state.runtime;
    if (!rt.started) return renderBattleSetup();
    return `
      ${renderCommandPanel(rt)}
      ${rt.showPotionPanel ? renderBattlePotionPanel(rt) : ''}
      <div class="gb-grid two">
        <div class="gb-panel">
          <div class="gb-section-title">아군 (${getAlive(rt.party).length}/${rt.party.length})</div>
          ${rt.party.map(unitRowHtml).join('')}
        </div>
        <div class="gb-panel">
          <div class="gb-section-title">적 (${getAlive(rt.enemies).length}/${rt.enemies.length})</div>
          ${rt.enemies.map(unitRowHtml).join('')}
        </div>
      </div>
      <div class="gb-grid two">
        <div class="gb-panel">
          <div class="gb-section-title">라운드 요약</div>
          <div class="gb-log">${rt.roundSummaries.length ? rt.roundSummaries.map(row => `<div>• ${escapeHtml(row.text)}</div>`).join('') : '<div>아직 라운드가 진행되지 않았다.</div>'}</div>
        </div>
        <div class="gb-panel">
          <div class="gb-section-title">전투 결과</div>
          <div class="gb-sub">상태: <strong>${escapeHtml(rt.finished ? rt.outcome : ('진행 중 / ' + rt.round + '라운드'))}</strong></div>
          <div class="gb-sub">총 피해 — 아군이 준 피해 ${rt.totals.partyDamage}, 적이 준 피해 ${rt.totals.enemyDamage}</div>
          <div class="gb-sub">총 회복 — 아군 ${rt.totals.partyHealing}, 적 ${rt.totals.enemyHealing}</div>
          <div class="gb-sub">총 처치 — 아군 ${rt.totals.partyKills}, 적 ${rt.totals.enemyKills}</div>
          ${rt.expGained > 0 ? `<div class="gb-sub" style="color:#34d399;font-weight:600;">⭐ 획득 EXP: ${rt.expGained} (처치 ${(rt.expLog||[]).length}건)</div>
            <div class="gb-sub" style="font-size:0.82em;">${(rt.expLog||[]).slice(0,10).map(e=>`${e.name}(${e.rank}/${e.kind}) +${e.exp}`).join(' / ')}${(rt.expLog||[]).length>10?` 외 ${(rt.expLog||[]).length-10}건…`:''}</div>
            ${(rt.expResults||[]).length ? `<div class="gb-sub" style="color:#fbbf24;">${rt.expResults.map(r=>`${r.name} Lv${r.newLevel}${r.levelsGained>0?' ⬆️레벨업!':''}`).join(' / ')}</div>` : ''}` : ''}
          <textarea id="gb-llm-block" class="gb-textarea short" readonly>${escapeHtml(rt.llmBlock || '')}</textarea>
          <div class="gb-btn-row"><button class="gb-btn" id="gb-copy-llm">결과 블록 복사</button></div>
        </div>
      </div>
      <div class="gb-panel">
        <div class="gb-section-title">상세 전투 로그</div>
        <div class="gb-log">${(rt.logs || []).length ? rt.logs.map(row => `<div>• ${escapeHtml(row)}</div>`).join('') : '<div>아직 상세 로그가 없다.</div>'}</div>
      </div>
    `;
  }

  function renderCharacterEditor() {
    ensureSelections();
    const item = deepClone(getCharById(model.state.selected.characters) || {
      id:'', name:'', job:'', position:'', row:'mid', rank:'E',
      stats:{ str:0, con:0, int:0, agi:0, sense:0 }, hp:0, mp:0, sp:0, atk:0, pdef:0, mdef:0,
      damageType:'physical', attackStat:'str', skills:[], note:'',
      level:1, exp:0, totalExp:0
    });
    const list = (model.db.characters || []).map(c => `<button class="gb-list-item ${c.id===model.state.selected.characters?'is-active':''}" data-select-type="characters" data-id="${escapeHtml(c.id)}">${escapeHtml(c.name)} <span class="gb-sub">[${escapeHtml(c.job)}] Lv${Number(c.level||1)}</span></button>`).join('');
    return `
      <div class="gb-grid db">
        <div class="gb-panel"><div class="gb-section-title">캐릭터 목록</div>${list || '<div class="gb-sub">등록된 캐릭터 없음.</div>'}<div class="gb-btn-row"><button class="gb-btn" id="gb-char-new">새 캐릭터</button><button class="gb-btn danger" id="gb-char-clear-all">캐릭터 전체삭제</button></div></div>
        <div class="gb-panel">
          <div class="gb-section-title">캐릭터 편집</div>
          <div class="gb-grid two">
            <label>ID<input class="gb-input" id="gb-char-id" value="${escapeHtml(item.id)}" /></label>
            <label>이름<input class="gb-input" id="gb-char-name" value="${escapeHtml(item.name)}" /></label>
            <label>직업<input class="gb-input" id="gb-char-job" value="${escapeHtml(item.job)}" /></label>
            <label>포지션<input class="gb-input" id="gb-char-position" value="${escapeHtml(item.position)}" /></label>
            <label>행<select class="gb-input" id="gb-char-row">${optionHtml('front','전열',item.row==='front')}${optionHtml('mid','중열',item.row==='mid')}${optionHtml('back','후열',item.row==='back')}</select></label>
            <label>랭크<select class="gb-input" id="gb-char-rank">${GRADE_ORDER.map(g=>optionHtml(g,g,item.rank===g)).join('')}</select></label>
            <label>HP<input class="gb-input" id="gb-char-hp" type="number" value="${escapeHtml(item.hp)}" /></label>
            <label>MP<input class="gb-input" id="gb-char-mp" type="number" value="${escapeHtml(item.mp)}" /></label>
            <label>SP<input class="gb-input" id="gb-char-sp" type="number" value="${escapeHtml(item.sp)}" /></label>
            <label>ATK<input class="gb-input" id="gb-char-atk" type="number" value="${escapeHtml(item.atk)}" /></label>
            <label>물리방어<input class="gb-input" id="gb-char-pdef" type="number" value="${escapeHtml(item.pdef)}" /></label>
            <label>마법방어<input class="gb-input" id="gb-char-mdef" type="number" value="${escapeHtml(item.mdef)}" /></label>
            <label>STR<input class="gb-input" id="gb-char-str" type="number" value="${escapeHtml(item.stats.str)}" /></label>
            <label>CON<input class="gb-input" id="gb-char-con" type="number" value="${escapeHtml(item.stats.con)}" /></label>
            <label>INT<input class="gb-input" id="gb-char-int" type="number" value="${escapeHtml(item.stats.int)}" /></label>
            <label>AGI<input class="gb-input" id="gb-char-agi" type="number" value="${escapeHtml(item.stats.agi)}" /></label>
            <label>SENSE<input class="gb-input" id="gb-char-sense" type="number" value="${escapeHtml(item.stats.sense)}" /></label>
            <label>피해 타입<select class="gb-input" id="gb-char-dmgtype">${optionHtml('physical','physical',item.damageType==='physical')}${optionHtml('magic','magic',item.damageType==='magic')}</select></label>
            <label>공격 스탯<select class="gb-input" id="gb-char-atkstat">${['str','con','int','agi','sense'].map(s=>optionHtml(s,s,item.attackStat===s)).join('')}</select></label>
            <label>기본 위협값<input class="gb-input" id="gb-char-threat" type="number" value="${escapeHtml(item.threatBase != null ? item.threatBase : inferThreatBase(item.position,item.row))}" /></label>
            <label>스킬 ID(쉼표구분)<input class="gb-input" id="gb-char-skills" value="${escapeHtml((item.skills||[]).join(', '))}" /></label>
          </div>
          <div class="gb-sub" style="margin:6px 0;">💡 HP/MP/SP는 비워두면(0) 스탯 기준 자동 계산: HP=100+(CON-10)×10+(STR-10)×3, MP=100+(INT-10)×10+(SEN-10)×3, SP=100+(AGI-10)×10+(SEN-10)×3. ATK/물방/마방은 기본 0 (스킬·장비로만 증가).</div>
          <label>메모<textarea class="gb-textarea short" id="gb-char-note">${escapeHtml(item.note || '')}</textarea></label>
          <div style="margin-top:10px;border-top:1px solid rgba(148,163,184,0.2);padding-top:8px;">
            <div class="gb-section-title">📈 레벨 / 경험치 (DB 직접 수정)</div>
            ${(() => {
              const lv = Number(item.level || 1);
              const curExp = Number(item.exp || 0);
              const totalExp = Number(item.totalExp || 0);
              const needed = expNeededForLevel(lv);
              return `<div class="gb-sub">현재 Lv${lv} / 현재 EXP ${curExp} / ${needed} (다음 레벨까지) / 누적 EXP ${totalExp}</div>`;
            })()}
            <div class="gb-grid two">
              <label>레벨<input class="gb-input" id="gb-char-level" type="number" min="1" max="${EXP_MAX_LEVEL}" value="${Number(item.level || 1)}" /></label>
              <label>현재 EXP<input class="gb-input" id="gb-char-exp" type="number" min="0" value="${Number(item.exp || 0)}" /></label>
              <label>누적 EXP<input class="gb-input" id="gb-char-totalexp" type="number" min="0" value="${Number(item.totalExp || 0)}" /></label>
            </div>
          </div>
          <div class="gb-btn-row"><button class="gb-btn primary" id="gb-char-save">저장</button><button class="gb-btn" id="gb-char-delete">삭제</button></div>
          ${item.id ? renderEquippedStatSection(item, 'character') : ''}
        </div>
      </div>
      ${renderPersonalInventoryHtml('character', item.id)}
    `;
  }

  // ── 개인 인벤토리 + 장비창 렌더 (캐릭터 & 페르소나 공용) ──────────────────
  function getPersonalInv(type, entityId) {
    if (!entityId) return null;
    const arr = type === 'persona' ? (model.db.personas || []) : (model.db.characters || []);
    const entity = arr.find(x => x.id === entityId);
    if (!entity) return null;
    if (!entity.inventory) entity.inventory = { items: [], equipped: { weapon: null, armor: null, subweapon: null, accessory: null, bag: null } };
    if (!entity.inventory.equipped) entity.inventory.equipped = { weapon: null, armor: null, subweapon: null, accessory: null, bag: null };
    if (entity.inventory.equipped.bag === undefined) entity.inventory.equipped.bag = null;
    return entity.inventory;
  }

  // 캐릭터/페르소나의 장착 장비를 포함하여 파생 스탯(HP/MP/SP/ATK/PDEF/MDEF) 재계산
  // 스탯 보너스는 기준치 10을 초과한 부분만 반영 (E급 최하 10/10/10/10/10 → HP/MP/SP=100, ATK=0)
  // PDEF/MDEF는 장비·스킬로만 증가 (기본 0)
  function recalcCharDerivedStats(entity) {
    if (!entity || !entity.stats) return;
    const s = entity.stats;
    const lvBonus = Math.max(0, (Number(entity.level) || 1) - 1) * 2;
    entity.hp = 100 + ((Number(s.con)||0) - 10) * 10 + ((Number(s.str)||0) - 10) * 3 + lvBonus;
    entity.mp = 100 + ((Number(s.int)||0) - 10) * 10 + ((Number(s.sense)||0) - 10) * 3 + lvBonus;
    entity.sp = 100 + ((Number(s.agi)||0) - 10) * 10 + ((Number(s.sense)||0) - 10) * 3 + lvBonus;
    // 장착 장비 ATK/PDEF/MDEF 반영
    let weaponAtk = 0;
    let equipPdef = 0;
    let equipMdef = 0;
    const inv = entity.inventory;
    if (inv && inv.equipped) {
      if (inv.equipped.weapon) weaponAtk = Number(inv.equipped.weapon.atk || 0);
      EQUIP_PARTS.forEach(part => {
        const eq = inv.equipped[part];
        if (!eq) return;
        equipPdef += Number(eq.pdef || 0);
        equipMdef += Number(eq.mdef || 0);
      });
    }
    entity.atk = Math.round(weaponAtk + ((Number(s.str)||0) - 10) * 0.2 + ((Number(s.agi)||0) - 10) * 0.2 + ((Number(s.int)||0) - 10) * 0.3);
    entity.pdef = equipPdef;
    entity.mdef = equipMdef;
  }

  // 장착 장비 스탯 합산 반환 { atk, pdef, mdef, str, con, int, agi, sense }
  function calcEquippedStatBonus(equipped) {
    const bonus = { atk:0, pdef:0, mdef:0, str:0, con:0, int:0, agi:0, sense:0 };
    if (!equipped) return bonus;
    EQUIP_PARTS.forEach(part => {
      const eq = equipped[part];
      if (!eq) return;
      bonus.atk   += Number(eq.atk   || 0);
      bonus.pdef  += Number(eq.pdef  || 0);
      bonus.mdef  += Number(eq.mdef  || 0);
      // 방어구/악세서리만 totalStatSum 기반 주스탯 보너스 적용 (무기/보조무기는 주스탯 없음)
      if (part === 'armor' && eq.mainStat && bonus[eq.mainStat] !== undefined) {
        const armorData = ARMOR_STAT_BY_RANK[eq.rank || 'E'] || ARMOR_STAT_BY_RANK.E;
        const baseStat = armorData.totalStatSum || 0;
        const subBonusMul = (eq.armorSubtype && ARMOR_SUBTYPES[eq.armorSubtype]) ? ARMOR_SUBTYPES[eq.armorSubtype].statBonusMul : 0;
        bonus[eq.mainStat] += Math.round(baseStat * (1 + subBonusMul));
      }
      if (part === 'accessory' && eq.mainStat && bonus[eq.mainStat] !== undefined) {
        const accData = ACCESSORY_STAT_BY_RANK[eq.rank || 'E'] || ACCESSORY_STAT_BY_RANK.E;
        bonus[eq.mainStat] += accData.totalStatSum || 0;
      }
    });
    return bonus;
  }

  // 장착 스탯 섹션 HTML (캐릭터/페르소나 편집기 공용)
  function renderEquippedStatSection(item, type) {
    const inv = getPersonalInv(type, item.id);
    if (!inv) return '';
    const bonus = calcEquippedStatBonus(inv.equipped);
    const hasAny = Object.values(bonus).some(v => v !== 0);
    const equipNames = EQUIP_PARTS.map(p => {
      const eq = inv.equipped[p];
      if (!eq) return null;
      return `${EQUIP_PART_LABELS[p]}: <strong style="${rarityStyle(eq.rarity)}">${escapeHtml(eq.name||eq.id)}</strong>${eq.enhance>0?` +${eq.enhance}`:''}${eq.rarity && eq.rarity !== 'Normal' ? ` <span class="gb-badge" style="background:${rarityColor(eq.rarity)};color:#000;font-size:9px;">${escapeHtml(eq.rarity)}</span>` : ''}`;
    }).filter(Boolean);

    // 기본값: 스탯 기반 (장비 제외) — PDEF/MDEF는 기본 0, ATK는 스탯 보너스만
    const stats = item.stats || {};
    const baseAtk = Math.round(((Number(stats.str)||0) - 10) * 0.2 + ((Number(stats.agi)||0) - 10) * 0.2 + ((Number(stats.int)||0) - 10) * 0.3);
    const basePdef = 0;
    const baseMdef = 0;
    const fmtDiff = (v, b) => b > 0 ? `${v} <span style="color:#34d399">+${b}</span> = <strong>${v+b}</strong>` : `<strong>${v}</strong>`;

    return `<div style="margin-top:10px;border-top:1px solid rgba(148,163,184,0.2);padding-top:8px;">
      <div class="gb-section-title">⚔️ 장착 장비 스탯 반영</div>
      ${equipNames.length ? `<div class="gb-sub" style="margin-bottom:6px;">${equipNames.join(' / ')}</div>` : '<div class="gb-sub" style="margin-bottom:6px;color:#64748b;">장착 장비 없음</div>'}
      ${hasAny ? `<div class="gb-grid four" style="gap:4px;font-size:12px;">
        <div>ATK ${fmtDiff(baseAtk, bonus.atk)}</div>
        <div>물리방어 ${fmtDiff(basePdef, bonus.pdef)}</div>
        <div>마법방어 ${fmtDiff(baseMdef, bonus.mdef)}</div>
        <div>STR ${fmtDiff(Number(stats.str||0), bonus.str)}</div>
        <div>CON ${fmtDiff(Number(stats.con||0), bonus.con)}</div>
        <div>INT ${fmtDiff(Number(stats.int||0), bonus.int)}</div>
        <div>AGI ${fmtDiff(Number(stats.agi||0), bonus.agi)}</div>
        <div>SENSE ${fmtDiff(Number(stats.sense||0), bonus.sense)}</div>
      </div>` : '<div class="gb-sub">—</div>'}
    </div>`;
  }

  function personalInvCapacity(type, entityId) {
    const arr = type === 'persona' ? (model.db.personas || []) : (model.db.characters || []);
    const entity = arr.find(x => x.id === entityId);
    if (!entity) return { slots: PERSONAL_INV_BASE_SLOTS, maxWeightG: PERSONAL_INV_BASE_MAX_WEIGHT_G, weightMul: 1.0 };
    const equippedBagId = (entity.inventory && entity.inventory.equipped && entity.inventory.equipped.bag && entity.inventory.equipped.bag.bagId) || null;
    const bagId = equippedBagId || entity.bagId || 'none';
    const bag = PARTY_BAGS[bagId] || PARTY_BAGS.none;
    return {
      slots: PERSONAL_INV_BASE_SLOTS + Number(bag.slotBonus || 0),
      maxWeightG: PERSONAL_INV_BASE_MAX_WEIGHT_G + Number(bag.maxWeightBonusG || 0),
      weightMul: Number(bag.weightMul || 1.0)
    };
  }
  function personalInvUsedWeightG(inv, pCap) {
    return Math.round((Array.isArray(inv.items) ? inv.items : []).reduce((s, it) => s + inventoryBaseWeightG(it), 0) * pCap.weightMul);
  }

  function renderPersonalInventoryHtml(type, entityId) {
    if (!entityId) return '<div class="gb-panel gb-sub">캐릭터/페르소나를 먼저 저장하면 개인 인벤토리를 사용할 수 있다.</div>';
    const inv = getPersonalInv(type, entityId);
    if (!inv) return '';
    const tabKey = type === 'persona' ? 'personaInvTab' : 'charInvTab';
    const activeTab = model.state[tabKey] || 'equip';
    const tabBar = `<div class="gb-btn-row">
      <button class="gb-btn${activeTab==='equip'?' primary':''}" data-personal-inv-tab="${type}:equip">🛡️ 장비창</button>
      <button class="gb-btn${activeTab==='items'?' primary':''}" data-personal-inv-tab="${type}:items">🎒 인벤토리</button>
    </div>`;
    const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 10000 ? `${Math.round(n/10000)}만` : n.toLocaleString('en-US');
    if (activeTab === 'equip') {
      // Equipment slots (weapon/subweapon/armor/accessory) 
      const slotHtml = EQUIP_PARTS.map(part => {
        const eq = inv.equipped[part];
        const label = EQUIP_PART_LABELS[part] || part;
        if (eq) {
          const dur = Number(eq.durability ?? 100);
          const maxDur = Number(eq.maxDurability ?? 100);
          const traitTxt = (eq.traits||[]).length ? ` [${(eq.traits||[]).map(t=>equipTraitDisplay(t, eq.rank)).join(',')}]` : '';
          const enhTxt = eq.enhance > 0 ? ` +${eq.enhance}` : '';
          return `<div class="gb-unit"><div class="gb-unit-top">
            <div>
              <span class="gb-sub" style="font-size:0.8em;">${label}</span>
              <div><strong style="${rarityStyle(eq.rarity)}">${escapeHtml(eq.name||eq.id)}${enhTxt}</strong>${eq.rarity && eq.rarity !== 'Normal' ? ` <span class="gb-badge" style="background:${rarityColor(eq.rarity)};color:#000;font-size:9px;">${escapeHtml(eq.rarity)}</span>` : ''}${traitTxt ? `<span class="gb-sub">${escapeHtml(traitTxt)}</span>` : ''}</div>
              <div class="gb-sub">내구도 ${dur}/${maxDur} | ${escapeHtml(eq.rank||'E')}등급</div>
            </div>
            <button class="gb-btn tiny" data-personal-unequip="${type}:${entityId}:${part}">해제</button>
          </div></div>`;
        }
        return `<div class="gb-unit"><div class="gb-unit-top">
          <div><span class="gb-sub">${label}</span> <span class="gb-sub">(비어 있음)</span></div>
          <div></div>
        </div></div>`;
      }).join('');
      // 가방 슬롯
      const equippedBag = inv.equipped.bag || null;
      const bagSlotHtml = equippedBag
        ? `<div class="gb-unit"><div class="gb-unit-top">
            <div>
              <span class="gb-sub" style="font-size:0.8em;">가방</span>
              <div><strong>${escapeHtml(equippedBag.name||equippedBag.id)}</strong></div>
              <div class="gb-sub">${escapeHtml(equippedBag.note||'')}</div>
            </div>
            <button class="gb-btn tiny" data-personal-unequip="${type}:${entityId}:bag">해제</button>
          </div></div>`
        : `<div class="gb-unit"><div class="gb-unit-top"><div><span class="gb-sub">가방</span> <span class="gb-sub">(없음 — 소모품 상점에서 구매)</span></div><div></div></div></div>`;
      // 인벤에서 장착 가능한 장비 목록 (장비 + 가방)
      const equippableHtml = (inv.items||[]).filter(it => it.category === 'equipment' || it.category === 'bag').map(it => {
        const ikey = inventoryItemKey(it);
        const traitTxt = (it.traits||[]).length ? ` [${(it.traits||[]).map(t=>equipTraitDisplay(t, it.rank)).join(',')}]` : '';
        const isBag = it.category === 'bag';
        return `<div class="gb-unit"><div class="gb-unit-top">
          <div>
            <strong>${escapeHtml(it.name||it.id)}</strong>${it.enhance>0?` +${it.enhance}`:''}
            <span class="gb-badge">${escapeHtml(it.rank||'')}</span>
            ${!isBag ? `<span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part||'']||it.part||'')}</span>` : '<span class="gb-badge">가방</span>'}
            ${traitTxt ? `<span class="gb-sub">${escapeHtml(traitTxt)}</span>` : ''}
            ${isBag && it.note ? `<div class="gb-sub">${escapeHtml(it.note)}</div>` : ''}
          </div>
          <button class="gb-btn tiny primary" data-personal-equip="${type}:${entityId}:${escapeHtml(ikey)}">장착</button>
        </div></div>`;
      }).join('');
      return `<div class="gb-panel" style="margin-top:10px;">
        <div class="gb-section-title">⚔️ 개인 장비창 / 인벤토리</div>
        ${tabBar}
        <div class="gb-section-title" style="margin-top:8px;">장착 슬롯</div>
        ${slotHtml}
        <div class="gb-section-title" style="margin-top:8px;">🎒 가방 슬롯</div>
        ${bagSlotHtml}
        <div class="gb-section-title" style="margin-top:8px;">인벤에서 장착</div>
        ${equippableHtml || '<div class="gb-sub">인벤에 장착 가능한 장비/가방 없음. 공용 인벤에서 이동하거나 구매하라.</div>'}
      </div>`;
    }
    // items tab: 개인 인벤 아이템 목록
    const items = inv.items || [];
    const itemsHtml = items.length === 0
      ? '<div class="gb-sub">개인 인벤이 비어 있다. 공용 인벤에서 아이템을 이동하자.</div>'
      : items.map(it => {
          const ikey = inventoryItemKey(it);
          const isEq = it.category === 'equipment';
          const isBag = it.category === 'bag';
          const traitTxt = isEq && (it.traits||[]).length ? ` [${(it.traits||[]).map(t=>equipTraitDisplay(t, it.rank)).join(',')}]` : '';
          return `<div class="gb-unit"><div class="gb-unit-top">
            <div>
              <strong>${escapeHtml(it.name||it.id)}</strong>
              ${it.rank ? `<span class="gb-badge">${escapeHtml(it.rank||'')}</span>` : ''}
              ${isEq ? `<span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part]||it.part||'')}</span>` : ''}
              ${isBag ? `<span class="gb-badge">가방</span>` : ''}
              ${traitTxt ? `<span class="gb-sub">${escapeHtml(traitTxt)}</span>` : ''}
              ${isEq ? `<div class="gb-sub">내구도 ${Number(it.durability??100)}/${Number(it.maxDurability??100)}</div>` : ''}
              ${isBag && it.note ? `<div class="gb-sub">${escapeHtml(it.note)}</div>` : ''}
              ${!isEq && !isBag && it.count > 1 ? `<span class="gb-sub"> ×${it.count}</span>` : ''}
            </div>
            <div>
              <button class="gb-btn tiny" data-personal-to-shared="${type}:${entityId}:${escapeHtml(ikey)}">공용으로 이동</button>
            </div>
          </div></div>`;
        }).join('');
    // 공용 인벤에서 가져오기 (모든 아이템)
    const sharedInv = getInventory();
    const sharedAll = (sharedInv.items||[]);
    const fromSharedHtml = sharedAll.length === 0
      ? '<div class="gb-sub">공용 인벤에 아이템 없음.</div>'
      : sharedAll.map(it => {
          const ikey = inventoryItemKey(it);
          const isEq = it.category === 'equipment';
          const isBag = it.category === 'bag';
          return `<div class="gb-unit"><div class="gb-unit-top">
            <div>
              <strong>${escapeHtml(it.name||it.id)}</strong>
              ${it.rank ? `<span class="gb-badge">${escapeHtml(it.rank||'')}</span>` : ''}
              ${isEq ? `<span class="gb-badge">${escapeHtml(EQUIP_PART_LABELS[it.part]||it.part||'')}</span>` : ''}
              ${isBag ? `<span class="gb-badge">가방</span>` : ''}
              ${it.count > 1 ? `<span class="gb-sub"> ×${it.count}</span>` : ''}
            </div>
            <button class="gb-btn tiny primary" data-shared-to-personal="${type}:${entityId}:${escapeHtml(ikey)}">개인으로 이동</button>
          </div></div>`;
        }).join('');
    const pCap = personalInvCapacity(type, entityId);
    const pUsedSlots = inventoryUsedSlots(inv);
    const pUsedWeight = personalInvUsedWeightG(inv, pCap);
    const slotPct = pCap.slots > 0 ? Math.min(100, Math.round(pUsedSlots / pCap.slots * 100)) : 0;
    const weightPct = pCap.maxWeightG > 0 ? Math.min(100, Math.round(pUsedWeight / pCap.maxWeightG * 100)) : 0;
    const slotColor = slotPct >= 90 ? '#ef4444' : slotPct >= 70 ? '#eab308' : '#34d399';
    const weightColor = weightPct >= 90 ? '#ef4444' : weightPct >= 70 ? '#eab308' : '#34d399';
    return `<div class="gb-panel" style="margin-top:10px;">
      <div class="gb-section-title">⚔️ 개인 장비창 / 인벤토리</div>
      ${tabBar}
      <div class="gb-section-title" style="margin-top:8px;">개인 인벤</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;font-size:12px;">
        <div style="flex:1;min-width:140px;">
          <div style="display:flex;justify-content:space-between;"><span>슬롯</span><strong style="color:${slotColor}">${pUsedSlots} / ${pCap.slots}</strong></div>
          <div style="height:6px;background:#1e293b;border-radius:99px;margin-top:3px;overflow:hidden;"><div style="width:${slotPct}%;height:100%;background:${slotColor};border-radius:99px;"></div></div>
        </div>
        <div style="flex:1;min-width:140px;">
          <div style="display:flex;justify-content:space-between;"><span>무게</span><strong style="color:${weightColor}">${formatWeightG(pUsedWeight)} / ${formatWeightG(pCap.maxWeightG)}</strong></div>
          <div style="height:6px;background:#1e293b;border-radius:99px;margin-top:3px;overflow:hidden;"><div style="width:${weightPct}%;height:100%;background:${weightColor};border-radius:99px;"></div></div>
        </div>
      </div>
      ${itemsHtml}
      <div class="gb-section-title" style="margin-top:8px;">📦 공용 인벤에서 이동</div>
      ${fromSharedHtml}
    </div>`;
  }

  function renderMonsterEditor() {
    ensureSelections();
    const item = deepClone(getMonsterById(model.state.selected.monsters) || {
      id:'', name:'', kind:'', role:'', position:'', row:'front', rank:'E',
      stats:{ str:0, con:0, int:0, agi:0, sense:0 }, hp:0, mp:0, sp:0, atk:0, pdef:0, mdef:0,
      damageType:'physical', attackStat:'str', skills:[], note:''
    });
    const list = (model.db.monsters || []).map(c => `<button class="gb-list-item ${c.id===model.state.selected.monsters?'is-active':''}" data-select-type="monsters" data-id="${escapeHtml(c.id)}">${escapeHtml(c.name)} <span class="gb-sub">[${escapeHtml(c.kind || 'Normal')}]</span></button>`).join('');
    return `
      <div class="gb-grid db">
        <div class="gb-panel"><div class="gb-section-title">몬스터 목록</div>${list || '<div class="gb-sub">등록된 몬스터 없음.</div>'}<div class="gb-btn-row"><button class="gb-btn" id="gb-mon-new">새 몬스터</button><button class="gb-btn danger" id="gb-mon-clear-all">몬스터 전체 삭제</button></div></div>
        <div class="gb-panel">
          <div class="gb-section-title">몬스터 편집</div>
          <div class="gb-sub">v7.2에서는 몬스터 HP/기본피해/스킬배율을 랭크·종류·행 기준 몬스터 프로필로 다시 계산한다. 저장된 이름/종족/스킬/행/포지션은 그대로 활용된다.</div>
          <div class="gb-grid two">
            <label>ID<input class="gb-input" id="gb-mon-id" value="${escapeHtml(item.id)}" /></label>
            <label>이름<input class="gb-input" id="gb-mon-name" value="${escapeHtml(item.name)}" /></label>
            <label>종류<input class="gb-input" id="gb-mon-kind" value="${escapeHtml(item.kind || '')}" /></label>
            <label>역할<input class="gb-input" id="gb-mon-role" value="${escapeHtml(item.role || '')}" /></label>
            <label>포지션<input class="gb-input" id="gb-mon-position" value="${escapeHtml(item.position || '')}" /></label>
            <label>행<select class="gb-input" id="gb-mon-row">${optionHtml('front','전열',item.row==='front')}${optionHtml('mid','중열',item.row==='mid')}${optionHtml('back','후열',item.row==='back')}</select></label>
            <label>랭크<select class="gb-input" id="gb-mon-rank">${GRADE_ORDER.map(g=>optionHtml(g,g,item.rank===g)).join('')}</select></label>
            <label>HP(참조값)<input class="gb-input" id="gb-mon-hp" type="number" value="${escapeHtml(item.hp)}" /></label>
            <label>MP(참조값)<input class="gb-input" id="gb-mon-mp" type="number" value="${escapeHtml(item.mp)}" /></label>
            <label>SP(참조값)<input class="gb-input" id="gb-mon-sp" type="number" value="${escapeHtml(item.sp)}" /></label>
            <label>ATK(참조값)<input class="gb-input" id="gb-mon-atk" type="number" value="${escapeHtml(item.atk)}" /></label>
            <label>물리방어<input class="gb-input" id="gb-mon-pdef" type="number" value="${escapeHtml(item.pdef)}" /></label>
            <label>마법방어<input class="gb-input" id="gb-mon-mdef" type="number" value="${escapeHtml(item.mdef)}" /></label>
            <label>STR<input class="gb-input" id="gb-mon-str" type="number" value="${escapeHtml(item.stats.str)}" /></label>
            <label>CON<input class="gb-input" id="gb-mon-con" type="number" value="${escapeHtml(item.stats.con)}" /></label>
            <label>INT<input class="gb-input" id="gb-mon-int" type="number" value="${escapeHtml(item.stats.int)}" /></label>
            <label>AGI<input class="gb-input" id="gb-mon-agi" type="number" value="${escapeHtml(item.stats.agi)}" /></label>
            <label>SENSE<input class="gb-input" id="gb-mon-sense" type="number" value="${escapeHtml(item.stats.sense)}" /></label>
            <label>피해 타입<select class="gb-input" id="gb-mon-dmgtype">${optionHtml('physical','physical',item.damageType==='physical')}${optionHtml('magic','magic',item.damageType==='magic')}</select></label>
            <label>공격 스탯<select class="gb-input" id="gb-mon-atkstat">${['str','con','int','agi','sense'].map(s=>optionHtml(s,s,item.attackStat===s)).join('')}</select></label>
            <label>기본 위협값<input class="gb-input" id="gb-mon-threat" type="number" value="${escapeHtml(item.threatBase != null ? item.threatBase : inferThreatBase(item.position,item.row))}" /></label>
            <label>스킬 ID(쉼표구분)<input class="gb-input" id="gb-mon-skills" value="${escapeHtml((item.skills||[]).join(', '))}" /></label>
          </div>
          <label>메모<textarea class="gb-textarea short" id="gb-mon-note">${escapeHtml(item.note || '')}</textarea></label>
          <div class="gb-btn-row"><button class="gb-btn primary" id="gb-mon-save">저장</button><button class="gb-btn" id="gb-mon-delete">삭제</button></div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,0.16);">
            <div class="gb-section-title">몬스터 JSON 가져오기 / 내보내기</div>
            <div class="gb-sub">배열 <code>[...]</code> 또는 객체 <code>{"monsters":[...]}</code> 둘 다 지원. 같은 ID는 덮어쓴다.</div>
            <textarea class="gb-textarea short" id="gb-mon-json"></textarea>
            <div class="gb-btn-row">
              <button class="gb-btn" id="gb-mon-export-json">현재 몬스터 내보내기</button>
              <button class="gb-btn" id="gb-mon-import-json">JSON 가져오기</button>
              <button class="gb-btn" id="gb-mon-copy-json">JSON 복사</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPersonaEditor() {
    ensureSelections();
    const blankPersona = {
      id:'', name:'', job:'', rank:'E', row:'back',
      stats:{ str:0, con:0, int:0, agi:0, sense:0 },
      hp:0, mp:0, sp:0, atk:0, pdef:0, mdef:0,
      damageType:'physical', attackStat:'str', skills:[], level:1, exp:0, totalExp:0, note:''
    };
    const item = deepClone(getPersonaById(model.state.selected.personas) || blankPersona);
    if (!item.stats) item.stats = { str:0, con:0, int:0, agi:0, sense:0 };
    const list = (model.db.personas || []).map(c => `<button class="gb-list-item ${c.id===model.state.selected.personas?'is-active':''}" data-select-type="personas" data-id="${escapeHtml(c.id)}">${escapeHtml(c.name)} <span class="gb-sub">[${escapeHtml(c.job||'페르소나')}] Lv${Number(c.level||1)}</span></button>`).join('');
    return `
      <div class="gb-grid db">
        <div class="gb-panel"><div class="gb-section-title">페르소나 목록</div>${list || '<div class="gb-sub">등록된 페르소나 없음.</div>'}<div class="gb-btn-row"><button class="gb-btn" id="gb-persona-new">새 페르소나</button></div></div>
        <div class="gb-panel">
          <div class="gb-section-title">페르소나 편집</div>
          <div class="gb-grid two">
            <label>ID<input class="gb-input" id="gb-persona-id" value="${escapeHtml(item.id)}" /></label>
            <label>이름<input class="gb-input" id="gb-persona-name" value="${escapeHtml(item.name)}" /></label>
            <label>직업/역할<input class="gb-input" id="gb-persona-job" value="${escapeHtml(item.job||'')}" /></label>
            <label>행<select class="gb-input" id="gb-persona-row">${optionHtml('front','전열',item.row==='front')}${optionHtml('mid','중열',item.row==='mid')}${optionHtml('back','후열',item.row==='back')}</select></label>
            <label>랭크<select class="gb-input" id="gb-persona-rank">${GRADE_ORDER.map(g=>optionHtml(g,g,item.rank===g)).join('')}</select></label>
            <label>HP<input class="gb-input" id="gb-persona-hp" type="number" value="${escapeHtml(item.hp)}" /></label>
            <label>MP<input class="gb-input" id="gb-persona-mp" type="number" value="${escapeHtml(item.mp)}" /></label>
            <label>SP<input class="gb-input" id="gb-persona-sp" type="number" value="${escapeHtml(item.sp)}" /></label>
            <label>ATK<input class="gb-input" id="gb-persona-atk" type="number" value="${escapeHtml(item.atk)}" /></label>
            <label>물리방어<input class="gb-input" id="gb-persona-pdef" type="number" value="${escapeHtml(item.pdef)}" /></label>
            <label>마법방어<input class="gb-input" id="gb-persona-mdef" type="number" value="${escapeHtml(item.mdef)}" /></label>
            <label>STR<input class="gb-input" id="gb-persona-str" type="number" value="${escapeHtml(item.stats.str)}" /></label>
            <label>CON<input class="gb-input" id="gb-persona-con" type="number" value="${escapeHtml(item.stats.con)}" /></label>
            <label>INT<input class="gb-input" id="gb-persona-int" type="number" value="${escapeHtml(item.stats.int)}" /></label>
            <label>AGI<input class="gb-input" id="gb-persona-agi" type="number" value="${escapeHtml(item.stats.agi)}" /></label>
            <label>SENSE<input class="gb-input" id="gb-persona-sense" type="number" value="${escapeHtml(item.stats.sense)}" /></label>
            <label>피해 타입<select class="gb-input" id="gb-persona-dmgtype">${optionHtml('physical','physical',item.damageType==='physical')}${optionHtml('magic','magic',item.damageType==='magic')}</select></label>
            <label>공격 스탯<select class="gb-input" id="gb-persona-atkstat">${['str','con','int','agi','sense'].map(s=>optionHtml(s,s,item.attackStat===s)).join('')}</select></label>
            <label>레벨<input class="gb-input" id="gb-persona-level" type="number" min="1" max="${EXP_MAX_LEVEL}" value="${Number(item.level||1)}" /></label>
            <label>현재 EXP<input class="gb-input" id="gb-persona-exp" type="number" min="0" value="${Number(item.exp||0)}" /></label>
            <label>스킬 ID(쉼표구분)<input class="gb-input" id="gb-persona-skills" value="${escapeHtml((item.skills||[]).join(', '))}" /></label>
          </div>
          <label>메모<textarea class="gb-textarea short" id="gb-persona-note">${escapeHtml(item.note || '')}</textarea></label>
          <div class="gb-btn-row"><button class="gb-btn primary" id="gb-persona-save">저장</button><button class="gb-btn" id="gb-persona-delete">삭제</button></div>
          ${item.id ? renderEquippedStatSection(item, 'persona') : ''}
        </div>
      </div>
      ${renderPersonalInventoryHtml('persona', item.id)}
    `;
  }

  function renderSkillEditor() {
    ensureSelections();
    const selId = model.state.selected.skills || '';
    // Try custom first, then builtin, then default empty
    const allSkills = getAllSkillMap();
    let item;
    if (selId && allSkills[selId]) {
      const sk = deepClone(allSkills[selId]);
      // Flatten for editor fields
      item = {
        id: sk.id || '',
        name: sk.name || '',
        grade: sk.grade || 'E',
        rarity: sk.rarity || 'Normal',
        category: sk.category || 'singleAttack',
        target: sk.target || 'singleEnemy',
        coef: sk.coef != null ? sk.coef : 0,
        mp: (sk.costs && sk.costs.mp) || 0,
        sp: (sk.costs && sk.costs.sp) || 0,
        damageType: sk.damageType || 'physical',
        element: sk.element || 'none',
        statTypes: Array.isArray(sk.statTypes) ? sk.statTypes.join(', ') : (sk.statTypes || ''),
        duration: sk.duration || 0,
        ccType: (sk.cc && sk.cc.type) || '',
        ccTurns: (sk.cc && sk.cc.turns) || 1,
        ccChance: (sk.cc && sk.cc.chance != null) ? sk.cc.chance : '',
        buffStat: (sk.buff && sk.buff.stats) ? Object.keys(sk.buff.stats)[0] || '' : '',
        buffValue: (sk.buff && sk.buff.stats) ? Object.values(sk.buff.stats)[0] || 0 : 0,
        stealth: (sk.buff && sk.buff.stealth) || false,
        statusType: (sk.status && sk.status.type) || '',
        statusTurns: (sk.status && sk.status.turns) || 2,
        statusChance: (sk.status && sk.status.chance != null) ? sk.status.chance : '',
        cooldown: sk.cooldown || 0,
        desc: sk.desc || '',
      };
    } else {
      item = {
        id:'', name:'', grade:'E', rarity:'Normal', category:'singleAttack', target:'singleEnemy', coef:0, mp:0, sp:0,
        damageType:'physical', element:'none', statTypes:'', duration:0, ccType:'', ccTurns:0, ccChance:'', buffStat:'', buffValue:0, stealth:false, statusType:'', statusTurns:0, statusChance:'', cooldown:0, desc:''
      };
    }
    const catLabels = { singleAttack:'단일공격', aoeAttack:'광역공격', singleCC:'단일CC', aoeCC:'광역CC', singleHeal:'힐', aoeHeal:'광역힐', buff:'버프', passive:'패시브', utility:'유틸' };
    const catIcons = { singleAttack:'⚔️', aoeAttack:'💥', singleCC:'🔗', aoeCC:'🌀', singleHeal:'💚', aoeHeal:'🌿', buff:'✨', passive:'🛡️', utility:'🔧' };
    const customOverrides = new Set((model.db.customSkills || []).map(s => s.id));
    // Group builtin skills by category
    const builtinsByCategory = {};
    Object.values(BUILTIN_SKILLS).forEach(sk => {
      const catKey = sk.category || 'etc';
      if (!builtinsByCategory[catKey]) builtinsByCategory[catKey] = [];
      builtinsByCategory[catKey].push(sk);
    });
    // Merge custom skills into builtin accordion categories
    const customFiltered = (model.db.customSkills || []).filter(c => !BUILTIN_SKILLS[c.id]);
    customFiltered.forEach(c => {
      const catKey = c.category || 'etc';
      if (!builtinsByCategory[catKey]) builtinsByCategory[catKey] = [];
      builtinsByCategory[catKey].push({ ...c, _isCustom: true });
    });
    function renderSkillRow(sk) {
      const cat = catLabels[sk.category] || sk.category;
      const grade = sk.grade || '?';
      const rarity = sk.rarity ? ` <span class="gb-badge" style="background:#a855f7;color:#fff;">${escapeHtml(sk.rarity)}</span>` : '';
      const isOverridden = customOverrides.has(sk.id);
      const overrideBadge = isOverridden ? ' <span class="gb-badge" style="background:#ef4444;color:#fff;">수정됨</span>' : '';
      const costs = sk.costs || {};
      const costParts = [];
      if (costs.mp) costParts.push('MP:' + costs.mp);
      if (costs.sp) costParts.push('SP:' + costs.sp);
      const costStr = costParts.length ? costParts.join(' / ') : '';
      const coefStr = sk.coef != null ? '계수:' + sk.coef : (sk.baseSingleCoef != null ? '기본계수:' + sk.baseSingleCoef + ' (광역CC→½)' : '');
      const byRankStr = sk.byRank ? Object.entries(sk.byRank).map(([g, v]) => {
        const parts = [];
        if (v.coef != null) parts.push('계수:' + v.coef);
        if (v.costs) { if (v.costs.mp) parts.push('MP:' + v.costs.mp); if (v.costs.sp) parts.push('SP:' + v.costs.sp); }
        if (v.buff && v.buff.stats) parts.push('버프:' + Object.entries(v.buff.stats).map(([s,n])=>s.toUpperCase()+'+'+n).join(','));
        if (v.passiveBonuses) parts.push('패시브:' + Object.entries(v.passiveBonuses).map(([s,n])=>s.toUpperCase()+'+'+n).join(','));
        return parts.length ? g + '(' + parts.join(', ') + ')' : '';
      }).filter(Boolean).join(' | ') : '';
      const extras = [];
      if (sk.damageType) extras.push(sk.damageType === 'physical' ? '물리' : '마법');
      if (sk.element && sk.element !== 'none') extras.push('속성:' + sk.element);
      if (sk.cc) extras.push('CC:' + sk.cc.type + ' ' + sk.cc.turns + '턴');
      if (sk.buff && sk.buff.stats) extras.push('버프:' + Object.entries(sk.buff.stats).map(([s,n])=>s.toUpperCase()+'+'+n).join(','));
      if (sk.buff && sk.buff.threatBonus) extras.push('위협+' + sk.buff.threatBonus);
      if (sk.duration) extras.push(sk.duration + '턴');
      if (sk.resourceRestore) extras.push('회복:' + Object.entries(sk.resourceRestore).map(([k,v])=>k.toUpperCase()+'+'+v).join(','));
      if (sk.passiveBonuses) extras.push('패시브:' + Object.entries(sk.passiveBonuses).map(([s,n])=>s.toUpperCase()+'+'+n).join(','));
      if (sk.statTypes) extras.push('스탯:' + (Array.isArray(sk.statTypes) ? sk.statTypes : [sk.statTypes]).join('/'));
      if (sk.cooldown) extras.push('쿨타임:' + sk.cooldown + '턴');
      const extraStr = extras.join(' · ');
      const isCustom = sk._isCustom;
      const clickAttr = isCustom ? `data-select-type="skills" data-id="${escapeHtml(sk.id)}"` : `data-load-builtin-skill="${escapeHtml(sk.id)}"`;
      const customBadge = isCustom ? ' <span class="gb-badge" style="background:#22c55e;color:#fff;">커스텀</span>' : '';
      const isActive = isCustom && sk.id === model.state.selected.skills;
      return `<div class="gb-skill-row" ${clickAttr} style="padding:6px 0;border-bottom:1px solid rgba(148,163,184,0.1);cursor:pointer;${isActive?'background:#1e293b;border-radius:6px;padding-left:6px;':''}" title="클릭하면 편집기로 불러옵니다">
        <div><strong>${escapeHtml(sk.name)}</strong> <span class="gb-badge">${escapeHtml(grade)}</span>${rarity} <span class="gb-badge">${escapeHtml(cat)}</span> <span class="gb-badge">${escapeHtml(sk.id)}</span>${overrideBadge}${customBadge}</div>
        <div style="font-size:12px;margin-top:2px;">${coefStr ? `<span style="color:#3b82f6;font-weight:600;">${escapeHtml(coefStr)}</span>` : ''}${costStr ? ` <span style="color:#f59e0b;">[${escapeHtml(costStr)}]</span>` : ''}</div>
        ${byRankStr ? `<div class="gb-sub" style="font-size:11px;margin-top:2px;">📈 성장: ${escapeHtml(byRankStr)}</div>` : ''}
        ${extraStr ? `<div class="gb-sub" style="font-size:11px;margin-top:1px;">${escapeHtml(extraStr)}</div>` : ''}
        <div class="gb-skill-desc" style="margin-top:2px;">${escapeHtml(sk.desc || '')}</div>
      </div>`;
    }
    const catOrder = ['singleAttack','aoeAttack','singleCC','aoeCC','singleHeal','aoeHeal','buff','passive','utility'];
    const builtinAccordionOrder = [...catOrder];
    if (builtinsByCategory['etc'] && builtinsByCategory['etc'].length) builtinAccordionOrder.push('etc');
    const builtinAccordion = builtinAccordionOrder.filter(c => builtinsByCategory[c] && builtinsByCategory[c].length).map(catKey => {
      const label = catKey === 'etc' ? '기타' : (catLabels[catKey] || catKey);
      const icon = catKey === 'etc' ? '📋' : (catIcons[catKey] || '📋');
      const items = builtinsByCategory[catKey];
      const rows = items.map(renderSkillRow).join('');
      return `<div class="gb-skill-accordion">
        <div class="gb-skill-accordion-header" data-accordion-cat="${escapeHtml(catKey)}">
          <span>${icon} ${escapeHtml(label)} <span class="gb-sub">(${items.length}종)</span></span>
          <span class="gb-skill-accordion-arrow">▶</span>
        </div>
        <div class="gb-skill-accordion-body" data-accordion-body="${escapeHtml(catKey)}" style="display:none;">
          <div class="gb-skill-list">${rows}</div>
        </div>
      </div>`;
    }).join('');
    const isEditingBuiltin = item.id && BUILTIN_SKILLS[item.id];
    const editorTitle = isEditingBuiltin ? `내장 스킬 편집 — <span style="color:#3b82f6;">${escapeHtml(item.name || item.id)}</span>` : '커스텀 스킬 편집';
    return `
      ${builtinAccordion ? `<div class="gb-panel">
        <div class="gb-section-title">내장 스킬 <span class="gb-sub">(카테고리를 클릭하여 펼치기 · 스킬 클릭시 편집기에 불러옴)</span></div>
        ${builtinAccordion}
      </div>` : ''}
      <div class="gb-grid db" style="margin-top:12px;">
        <div class="gb-panel"><div class="gb-section-title">커스텀 스킬 관리</div><div class="gb-sub">커스텀 스킬은 위 카테고리 아코디언에 <span class="gb-badge" style="background:#22c55e;color:#fff;">커스텀</span> 태그와 함께 표시됩니다.</div><div class="gb-btn-row"><button class="gb-btn" id="gb-skill-new">새 스킬</button><button class="gb-btn danger" id="gb-skill-clear-all">스킬 전체삭제</button></div></div>
        <div class="gb-panel">
          <div class="gb-section-title">${editorTitle}</div>
          <div class="gb-grid two">
            <label>ID<input class="gb-input" id="gb-skill-id" value="${escapeHtml(item.id)}" /></label>
            <label>이름<input class="gb-input" id="gb-skill-name" value="${escapeHtml(item.name)}" /></label>
            <label>랭크<select class="gb-input" id="gb-skill-grade">${GRADE_ORDER.map(g=>optionHtml(g,g,item.grade===g)).join('')}</select></label>
            <label>희귀도<select class="gb-input" id="gb-skill-rarity" style="${rarityStyle(item.rarity||'Normal')}">
              ${RARITY_LIST.map(r => `<option value="${r}" ${(item.rarity||'Normal')===r?'selected':''} style="color:${rarityColor(r)}">${r}</option>`).join('')}
            </select></label>
            <label>카테고리<select class="gb-input" id="gb-skill-category">${['singleAttack','aoeAttack','singleCC','aoeCC','singleHeal','aoeHeal','buff','passive','utility'].map(v=>optionHtml(v,v,item.category===v)).join('')}</select></label>
            <label>대상<select class="gb-input" id="gb-skill-target">${['singleEnemy','allEnemies','rowFront','rowMid','rowBack','rowFrontMid','rowMidBack','singleAlly','allAllies','self'].map(v=>optionHtml(v,v,item.target===v)).join('')}</select></label>
            <label>계수<input class="gb-input" id="gb-skill-coef" type="number" step="0.001" value="${escapeHtml(item.coef)}" /></label>
            <label>MP 비용<input class="gb-input" id="gb-skill-mp" type="number" value="${escapeHtml(item.mp)}" /></label>
            <label>SP 비용<input class="gb-input" id="gb-skill-sp" type="number" value="${escapeHtml(item.sp)}" /></label>
            <label>피해 타입<select class="gb-input" id="gb-skill-dmgtype">${optionHtml('physical','physical',item.damageType==='physical')}${optionHtml('magic','magic',item.damageType==='magic')}</select></label>
            <label>속성<select class="gb-input" id="gb-skill-element">${DAMAGE_ELEMENTS.map(v=>optionHtml(v,v,item.element===v)).join('')}</select></label>
            <label>스탯 타입(쉼표구분)<input class="gb-input" id="gb-skill-stattypes" value="${escapeHtml(item.statTypes)}" /></label>
            <label>지속 턴<input class="gb-input" id="gb-skill-duration" type="number" value="${escapeHtml(item.duration)}" /></label>
            <label>CC 종류<select class="gb-input" id="gb-skill-cctype">${['','stun','bind','sleep','silence','slow'].map(v=>optionHtml(v,v||'(없음)',(item.ccType||'')===v)).join('')}</select></label>
            <label>CC 턴<input class="gb-input" id="gb-skill-ccturns" type="number" value="${escapeHtml(item.ccTurns)}" /></label>
            <label>CC 확률(0~1)<input class="gb-input" id="gb-skill-ccchance" type="number" step="0.01" min="0" max="1" value="${escapeHtml(item.ccChance)}" placeholder="비우면 100%" /></label>
            <label>버프 스탯<select class="gb-input" id="gb-skill-buffstat">${['','str','con','int','agi','sense'].map(v=>optionHtml(v,v||'(없음)',(item.buffStat||'')===v)).join('')}</select></label>
            <label>버프 수치<input class="gb-input" id="gb-skill-buffvalue" type="number" value="${escapeHtml(item.buffValue)}" /></label>
            <label style="display:flex;align-items:center;gap:6px;">🥷 은신 (공격 대상에서 제외, 공격 시 해제)<input type="checkbox" id="gb-skill-stealth" ${item.stealth?'checked':''} /></label>
            <label>상태이상<select class="gb-input" id="gb-skill-statustype">${['','poison','bleed','burn','curse','silence','slow'].map(v=>optionHtml(v,v||'(없음)',(item.statusType||'')===v)).join('')}</select></label>
            <label>상태이상 턴<input class="gb-input" id="gb-skill-statusturns" type="number" value="${escapeHtml(item.statusTurns)}" /></label>
            <label>상태이상 확률(0~1)<input class="gb-input" id="gb-skill-statuschance" type="number" step="0.01" min="0" max="1" value="${escapeHtml(item.statusChance)}" placeholder="비우면 기본값" /></label>
            <label>쿨타임(턴)<input class="gb-input" id="gb-skill-cooldown" type="number" value="${escapeHtml(item.cooldown)}" placeholder="0=없음" /></label>
          </div>

          <label>설명<textarea class="gb-textarea short" id="gb-skill-desc">${escapeHtml(item.desc || '')}</textarea></label>
          <div class="gb-btn-row"><button class="gb-btn primary" id="gb-skill-save">저장</button>${isEditingBuiltin ? '<button class="gb-btn" id="gb-skill-restore" style="background:#ef4444;color:#fff;">원본 복원</button>' : '<button class="gb-btn" id="gb-skill-delete">삭제</button>'}</div>
          <div class="gb-sub">${isEditingBuiltin ? '내장 스킬을 수정하면 커스텀 오버라이드로 저장된다. "원본 복원"으로 되돌릴 수 있다.' : '광역 CC는 플러그인 공통 규칙으로 자동 보정된다. 즉 입력 계수는 단일CC 기준으로 넣고, 실제 적용은 1/2 계수 + 비용 2배다.'}</div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,0.16);">
        <div class="gb-section-title">스킬 JSON 가져오기 / 내보내기</div>
        <div class="gb-sub">배열 <code>[...]</code> 또는 객체 <code>{"skills":[...]}</code> 둘 다 지원. 같은 ID는 덮어쓴다. 여러 스킬을 한번에 추가할 수 있다.</div>
        <textarea class="gb-textarea short" id="gb-skill-json" placeholder='[{"id":"fireball","name":"파이어볼","grade":"C","category":"singleAttack","target":"singleEnemy","costs":{"mp":35},"coef":3.2,"statTypes":["int"],"damageType":"magic","element":"fire","desc":"화염 단일 공격"}]'></textarea>
        <div class="gb-btn-row">
          <button class="gb-btn" id="gb-skill-export-json">현재 스킬 내보내기</button>
          <button class="gb-btn" id="gb-skill-import-json">JSON 가져오기</button>
          <button class="gb-btn" id="gb-skill-copy-json">JSON 복사</button>
        </div>
      </div>
    `;
  }


  function renderMaterialEditor() {
    ensureSelections();
    const pack = getRareMaterialPack();
    const rareCatalog = getRareMaterialCatalog();
    const normalCatalog = getNormalMaterialCatalog();
    const scales = getRareMaterialScaleKeys();
    const item = deepClone(getMaterialTraitById(model.state.selected.materials) || {
      id:'', name:'', category:'', scale:'', element:'', status:'', note:''
    });
    const list = (pack.traits || []).map(t => {
      const valText = traitScaleValueText(t, 'C');
      const tail = [t.category, valText ? ('C랭크 ' + valText) : ''].filter(Boolean).join(' / ');
      return `<button class="gb-list-item ${t.id===model.state.selected.materials?'is-active':''}" data-select-type="materials" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)} <span class="gb-sub">[${escapeHtml(t.id)}]</span><div class="gb-sub">${escapeHtml(tail)}</div></button>`;
    }).join('');
    const scalePreview = scales.map(key => {
      const row = pack.valueScales[key] || {};
      return `<div class="gb-skill-row"><div><strong>${escapeHtml(key)}</strong></div><div class="gb-skill-desc">${GRADE_ORDER.map(g => `${g}:${row[g] != null ? row[g] : '-'}`).join(' / ')}</div></div>`;
    }).join('');
    const rarePreview = rareCatalog.slice(0, 5).map(it => `<div class="gb-sub">- ${escapeHtml(it.name || it.id || '이름없음')} <span class="gb-sub">[${escapeHtml(String(it.rank || ''))}]</span></div>`).join('');
    const normalPreview = normalCatalog.slice(0, 5).map(it => `<div class="gb-sub">- ${escapeHtml(it.sourceMonsterName || it.name || it.id || '이름없음')} → ${(it.dropOptions || []).slice(0,2).map(d => escapeHtml(d.name || d.materialId || '재료')).join(', ')}</div>`).join('');
    return `
      <div class="gb-grid db">
        <div class="gb-panel">
          <div class="gb-section-title">희귀재료 특성 목록</div>
          ${list || '<div class="gb-sub">등록된 희귀재료 특성 없음.</div>'}
          <div class="gb-btn-row"><button class="gb-btn" id="gb-mat-new">새 특성</button></div>
        </div>
        <div class="gb-panel">
          <div class="gb-section-title">희귀재료 특성 편집</div>
          <div class="gb-grid two">
            <label>ID<input class="gb-input" id="gb-mat-id" value="${escapeHtml(item.id)}" /></label>
            <label>이름<input class="gb-input" id="gb-mat-name" value="${escapeHtml(item.name)}" /></label>
            <label>카테고리<select class="gb-input" id="gb-mat-category">${['offense','defense','status_apply','status_resist','support'].map(v => optionHtml(v, v, item.category===v)).join('')}</select></label>
            <label>값 스케일<select class="gb-input" id="gb-mat-scale">${scales.map(v => optionHtml(v, v, item.scale===v)).join('')}</select></label>
            <label>속성<select class="gb-input" id="gb-mat-element">${['', ...DAMAGE_ELEMENTS].map(v => optionHtml(v, v || '(없음)', (item.element || '')===v)).join('')}</select></label>
            <label>상태이상<select class="gb-input" id="gb-mat-status">${['', ...STATUS_KEYS].map(v => optionHtml(v, v || '(없음)', (item.status || '')===v)).join('')}</select></label>
          </div>
          <label>메모<textarea class="gb-textarea short" id="gb-mat-note">${escapeHtml(item.note || '')}</textarea></label>
          <div class="gb-btn-row"><button class="gb-btn primary" id="gb-mat-save">저장</button><button class="gb-btn" id="gb-mat-delete">삭제</button></div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,0.16);">
            <div class="gb-section-title">재료 JSON 가져오기 / 내보내기</div>
            <div class="gb-sub">지원 형식: 배열 <code>[...]</code>, <code>{"traits":[...]}</code>, 전체 팩 <code>{version,note,valueScales,traits}</code>, 희귀재료 카탈로그 <code>{items:[...]}</code>, 일반재료 드랍 테이블 <code>{entries:[...]}</code>.</div>
            <textarea class="gb-textarea short" id="gb-mat-json"></textarea>
            <div class="gb-btn-row">
              <button class="gb-btn" id="gb-mat-export-json">현재 특성 내보내기</button>
              <button class="gb-btn" id="gb-mat-import-json">JSON 가져오기</button>
              <button class="gb-btn" id="gb-mat-copy-json">JSON 복사</button>
            </div>
          </div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,0.16);">
            <div class="gb-section-title">불러온 재료 데이터 요약</div>
            <div class="gb-sub">희귀재료 카탈로그: <strong>${rareCatalog.length}</strong>개</div>
            ${rarePreview || '<div class="gb-sub">희귀재료 카탈로그 미등록</div>'}
            <div style="height:10px;"></div>
            <div class="gb-sub">일반재료 드랍 엔트리: <strong>${normalCatalog.length}</strong>개</div>
            ${normalPreview || '<div class="gb-sub">일반재료 드랍 테이블 미등록</div>'}
          </div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,0.16);">
            <div class="gb-section-title">값 스케일 미리보기</div>
            <div class="gb-skill-list">${scalePreview || '<div class="gb-sub">스케일 정보 없음.</div>'}</div>
          </div>
        </div>
      </div>
    `;
  }



  // ── Equipment Editor ──────────────────────────────────────────────────────
  function renderEquipmentEditor() {
    ensureSelections();
    if (!Array.isArray(model.db.equipments)) model.db.equipments = [];
    const sel = model.state.selected.equipment || '';
    const eqs = model.db.equipments;
    const item = deepClone(eqs.find(e => e.id === sel) || {
      id:'', name:'', part:'weapon', rank:'E', enhance:0,
      infuse:0, traits:[], durability:100,
      atk:0, pdef:0, mdef:0, stats:{ str:0, con:0, int:0, agi:0, sense:0 },
      note:'', price:0, resistType:'', resistPct:0, statusType:'',
      rarity:'Normal', specialEffect:null, armorSubtype:''
    });

    // Auto-preview calculated values
    const rank = item.rank || 'E';
    const part = item.part || 'weapon';
    const enhance = Number(item.enhance || 0);
    const maxEnhance = EQUIP_MAX_ENHANCE[part] || 0;
    const maxInfuse = EQUIP_MAX_INFUSE[part] || 1;
    const autoBasePrice = calcEquipBasePrice(rank, part);
    const autoEnhPrice = calcEquipEnhancedPrice(autoBasePrice, enhance, rank);
    // Trait bonus price: each trait adds tier-based rare material price
    const itemTraits = item.traits || [];
    let traitPriceBonus = 0;
    itemTraits.forEach(tid => {
      traitPriceBonus += getRareMatTierPrice(rank, tid);
    });
    const autoTotalPrice = autoEnhPrice + traitPriceBonus;
    const rangeText = (() => {
      const r = EQUIP_PRICE_RANGE[rank];
      if (!r) return '';
      const fmt = n => n >= 1e8 ? (n/1e8).toFixed(1)+'억' : n >= 10000 ? Math.round(n/10000)+'만' : n+'원';
      return `${fmt(r[0])} ~ ${fmt(r[1])}`;
    })();

    // Item list filtered by active part filter
    const partFilter = model.state.equipPartFilter || '';

    const partList = EQUIP_PARTS.map(p =>
      `<button class="gb-btn ${partFilter===p?'primary':''}" data-eq-part-filter="${p}">${EQUIP_PART_LABELS[p]}</button>`
    ).join('');

    const filteredEqs = partFilter ? eqs.filter(e => e.part === partFilter) : eqs;
    // 장비 목록을 부위별 + 등급별 접는 방식(details/summary)으로 그룹화
    const listHtml = (() => {
      if (!filteredEqs.length) return '<div class="gb-sub">등록된 장비 없음.</div>';
      const grouped = {};
      filteredEqs.forEach(e => {
        const key = `${EQUIP_PART_LABELS[e.part]||e.part}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
      });
      return Object.entries(grouped).map(([groupLabel, items]) => {
        const hasActive = items.some(e => e.id === sel);
        const rows = items.map(e => {
          const label = `${e.name || e.id} [${e.rank}+${e.enhance||0}]`;
          const rStyle = rarityStyle(e.rarity);
          return `<button class="gb-list-item ${e.id===sel?'is-active':''}" data-select-type="equipment" data-id="${escapeHtml(e.id)}" style="${rStyle}">${escapeHtml(label)}${e.rarity && e.rarity !== 'Normal' ? ' <span class="gb-badge" style="background:'+rarityColor(e.rarity)+';color:#000;font-size:10px;">'+escapeHtml(e.rarity)+'</span>' : ''}</button>`;
        }).join('');
        return `<details ${hasActive ? 'open' : ''} style="margin-bottom:4px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:4px 8px;font-size:0.9em;">${escapeHtml(groupLabel)} (${items.length})</summary>
          <div style="max-height:200px;overflow-y:auto;padding:2px 4px;">${rows}</div>
        </details>`;
      }).join('');
    })();

    const traitsHtml = EQUIP_TRAIT_TYPES.map(t => {
      const hasTrait = (item.traits || []).includes(t);
      return `<label style="display:flex;align-items:center;gap:4px;font-size:0.85em;"><input type="checkbox" id="gb-eq-trait-${t}" ${hasTrait?'checked':''} />${escapeHtml(equipTraitDisplay(t, rank))}</label>`;
    }).join('');

    // Weapon ATK auto-calc display
    const baseAtk = WEAPON_BASE_ATK[rank] || 0;
    const atkPerEnhance = WEAPON_ENHANCE_ATK[rank] || 1;
    const calcAtk = part === 'weapon' ? baseAtk + enhance * atkPerEnhance : (part === 'subweapon' ? -Math.ceil((Number(item.pdef||0))/2) : 0);
    const armorStat = ARMOR_STAT_BY_RANK[rank] || {};
    const accessoryStat = ACCESSORY_STAT_BY_RANK[rank] || {};

    const priceDisplay = (() => {
      const p = Number(item.price || autoTotalPrice);
      if (p >= 1e8) return `${(p/1e8).toFixed(2)}억원`;
      if (p >= 10000) return `${Math.round(p/10000)}만원`;
      return `${p.toLocaleString('en-US')}원`;
    })();
    const traitPriceText = traitPriceBonus > 0 ? (() => {
      if (traitPriceBonus >= 1e8) return `+${(traitPriceBonus/1e8).toFixed(2)}억`;
      if (traitPriceBonus >= 10000) return `+${Math.round(traitPriceBonus/10000)}만`;
      return `+${traitPriceBonus.toLocaleString('en-US')}원`;
    })() : '';

    return `
      <div class="gb-grid db">
        <div class="gb-panel">
          <div class="gb-section-title">장비 목록</div>
          <div class="gb-btn-row" style="flex-wrap:wrap;gap:4px;">
            <button class="gb-btn ${!partFilter?'primary':''}" data-eq-part-filter="">전체</button>
            ${partList}
          </div>
          <div style="margin-top:6px;">${listHtml}</div>
          <div class="gb-btn-row" style="margin-top:8px;">
            <button class="gb-btn" id="gb-eq-new">새 장비</button>
            <button class="gb-btn" id="gb-eq-export">내보내기</button>
          </div>
        </div>
        <div class="gb-panel">
          <div class="gb-section-title">장비 편집</div>
          ${item.id ? (() => {
            const partLabel = EQUIP_PART_LABELS[part] || part;
            const rarityLabel = item.rarity && item.rarity !== 'Normal' ? item.rarity : '일반';
            const traitCount = itemTraits.length;
            const enhStr = enhance > 0 ? ` +${enhance}강` : '';
            const infuseStr = Number(item.infuse || 0) > 0 ? ` · 주입 ${item.infuse}회` : '';
            const traitStr = traitCount > 0 ? ` · 특성 ${traitCount}개` : '';
            const smeStr = item.specialEffect && item.specialEffect.effectId ? ` · ✨특수효과` : '';
            const autoRareHint = (item.specialEffect && item.specialEffect.effectId && (part === 'weapon' || part === 'armor') && (!item.rarity || item.rarity === 'Normal')) ? ' <span style="color:#f59e0b;">→ 저장 시 Rare 자동 적용</span>' : '';
            return '<div style="background:#1a1d2e;border:1px solid rgba(148,163,184,0.15);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:13px;">' +
              '<strong style="color:#60a5fa;">' + escapeHtml(item.name || item.id) + '</strong> ' +
              '<span class="gb-badge">' + escapeHtml(rank) + '</span> ' +
              '<span style="color:' + rarityColor(item.rarity || 'Normal') + ';">' + escapeHtml(rarityLabel) + '</span> ' +
              escapeHtml(partLabel) + enhStr +
              '<div class="gb-sub" style="margin-top:2px;">' + escapeHtml(`내구도 ${item.durability != null ? item.durability : 100}%${infuseStr}${traitStr}${smeStr}`) + autoRareHint + '</div>' +
            '</div>';
          })() : ''}
          <div class="gb-sub" style="color:#94a3b8;">등급별 시세: <strong>${escapeHtml(rangeText)}</strong> | 자동 기준가: <strong>${escapeHtml(priceDisplay)}</strong>${traitPriceText ? ` <span style="color:#a78bfa;">(특성 ${escapeHtml(traitPriceText)})</span>` : ''}</div>

          <details open style="margin-top:8px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">📋 기본 정보</summary>
          <div class="gb-grid two" style="margin-top:6px;">
            <label>ID<input class="gb-input" id="gb-eq-id" value="${escapeHtml(item.id)}" /></label>
            <label>이름<input class="gb-input" id="gb-eq-name" value="${escapeHtml(item.name)}" /></label>
            <label>부위<select class="gb-input" id="gb-eq-part">
              ${EQUIP_PARTS.map(p => `<option value="${p}" ${item.part===p?'selected':''}>${EQUIP_PART_LABELS[p]}</option>`).join('')}
            </select></label>
            <label>등급<select class="gb-input" id="gb-eq-rank">
              ${GRADE_ORDER.map(g => `<option value="${g}" ${item.rank===g?'selected':''}>${g}</option>`).join('')}
            </select></label>
            <label>희귀도<select class="gb-input" id="gb-eq-rarity" style="${rarityStyle(item.rarity||'Normal')}">
              ${RARITY_LIST.map(r => `<option value="${r}" ${(item.rarity||'Normal')===r?'selected':''} style="color:${rarityColor(r)}">${r}</option>`).join('')}
            </select></label>
            <label>강화 (+0~+${maxEnhance})<input class="gb-input" id="gb-eq-enhance" type="number" min="0" max="${maxEnhance}" value="${enhance}" /></label>
            <label>인퓨전 횟수 (최대 ${maxInfuse})<input class="gb-input" id="gb-eq-infuse" type="number" min="0" max="${maxInfuse}" value="${Number(item.infuse||0)}" /></label>
            <label>내구도 (0~100)<input class="gb-input" id="gb-eq-durability" type="number" min="0" max="100" value="${Number(item.durability != null ? item.durability : 100)}" /></label>
            <label>가격 (0=자동)<input class="gb-input" id="gb-eq-price" type="number" min="0" value="${Number(item.price||0)}" /></label>
          </div>
          </details>

          ${part === 'weapon' ? `
          <details open style="margin-top:6px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">⚔️ 무기 스탯</summary>
          <div class="gb-sub">무기: 기본 ATK <strong>${baseAtk}</strong> + 강화당 <strong>+${atkPerEnhance}</strong> → +${enhance}강 ATK <strong>${baseAtk + enhance*atkPerEnhance}</strong></div>
          <div class="gb-grid two">
            <label>ATK (0=자동)<input class="gb-input" id="gb-eq-atk" type="number" value="${Number(item.atk||0)}" /></label>
          </div>
          </details>` : ''}

          ${part === 'subweapon' ? `
          <details open style="margin-top:6px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">🛡️ 보조무기 스탯</summary>
          <div class="gb-sub">보조무기: 방패만 물리방어 보유. 기타(장갑/보호대 등)는 특수효과만 적용.</div>
          <div class="gb-grid two">
            <label>물리방어<input class="gb-input" id="gb-eq-pdef" type="number" value="${Number(item.pdef||0)}" /></label>
          </div>
          </details>` : ''}

          ${part === 'armor' ? `
          <details open style="margin-top:6px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">🛡 방어구 스탯</summary>
          <div class="gb-sub">방어구: 물리방어/마법방어 ${armorStat.defRange?armorStat.defRange[0]+'~'+armorStat.defRange[1]:''} | 총 스탯합 ${armorStat.totalStatSum||0} | 강화당 주스탯 +${armorStat.enhanceStat||0}</div>
          <div class="gb-sub">🛡 방어구 종류: 중갑(방어90~100%,STR/CON,ATK-10%) · 경갑(방어70~80%,STR/CON/AGI) · 가죽(방어50~60%,STR/AGI/INT/SEN,스탯+10%) · 로브(방어40~50%,AGI/INT/SEN,스탯+20%)</div>
          <div class="gb-sub" style="color:#94a3b8;">⚗️ 저항은 희귀재료 인퓨즈로 부여 (DB에서 직접 수정 가능). 기본 저항 없음.</div>
          <div class="gb-grid two">
            <label>방어구 종류<select class="gb-input" id="gb-eq-armor-subtype">
              ${ARMOR_SUBTYPE_KEYS.map(k => `<option value="${k}" ${(item.armorSubtype||'')=== k?'selected':''}>${ARMOR_SUBTYPES[k].label} (방어${Math.round(ARMOR_SUBTYPES[k].defMul[0]*100)}~${Math.round(ARMOR_SUBTYPES[k].defMul[1]*100)}%${ARMOR_SUBTYPES[k].atkMul ? ', ATK'+Math.round(ARMOR_SUBTYPES[k].atkMul*100)+'%' : ''}${ARMOR_SUBTYPES[k].statBonusMul ? ', 스탯+'+Math.round(ARMOR_SUBTYPES[k].statBonusMul*100)+'%' : ''})</option>`).join('')}
            </select></label>
            <label>물리방어<input class="gb-input" id="gb-eq-pdef" type="number" value="${Number(item.pdef||0)}" /></label>
            <label>마법방어<input class="gb-input" id="gb-eq-mdef" type="number" value="${Number(item.mdef||0)}" /></label>
            <label>저항 타입 (인퓨즈 결과)<select class="gb-input" id="gb-eq-resist-type">
              <option value="">없음</option>
              ${['physical','magic','fire','ice','lightning','dark','light'].map(t => `<option value="${t}" ${item.resistType===t?'selected':''}>${t}</option>`).join('')}
            </select></label>
            <label>저항 %<input class="gb-input" id="gb-eq-resist-pct" type="number" min="0" max="100" value="${Number(item.resistPct||0)}" /></label>
            <label>총 스탯합 적용 주스탯<select class="gb-input" id="gb-eq-main-stat">
              ${['str','con','int','agi','sense'].map(s => `<option value="${s}" ${item.mainStat===s?'selected':''}>${s}</option>`).join('')}
            </select></label>
          </div>
          </details>` : ''}

          ${part === 'accessory' ? `
          <details open style="margin-top:6px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">💍 악세서리 스탯</summary>
          <div class="gb-sub">악세서리: 총 스탯합 ${accessoryStat.totalStatSum||0} | 특성 슬롯 ${accessoryStat.traits||1}개 | 강화당 주스탯 +${accessoryStat.enhanceStat||0}</div>
          <div class="gb-sub" style="color:#a78bfa;">✨ ${rank}등급 특성 효과 예시: 물리/마법 피해 +${(DEFAULT_RARE_MATERIAL_PACK.valueScales.percentSmall||{})[rank]||0}%, 속성/상태이상 +${(DEFAULT_RARE_MATERIAL_PACK.valueScales.statusPercent||{})[rank]||0}%, 치확 +${(DEFAULT_RARE_MATERIAL_PACK.valueScales.critChance||{})[rank]||0}%, 치피 +${(DEFAULT_RARE_MATERIAL_PACK.valueScales.critDamage||{})[rank]||0}%, 방어력 +${(DEFAULT_RARE_MATERIAL_PACK.valueScales.defenseFlat||{})[rank]||0}</div>
          <div class="gb-grid two">
            <label>총 스탯합 적용 주스탯<select class="gb-input" id="gb-eq-main-stat">
              ${['str','con','int','agi','sense'].map(s => `<option value="${s}" ${item.mainStat===s?'selected':''}>${s}</option>`).join('')}
            </select></label>
          </div>
          </details>` : ''}

          <details open style="margin-top:8px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">🔖 특성(Trait)</summary>
          <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px;">${traitsHtml}</div>
          </details>

          <details style="margin-top:6px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">⚡ 상태이상 부여 (유니크/전설 전용)</summary>
          <div class="gb-sub">유니크/전설 장비 전용 상태이상 효과. 상점/경매 미등록 아이템에만 사용.</div>
          <div class="gb-grid two" style="margin-top:4px;">
            <label>상태이상 종류<select class="gb-input" id="gb-eq-status-type">
              ${['','poison','bleed','burn','curse','silence','slow','bind','stun','sleep'].map(v=>`<option value="${v}" ${(item.statusType||'')===v?'selected':''}>${v||'(없음)'}</option>`).join('')}
            </select></label>
            <label>발동 확률 (%)<input class="gb-input" id="gb-eq-status-chance" type="number" min="0" max="100" value="${Number(item.statusChance||0)}" /></label>
          </div>
          </details>

          <label style="margin-top:8px;display:block;">메모<textarea class="gb-textarea short" id="gb-eq-note">${escapeHtml(item.note||'')}</textarea></label>

          <details style="margin-top:6px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">✨ 특수효과 (Special Effect)</summary>
            <div class="gb-sub">특성주입과 별개로 무기/장비에 추가되는 특수 옵션. 버프=자신 강화, 디버프=적에게 받는 피해 증가.</div>
            <div class="gb-sub" style="color:#f59e0b;">💡 무기/방어구에 특수효과 추가 시 자동으로 Rare 등급 적용. 확률·수치 0이면 등급에 맞게 자동 설정됨.</div>
            <div class="gb-sub" style="color:#60a5fa;">📌 특수효과는 주입이 아닙니다. maxInfuse를 증가시키지 않으며 주입횟수를 사용하지 않습니다.</div>
            <div class="gb-sub" style="color:#60a5fa;">📌 보조무기: 특수효과1 + 주입 최대 2회 / 악세서리: 특수효과1 + 주입 최대 1회</div>
            <div class="gb-grid two" style="margin-top:6px;">
              <label>효과 종류<select class="gb-input" id="gb-eq-sme-type">
                <option value="" ${!(item.specialEffect&&item.specialEffect.type)?'selected':''}>없음</option>
                <option value="buff" ${(item.specialEffect&&item.specialEffect.type)==='buff'?'selected':''}>버프 (자신 강화)</option>
                <option value="debuff" ${(item.specialEffect&&item.specialEffect.type)==='debuff'?'selected':''}>디버프 (받는 피해 증가)</option>
              </select></label>
              <label>발동확률 (%)<input class="gb-input" id="gb-eq-sme-chance" type="number" min="0" max="100" value="${(item.specialEffect&&item.specialEffect.chance)||0}" /></label>
              <label>효과 선택<select class="gb-input" id="gb-eq-sme-effect">
                ${smeOptionsHtml((item.specialEffect&&item.specialEffect.effectId)||'', (item.specialEffect&&item.specialEffect.type)||'')}
              </select></label>
              <label>효과 수치<input class="gb-input" id="gb-eq-sme-value" type="number" value="${(item.specialEffect&&item.specialEffect.value)||0}" /></label>
            </div>
            ${item.specialEffect && item.specialEffect.effectId ? (() => {
              const eff = getSpecialMaterialEffectById(item.specialEffect.effectId);
              if (!eff) return '';
              const desc = (item.specialEffect.type === 'debuff' && eff.canDebuff) ? eff.debuffDesc : eff.buffDesc;
              return '<div class="gb-sub" style="margin-top:4px;color:#a78bfa;">미리보기: ' + escapeHtml((desc||'').replace(/N/g, String(item.specialEffect.value||0))) + ' (발동확률 ' + (item.specialEffect.chance||0) + '%)</div>';
            })() : ''}
          </details>

          <div class="gb-btn-row" style="margin-top:8px;"><button class="gb-btn primary" id="gb-eq-save">저장</button><button class="gb-btn" id="gb-eq-delete">삭제</button><button class="gb-btn" id="gb-eq-send-inventory" title="커스텀 장비를 인벤토리로 전송">📦 인벤토리로 보내기</button></div>

          <details style="margin-top:8px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">🔧 수리비 계산기</summary>
            <div class="gb-sub">현재 내구도: <strong>${Number(item.durability != null ? item.durability : 100)}%</strong></div>
            <div class="gb-grid two">
              <label>수리 후 내구도<input class="gb-input" id="gb-eq-repair-target" type="number" min="0" max="100" value="100" /></label>
              <label style="display:flex;align-items:flex-end;">
                <button class="gb-btn" id="gb-eq-calc-repair">수리비 계산</button>
              </label>
            </div>
            <div id="gb-eq-repair-result" class="gb-sub"></div>
          </details>

          <details style="margin-top:6px;border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:6px;">
          <summary style="cursor:pointer;font-weight:bold;padding:2px 4px;">📥 장비 JSON 가져오기</summary>
            <textarea class="gb-textarea short" id="gb-eq-json"></textarea>
            <div class="gb-btn-row">
              <button class="gb-btn" id="gb-eq-import-json">JSON 가져오기</button>
            </div>
          </details>
        </div>
      </div>
    `;
  }


function renderDbView() {
    const tab = model.state.dbTab || 'characters';
    const inner = tab === 'characters' ? renderCharacterEditor()
      : tab === 'monsters' ? renderMonsterEditor()
      : tab === 'personas' ? renderPersonaEditor()
      : tab === 'materials' ? renderMaterialEditor()
      : tab === 'equipment' ? renderEquipmentEditor()
      : renderSkillEditor();
    return `
      <div class="gb-btn-row">
        <button class="gb-btn ${tab==='characters'?'primary':''}" data-dbtab="characters">캐릭터</button>
        <button class="gb-btn ${tab==='personas'?'primary':''}" data-dbtab="personas">페르소나</button>
        <button class="gb-btn ${tab==='skills'?'primary':''}" data-dbtab="skills">스킬</button>
        <button class="gb-btn ${tab==='monsters'?'primary':''}" data-dbtab="monsters">몬스터</button>
        <button class="gb-btn ${tab==='materials'?'primary':''}" data-dbtab="materials">재료</button>
        <button class="gb-btn ${tab==='equipment'?'primary':''}" data-dbtab="equipment">장비</button>
      </div>
      <div style="margin-top:12px;">${inner}</div>
    `;
  }

function renderDateCharBar() {
  const gd = model.db.gameDate || { year: 2026, month: 1, day: 1 };
  const chars = (model.db.characters || []).filter(c => !c.id.startsWith('char_guide'));
  const personas = (model.db.personas || []);
  const activeId = model.state.activeCharId || '';
  const charOpts = chars.map(c => {
    const val = `char:${c.id}`;
    return `<option value="${escapeHtml(val)}" ${val === activeId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
  }).join('');
  const personaOpts = personas.map(p => {
    const val = `persona:${p.id}`;
    return `<option value="${escapeHtml(val)}" ${val === activeId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`;
  }).join('');
  const activeInv = getActiveInventory();
  const goldDisplay = Number(activeInv.gold || 0);
  const goldLabel = getActiveLabel();
  return `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:6px 12px; background:rgba(30,41,59,0.5); border-bottom:1px solid rgba(148,163,184,0.1); font-size:0.85em;">
      <div style="display:flex; gap:4px; align-items:center;">
        <span>📅</span>
        <input type="number" id="gb-date-year" class="gb-input" style="width:64px; padding:2px 4px;" value="${gd.year}" min="1" />
        <span>년</span>
        <input type="number" id="gb-date-month" class="gb-input" style="width:44px; padding:2px 4px;" value="${gd.month}" min="1" max="12" />
        <span>월</span>
        <input type="number" id="gb-date-day" class="gb-input" style="width:44px; padding:2px 4px;" value="${gd.day}" min="1" max="31" />
        <span>일</span>
        <button class="gb-btn tiny" id="gb-date-next">다음날 ▶</button>
      </div>
      <div style="display:flex; gap:4px; align-items:center;">
        <span>🧑</span>
        <select id="gb-active-char" class="gb-input" style="padding:2px 4px; min-width:120px;">
          <option value="" ${!activeId ? 'selected' : ''}>📦 공용 인벤토리</option>
          ${charOpts ? `<optgroup label="캐릭터">${charOpts}</optgroup>` : ''}
          ${personaOpts ? `<optgroup label="페르소나">${personaOpts}</optgroup>` : ''}
        </select>
        <span style="color:#94a3b8;">💰 ₩${goldDisplay.toLocaleString('en-US')} (${escapeHtml(goldLabel)})</span>
      </div>
    </div>`;
}

function renderApp() {
  ensureSelections();
  const root = model.root || document.getElementById(UI_ID);
  if (!root) return;
  model.root = root;
  // 판매 경매 애니메이션 타이머 자동 재개 (페이지 재렌더 후)
  const ss = model.state.auctionSell;
  if (ss && ss.done === false && (ss.revealedCount ?? 0) < (ss.fullLog||[]).length && !_sellAuctionTimerId) {
    _startSellAuctionTimer();
  }
  const view = model.state.view || 'hub';
  // Gate immersive fullscreen: skip header/nav when active gate run
  const gateImmersive = view === 'gate' && activeGateRun();
  let body;
  if      (view === 'hub')         body = renderHub();
  else if (view === 'gate')        body = renderGateView();
  else if (view === 'battle')      body = renderBattleRuntime();
  else if (view === 'party')       body = renderPartyView();
  else if (view === 'character')   body = renderCharacterView();
  else if (view === 'inventory')   body = renderInventoryView();
  else if (view === 'association') body = renderAssociationView();
  else if (view === 'shop')        body = renderShopView();
  else if (view === 'home')        body = renderHomeView();
  else if (view === 'guild')       body = renderGuildView();
  else                             body = renderDbView();
  if (gateImmersive) {
    root.innerHTML = `
      <div class="gb-shell ${model.state.visible ? '' : 'hidden'}">
        ${body}
      </div>
    `;
  } else {
    root.innerHTML = `
      <div class="gb-shell ${model.state.visible ? '' : 'hidden'}">
        <div class="gb-header">
          <div>
            <div class="gb-title">⚔️ Gate Battle Prototype v7.4</div>
            <div class="gb-sub">허브 · 게이트 · 전투 · 파티 · 캐릭터 · 공용인벤 · DB</div>
          </div>
          <div style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;">
            <button class="gb-btn ${view==='hub'?'primary':''}" data-go="hub">허브</button>
            <button class="gb-btn ${view==='gate'?'primary':''}" data-go="gate">게이트</button>
            <button class="gb-btn ${view==='battle'?'primary':''}" data-go="battle">전투</button>
            <button class="gb-btn ${view==='party'?'primary':''}" data-go="party">파티</button>
            <button class="gb-btn ${view==='inventory'?'primary':''}" data-go="inventory">공용인벤</button>
            <button class="gb-btn ${view==='character'?'primary':''}" data-go="character">캐릭터</button>
            <button class="gb-btn ${view==='db'?'primary':''}" data-go="db">DB</button>
            <button class="gb-btn" id="gb-close-ui">닫기</button>
          </div>
        </div>
        ${renderDateCharBar()}
        ${body}
      </div>
    `;
  }
  bindUI();
}

function readPartySlotsFromUI() {
    const slots = [];
    for (let i=0;i<MAX_PARTY;i+=1) slots.push(fieldValue(`#gb-party-slot-${i}`));
    return slots;
  }
  function readEnemySlotsFromUI() {
    const slots = [];
    for (let i=0;i<MAX_ENEMIES;i+=1) slots.push(fieldValue(`#gb-enemy-slot-${i}`));
    return slots;
  }
  function collectPendingActions() {
    const runtime = model.state.runtime;
    const pending = {};
    getAlive(runtime.party).forEach(unit => {
      let mode = fieldValue(`#gb-act-mode-${unit.uid}`) || 'basic';
      const skillId = fieldValue(`#gb-act-skill-${unit.uid}`) || '';
      const target = fieldValue(`#gb-act-target-${unit.uid}`) || '';
      // 스킬이 선택되어 있으면 모드가 '기본공격'이어도 자동으로 스킬 모드로 전환
      if (skillId && mode === 'basic') mode = 'skill';
      pending[unit.uid] = { mode, skillId, target };
    });
    runtime.pendingActions = pending;
  }

  function upsertById(list, item) {
    const idx = list.findIndex(x => x.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
  }

  async function saveCharacterFromForm() {
    const id = slugify(fieldValue('#gb-char-id') || fieldValue('#gb-char-name'));
    const existingChar = getCharById(id) || {};
    const item = {
      id,
      name: fieldValue('#gb-char-name'),
      job: fieldValue('#gb-char-job'),
      position: fieldValue('#gb-char-position'),
      row: fieldValue('#gb-char-row'),
      rank: fieldValue('#gb-char-rank'),
      hp: Number(fieldValue('#gb-char-hp') || 0),
      mp: Number(fieldValue('#gb-char-mp') || 0),
      sp: Number(fieldValue('#gb-char-sp') || 0),
      atk: Number(fieldValue('#gb-char-atk') || 0),
      pdef: Number(fieldValue('#gb-char-pdef') || 0),
      mdef: Number(fieldValue('#gb-char-mdef') || 0),
      damageType: fieldValue('#gb-char-dmgtype') || 'physical',
      attackStat: fieldValue('#gb-char-atkstat') || 'str',
      threatBase: Number(fieldValue('#gb-char-threat') || 0),
      skills: splitCsv(fieldValue('#gb-char-skills')),
      note: fieldValue('#gb-char-note'),
      level: Math.max(1, Math.min(EXP_MAX_LEVEL, Number(fieldValue('#gb-char-level') || 1))),
      exp: Math.max(0, Number(fieldValue('#gb-char-exp') || 0)),
      totalExp: Math.max(0, Number(fieldValue('#gb-char-totalexp') || 0)),
      bagId: existingChar.bagId || 'none',
      stats: {
        str:Number(fieldValue('#gb-char-str') || 0),
        con:Number(fieldValue('#gb-char-con') || 0),
        int:Number(fieldValue('#gb-char-int') || 0),
        agi:Number(fieldValue('#gb-char-agi') || 0),
        sense:Number(fieldValue('#gb-char-sense') || 0)
      }
    };
    // HP/MP/SP가 0이면 스탯 기반 자동 계산
    if (item.hp <= 0) item.hp = 100 + (item.stats.con - 10) * 10 + (item.stats.str - 10) * 3;
    if (item.mp <= 0) item.mp = 100 + (item.stats.int - 10) * 10 + (item.stats.sense - 10) * 3;
    if (item.sp <= 0) item.sp = 100 + (item.stats.agi - 10) * 10 + (item.stats.sense - 10) * 3;
    if (existingChar.inventory) item.inventory = existingChar.inventory;
    if (!item.name) throw new Error('캐릭터 이름이 비어 있다.');
    upsertById(model.db.characters, item);
    // 장착 무기 ATK를 포함하여 파생 스탯 재계산
    const saved = getCharById(id);
    if (saved && saved.stats) recalcCharDerivedStats(saved);
    model.state.selected.characters = id;
    await saveDb(); await saveState(); renderApp(); toast('캐릭터 저장 완료');
  }
  async function clearAllMonsters() {
    model.db.monsters = [];
    model.state.selected.monsters = '';
    model.db.battleSetup.enemySlots = Array(MAX_ENEMIES).fill('');
    model.state.runtime = buildDefaultRuntime();
    model.state.gate = buildDefaultGateState();
    generateGateOptions(model.state.gate.size || 'small', model.state.gate.rank || 'E');
    await saveDb(); await saveState(); renderApp(); toast('몬스터 전체 삭제 완료');
  }
  async function clearAllCharacters() {
    model.db.characters = [];
    model.state.selected.characters = '';
    model.db.battleSetup.partySlots = Array(MAX_PARTY).fill('');
    model.db.team = [];
    model.state.runtime = buildDefaultRuntime();
    await saveDb(); await saveState(); renderApp(); toast('캐릭터 전체 삭제 완료');
  }
  async function clearAllCustomSkills() {
    model.db.customSkills = [];
    model.state.selected.skills = '';
    await saveDb(); await saveState(); renderApp(); toast('커스텀 스킬 전체 삭제 완료');
  }
  function exportSkillsJsonText() {
    return JSON.stringify({ skills: deepClone(model.db.customSkills || []) }, null, 2);
  }
  async function importSkillsJsonFromText(raw) {
    const txt = String(raw || '').trim();
    if (!txt) throw new Error('붙여넣은 JSON이 비어 있다.');
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch (e) { throw new Error('JSON 파싱 실패: ' + e.message); }
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.skills) ? parsed.skills : null);
    if (!rows) throw new Error('형식이 맞지 않는다. 배열 [...] 또는 { "skills":[...] } 형식이어야 한다.');
    if (!rows.length) throw new Error('가져올 스킬이 없다.');
    let count = 0;
    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const item = deepClone(row);
      if (!item.id) item.id = slugify(item.name || 'skill_' + count);
      if (!item.name) return;
      if (!item.grade) item.grade = 'E';
      if (!item.category) item.category = 'singleAttack';
      if (!item.target) item.target = 'singleEnemy';
      if (!item.costs) item.costs = { mp:0, sp:0 };
      if (item.coef == null) item.coef = 1.0;
      if (!item.damageType) item.damageType = 'physical';
      if (!item.element) item.element = 'none';
      if (!item.statTypes) item.statTypes = ['str'];
      if (!item.desc) item.desc = '';
      upsertById(model.db.customSkills, item);
      count += 1;
    });
    ensureSelections();
    await saveDb(); await saveState(); renderApp();
    toast(`스킬 ${count}개 가져오기 완료`);
  }
  
  async function saveMonsterFromForm() {
    const id = slugify(fieldValue('#gb-mon-id') || fieldValue('#gb-mon-name'));
    const prev = deepClone(getMonsterById(model.state.selected.monsters) || {});
    const item = normalizeImportedMonster(Object.assign({}, prev, {
      id,
      name: fieldValue('#gb-mon-name'),
      kind: fieldValue('#gb-mon-kind'),
      role: fieldValue('#gb-mon-role'),
      position: fieldValue('#gb-mon-position'),
      row: fieldValue('#gb-mon-row'),
      rank: fieldValue('#gb-mon-rank'),
      hp: Number(fieldValue('#gb-mon-hp') || 0),
      mp: Number(fieldValue('#gb-mon-mp') || 0),
      sp: Number(fieldValue('#gb-mon-sp') || 0),
      atk: Number(fieldValue('#gb-mon-atk') || 0),
      pdef: Number(fieldValue('#gb-mon-pdef') || 0),
      mdef: Number(fieldValue('#gb-mon-mdef') || 0),
      damageType: fieldValue('#gb-mon-dmgtype') || 'physical',
      attackStat: fieldValue('#gb-mon-atkstat') || 'str',
      threatBase: Number(fieldValue('#gb-mon-threat') || 0),
      skills: splitCsv(fieldValue('#gb-mon-skills')),
      note: fieldValue('#gb-mon-note'),
      stats: {
        str:Number(fieldValue('#gb-mon-str') || 0),
        con:Number(fieldValue('#gb-mon-con') || 0),
        int:Number(fieldValue('#gb-mon-int') || 0),
        agi:Number(fieldValue('#gb-mon-agi') || 0),
        sense:Number(fieldValue('#gb-mon-sense') || 0)
      }
    }), 0);
    if (!item.name) throw new Error('몬스터 이름이 비어 있다.');
    upsertById(model.db.monsters, item);
    model.state.selected.monsters = id;
    await saveDb(); await saveState(); renderApp(); toast('몬스터 저장 완료');
  }

  function normalizeImportedMonster(raw, idx) {
    const item = deepClone(raw || {});
    const id = slugify(item.id || item.name || `monster_${idx+1}`);
    const parsedMeta = parseMonsterMeta(item);
    return {
      id,
      name: String(item.name || id),
      kind: String(item.kind || 'Normal'),
      role: String(item.role || ''),
      position: String(item.position || ''),
      row: normRow(item.row || inferRow(item.position, item.job)),
      rank: String(item.rank || 'E').toUpperCase(),
      hp: Number(item.hp || 0),
      mp: Number(item.mp || 0),
      sp: Number(item.sp || 0),
      atk: Number(item.atk || 0),
      pdef: Number(item.pdef || 0),
      mdef: Number(item.mdef || 0),
      damageType: item.damageType === 'magic' ? 'magic' : 'physical',
      attackStat: ['str','con','int','agi','sense'].includes(item.attackStat) ? item.attackStat : 'str',
      threatBase: Number(item.threatBase != null ? item.threatBase : inferThreatBase(item.position, item.row)),
      skills: Array.isArray(item.skills) ? item.skills.map(x => String(x).trim()).filter(Boolean) : splitCsv(String(item.skills || '')),
      note: String(item.note || ''),
      species: item.species || parsedMeta.species || '',
      baseElement: normElement(item.baseElement || item.element || parsedMeta.baseElement || 'none'),
      immunities: Array.isArray(item.immunities) ? item.immunities.map(normStatus).filter(Boolean) : (parsedMeta.immunities || []),
      damageTakenMods: Object.assign({}, parsedMeta.damageTakenMods || {}, item.damageTakenMods || {}),
      bonusVsBleeding: Number(item.bonusVsBleeding || parsedMeta.bonusVsBleeding || 1),
      aloneDamageTaken: Number(item.aloneDamageTaken || parsedMeta.aloneDamageTaken || 1),
      regenPct: Number(item.regenPct || parsedMeta.regenPct || 0),
      regenBlockedBy: Array.isArray(item.regenBlockedBy) ? item.regenBlockedBy.map(normStatus).filter(Boolean) : (parsedMeta.regenBlockedBy || []),
      onHitStatus: normStatus(item.onHitStatus || parsedMeta.onHitStatus || ''),
      onHitChance: Number(item.onHitChance || parsedMeta.onHitChance || 0),
      onHitTurns: Number(item.onHitTurns || parsedMeta.onHitTurns || 0),
      stats: normaliseStats(item.stats || {})
    };
  }
  function exportMonstersJsonText() {
    return JSON.stringify({ monsters: deepClone(model.db.monsters || []) }, null, 2);
  }
  async function importMonstersJsonFromText(raw) {
    const txt = String(raw || '').trim();
    if (!txt) throw new Error('붙여넣은 JSON이 비어 있다.');
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch (e) { throw new Error('JSON 파싱 실패'); }
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.monsters) ? parsed.monsters : null);
    if (!rows) throw new Error('형식이 맞지 않는다. 배열 또는 { monsters:[...] } 형식이어야 한다.');
    if (!rows.length) throw new Error('가져올 몬스터가 없다.');
    let count = 0;
    rows.forEach((row, idx) => {
      const item = normalizeImportedMonster(row, idx);
      if (!item.name) return;
      upsertById(model.db.monsters, item);
      count += 1;
    });
    ensureSelections();
    await saveDb();
    await saveState();
    renderApp();
    toast(`몬스터 ${count}개 가져오기 완료`);
  }

  function normalizeImportedMaterialTrait(raw, idx) {
    const item = deepClone(raw || {});
    const id = slugify(item.id || item.name || `rare_trait_${idx+1}`);
    const categories = ['offense','defense','status_apply','status_resist','support'];
    const scaleKeys = getRareMaterialScaleKeys();
    return {
      id,
      name: String(item.name || id),
      category: categories.includes(String(item.category || '')) ? String(item.category) : 'offense',
      scale: scaleKeys.includes(String(item.scale || '')) ? String(item.scale) : (scaleKeys[0] || 'percentSmall'),
      element: item.element ? normElement(item.element) : '',
      status: item.status ? normStatus(item.status) : '',
      note: String(item.note || item.desc || '')
    };
  }
  function normalizeImportedRareMaterialCatalogItem(raw, idx) {
    const item = deepClone(raw || {});
    const id = slugify(item.id || `${item.sourceMonsterId || 'monster'}_${item.traitId || 'trait'}_${idx+1}`);
    return {
      id,
      name: String(item.name || id),
      rank: String(item.rank || 'E').toUpperCase(),
      sourceMonsterName: String(item.sourceMonsterName || ''),
      sourceMonsterId: String(item.sourceMonsterId || ''),
      sourceKind: String(item.sourceKind || ''),
      species: String(item.species || ''),
      traitId: String(item.traitId || ''),
      traitName: String(item.traitName || ''),
      traitScale: String(item.traitScale || ''),
      traitValue: Number(item.traitValue || 0),
      traitUnit: String(item.traitUnit || '%'),
      priceTier: String(item.priceTier || ''),
      basePriceMin: Number(item.basePriceMin || 0),
      basePriceMax: Number(item.basePriceMax || 0),
      suggestedPrice: Number(item.suggestedPrice || 0),
      materialCoreName: String(item.materialCoreName || ''),
      note: String(item.note || '')
    };
  }
  function normalizeImportedNormalMaterialEntry(raw, idx) {
    const item = deepClone(raw || {});
    const id = slugify(item.id || item.sourceMonsterId || `normal_material_entry_${idx+1}`);
    return {
      id,
      sourceMonsterId: String(item.sourceMonsterId || ''),
      sourceMonsterName: String(item.sourceMonsterName || item.name || ''),
      species: String(item.species || ''),
      rank: String(item.rank || 'E').toUpperCase(),
      position: String(item.position || ''),
      row: normRow(item.row || ''),
      damageType: String(item.damageType || ''),
      basePriceMin: Number(item.basePriceMin || 0),
      basePriceMax: Number(item.basePriceMax || 0),
      dropOptions: Array.isArray(item.dropOptions) ? item.dropOptions.map((opt, j) => ({
        materialId: slugify(opt.materialId || opt.name || `mat_${idx+1}_${j+1}`),
        name: String(opt.name || opt.materialId || `재료 ${j+1}`),
        weight: Number(opt.weight || 0),
        rank: String(opt.rank || item.rank || 'E').toUpperCase(),
        suggestedPrice: Number(opt.suggestedPrice || 0)
      })) : []
    };
  }
  function exportRareTraitsJsonText() {
    const pack = getRareMaterialPack();
    return JSON.stringify({ version:pack.version || 1, note:pack.note || '', valueScales:deepClone(pack.valueScales || {}), traits:deepClone(pack.traits || []) }, null, 2);
  }
  async function importMaterialJsonFromText(raw) {
    const txt = String(raw || '').trim();
    if (!txt) throw new Error('붙여넣은 JSON이 비어 있다.');
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch (e) { throw new Error('JSON 파싱 실패'); }

    const pack = getRareMaterialPack();
    const rareCatalog = getRareMaterialCatalog();
    const normalCatalog = getNormalMaterialCatalog();

    let mode = '';
    let rows = null;

    if (Array.isArray(parsed)) {
      const first = parsed[0] || {};
      if (first && typeof first === 'object' && Array.isArray(first.dropOptions)) { mode = 'normalCatalog'; rows = parsed; }
      else if (first && typeof first === 'object' && ('traitId' in first || 'sourceMonsterName' in first || 'materialCoreName' in first)) { mode = 'rareCatalog'; rows = parsed; }
      else { mode = 'traits'; rows = parsed; }
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.traits)) {
      mode = 'traits'; rows = parsed.traits;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
      mode = 'rareCatalog'; rows = parsed.items;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
      mode = 'normalCatalog'; rows = parsed.entries;
    }

    if (!mode || !rows) throw new Error('형식이 맞지 않는다. 배열 / {traits:[...]} / {items:[...]} / {entries:[...]} 형식이어야 한다.');
    if (!rows.length) throw new Error('가져올 데이터가 없다.');

    if (mode === 'traits') {
      if (parsed && typeof parsed === 'object' && parsed.valueScales && typeof parsed.valueScales === 'object') pack.valueScales = deepClone(parsed.valueScales);
      if (parsed && typeof parsed === 'object' && parsed.version != null) pack.version = parsed.version;
      if (parsed && typeof parsed === 'object' && parsed.note != null) pack.note = String(parsed.note);
      let count = 0;
      rows.forEach((row, idx) => {
        const item = normalizeImportedMaterialTrait(row, idx);
        if (!item.name) return;
        upsertById(pack.traits, item);
        count += 1;
      });
      ensureSelections();
      await saveDb(); await saveState(); renderApp();
      toast(`희귀재료 특성 ${count}개 가져오기 완료`);
      return;
    }

    if (mode === 'rareCatalog') {
      let count = 0;
      rows.forEach((row, idx) => {
        const item = normalizeImportedRareMaterialCatalogItem(row, idx);
        if (!item.name) return;
        upsertById(rareCatalog, item);
        count += 1;
      });
      await saveDb(); await saveState(); renderApp();
      toast(`희귀재료 카탈로그 ${count}개 가져오기 완료`);
      return;
    }

    if (mode === 'normalCatalog') {
      let count = 0;
      rows.forEach((row, idx) => {
        const item = normalizeImportedNormalMaterialEntry(row, idx);
        if (!item.sourceMonsterName && !item.dropOptions.length) return;
        upsertById(normalCatalog, item);
        count += 1;
      });
      await saveDb(); await saveState(); renderApp();
      toast(`일반재료 드랍 엔트리 ${count}개 가져오기 완료`);
      return;
    }
  }
async function saveMaterialTraitFromForm() {
    const pack = getRareMaterialPack();
    const scaleKeys = getRareMaterialScaleKeys();
    const id = slugify(fieldValue('#gb-mat-id') || fieldValue('#gb-mat-name'));
    const item = {
      id,
      name: fieldValue('#gb-mat-name'),
      category: fieldValue('#gb-mat-category') || 'offense',
      scale: scaleKeys.includes(fieldValue('#gb-mat-scale')) ? fieldValue('#gb-mat-scale') : (scaleKeys[0] || 'percentSmall'),
      element: fieldValue('#gb-mat-element') ? normElement(fieldValue('#gb-mat-element')) : '',
      status: fieldValue('#gb-mat-status') ? normStatus(fieldValue('#gb-mat-status')) : '',
      note: fieldValue('#gb-mat-note') || ''
    };
    if (!item.name) throw new Error('희귀재료 특성 이름이 비어 있다.');
    upsertById(pack.traits, item);
    model.state.selected.materials = id;
    await saveDb(); await saveState(); renderApp(); toast('희귀재료 특성 저장 완료');
  }
  async function savePersonaFromForm() {
    const id = slugify(fieldValue('#gb-persona-id') || fieldValue('#gb-persona-name'));
    if (!id) throw new Error('페르소나 이름이 비어 있다.');
    const existing = getPersonaById(model.state.selected.personas) || {};
    const item = Object.assign({}, existing, {
      id,
      name: fieldValue('#gb-persona-name'),
      job: fieldValue('#gb-persona-job') || '',
      rank: fieldValue('#gb-persona-rank') || 'E',
      row: fieldValue('#gb-persona-row') || 'back',
      stats: {
        str: Number(fieldValue('#gb-persona-str') || 5),
        con: Number(fieldValue('#gb-persona-con') || 5),
        int: Number(fieldValue('#gb-persona-int') || 5),
        agi: Number(fieldValue('#gb-persona-agi') || 5),
        sense: Number(fieldValue('#gb-persona-sense') || 5),
      },
      hp: Number(fieldValue('#gb-persona-hp') || 0),
      mp: Number(fieldValue('#gb-persona-mp') || 0),
      sp: Number(fieldValue('#gb-persona-sp') || 0),
      atk: Number(fieldValue('#gb-persona-atk') || 0),
      pdef: Number(fieldValue('#gb-persona-pdef') || 0),
      mdef: Number(fieldValue('#gb-persona-mdef') || 0),
      damageType: fieldValue('#gb-persona-dmgtype') || 'magic',
      attackStat: fieldValue('#gb-persona-atkstat') || 'int',
      skills: fieldValue('#gb-persona-skills').split(',').map(s=>s.trim()).filter(Boolean),
      level: Number(fieldValue('#gb-persona-level') || 1),
      exp: Number(fieldValue('#gb-persona-exp') || 0),
      totalExp: Number(existing.totalExp || 0),
      note: fieldValue('#gb-persona-note') || '',
    });
    // HP/MP/SP가 0이면 스탯 기반 자동 계산
    if (item.hp <= 0) item.hp = 100 + (item.stats.con - 10) * 10 + (item.stats.str - 10) * 3;
    if (item.mp <= 0) item.mp = 100 + (item.stats.int - 10) * 10 + (item.stats.sense - 10) * 3;
    if (item.sp <= 0) item.sp = 100 + (item.stats.agi - 10) * 10 + (item.stats.sense - 10) * 3;
    if (!item.name) throw new Error('페르소나 이름이 비어 있다.');
    upsertById(model.db.personas, item);
    // 장착 무기 ATK를 포함하여 파생 스탯 재계산
    const saved = getPersonaById(id);
    if (saved && saved.stats) recalcCharDerivedStats(saved);
    model.state.selected.personas = id;
    await saveDb(); await saveState(); renderApp(); toast('페르소나 저장 완료');
  }
  async function saveSkillFromForm() {
    const id = slugify(fieldValue('#gb-skill-id') || fieldValue('#gb-skill-name'));
    const buffStat = fieldValue('#gb-skill-buffstat').trim();
    const buffValue = Number(fieldValue('#gb-skill-buffvalue') || 0);
    const ccType = fieldValue('#gb-skill-cctype').trim();
    const statusType = fieldValue('#gb-skill-statustype').trim();
    const item = {
      id,
      name:fieldValue('#gb-skill-name'),
      grade:fieldValue('#gb-skill-grade'),
      rarity:fieldValue('#gb-skill-rarity') || 'Normal',
      category:fieldValue('#gb-skill-category'),
      target:fieldValue('#gb-skill-target'),
      costs:{ mp:Number(fieldValue('#gb-skill-mp') || 0), sp:Number(fieldValue('#gb-skill-sp') || 0) },
      coef:Number(fieldValue('#gb-skill-coef') || 0),
      damageType:fieldValue('#gb-skill-dmgtype') || 'physical',
      element:normElement(fieldValue('#gb-skill-element') || 'none'),
      statTypes:splitCsv(fieldValue('#gb-skill-stattypes')),
      duration:Number(fieldValue('#gb-skill-duration') || 0),
      desc:fieldValue('#gb-skill-desc')
    };
    const cooldownVal = Number(fieldValue('#gb-skill-cooldown') || 0);
    if (cooldownVal > 0) item.cooldown = cooldownVal;
    const stealthEl = document.getElementById('gb-skill-stealth');
    const stealthChecked = stealthEl && stealthEl.checked;
    if (buffStat && buffValue) {
      item.buff = { stats:{ [buffStat]: buffValue } };
      if (stealthChecked) item.buff.stealth = true;
    } else if (stealthChecked) {
      item.buff = { stats:{}, stealth: true };
    }
    if (ccType) {
      const ccObj = { type:ccType, turns:Number(fieldValue('#gb-skill-ccturns') || 1) };
      const ccChanceVal = fieldValue('#gb-skill-ccchance').trim();
      if (ccChanceVal !== '') ccObj.chance = Math.max(0, Math.min(1, Number(ccChanceVal)));
      item.cc = ccObj;
    }
    if (statusType) {
      const stObj = { type:statusType, turns:Number(fieldValue('#gb-skill-statusturns') || 2) };
      const stChanceVal = fieldValue('#gb-skill-statuschance').trim();
      if (stChanceVal !== '') stObj.chance = Math.max(0, Math.min(1, Number(stChanceVal)));
      item.status = stObj;
    }
    if (!item.name) throw new Error('스킬 이름이 비어 있다.');
    upsertById(model.db.customSkills, item);
    model.state.selected.skills = id;
    await saveDb(); await saveState(); renderApp(); toast('커스텀 스킬 저장 완료');
  }

  async function saveEquipmentFromForm() {
    const id = slugify(fieldValue('#gb-eq-id') || fieldValue('#gb-eq-name'));
    if (!id) throw new Error('장비 이름 또는 ID가 비어 있다.');
    const part = fieldValue('#gb-eq-part') || 'weapon';
    const rank = fieldValue('#gb-eq-rank') || 'E';
    const enhance = Math.max(0, Math.min(EQUIP_MAX_ENHANCE[part]||0, Number(fieldValue('#gb-eq-enhance')||0)));
    const infuse = Math.max(0, Math.min(EQUIP_MAX_INFUSE[part]||1, Number(fieldValue('#gb-eq-infuse')||0)));
    const durability = Math.max(0, Math.min(100, Number(fieldValue('#gb-eq-durability')||100)));
    const priceInput = Number(fieldValue('#gb-eq-price')||0);
    const autoPrice = calcEquipEnhancedPrice(calcEquipBasePrice(rank, part), enhance, rank);
    // Add trait tier price bonus
    const traits = EQUIP_TRAIT_TYPES.filter(t => {
      const el = document.getElementById(`gb-eq-trait-${t}`);
      return el && el.checked;
    });
    let traitPriceBonus = 0;
    traits.forEach(tid => {
      traitPriceBonus += getRareMatTierPrice(rank, tid);
    });
    const price = priceInput > 0 ? priceInput : (autoPrice + traitPriceBonus);
    const item = {
      id,
      name: fieldValue('#gb-eq-name') || id,
      part,
      rank,
      enhance,
      infuse,
      durability,
      price,
      traits,
      note: fieldValue('#gb-eq-note') || '',
      atk: Number(fieldValue('#gb-eq-atk')||0),
      pdef: Number(fieldValue('#gb-eq-pdef')||0),
      mdef: Number(fieldValue('#gb-eq-mdef')||0),
      mainStat: fieldValue('#gb-eq-main-stat') || 'str',
      resistType: fieldValue('#gb-eq-resist-type') || '',
      resistPct: Number(fieldValue('#gb-eq-resist-pct')||0),
      statusType: fieldValue('#gb-eq-status-type') || '',
      statusChance: Number(fieldValue('#gb-eq-status-chance')||0),
      rarity: fieldValue('#gb-eq-rarity') || 'Normal',
      stats: { str:0, con:0, int:0, agi:0, sense:0 }
    };
    // Armor subtype
    if (part === 'armor') {
      const armorSub = fieldValue('#gb-eq-armor-subtype') || 'light';
      item.armorSubtype = armorSub;
      item.armorStatBonusMul = ARMOR_SUBTYPES[armorSub] ? ARMOR_SUBTYPES[armorSub].statBonusMul : 0;
    }
    // Special material effect
    const smeType = fieldValue('#gb-eq-sme-type');
    const smeEffect = fieldValue('#gb-eq-sme-effect');
    if (smeType && smeEffect) {
      let smeChance = Number(fieldValue('#gb-eq-sme-chance')||0);
      let smeValue = Number(fieldValue('#gb-eq-sme-value')||0);
      // Auto-fill: chance=0 → rank-based default (E:10, D:15, C:20, B:25, A:30, S:40)
      if (smeChance <= 0) {
        const defaultChance = {E:10,D:15,C:20,B:25,A:30,S:40};
        smeChance = defaultChance[rank] || 20;
      }
      // Auto-fill: value=0 → use trait scale value for current rank
      if (smeValue <= 0) {
        const traitDef = (DEFAULT_RARE_MATERIAL_PACK.traits || []).find(t => t.id === smeEffect);
        if (traitDef && traitDef.scale) {
          const scaleTable = (DEFAULT_RARE_MATERIAL_PACK.valueScales || {})[traitDef.scale];
          if (scaleTable && scaleTable[rank] != null) smeValue = scaleTable[rank];
        }
        if (smeValue <= 0) {
          const fallback = (DEFAULT_RARE_MATERIAL_PACK.valueScales.percentSmall || {})[rank] || 3;
          smeValue = fallback;
        }
      }
      item.specialEffect = {
        type: smeType,
        effectId: smeEffect,
        chance: Math.max(0, Math.min(100, smeChance)),
        value: smeValue
      };
      // Auto-set rarity to Rare when special effect is present on weapon/armor
      if ((part === 'weapon' || part === 'armor') && (item.rarity === 'Normal' || !item.rarity)) {
        item.rarity = 'Rare';
      }
    } else {
      item.specialEffect = null;
    }
    // maxInfuse 자동 설정 (특수효과는 주입이 아님)
    item.maxInfuse = EQUIP_MAX_INFUSE[part] || 1;
    if (!Array.isArray(model.db.equipments)) model.db.equipments = [];
    upsertById(model.db.equipments, item);
    model.state.selected.equipment = id;
    await saveDb(); await saveState(); renderApp(); toast('장비 저장 완료');
  }

  async function deleteSelected(type) {
    const sel = model.state.selected[type];
    if (!sel) return;
    if (type === 'characters') model.db.characters = model.db.characters.filter(x => x.id !== sel);
    if (type === 'monsters') model.db.monsters = model.db.monsters.filter(x => x.id !== sel);
    if (type === 'personas') model.db.personas = model.db.personas.filter(x => x.id !== sel);
    if (type === 'skills') model.db.customSkills = model.db.customSkills.filter(x => x.id !== sel);
    if (type === 'materials') getRareMaterialPack().traits = getRareMaterialPack().traits.filter(x => x.id !== sel);
    if (type === 'equipment') { if (!Array.isArray(model.db.equipments)) model.db.equipments = []; model.db.equipments = model.db.equipments.filter(x => x.id !== sel); }
    model.state.selected[type] = '';
    ensureSelections();
    await saveDb(); await saveState(); renderApp(); toast('삭제 완료');
  }

  function bindUI() {
    const root = model.root;
    if (!root) return;
    const on = (selector, event, handler) => {
      const els = root.querySelectorAll(selector);
      els.forEach(el => el.addEventListener(event, handler));
    };

    on('#gb-close-ui', 'click', async () => {
      model.state.visible = false;
      await lsSet(KEY_VISIBLE, 'false');
      if (_hasRisu && Risuai.hideContainer) await Risuai.hideContainer();
      renderApp();
    });
    on('[data-go]', 'click', async (ev) => {
      const target = ev.currentTarget.getAttribute('data-go');
      // 게이트 진행 중에는 gate/battle/party/hub 외 다른 화면 이동 차단
      if (activeGateRun()) {
        const allowed = ['gate', 'battle', 'party', 'hub'];
        if (!allowed.includes(target)) {
          alert('⚠️ 게이트 진행 중에는 다른 화면으로 이동할 수 없습니다. 후퇴하거나 클리어 후 이용해 주세요.');
          return;
        }
      }
      model.state.view = target;
      await saveState();
      renderApp();
    });
    // ── 데이터 관리 핸들러 (내보내기/불러오기/삭제) ────────────────────────────
    on('#gb-data-export', 'click', () => {
      try {
        const exportData = {
          _exportVersion: 'GateBattleV21',
          _exportDate: new Date().toISOString(),
          db: deepClone(model.db),
          state: deepClone(model.state)
        };
        // runtime은 전투 중 임시 데이터이므로 제거
        delete exportData.state.runtime;
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.href = url;
        a.download = `hunter-world-save-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('💾 데이터를 파일로 내보냈습니다.');
      } catch (e) { toast('내보내기 실패: ' + (e.message || String(e)), true); }
    });
    on('#gb-data-import', 'click', () => {
      const fileInput = root.querySelector('#gb-data-import-file');
      if (fileInput) fileInput.click();
    });
    on('#gb-data-import-file', 'change', async (ev) => {
      try {
        const file = ev.currentTarget.files && ev.currentTarget.files[0];
        if (!file) return;
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!imported || typeof imported !== 'object' || !imported.db) {
          throw new Error('유효하지 않은 저장 파일입니다. (db 키가 없음)');
        }
        if (!confirm('⚠️ 현재 데이터를 불러온 데이터로 덮어씁니다.\n기존 데이터가 모두 교체됩니다.\n\n계속하시겠습니까?')) return;
        model.db = Object.assign(buildDefaultDb(), imported.db);
        if (imported.state && typeof imported.state === 'object') {
          const next = buildDefaultState();
          model.state = Object.assign(next, imported.state);
          model.state.runtime = buildDefaultRuntime();
          model.state.gate = Object.assign(buildDefaultGateState(), imported.state.gate || {});
          if (model.state.gate && model.state.gate.run && typeof model.state.gate.run === 'object') {
            if (model.state.gate.run.elapsedMinutes == null) model.state.gate.run.elapsedMinutes = 0;
            if (!('postBattle' in model.state.gate.run)) model.state.gate.run.postBattle = null;
            if (model.state.gate.run.partyStartCount == null) model.state.gate.run.partyStartCount = Array.isArray(model.state.gate.run.partyState) ? model.state.gate.run.partyState.length : 0;
            if (!model.state.gate.run.campSupplies) model.state.gate.run.campSupplies = { used:false, legacyMigrated:false };
            ensureGateLogContainers(model.state.gate.run);
          }
        }
        model.state.visible = true;
        getInventory();
        if (!Array.isArray(model.db.auctionListings)) model.db.auctionListings = [];
        if (!Array.isArray(model.db.hmUsedListings)) model.db.hmUsedListings = [];
        // 불러온 캐릭터/페르소나의 파생 스탯을 현재 공식으로 재계산
        (model.db.characters || []).forEach(c => { if (c.stats) recalcCharDerivedStats(c); });
        (model.db.personas || []).forEach(p => { if (p.stats) recalcCharDerivedStats(p); });
        ensureSelections();
        await saveDb();
        await saveState();
        toast('✅ 데이터를 성공적으로 불러왔습니다!');
        renderApp();
      } catch (e) { toast('불러오기 실패: ' + (e.message || String(e)), true); }
      ev.currentTarget.value = '';
    });
    on('#gb-data-clear', 'click', async () => {
      if (!confirm('⚠️ 정말로 모든 저장 데이터를 삭제하시겠습니까?\n캐릭터, 장비, 인벤토리, 게이트 진행 등 모든 데이터가 초기화됩니다.\n\n이 작업은 되돌릴 수 없습니다!')) return;
      if (!confirm('🔴 최종 확인: 정말 삭제하시겠습니까?')) return;
      model.db = buildDefaultDb();
      model.state = buildDefaultState();
      model.state.visible = true;
      await saveDb();
      await saveState();
      toast('🗑️ 모든 데이터가 초기화되었습니다.');
      renderApp();
    });
    // ── 날짜 시스템 핸들러 ─────────────────────────────────────────────────────
    on('#gb-date-year', 'change', async (ev) => {
      if (!model.db.gameDate) model.db.gameDate = { year:2026, month:1, day:1 };
      model.db.gameDate.year = Math.max(1, Number(ev.currentTarget.value) || 2026);
      await saveDb(); renderApp();
    });
    on('#gb-date-month', 'change', async (ev) => {
      if (!model.db.gameDate) model.db.gameDate = { year:2026, month:1, day:1 };
      model.db.gameDate.month = Math.max(1, Math.min(12, Number(ev.currentTarget.value) || 1));
      await saveDb(); renderApp();
    });
    on('#gb-date-day', 'change', async (ev) => {
      if (!model.db.gameDate) model.db.gameDate = { year:2026, month:1, day:1 };
      model.db.gameDate.day = Math.max(1, Math.min(31, Number(ev.currentTarget.value) || 1));
      await saveDb(); renderApp();
    });
    on('#gb-date-next', 'click', async () => {
      if (!model.db.gameDate) model.db.gameDate = { year:2026, month:1, day:1 };
      const gd = model.db.gameDate;
      const d = new Date(gd.year, gd.month - 1, gd.day);
      d.setDate(d.getDate() + 1);
      gd.year = d.getFullYear();
      gd.month = d.getMonth() + 1;
      gd.day = d.getDate();
      // 날짜 변경 시 전멸 상태 자동 해제 (당일 제한만 적용)
      model.db.lastWipeDate = null;
      // Process rent evictions
      const evictMsgs = processRentOnDateAdvance(gd);
      await saveDb(); renderApp();
      for (const msg of evictMsgs) toast(msg, true);
    });
    // ── 캐릭터 선택 핸들러 ────────────────────────────────────────────────────
    on('#gb-active-char', 'change', async (ev) => {
      model.state.activeCharId = ev.currentTarget.value || '';
      await saveState(); renderApp();
    });
    // ── 팀 핸들러 ────────────────────────────────────────────────────────────────
    on('#gb-team-add-btn', 'click', async () => {
      const sel = document.getElementById('gb-team-add-sel');
      const charId = sel ? sel.value : '';
      if (!charId) { toast('추가할 인물을 선택하라.', true); return; }
      if (!Array.isArray(model.db.team)) model.db.team = [];
      if (model.db.team.find(m => m.charId === charId)) { toast('이미 팀에 있다.', true); return; }
      const n = model.db.team.length;
      const ratio = n === 0 ? 100 : Math.floor(100 / (n + 1));
      model.db.team.push({ charId, ratio });
      // 비율 균등화
      if (n > 0) {
        const each = Math.floor(100 / model.db.team.length);
        model.db.team.forEach(m => { m.ratio = each; });
        model.db.team[0].ratio += 100 - each * model.db.team.length;
      }
      syncTeamToPartySlots();
      await saveDb(); renderApp();
    });
    on('#gb-team-add-shared', 'click', async () => {
      if (!Array.isArray(model.db.team)) model.db.team = [];
      if (model.db.team.find(m => m.charId === '__shared__')) { toast('공용 인벤은 이미 팀에 있다.', true); return; }
      const n = model.db.team.length;
      model.db.team.push({ charId: '__shared__', ratio: n === 0 ? 100 : Math.floor(100 / (n + 1)) });
      if (n > 0) {
        const each = Math.floor(100 / model.db.team.length);
        model.db.team.forEach(m => { m.ratio = each; });
        model.db.team[0].ratio += 100 - each * model.db.team.length;
      }
      syncTeamToPartySlots();
      await saveDb(); renderApp();
    });
    on('[data-team-remove]', 'click', async (ev) => {
      const idx = parseInt(ev.currentTarget.getAttribute('data-team-remove') || '-1', 10);
      if (!Array.isArray(model.db.team) || idx < 0) return;
      model.db.team.splice(idx, 1);
      syncTeamToPartySlots();
      await saveDb(); renderApp();
    });
    on('[data-team-ratio]', 'input', async (ev) => {
      const idx = parseInt(ev.currentTarget.getAttribute('data-team-ratio') || '-1', 10);
      if (!Array.isArray(model.db.team) || idx < 0) return;
      model.db.team[idx].ratio = Math.max(0, Math.min(100, parseInt(ev.currentTarget.value || '0', 10)));
      await saveDb();
    });
    // ── Association handlers ──────────────────────────────────────────────────
    on('[data-assoc-floor]', 'click', async (ev) => {
      model.state.assocFloor = ev.currentTarget.getAttribute('data-assoc-floor') || '1F';
      await saveState(); renderApp();
    });
    // ── 경매장 핸들러 ──────────────────────────────────────────────────────────────
    on('[data-auction-tab]', 'click', async (ev) => {
      model.state.auctionTab = ev.currentTarget.getAttribute('data-auction-tab') || 'browse';
      model.state.auctionSellSel = '';
      model.state.auctionBid = null;
      model.state.auctionSell = null;
      await saveState(); renderApp();
    });
    on('[data-auction-browse-type]', 'click', async (ev) => {
      model.state.auctionBrowseType = ev.currentTarget.getAttribute('data-auction-browse-type') || 'equip';
      await saveState(); renderApp();
    });
    on('[data-buy-manastone]', 'click', async (ev) => {
      const rank = ev.currentTarget.getAttribute('data-buy-manastone');
      const purity = Number(ev.currentTarget.getAttribute('data-ms-purity') || 95);
      const price = Number(ev.currentTarget.getAttribute('data-ms-price') || 0);
      const inv = getActiveInventory();
      if (Number(inv.gold || 0) < price) { toast('소지금 부족!'); return; }
      inv.gold = Number(inv.gold || 0) - price;
      const stoneId = `mana_${rank}_${purity}`;
      const label = (MANA_STONE_LABELS[rank] || (rank + ' 마정석')) + '(' + purity + ')';
      const existing = (inv.items || []).find(it => it.id === stoneId && it.category === 'manaStone');
      if (existing) {
        existing.count = (existing.count || 1) + 1;
      } else {
        if (!inv.items) inv.items = [];
        inv.items.push({ id: stoneId, name: label, category: 'manaStone', rank, count: 1, unitWeightG: manaStoneUnitWeight(String(purity)), stackable: true, note: String(purity) });
      }
      toast(`💎 ${label} 구매 완료! (-₩${price.toLocaleString('en-US')})`);
      await saveDb(); renderApp();
    });
    on('[data-auction-bid-raremat]', 'click', async (ev) => {
      const listingId = ev.currentTarget.getAttribute('data-auction-bid-raremat');
      const mktPrice = Number(ev.currentTarget.getAttribute('data-auction-bid-mkt') || 0);
      const inv = getActiveInventory();
      const startRatio = AUCTION_BUY_START_RATIO;
      const startPrice = Math.round(mktPrice * startRatio);
      if (Number(inv.gold || 0) < startPrice) { toast('소지금 부족! 최소 시작가: ₩' + startPrice.toLocaleString('en-US')); return; }
      model.state.auctionBid = { listingId, marketPrice: mktPrice, currentRatio: startRatio, step: 0, log: [`[경매 시작] 시장가: ₩${mktPrice.toLocaleString('en-US')} | 시작가: 시장가 ${Math.round(startRatio*100)}% = ₩${startPrice.toLocaleString('en-US')}`], done: false, isRareMat: true };
      await saveState(); renderApp();
    });
    on('[data-auction-rank]', 'click', async (ev) => {
      model.state.auctionRankFilter = ev.currentTarget.getAttribute('data-auction-rank') || '';
      await saveState(); renderApp();
    });
    on('[data-auction-refresh]', 'click', async () => {
      // 하루 3회 제한
      const today = new Date().toISOString().slice(0, 10);
      if (!model.state.auctionRefreshDate || model.state.auctionRefreshDate !== today) {
        model.state.auctionRefreshDate = today;
        model.state.auctionRefreshCount = 0;
      }
      if ((model.state.auctionRefreshCount || 0) >= 3) {
        toast('⚠️ 오늘 새로고침 횟수를 모두 사용했습니다 (3/3)');
        return;
      }
      model.state.auctionRefreshCount = (model.state.auctionRefreshCount || 0) + 1;
      if (!Array.isArray(model.db.auctionListings)) model.db.auctionListings = [];
      model.db.auctionListings = model.db.auctionListings.filter(l => !l.isNpc);
      if (!Array.isArray(model.db.auctionRareMats)) model.db.auctionRareMats = [];
      model.db.auctionRareMats = model.db.auctionRareMats.filter(l => !l.isNpc);
      seedNpcAuctionListings();
      await saveDb(); await saveState(); renderApp();
      toast(`🔄 NPC 경매 목록 갱신 완료 (${model.state.auctionRefreshCount}/3)`);
    });
    // 검색박스 입력 — 한글 IME 조합 중에는 리렌더 방지
    let auctionSearchComposing = false;
    on('#gb-auction-search', 'compositionstart', () => { auctionSearchComposing = true; });
    on('#gb-auction-search', 'compositionend', async (ev) => {
      auctionSearchComposing = false;
      model.state.auctionSearchQ = ev.currentTarget.value || '';
      const cursorPos = ev.currentTarget.selectionStart;
      await saveState(); renderApp();
      const searchEl = root.querySelector('#gb-auction-search');
      if (searchEl) { searchEl.focus(); searchEl.setSelectionRange(cursorPos, cursorPos); }
    });
    on('#gb-auction-search', 'input', async (ev) => {
      if (auctionSearchComposing) return; // IME 조합 중 리렌더 스킵
      model.state.auctionSearchQ = ev.currentTarget.value || '';
      const cursorPos = ev.currentTarget.selectionStart;
      await saveState(); renderApp();
      // 포커스 복원: renderApp() 후 검색 인풋에 포커스 + 커서 위치 복원
      const searchEl = root.querySelector('#gb-auction-search');
      if (searchEl) { searchEl.focus(); searchEl.setSelectionRange(cursorPos, cursorPos); }
    });
    // 구매 경매 참여 — 단계별 인터랙티브 입찰 시작
    on('[data-auction-bid]', 'click', async (ev) => {
      try {
        const auctionId = ev.currentTarget.getAttribute('data-auction-bid') || '';
        const mktPrice = Number(ev.currentTarget.getAttribute('data-auction-bid-mkt') || '0');
        if (!Array.isArray(model.db.auctionListings)) throw new Error('경매 목록이 없다.');
        const listing = model.db.auctionListings.find(l => l.id === auctionId);
        if (!listing) throw new Error('해당 경매 물품을 찾을 수 없다.');
        const actualMkt = mktPrice || listing.marketPrice || listing.askPrice;
        const startRatio = AUCTION_PRICE_MIN_RATIO; // 85%
        model.state.auctionBid = {
          listingId: auctionId,
          marketPrice: actualMkt,
          currentRatio: startRatio,
          pendingCompetitor: null,
          pendingRatio: null,
          log: [`[경매 참여] <strong>${escapeHtml(listing.item.name||listing.item.id)}</strong> — 시작가 시장가 ${Math.round(startRatio*100)}% (${Math.round(actualMkt*startRatio).toLocaleString('en-US')}원)`],
          won: false,
          finalPrice: null,
          done: false
        };
        await saveState(); renderApp();
      } catch(e) { toast(e.message || String(e), true); }
    });
    // 구매 경매 입찰 확정 (내 턴에서 입찰하기 버튼)
    on('[data-auction-place-bid]', 'click', async () => {
      try {
        const bidState = model.state.auctionBid;
        if (!bidState) throw new Error('경매 데이터가 없다.');
        const inv = getActiveInventory();
        const myPrice = Math.round(bidState.marketPrice * bidState.currentRatio);
        if (Number(inv.gold||0) < myPrice) throw new Error(`소지금 부족 (${getActiveLabel()}: 필요 ${myPrice.toLocaleString('en-US')}원)`);
        bidState.log.push(`[내 입찰] 시장가 ${Math.round(bidState.currentRatio*100)}% = ${myPrice.toLocaleString('en-US')}원`);
        // 경쟁자 판정
        const comp = rollBuyCompetitor(bidState.currentRatio, (bidState.log||[]).length);
        if (comp) {
          bidState.pendingCompetitor = comp.name;
          bidState.pendingRatio = comp.ratio;
          bidState.log.push(`[경쟁자 등장] <em>${escapeHtml(comp.name)}</em>이(가) ${Math.round(comp.ratio*100)}% (${Math.round(bidState.marketPrice*comp.ratio).toLocaleString('en-US')}원)에 입찰!`);
        } else {
          // 낙찰
          bidState.won = true;
          bidState.finalPrice = myPrice;
          bidState.log.push(`[🏆 낙찰] 경쟁자 없음. 시장가 ${Math.round(bidState.currentRatio*100)}% = ${myPrice.toLocaleString('en-US')}원에 낙찰!`);
        }
        await saveState(); renderApp();
      } catch(e) { toast(e.message || String(e), true); }
    });
    // 구매 경매 재입찰 (경쟁자 등장 후)
    on('[data-auction-rebid]', 'click', async () => {
      try {
        const bidState = model.state.auctionBid;
        if (!bidState || !bidState.pendingRatio) throw new Error('재입찰 데이터가 없다.');
        const inv = getActiveInventory();
        const newPrice = Math.round(bidState.marketPrice * bidState.pendingRatio);
        if (Number(inv.gold||0) < newPrice) throw new Error(`소지금 부족 (${getActiveLabel()}: 필요 ${newPrice.toLocaleString('en-US')}원)`);
        bidState.currentRatio = bidState.pendingRatio;
        bidState.pendingCompetitor = null;
        bidState.pendingRatio = null;
        bidState.log.push(`[재입찰] 시장가 ${Math.round(bidState.currentRatio*100)}% = ${newPrice.toLocaleString('en-US')}원`);
        // 경쟁자 재판정
        const comp = rollBuyCompetitor(bidState.currentRatio, (bidState.log||[]).length);
        if (comp) {
          bidState.pendingCompetitor = comp.name;
          bidState.pendingRatio = comp.ratio;
          bidState.log.push(`[경쟁자 등장] <em>${escapeHtml(comp.name)}</em>이(가) ${Math.round(comp.ratio*100)}% (${Math.round(bidState.marketPrice*comp.ratio).toLocaleString('en-US')}원)에 입찰!`);
        } else {
          bidState.won = true;
          bidState.finalPrice = newPrice;
          bidState.log.push(`[🏆 낙찰] 경쟁자 없음. 시장가 ${Math.round(bidState.currentRatio*100)}% = ${newPrice.toLocaleString('en-US')}원에 낙찰!`);
        }
        await saveState(); renderApp();
      } catch(e) { toast(e.message || String(e), true); }
    });
    // 구매 경매 낙찰 확정
    on('[data-auction-confirm]', 'click', async () => {
      try {
        const bidState = model.state.auctionBid;
        if (!bidState) throw new Error('경매 데이터가 없다.');
        const auctionId = bidState.listingId;
        // 희귀재료 경매인지 장비 경매인지 구분
        const listArr = bidState.isRareMat ? (model.db.auctionRareMats || []) : (model.db.auctionListings || []);
        if (!Array.isArray(listArr)) throw new Error('경매 목록이 없다.');
        const idx = listArr.findIndex(l => l.id === auctionId);
        if (idx < 0) throw new Error('해당 경매 물품이 이미 없다. (다른 사람이 낙찰)');
        const listing = listArr[idx];
        const inv = getActiveInventory();
        if (Number(inv.gold||0) < bidState.finalPrice) throw new Error(`소지금 부족 (${getActiveLabel()}: 필요 ${bidState.finalPrice.toLocaleString('en-US')}원)`);
        inv.gold = Number(inv.gold||0) - bidState.finalPrice;
        const buyItem = deepClone(listing.item);
        if (buyItem.category === 'equipment') {
          buyItem.stackable = false;
          buyItem.stackKey = `equipment:auction_${auctionId}_${Date.now()}`;
          buyItem.isUsed = false;
          buyItem.durability = 100;
          buyItem.maxDurability = 100;
          if (!buyItem.unitWeightG) buyItem.unitWeightG = EQUIP_WEIGHT_G[buyItem.part] || 1000;
        }
        grantActiveInventoryItem(buyItem);
        listArr.splice(idx, 1);
        model.state.auctionBid = null;
        await saveDb(); await saveState(); renderApp();
        const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억원` : n >= 10000 ? `${Math.round(n/10000)}만원` : `${n.toLocaleString('en-US')}원`;
        toast(`🏷️ ${buyItem.name} 낙찰! (-${fmt(bidState.finalPrice)})`);
      } catch(e) { toast(e.message || String(e), true); }
    });
    // 구매 경매 포기
    on('[data-auction-bid-cancel]', 'click', async () => {
      model.state.auctionBid = null;
      await saveState(); renderApp();
    });
    // 판매 아이템 선택
    on('[data-auction-sell-sel]', 'click', async (ev) => {
      model.state.auctionSellSel = ev.currentTarget.getAttribute('data-auction-sell-sel') || '';
      await saveState(); renderApp();
    });
    // 판매 경매 시작 — 3초 간격 단계별 공개
    on('[data-auction-sell-start]', 'click', async (ev) => {
      try {
        const ikey = ev.currentTarget.getAttribute('data-auction-sell-start') || '';
        const mktPrice = Number(ev.currentTarget.getAttribute('data-auction-sell-mkt') || '0');
        if (!mktPrice) throw new Error('시장가 정보가 없다.');
        const inv = getInventory();
        const it = (inv.items||[]).find(x => inventoryItemKey(x) === ikey);
        if (!it) throw new Error('등록할 아이템을 찾을 수 없다.');
        // 인벤에서 제거 후 경매 진행
        removeInventoryItem(ikey, 'one');
        const sim = simulateSellAuction(mktPrice);
        model.state.auctionSell = {
          itemKey: ikey,
          itemName: it.name || it.id,
          marketPrice: mktPrice,
          fullLog: sim.fullLog,
          revealedCount: 1, // 첫 항목만 즉시 표시
          finalRatio: sim.finalRatio,
          finalPrice: sim.finalPrice,
          done: false
        };
        model.state.auctionSellSel = '';
        await saveDb(); await saveState(); renderApp();
        // 3초 간격으로 로그 공개
        _startSellAuctionTimer();
      } catch(e) { toast(e.message || String(e), true); }
    });
    // 판매 경매 완료 확인 — 골드 지급
    on('[data-auction-sell-confirm]', 'click', async () => {
      try {
        const sellState = model.state.auctionSell;
        if (!sellState) throw new Error('판매 경매 데이터가 없다.');
        const inv = getInventory();
        inv.gold = Number(inv.gold||0) + sellState.finalPrice;
        model.state.auctionSell = null;
        await saveDb(); await saveState(); renderApp();
        const fmt = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억원` : n >= 10000 ? `${Math.round(n/10000)}만원` : `${n.toLocaleString('en-US')}원`;
        toast(`💰 ${escapeHtml(sellState.itemName)} 판매 완료! +${fmt(sellState.finalPrice)}`);
      } catch(e) { toast(e.message || String(e), true); }
    });
    // 경매 등록 취소 (플레이어가 등록한 물품)
    on('[data-auction-cancel]', 'click', async (ev) => {
      try {
        const auctionId = ev.currentTarget.getAttribute('data-auction-cancel') || '';
        if (!Array.isArray(model.db.auctionListings)) throw new Error('경매 목록이 없다.');
        const idx = model.db.auctionListings.findIndex(l => l.id === auctionId && !l.isNpc);
        if (idx < 0) throw new Error('내 경매 물품을 찾을 수 없다.');
        const listing = model.db.auctionListings[idx];
        const retItem = deepClone(listing.item);
        model.db.auctionListings.splice(idx, 1);
        grantInventoryItem(retItem);
        await saveDb(); await saveState(); renderApp();
        toast(`↩️ ${retItem.name} 경매 취소 완료. 아이템 반환됨.`);
      } catch(e) { toast(e.message || String(e), true); }
    });
    on('#gb-settle-calc', 'click', async () => {
      try {
        const st = model.state;
        st.settleType       = fieldValue('#gb-settle-type')      || 'association';
        st.settleGuildPct   = fieldValue('#gb-settle-guild-pct') || '40';
        st.settleDate       = fieldValue('#gb-settle-date')      || '';
        const manualParty = fieldValue('#gb-settle-party-manual');
        if (manualParty) st.settlePartyCount = manualParty;
        const teamSize = Array.isArray(model.db.team) ? model.db.team.length : 0;
        if (teamSize > 0) st.settlePartyCount = String(teamSize);
        await saveState(); renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-settle-apply', 'click', async () => {
      try {
        const st = model.state;
        st.settleType       = fieldValue('#gb-settle-type')      || 'association';
        st.settleGuildPct   = fieldValue('#gb-settle-guild-pct') || '40';
        st.settleDate       = fieldValue('#gb-settle-date')      || '';
        const manualParty = fieldValue('#gb-settle-party-manual');
        if (manualParty) st.settlePartyCount = manualParty;
        const teamSize = Array.isArray(model.db.team) ? model.db.team.length : 0;
        if (teamSize > 0) st.settlePartyCount = String(teamSize);
        const gs = gateStateSafe();
        if (gs.run) {
          const result = buildSettlementSheet(gs.run, st);
          toast(`✅ 설정 저장됨. 정산 계산 완료 — 최종 개인 지급액: ₩${formatWon(result.final)}`);
        } else {
          toast(`✅ 정산 설정 저장됨 (${st.settleType === 'guild' ? '길드 정산' : '협회 정산'})`);
        }
        await saveState(); renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-assoc-settle', 'click', async () => {
      try {
        const gs = gateStateSafe();
        if (!gs.run) throw new Error('정산할 게이트 공략이 없다.');
        const st = model.state;
        const dateVal = (fieldValue('#gb-settle-date') || st.settleDate || '').trim();
        const result = buildSettlementSheet(gs.run, st);
        const runTitle = gs.run.title || '게이트';
        const goldGain = result ? result.final : 0;
        if (goldGain > 0) {
          const inv = getInventory();
          inv.gold = (Number(inv.gold || 0)) + goldGain;
        }
        // Write income log entry
        if (!Array.isArray(model.db.incomeLog)) model.db.incomeLog = [];
        const isGuildSettle = (st.settleType || 'association') === 'guild';
        const guildName = isGuildSettle
          ? (model.db.guildId === 'custom'
              ? (model.db.customGuildName || '내 길드')
              : ((PRESET_GUILDS.find(g => g.id === model.db.guildId) || {}).name || '길드'))
          : '';
        model.db.incomeLog.push({
          date:       dateVal || '날짜 미입력',
          runTitle:   runTitle,
          gross:      result ? result.subtotal : 0,
          fee:        result ? result.fee : 0,
          corpTax:    isGuildSettle ? (result ? result.fee : 0) : 0,
          net:        result ? result.net : 0,
          perPerson:  result ? result.perPerson : 0,
          guildShare: result ? (result.guildShare || 0) : 0,
          final:      goldGain,
          type:       isGuildSettle ? 'guild' : 'association',
          guildName:  guildName,
        });
        // Write guild tax log for guild settlements
        if (isGuildSettle) {
          if (!Array.isArray(model.db.guildTaxLog)) model.db.guildTaxLog = [];
          model.db.guildTaxLog.push({
            date:       dateVal || '날짜 미입력',
            runTitle:   runTitle,
            gross:      result ? result.subtotal : 0,
            corpTax:    result ? result.fee : 0,
            net:        result ? result.net : 0,
            guildShare: result ? (result.guildShare || 0) : 0,
            members:    Number(st.settlePartyCount || '1'),
          });
        }
        gs.run = null;
        await saveDb(); await saveState(); renderApp();
        toast(`${runTitle} 정산 완료 — ₩${formatWon(goldGain)} 획득. 새 게이트를 진행할 수 있다.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-income-log-del]', 'click', async (ev) => {
      try {
        const idx = parseInt(ev.currentTarget.getAttribute('data-income-log-del') || '-1', 10);
        if (idx < 0) return;
        if (!Array.isArray(model.db.incomeLog)) return;
        model.db.incomeLog.splice(idx, 1);
        await saveDb(); renderApp();
        toast('소득 기록 삭제 완료');
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── 아이템 직접 판매 핸들러 ──────────────────────────────────────────────
    on('[data-settle-item-sel]', 'change', async (ev) => {
      const key = ev.currentTarget.getAttribute('data-settle-item-sel') || '';
      if (!key) return;
      if (!model.state.settleItemSel) model.state.settleItemSel = {};
      model.state.settleItemSel[key] = ev.currentTarget.checked;
      // 정산 방식/날짜도 함께 저장
      model.state.settleType = fieldValue('#gb-settle-type') || model.state.settleType || 'association';
      model.state.settleDate = fieldValue('#gb-settle-date') || model.state.settleDate || '';
      const manualParty = fieldValue('#gb-settle-party-manual');
      if (manualParty) model.state.settlePartyCount = manualParty;
      await saveState(); renderApp();
    });
    on('#gb-settle-item-sel-all', 'click', async () => {
      const inv = getInventory();
      if (!model.state.settleItemSel) model.state.settleItemSel = {};
      (inv.items||[]).forEach(it => {
        const k = inventoryItemKey(it);
        if (it.category === 'equipment') {
          // 중고 장비 제외 (협회 판매 불가)
          const isUsed = it.isUsed || Number(it.maxDurability ?? 100) < 100 || Number(it.durability ?? 100) < Number(it.maxDurability ?? 100);
          if (!isUsed) model.state.settleItemSel[k] = true;
        } else if (['rareMaterial','normalMaterial','manaStone'].includes(it.category)) {
          model.state.settleItemSel[k] = true;
        }
      });
      await saveState(); renderApp();
    });
    on('#gb-settle-item-sel-none', 'click', async () => {
      model.state.settleItemSel = {};
      await saveState(); renderApp();
    });
    on('#gb-direct-sell-single', 'click', async () => {
      try {
        const inv = getInventory();
        const sel = model.state.settleItemSel || {};
        const isGuild = (model.state.settleType||'association') === 'guild';
        const dateVal = (fieldValue('#gb-settle-date') || model.state.settleDate || '').trim();
        const fmtS = n => { const v = Math.floor((n||0) / 10) * 10; return v >= 1e8 ? `${(v/1e8).toFixed(2)}억원` : `${v.toLocaleString('en-US')}원`; };
        let total = 0;
        const toRemove = [];
        (inv.items||[]).forEach(it => {
          const key = inventoryItemKey(it);
          if (!sel[key]) return;
          const price = calcInventorySellPrice(it, isGuild);
          total += price;
          toRemove.push(key);
        });
        if (toRemove.length === 0) { toast('판매할 아이템을 선택하라.', true); return; }
        toRemove.forEach(k => removeInventoryItem(k, 'all'));
        // 5% 수수료 적용
        const fee = Math.floor(total * 0.05);
        const net = total - fee;
        inv.gold = Number(inv.gold||0) + net;
        model.state.settleItemSel = {};
        // 소득 기록 — 첫 번째 페르소나 이름으로 기록
        if (!Array.isArray(model.db.incomeLog)) model.db.incomeLog = [];
        const _firstP = (model.db.personas || [])[0];
        const _participantName = _firstP ? (_firstP.name || _firstP.id) : '공용 인벤';
        model.db.incomeLog.push({ date: dateVal||'날짜 미입력', runTitle: '직접 판매', gross: total, fee, net, perPerson: net, final: net, type: isGuild ? 'guild' : 'association', participant: _participantName });
        await saveDb(); await saveState(); renderApp();
        toast(`💰 ${toRemove.length}개 아이템 판매 완료 (세전 ${fmtS(total)} → 수수료 5% 차감 후 ${fmtS(net)})`);
      } catch(e) { toast(e.message || String(e), true); }
    });
    on('#gb-direct-sell-team', 'click', async () => {
      try {
        const inv = getInventory();
        const sel = model.state.settleItemSel || {};
        const isGuild = (model.state.settleType||'association') === 'guild';
        const dateVal = (fieldValue('#gb-settle-date') || model.state.settleDate || '').trim();
        const team = Array.isArray(model.db.team) ? model.db.team : [];
        const totalRatio = team.reduce((s, m) => s + Number(m.ratio||10), 0);
        if (team.length === 0) { toast('팀이 없다. 허브에서 팀을 구성하라.', true); return; }
        if (totalRatio !== 100) { toast(`팀 비율 합계가 ${totalRatio}%다. 100%가 되어야 한다.`, true); return; }
        const fmtS = n => { const v = Math.floor((n||0) / 10) * 10; return v >= 1e8 ? `${(v/1e8).toFixed(2)}억원` : `${v.toLocaleString('en-US')}원`; };
        let total = 0;
        const toRemove = [];
        (inv.items||[]).forEach(it => {
          const key = inventoryItemKey(it);
          if (!sel[key]) return;
          total += calcInventorySellPrice(it, isGuild);
          toRemove.push(key);
        });
        if (toRemove.length === 0) { toast('판매할 아이템을 선택하라.', true); return; }
        toRemove.forEach(k => removeInventoryItem(k, 'all'));
        // 5% 수수료 적용
        const fee = Math.floor(total * 0.05);
        const netTotal = total - fee;
        const lines = [];
        for (const m of team) {
          const share = Math.floor(netTotal * (m.ratio||10) / 100);
          const allChars = model.db.characters || [];
          const allPersonas = model.db.personas || [];
          const char = allChars.find(c => c.id === m.charId) || allPersonas.find(p => p.id === m.charId);
          const charName = m.charId === '__shared__' ? '공용 인벤' : (char ? (char.name||m.charId) : m.charId);
          if (m.charId === '__shared__') {
            inv.gold = Number(inv.gold||0) + share;
          } else if (char) {
            if (!char.inventory) char.inventory = { items: [], equipped: { weapon:null, armor:null, subweapon:null, accessory:null, bag:null } };
            char.inventory.gold = (Number(char.inventory.gold||0)) + share;
          } else {
            inv.gold = Number(inv.gold||0) + share;
          }
          lines.push(`${charName}: +${fmtS(share)}`);
        }
        // 소득 기록 — 페르소나 목록 첫 번째 1명만 기록 (팀 전체 분배 합산)
        if (!Array.isArray(model.db.incomeLog)) model.db.incomeLog = [];
        const _firstPersona = (model.db.personas || [])[0];
        const _firstPersonaName = _firstPersona ? (_firstPersona.name || _firstPersona.id) : '공용 인벤';
        model.db.incomeLog.push({ date: dateVal||'날짜 미입력', runTitle: '직접 판매 (팀 분배)', gross: total, fee, net: netTotal, perPerson: netTotal, final: netTotal, type: isGuild?'guild':'association', participant: _firstPersonaName });
        model.state.settleItemSel = {};
        await saveDb(); await saveState(); renderApp();
        toast(`💰 팀 분배 완료 (세전 ${fmtS(total)} → 5% 차감 후 ${fmtS(netTotal)})\n${lines.join(' / ')}`);
      } catch(e) { toast(e.message || String(e), true); }
    });
    on('#gb-tax-calc', 'click', async () => {
      try {
        const income = Number(fieldValue('#gb-tax-income') || '0');
        model.state.taxIncome = String(income);
        await saveState(); renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-tax-pay-preview', 'click', async () => {
      try {
        const month = (fieldValue('#gb-tax-pay-month') || '').trim();
        model.state.taxPayMonth = month;
        await saveState(); renderApp();
        if (!month) { toast('납부 월을 입력하라. (예: 2026-03)', true); return; }
        const log = Array.isArray(model.db.incomeLog) ? model.db.incomeLog : [];
        const cnt = log.filter(r => (r.date || '').startsWith(month)).length;
        toast(`${month} 기준 소득 기록 ${cnt}건이 있다. "납부 완료" 버튼으로 삭제할 수 있다.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-tax-pay-confirm', 'click', async () => {
      try {
        const month = (fieldValue('#gb-tax-pay-month') || model.state.taxPayMonth || '').trim();
        if (!month) throw new Error('납부 월을 입력하라. (예: 2026-03)');
        if (!Array.isArray(model.db.incomeLog)) model.db.incomeLog = [];
        const before = model.db.incomeLog.length;
        model.db.incomeLog = model.db.incomeLog.filter(r => !(r.date || '').startsWith(month));
        const removed = before - model.db.incomeLog.length;
        if (!removed) { toast(`${month}에 해당하는 소득 기록이 없다.`, true); return; }
        model.state.taxPayMonth = '';
        await saveDb(); await saveState(); renderApp();
        toast(`✅ ${month} 소득세 납부 완료 처리 — ${removed}건 기록 삭제됨`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── Shop handlers ─────────────────────────────────────────────────────────
    on('[data-shop-sub]', 'click', async (ev) => {
      model.state.shopSub = ev.currentTarget.getAttribute('data-shop-sub') || '';
      model.state.shopHunterSub = '';
      await saveState(); renderApp();
    });
    on('[data-shop-hunter-sub]', 'click', async (ev) => {
      model.state.shopHunterSub = ev.currentTarget.getAttribute('data-shop-hunter-sub') || '';
      await saveState(); renderApp();
    });
    on('[data-shop-buy]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-shop-buy') || '';
        const [cat, itemId] = raw.split(':');
        const items = SHOP_ITEMS[cat] || [];
        const shopItem = items.find(it => it.id === itemId);
        if (!shopItem) throw new Error('상품을 찾을 수 없다.');
        const inv = getActiveInventory();
        if (Number(inv.gold || 0) < shopItem.price) throw new Error(`소지금이 부족하다. (${getActiveLabel()})`);
        inv.gold = Number(inv.gold || 0) - shopItem.price;
        const item = shopItem.buildFn ? shopItem.buildFn() : null;
        if (!item) throw new Error('아이템 생성 실패.');
        const res = grantActiveInventoryItem(item);
        if (!res.ok) pushInventoryOverflow(item);
        await saveDb(); await saveState(); renderApp();
        toast(`${shopItem.name} 구매 완료 (₩${Number(shopItem.price).toLocaleString('en-US')} 차감)`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── 편의점 식량 구매 핸들러 ───────────────────────────────────────────────
    on('[data-conv-food-buy]', 'click', async (ev) => {
      try {
        const fId = ev.currentTarget.getAttribute('data-conv-food-buy') || '';
        const db = getConvFoodDb();
        const f = db.find(x => x.id === fId);
        if (!f) throw new Error('상품을 찾을 수 없다.');
        const inv = getActiveInventory();
        if (Number(inv.gold||0) < f.price) throw new Error(`소지금이 부족하다. (${getActiveLabel()})`);
        inv.gold = Number(inv.gold||0) - f.price;
        // 야영용(ration/water)은 campSupply로, 나머지는 convFood로 추가
        let item;
        if (f.id === 'conv_ration') item = buildSupplyItem('ration', 1);
        else if (f.id === 'conv_water') item = buildSupplyItem('water', 1);
        else if (f.id === 'pot_lowest_hp') item = buildPotionItem(POTION_CATALOG.find(p => p.id === 'lowest_hp_potion'), 1);
        else if (f.id === 'pot_lowest_mp') item = buildPotionItem(POTION_CATALOG.find(p => p.id === 'lowest_mp_potion'), 1);
        else if (f.id === 'pot_lowest_sp') item = buildPotionItem(POTION_CATALOG.find(p => p.id === 'lowest_sp_potion'), 1);
        else item = buildConvFoodItem(f, 1);
        const res = grantActiveInventoryItem(item);
        if (!res.ok) pushInventoryOverflow(item);
        await saveDb(); renderApp();
        toast(`${f.name} 구매 완료 (₩${f.price.toLocaleString('en-US')} 차감)`);
      } catch(e) { toast(e.message||String(e), true); }
    });
    // ── 편의점 DB 관리 핸들러 ─────────────────────────────────────────────────
    on('#gb-convdb-add', 'click', async () => {
      const db = getConvFoodDb();
      db.push({ id:`conv_custom_${Date.now()}`, name:'새 식품', price:3000, weightG:300, note:'편의점 식품' });
      await saveDb(); renderApp();
    });
    on('#gb-convdb-save', 'click', async () => {
      try {
        const db = getConvFoodDb();
        document.querySelectorAll('[data-convdb-name]').forEach(el => {
          const idx = parseInt(el.getAttribute('data-convdb-name')||'0',10);
          if (db[idx]) db[idx].name = el.value.trim() || db[idx].name;
        });
        document.querySelectorAll('[data-convdb-price]').forEach(el => {
          const idx = parseInt(el.getAttribute('data-convdb-price')||'0',10);
          if (db[idx]) db[idx].price = Math.max(0, parseInt(el.value||'0',10));
        });
        document.querySelectorAll('[data-convdb-weight]').forEach(el => {
          const idx = parseInt(el.getAttribute('data-convdb-weight')||'0',10);
          if (db[idx]) db[idx].weightG = Math.max(1, parseInt(el.value||'100',10));
        });
        await saveDb(); renderApp();
        toast('편의점 DB 저장 완료');
      } catch(e) { toast(e.message||String(e), true); }
    });
    on('#gb-convdb-reset', 'click', async () => {
      model.db.convFoodDb = DEFAULT_CONV_FOOD_DB.map(f => ({ ...f }));
      await saveDb(); renderApp();
      toast('편의점 DB 기본값 복원');
    });
    on('[data-convdb-del]', 'click', async (ev) => {
      const idx = parseInt(ev.currentTarget.getAttribute('data-convdb-del')||'0',10);
      const db = getConvFoodDb();
      db.splice(idx, 1);
      await saveDb(); renderApp();
    });
    // ── Material shop search/filter/page handlers ─────────────────────────────
    on('#gb-mat-search-btn', 'click', async (ev) => {
      model.state.shopMatQuery = fieldValue('#gb-mat-query') || '';
      model.state.shopMatRank  = fieldValue('#gb-mat-rank')  || '';
      model.state.shopMatTier  = fieldValue('#gb-mat-tier')  || '';
      model.state.shopMatPage  = 0;
      await saveState(); renderApp();
    });
    on('[data-mat-page]', 'click', async (ev) => {
      const p = parseInt(ev.currentTarget.getAttribute('data-mat-page') || '0', 10);
      if (!isNaN(p) && p >= 0) { model.state.shopMatPage = p; await saveState(); renderApp(); }
    });
    on('[data-mat-buy]', 'click', async (ev) => {
      try {
        const key = ev.currentTarget.getAttribute('data-mat-buy') || '';
        const parts = key.split(':');
        const kind = parts[0];
        const inv = getActiveInventory();
        let item = null;
        let price = 0;
        if (kind === 'rare') {
          const id = parts.slice(1).join(':');
          const catalog = getRareMaterialCatalog();
          const found = catalog.find(it => it.id === id);
          if (!found) throw new Error('재료를 찾을 수 없다.');
          price = Math.ceil((found.suggestedPrice || 0) * MAT_SHOP_BUY_MARKUP);
          item = rewardRowToInventoryItem(Object.assign({}, found, { count: 1 }), 'rare');
        }
        if (!item) throw new Error('아이템 생성 실패.');
        if (Number(inv.gold || 0) < price) throw new Error(`소지금이 부족하다. (${getActiveLabel()})`);
        inv.gold = Number(inv.gold || 0) - price;
        const res = grantActiveInventoryItem(item);
        if (!res.ok) pushInventoryOverflow(item);
        await saveDb(); await saveState(); renderApp();
        toast(`${item.name} 구매 완료 (₩${price.toLocaleString('en-US')} 차감)`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── Black market handlers ─────────────────────────────────────────────────
    on('[data-bm-tab]', 'click', async (ev) => {
      model.state.shopBmTab = ev.currentTarget.getAttribute('data-bm-tab') || 'rare';
      await saveState(); renderApp();
    });

    // ── Equipment Shop handlers ───────────────────────────────────────────────
    on('[data-equip-shop-rank]', 'click', async (ev) => {
      model.state.shopEquipRank = ev.currentTarget.getAttribute('data-equip-shop-rank') || '';
      await saveState(); renderApp();
    });
    on('[data-equip-shop-part]', 'click', async (ev) => {
      model.state.shopEquipPart = ev.currentTarget.getAttribute('data-equip-shop-part') || '';
      await saveState(); renderApp();
    });
    on('[data-equip-shop-buy]', 'click', async (ev) => {
      try {
        const id = ev.currentTarget.getAttribute('data-equip-shop-buy') || '';
        const eq = (model.db.equipments || []).find(e => e.id === id);
        if (!eq) throw new Error('장비를 찾을 수 없다.');
        const price = (eq.price != null && eq.price !== '' && Number(eq.price) >= 0) ? Number(eq.price) : calcEquipEnhancedPrice(calcEquipBasePrice(eq.rank, eq.part), eq.enhance||0, eq.rank);
        const inv = getActiveInventory();
        if (Number(inv.gold || 0) < price) throw new Error(`소지금 부족 (${getActiveLabel()}: ${Number(inv.gold||0).toLocaleString('en-US')}원 / 필요 ${price.toLocaleString('en-US')}원)`);
        inv.gold = Number(inv.gold || 0) - price;
        // Add to inventory as owned equipment (new = maxDurability 100, isUsed false)
        const newItem = Object.assign({}, deepClone(eq), {
          category: 'equipment',
          isUsed: false,
          durability: 100,
          maxDurability: 100,
          stackable: false,
          unitWeightG: EQUIP_WEIGHT_G[eq.part] || 1000,
          stackKey: `equipment:${eq.id}:${Date.now()}`
        });
        grantActiveInventoryItem(newItem);
        await saveDb(); await saveState(); renderApp();
        toast(`⚔️ ${eq.name} 구매 완료 (-₩${price.toLocaleString('en-US')}) [${getActiveLabel()}]`);
      } catch (e) { toast(e.message || String(e), true); }
    });

    // ── Hunter Market handlers ────────────────────────────────────────────────
    on('[data-hm-tab]', 'click', async (ev) => {
      model.state.shopHmTab = ev.currentTarget.getAttribute('data-hm-tab') || 'sell';
      await saveState(); renderApp();
    });
    on('[data-hm-rank]', 'click', async (ev) => {
      model.state.shopHmRank = ev.currentTarget.getAttribute('data-hm-rank') || '';
      await saveState(); renderApp();
    });
    on('[data-hm-part]', 'click', async (ev) => {
      model.state.shopHmPart = ev.currentTarget.getAttribute('data-hm-part') || '';
      await saveState(); renderApp();
    });
    on('[data-hm-refresh]', 'click', async () => {
      if (!Array.isArray(model.db.hmUsedListings)) model.db.hmUsedListings = [];
      model.db.hmUsedListings = model.db.hmUsedListings.filter(l => !l.isNpc);
      seedNpcUsedListings();
      await saveDb(); renderApp();
      toast('🔄 헌터마켓 NPC 목록 갱신 완료');
    });
    on('[data-hm-sell]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-hm-sell') || '';
        const lastColon = raw.lastIndexOf(':');
        const ikey = raw.substring(0, lastColon);
        const sellPrice = Number(raw.substring(lastColon+1));
        const inv = getActiveInventory();
        const it = inv.items.find(x => inventoryItemKey(x) === ikey);
        if (!it) throw new Error('판매할 장비를 찾을 수 없다.');
        // 판매 = 즉시 골드 획득 (헌터마켓 직거래)
        if (getActiveCharacter()) {
          const idx2 = inv.items.findIndex(x => inventoryItemKey(x) === ikey);
          if (idx2 >= 0) inv.items.splice(idx2, 1);
        } else {
          removeInventoryItem(ikey, 'one');
        }
        inv.gold = Number(inv.gold||0) + sellPrice;
        await saveDb(); await saveState(); renderApp();
        toast(`🏷️ ${it.name} 중고 판매 완료 (+₩${sellPrice.toLocaleString('en-US')}) [${getActiveLabel()}]`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-hm-browse-buy]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-hm-browse-buy') || '';
        const lastColon = raw.lastIndexOf(':');
        const listingId = raw.substring(0, lastColon);
        const usedPrice = Number(raw.substring(lastColon+1));
        if (!Array.isArray(model.db.hmUsedListings)) throw new Error('헌터마켓 목록이 없다.');
        const idx = model.db.hmUsedListings.findIndex(l => l.id === listingId);
        if (idx < 0) throw new Error('해당 중고 매물을 찾을 수 없다. (이미 판매됨)');
        const listing = model.db.hmUsedListings[idx];
        const inv = getActiveInventory();
        if (Number(inv.gold||0) < usedPrice) throw new Error(`소지금 부족 (${getActiveLabel()}: 필요 ₩${usedPrice.toLocaleString('en-US')})`);
        inv.gold = Number(inv.gold||0) - usedPrice;
        const buyItem = deepClone(listing.item);
        buyItem.category = 'equipment';
        buyItem.isUsed = true;
        buyItem.stackable = false;
        if (!buyItem.unitWeightG) buyItem.unitWeightG = EQUIP_WEIGHT_G[buyItem.part] || 1000;
        buyItem.stackKey = `equipment:hm_${listingId}_${Date.now()}`;
        grantActiveInventoryItem(buyItem);
        model.db.hmUsedListings.splice(idx, 1);
        await saveDb(); await saveState(); renderApp();
        toast(`🏷️ ${buyItem.name} 중고 구매 완료 (-₩${usedPrice.toLocaleString('en-US')}) [${getActiveLabel()}]`);
      } catch (e) { toast(e.message || String(e), true); }
    });

    // ── Repair Shop handlers ──────────────────────────────────────────────────
    on('[data-repair-sel]', 'click', async (ev) => {
      model.state.shopRepairSel = ev.currentTarget.getAttribute('data-repair-sel') || '';
      await saveState(); renderApp();
    });
    on('#gb-repair-full', 'click', async () => {
      try {
        const ikey = model.state.shopRepairSel;
        if (!ikey) throw new Error('수리할 장비를 선택하라.');
        const inv = getActiveInventory();
        const it = inv.items.find(x => inventoryItemKey(x) === ikey);
        if (!it) throw new Error('장비를 찾을 수 없다.');
        const dur = Number(it.durability ?? 100);
        const maxDur = Number(it.maxDurability ?? 100);
        const lost = maxDur - dur;
        const fee = calcRepairFee(it.rank||'E', it.part||'weapon', lost);
        if (fee > 0 && Number(inv.gold||0) < fee) throw new Error(`소지금 부족 (${getActiveLabel()}: ${Number(inv.gold||0).toLocaleString('en-US')}원 / 필요 ${fee.toLocaleString('en-US')}원)`);
        inv.gold = Math.max(0, Number(inv.gold||0) - fee);
        applyRepair(it, maxDur);
        await saveDb(); await saveState(); renderApp();
        toast(`🔧 ${it.name} 수리 완료. 내구도 ${it.durability}/${it.maxDurability}${fee>0?` (-₩${fee.toLocaleString('en-US')})`:' (무료)'}`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-repair-partial', 'click', async () => {
      try {
        const ikey = model.state.shopRepairSel;
        if (!ikey) throw new Error('수리할 장비를 선택하라.');
        const inv = getActiveInventory();
        const it = inv.items.find(x => inventoryItemKey(x) === ikey);
        if (!it) throw new Error('장비를 찾을 수 없다.');
        const targetDur = Number(fieldValue('#gb-repair-target-dur') || (it.maxDurability ?? 100));
        const dur = Number(it.durability ?? 100);
        const maxDur = Number(it.maxDurability ?? 100);
        if (targetDur <= dur) {
          const el = model.root && model.root.querySelector('#gb-repair-partial-result');
          if (el) el.textContent = '현재 내구도보다 낮거나 같은 목표는 수리가 필요 없다.';
          return;
        }
        const lost = Math.min(maxDur, targetDur) - dur;
        const fee = calcRepairFee(it.rank||'E', it.part||'weapon', lost);
        if (fee > 0 && Number(inv.gold||0) < fee) {
          const el = model.root && model.root.querySelector('#gb-repair-partial-result');
          if (el) el.textContent = `소지금 부족 (필요 ₩${fee.toLocaleString('en-US')})`;
          return;
        }
        inv.gold = Math.max(0, Number(inv.gold||0) - fee);
        applyRepair(it, Math.min(maxDur, targetDur));
        await saveDb(); await saveState(); renderApp();
        toast(`🔧 ${it.name} 부분 수리 완료. 내구도 ${it.durability}/${it.maxDurability}${fee>0?` (-₩${fee.toLocaleString('en-US')})`:' (무료)'}`);
      } catch (e) { toast(e.message || String(e), true); }
    });


    on('[data-bm-sell]', 'click', async (ev) => {
      try {
        const raw   = ev.currentTarget.getAttribute('data-bm-sell') || '';
        const colonIdx = raw.lastIndexOf(':');
        const ikey  = raw.substring(0, colonIdx);
        const mode  = raw.substring(colonIdx + 1); // 'one' or 'all'
        const inv   = getInventory();
        const it    = inv.items.find(x => inventoryItemKey(x) === ikey);
        if (!it) throw new Error('판매할 아이템을 찾을 수 없다.');
        const sp    = Number(it.suggestedPrice || 0);
        if (!sp) throw new Error('기준가 없는 아이템은 블랙마켓 판매 불가.');
        const cnt   = mode === 'all' ? Number(it.count || 1) : 1;
        const val   = sp * cnt;
        // Detection check: 2% per item
        let caught = false;
        for (let i = 0; i < cnt; i++) {
          if (Math.random() < BM_DETECT_RATE) { caught = true; break; }
        }
        // Item is always removed (seized or sold)
        removeInventoryItem(ikey, mode === 'all' ? 'all' : 'one');
        if (caught) {
          // Seizure: no gold gain, item gone, + 50% fine
          const fine = Math.floor(val * BM_FINE_RATE);
          inv.gold = Math.max(0, Number(inv.gold || 0) - fine);
          await saveDb(); await saveState(); renderApp();
          toast(`⚠️ 협회 특수수사대에 발각됐다! ${it.name} ${cnt}개 압수·거래 무효 + 벌금 ₩${fine.toLocaleString('en-US')} 부과.`, true);
        } else {
          inv.gold = Number(inv.gold || 0) + val;
          await saveDb(); await saveState(); renderApp();
          toast(`🖤 ${it.name} ${cnt}개 블랙마켓 거래 완료 (+₩${val.toLocaleString('en-US')})`);
        }
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── Forge (대장간 강화) handlers ─────────────────────────────────────────────
    on('[data-forge-tab]', 'click', async (ev) => {
      model.state.shopForgeTab = ev.currentTarget.getAttribute('data-forge-tab') || 'enhance';
      model.state.shopForgeSel = '';
      model.state.shopForgeStone = '';
      model.state.shopForgeInfuseMat = '';
      await saveState(); renderApp();
    });
    on('[data-forge-sel]', 'click', async (ev) => {
      model.state.shopForgeSel = ev.currentTarget.getAttribute('data-forge-sel') || '';
      model.state.shopForgeStone = '';
      model.state.shopForgeInfuseMat = '';
      await saveState(); renderApp();
    });
    on('[data-forge-stone]', 'click', async (ev) => {
      model.state.shopForgeStone = ev.currentTarget.getAttribute('data-forge-stone') || '';
      await saveState(); renderApp();
    });
    on('[data-forge-infuse-mat]', 'click', async (ev) => {
      model.state.shopForgeInfuseMat = ev.currentTarget.getAttribute('data-forge-infuse-mat') || '';
      await saveState(); renderApp();
    });
    on('#gb-forge-do', 'click', async (ev) => {
      try {
        const inv = getActiveInventory();
        const btn = ev.currentTarget;
        const equipKey = btn.getAttribute('data-forge-equip') || '';
        const stoneKey = btn.getAttribute('data-forge-stone-key') || '';
        const fee = Number(btn.getAttribute('data-forge-fee') || '0');
        const rate = Number(btn.getAttribute('data-forge-rate') || '0');
        const btnRank = btn.getAttribute('data-forge-rank') || 'E';
        const equip = inv.items.find(x => inventoryItemKey(x) === equipKey);
        const stone = inv.items.find(x => inventoryItemKey(x) === stoneKey);
        if (!equip) throw new Error('강화할 장비를 찾을 수 없다.');
        if (!stone) throw new Error('마정석을 찾을 수 없다.');
        if (Number(inv.gold || 0) < fee) throw new Error(`소지금 부족. (필요 ₩${fee.toLocaleString('en-US')})`);
        // 수수료 차감
        inv.gold = Math.max(0, Number(inv.gold || 0) - fee);
        // 마정석 1개 소모
        removeInventoryItem(stoneKey, 'one');
        const success = Math.random() < rate;
        if (success) {
          equip.enhance = (equip.enhance || 0) + 1;
          const baseP = Number(equip.price || calcEquipBasePrice(equip.rank||'E', equip.part||'weapon'));
          const newMarketPrice = calcEquipEnhancedPrice(baseP, equip.enhance, equip.rank || btnRank);
          const newUsedPrice = calcForgeEnhancedUsedPrice(baseP, equip.enhance, equip.part, equip.rank || btnRank);
          model.state.shopForgeStone = '';
          await saveDb(); await saveState(); renderApp();
          toast(`✨ 강화 성공! ${equip.name} +${equip.enhance} 달성! 경매장가 ₩${newMarketPrice.toLocaleString('en-US')} | 중고가 ₩${newUsedPrice.toLocaleString('en-US')} (-수수료 ₩${fee.toLocaleString('en-US')})`);
        } else {
          model.state.shopForgeStone = '';
          await saveDb(); await saveState(); renderApp();
          toast(`💥 강화 실패. ${equip.name} 장비 유지, 마정석 소멸 (-수수료 ₩${fee.toLocaleString('en-US')})`, true);
        }
      } catch(e) { toast(e.message || String(e), true); }
    });
    on('#gb-forge-infuse-do', 'click', async (ev) => {
      try {
        const inv = getActiveInventory();
        const btn = ev.currentTarget;
        const equipKey = btn.getAttribute('data-forge-equip') || '';
        const matKey = btn.getAttribute('data-forge-mat-key') || '';
        const totalCost = Number(btn.getAttribute('data-forge-infuse-fee') || '0');
        const traitId = btn.getAttribute('data-forge-trait-id') || '';
        const equip = inv.items.find(x => inventoryItemKey(x) === equipKey);
        const mat = inv.items.find(x => inventoryItemKey(x) === matKey);
        if (!equip) throw new Error('특성주입할 장비를 찾을 수 없다.');
        if (!mat) throw new Error('희귀재료를 찾을 수 없다.');
        if (!traitId) throw new Error('주입할 특성 정보가 없다.');
        const maxInfuse = equip.maxInfuse ?? EQUIP_MAX_INFUSE[equip.part||'weapon'] ?? 1;
        if ((equip.infuse || 0) >= maxInfuse) throw new Error(`이미 최대 특성 수(${maxInfuse})에 도달했다.`);
        if ((equip.traits||[]).includes(traitId)) throw new Error('이미 보유한 특성이다.');
        if (Number(inv.gold || 0) < totalCost) throw new Error(`소지금 부족. (필요 ₩${totalCost.toLocaleString('en-US')})`);
        // 비용 차감 및 재료 소모
        inv.gold = Math.max(0, Number(inv.gold || 0) - totalCost);
        removeInventoryItem(matKey, 'one');
        // 특성 주입 (100% 성공)
        if (!Array.isArray(equip.traits)) equip.traits = [];
        equip.traits.push(traitId);
        equip.infuse = (equip.infuse || 0) + 1;
        model.state.shopForgeInfuseMat = '';
        await saveDb(); await saveState(); renderApp();
        const traitLabel = EQUIP_TRAIT_LABELS[traitId] || traitId;
        toast(`💎 특성주입 성공! ${equip.name}에 [${traitLabel}] 주입 완료. (-₩${totalCost.toLocaleString('en-US')})`);
      } catch(e) { toast(e.message || String(e), true); }
    });

    on('[data-bm-gear-inv]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-bm-gear-inv') || '';
        const colonIdx = raw.lastIndexOf(':');
        if (colonIdx < 0) return;
        const ikey = raw.slice(0, colonIdx);
        const price = Math.max(0, Number(raw.slice(colonIdx + 1) || '0'));
        const inv = getInventory();
        const it = (inv.items||[]).find(x => inventoryItemKey(x) === ikey);
        if (!it) throw new Error('해당 장비를 인벤토리에서 찾을 수 없다.');
        if (Number(it.maxDurability ?? 100) < 100 || it.isUsed) throw new Error('중고 장비는 블랙마켓 매입 불가. (최대내구도 100 & 미사용 장비만 가능)');
        const caught = Math.random() < BM_DETECT_RATE;
        if (caught) {
          // 적발 — 아이템 압수, 벌금 부과
          removeInventoryItem(ikey, 'all');
          const fine = Math.floor(price * BM_FINE_RATE);
          inv.gold = Math.max(0, Number(inv.gold || 0) - fine);
          await saveDb(); await saveState(); renderApp();
          toast(`⚠️ [${it.rank}] ${it.name} — 발각됐다! 장비 압수·거래 무효 + 벌금 ₩${fine.toLocaleString('en-US')} 부과.`, true);
        } else {
          removeInventoryItem(ikey, 'all');
          inv.gold = Number(inv.gold || 0) + price;
          await saveDb(); await saveState(); renderApp();
          toast(`🖤 [${it.rank}] ${it.name} 블랙마켓 매입 완료 (+₩${price.toLocaleString('en-US')}) — 소득 기록 없음.`);
        }
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── Guild handlers ────────────────────────────────────────────────────────
    on('[data-guild-sub]', 'click', async (ev) => {
      model.state.guildSub = ev.currentTarget.getAttribute('data-guild-sub') || '';
      await saveState(); renderApp();
    });
    on('[data-guild-join]', 'click', async (ev) => {
      const id = ev.currentTarget.getAttribute('data-guild-join') || '';
      model.db.guildId = id;
      model.state.guildSub = '';
      await saveDb(); await saveState(); renderApp();
      const g = PRESET_GUILDS.find(x => x.id === id);
      toast(g ? `${g.name}에 가입했다.` : '길드 가입 완료');
    });
    on('[data-guild-leave]', 'click', async () => {
      model.db.guildId = '';
      model.db.customGuildName = '';
      model.db.customGuildDesc = '';
      model.state.guildSub = '';
      await saveDb(); await saveState(); renderApp();
      toast('길드에서 탈퇴했다.');
    });
    on('#gb-guild-create-btn', 'click', async (ev) => {
      try {
        const name = (fieldValue('#gb-guild-name-input') || '').trim().slice(0, 20);
        const desc = (fieldValue('#gb-guild-desc-input') || '').trim();
        if (!name) throw new Error('길드 이름을 입력하라.');
        model.db.guildId = 'custom';
        model.db.customGuildName = name;
        model.db.customGuildDesc = desc;
        model.state.guildSub = '';
        await saveDb(); await saveState(); renderApp();
        toast(`'${name}' 길드를 창설했다.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── Home handlers ─────────────────────────────────────────────────────────
    on('[data-home-sub]', 'click', async (ev) => {
      model.state.homeSub = ev.currentTarget.getAttribute('data-home-sub') || '';
      await saveState(); renderApp();
    });
    on('[data-home-enter]', 'click', async (ev) => {
      const parts = (ev.currentTarget.getAttribute('data-home-enter') || '').split(':');
      const regionId = parts[0] || '', homeId = parts[1] || '';
      model.state.homeViewTarget = { regionId, homeId };
      model.state.homeSub = 'interior';
      await saveState(); renderApp();
    });
    on('#gb-home-region-add-btn', 'click', async (ev) => {
      try {
        const name = (fieldValue('#gb-region-name') || '').trim();
        if (!name) throw new Error('지역 이름을 입력하라.');
        if (!Array.isArray(model.db.homeRegions)) model.db.homeRegions = [];
        model.db.homeRegions.push({ id: `region_${Date.now().toString(36)}`, name, homes: [] });
        model.state.homeSub = '';
        await saveDb(); await saveState(); renderApp();
        toast(`'${name}' 지역이 추가되었다.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-home-region-del]', 'click', async (ev) => {
      try {
        const regionId = ev.currentTarget.getAttribute('data-home-region-del') || '';
        if (!Array.isArray(model.db.homeRegions)) return;
        const idx = model.db.homeRegions.findIndex(r => r.id === regionId);
        if (idx < 0) return;
        // If any character living in this region, move them out
        migrateOwnedHomes();
        for (const [key, arr] of Object.entries(model.db.ownedHomes)) {
          if (!Array.isArray(arr)) continue;
          model.db.ownedHomes[key] = arr.filter(o => o.regionId !== regionId);
          if (model.db.ownedHomes[key].length === 0) delete model.db.ownedHomes[key];
        }
        model.db.homeRegions.splice(idx, 1);
        await saveDb(); renderApp();
        toast('지역이 삭제되었다.');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-home-add-btn', 'click', async (ev) => {
      try {
        const regionId = fieldValue('#gb-home-add-region') || '';
        const name = (fieldValue('#gb-home-name') || '').trim();
        if (!name) throw new Error('집 이름을 입력하라.');
        if (!Array.isArray(model.db.homeRegions)) model.db.homeRegions = [];
        const region = model.db.homeRegions.find(r => r.id === regionId);
        if (!region) throw new Error('지역을 찾을 수 없다.');
        if (!Array.isArray(region.homes)) region.homes = [];
        const area = (fieldValue('#gb-home-area') || '').trim();
        region.homes.push({
          id: `home_${Date.now().toString(36)}`,
          name,
          area,
          houseType: fieldValue('#gb-home-type') || 'rent',
          deposit: Math.max(0, Number(fieldValue('#gb-home-deposit')) || 0),
          monthlyRent: Math.max(0, Number(fieldValue('#gb-home-rent')) || 0),
          maintenanceFee: Math.max(0, Number(fieldValue('#gb-home-maint')) || 0),
          purchasePrice: Math.max(0, Number(fieldValue('#gb-home-purchase')) || 0),
          brokerFee: Math.max(0, Number(fieldValue('#gb-home-broker')) || 0),
          desc: (fieldValue('#gb-home-desc') || '').trim(),
          features: (fieldValue('#gb-home-features') || '').split(',').map(s => s.trim()).filter(Boolean),
          storages: buildDefaultStoragesForArea(area)
        });
        model.state.homeSub = '';
        await saveDb(); await saveState(); renderApp();
        toast(`'${name}' 집이 추가되었다. (보관함 자동 생성 완료)`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-home-del]', 'click', async (ev) => {
      try {
        const parts = (ev.currentTarget.getAttribute('data-home-del') || '').split(':');
        const regionId = parts[0], homeId = parts[1];
        if (!regionId || !homeId || !Array.isArray(model.db.homeRegions)) return;
        const region = model.db.homeRegions.find(r => r.id === regionId);
        if (!region || !Array.isArray(region.homes)) return;
        const idx = region.homes.findIndex(h => h.id === homeId);
        if (idx < 0) return;
        // If any character living in this home, move them out
        migrateOwnedHomes();
        for (const [key, arr] of Object.entries(model.db.ownedHomes)) {
          if (!Array.isArray(arr)) continue;
          model.db.ownedHomes[key] = arr.filter(o => !(o.regionId === regionId && o.homeId === homeId));
          if (model.db.ownedHomes[key].length === 0) delete model.db.ownedHomes[key];
        }
        region.homes.splice(idx, 1);
        await saveDb(); renderApp();
        toast('집이 삭제되었다.');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-home-movein]', 'click', async (ev) => {
      try {
        const parts = (ev.currentTarget.getAttribute('data-home-movein') || '').split(':');
        const regionId = parts[0], homeId = parts[1];
        if (!regionId || !homeId) return;
        const region = (model.db.homeRegions || []).find(r => r.id === regionId);
        const home = region ? (region.homes || []).find(h => h.id === homeId) : null;
        if (!home) throw new Error('집을 찾을 수 없다.');
        // Prevent double move-in: check if another character already lives here
        const existingOccupant = findHomeOccupant(regionId, homeId);
        if (existingOccupant) throw new Error(`이미 ${existingOccupant.label}(이)가 거주 중인 집이다.`);
        // Calculate move-in cost: deposit (or purchasePrice) + broker fee
        const cost = (home.houseType === 'purchase' ? Number(home.purchasePrice || 0) : Number(home.deposit || 0)) + Number(home.brokerFee || 0);
        const inv = getActiveInventory();
        const currentGold = Number(inv.gold || 0);
        if (cost > 0 && currentGold < cost) throw new Error(`입주 비용이 부족하다. 필요: ₩${cost.toLocaleString('en-US')} / 보유: ₩${currentGold.toLocaleString('en-US')}`);
        if (cost > 0) inv.gold = currentGold - cost;
        const gd = model.db.gameDate || { year:2026, month:1, day:1 };
        const moveInDate = `${gd.year}-${String(gd.month).padStart(2,'0')}-${String(gd.day).padStart(2,'0')}`;
        addActiveOwnedHome({ regionId, homeId, moveInDate, lastRentPaidMonth: formatYM(gd.year, gd.month), rentLog: [] });
        await saveDb(); await saveState(); renderApp();
        toast(cost > 0 ? `${getActiveLabel()} 입주 완료! (₩${cost.toLocaleString('en-US')} 차감)` : `${getActiveLabel()} 입주 완료!`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-home-moveout]', 'click', async (ev) => {
      try {
        const parts = (ev.currentTarget.getAttribute('data-home-moveout') || '').split(':');
        const regionId = parts[0] || '', homeId = parts[1] || '';
        let owned = null;
        if (regionId && homeId) {
          owned = getActiveOwnedHomeByLocation(regionId, homeId);
        } else {
          owned = getActiveOwnedHome();
        }
        if (owned) {
          const data = getOwnedHomeData(owned);
          // Refund deposit on voluntary move-out (only for rental homes)
          if (data && data.home && data.home.houseType === 'rent') {
            const deposit = Number(data.home.deposit || 0);
            if (deposit > 0) {
              const inv = getActiveInventory();
              inv.gold = Number(inv.gold || 0) + deposit;
              toast(`보증금 ₩${deposit.toLocaleString('en-US')} 환불 완료.`);
            }
          }
          removeActiveOwnedHome(owned.regionId, owned.homeId);
        }
        model.state.homeSub = '';
        model.state.homeViewTarget = {};
        await saveDb(); await saveState(); renderApp();
        toast(`${getActiveLabel()} 퇴거 처리 완료.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── Rent/maintenance payment handler ──────────────────────────────────────
    on('[data-home-pay-rent]', 'click', async (ev) => {
      try {
        const hvt = model.state.homeViewTarget || {};
        const owned = hvt.regionId ? getActiveOwnedHomeByLocation(hvt.regionId, hvt.homeId) : getActiveOwnedHome();
        if (!owned) throw new Error('거주 중인 집이 없다.');
        const data = getOwnedHomeData(owned);
        if (!data) throw new Error('집을 찾을 수 없다.');
        const gd = model.db.gameDate || { year:2026, month:1, day:1 };
        const rentInfo = calcRentDue(owned, data.home, gd);
        if (!rentInfo || rentInfo.totalDebt <= 0) throw new Error('납부할 금액이 없다.');
        const inv = getActiveInventory();
        const gold = Number(inv.gold || 0);
        if (gold < rentInfo.totalDebt) throw new Error(`골드가 부족하다. 필요: ₩${rentInfo.totalDebt.toLocaleString('en-US')} / 보유: ₩${gold.toLocaleString('en-US')}`);
        inv.gold = gold - rentInfo.totalDebt;
        // Record payment
        if (!Array.isArray(owned.rentLog)) owned.rentLog = [];
        const paidDate = `${gd.year}-${String(gd.month).padStart(2,'0')}-${String(gd.day).padStart(2,'0')}`;
        const isRent = data.home.houseType === 'rent';
        // Pay all overdue months
        for (let i = 0; i < rentInfo.overdueMonths; i++) {
          const rent = isRent ? Number(data.home.monthlyRent || 0) : 0;
          const maint = Number(data.home.maintenanceFee || 0);
          const isLast = (i === rentInfo.overdueMonths - 1);
          owned.rentLog.push({
            month: (() => { let y = gd.year, m = gd.month - rentInfo.overdueMonths + i; while(m<=0){m+=12;y--;} return formatYM(y,m); })(),
            amount: rent + maint + (isLast ? rentInfo.interest : 0),
            interest: isLast ? rentInfo.interest : 0,
            paidDate
          });
        }
        // Keep only last 2 entries
        if (owned.rentLog.length > 2) owned.rentLog = owned.rentLog.slice(-2);
        // Update last paid month to current month
        owned.lastRentPaidMonth = formatYM(gd.year, gd.month);
        await saveDb(); await saveState(); renderApp();
        const payLabel = isRent ? '월세' : '관리비';
        toast(`${payLabel} ₩${rentInfo.totalDebt.toLocaleString('en-US')} 납부 완료.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── 하루 휴식 핸들러 ──────────────────────────────────────────────────────
    on('#gb-home-rest', 'click', async () => {
      try {
        if (!model.db.gameDate) model.db.gameDate = { year:2026, month:1, day:1 };
        const gd = model.db.gameDate;
        // 날짜 하루 진행
        const d = new Date(gd.year, gd.month - 1, gd.day);
        d.setDate(d.getDate() + 1);
        gd.year = d.getFullYear();
        gd.month = d.getMonth() + 1;
        gd.day = d.getDate();
        // 임대료/관리비 처리
        const evictMsgs = processRentOnDateAdvance(gd);
        // 모든 캐릭터/페르소나 HP/MP/SP 완전 회복
        (model.db.characters || []).forEach(c => {
          if (c.stats) recalcCharDerivedStats(c);
          c.currentHp = Number(c.hp || 0);
          c.currentMp = Number(c.mp || 0);
          c.currentSp = Number(c.sp || 0);
        });
        (model.db.personas || []).forEach(p => {
          if (p.stats) recalcCharDerivedStats(p);
          p.currentHp = Number(p.hp || 0);
          p.currentMp = Number(p.mp || 0);
          p.currentSp = Number(p.sp || 0);
        });
        // 전멸 상태 해제
        model.db.lastWipeDate = null;
        await saveDb(); await saveState(); renderApp();
        for (const msg of evictMsgs) toast(msg, true);
        toast(`🛏️ 하루 휴식 완료! ${gd.year}년 ${gd.month}월 ${gd.day}일 — 모든 파티원 HP/MP/SP 완전 회복.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    // ── Storage handlers ──────────────────────────────────────────────────────
    on('#gb-home-storage-add-btn', 'click', async (ev) => {
      try {
        const name = (fieldValue('#gb-storage-name') || '').trim();
        const type = fieldValue('#gb-storage-type') || '기타';
        if (!name) throw new Error('보관함 이름을 입력하라.');
        const hvt = model.state.homeViewTarget || {};
        const owned = hvt.regionId ? getActiveOwnedHomeByLocation(hvt.regionId, hvt.homeId) : getActiveOwnedHome();
        if (!owned) return;
        const data = getOwnedHomeData(owned);
        if (!data) return;
        if (!Array.isArray(data.home.storages)) data.home.storages = [];
        data.home.storages.push({ id: `storage_${Date.now().toString(36)}`, name, type, maxSlots: 10, maxWeightKg: 0, items: [] });
        await saveDb(); renderApp();
        toast(`'${name}' 보관함이 추가되었다.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-home-storage-del]', 'click', async (ev) => {
      try {
        const idx = parseInt(ev.currentTarget.getAttribute('data-home-storage-del'), 10);
        const hvt = model.state.homeViewTarget || {};
        const owned = hvt.regionId ? getActiveOwnedHomeByLocation(hvt.regionId, hvt.homeId) : getActiveOwnedHome();
        if (!owned) return;
        const data = getOwnedHomeData(owned);
        if (!data || !Array.isArray(data.home.storages) || !data.home.storages[idx]) return;
        const sName = data.home.storages[idx].name;
        data.home.storages.splice(idx, 1);
        await saveDb(); renderApp();
        toast(`'${sName}' 보관함이 삭제되었다.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-home-storage-view]', 'click', async (ev) => {
      const idx = ev.currentTarget.getAttribute('data-home-storage-view') || '0';
      model.state.homeSub = `storage:${idx}`;
      await saveState(); renderApp();
    });
    on('#gb-home-storage-item-store-btn', 'click', async (ev) => {
      try {
        const itemIdx = parseInt(fieldValue('#gb-storage-store-item'), 10);
        const count = Math.max(1, Number(fieldValue('#gb-storage-store-count')) || 1);
        const hvt = model.state.homeViewTarget || {};
        const owned = hvt.regionId ? getActiveOwnedHomeByLocation(hvt.regionId, hvt.homeId) : getActiveOwnedHome();
        if (!owned) return;
        const sIdxStr = (model.state.homeSub || '').split(':')[1];
        const sIdx = parseInt(sIdxStr, 10);
        const data = getOwnedHomeData(owned);
        if (!data || !data.home.storages || !data.home.storages[sIdx]) throw new Error('보관함을 찾을 수 없다.');
        const storage = data.home.storages[sIdx];
        // Enforce slot limit
        if (storage.maxSlots && storage.items.length >= storage.maxSlots) throw new Error(`보관함이 가득 찼다. (최대 ${storage.maxSlots}칸)`);
        const inv = getActiveInventory();
        if (!inv.items || !inv.items[itemIdx]) throw new Error('아이템을 찾을 수 없다.');
        const srcItem = inv.items[itemIdx];
        const available = Math.max(1, Number(srcItem.count || 1));
        const toStore = Math.min(count, available);
        const storedItem = deepClone(srcItem);
        storedItem.count = toStore;
        // Enforce weight limit for food storages
        if (storage.maxWeightKg > 0) {
          const currentWeightG = storage.items.reduce((sum, it) => sum + Number(it.unitWeightG || 0) * Number(it.count || 1), 0);
          const addWeightG = Number(storedItem.unitWeightG || 0) * toStore;
          if ((currentWeightG + addWeightG) > storage.maxWeightKg * 1000) throw new Error(`무게 제한 초과. (최대 ${storage.maxWeightKg}kg)`);
        }
        storage.items.push(storedItem);
        if (toStore >= available) {
          inv.items.splice(itemIdx, 1);
        } else {
          srcItem.count = available - toStore;
        }
        await saveDb(); await saveState(); renderApp();
        toast(`${storedItem.name} x${toStore} 보관 완료.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-home-storage-item-take]', 'click', async (ev) => {
      try {
        const parts = (ev.currentTarget.getAttribute('data-home-storage-item-take') || '').split(':');
        const sIdx = parseInt(parts[0], 10);
        const iIdx = parseInt(parts[1], 10);
        const hvt = model.state.homeViewTarget || {};
        const owned = hvt.regionId ? getActiveOwnedHomeByLocation(hvt.regionId, hvt.homeId) : getActiveOwnedHome();
        if (!owned) return;
        // Check if storage is locked due to unpaid maintenance
        const data = getOwnedHomeData(owned);
        if (!data || !data.home.storages || !data.home.storages[sIdx]) return;
        const gd = model.db.gameDate || { year:2026, month:1, day:1 };
        const feeInfo = calcRentDue(owned, data.home, gd);
        if (feeInfo && feeInfo.storageLocked) throw new Error('관리비 2개월 미납으로 보관함 아이템 반출이 불가합니다. 관리비를 먼저 납부하세요.');
        const storage = data.home.storages[sIdx];
        if (!Array.isArray(storage.items) || !storage.items[iIdx]) return;
        const item = storage.items[iIdx];
        grantActiveInventoryItem(item);
        storage.items.splice(iIdx, 1);
        await saveDb(); await saveState(); renderApp();
        toast(`${item.name} x${Number(item.count||1)} 꺼냄.`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-inv-save', 'click', async () => {
      try {
        const inv = getInventory();
        inv.gold = Math.max(0, Number(fieldValue('#gb-inv-gold') || 0));
        await saveDb(); await saveState();
        renderApp();
        toast('인벤토리 설정 저장 완료');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-inv-grid-toggle', 'click', async () => {
      try {
        model.state.invGridCollapsed = !model.state.invGridCollapsed;
        await saveState(); renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-inv-collect-overflow', 'click', async () => {
      try {
        const moved = collectOverflowToInventory();
        await saveDb(); await saveState();
        renderApp();
        toast(`오버플로우 회수: ${moved}개 이동`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-inv-clear-overflow', 'click', async () => {
      clearInventoryOverflow();
      await saveDb(); await saveState();
      renderApp();
      toast('오버플로우 비우기 완료');
    });
    on('[data-supply-add]', 'click', async (ev) => {
      try {
        const kind = ev.currentTarget.getAttribute('data-supply-add') || '';
        const res = grantInventoryItem(buildSupplyItem(kind, 1));
        if (!res.ok) throw new Error('보급품 추가 실패');
        await saveDb(); await saveState(); renderApp(); toast('보급품 추가');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-supply-remove]', 'click', async (ev) => {
      try {
        const kind = ev.currentTarget.getAttribute('data-supply-remove') || '';
        const ok = consumeInventoryById(`supply_${kind}`, 1);
        if (!ok) throw new Error('해당 보급품이 없다.');
        await saveDb(); await saveState(); renderApp(); toast('보급품 차감');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-pickaxe-add]', 'click', async (ev) => {
      try {
        const rank = ev.currentTarget.getAttribute('data-pickaxe-add') || 'E';
        const res = grantInventoryItem(buildPickaxeItem(rank, 1));
        if (!res.ok) throw new Error('곡괭이 추가 실패');
        await saveDb(); await saveState(); renderApp(); toast(`${rank}급 곡괭이 추가`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-pickaxe-remove]', 'click', async (ev) => {
      try {
        const rank = ev.currentTarget.getAttribute('data-pickaxe-remove') || 'E';
        const ok = consumeInventoryById(`pickaxe_${rank}`, 1);
        if (!ok) throw new Error('해당 등급 곡괭이가 없다.');
        await saveDb(); await saveState(); renderApp(); toast(`${rank}급 곡괭이 차감`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('[data-inv-drop-one]', 'click', async (ev) => {
      removeInventoryItem(ev.currentTarget.getAttribute('data-inv-drop-one') || '', 'one');
      await saveDb(); await saveState();
      renderApp();
    });
    on('[data-inv-drop-all]', 'click', async (ev) => {
      removeInventoryItem(ev.currentTarget.getAttribute('data-inv-drop-all') || '', 'all');
      await saveDb(); await saveState();
      renderApp();
    });
    // ── 아이템 사용 핸들러 (식품/보급품 소비) ────────────────────────────────
    on('[data-inv-use]', 'click', async (ev) => {
      try {
        const key = ev.currentTarget.getAttribute('data-inv-use') || '';
        const inv = getInventory();
        const it = (inv.items||[]).find(i => inventoryItemKey(i) === key);
        if (!it) { toast('아이템을 찾을 수 없다.', true); return; }
        removeInventoryItem(key, 'one');
        await saveDb(); await saveState(); renderApp();
        toast(`${it.name} 사용 완료.`);
      } catch(e) { toast(e.message||String(e), true); }
    });
    // ── 골드 이동 핸들러 ─────────────────────────────────────────────────────
    on('[data-gold-to-shared]', 'click', async (ev) => {
      try {
        const id = ev.currentTarget.getAttribute('data-gold-to-shared') || '';
        const xType = ev.currentTarget.getAttribute('data-gold-xfer-type') || 'char';
        const amtEl = document.getElementById(`gb-gold-xfer-amt-${id}`);
        const amt = Math.floor(Number(amtEl ? amtEl.value : 0) || 0);
        if (amt <= 0) { toast('이동할 금액을 입력하라.', true); return; }
        const list = xType === 'persona' ? (model.db.personas||[]) : (model.db.characters||[]);
        const m = list.find(c => c.id === id);
        if (!m) { toast('캐릭터를 찾을 수 없다.', true); return; }
        const mGold = Number((m.inventory && m.inventory.gold) || 0);
        if (mGold < amt) { toast(`소지금 부족 (보유: ${mGold.toLocaleString('en-US')}원)`, true); return; }
        if (!m.inventory) m.inventory = { items:[], equipped:{} };
        m.inventory.gold = mGold - amt;
        const inv = getInventory();
        inv.gold = Number(inv.gold||0) + amt;
        await saveDb(); renderApp();
        toast(`💸 ${m.name} → 공용 ${amt.toLocaleString('en-US')}원 이동 완료`);
      } catch(e) { toast(e.message || String(e), true); }
    });
    on('[data-gold-from-shared]', 'click', async (ev) => {
      try {
        const id = ev.currentTarget.getAttribute('data-gold-from-shared') || '';
        const xType = ev.currentTarget.getAttribute('data-gold-xfer-type') || 'char';
        const amtEl = document.getElementById(`gb-gold-xfer-amt-${id}`);
        const amt = Math.floor(Number(amtEl ? amtEl.value : 0) || 0);
        if (amt <= 0) { toast('이동할 금액을 입력하라.', true); return; }
        const inv = getInventory();
        const sharedGold = Number(inv.gold||0);
        if (sharedGold < amt) { toast(`공용 소지금 부족 (보유: ${sharedGold.toLocaleString('en-US')}원)`, true); return; }
        const list = xType === 'persona' ? (model.db.personas||[]) : (model.db.characters||[]);
        const m = list.find(c => c.id === id);
        if (!m) { toast('캐릭터를 찾을 수 없다.', true); return; }
        if (!m.inventory) m.inventory = { items:[], equipped:{} };
        inv.gold = sharedGold - amt;
        m.inventory.gold = Number((m.inventory.gold)||0) + amt;
        await saveDb(); renderApp();
        toast(`💸 공용 → ${m.name} ${amt.toLocaleString('en-US')}원 이동 완료`);
      } catch(e) { toast(e.message || String(e), true); }
    });
    on('[data-dbtab]', 'click', async (ev) => {
      model.state.dbTab = ev.currentTarget.getAttribute('data-dbtab');
      await saveState();
      renderApp();
    });
    // ── 파티 뷰 핸들러 ────────────────────────────────────────────────────────
    on('[data-party-assign]', 'click', async (ev) => {
      const idx = parseInt(ev.currentTarget.getAttribute('data-party-assign'), 10);
      const sel = document.getElementById(`gb-party-assign-${idx}`);
      if (!sel || !sel.value) { toast('캐릭터를 선택하세요.', true); return; }
      if (!model.db.battleSetup) model.db.battleSetup = { partySlots:[], enemySlots:[] };
      if (!model.db.battleSetup.partySlots) model.db.battleSetup.partySlots = [];
      model.db.battleSetup.partySlots[idx] = sel.value;
      await saveDb(); renderApp();
    });
    on('[data-party-remove]', 'click', async (ev) => {
      const idx = parseInt(ev.currentTarget.getAttribute('data-party-remove'), 10);
      if (!model.db.battleSetup || !model.db.battleSetup.partySlots) return;
      model.db.battleSetup.partySlots[idx] = '';
      await saveDb(); renderApp();
    });
    on('#gb-party-save-all', 'click', async () => {
      await saveDb();
      toast('파티 편성 저장 완료');
    });
    on('[data-party-statup]', 'click', async (ev) => {
      const [charId, statKey] = (ev.currentTarget.getAttribute('data-party-statup') || '').split(':');
      if (!charId || !statKey) return;
      const allUnits = (model.db.characters || []).concat(model.db.personas || []);
      const unit = allUnits.find(u => u.id === charId);
      if (!unit) { toast('캐릭터를 찾을 수 없습니다.', true); return; }
      if (!unit.freeStatPoints || unit.freeStatPoints <= 0) { toast('배분 가능한 스탯포인트가 없습니다.', true); return; }
      if (!unit.stats) unit.stats = { str:0, con:0, int:0, agi:0, sense:0 };
      const cap = STAT_CAP_BY_RANK[unit.rank || 'E'] || STAT_CAP_BY_RANK.E;
      if ((unit.stats[statKey] || 0) >= cap) { toast(`${statKey} 스탯이 상한(${cap})에 도달했습니다.`, true); return; }
      unit.stats[statKey] = (unit.stats[statKey] || 0) + 1;
      unit.freeStatPoints -= 1;
      // 스탯 효과 자동 반영 (장착 무기 ATK 포함)
      recalcCharDerivedStats(unit);
      await saveDb(); renderApp();
      toast(`${unit.name}: ${statKey} +1 (잔여 ${unit.freeStatPoints}포인트)`);
    });
    on('[data-party-inv]', 'click', async (ev) => {
      model.state.partyInvTarget = ev.currentTarget.getAttribute('data-party-inv') || '';
      await saveState(); renderApp();
    });
    on('[data-party-inv-close]', 'click', async () => {
      model.state.partyInvTarget = '';
      await saveState(); renderApp();
    });
    // ── 캐릭터 뷰 핸들러 ──────────────────────────────────────────────────────
    on('[data-charview-tab]', 'click', async (ev) => {
      model.state.charViewTab = ev.currentTarget.getAttribute('data-charview-tab');
      model.state.charViewSelected = '';
      await saveState(); renderApp();
    });
    on('[data-charview-select]', 'click', async (ev) => {
      model.state.charViewSelected = ev.currentTarget.getAttribute('data-charview-select');
      await saveState(); renderApp();
    });
    on('[data-charview-statup]', 'click', async (ev) => {
      const [charId, statKey] = (ev.currentTarget.getAttribute('data-charview-statup') || '').split(':');
      if (!charId || !statKey) return;
      const allUnits = (model.db.characters || []).concat(model.db.personas || []);
      const unit = allUnits.find(u => u.id === charId);
      if (!unit) { toast('캐릭터를 찾을 수 없습니다.', true); return; }
      if (!unit.freeStatPoints || unit.freeStatPoints <= 0) { toast('배분 가능한 스탯포인트가 없습니다.', true); return; }
      if (!unit.stats) unit.stats = { str:0, con:0, int:0, agi:0, sense:0 };
      const cap = STAT_CAP_BY_RANK[unit.rank || 'E'] || STAT_CAP_BY_RANK.E;
      if ((unit.stats[statKey] || 0) >= cap) { toast(`${statKey} 스탯이 상한(${cap})에 도달했습니다.`, true); return; }
      unit.stats[statKey] = (unit.stats[statKey] || 0) + 1;
      unit.freeStatPoints -= 1;
      // 스탯 효과 자동 반영 (장착 무기 ATK 포함)
      recalcCharDerivedStats(unit);
      await saveDb(); renderApp();
      toast(`${unit.name}: ${statKey} +1 (잔여 ${unit.freeStatPoints}포인트)`);
    });
    on('[data-select-type]', 'click', async (ev) => {
      const type = ev.currentTarget.getAttribute('data-select-type');
      const id = ev.currentTarget.getAttribute('data-id');
      model.state.selected[type] = id;
      await saveState();
      renderApp();
    });
    on('[data-gate-rank]', 'click', async (ev) => {
      const gs = gateStateSafe();
      gs.rank = String(ev.currentTarget.getAttribute('data-gate-rank') || 'E').toUpperCase();
      generateGateOptions(gs.size || 'small', gs.rank);
      await saveState();
      renderApp();
    });
    on('[data-gate-size]', 'click', async (ev) => {
      const gs = gateStateSafe();
      generateGateOptions(ev.currentTarget.getAttribute('data-gate-size'), gs.rank || 'E');
      await saveState();
      renderApp();
    });
    on('#gb-gate-reroll', 'click', async () => {
      const gs = gateStateSafe();
      generateGateOptions(gs.size || 'small', gs.rank || 'E');
      await saveState();
      renderApp();
    });
    on('[data-gate-select]', 'click', async (ev) => {
      gateStateSafe().selectedId = ev.currentTarget.getAttribute('data-gate-select') || '';
      await saveState();
      renderApp();
    });
    on('#gb-gate-reroll-one', 'click', async () => {
      const gs = gateStateSafe();
      const idx = (gs.generated || []).findIndex(g => g.id === gs.selectedId);
      if (idx < 0) return toast('선택된 게이트가 없다.', true);
      gs.generated[idx] = generateGateOption(gs.size || 'small', idx, gs.rank || 'E');
      gs.selectedId = gs.generated[idx].id;
      await saveState();
      renderApp();
    });
    on('#gb-gate-apply', 'click', async () => {
      try {
        await applyGateSelectionToBattle(false);
        toast('선택 게이트를 적 편성에 반영했다.');
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-gate-apply-go', 'click', async () => {
      try {
        await applyGateSelectionToBattle(true);
        toast('게이트를 반영하고 전투 화면으로 이동했다.');
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-gate-run-start', 'click', async () => {
      try {
        if (activeGateRun()) { toast('이미 진행 중인 게이트가 있다.'); return; }
        beginGateRunFromSelectedGate();
        model.state.gateRunTab = 'main';
        await saveState();
        renderApp();
        toast('게이트에 진입했다.');
      } catch (e) { toast(e.message || String(e), true); }
    });
    // Gate run tab switching
    on('[data-gate-run-tab]', 'click', (ev) => {
      model.state.gateRunTab = ev.currentTarget.getAttribute('data-gate-run-tab') || 'main';
      model.state.gatePartyDetailId = '';
      renderApp();
    });
    // 게이트 파티탭 파티원 클릭 → 상세 펼침/접기
    on('[data-gate-party-detail]', 'click', (ev) => {
      const uid = ev.currentTarget.getAttribute('data-gate-party-detail') || '';
      model.state.gatePartyDetailId = (model.state.gatePartyDetailId === uid) ? '' : uid;
      renderApp();
    });
    // Gate fullscreen close → return to hub view
    on('#gb-gate-fullscreen-close', 'click', () => {
      model.state.view = 'hub';
      renderApp();
    });
    on('[data-stage-choice]', 'click', async (ev) => {
      try {
        const run = getGateRun();
        if (run && run.sideRoomActive) throw new Error('비밀방을 먼저 처리해야 한다.');
        const stage = getCurrentStage(run);
        if (!run || !stage || stage.kind !== 'choice') throw new Error('현재 갈림길이 아니다.');
        stage.chosen = ev.currentTarget.getAttribute('data-stage-choice') || '';
        const room = getActiveRoom(run);
        if (room) room.discovered = false;
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-enter', 'click', async () => {
      try {
        const run = getGateRun();
        if (!run) throw new Error('진행 중인 게이트가 없다.');
        // 이미 전투가 진행 중이면 중복 진입 방지
        const rt = model.state.runtime;
        if (rt && rt.started && !rt.finished) {
          toast('⚠️ 이미 전투가 진행 중입니다.', true);
          return;
        }
        enterGateRoom(run);
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-solve-puzzle', 'click', async () => {
      try {
        const run = getGateRun();
        const room = getActiveRoom(run);
        if (!run || !room || room.type !== 'puzzle') throw new Error('현재 퍼즐방이 아니다.');
        resolvePuzzleRoom(run, room);
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-open-secret', 'click', async () => {
      try {
        const run = getGateRun();
        const room = getActiveRoom(run);
        if (!run || !room || room.type !== 'secret') throw new Error('현재 비밀방이 아니다.');
        resolveSecretRoom(run, room);
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-mine', 'click', async () => {
      try {
        const run = getGateRun();
        const room = getActiveRoom(run);
        const lines = mineGateRoom(run, room);
        await saveDb(); await saveState();
        renderApp();
        toast(lines.length ? '광맥 채굴 완료' : '채굴 결과 없음');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-next', 'click', async () => {
      try {
        const run = getGateRun();
        continueAfterClearedRoom(run);
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-retreat', 'click', async () => {
      try {
        retreatFromGateRun(getGateRun());
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-camp', 'click', async () => {
      try {
        const run = getGateRun();
        if (!run) throw new Error('진행 중인 게이트가 없다.');
        const lines = campGateParty(run);
        await saveState();
        renderApp();
        toast(lines.length ? '야영 완료' : '야영 완료');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-room-skip-camp', 'click', async () => {
      try {
        const run = getGateRun();
        if (!run) throw new Error('진행 중인 게이트가 없다.');
        skipCampRoom(run);
        await saveState();
        renderApp();
        toast('야영지 통과');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-secret-enter', 'click', async () => {
      try {
        const run = getGateRun();
        if (!run || !run.secretPlan || !run.secretPlan.offered) throw new Error('발견된 비밀방이 없다.');
        run.sideRoomActive = true;
        run.secretPlan.room.discovered = true;
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-secret-skip', 'click', async () => {
      try {
        const run = getGateRun();
        if (!run || !run.secretPlan || !run.secretPlan.offered) throw new Error('발견된 비밀방이 없다.');
        run.secretPlan.offered = false;
        run.secretPlan.resolved = true;
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });

    on('#gb-save-setup', 'click', async () => {
      model.db.battleSetup.partySlots = readPartySlotsFromUI();
      model.db.battleSetup.enemySlots = readEnemySlotsFromUI();
      await saveDb(); await saveState();
      toast('편성 저장 완료');
    });
    on('#gb-start-battle', 'click', async () => {
      try {
        // 게이트 진행 중에는 전투탭 전투시작 차단 (게이트가 초기화되는 것 방지)
        if (activeGateRun()) {
          toast('⚠️ 게이트 진행 중에는 전투 탭에서 전투를 시작할 수 없습니다. 게이트 내 전투를 이용하세요.', true);
          return;
        }
        model.db.battleSetup.partySlots = readPartySlotsFromUI();
        model.db.battleSetup.enemySlots = readEnemySlotsFromUI();
        buildBattleFromSetup();
        await saveDb(); await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });

    on('#gb-run-round', 'click', async () => {
      try {
        collectPendingActions();
        resolveOneRound();
        autoHandleFinishedGateBattle();
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-auto-one', 'click', async () => {
      try {
        const runtime = model.state.runtime;
        const pending = {};
        getAlive(runtime.party).forEach(u => { pending[u.uid] = { mode:'auto' }; });
        runtime.pendingActions = pending;
        resolveOneRound();
        autoHandleFinishedGateBattle();
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-auto-battle', 'click', async () => {
      try {
        autoResolveBattle(30);
        autoHandleFinishedGateBattle();
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-battle-potion', 'click', () => {
      const rt = model.state.runtime;
      rt.showPotionPanel = !rt.showPotionPanel;
      renderApp();
    });
    on('#gb-battle-potion-close', 'click', () => {
      model.state.runtime.showPotionPanel = false;
      renderApp();
    });
    on('#gb-battle-potion-apply', 'click', async () => {
      try {
        const rt = model.state.runtime;
        const potionKey = fieldValue('#gb-battle-potion-select');
        const targetUid = fieldValue('#gb-battle-potion-target');
        if (!potionKey) throw new Error('물약을 선택해.');
        if (!targetUid) throw new Error('대상을 선택해.');
        const inv = getActiveInventory();
        const potionItem = inv.items.find(it => it.stackKey === potionKey);
        if (!potionItem) throw new Error('해당 물약을 찾을 수 없다.');
        const target = rt.party.find(u => u.uid === targetUid);
        if (!target || target.dead || target.hp <= 0) throw new Error('대상이 유효하지 않다.');
        const msg = usePotionOnUnit(potionItem, target);
        consumePotionFromInventory(potionKey);
        await saveState();
        renderApp();
        toast(msg);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-reset-battle', 'click', async () => {
      model.state.runtime = buildDefaultRuntime();
      await saveState();
      renderApp();
    });
    on('#gb-copy-llm', 'click', async () => {
      const text = model.state.runtime.llmBlock || '';
      if (!text) return toast('복사할 결과 블록이 아직 없다.', true);
      try { await navigator.clipboard.writeText(text); toast('결과 블록 복사 완료'); }
      catch (e) { toast('클립보드 복사 실패', true); }
    });
    on('#gb-postbattle-copy-llm', 'click', async () => {
      const run = getGateRun();
      const text = run && run.postBattle ? String(run.postBattle.llmBlock || '') : '';
      if (!text) return toast('복사할 결과 블록이 없다.', true);
      try { await navigator.clipboard.writeText(text); toast('결과 블록 복사 완료'); }
      catch (e) { toast('클립보드 복사 실패', true); }
    });
    on('#gb-postbattle-next', 'click', async () => {
      try {
        const run = getGateRun();
        continueAfterGateBattle(run);
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-postbattle-rest', 'click', async () => {
      try {
        const run = getGateRun();
        const lines = restGateParty(run);
        toast(lines.length ? '휴식 완료' : '휴식 완료');
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-postbattle-mine', 'click', async () => {
      try {
        const run = getGateRun();
        const room = run && run.postBattle ? getRoomById(run, run.postBattle.roomId) : null;
        const lines = mineGateRoom(run, room);
        await saveDb(); await saveState();
        renderApp();
        toast(lines.length ? '광맥 채굴 완료' : '채굴 결과 없음');
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-postbattle-potion', 'click', () => {
      const run = getGateRun();
      if (run) { run.showPotionPanel = !run.showPotionPanel; renderApp(); }
    });
    on('#gb-pb-potion-close', 'click', () => {
      const run = getGateRun();
      if (run) { run.showPotionPanel = false; renderApp(); }
    });
    on('#gb-pb-potion-apply', 'click', async () => {
      try {
        const run = getGateRun();
        if (!run) throw new Error('게이트 런을 찾을 수 없다.');
        const potionKey = fieldValue('#gb-pb-potion-select');
        const targetIdx = Number(fieldValue('#gb-pb-potion-target'));
        if (!potionKey) throw new Error('물약을 선택해.');
        const party = (run.partyState || []).filter(u => Number(u.currentHp || u.hp || 0) > 0);
        const target = party[targetIdx];
        if (!target) throw new Error('대상이 유효하지 않다.');
        const inv = getActiveInventory();
        const potionItem = inv.items.find(it => it.stackKey === potionKey);
        if (!potionItem) throw new Error('해당 물약을 찾을 수 없다.');
        const msg = usePotionOnUnit(potionItem, target);
        consumePotionFromInventory(potionKey);
        await saveDb(); await saveState();
        renderApp();
        toast(msg);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-postbattle-retreat', 'click', async () => {
      try {
        retreatFromGateRun(getGateRun());
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-gate-battle-win', 'click', async () => {
      try {
        resolveGateBattleAftermath(true);
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-gate-battle-fail', 'click', async () => {
      try {
        resolveGateBattleAftermath(false);
        await saveState();
        renderApp();
      } catch (e) { toast(e.message || String(e), true); }
    });

    on('#gb-char-new', 'click', async () => {
      model.state.selected.characters = '';
      await saveState();
      renderApp();
    });
    on('#gb-char-save', 'click', async () => { try { await saveCharacterFromForm(); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-char-delete', 'click', async () => { try { await deleteSelected('characters'); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-char-clear-all', 'click', async () => { try { await clearAllCharacters(); } catch (e) { toast(e.message || String(e), true); } });

    on('#gb-mon-new', 'click', async () => { model.state.selected.monsters = ''; await saveState(); renderApp(); });
    on('#gb-mon-save', 'click', async () => { try { await saveMonsterFromForm(); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-mon-delete', 'click', async () => { try { await deleteSelected('monsters'); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-mon-clear-all', 'click', async () => { try { await clearAllMonsters(); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-mon-export-json', 'click', async () => {
      const el = model.root && model.root.querySelector('#gb-mon-json');
      if (el) el.value = exportMonstersJsonText();
      toast('몬스터 JSON 내보내기 완료');
    });
    on('#gb-mon-import-json', 'click', async () => {
      try { await importMonstersJsonFromText(fieldValue('#gb-mon-json')); }
      catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-mon-copy-json', 'click', async () => {
      try {
        const text = fieldValue('#gb-mon-json') || exportMonstersJsonText();
        await navigator.clipboard.writeText(text);
        toast('JSON 복사 완료');
      } catch (e) { toast('복사 실패', true); }
    });

    on('#gb-persona-new', 'click', async () => { model.state.selected.personas = ''; await saveState(); renderApp(); });
    on('#gb-persona-save', 'click', async () => { try { await savePersonaFromForm(); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-persona-delete', 'click', async () => { try { await deleteSelected('personas'); } catch (e) { toast(e.message || String(e), true); } });

    // ── 개인 인벤토리 탭 전환 ──
    on('[data-personal-inv-tab]', 'click', async (ev) => {
      const raw = ev.currentTarget.getAttribute('data-personal-inv-tab') || '';
      const [type, tab] = raw.split(':');
      if (type === 'persona') model.state.personaInvTab = tab || 'equip';
      else model.state.charInvTab = tab || 'equip';
      await saveState(); renderApp();
    });
    // ── 개인 장착 (개인인벤 → 장비슬롯) ──
    on('[data-personal-equip]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-personal-equip') || '';
        const parts = raw.split(':');
        const type = parts[0], entityId = parts[1];
        const ikey = parts.slice(2).join(':');
        const inv = getPersonalInv(type, entityId);
        if (!inv) throw new Error('개인 인벤 없음');
        const idx = (inv.items||[]).findIndex(it => inventoryItemKey(it) === ikey);
        if (idx < 0) throw new Error('장착할 아이템을 개인 인벤에서 찾을 수 없다.');
        const it = inv.items[idx];
        // 가방은 bag 슬롯에, 장비는 part 슬롯에 장착
        const isBag = it.category === 'bag';
        const slot = isBag ? 'bag' : (it.part || 'weapon');
        // 기존 장착 해제 → 개인 인벤으로 반환
        if (inv.equipped[slot]) inv.items.push(inv.equipped[slot]);
        if (!isBag) {
          // 첫 장착 시 내구도 maxDurability 감소 (100→99)
          applyFirstEquip(it);
        }
        inv.equipped[slot] = it;
        inv.items.splice(idx, 1);
        // 가방 장착 시 캐릭터 bagId 동기화
        const arr = type === 'persona' ? (model.db.personas || []) : (model.db.characters || []);
        const entity = arr.find(x => x.id === entityId);
        if (isBag) {
          if (entity) entity.bagId = it.bagId || it.id;
        }
        // 장비 장착 후 캐릭터 파생 스탯 재계산 (ATK/HP/MP/SP 등)
        if (entity && entity.stats) recalcCharDerivedStats(entity);
        await saveDb(); await saveState(); renderApp();
        const msg = isBag ? `🎒 ${it.name} 가방 장착 완료` : `⚔️ ${it.name} 장착 완료 (${EQUIP_PART_LABELS[slot]||slot}) — 내구도 ${it.durability}/${it.maxDurability}`;
        toast(msg);
      } catch(e) { toast(e.message||String(e), true); }
    });
    // ── 개인 해제 (장비슬롯 → 개인인벤) ──
    on('[data-personal-unequip]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-personal-unequip') || '';
        const [type, entityId, slot] = raw.split(':');
        const inv = getPersonalInv(type, entityId);
        if (!inv || !inv.equipped[slot]) throw new Error('해제할 장비 없음');
        const it = inv.equipped[slot];
        inv.equipped[slot] = null;
        if (!Array.isArray(inv.items)) inv.items = [];
        inv.items.push(it);
        // 가방 해제 시 캐릭터 bagId 초기화
        const arr = type === 'persona' ? (model.db.personas || []) : (model.db.characters || []);
        const entity = arr.find(x => x.id === entityId);
        if (slot === 'bag') {
          if (entity) entity.bagId = 'none';
        }
        // 장비 해제 후 캐릭터 파생 스탯 재계산
        if (entity && entity.stats) recalcCharDerivedStats(entity);
        await saveDb(); await saveState(); renderApp();
        toast(`↩️ ${it.name} 해제 완료`);
      } catch(e) { toast(e.message||String(e), true); }
    });
    // ── 공용 인벤 → 개인 인벤 이동 ──
    on('[data-shared-to-personal]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-shared-to-personal') || '';
        const parts = raw.split(':');
        const type = parts[0], entityId = parts[1];
        const ikey = parts.slice(2).join(':');
        const sharedInv = getInventory();
        const idx = (sharedInv.items||[]).findIndex(it => inventoryItemKey(it) === ikey);
        if (idx < 0) throw new Error('공용 인벤에서 아이템을 찾을 수 없다.');
        const it = deepClone(sharedInv.items[idx]);
        sharedInv.items.splice(idx, 1);
        const personalInv = getPersonalInv(type, entityId);
        if (!personalInv) throw new Error('개인 인벤 없음');
        if (!Array.isArray(personalInv.items)) personalInv.items = [];
        personalInv.items.push(it);
        await saveDb(); await saveState(); renderApp();
        toast(`📦 ${it.name} → 개인 인벤 이동 완료`);
      } catch(e) { toast(e.message||String(e), true); }
    });
    // ── 개인 인벤 → 공용 인벤 이동 ──
    on('[data-personal-to-shared]', 'click', async (ev) => {
      try {
        const raw = ev.currentTarget.getAttribute('data-personal-to-shared') || '';
        const parts = raw.split(':');
        const type = parts[0], entityId = parts[1];
        const ikey = parts.slice(2).join(':');
        const personalInv = getPersonalInv(type, entityId);
        if (!personalInv) throw new Error('개인 인벤 없음');
        const idx = (personalInv.items||[]).findIndex(it => inventoryItemKey(it) === ikey);
        if (idx < 0) throw new Error('개인 인벤에서 아이템을 찾을 수 없다.');
        const it = deepClone(personalInv.items[idx]);
        personalInv.items.splice(idx, 1);
        grantInventoryItem(it);
        await saveDb(); await saveState(); renderApp();
        toast(`📦 ${it.name} → 공용 인벤 이동 완료`);
      } catch(e) { toast(e.message||String(e), true); }
    });

    on('#gb-mat-new', 'click', async () => { model.state.selected.materials = ''; await saveState(); renderApp(); });
    on('#gb-mat-save', 'click', async () => { try { await saveMaterialTraitFromForm(); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-mat-delete', 'click', async () => { try { await deleteSelected('materials'); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-mat-export-json', 'click', async () => {
      const el = model.root && model.root.querySelector('#gb-mat-json');
      if (el) el.value = exportRareTraitsJsonText();
      toast('희귀재료 특성 JSON 내보내기 완료');
    });
    on('#gb-mat-import-json', 'click', async () => {
      try { await importMaterialJsonFromText(fieldValue('#gb-mat-json')); }
      catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-mat-copy-json', 'click', async () => {
      try {
        const text = fieldValue('#gb-mat-json') || exportRareTraitsJsonText();
        await navigator.clipboard.writeText(text);
        toast('희귀재료 특성 JSON 복사 완료');
      } catch (e) { toast('복사 실패', true); }
    });

    // 대상 선택 시 계수 자동 채우기 (수정 가능)
    on('#gb-skill-target', 'change', () => {
      const grade = fieldValue('#gb-skill-grade') || 'E';
      const target = fieldValue('#gb-skill-target') || 'singleEnemy';
      const singleCoefs = { E:1.2, D:1.92, C:2.88, B:4.8, A:7.68, S:11.52 };
      const baseCoef = singleCoefs[grade] || 1.2;
      let coef = baseCoef;
      if (target === 'allEnemies' || target === 'allAllies') coef = Math.round(baseCoef * 0.58 * 1000) / 1000;
      else if (target.startsWith('row')) coef = Math.round(baseCoef * 0.58 * 1000) / 1000;
      const el = model.root && model.root.querySelector('#gb-skill-coef');
      if (el) el.value = coef;
    });
    on('#gb-skill-grade', 'change', () => {
      const grade = fieldValue('#gb-skill-grade') || 'E';
      const target = fieldValue('#gb-skill-target') || 'singleEnemy';
      const singleCoefs = { E:1.2, D:1.92, C:2.88, B:4.8, A:7.68, S:11.52 };
      const baseCoef = singleCoefs[grade] || 1.2;
      let coef = baseCoef;
      if (target === 'allEnemies' || target === 'allAllies') coef = Math.round(baseCoef * 0.58 * 1000) / 1000;
      else if (target.startsWith('row')) coef = Math.round(baseCoef * 0.58 * 1000) / 1000;
      const el = model.root && model.root.querySelector('#gb-skill-coef');
      if (el) el.value = coef;
    });

    on('#gb-skill-new', 'click', async () => { model.state.selected.skills = ''; await saveState(); renderApp(); });
    on('#gb-skill-save', 'click', async () => { try { await saveSkillFromForm(); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-skill-delete', 'click', async () => { try { await deleteSelected('skills'); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-skill-clear-all', 'click', async () => { try { await clearAllCustomSkills(); } catch (e) { toast(e.message || String(e), true); } });
    // 스킬 JSON 가져오기/내보내기
    on('#gb-skill-export-json', 'click', async () => {
      const el = model.root && model.root.querySelector('#gb-skill-json');
      if (el) el.value = exportSkillsJsonText();
      toast('스킬 JSON 내보내기 완료');
    });
    on('#gb-skill-import-json', 'click', async () => {
      try { await importSkillsJsonFromText(fieldValue('#gb-skill-json')); }
      catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-skill-copy-json', 'click', async () => {
      try {
        const text = fieldValue('#gb-skill-json') || exportSkillsJsonText();
        await navigator.clipboard.writeText(text);
        toast('스킬 JSON 복사 완료');
      } catch (e) { toast('복사 실패', true); }
    });
    // 내장 스킬 카테고리 아코디언 토글
    on('[data-accordion-cat]', 'click', (ev) => {
      const catKey = ev.currentTarget.getAttribute('data-accordion-cat');
      const accordion = ev.currentTarget.closest('.gb-skill-accordion');
      if (!accordion) return;
      const body = accordion.querySelector('[data-accordion-body="' + catKey + '"]');
      if (!body) return;
      const isOpen = accordion.classList.contains('open');
      if (isOpen) {
        accordion.classList.remove('open');
        body.style.display = 'none';
      } else {
        accordion.classList.add('open');
        body.style.display = '';
      }
    });
    // 내장 스킬 클릭 → 편집기로 불러오기
    on('[data-load-builtin-skill]', 'click', async (ev) => {
      const skillId = ev.currentTarget.getAttribute('data-load-builtin-skill');
      if (skillId) {
        model.state.selected.skills = skillId;
        await saveState(); renderApp();
        toast(`📝 내장 스킬 "${skillId}" 편집기에 로드됨`);
      }
    });
    // 내장 스킬 원본 복원 (오버라이드 삭제)
    on('#gb-skill-restore', 'click', async () => {
      const selId = model.state.selected.skills;
      if (!selId || !BUILTIN_SKILLS[selId]) return;
      model.db.customSkills = (model.db.customSkills || []).filter(x => x.id !== selId);
      await saveDb(); await saveState(); renderApp();
      toast(`↩️ "${selId}" 원본으로 복원 완료`);
    });

    // Equipment tab handlers
    on('#gb-eq-new', 'click', async () => { model.state.selected.equipment = ''; await saveState(); renderApp(); });
    // SME type change → re-populate effect dropdown (skill)
    on('#gb-skill-sme-type', 'change', () => {
      const typeEl = model.root && model.root.querySelector('#gb-skill-sme-type');
      const effectEl = model.root && model.root.querySelector('#gb-skill-sme-effect');
      if (typeEl && effectEl) { effectEl.innerHTML = smeOptionsHtml('', typeEl.value); }
    });
    // SME type change → re-populate effect dropdown (equipment)
    on('#gb-eq-sme-type', 'change', () => {
      const typeEl = model.root && model.root.querySelector('#gb-eq-sme-type');
      const effectEl = model.root && model.root.querySelector('#gb-eq-sme-effect');
      if (typeEl && effectEl) { effectEl.innerHTML = smeOptionsHtml('', typeEl.value); }
    });
    on('#gb-eq-save', 'click', async () => { try { await saveEquipmentFromForm(); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-eq-delete', 'click', async () => { try { await deleteSelected('equipment'); } catch (e) { toast(e.message || String(e), true); } });
    on('#gb-eq-send-inventory', 'click', async () => {
      try {
        const sel = model.state.selected.equipment;
        if (!sel) throw new Error('장비를 선택해 주세요.');
        const equips = model.db.equipments || [];
        const item = equips.find(e => e.id === sel);
        if (!item) throw new Error('선택된 장비를 찾을 수 없습니다.');
        // 커스텀 장비를 공용 인벤토리에 추가 (addInventoryItem → model.db.inventory)
        const invItem = {
          category: 'equipment',
          stackable: false,
          unitWeightG: EQUIP_WEIGHT_G[item.part] || 1000,
          stackKey: `equipment:custom_${item.id}_${Date.now()}`,
          name: item.name || item.id,
          part: item.part,
          rank: item.rank,
          rarity: item.rarity || 'Normal',
          enhance: item.enhance || 0,
          infuse: item.infuse || 0,
          maxInfuse: item.maxInfuse || 2,
          traits: Array.isArray(item.traits) ? item.traits.slice() : [],
          durability: item.durability != null ? item.durability : 100,
          maxDurability: item.maxDurability != null ? item.maxDurability : 100,
          atk: item.atk || 0,
          pdef: item.pdef || 0,
          mdef: item.mdef || 0,
          mainStat: item.mainStat || '',
          resistType: item.resistType || '',
          resistPct: item.resistPct || 0,
          specialEffect: item.specialEffect || '',
          specialEffectChance: item.specialEffectChance || 0,
          specialEffectValue: item.specialEffectValue || 0,
          statusEffect: item.statusEffect || '',
          statusEffectChance: item.statusEffectChance || 0,
          armorSubtype: item.armorSubtype || '',
          price: item.price || 0,
          note: item.note || '',
          count: 1
        };
        const res = addInventoryItem(invItem);
        if (!res.ok) pushInventoryOverflow(invItem);
        await saveDb();
        toast(`📦 ${item.name || item.id} → 공용 인벤토리 ${res.ok ? '추가 완료' : '(오버플로우에 추가됨)'}`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-eq-export', 'click', async () => {
      const text = JSON.stringify({ equipments: model.db.equipments || [] }, null, 2);
      const el = model.root && model.root.querySelector('#gb-eq-json');
      if (el) el.value = text;
      try { await navigator.clipboard.writeText(text); toast('장비 JSON 복사 완료'); } catch { toast('JSON 내보내기 완료 (클립보드 실패)'); }
    });
    on('#gb-eq-import-json', 'click', async () => {
      try {
        const raw = fieldValue('#gb-eq-json');
        if (!raw) throw new Error('JSON이 비어 있다.');
        let parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed = { equipments: parsed };
        const list = parsed.equipments || parsed.equipment || [];
        if (!Array.isArray(list)) throw new Error('올바른 장비 배열이 아니다.');
        if (!Array.isArray(model.db.equipments)) model.db.equipments = [];
        list.forEach(e => { if (e && e.id) upsertById(model.db.equipments, e); });
        await saveDb(); await saveState(); renderApp(); toast(`장비 ${list.length}개 가져오기 완료`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    on('#gb-eq-calc-repair', 'click', () => {
      const sel = model.state.selected.equipment;
      const eq = (model.db.equipments || []).find(e => e.id === sel);
      if (!eq) return;
      const target = Number(fieldValue('#gb-eq-repair-target') || 100);
      const current = Number(eq.durability != null ? eq.durability : 100);
      const lost = Math.max(0, target - current);
      if (lost <= 0) { const el = model.root && model.root.querySelector('#gb-eq-repair-result'); if (el) el.textContent = '수리 불필요 (이미 충분)'; return; }
      const fee = calcRepairFee(eq.rank || 'E', eq.part || 'weapon', lost);
      const el = model.root && model.root.querySelector('#gb-eq-repair-result');
      if (el) el.textContent = `수리비: ${fee === 0 ? '무료 (E등급)' : fee.toLocaleString('en-US') + '원'} (${lost}% 회복)`;
    });
    on('[data-eq-part-filter]', 'click', async (ev) => {
      model.state.equipPartFilter = ev.currentTarget.getAttribute('data-eq-part-filter');
      await saveState(); renderApp();
    });
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${UI_ID} { position:fixed; inset:0; z-index:9999; font-family: Inter, Pretendard, sans-serif; pointer-events:none; }
      #${UI_ID} .hidden { display:none; }
      #${UI_ID} .gb-shell { background:#0f1117; color:#e2e8f0; height:100%; overflow:auto; padding:18px 18px 48px; pointer-events:auto; box-sizing:border-box; }
      #${UI_ID} .gb-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:16px; }
      #${UI_ID} .gb-title { font-size:22px; font-weight:800; }
      #${UI_ID} .gb-sub { color:#94a3b8; font-size:12px; line-height:1.45; }
      #${UI_ID} .gb-grid { display:grid; gap:12px; margin-bottom:12px; }
      #${UI_ID} .gb-grid.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
      #${UI_ID} .gb-grid.three { grid-template-columns:repeat(3,minmax(0,1fr)); }
      #${UI_ID} .gb-grid.four { grid-template-columns:repeat(4,minmax(0,1fr)); }
      #${UI_ID} .gb-grid.db { grid-template-columns:320px 1fr; }
      #${UI_ID} .gb-panel { background:#171a23; border:1px solid rgba(148,163,184,0.16); border-radius:14px; padding:12px; }
      #${UI_ID} .gb-section-title { font-size:14px; font-weight:700; margin-bottom:8px; }
      #${UI_ID} label { display:block; font-size:12px; color:#cbd5e1; margin-bottom:8px; }
      #${UI_ID} .gb-input, #${UI_ID} .gb-textarea, #${UI_ID} select { width:100%; box-sizing:border-box; background:#0b0d12; color:#e2e8f0; border:1px solid rgba(148,163,184,0.18); border-radius:10px; padding:8px 10px; margin-top:4px; }
      #${UI_ID} .gb-textarea { min-height:280px; resize:vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
      #${UI_ID} .gb-textarea.short { min-height:180px; }
      #${UI_ID} .gb-btn-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
      #${UI_ID} .gb-btn { background:#222734; color:#e2e8f0; border:1px solid rgba(148,163,184,0.22); border-radius:10px; padding:8px 12px; cursor:pointer; }
      #${UI_ID} .gb-btn.tiny { padding:3px 7px; font-size:11px; border-radius:7px; }
      #${UI_ID} .gb-btn.primary { background:#2563eb; border-color:#2563eb; }
      #${UI_ID} .gb-btn.active  { background:#1d4ed8; border-color:#3b82f6; }
      #${UI_ID} .gb-btn:hover, #${UI_ID} .gb-card-nav:hover, #${UI_ID} .gb-list-item:hover { filter:brightness(1.08); }
      #${UI_ID} .gb-card-nav { text-align:left; background:#171a23; color:#e2e8f0; border:1px solid rgba(148,163,184,0.16); border-radius:14px; padding:18px; cursor:pointer; }
      #${UI_ID} .gb-card-nav.is-selected { border-color:#2563eb; background:#12203f; }
      #${UI_ID} .gb-card-title { font-size:20px; font-weight:800; margin-bottom:8px; }
      #${UI_ID} .gb-rule { margin-top:8px; color:#f6ad55; font-size:12px; font-weight:700; }
      #${UI_ID} .gb-skill-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
      #${UI_ID} .gb-skill-row { background:#0b0d12; border:1px solid rgba(148,163,184,0.12); border-radius:10px; padding:8px; }
      #${UI_ID} .gb-skill-desc { font-size:11px; color:#94a3b8; margin-top:4px; line-height:1.35; }
      #${UI_ID} .gb-list-item { width:100%; text-align:left; display:block; background:#0b0d12; border:1px solid rgba(148,163,184,0.12); border-radius:10px; color:#e2e8f0; padding:10px; margin-bottom:8px; cursor:pointer; }
      #${UI_ID} .gb-list-item.is-active { border-color:#2563eb; background:#12203f; }
      #${UI_ID} .gb-badge { display:inline-block; font-size:10px; padding:2px 6px; border-radius:999px; background:rgba(59,130,246,0.18); color:#bfdbfe; border:1px solid rgba(59,130,246,0.22); margin-left:4px; }
      #${UI_ID} .gb-unit { border:1px solid rgba(148,163,184,0.15); border-radius:10px; padding:10px; margin-bottom:8px; background:#0b0d12; }
      #${UI_ID} .gb-unit.is-dead { opacity:0.55; }
      #${UI_ID} .gb-unit-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      #${UI_ID} .gb-bar-wrap { display:grid; grid-template-columns:96px 1fr; align-items:center; gap:8px; font-size:11px; margin-top:6px; }
      #${UI_ID} .gb-bar { height:8px; background:#1e293b; border-radius:999px; overflow:hidden; }
      #${UI_ID} .gb-bar-fill { height:100%; }
      #${UI_ID} .gb-bar-fill.hp { background:#ef4444; }
      #${UI_ID} .gb-bar-fill.mp { background:#3b82f6; }
      #${UI_ID} .gb-bar-fill.sp { background:#eab308; }
      #${UI_ID} .gb-log { font-size:12px; line-height:1.45; max-height:360px; overflow:auto; display:flex; flex-direction:column; gap:6px; }
      #${UI_ID} .gb-command-list { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
      #${UI_ID} .gb-command-row { display:grid; grid-template-columns:180px 140px 1fr 1fr; gap:8px; align-items:center; }
      #${UI_ID} .gb-dead { color:#fca5a5; font-size:11px; }
      #${UI_ID} .gb-stun { color:#fcd34d; font-size:11px; margin-left:4px; }
      #${UI_ID} .gb-buff { color:#93c5fd; font-size:11px; margin-left:4px; }
      #${UI_ID} .gb-debuff { color:#fca5a5; font-size:11px; margin-left:4px; }
      #${UI_ID} .gb-toast { position:fixed; right:20px; bottom:20px; background:#111827; color:#e2e8f0; border:1px solid rgba(148,163,184,0.2); border-radius:10px; padding:10px 12px; opacity:0; transform:translateY(8px); transition:all .18s ease; pointer-events:none; z-index:10000; }
      #${UI_ID} .gb-toast.show { opacity:1; transform:translateY(0); }
      #${UI_ID} .gb-toast.err { border-color:rgba(239,68,68,0.45); color:#fecaca; }
      #${UI_ID} .gb-inv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(90px,1fr)); gap:8px; margin-top:8px; }
      #${UI_ID} .gb-inv-slot { border:1px solid rgba(148,163,184,0.2); border-radius:10px; min-height:90px; padding:6px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between; }
      #${UI_ID} .gb-inv-slot.filled { background:rgba(59,130,246,0.06); }
      #${UI_ID} .gb-inv-slot.empty { background:#0b0d12; opacity:0.45; }
      #${UI_ID} .gb-inv-slot-name { font-size:11px; font-weight:700; line-height:1.3; word-break:break-word; }
      #${UI_ID} .gb-inv-slot-meta { font-size:10px; color:#94a3b8; margin-top:2px; }
      #${UI_ID} .gb-inv-slot-btns { display:flex; gap:3px; margin-top:4px; }
      #${UI_ID} .gb-inv-slot-empty-label { font-size:10px; color:rgba(148,163,184,0.4); text-align:center; padding-top:30px; }
      /* 아이템 슬롯 툴팁 */
      #${UI_ID} .gb-inv-tooltip-wrap { position:relative; }
      #${UI_ID} .gb-inv-tooltip-wrap .gb-inv-slot-tooltip { display:none; position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%); background:#1e2130; color:#e2e8f0; font-size:11px; white-space:pre-line; padding:6px 10px; border-radius:8px; border:1px solid rgba(148,163,184,0.25); pointer-events:none; z-index:200; min-width:160px; max-width:260px; line-height:1.45; }
      #${UI_ID} .gb-inv-tooltip-wrap:hover .gb-inv-slot-tooltip { display:block; }
      /* tooltip for icon-only buttons */
      #${UI_ID} [data-tooltip] { position:relative; }
      #${UI_ID} [data-tooltip]::after { content:attr(data-tooltip); position:absolute; bottom:calc(100% + 5px); left:50%; transform:translateX(-50%); background:#1e2130; color:#e2e8f0; font-size:11px; white-space:nowrap; padding:4px 8px; border-radius:6px; border:1px solid rgba(148,163,184,0.25); pointer-events:none; opacity:0; transition:opacity 0.15s; z-index:100; }
      #${UI_ID} [data-tooltip]:hover::after { opacity:1; }
      #${UI_ID} .gb-skill-accordion { border:1px solid rgba(148,163,184,0.12); border-radius:10px; margin-bottom:6px; overflow:hidden; }
      #${UI_ID} .gb-skill-accordion-header { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; cursor:pointer; background:#0d1017; font-size:14px; font-weight:700; user-select:none; transition:background 0.15s; }
      #${UI_ID} .gb-skill-accordion-header:hover { background:#161b28; }
      #${UI_ID} .gb-skill-accordion-arrow { font-size:10px; color:#94a3b8; transition:transform 0.2s; }
      #${UI_ID} .gb-skill-accordion.open .gb-skill-accordion-arrow { transform:rotate(90deg); }
      #${UI_ID} .gb-skill-accordion-body { padding:8px; background:#0b0d12; }
      @keyframes gb-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @media (max-width: 1200px) {
        #${UI_ID} .gb-grid.two, #${UI_ID} .gb-grid.three, #${UI_ID} .gb-grid.four, #${UI_ID} .gb-grid.db, #${UI_ID} .gb-skill-list { grid-template-columns:1fr; }
        #${UI_ID} .gb-command-row { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  }
  function ensureRoot() {
    let root = document.getElementById(UI_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = UI_ID;
      document.body.appendChild(root);
    }
    model.root = root;
  }

  async function initPlugin() {
    await loadAll();
    ensureStyle();
    ensureRoot();
    renderApp();

    window.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Escape' && model.state.visible) {
        model.state.visible = false;
        await lsSet(KEY_VISIBLE, 'false');
        if (_hasRisu && Risuai.hideContainer) await Risuai.hideContainer();
        renderApp();
      }
    });

    if (_hasRisu && Risuai.registerButton) {
      Risuai.registerButton({
        name:'⚔️ Gate v1.7',
        icon:'⚔️',
        iconType:'html',
        location:'action'
      }, async () => {
        model.state.visible = true;
        await lsSet(KEY_VISIBLE, 'true');
        if (_hasRisu && Risuai.showContainer) await Risuai.showContainer('fullscreen');
        renderApp();
      });
    }

    if (_hasRisu && model.state.visible && Risuai.showContainer) {
      await Risuai.showContainer('fullscreen');
    }

    console.log(PLUGIN_NAME, 'ready');
  }

  await initPlugin();
} catch (error) {
  console.error('[Gate Battle Prototype v1.7] init error:', error && error.message ? error.message : error, error && error.stack ? error.stack : '');
}
})();
