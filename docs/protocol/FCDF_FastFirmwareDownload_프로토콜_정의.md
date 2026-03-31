# FC 0xDF : Fast Firmware Download 프로토콜

---

## 개요

| 항목 | 내용 |
|------|------|
| Function Code | `0xDF` (223) |
| 용도 | 고속 펌웨어 다운로드 (기존 FC 0x66 대체) |
| 방향 | Master → Slave (TX) / Slave → Master (RX) |
| CRC | **모든 TX/RX에 CRC-16 포함** (기존 프로토콜 대비 개선) |
| 최대 데이터 크기 | DataLen 필드 1바이트 → 최대 255 bytes/패킷 (장치 버퍼 의존) |

### 기존 프로토콜(FC 0x66) 대비 주요 개선점

| 항목 | FC 0x66 (기존) | FC 0xDF (신규) |
|------|--------------|--------------|
| RX CRC | 없음 | **있음** |
| 에코백 | 60바이트 전부 에코 | **없음** (ACK만 반환) |
| 재전송 | 없음 (실패 시 전체 중단) | **패킷 단위 최대 3회 재시도** |
| Erase 대기 | 고정 10초 하드코딩 | **0x91 폴링으로 실제 완료 감지** |
| 시퀀스 번호 | 없음 | **있음** (중복/누락 감지) |
| 패킷 크기 | 고정 60바이트 | **가변** (최대 255바이트) |
| 완료 검증 | 없음 | **전체 이미지 CRC32 검증** |
| 중단 명령 | 없음 | **0xFF Abort 지원** |

---

## OpCode 목록

### 요청(TX) OpCode

| OpCode | 이름 | 설명 |
|--------|------|------|
| `0x90` | Init | Flash Unlock & Erase 요청 |
| `0x91` | Erase Poll | Flash Erase 완료 상태 확인 |
| `0x03` | Data Transfer | 펌웨어 데이터 블록 전송 |
| `0x99` | Complete | 전송 완료 및 이미지 검증 요청 |
| `0xFF` | Abort | 다운로드 중단 및 장치 상태 초기화 |

### 응답(RX) OpCode

| OpCode | 이름 | 설명 |
|--------|------|------|
| `0x04` | ACK | 처리 성공 |
| `0x05` | NACK | 처리 실패 (ErrorCode 포함) |

### NACK ErrorCode

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
| 1 | Function Code | 1 B | 고정 `0xDF` |
| 2 | OpCode | 1 B | 동작 코드 |

---

### `0x90` — Init (Flash Unlock & Erase 요청)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x90` |
| 3–6 | FileSize | 4 B | 펌웨어 전체 크기 (bytes, Big-Endian) |
| 7–8 | CRC | 2 B | CRC-16 |

**총 길이: 9 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x90` |
| 3 | Status | 1 B | `0x00`=수락, `0x01`=이미 진행중, `0x02`=오류 |
| 4–5 | CRC | 2 B | CRC-16 |

**총 길이: 6 bytes**

> **참고:** Erase는 응답 직후 백그라운드에서 시작됨. 완료 여부는 0x91로 폴링.

---

### `0x91` — Erase Poll (Erase 완료 확인)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x91` |
| 3–4 | CRC | 2 B | CRC-16 |

**총 길이: 5 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
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
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x03` |
| 3–4 | SeqNum | 2 B | 패킷 순번 (0x0000부터 시작, 재전송 시 동일 값 유지) |
| 5–8 | FlashOffset | 4 B | 이 블록이 기록될 Flash 상대 주소 (Big-Endian) |
| 9 | DataLen | 1 B | 이 패킷의 펌웨어 데이터 크기 (bytes) |
| 10 … 10+DataLen−1 | Data | N B | 펌웨어 바이너리 데이터 |
| last–1 | CRC | 2 B | CRC-16 |

**총 길이: 12 + DataLen bytes**

**RX — ACK (OpCode `0x04`)**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x04` |
| 3–4 | SeqNum | 2 B | ACK한 패킷의 SeqNum (에코) |
| 5–8 | TotalReceived | 4 B | 현재까지 누적 수신 bytes |
| 9–10 | CRC | 2 B | CRC-16 |

**총 길이: 11 bytes**

