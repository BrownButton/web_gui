# FC(0x2B) MEI Transport — CANopen 프로토콜 정의

## 1. 개요

**FC 0x2B (Encapsulated Interface Transport)**는 Modbus 표준 Function Code로,
다른 프로토콜의 PDU를 Modbus RTU 프레임 안에 캡슐화하여 전송한다.

어떤 프로토콜을 캡슐화하는지는 **MEI Type** 바이트로 구분한다.

| MEI Type | 표준 명칭 | 설명 |
|----------|----------|------|
| `0x0D` | CANopen General Reference | CANopen SDO 프레임 캡슐화 ← **이 문서의 주제** |
| `0x0E` | Read Device Identification | Modbus 장치 정보 조회 |

> **참조**: Modbus Application Protocol Specification V1.1b3, Section 6.21

---

## 2. FC 0x2B 공통 프레임 구조

모든 MEI Type 공통. CRC 포함 가변 길이.

### 요청 (Master → Slave)

```
┌──────────┬──────────┬──────────┬─────────────────────────┬──────────┐
│ Slave ID │  0x2B    │ MEI Type │   MEI Data (가변)        │  CRC-16  │
│  1 byte  │  1 byte  │  1 byte  │       N bytes           │  2 bytes │
└──────────┴──────────┴──────────┴─────────────────────────┴──────────┘
```

### 응답 (Slave → Master)

```
┌──────────┬──────────┬──────────┬─────────────────────────┬──────────┐
│ Slave ID │  0x2B    │ MEI Type │   MEI Data (가변)        │  CRC-16  │
│  1 byte  │  1 byte  │  1 byte  │       N bytes           │  2 bytes │
└──────────┴──────────┴──────────┴─────────────────────────┴──────────┘
```

### 예외 응답 (오류 시)

```
┌──────────┬──────────┬─────────────────┬──────────┐
│ Slave ID │  0xAB    │  Exception Code │  CRC-16  │
│  1 byte  │  1 byte  │     1 byte      │  2 bytes │
└──────────┴──────────┴─────────────────┴──────────┘
```

- `0xAB` = `0x2B | 0x80` (Modbus 예외 응답 규칙)
- Exception Code: `0x01` 미지원 FC, `0x02` 잘못된 주소, `0x03` 잘못된 값, `0x04` 장치 오류

---

## 3. MEI Type 0x0D — CANopen General Reference

### 3.1 개념

Modbus RTU 위에서 **CANopen SDO(Service Data Object)** 통신을 수행한다.

```
Master (이 앱)                          Slave (EC-FAN)
     │                                       │
     │  [Modbus Frame]                       │
     │  SlaveID │ 0x2B │ 0x0D │ [SDO PDU] │ CRC
     │ ─────────────────────────────────── → │
     │                                       │  CANopen SDO 처리
     │  [Modbus Frame]                       │
     │  SlaveID │ 0x2B │ 0x0D │ [SDO PDU] │ CRC
     │ ← ─────────────────────────────────  │
```

CANopen SDO는 장치의 **Object Dictionary(OD)** 에 접근하는 프로토콜이다.
- OD 항목은 **Index(2 bytes) + Sub-Index(1 byte)** 로 식별
- SDO는 **Expedited Transfer** (≤4 bytes) 와 **Segmented Transfer** (>4 bytes) 로 구분

### 3.2 MEI Data 구조 (CANopen SDO PDU)

MEI Type `0x0D` 의 Data 필드는 **CANopen SDO PDU** 그대로다.

#### CANopen SDO PDU 구조

```
┌──────────┬──────────────────┬───────────────────┬────────────┬──────────────────┐
│ Reserved │  Command Byte    │    Index          │ Sub-Index  │      Data        │
│  1 byte  │  (cs) 1 byte     │   2 bytes (LE)   │   1 byte   │   4 bytes        │
└──────────┴──────────────────┴───────────────────┴────────────┴──────────────────┘
```

- **Reserved**: 항상 `0x00`
- **Index**: Little-Endian (CANopen 표준) — 예: Index 0x6040 → `40 60`
- **Data**: Little-Endian, 4 bytes 고정 (Expedited). 사용 안 하는 바이트는 `00`
- **Command Byte(cs)**: 아래 SDO Command Specifier 참조

#### SDO Command Specifier (Command Byte) 표

**읽기 (Upload)**

