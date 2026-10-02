# ebm-papst MODBUS V6.3 스펙 기반 기능별 개발 리스트

> 기준 문서: `docs/Customer version of MODBUS series parameter specification V6.3.pdf` (ebm-papst "product range" 팬 제품군, 2020-07-09, 129p)
> 대조 대상: `parameters.csv` (repo 루트) / `app.js` `getDefaultParameters()`(app.js:6488), `getConfigParamMap()`(app.js:~17710)
> 작성일 기준 구현 여부는 `parameters.csv`의 `implemented` 컬럼(Y/N)을 1차 근거로 하며, 코드 확인으로 발견된 플래그 오류는 별도 표기했다.
> **이번 개정에서 각 기능 그룹 표에 이미 구현된(✅) 레지스터도 함께 표시하도록 보강했다** — 한 그룹 안에서 "무엇이 이미 되어 있고, 무엇이 남았는지"를 한눈에 볼 수 있다. 또한 `parameters.csv`에 아예 행 자체가 없는 레지스터(스펙엔 있지만 앱 파라미터 테이블에 등록조차 안 된 것)를 다수 발견해 **"CSV 미등록"**으로 구분 표기했다 — 이 경우는 값만 켜면 되는 게 아니라 파라미터 정의 자체를 새로 추가해야 한다.

## 1. 개요 — 현재 커버리지

| 구분 | 전체 파라미터 수 | 구현(Y) | 미구현(N) | 구현률 |
|---|---:|---:|---:|---:|
| Holding register (ebm-papst 스펙, CSV 등록 기준) | 100 | 22 | 78 | 22% |
| Input register (ebm-papst 스펙, CSV 등록 기준) | 28 | 22 | 6 | 79% |
| **ebm-papst 스펙 합계 (CSV 등록 기준)** | **128** | **44** | **84** | **34%** |
| LSM 전용 레지스터 (FC 0x2B, 별도 프로토콜 — 서보 드라이브용, ebm-papst 스펙과 무관) | 47 | 47 | 0 | 100% (별도 관리) |

즉, **읽기 전용 상태값(Input register)은 대부분 구현되어 있으나, 실제 동작을 바꾸는 설정용 Holding register는 78%가 미구현** 상태다.

> ⚠️ 위 "128개"는 `parameters.csv`에 **행으로 등록된** 레지스터만 센 것이다. 아래 §3~§5 그룹 표를 만들며 대조해보니, 스펙에는 명시돼 있지만 CSV/앱 파라미터 테이블에 **행 자체가 아예 없는 레지스터가 40개 이상** 추가로 발견됐다(예: Password D002~D004, Parameter set source D104/D105, P/I factor D10A~D10D, Fail-safe 관련 D15B~D15F 전부, Set value source switching D16C 등). 즉 실제 미구현 갭은 84개보다 더 크며, 각 항목마다 "CSV 미등록"으로 표시해두었다.

### 발견된 데이터 오류 / 갭 (문서 작성 중 코드 대조로 확인)

1. **주소 오타 (4건)**: `parameters.csv`의 Shedding function 관련 행이 `0xF150`~`0xF153`로 기재되어 있으나, 스펙 원문(2.45절, Overview 표 p.31)상 정확한 주소는 **`0xD150`~`0xD153`**이다. `F150` 대역은 스펙에 존재하지 않는 주소 공간이며 오타로 추정된다. → 개발 착수 전 CSV 수정 필요.
2. **구현 플래그 오류 (3건)**: `D1A2`(Serial Number 1), `D1A3`(Serial Number 2), `D1A4`(Date of manufacture)는 CSV상 `N`으로 표기되어 있으나, 실제로는 app.js의 Serial Number 탭(약 21200~21460행)에서 CANopen/FC0x2B 경로로 이미 읽기/쓰기가 구현되어 있다. → `D1A2`~`D1A4`만 `Y`로 정정 필요.
3. **CSV 미등록 레지스터 다수 발견**: 스펙에 정의된 레지스터인데 `parameters.csv`에 행 자체가 없는 경우가 §3(P0)~§5(P2) 전반에 걸쳐 다수 있다 — 예: Password(D002~D004), Parameter set source/internal(D104/D105), P/I factor(D10A~D10D), 각종 Set1/2 분리값(D108/109, D10E/F, D110/111, D116~118), 방향/소스 전환 계열(D12E, D148, D16C), Fail-safe 전체(D15B~D15F), Enable/Disable 관련(D010, D16A, D16B), 0-10V 출력측(D130, D140~143, D13C~13F), 센서 단위(D164~169), 로터 캘리브레이션(D1F7/D1F8), RFID(D16F), 에러/경고 출력 지연 일부(D620~622), Mask-out 관련 Holding D011/D012 등. 자세한 내용은 각 그룹 표에 개별 표시.

---

## 2. 완료된 기능 (참고용 — 이미 안정적으로 동작 중)

아래 항목들은 추가 개발 없이 이미 동작하는 기능이다. 다만 몇몇은 "관련 스펙 기능의 절반만" 구현된 상태라, 아래 §3~§5의 관련 항목과 함께 봐야 전체 그림이 보인다(표에 교차 참조 표시).

