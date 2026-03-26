# 기본동작 No. 10 - 펌웨어 버전확인 inverter, inverter boot

## 시험 항목

Inverter 펌웨어 버전 및 Inverter Boot 버전 파라미터가 현재 탑재된 버전과 일치하는지 확인하는 시험이다.

## 시험 목표

Commutation Controller Software Version [0xD005] 및 Commutation Controller Software Name [0xD004] Input 레지스터를 FC(04)로 읽어 현재 탑재된 Inverter 펌웨어 및 Boot 버전과 일치하는지 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- 탑재된 Inverter 펌웨어 버전 정보 사전 확보
- Slave ID: 0x01 기준

### 시험 절차

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. 통신 툴을 실행하고 드라이브와 정상 통신되는지 확인한다.
3. Inverter SW Version 파라미터를 읽는다.

**Inverter SW Version 읽기 명령 — FC(04) Read Input Register**
- 레지스터: Commutation Controller Software Version [0xD005]

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x05 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 05 00 01 F9 8E`

4. Inverter Boot Version 파라미터를 읽는다.

**Inverter Boot Version 읽기 명령 — FC(04) Read Input Register**
- 레지스터: Commutation Controller Software Name [0xD004]

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x04 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 04 00 01 48 4E`

5. 읽은 버전이 현재 탑재된 Inverter 펌웨어 버전과 일치하는지 확인한다.
6. Inverter OS 다운로드(No. 12) 시험 후 버전이 갱신되는지 확인한다. (No. 12 시험과 연계)

### 판정 기준

- Inverter SW Version(0xD005) 파라미터가 현재 탑재된 인버터 펌웨어 버전과 일치
- Inverter Boot Version(0xD004) 파라미터가 정상 출력

**합격 조건**: 위 판정 조건 모두 만족

## 시험 결과

| 시험 일자 | 시험자 | 판정 | 비고 |
|----------|--------|------|------|
|          |        | □ 합격 / □ 불합격 |      |
