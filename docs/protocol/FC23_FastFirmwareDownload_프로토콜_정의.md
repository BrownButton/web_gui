# FC 0x23 : Fast Firmware Download 프로토콜

---

## 개요

| 항목 | 내용 |
|------|------|
| Function Code | `0x23` (35) |
| 용도 | 고속 펌웨어 다운로드 (기존 FC 0x66 대체) |
| 방향 | Master → Slave (TX) / Slave → Master (RX) |
| CRC | **모든 TX/RX에 CRC-16 포함** (기존 프로토콜 대비 개선) |
| 최대 데이터 크기 | DataLen 필드 1바이트 → 최대 255 bytes/패킷 (장치 버퍼 의존) |

### 기존 프로토콜(FC 0x66) 대비 주요 개선점

| 항목 | FC 0x66 (기존) | FC 0x23 (신규) |
|------|--------------|--------------|
| RX CRC | 없음 | **있음** |
| 에코백 | 60바이트 전부 에코 | **없음** (ACK만 반환) |
| 재전송 | 없음 (실패 시 전체 중단) | **패킷 단위 최대 3회 재시도** |
| Erase 대기 | 고정 10초 하드코딩 | **0x91 폴링으로 실제 완료 감지** |
| 시퀀스 번호 | 없음 | **있음** (중복/누락 감지) |
| 패킷 크기 | 고정 60바이트 | **가변** (최대 255바이트) |
| 완료 검증 | 없음 | **전체 이미지 CRC-32 검증** |
| 중단 명령 | 없음 | **0xFF Abort 지원** |
| 이어받기 | 없음 | **LastOffset 기반 Resume 지원** |
| 독립 검증 | 없음 | **0x9A Standalone Verify 지원** |

---

## OpCode 목록

### 요청(TX) OpCode

| OpCode | 이름 | 설명 |
|--------|------|------|
| `0x90` | Init | Flash Unlock & Erase 요청 |
| `0x91` | Erase Poll | Flash Erase 완료 상태 확인 |
| `0x03` | Data Transfer | 펌웨어 데이터 블록 전송 |
| `0x99` | Complete | 전송 완료 및 이미지 검증 요청 |
| `0x9A` | Verify | Flash에 기록된 펌웨어 독립 검증 요청 |
| `0xFF` | Abort | 다운로드 중단 및 장치 상태 초기화 |

### 응답(RX) OpCode

모든 응답은 요청과 동일한 OpCode를 에코함.
`0x03` Data Transfer 응답만 OpCode 다음 바이트(ACK/NACK)로 성공/실패를 구분함.

| 값 | 이름 | 사용 위치 |
|----|------|----------|
| `0x04` | ACK  | `0x03` Data 응답 내 ACK/NACK 바이트 (성공) |
| `0x05` | NACK | `0x03` Data 응답 내 ACK/NACK 바이트 (실패) |

### NACK ErrorCode (`0x03` Data 응답 내 ErrorCode 필드)

| 값 | 이름 | 설명 |
|----|------|------|
| `0x01` | CRC_ERROR | 수신 패킷 CRC 불일치 |
| `0x02` | OFFSET_MISMATCH | FlashOffset이 장치 예상값과 다름 |
| `0x03` | SEQ_MISMATCH | SeqNum이 예상 값과 다름 |
| `0x04` | FLASH_WRITE_FAIL | Flash 쓰기 하드웨어 오류 |
| `0x05` | BUFFER_OVERFLOW | DataLen이 장치 버퍼 초과 |
| `0x06` | NOT_INITIALIZED | 0x90 Init 없이 데이터 전송 시도 |
| `0x07` | ERASE_NOT_DONE | Erase 미완료 상태에서 데이터 전송 시도 |

---

## TX/RX 패킷 구조

### 공통 헤더 (모든 패킷)

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | Modbus 슬레이브 주소 |
| 1 | Function Code | 1 B | 고정 `0x23` |
| 2 | OpCode | 1 B | 동작 코드 |

---

### 펌웨어 대상 칩 (TargetType / TargetIndex)

`0x90 Init` TX에 포함되며, 이후 세션 전체(0x91/0x03/0x99/0x9A/0xFF)에 적용됨.

