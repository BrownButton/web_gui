# Alarm Code Reference

## Group 0 — Normal

| Code | Define | Display Name |
|------|--------|--------------|
| 0x00 | — | No error |

---

## Group 1 — Current

| Code | Define | Display Name |
|------|--------|--------------|
| 0x10 | `ERRCODE_IPM_FAULT` | IPM fault |
| 0x11 | `ERRCODE_IPM_TEMP` | IPM temperature |
| 0x12 | `ERRCODE_U_CURR` | V-phase current |
| 0x13 | `ERRCODE_V_CURR` | U-phase current |
| 0x14 | `ERRCODE_OV_CURR` | Over current |
| 0x15 | `ERRCODE_CURR_OFFSET` | Current offset |
| 0x16 | `ERRCODE_OV_CURR_CL` | Current limit exceeded |
| 0x17 | `ERRCODE_IPM_LOW_TEMP` | IPM Low temperature |

---

## Group 2 — Overload

| Code | Define | Display Name |
|------|--------|--------------|
| 0x20 | `ERRCODE_INST_OVLOAD` | Instantaneous overload |
| 0x21 | `ERRCODE_CONT_OVLOAD` | Continuous overload |
| 0x22 | `ERRCODE_DRIVE_TEMP1` | Drive temperature 1 |
| 0x23 | `ERRCODE_REG_OVLOAD` | Regeneration overload |
| 0x24 | `ERRCODE_OPEN_MTR_CABLE` | Motor cable open |
| 0x25 | `ERRCODE_DRIVE_TEMP2` | Drive temperature 2 |
| 0x26 | `ERRCODE_ENCODER_TEMP` | Encoder temperature |
| 0x27 | `ERRCODE_MOTOR_TEMP` | Motor temperature |
| 0x28 | `ERRCODE_FAN_TRIP` | Fan trip |
| 0x29 | `ERRCODE_RB_FAULT` | Regeneration brake fault |
| 0x2A | `ERRCODE_MTR_CIRCUIT` | Motor circuit failure |

---

## Group 3 — Encoder & Motor

| Code | Define | Display Name |
|------|--------|--------------|
| 0x30 | `ERRCODE_ENC_COMM` | Encoder communication |
| 0x31 | `ERRCODE_OPEN_ENC_CABLE` | Encoder cable open |
| 0x32 | `ERRCODE_ENC_DATA` | Encoder data |
| 0x33 | `ERRCODE_MTR_SETTING` | Motor setting |
| 0x34 | `ERRCODE_ZPHASE_OPEN` | Encoder Z phase open |
| 0x35 | `ERRCODE_LOW_BATT` | Encoder low battery |
| 0x36 | `ERRCODE_SIN_LOW_AMPLITUDE` | Encoder Low Amplitude |
| 0x37 | `ERRCODE_SIN_HIGH_AMPLITUDE` | Encoder High Amplitude |
| 0x38 | `ERRCODE_SIN_FREQUENCY` | Encoder Frequency |
| 0x39 | `ERRCODE_SIN_OFFSET` | Encoder Offset |
| 0x3A | `ERRCODE_SIN_PHASE` | Encoder Phase |
| 0x3B | `ERRCODE_ENC_POSITION` | Encoder position |
| 0x3C | `ERRCODE_ENC_OVERVOLTAGE` | Encoder over voltage |
| 0x3D | `ERRCODE_ENC_UNDERVOLTAGE` | Encoder under voltage |
| 0x3E | `ERRCODE_ENC_OVERCURRENT` | Encoder over current |
| 0x3F | `ERRCODE_ENC_BATTARY_FAILURE` | Encoder batt. failure |

---

## Group 4 — Voltage

| Code | Define | Display Name |
|------|--------|--------------|
| 0x40 | `ERRCODE_UD_VTG` | Under voltage |
| 0x41 | `ERRCODE_OV_VTG` | Over voltage |
| 0x42 | `ERRCODE_RST_PWR_FAIL` | Main power fail |
| 0x43 | `ERRCODE_CONT_PWR_FAIL` | Control power fail |
| 0x45 | `ERRCODE_FAST_OV_VTG` | *(Fast Detect over voltage — 표시 메시지 미정의)* |

---

## Group 5 — Control Functions

| Code | Define | Display Name |
|------|--------|--------------|
| 0x50 | `ERRCODE_OV_SPD` | Over speed limit |
| 0x51 | `ERRCODE_FOLLOWING` | POS following |
| 0x52 | `ERRCODE_ESTOP` | Emergency stop |
| 0x53 | `ERRCODE_SPD_DEVIATION` | Excessive SPD deviation |
| 0x54 | `ERRCODE_POS_DIFFERENCE` | Encoder2 POS difference |
| 0x55 | `ERRCODE_POS_TRACKING` | POS tracking |
| 0x56 | `ERRCODE_OV_POSCMD` | Over position command |
| 0x57 | `ERRCODE_OV_POUT_SPD` | Over speed pulse-out |
| 0x58 | `ERRCODE_MOTOR_BLOCKED` | Motor Blocked |
| 0x59 | `ERRCODE_MOTOR_BRAKING` | Motor Braking |

