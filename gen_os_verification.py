"""
OS Verification 섹션 HTML을 생성하여 index.html에 적용하는 스크립트
"""

ITEM_STYLE = 'background:white;border:1px solid #e9ecef;border-radius:8px;overflow:hidden;transition:all 0.2s;'
INDENT = '                                            '

def card(test_id, title, desc):
    return f'''\
{INDENT}<div class="os-test-item" data-test-id="{test_id}" style="{ITEM_STYLE}">
{INDENT}  <div class="os-test-header" style="padding:16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
{INDENT}    <div style="flex:1;"><div style="font-size:14px;font-weight:500;color:#1a1a1a;margin-bottom:4px;">{title}</div><div style="font-size:12px;color:#6c757d;">{desc}</div></div>
{INDENT}    <div style="display:flex;align-items:center;gap:12px;"><span class="test-status-badge" style="padding:4px 12px;background:#e9ecef;color:#6c757d;border-radius:12px;font-size:12px;font-weight:500;">Pending</span><span class="test-expand-icon" style="font-size:18px;color:#6c757d;transition:transform 0.3s;">▼</span></div>
{INDENT}  </div>
{INDENT}  <div class="os-test-content" style="display:none;border-top:1px solid #e9ecef;">
{INDENT}    <div style="padding:20px;background:#f8f9fa;"><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;font-size:13px;"><div><div style="color:#6c757d;margin-bottom:4px;">시험 분류</div><div style="color:#1a1a1a;font-weight:500;" class="test-category">-</div></div><div><div style="color:#6c757d;margin-bottom:4px;">시험 번호</div><div style="color:#1a1a1a;font-weight:500;" class="test-number">-</div></div><div style="grid-column:1/-1;"><div style="color:#6c757d;margin-bottom:4px;">시험 목적</div><div style="color:#1a1a1a;" class="test-purpose">-</div></div><div><div style="color:#6c757d;margin-bottom:4px;">적용 모델</div><div style="color:#1a1a1a;" class="test-model">EC-FAN</div></div><div><div style="color:#6c757d;margin-bottom:4px;">시험 장비</div><div style="color:#1a1a1a;" class="test-equipment">-</div></div></div></div>
{INDENT}    <div style="padding:20px;background:#f8f9fa;border-top:1px solid #e9ecef;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><h4 style="margin:0;font-size:15px;font-weight:600;">테스트 실행</h4><div style="display:flex;gap:8px;"><button class="btn btn-primary btn-sm test-start-btn">▶ Start Test</button><button class="btn btn-secondary btn-sm test-stop-btn" style="display:none;">⏹ Stop</button></div></div><div style="background:#e9ecef;height:6px;border-radius:3px;overflow:hidden;"><div class="test-progress-bar" style="height:100%;background:linear-gradient(90deg,#667eea,#764ba2);width:0%;transition:width 0.3s;"></div></div><div class="test-progress-text" style="margin-top:6px;font-size:12px;color:#6c757d;text-align:center;">테스트를 시작하려면 Start Test 버튼을 클릭하세요</div></div>
{INDENT}    <div style="padding:20px;"><h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;">시험 단계</h4><div class="test-steps-list" style="display:flex;flex-direction:column;gap:8px;"></div></div>
{INDENT}    <div style="padding:0 20px 20px 20px;"><h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;">실행 로그</h4><div class="test-log-container" style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;font-family:'Consolas','Monaco',monospace;font-size:11px;max-height:200px;overflow-y:auto;line-height:1.5;"><div style="color:#6c757d;">테스트 로그가 여기에 표시됩니다...</div></div></div>
{INDENT}    <div style="padding:0 20px 20px 20px;"><h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;">판정 기준</h4><div style="padding:12px;background:#e7f3ff;border-left:4px solid #2196f3;border-radius:4px;"><div style="font-size:13px;color:#1a1a1a;" class="test-criteria">-</div></div></div>
{INDENT}    <div style="padding:20px;background:#f8f9fa;border-top:1px solid #e9ecef;"><h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;">테스트 결과</h4><div class="test-result-display" style="display:none;"></div><div class="test-result-pending" style="padding:12px;background:#e9ecef;border-radius:4px;text-align:center;color:#6c757d;font-size:13px;">테스트를 실행하면 결과가 자동으로 표시됩니다</div></div>
{INDENT}  </div>
{INDENT}</div>'''

