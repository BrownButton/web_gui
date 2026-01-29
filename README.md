# Modbus RTU/RS-485 Dashboard

웹 브라우저에서 Modbus RTU/RS-485 통신을 테스트할 수 있는 대시보드 애플리케이션입니다.

## 기능

### Modbus 프로토콜 지원
- **읽기 기능**
  - FC01: Read Coils
  - FC02: Read Discrete Inputs
  - FC03: Read Holding Registers
  - FC04: Read Input Registers

- **쓰기 기능**
  - FC05: Write Single Coil
  - FC06: Write Single Register
  - FC15: Write Multiple Coils
  - FC16: Write Multiple Registers

### 주요 기능
- Web Serial API를 통한 실시간 시리얼 통신
- CRC-16 자동 계산 및 검증
- 실시간 데이터 시각화
- 통신 로그 모니터링 (송신/수신 프레임 HEX 표시)
- 통계 정보 (요청 수, 성공률, 에러 수)
- 다양한 시리얼 포트 설정 지원

## 시스템 요구사항

### 브라우저
이 애플리케이션은 **Web Serial API**를 사용하므로 다음 브라우저에서만 작동합니다:
- Google Chrome (89 이상)
- Microsoft Edge (89 이상)
- Opera (75 이상)

**참고**: Firefox, Safari는 Web Serial API를 지원하지 않습니다.

### 하드웨어
- USB-to-RS485 변환기 (예: CH340, FTDI, CP2102 등)
- Modbus RTU 슬레이브 장치

## 사용 방법

### 1. 파일 구조
```
html_claude/
├── index.html      # 메인 HTML 파일
├── styles.css      # 스타일시트
├── modbus.js       # Modbus RTU 프로토콜 라이브러리
├── app.js          # 애플리케이션 로직
└── README.md       # 이 파일
```

### 2. 실행 방법

#### 로컬에서 실행
1. Chrome 또는 Edge 브라우저를 엽니다.
2. `index.html` 파일을 브라우저로 드래그하거나 직접 엽니다.
3. 또는 로컬 서버를 사용:
   ```bash
   # Python이 설치되어 있다면
   python -m http.server 8000

   # Node.js의 http-server가 설치되어 있다면
   npx http-server
   ```
4. 브라우저에서 `http://localhost:8000` 접속

### 3. 연결 설정

1. **Serial Port Connection** 섹션에서 시리얼 포트 설정:
   - Baud Rate: 통신 속도 (일반적으로 9600, 19200, 115200)
   - Data Bits: 데이터 비트 (일반적으로 8)
   - Parity: 패리티 비트 (None, Even, Odd)
   - Stop Bits: 정지 비트 (1 또는 2)

2. **Connect** 버튼 클릭
   - 브라우저가 시리얼 포트 선택 창을 표시합니다
   - USB-to-RS485 변환기를 선택합니다
   - 연결되면 상태가 "Connected"로 변경됩니다

### 4. Modbus 통신 테스트

1. **Modbus Configuration** 섹션에서 설정:
   - **Slave ID**: Modbus 슬레이브 주소 (1-247)
   - **Function Code**: 실행할 Modbus 기능 선택
   - **Start Address**: 읽기/쓰기 시작 주소
   - **Quantity**: 읽기/쓰기할 레지스터 또는 코일 수
   - **Write Value**: 쓰기 작업 시 사용할 값 (쓰기 기능일 때만 표시)

2. **Send Request** 버튼 클릭하여 요청 전송

3. 결과 확인:
   - **Response Data**: 읽어온 데이터가 표시됩니다
   - **Communication Log**: 송수신된 프레임이 HEX 형식으로 표시됩니다
   - **Statistics**: 통신 통계 정보가 업데이트됩니다

## 예제 사용 시나리오

### 예제 1: Holding Register 읽기
```
Slave ID: 1
Function Code: 03 - Read Holding Registers
Start Address: 0
Quantity: 10

-> 주소 0부터 9까지 10개의 홀딩 레지스터를 읽습니다
```

### 예제 2: Single Register 쓰기
```
Slave ID: 1
Function Code: 06 - Write Single Register
Start Address: 100
Write Value: 1234

-> 주소 100에 값 1234를 씁니다
```

### 예제 3: Multiple Registers 쓰기
```
Slave ID: 1
Function Code: 16 - Write Multiple Registers
Start Address: 0
Quantity: 5
Write Value: 100

-> 주소 0부터 4까지 5개의 레지스터에 모두 100을 씁니다
```

## Communication Log 해석

로그는 다음과 같은 형식으로 표시됩니다:

```
[시간] TX: 01 03 00 00 00 0A C5 CD
```
- **TX**: 전송된 프레임
- **01**: Slave ID
- **03**: Function Code (Read Holding Registers)
- **00 00**: Start Address (0)
- **00 0A**: Quantity (10)
- **C5 CD**: CRC-16

```
[시간] RX: 01 03 14 00 00 00 01 00 02 00 03 00 04 00 05 00 06 00 07 00 08 00 09 XX XX
```
- **RX**: 수신된 프레임
- **01**: Slave ID
- **03**: Function Code
- **14**: Byte Count (20 bytes = 10 registers × 2)
- **00 00 ... 00 09**: 레지스터 값들
- **XX XX**: CRC-16

## 문제 해결

### 포트 연결 실패
- USB-to-RS485 변환기가 제대로 연결되어 있는지 확인
- 장치 관리자에서 COM 포트가 인식되는지 확인
- 다른 프로그램이 포트를 사용 중이지 않은지 확인

### 응답 없음 (No Response)
- Baud rate, parity, stop bits 설정이 슬레이브 장치와 일치하는지 확인
- Slave ID가 올바른지 확인
- RS485 A/B 배선이 올바른지 확인 (반대로 연결되었을 수 있음)
- 슬레이브 장치의 전원이 켜져 있는지 확인

### CRC 에러
- 전기적 노이즈나 배선 문제일 수 있습니다
- 케이블 길이를 줄이거나 차폐 케이블 사용
- 종단 저항(120Ω) 연결 확인

### Exception 응답
Modbus Exception 코드:
- **01**: Illegal Function - 지원하지 않는 Function Code
- **02**: Illegal Data Address - 잘못된 레지스터 주소
- **03**: Illegal Data Value - 잘못된 데이터 값
- **04**: Slave Device Failure - 슬레이브 장치 오류

## 기술 스택

- **HTML5**: 웹 페이지 구조
- **CSS3**: 반응형 디자인 및 스타일링
- **JavaScript (ES6+)**: 애플리케이션 로직
- **Web Serial API**: 시리얼 포트 통신
- **Modbus RTU Protocol**: CRC-16 계산 및 프레임 처리

## 라이선스

이 프로젝트는 교육 및 테스트 목적으로 자유롭게 사용할 수 있습니다.

## 주의사항

- 이 도구는 테스트 및 개발 목적으로 사용하세요
- 프로덕션 환경에서는 검증된 Modbus 마스터 소프트웨어를 사용하세요
- RS485 배선 시 극성(A/B)에 주의하세요
- 장비 손상을 방지하기 위해 올바른 Slave ID와 주소를 사용하세요