| TargetType | 이름 | 설명 |
|-----------|------|------|
| `0x01` | MAIN_MCU | 메인 MCU (자기 자신) |
| `0x02` | INVERTER_MCU | 인버터 MCU (Main MCU 경유 전달) |
| `0x03` | CORE0 | Dual Core MCU — Core 0 |
| `0x04` | CORE1 | Dual Core MCU — Core 1 |
| `0x05` | FPGA | FPGA |

**TargetIndex**: 동일 타입이 여러 개일 때 인스턴스 번호. `0x00` = 첫 번째/유일.

> **모델별 구성 예시:**
> - 단일 MCU 모델 : `MAIN_MCU(0x01, idx=0)`
> - 인버터 포함 모델 : `MAIN_MCU` + `INVERTER_MCU(0x02, idx=0)`
> - Dual Core 모델 : `CORE0(0x03, idx=0)` + `CORE1(0x04, idx=0)`
> - FPGA 모델 : `MAIN_MCU` + `FPGA(0x05, idx=0)`

---

### `0x90` — Init (Flash Unlock & Erase 요청)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x90` |
| 3 | TargetType | 1 B | 대상 칩 종류 (위 표 참고) |
| 4 | TargetIndex | 1 B | 대상 인스턴스 번호 (`0x00`=첫 번째/유일) |
| 5–8 | FileSize | 4 B | 펌웨어 전체 크기 (bytes, Big-Endian) |
| 9–10 | CRC | 2 B | CRC-16 |

**총 길이: 11 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x90` |
| 3 | ProtocolVersion | 1 B | 슬레이브가 구현한 0x23 프로토콜 버전 (`0x01` = 본 문서 기준) |
| 4 | Status | 1 B | 아래 Status 코드 표 참고 |
| 5–8 | LastOffset | 4 B | 장치가 마지막으로 성공한 Flash 쓰기 offset. Status=`0x00`이면 `0x00000000` |
| 9–10 | CRC | 2 B | CRC-16 |

**총 길이: 11 bytes**

**Status 코드**

| 값 | 이름 | Master 동작 |
|----|------|------------|
| `0x00` | OK | Erase 완료를 0x91로 폴링 후 offset 0부터 전송 시작 |
| `0x01` | RESUME | Erase 폴링 생략, `LastOffset`부터 바로 데이터 전송 재개 |
| `0x02` | ERROR | 0xFF Abort 후 재시도 |
| `0x03` | TARGET_MISMATCH | 진행중인 타겟과 다른 타겟 요청 — 0xFF Abort 후 재시도 |
| `0x04` | TARGET_UNSUPPORTED | 해당 모델에서 지원하지 않는 타겟 |
| `0x05` | VERSION_UNSUPPORTED | 마스터가 요청한 동작이 슬레이브 펌웨어 버전에서 지원되지 않음 |

> **참고:** Status=`0x00` 시 Erase는 응답 직후 백그라운드에서 시작됨. 완료 여부는 0x91로 폴링.

> **버전 협상 (ProtocolVersion):**
> - 마스터는 Init 응답의 `ProtocolVersion`을 보고 자신이 지원하는 범위인지 확인.
> - 지원 범위 밖이면 즉시 `0xFF` Abort 후 사용자에게 호환성 오류 보고.
> - 본 문서 기준 버전 = `0x01`. 향후 패킷 구조 변경(필드 추가/제거, OpCode 추가)이 발생하면 `0x02` 이상으로 증가.
> - 마이너 호환 변경(예: 새 ErrorCode 값 추가)은 버전 증가 없이 예약된 enum 슬롯으로 흡수.
> - 버전은 Init RX에만 포함됨 (이후 세션 전체에 동일 적용). 다른 OpCode 응답에서는 생략.

---

### `0x91` — Erase Poll (Erase 완료 확인)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x91` |
| 3–4 | CRC | 2 B | CRC-16 |

**총 길이: 5 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x91` |
| 3 | EraseStatus | 1 B | `0x00`=진행중, `0x01`=완료, `0x02`=오류 |
| 4–5 | CRC | 2 B | CRC-16 |

**총 길이: 6 bytes**

> **폴링 권장 주기:** 500 ms 간격으로 반복 요청.
> EraseStatus=`0x01` 수신 후 Data Transfer 단계로 진행.

---

### `0x03` — Data Transfer (펌웨어 데이터 전송)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x03` |
| 3–4 | SeqNum | 2 B | 패킷 순번 (0x0000부터 시작, 재전송 시 동일 값 유지) |
| 5–8 | FlashOffset | 4 B | 이 블록이 기록될 Flash 상대 주소 (Big-Endian) |
| 9 | DataLen | 1 B | 이 패킷의 펌웨어 데이터 크기 (bytes) |
| 10 … 10+DataLen−1 | Data | N B | 펌웨어 바이너리 데이터 |
| last–1 | CRC | 2 B | CRC-16 |

