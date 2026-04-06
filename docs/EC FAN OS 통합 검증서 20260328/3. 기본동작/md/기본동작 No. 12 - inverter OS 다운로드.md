# 기본동작 No. 12 - inverter OS 다운로드

## 시험 항목

inverter OS 다운로드

## 시험 목표

- EC FAN OS 업데이트 툴을 이용하여 Inverter F/W 파일을 드라이브에 다운로드한 후 전원 Off/On 시 새로운 OS가 정상 적용됨을 확인한다.
- 다운로드 후 Inverter SW Version [0xD005] 파라미터에 업데이트된 버전이 반영됨을 확인한다.

## 시험 기준

### 사전 조건

- RS485 인터페이스를 통해 드라이브와 호스트 PC 연결 완료
- EC FAN OS 업데이트 툴 설치 완료
- 다운로드할 Inverter F/W 파일 준비 완료
- 현재 탑재 버전과 다운로드할 버전이 상이함을 확인

> ⚠️ 기본 통신 사양 (공장 출하 상태): Baudrate 19,200bps, Even Parity
> 드라이브 설정이 다를 경우 접속 불가 — 사전에 현재 설정 확인 필요

### 시험 절차

1. RS485 인터페이스를 통해 드라이브와 호스트 PC를 연결한다.
2. 시험 전 현재 Inverter SW Version을 확인한다.

**Inverter SW Version 읽기 명령 — FC(04)**

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x05 | 0x00 | 0x01 | CRC Lo | CRC Hi |

→ `01 04 D0 05 00 01 F9 8E`

3. EC FAN OS 업데이트 툴을 실행한다.
4. 통신 사양을 설정한 후 Connect 버튼을 누른다.
   - Baudrate: 19,200bps
   - Parity: Even
5. 다운로드할 **Inverter** F/W 파일을 선택한 후 Forced Download 체크박스를 체크한다.
6. Start 버튼을 눌러 다운로드를 진행한다.
   - 다운로드 진행 중 Progress Bar 모니터링
7. 다운로드 완료 후 전원을 Off/On한다.
8. 통신을 재접속하여 Inverter SW Version [0xD005]을 읽어 업데이트된 버전으로 변경되었는지 확인한다.

### 판정 기준

- Inverter OS 다운로드 및 전원 Off/On 후 Inverter SW Version(0xD005)이 업데이트된 버전으로 확인됨

**합격 조건**: 위 판정 조건 모두 만족

## 시험 결과

| 시험 일자 | 시험자 | 판정 | 비고 |
|----------|--------|------|------|
|          |        | □ 합격 / □ 불합격 |      |


시험 항목 : [RS485 Modbus 기반 듀얼 코어 IPC 패스스루(Pass-through) Inverter OS 다운로드 무결성 및 플래싱 중단 시 연계 안전 복구 통합 검증] 시험 목적 : EC FAN OS 업데이트 툴을 이용해 Main MCU를 거쳐 Inverter MCU로 전달되는 F/W 다운로드의 IPC(Inter-Processor Communication) 무결성을 확인한다. 또한 구동 중 업데이트 시도에 대한 안전 인터락(Safety Interlock), 타겟 불일치 파일 주입 예외 처리, 그리고 Inverter 플래싱 중단(Power-Loss) 시 Main MCU의 생존 및 Inverter Bootloader 연계 자가 복구 상태를 종합적으로 검증한다.

시험 방법 : <Phase 1. 초기 상태 연결 및 모터 구동 중 OTA 진입 인터락 안전성 검증 (Base Setup & Safety Interlock Test)>

RS485 인터페이스를 통해 드라이브(Node ID: 0x01)와 PC를 연결하고 19200bps(Even) 통신을 개방한다.
Inverter SW Version [0xD005] 파라미터를 Read Input Register (FC: 0x04) 명령(01 04 D0 05 00 01 F9 8E)으로 읽어 현재 버전을 기록한다.
[안전성 스트레스 주입] 모터에 Run 명령을 내려 정격 속도로 고속 회전시킨다.
모터가 회전하고 있는 상태에서, 업데이트 툴을 통해 Inverter F/W 다운로드(Start)를 강제 시도한다.
펌웨어가 이 위험한 명령을 즉각 거부(Reject)하거나, 안전하게 모터를 정지(Stop)시킨 후 다운로드 모드로 진입하는지 물리적 거동을 확인한다. (스펙에 맞게 동작해야 함)
<Phase 2. 정상 Inverter OS 다운로드 및 IPC 패스스루 갱신 검증 (Positive Dual-Core OTA Test)>

