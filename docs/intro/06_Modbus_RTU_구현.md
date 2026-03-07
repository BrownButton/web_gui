# 06. Modbus RTU 구현

## 1. Modbus RTU 기본 개념

Modbus RTU는 산업용 시리얼 통신 프로토콜입니다.
RS-485 버스 위에서 **마스터-슬레이브** 방식으로 동작합니다.

```
마스터 (PC, 이 앱) ──→ 요청 프레임 ──→ 슬레이브 (EC-FAN)
                   ←── 응답 프레임 ←──
```

**한 번에 한 슬레이브만** 통신합니다 (반이중, Half-Duplex).
이 점이 RS-485 버스 관리가 중요한 이유입니다.

---

## 2. Modbus RTU 프레임 구조

### 요청 프레임 (마스터 → 슬레이브)

```
┌──────────┬──────────┬──────────────────┬─────────────────┬──────────┐
│ Slave ID │  FC Code │    Address       │    Quantity     │  CRC-16  │
│  1 byte  │  1 byte  │    2 bytes       │    2 bytes      │  2 bytes │
└──────────┴──────────┴──────────────────┴─────────────────┴──────────┘
```

### 응답 프레임 (슬레이브 → 마스터)

```
┌──────────┬──────────┬──────────┬──────────────────┬──────────┐
│ Slave ID │  FC Code │ Byte Cnt │    Data          │  CRC-16  │
│  1 byte  │  1 byte  │  1 byte  │  N bytes         │  2 bytes │
└──────────┴──────────┴──────────┴──────────────────┴──────────┘
```

### 실제 예시: FC04 Motor Status 읽기

```
요청: 01  04  D0 11  00 01  F1 CA
      │   │   │      │      │
      │   │   │      │      └── CRC-16 (자동 계산)
      │   │   │      └───────── 읽을 레지스터 수 (1개)
      │   │   └──────────────── 레지스터 주소 0xD011
      │   └──────────────────── 기능 코드 04 (입력 레지스터 읽기)
      └──────────────────────── Slave ID 1

응답: 01  04  02  00 01  78 F1
      │   │   │   │       │
      │   │   │   │       └── CRC-16
      │   │   │   └────────── 데이터 값 0x0001 (Motor Running)
      │   │   └────────────── 데이터 바이트 수 (2)
      │   └────────────────── 기능 코드 04
      └────────────────────── Slave ID 1
```

---

## 3. 구현된 기능 코드 (Function Codes)

`modbus.js`에서 다음 기능 코드를 지원합니다:

| FC | 이름 | 용도 | 이 프로젝트에서 사용 |
|----|------|------|-------------------|
| FC01 | Read Coils | 코일(1bit) 읽기 | - |
| FC02 | Read Discrete Inputs | 이산 입력 읽기 | - |
| **FC03** | **Read Holding Registers** | **설정값 읽기** | **Setpoint, Fan Address 등** |
| **FC04** | **Read Input Registers** | **상태값 읽기** | **Motor Status, Actual Speed** |
| FC05 | Write Single Coil | 코일 쓰기 | - |
| **FC06** | **Write Single Register** | **단일 레지스터 쓰기** | **Setpoint 변경** |
| FC15 | Write Multiple Coils | 다중 코일 쓰기 | - |
| FC16 | Write Multiple Registers | 다중 레지스터 쓰기 | - |

---

## 4. modbus.js 역할

`modbus.js`는 Modbus RTU 프로토콜의 순수 라이브러리입니다.
통신 자체는 담당하지 않고, **프레임 생성과 파싱**만 담당합니다.

```javascript
// modbus.js 주요 함수들

// FC03: 홀딩 레지스터 읽기 프레임 생성
ModbusRTU.buildReadHoldingFrame(slaveId, address, quantity)
// 예: buildReadHoldingFrame(1, 0xD001, 1)
// → Uint8Array([01, 03, D0, 01, 00, 01, CRC_L, CRC_H])

// FC04: 입력 레지스터 읽기 프레임 생성
ModbusRTU.buildReadInputFrame(slaveId, address, quantity)
// 예: buildReadInputFrame(1, 0xD011, 1)
// → Uint8Array([01, 04, D0, 11, 00, 01, CRC_L, CRC_H])

// FC06: 단일 레지스터 쓰기 프레임 생성
ModbusRTU.buildWriteSingleFrame(slaveId, address, value)
// 예: buildWriteSingleFrame(1, 0xD001, 32000)
// → Uint8Array([01, 06, D0, 01, 7D, 00, CRC_L, CRC_H])

// CRC-16 계산 (Modbus 표준 다항식 0xA001)
ModbusRTU.calcCRC(data)

// 응답 프레임 파싱 → 레지스터 값 추출
ModbusRTU.parseResponse(frame)
```