### 2-1. 기본 통신 프로토콜 & Reset
| 주소 | 이름 | 상태 |
|---|---|---|
| — | FC03/04/06/16 읽기·쓰기, CRC-16 | ✅ (`modbus.js` 전체) |
| D000 (holding) | Reset (Software Reset / Error Reset / EEPROM→RAM) | ✅ |

### 2-2. Setpoint 및 기본 운전
| 주소 | 이름 | 상태 |
|---|---|---|
| D001 | Setpoint (지령값) | ✅ |
| D101 | Set value source — 기본값만 (Ain1/RS485/Ain2/PWM 선택) | ✅ (전환 로직 D16C는 → §3 P0-3) |
| D102 | Preferred running direction — 기본값만 | ✅ (전환 로직 D148은 → §3 P0-3) |
| D106 | Operating mode — 단일 값만 사용 중 | ✅ (스펙상 "Parameter set 1"용 레지스터만 쓰고 있으며, Set2 분리·전환은 → §3 P0-3) |

### 2-3. Fan Address & 인터페이스 설정
| 주소 | 이름 | 상태 |
|---|---|---|
| D100 | Fan address (Node ID) | ✅ |
| D149 | Transmission speed (RS485 통신속도) | ✅ |
| D14A | Parity configuration | ✅ |
| D1FF | 종단저항(Termination resistor) 활성화 | ✅ |

### 2-4. 가속/감속 & 최대속도
| 주소 | 이름 | 상태 |
|---|---|---|
| D11F | Ramp-up curve | ✅ |
| D120 | Ramp-down curve | ✅ |
| D119 | Maximum speed | ✅ (상한 검증용 D11A Max permissible speed는 미구현) |

### 2-5. 입력 특성곡선 (Parameter set 1)
| 주소 | 이름 | 상태 |
|---|---|---|
| D12A / D12B | Point 1 X / Y 좌표 | ✅ |
| D12C / D12D | Point 2 X / Y 좌표 | ✅ |

Set2용 입력곡선(D13C~D13F)과 0-10V 출력측 곡선은 → §4 P1-3.

### 2-6. 센서 스케일링 & 실측값
| 주소 | 이름 | 상태 |
|---|---|---|
| D147 | Sensor actual value source | ✅ |
| D160 / D162 | Min / Max sensor value | ✅ |
| D01B (input) | Sensor actual value (선택된 실제 센서 값) | ✅ |
| D023~D026 (input) | Sensor actual value 1~4 (Ain1/Ain2/PWM duty·freq 실측값) | ✅ |

단위 문자열(D164~D169)은 → §4 P1-4.

### 2-7. 보호 파라미터 (일부)
| 주소 | 이름 | 상태 |
|---|---|---|
| D13B | Maximum coil current | ✅ (단, 활성화 스위치 D12F 없이는 실제 동작 미검증 → §3 P0-5) |
| D137 / D138 | Module temperature power derating start / end | ✅ (활성화 비트·상한값 등 나머지는 → §3 P0-5) |

### 2-8. 실시간 상태 Input register
| 주소 | 이름 | 상태 |
|---|---|---|
| D000~D005 (input) | Identification, Max bytes, Bus/Commutation controller SW 이름·버전 (6개) | ✅ |
| D010 / D02D | Actual speed (상대값 / 절대 RPM) | ✅ |
| D011 | Motor status | ✅ |
| D012 | Warning | ✅ |
| D013 | DC-link voltage | ✅ |
| D015 / D017 | Module temperature / Electronics temperature | ✅ |
| D019 | Current modulation level | ✅ |
| D028 | Current set value source | ✅ |

### 2-9. 앱 자체 확장 (스펙 미정의 주소 — 확인 필요)
| 주소 | 이름 | 상태 |
|---|---|---|
| D050 (input) | Command speed | ✅ (단, 스펙 원문 Input register 개요 p.114에는 이 대역이 **"Not assigned"**로 명시되어 있음) |
| D051 (input) | Command torque | ✅ (위와 동일) |

이 두 레지스터는 ebm-papst 공식 스펙 문서(V6.3, 129p 발췌본)에는 정의되어 있지 않은 주소를 쓰고 있다. 오동작은 아니겠지만, 펌웨어 벤더 측에 이 주소가 실제로 무엇을 반환하도록 구현되어 있는지 별도 확인·문서화가 필요하다.

---

## 3. P0 — 핵심 제어 · 안전 (즉시 착수 권장)

상태 기호: ✅ 완료 · ⬜ 미구현(CSV에 값만 N) · **⬜ CSV 미등록**(파라미터 정의 자체를 신규 추가해야 함)

### P0-1. I/O 구성 (Configuration of I/O) — 🟡 부분 → 최우선 착수
스펙 2.46절. 팬 뒷면에 있는 IO1/IO2/IO3 핀 3개를 각각 "무슨 용도로 쓸지" 정하는 스위치다. 예를 들어 IO1을 "디지털 입력"으로 설정하면 외부 스위치를 연결해 파라미터셋을 바꾸거나 회전방향을 반전시킬 수 있고, 반대로 "Tacho 출력"으로 설정하면 팬이 현재 속도를 펄스 신호로 내보내 외부 계측기가 읽을 수 있다. 문제는 이 용도를 먼저 정해두지 않으면 뒤에서 만들 Fail-safe(신호 단선 감지), 방향/파라미터셋 전환 스위치, 0-10V 신호 출력 같은 기능들이 "어느 핀을 봐야 할지" 알 수 없어 전부 무용지물이 된다는 점이다. 그래서 이 항목을 가장 먼저 완성해야 나머지 기능들이 실제로 동작한다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D158 | Configuration of I/O 1 | ⬜ |
| D159 | Configuration of I/O 2 | ⬜ |
| D15A | Configuration of I/O 3 | ⬜ |

