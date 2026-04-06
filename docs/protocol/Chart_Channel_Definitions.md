# Chart Channel Definitions

Chart 탭에서 사용되는 채널 번호(Channel ID) 정의표.

- **기본 자료형**: `float`
- **1-bit 자료형**: 채널 번호 **100 ~ 195** 범위 (디지털 입출력 / ControlWord / StatusWord)

---

## Float 채널 (C0 ~ C55)

| 채널 번호 | 상수명 | Hex | 설명 | 단위 |
|-----------|--------|-----|------|------|
| C0  | C0_VELOCITY_FEEDBACK                 | 0x00 | Velocity Feedback                  | rpm, mm/s |
| C1  | C1_VELOCITY_COMMAND                  | 0x01 | Velocity Command                   | rpm, mm/s |
| C2  | C2_VELOCITY_ERROR                    | 0x02 | Velocity Error                     | rpm, mm/s |
| C3  | C3_TORQUE_FEEDBACK                   | 0x03 | Torque Feedback                    | % |
| C4  | C4_TORQUE_COMMAND                    | 0x04 | Torque Command                     | % |
| C5  | C5_FOLLOWING_ERROR                   | 0x05 | Following Error                    | pulse |
| C6  | C6_ACCUMULATED_OPERATION_OVERLOAD    | 0x06 | Accumulated Operation Overload     | % |
| C7  | C7_DC_LINK_VOLTAGE                   | 0x07 | DC Link Voltage                    | V |
| C8  | C8_ACCUMULATED_REGENERATIVE_OVERLOAD | 0x08 | Accumulated Regenerative Overload  | % |
| C9  | C9_ENCODER_SINGLETURN                | 0x09 | Encoder SingleTurn Data            | Pulse |
| C10 | C10_INERTIA_RATIO                    | 0x0A | Inertia Ratio                      | % |
| C11 | C11_FOLLOWING_ERROR_ACTUAL_VALUE     | 0x0B | Following Error Actual Value       | UU |
| C12 | C12_DRIVE_TEMPERATURE1               | 0x0C | Drive Temperature 1                | ℃ |
| C13 | C13_DRIVE_TEMPERATURE2               | 0x0D | Drive Temperature 2                | ℃ |
| C14 | C14_ENCODER_TEMPERATURE              | 0x0E | Encoder Temperature                | ℃ |
| C15 | C15_HALL_SIGNAL_VALUE                | 0x0F | Hall Signal Value                  | — |
| C16 | C16_U_PHASE_CURRENT                  | 0x10 | U Phase Current                    | A |
| C17 | C17_V_PHASE_CURRENT                  | 0x11 | V Phase Current                    | A |
| C18 | C18_W_PHASE_CURRENT                  | 0x12 | W Phase Current                    | A |
| C19 | C19_POSITION_ACTUAL                  | 0x13 | Position Actual Value              | UU |
| C20 | C20_POSITION_DEMAND                  | 0x14 | Position Demand Value              | UU |
| C21 | C21_POSITION_COMMAND_VELOCITY        | 0x15 | Position Command Velocity          | rpm, mm/s |
| C22 | C22_HALL_U                           | 0x16 | Hall U Value                       | — |
| C23 | C23_HALL_V                           | 0x17 | Hall V Value                       | — |
| C24 | C24_HALL_W                           | 0x18 | Hall W Value                       | — |
| C25 | C25_COMMANDED_MOTOR_PHASE_ANGLE      | 0x19 | Commanded Motor Phase Angle        | — |
| C26 | C26_HALL_PHASE_ANGLE                 | 0x1A | Hall Phase Angle                   | — |
| C27 | C27_ELECTRIC_ANGLE                   | 0x1B | Electric Angle                     | — |
| C32 | C32_LEFT_SENSOR_POSITION             | 0x20 | Left Sensor Position               | — |
| C33 | C33_RIGHT_SENSOR_POSITION            | 0x21 | Right Sensor Position              | — |
| C34 | C34_LR_POSITION_DIFFERENCE           | 0x22 | L/R Position Difference            | — |
| C35 | C35_SENSOR_POSITION_INTERNAL_VALUE   | 0x23 | Sensor Position Internal Value     | — |
| C36 | C36_LEFT_SENSOR_VALID                | 0x24 | Left Sensor Valid                  | — |
| C37 | C37_LEFT_SENSOR_VALID                | 0x25 | Left Sensor Valid                  | — |
| C38 | C38_LEFT_SENSOR_SINGLETURN_DATA      | 0x26 | Left Sensor Singleturn Data        | — |
| C39 | C39_RIGHT_SENSOR_SINGLETURN_DATA     | 0x27 | Right Sensor Singleturn Data       | — |
| C40 | C40_LMS_READY                        | 0x28 | LMS READY                          | — |
| C41 | C41_RESERVED_1_LMS_STATEMACHINE      | 0x29 | Reserved 1 (LMS StateMachine)      | — |
| C42 | C42_ROS                              | 0x2A | ROS                                | — |
| C43 | C43_RESERVED_3_LEFT_SENSOR_VALID_RAW | 0x2B | Reserved 3 (Left Sensor Valid Raw) | — |
| C44 | C44_RESERVED_4_RIGHT_SENSOR_VALID_RAW| 0x2C | Reserved 4 (Right Sensor Valid Raw)| — |
| C54 | C54_FFTINPUT                         | 0x36 | FFT Input                          | — |
| C55 | C55_FFTOUTPUT                        | 0x37 | FFT Output                         | — |

