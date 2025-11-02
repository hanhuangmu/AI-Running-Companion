// App bootstrap for AI Running Companion (Chinese UI)
// - 语音输入：Web Speech API（若可用）
// - 语音播报：speechSynthesis
// - 本地规则教练（analysis.js）
// - 可选：兼容 OpenAI 的 LLM（可配置 API Base/Model/Key）

(function () {
  const chatEl = document.getElementById('chat');
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('message');
  const micBtn = document.getElementById('micBtn');
  const clearChatBtn = document.getElementById('clearChat');

  const runForm = document.getElementById('runForm');
  const clearRunBtn = document.getElementById('clearRun');
  const startRunBtn = document.getElementById('startRun');
  const stopRunBtn = document.getElementById('stopRun');
  const destField = document.getElementById('destField');
  const searchPlaceBtn = document.getElementById('searchPlace');
  const mapEl = document.getElementById('map');
  // Goals & check-in UI
  const aiGoalBtn = document.getElementById('aiGoalBtn');
  const aiGoalModal = document.getElementById('aiGoalModal');
  const aiGoalForm = document.getElementById('aiGoalForm');
  const aiGoalCancel = document.getElementById('aiGoalCancel');
  const checkinBtn = document.getElementById('checkinBtn');
  const checkinStatus = document.getElementById('checkinStatus');

  // Metrics display elements
  const statusText = document.getElementById('statusText');
  const posText = document.getElementById('posText');
  const instPaceText = document.getElementById('instPaceText');
  const avgPaceText = document.getElementById('avgPaceText');
  const distText = document.getElementById('distText');
  const timeText = document.getElementById('timeText');
  const toDestRow = document.getElementById('toDestRow');
  const toDestText = document.getElementById('toDestText');

  const voiceToggle = document.getElementById('voiceToggle');
  const useOpenAI = document.getElementById('useOpenAI');
  const openaiKeyInput = document.getElementById('openaiKey');
  const openaiBaseInput = document.getElementById('openaiBase');
  const modelNameInput = document.getElementById('modelName');

  const state = {
    run: loadRunFromStorage(),
    speaking: false,
    recognizing: false,
    recognition: null,
    messages: [],
    running: false,
    watchId: null,
    track: [], // {lat,lng,timestamp}
    startTime: null,
    totalDistanceKm: 0,
    lastCoachAt: 0,
    // map state
    map: null,
    routeLine: null,
    routePlanLine: null,
    posMarker: null,
    destMarker: null,
    startMarker: null,
    weather: { lastAt: 0, tempC: null, windKph: null, weatherCode: null, desc: null },
    geoCtrl: null,
    // milestones
    lastKmSpoken: 0,
    lastKmAtTime: null,
    lastKmAtDist: 0,
  };

  // Map helpers (AMap)
  const isFiniteNum = (v) => Number.isFinite(v);
  const MAX_WALK_PLAN_KM = 30; // 步行路线最大规划距离，超出则跳过以避免 OVER_DIRECTION_RANGE
  function initMapIfNeeded() {
    if (!mapEl || state.map || typeof AMap === 'undefined') return;
    // Avoid initializing map when container is hidden or has no size
    try {
      const cs = window.getComputedStyle(mapEl);
      const hidden = cs && (cs.display === 'none' || cs.visibility === 'hidden');
      if (hidden || mapEl.offsetWidth === 0 || mapEl.offsetHeight === 0) return;
    } catch {}
    const m = new AMap.Map(mapEl, {
      zoom: 14,
      center: [116.397428, 39.90923], // Default Tiananmen Square, Beijing
      viewMode: '3D'
    });
    // routeLine 延迟到首次定位点到来时再创建，避免空路径告警
    // Clicking the map sets destination
    m.on('click', (e) => {
      const { lng, lat } = e.lnglat || {};
      if (isFiniteNum(lat) && isFiniteNum(lng)) setDestinationFromMap(lat, lng);
    });
    // Simple inline controls: Recenter and Fit
    const ctr = document.createElement('div');
    ctr.style.position = 'absolute';
    ctr.style.top = '10px';
    ctr.style.left = '10px';
    ctr.style.background = 'rgba(255,255,255,0.9)';
    ctr.style.borderRadius = '4px';
    ctr.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
    ctr.style.display = 'flex';
    ctr.style.gap = '6px';
    ctr.style.padding = '6px';
    const btn = (txt, title, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = txt;
      b.title = title;
      b.style.cursor = 'pointer';
      b.style.padding = '4px 8px';
      b.style.border = '1px solid #ccc';
      b.style.borderRadius = '3px';
      b.style.background = '#fff';
      b.addEventListener('click', (e) => { e.preventDefault(); onClick && onClick(); });
      return b;
    };
    ctr.appendChild(btn('居中', '居中到当前位置', () => recenterOnRunner()));
    ctr.appendChild(btn('全览', '全览路线', () => fitToRoute()));
    // AMap container is a div; we can append our control into mapEl
    mapEl.style.position = mapEl.style.position || 'relative';
    mapEl.appendChild(ctr);
    state.map = m;
    // Restore destination marker if any
    if (state.run && isFiniteNum(state.run?.destLat) && isFiniteNum(state.run?.destLng)) {
      updateDestMarker(state.run.destLat, state.run.destLng, state.run.destLabel || '目的地');
    }
    // One-time geolocation to show and center on user's current position
    if ('geolocation' in navigator) {
      try {
        navigator.geolocation.getCurrentPosition((pos)=>{
          const { longitude: lng, latitude: lat } = pos.coords || {};
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            ensurePosMarker(lat, lng);
            try { state.map.setZoomAndCenter(16, [lng, lat]); } catch {}
          }
        }, (err)=>{ console.warn('initial geolocation failed', err); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
      } catch {}
    }

    // Add AMap native Geolocation control (blue dot + button)
    try {
      AMap.plugin('AMap.Geolocation', function(){
        try {
          const geo = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            position: 'RB',
            zoomToAccuracy: true,
            showButton: true,
            showCircle: true,
            showMarker: true,
            panToLocation: true,
            convert: true,
          });
          // Attach to map
          try { m.addControl ? m.addControl(geo) : m.add(geo); } catch {}
          state.geoCtrl = geo;
          // Trigger once to display blue dot and center
          try {
            geo.getCurrentPosition((status, result) => {
              if (status === 'complete' && result && result.position) {
                const pos = result.position;
                const lng = (typeof pos.getLng === 'function') ? pos.getLng() : pos.lng;
                const lat = (typeof pos.getLat === 'function') ? pos.getLat() : pos.lat;
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  ensurePosMarker(lat, lng);
                  try { m.setZoomAndCenter(16, [lng, lat]); } catch {}
                }
              } else {
                console.warn('geolocation control failed', result);
              }
            });
          } catch {}
        } catch (e) { console.warn('AMap.Geolocation error', e); }
      });
    } catch {}
  }

  function updateRouteOnMap(point) {
    if (!state.map || !state.routeLine) return;
    const lng = Number(point?.lng);
    const lat = Number(point?.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (!state.routeLine) {
      try {
        state.routeLine = new AMap.Polyline({
          path: [new AMap.LngLat(lng, lat)],
          strokeColor: '#47a3ff',
          strokeWeight: 4
        });
        state.map.add(state.routeLine);
      } catch { /* ignore */ }
    } else {
      const path = state.routeLine.getPath() || [];
      try { path.push(new AMap.LngLat(lng, lat)); } catch { return; }
      try { state.routeLine.setPath(path); } catch {}
    }
    if (!state.startMarker) {
      state.startMarker = new AMap.Marker({ position: [lng, lat], title: '起点' });
      try { state.map.add(state.startMarker); } catch {}
    }
    if (!state.posMarker) {
      state.posMarker = new AMap.Marker({ position: [lng, lat], title: '当前位置' });
      try { state.map.add(state.posMarker); } catch {}
    } else {
      try { state.posMarker.setPosition([lng, lat]); } catch {}
    }
    // Follow user when running
    const z = state.map.getZoom();
    const targetZ = !Number.isFinite(z) ? 15 : Math.max(z, 15);
    try { state.map.setZoomAndCenter(targetZ, [lng, lat]); } catch {}
    // Plan/update route if destination exists
    maybePlanRoute();
  }

  function clearRouteOnMap() {
    if (state.routeLine && state.map) { try { state.map.remove(state.routeLine); } catch {} }
    state.routeLine = null;
    if (state.posMarker && state.map) { try { state.map.remove(state.posMarker); } catch {} state.posMarker = null; }
    if (state.startMarker && state.map) { try { state.map.remove(state.startMarker); } catch {} state.startMarker = null; }
  }

  function ensurePosMarker(lat, lng, label) {
    if (!state.map || typeof AMap === 'undefined') return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!state.posMarker) {
      try {
        state.posMarker = new AMap.Marker({ position: [lng, lat], title: label || '当前位置' });
        state.map.add(state.posMarker);
      } catch {}
    } else {
      try { state.posMarker.setPosition([lng, lat]); } catch {}
    }
  }

  function updateDestMarker(lat, lng, label) {
    if (!state.map || typeof AMap === 'undefined') return;
    if (!isFiniteNum(lat) || !isFiniteNum(lng)) return;
    if (!state.destMarker) {
      state.destMarker = new AMap.Marker({ position: [lng, lat], title: label || '目的地', label: label ? { content: label, direction: 'top' } : undefined });
      state.map.add(state.destMarker);
    } else {
      state.destMarker.setPosition([lng, lat]);
      if (label) state.destMarker.setLabel({ content: label, direction: 'top' });
    }
    // Try to plan route once destination is set
    maybePlanRoute();
  }

  function removeDestMarker() {
    if (state.destMarker && state.map) { try { state.map.remove(state.destMarker); } catch {} }
    state.destMarker = null;
    if (state.routePlanLine && state.map) { try { state.map.remove(state.routePlanLine); } catch {} }
    state.routePlanLine = null;
  }

  function setDestinationFromMap(lat, lng) {
    // Switch to destination mode
    const radios = runForm.querySelectorAll('input[name="mode"]');
    radios.forEach(r => { r.checked = (r.value === 'dest'); });
    destField.style.display = '';
    // Fill input field
    const destInput = document.getElementById('destination');
    if (destInput) destInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    // Update state
    state.run.mode = 'dest';
    state.run.destination = `${lat},${lng}`;
    state.run.destLabel = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    state.run.destLat = lat; state.run.destLng = lng;
    saveRunToStorage();
    updateUi();
    updateDestMarker(lat, lng, state.run.destLabel);
    addMsg('assistant', `已将目的地设置为地图坐标：${state.run.destLabel}`);
  }

  function fitToRoute() {
    if (!state.map || !state.routeLine) return;
    const overlays = [];
    if (state.routeLine) overlays.push(state.routeLine);
    if (state.routePlanLine) overlays.push(state.routePlanLine);
    if (overlays.length) {
      try { state.map.setFitView(overlays); } catch {}
    } else if (state.posMarker) {
      recenterOnRunner();
    }
  }

  function recenterOnRunner() {
    if (!state.map || !state.posMarker) return;
    const pos = state.posMarker.getPosition();
    const lng = typeof pos?.getLng === 'function' ? pos.getLng() : pos?.lng;
    const lat = typeof pos?.getLat === 'function' ? pos.getLat() : pos?.lat;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const z = state.map.getZoom();
    state.map.setZoomAndCenter(Math.max(z || 16, 16), [lng, lat]);
  }

  function loadRunFromStorage() {
    try {
      const r = JSON.parse(localStorage.getItem('run') || '{}') || {};
      const numKeys = ['destLat','destLng','instPaceMinPerKm','avgPaceMinPerKm','toDestKm','distance','duration'];
      for (const k of numKeys) {
        if (k in r) {
          let v = r[k];
          if (typeof v === 'string') {
            const s = v.trim();
            if (s === '') { delete r[k]; continue; }
            v = Number(s);
          }
          if (Number.isFinite(v)) r[k] = v; else delete r[k];
        }
      }
      return r;
    } catch { return {}; }
  }
  function saveRunToStorage() {
    localStorage.setItem('run', JSON.stringify(state.run || {}));
  }

  // --------------- 打卡（Check-in）---------------
  function loadCheckins() {
    try { return JSON.parse(localStorage.getItem('checkins')||'[]') || []; } catch { return []; }
  }
  function saveCheckins(arr) {
    localStorage.setItem('checkins', JSON.stringify(arr||[]));
  }
  function fmtDateKey(d) {
    const y=d.getFullYear(); const m=(d.getMonth()+1).toString().padStart(2,'0'); const da=d.getDate().toString().padStart(2,'0');
    return `${y}-${m}-${da}`;
  }
  function calcStreak(arr) {
    const set = new Set(arr.map(x=>x.date));
    let streak = 0; let d = new Date();
    while (set.has(fmtDateKey(d))) { streak++; d = new Date(d.getFullYear(), d.getMonth(), d.getDate()-1); }
    return streak;
  }
  function updateCheckinUi() {
    if (!checkinStatus) return;
    const arr = loadCheckins();
    const total = arr.length;
    const streak = calcStreak(arr);
    const today = fmtDateKey(new Date());
    const doneToday = arr.some(x=>x.date===today);
    checkinStatus.textContent = doneToday ? `已打卡｜连续 ${streak} 天｜累计 ${total} 次`
                                         : `未打卡｜连续 ${streak} 天｜累计 ${total} 次`;
    if (checkinBtn) checkinBtn.disabled = doneToday;
  }
  function doCheckin(note) {
    const arr = loadCheckins();
    const today = fmtDateKey(new Date());
    if (!arr.some(x=>x.date===today)) {
      arr.push({
        date: today,
        distanceKm: state.totalDistanceKm || 0,
        durationMin: state.startTime ? Math.round((Date.now()-state.startTime)/60000) : null,
        note: note || ''
      });
      saveCheckins(arr);
      updateCheckinUi();
      addMsg('assistant', '已完成今日打卡，继续加油！');
      speak('已完成今日打卡，继续加油');
      // Award streak medal if reached
      try {
        const streak = calcStreak(arr || []);
        if (streak >= 7) {
          try { if (typeof window !== 'undefined' && window.MedalSystem && typeof window.MedalSystem.award === 'function') window.MedalSystem.award(null, 'streak_7', { streak }); } catch (e) {}
        }
      } catch (e) {}
    }
  }

  // Helpers
  function addMsg(role, text) {
    const el = document.createElement('div');
    el.className = `msg ${role === 'user' ? 'me' : 'coach'}`;
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = role === 'user' ? '你' : '教练';
    const body = document.createElement('div'); body.className = 'text'; body.textContent = text;
    el.appendChild(meta); el.appendChild(body);
    // For assistant messages, add a small share button
    if (role !== 'user') {
      try {
        const shareBtn = document.createElement('button'); shareBtn.type = 'button'; shareBtn.textContent = '分享'; shareBtn.className = 'msg-share-btn';
        shareBtn.style.marginLeft = '8px'; shareBtn.style.fontSize = '12px'; shareBtn.addEventListener('click', (e)=>{
          try {
            if (window.ShareSystem && typeof window.ShareSystem.share === 'function') {
              window.ShareSystem.share('ai', { text }, { title: '教练建议' });
            } else alert('分享系统未加载');
          } catch (err) { console.warn('share assistant msg error', err); }
        });
        // append to meta area for compact UI
        meta.appendChild(shareBtn);
      } catch (e) { /* ignore */ }
    }
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function speak(text) {
    if (!voiceToggle.checked) return;
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1; u.lang = 'zh-CN';
    state.speaking = true;
    u.onend = () => { state.speaking = false; };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  // --------------- AI 目标建议 ---------------
  function bmiFrom(heightCm, weightKg) {
    const h = Number(heightCm)/100; const w = Number(weightKg);
    if (!Number.isFinite(h) || !Number.isFinite(w) || h<=0 || w<=0) return null;
    return w/(h*h);
  }
  function openAiGoalModal(open) {
    if (!aiGoalModal) return;
    aiGoalModal.style.display = open ? 'flex' : 'none';
  }
  async function fetchGoalAdviceViaLLM(payload) {
    // 复用已配置的 LLM
    const base = (openaiBaseInput?.value || '').trim();
    const model = (modelNameInput?.value || '').trim();
    const key = (openaiKeyInput?.value || '').trim();
    const useCloud = useOpenAI.checked && (key || base);
    const sys = '你是一名专业跑步教练与体能训练师。基于用户的身高、体重（BMI）、周跑量、可训练天数、跑步目的与PB等信息，给出中文目标建议：包含阶段目标（4-8周）、每周训练结构（质量课与轻松跑分配）、推荐配速区间与注意事项，控制在180字内。';
    const user = `用户画像 JSON：${JSON.stringify(payload)}`;
    if (useCloud) {
      try {
        const reply = await fetchOpenAI({ userText: user, run: state.run, apiKey: key, apiBase: base, model });
        return reply;
      } catch (e) { console.warn('Goal LLM error', e); }
    }
    // 规则兜底
    const bmi = payload.bmi;
    const purpose = payload.purpose || '健康';
    const wk = Number(payload.weeklyKm)||0;
    const days = Number(payload.daysPerWeek)||3;
    const cues = [];
    if (bmi && bmi>=27) cues.push('优先控强度，逐步增加跑量');
    else if (bmi && bmi<18.5) cues.push('注意营养与力量训练');
    if (wk<20) cues.push('先打基础，逐步加到每周20–30km');
    if (days<3) cues.push('建议每周≥3天跑步');
    const tip = cues.join('，') || '循序渐进，注意恢复';
    return `${purpose}目标建议：4–6周阶段。每周${days}天，1次质量课（节奏或间歇）+ 2–3次轻松跑；周跑量约${Math.max(15,Math.min(45,wk+10))}km；训练配速以可对话强度为主，质量课略快。${tip}。`;
  }

  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => { state.recognizing = true; micBtn.textContent = '🛑'; };
    rec.onend = () => { state.recognizing = false; micBtn.textContent = '🎤'; };
    rec.onerror = () => { state.recognizing = false; micBtn.textContent = '🎤'; };
    rec.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
      }
      if (final.trim()) {
        messageInput.value = final.trim();
        submitMessage();
      }
    };
    return rec;
  }

  // Geo + metrics helpers
  function haversineKm(a, b) {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function toRad(x){ return x * Math.PI/180; }
  function fmtPaceMinPerKm(minPerKm){
    if (!isFinite(minPerKm) || minPerKm <= 0) return '-';
    const min = Math.floor(minPerKm);
    const sec = Math.round((minPerKm - min) * 60);
    return `${min}分${sec.toString().padStart(2,'0')}秒/公里`;
  }
  function fmtTime(sec){
    if (!isFinite(sec) || sec < 0) return '-';
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec%3600)/60);
    const s = Math.floor(sec%60);
    return h>0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
  }

  // Encourage each kilometer
  function maybeAnnounceKilometer(){
    const kmDone = Math.floor(state.totalDistanceKm || 0);
    const last = state.lastKmSpoken || 0;
    if (kmDone > last && kmDone >= 1){
      const now = Date.now();
      const lastTime = state.lastKmAtTime || state.startTime || now;
      const lastDist = state.lastKmAtDist || 0;
      const deltaMin = (now - lastTime)/60000;
      const deltaDist = Math.max(0, (state.totalDistanceKm || 0) - lastDist);
      let lapPace = (deltaDist > 0.2) ? (deltaMin / deltaDist) : (state.run.instPaceMinPerKm || state.run.avgPaceMinPerKm || null);
      const lapLabel = isFinite(lapPace) ? fmtPaceMinPerKm(lapPace) : '-';
      const phrases = [
        (n, p)=>`已完成第 ${n} 公里，保持！该公里配速 ${p}。`,
        (n)=>`第 ${n} 公里到手，继续稳住节奏！`,
        (n)=>`不错！第 ${n} 公里完成，注意放松肩颈。`,
        (n)=>`第 ${n} 公里，呼吸顺畅，前进！`,
      ];
      const f = phrases[kmDone % phrases.length];
      const msg = f(kmDone, lapLabel);
      addMsg('assistant', msg);
      speak(msg);
      state.lastKmSpoken = kmDone;
      state.lastKmAtTime = now;
      state.lastKmAtDist = state.totalDistanceKm || 0;
    }
  }

  function parseDestInput(s){
    const t = (s||'').trim();
    if (!t) return { label: '', lat: null, lng: null };
    // Try lat,lng
    const m = t.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m){
      const lat = Number(m[1]); const lng = Number(m[2]);
      if (isFinite(lat) && isFinite(lng)) return { label: `${lat},${lng}`, lat, lng };
    }
    return { label: t, lat: null, lng: null };
  }

  function updateUi(){
    const running = state.running;
    statusText.textContent = running ? '进行中' : '未开始';
    if (state.track.length){
      const last = state.track[state.track.length-1];
      posText.textContent = `${last.lat.toFixed(5)}, ${last.lng.toFixed(5)}`;
    } else {
      posText.textContent = '-';
    }
    // Instant pace
    const inst = state.run.instPaceMinPerKm;
    instPaceText.textContent = fmtPaceMinPerKm(inst);
    // Avg pace
    const avg = state.run.avgPaceMinPerKm;
    avgPaceText.textContent = fmtPaceMinPerKm(avg);
    // Distance
    distText.textContent = isFinite(state.totalDistanceKm) ? `${state.totalDistanceKm.toFixed(2)} 公里` : '-';
    // Time
    const elapsed = state.startTime ? ((Date.now() - state.startTime)/1000) : 0;
    timeText.textContent = fmtTime(elapsed);
    // To destination
    if (state.run.mode === 'dest' && state.run.destLat != null && state.run.destLng != null && state.track.length){
      const last = state.track[state.track.length-1];
      const toKm = haversineKm({lat:last.lat,lng:last.lng},{lat:state.run.destLat,lng:state.run.destLng});
      toDestRow.style.display = '';
      toDestText.textContent = `${toKm.toFixed(2)} 公里`;
      state.run.toDestKm = toKm;
    } else {
      toDestRow.style.display = 'none';
      toDestText.textContent = '-';
      state.run.toDestKm = null;
    }
  }

  function handlePosition(pos){
    const { latitude: lat, longitude: lng, speed } = pos.coords || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { return; }
    const ts = pos.timestamp || Date.now();
    const point = { lat, lng, ts };
    const prev = state.track[state.track.length - 1];
    state.track.push(point);
    if (prev){
      const d = haversineKm(prev, point);
      const prevTotal = state.totalDistanceKm || 0;
      state.totalDistanceKm += d;
      // Award total_10km when crossing 10 km
      try {
        if (typeof window !== 'undefined' && window.MedalSystem && typeof window.MedalSystem.award === 'function') {
          try {
            if (prevTotal < 10 && (state.totalDistanceKm || 0) >= 10) {
              window.MedalSystem.award(null, 'total_10km', { distance: state.totalDistanceKm });
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
    // Instant pace: prefer native speed m/s if valid, else derive from last segment
    let mPerKm = null;
    if (speed != null && isFinite(speed) && speed > 0){
      const minPerKm = (1000 / speed) / 60; // speed m/s
      mPerKm = minPerKm;
    } else if (prev) {
      const dt = (point.ts - prev.ts)/1000; // s
      const dk = haversineKm(prev, point);
      if (dt > 0 && dk > 0) mPerKm = (dt/60) / dk;
    }
    state.run.instPaceMinPerKm = mPerKm;
    const elapsedMin = state.startTime ? (Date.now() - state.startTime) / 60000 : 0;
    state.run.avgPaceMinPerKm = (state.totalDistanceKm > 0) ? (elapsedMin / state.totalDistanceKm) : null;
    updateUi();
    // Update map
    initMapIfNeeded();
    updateRouteOnMap(point);
    // Weather (throttled)
    maybeFetchWeather(point.lat, point.lng);
    // Kilometer encouragement
    maybeAnnounceKilometer();
    maybeCoachRealtime();
  }

  function startWatching(){
    initMapIfNeeded();
    if (!('geolocation' in navigator)){
      addMsg('assistant','当前设备不支持地理定位。');
      speak('当前设备不支持地理定位');
      return;
    }
    if (state.running) return;
    state.running = true;
    state.track = [];
    state.totalDistanceKm = 0;
    state.startTime = Date.now();
    state.lastKmSpoken = 0; state.lastKmAtTime = state.startTime; state.lastKmAtDist = 0;
    // fresh route visuals
    clearRouteOnMap();
    // keep any previous planned route only when a destination is set; otherwise clear
    if (!(state.run && isFiniteNum(state.run?.destLat) && isFiniteNum(state.run?.destLng))) {
      removeDestMarker();
    }
    startRunBtn.disabled = true;
    stopRunBtn.disabled = false;
    updateUi();
    try {
      state.watchId = navigator.geolocation.watchPosition(
        handlePosition,
        (err)=>{
          addMsg('assistant', `定位失败：${err.message}`);
          speak('定位失败');
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
      );
      addMsg('assistant','已开始跑步。定位初始化中……');
      speak('已开始跑步，定位初始化中');
    } catch(e){
      addMsg('assistant','无法开始定位。');
    }
  }

  function stopWatching(){
    if (state.watchId != null){
      try { navigator.geolocation.clearWatch(state.watchId); } catch {}
      state.watchId = null;
    }
    state.running = false;
    startRunBtn.disabled = false;
    stopRunBtn.disabled = true;
    updateUi();
    // Show full route on finish
    fitToRoute();
    const tips = window.LocalCoach.analyzeRun({...state.run, distance: state.totalDistanceKm, duration: Math.round((Date.now()-state.startTime)/60000)});
    if (tips.length){ addMsg('assistant', `本次结束。${tips[0]}`); speak(tips[0]); }
    // Personal best detection: compare average pace (min/km) with stored best and award pb_run if improved
    try {
      const avg = state.run?.avgPaceMinPerKm;
      if (isFinite(avg) && avg > 0) {
        const BEST_KEY = 'ai_running_best_avgPace_local';
        const prev = parseFloat(localStorage.getItem(BEST_KEY) || '');
        if (!isFinite(prev) || avg < prev) {
          try { if (typeof window !== 'undefined' && window.MedalSystem && typeof window.MedalSystem.award === 'function') window.MedalSystem.award(null, 'pb_run', { avgPace: avg, prev }); } catch (e) {}
          try { localStorage.setItem(BEST_KEY, String(avg)); } catch (e) {}
        }
      }
    } catch (e) { console.warn('pb detection error', e); }
  }

  // --- Weather ---
  function weatherDescFromCode(code){
    const map = {
      0: '晴', 1: '多云', 2: '多云', 3: '阴',
      45: '雾', 48: '雾', 51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
      56: '小冻雨', 57: '冻雨', 61: '小雨', 63: '中雨', 65: '大雨',
      66: '小冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪',
      77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '强阵雪',
      95: '雷雨', 96: '雷雨伴有冰雹', 99: '强雷雨伴有冰雹'
    };
    return map[code] || '天气未知';
  }
  async function fetchWeather(lat, lng){
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather http ' + res.status);
      const data = await res.json();
      const cw = data.current_weather || {};
      const tempC = cw.temperature;
      const wind = cw.windspeed; // km/h
      const code = cw.weathercode;
      state.weather = {
        lastAt: Date.now(),
        tempC: isFinite(tempC) ? tempC : null,
        windKph: isFinite(wind) ? wind : null,
        weatherCode: code,
        desc: weatherDescFromCode(code)
      };
    } catch (e) {
      console.warn('weather fetch failed', e);
    }
  }
  function maybeFetchWeather(lat, lng){
    const now = Date.now();
    if (!state.weather.lastAt || now - state.weather.lastAt > 10 * 60 * 1000) {
      fetchWeather(lat, lng);
    }
  }

  // --- Geocoding & Route planning ---
  async function geocodePlace(name){
    const q = (name||'').trim(); if (!q) return null;
    if (typeof AMap === 'undefined') return null;
    return new Promise((resolve) => {
      AMap.plugin('AMap.Geocoder', function(){
        try {
          const geocoder = new AMap.Geocoder();
          geocoder.getLocation(q, (status, result) => {
            if (status === 'complete' && result.geocodes && result.geocodes.length) {
              const g = result.geocodes[0];
              const loc = g.location; // AMap.LngLat
              resolve({ lat: loc.lat, lng: loc.lng, label: g.formattedAddress || q });
            } else {
              resolve(null);
            }
          });
        } catch (e) { console.warn('AMap geocoder error', e); resolve(null); }
      });
    });
  }

  async function planRoute(from, to){
    if (!from || !to || !state.map || typeof AMap === 'undefined') return;
    const distKm = haversineKm(from, to);
    if (!Number.isFinite(distKm) || distKm > MAX_WALK_PLAN_KM) {
      // 距离过远，AMap.Walking 会返回 OVER_DIRECTION_RANGE，直接跳过并清理已有规划线
      if (state.routePlanLine && state.map) { try { state.map.remove(state.routePlanLine); } catch {} }
      state.routePlanLine = null;
      console.warn('Skipping walking route planning, distance too far:', distKm);
      return;
    }
    AMap.plugin('AMap.Walking', function(){
      try {
        const walking = new AMap.Walking({ policy: 0 });
        walking.search([from.lng, from.lat], [to.lng, to.lat], (status, result) => {
          if (status === 'complete' && result && result.routes && result.routes[0]) {
            const steps = result.routes[0].steps || [];
            const path = [];
            for (const s of steps) {
              const arr = s.path || [];
              for (const p of arr) path.push(p);
            }
            if (!path.length) { console.warn('AMap walking returned empty path'); return; }
            if (state.routePlanLine && state.map) { try { state.map.remove(state.routePlanLine); } catch {} }
            state.routePlanLine = new AMap.Polyline({
              path,
              strokeColor: '#3cb371',
              strokeWeight: 4,
              strokeStyle: 'dashed',
              strokeDasharray: [10, 6]
            });
            state.map.add(state.routePlanLine);
            if (!state.track.length || state.track.length < 3) {
              try { state.map.setFitView([state.routePlanLine]); } catch {}
            }
          } else {
            console.warn('AMap walking failed', result);
          }
        });
      } catch (e) { console.warn('AMap walking error', e); }
    });
  }

  function maybePlanRoute(){
    if (!state.map) return;
    if (state.run && isFiniteNum(state.run?.destLat) && isFiniteNum(state.run?.destLng)) {
      const last = state.track[state.track.length-1];
      if (last) {
        planRoute({ lat: last.lat, lng: last.lng }, { lat: state.run.destLat, lng: state.run.destLng });
      }
    }
  }

  async function maybeCoachRealtime(){
    const now = Date.now();
    // Speak at most once every 30s, and only after we have at least 200m and 60s
    const elapsedSec = state.startTime ? (now - state.startTime)/1000 : 0;
    if (elapsedSec < 60 || state.totalDistanceKm < 0.2) return;
    if (now - state.lastCoachAt < 30000) return;
    state.lastCoachAt = now;
    const context = {
      mode: state.run.mode,
      instPaceMinPerKm: state.run.instPaceMinPerKm,
      avgPaceMinPerKm: state.run.avgPaceMinPerKm,
      distanceKm: state.totalDistanceKm,
      elapsedSec,
      toDestKm: state.run.toDestKm,
      destLabel: state.run.destLabel || state.run.destination,
      weather: state.weather && {
        temperatureC: state.weather.tempC,
        windKph: state.weather.windKph,
        desc: state.weather.desc
      },
    };
    let advice = '';
    // Prefer cloud LLM if配置开启
    const base = (openaiBaseInput?.value || '').trim();
    const model = (modelNameInput?.value || '').trim();
    const key = (openaiKeyInput?.value || '').trim();
    const useCloud = useOpenAI.checked && (key || base);
    if (useCloud){
      try {
        const sys = '你是中文跑步教练。基于给定的实时数据，用1句话给出具体可执行的建议。避免客套，直达主题。';
        const user = `数据: ${JSON.stringify(context)}`;
        const msg = await fetchOpenAI({ userText: user, run: state.run, apiKey: key, apiBase: base, model });
        advice = msg || '';
      } catch(e){ advice = ''; }
    }
    if (!advice) advice = window.LocalCoach.realtimeAdvice(context);
    if (advice){ addMsg('assistant', advice); speak(advice); }
  }

  async function coachReply(userText) {
    const base = (openaiBaseInput?.value || '').trim();
    const model = (modelNameInput?.value || '').trim();
    const key = (openaiKeyInput?.value || '').trim();
    const useCloud = useOpenAI.checked && (key || base);
    if (useCloud) {
      try {
        const reply = await fetchOpenAI({ userText, run: state.run, apiKey: key, apiBase: base, model });
        return reply || window.LocalCoach.respondToMessage(userText, state.run);
      } catch (err) {
        console.warn('OpenAI error, falling back to local:', err);
        return window.LocalCoach.respondToMessage(userText, state.run);
      }
    }
    return window.LocalCoach.respondToMessage(userText, state.run);
  }

  async function submitMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    addMsg('user', text);
    messageInput.value = '';
    const reply = await coachReply(text);
    addMsg('assistant', reply);
    speak(reply);
  }

  async function fetchOpenAI({ userText, run, apiKey, apiBase, model }) {
    // 注意：浏览器中使用 API Key 存在泄露风险，生产环境请走后端代理。
    const sys = `你是一名专业的跑步教练。你可以结合用户的实时跑步数据（位置、即时配速、平均配速、已跑距离、与目的地距离、年龄/性别、当地天气）提供中文建议，不必等待用户提问。每次建议不超过120字，务求具体可执行。`;
    const ctx = `实时跑步数据 JSON：${JSON.stringify({
      mode: state.run.mode,
      instPaceMinPerKm: state.run.instPaceMinPerKm,
      avgPaceMinPerKm: state.run.avgPaceMinPerKm,
      distanceKm: state.totalDistanceKm,
      toDestKm: state.run.toDestKm,
      age: state.run.age,
      gender: state.run.gender,
      destLabel: state.run.destLabel || state.run.destination,
      weather: state.weather && {
        temperatureC: state.weather.tempC,
        windKph: state.weather.windKph,
        desc: state.weather.desc
      }
    })}`;
    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: `${ctx}\n\n用户：${userText}` }
    ];
    const base = (apiBase && apiBase.trim()) || 'https://api.openai.com/v1';
    const url = joinUrl(base, '/chat/completions');
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: (model && model.trim()) || 'gpt-4o-mini',
        messages,
        temperature: 0.7,
      })
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim();
  }

  function joinUrl(base, path) {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
  }

  // Events: chat
  chatForm.addEventListener('submit', (e) => { e.preventDefault(); submitMessage(); });
  micBtn.addEventListener('click', () => {
    if (!state.recognition) state.recognition = initRecognition();
    if (!state.recognition) {
      addMsg('assistant', '当前浏览器不支持语音识别。');
      return;
    }
    if (state.recognizing) {
      try { state.recognition.stop(); } catch {}
    } else {
      try { state.recognition.start(); } catch {}
    }
  });
  clearChatBtn.addEventListener('click', () => { chatEl.innerHTML = ''; });

  // Events: goals & check-in
  if (aiGoalBtn) aiGoalBtn.addEventListener('click', ()=> openAiGoalModal(true));
  if (aiGoalCancel) aiGoalCancel.addEventListener('click', ()=> openAiGoalModal(false));
  if (aiGoalForm) aiGoalForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const h = Number(document.getElementById('qHeight')?.value);
    const w = Number(document.getElementById('qWeight')?.value);
    const purpose = (document.getElementById('qPurpose')?.value||'').trim();
    const pb = (document.getElementById('qPB')?.value||'').trim();
    const weeklyKm = Number(document.getElementById('qWeeklyKm')?.value);
    const daysPerWeek = Number(document.getElementById('qDaysPerWeek')?.value);
    const bmi = bmiFrom(h, w);
    const payload = { heightCm:h, weightKg:w, bmi: bmi?Number(bmi.toFixed(1)):null, purpose, pb, weeklyKm, daysPerWeek,
      age: state.run?.age || null, gender: state.run?.gender || null };
    addMsg('assistant', '正在生成目标建议…');
    const advice = await fetchGoalAdviceViaLLM(payload);
    openAiGoalModal(false);
    if (advice) { addMsg('assistant', advice); speak(advice); }
    else { addMsg('assistant', '暂时无法生成建议，请稍后再试。'); }
  });
  if (checkinBtn) checkinBtn.addEventListener('click', ()=> doCheckin('用户手动打卡'));

  // Header: Medals button (打开/关闭奖章面板)
  try {
    const medalsBtn = document.getElementById('medalsBtn');
    if (medalsBtn) {
      medalsBtn.addEventListener('click', () => {
        try {
          if (typeof window !== 'undefined' && window.MedalSystem) {
            // ensure initialized once
            if (!document.getElementById('medal-system-root') && typeof window.MedalSystem.init === 'function') {
              try { window.MedalSystem.init({ userId: null }); } catch (e) { console.warn('MedalSystem init err', e); }
            }
            const root = document.getElementById('medal-system-root');
            const panel = root ? root.querySelector('.medal-panel') : null;
            if (panel) {
              panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
            } else {
              // Fallback: initialize (will create panel)
              try { if (typeof window.MedalSystem.init === 'function') window.MedalSystem.init({ userId: null }); } catch (e) { console.warn(e); }
            }
          } else {
            console.warn('MedalSystem not available');
            alert('奖章系统未加载');
          }
        } catch (e) { console.warn('medalsBtn click error', e); }
      });
    }
  } catch (e) {}

  // Events: running controls & form
  runForm.addEventListener('change', (e)=>{
    // Mode toggle show/hide destination field
    const fd = new FormData(runForm);
    const mode = (fd.get('mode')||'free').toString();
    destField.style.display = mode === 'dest' ? '' : 'none';
    // Persist gender/age, mode, destination
    const destRaw = (fd.get('destination')||'').toString();
    const parsedDest = parseDestInput(destRaw);
    state.run.mode = mode;
    state.run.destination = destRaw;
    state.run.destLabel = parsedDest.label;
    state.run.destLat = parsedDest.lat;
    state.run.destLng = parsedDest.lng;
    state.run.gender = (fd.get('gender')||'').toString();
    state.run.age = (fd.get('age')||'').toString();
    saveRunToStorage();
    updateUi();
    // Map destination marker update
    initMapIfNeeded();
    if (mode === 'dest' && parsedDest.lat != null && parsedDest.lng != null) {
      updateDestMarker(parsedDest.lat, parsedDest.lng, parsedDest.label || '目的地');
    } else {
      removeDestMarker();
    }
  });
  startRunBtn.addEventListener('click', startWatching);
  stopRunBtn.addEventListener('click', stopWatching);
  if (searchPlaceBtn) {
    searchPlaceBtn.addEventListener('click', async () => {
      const input = document.getElementById('destination');
      const q = input ? input.value : '';
      if (!q.trim()) { addMsg('assistant','请输入地名或经纬度后再搜索。'); return; }
      addMsg('assistant', `正在搜索：${q} ...`);
      const res = await geocodePlace(q);
      if (!res) { addMsg('assistant', '未找到匹配地点。请尝试更具体的名称。'); return; }
      // Switch to destination mode
      const radios = runForm.querySelectorAll('input[name="mode"]');
      radios.forEach(r => { r.checked = (r.value === 'dest'); });
      destField.style.display = '';
      if (input) input.value = res.label;
      state.run.mode = 'dest';
      state.run.destination = res.label;
      state.run.destLabel = res.label;
      state.run.destLat = res.lat; state.run.destLng = res.lng;
      saveRunToStorage();
      updateUi();
      initMapIfNeeded();
      updateDestMarker(res.lat, res.lng, res.label);
      addMsg('assistant', `已设置目的地：${res.label}`);
      // Plan route from current position if available
      const last = state.track[state.track.length-1];
      if (last) {
        planRoute({ lat: last.lat, lng: last.lng }, { lat: res.lat, lng: res.lng });
      }
    });
  }

  clearRunBtn.addEventListener('click', () => {
    // Only clear session metrics; keep age/gender/mode/destination
    state.track = [];
    state.totalDistanceKm = 0;
    state.startTime = null;
    state.run.instPaceMinPerKm = null;
    state.run.avgPaceMinPerKm = null;
    if (state.watchId != null) { try { navigator.geolocation.clearWatch(state.watchId); } catch {} }
    state.watchId = null;
    state.running = false;
    startRunBtn.disabled = false;
    stopRunBtn.disabled = true;
    updateUi();
    clearRouteOnMap();
    addMsg('assistant', '已清空本次跑步记录。');
  });

  // Prefill from storage
  (function prefill() {
    const r = state.run || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    // gender/age/destination and mode
    set('gender', r.gender || '');
    set('age', r.age || '');
    set('destination', r.destination || '');
    // mode radios
    const mode = r.mode || 'free';
    const radios = runForm.querySelectorAll('input[name="mode"]');
    radios.forEach(radio => { radio.checked = (radio.value === mode); });
    destField.style.display = mode === 'dest' ? '' : 'none';
    // LLM cfg
    try {
      const cfg = JSON.parse(localStorage.getItem('llmCfg') || '{}');
      if (cfg.apiBase) set('openaiBase', cfg.apiBase);
      if (cfg.model) set('modelName', cfg.model);
    } catch {}
  })();

  // Initial prompts / UI
  updateUi();
  initMapIfNeeded();
  addMsg('assistant', '你好！点击“开始跑步”后，我将实时播报当前位置、即时/平均配速，并在目的地模式下提示剩余距离。也可随时向我发问。');
  updateCheckinUi();

  // Save LLM cfg (key not stored)
  function saveCfg() {
    const cfg = {
      apiBase: (openaiBaseInput?.value || '').trim(),
      model: (modelNameInput?.value || '').trim(),
    };
    localStorage.setItem('llmCfg', JSON.stringify(cfg));
  }
  if (openaiBaseInput) openaiBaseInput.addEventListener('change', saveCfg);
  if (modelNameInput) modelNameInput.addEventListener('change', saveCfg);

  // Expose minimal app context for integrations outside this IIFE
  try {
    window.App = Object.assign(window.App || {}, {
      state,
      speak,
      voiceToggle,
      ensureMap: initMapIfNeeded,
    });
  } catch {}
})();