**총 길이: 12 + DataLen bytes**

**RX — ACK**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x03` |
| 3 | ACK/NACK | 1 B | `0x04` = ACK |
| 4–5 | SeqNum | 2 B | ACK한 패킷의 SeqNum (에코) |
| 6–9 | TotalReceived | 4 B | 현재까지 누적 수신 bytes |
| 10–11 | CRC | 2 B | CRC-16 |

**총 길이: 12 bytes**

**RX — NACK**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x03` |
| 3 | ACK/NACK | 1 B | `0x05` = NACK |
| 4–5 | SeqNum | 2 B | 실패한 패킷의 SeqNum |
| 6 | ErrorCode | 1 B | 오류 코드 (위 NACK ErrorCode 표 참고) |
| 7–10 | ExpectedOffset | 4 B | 장치가 기대하는 다음 FlashOffset |
| 11–12 | CRC | 2 B | CRC-16 |

**총 길이: 13 bytes**

> **패킷 크기:**
> - 장치 UART 수신 버퍼 최대 256 bytes → 헤더(10 B) + CRC(2 B) 제외 시 **최대 DataLen = 244 bytes**
> - 권장 시작값: 120 bytes (안정성 우선)
> - ErrorCode=`BUFFER_OVERFLOW`(0x05) NACK 수신 시 DataLen을 절반으로 줄여 재시도

---

### `0x99` — Complete (전송 완료 및 이미지 검증)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x99` |
| 3–6 | FirmwareCRC32 | 4 B | 전체 펌웨어 이미지 CRC-32 (Big-Endian) |
| 7–10 | TotalSize | 4 B | 전체 펌웨어 크기 bytes (Big-Endian) |
| 11–12 | CRC | 2 B | CRC-16 |

**총 길이: 13 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x99` |
| 3 | VerifyResult | 1 B | `0x00`=OK, `0x01`=CRC불일치, `0x02`=크기불일치, `0x03`=Flash읽기오류 |
| 4–7 | DeviceCRC32 | 4 B | 장치가 Flash에서 계산한 CRC-32 (비교용) |
| 8–9 | CRC | 2 B | CRC-16 |

**총 길이: 10 bytes**

> - VerifyResult=`0x00`: 장치가 다음 부팅 시 Flash Copy 실행
> - VerifyResult≠`0x00`: 펌웨어 이미지 손상 → 0xFF Abort 후 처음부터 재시도

---

### `0x9A` — Verify (Flash 펌웨어 독립 검증)

전송 완료 여부와 무관하게, 현재 Flash에 기록된 펌웨어 이미지를 검증함.
다운로드 후 일정 시간이 지난 뒤 무결성 확인이 필요할 때 사용.

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x9A` |
| 3–6 | ExpectedCRC32 | 4 B | 호스트가 기대하는 CRC-32 (Big-Endian) |
| 7–10 | ExpectedSize | 4 B | 호스트가 기대하는 펌웨어 크기 bytes (Big-Endian) |
| 11–12 | CRC | 2 B | CRC-16 |

**총 길이: 13 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0x9A` |
| 3 | VerifyResult | 1 B | `0x00`=OK, `0x01`=CRC불일치, `0x02`=크기불일치, `0x03`=Flash읽기오류 |
| 4–7 | DeviceCRC32 | 4 B | 장치가 Flash에서 계산한 CRC-32 (비교용) |
| 8–9 | CRC | 2 B | CRC-16 |

**총 길이: 10 bytes**

> 다운로드 세션과 무관하게 언제든지 요청 가능.
> 장치 상태를 변경하지 않음 (읽기 전용).

---

### `0xFF` — Abort (다운로드 중단)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0xFF` |
| 3–4 | CRC | 2 B | CRC-16 |

