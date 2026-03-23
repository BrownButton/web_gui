OS 검증 리스트

1. RS485
    1-01. 기본 연결 동작 시험 및 Baudrate, Parity 변경
    1-02. Broadcast 동작 시험
    1-03. NodeID 변경 시험

2. Modbus RTU
    2-01. FC(03) 동작 시험
    2-02. FC(04) 동작 시험
    2-03. FC(06) 동작 시험
    2-04. FC(10) 동작 시험
    2-05. FC(2B) 동작 시험

3. 기본동작
    3-01. Software Reset
    3-02. Alarm Reset
    3-02. 전류제한 파라미터 설정
    3-03. 구동 방향 설정 (CW, CCW)
    3-04. EEPROM Save
    3-05. DCLink V
    3-06. Board 온도
    3-07. IGBT 온도
    3-08. 펌웨어 버전확인 main/main boot
    3-09. 펌웨어 버전확인 inverter/inverter boot
    3-10. OS 다운로드
    3-11. main OS 다운로드
    3-12. inverter OS 다운로드
    3-13. OS 다운로드 중, 분리 예외처리

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

5. 보호동작
    5-01. Error 0x10 IPM fault
    5-02. Error 0x11 IPM Over temperature 
    5-03. Error 0x14 over current (프로시저에 할당해서 처리 하는 방식으로 구현 -그냥 돌려도 될수도?)
    5-04. Error 0x15 current offset (프로시저에 할당해서 처리 하는 방식으로 구현)
    5-05. Error 0x17 IPM Low temperature (챔버 환경 미흡으로 검증실험 불가)
    5-06. Error 0x22 drive temperature 1 (22, 25 둘중 인버터는 삭제하고 하나는 살리자)
    5-07. Error 0x24 motor cable open
    5-08. Error 0x25 drive temperature 2 (22, 25 둘중 인버터는 삭제하고 하나는 살리자)
    5-09. Error 0x2A motor circuit abnormality
    5-10. Error 0x36 Sinusoidal encoder amplitude is too low
    5-11. Error 0x37 Sinusoidal encoder amplitude is too high   (검증실험 가능여부 확인 후, 불가시 삭제)
    5-12. Error 0x40 under voltage
    5-13. Error 0x41 over voltage
    5-14. Error 0x42 rst power fail
    5-15. Error 0x50 over speed limit
    5-16. Error 0x53 excessive speed deviation
    5-17. Error 0x58 motor shaft is Blocked
    5-18. Warning 0x01 DC Link under voltage
    5-19. Warning 0x02 DC Link over voltage
    5-20. Warning 0x04 motor over temperature
    5-21. Warning 0x08 IGBT Module over temperature
    5-22. Warning 0x10 Drive(Control part) over temperature
    5-23. Warning 0x40 Torque Limit