**RX — NACK (OpCode `0x05`)**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x05` |
| 3–4 | SeqNum | 2 B | 실패한 패킷의 SeqNum |
| 5 | ErrorCode | 1 B | 오류 코드 (위 표 참고) |
| 6–9 | ExpectedOffset | 4 B | 장치가 기대하는 다음 FlashOffset |
| 10–11 | CRC | 2 B | CRC-16 |

**총 길이: 12 bytes**

> **패킷 크기:**
> - 장치 UART 수신 버퍼 최대 256 bytes → 헤더(10 B) + CRC(2 B) 제외 시 **최대 DataLen = 244 bytes**
> - 권장 시작값: 120 bytes (안정성 우선)
> - BUFFER_OVERFLOW(0x05) NACK 시 절반으로 줄여 재시도

---

### `0x99` — Complete (전송 완료 및 이미지 검증)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x99` |
| 3–6 | FirmwareCRC32 | 4 B | 전체 펌웨어 이미지 CRC-32 (Big-Endian) |
| 7–10 | TotalSize | 4 B | 전체 펌웨어 크기 bytes (Big-Endian) |
| 11–12 | CRC | 2 B | CRC-16 |

**총 길이: 13 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0x99` |
| 3 | VerifyResult | 1 B | `0x00`=OK, `0x01`=CRC불일치, `0x02`=크기불일치, `0x03`=Flash읽기오류 |
| 4–7 | DeviceCRC32 | 4 B | 장치가 Flash에서 계산한 CRC-32 (비교용) |
| 8–9 | CRC | 2 B | CRC-16 |

**총 길이: 10 bytes**

> VerifyResult=`0x00` 수신 시 장치가 다음 부팅에 Flash Copy를 실행함.
> VerifyResult≠`0x00` 시 펌웨어 이미지 손상 — 처음부터 재시도 필요.

---

### `0xFF` — Abort (다운로드 중단)

**TX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0xFF` |
| 3–4 | CRC | 2 B | CRC-16 |

**총 길이: 5 bytes**

**RX**

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | FC | 1 B | `0xDF` |
| 2 | OpCode | 1 B | `0xFF` |
| 3 | Status | 1 B | `0x00`=초기화 완료 |
| 4–5 | CRC | 2 B | CRC-16 |

**총 길이: 6 bytes**

> 장치는 Abort 수신 시 Flash 쓰기를 중단하고 다운로드 상태를 초기화함.

---

## 전체 동작 시퀀스

```
Master                                   Slave
  │                                        │
  │──── 0x90 Init [FileSize] ─────────────▶│  Flash Unlock & Erase 시작
  │◀─── 0x90 ACK [Status=0x00] ────────────│  Erase 백그라운드 진행 중
  │                                        │
  │──── 0x91 Erase Poll ──────────────────▶│
  │◀─── 0x91 [EraseStatus=0x00] ───────────│  진행 중, 500ms 후 재시도
  │──── 0x91 Erase Poll ──────────────────▶│
  │◀─── 0x91 [EraseStatus=0x01] ───────────│  완료
  │                                        │
  │──── 0x03 [SeqNum=0, Offset=0, N bytes]▶│
  │◀─── 0x04 ACK [SeqNum=0, Total=N] ──────│
  │──── 0x03 [SeqNum=1, Offset=N, N bytes]▶│
  │◀─── 0x05 NACK [ErrorCode=CRC_ERROR] ───│  CRC 오류 발생
  │──── 0x03 [SeqNum=1, Offset=N, N bytes]▶│  동일 패킷 재전송 (1st retry)
  │◀─── 0x04 ACK [SeqNum=1, Total=2N] ─────│  성공
  │         … N 패킷 반복 …                 │
  │──── 0x03 [SeqNum=M, 마지막 블록] ──────▶│
  │◀─── 0x04 ACK [Total=FileSize] ──────────│
  │                                        │
  │──── 0x99 Complete [CRC32, Size] ───────▶│  전체 이미지 검증 요청
  │◀─── 0x99 [VerifyResult=0x00, CRC32] ───│  검증 성공, 부팅 시 Flash Copy 예약
  │                                        │
  │          다운로드 완료                   │
```

### 오류 발생 시 (중단)

