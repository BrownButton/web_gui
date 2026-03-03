# EC-FAN Modbus Dashboard - 프로젝트 문서

> **이 문서는 회사 내 기술 검토 및 AI 개발 방식 승인을 위해 작성되었습니다.**

---

## 프로젝트 한 줄 요약

EC-FAN 모터 드라이브를 PC 브라우저에서 실시간으로 모니터링하고 제어할 수 있는
**Modbus RTU / RS-485 기반 웹 대시보드 애플리케이션**

---

## 문서 목록

| 파일 | 내용 |
|------|------|
| [01_프로젝트_개요.md](01_프로젝트_개요.md) | 무엇을 만들었나, 왜 웹으로 만들었나, 주요 기능 |
| [02_AI_개발방식.md](02_AI_개발방식.md) | Claude Code(AI)를 활용한 개발 방법 상세 설명 |
| [03_웹기술_설명.md](03_웹기술_설명.md) | HTML/CSS/JS 웹 기술 스택 (비웹개발자 대상) |
| [04_프로젝트_아키텍처.md](04_프로젝트_아키텍처.md) | 파일 구조, 클래스 설계, 데이터 흐름 |
| [05_WebSerial_통신.md](05_WebSerial_통신.md) | Web Serial API로 RS-485 포트에 접근하는 방법 |
| [06_Modbus_RTU_구현.md](06_Modbus_RTU_구현.md) | Modbus RTU 프로토콜 구현 상세 |
| [07_485버스_안전구조.md](07_485버스_안전구조.md) | 폴링 중 버스 충돌 방지 설계 및 Command Queue |

---

## 기술 스택 요약

| 구분 | 기술 | 비고 |
|------|------|------|
| UI | HTML5 + CSS3 + JavaScript (ES6+) | 외부 프레임워크 없음 |
| 시리얼 통신 | Web Serial API | Chrome/Edge 89+ 필요 |
| 프로토콜 | Modbus RTU (CRC-16) | FC03/FC04/FC06 등 |
| 데이터 저장 | localStorage / sessionStorage | 설치 불필요, 브라우저 저장 |
| 개발 도구 | Claude Code (Anthropic AI) | VS Code 확장 또는 CLI |
| 버전 관리 | Git / GitHub | 코드 이력 관리 |

---

## 지원 환경

- **브라우저**: Google Chrome 89+, Microsoft Edge 89+
- **OS**: Windows 10/11 (Web Serial API 지원 필수)
- **연결**: USB-RS485 변환기 또는 RS-485 직접 포트

---

## 읽는 순서 권장

```
01 → 02 → 03 → 04 → 05 → 06 → 07
```

처음 접하는 분은 순서대로 읽는 것을 권장합니다.
특정 주제만 필요한 경우 해당 파일을 직접 열어보세요.
