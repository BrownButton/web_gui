source ./shell.sh
LOFI='body{background:#f7f7f4;color:#333;font-family:"Segoe Print","Comic Sans MS","Bradley Hand",cursive,sans-serif}
.w{width:1440px;height:900px;display:grid;overflow:hidden;background:#f7f7f4}
.bx{border:2px solid #444;border-radius:6px;background:#fff;display:flex;flex-direction:column;gap:8px;padding:10px}
.bx.g{background:#ececea}
.t{font-weight:700;font-size:14px}
.s{font-size:12px;color:#666}
.ln{height:8px;background:#ddd;border-radius:4px}
.ph{background:repeating-linear-gradient(135deg,#eee,#eee 6px,#f7f7f4 6px,#f7f7f4 12px);border:2px dashed #999;border-radius:6px}
.tag{display:inline-block;border:2px solid #444;border-radius:12px;padding:1px 8px;font-size:11px;background:#fff}
.hl{background:#fff3a3;padding:0 3px}'

{
dc_head "$LOFI"
cat <<B
<div class="w" style="grid-template-columns:200px minmax(0,1fr);grid-template-rows:56px minmax(0,1fr)">
  <div class="bx g" style="grid-row:1/3;border-radius:0;gap:6px">
    <span class="t">LS · FanCM</span>
    <span class="tag" style="align-self:flex-start">● COM3 connected</span>
    <span class="s">Text sidebar, like today</span>
    <div class="ln" style="width:70%;background:#444;height:12px"></div>
    <div class="ln" style="width:60%"></div><div class="ln" style="width:65%"></div><div class="ln" style="width:55%"></div>
    <div style="flex:1"></div>
    <span class="s">Engineer ▸ Terminal, Manufacture</span>
    <div class="ln" style="width:60%"></div><div class="ln" style="width:50%"></div>
    <span class="s">Settings</span>
  </div>
  <div class="bx g" style="border-radius:0;flex-direction:row;align-items:center"><span class="t">Dashboard</span><span style="flex:1"></span><span class="tag">REQ · OK · ERR</span><span class="tag">Light theme</span><span class="tag">Role: User</span></div>
  <div style="padding:16px;display:flex;flex-direction:column;gap:12px;min-height:0">
    <div style="display:flex;gap:8px"><span class="tag">All</span><span class="tag">EC-FAN M</span><span class="tag">EC-FAN S</span><span style="flex:1"></span><span class="tag">Scan</span><span class="tag">+ Add</span></div>
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:12px">
      <div class="bx" style="height:170px"><span class="t">Supply Fan 1 <span class="tag">M</span></span><div class="ln" style="width:40%"></div><span style="font-size:26px;font-weight:700">1 245 RPM</span><div class="ln"></div><div class="ln" style="width:60%"></div></div>
      <div class="bx" style="height:170px"><span class="t">Supply Fan 2 <span class="tag">M</span></span><div class="ln" style="width:40%"></div><span style="font-size:26px;font-weight:700">1 248 RPM</span><div class="ln"></div><div class="ln" style="width:60%"></div></div>
      <div class="bx" style="height:170px"><span class="t">Roof Fan A <span class="tag">S</span></span><div class="ln" style="width:40%"></div><span style="font-size:26px;font-weight:700">62.5 %</span><div class="ln"></div><div class="ln" style="width:60%"></div></div>
    </div>
    <div class="ph" style="height:150px;display:flex;align-items:center;justify-content:center"><span class="s">more cards…</span></div>
    <div style="flex:1"></div>
    <div class="bx" style="flex-direction:row;align-items:center;background:#fff3a3"><span class="t">2 selected</span><span class="tag">RPM / %</span><span class="tag">0 25 50 75 100</span><span class="tag">Apply</span><span class="tag">Stop</span></div>
  </div>
</div>
B
dc_foot
} > OptionLight.dc.html

{
dc_head "$LOFI"
cat <<B
<div class="w" style="grid-template-columns:66px 260px minmax(0,1fr) 320px;grid-template-rows:56px minmax(0,1fr)">
  <div class="bx g" style="grid-row:1/3;border-radius:0;align-items:center"><span class="t">LS</span><div class="ln" style="width:30px;height:30px;border-radius:8px;background:#444"></div><div class="ln" style="width:30px;height:30px;border-radius:8px"></div><div class="ln" style="width:30px;height:30px;border-radius:8px"></div></div>
  <div class="bx g" style="grid-column:2/5;border-radius:0;flex-direction:row;align-items:center"><span class="t">Workbench</span><span class="tag">● COM3</span><span style="flex:1"></span><span class="tag">Layout: Tune</span><span class="tag">Role: Engineer</span></div>
  <div class="bx g" style="border-radius:0;gap:6px">
    <span class="t">Devices</span>
    <div class="bx" style="padding:6px;background:#fff3a3"><span>Supply Fan 1 · 07</span></div>
    <div class="bx" style="padding:6px"><span>Supply Fan 2 · 08</span></div>
    <div class="bx" style="padding:6px"><span>Roof Fan A · 21</span></div>
    <div class="bx" style="padding:6px"><span>Roof Fan B · 22</span></div>
    <div style="flex:1"></div>
    <span class="s">Select many → bulk bar in inspector</span>
  </div>
  <div style="padding:12px;display:flex;flex-direction:column;gap:10px;min-height:0">
    <div class="ph" style="flex:1;display:flex;align-items:center;justify-content:center"><span class="t">Chart always in the middle</span></div>
    <div class="bx" style="height:160px;flex-direction:row;gap:12px"><div class="bx" style="flex:1"><span class="s">CH1–4</span></div><div class="bx" style="flex:1"><span class="s">Trigger</span></div><div class="bx" style="flex:1"><span class="s">Cursors</span></div></div>
  </div>
  <div class="bx g" style="border-radius:0;gap:8px">
    <span class="t">Inspector · Supply Fan 1</span>
    <div class="bx" style="gap:6px"><span class="s">Control</span><span style="font-size:24px;font-weight:700">1 245 RPM</span><div style="display:flex;gap:6px"><span class="tag">Run</span><span class="tag">Stop</span><span class="tag">SP 1 250</span></div></div>
    <div class="bx" style="gap:6px"><span class="s">Configuration (tabs)</span><div class="ln"></div><div class="ln" style="width:70%"></div><div class="ln" style="width:80%"></div></div>
    <div class="bx" style="gap:6px"><span class="s">Parameters</span><div class="ln"></div><div class="ln" style="width:60%"></div></div>
    <div style="flex:1"></div>
    <span class="s">Dashboard / Manufacture become other layouts of the same shell</span>
  </div>
</div>
B
dc_foot
} > OptionWorkbench.dc.html
echo "Options written"