개발 메모: 스펙 2.46.2절에 "I/O 모드 ↔ 관련 기능 파라미터" 매핑 표가 있음(예: Din1 선택 시 D101/D147/D104/D12E/D148/D16C/D16A 중 무엇을 그 입력에 연결할지 추가로 골라야 함) — UI는 2단 선택(① I/O 물리 모드 → ② 그 모드가 서비스할 논리 기능)으로 설계 필요. 이 3개 레지스터 자체는 CSV에 행이 있고(N), 값만 채우면 되는 상태다.

### P0-2. Fail-safe 모드 — ⬜ 미구현 (전부 CSV 미등록)
스펙 2.47~2.51절. 팬에 속도 지령을 보내는 케이블(RS485든 0-10V 아날로그선이든)이 물리적으로 빠지거나 끊어지면 지금은 아무 안전장치가 없어 팬이 마지막 값 그대로 멈춰 있거나 예측 불가능한 상태로 남는다. 이 기능을 넣으면 "신호가 이 시간(D15E) 이상 안 들어오면, 미리 정해둔 안전한 속도(D15D)와 회전방향(D15B)으로 자동 전환"하도록 만들 수 있다 — 통신이 끊기면 자동으로 감속하는 자동차 크루즈 컨트롤과 비슷한 원리다. 배기/환기 설비처럼 "신호 끊김 = 팬이 갑자기 멈춤"이 안전사고로 이어질 수 있는 현장에서는 필수 기능인데, 현재 전무한 상태다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D15B | Fail-safe running direction | ⬜ CSV 미등록 |
| D15C | Fail-safe set value source | ⬜ CSV 미등록 |
| D15D | Fail-safe set value | ⬜ CSV 미등록 |
| D15E | Fail-safe time delay | ⬜ CSV 미등록 |
| D15F | Open circuit limit value input characteristic curve | ⬜ CSV 미등록 |

### P0-3. 신호소스 전환(지령/방향/파라미터셋/제어방향) + 파라미터셋 P/I 게인 — 🟡 부분
스펙 2.16~2.29절. 이미 구현된 것과 남은 것을 함께 보면: **어떤 값을 쓸지(D101/D102/D106)는 이미 구현**되어 있지만, **그 값을 디지털 입력으로 실시간 오버라이드하는 "전환 스위치" 레지스터들은 전부 없다.** 팬 하나에 "낮 모드/밤 모드"처럼 서로 다른 설정 세트(Set1/Set2) 두 개를 저장해두고 외부 신호로 즉시 바꿔 끼우는 것도 마찬가지로 안 된다 — 지금은 세트 1개만 쓸 수 있다. 더 중요한 건 **P factor/I factor**인데, 센서 제어 시 "실제값이 목표치에서 벗어났을 때 팬이 얼마나 빠르고 민감하게 반응할지"를 정하는 튜닝값이다. 값이 크면 속도가 오락가락하고 작으면 반응이 느린데, 이 값을 조정할 UI 자체가 없어 공장 기본값 그대로 동작 중이다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D101 | Set value source (기본값) | ✅ (→ §2-2) |
| D16C | Set value source switching (디지털 입력으로 전환) | ⬜ CSV 미등록 |
| D102 | Preferred running direction (기본값) | ✅ (→ §2-2) |
| D148 | Running direction source (디지털 입력으로 전환) | ⬜ CSV 미등록 |
| D106 | Operating mode (현재 단일 값, 사실상 Set1) | ✅ (→ §2-2) |
| D104 | Parameter set source (파라미터셋을 무엇으로 고를지) | ⬜ CSV 미등록 |
| D105 | Parameter set internal (내부값 사용 시 Set1/2 선택) | ⬜ CSV 미등록 |
| D01D (input) | Current parameter set (현재 적용 중인 세트 확인용, 읽기전용) | ⬜ CSV 미등록 |
| D12E | Direction of action source | ⬜ CSV 미등록 |
| D108 / D109 | Direction of action (Set1/Set2) | ⬜ CSV 미등록 |
| D01E (input) | Current direction of action (읽기전용 확인용) | ⬜ CSV 미등록 |
| D10A / D10B | P factor (Set1/Set2) | ⬜ CSV 미등록 |
| D10C / D10D | I factor (Set1/Set2) | ⬜ CSV 미등록 |
| D10E / D10F | Maximum modulation level (Set1/Set2) | ⬜ CSV 미등록 |
| D110 / D111 | Minimum modulation level (Set1/Set2) | ⬜ CSV 미등록 |
| D112 | Motor stop enable (현재 CSV엔 Set 구분 없이 단일 항목으로 등록됨) | ⬜ (CSV 있음, N) |
| D116 | Starting modulation level | ⬜ CSV 미등록 |
| D117 | Max. permissible modulation level | ⬜ CSV 미등록 |
| D118 | Min. permissible modulation level | ⬜ CSV 미등록 |

