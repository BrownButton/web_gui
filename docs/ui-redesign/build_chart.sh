source ./shell.sh
# chrow n color name value min max scale offset
chrow() {
  cat <<R
<div style="display:grid;grid-template-columns:44px 200px 90px 70px 70px 70px 70px 70px;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #1a2438;font-size:12px">
  <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:$2"></span><b class="mono">CH$1</b></span>
  <span class="input" style="height:26px;justify-content:space-between">$3 $ICON_CHEV</span>
  <span class="mono" style="color:$2;font-weight:500;text-align:right">$4</span>
  <span class="seg" style="height:24px"><span class="on">Auto</span><span>Man</span></span>
  <span class="input mono" style="height:26px;justify-content:flex-end">$5</span>
  <span class="input mono" style="height:26px;justify-content:flex-end">$6</span>
  <span class="input mono" style="height:26px;justify-content:flex-end">$7</span>
  <span class="input mono" style="height:26px;justify-content:flex-end">$8</span>
</div>
R
}
{
dc_head ''
shell_open chart "Chart" "Supply Fan 1 · continuous · 1 ms" 1 Engineer
cat <<B
<div style="padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #1c2740">
  <span class="btn danger">$ICON_STOP Stop</span>
  <span class="btn">Clear</span>
  <span style="width:1px;height:20px;background:#22304a"></span>
  <span class="seg" style="height:30px"><span class="on">Overlay</span><span>Split</span></span>
  <span class="input" style="gap:6px">Y: Independent $ICON_CHEV</span>
  <span class="btn">Cursors</span>
  <span style="width:1px;height:20px;background:#22304a"></span>
  <span class="mono" style="color:#8a9bb5;font-size:12px;display:inline-flex;gap:14px"><span>12 500 pts</span><span>1.00 kS/s</span><span>12.5 s</span></span>
  <span class="chip ok" style="height:22px;padding:0 8px">$ICON_PLAY Live</span>
  <span style="flex:1"></span>
  <span class="btn">CSV</span><span class="btn">.lsm</span><span class="btn">PNG</span>
  <span class="btn ghost">$ICON_CHEV</span>
</div>
<div style="flex:1;display:grid;grid-template-columns:minmax(0,1fr) 300px;min-height:0">
  <div style="display:flex;flex-direction:column;min-height:0">
    <div style="flex:1;position:relative;background:#070c16;margin:12px 0 0 16px;border:1px solid #1c2740;border-radius:8px;overflow:hidden">
      <svg viewBox="0 0 1000 440" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">
        <g stroke="#152036" stroke-width="1">
          <path d="M0 55H1000M0 110H1000M0 165H1000M0 220H1000M0 275H1000M0 330H1000M0 385H1000"></path>
          <path d="M100 0V440M200 0V440M300 0V440M400 0V440M500 0V440M600 0V440M700 0V440M800 0V440M900 0V440"></path>
        </g>
        <path d="M0 300 C60 300 80 300 120 290 S180 160 240 140 S320 130 400 128 S560 126 700 126 S900 125 1000 125" fill="none" stroke="#ffd166" stroke-width="1.8"></path>
        <path d="M0 300 L130 300 L130 130 L1000 130" fill="none" stroke="#4fd1ff" stroke-width="1.5" stroke-dasharray="4 3"></path>
        <path d="M0 360 C80 360 100 330 130 320 S170 200 200 220 S230 260 260 250 S330 235 400 240 S600 238 800 240 S950 239 1000 240" fill="none" stroke="#ff6bd6" stroke-width="1.5"></path>
        <path d="M0 395 L1000 393" fill="none" stroke="#7bff9a" stroke-width="1.5"></path>
        <path d="M640 0V440" stroke="#8fb8ff" stroke-width="1" stroke-dasharray="3 3"></path>
      </svg>
      <div class="mono" style="position:absolute;left:12px;top:10px;display:flex;flex-direction:column;gap:2px;font-size:11px;color:#8a9bb5"><span style="color:#ffd166">CH1 1 245 RPM</span><span style="color:#4fd1ff">CH2 1 250 RPM</span><span style="color:#ff6bd6">CH3 2.41 A</span><span style="color:#7bff9a">CH4 41.0 °C</span></div>
      <div class="mono" style="position:absolute;left:66%;top:10px;padding:6px 8px;background:#111a2b;border:1px solid #2a3a58;border-radius:6px;font-size:11px;display:flex;flex-direction:column;gap:2px"><span style="color:#8fb8ff">t = 8.00 s</span><span style="color:#ffd166">1 247</span><span style="color:#4fd1ff">1 250</span><span style="color:#ff6bd6">2.38</span><span style="color:#7bff9a">41.0</span></div>
      <div class="mono" style="position:absolute;left:12px;bottom:8px;right:12px;display:flex;justify-content:space-between;font-size:10.5px;color:#5b6b85"><span>0 s</span><span>2.5</span><span>5.0</span><span>7.5</span><span>10.0</span><span>12.5 s</span></div>
    </div>
    <div style="margin:10px 0 0 16px;display:flex;flex-direction:column;min-height:0">
      <div class="tabs">
        <span class="tab on">Channels</span><span class="tab">Time base</span><span class="tab">Trigger</span><span class="tab">Cursor measurement</span><span class="tab" style="color:#5b6b85">FRF <span class="badge cap">planned</span></span>
      </div>
      <div style="display:grid;grid-template-columns:44px 200px 90px 70px 70px 70px 70px 70px;gap:10px;padding:8px 0 2px">
        <span class="label">Ch</span><span class="label">Parameter</span><span class="label" style="text-align:right">Value</span><span class="label">Range</span><span class="label" style="text-align:right">Min</span><span class="label" style="text-align:right">Max</span><span class="label" style="text-align:right">Scale</span><span class="label" style="text-align:right">Offset</span>
      </div>
      $(chrow 1 "#ffd166" "Actual speed · 0xD02D" "1 245 RPM" 0 "1 600" 1 0)
      $(chrow 2 "#4fd1ff" "Setpoint · 0xD001" "1 250 RPM" 0 "1 600" 1 0)
      $(chrow 3 "#ff6bd6" "Motor current · 0xD052" "2.41 A" 0 "5.0" 1 0)
      $(chrow 4 "#7bff9a" "Temperature · 0xD027" "41.0 °C" 0 "120" 1 0)
    </div>
  </div>
  <div style="margin:12px 16px 12px 12px;display:flex;flex-direction:column;gap:12px;min-height:0">
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;gap:8px"><span class="label">Control</span><span style="flex:1"></span><span class="input" style="height:24px;gap:6px;font-size:11.5px">Supply Fan 1 · ID 07 $ICON_CHEV</span></div>
      <div style="display:flex;align-items:baseline;gap:8px"><span class="mono" style="font-size:34px;font-weight:500;line-height:1">1 245</span><span style="color:#8a9bb5">RPM actual</span><span style="flex:1"></span><span class="chip ok" style="height:22px;padding:0 8px">$ICON_PLAY Running</span></div>
      <div style="display:flex;gap:6px"><span class="btn primary" style="flex:1;justify-content:center">$ICON_PLAY Run</span><span class="btn danger" style="flex:1;justify-content:center">$ICON_STOP Stop</span></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:6px"><span class="label" style="flex:1">Setpoint</span><span class="seg" style="height:24px"><span class="on">RPM</span><span>%</span></span></div>
        <div style="display:flex;gap:6px"><span class="input mono" style="flex:1;justify-content:flex-end;font-size:14px;height:32px">1 250</span><span class="btn primary" style="height:32px">Apply</span></div>
        <div style="display:flex;gap:4px"><span class="btn sm" style="flex:1;justify-content:center">0</span><span class="btn sm" style="flex:1;justify-content:center">25</span><span class="btn sm" style="flex:1;justify-content:center">50</span><span class="btn sm" style="flex:1;justify-content:center">75</span><span class="btn sm" style="flex:1;justify-content:center">100</span></div>
        <span class="chip ok" style="height:22px;align-self:flex-start">$ICON_CHECK Confirmed 12:03:41 · marker added</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;border-top:1px solid #1e2b45;padding-top:10px">
        <div class="kv"><span>Mode</span><b>Speed control</b></div>
        <div class="kv"><span>Direction</span><b>CW</b></div>
        <div class="kv"><span>Alarm</span><b style="color:#7fe2a8">None</b></div>
        <div class="kv"><span>Updated</span><b class="mono">0.3 s ago</b></div>
      </div>
    </div>
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:8px">
      <span class="label">Markers</span>
      <div class="kv mono"><span style="color:#8fb8ff">M1 · 1.30 s</span><b>SP 0 → 1 250</b></div>
      <div class="kv mono"><span style="color:#8fb8ff">M2 · 8.00 s</span><b>cursor</b></div>
      <div class="kv"><span>Δt M1→M2</span><b class="mono">6.70 s</b></div>
    </div>
  </div>
</div>
B
shell_close
dc_foot
} > Chart.dc.html
echo "Chart written"