| cs 값 | 방향 | 의미 | 데이터 크기 |
|-------|------|------|------------|
| `0x40` | 요청 | Initiate Upload Request | — |
| `0x43` | 응답 | Upload Response | 4 bytes |
| `0x47` | 응답 | Upload Response | 3 bytes |
| `0x4B` | 응답 | Upload Response | 2 bytes |
| `0x4F` | 응답 | Upload Response | 1 byte |

**쓰기 (Download)**

| cs 값 | 방향 | 의미 | 데이터 크기 |
|-------|------|------|------------|
| `0x23` | 요청 | Initiate Download Request | 4 bytes |
| `0x27` | 요청 | Initiate Download Request | 3 bytes |
| `0x2B` | 요청 | Initiate Download Request | 2 bytes |
| `0x2F` | 요청 | Initiate Download Request | 1 byte |
| `0x60` | 응답 | Download Response (확인) | — |

**오류**

| cs 값 | 방향 | 의미 |
|-------|------|------|
| `0x80` | 응답 | Abort Transfer (오류) |

> **Abort 응답 시 Data 필드**는 4-byte Abort Code (Little-Endian).
> 예: `0x06090011` = "Sub-index does not exist"

---

### 3.3 Expedited SDO 프레임 전체 예시

#### Object Dictionary 항목 읽기 (Upload)

**요청**: Index=0x6040, Sub-Index=0x00 읽기

```
Modbus 프레임:
01   2B   0D   00   40   40 60   00   00 00 00 00   [CRC_L CRC_H]
│    │    │    │    │    └──┬──┘  │    └────┬────┘
│    │    │    │    │       │     │         └── Data (읽기 요청이므로 00 패딩)
│    │    │    │    │       │     └──────────── Sub-Index: 0x00
│    │    │    │    │       └────────────────── Index: 0x6040 (LE: 40 60)
│    │    │    │    └────────────────────────── cs: 0x40 (Upload Request)
│    │    │    └─────────────────────────────── Reserved: 0x00
│    │    └──────────────────────────────────── MEI Type: 0x0D
│    └───────────────────────────────────────── FC: 0x2B
└────────────────────────────────────────────── Slave ID: 0x01

전체 14 bytes (CRC 포함)
```

**응답**: 값 0x000F (2 bytes) 반환

```
Modbus 프레임:
01   2B   0D   00   4B   40 60   00   0F 00 00 00   [CRC_L CRC_H]
                    │    │    └──┬──┘  │    └────┬────┘
                    │    │       │     │         └── Data: 0x000F (LE, 2 bytes 유효)
                    │    │       │     └──────────── Sub-Index: 0x00
                    │    │       └────────────────── Index: 0x6040 (에코)
                    │    └────────────────────────── cs: 0x4B (Upload Response, 2 bytes)
                    └─────────────────────────────── Reserved: 0x00
```

---

#### Object Dictionary 항목 쓰기 (Download)

**요청**: Index=0x6040, Sub-Index=0x00 에 0x000F (2 bytes) 쓰기

```
Modbus 프레임:
01   2B   0D   00   2B   40 60   00   0F 00 00 00   [CRC_L CRC_H]
                    │    │    └──┬──┘  │    └────┬────┘
                    │    │       │     │         └── Data: 0x000F (LE)
                    │    │       │     └──────────── Sub-Index: 0x00
                    │    │       └────────────────── Index: 0x6040 (LE)
                    │    └────────────────────────── cs: 0x2B (Download Request, 2 bytes)
                    └─────────────────────────────── Reserved: 0x00
```

**응답**: 쓰기 완료 확인

```
Modbus 프레임:
01   2B   0D   00   60   40 60   00   00 00 00 00   [CRC_L CRC_H]
                    │    │
                    │    └── cs: 0x60 (Download Response)
                    └─────── Reserved: 0x00
```

---

#### Abort 응답 예시

```
Modbus 프레임:
01   2B   0D   00   80   40 60   00   11 00 09 06   [CRC_L CRC_H]
                    │    │                └────┬────┘
                    │    │                    └── Abort Code: 0x06090011 (LE)
                    │    │                        "Sub-index does not exist"
                    │    └── cs: 0x80 (Abort)
                    └─────── Reserved: 0x00
```

---

### 3.4 SDO Abort Code 표 (주요 항목)

