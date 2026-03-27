# 기본동작 No. 09 - 펌웨어 버전확인 main, main boot

## 시험 항목

펌웨어 버전확인 main, main boot

## 시험 목표

- Main SW Version [0xD003] 파라미터를 FC(04)로 읽어 현재 탑재된 Main 펌웨어 버전과 일치함을 확인한다.
- Main Boot Version [0xD002] 파라미터를 FC(04)로 읽어 정상 출력됨을 확인한다.
- OS 다운로드(No. 11) 시험 후 버전이 갱신됨을 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- 탑재된 펌웨어 버전 정보 사전 확보
- Slave ID: 0x01 기준

### 시험 절차

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. 통신 툴을 실행하고 드라이브와 정상 통신되는지 확인한다.
3. Main SW Version 파라미터를 읽는다.

**Main SW Version 읽기 명령 — FC(04) Read Input Register**
- 레지스터: Bus Controller Software Version [0xD003]

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x03 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 03 00 01 B8 4F`

4. Main Boot Version 파라미터를 읽는다.

**Main Boot Version 읽기 명령 — FC(04) Read Input Register**
- 레지스터: Bus Controller Software Name [0xD002]

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x02 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 02 00 01 09 8F`

5. 읽은 버전이 현재 탑재된 펌웨어 버전과 일치하는지 확인한다.
6. OS 다운로드(No. 11) 시험 후 버전이 갱신되는지 확인한다. (No. 11 시험과 연계)

### 판정 기준

- Main SW Version(0xD003) 파라미터가 현재 탑재된 펌웨어 버전과 일치
- Main Boot Version(0xD002) 파라미터가 정상 출력

**합격 조건**: 위 판정 조건 모두 만족

## 시험 결과

| 시험 일자 | 시험자 | 판정 | 비고 |
|----------|--------|------|------|
|          |        | □ 합격 / □ 불합격 |      |


시험 항목 : [RS485 Modbus 기반 펌웨어(Main/Boot) 버전 메모리 무결성 및 OS 다운로드(OTA) 연계 침범 방어/안전 복구 통합 검증] 시험 목적 : Modbus FC 0x04 명령으로 Main SW [0xD003] 및 Main Boot [0xD002] 버전이 정상 파싱되는지 확인하고, OS 다운로드 시 Main App 영역만 독립적으로 갱신되며 Boot 영역은 철저히 보호되는지 검증한다. 또한 Read-Only 권한 침범에 대한 예외 처리와 OS 다운로드 중단(Power-Loss) 시 Bootloader 자가 복구 상태(Fallback) 진입을 종합적으로 확인한다.

시험 방법 : <Phase 1. 초기 통신 연결 및 현재 펌웨어 메모리 무결성 확인 (Base Setup)>

RS485 인터페이스를 통해 드라이브(Node ID: 0x01)와 PC를 연결하고 19200bps 통신을 개방한다.
Main SW Version [0xD003] 파라미터를 Read Input Register (FC: 0x04) 명령으로 읽어온다.
송신(TX) 프레임: 01 04 D0 03 00 01 B8 4F
Main Boot Version [0xD002] 파라미터를 동일하게 읽어온다.
송신(TX) 프레임: 01 04 D0 02 00 01 09 8F
수신된 Hex 데이터를 파싱하여, 현재 드라이브에 플래싱(Flashing)된 실제 바이너리 릴리즈 버전(예: Main v1.0.0, Boot v1.0)과 100% 일치하는지 확인하여 초기값을 기록한다.
<Phase 2. OS 다운로드 연계 및 메모리 침범(Memory Segregation) 무결성 검증 (OTA Update Test)>

전용 툴(또는 Modbus Master)을 이용하여 상위 버전(예: Main v1.1.0)의 신규 OS 펌웨어 바이너리를 드라이브에 다운로드(OTA) 수행한다.
다운로드가 100% 완료되고 드라이브가 스스로 재부팅(소프트웨어 리셋)을 완료할 때까지 대기한다.
통신이 재개되면 Phase 1의 읽기 명령(FC: 0x04)을 다시 전송하여 버전 갱신 여부를 확인한다.
[메모리 분리 핵심] Main SW Version [0xD003]은 신규 버전(v1.1.0)으로 갱신되었으나, Main Boot Version [0xD002]은 절대 변하지 않고 기존 버전(v1.0)을 완벽히 유지하는지 확인한다.
<Phase 3. 버전에 대한 불법 쓰기 시도 및 권한 예외 검증 (Negative Test)>

