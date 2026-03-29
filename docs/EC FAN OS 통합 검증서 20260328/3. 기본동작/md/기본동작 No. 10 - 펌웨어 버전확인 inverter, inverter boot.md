# 기본동작 No. 10 - 펌웨어 버전확인 inverter, inverter boot

## 시험 항목

펌웨어 버전확인 inverter, inverter boot

## 시험 목표

- Inverter SW Version [0xD005] 파라미터를 FC(04)로 읽어 현재 탑재된 Inverter 펌웨어 버전과 일치함을 확인한다.
- Inverter Boot Version [0xD004] 파라미터를 FC(04)로 읽어 정상 출력됨을 확인한다.
- Inverter OS 다운로드(No. 12) 시험 후 버전이 갱신됨을 확인한다.

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


시험 항목 : [RS485 Modbus 기반 듀얼 MCU(Inverter/Boot) 버전 IPC 무결성 및 내부 OS 업데이트(OTA) 연계 격리/안전 복구 통합 검증]

시험 목적 : Modbus FC 0x04 명령으로 Inverter SW [0xD005] 및 Boot [0xD004] 버전을 읽어 Main-Inverter 간 내부 통신(IPC) 동기화 상태를 확인하고, Inverter OS 다운로드 시 Boot 영역이 철저히 보호(격리)되는지 검증한다. 또한 Read-Only 접근 권한 방어 로직과, Inverter 펌웨어 업데이트 중단(Power-Loss) 시 Main MCU의 통신 생존성 및 Inverter Bootloader 자가 복구 대기 상태를 종합적으로 검증한다.

시험 방법 : <Phase 1. 초기 듀얼 통신 연결 및 내부 IPC(Inter-Processor Comm) 동기화 무결성 확인 (Base Setup)>

RS485 인터페이스를 통해 드라이브(Node ID: 0x01)와 PC를 연결하고 19200bps 통신을 개방한다.
Inverter SW Version [0xD005] 파라미터를 Read Input Register (FC: 0x04) 명령으로 읽어온다.
송신(TX) 프레임: 01 04 D0 05 00 01 F9 8E
Inverter Boot Version [0xD004] 파라미터를 동일하게 읽어온다.
송신(TX) 프레임: 01 04 D0 04 00 01 48 4E
수신된 Hex 데이터가 Main MCU 내부에 캐시(Cache)된 더미 데이터가 아닌, 실제 Inverter MCU에서 정상적으로 응답받은 최신 릴리즈 버전(예: Inverter v2.0.0, Boot v1.0)과 100% 일치하는지 확인한다.
<Phase 2. Inverter OS 다운로드 연계 및 메모리 격리(Isolation) 검증 (Inverter OTA Test)>

통신 툴(또는 전용 다운로더)을 이용하여 상위 버전(예: Inverter v2.1.0)의 신규 OS 바이너리를 드라이브에 전송한다.
[내부 통신 스트레스] Main MCU가 Inverter MCU로 데이터를 패스스루(Pass-through)하며 플래싱하는 수십 초의 과정 동안, 다른 범용 Modbus 읽기 명령(예: Status [0xD011])을 간헐적으로 Polling 하여 RS485 통신 스택이 데드락(Hang-up)에 빠지지 않는지 확인한다.
업데이트 완료 및 인버터 재부팅 후, Phase 1의 버전 읽기 명령을 재전송한다.
Inverter SW [0xD005]는 신규 버전(v2.1.0)으로 갱신되었으나, Inverter Boot [0xD004]는 절대 덮어씌워지지 않고 기존 버전(v1.0)을 완벽히 유지하는지 확인한다.
<Phase 3. 버전에 대한 불법 쓰기 시도 및 Input 권한 예외 검증 (Negative Test)>

Inverter 버전 정보는 외부 마스터가 임의로 수정할 수 없는 순수 Read-Only 속성이어야 한다. 이를 침범하기 위해 Inverter SW [0xD005] 주소에 임의의 버전 값(예: 0x8888)을 강제로 Write Single Register (FC: 0x06) 송신 시도한다.
예외 송신(TX) 프레임: 01 06 D0 05 88 88 [맞는 CRC Hi/Lo]
수신 버퍼를 감시하며 펌웨어가 이 불법적인 덮어쓰기 공격을 거부하는지 확인한다.
드라이브 리셋 후 버전을 다시 읽었을 때 0x8888로 오염되지 않았는지 2차 대조한다.
<Phase 4. Inverter OS 다운로드 중단(Blackout) 스트레스 및 Main MCU 생존/Boot 복구 검증 (Dual-Core Recovery Test)>

다시 신규 Inverter 펌웨어(예: v2.2.0) 다운로드를 시작하고, Inverter MCU의 플래시 메모리에 데이터를 한창 굽고 있는 도중(약 50% 진행 시점) 드라이브 주 전원을 강제로 절체한다.
10초 대기 후 전원을 재투입한다.
[아키텍처 복구 핵심] Inverter App 영역이 훼손되었더라도 Main MCU는 정상 부팅되어 RS485 통신 응답을 수행해야만 한다.
Main MCU가 내부적으로 Inverter MCU와 통신을 시도했을 때, Inverter MCU가 벽돌(Brick)이 되지 않고 Bootloader로 응답하는지 확인한다.
이때 Inverter SW [0xD005] 읽기 시 0x0000 또는 0xFFFF(App Corrupted)를 반환하고, Boot [0xD004]는 정상 출력되어 상위 제어기가 '인버터 OS 재다운로드 필요 상태'임을 명확히 인지할 수 있도록 리포트해야 한다.

판정기준 :
[Phase 1 판정 - 초기 연결 및 IPC 정상]
01 04 02 [Data Hi] [Data Lo] [CRC] 형태의 정상 응답이 수신되어야 하며, Main MCU와 Inverter MCU 간의 내부 통신(SPI/UART 등) 에러로 인한 Timeout이나 Exception 응답이 없어야 한다.

[Phase 2 판정 - 정상 조합 전수 및 경계값 (메모리 보호 핵심)]
OTA 중에도 Main MCU의 Modbus 파서는 타 명령에 대해 최소한의 응답(또는 Busy Exception)을 주어야 하며 멈추지 않아야 한다.
갱신 후 Inverter Boot [0xD004] 파라미터가 훼손 없이 기존 값을 유지하여, App-Boot 영역 간 격리(Segregation)가 완벽함을 증명해야 합격 처리한다.

[Phase 3 판정 - 예외 처리]
FC 0x04 전용 Input Register 영역에 FC 0x06 Write 시도 시, Main MCU 파서는 즉각 Modbus Exception Code 0x01 (Illegal Function) 또는 0x02 (Illegal Data Address) 프레임(예: 01 86 01 83 A0)으로 응답하여 메모리 오염을 원천 차단해야 한다.
Phase 4 판정 - 에러 [blocked]

Inverter 업데이트 중 전원이 날아가도 **드라이브 전체가 통신 불능(Deadlock)의 벽돌 상태가 되면 즉시 불합격(Fail)**이다.
재부팅 시 Main MCU는 정상적으로 RS485 통신을 개방하고, Inverter MCU의 상태를 Boot 모드(App 훼손 상태)로 정확히 상위에 리포트하여 JTAG 장비 없이도 통신선만으로 OS 재복구가 가능하도록 시스템을 방어해야만 최종 합격 처리한다.