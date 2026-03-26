# 구동동작 No. 07 - Set Value

## 시험 항목

Set Point [0xD001] 파라미터를 통해 다양한 지령값을 설정하고 드라이브가 해당 값에 정상 추종하는지 확인하는 시험이다.

## 시험 목표

Open-loop 및 Closed-loop Velocity 모드에서 Set Point [0xD001]에 다양한 지령값을 입력하여 각 값에 대해 Command Torque [0xD050] 또는 Actual Speed [0xD02D] 파라미터가 정상 추종하는지 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- Set Value Source [0xD101] = RS485 (0x0001) 설정 완료
- Slave ID: 0x01 기준

---

### Open-loop 모드 Set Value 검증

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. Operating Mode를 Open-loop(0x0002)로 설정한다.
3. 아래 Set Point 값을 순서대로 설정하고 Command Torque [0xD050]를 읽어 확인한다.

**변환 공식 (Open-loop):** raw = pct / 100 × 65535

| Set Point 값 | 의미 | 기대 Command Torque |
|-------------|------|---------------------|
| 0x0000 (0) | 0% | 0% |
| 0x199A (6554) | 10% | 10 |
| 0x8000 (32768) | 50% | 50 |
| 0xFFFF (65535) | 100% | 100 |

**Command Torque 읽기 — FC(04) Read Input Register**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x50 | 0x00 | 0x01 | 0x09 | 0x1B |

→ `01 04 D0 50 00 01 09 1B`

---

### Closed-loop Velocity 모드 Set Value 검증

4. Operating Mode를 Closed-loop Velocity(0x0000)로 설정한다.
5. 아래 Set Point 값을 순서대로 설정하고 Actual Speed [0xD02D]를 읽어 확인한다.

**변환 공식 (Closed-loop):** raw = rpm / maxSpeed × 64000 (maxSpeed = 1600RPM 기준)

| Set Point 값 | 기대 속도 (RPM) |
|-------------|----------------|
| 0x0000 (0) | 0 RPM |
| 0x0C80 (3200) | 100 RPM |
| 0x1900 (6400) | 200 RPM |
| 0x7D00 (32000) | 1000 RPM |
| 0xFA00 (64000) | 1600 RPM (최대) |

**Actual Speed 읽기 — FC(04) Read Input Register**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x2D | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 2D 00 01 99 CB`

### 판정 기준

| 케이스 | 판정 조건 |
|--------|----------|
| Open-loop SP | 0% / 10% / 50% / 100% Set Point 각각에 대해 Command Torque가 기대값에 일치 |
| Closed-loop SP | 0 / 100 / 200 / 1000 / 1600 RPM Set Point 각각에 대해 Actual Speed가 기대값에 추종 |

**합격 조건**: Open-loop / Closed-loop 모드 모두 전 설정 포인트에서 정상 추종

## 시험 결과

| 시험 일자 | 시험자 | 케이스 | 판정 | 비고 |
|----------|--------|--------|------|------|
|          |        | Open-loop SP | □ 합격 / □ 불합격 | |
|          |        | Closed-loop SP | □ 합격 / □ 불합격 | |
|          |        | **종합** | □ 합격 / □ 불합격 | |
