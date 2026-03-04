# EC FAN OS 통합 검증 리스트

**표준코드**: LSMS-T-R2-26-004
**적용 모델**: EC-FAN Series
**작성일**: 2026-03-04

---

## 검증서 형식

각 검증 항목은 아래 구조로 작성되어 있습니다:

| 구성 | 내용 |
|------|------|
| **시험 목적** | 해당 항목을 검증하는 이유와 목표 |
| **적용 모델** | EC-FAN ✓ |
| **시험 장비** | 필요한 장비 목록 |
| **시험 방법** | 단계별 시험 절차 및 Modbus 명령 프레임 |
| **판정기준** | 합격/불합격 판정 기준 |
| **시험결과** | 실측 결과 기록란 |
| **기타** | 주의사항 및 첨부 자료 |

---

## 1. RS485 통신 시험

| No | 항목 | 파일 |
|----|------|------|
| 1-1 | 기본 연결 동작 시험 및 Baudrate, Parity 변경 | [1-1. 기본 연결 동작 시험 및 Baudrate_Parity 변경.md](1.%20RS485/1-1.%20기본%20연결%20동작%20시험%20및%20Baudrate_Parity%20변경.md) |
| 1-2 | Broadcast 동작 시험 | [1-2. Broadcast 동작 시험.md](1.%20RS485/1-2.%20Broadcast%20동작%20시험.md) |
| 1-3 | NodeID 변경 시험 | [1-3. NodeID 변경 시험.md](1.%20RS485/1-3.%20NodeID%20변경%20시험.md) |

---

## 2. Modbus RTU 프로토콜 검증 시험

| No | 항목 | 파일 |
|----|------|------|
| 2-1 | FC(03) Read Holding Register 동작 시험 | [2-1. FC(03) 동작 시험.md](2.%20Modbus%20RTU/2-1.%20FC(03)%20동작%20시험.md) |
| 2-2 | FC(04) Read Input Register 동작 시험 | [2-2. FC(04) 동작 시험.md](2.%20Modbus%20RTU/2-2.%20FC(04)%20동작%20시험.md) |
| 2-3 | FC(06) Write Single Register 동작 시험 | [2-3. FC(06) 동작 시험.md](2.%20Modbus%20RTU/2-3.%20FC(06)%20동작%20시험.md) |
| 2-4 | FC(10) Write Multiple Registers 동작 시험 | [2-4. FC(10) 동작 시험.md](2.%20Modbus%20RTU/2-4.%20FC(10)%20동작%20시험.md) |
| 2-5 | FC(2B) MEI Transport 동작 시험 | [2-5. FC(2B) 동작 시험.md](2.%20Modbus%20RTU/2-5.%20FC(2B)%20동작%20시험.md) |

---

## 3. 기본동작 검증 시험

| No | 항목 | 파일 |
|----|------|------|
| 3-1-1 | Software Reset | [3-1-1. Software Reset.md](3.%20기본동작/3-1-1.%20Software%20Reset.md) |
| 3-1-2 | Alarm Reset | [3-1-2. Alarm Reset.md](3.%20기본동작/3-1-2.%20Alarm%20Reset.md) |
| 3-2 | 전류제한 파라미터 설정 (Max Coil Current 0xD13B) | [3-2. 전류제한 파라미터 설정.md](3.%20기본동작/3-2.%20전류제한%20파라미터%20설정.md) |
| 3-3 | 구동 방향 설정 (CW, CCW) | [3-3. 구동 방향 설정 (CW, CCW).md](3.%20기본동작/3-3.%20구동%20방향%20설정%20(CW,%20CCW).md) |
| 3-4 | EEPROM Save | [3-4. EEPROM Save.md](3.%20기본동작/3-4.%20EEPROM%20Save.md) |
| 3-5 | DCLink V 모니터링 | [3-5. DCLink V.md](3.%20기본동작/3-5.%20DCLink%20V.md) |
| 3-6 | Board 온도 모니터링 | [3-6. Board 온도.md](3.%20기본동작/3-6.%20Board%20온도.md) |
| 3-7 | IGBT 온도 모니터링 | [3-7. IGBT 온도.md](3.%20기본동작/3-7.%20IGBT%20온도.md) |
| 3-8 | 펌웨어 버전 확인 (Main / Main Boot) | [3-8. 펌웨어 버전확인 main_main boot.md](3.%20기본동작/3-8.%20펌웨어%20버전확인%20main_main%20boot.md) |
| 3-9 | 펌웨어 버전 확인 (Inverter / Inverter Boot) | [3-9. 펌웨어 버전확인 inverter_inverter boot.md](3.%20기본동작/3-9.%20펌웨어%20버전확인%20inverter_inverter%20boot.md) |
| 3-10-1 | Main OS 다운로드 | [3-10-1. main OS 다운로드.md](3.%20기본동작/3-10-1.%20main%20OS%20다운로드.md) |
| 3-10-2 | Inverter OS 다운로드 | [3-10-2. inverter OS 다운로드.md](3.%20기본동작/3-10-2.%20inverter%20OS%20다운로드.md) |
| 3-10-3 | OS 다운로드 중 분리 예외처리 | [3-10-3. OS 다운로드 중 분리 예외처리.md](3.%20기본동작/3-10-3.%20OS%20다운로드%20중%20분리%20예외처리.md) |

