# 보호동작 No. 23 - Warning 0x40 Torque Limit

## 시험 항목

Warning 0x40 Torque Limit

## 시험 목표

- Maximum Coil Current [0xD13B]를 낮게 설정하여 토크 제한값을 낮추고 Closed-loop Velocity 모드로 구동 시 부하를 증가시킨다.
- 토크 제한에 도달하면 Warning Status [0xD012]의 Bit 6 (Torque Limit, 0x0040)이 Set됨을 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- Slave ID: 0x01 기준

### 시험 절차

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. 통신 툴을 실행하고 드라이브와 정상 통신되는지 확인한다.
3. Max Coil Current [0xD13B] 파라미터를 낮은 값으로 설정하여 토크 제한을 낮춘다.

**Max Coil Current 쓰기 — FC(06) Write Single Register**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x06 | 0xD1 | 0x3B | Low Value Hi | Low Value Lo | CRC Lo | CRC Hi |

4. Closed-loop Velocity 모드로 구동하면서 부하를 증가시킨다.
   - 또는 팬 블레이드를 부착한 상태에서 높은 속도로 구동
5. Command Torque [0xD050] 파라미터를 모니터링하여 토크 제한값에 도달하는지 확인한다.

**Command Torque 읽기 — FC(04)**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x50 | 0x00 | 0x01 | 0x09 | 0x1B |

6. Warning Status [0xD012]를 읽어 비트 6 Set 여부를 확인한다.

**Warning Status 읽기 명령 — FC(04) Read Input Register**
- 레지스터: Warning [0xD012]

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x12 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 12 00 01 28 4F`

**Warning Status 비트맵 (확인 비트)**

| 비트 | 이름 | 값 | 설명 |
|------|------|----|------|
| 6 | Torque Limit | 0x0040 | 토크 제한 도달 경고 |

### 판정 기준

- Warning Status [0xD012] Bit 6 (0x0040) Set 확인

**합격 조건**: 위 판정 조건 모두 만족

## 시험 결과

| 시험 일자 | 시험자 | 판정 | 비고 |
|----------|--------|------|------|
|          |        | □ 합격 / □ 불합격 |      |
