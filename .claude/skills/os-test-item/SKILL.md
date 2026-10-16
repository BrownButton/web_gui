---
name: os-test-item
description: web_gui/FanCM의 OS 검증 화면에 Modbus RTU 시험 항목을 추가·구현할 때 사용한다. os-test-modbus.js(또는 다른 os-test-*.js)의 tests/executors에 modbus0X 항목을 만들 때, "OS 검증 항목 추가", "FC 0xNN 테스트 구현", "시험 항목 구현", "modbus 테스트 만들어줘"처럼 요청하면 반드시 이 스킬을 먼저 읽는다. 통신 API 사용 규칙, 로그 패턴, Phase 구성, 판정 반환 형식을 정한다.
---

# OS 검증 테스트 항목 구현 스킬

OS 검증서의 새 시험 항목을 `os-test-modbus.js`(또는 다른 os-test-*.js)에 구현할 때 사용한다.

## 사용법

```
/os-test-item
```

사용자가 시험 항목 명세(시험 목적, Phase별 시험 방법, 판정 기준)를 제공하면, 아래 규칙에 따라 구현한다.

---

## 구현 절차

### 1. 명세 파악

사용자에게 다음을 확인한다 (제공되지 않은 경우만):
- **테스트 ID** — `modbus01`, `modbus02` 등 (`tests` / `executors` 키)
- **시험 번호 / 제목** — `number`, `title`
- **Phase별 시험 방법과 판정 기준** — Phase 2(정상), Phase 3-x(예외), Phase 4(버퍼 복구)
- **사용할 레지스터 주소 / FC 코드**

---

### 2. `tests` 정의 작성 규칙

```js
'modbus0X': {
  id: 'modbus0X',
  category: 'Modbus RTU',
  number: '2-X',
  title: '...',
  description: '한 줄 요약',
  purpose: '상세 시험 목적',
  model: 'EC-FAN',
  equipment: 'EC FAN 1EA, USB to RS485 Converter',
  criteria: '한 줄 합격 기준 요약',
  steps: [
    '[Phase 2-1] 시험 내용\n판정 기준: ...',
    '[Phase 2-2] 시험 내용\n판정 기준: ...',
    '[Phase 3-1] 시험 내용\n판정 기준: ...',
    // ...
    '[Phase 4] 버퍼 자가 복구\n판정 기준: 정상 응답값 수신 (버퍼 복구 완료)',
  ],
},
```

**steps 작성 규칙:**
- 각 항목은 `'[Phase X-Y] 시험 내용\n판정 기준: ...'` 형식
- TX 프레임 표기는 steps에 넣지 않음 (executor 로그에만 표기)
- Phase 4는 항상 버퍼 자가 복구 확인

---

### 3. `executors` 작성 규칙

```js
'modbus0X': async function() {
  const self = this;
  self.checkConnection();

  // Phase 2-1  [step 0]
  self.addLog('▶ Phase 2-1 시작', 'info');
  self.addLog('[Phase 2-1] ...', 'step');
  self.updateStepStatus(0, 'running');
  self.updateProgress(5, 'Phase 2-1: ...');
  // ... 통신 ...
  self.updateStepStatus(0, 'success');
  await self.delay(200);
  self.checkStop();  // ← 모든 Phase 사이에 반드시 삽입

  // Phase 2-2  [step 1]
  // ...

  // Phase 4  [step N]
  self.addLog('▶ Phase 4 시작', 'info');
  self.addLog('[Phase 4] 버퍼 자가 복구 — 정상 FC 재시도', 'step');
  self.updateStepStatus(N, 'running');
  self.updateProgress(85, 'Phase 4: 버퍼 복구');
  // 정상 읽기 1회
  // ...

  self.updateProgress(100, '테스트 완료');
  self.addLog('FC 0xXX 프레임 검증: 합격', 'success');
  return {
    status: 'pass',
    message: '...',
    details: 'Phase 2-1: ...\nPhase 2-2: ...\n...\nPhase 4: 버퍼 복구 확인',
  };
},
```

---

