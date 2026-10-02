source ./shell.sh
sw() { echo "<div style=\"display:flex;flex-direction:column;gap:4px\"><span style=\"height:36px;border-radius:6px;background:$1;border:1px solid #22304a\"></span><span style=\"font-size:11px\">$2</span><span class=\"mono\" style=\"font-size:10.5px;color:#8a9bb5\">$1</span></div>"; }
swl() { echo "<div style=\"display:flex;flex-direction:column;gap:4px\"><span style=\"height:36px;border-radius:6px;background:$1;border:1px solid #d0d7e0\"></span><span style=\"font-size:11px;color:#1c2740\">$2</span><span class=\"mono\" style=\"font-size:10.5px;color:#5b6b85\">$1</span></div>"; }
st() { echo "<div style=\"display:grid;grid-template-columns:150px 60px 60px minmax(0,1fr);gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #1a2438;font-size:12px\"><span>$1</span><span class=\"dot\" style=\"background:$2;width:10px;height:10px\"></span><span style=\"color:$2;display:flex\">$3</span><span class=\"chip $4\" style=\"height:22px;align-self:start;justify-self:start\">$3 $5</span></div>"; }
tree() { echo "<div style=\"display:flex;align-items:center;gap:8px;padding:4px 0 4px $1px;font-size:12.5px\"><span style=\"width:6px;height:6px;border-radius:50%;background:#4f8df7\"></span><span>$2</span><span style=\"color:#5b6b85;font-size:11.5px\">$3</span>$4</div>"; }
{
dc_head 'body{width:1440px;height:1400px;overflow:hidden}'
cat <<B
<div style="padding:32px 40px;display:flex;flex-direction:column;gap:28px;width:1440px;height:1400px">
  <div style="display:flex;align-items:baseline;gap:14px"><span style="font-size:22px;font-weight:600">FanCM design system · draft 1</span><span style="color:#8a9bb5">Tokens, status conventions, information architecture, gating rules</span></div>
  <div style="display:grid;grid-template-columns:400px 500px minmax(0,1fr);gap:32px">
    <div style="display:flex;flex-direction:column;gap:14px">
      <span class="label">Information architecture</span>
      $(tree 0 "Connect" "onboarding · first screen / modal" "")
      $(tree 0 "Dashboard" "monitor · operate · bulk actions" "")
      $(tree 16 "Device cards" "grouped by product family" "")
      $(tree 16 "Selection action bar" "replaces All Device Control" "")
      $(tree 0 "Devices" "one device, all of its settings" "")
      $(tree 16 "Overview · Configuration · Parameters" "" "")
      $(tree 16 "Information · Update · Diagnostics" "" "<span class=\"badge cap\">planned</span>")
      $(tree 0 "Chart" "oscilloscope + docked control" "")
      $(tree 0 "Terminal" "raw frames · CANopen SDO" "<span class=\"badge role\">Engineer</span>")
      $(tree 0 "Manufacture" "HW · Offset · OS · Serial" "<span class=\"badge role\">Manufacture</span>")
      $(tree 0 "Monitor" "right drawer · TX/RX log" "")
      $(tree 0 "Settings" "modal · polling · scan · simulator" "")
      <span class="label" style="margin-top:10px">Role × capability gating</span>
      <div style="display:grid;grid-template-columns:130px repeat(3, minmax(0,1fr));gap:1px;background:#1e2b45;border:1px solid #1e2b45;border-radius:8px;overflow:hidden;font-size:11.5px">
        <span style="background:#0e1626;padding:6px 8px" class="label">Area</span><span style="background:#0e1626;padding:6px 8px" class="label">User</span><span style="background:#0e1626;padding:6px 8px" class="label">Engineer</span><span style="background:#0e1626;padding:6px 8px" class="label">Manufacture</span>
        <span style="background:#111a2b;padding:6px 8px">Dashboard, Devices</span><span style="background:#111a2b;padding:6px 8px;color:#7fe2a8">show</span><span style="background:#111a2b;padding:6px 8px;color:#7fe2a8">show</span><span style="background:#111a2b;padding:6px 8px;color:#7fe2a8">show</span>
        <span style="background:#111a2b;padding:6px 8px">Servo tuning, Terminal</span><span style="background:#111a2b;padding:6px 8px;color:#5b6b85">hidden</span><span style="background:#111a2b;padding:6px 8px;color:#7fe2a8">show</span><span style="background:#111a2b;padding:6px 8px;color:#7fe2a8">show</span>
        <span style="background:#111a2b;padding:6px 8px">Manufacture tools</span><span style="background:#111a2b;padding:6px 8px;color:#5b6b85">hidden</span><span style="background:#111a2b;padding:6px 8px;color:#5b6b85">hidden</span><span style="background:#111a2b;padding:6px 8px;color:#7fe2a8">show</span>
        <span style="background:#111a2b;padding:6px 8px">Unsupported by model / FW</span><span style="background:#111a2b;padding:6px 8px;color:#5b6b85">hidden</span><span style="background:#111a2b;padding:6px 8px;color:#f5c862">disabled + reason</span><span style="background:#111a2b;padding:6px 8px;color:#f5c862">disabled + reason</span>
        <span style="background:#111a2b;padding:6px 8px">Password-locked parameter</span><span style="background:#111a2b;padding:6px 8px;color:#f5c862">lock icon</span><span style="background:#111a2b;padding:6px 8px;color:#f5c862">lock icon</span><span style="background:#111a2b;padding:6px 8px;color:#7fe2a8">unlocked</span>
      </div>
      <span style="color:#8a9bb5;font-size:11.5px;line-height:1.5">Rule: role decides <b style="color:#c9d4e5">visibility</b> (rail items, category groups), device capability decides <b style="color:#c9d4e5">enabled state</b>, password level decides <b style="color:#c9d4e5">write access</b> (lock icon). A disabled control always carries a reason chip (FW ≥ 1.2, model S).</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px">
      <span class="label">Status conventions · color + icon + text, always all three</span>
      $(st "Port connected" "#2fd27a" "$ICON_PLUG" ok "COM3 · Connected")
      $(st "Port disconnected" "#8a9bb5" "$ICON_OFF" off "Not connected")
      $(st "Polling (live watch)" "#2fd27a" "$ICON_REFRESH" ok "Live · 420 ms cycle")
      $(st "Running" "#2fd27a" "$ICON_PLAY" ok "Running")
      $(st "Stopped / idle" "#8a9bb5" "$ICON_STOP" off "Stopped")
      $(st "Warning" "#f5b53f" "$ICON_WARN" warn "W03 Derating")
      $(st "Alarm" "#ff4d6d" "$ICON_WARN" err "Alarm E12")
      $(st "Limit active" "#f5b53f" "$ICON_BOLT" warn "Current limit active")
      $(st "Offline" "#8a9bb5" "$ICON_OFF" off "Offline · 3 retries")
      $(st "Value read" "#2fd27a" "$ICON_CHECK" ok "Read")
      $(st "Unsaved edit" "#f5b53f" "$ICON_CLOCK" warn "Unsaved")
      $(st "Write queued" "#f5b53f" "$ICON_CLOCK" warn "Queued · 2 ahead")
      $(st "Writing" "#4f8df7" "$ICON_SPIN" info "Writing")
      $(st "Confirmed" "#2fd27a" "$ICON_CHECK" ok "Confirmed 12:03:41")
      $(st "Failed" "#ff4d6d" "$ICON_X" err "Failed · retry")
      <span class="label" style="margin-top:10px">Write lifecycle on the RS-485 bus</span>
      <div style="display:flex;align-items:center;gap:0;font-size:11.5px">
        <span class="chip warn">$ICON_CLOCK Queued</span><span style="width:28px;height:1px;background:#2a3a58"></span>
        <span class="chip info">$ICON_SPIN Writing</span><span style="width:28px;height:1px;background:#2a3a58"></span>
        <span class="chip ok">$ICON_CHECK Confirmed</span><span style="color:#5b6b85;margin:0 8px">or</span><span class="chip err">$ICON_X Failed</span>
      </div>
      <span style="color:#8a9bb5;font-size:11.5px;line-height:1.5">Every value shows its own freshness (<span class="mono" style="color:#c9d4e5">0.3 s</span>) and the bar shows the poll cycle. Numbers are tabular monospace with a thin space as thousands separator and the unit next to the number, never in the label only.</span>
      <span class="label" style="margin-top:10px">Type</span>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="font-size:22px;font-weight:600">Page title 22 / 600 · IBM Plex Sans</span>
        <span style="font-size:18px;font-weight:600">Section 18 / 600</span>
        <span style="font-size:13px">Body 13 / 400 · line 1.4</span>
        <span class="label">Label 11 / 500 / uppercase / 0.06em</span>
        <span class="mono" style="font-size:30px;font-weight:500">1 245 RPM · readout 30 / IBM Plex Mono</span>
        <span class="mono" style="font-size:12px">0xD02D · 12:03:41 · code 12 / mono</span>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px">
      <span class="label">Color · dark (default)</span>
      <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:10px">
        $(sw "#0b111d" "bg")$(sw "#0e1626" "bg-rail")$(sw "#111a2b" "surface")$(sw "#182742" "surface-active")
        $(sw "#1e2b45" "line")$(sw "#2a3a58" "line-strong")$(sw "#e6edf7" "text")$(sw "#8a9bb5" "text-sub")
        $(sw "#2f6fe0" "brand-action")$(sw "#4f8df7" "brand-accent")$(sw "#003875" "LS blue")$(sw "#ED164B" "LS red")
        $(sw "#2fd27a" "ok")$(sw "#f5b53f" "warn")$(sw "#ff4d6d" "error")$(sw "#5b6b85" "off")
      </div>
      <span class="label">Color · light</span>
      <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:10px;padding:12px;background:#f5f7fb;border-radius:8px">
        $(swl "#f5f7fb" "bg")$(swl "#eef1f6" "bg-rail")$(swl "#ffffff" "surface")$(swl "#e4ecfb" "surface-active")
        $(swl "#e3e8f0" "line")$(swl "#c9d2e0" "line-strong")$(swl "#1c2740" "text")$(swl "#5b6b85" "text-sub")
        $(swl "#2456c7" "brand-action")$(swl "#2f6fe0" "brand-accent")$(swl "#003875" "LS blue")$(swl "#ED164B" "LS red")
        $(swl "#1a9d55" "ok")$(swl "#c98a12" "warn")$(swl "#d9284f" "error")$(swl "#9aa5b8" "off")
      </div>
      <span class="label">Chart channels · product families</span>
      <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:10px">
        $(sw "#ffd166" "CH1")$(sw "#4fd1ff" "CH2")$(sw "#ff6bd6" "CH3")$(sw "#7bff9a" "CH4")
      </div>
      <div style="display:flex;gap:8px"><span class="badge m">EC-FAN M</span><span class="badge s">EC-FAN S</span><span class="badge u">Unidentified</span><span class="badge id">ID 07</span><span class="badge role">Engineer</span><span class="badge cap">FW ≥ 1.2</span></div>
      <span class="label">Shape</span>
      <div style="display:flex;gap:10px;align-items:flex-end">
        <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><span style="width:56px;height:36px;border-radius:6px;background:#172236;border:1px solid #2a3a58"></span><span style="font-size:11px;color:#8a9bb5">control 6</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><span style="width:56px;height:36px;border-radius:10px;background:#111a2b;border:1px solid #1e2b45"></span><span style="font-size:11px;color:#8a9bb5">card 10</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><span style="width:56px;height:36px;border-radius:6px;background:#111a2b;border:1px solid #1e2b45;box-shadow:0 8px 24px rgba(0,0,0,.35)"></span><span style="font-size:11px;color:#8a9bb5">floating</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><span class="mono" style="font-size:11px;color:#c9d4e5">4 · 8 · 12 · 16 · 24</span><span style="font-size:11px;color:#8a9bb5">spacing px</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><span class="mono" style="font-size:11px;color:#c9d4e5">24 · 28 · 30 · 38</span><span style="font-size:11px;color:#8a9bb5">control heights</span></div>
      </div>
      <span class="label" style="margin-top:6px">Layout</span>
      <span style="color:#8a9bb5;font-size:11.5px;line-height:1.5">66 px icon rail · 52 px top bar · 24 px page gutter · 12-column card grid at 12 px gap (4 cards per row at 1440). Desktop first; below 1100 px the rail keeps icons only and cards drop to 2 per row.</span>
    </div>
  </div>
</div>
B
dc_foot
} > Tokens.dc.html
echo "Tokens written"
