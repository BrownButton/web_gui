# 구동 방식 설정 지원 체크리스트

EC FAN 펌웨어의 구동 방식 선택 기능(홀 센서, 센서리스)을 FanCM에서 설정하고 확인하기 위한 작업 항목과 상태를 정리합니다.

- 대상: `app.js`, `parameters.csv` (브랜치 `feature/ecfan-drive-method-setting`)
- 펌웨어 기준: ec-fan 저장소의 `merge/ecfan-600w-pfc-sensorless` 브랜치. 1.0.8 정식 배포 펌웨어에는 이 기능이 없습니다.
- 상태 구분: `진행 전`, `구현`, `실기대기`, `실기OK`

## 구현 항목

| 번호 | 항목 | 화면 위치 | 상태 |
|---|---|---|---|
| 1 | 구동 방식(`0x270C`) 설정 행 추가 | Configuration 탭 > 제품설정 (개발자 모드) | 구현 / 실기대기 |
| 2 | 모터 타입에 `0x2001` 추가, 모터 ID 목록을 한 곳으로 통합 | Configuration 탭 > 모터 정보, Device 정보, 제조 검증 | 구현 / 실기대기 |
| 3 | Device 정보에 구동 방식 표시, 센서리스와 모터 ID 불일치 경고 | Device 정보 카드 | 구현 / 실기대기 |
| 4 | 센서리스 차트 채널 `0x3B`~`0x4C` 추가 | 차트 채널 목록 (Sensorless 그룹) | 구현 / 실기대기 |
| 5 | 파라미터 목록에 `0x270C` 추가 | Parameters 탭, `parameters.csv` | 구현 / 실기대기 |

`app.js`의 문법 검사(`node --check`)는 통과했습니다. 화면 동작은 브라우저와 실기에서 확인해야 합니다.

## 설정 방법

센서리스로 구동하려면 아래 세 값을 설정한 뒤 전원을 재투입합니다. 세 값 모두 전원 재투입 후에 적용됩니다.

| 순서 | 화면 | 항목 | 값 |
|---|---|---|---|
| 1 | Configuration 탭 > 모터 정보 | 모터 타입 (`0x2000`) | Axial Motor 센서리스용 (`0x2001`) |
| 2 | Configuration 탭 > 제품설정 | 제품 전압 클래스 (`0x270A`) | 보드에 맞는 값. EC FAN-600W는 200V 단상 PFC |
| 3 | Configuration 탭 > 제품설정 | 구동 방식 (`0x270C`) | 센서리스 (I/F + 확장 역기전력) |

모터 정보와 제품설정은 개발자 모드에서만 보입니다.

## 값 정의

FanCM의 목록은 펌웨어의 정의와 같아야 합니다. 펌웨어에서 값을 추가하면 아래 함수의 목록을 함께 고칩니다.

| 오브젝트 | 값 | FanCM 목록 | 펌웨어 정의 |
|---|---|---|---|
| `0x270C` 구동 방식 | 0: 펌웨어 기본값, 1: 홀 센서, 2: 센서리스 (I/F + 확장 역기전력) | `_driveMethodOptions()` | `DRIVE_METHOD_SETTING_xxx` (`Common/ecfan_memory_map.h`) |
| `0x2000` 모터 ID | `0x1000`: Sirocco, `0x2000`: Axial, `0x2001`: Axial 센서리스용 | `_motorIdOptions()` | `motor_table` (`Common/Motor.h`) |

- 구동 방식 0은 Inverter 펌웨어에 빌드된 기본 방식(`DRIVE_METHOD_DEFAULT`)을 따릅니다. 현재 기본 방식은 홀 센서입니다.
- 센서리스는 펌웨어에 센서리스 상수가 있는 모터에서만 동작합니다. 현재는 `0x2001`뿐입니다. 다른 모터 ID로 센서리스를 고르면 펌웨어가 모터 설정 알람을 내고 홀 센서 방식으로 동작합니다.
- `_motorIdOptions()`에서 `sensorless: true`인 모터가 센서리스를 쓸 수 있는 모터입니다. Device 정보의 불일치 경고가 이 표시를 씁니다.

## 차트 채널

채널 번호는 Inverter 펌웨어 `trace.c`의 `C59`~`C76` 정의와 같습니다.

| 채널 | 이름 | 단위 |
|---|---|---|
| `0x3B` | Observer Speed | rpm |
| `0x3C` | Observer Electric Angle | count (32768 = 180°) |
| `0x3D` | Sensorless Frame Angle | count |
| `0x3E` | Observer EMF Gamma | V |
| `0x3F` | Observer EMF Delta | V |
| `0x40` | Observer Current Gamma | A |
| `0x41` | Sensorless Sequence State | 0: 정지, 1: 정렬, 2: I/F 가속, 3: I/F 유지, 4: 폐루프, 5: I/F 진입 |
| `0x42` | Handover Torque Current | % |
| `0x43` | Velocity Loop Ki Term | % |
| `0x44` | Velocity Loop Ka Term | % |
| `0x45` | Velocity Loop Integral | % |
| `0x46` | Voltage Ref. Magnitude | V |
| `0x47` | Voltage Ref. Limit | V |
| `0x48` | PWM Enable | 0 또는 1 |
| `0x49` | Id Current (A) | A |
| `0x4A` | Iq Current (A) | A |
| `0x4B` | I/F Frame Angle | count |
| `0x4C` | Sensorless Angle Offset | count |

## 실기 검증 항목

| 번호 | 항목 | 확인 내용 | 상태 |
|---|---|---|---|
| 1 | 제품설정 화면 | 구동 방식 행이 보이고, 탭에 들어가면 디바이스 값이 읽히는지 | 실기대기 |
| 2 | 구동 방식 쓰기 | 값을 바꾸면 ⭕가 표시되고, 전원 재투입 후에도 값이 유지되는지 | 실기대기 |
| 3 | 모터 타입 | 목록에 세 모터가 보이고 `0x2001`을 쓸 수 있는지 | 실기대기 |
| 4 | Device 정보 | 구동 방식이 표시되는지. 센서리스이고 모터 ID가 `0x2001`이 아니면 경고가 뜨는지 | 실기대기 |
| 5 | 이전 펌웨어 | 1.0.8 펌웨어에서 Device 정보의 구동 방식이 "읽기 실패 (FW 미지원 가능)"로 표시되고, 다른 항목은 정상인지 | 실기대기 |
| 6 | 차트 | Sensorless 그룹의 채널이 보이고, 센서리스 운전 중 값이 나오는지 | 실기대기 |
| 7 | 제조 검증 화면 | Motor ID 표시가 이전과 같고, `0x2001`의 이름이 나오는지 | 실기대기 |
