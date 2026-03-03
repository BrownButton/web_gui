# 05. WebSerial 통신

## 1. Web Serial API란?

**Web Serial API**는 Chrome/Edge 브라우저에서 직접 COM 포트(시리얼 포트)에 접근할 수 있게 해주는 브라우저 내장 API입니다.

기존에는 웹 브라우저에서 하드웨어 포트에 직접 접근하는 것이 불가능했습니다.
Web Serial API는 이 한계를 해결하여 웹 앱에서도 RS-485, USB-시리얼 변환기 등을 제어할 수 있게 합니다.

### C#과의 비교

| 기능 | C# (System.IO.Ports) | Web Serial API |
|------|---------------------|----------------|
| 포트 열기 | `new SerialPort("COM3", 9600)` | `navigator.serial.requestPort()` |
| 포트 설정 | `port.BaudRate = 9600` | `port.open({ baudRate: 9600, ... })` |
| 데이터 쓰기 | `port.Write(buffer, 0, len)` | `writer.write(buffer)` |
| 데이터 읽기 | `port.Read(buffer, 0, len)` | `await reader.read()` |
| 포트 닫기 | `port.Close()` | `port.close()` |
| 포트 목록 | `SerialPort.GetPortNames()` | 사용자 선택 다이얼로그 |

### 보안 모델 차이

C#은 코드에서 COM3, COM4 등 포트 이름을 직접 지정할 수 있지만,
Web Serial은 **사용자가 직접 포트를 선택**해야 합니다.
이는 보안상 웹 앱이 임의로 모든 포트에 접근하는 것을 막기 위한 설계입니다.

---

## 2. 연결 흐름

### 사용자 관점

```
1. 앱에서 "연결" 버튼 클릭
2. 브라우저 포트 선택 다이얼로그 팝업 (COM3, COM4... 목록)
3. 사용자가 포트 선택 후 "연결" 클릭
4. 연결 완료 → 상태바 "연결됨" 표시
5. 자동 폴링 시작
```

### 코드 관점 (app.js 내부)

```javascript
async connectSerial() {
    // ① 사용자에게 포트 선택 다이얼로그 표시
    this.port = await navigator.serial.requestPort();

    // ② 포트를 RS-485 설정으로 열기
    await this.port.open({
        baudRate: 9600,      // 보드레이트 (설정에서 변경 가능: 9600~115200)
        dataBits: 8,         // 데이터 비트
        stopBits: 1,         // 정지 비트
        parity: 'none'       // 패리티 (none / even / odd)
    });

    // ③ 송신(Writer)과 수신(Reader) 스트림 얻기
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();

    // ④ 백그라운드에서 데이터 수신 루프 시작
    this.startReading();

    // ⑤ 자동 폴링 시작
    this.startAutoPolling();
}
```

---

## 3. 데이터 수신 루프 (startReading)

데이터 수신은 연속적인 읽기 루프로 구현됩니다.
C#의 `DataReceived` 이벤트와 유사하지만, `async/await`를 이용한 무한 루프 방식입니다.

```javascript
async startReading() {
    // 포트가 열려있는 동안 계속 읽기
    while (this.port && this.port.readable) {
        try {
            // ① reader.read() : 데이터가 올 때까지 대기 (비동기)
            //    C#의 SerialPort.Read()와 동일한 역할
            const { value, done } = await this.reader.read();

            if (done) break;  // 포트가 닫히면 종료

            // ② 수신된 바이트를 버퍼에 누적
            //    (한 번에 완전한 프레임이 안 올 수 있음)
            for (const byte of value) {
                this.receiveBuffer.push(byte);
            }

            // ③ 버퍼에서 완성된 Modbus 프레임 파싱 시도
            this.handleReceivedData();

        } catch (error) {
            // 포트 연결 끊김 처리
            this.handleDisconnect();
            break;
        }
    }
}
```

### 수신 버퍼 필요 이유

시리얼 통신은 데이터가 **한 번에 완전한 프레임으로 오지 않을 수 있습니다**.
예를 들어 8바이트 응답이 `3 + 3 + 2` 바이트로 나뉘어 올 수 있습니다.
따라서 `receiveBuffer[]`에 바이트를 계속 누적하고, 완성된 프레임을 감지합니다.

```
수신 버퍼: [ 01 04 02 00 ... ]
              ↑  ↑  ↑
              │  │  └── 데이터 길이
              │  └────── 기능 코드 (FC04)
              └───────── Slave ID
```

