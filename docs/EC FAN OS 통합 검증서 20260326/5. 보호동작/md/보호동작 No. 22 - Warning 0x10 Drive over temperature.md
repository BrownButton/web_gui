# 보호동작 No. 22 - Warning 0x10 Drive over temperature

## 시험 항목

Warning 0x10 Drive over temperature

## 시험 목표

- 드라이브를 고부하로 운전하거나 열풍기로 제어부 온도를 Warning 임계값 이상으로 상승시킨다.
- Warning Status [0xD012]의 Bit 4 (Drive Over Temperature, 0x0010)이 Set됨을 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- Electronics Temperature [0xD017] 모니터링 가능 상태
- Slave ID: 0x01 기준

### 시험 절차

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. 통신 툴을 실행하고 드라이브와 정상 통신되는지 확인한다.
3. 드라이브를 고부하로 운전하거나 열풍기로 드라이브 제어부 온도를 상승시킨다.
4. Board 온도 파라미터(Electronics Temperature [0xD017])를 모니터링하면서 Warning 임계값에 근접하는지 확인한다.

**Board Temperature 읽기 명령 — FC(04)**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x17 | 0x00 | 0x01 | CRC Lo | CRC Hi |

5. Warning Status 파라미터를 읽어 비트 4 Set 여부를 확인한다.

**Warning Status 읽기 명령 — FC(04) Read Input Register**
- 레지스터: Warning [0xD012]

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x12 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 12 00 01 28 4F`

**Warning Status 비트맵 (확인 비트)**

| 비트 | 이름 | 값 | 설명 |
|------|------|----|------|
| 4 | Drive Over Temperature | 0x0010 | 드라이브 제어부 과온 경고 |

### 판정 기준

- Warning Status [0xD012] Bit 4 (0x0010) Set 확인

**합격 조건**: 위 판정 조건 모두 만족

## 시험 결과

| 시험 일자 | 시험자 | 판정 | 비고 |
|----------|--------|------|------|
|          |        | □ 합격 / □ 불합격 |      |