---

## Group 6 — Communication / Data

| Code | Define | Display Name |
|------|--------|--------------|
| 0x60 | `ERRCODE_USB_COMM` | USB communication |
| 0x61 | `ERRCODE_RS422` | *(reserved)* |
| 0x62 | `ERRCODE_ECAT` | *(reserved)* |
| 0x63 | `ERRCODE_PR_CHKSUM` | Parameter checksum |
| 0x64 | `ERRCODE_PR_RANGE` | Parameter range |
| 0x65 | `ERRCODE_ECAT_HW_INIT` | ECAT hardware init |
| 0x66 | `ERRCODE_ECAT_COMM1` | ECAT communication 1 |
| 0x67 | `ERRCODE_ECAT_COMM2` | ECAT communication 2 |
| 0x68 | `ERRCODE_ECAT_COMM3` | ECAT communication 3 |

---

## Group 7 — System Configuration

| Code | Define | Display Name |
|------|--------|--------------|
| 0x70 | `ERRCODE_SETUP` | Drive motor combination |
| 0x71 | `ERRCODE_FACTORY_SET` | Factory setting |
| 0x72 | `ERRCODE_GPIO_SET` | GPIO setting |
| 0x73 | `ERRCODE_INVALID_HW` | Invalid hardware |
| 0x74 | `ERRCODE_FPGA_CONFIG` | FPGA not configured |
| 0x75 | `ERRCODE_FIRMWARE_CONFIG` | Firmware not configured |
| 0x76 | `ERRCODE_USB_OVERCURRENT` | USB over current |
| 0x77 | `ERRCODE_Lost_Cmd` | Modbus TCP Lost Command |

---

## Group 8 — External Encoder (Enc2)

| Code | Define | Display Name |
|------|--------|--------------|
| 0x80 | `ERRCODE_ENC2_COMM` | Enc2 communication |
| 0x81 | `ERRCODE_ENC2_OPEN_CABLE` | Enc2 cable open |
| 0x82 | `ERRCODE_ENC2_DATA` | Enc2 data |
| 0x83 | `ERRCODE_ENC2_ZPHASE_OPEN` | Enc2 Z phase open |
| 0x84 | `ERRCODE_ENC2_MTR_SETTING` | Enc2 motor setting |
| 0x85 | `ERRCODE_ENC2_LOW_BATT` | Enc2 low battery |
| 0x86 | `ERRCODE_ENC2_SIN_AMPLITUDE` | Enc2 Sin/Cos Amplitude |
| 0x87 | `ERRCODE_ENC2_SIN_FREQUENCY` | Enc2 Sin/Cos Frequency |
| 0x88 | `ERRCODE_ENC2_SETTING` | Enc2 setting |
| 0x89 | `ERRCODE_ENC2_TEMP` | Enc2 temperature |
| 0x8A | `ERRCODE_ENC2_LIGHTSOURCE` | Enc2 light source |
| 0x8B | `ERRCODE_ENC2_POSITION` | Enc2 position |
| 0x8C | `ERRCODE_ENC2_OVERVOLTAGE` | Enc2 over voltage |
| 0x8D | `ERRCODE_ENC2_UNDERVOLTAGE` | Enc2 under voltage |
| 0x8E | `ERRCODE_ENC2_OVERCURRENT` | Enc2 over current |
| 0x8F | `ERRCODE_ENC2_BATTARY_FAILURE` | Enc2 battery failure |

---

## Warning Codes (Bit Flags)

Warning 코드는 비트 플래그로 OR 조합 가능.

| Bit (Hex) | Define | Description |
|-----------|--------|-------------|
| 0x01 | `WARNCODE_VDC_UD_VTG` | DC Link under voltage |
| 0x02 | `WARNCODE_VDC_OV_VTG` | DC Link over voltage |
| 0x04 | `WARNCODE_MOTOR_OVT` | Motor over temperature |
| 0x08 | `WARNCODE_IGBT_OVT` | IGBT Module over temperature |
| 0x10 | `WARNCODE_DRIVE_OVT` | Drive over temperature |
| 0x20 | `WARNCODE_UNDER_SPEED` | Speed deviation |
| 0x40 | `WARNCODE_TQ_LIMIT` | Torque limit |
| 0x80 | `WARNCODE_PWR_LIMIT` | Power limit |