---

## 4. 구동동작 검증 시험

| No | 항목 | 파일 |
|----|------|------|
| 4-1-1 | Set Value Source - PWM 입력 | [4-1-1. Set Value Source - PWM 입력.md](4.%20구동동작/4-1-1.%20Set%20Value%20Source%20-%20PWM%20입력.md) |
| 4-1-2 | Set Value Source - Analog V | [4-1-2. Set Value Source - Analog V.md](4.%20구동동작/4-1-2.%20Set%20Value%20Source%20-%20Analog%20V.md) |
| 4-1-3 | Set Value Source - Analog I | [4-1-3. Set Value Source - Analog I.md](4.%20구동동작/4-1-3.%20Set%20Value%20Source%20-%20Analog%20I.md) |
| 4-1-4 | Set Value Source - RS485 | [4-1-4. Set Value Source - RS485.md](4.%20구동동작/4-1-4.%20Set%20Value%20Source%20-%20RS485.md) |
| 4-2 | FG PPR 설정 (1, 2, 4, 8) | [4-2. FG PPR 설정 (1,2,4,8).md](4.%20구동동작/4-2.%20FG%20PPR%20설정%20(1,2,4,8).md) |
| 4-3 | 구동 모드 설정 (Torque / Velocity) | [4-3. 구동 모드 설정 (Operation mode).md](4.%20구동동작/4-3.%20구동%20모드%20설정%20(Operation%20mode).md) |
| 4-4 | Set Value | [4-4. Set Value.md](4.%20구동동작/4-4.%20Set%20Value.md) |
| 4-5 | Open-loop Control 운전 시험 | [4-5. Open-loop Control.md](4.%20구동동작/4-5.%20Open-loop%20Control.md) |
| 4-6 | Closed-loop Velocity Control 운전 시험 | [4-6. Closed-loop Velocity Control.md](4.%20구동동작/4-6.%20Closed-loop%20Velocity%20Control.md) |

---

## 5. 보호동작 검증 시험

> Motor Status [0xD011] 비트맵 참조: [Motor Status 비트맵 참조.md](5.%20보호동작/Motor%20Status%20비트맵%20참조.md)

### Error (알람)

