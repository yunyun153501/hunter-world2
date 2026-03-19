# 🎮 Hunter World — 전투 밸런스 공식 총정리

> **코드 기준**: `GateBattle_v7_4.js` (v7.6.0)  
> **목적**: 이 문서만으로 게임의 전투 시스템, 밸런스 공식, 스킬 메커니즘, 장비 특성을 **완전히** 이해할 수 있도록 작성됨

---

## 📑 목차

1. [게임 개요](#1-게임-개요)
2. [기본 스탯 시스템](#2-기본-스탯-시스템)
3. [데미지 공식](#3-데미지-공식)
4. [방어 공식 (DEF 기반)](#4-방어-공식-def-기반)
5. [크리티컬 공식](#5-크리티컬-공식)
6. [명중/회피 공식](#6-명중회피-공식)
7. [회복 공식](#7-회복-공식)
8. [속성 상성 시스템](#9-속성-상성-시스템)
9. [상태이상 시스템](#10-상태이상-시스템)
10. [종족(Species) 시스템](#11-종족species-시스템)
12. [위협(Threat) 시스템](#12-위협threat-시스템)
13. [전열(Row) 시스템](#13-전열row-시스템)
14. [스킬 시스템](#14-스킬-시스템)
15. [패시브 스킬 시스템](#15-패시브-스킬-시스템)
16. [은신(Stealth) 시스템](#16-은신stealth-시스템)
17. [몬스터 전투 테이블](#17-몬스터-전투-테이블)
18. [장비 시스템](#18-장비-시스템)
19. [통합 특성(Trait) 시스템 — 58종](#19-통합-특성trait-시스템--58종)
20. [특성 효과 수치 (등급별)](#20-특성-효과-수치-등급별)
21. [특성 티어 분류 (TRAIT_TIER_MAP)](#21-특성-티어-분류-trait_tier_map)
22. [희귀도(Rarity) 시스템](#22-희귀도rarity-시스템)
23. [디버프 가능 특성 (10종)](#23-디버프-가능-특성-10종)
24. [포션 시스템](#24-포션-시스템)
25. [스킬 계수/비용 기준표](#26-스킬-계수비용-기준표)
27. [쿨타임 시스템](#27-쿨타임-시스템)
28. [장비 강화 시스템](#28-장비-강화-시스템)
29. [경제/가격 테이블](#29-경제가격-테이블)

---

## 1. 게임 개요

Hunter World는 **턴제 RPG 전투 시뮬레이터**입니다.
- **헌터(플레이어 캐릭터)** vs **몬스터** 형태의 전투
- 최대 **8명** 파티 vs 최대 **10마리** 몬스터
- **전열(front)/중열(mid)/후열(back)** 3열 배치 시스템
- **등급**: E → D → C → B → A → S (6단계)
- **속성**: none, water, fire, ice, earth, wind, electric, dark, light (9종)

---

## 2. 기본 스탯 시스템

### 2.1 5대 스탯

| 스탯 | 약자 | 역할 |
|------|------|------|
| **STR** (힘) | STR | HP 보조, 물리 계열 |
| **CON** (체력) | CON | HP 주력, 탱커 |
| **INT** (지능) | INT | MP 주력, 마법 계열 |
| **AGI** (민첩) | AGI | SP 주력, 크리티컬/회피 |
| **SENSE** (감각) | SEN | MP/SP 보조, 명중/크리티컬 |

> **스탯 최소값 = 10**. 모든 스탯이 10일 때 HP = MP = SP = **100** (기본값).

### 2.2 파생 스탯 공식

| 파생 스탯 | 공식 | 스탯=10, 레벨=1일 때 |
|-----------|------|:---:|
| **HP** | `100 + (CON - 10) × 10 + (STR - 10) × 3 + (레벨 - 1) × 2` | 100 |
| **MP** | `100 + (INT - 10) × 10 + (SENSE - 10) × 3 + (레벨 - 1) × 2` | 100 |
| **SP** | `100 + (AGI - 10) × 10 + (SENSE - 10) × 3 + (레벨 - 1) × 2` | 100 |
| **ATK** | `무기ATK + (STR - 10) × 0.2 + (AGI - 10) × 0.2 + (INT - 10) × 0.3` | 0 |
| **물리방어(PDEF)** | 기본 **0** (장비·스킬로만 증가) | 0 |
| **마법방어(MDEF)** | 기본 **0** (장비·스킬로만 증가) | 0 |

> 레벨업 시 HP/MP/SP에 **+(레벨 - 1) × 2** 보너스 적용 (레벨 15 → +28, 레벨 120 → +238)  
> ATK는 스탯 보너스(기준치 10 초과분)와 장비 무기 ATK의 합산  
> PDEF/MDEF는 스탯과 무관 — **장비와 스킬 효과로만 변동**

### 2.3 등급별 기준표

| 구분 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **최대 레벨** | 15 | 25 | 40 | 60 | 80 | 120 |
| **주스탯 상한** | 25 | 40 | 60 | 80 | 100 | 150 |
| **기준 스탯합** | ~70 | 70~90 | 90~120 | 120~160 | 160~200 | 200~ |

### 2.4 버프 스탯 계산

```
최종 스탯 = 기본 스탯 + 패시브 보너스 + Σ(활성 버프 스탯)
```

> 버프는 가산 (additive), 패시브 보너스도 가산

---

## 3. 데미지 공식

### 3.1 헌터 기본 공식

```
rawBase = (2 × MainStat) + (3 × ATK)
rawDamage = rawBase × coef × critMult × resistMult × elementMul × typeMul × incomingMul × outgoingMul
```

각 항목:
- **rawBase** = `(2 × MainStat) + (3 × ATK)`
  - MainStat = 스킬의 statTypes 평균 (예: `['con']` → CON, `['int','sense']` → (INT+SENSE)/2)
- **coef** = 스킬 계수 (기본 1.0, 스킬마다 다름)
- **critMult** = 크리티컬 시 `1.5`, 아니면 `1.0`
- **resistMult** = 대상의 해당 속성 저항 배율 (기본 1.0, 낮을수록 저항)
- **elementMul** = 속성 상성 배율 (유리 1.25, 불리 0.75, 기본 1.0)
- **typeMul** = 종족별 피해 타입 배율 (예: 고스트 → 물리 0.50, 마법 1.25)
- **incomingMul** = 대상 피격 배율 (저주/화상 등으로 증가)
- **outgoingMul** = 공격자 공격력 배율 (저주로 감소 등)

### 3.2 몬스터 기본 공식

```
rawBase = monsterBaseDamage × (스킬 사용 시 monsterSkillMul, 기본공격 시 1)
```

> 몬스터는 개별 스탯(STR/CON 등)이 **없으므로** `(2×MainStat + 3×ATK)` 공식을 사용하지 않음  
> `monsterBaseDamage`를 rawBase로 직접 사용 → 이후 rawDamage 계산은 헌터와 동일

### 3.3 최종 피해 계산 (방어 적용)

```
최종피해 = rawDamage × (1 - DEF/(DEF + 1.5 × rawDamage)) × (1 - 패시브피해감소) × bonusMul
```

> 방어는 **헌터 대상에게만** 적용. 몬스터는 PDEF=0, MDEF=0 → 방어 공식 미적용

### 3.4 incomingMul (피격 배율) 상세

다음 요소들이 **곱연산**으로 적용:
1. **버프 damageTakenMul** — 활성 버프의 피격 배율
2. **aloneDamageTaken** — 혼자 남았을 때 (야수: ×1.10)
3. **저주(Curse)** — `×(1 + cursePenalty)` (등급별 10~30% 증가)
4. **화상(Burn)** — `×1.10` (피격 10% 증가)
5. **진형 지휘 패시브** — 전투 시작 2턴, 전열 유닛 `×(1 - formationDmgReduce)`

### 3.5 outgoingMul (공격 배율) 상세

1. **저주(Curse)** — `×(1 - cursePenalty)` (등급별 10~30% 감소)
2. **야수 vs 출혈 대상** — `×1.2`

---

## 4. 방어 공식 (DEF 기반)

### 4.1 피해감소 공식

```
피해감소율 = DEF / (DEF + 1.5 × rawDamage)
finalDamage = rawDamage × (1 - 피해감소율)
           = rawDamage × (1.5 × rawDamage) / (DEF + 1.5 × rawDamage)
```

- **DEF** = 물리 공격이면 PDEF, 마법 공격이면 MDEF
- 헌터 PDEF/MDEF는 기본 0 — **장비·스킬로만 증가**
- 몬스터는 PDEF=0, MDEF=0 → **방어 미적용**

### 4.2 유효 방어력 계산

```
유효 DEF = unit.pdef(또는 mdef) + passiveBonuses.pdef(또는 mdef) + traitBonuses.pdef_flat(또는 mdef_flat)
```

> passiveBonuses는 패시브 스킬에서 온 방어 보너스, traitBonuses는 장비 특성에서 온 고정값 보너스

### 4.3 방어 수치 예시

| 상황 | DEF | rawDamage | 피해감소율 | 실제피해 |
|------|:---:|:---------:|:---------:|:-------:|
| E급 탱커 vs E Normal | 10 | 9 | 42.6% | 5.2 |
| E급 탱커 vs E Boss | 10 | 39 | 14.6% | 33.3 |
| C급 탱커 vs C Normal | 30 | 22 | 47.6% | 11.5 |
| S급 탱커 vs S Boss | 80 | 150 | 26.2% | 110.6 |

### 4.4 공식 특성

- **약한 공격**: DEF가 상대적으로 크므로 높은 감소율 → 탱커의 소규모 피해 흡수 우수
- **강한 공격**: rawDamage가 크므로 감소율 하락 → 보스 일격 등 과도한 탱킹 방지
- **DEF=0이면** 피해감소율 0% → 방어 없는 유닛은 rawDamage 그대로 받음

---

## 5. 크리티컬 공식

```
CritChance = clamp(0.25 × (AGI + SENSE) + buffBonus, 3, 35) / 100
```

| 항목 | 설명 |
|------|------|
| 최소 확률 | **3%** |
| 최대 확률 | **35%** |
| 크리티컬 배율 | **×1.5** |
| 속박(Bind) 시 | SENSE 50% 감소 후 계산 |
| buff 보너스 | 버프의 `critChanceBonus` 합산 |

---

## 6. 명중/회피 공식

### 6.1 명중률

| 공격자 | 기본 명중률 | 속박(Bind) | 둔화(Slow) |
|--------|:---:|:---:|:---:|
| **몬스터** | 100% | ×0.5 | ×0.7 |
| **헌터** | (70 + SENSE × 0.5) / 100 | SENSE -50%, 명중률 ×0.5 | ×0.7 |

### 6.2 회피율 (등급별, 헌터·몬스터 공통)

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **기본 회피율** | 3% | 5% | 7% | 10% | 12% | 15% |

### 6.3 회피 보정 규칙

- **패시브 회피 보너스**: 일부 패시브 스킬로 추가
- **공격자 등급 > 대상 등급** → 대상 회피율 **0%**
- **같은 등급 몬스터가 헌터 공격** → 헌터 회피율 **50%만** 적용
- **낮은 등급 몬스터가 높은 등급 헌터 공격** → 헌터 회피율 **그대로** 적용
- **대상 둔화** → 회피율 **-50%**
- **긴급회피 버프** → 다음 1회 공격 100% 회피 (1회 소모)

### 6.4 최종 적중률

```
최종 적중률 = 명중률 - 회피율
```

> 100% 이상이면 무조건 적중

---

## 7. 회복 공식

```
Heal = (MainStat × 0.5) × 스킬계수 × (1 + 치유량증가%)
실제회복 = Heal × (1 + 받는치유량증가%)
```

### 7.1 힐 전용 스킬 계수 범위

> 힐 스킬은 공격 계수와 **별도** 범위를 사용합니다.  
> 광역힐(aoeHeal) = 단일힐 계수 × **0.58**

| 등급 | 단일힐 계수 | 광역힐 계수 (×0.58) |
|:----:|:----------:|:-------------------:|
| E | 1.2 ~ 1.3 | 0.70 ~ 0.75 |
| D | 1.4 ~ 1.5 | 0.81 ~ 0.87 |
| C | 1.6 ~ 1.7 | 0.93 ~ 0.99 |
| B | 1.8 ~ 2.0 | 1.04 ~ 1.16 |
| A | 2.1 ~ 2.3 | 1.22 ~ 1.33 |
| S | 2.4 ~ 2.6 | 1.39 ~ 1.51 |

### 7.2 회복 관련 상태/특성

| 상태 | 효과 |
|------|------|
| **출혈 대상** | 회복량 **50% 감소** (3턴) |
| **장비 특성: healing_done** | 시전자의 치유량 +N% 증가 |
| **장비 특성: healing_received** | 대상의 받는 치유량 +N% 증가 |

> 초과 회복량은 그냥 소멸됨 (보호막 변환 없음)

---

## 9. 속성 상성 시스템

### 9.1 속성 순환 체인

```
light → dark → electric → wind → earth → water → fire → ice → light (순환)
```
> A → B = A가 B를 이김 (×1.25)

| 관계 | 배율 | 설명 |
|------|:---:|------|
| **유리 (→ 방향 공격)** | ×1.25 | 25% 추가 피해 |
| **불리 (← 방향 공격)** | ×0.75 | 25% 피해 감소 |
| **동속 / none** | ×1.0 | 변동 없음 |

### 9.2 상성 예시

| 공격 속성 | 대상 속성 | 배율 |
|-----------|-----------|:---:|
| light | dark | ×1.25 (유리) |
| dark | light | ×0.75 (불리) |
| fire | ice | ×1.25 (유리) |
| fire | water | ×0.75 (불리) |
| fire | fire | ×1.0 |

---

## 10. 상태이상 시스템

### 10.1 기본 확률/턴수

| 상태이상 | 기본 확률 | 기본 턴수 | 분류 | 비고 |
|----------|:---:|:---:|:---:|------|
| **독(poison)** | 23% | 3턴 | DoT | 스택형 (최대 3중첩) |
| **출혈(bleed)** | 23% | 3턴 | DoT | 즉시 추가피해 + 회복 감소 |
| **화상(burn)** | 23% | 5턴 | DoT | 스택형 (최대 5중첩) + 피격 증가 |
| **저주(curse)** | 18% | 3턴 | 하드CC | 공격↓ + 피격↑, 5턴 면역 |
| **기절(stun)** | 16% | 2턴 | 하드CC | 행동 불가, 5턴 면역, 보스/엘리트 1턴 |
| **빙결(freeze)** | 16% | 2턴 | 하드CC | 행동 불가, 5턴 면역, 보스/엘리트 1턴 |
| **마비(paralyze)** | 16% | 2턴 | 하드CC | 행동 불가, 5턴 면역, 보스/엘리트 1턴 |
| **수면(sleep)** | 16% | 3턴 | 하드CC | 행동 불가, 피격 시 해제, 5턴 면역, 보스/엘리트 2턴 |
| **속박(bind)** | 18% | 2턴 | 하드CC | SENSE -50%, 명중률 -50%, 5턴 면역 |
| **침묵(silence)** | 20% | 2턴 | 소프트CC | 스킬 사용 불가 |
| **둔화(slow)** | 25% | 3턴 | 소프트CC | 명중률 -30%, 회피율 -50% |
| **실명(blind)** | 20% | 3턴 | 소프트CC | 명중률 -50% |

### 10.2 DOT (지속 피해) 공식

**독(Poison)**:
```
틱당 피해 = poisonPower × min(3, poisonStacks)
```
- 헌터 시전: `poisonPower = (2×MainStat + 3×ATK) × skillCoef × 0.2`
- 몬스터 시전: `poisonPower = monsterBaseDamage × 0.4`
- **방어 무시** 절대 데미지
- 최대 **3중첩**

**출혈(Bleed)**:
```
즉시 추가피해 = 공격 데미지 × 30%
```
- 출혈 자체는 DOT 없음 — **공격 시 즉시** 30% 추가 피해
- 치유량 **50% 감소** 3턴

**화상(Burn)**:
```
틱당 피해 = burnPower × min(5, burnStacks)
```
- 헌터 시전: `burnPower = (2×MainStat + 3×ATK) × skillCoef × 0.12`
- 몬스터 시전: `burnPower = monsterBaseDamage × 0.2`
- **방어 무시** 절대 데미지
- 최대 **5중첩**
- 피격 데미지 **+10%** (incomingMul)

### 10.3 저주(Curse) 등급별 패널티

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **패널티** | 10% | 12% | 15% | 20% | 25% | 30% |

저주 효과:
- 공격 데미지 **-N%** (outgoingMul)
- 피격 데미지 **+N%** (incomingMul)

### 10.4 CC 면역 시스템

- **기절(Stun)**: 기절 종료 후 **5턴 면역** (stunResistTimer)
- **빙결(Freeze)**: 빙결 종료 후 **5턴 면역** (freezeResistTimer)
- **마비(Paralyze)**: 마비 종료 후 **5턴 면역** (paralyzeResistTimer)
- **수면(Sleep)**: 수면 종료 후 **5턴 면역** (sleepResistTimer)
- **수면 피격 해제**: 수면 중 피격 시 즉시 깨어남
- **속박(Bind)**: 속박 종료 후 **5턴 면역** (bindResistTimer)
- **저주(Curse)**: 저주 종료 후 **5턴 면역** (curseResistTimer)
- 모든 하드CC(6종)에 5턴 면역 적용

---

## 11. 종족(Species) 시스템

### 11.1 종족 데이터

| 종족 | 기본 속성 | 면역 | 피해 배율 | 특수 |
|------|-----------|------|-----------|------|
| **언데드** | dark | 독,출혈,저주 | 물리 ×1.10 | — |
| **고스트** | dark | 독,출혈,저주 | 물리 ×0.50, 마법 ×1.25 | — |
| **야수** | wind | 둔화 | — | 출혈 대상 공격 ×1.2, 혼자일 때 피격 ×1.1 |
| **식물** | earth | 출혈 | — | 턴당 HP 3% 재생 (화상 시 차단) |
| **슬라임** | water | 둔화 | 물리 ×0.70, 마법 ×1.10 | — |
| **구조체** | electric | 독,출혈,수면 | 마법 ×0.80, 물리 ×1.15 | — |
| **정령** | none | — | — | — |
| **악마** | fire | 화상 | 어둠 ×0.70 | — |
| **빙정** | ice | 수면 | 물리 ×0.80 | — |
| **천사체** | light | 저주 | 마법 ×0.80 | — |

### 11.2 적용 방식

- **면역**: 해당 상태이상 부여 자체가 불가
- **피해 배율**: `computeDamage()`의 `typeMul`에 적용 (종족별 물리/마법 피해 배율)
- **재생**: 매 턴 시작 시 HP 회복 (화상 시 차단)
- **출혈 보너스**: 야수가 출혈 대상 공격 시 `outgoingMul × 1.2`

---

## 12. 위협(Threat) 시스템

### 12.1 기본 위협값

```
위협 가중치 = threatBase + threatBonus
```

| 역할 | threatBase |
|------|:---:|
| **탱커** (전열 근접) | 5 |
| **일반 DPS** | 2 |
| **원거리/마법** | 2 |

### 12.2 타겟 선택

- 같은 열 내에서 **위협 가중치 비례** 확률로 타겟 선택
- 도발 스킬: 위협 수치 강제 증가 → 타겟 고정
- 기본 위협: 딜량 비례 / 힐량 비례 (×0.5)

---

## 13. 전열(Row) 시스템

### 13.1 전열 배치

| 열 | 역할 | 특징 |
|----|------|------|
| **전열(front)** | 탱커, 근접 딜러 | 먼저 공격 당함 |
| **중열(mid)** | 근접/원거리 혼합 | 전열 전멸 시 노출 |
| **후열(back)** | 원거리, 마법, 힐러 | 전열+중열 보호 |

### 13.2 근접 vs 원거리 공격

- **근접 공격자**: 전열 → 중열 → 후열 순서로만 공격 가능
- **원거리/마법 공격자**: 모든 열 공격 가능
- **광역(AoE)**: 모든 생존 열 대상

### 13.3 열별 타겟 가중치

```
front: 70, mid: 20, back: 10
```

### 13.4 열 전진 규칙

- 매 턴 종료 시 앞 열 전멸 → 뒤 열 자동 전진
- 전열 전멸 → 중열→전열, 후열→중열

### 13.5 몬스터 열 보정 (스탯 생성 시)

| 열 | HP 보정 | DMG 보정 |
|----|:---:|:---:|
| **front** | +12% | +8% |
| **mid** | +3% | +2% |
| **back** | -10% | -4% |

| 포지션 | HP 보정 | DMG 보정 |
|--------|:---:|:---:|
| **원거리** | -3% | -1% |
| **마법** | -4% | -2% |
| **근거리** | — | +4% |

---

## 14. 스킬 시스템

### 14.1 스킬 카테고리

| 카테고리 | 대상 | 설명 |
|----------|------|------|
| **singleAttack** | 적 1체 | 단일 공격 |
| **aoeAttack** | 전체 적 | 광역 공격 |
| **rowAttack** | 특정 열 | 열 공격 (rowFront/rowMid/rowBack 등) |
| **singleCC** | 적 1체 | 단일 CC (기절/속박 등) + 데미지 |
| **aoeCC** | 전체 적 | 광역 CC + 데미지 |
| **singleHeal** | 아군 1체 | 단일 회복 |
| **aoeHeal** | 전체 아군 | 광역 회복 |
| **buff** | 아군 | 버프 (스탯 증가, 은신 등) |
| **passive** | 상시 | 패시브 (항상 적용) |
| **utility** | 특수 | 유틸리티 (소환, 수리 등) |

### 14.2 스킬 비용

- **MP** (마나) 또는 **SP** (스태미나) 또는 **둘 다** 소모
- 패시브 비용 배율 수정 가능 (예: 방패숙련 → 방패 SP ×0.9)

### 14.3 스킬 속성

| 필드 | 설명 |
|------|------|
| `coef` | 스킬 계수 (데미지/회복량 배율) |
| `damageType` | physical / magic |
| `element` | 속성 (none, fire, water 등) |
| `statTypes` | 주력 스탯 (예: ['str'], ['int','sense']) |
| `cooldown` | 재사용 대기 턴수 (0=없음) |
| `rarity` | Normal / Rare / Unique / Legendary |

---

## 15. 패시브 스킬 시스템

### 15.1 패시브 보너스 (passiveBonuses)

스탯/방어력에 **고정 수치** 추가:
```
passiveBonuses: { str:+N, con:+N, int:+N, agi:+N, sense:+N, pdef:+N, mdef:+N }
```

### 15.2 패시브 모드 (passiveMods)

비용 배율 변경, 특수 효과:
```
passiveMods: {
  shieldSpMul: 0.9,        // 방패 SP -10%
  daggerSpMul: 0.9,        // 단검 SP -10%
  physicalDmgReduce: 0.15, // 물리 피해 -15%
  evasionBonus: 0.12,      // 회피율 +12%
  formationDmgReduce: 0.1, // 진형 지휘: 2턴 피해감소
  bonusDamage: 0.2,        // 관통탄: 최종 피해 +20%
}
```

---

## 16. 은신(Stealth) 시스템

| 규칙 | 설명 |
|------|------|
| 적용 방식 | 버프 스킬로 `buff.stealth = true` 부여 |
| 효과 | 적의 **모든** 공격 타겟에서 제외 (단일+AoE) |
| 보스 포함 | **보스를 포함한 모든 적에게 은신 적용** |
| 해제 조건 | 은신 중 **공격 행동** 시 즉시 해제 |
| 비공격 행동 | 대기/방어/힐/버프는 은신 유지 |
| 시각 표시 | 보라색 🥷 배지 |

---

## 17. 몬스터 전투 테이블

### 17.1 MONSTER_COMBAT_TABLE

| 등급 | 종류 | HP 범위 | Damage 범위 | skillMul |
|------|------|:---:|:---:|:---:|
| **E** | Normal | 50~90 | 7~10 | 1.0 |
| **E** | Elite | 200~360 | 15~20 | 1.1 |
| **E** | Boss | 500~900 | 35~40 | 1.25 |
| **D** | Normal | 175~275 | 15~20 | 1.0 |
| **D** | Elite | 700~1100 | 35~40 | 1.2 |
| **D** | Boss | 1750~2750 | 55~60 | 1.5 |
| **C** | Normal | 400~700 | 20~25 | 1.0 |
| **C** | Elite | 1800~3150 | 45~50 | 1.2 |
| **C** | Boss | 5000~8750 | 70~80 | 1.5 |
| **B** | Normal | 1250~1750 | 30~35 | 1.0 |
| **B** | Elite | 5500~8000 | 60~65 | 1.25 |
| **B** | Boss | 15000~22500 | 90~100 | 1.6 |
| **A** | Normal | 3000~4500 | 35~40 | 1.0 |
| **A** | Elite | 15000~22500 | 80~90 | 1.4 |
| **A** | Boss | 45000~67500 | 110~120 | 1.75 |
| **S** | Normal | 7500~10000 | 50~60 | 1.0 |
| **S** | Elite | 37500~50000 | 100~110 | 1.5 |
| **S** | Boss | 112500~150000 | 130~150 | 1.8 |

### 17.2 몬스터 스킬 쿨타임 시스템

몬스터는 **MP/SP가 없으며**, 스킬 사용은 쿨타임으로만 관리됩니다.

**일반 몬스터 (Normal)**

| 행동 | 쿨타임 |
|------|:---:|
| 기본 공격 | 1턴 |
| 스킬 공격 | 2턴 |

**엘리트/보스 몬스터 (Elite/Boss)**

| 행동 | 쿨타임 |
|------|:---:|
| 기본 공격 | 1턴 |
| 스킬 공격 | 2턴 |
| 광역 공격 | 3턴 |

> 몬스터는 기본공격과 스킬을 번갈아 사용하며, 쿨타임 중인 행동은 사용 불가

### 17.3 몬스터 특이사항

- 몬스터는 **개별 스탯(STR/CON 등)이 없음** → `stats = {str:0, con:0, int:0, agi:0, sense:0}`
- 몬스터의 `atk` = `monsterBaseDamage` (프로필에서 계산된 damage)
- 몬스터 **PDEF=0, MDEF=0** → 방어 공식 적용 없음

---

## 18. 장비 시스템

### 18.1 장비 부위

| 부위 | ATK | PDEF | MDEF | 특성 수 |
|------|:---:|:---:|:---:|:---:|
| **무기(weapon)** | ✅ 주력 | — | — | 1 |
| **보조무기(subweapon)** | — | 방패류 | — | 1 |
| **방어구(armor)** | — | ✅ 주력 | ✅ | 1 |
| **악세서리(accessory)** | — | — | — | 1 |

### 18.2 무기 기본 ATK (WEAPON_BASE_ATK)

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **ATK** | 5 | 15 | 25 | 45 | 70 | 100 |

### 18.3 방어구 기본 스탯 (ARMOR_STAT_BY_RANK)

| 등급 | 스탯합 | 방어 범위 | 저항 | 강화 스탯 |
|------|:---:|:---:|:---:|:---:|
| E | 0 | 0~5 | 1% | 1 |
| D | 2 | 0~15 | 2% | 2 |
| C | 5 | 0~40 | 3% | 3 |
| B | 8 | 0~75 | 5% | 4 |
| A | 11 | 0~100 | 7% | 5 |
| S | 16 | 0~200 | 10% | 6 |

- **방어구 PDEF** = 방어 범위 × 50%
- **보조무기 PDEF** = 방어 범위 × 25%
- **방어구 MDEF** = 방어 범위 × 50%

### 18.4 장비 스탯 합산 (calcEquippedStatBonus)

```
총 ATK = Σ(무기 ATK + 강화 ATK)
총 PDEF = Σ(방어구 PDEF + 보조무기 PDEF + 강화 PDEF)
총 MDEF = Σ(방어구 MDEF + 강화 MDEF)
방어구 주스탯 보너스 = ARMOR_STAT_BY_RANK[등급].totalStatSum {E:0, D:2, C:5, B:8, A:11, S:16}
악세서리 주스탯 보너스 = ACCESSORY_STAT_BY_RANK[등급].totalStatSum {E:0, D:1, C:3, B:5, A:8, S:12}
※ 무기/보조무기는 주스탯 보너스 없음
```

### 18.5 무기 강화 ATK 보너스

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **강화당 ATK** | +1 | +1 | +2 | +3 | +4 | +5 |

---

## 19. 통합 특성(Trait) 시스템 — 58종

> 장비 특성, 재료 특수효과, 스킬 특수효과가 하나의 통합 특성 시스템으로 운영됩니다.
> 수치는 장비 등급(E~S)에 따라 스케일 테이블로 자동 적용.

### 19.1 공격 특성 (12종)

| ID | 이름 | 스케일 | 디버프 |
|----|------|:---:|:---:|
| `physical_damage` | 물리 피해 증가 | percentSmall | ✅ |
| `magic_damage` | 마법 피해 증가 | percentSmall | ✅ |
| `fire_damage` | 불 속성 피해 증가 | statusPercent | ✅ |
| `water_damage` | 물 속성 피해 증가 | statusPercent | ✅ |
| `ice_damage` | 얼음 속성 피해 증가 | statusPercent | ✅ |
| `earth_damage` | 대지 속성 피해 증가 | statusPercent | ✅ |
| `wind_damage` | 바람 속성 피해 증가 | statusPercent | ✅ |
| `lightning_damage` | 전기 속성 피해 증가 | statusPercent | ✅ |
| `light_damage` | 빛 속성 피해 증가 | statusPercent | ✅ |
| `dark_damage` | 어둠 속성 피해 증가 | statusPercent | ✅ |
| `crit_chance` | 치명타 확률 증가 | critChance | — |
| `crit_damage` | 치명타 피해 증가 | critDamage | — |

### 19.2 방어 특성 (12종)

| ID | 이름 | 스케일 |
|----|------|:---:|
| `physical_defense` | 물리피해감소 증가 | percentSmall |
| `magic_defense` | 마법피해감소 증가 | percentSmall |
| `pdef_flat` | 물리방어력 증가 | defenseFlat |
| `mdef_flat` | 마법방어력 증가 | defenseFlat |
| `fire_resist` | 불 속성 저항 | statusPercent |
| `water_resist` | 물 속성 저항 | statusPercent |
| `ice_resist` | 얼음 속성 저항 | statusPercent |
| `earth_resist` | 대지 속성 저항 | statusPercent |
| `wind_resist` | 바람 속성 저항 | statusPercent |
| `lightning_resist` | 전기 속성 저항 | statusPercent |
| `light_resist` | 빛 속성 저항 | statusPercent |
| `dark_resist` | 어둠 속성 저항 | statusPercent |

### 19.3 상태이상 부여 (12종)

| ID | 이름 | 스케일 | 티어 |
|----|------|:---:|:---:|
| `stun_apply` | 기절 부여 확률 증가 | statusPercent | 1 |
| `freeze_apply` | 빙결 부여 확률 증가 | statusPercent | 1 |
| `paralyze_apply` | 마비 부여 확률 증가 | statusPercent | 1 |
| `sleep_apply` | 수면 부여 확률 증가 | statusPercent | 1 |
| `poison_apply` | 독 부여 확률 증가 | statusPercent | 2 |
| `bleed_apply` | 출혈 부여 확률 증가 | statusPercent | 2 |
| `burn_apply` | 화상 부여 확률 증가 | statusPercent | 2 |
| `curse_apply` | 저주 부여 확률 증가 | statusPercent | 2 |
| `bind_apply` | 속박 부여 확률 증가 | statusPercent | 2 |
| `silence_apply` | 침묵 부여 확률 증가 | statusPercent | 2 |
| `blind_apply` | 실명 부여 확률 증가 | statusPercent | 2 |
| `slow_apply` | 둔화 부여 확률 증가 | statusPercent | 3 |

### 19.4 상태이상 저항 (12종)

| ID | 이름 | 스케일 | 티어 |
|----|------|:---:|:---:|
| `stun_resist` | 기절 저항 | statusPercent | 3 |
| `freeze_resist` | 빙결 저항 | statusPercent | 3 |
| `paralyze_resist` | 마비 저항 | statusPercent | 3 |
| `sleep_resist` | 수면 저항 | statusPercent | 3 |
| `poison_resist` | 독 저항 | statusPercent | 4 |
| `bleed_resist` | 출혈 저항 | statusPercent | 4 |
| `burn_resist` | 화상 저항 | statusPercent | 4 |
| `curse_resist` | 저주 저항 | statusPercent | 4 |
| `bind_resist` | 속박 저항 | statusPercent | 4 |
| `silence_resist` | 침묵 저항 | statusPercent | 4 |
| `blind_resist` | 실명 저항 | statusPercent | 4 |
| `slow_resist` | 둔화 저항 | statusPercent | 4 |

### 19.5 지원 특성 (5종)

| ID | 이름 | 스케일 |
|----|------|:---:|
| `healing_done` | 치유량 증가 | percentSmall |
| `healing_received` | 받는 치유량 증가 | percentSmall |
| `shield_effect` | 보호막 효과 증가 | statusPercent |
| `threat_up` | 위협 수치 증가 | threatPercent |
| `threat_down` | 위협 수치 감소 | threatPercent |

### 19.6 스탯 특성 (5종) — 신규

| ID | 이름 | 스케일 | 효과 |
|----|------|:---:|------|
| `stat_str_up` | STR 증가 | statFlat | HP +3N, ATK +0.2N |
| `stat_con_up` | CON 증가 | statFlat | HP +10N |
| `stat_int_up` | INT 증가 | statFlat | MP +10N, ATK +0.3N |
| `stat_agi_up` | AGI 증가 | statFlat | SP +10N, 행동순서 +2N, 크리확률 +0.25N% |
| `stat_sense_up` | SENSE 증가 | statFlat | MP +3N, SP +3N, 명중률 +0.5N%, 크리확률 +0.25N% |

---

## 20. 특성 효과 수치 (등급별)

### percentSmall (물리/마법 피해감소, 물리/마법 피해 증가, 치유)

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **효과(%)** | 1 | 2 | 3 | 5 | 7 | 10 |

**적용 특성**: physical_damage, magic_damage, physical_defense, magic_defense, healing_done, healing_received

### statusPercent (상태이상 확률/저항, 속성 피해 증가, 속성 저항, 보호막)

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **효과(%)** | 2 | 4 | 6 | 8 | 10 | 12 |

**적용 특성**: 8종 속성 피해(fire/water/ice/earth/wind/lightning/light/dark_damage), 8종 속성 저항(fire/water/ice/earth/wind/lightning/light/dark_resist), 12종 상태이상 부여(poison/bleed/burn/curse/stun/bind/sleep/silence/slow/blind/freeze/paralyze_apply), 12종 상태이상 저항(poison/bleed/burn/curse/stun/bind/sleep/silence/slow/blind/freeze/paralyze_resist), shield_effect

### critChance (크리티컬 확률)

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **효과(%)** | 1 | 2 | 3 | 4 | 5 | 7 |

**적용 특성**: crit_chance

### critDamage (크리티컬 피해)

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **효과(%)** | 5 | 10 | 15 | 20 | 25 | 35 |

**적용 특성**: crit_damage

### threatPercent (위협 수치)

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **효과(%)** | 10 | 20 | 30 | 40 | 50 | 60 |

**적용 특성**: threat_up, threat_down

### defenseFlat (물리방어력/마법방어력) — 고정값, % 아님

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **고정값** | +3 | +8 | +20 | +35 | +50 | +70 |

**적용 특성**: pdef_flat (물리방어력), mdef_flat (마법방어력)

> **중요**: defenseFlat은 **퍼센트가 아닌 고정 수치**. DEF에 직접 더해짐.

### statFlat (스탯 증가) — 고정값, 신규

| 등급 | E | D | C | B | A | S |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **고정값** | +2 | +4 | +6 | +8 | +11 | +14 |

**적용 특성**: stat_str_up, stat_con_up, stat_int_up, stat_agi_up, stat_sense_up

> 스탯 고정 수치가 전투 시작 시 해당 스탯에 직접 합산됨.

---

## 21. 특성 티어 분류 (TRAIT_TIER_MAP)

> 특성의 가치/희귀도를 결정하는 4단계 티어 시스템. 장비 레어리티 및 희귀재료 가격에 영향.

| 티어 | 특성 | 설명 |
|:---:|------|------|
| **1** | crit_chance, crit_damage, physical_damage, magic_damage, stun/freeze/paralyze/sleep_apply | 최고가치 (공격 핵심 + 행동불가 부여) |
| **2** | 8종 속성 피해, poison/bleed/burn/curse/bind/silence/blind_apply, 5종 스탯 증가 | 고가치 (속성/상태이상/스탯) |
| **3** | physical_defense, magic_defense, healing_done, shield_effect, pdef_flat, mdef_flat, slow_apply, stun/freeze/paralyze/sleep_resist | 중가치 (방어/지원 + 행동불가 저항) |
| **4** | 8종 속성 저항, poison/bleed/burn/curse/bind/silence/blind/slow_resist, healing_received, threat_up, threat_down | 저가치 (저항/유틸) |

### 레어리티 판정 규칙

- **무기/방어구**: 특성 없음 = Normal, 특성 있음 = Rare
- **보조무기/악세서리**: 티어 1~2 = Rare, 티어 3~4 = Normal
- **Unique/Legendary**: DB 수동 입력으로만 부여

---

## 22. 희귀도(Rarity) 시스템

| 등급 | 색상 | 획득 방법 |
|------|------|-----------|
| **Normal** | #ffffff (흰) | 기본 |
| **Rare** | #4488ff (파랑) | 특성 보유 시 자동 |
| **Unique** | #ff69b4 (분홍) | DB 수동 입력 |
| **Legendary** | #ffd700 (금) | DB 수동 입력 |

> Unique/Legendary는 상점/경매장/마켓에서 **필터링** (구매 불가)

---

## 23. 디버프 가능 특성 (10종)

> 통합 특성 58종 중 피해 증가 계열 10종만 디버프로 전환 가능 (`TRAIT_CAN_DEBUFF`).
> 디버프 시 적에게 해당 속성 "받는 피해 증가" 효과를 적용합니다.

| ID | 버프 효과 | 디버프 효과 |
|----|-----------|-------------|
| `physical_damage` | +N% 물리 피해 | +N% 받는 물리 피해 증가 |
| `magic_damage` | +N% 마법 피해 | +N% 받는 마법 피해 증가 |
| `fire_damage` | +N% 화염 피해 | +N% 받는 화염 피해 증가 |
| `water_damage` | +N% 물 피해 | +N% 받는 물 피해 증가 |
| `ice_damage` | +N% 빙결 피해 | +N% 받는 빙결 피해 증가 |
| `earth_damage` | +N% 대지 피해 | +N% 받는 대지 피해 증가 |
| `wind_damage` | +N% 바람 피해 | +N% 받는 바람 피해 증가 |
| `lightning_damage` | +N% 번개 피해 | +N% 받는 번개 피해 증가 |
| `light_damage` | +N% 빛 피해 | +N% 받는 빛 피해 증가 |
| `dark_damage` | +N% 암흑 피해 | +N% 받는 암흑 피해 증가 |

> 방어/치유/스탯/상태이상 특성은 디버프로 사용 불가.
> 레거시 `_up` 접미사 ID (예: `physical_damage_up`)는 자동으로 통합 ID로 변환됩니다.

---

## 24. 포션 시스템

### 24.1 일일 사용 제한

**일반 회복 포션 (HP/MP/SP)**
- 1~5회: 정상 (100% 효율)
- 6회: 효율 20%만 적용
- 7회+: 사용 불가

**버프 포션**
- 1~3회: 정상 (100% 효율)
- 4회+: 사용 불가

**해제 포션 (해독/CC회복/저주해제)**
- 무제한: 사용 제한 없음

### 24.2 포션 종류 (42종)

3가지 자원 (HP/MP/SP) × 7등급 × 2종류 = 42종

| 등급 | 이름 | 회복량 | 가격 |
|------|------|:---:|:---:|
| 최하급 | 최하급 HP/MP/SP 포션 | 소량 | 저렴 |
| 하급 | 하급 HP/MP/SP 포션 | 약간 | 보통 |
| ... | ... | ... | ... |
| 최상급 | 최상급 HP/MP/SP 포션 | 대량 | 고가 |

### 24.3 사용 가능 시점

- **전투 중** (🧪 버튼) — 턴 소모 없이 사용
- **전투 후** (🧪 버튼) — 체력 회복용

---

---

## 26. 스킬 계수/비용 기준표

### 26.1 단일 대상 스킬

| 등급 | 계수 범위 | 비용 범위 |
|------|:---:|:---:|
| E | 1.2 ~ 1.5 | 20 ~ 30 |
| D | 1.92 ~ 2.4 | 25 ~ 35 |
| C | 2.88 ~ 3.6 | 30 ~ 40 |
| B | 4.8 ~ 6.0 | 40 ~ 50 |
| A | 7.68 ~ 9.6 | 55 ~ 60 |
| S | 11.52 ~ 14.4 | 70 ~ 80 |

### 26.2 파생 계수

- **광역/열 공격**: 단일 계수 × **58%**
- **광역 CC**: 단일 CC 계수 × **50%**, 비용 × **200%**
- **CC/상태이상 스킬**: 단일 하한 × **80%** (20% 약화)

### 26.3 CC/상태이상 스킬 추천 계수

| 등급 | 단일 CC | 광역 CC |
|------|:---:|:---:|
| E | 0.96 | 0.56 |
| D | 1.54 | 0.89 |
| C | 2.30 | 1.33 |
| B | 3.84 | 2.23 |
| A | 6.14 | 3.56 |
| S | 9.22 | 5.35 |

> 밸런스 기준: 직접피해 + 상태이상 효과 총합 ≥ 순수공격 상한계수

### 26.4 힐 전용 스킬 계수

> 힐 스킬은 공격 계수와 **별도** 범위를 사용합니다.  
> 힐 기본값 = `MainStat × 0.5` (공격의 `2×MainStat + 3×ATK`과 다름)

| 등급 | 단일힐 계수 | 광역힐 (×0.58) |
|:----:|:----------:|:-------------:|
| E | 1.2 ~ 1.3 | 0.70 ~ 0.75 |
| D | 1.4 ~ 1.5 | 0.81 ~ 0.87 |
| C | 1.6 ~ 1.7 | 0.93 ~ 0.99 |
| B | 1.8 ~ 2.0 | 1.04 ~ 1.16 |
| A | 2.1 ~ 2.3 | 1.22 ~ 1.33 |
| S | 2.4 ~ 2.6 | 1.39 ~ 1.51 |

---

## 27. 쿨타임 시스템

- 스킬에 `cooldown` 설정 시 사용 후 해당 턴 수만큼 재사용 불가
- 매 턴 종료 시 쿨타임 -1
- `cooldown: 0` 또는 미설정 = 매턴 사용 가능

---

## 28. 장비 강화 시스템

### 28.1 요구 재료

- **마정석**: 같은 등급, 순도 80% 이상
- **수수료**: 마정석 시세 × 25%

### 28.2 성공률

| 순도 | 성공률 |
|:---:|:---:|
| 80% | 70.0% |
| 85% | 77.5% |
| 90% | 85.0% |
| 95% | 90.0% |
| 100% | 95.0% |

> 실패 시 강화 수치 유지 (재료만 소모)

---

## 29. 경제/가격 테이블

### 29.1 희귀재료 티어별 가격 (RARE_PRICE_BY_RANK_TIER)

| 등급 | 티어1 | 티어2 | 티어3 | 티어4 |
|------|------:|------:|------:|------:|
| E | 187,500 | 150,000 | 100,000 | 62,500 |
| D | 1,125,000 | 900,000 | 600,000 | 375,000 |
| C | 11,250,000 | 9,000,000 | 6,000,000 | 3,750,000 |
| B | 170,000,000 | 130,000,000 | 85,000,000 | 55,000,000 |
| A | 4,500,000,000 | 3,500,000,000 | 2,250,000,000 | 1,375,000,000 |
| S | 187,500,000,000 | 100,000,000,000 | 37,500,000,000 | 6,250,000,000 |

### 29.2 경매장 특성 배분

- **80%**: 특성 없음 (Normal 등급) — NORMAL_TRAIT_POOL 사용
- **20%**: 특성 있음 (Rare 등급) — RARE_TRAIT_POOL 사용

---

## 부록 A: 중요 밸런스 메모

### A.1 물리방어 vs 물리피해감소 구분

| 용어 | 시스템 | 소스 |
|------|--------|------|
| **물리방어(PDEF)** | DEF 기반 피해감소 공식에 사용 | 장비 스탯 |
| **물리피해감소(%)** | rawDamage에 곱연산 감소 | 장비 특성 / 패시브 스킬 |
| **마법방어(MDEF)** | DEF 기반 피해감소 공식에 사용 | 장비 스탯 |
| **마법피해감소(%)** | rawDamage에 곱연산 감소 | 장비 특성 / 패시브 스킬 |

> 방어력(DEF)과 피해감소(%)는 **별개 시스템**으로 **중첩 적용**됨

### A.2 장비 특성 전투 적용 현황

> ✅ **v7.7.0부터 장비 특성 % 효과가 전투에 자동 적용됨**  
> `buildUnit()` 시 `calcEquipTraitBonuses(entry)`로 장착 장비의 특성 보너스를 산출 → `unit.traitBonuses`에 저장

| 적용 위치 | 특성 | 효과 |
|-----------|------|------|
| `computeDamage` | physical_damage, magic_damage | 공격자 물리/마법 피해 +N% |
| `computeDamage` | fire/water/ice/earth/wind/lightning/light/dark_damage | 공격자 속성 피해 +N% |
| `computeDamage` | crit_damage | 크리티컬 피해 배율 +N% (1.5→1.5+N%) |
| `computeDamage` | physical_defense, magic_defense | 대상 물리/마법 피해감소 N% |
| `computeDamage` | 8종 속성 저항 | 대상 속성 피해감소 N% |
| `getEffectiveDefense` | pdef_flat, mdef_flat | DEF 고정값 +N |
| `critChance` | crit_chance | 크리티컬 확률 +N% |
| `computeHeal` | healing_done | 시전자 치유량 +N% |
| `applyHeal` | healing_received | 대상 받는 치유량 +N% |
| `applyStatus` | poison/bleed/burn/curse_apply | 상태이상 부여 확률 +N% |
| `applyStatus` | poison/bleed/burn/curse_resist | 상태이상 저항 -N% |
| 타겟팅 | threat_up, threat_down | 위협 가중치 ±N% |

### A.3 피해 계산 순서 요약

```
1. rawBase 계산 (2×MainStat + 3×ATK) 또는 monsterBaseDamage
2. 장비 특성 공격 보너스: traitOutMul = 1 + (물리/마법피해%) + (속성피해%)
3. rawDamage = rawBase × coef × critMult × resistMult × elementMul × typeMul × incomingMul × outgoingMul × traitOutMul
4. DEF 감소 적용: afterDef = rawDamage × (1 - DEF/(DEF + 1.5×rawDamage))
5. 장비 특성 방어 보너스: afterTrait = afterDef × traitDefMul (1 - 물리/마법피해감소% - 속성저항%)
6. 패시브 물리피해감소 적용: afterPassive = afterTrait × (1 - physicalDmgReduce)
7. 보너스 배율 적용: final = afterPassive × bonusMul
8. 최종피해 = max(1, round(final))
```
