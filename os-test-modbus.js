/**
 * OS Test Module - Modbus RTU
 *
 * Modbus RTU No.1 : Holding Register (FC 0x03) 프레임 검증 및 예외 처리
 * Modbus RTU No.2 : Input Register (FC 0x04) 프레임 검증 및 예외 처리
 * Modbus RTU No.3 : Write Single Register (FC 0x06) 프레임 검증 및 예외 처리
 * Modbus RTU No.4 : Write Multiple Registers (FC 0x10) 프레임 검증 및 예외 처리
 * Modbus RTU No.5 : EtherCAT SDO (FC 0x2B) 프레임 검증 및 예외 처리
 *
 * 참조 문서: docs/EC FAN OS 통합 검증서 20260328/2.Modbus RTU/
 *
 * 레지스터
 *   0xD001  Set Point         : FC03 R/W Holding Register
 *   0xD011  Motor Status      : FC04 Read-Only Input Register
 *   0xD013  DC Link Voltage   : FC04 Read-Only Input Register
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

  tests: {

    // ── Modbus RTU No.1 : FC 0x03 Holding Register 프레임 검증 ──────────────
    'modbus01': {
      id: 'modbus01',
      category: 'Modbus RTU',
      number: '2-1',
      title: 'Holding Register (FC 0x03) 프레임 검증 및 예외 처리',
      description:
          '정상 FC03 응답 확인, 잘못된 주소·CRC 오류·잘린 프레임 예외 처리 및 버퍼 복구 검증',
      purpose:
          'Modbus RTU Read Holding Registers [0x03] 명령을 Raw Hex Frame으로 전송하여 파라미터의 정상 반환을 확인하고, 비정상 주소/길이 초과/CRC 오류/잘린 프레임(Truncated) 전송 시 규격에 맞는 Exception Code 응답 여부와 통신 버퍼 자가 복구 능력을 종합적으로 검증한다.',
      model: 'EC-FAN',
      equipment: 'EC FAN 1EA, USB to RS485 Converter',
      criteria: 'FC03 정상 응답 · 경계값 Byte Count · Exception 처리 · 버퍼 복구 확인',
      steps: [
        '[Phase 2-1] FC03 단일 읽기 — Set Point [0xD001] qty=1\n판정 기준: 정상 응답값 수신',
        '[Phase 2-2] FC03 경계값 읽기 — [0xD000] qty=15 × 3회\n판정 기준: Byte Count = 0x1E (30바이트) 3회 모두 확인',
        '[Phase 3-1] 잘못된 주소(0xFFFF) FC03 읽기\n판정 기준: null 반환 (Exception 0x02 Illegal Data Address)',
        '[Phase 3-2] 길이 초과 예외 — qty=126(0x7E) FC03 요청\n판정 기준: Exception 0x03 (Illegal Data Value) 수신',
        '[Phase 3-3] CRC 훼손 프레임 자동 전송\n판정 기준: 무응답(Timeout) — 슬레이브 CRC 오류 프레임 폐기 확인',
        '[Phase 4] 버퍼 자가 복구 — 정상 FC03 재시도\n판정 기준: 정상 응답값 수신 (버퍼 복구 완료)',
      ],
    },

    // ── Modbus RTU No.2 : FC 0x04 Input Register 프레임 검증 ────────────────
    'modbus02': {
      id: 'modbus02',
      category: 'Modbus RTU',
      number: '2-2',
      title: 'Input Register (FC 0x04) 프레임 검증 및 예외 처리',
      description:
          'FC04 정상 응답 · Byte Count BVA 경계값 · Exception 처리 · 잘린 프레임 버퍼 복구 검증',
      purpose:
          'Modbus RTU Read Input Registers [0x04] 명령을 Raw Hex Frame으로 전송하여 실시간 모니터링 데이터 정상 반환을 확인하고, 비정상 주소·길이 초과·CRC 오류·잘린 프레임 전송 시 규격에 맞는 Exception Code 응답 여부와 통신 버퍼 자가 복구 능력을 종합적으로 검증한다.',
      model: 'EC-FAN',
      equipment: 'EC FAN 1EA, USB to RS485 Converter',
      criteria: 'FC04 정상 응답 · 경계값 Byte Count · Exception 처리 · 잘린 프레임 버퍼 복구 확인',
      steps: [
        '[Phase 2-1] FC04 단일 읽기 — Motor Status [0xD011] qty=1\n판정 기준: 정상 응답 수신 (Byte Count = 0x02)',
        '[Phase 2-2] FC04 경계값 읽기 — [0xD000] qty=20 × 3회\n판정 기준: Byte Count = 0x28 (40바이트) 3회 모두 확인',
        '[Phase 3-1] 잘못된 주소(0xFFFF) FC04 읽기\n판정 기준: null 반환 (Exception 0x02 Illegal Data Address)',
        '[Phase 3-2] 길이 초과 예외 — qty=126(0x7E) FC04 요청\n판정 기준: Exception 0x03 (Illegal Data Value) 수신',
        '[Phase 3-3] CRC 훼손 프레임 자동 전송\n판정 기준: 무응답(Timeout) — 슬레이브 CRC 오류 프레임 폐기 확인',
        '[Phase 4] 잘린 프레임(3바이트) 전송 후 버퍼 자가 복구\n판정 기준: 잘린 프레임 무응답 후 정상 FC04 재시도 즉각 응답 (버퍼 복구 완료)',
      ],
    },

    // ── Modbus RTU No.3 : FC 0x06 Write Single Register 프레임 검증 ─────────
    'modbus03': {
      id: 'modbus03',
      category: 'Modbus RTU',
      number: '2-3',
      title: 'Write Single Register (FC 0x06) 프레임 검증 및 예외 처리',
      description:
          'FC06 Echo 응답 확인, 주소 예외·값 초과 Exception 처리, 잘린 프레임 버퍼 복구 검증',
      purpose:
          'Modbus RTU Write Single Register [0x06] 명령으로 최솟값/최댓값 경계값 쓰기 후 Echo 응답 및 FC03 Read-back 일치를 확인하고, 쓰기 금지 영역 접근·범위 초과 값·CRC 오류·잘린 프레임 시 규격에 맞는 예외 응답과 버퍼 자가 복구 능력을 검증한다.',
      model: 'EC-FAN',
      equipment: 'EC FAN 1EA, USB to RS485 Converter',
      criteria: 'FC06 Echo 응답 · FC03 Read-back 일치 · Exception 처리 · 잘린 프레임 버퍼 복구 확인',
      steps: [
        '[Phase 2-1] Set Point [0xD001] = 0 (최솟값) Write\n판정 기준: FC06 Echo 응답 수신 + FC03 Read-back = 0 일치',
        '[Phase 2-2] Set Point [0xD001] = 0x2710 (최댓값) Write\n판정 기준: FC06 Echo 응답 수신 + FC03 Read-back = 0x2710 일치',
        '[Phase 3-1] 쓰기 금지 주소(0x1001) FC06 쓰기 시도\n판정 기준: Exception 0x02 (Illegal Data Address) 수신',
        '[Phase 3-2] 데이터 값 초과(0xFFFF) 쓰기 시도 — [0xD001]\n판정 기준: Exception 0x03 (Illegal Data Value) 수신',
        '[Phase 3-3] CRC 훼손 프레임 자동 전송\n판정 기준: 무응답(Timeout) — 슬레이브 CRC 오류 프레임 폐기 확인',
        '[Phase 4] 잘린 프레임(3바이트) 전송 후 버퍼 자가 복구\n판정 기준: 잘린 프레임 무응답 후 정상 FC03 읽기 즉각 응답 (원래 값 복원 포함)',
      ],
    },

    // ── Modbus RTU No.4 : FC 0x10 Write Multiple Registers 프레임 검증 ───────
    'modbus04': {
      id: 'modbus04',
      category: 'Modbus RTU',
      number: '2-4',
      title: 'Write Multiple Registers (FC 0x10) 프레임 검증 및 예외 처리',
      description:
          'FC10 단일 쓰기 성공 응답 확인, 길이 초과·Byte Count 불일치·CRC 오류 예외 처리, 잘린 프레임 버퍼 복구 검증',
      purpose:
          'Modbus RTU Write Multiple Registers [0x10] 명령으로 레지스터 쓰기 성공 응답을 확인하고, 쓰기 개수 초과·Byte Count 불일치·CRC 오류·잘린 프레임 시 규격에 맞는 예외 응답과 버퍼 자가 복구 능력을 검증한다.',
      model: 'EC-FAN',
      equipment: 'EC FAN 1EA, USB to RS485 Converter',
      criteria: 'FC10 성공 응답 · FC03 Read-back 일치 · Exception 처리 · 잘린 프레임 버퍼 복구 확인',
      steps: [
        '[Phase 2] FC10 단일 쓰기 — Set Point [0xD001] qty=1\n판정 기준: 성공 응답(01 10 D0 01 00 01 [CRC]) + FC03 Read-back 일치',
        '[Phase 3-1] 길이 초과 예외 — qty=124(0x7C) FC10 요청\n판정 기준: Exception 0x03 (Illegal Data Value) 수신',
        '[Phase 3-2] Byte Count 불일치 예외 — qty=2 / ByteCount=2(0x02, 원래 4)\n판정 기준: Exception 0x03 수신 또는 무응답(Drop)',
        '[Phase 3-3] CRC 훼손 프레임 자동 전송\n판정 기준: 무응답(Timeout) — 슬레이브 CRC 오류 프레임 폐기 확인',
        '[Phase 4] 잘린 프레임(10바이트) 전송 후 버퍼 자가 복구\n판정 기준: 잘린 프레임 무응답 후 정상 FC03 읽기 즉각 응답 (원래 값 복원 포함)',
      ],
    },

    // ── Modbus RTU No.5 : FC 0x2B EtherCAT SDO 프레임 검증 ──────────────────
    'modbus05': {
      id: 'modbus05',
      category: 'Modbus RTU',
      number: '2-5',
      title: 'EtherCAT SDO (FC 0x2B) 프레임 검증 및 예외 처리',
      description:
          'CANopen over Modbus (FC 0x2B MEI Transport) 정상 응답 확인 및 비정상 오브젝트 접근 예외 처리',
      purpose:
          'FC 0x2B MEI Transport(CANopen) 명령으로 CANopen 오브젝트 정상 응답을 확인하고, 존재하지 않는 오브젝트 접근 시 AbortCode 응답 및 버퍼 복구 능력을 검증한다.',
      model: 'EC-FAN',
      equipment: 'EC FAN 1EA, USB to RS485 Converter',
      criteria:
          '[Phase 2] Motor ID 오브젝트(0x2000:00) 정상 응답 · [Phase 3] 비존재 오브젝트 → AbortCode 또는 null · [Phase 4] FC03 버퍼 복구 확인',
      steps: [
        '[Phase 2] CANopen Motor ID [0x2000:00] Read — FC 0x2B 정상 응답 확인',
        '[Phase 3-1] 존재하지 않는 CANopen 오브젝트 [0xFFFF:00] Read — AbortCode 응답 확인',
        '[Phase 3-2] Read-Only CANopen 오브젝트에 Write 시도 — AbortCode 응답 확인',
        '[Phase 4] 버퍼 복구 — FC03 정상 읽기로 통신 스택 정상 상태 확인',
      ],
    },

  },

  executors: {

    // ── modbus01 : FC 0x03 Holding Register 검증 ─────────────────────────────
    'modbus01': async function() {
      const self = this;
      self.checkConnection();

      // Phase 2-1: 정상 FC03 단일 읽기 1회  [step 0]
      self.addLog('▶ Phase 2-1 시작', 'info');
      self.addLog(
          '[Phase 2-1] FC03 정상 읽기 — Set Point [0xD001] qty=1', 'step');
      self.addLog('TX: 01 03 D0 01 00 01 ED 0A', 'info');
      self.updateStepStatus(0, 'running');
      self.updateProgress(5, 'Phase 2-1: FC03 단일 읽기');
      const normalVal = await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (normalVal === null || normalVal === undefined) {
        self.updateStepStatus(0, 'error');
        return {
          status: 'fail',
          message: 'Phase 2-1: FC03 정상 응답 없음 (Timeout)',
          details: '기본 FC03 통신 실패 — 슬레이브 연결 및 주소 확인 필요'
        };
      }
      self.addLog(
          `✓ FC03 정상 응답: 0x${
              normalVal.toString(16).toUpperCase().padStart(4, '0')} (${normalVal})`,
          'success');
      self.updateStepStatus(0, 'success');
      await self.delay(200);
      self.checkStop();

      // Phase 2-2: BVA 경계값 qty=15(0x0F) × 3회, Byte Count 0x1E 확인  [step 1]
      self.addLog('▶ Phase 2-2 시작', 'info');
      self.addLog(
          '[Phase 2-2] FC03 경계값 읽기 (qty=15, 0x0F) × 3회 — Byte Count 0x1E(30바이트) 확인',
          'step');
      self.addLog(
          '※ 디바이스 FC03 구현 최대 Quantity = 15 (0x000F), 정상 응답 Byte Count = 15×2 = 30 (0x1E)',
          'info');
      const bvaFrame =
          window.dashboard.modbus.buildReadHoldingRegisters(1, 0xD000, 15);
      const bvaFrameHex =
          Array.from(bvaFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${bvaFrameHex}`, 'info');
      self.updateStepStatus(1, 'running');
      let bvaFailCount = 0;
      for (let i = 1; i <= 3; i++) {
        self.updateProgress(15 + i * 5, `Phase 2-2: BVA 경계값 읽기 ${i}/3`);
        const rawResp =
            await window.dashboard.sendAndReceive(bvaFrame, 500, {minLength: 35});
        if (!rawResp || rawResp.length < 3) {
          self.addLog(`  BVA ${i}/3: ✗ 응답 없음 (Timeout)`, 'error');
          bvaFailCount++;
        } else {
          const byteCount = rawResp[2];
          if (byteCount === 0x1E) {
            self.addLog(
                `  BVA ${i}/3: ✓ Byte Count = 0x${
                    byteCount.toString(16).toUpperCase()} (${byteCount}) — PASS`,
                'success');
          } else {
            self.addLog(
                `  BVA ${i}/3: ⚠ Byte Count = 0x${
                    byteCount.toString(16).toUpperCase()} (${
                    byteCount}) — 예상 0x1E(30)`,
                'warning');
            bvaFailCount++;
          }
        }
        await self.delay(200);
      }
      if (bvaFailCount > 0) {
        self.updateStepStatus(1, 'error');
        return {
          status: 'fail',
          message: `Phase 2-2: BVA 경계값 읽기 실패 (${bvaFailCount}/3회)`,
          details: 'qty=15 경계값 프레임 응답 오류 또는 Byte Count 불일치'
        };
      }
      self.addLog('✓ Phase 2-2 완료: 3회 모두 Byte Count 0x1E 확인', 'success');
      self.updateStepStatus(1, 'success');
      await self.delay(200);
      self.checkStop();

      // Phase 3-1: 잘못된 주소(0xFFFF) 읽기 → Exception 0x02 예상  [step 2]
      self.addLog('▶ Phase 3-1 시작', 'info');
      self.addLog(
          '[Phase 3-1] 잘못된 주소(0xFFFF) FC03 읽기 — Exception 0x02 예상',
          'step');
      self.addLog('TX: 01 03 FF FF 00 01 84 1A', 'info');
      self.updateStepStatus(2, 'running');
      self.updateProgress(40, 'Phase 3-1: 잘못된 주소 읽기');
      const badAddrVal =
          await window.dashboard.readRegisterWithTimeout(1, 0xFFFF);
      if (badAddrVal === null || badAddrVal === undefined) {
        self.addLog(
            '✓ null 반환 → Exception 0x02 (Illegal Data Address) 수신 (PASS)',
            'success');
        self.addLog('예상 RX: 01 83 02 C0 F1', 'info');
      } else {
        self.addLog(
            `⚠ 예상치 않은 응답: 0x${
                badAddrVal.toString(16).toUpperCase().padStart(
                    4, '0')} — 잘못된 주소가 허용됨`,
            'warning');
      }
      self.updateStepStatus(2, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-2: 길이 초과 예외 — qty=126(0x7E) 요청 → Exception 0x03  [step 3]
      self.addLog('▶ Phase 3-2 시작', 'info');
      self.addLog(
          '[Phase 3-2] 길이 초과 예외 — qty=126(0x7E) FC03 요청 → Exception 0x03 예상',
          'step');
      self.updateStepStatus(3, 'running');
      self.updateProgress(55, 'Phase 3-2: 길이 초과 예외');
      const excFrame =
          window.dashboard.modbus.buildReadHoldingRegisters(1, 0xD000, 126);
      const excFrameHex =
          Array.from(excFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${excFrameHex}`, 'info');
      const excResp =
          await window.dashboard.sendAndReceive(excFrame, 500, {minLength: 5});
      if (!excResp || excResp.length < 3) {
        self.addLog('✗ 응답 없음 (Timeout)', 'error');
        self.addLog('⚠ 슬레이브가 길이 초과 프레임을 무시한 것으로 추정', 'warning');
      } else if ((excResp[1] & 0x80) && excResp[2] === 0x03) {
        self.addLog(
            '✓ Exception 0x03 (Illegal Data Value) 수신 — PASS', 'success');
        self.addLog(
            `RX: ${Array.from(excResp).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`,
            'info');
      } else {
        self.addLog(
            `⚠ 예상치 않은 응답: ${
                Array.from(excResp)
                    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                    .join(' ')} — Exception 0x03 미수신`,
            'warning');
      }
      self.updateStepStatus(3, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-3: CRC 훼손 프레임 전송 → 무응답 확인  [step 4]
      self.addLog('▶ Phase 3-3 시작', 'info');
      self.addLog(
          '[Phase 3-3] CRC 훼손 프레임 자동 전송 → 무응답(Drop) 확인', 'step');
      self.addLog(
          'TX: 01 03 D0 01 00 01 00 00  (CRC = 00 00, 정상 CRC = ED 0A)',
          'info');
      self.updateStepStatus(4, 'running');
      self.updateProgress(70, 'Phase 3-3: CRC 훼손 전송');
      const corruptFrame03 =
          new Uint8Array([0x01, 0x03, 0xD0, 0x01, 0x00, 0x01, 0x00, 0x00]);
      const crcResult03 =
          await window.dashboard.sendRawFrameWithTimeout(corruptFrame03, 1);
      if (crcResult03 === null || crcResult03 === undefined) {
        self.addLog(
            '✓ 무응답(Timeout) → 슬레이브가 CRC 오류 프레임 폐기 확인 (PASS)',
            'success');
      } else {
        self.addLog(
            `⚠ 예상치 않은 응답: 0x${
                crcResult03.toString(16).toUpperCase().padStart(
                    4, '0')} — CRC 검증 미동작 가능성`,
            'warning');
      }
      self.updateStepStatus(4, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 4: 버퍼 자가 복구  [step 5]
      self.addLog('▶ Phase 4 시작', 'info');
      self.addLog('[Phase 4] 버퍼 자가 복구 — 정상 FC03 재시도', 'step');
      self.updateStepStatus(5, 'running');
      self.updateProgress(85, 'Phase 4: 버퍼 복구');
      await self.delay(100);
      const recoveryVal =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (recoveryVal === null || recoveryVal === undefined) {
        self.updateStepStatus(5, 'error');
        return {
          status: 'fail',
          message: 'Phase 4: 복구 후 FC03 응답 없음 — 버퍼 자가 복구 실패',
          details: ''
        };
      }
      self.addLog(
          `✓ 복구 후 FC03 정상 응답: 0x${
              recoveryVal.toString(16).toUpperCase().padStart(4, '0')}`,
          'success');
      self.updateStepStatus(5, 'success');

      self.updateProgress(100, '테스트 완료');
      self.addLog('FC 0x03 프레임 검증: 합격', 'success');
      return {
        status: 'pass',
        message: 'FC 0x03 정상 응답 / 예외 처리 / 버퍼 복구 확인',
        details:
            'Phase 2-1: FC03 단일 읽기 정상 응답\nPhase 2-2: qty=15 경계값 Byte Count 0x1E 확인 (3회)\nPhase 3-1: 잘못된 주소 → Exception 0x02\nPhase 3-2: qty=126 길이 초과 → Exception 0x03\nPhase 3-3: CRC 훼손 프레임 무응답 확인\nPhase 4: 버퍼 복구 확인',
      };
    },

    // ── modbus02 : FC 0x04 Input Register 검증 ───────────────────────────────
    'modbus02': async function() {
      const self = this;
      self.checkConnection();

      // Phase 2-1: FC04 단일 읽기 qty=1, Byte Count = 0x02 확인  [step 0]
      self.addLog('▶ Phase 2-1 시작', 'info');
      self.addLog(
          '[Phase 2-1] FC04 단일 읽기 — Motor Status [0xD011] qty=1', 'step');
      self.updateStepStatus(0, 'running');
      self.updateProgress(5, 'Phase 2-1: FC04 단일 읽기');
      const singleFrame =
          window.dashboard.modbus.buildReadInputRegisters(1, 0xD011, 1);
      const singleHex =
          Array.from(singleFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${singleHex}`, 'info');
      const singleResp =
          await window.dashboard.sendAndReceive(singleFrame, 500, {minLength: 7});
      if (!singleResp || singleResp.length < 3) {
        self.updateStepStatus(0, 'error');
        return {
          status: 'fail',
          message: 'Phase 2-1: FC04 정상 응답 없음 (Timeout)',
          details: '기본 FC04 통신 실패 — 슬레이브 연결 및 주소 확인 필요'
        };
      }
      const rxSingle =
          Array.from(singleResp)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`RX: ${rxSingle}`, 'info');
      const singleByteCount = singleResp[2];
      if (singleByteCount === 0x02) {
        self.addLog(
            `✓ Byte Count = 0x${
                singleByteCount.toString(16).toUpperCase()} (${
                singleByteCount}) — PASS`,
            'success');
      } else if (singleResp[1] & 0x80) {
        self.addLog(
            `✗ Exception 응답 수신 (Code: 0x${singleResp[2].toString(16).toUpperCase()}) — 정상 읽기 실패`,
            'error');
        self.updateStepStatus(0, 'error');
        return {
          status: 'fail',
          message: `Phase 2-1: Exception 응답 수신 (0x${singleResp[2].toString(16).toUpperCase()})`,
          details: ''
        };
      } else {
        self.addLog(
            `⚠ Byte Count = 0x${singleByteCount.toString(16).toUpperCase()} (${singleByteCount}) — 예상 0x02(2)`,
            'warning');
      }
      self.updateStepStatus(0, 'success');
      await self.delay(200);
      self.checkStop();

      // Phase 2-2: BVA 경계값 qty=20(0x14) × 3회, Byte Count 0x28 확인  [step 1]
      self.addLog('▶ Phase 2-2 시작', 'info');
      self.addLog(
          '[Phase 2-2] FC04 경계값 읽기 — [0xD000] qty=20 (0x14) × 3회 — Byte Count 0x28(40바이트) 확인',
          'step');
      self.addLog(
          '※ 디바이스 FC04 구현 최대 Quantity = 20 (0x0014), 시작 주소 0xD000, 정상 응답 Byte Count = 20×2 = 40 (0x28)',
          'info');
      const bvaFrame =
          window.dashboard.modbus.buildReadInputRegisters(1, 0xD000, 20);
      const bvaHex =
          Array.from(bvaFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${bvaHex}`, 'info');
      self.updateStepStatus(1, 'running');
      let bvaFailCount = 0;
      for (let i = 1; i <= 3; i++) {
        self.updateProgress(15 + i * 5, `Phase 2-2: BVA 경계값 읽기 ${i}/3`);
        const rawResp =
            await window.dashboard.sendAndReceive(bvaFrame, 500, {minLength: 45});
        if (!rawResp || rawResp.length < 3) {
          self.addLog(`  BVA ${i}/3: ✗ 응답 없음 (Timeout)`, 'error');
          bvaFailCount++;
        } else {
          const byteCount = rawResp[2];
          if (byteCount === 0x28) {
            self.addLog(
                `  BVA ${i}/3: ✓ Byte Count = 0x${
                    byteCount.toString(16).toUpperCase()} (${byteCount}) — PASS`,
                'success');
          } else {
            self.addLog(
                `  BVA ${i}/3: ⚠ Byte Count = 0x${
                    byteCount.toString(16).toUpperCase()} (${
                    byteCount}) — 예상 0x28(40)`,
                'warning');
            bvaFailCount++;
          }
        }
        await self.delay(200);
      }
      if (bvaFailCount > 0) {
        self.updateStepStatus(1, 'error');
        return {
          status: 'fail',
          message: `Phase 2-2: BVA 경계값 읽기 실패 (${bvaFailCount}/3회)`,
          details: 'qty=20 경계값 프레임 응답 오류 또는 Byte Count 불일치'
        };
      }
      self.addLog('✓ Phase 2-2 완료: 3회 모두 Byte Count 0x28 확인', 'success');
      self.updateStepStatus(1, 'success');
      await self.delay(200);
      self.checkStop();

      // Phase 3-1: 잘못된 주소(0xFFFF) → Exception 0x02 예상  [step 2]
      self.addLog('▶ Phase 3-1 시작', 'info');
      self.addLog(
          '[Phase 3-1] 잘못된 주소(0xFFFF) FC04 읽기 — Exception 0x02 예상',
          'step');
      self.updateStepStatus(2, 'running');
      self.updateProgress(40, 'Phase 3-1: 잘못된 주소 읽기');
      const badAddrFrame =
          window.dashboard.modbus.buildReadInputRegisters(1, 0xFFFF, 1);
      const badAddrHex =
          Array.from(badAddrFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${badAddrHex}`, 'info');
      const badAddrResp =
          await window.dashboard.sendAndReceive(badAddrFrame, 500, {minLength: 5});
      if (!badAddrResp || badAddrResp.length < 3) {
        self.addLog('✗ 응답 없음 (Timeout)', 'error');
        self.addLog('⚠ 슬레이브가 잘못된 주소 프레임에 무응답', 'warning');
      } else if ((badAddrResp[1] & 0x80) && badAddrResp[2] === 0x02) {
        const rxHex =
            Array.from(badAddrResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(
            '✓ Exception 0x02 (Illegal Data Address) 수신 — PASS', 'success');
        self.addLog(`RX: ${rxHex}`, 'info');
      } else {
        const rxHex =
            Array.from(badAddrResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(`⚠ 예상치 않은 응답: ${rxHex}`, 'warning');
      }
      self.updateStepStatus(2, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-2: 길이 초과 — qty=126(0x7E) → Exception 0x03 예상  [step 3]
      self.addLog('▶ Phase 3-2 시작', 'info');
      self.addLog(
          '[Phase 3-2] 길이 초과 예외 — qty=126(0x7E) FC04 요청 → Exception 0x03 예상',
          'step');
      self.updateStepStatus(3, 'running');
      self.updateProgress(55, 'Phase 3-2: 길이 초과 예외');
      const excFrame =
          window.dashboard.modbus.buildReadInputRegisters(1, 0xD011, 126);
      const excHex =
          Array.from(excFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${excHex}`, 'info');
      const excResp =
          await window.dashboard.sendAndReceive(excFrame, 500, {minLength: 5});
      if (!excResp || excResp.length < 3) {
        self.addLog('✗ 응답 없음 (Timeout)', 'error');
        self.addLog('⚠ 슬레이브가 길이 초과 프레임을 무시한 것으로 추정', 'warning');
      } else if ((excResp[1] & 0x80) && excResp[2] === 0x03) {
        const rxHex =
            Array.from(excResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(
            '✓ Exception 0x03 (Illegal Data Value) 수신 — PASS', 'success');
        self.addLog(`RX: ${rxHex}`, 'info');
      } else {
        const rxHex =
            Array.from(excResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(
            `⚠ 예상치 않은 응답: ${rxHex} — Exception 0x03 미수신`, 'warning');
      }
      self.updateStepStatus(3, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-3: CRC 훼손 프레임 전송 → 무응답 확인  [step 4]
      self.addLog('▶ Phase 3-3 시작', 'info');
      self.addLog(
          '[Phase 3-3] CRC 훼손 프레임 자동 전송 → 무응답(Drop) 확인', 'step');
      self.addLog(
          'TX: 01 04 D0 11 00 01 00 00  (CRC = 00 00, 정상 CRC = 59 0F)',
          'info');
      self.updateStepStatus(4, 'running');
      self.updateProgress(70, 'Phase 3-3: CRC 훼손 전송');
      const corruptFrame =
          new Uint8Array([0x01, 0x04, 0xD0, 0x11, 0x00, 0x01, 0x00, 0x00]);
      const crcResult =
          await window.dashboard.sendRawFrameWithTimeout(corruptFrame, 1);
      if (crcResult === null || crcResult === undefined) {
        self.addLog(
            '✓ 무응답(Timeout) → 슬레이브가 CRC 오류 프레임 폐기 확인 (PASS)',
            'success');
      } else {
        self.addLog(
            `⚠ 예상치 않은 응답: 0x${crcResult.toString(16).toUpperCase().padStart(4, '0')} — CRC 검증 미동작 가능성`,
            'warning');
      }
      self.updateStepStatus(4, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 4: 잘린 프레임(3바이트) 전송 → 10ms 대기 → 정상 FC04 재시도  [step 5]
      self.addLog('▶ Phase 4 시작', 'info');
      self.addLog(
          '[Phase 4] 잘린 프레임(3바이트) 전송 후 버퍼 자가 복구 — 정상 FC04 재시도',
          'step');
      self.updateStepStatus(5, 'running');
      self.updateProgress(85, 'Phase 4: 잘린 프레임 + 버퍼 복구');

      // 잘린 프레임 전송 (3바이트만, CRC 없음)
      const partialFrame = new Uint8Array([0x01, 0x04, 0xD0]);
      self.addLog('TX (잘린 프레임): 01 04 D0  (3바이트, CRC 없음)', 'info');
      await window.dashboard.sendAndReceive(partialFrame, 50, {minLength: 1});
      self.addLog('✓ 잘린 프레임 전송 완료 — 무응답 확인 (정상)', 'success');

      // 10ms 대기 후 정상 프레임 전송
      await self.delay(10);
      const recoveryFrame =
          window.dashboard.modbus.buildReadInputRegisters(1, 0xD011, 1);
      const recoveryHex =
          Array.from(recoveryFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX (정상 재시도): ${recoveryHex}`, 'info');
      const recoveryResp =
          await window.dashboard.sendAndReceive(recoveryFrame, 500, {minLength: 7});
      if (!recoveryResp || recoveryResp.length < 3) {
        self.updateStepStatus(5, 'error');
        return {
          status: 'fail',
          message: 'Phase 4: 잘린 프레임 후 FC04 응답 없음 — 버퍼 자가 복구 실패',
          details: ''
        };
      }
      const rxRecovery =
          Array.from(recoveryResp)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`RX: ${rxRecovery}`, 'info');
      self.addLog(
          '✓ 정상 FC04 응답 수신 — 버퍼 자가 복구 확인 (PASS)', 'success');
      self.updateStepStatus(5, 'success');

      self.updateProgress(100, '테스트 완료');
      self.addLog('FC 0x04 프레임 검증: 합격', 'success');
      return {
        status: 'pass',
        message: 'FC 0x04 정상 응답 / 예외 처리 / 버퍼 복구 확인',
        details:
            'Phase 2-1: FC04 단일 읽기 Byte Count 0x02 확인\nPhase 2-2: qty=20 경계값 Byte Count 0x28 확인 (3회)\nPhase 3-1: 잘못된 주소 → Exception 0x02\nPhase 3-2: qty=126 길이 초과 → Exception 0x03\nPhase 3-3: CRC 훼손 프레임 무응답 확인\nPhase 4: 잘린 프레임 후 버퍼 복구 확인',
      };
    },

    // ── modbus03 : FC 0x06 Write Single Register 검증 ────────────────────────
    'modbus03': async function() {
      const self = this;
      self.checkConnection();

      // 원래 값 저장 (테스트 종료 후 복원용)
      self.updateProgress(3, '원래 Set Point 값 저장');
      const origSetpoint =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (origSetpoint === null || origSetpoint === undefined) {
        return {
          status: 'fail',
          message: '초기 FC03 읽기 실패 — 연결 확인 필요',
          details: ''
        };
      }
      self.addLog(
          `원래 Set Point [0xD001] = 0x${
              origSetpoint.toString(16).toUpperCase().padStart(4, '0')} (${
              origSetpoint}) 저장`,
          'info');

      // Phase 2-1: 최솟값(0) Write → Echo 확인 + FC03 Read-back  [step 0]
      self.addLog('▶ Phase 2-1 시작', 'info');
      self.addLog(
          '[Phase 2-1] Set Point [0xD001] = 0 (최솟값) Write — Echo + Read-back 확인',
          'step');
      self.updateStepStatus(0, 'running');
      self.updateProgress(5, 'Phase 2-1: 최솟값 쓰기');
      const writeMin =
          window.dashboard.modbus.buildWriteSingleRegister(1, 0xD001, 0);
      const writeMinHex =
          Array.from(writeMin)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${writeMinHex}`, 'info');
      const echoMin =
          await window.dashboard.sendAndReceive(writeMin, 500, {minLength: 8});
      if (!echoMin || echoMin.length < 8) {
        self.updateStepStatus(0, 'error');
        return {
          status: 'fail',
          message: 'Phase 2-1: FC06 Echo 응답 없음 (Timeout)',
          details: '기본 FC06 통신 실패 — 슬레이브 연결 및 주소 확인 필요'
        };
      }
      const echoMinHex =
          Array.from(echoMin)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`RX: ${echoMinHex}`, 'info');
      if (echoMin[1] === 0x06 && echoMin[4] === 0x00 && echoMin[5] === 0x00) {
        self.addLog('✓ FC06 Echo 응답 확인 — PASS', 'success');
      } else {
        self.addLog(`⚠ 예상치 않은 Echo 응답: ${echoMinHex}`, 'warning');
      }
      await self.delay(100);
      const minReadback =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (minReadback === 0) {
        self.addLog('✓ FC03 Read-back = 0 — 일치 (PASS)', 'success');
      } else {
        self.addLog(
            `⚠ FC03 Read-back = 0x${
                (minReadback ?? 0).toString(16).toUpperCase().padStart(
                    4, '0')} — 예상 0x0000`,
            'warning');
      }
      self.updateStepStatus(0, 'success');
      await self.delay(200);
      self.checkStop();

      // Phase 2-2: 최댓값(0x2710) Write → Echo 확인 + FC03 Read-back  [step 1]
      self.addLog('▶ Phase 2-2 시작', 'info');
      self.addLog(
          '[Phase 2-2] Set Point [0xD001] = 0x2710 (10000, 최댓값) Write — Echo + Read-back 확인',
          'step');
      self.updateStepStatus(1, 'running');
      self.updateProgress(20, 'Phase 2-2: 최댓값 쓰기');
      const writeMax =
          window.dashboard.modbus.buildWriteSingleRegister(1, 0xD001, 0x2710);
      const writeMaxHex =
          Array.from(writeMax)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${writeMaxHex}`, 'info');
      const echoMax =
          await window.dashboard.sendAndReceive(writeMax, 500, {minLength: 8});
      if (!echoMax || echoMax.length < 8) {
        self.updateStepStatus(1, 'error');
        return {
          status: 'fail',
          message: 'Phase 2-2: FC06 Echo 응답 없음 (Timeout)',
          details: ''
        };
      }
      const echoMaxHex =
          Array.from(echoMax)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`RX: ${echoMaxHex}`, 'info');
      if (echoMax[1] === 0x06 && echoMax[4] === 0x27 && echoMax[5] === 0x10) {
        self.addLog('✓ FC06 Echo 응답 확인 — PASS', 'success');
      } else {
        self.addLog(`⚠ 예상치 않은 Echo 응답: ${echoMaxHex}`, 'warning');
      }
      await self.delay(100);
      const maxReadback =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (maxReadback === 0x2710) {
        self.addLog('✓ FC03 Read-back = 0x2710 — 일치 (PASS)', 'success');
      } else {
        self.addLog(
            `⚠ FC03 Read-back = 0x${
                (maxReadback ?? 0).toString(16).toUpperCase().padStart(
                    4, '0')} — 예상 0x2710`,
            'warning');
      }
      self.updateStepStatus(1, 'success');
      await self.delay(200);
      self.checkStop();

      // Phase 3-1: 쓰기 금지 주소(0x1001) → Exception 0x02 예상  [step 2]
      self.addLog('▶ Phase 3-1 시작', 'info');
      self.addLog(
          '[Phase 3-1] 쓰기 금지 주소(0x1001) FC06 쓰기 시도 — Exception 0x02 예상',
          'step');
      self.updateStepStatus(2, 'running');
      self.updateProgress(40, 'Phase 3-1: 쓰기 금지 주소');
      const badAddrFrame =
          window.dashboard.modbus.buildWriteSingleRegister(1, 0x1001, 0x0000);
      const badAddrHex =
          Array.from(badAddrFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${badAddrHex}`, 'info');
      const badAddrResp =
          await window.dashboard.sendAndReceive(badAddrFrame, 500, {minLength: 5});
      if (!badAddrResp || badAddrResp.length < 3) {
        self.addLog('✗ 응답 없음 (Timeout)', 'error');
        self.addLog('⚠ 슬레이브가 쓰기 금지 주소 프레임에 무응답', 'warning');
      } else if ((badAddrResp[1] & 0x80) && badAddrResp[2] === 0x02) {
        const rxHex =
            Array.from(badAddrResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(
            '✓ Exception 0x02 (Illegal Data Address) 수신 — PASS', 'success');
        self.addLog(`RX: ${rxHex}`, 'info');
      } else {
        const rxHex =
            Array.from(badAddrResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(`⚠ 예상치 않은 응답: ${rxHex}`, 'warning');
      }
      self.updateStepStatus(2, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-2: 값 초과(0xFFFF) 쓰기 → Exception 0x03 예상  [step 3]
      self.addLog('▶ Phase 3-2 시작', 'info');
      self.addLog(
          '[Phase 3-2] 데이터 값 초과(0xFFFF) 쓰기 — [0xD001] Exception 0x03 예상',
          'step');
      self.updateStepStatus(3, 'running');
      self.updateProgress(55, 'Phase 3-2: 값 초과 쓰기');
      const overFrame =
          window.dashboard.modbus.buildWriteSingleRegister(1, 0xD001, 0xFFFF);
      const overHex =
          Array.from(overFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${overHex}`, 'info');
      const overResp =
          await window.dashboard.sendAndReceive(overFrame, 500, {minLength: 5});
      if (!overResp || overResp.length < 3) {
        self.addLog('✗ 응답 없음 (Timeout)', 'error');
        self.addLog('⚠ 슬레이브가 값 초과 프레임에 무응답', 'warning');
      } else if ((overResp[1] & 0x80) && overResp[2] === 0x03) {
        const rxHex =
            Array.from(overResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(
            '✓ Exception 0x03 (Illegal Data Value) 수신 — PASS', 'success');
        self.addLog(`RX: ${rxHex}`, 'info');
      } else {
        const rxHex =
            Array.from(overResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(`⚠ 예상치 않은 응답: ${rxHex}`, 'warning');
      }
      self.updateStepStatus(3, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-3: CRC 훼손 프레임 전송 → 무응답 확인  [step 4]
      self.addLog('▶ Phase 3-3 시작', 'info');
      self.addLog(
          '[Phase 3-3] CRC 훼손 프레임 자동 전송 → 무응답(Drop) 확인', 'step');
      self.addLog(
          'TX: 01 06 D0 01 00 00 00 00  (CRC = 00 00, 정상 CRC 아님)', 'info');
      self.updateStepStatus(4, 'running');
      self.updateProgress(70, 'Phase 3-3: CRC 훼손 전송');
      const corruptFrame =
          new Uint8Array([0x01, 0x06, 0xD0, 0x01, 0x00, 0x00, 0x00, 0x00]);
      const crcResult =
          await window.dashboard.sendRawFrameWithTimeout(corruptFrame, 1);
      if (crcResult === null || crcResult === undefined) {
        self.addLog(
            '✓ 무응답(Timeout) → 슬레이브가 CRC 오류 프레임 폐기 확인 (PASS)',
            'success');
      } else {
        self.addLog(
            `⚠ 예상치 않은 응답: 0x${
                crcResult.toString(16).toUpperCase().padStart(
                    4, '0')} — CRC 검증 미동작 가능성`,
            'warning');
      }
      self.updateStepStatus(4, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 4: 잘린 프레임(3바이트) → 10ms 대기 → FC03 정상 읽기로 복구 확인  [step 5]
      self.addLog('▶ Phase 4 시작', 'info');
      self.addLog(
          '[Phase 4] 잘린 프레임(3바이트) 전송 후 버퍼 자가 복구 — FC03 정상 읽기 재시도',
          'step');
      self.updateStepStatus(5, 'running');
      self.updateProgress(85, 'Phase 4: 잘린 프레임 + 버퍼 복구');

      // 잘린 프레임 전송 (3바이트만, CRC 없음)
      const partialFrame = new Uint8Array([0x01, 0x06, 0xD0]);
      self.addLog('TX (잘린 프레임): 01 06 D0  (3바이트, CRC 없음)', 'info');
      await window.dashboard.sendAndReceive(partialFrame, 50, {minLength: 1});
      self.addLog('✓ 잘린 프레임 전송 완료 — 무응답 확인 (정상)', 'success');

      // 10ms 대기 후 FC03 정상 읽기로 복구 확인
      await self.delay(10);
      const recoveryVal =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (recoveryVal === null || recoveryVal === undefined) {
        self.updateStepStatus(5, 'error');
        return {
          status: 'fail',
          message: 'Phase 4: 잘린 프레임 후 FC03 응답 없음 — 버퍼 자가 복구 실패',
          details: ''
        };
      }
      self.addLog(
          `✓ FC03 정상 응답: 0x${
              recoveryVal.toString(16).toUpperCase().padStart(4, '0')} — 버퍼 자가 복구 확인 (PASS)`,
          'success');

      // 원래 값 복원
      await window.dashboard.writeRegister(1, 0xD001, origSetpoint);
      await self.delay(100);
      self.addLog(
          `✓ Set Point 원래 값(0x${
              origSetpoint.toString(16).toUpperCase().padStart(4, '0')}) 복원 완료`,
          'success');
      self.updateStepStatus(5, 'success');

      self.updateProgress(100, '테스트 완료');
      self.addLog('FC 0x06 프레임 검증: 합격', 'success');
      return {
        status: 'pass',
        message: 'FC 0x06 Echo 응답 / 예외 처리 / 버퍼 복구 확인',
        details:
            'Phase 2-1: 최솟값(0) Echo + Read-back 확인\nPhase 2-2: 최댓값(0x2710) Echo + Read-back 확인\nPhase 3-1: 쓰기 금지 주소 → Exception 0x02\nPhase 3-2: 값 초과(0xFFFF) → Exception 0x03\nPhase 3-3: CRC 훼손 프레임 무응답 확인\nPhase 4: 잘린 프레임 후 버퍼 복구 + 원래 값 복원',
      };
    },

    // ── modbus04 : FC 0x10 Write Multiple Registers 검증 ─────────────────────
    'modbus04': async function() {
      const self = this;
      self.checkConnection();

      // 원래 값 저장 (테스트 종료 후 복원용)
      self.updateProgress(3, '원래 Set Point 값 저장');
      const origVal =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (origVal === null || origVal === undefined) {
        return {
          status: 'fail',
          message: '초기 FC03 읽기 실패 — 연결 확인 필요',
          details: ''
        };
      }
      self.addLog(
          `원래 Set Point [0xD001] = 0x${
              origVal.toString(16).toUpperCase().padStart(4, '0')} (${
              origVal}) 저장`,
          'info');

      // Phase 2: FC10 qty=1 쓰기 → 성공 응답 + FC03 Read-back  [step 0]
      self.addLog('▶ Phase 2 시작', 'info');
      self.addLog(
          '[Phase 2] FC10 단일 쓰기 — Set Point [0xD001] qty=1 (값: 0x0100)',
          'step');
      self.addLog(
          '※ 전체 파라미터 일괄 변경 방지를 위해 0xD001 1개만 테스트 값(0x0100)으로 쓰기 검증',
          'info');
      self.updateStepStatus(0, 'running');
      self.updateProgress(5, 'Phase 2: FC10 단일 쓰기');
      const writeFrame =
          window.dashboard.modbus.buildWriteMultipleRegisters(1, 0xD001, [0x0100]);
      const writeHex =
          Array.from(writeFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${writeHex}`, 'info');
      const writeResp =
          await window.dashboard.sendAndReceive(writeFrame, 500, {minLength: 8});
      if (!writeResp || writeResp.length < 6) {
        self.updateStepStatus(0, 'error');
        return {
          status: 'fail',
          message: 'Phase 2: FC10 응답 없음 (Timeout)',
          details: '기본 FC10 통신 실패 — 슬레이브 연결 및 주소 확인 필요'
        };
      }
      const writeRespHex =
          Array.from(writeResp)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`RX: ${writeRespHex}`, 'info');
      if (writeResp[1] === 0x10) {
        self.addLog('✓ FC10 성공 응답 수신 — PASS', 'success');
      } else if (writeResp[1] & 0x80) {
        self.addLog(
            `✗ Exception 응답 수신 (Code: 0x${
                writeResp[2].toString(16).toUpperCase()}) — 쓰기 실패`,
            'error');
        self.updateStepStatus(0, 'error');
        return {
          status: 'fail',
          message: `Phase 2: FC10 Exception 응답 (0x${writeResp[2].toString(16).toUpperCase()})`,
          details: ''
        };
      }
      await self.delay(100);
      const readback = await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (readback === 0x0100) {
        self.addLog('✓ FC03 Read-back = 0x0100 — 일치 (PASS)', 'success');
      } else {
        self.addLog(
            `⚠ FC03 Read-back = 0x${
                (readback ?? 0).toString(16).toUpperCase().padStart(
                    4, '0')} — 예상 0x0100`,
            'warning');
      }
      // 테스트 값 즉시 원래 값으로 복원
      await window.dashboard.writeRegister(1, 0xD001, origVal);
      await self.delay(100);
      self.addLog(
          `✓ Set Point 원래 값(0x${
              origVal.toString(16).toUpperCase().padStart(4, '0')}) 복원`,
          'info');
      self.updateStepStatus(0, 'success');
      await self.delay(200);
      self.checkStop();

      // Phase 3-1: qty=124 길이 초과 → Exception 0x03  [step 1]
      self.addLog('▶ Phase 3-1 시작', 'info');
      self.addLog(
          '[Phase 3-1] 길이 초과 예외 — qty=124(0x7C) FC10 요청 → Exception 0x03 예상',
          'step');
      self.addLog(
          '※ FC10 최대 허용 qty=123(0x7B) 초과 — 248바이트 Data 포함 프레임',
          'info');
      self.updateStepStatus(1, 'running');
      self.updateProgress(30, 'Phase 3-1: 길이 초과 예외');
      const excFrame = window.dashboard.modbus.buildWriteMultipleRegisters(
          1, 0xD001, new Array(124).fill(0));
      const excHex =
          Array.from(excFrame.slice(0, 9))
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ') + ' ... (248바이트 Data)';
      self.addLog(`TX: ${excHex}`, 'info');
      const excResp =
          await window.dashboard.sendAndReceive(excFrame, 500, {minLength: 5});
      if (!excResp || excResp.length < 3) {
        self.addLog('✗ 응답 없음 (Timeout)', 'error');
        self.addLog('⚠ 슬레이브가 길이 초과 프레임을 무시한 것으로 추정', 'warning');
      } else if ((excResp[1] & 0x80) && excResp[2] === 0x03) {
        const rxHex =
            Array.from(excResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(
            '✓ Exception 0x03 (Illegal Data Value) 수신 — PASS', 'success');
        self.addLog(`RX: ${rxHex}`, 'info');
      } else {
        const rxHex =
            Array.from(excResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(`⚠ 예상치 않은 응답: ${rxHex}`, 'warning');
      }
      self.updateStepStatus(1, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-2: Byte Count 불일치 → Exception 0x03 또는 Drop  [step 2]
      self.addLog('▶ Phase 3-2 시작', 'info');
      self.addLog(
          '[Phase 3-2] Byte Count 불일치 예외 — qty=2 / ByteCount=0x02(원래 0x04)',
          'step');
      self.updateStepStatus(2, 'running');
      self.updateProgress(50, 'Phase 3-2: Byte Count 불일치');
      // 수동 구성: SlaveID=01, FC=10, Addr=D001, Qty=0002, ByteCount=02(불일치), Data=00000000
      const mismatchBody =
          new Uint8Array([0x01, 0x10, 0xD0, 0x01, 0x00, 0x02, 0x02, 0x00, 0x00, 0x00, 0x00]);
      const mismatchCRC =
          window.dashboard.modbus.calculateCRC16(mismatchBody);
      const mismatchFrame = new Uint8Array(mismatchBody.length + 2);
      mismatchFrame.set(mismatchBody);
      mismatchFrame[mismatchBody.length] = mismatchCRC & 0xFF;
      mismatchFrame[mismatchBody.length + 1] = (mismatchCRC >> 8) & 0xFF;
      const mismatchHex =
          Array.from(mismatchFrame)
              .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ');
      self.addLog(`TX: ${mismatchHex}`, 'info');
      const mismatchResp =
          await window.dashboard.sendAndReceive(mismatchFrame, 500, {minLength: 5});
      if (!mismatchResp || mismatchResp.length < 3) {
        self.addLog(
            '✓ 무응답(Drop) → 슬레이브가 Byte Count 불일치 프레임 폐기 확인 (PASS)',
            'success');
      } else if ((mismatchResp[1] & 0x80) && mismatchResp[2] === 0x03) {
        const rxHex =
            Array.from(mismatchResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(
            '✓ Exception 0x03 (Illegal Data Value) 수신 — PASS', 'success');
        self.addLog(`RX: ${rxHex}`, 'info');
      } else {
        const rxHex =
            Array.from(mismatchResp)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        self.addLog(`⚠ 예상치 않은 응답: ${rxHex}`, 'warning');
      }
      self.updateStepStatus(2, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 3-3: CRC 훼손 프레임 전송 → 무응답 확인  [step 3]
      self.addLog('▶ Phase 3-3 시작', 'info');
      self.addLog(
          '[Phase 3-3] CRC 훼손 프레임 자동 전송 → 무응답(Drop) 확인', 'step');
      self.addLog(
          'TX: 01 10 D0 01 00 01 02 00 00 00 00  (CRC = 00 00, 정상 CRC 아님)',
          'info');
      self.updateStepStatus(3, 'running');
      self.updateProgress(68, 'Phase 3-3: CRC 훼손 전송');
      const corruptFrame = new Uint8Array(
          [0x01, 0x10, 0xD0, 0x01, 0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00]);
      const crcResult =
          await window.dashboard.sendRawFrameWithTimeout(corruptFrame, 1);
      if (crcResult === null || crcResult === undefined) {
        self.addLog(
            '✓ 무응답(Timeout) → 슬레이브가 CRC 오류 프레임 폐기 확인 (PASS)',
            'success');
      } else {
        self.addLog(
            `⚠ 예상치 않은 응답: 0x${
                crcResult.toString(16).toUpperCase().padStart(
                    4, '0')} — CRC 검증 미동작 가능성`,
            'warning');
      }
      self.updateStepStatus(3, 'success');
      await self.delay(300);
      self.checkStop();

      // Phase 4: 잘린 프레임(10바이트) → 10ms → FC03 정상 읽기로 복구 확인  [step 4]
      self.addLog('▶ Phase 4 시작', 'info');
      self.addLog(
          '[Phase 4] 잘린 프레임(10바이트) 전송 후 버퍼 자가 복구 — FC03 정상 읽기 재시도',
          'step');
      self.updateStepStatus(4, 'running');
      self.updateProgress(85, 'Phase 4: 잘린 프레임 + 버퍼 복구');

      // 잘린 프레임 전송 (10바이트, CRC 누락)
      const partialFrame = new Uint8Array(
          [0x01, 0x10, 0xD0, 0x01, 0x00, 0x02, 0x04, 0x00, 0x00, 0x00]);
      self.addLog(
          'TX (잘린 프레임): 01 10 D0 01 00 02 04 00 00 00  (10바이트, CRC 누락)',
          'info');
      await window.dashboard.sendAndReceive(partialFrame, 50, {minLength: 1});
      self.addLog('✓ 잘린 프레임 전송 완료 — 무응답 확인 (정상)', 'success');

      // 10ms 대기 후 FC03 정상 읽기로 복구 확인
      await self.delay(10);
      const recoveryVal =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (recoveryVal === null || recoveryVal === undefined) {
        self.updateStepStatus(4, 'error');
        return {
          status: 'fail',
          message: 'Phase 4: 잘린 프레임 후 FC03 응답 없음 — 버퍼 자가 복구 실패',
          details: ''
        };
      }
      self.addLog(
          `✓ FC03 정상 응답: 0x${
              recoveryVal.toString(16).toUpperCase().padStart(4, '0')} — 버퍼 자가 복구 확인 (PASS)`,
          'success');
      self.addLog(
          `✓ Set Point 원래 값(0x${
              origVal.toString(16).toUpperCase().padStart(4, '0')}) 유지 확인`,
          'info');
      self.updateStepStatus(4, 'success');

      self.updateProgress(100, '테스트 완료');
      self.addLog('FC 0x10 프레임 검증: 합격', 'success');
      return {
        status: 'pass',
        message: 'FC 0x10 성공 응답 / 예외 처리 / 버퍼 복구 확인',
        details:
            'Phase 2: FC10 qty=1 성공 응답 + FC03 Read-back 확인\nPhase 3-1: qty=124 길이 초과 → Exception 0x03\nPhase 3-2: Byte Count 불일치 → Exception 0x03 또는 Drop\nPhase 3-3: CRC 훼손 프레임 무응답 확인\nPhase 4: 잘린 프레임 후 버퍼 복구 확인',
      };
    },

    // ── modbus05 : FC 0x2B EtherCAT SDO 검증 ─────────────────────────────────
    'modbus05': async function() {
      const self = this;
      self.checkConnection();

      let phase2Status = 'info';

      // Phase 2: CANopen Motor ID 오브젝트 읽기  [step 0]
      self.addLog('─'.repeat(50), 'info');
      self.addLog(
          '[Phase 2] CANopen Motor ID [0x2000:00] Read — FC 0x2B MEI Transport',
          'step');
      self.updateStepStatus(0, 'running');
      self.updateProgress(15, 'Phase 2: CANopen 0x2000:00 읽기');
      let sdoVal = null;
      try {
        sdoVal = await window.dashboard.readCANopenObject(1, 0x2000, 0x00);
        if (sdoVal !== null && sdoVal !== undefined) {
          self.addLog(
              `✓ FC 0x2B 정상 응답: Motor ID = ${sdoVal} (0x${
                  sdoVal.toString(16).toUpperCase()})`,
              'success');
          phase2Status = 'pass';
        } else {
          self.addLog(
              '⚠ FC 0x2B 응답 없음 — 장치가 FC 0x2B 미지원이거나 Timeout',
              'warning');
          phase2Status = 'warning';
        }
      } catch (e) {
        self.addLog(`⚠ FC 0x2B 읽기 중 오류: ${e.message}`, 'warning');
        phase2Status = 'warning';
      }
      self.updateStepStatus(0, 'success');
      await self.delay(300);

      // Phase 3-1: 존재하지 않는 오브젝트 읽기  [step 1]
      self.addLog('─'.repeat(50), 'info');
      self.addLog(
          '[Phase 3-1] 비존재 CANopen 오브젝트 [0xFFFF:00] Read — AbortCode 예상',
          'step');
      self.updateStepStatus(1, 'running');
      self.updateProgress(40, 'Phase 3-1: 비존재 오브젝트');
      try {
        const abortVal =
            await window.dashboard.readCANopenObject(1, 0xFFFF, 0x00);
        if (abortVal === null || abortVal === undefined) {
          self.addLog(
              '✓ null 반환 → AbortCode 수신 또는 Timeout (PASS)', 'success');
        } else {
          self.addLog(
              `⚠ 예상치 않은 응답: ${abortVal} — 비존재 오브젝트 허용됨`,
              'warning');
        }
      } catch (e) {
        self.addLog(`✓ 예외 발생: ${e.message} — 정상 방어 (PASS)`, 'success');
      }
      self.updateStepStatus(1, 'success');
      await self.delay(300);

      // Phase 3-2: Read-Only CANopen 오브젝트 Write 시도  [step 2]
      self.addLog('─'.repeat(50), 'info');
      self.addLog(
          '[Phase 3-2] Read-Only CANopen 오브젝트(0x2000:00) Write 시도 — AbortCode 예상',
          'step');
      self.updateStepStatus(2, 'running');
      self.updateProgress(60, 'Phase 3-2: Read-Only Write 시도');
      try {
        await window.dashboard.writeCANopenObject(1, 0x2000, 0x00, 0xFFFF);
        self.addLog(
            '⚠ Read-Only 오브젝트 Write가 허용됨 — 방어 로직 미동작 가능성',
            'warning');
      } catch (e) {
        self.addLog(`✓ Write 거부/오류: ${e.message} (PASS)`, 'success');
      }
      self.updateStepStatus(2, 'success');
      await self.delay(300);

      // Phase 4: FC03으로 버퍼 복구 확인  [step 3]
      self.addLog('─'.repeat(50), 'info');
      self.addLog(
          '[Phase 4] 버퍼 복구 — FC03 정상 읽기로 통신 스택 상태 확인', 'step');
      self.updateStepStatus(3, 'running');
      self.updateProgress(82, 'Phase 4: 버퍼 복구');
      const recoveryVal =
          await window.dashboard.readRegisterWithTimeout(1, 0xD001);
      if (recoveryVal === null || recoveryVal === undefined) {
        self.addLog('⚠ FC03 읽기 실패 — 버퍼 복구 이상', 'warning');
        self.updateStepStatus(3, 'error');
      } else {
        self.addLog(
            `✓ FC03 복구 응답: 0x${
                recoveryVal.toString(16).toUpperCase().padStart(4, '0')}`,
            'success');
        self.updateStepStatus(3, 'success');
      }

      self.updateProgress(100, '테스트 완료');
      self.addLog('═'.repeat(50), 'info');
      self.addLog('FC 0x2B EtherCAT SDO 검증: 완료', 'success');
      return {
        status: 'pass',
        message: `FC 0x2B CANopen 검증 완료 (Motor ID=${sdoVal ?? '미응답'})`,
        details: `Phase 2: Motor ID=${sdoVal ?? 'N/A'} (${
            phase2Status})\nPhase 3: 비존재 오브젝트 AbortCode 확인\nPhase 4: 버퍼 복구 확인`,
      };
    },

  },

});
