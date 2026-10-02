source ./shell.sh
# devrow name model id statusicon color [active]
devrow() {
  local bg="transparent"; [ "${6:-0}" = "1" ] && bg="#182742"
  cat <<R
<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;background:$bg">
  <span style="color:$5;display:flex;width:14px">$4</span>
  <span style="font-weight:500;flex:1">$1</span>
  <span class="badge $2">$(echo $2 | tr a-z A-Z)</span>
  <span class="badge id">$3</span>
</div>
R
}
# catrow label [badge-html] [active]
catrow() {
  local bg="transparent" col="#c9d4e5"; [ "${3:-0}" = "1" ] && bg="#182742" && col="#e6edf7"
  echo "<div style=\"display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:6px;background:$bg;color:$col;font-size:12.5px\"><span style=\"flex:1\">$1</span>$2</div>"
}
# frow label control unit statusclass statusicon statustext [note]
frow() {
  cat <<F
<div style="display:grid;grid-template-columns:220px 200px 60px minmax(0,1fr) 150px;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #1a2438">
  <div style="display:flex;flex-direction:column"><span>$1</span><span style="color:#5b6b85;font-size:11px" class="mono">$7</span></div>
  <div>$2</div>
  <span style="color:#8a9bb5;font-size:12px">$3</span>
  <span style="color:#5b6b85;font-size:11.5px">$8</span>
  <span class="chip $4" style="height:22px;padding:0 8px;font-size:11px;justify-self:end">$5 $6</span>
</div>
F
}
SEL_MODE='<span class="input" style="justify-content:space-between">Speed control '"$ICON_CHEV"'</span>'
SEL_SRC='<span class="input" style="justify-content:space-between">Modbus setpoint '"$ICON_CHEV"'</span>'
SEG_DIR='<span class="seg" style="height:28px"><span>CCW</span><span class="on">CW</span></span>'
NUM() { echo "<span class=\"input mono\" style=\"justify-content:flex-end;border-color:${2:-#2a3a58}\">$1</span>"; }