---

## 1-bit 채널 — 디지털 입력 (C100 ~ C131)

> 채널 번호 100 ~ 195 전체가 1-bit 자료형

| 채널 번호 | 상수명 | Hex | 신호명 |
|-----------|--------|-----|--------|
| C100 | C100_POT    | 0x64 | POT    |
| C101 | C101_NOT    | 0x65 | NOT    |
| C102 | C102_HOME   | 0x66 | HOME   |
| C103 | C103_STOP   | 0x67 | STOP   |
| C104 | C104_PCON   | 0x68 | PCON   |
| C105 | C105_GAIN   | 0x69 | GAIN   |
| C106 | C106_P_CL   | 0x6A | P_CL   |
| C107 | C107_N_CL   | 0x6B | N_CL   |
| C108 | C108_PROBE1 | 0x6C | PROBE1 |
| C109 | C109_PROBE2 | 0x6D | PROBE2 |
| C110 | C110_EMG    | 0x6E | EMG    |
| C111 | C111_A_RST  | 0x6F | A_RST  |
| C112 | C112_SV_ON  | 0x70 | SV_ON  |
| C116 | C116_START  | 0x74 | START  |
| C117 | C117_PAUSE  | 0x75 | PAUSE  |
| C118 | C118_REGT   | 0x76 | REGT   |
| C119 | C119_HSTART | 0x77 | HSTART |
| C120 | C120_ISEL0  | 0x78 | ISEL0  |
| C121 | C121_ISEL1  | 0x79 | ISEL1  |
| C122 | C122_ISEL2  | 0x7A | ISEL2  |
| C123 | C123_ISEL3  | 0x7B | ISEL3  |
| C124 | C124_ISEL4  | 0x7C | ISEL4  |
| C125 | C125_ISEL5  | 0x7D | ISEL5  |
| C126 | C126_ABS_RQ | 0x7E | ABS_RQ |
| C127 | C127_JSTART | 0x7F | JSTART |
| C128 | C128_JDIR   | 0x80 | JDIR   |
| C129 | C129_PCLR   | 0x81 | PCLR   |
| C130 | C130_AVOR   | 0x82 | AVOR   |
| C131 | C131_INHIB  | 0x83 | INHIB  |

## 1-bit 채널 — 디지털 출력 (C132 ~ C155)

| 채널 번호 | 상수명 | Hex | 신호명 |
|-----------|--------|-----|--------|
| C132 | C132_BRAKE  | 0x84 | BRAKE  |
| C133 | C133_ALARM  | 0x85 | ALARM  |
| C134 | C134_READY  | 0x86 | READY  |
| C135 | C135_ZSPD   | 0x87 | ZSPD   |
| C136 | C136_INPOS1 | 0x88 | INPOS1 |
| C137 | C137_TLMT   | 0x89 | TLMT   |
| C138 | C138_VLMT   | 0x8A | VLMT   |
| C139 | C139_INSPD  | 0x8B | INSPD  |
| C140 | C140_WARN   | 0x8C | WARN   |
| C141 | C141_TGON   | 0x8D | TGON   |
| C142 | C142_INPOS2 | 0x8E | INPOS2 |
| C148 | C148_ORG    | 0x94 | ORG    |
| C149 | C149_EOS    | 0x95 | EOS    |
| C150 | C150_IOUT0  | 0x96 | IOUT0  |
| C151 | C151_IOUT1  | 0x97 | IOUT1  |
| C152 | C152_IOUT2  | 0x98 | IOUT2  |
| C153 | C153_IOUT3  | 0x99 | IOUT3  |
| C154 | C154_IOUT4  | 0x9A | IOUT4  |
| C155 | C155_IOUT5  | 0x9B | IOUT5  |

