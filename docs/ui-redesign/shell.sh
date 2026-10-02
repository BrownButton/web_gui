# Shared fragments for FanCM redesign artboards. Source this file.
ICON_DASH='<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"></rect><rect x="13" y="3" width="8" height="8" rx="1.5"></rect><rect x="3" y="13" width="8" height="8" rx="1.5"></rect><rect x="13" y="13" width="8" height="8" rx="1.5"></rect></svg>'
ICON_DEV='<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"></rect><rect x="9" y="9" width="6" height="6" rx="1"></rect><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"></path></svg>'
ICON_CHART='<svg viewBox="0 0 24 24"><path d="M3 12h3l2-6 4 12 3-9 2 3h4"></path></svg>'
ICON_TERM='<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 9l3 3-3 3M12 15h5"></path></svg>'
ICON_MFG='<svg viewBox="0 0 24 24"><path d="M9 4h6v3H9zM5 7h14v13H5z"></path><path d="M9 14l2 2 4-4"></path></svg>'
ICON_SET='<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"></path><circle cx="16" cy="7" r="2"></circle><circle cx="9" cy="12" r="2"></circle><circle cx="18" cy="17" r="2"></circle></svg>'
ICON_MON='<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h13"></path><path d="M18 11l3 3-3 3"></path></svg>'
ICON_PLUG='<svg viewBox="0 0 24 24"><path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v3"></path></svg>'
ICON_SCAN='<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="M20 20l-4.5-4.5"></path></svg>'
ICON_PLUS='<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>'
ICON_PLAY='<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"></path></svg>'
ICON_STOP='<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>'
ICON_CHECK='<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"></path></svg>'
ICON_WARN='<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"></path><path d="M12 10v5M12 18h0"></path></svg>'
ICON_CLOCK='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>'
ICON_SPIN='<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-4-7.5"></path></svg>'
ICON_OFF='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"></circle><path d="M8 12h8"></path></svg>'
ICON_REFRESH='<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"></path><path d="M20 4v5h-5"></path></svg>'
ICON_MORE='<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18" cy="12" r="1.2"></circle></svg>'
ICON_CHEV='<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"></path></svg>'
ICON_LOCK='<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>'
ICON_SUN='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>'
ICON_X='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
ICON_BOLT='<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"></path></svg>'

dc_head() {
cat <<H
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
$(cat shared.css)
$1
  </style>
</helmet>
H
}
dc_foot() {
cat <<F
</x-dc>
</body>
</html>
F
}

# rail_item key label icon active
rail_item() {
  local cls="rail-item"; [ "$4" = "$1" ] && cls="rail-item active"
  echo "<div class=\"$cls\">$3<span>$2</span></div>"
}

# shell active title subtitle [connected=1] [role=User]
# Role decides rail visibility: User hides Terminal + Manufacture, Engineer hides Manufacture.
shell_open() {
  local active="$1" title="$2" sub="$3" conn="${4:-1}" role="${5:-User}"
  local dim=""; [ "$conn" = "1" ] || dim='opacity:.45;'
  echo '<div class="app">'
  echo '<div class="rail">'
  echo '<div class="rail-logo"><img src="LS_logo.svg" alt="LS"></div>'
  echo "<div style=\"${dim}display:flex;flex-direction:column;align-items:center;gap:4px\">"
  rail_item dashboard Dashboard "$ICON_DASH" "$active"
  rail_item devices Devices "$ICON_DEV" "$active"
  rail_item chart Chart "$ICON_CHART" "$active"
  [ "$role" != "User" ] && rail_item terminal Terminal "$ICON_TERM" "$active"
  if [ "$role" = "Manufacture" ]; then echo '<div class="rail-sep"></div>'; rail_item mfg Manufacture "$ICON_MFG" "$active"; fi
  echo '</div>'
  echo '<div class="rail-spacer"></div>'
  rail_item monitor Monitor "$ICON_MON" "$active"
  rail_item settings Settings "$ICON_SET" "$active"
  echo '</div>'
  echo '<div class="topbar">'
  echo "<span class=\"title\">$title</span><span class=\"sub\">$sub</span><span class=\"grow\"></span>"
  if [ "$conn" = "1" ]; then
    echo "<span class=\"chip ok\">$ICON_PLUG COM3 · 115200 8N1 · Connected</span>"
    echo "<span class=\"chip mono\" style=\"gap:10px\"><span>REQ <b style=\"color:#e6edf7\">12 480</b></span><span>OK <b style=\"color:#7fe2a8\">12 462</b></span><span>ERR <b style=\"color:#ff8aa3\">18</b></span><span style=\"color:#8a9bb5\">99.86%</span></span>"
  else
    echo "<span class=\"chip\">$ICON_OFF Not connected</span>"
  fi
  local r; echo -n '<span class="seg">'; for r in User Engineer Manufacture; do if [ "$r" = "$role" ]; then echo -n "<span class=\"on\">$r</span>"; else echo -n "<span>$r</span>"; fi; done; echo '</span>'
  echo "<span class=\"btn ghost\" style=\"padding:0 6px\">$ICON_SUN</span>"
  echo '</div>'
  echo '<div class="content">'
}
shell_close() { echo '</div></div>'; }