SEC_INDENT = '                                    '
GRID_INDENT = '                                        '

def section(num, title, count, cards_html):
    return f'''\
{SEC_INDENT}<section style="margin-bottom:28px;">
{SEC_INDENT}  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
{SEC_INDENT}    <h3 style="margin:0;font-size:17px;font-weight:600;color:#1a1a1a;">{num}. {title}</h3>
{SEC_INDENT}    <span style="font-size:12px;color:#6c757d;">{count} tests</span>
{SEC_INDENT}  </div>
{GRID_INDENT}<div style="display:grid;gap:10px;">
{cards_html}
{GRID_INDENT}</div>
{SEC_INDENT}</section>'''

# ── RS485 ──────────────────────────────────────────────────────────
rs_cards = '\n'.join([
    card('rs-1', 'RS485 No.1-1  기본 연결 동작 시험 및 Baudrate, Parity 변경', 'RS485 기본 통신 기능 검증'),
    card('rs-2', 'RS485 No.1-2  Broadcast 동작 시험', 'ID 0으로 전체 디바이스 명령 전달 검증'),
    card('rs-3', 'RS485 No.1-3  NodeID 변경 시험', 'Modbus Slave ID 설정 및 반영 검증'),
])
sec_rs = section(1, 'RS485', 3, rs_cards)

# ── Modbus RTU ─────────────────────────────────────────────────────
mb_cards = '\n'.join([
    card('mb-1', 'Modbus No.2-1  FC(03) Read Holding Register', 'Holding Register 읽기 기능 검증'),
    card('mb-2', 'Modbus No.2-2  FC(04) Read Input Register', 'Input Register 읽기 기능 검증'),
    card('mb-3', 'Modbus No.2-3  FC(06) Write Single Register', 'Single Register 쓰기 기능 검증'),
    card('mb-4', 'Modbus No.2-4  FC(10) Write Multiple Registers', 'Multiple Register 쓰기 기능 검증'),
    card('mb-5', 'Modbus No.2-5  FC(2B) Read Device Identification', 'Device ID 오브젝트 읽기 기능 검증'),
])
sec_mb = section(2, 'Modbus RTU', 5, mb_cards)

# ── 기본동작 ────────────────────────────────────────────────────────
basic_cards = '\n'.join([
    card('basic-sw-reset',       '기본동작 No.3-1-1  Software Reset', 'SW Reset 명령 처리 검증'),
    card('basic-alarm-reset',    '기본동작 No.3-1-2  Alarm Reset', '알람 클리어 명령 처리 검증'),
    card('basic-current-limit',  '기본동작 No.3-2    전류제한 파라미터 설정', '최대 코일 전류 설정 및 반영 검증'),
    card('basic-direction',      '기본동작 No.3-3    구동 방향 설정 (CW / CCW)', '모터 정·역 방향 설정 파라미터 검증'),
    card('basic-eeprom',         '기본동작 No.3-4    EEPROM Save', '파라미터 저장 명령 처리 검증'),
    card('basic-dclink',         '기본동작 No.3-5    DCLink Voltage 읽기', 'DC 링크 전압 센싱 정상 여부 검증'),
    card('basic-board-temp',     '기본동작 No.3-6    Board 온도 읽기', '드라이브 기판 온도 센싱 검증'),
    card('basic-igbt-temp',      '기본동작 No.3-7    IGBT 온도 읽기', 'IGBT 모듈 온도 센싱 검증'),
    card('basic-fw-main',        '기본동작 No.3-8    펌웨어 버전 확인 (MAIN / MAIN Boot)', 'Main MCU 및 Boot 버전 레지스터 읽기 검증'),
    card('basic-fw-inv',         '기본동작 No.3-9    펌웨어 버전 확인 (INVERTER / INVERTER Boot)', 'Inverter MCU 및 Boot 버전 레지스터 읽기 검증'),
    card('basic-dl-main',        '기본동작 No.3-10-1  Main OS 다운로드', 'Main MCU 펌웨어 다운로드 기능 검증'),
    card('basic-dl-inv',         '기본동작 No.3-10-2  Inverter OS 다운로드', 'Inverter MCU 펌웨어 다운로드 기능 검증'),
    card('basic-dl-except',      '기본동작 No.3-10-3  OS 다운로드 중 분리 예외처리', '다운로드 중 연결 해제 시 복구 처리 검증'),
])
sec_basic = section(3, '기본동작', 13, basic_cards)