**총 길이: 5 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0x23` |
| 2 | OpCode | 1 B | `0xFF` |
| 3 | Status | 1 B | `0x00`=초기화 완료 |
| 4–5 | CRC | 2 B | CRC-16 |

**총 길이: 6 bytes**

> 장치는 Abort 수신 시 Flash 쓰기를 중단하고 다운로드 상태(LastOffset 포함)를 초기화함.

---

## 전체 동작 시퀀스

### 신규 다운로드 (Status=0x00)

```
Master                                   Slave
  │                                        │
  │──── 0x90 Init [FileSize] ─────────────▶│  Flash Unlock & Erase 시작
  │◀─── 0x90 [Status=0x00, LastOffset=0] ──│  Erase 백그라운드 진행 중
  │                                        │
  │──── 0x91 Erase Poll ──────────────────▶│
  │◀─── 0x91 [EraseStatus=0x00] ───────────│  진행 중, 500ms 후 재시도
  │──── 0x91 Erase Poll ──────────────────▶│
  │◀─── 0x91 [EraseStatus=0x01] ───────────│  완료
  │                                        │
  │──── 0x03 [SeqNum=0, Offset=0, N bytes]▶│
  │◀─── ACK [SeqNum=0, Total=N] ───────────│
  │──── 0x03 [SeqNum=1, Offset=N, N bytes]▶│
  │◀─── NACK [ErrorCode=CRC_ERROR] ────────│  CRC 오류 발생
  │──── 0x03 [SeqNum=1, Offset=N, N bytes]▶│  동일 패킷 재전송 (1st retry)
  │◀─── ACK [SeqNum=1, Total=2N] ──────────│  성공
  │         … N 패킷 반복 …                 │
  │──── 0x03 [SeqNum=M, 마지막 블록] ──────▶│
  │◀─── ACK [Total=FileSize] ───────────────│
  │                                        │
  │──── 0x99 Complete [CRC32, Size] ───────▶│  전체 이미지 검증 요청
  │◀─── 0x99 [VerifyResult=0x00, CRC32] ───│  검증 성공, 부팅 시 Flash Copy 예약
  │                                        │
  │          다운로드 완료                   │
```

### Resume (중단 후 이어받기, Status=0x01)

```
Master                                   Slave
  │  (연결 끊김 후 재연결)                  │
  │                                        │
  │──── 0x90 Init [FileSize] ─────────────▶│
  │◀─── 0x90 [Status=0x01, LastOffset=K] ──│  K bytes까지 이미 기록됨
  │                                        │
  │  (Erase 폴링 생략, 데이터 전송 바로 진입)│
  │                                        │
  │──── 0x03 [SeqNum=K/N, Offset=K, N bytes]▶│  K offset부터 재개
  │◀─── ACK [SeqNum=K/N, Total=K+N] ────────│
  │         … 나머지 패킷 반복 …             │
  │──── 0x99 Complete [CRC32, Size] ───────▶│
  │◀─── 0x99 [VerifyResult=0x00, CRC32] ───│
  │                                        │
  │          Resume 완료                    │
```

### 독립 검증 (다운로드 없이 Flash 검증)

```
Master                                   Slave
  │                                        │
  │──── 0x9A Verify [ExpectedCRC32, Size] ─▶│  Flash CRC-32 계산
  │◀─── 0x9A [VerifyResult=0x00, CRC32] ───│  검증 성공
  │                                        │
```

### 오류 발생 시 (중단)

```
Master                                   Slave
  │                                        │
  │  (연속 3회 NACK 또는 타임아웃)           │
  │──── 0xFF Abort ────────────────────────▶│  상태 초기화 (LastOffset 리셋)
  │◀─── 0xFF ACK ──────────────────────────│
  │          다운로드 실패 처리               │
