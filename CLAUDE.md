# web_gui Project Guide for Claude

## 프로젝트 개요
Modbus RTU/RS-485 Dashboard 웹앱.
- 주요 파일: `app.js` (~10000+ lines), `styles.css`, `index.html`
- Web Serial API 사용 (RS-485 통신)

---

## ⚠️ 485 버스 접근 규칙 (가장 중요)

### 절대 금지: `this.writer.write(frame)` 직접 호출
새 기능 추가 시 반드시 아래 안전한 경로를 통해야 함.

### 안전한 경로
| 용도 | 사용할 함수 |
|------|------------|
| 레지스터 쓰기 | `writeRegister(slaveId, address, value)` |
| 파라미터 읽기 | `readParameterByAddress(param)` |
| 폴링 내부 읽기 | `readRegisterWithTimeout()` / `readInputRegisterWithTimeout()` |

### 이유
polling 중 직접 `writer.write()`를 호출하면 485 버스 충돌 발생:
```
폴링: Slave 7 TX → 응답 대기 중
신규 TX 직접 호출  ← 충돌 → "Slave 7: Response timeout"
```

### Command Queue 구조
- `autoPollingTimer` 가 설정되어 있으면(polling 중) → queue에 등록
- polling 없으면 → 직접 전송
- Queue 아이템: `{ type: 'write'|'read', frame, slaveId, address, resolve, reject }`
- Queue 처리: `pollNextDeviceSequential()` — 폴링 사이클 사이에 소진

### 새 기능에서 TX가 필요할 때 체크리스트
1. `this.autoPollingTimer` 체크
   - polling 중 → `commandQueue.push(...)` 으로 등록
   - polling 아님 → `sendAndWaitResponse()` 또는 `sendWriteAndWaitResponse()` 직접 호출
2. scan처럼 `isScanning=true`로 폴링을 막는 경우라도,
   이미 진행 중인 사이클이 있을 수 있으니 `while (this.isPolling) await delay(5)` 대기 후 전송

---

## 주요 상태 변수
- `this.selectedParamDeviceId` — Parameters Read All 용 slave ID. `applyFanAddress` 후 반드시 동기화
- `this.currentSetupDeviceId` — Configuration 탭에서 선택된 디바이스의 내부 ID
- `this.autoPollingTimer` — polling 활성 여부
- `this.isPolling` — 현재 폴링 사이클 진행 중 여부
- `this.isScanning` — 디바이스 스캔 중 여부 (true면 polling 루프 일시정지)
- `this.commandQueue` — 대기 중인 write/read 명령 배열

---

## 주요 레지스터
| 주소 | 이름 | 비고 |
|------|------|------|
| 0xD000 | Reset / EEPROM | |
| 0xD001 | Setpoint | holding, FC03 |
| 0xD011 | Motor Status | input, FC04, scan 레지스터로 사용 |
| 0xD100 | Fan Address | Modbus slave ID |
| 0xD102 | Running Direction | 0=CCW, 1=CW |
| 0xD106 | Operating Mode | 0=Speed Control, 2=Open-loop |
| 0xD119 | Maximum Speed | 디바이스 미구현, 임시 1600 RPM 하드코딩 |
| 0xD13B | Max Coil Current | |
| 0xD02D | Actual Speed | input |

## Setpoint 변환
- Speed Control (mode=0): `raw = rpm / maxSpeed * 64000` (maxSpeed=1600 임시)
- Open-loop (mode=2): `raw = pct / 100 * 65535`
- 역변환: `convertRawToSetpoint(device, raw)`

---

## Dashboard ⚙ 모달 (showDeviceEditModal)
- 대시보드 카드의 ⚙ 버튼 → `showDeviceEditModal(device.id)`
- 모달이 열리는 동안 페이지의 `#deviceSetupConfig` innerHTML을 비워서 중복 ID 제거
- 닫힐 때 원래 내용 복원
- 이렇게 하지 않으면 `getElementById`가 모달 대신 페이지의 요소를 먼저 찾아 값이 잘못 전달됨