# ── 구동동작 ────────────────────────────────────────────────────────
drive_cards = '\n'.join([
    card('drive-pwm',        '구동동작 No.4-1-1  Set Value Source – PWM 입력', 'PWM 신호로 Setpoint 설정 검증'),
    card('drive-analog-v',   '구동동작 No.4-1-2  Set Value Source – Analog V 입력', 'Analog 전압으로 Setpoint 설정 검증'),
    card('drive-analog-i',   '구동동작 No.4-1-3  Set Value Source – Analog I 입력', 'Analog 전류로 Setpoint 설정 검증'),
    card('drive-rs485-input','구동동작 No.4-1-4  Set Value Source – RS485 입력', 'RS485 통신으로 Setpoint 설정 검증'),
    card('drive-fg',         '구동동작 No.4-2    FG / PPR 설정 (1, 2, 4, 8)', 'FG 출력 및 PPR 파라미터 설정 검증'),
    card('drive-mode',       '구동동작 No.4-3    구동 모드 설정 (Torque / Velocity)', 'Operating Mode 파라미터 설정 및 적용 검증'),
    card('drive-setval',     '구동동작 No.4-4    Set Value (Setpoint 입력 및 속도 확인)', 'Setpoint 쓰기 후 실제 속도 응답 검증'),
    card('drive-openloop',   '구동동작 No.4-5    Open-loop Control', '개방형 제어 모드 구동 검증'),
    card('drive-closedloop', '구동동작 No.4-6    Closed-loop Velocity Control', '폐루프 속도 제어 모드 구동 검증'),
])
sec_drive = section(4, '구동동작', 9, drive_cards)

# ── 보호동작 ────────────────────────────────────────────────────────
def prot_card(test_id, code, name, note=''):
    label = f'보호동작  {code}  {name}'
    desc = note if note else f'{name} 발생 시 에러/경고 코드 정상 처리 검증'
    return card(test_id, label, desc)

prot_cards = '\n'.join([
    prot_card('prot-0x10', 'Error 0x10', 'IPM fault'),
    prot_card('prot-0x11', 'Error 0x11', 'IPM Over temperature'),
    prot_card('prot-0x14', 'Error 0x14', 'Over current', '프로시저 명령으로 과전류 트리거 후 에러 코드 확인'),
    prot_card('prot-0x15', 'Error 0x15', 'Current offset', '프로시저 명령으로 전류 offset 오류 트리거 후 에러 코드 확인'),
    prot_card('prot-0x17', 'Error 0x17', 'IPM Low temperature', '챔버 환경 필요 — 검증 환경 확보 후 진행'),
    prot_card('prot-0x22', 'Error 0x22', 'Drive temperature 1', '(0x22 / 0x25 중 인버터 항목 삭제 예정)'),
    prot_card('prot-0x24', 'Error 0x24', 'Motor cable open'),
    prot_card('prot-0x25', 'Error 0x25', 'Drive temperature 2', '(0x22 / 0x25 중 인버터 항목 삭제 예정)'),
    prot_card('prot-0x2a', 'Error 0x2A', 'Motor circuit abnormality'),
    prot_card('prot-0x36', 'Error 0x36', 'Sinusoidal encoder amplitude too low'),
    prot_card('prot-0x37', 'Error 0x37', 'Sinusoidal encoder amplitude too high', '검증 가능 여부 확인 후 불가 시 삭제'),
    prot_card('prot-0x40', 'Error 0x40', 'Under voltage'),
    prot_card('prot-0x41', 'Error 0x41', 'Over voltage'),
    prot_card('prot-0x42', 'Error 0x42', 'RST power fail'),
    prot_card('prot-0x50', 'Error 0x50', 'Over speed limit'),
    prot_card('prot-0x53', 'Error 0x53', 'Excessive speed deviation'),
    prot_card('prot-0x58', 'Error 0x58', 'Motor shaft is Blocked'),
    prot_card('prot-w01',  'Warning 0x01', 'DC Link under voltage'),
    prot_card('prot-w02',  'Warning 0x02', 'DC Link over voltage'),
    prot_card('prot-w04',  'Warning 0x04', 'Motor over temperature'),
    prot_card('prot-w08',  'Warning 0x08', 'IGBT Module over temperature'),
    prot_card('prot-w10',  'Warning 0x10', 'Drive (Control part) over temperature'),
    prot_card('prot-w40',  'Warning 0x40', 'Torque Limit'),
])
sec_prot = section(5, '보호동작', 23, prot_cards)

