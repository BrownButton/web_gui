# Motor Status [0xD011] 비트맵 참조

보호동작 시험에서 공통으로 사용되는 Motor Status 레지스터 비트 정의입니다.

## 레지스터 정보

- **주소**: 0xD011
- **타입**: Input Register (FC04로 읽기)
- **역할**: 드라이브의 현재 상태 및 알람/경고 플래그

## 비트 정의

| 비트 | 이름 | 설명 |
|------|------|------|
| Bit 0 | PHA | 주 전원 결상 (Phase Loss) |
| Bit 4 | FB | 팬 에러 (현재 에러 상태일 경우 활성화) |
| Bit 5 | SKF | 통신 에러 |
| Bit 6 | HLL | 엔코더 신호 이상 (Hall sensor Level Low) |
| Bit 7 | BLK | 모터 구속 (Blocked) |
| Bit 8 | N_Limit | 속도 제한치 도달 (과속 보호) |
| Bit 10 | RL_Cal | 엔코더 보정 에러 |
| Bit 12 | UzLow | DC링크 전압 낮음 (Under Voltage) |
| Bit 3 | TFE | 인버터 과열 |

## Motor Status 읽기 명령

```
01 04 D0 11 00 01 59 0F
```

| 바이트 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|--------|------|------|------|------|------|------|------|------|
| 내용 | 0x01 | 0x04 | 0xD0 | 0x11 | 0x00 | 0x01 | 0x59 | 0x0F |

## 보호동작별 예상 Motor Status 값

| 보호동작 | 항목 | 관련 비트 | 예상 값 |
|---------|------|-----------|---------|
| No. 1 | 주 전원 결상 | Bit 0 (PHA) + Bit 4 (FB) | 0x0011 |
| No. 2 | 엔코더 신호 이상 | Bit 4 (FB) + Bit 6 (HLL) | 0x0050 |
| No. 3 | 모터 구속 | Bit 4 (FB) + Bit 7 (BLK) | 0x0090 |
| No. 4 | 과속 | Bit 4 (FB) + Bit 8 (N_Limit) | 0x0110 |
| No. 5 | 엔코더 보정 에러 | Bit 4 (FB) + Bit 10 (RL_Cal) | 0x0410 |
| No. 6 | 저전압 | Bit 4 (FB) + Bit 12 (UzLow) | 0x1010 |
