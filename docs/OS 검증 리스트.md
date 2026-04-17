OS 검증 리스트

1. RS485
    1-01. 기본 연결 동작 시험 및 Baudrate, Parity 변경
    1-02. Termination 저항 설정
    1-03. 통신 지연 기능 설정

2. Modbus RTU
    2-01. Broadcast 동작 시험
    2-02. NodeID 변경 시험
    2-03. FC(03) 동작 시험
    2-04. FC(04) 동작 시험
    2-05. FC(06) 동작 시험
    2-06. FC(10) 동작 시험
    2-07. FC(2B) 동작 시험

3. 기본동작
    3-01. Software Reset
    3-02. Alarm Reset
    3-03. 전류제한 파라미터 설정
    3-04. 구동 방향 설정 (CW, CCW)
    3-05. EEPROM Save
    3-06. DCLink V
    3-07. Board 온도
    3-08. IGBT 온도
    3-09. 드라이브 펌웨어 버전정보 확인 (main, inverter)
    3-10. 통신 인터페이스 기반 Main Firmware 다운로드 기능 검증 및 플래싱 중단(Blackout)시 Bootloader 안전 복구 통합 검증
    3-11. 통신 인터페이스 기반 Inverter Firmware 다운로드 기능 검증 및 플래싱 중단(Blackout)시 Bootloader 안전 복구 통합 검증
    3-12. 시리얼 넘버 설정
    3-13. Motor ID 변경
    3-14. 200V/400V 전환

4. 구동동작
    4-01. Set Value Source 입력 방식 설정 - PWM 입력
    4-02. Set Value Source 입력 방식 설정 - Analog V
    4-03. Set Value Source 입력 방식 설정 - Analog I
    4-04. Set Value Source 입력 방식 설정 - RS485
    4-05. FG PPR 설정 (1,2,4,8)
    4-06. 구동 모드 설정 (Operation mode : torque, velocity)
    4-07. Set Value
    4-08. Open-loop Control
    4-09. Closed-loop Velocity Control

5. 보호 동작
    5-01. Dynamic brake
    5-02. IGBT 온도에 따른 속도 Derating

6. 알람 및 경고 동작
    6-01. Alarm History
    6-02. Alarm clear
    6-03. Error 0x10 IPM fault
    6-04. Error 0x11 IPM Over temperature 
    6-05. Error 0x14 over current (프로시저에 할당해서 처리 하는 방식으로 구현 -그냥 돌려도 될수도?)
    6-06. Error 0x15 current offset (프로시저에 할당해서 처리 하는 방식으로 구현)
    6-07. Error 0x17 IPM Low temperature (챔버 환경 미흡으로 검증실험 불가)
    6-08. Error 0x22 drive temperature 1 (22, 25 둘중 인버터는 삭제하고 하나는 살리자)
    6-09. Error 0x24 motor cable open
    6-10. Error 0x25 drive temperature 2 (22, 25 둘중 인버터는 삭제하고 하나는 살리자)
    6-11. Error 0x2A motor circuit abnormality
    6-12. Error 0x36 Sinusoidal encoder amplitude is too low
    6-13. Error 0x37 Sinusoidal encoder amplitude is too high (검증실험 가능여부 확인 후, 불가시 삭제)
    6-14. Error 0x40 under voltage
    6-15. Error 0x41 over voltage
    6-16. Error 0x42 rst power fail
    6-17. Error 0x50 over speed limit
    6-18. Error 0x53 excessive speed deviation
    6-19. Error 0x58 motor shaft is Blocked
    6-20. Warning 0x01 DC Link under voltage
    6-21. Warning 0x02 DC Link over voltage
    6-22. Warning 0x04 motor over temperature
    6-23. Warning 0x08 IGBT Module over temperature
    6-24. Warning 0x10 Drive(Control part) over temperature
    6-25. Warning 0x40 Torque Limit