## 1-bit 채널 — ControlWord 비트 (C164 ~ C179)

| 채널 번호 | 상수명 | Hex | 비트 |
|-----------|--------|-----|------|
| C164 | C164_CONTROLWORD_0  | 0xA4 | ControlWord.0  |
| C165 | C165_CONTROLWORD_1  | 0xA5 | ControlWord.1  |
| C166 | C166_CONTROLWORD_2  | 0xA6 | ControlWord.2  |
| C167 | C167_CONTROLWORD_3  | 0xA7 | ControlWord.3  |
| C168 | C168_CONTROLWORD_4  | 0xA8 | ControlWord.4  |
| C169 | C169_CONTROLWORD_5  | 0xA9 | ControlWord.5  |
| C170 | C170_CONTROLWORD_6  | 0xAA | ControlWord.6  |
| C171 | C171_CONTROLWORD_7  | 0xAB | ControlWord.7  |
| C172 | C172_CONTROLWORD_8  | 0xAC | ControlWord.8  |
| C173 | C173_CONTROLWORD_9  | 0xAD | ControlWord.9  |
| C174 | C174_CONTROLWORD_10 | 0xAE | ControlWord.10 |
| C175 | C175_CONTROLWORD_11 | 0xAF | ControlWord.11 |
| C176 | C176_CONTROLWORD_12 | 0xB0 | ControlWord.12 |
| C177 | C177_CONTROLWORD_13 | 0xB1 | ControlWord.13 |
| C178 | C178_CONTROLWORD_14 | 0xB2 | ControlWord.14 |
| C179 | C179_CONTROLWORD_15 | 0xB3 | ControlWord.15 |

## 1-bit 채널 — StatusWord 비트 (C180 ~ C195)

| 채널 번호 | 상수명 | Hex | 비트 |
|-----------|--------|-----|------|
| C180 | C180_STATUSWORD_0  | 0xB4 | StatusWord.0  |
| C181 | C181_STATUSWORD_1  | 0xB5 | StatusWord.1  |
| C182 | C182_STATUSWORD_2  | 0xB6 | StatusWord.2  |
| C183 | C183_STATUSWORD_3  | 0xB7 | StatusWord.3  |
| C184 | C184_STATUSWORD_4  | 0xB8 | StatusWord.4  |
| C185 | C185_STATUSWORD_5  | 0xB9 | StatusWord.5  |
| C186 | C186_STATUSWORD_6  | 0xBA | StatusWord.6  |
| C187 | C187_STATUSWORD_7  | 0xBB | StatusWord.7  |
| C188 | C188_STATUSWORD_8  | 0xBC | StatusWord.8  |
| C189 | C189_STATUSWORD_9  | 0xBD | StatusWord.9  |
| C190 | C190_STATUSWORD_10 | 0xBE | StatusWord.10 |
| C191 | C191_STATUSWORD_11 | 0xBF | StatusWord.11 |
| C192 | C192_STATUSWORD_12 | 0xC0 | StatusWord.12 |
| C193 | C193_STATUSWORD_13 | 0xC1 | StatusWord.13 |
| C194 | C194_STATUSWORD_14 | 0xC2 | StatusWord.14 |
| C195 | C195_STATUSWORD_15 | 0xC3 | StatusWord.15 |

---

## Float 채널 — 기타 (C208, C250 ~ C253)

| 채널 번호 | 상수명 | Hex | 설명 |
|-----------|--------|-----|------|
| C208 | C208_INDEX_Z_PHASE    | 0xD0 | INDEX (Z-PHASE)  |
| C250 | C250_OBJECT_MONITOR_1 | 0xFA | Object Monitor 1 |
| C251 | C251_OBJECT_MONITOR_2 | 0xFB | Object Monitor 2 |
| C252 | C252_OBJECT_MONITOR_3 | 0xFC | Object Monitor 3 |
| C253 | C253_OBJECT_MONITOR_4 | 0xFD | Object Monitor 4 |

---

## 자료형 요약

| 범위 | 채널 번호 | 자료형 |
|------|-----------|--------|
| 아날로그 / 연산값 | C0 ~ C55 | float |
| 디지털 입력 (DI) | C100 ~ C131 | 1-bit |
| 디지털 출력 (DO) | C132 ~ C155 | 1-bit |
| ControlWord 비트 | C164 ~ C179 | 1-bit |
| StatusWord 비트  | C180 ~ C195 | 1-bit |
| 기타 모니터      | C208, C250~C253 | float |
