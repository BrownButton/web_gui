source ./shell.sh
# ---- device card helper --------------------------------------------------
# card name sn id modelcls modeltxt statuscls statustxt statusicon fresh actual unit setpoint writecls writeicon writetxt footer [checked] [dim]
card() {
  local name="$1" sn="$2" id="$3" mcls="$4" mtxt="$5" scls="$6" stxt="$7" sicon="$8" fresh="$9"
  local actual="${10}" unit="${11}" sp="${12}" wcls="${13}" wicon="${14}" wtxt="${15}" footer="${16}" checked="${17:-0}" dim="${18:-0}"
  local chk='<span style="width:14px;height:14px;border:1px solid #3a4a68;border-radius:3px;display:inline-block"></span>'
  if [ "$checked" = "1" ]; then
    chk='<span style="width:14px;height:14px;border-radius:3px;background:#2f6fe0;display:inline-flex;align-items:center;justify-content:center"><svg class="ic" viewBox="0 0 24 24" style="width:11px;height:11px;stroke:#fff;stroke-width:3"><path d="M5 12l5 5 9-10"></path></svg></span>'
  fi
  local border="#1e2b45"; [ "$checked" = "1" ] && border="#2f6fe0"
  local op="1"; [ "$dim" = "1" ] && op="0.6"
  cat <<C
<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;border-color:$border;opacity:$op">
  <div style="display:flex;align-items:center;gap:8px">
    $chk
    <span style="font-weight:600;font-size:13px">$name</span>
    <span class="badge $mcls">$mtxt</span>
    <span style="flex:1"></span>
    <span class="badge id">ID $id</span>
    <span style="color:#5b6b85">$ICON_MORE</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;font-size:11.5px">
    <span class="chip $scls" style="height:22px;padding:0 8px">$sicon $stxt</span>
    <span class="mono" style="color:#8a9bb5;font-size:11px">SN $sn</span>
    <span style="flex:1"></span>
    <span class="mono" style="color:#5b6b85;font-size:11px;display:inline-flex;align-items:center;gap:4px">$ICON_REFRESH $fresh</span>
  </div>
  <div style="display:flex;align-items:baseline;gap:8px">
    <span class="mono" style="font-size:30px;font-weight:500;line-height:1;letter-spacing:-.01em">$actual</span>
    <span style="color:#8a9bb5;font-size:12px">$unit actual</span>
    <span style="flex:1"></span>
    <span class="mono" style="color:#c9d4e5;font-size:12px">SP $sp</span>
  </div>
  <div style="display:flex;align-items:center;gap:6px">
    <span class="input mono" style="width:86px;justify-content:flex-end">$sp</span>
    <span class="seg" style="height:28px"><span class="on">RPM</span><span>%</span></span>
    <span class="btn sm primary" style="height:28px">Apply</span>
    <span style="flex:1"></span>
    <span class="chip $wcls" style="height:22px;padding:0 8px;font-size:11px">$wicon $wtxt</span>
  </div>
  <div style="display:flex;gap:4px">
    <span class="btn sm" style="flex:1;justify-content:center">0</span><span class="btn sm" style="flex:1;justify-content:center">25</span><span class="btn sm" style="flex:1;justify-content:center">50</span><span class="btn sm" style="flex:1;justify-content:center">75</span><span class="btn sm" style="flex:1;justify-content:center">100 %</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;border-top:1px solid #1e2b45;padding-top:8px;min-height:22px">$footer</div>
</div>
C
}

MON='<span class="kv" style="gap:8px"><span>Iq <b class="mono">2.4 A</b></span><span>Temp <b class="mono">41 °C</b></span></span><span style="flex:1"></span><span style="color:#5b6b85;font-size:11px">Add monitor</span>'
ICON_LIST='<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>'
ALARM_FOOT="<span class=\"chip err\" style=\"height:20px;padding:0 6px;font-size:11px\">$ICON_WARN E12 Over temperature</span><span style=\"flex:1\"></span><span class=\"btn sm\">Reset alarm</span>"
LIMIT_FOOT="<span class=\"chip warn\" style=\"height:20px;padding:0 6px;font-size:11px\">$ICON_BOLT Current limit active</span><span style=\"flex:1\"></span><span style=\"color:#5b6b85;font-size:11px\">Why?</span>"
OFF_FOOT='<span style="color:#8a9bb5;font-size:11px">Last seen 12:01:15 · check wiring or ID</span><span style="flex:1"></span><span class="btn sm">Retry</span>'

