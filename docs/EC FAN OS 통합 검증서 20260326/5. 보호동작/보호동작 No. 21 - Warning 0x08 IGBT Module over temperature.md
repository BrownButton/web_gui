# 보호동작 No. 21 - Warning 0x08 IGBT Module over temperature

## 시험 항목

IGBT 모듈 온도가 Warning 임계값을 초과했을 때 Warning 신호가 발생하는지 확인하는 시험이다.

## 시험 목표

드라이브를 고부하로 운전하거나 IGBT 모듈에 직접 열을 가하여 Module Temperature [0xD015]가 Warning 임계값을 초과하면, Warning Status [0xD012]의 Bit 3 (IGBT Module Over Temperature, 0x0008)이 Set되는지 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- Module Temperature [0xD015] 모니터링 가능 상태
- Slave ID: 0x01 기준

### 시험 절차

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. 통신 툴을 실행하고 드라이브와 정상 통신되는지 확인한다.
3. 드라이브를 고부하로 운전하거나 열풍기로 IGBT 모듈 온도를 상승시킨다.
4. Module Temperature [0xD015]를 모니터링하면서 Warning 임계값에 근접하는지 확인한다.

**Module Temperature 읽기 명령 — FC(04)**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x15 | 0x00 | 0x01 | CRC Lo | CRC Hi |

5. Warning Status 파라미터를 읽어 비트 3 Set 여부를 확인한다.

**Warning Status 읽기 명령 — FC(04) Read Input Register**
- 레지스터: Warning [0xD012]

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x12 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 12 00 01 28 4F`

**Warning Status 비트맵 (확인 비트)**

| 비트 | 이름 | 값 | 설명 |
|------|------|----|------|
| 3 | IGBT Module Over Temperature | 0x0008 | IGBT 모듈 과온 경고 |

### 판정 기준

- Warning Status [0xD012] Bit 3 (0x0008) Set 확인

**합격 조건**: 위 판정 조건 모두 만족

## 시험 결과

| 시험 일자 | 시험자 | 판정 | 비고 |
|----------|--------|------|------|
|          |        | □ 합격 / □ 불합격 |      |