```

---

## 재전송 정책

| 상황 | 동작 |
|------|------|
| NACK(ACK/NACK=`0x05`) 수신 | 동일 SeqNum 패킷 즉시 재전송 |
| 응답 타임아웃 (500 ms) | 동일 패킷 재전송 |
| 최대 재시도 횟수 | **3회** (초과 시 0xFF Abort 후 다운로드 중단) |
| NACK의 ExpectedOffset이 현재 Offset과 다를 때 | ExpectedOffset 기준으로 해당 패킷부터 재개 |
| ErrorCode=`BUFFER_OVERFLOW`(0x05) NACK | DataLen을 절반으로 줄여 재분할 전송 |

---

## 패킷 크기 가이드라인

| 단계 | 권장 DataLen | 비고 |
|------|-------------|------|
| 초기 테스트 | 60 bytes | FC 0x66과 동일 (안전) |
| 표준 운용 | 120 bytes | 2배 향상, 대부분 장치에서 안전 |
| 고성능 | 240 bytes | 장치 버퍼 확인 필요 |
| 최대 이론치 | 244 bytes | 버퍼 256B - 헤더(10B) - CRC(2B) |

> ErrorCode=`BUFFER_OVERFLOW` NACK 발생 시 현재 DataLen의 절반으로 줄이고,
> 이후 패킷부터 줄어든 크기 유지.

---

## 성능 예측 (FileSize = 112 KB 기준)

> 19200 bps, 10 bits/byte (1 start + 8 data + 1 stop) 기준 계산값

| 조건 | TX 시간 | RX 시간 | 패킷당 합계 | 총 패킷 수 | 예상 시간 |
|------|--------|--------|-----------|-----------|---------|
| FC 0x66 기존 (19200, 60B, 에코 65B) | 33 ms | 34 ms | ~67 ms | ~1,900 | **~127 초** |
| FC 0x23 (19200, 60B, ACK 12B) | 38 ms | 7 ms | ~45 ms | ~1,900 | **~85 초** |
| FC 0x23 (19200, 120B, ACK 12B) | 68 ms | 7 ms | ~75 ms | ~950 | **~71 초** |
| FC 0x23 (19200, 240B, ACK 12B) | 128 ms | 7 ms | ~135 ms | ~475 | **~64 초** |

> - TX 시간: `(12 + DataLen) bytes × 10 bits ÷ 19200`
> - RX ACK 시간: `12 bytes × 10 bits ÷ 19200 ≈ 6.25 ms`
> - 실제 시간은 장치 Flash 쓰기 지연, 인터패킷 간격 등으로 달라질 수 있음.
> - Baud Rate는 장치 파라미터로 별도 설정하며 본 프로토콜에서 다루지 않음.

---

## 확인된 사항

| 항목 | 내용 |
|------|------|
| 패킷 CRC | Modbus CRC-16 (표준 — 다항식 `0xA001`, 초기값 `0xFFFF`) |
| 장치 UART 수신 버퍼 | 최대 256 bytes → 최대 DataLen = **244 bytes** |
| 지원 Baud Rate | 115200 bps 확인, 그 이상도 구현 가능 |

---

## 마스터 구현 권장사항

본 프로토콜을 호스트(마스터)에서 구현할 때 안전성·신뢰성 확보를 위해 권장되는 동작 규칙.

### 1. 폴링 중단 강제

- 다운로드 시작 시점에 자동 폴링(`autoPollingTimer`)이 동작 중이면 반드시 **사전 중단**.
- 0x23 세션 동안에는 동일 RS-485 버스에서 다른 슬레이브 폴링도 금지 (전송 직렬성 보장).
- 다운로드 종료(성공/실패/Abort) 후 폴링 재개.

### 2. 응답 가변 길이 처리

- 0x03 Data 응답은 ACK(12 B) / NACK(13 B)로 길이가 다름.
- 수신 파서는 OpCode 수신 후 4번째 바이트(ACK/NACK 구분자)를 보고 잔여 길이 결정해야 함.
- OpCode별 고정 길이:

| OpCode | TX 길이 | RX 길이 |
|--------|--------|--------|
| `0x90` Init | 11 B | 11 B |
| `0x91` Erase Poll | 5 B | 6 B |
| `0x03` Data | 12 + DataLen B | ACK=12 B / NACK=13 B |
| `0x99` Complete | 13 B | 10 B |
| `0x9A` Verify | 13 B | 10 B |
| `0xFF` Abort | 5 B | 6 B |

### 3. Abort 직렬화

- `0xFF` Abort 송신 후 **반드시 응답을 기다리고**, 그 이전에는 다른 명령(특히 0x90 Init 재시도)을 보내지 않음.
- Abort 응답 timeout 시에도 추가 1회 재전송까지만 허용. 이후에는 사용자에게 통신 오류로 보고.
- 사용자 취소 시: 진행 중인 패킷 응답 수신 완료 대기 → Abort 송신 (송신 충돌 방지).

### 4. CRC-16 (패킷) / CRC-32 (이미지) 분리

- **CRC-16**: 모든 0x23 프레임에 부착되는 패킷 체크섬. Modbus 표준 CRC-16-IBM 사용.
- **CRC-32**: 0x99 Complete / 0x9A Verify에 포함되는 펌웨어 이미지 검증값.
- 두 CRC를 혼동하지 않도록 마스터 구현 시 함수 분리 권장.

### 5. 표준 RX 파서와의 통합

- 0x23 프레임은 길이가 OpCode 및 ACK/NACK 구분자로 결정 가능하므로, 기존 `tryParseFrame()` 길이 기반 파서에 흡수시키는 것이 안전.
- FC 0x66처럼 별도 `responseBuffer`로 우회하면 CRC 검증·노이즈 폐기·멀티프레임 분리 등 표준 RX 보호 로직이 비활성됨.
- `getExpectedFrameLength()`에 0x23 케이스를 추가하여 OpCode·ACK/NACK 기반으로 길이 반환 (바이트 부족 시 `null`로 다음 청크 대기).

### 6. NACK 처리 정책

- ErrorCode별 권장 동작:

| ErrorCode | 권장 동작 |
|-----------|----------|
| `0x01` CRC_ERROR | 동일 SeqNum 재전송 (최대 3회) |
| `0x02` OFFSET_MISMATCH | NACK의 `ExpectedOffset`으로 동기 후 해당 패킷부터 재개 |
| `0x03` SEQ_MISMATCH | NACK의 `ExpectedOffset` 기준으로 SeqNum 재계산 후 재전송 |
| `0x04` FLASH_WRITE_FAIL | 1회 재시도, 실패 시 0xFF Abort + 사용자 보고 |
| `0x05` BUFFER_OVERFLOW | DataLen을 절반으로 줄여 동일 패킷 재전송, 이후 패킷도 줄어든 크기 유지 |
| `0x06` NOT_INITIALIZED | 0xFF Abort 후 처음부터 재시작 (세션 동기 깨짐) |
| `0x07` ERASE_NOT_DONE | 0x91 폴링으로 복귀 후 Erase 완료 재확인 |

---

## 미결 사항 (TODO)

- [ ] **Baud Rate 변경 시퀀스 설계**
  - 흐름: Baud Rate 파라미터 쓰기 → 소프트웨어 리셋 명령 → 새 Baud Rate로 100 ms마다 폴링하여 부팅 및 설정 확인
  - 최대 재시도 횟수 결정 (초과 시 fail 처리)
  - 폴링에 사용할 패킷 종류 결정 (FC 0x23 Init 재사용 vs 별도 ping)

- [ ] **0xFF Abort 방향 결정** — 아래 3가지 중 선택
  - ① Abort 불필요: 실패 시 소프트웨어 리셋으로 원래 Baud Rate 복구 후 처음부터 재시도
  - ② Abort 유지: Init(0x90) 이후 ~ Complete(0x99) 이전 어느 단계에서든 명시적 취소 명령
  - ③ Abort = 소프트웨어 리셋: 0xFF를 "다운로드 상태 초기화 + 리셋" 복합 명령으로 정의

- [ ] **0x99 Complete의 펌웨어 이미지 CRC-32 알고리즘 확인**
  - **권장 후보: CRC-32/ISO-HDLC**
    - 다항식: `0x04C11DB7`
    - 초기값: `0xFFFFFFFF`
    - 입력 비트 반전: Yes (RefIn=true)
    - 출력 비트 반전: Yes (RefOut=true)
    - 출력 XOR: `0xFFFFFFFF`
    - 검증 테스트 벡터: 입력 `"123456789"` (9 bytes ASCII) → 출력 `0xCBF43926`
  - STM32 CRC 하드웨어 유닛은 기본 동작이 비트 반전 없음 + 초기값 `0xFFFFFFFF` + 워드 단위 입력. 위 알고리즘과 동일 결과를 내려면 펌웨어 측에서 SW 구현하거나 STM32L4/F7 이상의 설정 가능 옵션을 사용해야 함.
  - 호스트(`app.js`)와 장치가 동일한 CRC-32 결과를 내는지 위 테스트 벡터로 사전 검증 필수.

- [ ] **최적 DataLen 실측**
  - 244 bytes가 이론상 최대이나 Flash 쓰기 지연 고려 시 실제 안정적인 최대값 확인 필요

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app.js` | OS Update 탭 UI 및 전송 로직 |
| `docs/protocol/펌웨어 다운로드 프로토콜 정리.txt` | 기존 FC 0x66 프로토콜 참고 |