{
dc_head ''
shell_open devices "Devices" "Supply Fan 1" 1 Engineer
cat <<B
<div style="flex:1;display:grid;grid-template-columns:250px minmax(0,1fr);min-height:0">
  <div style="border-right:1px solid #1c2740;display:flex;flex-direction:column;padding:12px 8px;gap:4px;overflow:auto">
    <span class="input" style="margin:0 4px 6px;color:#5b6b85;gap:6px">$ICON_SCAN Search name, ID, serial</span>
    <span class="label" style="padding:6px 12px 2px">EC-FAN M</span>
    $(devrow "Supply Fan 1" m 07 "$ICON_PLAY" "#2fd27a" 1)
    $(devrow "Supply Fan 2" m 08 "$ICON_PLAY" "#2fd27a")
    $(devrow "Supply Fan 3" m 09 "$ICON_PLAY" "#2fd27a")
    $(devrow "Exhaust Fan 1" m 10 "$ICON_WARN" "#ff4d6d")
    <span class="label" style="padding:10px 12px 2px">EC-FAN S</span>
    $(devrow "Roof Fan A" s 21 "$ICON_PLAY" "#2fd27a")
    $(devrow "Roof Fan B" s 22 "$ICON_OFF" "#8a9bb5")
    <span class="label" style="padding:10px 12px 2px">Unidentified</span>
    $(devrow "Slave 12" u 12 "$ICON_OFF" "#8a9bb5")
    <div style="display:flex;align-items:center;gap:6px;padding:8px 12px;color:#5b6b85;font-size:11px;margin-top:auto">$ICON_PLAY Running · $ICON_WARN Alarm · $ICON_OFF Offline</div>
  </div>
  <div style="display:flex;flex-direction:column;min-height:0">
    <div style="padding:16px 24px 0;display:flex;align-items:center;gap:10px">
      <span style="font-size:18px;font-weight:600">Supply Fan 1</span>
      <span class="badge m">EC-FAN M</span><span class="badge id">ID 07</span>
      <span class="mono" style="color:#8a9bb5;font-size:12px">SN 24A0012 · FW 1.0.8 · Boot 1.0.2</span>
      <span style="flex:1"></span>
      <span class="chip ok">$ICON_PLAY Running · 1 245 RPM</span>
      <span class="btn">$ICON_REFRESH Read all</span>
      <span class="btn">$ICON_MORE</span>
    </div>
    <div class="tabs" style="padding:8px 24px 0">
      <span class="tab">Overview</span>
      <span class="tab on">Configuration</span>
      <span class="tab">Parameters <span class="badge cap">176</span></span>
      <span class="tab">Information</span>
      <span class="tab">Update</span>
      <span class="tab">Diagnostics <span class="badge cap">planned</span></span>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:210px minmax(0,1fr);min-height:0">
      <div style="padding:14px 12px;border-right:1px solid #1c2740;display:flex;flex-direction:column;gap:2px">
        $(catrow "Motor control" "" 1)
        $(catrow "Sensor input")
        $(catrow "Protection")
        $(catrow "Communication")
        $(catrow "Alarms" "<span class=\"badge cap\">12</span>")
        $(catrow "System")
        <span class="label" style="padding:12px 10px 4px;color:#f5c862">Engineer only</span>
        $(catrow "Motor information")
        $(catrow "Servo tuning")
        $(catrow "Product settings" "<span style=\"color:#f5c862\" title=\"Manufacturer password level\">$ICON_LOCK</span>")
        <span class="label" style="padding:12px 10px 4px">Not on this firmware</span>
        <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;color:#5b6b85;font-size:12.5px"><span style="flex:1">I/O pins</span><span class="badge cap">FW ≥ 1.2</span></div>
        <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;color:#5b6b85;font-size:12.5px"><span style="flex:1">Fail-safe</span><span class="badge cap">FW ≥ 1.2</span></div>
        <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;color:#5b6b85;font-size:12.5px"><span style="flex:1">Parameter sets</span><span class="badge cap">FW ≥ 1.2</span></div>
        <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;color:#5b6b85;font-size:12.5px"><span style="flex:1">Power limiter</span><span class="badge cap">FW ≥ 1.2</span></div>
      </div>
      <div style="padding:14px 24px;display:flex;flex-direction:column;min-height:0;overflow:auto">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:15px;font-weight:600">Motor control</span>
          <span style="color:#5b6b85;font-size:12px">Read 0.8 s ago · values shown in device units</span>
          <span style="flex:1"></span>
          <span class="seg"><span class="on">Form</span><span>Registers</span></span>
        </div>
        <div style="display:grid;grid-template-columns:220px 200px 60px minmax(0,1fr) 150px;gap:12px;padding:6px 0;border-bottom:1px solid #22304a">
          <span class="label">Parameter</span><span class="label">Value</span><span class="label">Unit</span><span class="label">Note</span><span class="label" style="justify-self:end">Status</span>
        </div>
        $(frow "Operating mode" "$SEL_MODE" "" ok "$ICON_CHECK" "Read" "0xD106" "0 = speed control · 2 = open-loop · 1 not used on this model")
        $(frow "Setpoint source" "$SEL_SRC" "" ok "$ICON_CHECK" "Read" "0xD101" "")
        $(frow "Running direction" "$SEG_DIR" "" info "$ICON_SPIN" "Writing" "0xD102" "Takes effect on next start")
        $(frow "Maximum speed" "$(NUM "1 600" "#f5b53f")" "RPM" warn "$ICON_CLOCK" "Unsaved" "0xD119" "Changed from 1 500 · used for RPM ↔ raw conversion")
        $(frow "Acceleration ramp" "$(NUM "5.0")" "s" ok "$ICON_CHECK" "Read" "0xD11A" "")
        $(frow "Deceleration ramp" "$(NUM "5.0")" "s" ok "$ICON_CHECK" "Read" "0xD11B" "")
        $(frow "Max coil current" "$(NUM "3.2" "#ff4d6d")" "A" err "$ICON_X" "Failed · retry" "0xD13B" "Illegal data value · device limit is 3.0 A")
        <div style="flex:1"></div>
        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;margin:0 -8px;background:#0f1f3a;border:1px solid #2f6fe0;border-radius:10px">
          <span class="chip warn">$ICON_CLOCK 1 unsaved change</span>
          <span style="color:#8a9bb5;font-size:12px">Writes go to RAM first. Save to EEPROM to keep them after power cycle.</span>
          <span style="flex:1"></span>
          <span class="btn ghost">Discard</span>
          <span class="btn">Write 1</span>
          <span class="btn primary">Write and save to EEPROM</span>
        </div>
      </div>
    </div>
  </div>
</div>
B
shell_close
dc_foot
} > Device.dc.html
echo "Device written"
