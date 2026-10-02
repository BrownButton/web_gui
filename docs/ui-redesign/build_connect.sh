source ./shell.sh
{
dc_head ''
shell_open dashboard "Connect" "" 0
cat <<B
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:40px">
  <div style="display:flex;align-items:center;gap:0">
    <div style="display:flex;align-items:center;gap:8px"><span style="width:24px;height:24px;border-radius:50%;background:#2f6fe0;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">1</span><span style="font-weight:600">Connect port</span></div>
    <span style="width:80px;height:1px;background:#2a3a58;margin:0 12px"></span>
    <div style="display:flex;align-items:center;gap:8px;color:#8a9bb5"><span style="width:24px;height:24px;border-radius:50%;border:1px solid #2a3a58;display:inline-flex;align-items:center;justify-content:center;font-size:12px">2</span><span>Discover devices</span></div>
    <span style="width:80px;height:1px;background:#2a3a58;margin:0 12px"></span>
    <div style="display:flex;align-items:center;gap:8px;color:#8a9bb5"><span style="width:24px;height:24px;border-radius:50%;border:1px solid #2a3a58;display:inline-flex;align-items:center;justify-content:center;font-size:12px">3</span><span>Identify models</span></div>
  </div>

  <div class="card" style="width:640px;padding:24px 28px;display:flex;flex-direction:column;gap:18px">
    <div style="display:flex;flex-direction:column;gap:4px">
      <span style="font-size:18px;font-weight:600">Connect to the RS-485 bus</span>
      <span style="color:#8a9bb5">Chrome or Edge will ask for permission to use the serial port. Settings are remembered per port.</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <span class="label">Serial port</span>
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #2f6fe0;background:#0f1f3a;border-radius:8px">
        $ICON_PLUG<span style="font-weight:600">COM3</span><span style="color:#8a9bb5">USB-SERIAL CH340</span><span style="flex:1"></span><span class="chip info" style="height:22px">Last used · 8 devices</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #22304a;border-radius:8px;color:#8a9bb5">
        $ICON_PLUG<span style="font-weight:500;color:#c9d4e5">COM5</span><span>FTDI FT232R</span><span style="flex:1"></span>
      </div>
      <span style="color:#5b6b85;font-size:11.5px">Port not listed? <a href="#">Request port access</a></span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:10px">
      <div style="display:flex;flex-direction:column;gap:6px"><span class="label">Baud</span><span class="input mono" style="justify-content:space-between">115200 $ICON_CHEV</span></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="label">Parity</span><span class="input" style="justify-content:space-between">None $ICON_CHEV</span></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="label">Data bits</span><span class="input mono" style="justify-content:space-between">8 $ICON_CHEV</span></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="label">Stop bits</span><span class="input mono" style="justify-content:space-between">1 $ICON_CHEV</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0e1626;border-radius:8px">
      <span class="toggle on"></span><span>Scan IDs <b class="mono">1–32</b> after connecting</span>
      <span style="flex:1"></span>
      <span style="color:#8a9bb5;font-size:12px">Timeout <b class="mono" style="color:#c9d4e5">200 ms</b> · register <b class="mono" style="color:#c9d4e5">0xD011</b></span>
      <span style="color:#4f8df7;font-size:12px">Change</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span class="btn primary" style="height:38px;padding:0 20px;font-size:13px">$ICON_PLUG Connect and scan</span>
      <span class="btn" style="height:38px">Connect only</span>
      <span style="flex:1"></span>
      <span style="color:#8a9bb5;font-size:12px">No hardware? <a href="#">Start the simulator</a></span>
    </div>
  </div>

  <div style="width:640px;display:flex;flex-direction:column;gap:8px">
    <span class="label">After connecting, the bar collapses to this</span>
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px dashed #2a3a58;border-radius:8px">
      <span class="chip ok">$ICON_PLUG COM3 · 115200 8N1 · Connected</span>
      <span style="color:#5b6b85;font-size:12px">click → reconnect · change settings · disconnect</span>
    </div>
  </div>
</div>
B
shell_close
dc_foot
} > Connect.dc.html
echo "Connect written"