---

## 4. 데이터 송신

Modbus 프레임을 RS-485 버스로 전송합니다.

```javascript
// Modbus FC04 요청 프레임 생성 (modbus.js)
const frame = ModbusRTU.buildReadInputFrame(slaveId, address, quantity);
// 결과: Uint8Array([01, 04, D0, 11, 00, 01, CRC_L, CRC_H])

// RS-485 버스로 전송 (app.js 내부)
await this.writer.write(frame);
```

`Uint8Array`는 C#의 `byte[]`에 해당하는 JavaScript 타입입니다.

---

## 5. 응답 대기 (Promise 패턴)

Modbus 요청을 보낸 후 응답을 기다리는 방식입니다.
C#의 `ManualResetEvent` 또는 `TaskCompletionSource`와 유사합니다.

```javascript
async sendAndWaitResponse(frame, slaveId) {
    return new Promise((resolve, reject) => {
        // ① 타임아웃 설정 (기본 200ms)
        const timer = setTimeout(() => {
            reject(new Error('Response timeout'));
        }, this.responseTimeout);

        // ② 응답 수신 시 호출될 콜백 등록
        this.pendingResponse = {
            slaveId,
            resolve: (data) => {
                clearTimeout(timer);     // 타임아웃 취소
                resolve(data);           // 응답 데이터 반환
            },
            reject
        };

        // ③ 프레임 전송
        this.writer.write(frame);
    });
}

// 수신 루프에서 응답 도착 시:
handleReceivedData() {
    // 완성된 프레임 감지되면 pendingResponse.resolve() 호출
    if (this.pendingResponse && frameComplete) {
        this.pendingResponse.resolve(parsedData);
        this.pendingResponse = null;
    }
}
```

---

## 6. 포트 연결 끊김 처리

USB 케이블을 뽑거나 포트 오류 발생 시 자동으로 감지합니다.

```javascript
// 포트 연결 끊김 이벤트 (navigator.serial API)
navigator.serial.addEventListener('disconnect', (event) => {
    if (event.target === this.port) {
        this.handleDisconnect();
    }
});

handleDisconnect() {
    this.stopAutoPolling();     // 폴링 중지
    this.port = null;           // 포트 참조 해제
    this.updateConnectionUI();  // UI에 "연결 끊김" 표시
}
```

---

## 7. 포트 설정값

RS-485 통신을 위한 시리얼 포트 설정값입니다.
앱 Settings 탭에서 변경 가능합니다.

| 설정 | 기본값 | 범위 |
|------|--------|------|
| Baud Rate | 9600 | 1200 / 2400 / 4800 / 9600 / 19200 / 38400 / 57600 / 115200 |
| Data Bits | 8 | 7 / 8 |
| Stop Bits | 1 | 1 / 2 |
| Parity | None | None / Even / Odd |
| Flow Control | None | None / Hardware |

EC-FAN 기본 설정: **9600 baud, 8N1** (8 data bits, No parity, 1 stop bit)

---

## 8. 지원 브라우저

| 브라우저 | Web Serial 지원 | 비고 |
|---------|----------------|------|
| Chrome 89+ | ✓ 지원 | 권장 |
| Edge 89+ | ✓ 지원 | 권장 |
| Opera 75+ | ✓ 지원 | |
| Firefox | ✗ 미지원 | 사용 불가 |
| Safari | ✗ 미지원 | 사용 불가 |

> **주의**: 반드시 Chrome 또는 Edge를 사용해야 합니다.

---

## 9. 디버깅 방법

브라우저 개발자 도구(F12) → Console 탭에서 통신 상태를 확인할 수 있습니다.

```javascript
// 콘솔에서 현재 연결 상태 확인
window.dashboard.port              // 포트 객체 (null이면 연결 안 됨)
window.dashboard.receiveBuffer     // 수신 버퍼 내용
window.dashboard.pendingResponse   // 현재 대기 중인 응답
```

또한 앱의 통신 모니터(Monitor 패널)에서
실시간으로 송수신 프레임을 HEX로 확인할 수 있습니다.

```
[TX] 01 04 D0 11 00 01 F1 CA    ← 요청 (Slave 1, FC04, 주소 0xD011)
[RX] 01 04 02 00 01 78 F1       ← 응답 (값: 0x0001 = Motor Running)
```
