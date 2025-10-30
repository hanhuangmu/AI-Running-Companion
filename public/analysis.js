// Basic, local rule-based coach for running guidance.
// No network calls; safe to run in-browser only.

function estimateMaxHr(age) {
  if (!age || age <= 0) return 200; // fallback
  // Common formulae: 220-age; Tanaka: 208 - 0.7*age. Use Tanaka as a middle ground.
  return Math.round(208 - 0.7 * age);
}

function hrZone(avgHr, maxHr) {
  if (!avgHr || !maxHr) return { zone: "unknown", pct: null };
  const pct = (avgHr / maxHr) * 100;
  let zone = "Z1";
  if (pct < 60) zone = "Z1（非常轻松/恢复）";
  else if (pct < 70) zone = "Z2（轻松/有氧）";
  else if (pct < 80) zone = "Z3（节奏/稳态）";
  else if (pct < 90) zone = "Z4（阈值）";
  else zone = "Z5（最大摄氧量/间歇）";
  return { zone, pct: Math.round(pct) };
}

function paceFromDistanceAndDuration(distanceKm, durationMin) {
  if (!distanceKm || !durationMin || distanceKm <= 0) return null;
  const paceMinPerKm = durationMin / distanceKm;
  const min = Math.floor(paceMinPerKm);
  const sec = Math.round((paceMinPerKm - min) * 60);
  return { paceMinPerKm, label: `${min}分${sec.toString().padStart(2, "0")}秒/公里` };
}

function analyzeRun(run) {
  const recs = [];
  const age = toNum(run.age);
  const maxHr = estimateMaxHr(age);
  const avgHr = toNum(run.avgHr);
  // Support legacy fields (distance/duration) and realtime metrics
  const distanceKm = toNum(run.distance) || toNum(run.distanceKm) || toNum(run.totalDistanceKm);
  const durationMin = toNum(run.duration) || (toNum(run.elapsedSec) ? toNum(run.elapsedSec)/60 : null);
  const notes = (run.notes || "").toLowerCase();

  let p = paceFromDistanceAndDuration(distanceKm, durationMin);
  if (!p && run.avgPaceMinPerKm) {
    const min = Math.floor(run.avgPaceMinPerKm);
    const sec = Math.round((run.avgPaceMinPerKm - min) * 60);
    p = { paceMinPerKm: run.avgPaceMinPerKm, label: `${min}分${sec.toString().padStart(2, "0")}秒/公里` };
  }
  if (p) recs.push(`你的平均配速为 ${p.label}。`);

  if (avgHr) {
    const z = hrZone(avgHr, maxHr);
    if (z.pct) {
      recs.push(`平均心率 ${avgHr} 次/分 ≈ 最高心率的 ${z.pct}% → ${z.zone}。`);
      if (z.pct >= 88) recs.push("强度较高。建议缩短重复时长、拉长恢复时间，留意跑姿与呼吸。");
      else if (z.pct >= 80) recs.push("接近阈值。推荐10–20分钟一组，中间穿插2–3分钟轻松跑。");
      else if (z.pct >= 70) recs.push("稳态有氧，有助于建立耐力。保持可对话的呼吸节奏。");
      else recs.push("轻松区间，适合恢复或热身/放松。");
    }
  }

  if (distanceKm && distanceKm >= 10 && (!durationMin || durationMin > distanceKm * 7)) {
    recs.push("检测到较长距离。建议补给（每小时30–60克碳水）与补水（每小时400–800毫升）。");
  }

  if (notes.includes("hot") || notes.includes("heat") || notes.includes("热") || notes.includes("炎热")) {
    recs.push("天气炎热。配速放慢10–20秒/公里，增加水与电解质摄入。");
  }
  if (notes.includes("hill") || notes.includes("hills") || notes.includes("elevation") || notes.includes("坡") || notes.includes("爬坡")) {
    recs.push("存在爬坡。上坡时适当缩短步幅、提高步频；身体从脚踝轻微前倾。");
  }

  if (p && p.paceMinPerKm <= 4.5) recs.push("强度较快。结束后优先做好放松与轻度拉伸。");
  if (p && p.paceMinPerKm >= 7.5) recs.push("今天配速较轻松——非常适合恢复日，保持可对话强度。");

  if (!distanceKm && !durationMin && !avgHr && !run.avgPaceMinPerKm) {
    recs.push("添加距离、时长或心率以获得个性化建议。");
  }

  return recs;
}