모터를 완전히 정지시킨 후, 업데이트 툴에서 정상적으로 빌드된 상위 버전의 Inverter F/W 바이너리를 선택하고 'Forced Download'를 체크한다.
Start 버튼을 눌러 다운로드를 진행한다.
[IPC 병목 관찰] PC에서 보낸 펌웨어 청크(Chunk) 데이터가 Main MCU의 RS485 버퍼를 거쳐 내부 SPI/UART로 Inverter MCU의 플래시 메모리에 기록되는 동안, 통신 지연으로 인한 툴의 Progress Bar 멈춤이나 Timeout(Disconnect) 에러가 발생하지 않고 100% 도달하는지 모니터링한다.
완료 후 전원을 OFF/ON(또는 자동 Soft-Reset) 하고 [0xD005]를 다시 읽어 신규 Inverter 버전으로 정확히 갱신되었는지 확인한다.
<Phase 3. 타겟 불일치 파일(Main F/W) 주입 및 내부 헤더 검사 예외 검증 (Negative Binary Test)>

이번에는 업데이트 툴에서 Inverter F/W가 아닌 Main F/W 파일 또는 CRC가 고의로 훼손된 깨진 파일을 선택한다.
Start 버튼을 눌러 강제 다운로드를 시도한다.
Inverter Bootloader 파서(Parser)가 전송받은 파일 헤더의 Target ID(Inverter용인지 Main용인지 구분)를 검사하여, 플래시 메모리를 지우기(Erase) 전에 즉각 NACK를 띄우고 다운로드를 거부하는지 확인한다.
실패 팝업 확인 후 [0xD005]를 다시 읽어 기존 Inverter OS가 훼손되지 않았는지 교차 대조한다.
<Phase 4. Inverter 플래싱 중 전원 단절 스트레스 및 Main-Boot 연계 자가 복구 검증 (Brick Prevention Test)>

다시 정상적인 Inverter F/W 파일을 선택하고 다운로드를 시작한다.
[극한 스트레스 주입] Progress Bar가 약 50%를 통과하며 Inverter MCU 플래시 메모리를 한창 굽고 있는 도중, 기습적으로 드라이브 주 전원을 차단(Blackout)한다.
10초 대기 후 전원을 재투입한다. (Inverter App 영역은 반쯤 지워져 정상 구동 불가 상태임)
[아키텍처 생존 핵심] Main MCU는 온전히 살아나서 RS485 통신을 개방해야 하며, 내부적으로 Inverter MCU와 통신을 시도했을 때 Inverter가 벽돌(Brick)이 되지 않고 'Bootloader 모드'로 응답하는지 확인한다.
이때 [0xD005] (Inverter SW) 읽기 시 0x0000 또는 0xFFFF를 출력하여 App 파손 상태를 알리고, [0xD004] (Inverter Boot)는 정상 출력되어야 한다.
이 상태에서 업데이트 툴을 다시 연결하고, JTAG 없이 RS485 통신선만으로 Inverter F/W 재다운로드를 수행하여 100% 정상 복구(Recovery)되는지 최종 확인한다.
판정기준 : [Phase 1 판정 - 구동 중 인터락 안전성 (안전 규격 핵심)]

모터 구동 중 다운로드 시도 시, 하드웨어 파손이나 급격한 제동 알람(OVP)이 발생하면 즉시 **불합격(Fail)**이다.
스펙에 따라 툴에 명확한 에러(예: "Motor is running. Cannot update.")를 띄우고 무시하거나, 모터를 완전히 0 RPM으로 정지시킨 뒤 안전하게 진입해야만 합격 처리한다.
[Phase 2 판정 - 정상 패스스루 업데이트]

듀얼 코어 간의 IPC 딜레이를 고려하더라도 Modbus 응답 Timeout(일반적으로 100~500ms) 규격을 준수하여 툴이 뻗지 않고 100% 완료되어야 한다.
재부팅 후 Inverter 버전 파라미터가 Exception 없이 정상적으로 신규 버전으로 응답되어야 한다.
[Phase 3 판정 - 잘못된 파일 거부 (방어 로직 핵심)]

Main OS 파일을 넣었을 때 Inverter MCU가 이를 맹목적으로 받아들여 자신의 플래시를 덮어써버리는(Overwrite) 멍청한 동작을 수행하면 절대 안 된다.
즉시 Target Mismatch를 감지하여 툴에 에러를 리포트하고, 기존 Inverter OS를 보호해야 합격이다.
[Phase 4 판정 - 다운로드 중단 시 자가 복구 (가장 중요한 듀얼 코어 신뢰성)]

Inverter 업데이트 중 전원이 날아갔다고 해서 Main MCU까지 통신 불능의 벽돌(Brick) 상태가 되면 즉시 **불합격(Fail)**이다.
전원 재투입 시 Main MCU는 정상적으로 마스터(PC)의 Modbus 명령에 응답해야 하며, 손상된 Inverter MCU를 JTAG 없이 RS485를 통해 다시 펌핑(재다운로드)할 수 있도록 통로(Pass-through) 역할을 완벽히 수행하여 100% 복구되어야 최종 합격 처리한다.