### P0-4. Enable/Disable & Remote control — ⬜ 미구현
스펙 2.11, 2.12, 2.53, 2.54절. 지금 팬을 세우려면 지령값(setpoint)을 0으로 써야 하는데, 이건 "속도를 0으로 하라"는 명령이지 "구동 자체를 차단하라"는 명령이 아니다. 서보모터의 SVON/SVOFF에 해당하는 별도의 Enable 신호(D00F)를 추가하면 속도 지령과 무관하게 "이 팬을 아예 대기 상태로 둘지"를 독립적으로 제어할 수 있다 — 정비 중에 Disable을 걸어두면 실수로 setpoint가 들어와도 팬이 절대 돌지 않는다. 정전 후 복전 시 이전 Enable 상태를 기억해 자동 재시작할지(D16B)도 이 그룹에 포함된다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D00F | Enable / Disable | ⬜ (CSV 있음, N) |
| D010 | Remote control output 0-10 V | ⬜ CSV 미등록 |
| D16A | Enable / Disable source | ⬜ CSV 미등록 |
| D16B | Stored Enable / Disable | ⬜ CSV 미등록 |
| D01C (input) | Enable / Disable input state (읽기전용 확인용) | ⬜ (CSV 있음, N — → §5 P0-7과 중복 참고) |

### P0-5. Power Limiter 완성 — 🟡 부분 (활성화 스위치가 없어 무의미할 가능성)
스펙 2.38, 2.40절. 지금은 "모듈 온도가 몇 도부터 몇 도까지 오르면 출력을 서서히 낮춰라"라는 온도 구간(D137/D138)만 입력되어 있는데, 정작 이 파워 리미터 기능 자체를 켜는 스위치(D12F)가 없다 — 에어컨 온도 설정은 해놨는데 전원 버튼을 안 누른 상태와 같아서, 값은 저장돼도 실제로는 동작하지 않을 가능성이 높다. 여기에 최대 파워 상한값(D135/D155), 모터 자체 온도 기준 디레이팅(D14D/D14E), 디레이팅 값이 급변하지 않게 완만히 적용하는 램프(D16D)까지 채워야 "과열로 인한 고장을 막는" 기능이 실제로 완성된다. **개발 착수 전 D12F 활성화 비트가 실제로 꺼져 있는지부터 현장 확인이 필요**하다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D137 | Module temperature power derating start | ✅ (→ §2-7) |
| D138 | Module temperature power derating end | ✅ (→ §2-7) |
| D13B | Maximum coil current | ✅ (→ §2-7, 단 D12F 없이는 미검증) |
| D12F | Limitation Control (Power/Current limit enable bit) | ⬜ (CSV 있음, N) |
| D135 | Maximum permissible power | ⬜ (CSV 있음, N) |
| D136 | Max. power at derating end | ⬜ (CSV 있음, N) |
| D14D / D14E | Motor temperature power derating start/end | ⬜ (CSV 있음, N) |
| D155 | Maximum power | ⬜ (CSV 있음, N) |
| D16D | Power derating ramp | ⬜ CSV 미등록 |

### P0-6. Error History (에러 로그) — ⬜ 미구현
스펙 2.59절. 지금은 팬에 "지금 당장" 어떤 에러가 떠 있는지만 보이고, "어제 새벽 3시에 과열 에러가 났었다" 같은 지나간 기록은 전혀 알 수 없다. 이 기능을 붙이면 팬 내부에 자동으로 쌓인 최근 13건의 에러 목록과 각 발생 시각(누적 운전시간 기준)을 통째로 읽어와, 현장에 가지 않고도 "왜 이 팬이 예전에 멈췄었는지"를 원격 진단할 수 있다 — 자동차의 고장 이력 조회 기능과 비슷하며, 필드 서비스에는 사실상 필수 기능이다. (아래 레지스터는 전부 CSV에 행은 있으나 값이 N인 상태 — 신규 추가가 아니라 값만 채우면 된다.)

| 주소 | 이름 | 상태 |
|---|---|---|
| D180 | Operating hours counter (back-up) | ⬜ (CSV 있음, N) |
| D182 | Error indicator (최근 에러 위치 포인터) | ⬜ (CSV 있음, N) |
| D184 / D185 | 1st error / time | ⬜ (CSV 있음, N) |
| D186~D19F | Error history 1~13 + 각 시각 (26개 레지스터) | ⬜ (CSV 있음, N) |

### P0-7. 손쉬운 텔레메트리 보강 — ⬜ 미구현 (구현 난이도 낮음, 읽기 전용)
새 기능을 설계할 필요 없이, 이미 만들어둔 읽기 함수(`readInputRegisterWithTimeout`)로 주소만 하나씩 더 읽으면 되는 "저비용 고효율" 항목들이다. DC링크 전류·현재 회전방향·현재 지령값·Enable 입력 상태·현재 전력·운전시간/분 카운터·라인 전압 등을 포함한다. 대조 과정에서 **모터 온도(D016)와 절대 전력값(D027), 누적 전력량(D029/D02A)이 CSV에 아예 등록조차 안 되어 있다**는 것도 새로 발견했다 — 특히 누적 전력량은 "이 팬이 지금까지 전기를 얼마나 썼는지"를 보여줘 에너지 관리/과금 용도로 바로 활용할 수 있는 값이라 놓치기 아깝다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D009 | Operating hours counter | ⬜ (CSV 있음, N) |
| D00A | Operating minutes counter | ⬜ (CSV 있음, N) |
| D014 (input) | DC-link current | ⬜ (CSV 있음, N) |
| D016 (input) | Motor temperature | ⬜ CSV 미등록 |
| D018 (input) | Current direction of rotation | ⬜ (CSV 있음, N) |
| D01A (input) | Current set value | ⬜ (CSV 있음, N) |
| D01C (input) | Enable / Disable input state | ⬜ (CSV 있음, N) |
| D021 (input) | Current power (relative) | ⬜ (CSV 있음, N) |
| D027 (input) | Current power [W] (absolute) | ⬜ CSV 미등록 |
| D029 / D02A (input) | Energy consumption counter | ⬜ CSV 미등록 |
| D03D (input) | Line voltage | ⬜ (CSV 있음, N) |