// ========================================
// 元气值和哈特心脏系统集成
// ========================================

// 初始化元气值系统
const energySystem = new EnergySystemFigma();

// Helpers to access app state/speak safely from outside IIFE
const getApp = () => (typeof window !== 'undefined' ? (window.App || null) : null);
const getState = () => { const app = getApp(); return app ? app.state : null; };

// UI元素引用
const energyBarFill = document.getElementById('energyBarFill');
const energyValue = document.getElementById('energyValue');
const heartIcon = document.getElementById('heartIcon');
const heartPath = document.getElementById('heartPath');
const heartGradStart = document.getElementById('heartGradStart');
const heartGradEnd = document.getElementById('heartGradEnd');
const energyMessage = document.getElementById('energyMessage');

/**
 * 更新元气值UI显示 - 增强版支持6级哈特系统
 */
function updateEnergyUI() {
  const status = energySystem.getDetailedStatus();

  // 更新进度条
  if (energyBarFill) {
    energyBarFill.style.width = status.percent;
    energyBarFill.setAttribute('data-level', status.state);
  }

  // 更新数值显示
  if (energyValue) {
    energyValue.textContent = status.percent;
    energyValue.setAttribute('data-level', status.state);
  }

  // 更新心脏状态
  if (heartIcon) {
    heartIcon.setAttribute('data-state', status.state);
    heartIcon.style.transform = `scale(${status.scale})`;
    heartIcon.style.opacity = status.opacity || 1.0;
  }

  // 更新心脏SVG路径的不透明度
  if (heartPath) {
    heartPath.style.opacity = status.opacity || 1.0;
  }

  // 更新心脏颜色渐变
  if (heartGradStart && heartGradEnd) {
    const gradColors = status.gradient.match(/#[0-9A-Fa-f]{6}/g);
    if (gradColors && gradColors.length >= 2) {
      heartGradStart.style.stopColor = gradColors[0];
      heartGradEnd.style.stopColor = gradColors[1];
    }
  }

  // 更新激励消息，使用等级名称
  if (energyMessage) {
    const levelInfo = status.name ? `Lv.${status.level} ${status.name}` : status.message;
    energyMessage.textContent = `${levelInfo} - ${status.message}`;
    energyMessage.style.color = status.color;
  }
}

/**
 * 集成元气值更新到现有的跑步追踪逻辑
 */
(function integrateEnergySystem() {
  const s = getState();
  if (!s) return; // 如果主应用尚未初始化，跳过集成（避免抛错）
  // 保存原始的位置更新处理器（若有）
  const originalWatchSuccess = s.handleWatchSuccess || function() {};
  
  // 包装位置更新处理器以包含元气值更新
  s.handleWatchSuccess = function(position) {
    // 调用原始处理
    if (typeof originalWatchSuccess === 'function') {
      try { originalWatchSuccess(position); } catch {}
    }
    
    // 计算运动指标用于元气值系统
    const nowState = getState();
    if (!nowState) return;
    const metrics = {
      running: nowState.running,
      instantPace: calculateInstantaneousPace(),
      targetPace: 6.0, // 可以从用户设置获取
      duration: nowState.running && nowState.startTime ? 
        Math.floor((Date.now() - nowState.startTime) / 1000) : 0,
      heartRate: estimateHeartRate(), // 估算心率
      justStopped: !nowState.running && nowState.track.length > 0
    };
    
    // 更新元气值
    energySystem.updateEnergy(metrics);
    
    // 更新UI
    updateEnergyUI();
  };
  
  // 计算即时配速（基于最近的位置点）
  function calculateInstantaneousPace() {
    const s = getState();
    if (!s || s.track.length < 2) return Infinity;
    
    const recentPoints = s.track.slice(-5); // 最近5个点
    let totalDist = 0;
    let totalTime = 0;
    
    for (let i = 1; i < recentPoints.length; i++) {
      const dist = haversineKm(
        recentPoints[i-1].lat, recentPoints[i-1].lng,
        recentPoints[i].lat, recentPoints[i].lng
      );
      const time = (recentPoints[i].timestamp - recentPoints[i-1].timestamp) / 1000;
      totalDist += dist;
      totalTime += time;
    }
    
    if (totalDist <= 0 || totalTime <= 0) return Infinity;
    
    // 返回分钟/公里
    return (totalTime / 60) / totalDist;
  }
  
  // 估算心率（基于配速和年龄）
  function estimateHeartRate() {
    const pace = calculateInstantaneousPace();
    if (!pace || pace === Infinity) return 75;
    
    const age = parseInt(document.getElementById('age')?.value) || 30;
    const maxHR = 220 - age;
    
    // 根据配速估算心率百分比
    let hrPercent = 0.5; // 默认50%最大心率
    
    if (pace < 4) hrPercent = 0.9;       // 非常快
    else if (pace < 5) hrPercent = 0.85; // 快速
    else if (pace < 6) hrPercent = 0.75; // 中等
    else if (pace < 7) hrPercent = 0.65; // 轻松
    else hrPercent = 0.55;                 // 慢跑
    
    return Math.round(maxHR * hrPercent);
  }
  
  // Haversine公式计算距离
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
})();

// 在开始跑步时重置元气值（全局作用域安全获取按钮引用）
(function attachEnergyResetOnStart() {
  try {
    const btn = document.getElementById('startRun');
    if (btn) {
      btn.addEventListener('click', function () {
        energySystem.reset();
        updateEnergyUI();
      });
    }
  } catch {}
})();

// 定期更新元气值（即使没有新的GPS数据）
setInterval(function() {
  const s = getState();
  if (s && (s.running || s.track.length > 0)) {
    const metrics = {
      running: s.running,
      instantPace: Infinity,
      duration: s.running && s.startTime ? 
        Math.floor((Date.now() - s.startTime) / 1000) : 0,
      justStopped: !s.running && s.track.length > 0
    };
    
    energySystem.updateEnergy(metrics);
    updateEnergyUI();
  }
}, 2000); // 每2秒更新一次

// 完成公里数时的元气奖励
function onKilometerCompleted(km) {
  energySystem.addBoost(5, `完成第${km}公里`);
  updateEnergyUI();
  
  // 语音鼓励
  const message = `完成第${km}公里！${energySystem.getMotivationalMessage()}`;
  if (getApp()?.voiceToggle?.checked && getApp()?.speak) {
    try { getApp().speak(message); } catch {}
  }

  // Award medal on first completed kilometer (first run milestone)
  try {
    if (typeof window !== 'undefined' && window.MedalSystem && typeof window.MedalSystem.award === 'function') {
      try { if ((Number(km) || 0) === 1) { window.MedalSystem.award(null, 'first_run', { km }); } } catch (e) {}
    }
  } catch (e) {}
}

// Share buttons: checkin & run
try {
  const shareCheckinBtn = document.getElementById('shareCheckinBtn');
  if (shareCheckinBtn) {
    shareCheckinBtn.addEventListener('click', () => {
      try {
        const arr = loadCheckins();
        const today = fmtDateKey(new Date());
        const todayRec = arr.find(x=>x.date===today) || { date: today, distanceKm: state.totalDistanceKm || 0, durationMin: state.startTime ? Math.round((Date.now()-state.startTime)/60000) : null };
        if (window.ShareSystem && typeof window.ShareSystem.share === 'function') {
          window.ShareSystem.share('checkin', todayRec, { title: `打卡：${todayRec.date}`, text: `已打卡 ${todayRec.distanceKm || 0} km` });
        } else alert('分享系统未加载');
      } catch (e) { console.warn('shareCheckin error', e); }
    });
  }
  const shareRunBtn = document.getElementById('shareRunBtn');
  if (shareRunBtn) {
    shareRunBtn.addEventListener('click', () => {
      try {
  const runData = { distanceKm: state.totalDistanceKm || 0, durationMin: state.startTime ? Math.round((Date.now()-state.startTime)/60000) : null, avgPace: state.run?.avgPaceMinPerKm || null, tips: '', track: (state.track||[]).map(p=>({ lat: p.lat, lng: p.lng })) };
        if (window.ShareSystem && typeof window.ShareSystem.share === 'function') {
          window.ShareSystem.share('run', runData, { title: '跑步记录分享', text: `已跑 ${runData.distanceKm.toFixed(2)} km` });
        } else alert('分享系统未加载');
      } catch (e) { console.warn('shareRun error', e); }
    });
  }
} catch (e) {}

// 导出供其他模块使用
window.energySystem = energySystem;
window.updateEnergyUI = updateEnergyUI;

console.log('✅ 元气值和哈特心脏系统已初始化');

// ========================================
// Figma风格启动屏逻辑
// ========================================

// 获取启动屏相关元素
const launchScreen = document.getElementById('launchScreen');
const launchPlayBtn = document.getElementById('launchPlayBtn');
const launchMicBtn = document.getElementById('launchMicBtn');
const launchHeartIcon = document.getElementById('launchHeartIcon');
const currentTimeEl = document.getElementById('currentTime');
const energyPercentEl = document.getElementById('energyPercent');

// 获取主界面元素
const appHeader = document.getElementById('appHeader');
const appMain = document.getElementById('appMain');
const appFooter = document.getElementById('appFooter');
const energyContainer = document.getElementById('energyContainer');

// 更新启动屏时间显示
function updateLaunchTime() {
  if (!currentTimeEl) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  currentTimeEl.textContent = `${hours}:${minutes}`;
}

// 更新启动屏元气值显示（显示在电量位置）- 增强版支持6级系统
function updateLaunchEnergy() {
  if (!energyPercentEl || !launchHeartIcon) return;

  const status = window.energySystem?.getDetailedStatus() || {state: 'normal', opacity: 1.0};
  energyPercentEl.textContent = window.energySystem ? `${Math.round(window.energySystem.energy)}%` : "100%";

  // 更新启动屏心脏状态
  launchHeartIcon.setAttribute('data-state', status.state);
  launchHeartIcon.style.opacity = status.opacity || 1.0;
  
  // 设置心脏颜色
  if (status.color) {
    launchHeartIcon.style.color = status.color;
  }
}

// 启动屏进入主界面
function enterMainApp() {
  // 添加渐隐动画
  launchScreen.classList.add('hidden');

  // 等待动画完成后隐藏启动屏
  setTimeout(() => {
    launchScreen.style.display = 'none';

    // 显示主界面
    appHeader.style.display = 'flex';
    appMain.style.display = 'grid';
    appFooter.style.display = 'block';
    energyContainer.style.display = 'flex';

    // 停止启动屏更新
    if (launchScreenTimer) {
      clearInterval(launchScreenTimer);
    }

    // 主界面可见后再初始化地图，避免容器尺寸为0导致 AMap 报错
    try { window.App?.ensureMap?.(); } catch {}
    console.log('✅ 进入主界面');
  }, 300);
}

// 播放按钮点击 - 直接开始跑步
if (launchPlayBtn) {
  launchPlayBtn.addEventListener('click', () => {
    enterMainApp();

    // 等待界面显示后自动开始跑步
    setTimeout(() => {
      const startRunBtn = document.getElementById('startRun');
      if (startRunBtn) {
        startRunBtn.click();
      }
    }, 400);
  });
}

// 麦克风按钮点击 - 进入主界面但不开始跑步
if (launchMicBtn) {
  launchMicBtn.addEventListener('click', () => {
    enterMainApp();

    // 可以选择打开聊天界面或语音输入
    setTimeout(() => {
      const messageInput = document.getElementById('message');
      if (messageInput) {
        messageInput.focus();
      }
    }, 400);
  });
}

// 路线卡片点击事件
const routeCards = document.querySelectorAll('.route-card');
routeCards.forEach(card => {
  card.addEventListener('click', function() {
    const routeName = this.querySelector('.route-name')?.textContent;
    console.log(`选择路线: ${routeName}`);

    // 进入主界面
    enterMainApp();

    // 可以根据路线名称设置目的地（未来扩展）
    setTimeout(() => {
      // TODO: 根据routeName设置目的地
      const startRunBtn = document.getElementById('startRun');
      if (startRunBtn) {
        startRunBtn.click();
      }
    }, 400);
  });
});

// 启动屏定时更新
let launchScreenTimer = null;
if (launchScreen && launchScreen.style.display !== 'none') {
  // 初始更新
  updateLaunchTime();
  
  // 等待energySystem初始化完成后再更新
  setTimeout(() => {
    try {
      if (window.energySystem) {
        updateLaunchEnergy();
      }
    } catch (e) {
      console.error("更新启动屏元气值失败:", e);
    }
  }, 500);

  // 定时更新时间和元气值
  launchScreenTimer = setInterval(() => {
    updateLaunchTime();
    try {
      if (window.energySystem) {
        updateLaunchEnergy();
      }
    } catch (e) {
      console.error("更新启动屏元气值失败:", e);
    }
  }, 1000);
}

// 导出供调试使用
window.enterMainApp = enterMainApp;

console.log('✅ Figma启动屏已初始化');

// -----------------------------
// MedalSystem 最小化初始化
// 如果页面已加载 medalSystem.js，则在此处进行一次安全的初始化（不引入大量逻辑）
try {
  if (window.MedalSystem && typeof window.MedalSystem.init === 'function') {
    // 使用默认 userId（null 表示本地存储），只做面板初始化
    try { window.MedalSystem.init({ userId: null }); console.log('✅ MedalSystem 已初始化'); } catch (e) { console.warn('MedalSystem init error', e); }
  }
} catch (e) { console.warn('MedalSystem safe init failed', e); }