| No | Error Code | 항목 | 파일 |
|----|-----------|------|------|
| 5-1 | 0x10 | IPM Fault | [5-1. Error 0x10 IPM fault.md](5.%20보호동작/5-1.%20Error%200x10%20IPM%20fault.md) |
| 5-2 | 0x11 | IPM Over Temperature | [5-2. Error 0x11 IPM Over temperature.md](5.%20보호동작/5-2.%20Error%200x11%20IPM%20Over%20temperature.md) |
| 5-3 | 0x14 | Over Current | [5-3. Error 0x14 over current.md](5.%20보호동작/5-3.%20Error%200x14%20over%20current.md) |
| 5-4 | 0x15 | Current Offset | [5-4. Error 0x15 current offset.md](5.%20보호동작/5-4.%20Error%200x15%20current%20offset.md) |
| 5-5 | 0x17 | IPM Low Temperature ⚠️챔버 미흡 | [5-5. Error 0x17 IPM Low temperature.md](5.%20보호동작/5-5.%20Error%200x17%20IPM%20Low%20temperature.md) |
| 5-6 | 0x22 | Drive Temperature 1 | [5-6. Error 0x22 drive temperature 1.md](5.%20보호동작/5-6.%20Error%200x22%20drive%20temperature%201.md) |
| 5-7 | 0x24 | Motor Cable Open | [5-7. Error 0x24 motor cable open.md](5.%20보호동작/5-7.%20Error%200x24%20motor%20cable%20open.md) |
| 5-8 | 0x25 | Drive Temperature 2 | [5-8. Error 0x25 drive temperature 2.md](5.%20보호동작/5-8.%20Error%200x25%20drive%20temperature%202.md) |
| 5-9 | 0x2A | Motor Circuit Abnormality | [5-9. Error 0x2A motor circuit abnormality.md](5.%20보호동작/5-9.%20Error%200x2A%20motor%20circuit%20abnormality.md) |
| 5-10 | 0x36 | Sinusoidal Encoder Amplitude Too Low | [5-10. Error 0x36 Sinusoidal encoder amplitude too low.md](5.%20보호동작/5-10.%20Error%200x36%20Sinusoidal%20encoder%20amplitude%20too%20low.md) |
| 5-11 | 0x37 | Sinusoidal Encoder Amplitude Too High ⚠️가능여부 확인 | [5-11. Error 0x37 Sinusoidal encoder amplitude too high.md](5.%20보호동작/5-11.%20Error%200x37%20Sinusoidal%20encoder%20amplitude%20too%20high.md) |
| 5-14 | 0x40 | Under Voltage | [5-14. Error 0x40 under voltage.md](5.%20보호동작/5-14.%20Error%200x40%20under%20voltage.md) |
| 5-15 | 0x41 | Over Voltage | [5-15. Error 0x41 over voltage.md](5.%20보호동작/5-15.%20Error%200x41%20over%20voltage.md) |
| 5-16 | 0x42 | RST Power Fail (주 전원 결상) | [5-16. Error 0x42 rst power fail.md](5.%20보호동작/5-16.%20Error%200x42%20rst%20power%20fail.md) |
| 5-18 | 0x50 | Over Speed Limit | [5-18. Error 0x50 over speed limit.md](5.%20보호동작/5-18.%20Error%200x50%20over%20speed%20limit.md) |
| 5-19 | 0x53 | Excessive Speed Deviation | [5-19. Error 0x53 excessive speed deviation.md](5.%20보호동작/5-19.%20Error%200x53%20excessive%20speed%20deviation.md) |
| 5-20 | 0x58 | Motor Shaft is Blocked (모터 구속) | [5-20. Error 0x58 motor shaft is Blocked.md](5.%20보호동작/5-20.%20Error%200x58%20motor%20shaft%20is%20Blocked.md) |

### Warning (경고)

| No | Warning Code | 항목 | 파일 |
|----|-------------|------|------|
| 5-21 | 0x01 | DC Link Under Voltage | [5-21. Warning 0x01 DC Link under voltage.md](5.%20보호동작/5-21.%20Warning%200x01%20DC%20Link%20under%20voltage.md) |
| 5-22 | 0x02 | DC Link Over Voltage | [5-22. Warning 0x02 DC Link over voltage.md](5.%20보호동작/5-22.%20Warning%200x02%20DC%20Link%20over%20voltage.md) |
| 5-23 | 0x04 | Motor Over Temperature | [5-23. Warning 0x04 motor over temperature.md](5.%20보호동작/5-23.%20Warning%200x04%20motor%20over%20temperature.md) |
| 5-24 | 0x08 | IGBT Module Over Temperature | [5-24. Warning 0x08 IGBT Module over temperature.md](5.%20보호동작/5-24.%20Warning%200x08%20IGBT%20Module%20over%20temperature.md) |
| 5-25 | 0x10 | Drive (Control Part) Over Temperature | [5-25. Warning 0x10 Drive over temperature.md](5.%20보호동작/5-25.%20Warning%200x10%20Drive%20over%20temperature.md) |
| 5-27 | 0x40 | Torque Limit | [5-27. Warning 0x40 Torque Limit.md](5.%20보호동작/5-27.%20Warning%200x40%20Torque%20Limit.md) |

---

## 주요 공통 정보

### 기본 통신 설정
- Baudrate: 19200bps
- Data Size: 8
- Parity: Even
- Node Address: 1 (공장 출하 시 Broadcasting ID로 설정)

### 주요 Modbus 명령 참조

| 기능 | FC | 주소 | 설명 |
|------|----|----- |------|
| Motor Status 읽기 | 0x04 | 0xD011 | `01 04 D0 11 00 01 59 0F` |
| Set Point 쓰기 | 0x06 | 0xD001 | 속도/토크 지령 |
| Operating Mode 쓰기 | 0x06 | 0xD106 | 0=Velocity, 2=Open-loop |
| Running Direction 쓰기 | 0x06 | 0xD102 | 0=CCW, 1=CW |
| Fan Address 읽기 | 0x03 | 0xD100 | Node ID |
| Actual Speed 읽기 | 0x04 | 0xD02D | 실제 속도 |
| EEPROM Save | 0x06 | 0xD000 | 파라미터 저장 |