### P0-8. 과변조(Overmodulation) 진입 시 토크/속도 제한 알림 — ⬜ 미구현 (PDF 스펙 외 — 현장 구현 지식 기반)
> 이 항목은 ebm-papst PDF 스펙에 나오는 내용이 아니라, 실제 개발 과정에서 발견된 현재 구현의 갭이다.

토크 모드·속도 모드에서 실제로 필요한 출력 전압이 DC-link 전압으로 낼 수 있는 한계를 넘어서면 "과변조(overmodulation)" 영역에 들어가게 되고, 이 영역에서는 전류 파형이 일그러지면서 제어 자체가 불안정해진다. 이를 막기 위해 이미 코드에서 토크·속도 상한을 걸어 이 영역에 아예 진입하지 못하도록 제한을 걸어두었다 — 여기까지는 안전하게 잘 만들어져 있다. 문제는 **이 제한이 실제로 걸렸을 때 사용자에게 알려주는 방법이 전혀 없다는 것**이다. 그러다 보니 사용자는 지령한 만큼 속도/토크가 안 나올 때 "내가 뭘 잘못 설정했나?"만 의심하게 되고, "지금 DC-link 전압 한계 때문에 제한이 걸려 있다"는 실제 원인은 알 도리가 없다 — 마치 자동차 가속페달을 끝까지 밟았는데 계기판에 아무 경고도 없이 속도만 안 오르는 것과 같다.

| 항목 | 내용 | 상태 |
|---|---|---|
| 상태 신호 | 과변조로 인해 토크/속도가 제한 중임을 나타내는 상태 비트(또는 레지스터) | ⬜ (앱 파라미터 테이블에 관련 레지스터 없음 — 펌웨어가 이미 이 상태를 어떤 형태로든 반환하고 있는지 먼저 확인 필요. 없다면 신규로 정의해야 함) |
| UI 알림 | 대시보드/모니터링 화면에 "DC-link 전압 한계로 토크·속도 제한 중" 같은 경고 표시(토스트 또는 상시 배지) | ⬜ 미구현 |

개발 메모: 기존 P0-5(Power Limiter)의 D12F/P_Limit·I_Limit 계열, Warning 레지스터(D012)의 상태 비트 구조와 성격이 비슷하다 — 신규 상태를 정의할 때 이 기존 패턴(제한 종류별 비트 플래그 + 해당 비트를 대시보드 경고로 표시)을 그대로 재사용하는 것을 권장한다.

---

## 4. P1 — 가치는 크지만 고난도/니치

### P1-1. 시리얼번호 기반 자동 어드레싱 — ⬜ 미구현 (프로토콜 확장 필요)
스펙 1.3.6, 1.3.6.5절. 설치 현장에 팬 10대를 새로 달 때 지금 방식은 "한 대씩 켜고 → 주소 부여하고 → 끄고 → 다음 대 켜고"를 반복해야 한다. 이 기능을 쓰면 10대를 전부 동시에 켜놓은 채로, 각 팬 케이스에 인쇄된 고유 시리얼 번호(모두 다름)를 이용해 "너는 3번 주소를 써라"라고 하나씩 개별 지정할 수 있다 — 원래는 전부 기본 주소(1번)로 충돌하는 상태이지만, 시리얼 번호라는 유일한 식별자로 개별 접근이 가능해지기 때문이다. 다만 표준 FC03/04/06/16이 아니라 ebm-papst가 별도로 정의한 **신규 커맨드(0x43/0x44/0x46/0x50)와 6바이트 시리얼번호 필드가 추가된 전용 프레이밍**을 새로 구현해야 해서, `modbus.js` 프로토콜 레이어 확장이 선행되어야 한다.

| 커맨드 | 기능 | 상태 |
|---|---|---|
| 0x43 | Read holding register addressed by serial no. | ⬜ (신규 프로토콜) |
| 0x44 | Read input register addressed by serial no. | ⬜ (신규 프로토콜) |
| 0x46 | Write single register addressed by serial no. | ⬜ (신규 프로토콜) |
| 0x50 | Write multiple register addressed by serial no. | ⬜ (신규 프로토콜) |
| D00C | Addressing on/off (데이지체인 펄스 방식 대안) | ⬜ CSV 미등록 |