```
Master                                   Slave
  │                                        │
  │  (연속 3회 NACK 또는 타임아웃)           │
  │──── 0xFF Abort ────────────────────────▶│  상태 초기화
  │◀─── 0xFF ACK ──────────────────────────│
  │          다운로드 실패 처리               │
```

---

## 재전송 정책

| 상황 | 동작 |
|------|------|
| NACK(0x05) 수신 | 동일 SeqNum 패킷 즉시 재전송 |
| 응답 타임아웃 (500 ms) | 동일 패킷 재전송 |
| 최대 재시도 횟수 | **3회** (초과 시 다운로드 중단) |
| NACK의 ExpectedOffset이 현재 Offset과 다를 때 | ExpectedOffset 기준으로 해당 패킷부터 재개 |
| BUFFER_OVERFLOW(0x05) | DataLen을 절반으로 줄여 재분할 전송 |

---

## 패킷 크기 가이드라인

| 단계 | 권장 DataLen | 비고 |
|------|-------------|------|
| 초기 테스트 | 60 bytes | FC 0x66과 동일 (안전) |
| 표준 운용 | 120 bytes | 2배 향상, 대부분 장치에서 안전 |
| 고성능 | 240 bytes | 장치 버퍼 확인 필요 |
| 최대 이론치 | 255 bytes | DataLen 필드 최대값 |

> BUFFER_OVERFLOW NACK 발생 시 현재 DataLen의 절반으로 줄이고,
> 이후 패킷부터 줄어든 크기 유지.

---

## 성능 예측 (FileSize = 112 KB 기준)

| 조건 | 패킷당 시간 | 총 패킷 수 | 예상 시간 |
|------|------------|-----------|---------|
| FC 0x66 기존 (19200, 60B, 에코) | ~54 ms | ~1,900 | **~103 초** |
| FC 0xDF (19200, 60B, ACK only) | ~33 ms | ~1,900 | **~63 초** |
| FC 0xDF (19200, 120B, ACK only) | ~52 ms | ~950 | **~49 초** |
| FC 0xDF (19200, 240B, ACK only) | ~100 ms | ~475 | **~47 초** |

> 실제 시간은 장치 Flash 쓰기 지연, 인터패킷 간격 등으로 달라질 수 있음.
> Baud Rate는 장치 파라미터로 별도 설정하며 본 프로토콜에서 다루지 않음.

---

## 확인된 사항

| 항목 | 내용 |
|------|------|
| 패킷 CRC | Modbus CRC-16 (표준) |
| 장치 UART 수신 버퍼 | 최대 256 bytes → 최대 DataLen = **244 bytes** |
| 지원 Baud Rate | 115200 bps 확인, 그 이상도 구현 가능 |

---

## 미결 사항 (TODO)

- [ ] **Baud Rate 변경 시퀀스 설계**
  - 흐름: Baud Rate 파라미터 쓰기 → 소프트웨어 리셋 명령 → 새 Baud Rate로 100 ms마다 폴링하여 부팅 및 설정 확인
  - 최대 재시도 횟수 결정 (초과 시 fail 처리)
  - 폴링에 사용할 패킷 종류 결정 (FC 0xDF Init 재사용 vs 별도 ping)

- [ ] **0xFF Abort 방향 결정** — 아래 3가지 중 선택
  - ① Abort 불필요: 실패 시 소프트웨어 리셋으로 원래 Baud Rate 복구 후 처음부터 재시도
  - ② Abort 유지: Init(0x90) 이후 ~ Complete(0x99) 이전 어느 단계에서든 명시적 취소 명령
  - ③ Abort = 소프트웨어 리셋: 0xFF를 "다운로드 상태 초기화 + 리셋" 복합 명령으로 정의

- [ ] **0x99 Complete의 펌웨어 이미지 CRC-32 알고리즘 확인**
  - STM32 CRC 하드웨어 유닛 사용 여부 및 초기값·다항식 확인 필요
  - 호스트(app.js)와 장치가 동일한 CRC-32 결과를 내야 함

- [ ] **최적 DataLen 실측**
  - 244 bytes가 이론상 최대이나 Flash 쓰기 지연 고려 시 실제 안정적인 최대값 확인 필요

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app.js` | OS Update 탭 UI 및 전송 로직 |
| `docs/protocol/펌웨어 다운로드 프로토콜 정리.txt` | 기존 FC 0x66 프로토콜 참고 |
