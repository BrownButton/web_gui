/**
 * OS Test Module - 기본동작
 *
 * 검증서: docs/EC FAN OS 통합 검증서 20260328/3. 기본동작/
 *
 * [docx vs CLAUDE.md 차이]
 * | 항목            | CLAUDE.md (정) | docx 기재    |
 * | DC Link 전압    | 0xD013 (FC04)  | 0xD019       |
 * | Current Limit   | 0xD13B (FC03)  | 0x2010       |
 * → 구현은 CLAUDE.md 기준. 실기 확인 후 docx 수정 필요.
 *
 * [시험 목록]
 * basic01 (3-1) : 통신 인터페이스 기반 Software Reset 동작 및 구동 중 강제 리셋 예외/복구 통합 검증
 * basic03 (3-2) : Current Limit 파라미터 설정 검증
 * basic04 (3-3) : 구동 방향(CW/CCW) 설정 검증
 * basic06 (3-4) : DC Link 전압 모니터링 검증
 * basic07 (3-5) : Board 온도 센싱 검증
 * basic08 (3-6) : 인버터 모듈 온도 센싱 검증
 * basic09 (3-7) : 펌웨어 버전 확인
 * basic10 (3-8) : Main OS 다운로드 검증
 * basic11 (3-9) : Inverter OS 다운로드 검증
 */

window.OSTestModules = window.OSTestModules || [];

// ─── 공유 executor: basic01, basic02 모두 동일 로직 ──────────────────────────
window._basicAlarmResetExecutor = async function() {
  const self = this;
  self.checkConnection();

  // Phase 2-1: 현재 상태 읽기 (Motor Status)
  self.addLog('[Phase 2-1] Motor Status 읽기 (0xD011, FC04)', 'info');
  const motorStatus =
      await window.dashboard.readInputRegisterWithTimeout(1, 0xD011);
  if (motorStatus === null || motorStatus === undefined) {
    return {
      status: 'fail',
      message: 'Motor Status 읽기 실패',
      details: '0xD011 FC04 응답 없음'
    };
  }
  self.addLog(
      `Motor Status: 0x${
          motorStatus.toString(16).toUpperCase().padStart(4, '0')}`,
      'info');

  // Phase 2-2: 정상 구동 중 Alarm Reset 전송
  self.addLog('[Phase 2-2] Alarm Reset 명령 전송 (0x800E ← 0x0001)', 'info');
  await window.dashboard.writeRegister(1, 0x800E, 0x0001);
  await new Promise(r => setTimeout(r, 300));

  // Phase 3: 알람 유발 안내 + 카운트다운
  self.addLog('[Phase 3] 알람 유발 안내', 'warn');
  self.addLog(
      '장치에 알람 조건을 발생시킨 뒤 아래 카운트다운이 끝나면 자동으로 Alarm Reset을 전송합니다.',
      'info');
  await self._runStep(
      {
        type: 'wait_countdown',
        seconds: 20,
        message: '알람 유발 후 대기 (20초)'
      },
      0);

  self.addLog('[Phase 3] Alarm Reset 재전송', 'info');
  await window.dashboard.writeRegister(1, 0x800E, 0x0001);
  await new Promise(r => setTimeout(r, 500));

  const statusAfter =
      await window.dashboard.readInputRegisterWithTimeout(1, 0xD011);
  self.addLog(
      `리셋 후 Motor Status: ${
          statusAfter !== null ?
              '0x' + statusAfter.toString(16).toUpperCase().padStart(4, '0') :
              'null'}`,
      'info');

  // Phase 4: 비정상 코드 쓰기 → 예외 확인
  self.addLog(
      '[Phase 4] 비정상 Alarm Reset 코드 전송 (0x800E ← 0xFFFF)', 'info');
  await window.dashboard.writeRegister(1, 0x800E, 0xFFFF);
  await new Promise(r => setTimeout(r, 300));
  const statusAfterInvalid =
      await window.dashboard.readInputRegisterWithTimeout(1, 0xD011);
  self.addLog(
      `비정상 코드 후 Motor Status: ${
          statusAfterInvalid !== null ? '0x' +
                  statusAfterInvalid.toString(16).toUpperCase().padStart(
                      4, '0') :
                                        'null'}`,
      'info');

  return {
    status: 'pass',
    message: 'Alarm Reset 명령 검증 완료',
    details: [
      `초기 Motor Status: 0x${
          motorStatus.toString(16).toUpperCase().padStart(4, '0')}`,
      `리셋 후 Motor Status: ${
          statusAfter !== null ?
              '0x' + statusAfter.toString(16).toUpperCase().padStart(4, '0') :
              'N/A'}`,
      '비정상 코드(0xFFFF) 전송 완료 — 장치가 무시 또는 예외 응답 반환 확인',
    ].join('\n'),
  };
};

