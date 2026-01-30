# Modbus RTU/RS-485 Dashboard

웹 브라우저에서 Modbus RTU/RS-485 통신을 테스트할 수 있는 대시보드 애플리케이션입니다.

## 주요 기능

### 제품 테스트 대시보드
- 여러 Modbus 슬레이브 장치 동시 관리
- 일괄 제어 (선택된 장치들 동시 제어)
- 개별 제어 (장치별 독립 제어)
- RPM/% 모드 전환
- 카드/리스트 뷰 모드
- 자동 ID 할당 기능

### 실시간 차트
- 4채널 실시간 데이터 모니터링
- Continuous/Trigger 모드
- Zoom, Pan, Cursor 지원
- 마커 및 델타 측정
- CSV/PNG 내보내기

### Modbus 프로토콜 지원
- **읽기 기능**
  - FC01: Read Coils
  - FC02: Read Discrete Inputs
  - FC03: Read Holding Registers
  - FC04: Read Input Registers

- **쓰기 기능**
  - FC05: Write Single Coil
  - FC06: Write Single Register
  - FC15: Write Multiple Coils
  - FC16: Write Multiple Registers

- **커스텀 기능**
  - FC66 (0x66): Firmware Update Protocol

### 펌웨어 업데이트
- 4단계 업데이트 프로세스 (Init → Erase → Data Transfer → Done)
- .bin, .hex, .fw 파일 지원
- 진행률 표시 및 로그 출력

### 파라미터 관리
- CSV 가져오기/내보내기
- 파라미터 필터링 (Holding/Input Registers)
- 파라미터 읽기/쓰기

### 통신 모니터
- 실시간 송수신 로그
- HEX/DEC 포맷 전환
- 바이트별 정보 툴팁
- 가상 스크롤 (대용량 로그 지원)

### 시뮬레이터
- 가상 Modbus 슬레이브
- 실제 하드웨어 없이 테스트 가능
- 펌웨어 업로드 시뮬레이션

---

## 프로젝트 구조

### 기존 구조 (Legacy)
```
web_gui/
├── index.html          # 메인 HTML
├── styles.css          # 스타일시트
├── app.js              # 메인 애플리케이션 (6,400+ 줄)
├── modbus.js           # Modbus 프로토콜 라이브러리
├── simulator.js        # 가상 슬레이브 시뮬레이터
└── parameters.csv      # 파라미터 정의
```

### 모듈화된 구조 (ES6 Modules)
```
web_gui/
├── index.html
├── styles.css
├── app.js              # (기존 유지 - 호환성)
├── modbus.js           # (기존 유지 - 호환성)
├── simulator.js        # (기존 유지 - 호환성)
│
├── js/                 # 모듈화된 코드
│   ├── app.js          # 메인 진입점 (~350줄)
│   │
│   ├── core/           # 핵심 인프라
│   │   ├── EventBus.js       # 이벤트 기반 모듈 통신
│   │   └── ModbusProtocol.js # Modbus RTU 프로토콜
│   │
│   ├── modules/        # 기능별 모듈
│   │   ├── ChartManager.js        # 실시간 차트
│   │   ├── CommunicationLayer.js  # 시리얼 통신
│   │   ├── MonitorModule.js       # 통신 모니터
│   │   ├── StatisticsManager.js   # 통계 관리
│   │   ├── SettingsManager.js     # 설정 관리
│   │   ├── ParameterManager.js    # 파라미터 관리
│   │   ├── DeviceManager.js       # 장치 관리
│   │   ├── FirmwareManager.js     # 펌웨어 업데이트
│   │   └── AutoScanModule.js      # 자동 장치 탐색
│   │
│   ├── utils/          # 유틸리티
│   │   └── helpers.js  # 공통 함수
│   │
│   └── simulator.js    # 시뮬레이터 (ES6 모듈)
│
└── data/
    └── parameters.csv  # 파라미터 정의
```

### 모듈별 책임

| 모듈 | 책임 | 예상 줄 수 |
|------|------|-----------|
| `EventBus.js` | 모듈 간 이벤트 기반 통신 | ~130 |
| `ChartManager.js` | 4채널 실시간 차트, 줌/팬 | ~950 |
| `CommunicationLayer.js` | Web Serial API, 프레임 송수신 | ~400 |
| `MonitorModule.js` | 통신 로그 패널, 바이트 툴팁 | ~550 |
| `DeviceManager.js` | 장치 관리, 자동 폴링 | ~400 |
| `ParameterManager.js` | 파라미터, CSV 처리 | ~300 |
| `FirmwareManager.js` | 4단계 펌웨어 업로드 | ~350 |
| `StatisticsManager.js` | 통신 통계 | ~250 |
| `SettingsManager.js` | 설정 관리, 모달 | ~280 |
| `AutoScanModule.js` | 장치 자동 탐색 | ~250 |

---

## 시스템 요구사항

### 브라우저
이 애플리케이션은 **Web Serial API**를 사용하므로 다음 브라우저에서만 작동합니다:
- Google Chrome (89 이상)
- Microsoft Edge (89 이상)
- Opera (75 이상)

**참고**: Firefox, Safari는 Web Serial API를 지원하지 않습니다.

### 하드웨어
- USB-to-RS485 변환기 (예: CH340, FTDI, CP2102 등)
- Modbus RTU 슬레이브 장치 (또는 내장 시뮬레이터 사용)

---

## 사용 방법

### 1. 실행 방법

#### 방법 A: 직접 열기
1. Chrome 또는 Edge 브라우저에서 `index.html` 파일을 엽니다.

