OS 검증 리스트

1. RS485
    1-1. 기본 연결 동작 시험 및 Baudrate, Parity 변경
    1-2. Broadcast 동작 시험
    1-3. NodeID 변경 시험

2. Modbus RTU
    2-1. FC(03) 동작 시험
    2-2. FC(04) 동작 시험
    2-3. FC(06) 동작 시험
    2-4. FC(10) 동작 시험
    2-5. FC(2B) 동작 시험

3. 기본동작
    3-1. Reset
        3-1-1. Software Reset
        3-1-2. Alarm Reset
    3-2. 전류제한 파라미터 설정
    3-3. 구동 방향 설정 (CW, CCW)
    3-4. EEPROM Save
    3-5. DCLink V
    3-6. Board 온도
    3-7. IGBT 온도
    3-8. 펌웨어 버전확인 main/main boot
    3-9. 펌웨어 버전확인 inverter/inverter boot
    3-10. OS 다운로드
        3-10-1. main OS 다운로드
        3-10-2. inverter OS 다운로드
        3-10-3. OS 다운로드 중, 분리 예외처리

4. 구동동작
    4-1. Set Value Source 입력 방식 설정
        4-1-1. PWM 입력
        4-2-2. Analog V
        4-3-3. Analog I
        4-4-4. RS485
    4-2. FG
        3-3-1. PPR 설정 (1,2,4,8)
    4-3. 구동 모드 설정 (Operation mode : torque, velocity)
    4-4. Set Value
    4-5. Open-loop Control
    4-6. Closed-loop Velocity Control

5. 보호동작
    5-1. Error 0x10 IPM fault
    5-2. Error 0x11 IPM Over temperature 
    5-3. Error 0x14 over current (프로시저에 할당해서 처리 하는 방식으로 구현 -그냥 돌려도 될수도?)
    5-4. Error 0x15 current offset (프로시저에 할당해서 처리 하는 방식으로 구현)
    5-5. Error 0x17 IPM Low temperature (챔버 환경 미흡으로 검증실험 불가)
    5-6. Error 0x22 drive temperature 1 (22, 25 둘중 인버터는 삭제하고 하나는 살리자)
    5-7. Error 0x24 motor cable open
    5-8. Error 0x25 drive temperature 2 (22, 25 둘중 인버터는 삭제하고 하나는 살리자)
    5-9. Error 0x2A motor circuit abnormality
    5-10. Error 0x36 Sinusoidal encoder amplitude is too low
    5-11. Error 0x37 Sinusoidal encoder amplitude is too high   (검증실험 가능여부 확인 후, 불가시 삭제)
    5-14. Error 0x40 under voltage
    5-15. Error 0x41 over voltage
    5-16. Error 0x42 rst power fail
    5-18. Error 0x50 over speed limit
    5-19. Error 0x53 excessive speed deviation
    5-20. Error 0x58 motor shaft is Blocked
    5-21. Warning 0x01 DC Link under voltage
    5-22. Warning 0x02 DC Link over voltage
    5-23. Warning 0x04 motor over temperature
    5-24. Warning 0x08 IGBT Module over temperature
    5-25. Warning 0x10 Drive(Control part) over temperature
    5-27. Warning 0x40 Torque Limit