OUTER_INDENT = '                                '

new_section = f'''\
{OUTER_INDENT}<div style="padding:20px 32px;background:#f8f9fa;border-bottom:1px solid #e9ecef;flex-shrink:0;">
{OUTER_INDENT}  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;margin-bottom:12px;">
{OUTER_INDENT}    <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#1a1a1a;" id="osTestTotal">53</div><div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Total Tests</div></div>
{OUTER_INDENT}    <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#28a745;" id="osTestPassed">0</div><div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Passed</div></div>
{OUTER_INDENT}    <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#dc3545;" id="osTestFailed">0</div><div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Failed</div></div>
{OUTER_INDENT}    <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#6c757d;" id="osTestPending">53</div><div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Pending</div></div>
{OUTER_INDENT}    <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#667eea;" id="osTestProgress">0%</div><div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Progress</div></div>
{OUTER_INDENT}  </div>
{OUTER_INDENT}  <div style="display:flex;gap:8px;justify-content:flex-end;">
{OUTER_INDENT}    <button class="btn btn-success btn-sm" id="osRunAllTestsBtn">▶ Run All Tests</button>
{OUTER_INDENT}    <button class="btn btn-warning btn-sm" id="osResetTestsBtn">↺ Reset All</button>
{OUTER_INDENT}  </div>
{OUTER_INDENT}</div>
{OUTER_INDENT}<div style="flex:1;overflow-y:auto;padding:24px 32px;">
{sec_rs}
{sec_mb}
{sec_basic}
{sec_drive}
{sec_prot}
{OUTER_INDENT}</div>
{OUTER_INDENT[:-4]}</div>
{OUTER_INDENT[:-8]}</div>'''

# ── 파일 적용 ──────────────────────────────────────────────────────
with open('c:/github/web_gui/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 교체 대상: Progress Summary div 시작 ~ manufactureOsVerification 닫는 </div>
# 유일한 앵커로 교체
import re

# 패턴: Progress Summary 시작부터 OS Verification 닫힌 </div></div> 까지
OLD_START = '                                <div style="padding: 20px 32px; background: #f8f9fa; border-bottom: 1px solid #e9ecef;">'
OLD_END   = '                            </div>\n\n                            <!-- Hardware Test Sub-tab -->'
NEW_END   = '                            <!-- Hardware Test Sub-tab -->'

start_idx = html.find(OLD_START)
end_idx   = html.find(OLD_END)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: anchor not found. start={start_idx}, end={end_idx}")
    exit(1)

# end_idx는 OLD_END 시작점 → OLD_END 길이만큼 건너뛴 뒤부터가 새 위치
new_html = html[:start_idx] + new_section + '\n\n                            <!-- Hardware Test Sub-tab -->' + html[end_idx + len(OLD_END):]

with open('c:/github/web_gui/index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Done! OS Verification section replaced.")
print(f"New section length: {len(new_section)} chars")