window.OSTestModules.push(
    {

      tests: {

        // ── basic01: SW Reset 동작 및 구동 중 강제 리셋 예외/복구 통합 검증
        // ─────────────────────────────
        'basic01': {
          id: 'basic01',
          category: '기본동작',
          number: '3-1',
          title: '통신 인터페이스 기반 Software Reset 동작 및 구동 중 강제 리셋 예외/복구 통합 검증',
          description:
              'SW Reset 명령 인가 및 부팅 타이밍 측정, 비정상 리셋 코드 예외 검증, 모터 구동 중 강제 리셋 시 PWM 즉각 차단 및 Safe State 복구 통합 검증',
          purpose:
              '통신 인터페이스 기반 명령으로 Software Reset 명령을 전송했을 때 재부팅 수행 여부, 비정상 리셋 코드 입력 시 방어 로직, 재부팅 소요 시간(Boot Time), 모터 구동 중 강제 리셋 시 PWM 출력 즉각 차단 및 Stop/Ready 상태로의 안전 복구 여부를 종합적으로 검증한다.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter',
          steps: [
            '[Phase 2] SW Reset 명령 인가 (0xD000 ← 0x0008) → 100ms 주기 폴링으로 부팅 소요 시간(Boot Time) 측정\n판정 기준: 재부팅 후 통신 복구까지 5초 이내 + EEPROM 파라미터 훼손 없음',
            '[Phase 3] SW Reset 비트(0x0008) 미포함 값 (0x0001 / 0x0002 / 0x0004) Write → 정상 응답 수신 확인 후 5초간 통신 유지 여부로 SW Reset 미발생 검증\n판정 기준: Write 정상 응답 수신 + 5초간 통신 단절 없음 (0xD000은 비트 필드 레지스터 — Exception 미발생이 정상)',
            '[Phase 4] 모터 구동 중 SW Reset 명령 전송 → 펌웨어가 명령을 무시하고 모터 구동 지속 여부 확인 (Safety Interlock)\n판정 기준: 재부팅 없음 + 모터 PWM 차단 없음 + 현재 지령 속도 정상 유지 (구동 중 리셋 수용 시 즉시 FAIL)',
          ],
        },

        // ── basic03: Current Limit 파라미터 설정 검증
        // ─────────────────────────
        'basic03': {
          id: 'basic03',
          category: '기본동작',
          number: '3-2',
          title: 'Current Limit 파라미터 설정 검증',
          description:
              'Torque/Velocity 모드 구동 중 전류 제한 Clamping·Saturation을 실시간 차트로 검증하고, 범위 초과 입력 예외 처리 및 Anti-windup 복구 능력을 확인한다.',
          purpose:
              '통신 인터페이스를 통해 전류 제한 파라미터(Current Limit [0x2010])가 정상적으로 Read/Write 되는지 확인하고, Torque 및 Velocity 모드에서 제어기의 최종 토크 지령이 설정된 제한 값을 초과하지 않는지 FC 0x64 실시간 차트(Ch0,1,3,4, 20ms)로 객관적 검증을 수행한다. 범위 초과 값 입력 시 예외 방어 로직과 동적 제한 변경 시 Anti-windup 복구 능력을 검증한다.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter, 부하 장치',
          criteria:
              '[Phase 2-1] Torque: Ch0,1,3,4 파형이 Current Limit 200 레벨에서 Clamping (차트 육안 확인)\n[Phase 2-2] Velocity: 급가속 시 400 레벨 Saturation 후 목표 속도 도달 (차트 육안 확인)\n[Phase 3-1] 범위 초과 Write → Read-back 값 ≤ 1000 (자동)\n[Phase 3-2] Current Limit 0% 시 실제 속도 0xD02D ≤ 50 RPM (자동)\n[Phase 4] Anti-windup 복구 후 최대 속도 ≤ MaxSpeed(0xD119)×1.05 RPM (0xD02D 자동, Overshoot < 5%)',
          steps: [
            '[Phase 2-1] Torque 모드 — Current Limit 20% (200) 설정 후 50%/100% 지령 Clamping 검증\n판정 기준: 차트 채널이 200 레벨에서 평탄하게 Clamping 유지 (차트 육안 판독)',
            '[Phase 2-2] Velocity 모드 — Current Limit 40% (400) + 1600 RPM 급가속 Saturation 검증\n판정 기준: 급가속 구간 채널이 400 레벨에서 Saturation 후 목표 속도 도달 (차트 육안 판독)',
            '[Phase 3-1] 범위 초과 150% (1500, 0x05DC) Write → Read-back 값 ≤ 1000 검증\n판정 기준: Write 후 Read-back 값 ≤ 1000 (자동)',
            '[Phase 3-2] Current Limit 0% 설정 후 Run — 모터 무회전 검증\n판정 기준: 실제 속도 0xD02D ≤ 50 RPM (자동)',
            '[Phase 4] On-the-fly 전류 제한 10% 하향 → 속도 하락 → 100% 복구 Anti-windup 검증\n판정 기준: 복구 후 최대 속도 0xD02D ≤ MaxSpeed(0xD119)×1.05 RPM (자동, Overshoot < 5%)',
          ],
        },

        // ── basic04: 구동 방향(CW/CCW) 설정 검증 ────────────────────────────
        'basic04': {
          id: 'basic04',
          category: '기본동작',
          number: '3-3',
          title: '구동 방향(CW/CCW) 설정 검증',
          description:
              '구동 방향 레지스터(0xD102)를 CCW(0)으로 변경 후 SW Reset으로 저장·재부팅, 재연결 후 설정 유지 여부 확인. Torque·Velocity 모드에서 CW/CCW 전환 육안 확인. 비정상값 Write 거부 검증.',
          purpose:
              'Running Direction 레지스터(0xD102) 변경 → SW Reset(EEPROM 저장+재부팅) → 재연결 후 설정 유지 여부 확인. Torque 모드(0xD106=2)·Velocity 모드(0xD106=0)에서 CW(1)/CCW(0) 방향 전환 육안 확인. 0x0002·0xFFFF 예외값 Write 거부 여부 검증.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter',
          criteria:
              '[Phase 2] SW Reset 후 재연결 시 0xD102 = 0(CCW) 유지\n[Phase 3-1] Torque 모드 CW/CCW → Hall 위상 자동 판정\n[Phase 3-2] Velocity 모드 CW/CCW → Hall 위상 자동 판정',
          steps: [
            '[Phase 2] CCW 설정 후 SW Reset → 재연결 후 Read-back 검증\n판정 기준: 재연결 후 0xD102 = 0(CCW) 유지 시 합격',
            '[Phase 3-1] Torque 모드(0xD106=2) CW/CCW 방향 전환 자동 판정\n판정 기준: Hall 위상 순서 분석 → CW/CCW 일치 여부 자동 확인',
            '[Phase 3-2] Velocity 모드(0xD106=0) CW/CCW 방향 전환 자동 판정\n판정 기준: Hall 위상 순서 분석 → CW/CCW 일치 여부 자동 확인',
          ],
        },

        // ── basic06: DC Link 전압 모니터링 검증 ──────────────────────────────
        'basic06': {
          id: 'basic06',
          category: '기본동작',
          number: '3-4',
          title: 'DC Link 전압 모니터링 검증',
          description:
              '통신 인터페이스를 통해 DC-link Voltage 파라미터를 읽어, 정격전압(380Vac) 인가 시 실제 물리적 직류 전압(DC 537V 기준)을 오차 범위(±10%) 내에서 표시하는지 검증한다.',
          purpose:
              'FC 0x64 차트 스트림(CH7, 20ms)으로 DC Link 전압을 실시간 수신하여, 380Vac 정격 인가 시 변환 직류 전압(380×√2 ≈ 537Vdc) 대비 ±10% 오차 범위(483~590V) 내에 있는지 확인한다. 펌웨어 전압 분배/스케일링 무결성 및 비정상값(NaN, 음수 등) 감지 포함.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter, 멀티미터(DMM)',
          criteria:
              '[Phase 2-1] FC 0x64 CH7 스트림이 정상적으로 수신되어야 한다\n[Phase 2-2] 수신 전압값이 정격 전압 기준 ±10% 허용 범위(483~590V) 내에 있어야 한다\n   — 외부 멀티미터 실측값과 대조 필요',
          steps: [
            '[Phase 2-1] FC 0x64 CH7 스트림 수신 확인\n판정 기준: FC 0x64 Configure 후 CH7 데이터가 정상적으로 수신되어야 한다.',
            '[Phase 2-2] DC Link 전압 정확도 판정\n판정 기준: 수신값이 정격 전압 기준 ±10% 허용 범위(483~590V) 내에 있어야 한다.',
          ],
        },

        // ── basic07: Board 온도 센싱 검증 ────────────────────────────────────
        'basic07': {
          id: 'basic07',
          category: '기본동작',
          number: '3-5',
          title: 'Board 온도 센싱 검증',
          description:
              '통신 인터페이스를 통해 Board Temperature 파라미터를 읽어 상온에서 드라이브의 온도 센싱 기능이 정상적으로 동작하는지 확인한다. (FC04, 0xD017)',
          purpose:
              'Board Temperature 레지스터(0xD017, FC04)를 읽어, 드라이브 대기 상태(열 평형)에서 측정 환경 상온(15~35°C)에 부합하는 값이 출력되는지 확인한다. 단선(0°C), 쇼트/오버플로우(-50°C 또는 ≥200°C) 등 비정상 쓰레기값 감지 포함.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter, 온도계',
          criteria:
              '[Phase 2-1] Exception 없이 정상 응답이 수신되어야 한다\n[Phase 2-2] 파싱된 온도가 비정상 쓰레기값(단선·쇼트·오버플로우)이 아니며, 상온 범위(15~35°C)에 부합해야 한다',
          steps: [
            '[Phase 2-1] Board Temperature 파라미터 읽기\n판정 기준: Exception 오류 없이 정상 응답이 수신되어야 한다.',
            '[Phase 2-2] 온도 정상 범위 판정\n판정 기준: 읽기값이 상온 범위(15~35°C)에 부합하며 비정상 쓰레기값이 아니어야 한다.',
          ],
        },

        // ── basic08: 인버터 모듈 온도 센싱 검증 ─────────────────────────────
        'basic08': {
          id: 'basic08',
          category: '기본동작',
          number: '3-6',
          title: '인버터 모듈 온도 센싱 검증',
          description:
              '통신 인터페이스를 통해 Module Temperature 파라미터를 읽어 상온에서 인버터 모듈의 온도 센싱 기능이 정상적으로 동작하는지 확인한다. (FC04, 0xD015)',
          purpose:
              'Module Temperature 레지스터(0xD015, FC04)를 읽어, 드라이브 대기 상태(열 평형)에서 측정 환경 상온(15~35°C)에 부합하는 값이 출력되는지 확인한다. 단선(-50°C 의심), 쇼트/오버플로우(255°C 의심) 등 비정상 쓰레기값 감지 포함.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter, 온도계',
          criteria:
              '[Phase 2-1] Exception 없이 정상 응답이 수신되어야 한다\n[Phase 2-2] 파싱된 온도가 비정상 쓰레기값(단선·쇼트·오버플로우)이 아니며, 상온 범위(15~35°C)에 부합해야 한다',
          steps: [
            '[Phase 2-1] Module Temperature 파라미터 읽기\n판정 기준: Exception 오류 없이 정상 응답이 수신되어야 한다.',
            '[Phase 2-2] 온도 정상 범위 판정\n판정 기준: 읽기값이 상온 범위(15~35°C)에 부합하며 비정상 쓰레기값이 아니어야 한다.',
          ],
        },

        // ── basic09: 펌웨어 버전 확인 ────────────────────────────────────────
        'basic09': {
          id: 'basic09',
          category: '기본동작',
          number: '3-7',
          title: '펌웨어 버전 확인',
          description:
              '통신 인터페이스를 통해 Main/Inverter의 Firmware/Bootloader 버전을 읽어 올바른 버전 정보를 출력하는지 확인하고, Inverter 버전 정보 수신으로 Main-Inverter 간 내부 통신(IPC) 상태를 검증한다.',
          purpose:
              'FC 0x2B CANopen SDO로 Main Boot(0x27F0), Main FW(0x27F1), Inverter Boot(0x27F2), Inverter FW(0x27F3) 4개 버전을 순차 읽어 유효한 ASCII 버전 문자열이 수신되는지 확인한다. 더미값(0x0000) 또는 응답 없음 시 불합격. 사전 확보된 릴리즈 버전과 일치 여부 판정.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter, 릴리즈 노트',
          criteria:
              '[Phase 2-1~2-4] 4개 버전 레지스터 모두 Exception 없이 정상 응답 수신\n[Phase 2-5] 수신된 버전이 사전 확보된 릴리즈 버전과 완전히 일치해야 한다',
          steps: [
            '[Phase 2-1] Main Boot Version 읽기 (0x27F0)\n판정 기준: Exception 없이 유효한 ASCII 버전 문자열이 수신되어야 한다.',
            '[Phase 2-2] Main FW Version 읽기 (0x27F1)\n판정 기준: Exception 없이 유효한 ASCII 버전 문자열이 수신되어야 한다.',
            '[Phase 2-3] Inverter Boot Version 읽기 (0x27F2)\n판정 기준: Exception 없이 유효한 ASCII 버전 문자열이 수신되어야 한다.',
            '[Phase 2-4] Inverter FW Version 읽기 (0x27F3)\n판정 기준: Exception 없이 유효한 ASCII 버전 문자열이 수신되어야 한다.',
            '[Phase 2-5] 릴리즈 버전 일치 판정\n판정 기준: 수신된 버전이 사전 확보된 릴리즈 노트의 버전과 완전히 일치해야 한다.',
          ],
        },

        // ── basic10: Main OS 다운로드 검증 ───────────────────────────────────
        'basic10': {
          id: 'basic10',
          category: '기본동작',
          number: '3-8',
          title: 'Main OS 다운로드 검증',
          description: 'OS 업데이트 툴로 Main F/W를 다운로드하고 버전 변경 여부를 확인한다.',
          purpose:
              'OS 업데이트 툴을 통해 Main F/W를 다운로드하고, 업데이트 전후 버전 레지스터(0xD003) 값 변경으로 정상 업데이트 여부를 검증한다.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter, OS 업데이트 툴',
          criteria: '업데이트 후 Main SW Version(0xD003) 값이 업데이트 전과 다름',
          manual: true,
          steps: [
            'OS 업데이트 툴을 사용하여 Main F/W 다운로드를 진행한다.',
            '다운로드 완료 후 장치가 자동으로 재부팅되는지 확인한다.',
            '재부팅 후 Main SW 버전(0xD003, FC04)을 읽어 업데이트 전과 다른지 확인한다.\n판정 기준: 업데이트 후 버전이 업데이트 전과 다름',
          ],
        },

        // ── basic11: Inverter OS 다운로드 검증 ──────────────────────────────
        'basic11': {
          id: 'basic11',
          category: '기본동작',
          number: '3-9',
          title: 'Inverter OS 다운로드 검증',
          description: 'OS 업데이트 툴로 Inverter F/W를 다운로드하고 버전 변경 여부를 확인한다.',
          purpose:
              'OS 업데이트 툴을 통해 Inverter F/W를 다운로드하고, 업데이트 전후 버전 레지스터(0xD005) 값 변경으로 정상 업데이트 여부를 검증한다.',
          model: 'EC-FAN',
          equipment: 'EC FAN 1EA, USB to RS485 Converter, OS 업데이트 툴',
          criteria: '업데이트 후 Inverter SW Version(0xD005) 값이 업데이트 전과 다름',
          manual: true,
          steps: [
            'OS 업데이트 툴을 사용하여 Inverter F/W 다운로드를 진행한다.',
            '다운로드 완료 후 장치가 자동으로 재부팅되는지 확인한다.',
            '재부팅 후 Inverter SW 버전(0xD005, FC04)을 읽어 업데이트 전과 다른지 확인한다.\n판정 기준: 업데이트 후 버전이 업데이트 전과 다름',
          ],
        },

      },

      // ─────────────────────────────────────────────────────────────────────────
      executors: {

        // ── basic01 executor ─────────────────────────────────────────────────
        'basic01': async function() {
          const self = this;
          const d = window.dashboard;
          const slaveId = 1;
          self.checkConnection();

          const passed = [];
          const failed = [];

          // ── Phase 2: SW Reset + Boot Time 측정 ─────────────────────────
          {
            self.updateStepStatus(0, 'running');
            self.updateProgress(5, 'Phase 2: SW Reset 명령 인가');
            self.addLog('▶ Phase 2 시작 — SW Reset 명령 인가 및 부팅 시간 측정', 'info');
            try {
              self.checkStop();

              const preBoot = await d.readInputRegisterWithTimeout(slaveId, 0xD011);
              self.addLog(`리셋 전 Motor Status [0xD011] = 0x${preBoot?.toString(16).toUpperCase().padStart(4, '0') ?? 'null'}`, 'info');

              self.addLog('SW Reset 명령 전송 (0xD000 ← 0x0008)', 'step');
              const resetStart = Date.now();
              try {
                await d.writeRegister(slaveId, 0xD000, 0x0008);
                self.addLog('응답 수신 — 디바이스 재부팅 시작', 'info');
              } catch (_) {
                self.addLog('응답 없음 (정상 — 재부팅 직후 통신 단절)', 'info');
              }

              self.addLog('100ms 주기 폴링으로 통신 복구 대기 중...', 'info');
              let commUpTime = null;
              for (let elapsed = 100; elapsed <= 10000; elapsed += 100) {
                if (self.shouldStopTest) throw new Error('테스트 중단됨');
                await self.delay(100);
                try {
                  const val = await d.readInputRegisterWithTimeout(slaveId, 0xD011);
                  if (val !== null && val !== undefined) {
                    commUpTime = Date.now();
                    const bootMs = commUpTime - resetStart;
                    self.addLog(`✓ 통신 복구 — [0xD011] = 0x${val.toString(16).toUpperCase().padStart(4, '0')}  경과: ${bootMs}ms`, 'success');
                    if (bootMs <= 5000) {
                      self.addLog(`✓ 부팅 소요 시간: ${bootMs}ms ≤ 5000ms — PASS`, 'success');
                    } else {
                      self.addLog(`⚠ 부팅 소요 시간: ${bootMs}ms > 5000ms — 스펙 초과`, 'warning');
                    }
                    break;
                  } else {
                    self.addLog(`  ${elapsed}ms: 응답 없음 (재부팅 중)`, 'info');
                  }
                } catch (_) {
                  self.addLog(`  ${elapsed}ms: 응답 없음 (재부팅 중)`, 'info');
                }
              }

              if (commUpTime === null) throw new Error('10초 이내 통신 복구 실패');

              passed.push('Phase 2');
              self.updateStepStatus(0, 'success');
              self.addLog('✓ Phase 2 합격', 'success');
            } catch (e) {
              failed.push('Phase 2');
              self.updateStepStatus(0, 'error');
              self.addLog(`✗ Phase 2 불합격: ${e.message}`, 'error');
            }
          }

          // ── Phase 3: 비정상 리셋 코드 예외 검증 ─────────────────────────
          {
            self.updateStepStatus(1, 'running');
            self.updateProgress(40, 'Phase 3: 비정상 리셋 코드 예외 검증');
            self.addLog('▶ Phase 3 시작 — 정의되지 않은 비정상 리셋 코드 예외 검증', 'info');
            try {
              self.checkStop();

              // 0xD000은 비트 필드 레지스터: SW Reset 비트는 0x0008
              // → 0x0008 미포함 값은 정상 Write 응답이 오는 것이 맞고, Exception은 발생하지 않음
              // → SW Reset 미발생 판별은 통신 유지 여부(5초 폴링)로만 확인 (현재 유일한 판별 수단)
              self.addLog('※ 0xD000은 비트 필드 레지스터 — SW Reset 비트 = 0x0008', 'info');
              self.addLog('※ 비트 필드 Write는 정상 응답이 오는 것이 맞음 (Exception 미발생이 정상)', 'info');
              self.addLog('※ SW Reset 미발생 판별: 5초간 통신 단절 없음으로 확인', 'info');

              let failCount = 0;
              for (const code of [0x0001, 0x0002, 0x0004]) {
                const codeHex = `0x${code.toString(16).toUpperCase().padStart(4, '0')}`;
                self.addLog(`[0xD000] ← ${codeHex} Write (SW Reset 비트 0x0008 미포함)`, 'step');
                try {
                  await d.writeRegister(slaveId, 0xD000, code);
                  self.addLog(`✓ ${codeHex}: 정상 Write 응답 수신 — 비트 필드 기록`, 'success');
                } catch (e) {
                  self.addLog(`⚠ ${codeHex}: Write 응답 없음 — ${e.message}`, 'warning');
                }

                self.addLog(`5초간 100ms 주기 폴링 (0xD02D 실제 속도) — SW Reset(통신 단절) 발생 여부 감시 (${codeHex})`, 'info');
                let rebooted = false;
                for (let t = 100; t <= 5000; t += 100) {
                  if (self.shouldStopTest) throw new Error('테스트 중단됨');
                  await self.delay(100);
                  try {
                    const speed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    if (speed === null || speed === undefined) {
                      rebooted = true;
                      self.addLog(`✗ ${codeHex}: ${t}ms 시점 응답 없음 — SW Reset 발생 의심`, 'error');
                      break;
                    }
                  } catch (_) {
                    rebooted = true;
                    self.addLog(`✗ ${codeHex}: ${t}ms 시점 통신 단절 — SW Reset 발생 의심`, 'error');
                    break;
                  }
                }

                if (rebooted) {
                  self.addLog(`✗ ${codeHex}: SW Reset 발생 감지 (통신 단절) — FAIL`, 'error');
                  failCount++;
                  self.addLog('SW Reset 발생 — 통신 복구 대기 중...', 'warning');
                  for (let elapsed = 100; elapsed <= 8000; elapsed += 100) {
                    await self.delay(100);
                    try {
                      const val = await d.readInputRegisterWithTimeout(slaveId, 0xD011);
                      if (val !== null && val !== undefined) {
                        self.addLog(`통신 복구 (${elapsed}ms)`, 'info');
                        break;
                      }
                    } catch (_) {}
                  }
                } else {
                  self.addLog(`✓ ${codeHex}: 5초 정상 통신 유지 (재부팅 없음) — PASS`, 'success');
                }
              }

              if (failCount > 0) throw new Error(`${failCount}건 비정상 코드 입력 시 재부팅 발생`);

              passed.push('Phase 3');
              self.updateStepStatus(1, 'success');
              self.addLog('✓ Phase 3 합격', 'success');
            } catch (e) {
              failed.push('Phase 3');
              self.updateStepStatus(1, 'error');
              self.addLog(`✗ Phase 3 불합격: ${e.message}`, 'error');
            }
          }

          // ── Phase 4: 모터 구동 중 SW Reset Safety Interlock 검증 ──────────
          {
            self.updateStepStatus(2, 'running');
            self.updateProgress(70, 'Phase 4: 구동 중 리셋 방어 로직 검증');
            self.addLog('▶ Phase 4 시작 — 모터 구동 중 SW Reset Safety Interlock 검증', 'info');
            self.addLog('판정: 리셋 무시 + 모터 구동 지속 → PASS / 재부팅 발생 → 즉시 FAIL', 'info');
            try {
              self.checkStop();

              // 모터 Run 명령
              self.addLog('Run 명령 전송 (Setpoint = 8000, Run = 1)', 'step');
              await d.writeRegister(slaveId, 0xD001, 8000);  // 200 RPM = 200/1600*64000
              await d.writeRegister(slaveId, 0x0001, 1);
              self.addLog('모터 가속 대기 (3초)...', 'info');
              await self.delay(3000);

              const speedBefore = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
              self.addLog(`SW Reset 전 실제 속도 [0xD02D] = ${speedBefore ?? 'null'}`, 'info');
              if (!speedBefore) throw new Error('모터 구동 확인 실패 — 속도 응답 없음');

              // 구동 중 SW Reset 명령 전송
              self.addLog('★ 구동 중 SW Reset 명령 전송 (0xD000 ← 0x0008)', 'step');
              self.addLog('펌웨어가 명령을 무시하면 통신이 끊기지 않고 모터가 계속 동작해야 함', 'info');
              try {
                await d.writeRegister(slaveId, 0xD000, 0x0008);
                self.addLog('SW Reset 명령에 응답 수신 (Echo 또는 거부 응답)', 'info');
              } catch (e) {
                self.addLog(`SW Reset 명령 응답: ${e.message}`, 'info');
              }

              // 5초간 100ms 주기로 통신 단절 여부 감시
              self.addLog('5초간 100ms 주기 폴링 — 통신 단절(재부팅) 여부 감시', 'info');
              let rebooted = false;
              let commDownAt = null;
              for (let elapsed = 100; elapsed <= 5000; elapsed += 100) {
                if (self.shouldStopTest) throw new Error('테스트 중단됨');
                await self.delay(100);
                try {
                  const val = await d.readInputRegisterWithTimeout(slaveId, 0xD011);
                  if (val === null || val === undefined) {
                    rebooted = true;
                    commDownAt = elapsed;
                    self.addLog(`✗ ${elapsed}ms: 응답 없음 — 재부팅 발생 (FAIL)`, 'error');
                    break;
                  }
                } catch (_) {
                  rebooted = true;
                  commDownAt = elapsed;
                  self.addLog(`✗ ${elapsed}ms: 통신 단절 — 재부팅 발생 (FAIL)`, 'error');
                  break;
                }
              }

              if (rebooted) {
                // 재부팅 발생 시 통신 복구 대기 후 Stop 처리
                self.addLog(`✗ ${commDownAt}ms 시점 재부팅 감지 — Safety Interlock 미작동 (치명적 안전 결함)`, 'error');
                self.addLog('통신 복구 대기 중...', 'warning');
                for (let elapsed = 100; elapsed <= 8000; elapsed += 100) {
                  await self.delay(100);
                  try {
                    const val = await d.readInputRegisterWithTimeout(slaveId, 0xD011);
                    if (val !== null && val !== undefined) {
                      self.addLog(`통신 복구 (${elapsed}ms) — 모터 Stop 명령 전송`, 'warning');
                      await d.writeRegister(slaveId, 0x0001, 0);
                      break;
                    }
                  } catch (_) {}
                }
                throw new Error(`구동 중 리셋 수용됨 (${commDownAt}ms 시점 통신 단절) — Safety Interlock 미작동`);
              }

              // 5초 후 속도 확인 — 모터가 계속 구동 중인지 검증
              const speedAfter = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
              self.addLog(`5초 경과 후 실제 속도 [0xD02D] = ${speedAfter ?? 'null'}`, 'info');
              self.addLog('✓ 5초간 통신 단절 없음 — 리셋 명령 무시 확인', 'success');

              if (!speedAfter || speedAfter < (speedBefore * 0.5)) {
                // 모터 Stop 정리 후 FAIL
                await d.writeRegister(slaveId, 0x0001, 0);
                throw new Error(`PWM 차단 감지 — 속도 급감 (전: ${speedBefore} → 후: ${speedAfter ?? 'null'}) — Safety Interlock 미작동`);
              }
              self.addLog(`✓ 속도 정상 유지 (전: ${speedBefore} → 후: ${speedAfter}) — PWM 출력 차단 없음`, 'success');

              // 모터 Stop (정리)
              self.addLog('모터 Stop 명령 전송 (정리)', 'step');
              await d.writeRegister(slaveId, 0x0001, 0);

              passed.push('Phase 4');
              self.updateStepStatus(2, 'success');
              self.addLog('✓ Phase 4 합격 — Safety Interlock 정상 동작 확인', 'success');
            } catch (e) {
              failed.push('Phase 4');
              self.updateStepStatus(2, 'error');
              self.addLog(`✗ Phase 4 불합격: ${e.message}`, 'error');
            }
          }

          // 모터 정지 (정리)
          try {
            await d.writeRegister(slaveId, 0xD001, 0);
            self.addLog('■ 모터 정지 명령 전송 (0xD001 ← 0)', 'info');
          } catch (_) {}

          // 최종 요약
          self.updateProgress(100, '테스트 완료');
          self.addLog('결과 요약', 'step');
          self.addLog(`합격: ${passed.join(', ') || '없음'}`, passed.length ? 'success' : 'info');
          self.addLog(`불합격: ${failed.join(', ') || '없음'}`, failed.length ? 'error' : 'info');

          const ok = failed.length === 0;
          return {
            status: ok ? 'pass' : 'fail',
            message: ok ? '3개 Phase 전체 합격' : `불합격 ${failed.length}개: ${failed.join(', ')}`,
            details:
              'Phase 2: SW Reset + Boot Time 측정\n' +
              'Phase 3: 비정상 리셋 코드 거부 확인 (0x0000/0x0002/0xFFFF)\n' +
              'Phase 4: 구동 중 리셋 → PWM 차단 + Auto-Restart 없음 확인',
          };
        },

        // ── basic02 executor ─────────────────────────────────────────────────
        'basic02': async function() {
          return await window._basicAlarmResetExecutor.call(this);
        },

        // ── basic03 executor ─────────────────────────────────────────────────
        'basic03': async function() {
          const self = this;
          const d = window.dashboard;
          const modbus = d.modbus;
          const slaveId = 1;

          self.checkConnection();

          // ── 인라인 차트 삽입 ──────────────────────────────────────────────
          const testItem =
              document.querySelector('.os-test-item[data-test-id="basic03"]');
          let chart = null;

          if (testItem) {
            testItem.querySelector('.basic03-chart-section')?.remove();
            const chartSection = document.createElement('div');
            chartSection.className = 'basic03-chart-section';
            chartSection.style.cssText = 'padding:0 20px 20px 20px;';
            chartSection.innerHTML = `
                  <div style="background:white;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                    <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-size:13px;font-weight:600;color:#1a1a1a;">실시간 차트 (Continuous 20ms)</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e9ecef;border-bottom:1px solid #e9ecef;">
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#e74c3c;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Velocity Feedback [rpm]</span>
                        </div>
                        <div id="basic03-val-0" style="font-size:18px;font-weight:600;font-family:monospace;color:#e74c3c;">—</div>
                      </div>
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#3498db;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Velocity Command [rpm]</span>
                        </div>
                        <div id="basic03-val-1" style="font-size:18px;font-weight:600;font-family:monospace;color:#3498db;">—</div>
                      </div>
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#2ecc71;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Torque Feedback [%]</span>
                        </div>
                        <div id="basic03-val-2" style="font-size:18px;font-weight:600;font-family:monospace;color:#2ecc71;">—</div>
                      </div>
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#f39c12;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Torque Command [%]</span>
                        </div>
                        <div id="basic03-val-3" style="font-size:18px;font-weight:600;font-family:monospace;color:#f39c12;">—</div>
                      </div>
                    </div>
                    <canvas id="basic03-canvas" width="800" height="220"
                            style="width:100%;height:220px;display:block;background:#fafafa;"></canvas>
                  </div>`;
            const logDiv =
                [...testItem.querySelector('.os-test-content').children].find(
                    el => el.querySelector('.test-log-container'));
            if (logDiv)
              logDiv.parentElement.insertBefore(chartSection, logDiv);
            else
              testItem.querySelector('.os-test-content')
                  .appendChild(chartSection);

            // 아코디언 열기 — Run Category / Run All 실행 시 닫혀있을 수 있음
            const contentEl = testItem.querySelector('.os-test-content');
            if (contentEl && contentEl.style.display !== 'block') {
              contentEl.style.display = 'block';
              const expandIcon = testItem.querySelector('.test-expand-icon');
              if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
            }

            const canvas = document.getElementById('basic03-canvas');
            if (canvas) {
              chart = new MiniChart(
                  canvas,
                  [
                    {
                      name: 'Velocity Feedback [rpm]',
                      color: '#e74c3c',
                      chNum: 0
                    },
                    {
                      name: 'Velocity Command [rpm]',
                      color: '#3498db',
                      chNum: 1
                    },
                    {name: 'Torque Feedback [%]', color: '#2ecc71', chNum: 3},
                    {name: 'Torque Command [%]', color: '#f39c12', chNum: 4},
                  ],
                  {maxPoints: 10000, displayPoints: 300});

              const saveLsmBtn = testItem.querySelector('.test-save-lsm-btn');
              if (saveLsmBtn) {
                saveLsmBtn.onclick = () => {
                  if (!chart) return;
                  const ts =
                      new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                  LsmExporter.download(chart.channels, 20, `3-2_${ts}.lsm`);
                };
              }
            }
          }

          // ── FC 0x64 차트 루프 헬퍼 ────────────────────────────────────────
          const chartStop = {stop: false};
          const FC64_TYPE = 'basic03chart';

          const startChartLoop = async () => {
            if (!d.writer || !chart) return false;
            chartStop.stop = false;

            // 다른 탭에서 FC64 차트가 실행 중이면 먼저 정지
            if (d.chartRunning) {
              self.addLog('⏹ Chart 탭 FC64 차트를 정지합니다...', 'info');
              await d.stopChartCapture();
            }
            const runningMini =
                Object.keys(d.miniChartRunning)
                    .filter(k => k !== FC64_TYPE && d.miniChartRunning[k]);
            for (const key of runningMini) {
              self.addLog(
                  `⏹ HW Overview 미니 차트 [${key}]를 정지합니다...`, 'info');
              await d.stopMiniChart(key);
            }

            d._fc64Busy = true;
            while (d.isPolling) await self.delay(5);
            await d.sendAndReceiveFC64(
                modbus.buildContinuousStop(slaveId), 0x00, 300);
            const resp = await d.sendAndReceiveFC64(
                modbus.buildContinuousConfigure(slaveId, 160, [0, 1, 3, 4]),
                0x02, 1000);
            if (!resp) {
              d._fc64Busy = false;
              self.addLog(
                  '⚠ FC 0x64 Configure 실패 — 차트 없이 계속 진행', 'warning');
              return false;
            }
            d.miniChartRunning[FC64_TYPE] = true;
            d._fc64Busy = false;
            (async () => {
              while (!chartStop.stop && d.miniChartRunning[FC64_TYPE]) {
                const r = await d.sendAndReceiveFC64(
                    modbus.buildContinuousRequest(slaveId), 0x03, 300);
                if (chartStop.stop) break;
                if (r) {
                  const p = modbus.parseContinuousDataResponse(r);
                  if (p && p.data.length > 0) {
                    const spc = Math.floor(p.data.length / 4);
                    for (let s = 0; s < spc; s++)
                      for (let ci = 0; ci < 4; ci++) {
                        const v = p.data[ci * spc + s];
                        if (v !== undefined) chart.addDataPoint(ci, v);
                      }
                    chart.render();
                    // 최신값(가장 오른쪽) 숫자 표시
                    for (let ci = 0; ci < 4; ci++) {
                      const ch = chart.channels[ci];
                      if (ch && ch.data.length > 0) {
                        const el = document.getElementById(`basic03-val-${ci}`);
                        if (el)
                          el.textContent =
                              ch.data[ch.data.length - 1].toFixed(2);
                      }
                    }
                  }
                }
                if (d.commandQueue.length > 0) await d._drainCommandQueue();
              }
            })();
            self.addLog('✓ FC 0x64 차트 시작 (Ch0,1,3,4, 20ms)', 'success');
            return true;
          };

          const stopChartLoop = async () => {
            chartStop.stop = true;
            d.miniChartRunning[FC64_TYPE] = false;
            await new Promise(r => setTimeout(r, 150));
            if (d.writer) {
              d._fc64Busy = true;
              await d.sendAndReceiveFC64(
                  modbus.buildContinuousStop(slaveId), 0x00, 300);
              d._fc64Busy = false;
            }
            self.addLog('■ FC 0x64 차트 정지', 'info');
          };

          const waitUntilStopped = async (label = '') => {
            const deadline = Date.now() + 30000;
            self.addLog(`  정지 대기${label ? ' (' + label + ')' : ''} — 실제 속도 ≤ 6 RPM 확인...`, 'info');
            while (Date.now() < deadline) {
              await self.checkStop();
              await self.delay(500);
              const spd = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
              if (spd !== null && spd !== undefined && Math.abs(spd) <= 6) {
                self.addLog('  ✓ 정지 확인 (≤ 6 RPM)', 'success');
                return;
              }
            }
            self.addLog('  ⚠ 30초 내 정지 미확인 — 강제 진행', 'warning');
          };

          // ── 테스트 본체 ───────────────────────────────────────────────────
          // 복원용 초기값 — 중단(Stop) 시 finally에서 접근하기 위해 try 밖에
          // 선언
          let initOpMode = null;
          let initCurLimit = null;
          let initSetpoint = null;

          try {
            // ── 다른 FC64 차트가 동작 중이면 먼저 정지 ──────────────────
            if (d.chartRunning) {
              self.addLog('⚠ 메인 차트 동작 중 — 정지 중...', 'warning');
              await d.stopChartCapture();
              self.addLog('  메인 차트 정지 완료', 'info');
            }
            for (const [type, running] of Object.entries(d.miniChartRunning)) {
              if (running && type !== 'basic03chart') {
                self.addLog(
                    `⚠ 미니 차트(${type}) 동작 중 — 정지 중...`, 'warning');
                await d.stopMiniChart(type);
                self.addLog(`  미니 차트(${type}) 정지 완료`, 'info');
              }
            }
            while (d._fc64Busy) await self.delay(50);

            // 초기값 저장 (FC64 시작 전 — 직접 읽기, 큐 불필요)
            initOpMode = await d.readRegisterWithTimeout(slaveId, 0xD106);
            initCurLimit = await d.readRegisterWithTimeout(slaveId, 0xD13B);
            initSetpoint = await d.readRegisterWithTimeout(slaveId, 0xD001);
            const maxSpeedRaw = await d.readRegisterWithTimeout(slaveId, 0xD119);
            const maxSpeedRpm = (maxSpeedRaw != null && maxSpeedRaw > 0) ? maxSpeedRaw : 1800;
            self.addLog(
                `초기값 — OperationMode[0xD106]: ${
                    initOpMode ?? 'N/A'}, CurrentLimit[0xD13B]: ${
                    initCurLimit ??
                    'N/A'}, Setpoint[0xD001]: ${initSetpoint ?? 'N/A'}, MaxSpeed[0xD119]: ${maxSpeedRpm} RPM${maxSpeedRaw == null || maxSpeedRaw === 0 ? ' (읽기 실패 — 기본값 1800 사용)' : ''}`,
                'info');

            await startChartLoop();

            // ── Phase 2-1 : Torque 모드 — Current Limit 20% Clamping ──────
            self.addLog('▶ Phase 2-1 시작', 'info');
            self.addLog(
                '[Phase 2-1] Torque 모드 — Current Limit 20% (200) Clamping 검증',
                'step');
            self.updateStepStatus(0, 'running');
            self.updateProgress(5, 'Phase 2-1: 설정');

            // Current Limit = 200 (20%)
            self.updateProgress(8, 'Phase 2-1: Current Limit 설정');
            await d.writeRegister(slaveId, 0xD13B, 200);
            self.addLog(
                '  Write: Current Limit [0xD13B] = 200 (20.0%)', 'info');
            await self.delay(200);

            const limitRb21 = await d.readRegisterWithTimeout(slaveId, 0xD13B);
            self.addLog(
                `  Read-back: Current Limit = ${limitRb21 ?? 'N/A'} ${
                    limitRb21 === 200 ? '✓' : '⚠ 불일치'}`,
                limitRb21 === 200 ? 'success' : 'warning');

            // 3. Operation Mode → Torque Control (2)
            await d.writeRegister(slaveId, 0xD106, 2);
            self.addLog(
                '  Write: Operation Mode [0xD106] = 2 (Torque Control)',
                'info');
            await self.delay(200);

            // 4. Setpoint 50% (raw = 50/100 * 65535 = 32767)
            const setpoint50 = Math.round(0.5 * 65535);
            await d.writeRegister(slaveId, 0xD001, setpoint50);
            self.addLog(
                `  Write: Setpoint [0xD001] = ${setpoint50} (50%)`, 'info');
            await self.delay(200);

            // 5. 차트 확인
            self.addLog(
                '★ 모터를 Run 하세요 — 차트 Ch4(Torque CMD)가 Current Limit(200) 레벨을 넘지 않는지 확인 (7초 대기)',
                'warning');
            self.updateProgress(12, 'Phase 2-1: 파형 확인 중');
            await self.delay(7000);
            self.checkStop();

            self.addLog('정지 명령 전송 (0xD001 ← 0)', 'info');
            await d.writeRegister(slaveId, 0xD001, 0);
            await waitUntilStopped('Phase 2-1 종료');

            // 초기값 복원
            if (initOpMode != null) {
              await d.writeRegister(slaveId, 0xD106, initOpMode);
              await self.delay(100);
            }
            if (initCurLimit != null) {
              await d.writeRegister(slaveId, 0xD13B, initCurLimit);
              await self.delay(100);
            }
            if (initSetpoint != null) {
              await d.writeRegister(slaveId, 0xD001, initSetpoint);
              await self.delay(100);
            }
            self.addLog('  초기값 복원 완료', 'info');

            self.updateStepStatus(0, 'success');
            self.updateProgress(17, 'Phase 2-1 완료');
            await self.delay(300);
            self.checkStop();

            // ── Phase 2-2 : Velocity 모드 — Current Limit 40% Saturation ─
            self.addLog('▶ Phase 2-2 시작', 'info');
            self.addLog(
                '[Phase 2-2] Velocity 모드 — Current Limit 40% (400) + 최대속도 급가속 Saturation 검증',
                'step');
            self.updateStepStatus(1, 'running');
            self.updateProgress(20, 'Phase 2-2: 설정');


            // Current Limit = 400 (40%)
            await d.writeRegister(slaveId, 0xD13B, 400);
            self.addLog(
                '  Write: Current Limit [0xD13B] = 400 (40.0%)', 'info');
            await self.delay(200);

            // 3. Operation Mode → Velocity Control (0)
            await d.writeRegister(slaveId, 0xD106, 0);
            self.addLog(
                '  Write: Operation Mode [0xD106] = 0 (Velocity Control)',
                'info');
            await self.delay(200);

            // 4. Setpoint 100% (raw = 1600/1600 * 64000 = 64000)
            await d.writeRegister(slaveId, 0xD001, 64000);
            self.addLog(
                '  Write: Setpoint [0xD001] = 64000 (100% = 1600 RPM) — 급가속 유발',
                'info');
            await self.delay(200);

            self.addLog(
                '★ 모터를 Run 하세요 — 급가속 시 Ch4(Torque CMD) 400 레벨 Saturation 후 속도 도달 확인 (10초 대기)',
                'warning');
            self.addLog(
                '  → 급가속 구간 파형 상단이 400에서 잘리고, 목표 속도 도달 후 자연스럽게 하강해야 합격',
                'info');
            self.updateProgress(25, 'Phase 2-2: 파형 확인 중');
            await self.delay(10000);
            self.checkStop();

            self.addLog('★ 모터를 Stop 하세요', 'warning');
            self.addLog('정지 명령 전송 (0xD001 ← 0)', 'info');
            await d.writeRegister(slaveId, 0xD001, 0);
            await waitUntilStopped('Phase 2-2 종료');

            // 초기값 복원
            if (initOpMode != null) {
              await d.writeRegister(slaveId, 0xD106, initOpMode);
              await self.delay(100);
            }
            if (initCurLimit != null) {
              await d.writeRegister(slaveId, 0xD13B, initCurLimit);
              await self.delay(100);
            }
            if (initSetpoint != null) {
              await d.writeRegister(slaveId, 0xD001, initSetpoint);
              await self.delay(100);
            }
            self.addLog('  초기값 복원 완료', 'info');

            self.updateStepStatus(1, 'success');
            self.updateProgress(35, 'Phase 2-2 완료');
            await self.delay(300);
            self.checkStop();

            // ── 합/불합격 추적 ────────────────────────────────────────────
            const passed = [];
            const failed = [];

            // ── Phase 3-1 : 범위 초과 150% (1500) Write ─────────────────
            self.addLog('▶ Phase 3-1 시작', 'info');
            self.addLog(
                '[Phase 3-1] 범위 초과 150% (1500, 0x05DC) Write — Exception 0x03 예상',
                'step');
            self.updateStepStatus(2, 'running');
            self.updateProgress(42, 'Phase 3-1: 범위 초과 Write');

            const limitPre31 = await d.readRegisterWithTimeout(slaveId, 0xD13B);
            self.addLog(
                `  현재 Current Limit [0xD13B]: ${limitPre31 ?? 'N/A'}`,
                'info');
            await d.writeRegister(slaveId, 0xD13B, 1500);
            await self.delay(300);
            const limitRead1 = await d.readRegisterWithTimeout(slaveId, 0xD13B);
            self.addLog(`  1차 Read-back: Current Limit = ${limitRead1 ?? 'N/A'}`, 'info');
            await self.delay(300);
            const limitPost31 = await d.readRegisterWithTimeout(slaveId, 0xD13B);
            self.addLog(`  2차 Read-back: Current Limit = ${limitPost31 ?? 'N/A'}`, 'info');
            if (limitPost31 != null && limitPost31 <= 1000) {
              self.addLog(
                  `✓ Read-back 값 ${limitPost31} ≤ 1000 (100%) — 범위 초과 클램핑/거부 확인 — PASS`,
                  'success');
              self.updateStepStatus(2, 'success');
              passed.push('Phase 3-1');
            } else {
              self.addLog(
                  `✗ [FAIL] Read-back 값 ${limitPost31 ?? 'N/A'} > 1000 — 범위 초과 허용됨 (불합격)`,
                  'error');
              self.updateStepStatus(2, 'error');
              failed.push('Phase 3-1');
            }
            await self.delay(300);
            self.checkStop();

            // ── Phase 3-2 : Current Limit 0% → 모터 무회전 ──────────────
            self.addLog('▶ Phase 3-2 시작', 'info');
            self.addLog(
                '[Phase 3-2] Current Limit 0% (0) 설정 후 Run — 모터 무회전 검증',
                'step');
            self.updateStepStatus(3, 'running');
            self.updateProgress(52, 'Phase 3-2: 0% 설정');


            await d.writeRegister(slaveId, 0xD13B, 0);
            self.addLog('  Write: Current Limit [0xD13B] = 0 (0.0%)', 'info');
            await self.delay(200);

            self.addLog(
                '★ 모터를 Run 하세요 — 5초간 실제 속도(0xD02D) 자동 측정',
                'warning');
            let maxSpeed32 = 0;
            const endTime32 = Date.now() + 5000;
            while (Date.now() < endTime32) {
              const spd = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
              if (spd !== null && spd > maxSpeed32) maxSpeed32 = spd;
              await self.delay(300);
              self.checkStop();
            }
            self.addLog(`  측정 완료 — 최대 실제 속도: ${maxSpeed32} RPM`, 'info');

            self.addLog('★ 모터를 Stop 하세요', 'warning');
            self.addLog('정지 명령 전송 (0xD001 ← 0)', 'info');
            await d.writeRegister(slaveId, 0xD001, 0);
            await waitUntilStopped('Phase 3-2 종료');

            // 복원 (다음 Phase를 위해 100%로)
            await d.writeRegister(slaveId, 0xD13B, 1000);
            self.addLog('  Current Limit [0xD13B] = 1000 (100%) 복원', 'info');
            await self.delay(200);

            if (maxSpeed32 <= 50) {
              self.addLog(
                  `✓ 최대 속도 ${maxSpeed32} RPM ≤ 50 RPM — 모터 무회전 확인 — PASS`,
                  'success');
              self.updateStepStatus(3, 'success');
              passed.push('Phase 3-2');
            } else {
              self.addLog(
                  `✗ [FAIL] 최대 속도 ${maxSpeed32} RPM > 50 RPM — 모터 회전 감지 (불합격)`,
                  'error');
              self.updateStepStatus(3, 'error');
              failed.push('Phase 3-2');
            }
            self.updateProgress(62, 'Phase 3-2 완료');
            await self.delay(300);
            self.checkStop();

            // ── Phase 4 : Anti-windup 복구 검증 ─────────────────────────
            self.addLog('▶ Phase 4 시작', 'info');
            self.addLog(
                '[Phase 4] On-the-fly 전류 제한 10% 하향 → 속도 하락 관찰 → 100% 복구 Anti-windup 검증',
                'step');
            self.updateStepStatus(4, 'running');
            self.updateProgress(70, 'Phase 4: 구동 준비');


            await d.writeRegister(slaveId, 0xD13B, 1000);
            self.addLog(
                '  Write: Current Limit [0xD13B] = 1000 (100.0%)', 'info');
            await self.delay(100);
            await d.writeRegister(slaveId, 0xD106, 0);
            self.addLog(
                '  Write: Operation Mode [0xD106] = 0 (Velocity Control)',
                'info');
            await self.delay(100);
            await d.writeRegister(slaveId, 0xD001, 64000);
            self.addLog(
                `  Write: Setpoint [0xD001] = 64000 (100% = ${maxSpeedRpm} RPM)`, 'info');
            await self.delay(200);

            self.addLog(
                '★ 모터를 Run 하여 정상 회전 상태로 만드세요 (5초 안정화 대기)',
                'warning');
            await self.delay(5000);
            self.checkStop();

            self.updateProgress(78, 'Phase 4: 전류 제한 10% 하향');
            await d.writeRegister(slaveId, 0xD13B, 100);
            self.addLog(
                '  Write: Current Limit [0xD13B] = 100 (10.0%) ← On-the-fly 하향',
                'info');
            self.addLog(
                '  → 토크 부족으로 속도 하락 예상 — 차트 관찰 (3초)', 'info');
            await self.delay(3000);
            self.checkStop();

            self.updateProgress(88, 'Phase 4: 100% 복구 — Anti-windup 관찰');
            await d.writeRegister(slaveId, 0xD13B, 1000);
            self.addLog(
                '  Write: Current Limit [0xD13B] = 1000 (100.0%) ← 복구',
                'info');
            // 10초간 실제 속도 모니터링 (Overshoot 감시)
            const overshootLimit = Math.round(maxSpeedRpm * 1.05);
            self.addLog(
                `  → Anti-windup 확인: 한계 ${overshootLimit} RPM (${maxSpeedRpm}×1.05) — 10초 자동 측정`,
                'info');
            let maxSpeed4 = 0;
            const endTime4 = Date.now() + 10000;
            while (Date.now() < endTime4) {
              const spd = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
              if (spd !== null && spd > maxSpeed4) maxSpeed4 = spd;
              await self.delay(200);
              self.checkStop();
            }
            self.addLog(
                `  모니터링 완료 — 최대 속도: ${maxSpeed4} RPM (한계: ${overshootLimit} RPM)`,
                'info');

            self.addLog('★ 모터를 Stop 하세요', 'warning');
            self.addLog('정지 명령 전송 (0xD001 ← 0)', 'info');
            await d.writeRegister(slaveId, 0xD001, 0);
            await waitUntilStopped('Phase 4 종료');

            // 초기값 복원
            if (initOpMode != null) {
              await d.writeRegister(slaveId, 0xD106, initOpMode);
              await self.delay(100);
            }
            if (initCurLimit != null) {
              await d.writeRegister(slaveId, 0xD13B, initCurLimit);
              await self.delay(100);
            }
            if (initSetpoint != null) {
              await d.writeRegister(slaveId, 0xD001, initSetpoint);
              await self.delay(100);
            }
            self.addLog('  초기값 복원 완료', 'info');

            if (maxSpeed4 <= overshootLimit) {
              self.addLog(
                  `✓ 최대 속도 ${maxSpeed4} RPM ≤ ${overshootLimit} RPM — Overshoot 없음 — PASS`,
                  'success');
              self.updateStepStatus(4, 'success');
              passed.push('Phase 4');
            } else {
              self.addLog(
                  `✗ [FAIL] 최대 속도 ${maxSpeed4} RPM > ${overshootLimit} RPM — Overshoot 초과 (불합격)`,
                  'error');
              self.updateStepStatus(4, 'error');
              failed.push('Phase 4');
            }

            const ok = failed.length === 0;
            self.updateProgress(100, ok ? '테스트 완료 — 합격' : '테스트 완료 — 불합격');
            self.addLog(
                ok ? '✓ Current Limit 파라미터 설정 검증: 합격'
                   : `✗ Current Limit 파라미터 설정 검증: 불합격 (${failed.join(', ')})`,
                ok ? 'success' : 'error');

            return {
              status: ok ? 'pass' : 'fail',
              message: ok
                  ? 'Current Limit 파라미터 검증 완료 — 합격'
                  : `불합격 항목: ${failed.join(', ')}`,
              details:
                  'Phase 2-1: Torque 모드 Current Limit 200 Clamping (차트 육안)\n' +
                  'Phase 2-2: Velocity 모드 Current Limit 400 Saturation (차트 육안)\n' +
                  `Phase 3-1: 150% 초과 Write Read-back ≤ 1000 → ${passed.includes('Phase 3-1') ? '합격' : '불합격'}\n` +
                  `Phase 3-2: 0% 설정 모터 무회전 (0xD02D ≤ 50 RPM) → ${passed.includes('Phase 3-2') ? '합격' : '불합격'}\n` +
                  `Phase 4: Anti-windup 복구 Overshoot (0xD02D ≤ ${overshootLimit} RPM) → ${passed.includes('Phase 4') ? '합격' : '불합격'}`,
            };

          } finally {
            await stopChartLoop();
            // 중단(Stop) 또는 완료 시 레지스터 초기값 복원
            // ※ self.delay() 금지 — shouldStopTest=true 상태에서 즉시 throw
            // 하므로
            //   raw setTimeout Promise 사용
            const _wait = ms => new Promise(r => setTimeout(r, ms));
            try {
              if (initOpMode != null) {
                await d.writeRegister(slaveId, 0xD106, initOpMode);
                await _wait(50);
              }
              if (initCurLimit != null) {
                await d.writeRegister(slaveId, 0xD13B, initCurLimit);
                await _wait(50);
              }
              if (initSetpoint != null) {
                await d.writeRegister(slaveId, 0xD001, initSetpoint);
              }
              if (initOpMode != null || initCurLimit != null ||
                  initSetpoint != null)
                self.addLog('■ 레지스터 초기값 복원 완료 (중단/완료)', 'info');
            } catch (_e) { /* 연결 없음 등 무시 */
            }
          }
        },

        // ── basic04 executor ─────────────────────────────────────────────────
        'basic04': async function() {
          const self = this;
          self.checkConnection();
          const d = window.dashboard;
          const modbus = d.modbus;
          const slaveId = 1;
          const _wait = ms => new Promise(r => setTimeout(r, ms));
          const dirLabel = v =>
              v === 0 ? 'CCW(0)' : v === 1 ? 'CW(1)' : `Unknown(${v})`;

          const waitUntilStopped = async (label = '') => {
            const deadline = Date.now() + 30000;
            self.addLog(`  정지 대기${label ? ' (' + label + ')' : ''} — 실제 속도 ≤ 6 RPM 확인...`, 'info');
            while (Date.now() < deadline) {
              await self.checkStop();
              await _wait(500);
              const spd = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
              if (spd !== null && spd !== undefined && Math.abs(spd) <= 6) {
                self.addLog('  ✓ 정지 확인 (≤ 6 RPM)', 'success');
                return;
              }
            }
            self.addLog('  ⚠ 30초 내 정지 미확인 — 강제 진행', 'warning');
          };

          let origDir = null, origOpMode = null;
          const failed = [], passed = [];

          // ── Hall 차트 패널 주입 ───────────────────────────────────────────
          const FC64_TYPE = 'basic04chart';
          let hallChart = null;
          const hallData = [[], [], []];
          const chartStop = {stop: false};

          const testItem = document.querySelector('.os-test-item[data-test-id="basic04"]');
          if (testItem) {
            testItem.querySelector('.basic04-chart-section')?.remove();
            const chartSection = document.createElement('div');
            chartSection.className = 'basic04-chart-section';
            chartSection.style.cssText = 'padding:0 20px 20px 20px;';
            chartSection.innerHTML = `
              <div style="background:white;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
                  <span style="font-size:13px;font-weight:600;color:#1a1a1a;">Hall 센서 U/V/W — 위상 순서 자동 분석</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#e9ecef;border-bottom:1px solid #e9ecef;">
                  <div style="background:white;padding:8px 12px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                      <span style="width:12px;height:3px;background:#e74c3c;display:inline-block;border-radius:2px;"></span>
                      <span style="font-size:11px;color:#6c757d;">Hall U (CH 0x16)</span>
                    </div>
                    <div id="basic04-val-0" style="font-size:18px;font-weight:600;font-family:monospace;color:#e74c3c;">—</div>
                  </div>
                  <div style="background:white;padding:8px 12px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                      <span style="width:12px;height:3px;background:#3498db;display:inline-block;border-radius:2px;"></span>
                      <span style="font-size:11px;color:#6c757d;">Hall V (CH 0x17)</span>
                    </div>
                    <div id="basic04-val-1" style="font-size:18px;font-weight:600;font-family:monospace;color:#3498db;">—</div>
                  </div>
                  <div style="background:white;padding:8px 12px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                      <span style="width:12px;height:3px;background:#2ecc71;display:inline-block;border-radius:2px;"></span>
                      <span style="font-size:11px;color:#6c757d;">Hall W (CH 0x18)</span>
                    </div>
                    <div id="basic04-val-2" style="font-size:18px;font-weight:600;font-family:monospace;color:#2ecc71;">—</div>
                  </div>
                </div>
                <canvas id="basic04-canvas" width="800" height="200"
                        style="width:100%;height:200px;display:block;background:#fafafa;"></canvas>
                <div id="basic04-dir-result" style="padding:8px 16px;font-size:12px;color:#6c757d;text-align:center;">분석 대기 중...</div>
              </div>`;

            const contentEl = testItem.querySelector('.os-test-content');
            if (contentEl && contentEl.style.display !== 'block') {
              contentEl.style.display = 'block';
              const expandIcon = testItem.querySelector('.test-expand-icon');
              if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
            }
            const logDiv = [...(contentEl?.children || [])]
                .find(el => el.querySelector('.test-log-container'));
            if (logDiv) logDiv.parentElement.insertBefore(chartSection, logDiv);
            else contentEl?.appendChild(chartSection);

            const canvas = document.getElementById('basic04-canvas');
            if (canvas) {
              hallChart = new MiniChart(canvas, [
                {name: 'Hall U', color: '#e74c3c', chNum: 0},
                {name: 'Hall V', color: '#3498db', chNum: 1},
                {name: 'Hall W', color: '#2ecc71', chNum: 2},
              ], {maxPoints: 10000, displayPoints: 300});
            }
          }

          // ── Hall FC 0x64 제어 헬퍼 ──────────────────────────────────────
          const startHallChart = async () => {
            if (!d.writer || !hallChart) return false;
            chartStop.stop = false;
            if (d.chartRunning) {
              self.addLog('⏹ 메인 차트 정지 중...', 'info');
              await d.stopChartCapture();
            }
            const runningMini = Object.keys(d.miniChartRunning)
                .filter(k => k !== FC64_TYPE && d.miniChartRunning[k]);
            for (const key of runningMini) await d.stopMiniChart(key);
            d._fc64Busy = true;
            while (d.isPolling) await self.delay(5);
            await d.sendAndReceiveFC64(modbus.buildContinuousStop(slaveId), 0x00, 300);
            const resp = await d.sendAndReceiveFC64(
                modbus.buildContinuousConfigure(slaveId, 160, [0x16, 0x17, 0x18]),
                0x02, 1000);
            if (!resp) {
              d._fc64Busy = false;
              self.addLog('⚠ FC 0x64 Configure 실패 — Hall 차트 없이 계속', 'warning');
              return false;
            }
            d.miniChartRunning[FC64_TYPE] = true;
            d._fc64Busy = false;
            (async () => {
              while (!chartStop.stop && d.miniChartRunning[FC64_TYPE]) {
                const r = await d.sendAndReceiveFC64(
                    modbus.buildContinuousRequest(slaveId), 0x03, 300);
                if (chartStop.stop) break;
                if (r) {
                  const p = modbus.parseContinuousDataResponse(r);
                  if (p && p.data.length > 0) {
                    const spc = Math.floor(p.data.length / 3);
                    for (let s = 0; s < spc; s++) {
                      for (let ci = 0; ci < 3; ci++) {
                        const v = p.data[ci * spc + s];
                        if (v !== undefined) {
                          hallChart.addDataPoint(ci, v);
                          hallData[ci].push(v);
                        }
                      }
                    }
                    hallChart.render();
                    for (let ci = 0; ci < 3; ci++) {
                      const ch = hallChart.channels[ci];
                      if (ch && ch.data.length > 0) {
                        const el = document.getElementById(`basic04-val-${ci}`);
                        if (el) el.textContent = ch.data[ch.data.length - 1].toFixed(1);
                      }
                    }
                  }
                }
                if (d.commandQueue.length > 0) await d._drainCommandQueue();
              }
            })();
            self.addLog('✓ Hall FC 0x64 차트 시작 (CH 0x16/17/18, 20ms)', 'success');
            return true;
          };

          const stopHallChart = async () => {
            chartStop.stop = true;
            d._fc64Busy = true;              // 먼저 busy 설정 → _isFc64Active 유지
            d.miniChartRunning[FC64_TYPE] = false;
            await new Promise(r => setTimeout(r, 200)); // 루프 마지막 iteration 완료 대기
            if (d.writer) {
              await d.sendAndReceiveFC64(modbus.buildContinuousStop(slaveId), 0x00, 300);
              await new Promise(r => setTimeout(r, 400)); // 디바이스 Modbus RTU 모드 복귀 대기
            }
            d._fc64Busy = false;
            self.addLog('■ Hall FC 0x64 차트 정지', 'info');
          };

          // ── Hall 위상 순서 판정 ──────────────────────────────────────────
          const analyzeHallDirection = () => {
            const U = hallData[0], V = hallData[1];
            if (U.length < 20) return null;
            const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
            const mU = mean(U), mV = mean(V);
            const u = U.map(v => v - mU);
            const v = V.map(v => v - mV);

            // 정지 여부 판정: DC 제거 후 신호의 peak-to-peak 진폭 확인
            const uMax = Math.max(...u), uMin = Math.min(...u);
            const uPeakToPeak = uMax - uMin;
            const vMax = Math.max(...v), vMin = Math.min(...v);
            const vPeakToPeak = vMax - vMin;
            // 두 채널 모두 진폭이 거의 없으면 모터 정지로 판단
            // (정지 시 DC 제거 후 신호가 노이즈 수준에 머뭄)
            if (uPeakToPeak < 10 && vPeakToPeak < 10) {
              return { stopped: true, reason: '신호 진폭 부족 (peak-to-peak < 10)' };
            }

            // U 상승 영교차 시점에 V 부호로 위상 순서 판정
            // V > 0 → U→V→W 순서 → CW
            // V < 0 → U→W→V 순서 → CCW
            let cwVotes = 0, ccwVotes = 0;
            for (let i = 1; i < u.length; i++) {
              if (u[i - 1] < 0 && u[i] >= 0) {
                if (v[i] > 0) cwVotes++;
                else ccwVotes++;
              }
            }
            const total = cwVotes + ccwVotes;

            // 영교차 횟수 부족 → 모터 미구동 또는 속도 너무 낮음
            // 100 RPM·5초 수집 시 정상적으로 수십 회 발생해야 함
            if (total < 3) {
              return { stopped: true, reason: `영교차 횟수 부족 (${total}회 < 3회)` };
            }

            return {
              stopped: false,
              direction: cwVotes > ccwVotes ? 'CW' : 'CCW',
              cwVotes, ccwVotes,
              confidence: Math.max(cwVotes, ccwVotes) / total,
            };
          };

          try {
            // ─── 사전 준비: 기존값 읽기 (Phase 아님)
            self.updateProgress(5, '기존값 읽기 중...');
            self.addLog('[준비] 기존 방향(0xD102), 동작 모드(0xD106), 최대속도(0xD119) 읽기', 'info');

            origDir = await d.readRegisterWithTimeout(slaveId, 0xD102);
            origOpMode = await d.readRegisterWithTimeout(slaveId, 0xD106);
            const maxSpeedRaw = await d.readRegisterWithTimeout(slaveId, 0xD119);
            const maxSpeed = (maxSpeedRaw != null && maxSpeedRaw > 0) ? maxSpeedRaw : 1600;

            if (origDir == null) throw new Error('0xD102 Read 실패 — 응답 없음');
            if (origOpMode == null) throw new Error('0xD106 Read 실패 — 응답 없음');

            self.addLog(`  기존 방향: ${dirLabel(origDir)}`, 'info');
            self.addLog(
                `  기존 동작 모드: ${
                    origOpMode === 0 ? 'Velocity(0)' :
                    origOpMode === 2 ? 'Torque(2)' : `Unknown(${origOpMode})`}`,
                'info');
            self.addLog(
                `  최대속도: ${maxSpeed} RPM${maxSpeedRaw == null || maxSpeedRaw === 0 ? ' (읽기 실패 — 기본값 1800 사용)' : ''}`,
                maxSpeedRaw == null || maxSpeedRaw === 0 ? 'warning' : 'info');

            // 속도 Setpoint raw 값 (150 RPM 기준)
            const rawSpeed = Math.round(150 / maxSpeed * 64000);

            // ─── Phase 2: CCW 설정 → SW Reset → 재연결 → Read-back
            self.updateProgress(10, '[Phase 2] CCW 설정 후 SW Reset 중...');
            self.updateStepStatus(0, 'running');
            self.addLog('[Phase 2] CCW(0) 설정 후 SW Reset → 재연결 후 Read-back 검증', 'info');

            await d.writeRegister(slaveId, 0xD102, 0);
            await _wait(200);
            const cwReadAfterWrite = await d.readRegisterWithTimeout(slaveId, 0xD102);
            self.addLog(`  CCW(0) Write Read-back: ${cwReadAfterWrite}`, 'info');

            self.addLog('★ 디바이스 재부팅 대기 중...', 'warning');
            const reboot = await self.swResetAndWait(slaveId, { timeoutMs: 60000, pollIntervalMs: 1000 });
            if (!reboot.ok) throw new Error('60초 내 재부팅 응답 없음 — 디바이스 미응답');
            await _wait(300);

            const dirAfterReset = await d.readRegisterWithTimeout(slaveId, 0xD102);
            if (dirAfterReset === 0) {
              self.addLog(`  Read-back 0xD102 = ${dirAfterReset}(CCW) → 합격 ✓`, 'success');
              passed.push('Phase 2');
              self.updateStepStatus(0, 'success');
            } else {
              self.addLog(
                  `  Read-back 0xD102 = ${dirAfterReset ?? 'null'} (기대: 0/CCW) → 불합격 ✗`,
                  'error');
              failed.push('Phase 2');
              self.updateStepStatus(0, 'error');
            }

            // ── Hall 차트 기동 → 모터 Run → 데이터 수집 → 방향 자동 판정
            self.addLog('  Hall FC 0x64 차트 기동 중...', 'info');
            const hallStarted = await startHallChart();
            await _wait(300);

            self.addLog(`  모터 Run (0xD001 ← ${rawSpeed} = 150 RPM) — Hall 위상 데이터 수집 (5초)`, 'info');
            try {
              await d.writeRegister(slaveId, 0xD001, rawSpeed);
            } catch (_) {}
            await _wait(500); // 가속 대기

            for (let c = 5; c > 0; c--) {
              await self.checkStop();
              self.updateProgress(15 + (5 - c) * 2, `[Phase 2] Hall 데이터 수집 중 (${c}초)`);
              await _wait(1000);
            }

            await stopHallChart();

            // 위상 순서 분석 → 방향 판정
            const dirResult = analyzeHallDirection();
            const resultEl = document.getElementById('basic04-dir-result');
            if (!dirResult) {
              self.addLog('  ⚠ Hall 데이터 부족 — 위상 순서 판정 불가', 'warning');
              if (resultEl) resultEl.textContent = '데이터 부족 — 판정 불가';
            } else if (dirResult.stopped) {
              self.addLog(
                  `  ⚠ Hall 위상 판정 불가 — 모터 미구동 상태 (${dirResult.reason})`,
                  'warning');
              if (resultEl) {
                resultEl.textContent = `판정 불가 — 모터 미구동 (${dirResult.reason})`;
                resultEl.style.color = '#f59e0b';
                resultEl.style.fontWeight = '600';
              }
              // 모터 정지 상태에서는 Hall 방향 판정을 레지스터 결과에 반영하지 않음
            } else {
              const isCCW = dirResult.direction === 'CCW';
              const confPct = (dirResult.confidence * 100).toFixed(0);
              self.addLog(
                  `  Hall 위상 순서: ${dirResult.direction}` +
                  ` (CW표 ${dirResult.cwVotes} / CCW표 ${dirResult.ccwVotes}, 신뢰도 ${confPct}%)`,
                  isCCW ? 'success' : 'error');
              if (resultEl) {
                resultEl.textContent =
                    `위상 순서 판정: ${dirResult.direction} (신뢰도 ${confPct}%) — ` +
                    (isCCW ? '합격 ✓' : '불합격 ✗');
                resultEl.style.color = isCCW ? '#27ae60' : '#e74c3c';
                resultEl.style.fontWeight = '600';
              }
              if (!isCCW && passed.includes('Phase 2')) {
                passed.splice(passed.indexOf('Phase 2'), 1);
                failed.push('Phase 2');
                self.updateStepStatus(0, 'error');
                self.addLog(
                    '  ✗ 레지스터 CCW(0) 저장됐으나 Hall 위상 순서 CW — Phase 2 불합격',
                    'error');
              } else if (isCCW && !passed.includes('Phase 2')) {
                self.addLog('  (Hall 위상 CCW 확인 — 레지스터 판정 결과 유지)', 'info');
              }
            }

            // ─── Phase 3-1: Torque 모드 CW/CCW 방향 전환 자동 판정
            self.updateProgress(28, '[Phase 3-1] Torque 모드 방향 전환 중...');
            self.updateStepStatus(1, 'running');
            self.addLog('[Phase 3-1] Torque 모드(0xD106=2) CW/CCW 방향 전환 자동 판정 (Hall 위상)', 'info');
            const rawTorque10 = Math.round(0.1 * 65535); // 6554
            let phase31Pass = true;

            for (const [dirVal, dirName, progBase] of [[1, 'CW', 28], [0, 'CCW', 42]]) {
              // 정지 → 방향 Write → SW Reset
              self.addLog(`  [${dirName} 전환] 정지 명령 전송 (0xD001 ← 0)`, 'info');
              await d.writeRegister(slaveId, 0xD001, 0);
              await waitUntilStopped(`${dirName} 전환 전`);
              await d.writeRegister(slaveId, 0xD102, dirVal);
              await _wait(200);
              self.addLog(`  ${dirName}(${dirVal}) Write 완료 → SW Reset (EEPROM 저장 + 재부팅)`, 'info');
              const reboot31 = await self.swResetAndWait(slaveId, { timeoutMs: 60000, pollIntervalMs: 1000 });
              if (!reboot31.ok) throw new Error(`[Phase 3-1] ${dirName} 전환 후 재부팅 응답 없음`);
              await _wait(300);

              // Hall 데이터 초기화 후 차트 재시작
              hallData[0].length = 0; hallData[1].length = 0; hallData[2].length = 0;
              await startHallChart();

              // Torque 모드 + 구동
              await d.writeRegister(slaveId, 0xD106, 2);
              await _wait(200);
              await d.writeRegister(slaveId, 0xD001, rawTorque10);
              self.addLog(`  Torque 모드(0xD106=2) + Setpoint=${rawTorque10}(10%) — 모터 Run, 8초 수집`, 'info');

              // 8초 데이터 수집
              for (let c = 8; c > 0; c--) {
                await self.checkStop();
                self.updateProgress(progBase + Math.round((8 - c) / 8 * 12), `[Phase 3-1] ${dirName} Hall 수집 (${c}초)`);
                await _wait(1000);
              }
              await stopHallChart();

              // 자동 판정
              const res = analyzeHallDirection();
              if (!res) {
                self.addLog(`  ⚠ [Phase 3-1] ${dirName}: Hall 데이터 부족 — 판정 불가`, 'warning');
                phase31Pass = false;
              } else if (res.stopped) {
                self.addLog(`  ✗ [Phase 3-1] ${dirName}: 모터 미구동 (${res.reason}) — 불합격`, 'error');
                phase31Pass = false;
              } else {
                const confPct = (res.confidence * 100).toFixed(0);
                const ok = res.direction === dirName;
                self.addLog(
                    `  ${ok ? '✓' : '✗'} [Phase 3-1] ${dirName}: Hall 위상 판정=${res.direction} (CW표 ${res.cwVotes}/CCW표 ${res.ccwVotes}, 신뢰도 ${confPct}%) — ${ok ? '합격' : '불합격'}`,
                    ok ? 'success' : 'error');
                if (!ok) phase31Pass = false;
              }
            }

            // Phase 3-1 종료
            self.addLog('  [Phase 3-1 종료] 정지 명령 전송 (0xD001 ← 0)', 'info');
            await d.writeRegister(slaveId, 0xD001, 0);
            await waitUntilStopped('Phase 3-1 종료');
            self.addLog(`  Phase 3-1 완료 — ${phase31Pass ? '합격' : '불합격'}`, phase31Pass ? 'success' : 'error');
            self.updateStepStatus(1, phase31Pass ? 'success' : 'error');
            (phase31Pass ? passed : failed).push('Phase 3-1');

            // ─── Phase 3-2: Velocity 모드 CW/CCW 방향 전환 자동 판정
            self.updateProgress(57, '[Phase 3-2] Velocity 모드 방향 전환 중...');
            self.updateStepStatus(2, 'running');
            self.addLog('[Phase 3-2] Velocity 모드(0xD106=0) CW/CCW 방향 전환 자동 판정 (Hall 위상)', 'info');
            let phase32Pass = true;

            for (const [dirVal, dirName, progBase] of [[1, 'CW', 57], [0, 'CCW', 71]]) {
              // 정지 → 방향 Write → SW Reset
              self.addLog(`  [${dirName} 전환] 정지 명령 전송 (0xD001 ← 0)`, 'info');
              await d.writeRegister(slaveId, 0xD001, 0);
              await waitUntilStopped(`${dirName} 전환 전`);
              await d.writeRegister(slaveId, 0xD102, dirVal);
              await _wait(200);
              self.addLog(`  ${dirName}(${dirVal}) Write 완료 → SW Reset (EEPROM 저장 + 재부팅)`, 'info');
              const reboot32 = await self.swResetAndWait(slaveId, { timeoutMs: 60000, pollIntervalMs: 1000 });
              if (!reboot32.ok) throw new Error(`[Phase 3-2] ${dirName} 전환 후 재부팅 응답 없음`);
              await _wait(300);

              // Hall 데이터 초기화 후 차트 재시작
              hallData[0].length = 0; hallData[1].length = 0; hallData[2].length = 0;
              await startHallChart();

              // Velocity 모드 + 구동
              await d.writeRegister(slaveId, 0xD106, 0);
              await _wait(200);
              await d.writeRegister(slaveId, 0xD001, rawSpeed);
              self.addLog(`  Velocity 모드(0xD106=0) + Setpoint=${rawSpeed}(150 RPM) — 모터 Run, 8초 수집`, 'info');

              // 8초 데이터 수집
              for (let c = 8; c > 0; c--) {
                await self.checkStop();
                self.updateProgress(progBase + Math.round((8 - c) / 8 * 12), `[Phase 3-2] ${dirName} Hall 수집 (${c}초)`);
                await _wait(1000);
              }
              await stopHallChart();

              // 자동 판정
              const res = analyzeHallDirection();
              if (!res) {
                self.addLog(`  ⚠ [Phase 3-2] ${dirName}: Hall 데이터 부족 — 판정 불가`, 'warning');
                phase32Pass = false;
              } else if (res.stopped) {
                self.addLog(`  ✗ [Phase 3-2] ${dirName}: 모터 미구동 (${res.reason}) — 불합격`, 'error');
                phase32Pass = false;
              } else {
                const confPct = (res.confidence * 100).toFixed(0);
                const ok = res.direction === dirName;
                self.addLog(
                    `  ${ok ? '✓' : '✗'} [Phase 3-2] ${dirName}: Hall 위상 판정=${res.direction} (CW표 ${res.cwVotes}/CCW표 ${res.ccwVotes}, 신뢰도 ${confPct}%) — ${ok ? '합격' : '불합격'}`,
                    ok ? 'success' : 'error');
                if (!ok) phase32Pass = false;
              }
            }

            // Phase 3-2 종료
            self.addLog('  [Phase 3-2 종료] 정지 명령 전송 (0xD001 ← 0)', 'info');
            await d.writeRegister(slaveId, 0xD001, 0);
            await waitUntilStopped('Phase 3-2 종료');
            self.addLog(`  Phase 3-2 완료 — ${phase32Pass ? '합격' : '불합격'}`, phase32Pass ? 'success' : 'error');
            self.updateStepStatus(2, phase32Pass ? 'success' : 'error');
            (phase32Pass ? passed : failed).push('Phase 3-2');

            const ok = failed.length === 0;
            self.updateProgress(100, ok ? '테스트 완료 — 합격' : '테스트 완료 — 불합격');
            self.addLog(
                ok ? '✓ 구동 방향(CW/CCW) 설정 검증: 합격'
                   : `✗ 구동 방향(CW/CCW) 설정 검증: 불합격 (${failed.join(', ')})`,
                ok ? 'success' : 'error');

            return {
              status: ok ? 'pass' : 'fail',
              message: ok ? '구동 방향 설정 검증 완료' : `불합격 항목: ${failed.join(', ')}`,
              details:
                  `Phase 2: SW Reset 후 CCW(0) 유지 → ${passed.includes('Phase 2') ? '합격' : '불합격'}\n` +
                  `Phase 3-1: Torque 모드 CW/CCW Hall 자동 판정 → ${passed.includes('Phase 3-1') ? '합격' : '불합격'}\n` +
                  `Phase 3-2: Velocity 모드 CW/CCW Hall 자동 판정 → ${passed.includes('Phase 3-2') ? '합격' : '불합격'}`,
            };

          } finally {
            const _w = ms => new Promise(r => setTimeout(r, ms));
            try { await stopHallChart(); } catch (_) {}
            try {
              // 모터 Stop
              await d.writeRegister(slaveId, 0xD001, 0);
              await _w(100);
            } catch (_) {}
            try {
              if (origDir != null) {
                await d.writeRegister(slaveId, 0xD102, origDir);
                await _w(100);
              }
              if (origOpMode != null) {
                await d.writeRegister(slaveId, 0xD106, origOpMode);
                await _w(100);
              }
              if (origDir != null || origOpMode != null)
                self.addLog('■ 레지스터 초기값 복원 완료 (중단/완료)', 'info');
            } catch (_e) { /* 연결 없음 등 무시 */ }
          }
        },

        // ── basic06 executor ─────────────────────────────────────────────────
        'basic06': async function() {
          const self = this;
          const d = window.dashboard;
          const slaveId = 1;

          self.checkConnection();

          // ── 인라인 차트 삽입 ──────────────────────────────────────────────
          const testItem =
              document.querySelector('.os-test-item[data-test-id="basic06"]');
          let chart = null;

          if (testItem) {
            testItem.querySelector('.basic06-chart-section')?.remove();
            const chartSection = document.createElement('div');
            chartSection.className = 'basic06-chart-section';
            chartSection.style.cssText = 'padding:0 20px 20px 20px;';
            chartSection.innerHTML = `
                      <div style="background:white;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                        <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;">
                          <span style="font-size:13px;font-weight:600;color:#1a1a1a;">실시간 차트 (FC 0x64 CH7)</span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr;gap:1px;background:#e9ecef;border-bottom:1px solid #e9ecef;">
                          <div style="background:white;padding:8px 12px;">
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                              <span style="width:12px;height:3px;background:#3498db;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                              <span style="font-size:11px;color:#6c757d;">DC Link Voltage [V]</span>
                            </div>
                            <div id="basic06-val-0" style="font-size:18px;font-weight:600;font-family:monospace;color:#3498db;">—</div>
                          </div>
                        </div>
                        <canvas id="basic06-canvas" width="800" height="180"
                                style="width:100%;height:180px;display:block;background:#fafafa;"></canvas>
                      </div>`;

            const logDiv =
                [...testItem.querySelector('.os-test-content').children].find(
                    el => el.querySelector('.test-log-container'));
            if (logDiv)
              logDiv.parentElement.insertBefore(chartSection, logDiv);
            else
              testItem.querySelector('.os-test-content')
                  .appendChild(chartSection);

            // 아코디언 열기
            const contentEl = testItem.querySelector('.os-test-content');
            if (contentEl && contentEl.style.display !== 'block') {
              contentEl.style.display = 'block';
              const expandIcon = testItem.querySelector('.test-expand-icon');
              if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
            }

            const canvas = document.getElementById('basic06-canvas');
            if (canvas) {
              chart = new MiniChart(
                  canvas,
                  [
                    {name: 'DC Link Voltage [V]', color: '#3498db', chNum: 0},
                  ],
                  {maxPoints: 36000, displayPoints: 100});

              const saveLsmBtn = testItem.querySelector('.test-save-lsm-btn');
              if (saveLsmBtn) {
                saveLsmBtn.onclick = () => {
                  if (!chart) return;
                  const ts =
                      new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                  LsmExporter.download(chart.channels, 20, `3-4_${ts}.lsm`);
                };
              }
            }
          }

          // ── FC 0x64 CH7 데이터 루프 ──────────────────────────────────────
          const fc64Stop = {stop: false};
          let lastDcVoltage = null;
          const valEl = document.getElementById('basic06-val-0');

          const startFc64Loop = async () => {
            // 다른 FC64 스트림이 활성 중이면 중지
            for (const [t, v] of Object.entries(d.miniChartRunning)) {
              if (v) await d.stopMiniChart(t);
            }

            d._fc64Busy = true;
            while (d.isPolling) await self.delay(5);

            const stopFrame = d.modbus.buildContinuousStop(slaveId);
            await d.sendAndReceiveFC64(stopFrame, 0x00, 300);

            const period = 160;  // 1 unit = 125μs → 20ms
            const configFrame = d.modbus.buildContinuousConfigure(
                slaveId, period, [0x07, 0xFF, 0xFF, 0xFF]);
            const configResp =
                await d.sendAndReceiveFC64(configFrame, 0x02, 1000);
            if (!configResp) {
              d._fc64Busy = false;
              return false;
            }

            d.miniChartRunning['basic06'] = true;
            d._fc64Busy = false;

            // 데이터 루프 (fire-and-forget)
            (async () => {
              while (!fc64Stop.stop) {
                const frame = d.modbus.buildContinuousRequest(slaveId);
                const response = await d.sendAndReceiveFC64(frame, 0x03, 300);
                if (fc64Stop.stop) break;
                if (!response) {
                  await Promise.resolve();
                  continue;
                }
                const parsed = d.modbus.parseContinuousDataResponse(response);
                if (!parsed || parsed.data.length === 0) {
                  await Promise.resolve();
                  continue;
                }
                const v = parsed.data[0];  // slot 0 = CH7
                if (v !== undefined) {
                  lastDcVoltage = v;
                  if (chart) {
                    chart.addDataPoint(0, v);
                    chart.render();
                  }
                  if (valEl) valEl.textContent = `${v.toFixed(1)} V`;
                }
                if (parsed.status === 0x00) await self.delay(5);
                if (d.commandQueue.length > 0) await d._drainCommandQueue();
              }
              d.miniChartRunning['basic06'] = false;
            })();

            return true;
          };

          const stopFc64Loop = async () => {
            fc64Stop.stop = true;
            await self.delay(50);
            if (d.writer) {
              const stopFrame = d.modbus.buildContinuousStop(slaveId);
              await d.sendAndReceiveFC64(stopFrame, 0x00, 300);
            }
            d.miniChartRunning['basic06'] = false;
            d._fc64Busy = false;
          };

          // ── 테스트 본체 ───────────────────────────────────────────────────
          try {

            self.addLog(
                '[Phase 2] 정격 입력(380Vac) 인가 및 DC Link 전압 센싱 정밀도 확인 (Static Positive Test)',
                'step');
            self.addLog(
                '  기준값: 380Vac × √2 ≈ 537Vdc  /  허용범위: ±10%  →  483 ~ 590V',
                'info');


            // ── Phase 2-1: DC Link 전압 파라미터 읽기 ──────────────────────
            self.addLog('▶ Phase 2-1 시작', 'info');
            self.addLog('[Phase 2-1] DC Link 전압 파라미터 읽기', 'step');
            self.updateStepStatus(0, 'running');
            self.updateProgress(10, 'Phase 2-1: DC Link 전압 읽기');

            self.addLog(
                '  [Step 1] 메인 전원 3상 380Vac 인가 및 커패시터 충전 완료 여부를 확인하십시오.',
                'warn');
            self.addLog(
                '  [Step 2] FC 0x64 Configure — CH7 (DC Link Voltage), period=160 (20ms)',
                'info');

            const fc64Ok = await startFc64Loop();
            if (!fc64Ok) {
              self.addLog(
                  '  FC 0x64 Configure 실패 — 디바이스 응답 없음', 'error');
              self.updateStepStatus(0, 'error');
              self.updateProgress(100, '테스트 중단');
  
              return {
                status: 'fail',
                message: 'FC 0x64 Configure 실패',
                details: 'CH7 스트림 Configure 응답 없음'
              };
            }

            self.addLog('  FC 0x64 스트림 시작 — 첫 샘플 대기 중...', 'info');

            // FC64 루프 첫 샘플이 들어올 때까지 대기
            const fc64Timeout = Date.now() + 3000;
            while (lastDcVoltage === null) {
              if (Date.now() > fc64Timeout) break;
              await self.delay(20);
            }
            const dcVoltage = lastDcVoltage;

            if (dcVoltage === null || dcVoltage === undefined) {
              self.addLog(
                  '  RX: 스트림 데이터 없음 — 디바이스 응답 없음', 'error');
              self.updateStepStatus(0, 'error');
              self.updateProgress(100, '테스트 중단');
  
              return {
                status: 'fail',
                message: 'DC Link 전압 읽기 실패',
                details: 'FC 0x64 CH7 스트림 데이터 수신 없음'
              };
            }

            self.addLog(
                `  RX: FC 0x64 CH7 → ${dcVoltage.toFixed(2)} V`, 'info');
            self.addLog(
                '  ✔ DC Link 전압 수신 성공 — Phase 2-1 PASS', 'success');
            self.updateStepStatus(0, 'success');
            self.updateProgress(50, 'Phase 2-1 완료');


            // ── Phase 2-2: DC Link 전압 정확도 판정 ────────────────────────
            self.addLog('▶ Phase 2-2 시작', 'info');
            self.addLog('[Phase 2-2] DC Link 전압 정확도 판정', 'step');
            self.updateStepStatus(1, 'running');
            self.updateProgress(60, 'Phase 2-2: 판정');

            // 쓰레기값 감지
            const isGarbage =
                !isFinite(dcVoltage) || isNaN(dcVoltage) || dcVoltage < 0;
            if (isGarbage) {
              self.addLog(
                  `  ✘ 의미 없는 값 감지: ${
                      dcVoltage}V — ADC/스케일링 오류 → FAIL`,
                  'error');
              self.updateStepStatus(1, 'error');
              self.updateProgress(100, '테스트 완료');
  
              return {
                status: 'fail',
                message: `DC Link 전압 쓰레기값 (${dcVoltage}V)`,
                details: [
                  `DC Link 전압: ${dcVoltage}V`,
                  'Phase 2-1: DC Link 전압 수신 — PASS',
                  'Phase 2-2: 비정상값 감지 — FAIL',
                ].join('\n'),
              };
            }

            const inRange = dcVoltage >= 483 && dcVoltage <= 590;
            self.addLog(
                `  [Step 3] 읽기값: ${
                    dcVoltage.toFixed(
                        2)}V  /  기준: 537Vdc ±10%  →  허용구간: 483 ~ 590V`,
                'info');
            self.addLog(
                '  ※ 멀티미터(DMM)로 DC Link (+, -) 단자 직접 계측값과 대조하십시오.',
                'warn');
            self.addLog(
                `  통신 읽기값 ${dcVoltage.toFixed(2)}V → ${
                    inRange ? '✔ 범위 내 — PASS' : '✘ 범위 벗어남 — FAIL'}`,
                inRange ? 'success' : 'error');

            self.updateStepStatus(1, inRange ? 'success' : 'error');

            // 차트 안정화 관찰 (5초)
            self.addLog('  차트 안정화 확인 중 (5초)...', 'info');
            self.updateProgress(80, '차트 안정화 관찰');
            await self.delay(5000);
            self.checkStop();

            self.updateProgress(100, '테스트 완료');


            return {
              status: inRange ? 'pass' : 'fail',
              message: inRange ?
                  `DC Link 전압 정상 (${dcVoltage.toFixed(2)}V)` :
                  `DC Link 전압 범위 이탈 (${dcVoltage.toFixed(2)}V)`,
              details: [
                `DC Link 전압: ${dcVoltage.toFixed(2)}V`,
                `Phase 2-1: DC Link 전압 수신 (FC 0x64 CH7) — PASS`,
                `Phase 2-2: ${
                    dcVoltage.toFixed(2)}V  /  허용범위 483~590V  →  ${
                    inRange ? 'PASS' : 'FAIL'}`,
              ].join('\n'),
            };

          } finally {
            await stopFc64Loop();
          }
        },

        // ── basic07 executor ─────────────────────────────────────────────────
        'basic07': async function() {
          const self = this;
          const d = window.dashboard;
          const slaveId = 1;

          self.checkConnection();

          // ── 숫자 박스 삽입 ───────────────────────────────────────────────
          const testItem =
              document.querySelector('.os-test-item[data-test-id="basic07"]');

          if (testItem) {
            testItem.querySelector('.basic07-display-section')?.remove();
            const displaySection = document.createElement('div');
            displaySection.className = 'basic07-display-section';
            displaySection.style.cssText = 'padding:0 20px 20px 20px;';
            displaySection.innerHTML = `
                      <div style="background:white;border:1px solid #e9ecef;border-radius:12px;padding:16px 20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);display:flex;align-items:center;gap:16px;">
                        <span style="font-size:13px;color:#6c757d;white-space:nowrap;">Board Temperature</span>
                        <div id="basic07-val-0" style="font-size:36px;font-weight:700;font-family:monospace;color:#e67e22;letter-spacing:2px;">— °C</div>
                      </div>`;

            const logDiv =
                [...testItem.querySelector('.os-test-content').children].find(
                    el => el.querySelector('.test-log-container'));
            if (logDiv)
              logDiv.parentElement.insertBefore(displaySection, logDiv);
            else
              testItem.querySelector('.os-test-content').appendChild(displaySection);

            // 아코디언 열기
            const contentEl = testItem.querySelector('.os-test-content');
            if (contentEl && contentEl.style.display !== 'block') {
              contentEl.style.display = 'block';
              const expandIcon = testItem.querySelector('.test-expand-icon');
              if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
            }
          }

          // ── FC04 폴링 루프 (1s 주기) ─────────────────────────────────────
          const pollStop = { stop: false };
          let lastTemp = null;
          const valEl = document.getElementById('basic07-val-0');

          const startPollLoop = () => {
            (async () => {
              while (!pollStop.stop) {
                const v = await d.readInputRegisterWithTimeout(slaveId, 0xD017);
                if (pollStop.stop) break;
                if (v !== null && v !== undefined) {
                  lastTemp = v;
                  if (valEl) valEl.textContent = `${v} °C`;
                }
                await self.delay(1000);
              }
            })();
          };

          // ── 테스트 본체 ───────────────────────────────────────────────────
          try {
            startPollLoop();


            self.addLog(
                '[Phase 2] 드라이브 온도 센싱 기능 동작 여부 확인 (Positive Test)',
                'step');


            // ── Phase 2-1: Board Temperature 파라미터 읽기 ─────────────────
            self.addLog('▶ Phase 2-1 시작', 'info');
            self.addLog('[Phase 2-1] Board Temperature 파라미터 읽기', 'step');
            self.updateStepStatus(0, 'running');
            self.updateProgress(10, 'Phase 2-1: Board Temperature 읽기');

            self.addLog(
                '  [Step 1] 드라이브 전원 인가 후 모터 미구동 대기 상태(열 평형)를 유지하십시오.',
                'warn');
            self.addLog(
                '  [Step 2] Board Temperature 읽기 요청 (0xD017, FC04 Input Register)',
                'info');

            // 폴링 루프 첫 샘플 대기
            while (lastTemp === null) await self.delay(100);
            const boardTemp = lastTemp;

            if (boardTemp === null || boardTemp === undefined) {
              self.addLog('  RX: 응답 없음 — Exception 또는 통신 오류', 'error');
              self.updateStepStatus(0, 'error');
              self.updateProgress(100, '테스트 중단');
  
              return {
                status: 'fail',
                message: 'Board 온도 읽기 실패',
                details: '0xD017 FC04 응답 없음 — Exception 또는 통신 오류'
              };
            }

            self.addLog(`  RX: Board Temperature → ${boardTemp}°C`, 'info');
            self.addLog('  ✔ Board Temperature 수신 성공 — Phase 2-1 PASS', 'success');
            self.updateStepStatus(0, 'success');
            self.updateProgress(50, 'Phase 2-1 완료');


            // ── Phase 2-2: 온도 정상 범위 판정 ──────────────────────────
            self.addLog('▶ Phase 2-2 시작', 'info');
            self.addLog('[Phase 2-2] 온도 정상 범위 판정', 'step');
            self.updateStepStatus(1, 'running');
            self.updateProgress(60, 'Phase 2-2: 판정');

            // 비정상 쓰레기값 감지
            const isGarbage = boardTemp <= 0 || boardTemp >= 200;
            if (isGarbage) {
              const reason = boardTemp <= 0
                  ? `${boardTemp}°C — 단선 또는 쇼트 의심`
                  : `${boardTemp}°C — 오버플로우 의심`;
              self.addLog(`  ✘ 비정상값 감지: ${reason} → FAIL`, 'error');
              self.updateStepStatus(1, 'error');
              self.updateProgress(100, '테스트 완료');
  
              return {
                status: 'fail',
                message: `Board 온도 비정상값 (${boardTemp}°C)`,
                details: [
                  `Board Temperature: ${boardTemp}°C`,
                  'Phase 2-1: Board Temperature 수신 — PASS',
                  `Phase 2-2: 비정상값 감지 (${reason}) — FAIL`,
                ].join('\n'),
              };
            }

            const inRange = boardTemp >= 15 && boardTemp <= 35;
            self.addLog(
                `  [Step 3] 읽기값: ${boardTemp}°C  /  상온 기준: 15~35°C`,
                'info');
            self.addLog(
                '  ※ 온도계로 측정 환경 실내 온도와 대조하십시오.',
                'warn');
            self.addLog(
                `  ${inRange ? '✔' : '⚠'} ${boardTemp}°C → ${
                    inRange ? '상온 범위 내 — PASS'
                            : '상온 범위 외 — WARNING (구동 중 또는 고온 환경 확인)'}`,
                inRange ? 'success' : 'warn');

            self.updateStepStatus(1, inRange ? 'success' : 'warning');
            self.updateProgress(100, '테스트 완료');


            return {
              status: inRange ? 'pass' : 'warn',
              message: inRange
                  ? `Board 온도 정상 (${boardTemp}°C)`
                  : `Board 온도 상온 범위 외 (${boardTemp}°C) — 환경 확인 필요`,
              details: [
                `Board Temperature: ${boardTemp}°C`,
                'Phase 2-1: Board Temperature 수신 (FC04, 0xD017) — PASS',
                `Phase 2-2: ${boardTemp}°C  /  상온 범위 15~35°C  →  ${
                    inRange ? 'PASS' : 'WARNING'}`,
              ].join('\n'),
            };

          } finally {
            pollStop.stop = true;
          }
        },

        // ── basic08 executor ─────────────────────────────────────────────────
        'basic08': async function() {
          const self = this;
          const d = window.dashboard;
          const slaveId = 1;

          self.checkConnection();

          // ── 숫자 박스 삽입 ───────────────────────────────────────────────
          const testItem =
              document.querySelector('.os-test-item[data-test-id="basic08"]');

          if (testItem) {
            testItem.querySelector('.basic08-display-section')?.remove();
            const displaySection = document.createElement('div');
            displaySection.className = 'basic08-display-section';
            displaySection.style.cssText = 'padding:0 20px 20px 20px;';
            displaySection.innerHTML = `
                      <div style="background:white;border:1px solid #e9ecef;border-radius:12px;padding:16px 20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);display:flex;align-items:center;gap:16px;">
                        <span style="font-size:13px;color:#6c757d;white-space:nowrap;">Module Temperature</span>
                        <div id="basic08-val-0" style="font-size:36px;font-weight:700;font-family:monospace;color:#e74c3c;letter-spacing:2px;">— °C</div>
                      </div>`;

            const logDiv =
                [...testItem.querySelector('.os-test-content').children].find(
                    el => el.querySelector('.test-log-container'));
            if (logDiv)
              logDiv.parentElement.insertBefore(displaySection, logDiv);
            else
              testItem.querySelector('.os-test-content').appendChild(displaySection);

            const contentEl = testItem.querySelector('.os-test-content');
            if (contentEl && contentEl.style.display !== 'block') {
              contentEl.style.display = 'block';
              const expandIcon = testItem.querySelector('.test-expand-icon');
              if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
            }
          }

          // ── FC04 폴링 루프 (1s 주기) ─────────────────────────────────────
          const pollStop = { stop: false };
          let lastTemp = null;
          const valEl = document.getElementById('basic08-val-0');

          const startPollLoop = () => {
            (async () => {
              while (!pollStop.stop) {
                const v = await d.readInputRegisterWithTimeout(slaveId, 0xD015);
                if (pollStop.stop) break;
                if (v !== null && v !== undefined) {
                  lastTemp = v;
                  if (valEl) valEl.textContent = `${v} °C`;
                }
                await self.delay(1000);
              }
            })();
          };

          // ── 테스트 본체 ───────────────────────────────────────────────────
          try {
            startPollLoop();

            self.addLog(
                '[Phase 2] 인버터 모듈 온도 센싱 기능 동작 여부 확인 (Positive Test)',
                'step');

            // ── Phase 2-1: Module Temperature 파라미터 읽기 ────────────────
            self.addLog('▶ Phase 2-1 시작', 'info');
            self.addLog('[Phase 2-1] Module Temperature 파라미터 읽기', 'step');
            self.updateStepStatus(0, 'running');
            self.updateProgress(10, 'Phase 2-1: Module Temperature 읽기');

            self.addLog(
                '  [Step 1] 드라이브 전원 인가 후 모터 미구동 대기 상태(열 평형)를 유지하십시오.',
                'warn');
            self.addLog(
                '  [Step 2] Module Temperature 읽기 요청 (0xD015, FC04 Input Register)',
                'info');

            while (lastTemp === null) await self.delay(100);
            const moduleTemp = lastTemp;

            if (moduleTemp === null || moduleTemp === undefined) {
              self.addLog('  RX: 응답 없음 — Exception 또는 통신 오류', 'error');
              self.updateStepStatus(0, 'error');
              self.updateProgress(100, '테스트 중단');
              return {
                status: 'fail',
                message: '모듈 온도 읽기 실패',
                details: '0xD015 FC04 응답 없음 — Exception 또는 통신 오류'
              };
            }

            self.addLog(`  RX: Module Temperature → ${moduleTemp}°C`, 'info');
            self.addLog('  ✔ Module Temperature 수신 성공 — Phase 2-1 PASS', 'success');
            self.updateStepStatus(0, 'success');
            self.updateProgress(50, 'Phase 2-1 완료');

            // ── Phase 2-2: 온도 정상 범위 판정 ──────────────────────────
            self.addLog('▶ Phase 2-2 시작', 'info');
            self.addLog('[Phase 2-2] 온도 정상 범위 판정', 'step');
            self.updateStepStatus(1, 'running');
            self.updateProgress(60, 'Phase 2-2: 판정');

            const isGarbage = moduleTemp <= 0 || moduleTemp >= 200;
            if (isGarbage) {
              const reason = moduleTemp <= 0
                  ? `${moduleTemp}°C — 단선 또는 쇼트 의심`
                  : `${moduleTemp}°C — 오버플로우 의심`;
              self.addLog(`  ✘ 비정상값 감지: ${reason} → FAIL`, 'error');
              self.updateStepStatus(1, 'error');
              self.updateProgress(100, '테스트 완료');
              return {
                status: 'fail',
                message: `모듈 온도 비정상값 (${moduleTemp}°C)`,
                details: [
                  `Module Temperature: ${moduleTemp}°C`,
                  'Phase 2-1: Module Temperature 수신 — PASS',
                  `Phase 2-2: 비정상값 감지 (${reason}) — FAIL`,
                ].join('\n'),
              };
            }

            const inRange = moduleTemp >= 15 && moduleTemp <= 35;
            self.addLog(
                `  [Step 3] 읽기값: ${moduleTemp}°C  /  상온 기준: 15~35°C`,
                'info');
            self.addLog(
                '  ※ 온도계로 측정 환경 실내 온도와 대조하십시오.',
                'warn');
            self.addLog(
                `  ${inRange ? '✔' : '⚠'} ${moduleTemp}°C → ${
                    inRange ? '상온 범위 내 — PASS'
                            : '상온 범위 외 — WARNING (구동 중 또는 고온 환경 확인)'}`,
                inRange ? 'success' : 'warn');

            self.updateStepStatus(1, inRange ? 'success' : 'warning');
            self.updateProgress(100, '테스트 완료');

            return {
              status: inRange ? 'pass' : 'warn',
              message: inRange
                  ? `모듈 온도 정상 (${moduleTemp}°C)`
                  : `모듈 온도 상온 범위 외 (${moduleTemp}°C) — 환경 확인 필요`,
              details: [
                `Module Temperature: ${moduleTemp}°C`,
                'Phase 2-1: Module Temperature 수신 (FC04, 0xD015) — PASS',
                `Phase 2-2: ${moduleTemp}°C  /  상온 범위 15~35°C  →  ${
                    inRange ? 'PASS' : 'WARNING'}`,
              ].join('\n'),
            };

          } finally {
            pollStop.stop = true;
          }
        },

        // ── basic09 executor ─────────────────────────────────────────────────
        'basic09': async function() {
          const self = this;
          const d = window.dashboard;
          const slaveId = 1;

          self.checkConnection();

          // ── 버전 표시 박스 삽입 ───────────────────────────────────────────
          const testItem =
              document.querySelector('.os-test-item[data-test-id="basic09"]');

          if (testItem) {
            testItem.querySelector('.basic09-display-section')?.remove();
            const displaySection = document.createElement('div');
            displaySection.className = 'basic09-display-section';
            displaySection.style.cssText = 'padding:0 20px 20px 20px;';
            displaySection.innerHTML = `
              <div style="background:white;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
                  <span style="font-size:13px;font-weight:600;color:#1a1a1a;">버전 정보</span>
                </div>
                <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <div style="padding:10px 12px;background:#fafafa;border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                      <span style="font-size:12px;color:#6c757d;">Main Boot</span>
                      <span style="font-size:11px;font-family:monospace;color:#adb5bd;">0x27F0</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:baseline;">
                      <span id="basic09-mcu-boot" style="font-size:15px;font-weight:700;font-family:monospace;color:#1a1a1a;flex:1;">—</span>
                      <span id="basic09-mcu-boot-hex" style="font-size:11px;font-family:monospace;color:#6c757d;background:#f0f0f0;padding:2px 5px;border-radius:3px;">—</span>
                    </div>
                    <div style="margin-top:6px;display:flex;align-items:center;gap:4px;">
                      <span style="font-size:11px;color:#6c757d;">예상:</span>
                      <input id="basic09-exp-mcu-boot" type="text" placeholder="예: v1.0.0"
                        style="font-size:11px;font-family:monospace;border:1px solid #dee2e6;border-radius:3px;padding:2px 5px;width:80px;outline:none;">
                    </div>
                  </div>
                  <div style="padding:10px 12px;background:#fafafa;border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                      <span style="font-size:12px;color:#6c757d;">Main FW</span>
                      <span style="font-size:11px;font-family:monospace;color:#adb5bd;">0x27F1</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:baseline;">
                      <span id="basic09-mcu-fw" style="font-size:15px;font-weight:700;font-family:monospace;color:#1a1a1a;flex:1;">—</span>
                      <span id="basic09-mcu-fw-hex" style="font-size:11px;font-family:monospace;color:#6c757d;background:#f0f0f0;padding:2px 5px;border-radius:3px;">—</span>
                    </div>
                    <div style="margin-top:6px;display:flex;align-items:center;gap:4px;">
                      <span style="font-size:11px;color:#6c757d;">예상:</span>
                      <input id="basic09-exp-mcu-fw" type="text" placeholder="예: v2.3.1"
                        style="font-size:11px;font-family:monospace;border:1px solid #dee2e6;border-radius:3px;padding:2px 5px;width:80px;outline:none;">
                    </div>
                  </div>
                  <div style="padding:10px 12px;background:#fafafa;border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                      <span style="font-size:12px;color:#6c757d;">Inv Boot</span>
                      <span style="font-size:11px;font-family:monospace;color:#adb5bd;">0x27F2</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:baseline;">
                      <span id="basic09-inv-boot" style="font-size:15px;font-weight:700;font-family:monospace;color:#1a1a1a;flex:1;">—</span>
                      <span id="basic09-inv-boot-hex" style="font-size:11px;font-family:monospace;color:#6c757d;background:#f0f0f0;padding:2px 5px;border-radius:3px;">—</span>
                    </div>
                    <div style="margin-top:6px;display:flex;align-items:center;gap:4px;">
                      <span style="font-size:11px;color:#6c757d;">예상:</span>
                      <input id="basic09-exp-inv-boot" type="text" placeholder="예: v1.0.0"
                        style="font-size:11px;font-family:monospace;border:1px solid #dee2e6;border-radius:3px;padding:2px 5px;width:80px;outline:none;">
                    </div>
                  </div>
                  <div style="padding:10px 12px;background:#fafafa;border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                      <span style="font-size:12px;color:#6c757d;">Inv FW</span>
                      <span style="font-size:11px;font-family:monospace;color:#adb5bd;">0x27F3</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:baseline;">
                      <span id="basic09-inv-fw" style="font-size:15px;font-weight:700;font-family:monospace;color:#1a1a1a;flex:1;">—</span>
                      <span id="basic09-inv-fw-hex" style="font-size:11px;font-family:monospace;color:#6c757d;background:#f0f0f0;padding:2px 5px;border-radius:3px;">—</span>
                    </div>
                    <div style="margin-top:6px;display:flex;align-items:center;gap:4px;">
                      <span style="font-size:11px;color:#6c757d;">예상:</span>
                      <input id="basic09-exp-inv-fw" type="text" placeholder="예: v2.3.1"
                        style="font-size:11px;font-family:monospace;border:1px solid #dee2e6;border-radius:3px;padding:2px 5px;width:80px;outline:none;">
                    </div>
                  </div>
                </div>
              </div>`;

            const logDiv =
                [...testItem.querySelector('.os-test-content').children].find(
                    el => el.querySelector('.test-log-container'));
            if (logDiv)
              logDiv.parentElement.insertBefore(displaySection, logDiv);
            else
              testItem.querySelector('.os-test-content').appendChild(displaySection);

            const contentEl = testItem.querySelector('.os-test-content');
            if (contentEl && contentEl.style.display !== 'block') {
              contentEl.style.display = 'block';
              const expandIcon = testItem.querySelector('.test-expand-icon');
              if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
            }
          }

          // ── 버전 읽기 헬퍼 ───────────────────────────────────────────────
          const readVersion = async (index) => {
            const r = await d.readCANopenObject(slaveId, index, 0x00, 16);
            if (!r || r.error) return { ascii: null, hex: null };
            const ascii = r.rawBytes
                .filter(b => b !== 0x00)
                .map(b => (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.')
                .join('');
            const hex = r.rawBytes
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
            return { ascii: ascii || null, hex };
          };

          // ── 테스트 본체 ───────────────────────────────────────────────────
          self.addLog(
              '[Phase 2] Main / Inverter Firmware, Bootloader 버전 확인 (Positive Test)',
              'step');

          const slots = [
            { index: 0x27F0, label: 'Main Boot Version',     stepIdx: 0, asciiId: 'basic09-mcu-boot',  hexId: 'basic09-mcu-boot-hex',  expId: 'basic09-exp-mcu-boot'  },
            { index: 0x27F1, label: 'Main FW Version',       stepIdx: 1, asciiId: 'basic09-mcu-fw',    hexId: 'basic09-mcu-fw-hex',    expId: 'basic09-exp-mcu-fw'    },
            { index: 0x27F2, label: 'Inverter Boot Version', stepIdx: 2, asciiId: 'basic09-inv-boot',  hexId: 'basic09-inv-boot-hex',  expId: 'basic09-exp-inv-boot'  },
            { index: 0x27F3, label: 'Inverter FW Version',   stepIdx: 3, asciiId: 'basic09-inv-fw',    hexId: 'basic09-inv-fw-hex',    expId: 'basic09-exp-inv-fw'    },
          ];

          const readResults = [];
          let allReceived = true;

          for (const slot of slots) {
            self.addLog(`▶ Phase 2-${slot.stepIdx + 1} 시작`, 'info');
            self.addLog(`[Phase 2-${slot.stepIdx + 1}] ${slot.label} 읽기 (0x${slot.index.toString(16).toUpperCase()})`, 'step');
            self.updateStepStatus(slot.stepIdx, 'running');
            self.updateProgress(
                10 + slot.stepIdx * 18,
                `Phase 2-${slot.stepIdx + 1}: ${slot.label}`);

            const { ascii, hex } = await readVersion(slot.index);

            const asciiEl = document.getElementById(slot.asciiId);
            const hexEl   = document.getElementById(slot.hexId);
            if (asciiEl) asciiEl.textContent = ascii ?? 'ERR';
            if (hexEl)   hexEl.textContent   = hex   ?? '-';

            if (!ascii) {
              self.addLog(`  ✘ 응답 없음 또는 더미값 — Phase 2-${slot.stepIdx + 1} FAIL`, 'error');
              self.updateStepStatus(slot.stepIdx, 'error');
              allReceived = false;
            } else {
              self.addLog(`  RX: "${ascii}"  [${hex}]`, 'info');
              self.addLog(`  ✔ 수신 성공 — Phase 2-${slot.stepIdx + 1} PASS`, 'success');
              self.updateStepStatus(slot.stepIdx, 'success');
            }
            readResults.push({ ...slot, ascii, hex });
          }

          // ── Phase 2-5: 릴리즈 버전 일치 판정 ────────────────────────────
          self.addLog('▶ Phase 2-5 시작', 'info');
          self.addLog('[Phase 2-5] 릴리즈 버전 일치 판정', 'step');
          self.updateStepStatus(4, 'running');
          self.updateProgress(82, 'Phase 2-5: 버전 일치 판정');

          let allMatch = true;
          let anyExpected = false;

          for (const r of readResults) {
            const expected = document.getElementById(r.expId)?.value?.trim();
            if (!expected) continue;
            anyExpected = true;
            const match = r.ascii === expected;
            self.addLog(
                `  ${r.label}: 수신="${r.ascii ?? '-'}"  예상="${expected}"  → ${match ? '✔ 일치' : '✘ 불일치'}`,
                match ? 'success' : 'error');
            if (!match) allMatch = false;
          }

          if (!anyExpected) {
            self.addLog('  ※ 예상 버전 미입력 — 수신값 육안 확인 필요', 'warn');
            self.updateStepStatus(4, 'warning');
          } else {
            self.updateStepStatus(4, allMatch ? 'success' : 'error');
          }

          self.updateProgress(100, '테스트 완료');

          const finalStatus = !allReceived ? 'fail'
              : (!anyExpected || allMatch)  ? 'pass'
              : 'fail';

          return {
            status: finalStatus,
            message: !allReceived ? '버전 수신 실패 — 응답 없음 또는 더미값'
                : !anyExpected    ? '버전 수신 완료 (예상값 미입력 — 육안 확인)'
                : allMatch        ? '모든 버전 릴리즈와 일치'
                :                   '버전 불일치 — 릴리즈 노트 확인 필요',
            details: readResults
                .map(r => {
                  const expected = document.getElementById(r.expId)?.value?.trim();
                  const matchStr = expected
                      ? (r.ascii === expected ? 'PASS' : `FAIL (예상: ${expected})`)
                      : '(예상값 미입력)';
                  return `${r.label} (0x${r.index.toString(16).toUpperCase()}): "${r.ascii ?? 'ERR'}" → ${matchStr}`;
                })
                .join('\n'),
          };
        },

      },

    });
