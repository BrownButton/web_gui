/**
 * LsmExporter — .lsm (LMS SCADAS CSV) 파일 생성/저장 모듈
 *
 * 포맷:
 *   1행: CH1 : name;CH2 : name;...;CHn : name;
 *   2행~: t v1;t v2;...;t vn;   (시간: 초, 공백으로 값 구분, 세미콜론으로 채널 구분)
 *
 * 사용 예:
 *   // MiniChart 에서
 *   LsmExporter.download(chart.channels, 20, 'basic03.lsm');
 *
 *   // 직접 데이터 지정
 *   LsmExporter.download([
 *     { name: 'Vel FB',  data: [...] },
 *     { name: 'Trq CMD', data: [...] },
 *   ], 20, 'capture.lsm');
 */
window.LsmExporter = {

    /**
     * 채널 데이터 배열에서 LSM 포맷 문자열 생성
     *
     * @param {Array<{name: string, data: number[]}>} channels
     * @param {number} periodMs  샘플 주기 (ms 단위, 예: 20)
     * @returns {string}
     */
    generate(channels, periodMs) {
        if (!channels || channels.length === 0) return '';

        // 헤더
        const header = channels.map((ch, i) => `CH${i + 1} : ${ch.name}`).join(';') + ';';

        // 모든 채널의 최소 길이로 맞춤
        const len = Math.min(...channels.map(ch => (ch.data || []).length));
        if (len === 0) return header;

        // 데이터 행: 정수 연산으로 시간 계산해 부동소수점 노이즈 방지
        const rows = [];
        for (let i = 0; i < len; i++) {
            const tMs = Math.round(i * periodMs);          // 정수 ms
            const tSec = tMs % 1000 === 0                  // 깔끔한 초 단위면 정수 표기
                ? String(tMs / 1000)
                : (tMs / 1000).toFixed(String(periodMs).replace('.', '').length + 1)
                              .replace(/0+$/, '');         // 불필요한 trailing zero 제거
            rows.push(channels.map(ch => `${tSec} ${ch.data[i]}`).join(';') + ';');
        }

        return header + '\n' + rows.join('\n');
    },

    /**
     * LSM 파일로 저장 (브라우저 다운로드)
     *
     * @param {Array<{name: string, data: number[]}>} channels
     * @param {number} periodMs
     * @param {string} [filename]  기본값: 'chart_<timestamp>.lsm'
     */
    download(channels, periodMs, filename) {
        const content = this.generate(channels, periodMs);
        if (!content) { console.warn('LsmExporter: 저장할 데이터 없음'); return; }

        if (!filename) {
            const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
            filename = `chart_${ts}.lsm`;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
};