{
dc_head ''
shell_open dashboard "Dashboard" "7 devices · poll cycle 420 ms"
cat <<B
<div style="padding:16px 24px 0;display:flex;align-items:center;gap:10px">
  <span style="font-size:18px;font-weight:600">Devices</span>
  <span style="color:#8a9bb5">6 online · 1 offline</span>
  <span style="flex:1"></span>
  <span class="chip" style="gap:8px"><span class="toggle on"></span>Live watch</span>
  <span class="btn">$ICON_SCAN Scan</span>
  <span class="btn">$ICON_PLUS Add device</span>
  <span class="seg" style="height:30px"><span class="on">$ICON_DASH</span><span>$ICON_LIST</span></span>
</div>
<div style="padding:12px 24px 0;display:flex;align-items:center;gap:6px">
  <span class="chip info">All · 7</span>
  <span class="chip"><span class="badge m">EC-FAN M</span> 4</span>
  <span class="chip"><span class="badge s">EC-FAN S</span> 2</span>
  <span class="chip"><span class="badge u">Unidentified</span> 1</span>
  <span style="width:1px;height:18px;background:#22304a;margin:0 4px"></span>
  <span class="chip"><span style="color:#2fd27a;display:flex">$ICON_PLAY</span>Running 4</span>
  <span class="chip"><span style="color:#ff4d6d;display:flex">$ICON_WARN</span>Alarm 1</span>
  <span class="chip"><span style="color:#8a9bb5;display:flex">$ICON_OFF</span>Offline 1</span>
  <span style="flex:1"></span>
  <span class="input" style="width:220px;color:#5b6b85;gap:6px">$ICON_SCAN Search name, ID, serial</span>
</div>
<div style="padding:16px 24px 0;display:flex;flex-direction:column;gap:14px;flex:1;min-height:0;overflow:hidden">
  <div style="display:flex;align-items:center;gap:8px"><span class="badge m">EC-FAN M</span><span style="font-weight:500">Supply air group</span><span style="color:#5b6b85;font-size:11.5px">4 devices · Modbus RTU + CANopen tunnel · FW 1.0.8</span><span style="flex:1"></span><span style="color:#8a9bb5;font-size:11.5px">Select all</span></div>
  <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:12px">
$(card "Supply Fan 1" 24A0012 07 m M ok Running "$ICON_PLAY" "0.3 s" "1 245" RPM "1 250" ok "$ICON_CHECK" "Confirmed 12:03:41" "$MON" 1)
$(card "Supply Fan 2" 24A0013 08 m M ok Running "$ICON_PLAY" "0.4 s" "1 248" RPM "1 250" info "$ICON_SPIN" "Writing" "$MON" 1)
$(card "Supply Fan 3" 24A0014 09 m M ok Running "$ICON_PLAY" "0.6 s" "980" RPM "1 250" warn "$ICON_CLOCK" "Queued · 2 ahead" "$MON" 1)
$(card "Exhaust Fan 1" 24A0021 10 m M err "Alarm E12" "$ICON_WARN" "0.2 s" "0" RPM "1 250" err "$ICON_X" "Failed · retry" "$ALARM_FOOT")
  </div>
  <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:12px">
  <div style="grid-column:1/3;display:flex;align-items:center;gap:8px"><span class="badge s">EC-FAN S</span><span style="font-weight:500">Roof units</span><span style="color:#5b6b85;font-size:11.5px">2 devices · Modbus RTU only · no CANopen, no fast update</span><span style="flex:1"></span><span style="color:#8a9bb5;font-size:11.5px">Select all</span></div>
  <div style="grid-column:3/4;display:flex;align-items:center;gap:8px"><span class="badge u">Unidentified</span><span style="color:#5b6b85;font-size:11.5px">1 device · found by scan</span></div>
  <div></div>
$(card "Roof Fan A" "—" 21 s S ok Running "$ICON_PLAY" "0.9 s" "62.5" "%" "62.5" ok "$ICON_CHECK" "Confirmed 11:58:02" "$LIMIT_FOOT")
$(card "Roof Fan B" "—" 22 s S off "Offline" "$ICON_OFF" "no data" "— —" "%" "40.0" off "$ICON_OFF" "Offline · 3 retries" "$OFF_FOOT" 0 1)
<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;border-style:dashed;border-color:#3a4a68">
  <div style="display:flex;align-items:center;gap:8px"><span class="badge u">Unidentified</span><span style="font-weight:600">Slave 12</span><span style="flex:1"></span><span class="badge id">ID 12</span></div>
  <div style="color:#8a9bb5;font-size:12px;line-height:1.5">Responds on 0xD011 but the product ID is unknown. Choose a model to unlock controls, or keep it as a generic Modbus device.</div>
  <div style="display:flex;gap:6px;margin-top:auto"><span class="btn sm primary">Identify model</span><span class="btn sm">Generic</span><span class="btn sm ghost">Ignore</span></div>
</div>
  </div>
</div>
<div style="margin:0 24px 16px;display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f1f3a;border:1px solid #2f6fe0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35)">
  <span style="font-weight:600">3 selected</span><span style="color:#8fb8ff">$ICON_X</span>
  <span style="width:1px;height:20px;background:#2a3a58"></span>
  <span class="seg"><span class="on">RPM</span><span>%</span></span>
  <span class="btn sm">0</span><span class="btn sm">25</span><span class="btn sm">50</span><span class="btn sm">75</span><span class="btn sm">100 %</span>
  <span class="input mono" style="width:96px;justify-content:flex-end">1 250</span>
  <span class="btn primary">Apply to 3</span>
  <span class="btn danger">$ICON_STOP Stop 3</span>
  <span style="flex:1"></span>
  <span class="btn ghost">Reset alarms</span>
  <span style="color:#5b6b85;font-size:11.5px;display:inline-flex;gap:4px;align-items:center">$ICON_CLOCK Writes are queued between poll cycles · ~0.5 s per device</span>
</div>
B
shell_close
dc_foot
} > Main.dc.html
echo "Main written: $(wc -c < Main.dc.html) bytes"
