# FanCM renewal

기존 `index.html` / `app.js`를 건드리지 않고, 새 디자인을 화면 단위로 쌓아 가는 폴더입니다.
근거 문서: `docs/claude-design-redesign-prompt.md`, 초안: `docs/ui-redesign/`.

## 실행

Chrome 또는 Edge에서 `renewal/index.html`을 엽니다. 서버 없이 `file://`로 동작합니다.
하드웨어가 없으면 화면 아래 **Start the simulator**로 전체 흐름을 볼 수 있습니다.

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 첫 화면(Connect 온보딩) 마크업. 아이콘은 인라인 SVG 심볼 |
| `dashboard.html` | 대시보드 마크업. 카드는 `dashboard.js`가 렌더링 |
| `styles.css` | 디자인 토큰(라이트/다크), 셸(레일·상단바), 프리미티브(칩·버튼·세그·스위치·토스트), Connect 화면 |
| `dashboard.css` | 툴바·필터, 제품군 그룹과 디바이스 카드, 목록 뷰, 일괄 제어 바, 팝오버·툴팁·메뉴, 빈 상태 |
| `shared.js` | 두 화면이 공유: 테마, 세그먼트 컨트롤 썸, 버튼 라벨·칩 블러 교체, 토스트 |
| `app.js` | Connect: Web Serial 포트 목록·권한 요청·열기, 3단계 상태 전환, 스캔 진행 표시 |
| `dashboard.js` | Dashboard: 세션 로드, 카드/목록 렌더링, 선택과 일괄 제어, 필터·검색, 폴링과 쓰기 큐 시뮬레이션 |

## 첫 화면 흐름

1. **Connect port** — 허용된 포트 목록, 통신 설정, "연결 후 스캔" 스위치
2. **Discover devices** — ID 범위 순차 폴링, 진행 바, 발견 즉시 행 추가
3. **Identify models** — 모델 확인/수정 후 **Open dashboard** → `dashboard.html`

연결되면 상단바 칩이 `포트 · 115200 8N1 · N devices`로 바뀌고 레일의 페이지 항목이 풀립니다.

## 대시보드

- **상단바**: 연결 칩(클릭 → 포트 팝오버: 재연결/해제), Live 스위치와 폴 사이클, 통신 통계(호버 툴팁), 역할, 테마
- **툴바**: 검색(이름·ID·시리얼), 전체 선택, 카드/목록 뷰, Scan, Add device
- **필터 칩**: 전체 / 제품군별(M·S·미식별) / Running·Alarm·Offline, 개수 실시간 갱신
- **제품군 그룹**: EC-FAN M, EC-FAN S, Unidentified 순. 그룹별 Select all
- **카드 상태**: Running·Stopped·Alarm·Offline, 쓰기 수명주기 Idle → Queued(n ahead) → Writing → Confirmed hh:mm:ss / Failed, Limit active, 갱신 신선도(↻ 0.3 s / 42 s ago)
- **일괄 제어 바**: 1개 이상 선택하면 아래에서 올라옴. RPM/% 단위, 프리셋, 값 입력, Apply to N, Stop, Reset alarms. 기존 All Device Control을 대체
- **빈 상태**: Connect에서 0개로 넘어오면 Scan/Add device 안내. `dashboard.html`을 직접 열면 데모 데이터 7개

## 아직 스텁인 것

- `scanBus()` (Connect) — 시뮬레이터일 때만 가짜 슬레이브를 돌려줍니다. 실제 버스 스윕은 `modbus.js`의 FC04 `0xD011` 읽기로 교체해야 합니다.
- `pollCycle()` / `processWriteQueue()` (Dashboard) — 1차 지연 모델로 actual 값을 흉내 내고, 사이클당 쓰기 1건을 처리합니다. 실제 연결은 CLAUDE.md의 안전 경로(`readInputRegisterWithTimeout`, `writeRegister`)로 교체합니다.
- 대시보드는 Connect에서 연 SerialPort 객체를 넘겨받지 못합니다(페이지 이동). 허용된 포트를 `getPorts()`로 다시 열어야 합니다.
- Identify model, Add device, Change fan address는 `prompt()` 또는 토스트로 대체되어 있습니다. Devices 화면이 생기면 거기로 연결합니다.
- 포트 이름 — Web Serial은 COM 번호를 주지 않으므로 `Port 1`, `Port 2`로 표시합니다. 벤더 ID로 CH340/FTDI/CP210x 정도는 구분합니다.

## 모션 규칙 (emil-design-eng 기준)

- 전환은 `transform`/`opacity`/`filter`만. 카드 높이 전환은 온보딩 한 번뿐이라 허용
- 진입 `ease-out` 커스텀 커브, UI 전환 300ms 이하, 버튼 `:active` scale(0.97)
- 자주 바뀌는 것은 움직이지 않음: 폴링 숫자는 즉시 교체, 카드의 RPM/% 토글은 썸 없이 즉시 전환, 필터 전환 무애니메이션
- 상태 변화만 블러 크로스페이드(쓰기 칩 Queued→Writing→Confirmed, 버튼 라벨)
- 팝오버·메뉴는 트리거 모서리에서 scale(.97→1), 모달이 아니므로 중앙 원점 금지. 닫힘은 열림보다 빠르게
- 일괄 제어 바는 아래에서 260ms로 올라오고 160ms로 내려감
- 호버 효과는 `(hover:hover) and (pointer:fine)`에서만
- `prefers-reduced-motion`이면 이동·블러 제거, 페이드만 유지