### P1-2. Shedding function (동결/구속 방지 기동) — ⬜ 미구현 (주소 오타 정정 포함)
스펙 2.45절. 겨울철 실외 팬 날개가 얼어붙어 아무리 힘을 줘도 안 돌아가는 상황을 떠올리면 된다. 이 기능은 그럴 때 팬을 무작정 세게 돌리는 대신, 회전방향을 좌→우→좌→우로 번갈아 흔들면서 힘(모듈레이션 레벨)을 조금씩 키워가며 — 눈에 박힌 자동차를 앞뒤로 흔들어 빼내듯 — 얼음을 깨고 탈출을 시도한다. 정해진 횟수만큼 시도해도 안 풀리면 결국 "모터 구속" 에러로 넘어간다.

| 주소(정정 전 → 정정 후) | 이름 | 상태 |
|---|---|---|
| 0xF150 → **0xD150** | Shedding function on/off | ⬜ (CSV 있음, N — 주소만 정정) |
| 0xF151 → **0xD151** | Max. starting modulation level | ⬜ (CSV 있음, N — 주소만 정정) |
| 0xF152 → **0xD152** | Number of start attempts | ⬜ (CSV 있음, N — 주소만 정정) |

### P1-3. 0–10V 출력 특성곡선 + 기능 선택 + 2번째 입력곡선 — ⬜ 미구현 (전부 CSV 미등록)
스펙 2.39, 2.37절. 지금까지 구현된 D12A~D12D는 "외부에서 들어오는 0-10V 신호를 어떻게 속도 지령으로 해석할지"를 정하는 입력측 곡선이다(→ §2-5). 이 항목은 반대로 "이 팬이 0-10V 핀으로 무엇을 내보낼지"를 정하는 출력측 기능이다 — 예를 들어 이 핀으로 "현재 속도"를 전압으로 내보내면 다른 계측 장비가 전압만 읽어 속도를 알 수 있고, 또는 이 팬이 받은 지령값을 그대로 다음 팬에 전달해 여러 대를 사슬처럼 연동시킬 수도 있다. 파라미터셋 2용 입력곡선(D13C~D13F)도 아직 없어, P0-3(Set1/Set2 전환)을 완성하려면 이것도 함께 필요하다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D130 | Function output 0..10 V / speed monitoring | ⬜ CSV 미등록 |
| D140~D143 | Characteristic curve output 0..10 V (P1/P2 X·Y) | ⬜ CSV 미등록 |
| D13C~D13F | Input characteristic curve (Parameter set 2) | ⬜ CSV 미등록 |

### P1-4. 센서 단위 문자열 — ⬜ 미구현 (CSV 미등록)
스펙 2.52절. 센서의 최소/최대값(D160/D162, 이미 구현됨 — 예: 0~1000, → §2-6)은 입력할 수 있는데, 그 숫자가 "Pa(압력)"인지 "°C(온도)"인지 "%RH(습도)"인지 알려주는 단위 이름표가 없다. 지금은 UI에 숫자만 나와서 사용자가 매번 단위를 별도로 기억하거나 확인해야 한다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D164~D169 | Sensor unit (ASCII 12바이트) | ⬜ CSV 미등록 |

### P1-5. Factory/Customer 설정 백업·복원 — 🟡 부분
스펙 2.5, 2.6절. 팬 설정을 실수로 엉망으로 만들었을 때 "공장 출하 상태로 한 번에 되돌리기" 버튼과, 반대로 "우리 회사 표준 설정값으로 한 번에 되돌리기" 버튼에 해당한다. 지금은 파라미터를 하나씩 손으로 되돌려야 해서, 설정 실수가 났을 때 복구가 번거롭다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D005 | Factory setting Control | ⬜ (CSV 있음, N) |
| D006 | Customer setting Control | ⬜ CSV 미등록 |

### P1-6. Password / 권한 레벨 처리 — ⬜ 미구현 (CSV 미등록)
스펙 2.4절. 이 스펙은 쓰기 권한을 3단계(ebm-papst 제조사 전용 / 고객사 / 최종 사용자)로 나눠서, 파라미터마다 "이 값은 최종 사용자가 못 바꾸게 막아라" 같은 제한을 걸도록 설계되어 있다(스펙 Overview 표 Writing 컬럼). 지금 앱은 이 구분이 없어서 권한이 부족해 쓰기가 거부됐을 때(exception 0x04) 사용자는 "왜 저장이 안 되지?"라는 원인을 알 수 없다. 비밀번호(D002~D004)를 먼저 입력해야 그 권한에 해당하는 파라미터들의 잠금이 풀리는 구조이며, 향후 P0/P1 항목을 구현할 때 "이 파라미터는 어느 권한이 필요한지"도 함께 반영해야 한다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D002~D004 | Password | ⬜ CSV 미등록 |

### P1-7. 경고/에러 출력 지연 및 릴레이 마스크 — ⬜ 미구현
스펙 2.69~2.71절. 팬에 아주 짧게 경고가 떴다가 바로 사라지는 경우(예: 순간 전압 스파이크)까지 매번 릴레이 접점이 열렸다 닫혔다 하면, 상위 제어 시스템이 이를 오작동으로 오인할 수 있다. 이 기능은 "이 경고/에러가 몇 초 이상 지속돼야 진짜로 반응해라"는 지연시간을 걸거나, 아예 "이 종류의 경고는 릴레이에 영향을 주지 말아라"라고 마스킹해서 불필요한 알람(false alarm)을 걸러내는 역할을 한다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D620 | Error output delay | ⬜ CSV 미등록 |
| D621 | Warning output delay | ⬜ CSV 미등록 |
| D622 | Warning output mask | ⬜ CSV 미등록 |
| D623 | Relay actuation mask (error) | ⬜ (CSV 있음, N) |
| D624 | Relay actuation mask (warning) | ⬜ (CSV 있음, N) |
| D153 | Relay dropout delay (Shedding 주소 대역과 인접하지만 별개 기능, 2.71.3절) | ⬜ (CSV 있음, N — 단 CSV엔 `0xF153`으로 오기재, → P1-2와 동일 정정 필요) |