function realtimeAdvice(ctx){
  const d = toNum(ctx.distanceKm);
  const ip = toNum(ctx.instPaceMinPerKm);
  const ap = toNum(ctx.avgPaceMinPerKm);
  const t = toNum(ctx.elapsedSec);
  const toDest = toNum(ctx.toDestKm);

  const fmt = (minPerKm)=>{
    if (!minPerKm) return '-';
    const m = Math.floor(minPerKm); const s = Math.round((minPerKm - m) * 60);
    return `${m}分${s.toString().padStart(2,'0')}秒/公里`;
  };

  if (!d || !t) return '';

  const parts = [];
  if (ip) parts.push(`即时 ${fmt(ip)}`);
  if (ap) parts.push(`平均 ${fmt(ap)}`);
  if (toDest && ctx.mode === 'dest') parts.push(`距目的地约 ${toDest.toFixed(2)} 公里`);

  // Simple coaching cues
  if (ip && ap) {
    const delta = ip - ap; // min/km: positive means slower than avg
    if (delta <= -0.2) parts.push('配速略快，注意放松上身。');
    else if (delta >= 0.3) parts.push('配速偏慢，可小幅提高步频。');
    else parts.push('节奏稳定，保持呼吸顺畅。');
  }
  return parts.join('，');
}

function respondToMessage(message, run) {
  const m = (message || "").toLowerCase();
  const tips = analyzeRun(run);

  // Quick intents
  if (/配速|pace/.test(m)) {
    let p = paceFromDistanceAndDuration(toNum(run.distance), toNum(run.duration));
    if (!p && run && toNum(run.avgPaceMinPerKm)){
      const v = toNum(run.avgPaceMinPerKm); const min = Math.floor(v); const sec = Math.round((v-min)*60);
      p = { paceMinPerKm: v, label: `${min}分${sec.toString().padStart(2,'0')}秒/公里` };
    }
    return p ? `你的平均配速为 ${p.label}。${attachTopTip(tips)}`
             : `需要提供距离与时长，或开始实时跑步以计算配速。${attachTopTip(tips)}`;
  }
  if (/(心率|hr|heart).*(区间|区|rate)|心率区|zone/.test(m)) {
    const maxHr = estimateMaxHr(toNum(run.age));
    const z = hrZone(toNum(run.avgHr), maxHr);
    return z.pct ? `平均心率 ${run.avgHr} 次/分，约为最高心率的 ${z.pct}%（估计最高心率 ${maxHr}）。区间：${z.zone}。${attachTopTip(tips)}`
                 : `提供年龄（可选）与平均心率后，我可以给出区间建议。${attachTopTip(tips)}`;
  }
  if (/补水|喝水|水|hydrate|drink/.test(m)) {
    return "补水建议：每小时约400–800毫升；炎热天气增加电解质，少量多次补充。";
  }
  if (/补给|碳水|营养|fuel|carb|nutrition/.test(m)) {
    return "超过60分钟的跑步：每小时补充约30–60克碳水。训练中就要实践比赛日的补给策略。";
  }
  if (/热身|warm.?up/.test(m)) {
    return "热身：5–10分钟轻松跑 + 3–4组加速跑。活动踝关节与髋部，循序渐进过渡到目标配速。";
  }
  if (/放松|冷身|cool.?down/.test(m)) {
    return "放松：5–10分钟轻松跑。小腿与髋部做轻度牵伸；30–60分钟内完成补水与补给。";
  }
  if (/受伤|疼|痛|injur|pain|hurt/.test(m)) {
    return "若疼痛影响跑姿或持续不缓解，请停止训练并咨询专业人士。不要硬撑尖锐的疼痛。";
  }

  // Default: summarize top suggestions and reflect user message
  const summary = tips.length ? `这里有条建议：${tips[0]}` : "告诉我你的距离、时长和心率，我可以给出更有针对性的建议。";
  return `${reflect(m)} ${summary}`.trim();
}

  function attachTopTip(tips) {
  return tips && tips.length ? `建议：${tips[0]}` : "";
}

  function reflect(m) {
  if (!m) return "收到。";
  if (m.length < 50) return `收到：“${capitalize(m)}”。`;
  return "我理解了。";
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

window.LocalCoach = { analyzeRun, respondToMessage, realtimeAdvice };
