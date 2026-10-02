source ./shell.sh
# hw n title value cls icon text
hw() {
  local border="#1e2b45"; [ "$4" = "err" ] && border="#6b1f33"; [ "$4" = "info" ] && border="#1f3d6b"
  cat <<H
<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;border-color:$border">
  <div style="display:flex;align-items:center;gap:8px"><span class="mono" style="color:#5b6b85;font-size:11px">$1</span><span style="font-weight:500;flex:1">$2</span><span class="chip $4" style="height:20px;padding:0 6px;font-size:10.5px">$5 $6</span></div>
  <span class="mono" style="color:#c9d4e5;font-size:12px">$3</span>
</div>
H
}
{
dc_head ''
shell_open mfg "Manufacture" "Line station 2" 1 Manufacture
cat <<B
<div style="display:flex;align-items:center;gap:10px;padding:8px 24px;background:#2a2110;border-bottom:1px solid #5a4416;color:#f5c862;font-size:12px">
  $ICON_WARN <span style="font-weight:600">Manufacture mode</span><span style="color:#c9a45a">Production tools are enabled. Writes bypass customer password level.</span><span style="flex:1"></span><span class="btn sm" style="border-color:#5a4416;background:transparent;color:#f5c862">Exit mode</span>
</div>
<div style="padding:14px 24px 0;display:flex;align-items:center;gap:10px">
  <span style="font-size:18px;font-weight:600">DUT</span>
  <span class="input" style="gap:6px;height:32px">Slave 07 · SN 24A0012 · EC-FAN M $ICON_CHEV</span>
  <span class="chip ok">$ICON_PLUG Responding · 0.2 s</span>
  <span style="flex:1"></span>
  <span class="btn primary">$ICON_PLAY Run all checks</span>
  <span class="btn">Reset</span>
  <span class="btn">Export report</span>
</div>
<div class="tabs" style="padding:8px 24px 0">
  <span class="tab on">HW overview</span><span class="tab">Offset calibration</span><span class="tab">OS verification <span class="badge cap">53</span></span><span class="tab">Serial number</span>
</div>
<div style="padding:14px 24px;display:flex;flex-direction:column;gap:14px;flex:1;min-height:0">
  <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:12px">
    <div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px"><span class="label">Total</span><span class="mono" style="font-size:26px;font-weight:500">14</span></div>
    <div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px;border-color:#1f5a3c"><span class="label" style="color:#7fe2a8">Passed</span><span class="mono" style="font-size:26px;font-weight:500;color:#7fe2a8">9</span></div>
    <div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px;border-color:#6b1f33"><span class="label" style="color:#ff8aa3">Failed</span><span class="mono" style="font-size:26px;font-weight:500;color:#ff8aa3">1</span></div>
    <div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px"><span class="label">Pending</span><span class="mono" style="font-size:26px;font-weight:500;color:#8a9bb5">4</span></div>
  </div>
  <div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;min-height:0">
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;align-content:start">
      $(hw 01 "RS-485 communication" "12/12 frames OK · 1.8 ms" ok "$ICON_CHECK" Pass)
      $(hw 02 "USB / serial link" "COM3 · CH340" ok "$ICON_CHECK" Pass)
      $(hw 03 "OS version" "FW 1.0.8 · Boot 1.0.2" ok "$ICON_CHECK" Pass)
      $(hw 04 "Motor ID" "0x0213 · EC-FAN M 370 W" ok "$ICON_CHECK" Pass)
      $(hw 05 "Serial number" "24A0012 · written" ok "$ICON_CHECK" Pass)
      $(hw 06 "DC-link sensing" "311.2 V · expected 300–330" ok "$ICON_CHECK" Pass)
      $(hw 07 "IGBT temperature" "38.5 °C" ok "$ICON_CHECK" Pass)
      $(hw 08 "Input phase loss" "no fault" ok "$ICON_CHECK" Pass)
      $(hw 09 "Hall sensors U/V/W" "V stuck high · 0/120/240° expected" err "$ICON_WARN" Fail)
      $(hw 10 "Current offset Iu/Iv/Iw" "running · 3/8 samples" info "$ICON_SPIN" Running)
      $(hw 11 "Hall offset" "waiting for check 10" off "$ICON_CLOCK" Pending)
      $(hw 12 "Rotation direction" "not started" off "$ICON_CLOCK" Pending)
      $(hw 13 "Brake / stop" "not started" off "$ICON_CLOCK" Pending)
      $(hw 14 "EEPROM save" "not started" off "$ICON_CLOCK" Pending)
    </div>
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px;min-height:0">
      <div style="display:flex;align-items:center;gap:8px"><span class="mono" style="color:#5b6b85;font-size:11px">09</span><span style="font-weight:600">Hall sensors U/V/W</span><span style="flex:1"></span><span class="chip err" style="height:20px;padding:0 6px;font-size:10.5px">$ICON_WARN Fail</span></div>
      <div style="height:120px;background:#070c16;border:1px solid #1c2740;border-radius:6px;position:relative;overflow:hidden">
        <svg viewBox="0 0 300 120" preserveAspectRatio="none" style="width:100%;height:100%">
          <path d="M0 90 L50 90 L50 30 L150 30 L150 90 L250 90 L250 30 L300 30" fill="none" stroke="#ffd166" stroke-width="1.5"></path>
          <path d="M0 60 L300 60" fill="none" stroke="#4fd1ff" stroke-width="1.5"></path>
          <path d="M0 100 L100 100 L100 40 L200 40 L200 100 L300 100" fill="none" stroke="#ff6bd6" stroke-width="1.5" transform="translate(0,-5)"></path>
        </svg>
        <span class="mono" style="position:absolute;right:8px;top:6px;font-size:10.5px;color:#8a9bb5"><span style="color:#ffd166">U</span> <span style="color:#4fd1ff">V</span> <span style="color:#ff6bd6">W</span></span>
      </div>
      <div class="kv"><span>Criterion</span><b>6 edges per electrical cycle, 60° apart</b></div>
      <div class="kv"><span>Measured</span><b style="color:#ff8aa3">V stuck high · no edge in 2.0 s</b></div>
      <div class="kv"><span>Likely cause</span><b>Hall V wiring or sensor</b></div>
      <div style="flex:1"></div>
      <div style="display:flex;gap:6px"><span class="btn" style="flex:1;justify-content:center">$ICON_REFRESH Re-run</span><span class="btn" style="flex:1;justify-content:center">Open offset tab</span></div>
    </div>
  </div>
</div>
B
shell_close
dc_foot
} > Manufacture.dc.html
echo "Manufacture written"