---

## 5. 주요 레지스터 테이블

| 주소 | 이름 | 타입 | 접근 | 설명 |
|------|------|------|------|------|
| 0xD000 | Reset/EEPROM | Holding | W | 리셋 또는 EEPROM 저장 명령 |
| 0xD001 | Setpoint | Holding | RW | 속도/퍼센트 설정값 |
| 0xD011 | Motor Status | Input | R | 0=정지, 1=운전 중 (스캔 레지스터) |
| 0xD02D | Actual Speed | Input | R | 현재 속도 (RPM) |
| 0xD100 | Fan Address | Holding | RW | Modbus Slave ID (1~247) |
| 0xD102 | Running Direction | Holding | RW | 0=CCW(반시계), 1=CW(시계) |
| 0xD106 | Operating Mode | Holding | RW | 0=속도 제어, 2=개루프 제어 |
| 0xD119 | Maximum Speed | Holding | RW | 최대 속도 (RPM) |
| 0xD13B | Max Coil Current | Holding | RW | 최대 코일 전류 |

### Holding Register vs Input Register

| 구분 | Function Code | 특성 |
|------|--------------|------|
| Holding Register | FC03 (읽기) / FC06 (쓰기) | 설정값 (읽고 쓸 수 있음) |
| Input Register | FC04 (읽기만 가능) | 측정값, 상태값 (읽기 전용) |

---

## 6. Setpoint 변환

EC-FAN은 Setpoint를 raw 정수값으로 받습니다.
운전 모드에 따라 변환 공식이 다릅니다.

### Speed Control 모드 (mode = 0)

```
raw = RPM ÷ maxSpeed × 64000

예: 800 RPM 설정 (maxSpeed = 1600 RPM)
raw = 800 ÷ 1600 × 64000 = 32000 (0x7D00)

역변환: RPM = raw ÷ 64000 × maxSpeed
예: raw = 32000 → RPM = 32000 ÷ 64000 × 1600 = 800 RPM
```

### Open-loop 모드 (mode = 2)

```
raw = 퍼센트 ÷ 100 × 65535

예: 50% 설정
raw = 50 ÷ 100 × 65535 = 32767 (0x7FFF)

역변환: 퍼센트 = raw ÷ 65535 × 100
```

> **참고**: 현재 maxSpeed(최대 속도)는 0xD119 레지스터에서 읽어야 하지만,
> EC-FAN 펌웨어에 아직 구현되지 않아 임시로 **1600 RPM으로 하드코딩**되어 있습니다.

```javascript
// app.js의 Setpoint 변환 함수
convertRawToSetpoint(device, raw) {
    if (device.operatingMode === 0) {  // Speed Control
        return Math.round(raw / 64000 * maxSpeed);  // → RPM
    } else {                           // Open-loop
        return Math.round(raw / 65535 * 100);       // → %
    }
}
```

---

## 7. CRC-16 검증

Modbus RTU는 **CRC-16**을 사용하여 데이터 무결성을 검증합니다.

```javascript
// CRC-16 계산 (modbus.js)
calcCRC(data) {
    let crc = 0xFFFF;
    for (const byte of data) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;  // Modbus 다항식
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;  // Low byte 먼저, High byte 나중 (리틀 엔디안)
}
```

수신된 응답의 CRC가 일치하지 않으면 데이터 오류로 처리합니다.

---

## 8. 타임아웃 처리

RS-485 통신에서 슬레이브가 응답하지 않을 경우를 처리합니다.

```javascript
// 기본 타임아웃 설정
this.responseTimeout = 200;       // ms, 설정에서 변경 가능
this.maxFailuresBeforeOffline = 3; // 연속 타임아웃 3회 → offline 처리

// 타임아웃 카운트
if (timeout) {
    device.stats.failures++;
    if (device.stats.failures >= maxFailures) {
        device.status = 'offline';
    }
} else {
    device.stats.failures = 0;  // 성공하면 리셋
    device.status = 'online';
}
```

---

## 9. 예외 응답 (Exception Response)

슬레이브가 요청을 처리할 수 없을 때 예외 응답을 반환합니다.

```
예외 응답: 01  84  02  ...
              │   └── 예외 코드 (0x02 = 잘못된 주소)
              └────── 기능 코드 OR 0x80 (FC04 → 0x84)
```

| 예외 코드 | 의미 |
|----------|------|
| 0x01 | 지원하지 않는 기능 코드 |
| 0x02 | 잘못된 레지스터 주소 |
| 0x03 | 잘못된 데이터 값 |
| 0x04 | 슬레이브 장치 오류 |
