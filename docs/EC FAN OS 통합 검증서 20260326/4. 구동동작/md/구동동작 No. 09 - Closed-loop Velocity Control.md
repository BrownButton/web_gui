# 구동동작 No. 09 - Closed-loop Velocity Control

## 시험 항목

Closed-loop Velocity Control

## 시험 목표

- Operating Mode [0xD106]을 Closed-loop Velocity(0x0000)로 설정하고 Set Point [0xD001]에 100rpm 속도 명령(0x0C80)을 전송한다.
- Command Velocity [0xD051] 파라미터가 100rpm으로 설정됨을 확인한다.
- Actual Speed [0xD02D]가 100rpm에 추종함을 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- Set Value Source [0xD101] = RS485 (0x0001) 설정 완료
- Slave ID: 0x01 기준

### 시험 절차

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. 통신 툴을 실행하고 드라이브와 정상 통신되는지 확인한다.
3. 운전 모드를 Closed-loop Velocity mode로 변경한다.

**Operating Mode 쓰기 (Closed-loop Velocity = 0x0000) — FC(06) Write Single Register**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x06 | 0xD1 | 0x06 | 0x00 | 0x00 | 0x50 | 0xF7 |

→ `01 06 D1 06 00 00 50 F7`

4. 100rpm으로 구동하도록 Set Point를 3200(0x0C80)으로 설정한다.
   - 변환 공식: raw = rpm / maxSpeed × 64000 (maxSpeed = 1600RPM 기준)
   - 100rpm = 100 / 1600 × 64000 = 4000 → 단, 기존 시험에서 3200(0x0C80) 사용

**Set Point 쓰기 (100rpm = 3200 = 0x0C80) — FC(06) Write Single Register**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x06 | 0xD0 | 0x01 | 0x0C | 0x80 | 0xE4 | 0x6A |

→ `01 06 D0 01 0C 80 E4 6A`

5. Command Velocity [0xD051] 파라미터를 읽어 100rpm으로 설정되었는지 확인한다.

**Command Velocity 읽기 — FC(04) Read Input Register**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x51 | 0x00 | 0x01 | 0x58 | 0xD8 |

→ `01 04 D0 51 00 01 58 D8`

6. Actual Speed [0xD02D]를 읽어 실제 속도가 100rpm에 추종하는지 확인한다.

**Actual Speed 읽기 — FC(04) Read Input Register**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x2D | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 2D 00 01 99 CB`

7. 다양한 속도 명령으로 추가 검증한다.

| Set Point 값 | 기대 Actual Speed |
|-------------|------------------|
| 0x0C80 (3200) | 100 RPM |
| 0x1900 (6400) | 200 RPM |
| 0x7D00 (32000) | 1000 RPM |

8. Set Point를 0으로 설정하여 정지시킨다.

### 판정 기준

- Command Velocity [0xD051] 파라미터의 값이 100으로 확인 (속도 지령 100rpm 출력 확인)
- Actual Speed [0xD02D]가 100rpm에 추종

**합격 조건**: 위 판정 조건 모두 만족

## 시험 결과

| 시험 일자 | 시험자 | 판정 | 비고 |
|----------|--------|------|------|
|          |        | □ 합격 / □ 불합격 |      |