### 4. 통신 API 사용 규칙 (필수 준수)

| 용도 | 사용 함수 |
|------|-----------|
| Holding Register 단일 읽기 | `window.dashboard.readRegisterWithTimeout(slaveId, address)` |
| Input Register 단일 읽기 | `window.dashboard.readInputRegisterWithTimeout(slaveId, address)` |
| 단일 레지스터 쓰기 | `window.dashboard.writeRegister(slaveId, address, value)` |
| Raw 프레임 송신 (정상 CRC) | `window.dashboard.sendRawFrameWithTimeout(frame, slaveId)` → 첫 레지스터 값 반환 |
| Raw 프레임 송신 + 전체 응답 | `window.dashboard.sendAndReceive(frame, timeout, {minLength})` → Uint8Array 반환 |
| 다수 레지스터 프레임 빌드 | `window.dashboard.modbus.buildReadHoldingRegisters(slaveId, address, qty)` |

**절대 금지:** `writer.write()`, `sendAndWaitResponse()`, `sendWriteAndWaitResponse()` 직접 호출

**`sendAndReceive` 사용 시점:**
- Raw 응답 바이트를 직접 확인해야 할 때 (Byte Count, Exception Code 등)
- 응답 길이: FC03/04 = `1+1+1+qty*2+2` bytes, Exception = 5 bytes

---

### 5. 로그 패턴

```js
// Phase 시작
self.addLog('▶ Phase X-Y 시작', 'info');
self.addLog('[Phase X-Y] 시험 내용', 'step');

// TX 프레임 (빌드된 경우)
const frame = window.dashboard.modbus.buildReadHoldingRegisters(...);
const hex = Array.from(frame).map(b => b.toString(16).toUpperCase().padStart(2,'0')).join(' ');
self.addLog(`TX: ${hex}`, 'info');

// 결과
self.addLog('✓ 정상 응답: 0x....', 'success');
self.addLog('⚠ 예상치 않은 응답: ...', 'warning');
self.addLog('✗ 응답 없음 (Timeout)', 'error');

// RX 프레임 표시 (raw 응답 시)
const rxHex = Array.from(resp).map(b => b.toString(16).toUpperCase().padStart(2,'0')).join(' ');
self.addLog(`RX: ${rxHex}`, 'info');
```

---

### 6. Exception 응답 판정 패턴

```js
// Exception 코드 확인 (sendAndReceive 사용 시)
if (!resp || resp.length < 3) {
  self.addLog('✗ 응답 없음 (Timeout)', 'error');
} else if ((resp[1] & 0x80) && resp[2] === 0x02) {
  self.addLog('✓ Exception 0x02 (Illegal Data Address) 수신 — PASS', 'success');
} else if ((resp[1] & 0x80) && resp[2] === 0x03) {
  self.addLog('✓ Exception 0x03 (Illegal Data Value) 수신 — PASS', 'success');
} else {
  self.addLog(`⚠ 예상치 않은 응답: ${rxHex}`, 'warning');
}
```

---

### 7. progress 배분 가이드

| Phase | updateProgress 값 |
|-------|-------------------|
| Phase 2-1 | 5 |
| Phase 2-2 (반복 시) | 15 + i*5 |
| Phase 3-1 | 40 |
| Phase 3-2 | 55 |
| Phase 3-3 | 70 |
| Phase 4 | 85 |
| 완료 | 100 |

---

### 8. fail 조기 반환 패턴

```js
if (val === null || val === undefined) {
  self.updateStepStatus(N, 'error');
  return {
    status: 'fail',
    message: 'Phase X-Y: 응답 없음 (Timeout)',
    details: '...'
  };
}
```

Phase 3-x의 예외 테스트는 예상치 않은 응답이어도 `warning` 로그만 남기고 **fail 반환하지 않음** (테스트 속행).
Phase 4 무응답 시에만 fail 반환.

---

### 9. 참조 구현

`os-test-modbus.js`의 `modbus01` executor가 이 스킬의 기준 구현체다.
새 항목 작성 전 반드시 `modbus01`을 읽고 패턴을 확인한다.