| Abort Code | 의미 |
|------------|------|
| `0x05030000` | Toggle bit not alternated |
| `0x05040000` | SDO protocol timed out |
| `0x06010000` | Unsupported access to an object |
| `0x06010001` | Read command to a write-only object |
| `0x06010002` | Write command to a read-only object |
| `0x06020000` | Object does not exist in OD |
| `0x06090011` | Sub-index does not exist |
| `0x06090030` | Value range exceeded |
| `0x08000000` | General error |
| `0x08000020` | Data cannot be transferred |

---

## 4. MEI Type 0x0E — Read Device Identification (참고)

표준 Modbus 장치 정보 조회. EC-FAN 지원 여부 미확인, 참고용 기술.

### 요청

```
┌──────────┬──────┬──────┬──────────────┬────────────┬──────────┐
│ Slave ID │ 0x2B │ 0x0E │ ReadDevId Code│ Object Id  │  CRC-16  │
│  1 byte  │      │      │    1 byte    │   1 byte   │  2 bytes │
└──────────┴──────┴──────┴──────────────┴────────────┴──────────┘
```

| ReadDevId Code | 접근 유형 |
|----------------|----------|
| `0x01` | Basic (필수 항목) |
| `0x02` | Regular (선택 항목) |
| `0x03` | Extended (확장 항목) |
| `0x04` | 특정 Object Id 단일 조회 |

Object Id `0x00` = VendorName, `0x01` = ProductCode, `0x02` = MajorMinorRevision

---

## 5. 프레임 길이 계산

FC 0x2B 응답은 MEI Type에 따라 길이가 다르다.

### MEI Type 0x0D (CANopen SDO)

**요청 및 정상 응답**: Reserved(1) + SDO PDU(8) = 9 bytes

```
전체 길이 = 1 (SlaveID) + 1 (FC) + 1 (MEI) + 1 (Reserved) + 8 (SDO PDU) + 2 (CRC) = 14 bytes
```

**Abort 응답**: SDO PDU = 8 bytes (동일, cs=0x80 + Abort Code 4 bytes)

```
전체 길이 = 14 bytes (동일)
```

**Modbus 예외 응답** (MEI 레벨 오류):
```
전체 길이 = 1 (SlaveID) + 1 (0xAB) + 1 (Exception Code) + 2 (CRC) = 5 bytes
```

### `getExpectedFrameLength()` 수정 방향

```javascript
case 0x2B: {
    if (frame.length < 3) return null; // MEI Type 아직 미수신
    const meiType = frame[2];
    if (meiType === 0x0D) return 14;  // CANopen SDO (Reserved 1 + SDO PDU 8 bytes)
    if (meiType === 0x0E) return null; // Read Device ID — 가변, 별도 처리
    return null;
}

// 예외 응답 (0xAB) 도 처리 필요:
case 0xAB: return 5; // SlaveID + 0xAB + ExCode + CRC
```

---

## 6. modbus.js 구현 대상 함수

### 6.1 SDO Upload (읽기) 프레임 생성

```javascript
/**
 * FC 0x2B / MEI 0x0D — CANopen SDO Upload Request 프레임 생성
 * @param {number} slaveId  Modbus Slave ID (1~247)
 * @param {number} index    CANopen Object Index (예: 0x6040)
 * @param {number} subIndex CANopen Sub-Index (예: 0x00)
 * @returns {Uint8Array}    CRC 포함 전체 프레임
 */
buildCANopenUploadFrame(slaveId, index, subIndex) {
    const buf = new Uint8Array(11); // CRC 제외 11 bytes
    buf[0] = slaveId;
    buf[1] = 0x2B;          // FC
    buf[2] = 0x0D;          // MEI Type: CANopen
    buf[3] = 0x40;          // cs: Upload Request
    buf[4] = index & 0xFF;  // Index Low byte (LE)
    buf[5] = (index >> 8) & 0xFF; // Index High byte
    buf[6] = subIndex;
    buf[7] = 0x00; buf[8] = 0x00; buf[9] = 0x00; buf[10] = 0x00; // Data 패딩
    return this.appendCRC(buf);
}
```

### 6.2 SDO Download (쓰기) 프레임 생성