버전 정보는 외부에서 수정할 수 없는 철저한 Read-Only 속성의 Input Register이다. 이를 파괴하기 위해 Main SW [0xD003] 주소에 임의의 버전 값(예: 0x9999)을 강제로 Write Single Register (FC: 0x06) 송신 시도한다.
예외 송신(TX) 프레임: 01 06 D0 03 99 99 [맞는 CRC Hi/Lo]
통신 수신 버퍼를 감시하며, 펌웨어가 이 불법적인 덮어쓰기 공격을 거부하는지 확인한다.
전원을 OFF/ON 한 후 다시 FC 0x04로 버전을 읽었을 때, 0x9999로 오염되지 않고 정상 버전이 유지되는지 교차 확인한다.
<Phase 4. OS 다운로드 중단(Blackout) 스트레스 및 Bootloader 생존 복구 검증 (Recovery Test)>

다시 신규 펌웨어(예: v1.2.0) 다운로드를 시작하고, 플래시 메모리에 데이터를 기록하는 도중(진행률 약 50% 시점) 기습적으로 드라이브의 주 전원을 강제 차단한다.
메인 App 영역이 반쯤 지워지고(Erase) 깨진(Corrupted) 상태에서 10초 대기 후 전원을 재투입한다.
장비가 벽돌(Brick/Deadlock) 현상에 빠지지 않고 Bootloader 모드로 자가 복구 부팅되어 RS485 통신 응답을 수행하는지 확인한다.
이 복구 상태(Fallback)에서 버전 읽기 명령(01 04 D0 03 00 01 B8 4F)을 전송했을 때, Main SW 버전은 0x0000 또는 0xFFFF(App 없음/에러 상태)를 리포트하고, Boot Version [0xD002]은 정상 출력되며 마스터의 OS 재다운로드 명령을 기다리는지 확인한다.
판정기준 : [Phase 1 판정 - 초기 연결]

01 04 02 [Data Hi] [Data Lo] [CRC] 형태의 정상 응답이 수신되어야 하며, 두 버전 모두 쓰레기 값 없이 명확히 파싱되어야 한다.
[Phase 2 판정 - 정상 조합 전수 및 경계값 (메모리 보호 핵심)]

OTA 완료 후 통신 단절(Deadlock) 없이 정상적으로 통신 루프가 재개되어야 한다.
Main SW [0xD003]의 파라미터는 신규 버전(예: 0x0110 -> v1.1.0)으로 갱신되되, Main Boot [0xD002]는 기존 값을 그대로 유지하여 메모리 영역 간 침범(Overwrite) 버그가 없음을 증명해야 합격 처리한다.
[Phase 3 판정 - 예외 처리]

Input Register 영역(FC 0x04 전용)에 FC 0x06 Write 시도 시, 펌웨어 파서(Parser)는 이를 무시하고 즉시 Modbus Exception Code 0x01 (Illegal Function) 또는 0x02 (Illegal Data Address) 프레임(예: 01 86 01 83 A0)으로 응답하여 메모리 오염을 원천 차단해야 한다.
[Phase 4 판정 - 에러 복구 및 Boot 생존율 (신뢰성 핵심)]

OS 업데이트 중 전원이 차단되더라도, 하드웨어가 뻗어버리거나 JTAG/SWD 장비 없이 복구가 불가능한 벽돌(Brick) 상태가 되면 즉시 **불합격(Fail)**이다.
전원 재투입 시 Bootloader가 스스로 살아남아 통신을 개방해야 하며, Main SW [0xD003] 값은 App 훼손을 의미하는 0x0000 등을 명확히 리포트하여, 상위 제어기(PC)가 안전하게 OS를 재다운로드할 수 있는 환경(Safe State)을 제공해야만 최종 합격 처리한다.