#### 방법 B: 로컬 서버 사용 (권장)
```bash
# Python
python -m http.server 8000

# Node.js
npx http-server

# 브라우저에서 접속
http://localhost:8000
```

### 2. 스크립트 로딩 옵션

`index.html`에서 두 가지 방식을 선택할 수 있습니다:

**옵션 1: 기존 방식 (기본값)**
```html
<script src="modbus.js"></script>
<script src="simulator.js"></script>
<script src="app.js"></script>
```

**옵션 2: 모듈화된 방식**
```html
<script type="module" src="js/app.js"></script>
```

### 3. 시리얼 포트 연결

1. 좌측 사이드바에서 시리얼 포트 설정:
   - Baud Rate: 9600, 19200, 115200 등
   - Data Bits: 8
   - Parity: None, Even, Odd
   - Stop Bits: 1, 2

2. **Connect** 버튼 클릭
3. 브라우저에서 시리얼 포트 선택

### 4. 시뮬레이터 사용

하드웨어 없이 테스트하려면:
1. Settings → Simulator 메뉴
2. **Activate** 버튼 클릭
3. 가상 슬레이브 ID 설정 (기본: 1)

---

## 페이지별 기능

### Dashboard
- 장치 카드/리스트 뷰
- 일괄 제어 (선택된 장치들)
- 개별 Setpoint 조절
- 자동 폴링

### Modbus
- Function Code 선택
- 시작 주소, 수량 설정
- 읽기/쓰기 테스트

### Parameters
- CSV 가져오기/내보내기
- 필터링 (Type, Implemented)
- 검색 기능

### Chart
- 4채널 실시간 그래프
- Continuous/Trigger 모드
- Zoom (Scroll), Pan (Drag)
- 마커 설정 (클릭)
- CSV/PNG 내보내기

### Firmware
- 파일 선택 (.bin, .hex, .fw)
- 4단계 업로드 프로세스
- 진행률 표시

---

## 모듈화 아키텍처

### EventBus 이벤트 목록

```javascript
// 시리얼 통신
SERIAL_CONNECTED, SERIAL_DISCONNECTED, SERIAL_ERROR

// Modbus 프레임
FRAME_SENT, FRAME_RECEIVED, FRAME_ERROR, FRAME_TIMEOUT

// 장치 관리
DEVICE_ADDED, DEVICE_REMOVED, DEVICE_UPDATED
DEVICE_SELECTED, DEVICE_DESELECTED

// 자동 스캔
SCAN_STARTED, SCAN_PROGRESS, SCAN_FOUND, SCAN_COMPLETED

// 통계
STATS_UPDATED, STATS_RESET

// 펌웨어
FIRMWARE_STARTED, FIRMWARE_PROGRESS, FIRMWARE_COMPLETE, FIRMWARE_ERROR

// 차트
CHART_STARTED, CHART_STOPPED, CHART_DATA

// 설정
SETTINGS_CHANGED, SETTINGS_LOADED

// UI
PAGE_CHANGED, TOAST_SHOW, MONITOR_TOGGLE
```

### 모듈 간 의존성

```
EventBus (중앙 이벤트 허브 - 모든 모듈이 참조)
    │
    ├── ModbusProtocol (프로토콜 정의)
    │
    ├── CommunicationLayer ← ModbusProtocol, Simulator
    │
    ├── MonitorModule ← EventBus (이벤트 수신만)
    ├── StatisticsManager ← EventBus
    ├── SettingsManager ← EventBus
    │
    ├── DeviceManager ← CommunicationLayer
    ├── ParameterManager ← CommunicationLayer
    ├── FirmwareManager ← CommunicationLayer, ModbusProtocol
    ├── AutoScanModule ← CommunicationLayer, DeviceManager
    │
    └── ChartManager ← EventBus
```

---

## 문제 해결

### 포트 연결 실패
- USB-to-RS485 변환기 연결 확인
- 장치 관리자에서 COM 포트 인식 확인
- 다른 프로그램의 포트 사용 여부 확인

### 응답 없음
- Baud rate, parity, stop bits 설정 확인
- Slave ID 확인
- RS485 A/B 배선 확인
- 슬레이브 장치 전원 확인

### CRC 에러
- 배선 문제 또는 전기적 노이즈
- 케이블 길이 줄이기 또는 차폐 케이블 사용
- 종단 저항(120Ω) 연결 확인

### Exception 응답
- **01**: Illegal Function - 지원하지 않는 Function Code
- **02**: Illegal Data Address - 잘못된 레지스터 주소
- **03**: Illegal Data Value - 잘못된 데이터 값
- **04**: Slave Device Failure - 슬레이브 장치 오류

---

## 기술 스택

- **HTML5**: 웹 페이지 구조
- **CSS3**: 반응형 디자인, Flexbox/Grid 레이아웃
- **JavaScript (ES6+)**: 클래스, 모듈, async/await
- **Web Serial API**: 시리얼 포트 통신
- **Canvas API**: 실시간 차트 렌더링
- **LocalStorage**: 설정 및 데이터 저장

---

## 라이선스

이 프로젝트는 교육 및 테스트 목적으로 자유롭게 사용할 수 있습니다.

## 주의사항

- 이 도구는 테스트 및 개발 목적으로 사용하세요
- 프로덕션 환경에서는 검증된 Modbus 마스터 소프트웨어를 사용하세요
- RS485 배선 시 극성(A/B)에 주의하세요
- 장비 손상을 방지하기 위해 올바른 Slave ID와 주소를 사용하세요