```javascript
/**
 * FC 0x2B / MEI 0x0D — CANopen SDO Download Request 프레임 생성
 * @param {number} slaveId  Modbus Slave ID
 * @param {number} index    CANopen Object Index
 * @param {number} subIndex CANopen Sub-Index
 * @param {number} value    쓸 값
 * @param {number} size     데이터 크기 (1,2,3,4 bytes)
 * @returns {Uint8Array}
 */
buildCANopenDownloadFrame(slaveId, index, subIndex, value, size = 4) {
    // cs: 0x2F=1byte, 0x2B=2bytes, 0x27=3bytes, 0x23=4bytes
    const cs = 0x2F - ((size - 1) << 2); // 크기별 cs 계산
    const buf = new Uint8Array(11);
    buf[0] = slaveId;
    buf[1] = 0x2B;
    buf[2] = 0x0D;
    buf[3] = cs;
    buf[4] = index & 0xFF;
    buf[5] = (index >> 8) & 0xFF;
    buf[6] = subIndex;
    // Data: Little-Endian, 4 bytes
    buf[7]  = value & 0xFF;
    buf[8]  = (value >> 8)  & 0xFF;
    buf[9]  = (value >> 16) & 0xFF;
    buf[10] = (value >> 24) & 0xFF;
    return this.appendCRC(buf);
}
```

### 6.3 SDO 응답 파싱

```javascript
/**
 * FC 0x2B / MEI 0x0D 응답 파싱
 * @param {Uint8Array} frame  CRC 포함 전체 프레임
{% raw %}
 * @returns {{ cs, index, subIndex, value, abortCode } | null}}
{% endraw %}
 */
parseCANopenResponse(frame) {
    if (frame[1] === 0xAB) {
        // Modbus 예외 응답
        return { error: 'modbus_exception', exceptionCode: frame[2] };
    }
    const cs       = frame[3];
    const index    = frame[4] | (frame[5] << 8); // LE → number
    const subIndex = frame[6];
    const rawData  = frame[7] | (frame[8] << 8) | (frame[9] << 16) | (frame[10] << 24);

    if (cs === 0x80) {
        // SDO Abort
        return { error: 'sdo_abort', abortCode: rawData >>> 0, index, subIndex };
    }
    if (cs === 0x60) {
        // Download 완료
        return { cs, index, subIndex, value: null };
    }
    // Upload 응답: cs에서 유효 바이트 수 추출
    const sizeMap = { 0x43: 4, 0x47: 3, 0x4B: 2, 0x4F: 1 };
    const byteCount = sizeMap[cs] ?? 4;
    const mask = byteCount === 4 ? 0xFFFFFFFF : (1 << (byteCount * 8)) - 1;
    return { cs, index, subIndex, value: rawData & mask };
}
```

---

## 7. 485 버스 통합 (app.js 연동)

CANopen SDO 명령도 **반드시 Command Queue** 경유.

```javascript
// app.js 래퍼 함수 (예시)
async readCANopenObject(slaveId, index, subIndex) {
    const frame = ModbusRTU.buildCANopenUploadFrame(slaveId, index, subIndex);
    // writeRegister처럼 큐/직접 전송 분기
    return new Promise((resolve, reject) => {
        const item = {
            type: 'canopen_read',
            frame,
            slaveId,
            resolve,
            reject
        };
        if (this.autoPollingTimer && !this.isPolling) {
            this.commandQueue.push(item);
        } else {
            this._sendCANopenAndWait(item);
        }
    });
}
```

> **CLAUDE.md 규칙 준수**: `writer.write()` 직접 호출 절대 금지.
> `writeRegister()` 패턴을 그대로 따라 CANopen 전용 래퍼 구현.

---

## 8. 관련 표준 문서

| 문서 | 내용 |
|------|------|
| Modbus Application Protocol Specification V1.1b3 | FC 0x2B 정의, Section 6.21 |
| CiA 301 (CANopen Application Layer) | SDO 프로토콜 정의 |
| CiA 315-2 (CANopen over Modbus) | MEI Type 0x0D 매핑 규칙 |

---

## 9. 관련 프로젝트 문서

| 문서 | 경로 |
|------|------|
| Modbus RTU 구현 개요 | `docs/intro/06_Modbus_RTU_구현.md` |
| 485 버스 안전 구조 | `docs/intro/07_485버스_안전구조.md` |
| 개발 규칙 (버스 충돌 방지) | `CLAUDE.md` |

---

*작성: 2026-03-17 / 기준: Modbus 표준 + CANopen CiA 301/315-2*