### P1-8. 로터 위치 센서 캘리브레이션 — ⬜ 미구현 (CSV 미등록)
스펙 2.63절. 모터를 처음 설치하거나 부품을 교체했을 때, 모터 내부의 회전자 위치 센서가 "지금 회전자가 정확히 몇 도 위치에 있는지"를 스스로 학습(보정)하는 절차다(open-loop 강제 회전 + 결과 판정). 이 보정이 틀어져 있으면 모터가 힘을 제대로 못 내거나 진동·소음이 커질 수 있어, 신품 교체나 정비 후 한 번씩 실행해줘야 하는 커미셔닝(초기 설정) 성격의 기능이다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D1F7 | Rotor position sensor calibration set value | ⬜ CSV 미등록 |
| D1F8 | Rotor position sensor calibration (트리거 비트) | ⬜ CSV 미등록 |

### P1-9. RFID 액세스 / 고객 스크래치 데이터 — ⬜ 미구현
스펙 2.56, 2.57절. RFID는 팬 근처에 RFID 리더를 태그처럼 대서 설정을 읽거나 쓸 수 있게 하는 근거리 무선 액세스 기능이며(D16F는 이 기능 자체를 켜고 끄는 스위치), 고객 데이터(D170~D17F)는 스펙이 용도를 정해두지 않은 "자유 메모지" 16칸으로 우리 회사가 원하는 아무 값(예: 설치 위치 코드, 자산번호)이나 저장해두고 나중에 읽어볼 수 있는 여분 저장공간이다. 우선순위는 낮지만 구현 난이도도 낮은 항목.

| 주소 | 이름 | 상태 |
|---|---|---|
| D16F | RFID access (RFID 안테나 활성/비활성) | ⬜ CSV 미등록 |
| D170~D17F | Customer data 0~15 (자유 사용 16개 레지스터) | ⬜ (CSV 있음, N — 16개 행) |

### P1-10. 플래그/기능 보정 — Serial Number & Fan type
§1의 "발견된 데이터 오류 2"에 대응. 조사해보니 시리얼 번호와 제조일자(`D1A2`~`D1A4`)는 사실 이미 코드(Serial Number 탭)에 구현되어 있는데 CSV 문서에만 "미구현"으로 잘못 표시돼 있었다 — 실제 개발 작업은 필요 없고 플래그만 `Y`로 정정하면 된다. 반면 팬 모델명(`D1A5`~`D1AA`, Fan type 1~6, ASCII)은 정말로 아직 UI에 노출되지 않고 있어서, "이 팬이 정확히 어떤 모델인지"를 화면에서 바로 확인할 수 없는 상태다 — 이 부분은 실제 UI 노출 작업이 필요하다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D1A2~D1A4 | Serial Number 1/2, Date of manufacture | ✅ (플래그만 정정 필요) |
| D1A5~D1AA | Fan type 1~6 | ⬜ (CSV 있음, N — 6개 행) |

---

## 5. P2 — 하드웨어 의존 / 저ROI, 후순위

이 티어는 우선순위가 낮아 레지스터별 CSV 등록 여부를 개별 표시하지는 않았다 — 대부분 CSV에 행 자체가 없는 상태다.

### P2-1. 미러 레지스터 (Mirror function) — ⬜ 미구현 (CSV 미등록)
스펙 2.64, 2.65, 3.29절. 원래 여기저기 흩어져 있는 레지스터 최대 32개(홀딩)/16개(입력)를 "원하는 순서대로" 한 곳에 나란히 재배치해두고, 딱 한 번의 읽기/쓰기 명령으로 그 값들을 몽땅 가져오거나 써버릴 수 있게 해주는 전송 최적화 기능이다. PLC처럼 폴링 주기가 짧고 여러 값을 자주 읽어야 하는 외부 마스터에는 유용하지만, 이 웹 앱은 단일 브라우저 클라이언트라 애초에 폴링 부담이 크지 않아 우선순위가 낮다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D380~D39F | Mirrored holding registers | ⬜ CSV 미등록 |
| D480~D49F | Original addresses of mirrored holding registers | ⬜ CSV 미등록 |
| D100~D10F (input) | Mirrored input registers | ⬜ CSV 미등록 |
| D400~D40F | Original addresses of mirrored input registers | ⬜ CSV 미등록 |

