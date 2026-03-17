# FC 0x64 : Continuous Data Streaming 프로토콜

---

## 개요

| 항목 | 내용 |
|------|------|
| Function Code | `0x64` |
| 용도 | 고속 연속 데이터 수집 (차트용) |
| 방향 | Master → Slave (TX) / Slave → Master (RX) |
| CRC | 있음 (표준 Modbus CRC-16) |
| 최대 채널 수 | 4채널 (현재 펌웨어 고정, 향후 변경 예정) |
| 최대 데이터 수 | 15개 / 패킷 |

---

## Control 코드

| 값 | 이름 | 설명 |
|----|------|------|
| `0x00` | stop | 스트리밍 중지 |
| `0x02` | configure | 채널·주기 설정 |
| `0x03` | request data | 데이터 요청 |

---

## TX 패킷 구조

### 공통 헤더

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | Modbus 슬레이브 주소 |
| 1 | Function Code | 1 B | 고정 `0x64` |
| 2 | Control | 1 B | 동작 제어 코드 (위 표 참고) |

---

### TX — Control: `0x00` (Stop)

| 바이트 | 필드 | 크기 | 값 |
|--------|------|------|----|
| 0 | NodeID | 1 B | `0x01` |
| 1 | Function Code | 1 B | `0x64` |
| 2 | Control | 1 B | `0x00` |
| 3–4 | CRC | 2 B | CRC-16 |

**예시:**
```
TX: 01 64 00 XX XX
```

---

### TX — Control: `0x02` (Configure)

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | Function Code | 1 B | `0x64` |
| 2 | Control | 1 B | `0x02` |
| 3–4 | Period | 2 B | 샘플링 주기 (단위: 0.125 μs, 최솟값: 160 → 20 μs) |
| 5… | Channel List | N B | 채널 번호 배열 (범위: 1–254, 사용자 입력), `0xFF`로 종료 |
| last–1 | CRC | 2 B | CRC-16 |

> **Period 계산:** `period_us = value × 0.125`
> 예: `160 × 0.125 = 20 μs` (최고 속도)

> **Channel List:**
> - 범위: `0x01 ~ 0xFE` (1–254), 사용자가 직접 입력
> - 종료 마커: `0xFF`
> - 예: 3채널 → `01 03 64 FF` (채널 1, 3, 100, 종료)
> - 채널 번호별 물리량 정의는 추후 펌웨어 스펙에 따라 확정 예정

**예시 (3채널, 주기 160):**
```
TX: 01 64 02 00 A0 01 03 64 FF XX XX
         |Control |Period  |Channels|End|CRC|
```

---

### TX — Control: `0x03` (Request Data)

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | Function Code | 1 B | `0x64` |
| 2 | Control | 1 B | `0x03` |
| 3–4 | CRC | 2 B | CRC-16 |

**예시:**
```
TX: 01 64 03 XX XX
```

---

## RX 패킷 구조

### RX — Control: `0x00` (Stop 응답)

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | Function Code | 1 B | `0x64` |
| 2 | Control | 1 B | `0x00` |
| 3–4 | CRC | 2 B | CRC-16 |

**총 길이:** 4 바이트 (CRC 포함)

---

### RX — Control: `0x02` (Configure 응답)

TX 패킷을 그대로 에코백 (바이트 수·내용 동일)

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | Function Code | 1 B | `0x64` |
| 2 | Control | 1 B | `0x02` |
| 3–4 | Period | 2 B | TX와 동일 |
| 5… | Channel List | N B | TX와 동일 (`0xFF` 포함) |
| last–1 | CRC | 2 B | CRC-16 |

---

### RX — Control: `0x03` (Request Data 응답)

| 바이트 | 필드 | 크기 | 설명 |
|--------|------|------|------|
| 0 | NodeID | 1 B | |
| 1 | Function Code | 1 B | `0x64` |
| 2 | Control | 1 B | `0x03` |
| 3 | Status | 1 B | `0x00` = done / `0x01` = stay (버퍼 잔여 있음) |
| 4 | Len | 1 B | 데이터 항목 수 (최대 15) |
| 5 … 5+(Len×4)−1 | Data[Len] | 4 B × Len | **float32** IEEE 754 (최대 60 B) |
| last–1 | CRC | 2 B | CRC-16 |

> **Status = `0x01` (stay):** 버퍼에 더 읽을 데이터가 남아있음 → 연속 요청 필요
> **Status = `0x00` (done):** 현재 버퍼 소진 완료

**총 길이:** `5 + (Len × 4) + 2` 바이트

---

## 동작 시퀀스

```
Master                              Slave
  │                                   │
  │── TX: Configure (0x02) ──────────▶│  채널·주기 설정
  │◀─ RX: TX 에코백 ──────────────────│  설정 완료 응답
  │                                   │
  │── TX: Request (0x03) ────────────▶│
  │◀─ RX: Status=stay (0x01), Data ───│  데이터 있음, 계속 요청
  │── TX: Request (0x03) ────────────▶│
  │◀─ RX: Status=stay (0x01), Data ───│
  │── TX: Request (0x03) ────────────▶│
  │◀─ RX: Status=done (0x00), Data ───│  버퍼 소진
  │                                   │
  │── TX: Stop (0x00) ───────────────▶│  스트리밍 중지
  │◀─ RX: [NodeID][0x64][0x00][CRC] ──│  4바이트 응답
```

---

## 미확인 사항 (TODO)

- [ ] 채널 번호별 물리량 정의 (현재는 1–254 사용자 직접 입력, 추후 펌웨어 스펙 확정 시 추가)

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app.js` | Chart 탭 UI 및 데이터 처리 |
| `modbus.js` | FC 0x64 프레임 생성·파싱 |