### P2-2. Mask-out 범위 + 진동 테스트런 — ⬜ 미구현 (진동센서 옵션 하드웨어 필요, CSV 미등록)
스펙 2.13, 2.14, 2.66~2.68절. 팬은 특정 속도 구간에서 기계적 공진(떨림)이 심해지는 경우가 있는데, 이 기능은 "테스트런"이라는 자동 진단 절차를 돌려 진동이 심한 위험 속도/출력 구간을 스스로 찾아낸 뒤(D356/D357), 실제 운전 중에는 그 구간을 건너뛰도록(D604~D617) 만드는 기능이다. 문제는 이걸 하려면 팬 안에 실제 진동을 측정하는 진동센서 옵션이 내장돼 있어야 해서, 해당 하드웨어가 없는 일반 팬 SKU에는 적용할 수 없다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D011 (holding) | Test run Control | ⬜ CSV 미등록 |
| D012 (holding) | Mask-out Back-up Control | ⬜ CSV 미등록 |
| D603 | Mask-out Control | ⬜ CSV 미등록 |
| D604~D617 | Speed / Modulation level mask-out range 1~5 | ⬜ CSV 미등록 |
| D342~D355 | 위 항목들의 back-up 값 | ⬜ CSV 미등록 |
| D356 / D357 | Test run time stamp / Number of mask-out ranges | ⬜ CSV 미등록 |

### P2-3. 진동센서 입력 레지스터 / 내부 버스 슬레이브 선택 — ⬜ 미구현 (하드웨어 의존, CSV 미등록)
스펙 2.67, 3.27, 3.28절. P2-2(Mask-out) 기능이 실제로 사용하는 원본 데이터 — 축 방향별(X/Y/Z) 진동 속도 값과 그 측정 시각을 읽어오는 부분이다. 마찬가지로 진동센서가 물리적으로 달린 팬에서만 값이 나온다.

| 주소 | 이름 | 상태 |
|---|---|---|
| D61A | Device internal bus slave select | ⬜ CSV 미등록 |
| D040~D04A (input) | Vibration sensor time stamp/speed/harmonic·RMS velocity (X/Y/Z) | ⬜ CSV 미등록 |
| D04B (input) | Vibration status | ⬜ CSV 미등록 |

### P2-4. Diagnostics (FC 0x08) — ⬜ 미구현
스펙 1.3.4절. 마스터가 임의의 데이터를 보내면 슬레이브가 그대로 되돌려주는 "메아리 테스트" 커맨드로, 통신 배선이나 프로토콜 스택이 제대로 동작하는지 개발/설치 단계에서 점검할 때만 쓰는 내부 테스트용 기능이다. 평소 사용자가 쓸 일은 거의 없다. (레지스터가 아니라 커맨드 자체이므로 CSV 대상 아님.)

---

## 6. 부록

### 6.1 스펙 조항 ↔ 레지스터 빠른 참조

| 절 번호 | 주제 | 관련 주소 |
|---|---|---|
| 1.3.6 | 시리얼번호 어드레싱 커맨드 | 0x43/0x44/0x46/0x50 |
| 2.2~2.14 | Reset/Password/Factory·Customer 설정/카운터/Addressing/Enable/Remote/Test run/Mask-out backup | D000~D012 |
| 2.15~2.36 | Fan address, Set value/방향/파라미터셋 소스, 제어 P/I, 모듈레이션·속도 제한 | D100~D128 |
| 2.37~2.43 | 입력특성곡선, Limitation Control, 0-10V 출력, Power limiter, 코일전류, 속도감시, 센서소스 | D12A~D147 |
| 2.44~2.45 | 인터페이스 설정, Shedding function | D149, D14A, D150~D153 |
| 2.46 | I/O 구성 | D158~D15A |
| 2.47~2.57 | Fail-safe, 센서 scaling, Enable/Disable source, 전압출력, RFID, 고객데이터 | D15B~D17F |
| 2.58~2.63 | 운영시간 백업, 에러 히스토리, DC-link 기준값, 제조정보, 로터센서 캘리브레이션 | D180~D1F8 |
| 2.64~2.65 | 미러 레지스터 (홀딩/입력) | D380~D49F |
| 2.66~2.68 | Mask-out 범위, 테스트런 | D342~D357, D603~D617 |
| 2.69~2.71 | 에러/경고 출력 지연, 릴레이 마스크 | D620~D624 |
| 3.2~3.29 | Input register 전체 (식별/상태/전력/에너지/진동) | D000~D04B (input) |

### 6.2 신규 파라미터 추가 시 반영해야 할 코드 위치 (개발자 노트)

새 Holding/Input register를 UI에 노출하려면 아래 3곳을 함께 갱신해야 한다 (기존 패턴 재사용). 특히 위 표에서 **"CSV 미등록"**으로 표시된 항목은 값을 켜는 게 아니라 아래 1번부터 신규로 정의해야 한다.

1. `parameters.csv` + `getDefaultParameters()` (app.js:6488) — 파라미터 정의(주소/이름/타입/설명) 및 "Parameters 탭 → Read All" 대상 등록.
2. `getConfigParamMap()` (app.js:~17710) — Device-setup > Configuration 탭에서 읽기/쓰기할 라이브 매핑.
3. `renderDeviceSetupConfig`의 카테고리 목록 (app.js:19072-19092) — 새 기능 그룹이면 신규 카테고리 추가, 기존 그룹 확장이면 해당 카테고리의 `getConfigCategoryHTML` case에 필드 추가.

TX(쓰기)는 반드시 `writeRegister(slaveId, address, value)`, RX(읽기)는 `readRegisterWithTimeout`/`readInputRegisterWithTimeout`을 통해야 한다 — CLAUDE.md의 485 버스 접근 규칙 참조.
