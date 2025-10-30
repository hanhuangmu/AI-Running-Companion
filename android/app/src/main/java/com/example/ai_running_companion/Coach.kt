package com.example.ai_running_companion

import kotlin.math.*

object Coach {
  data class RunSummary(
    val age: Int?,
    val avgHr: Int?,
    val distanceKm: Double?,
    val durationMin: Double?,
    val avgPaceMinPerKm: Double?
  )

  data class Pace(val paceMinPerKm: Double, val label: String)

  private fun estimateMaxHr(age: Int?): Int {
    if (age == null || age <= 0) return 200
    return (208 - 0.7 * age).roundToInt()
  }

  private fun hrZone(avgHr: Int?, maxHr: Int): Pair<String, Int?> {
    if (avgHr == null || maxHr <= 0) return "unknown" to null
    val pct = (avgHr.toDouble() / maxHr) * 100.0
    val zone = when {
      pct < 60 -> "Z1（非常轻松/恢复）"
      pct < 70 -> "Z2（轻松/有氧）"
      pct < 80 -> "Z3（节奏/稳态）"
      pct < 90 -> "Z4（阈值）"
      else -> "Z5（最大摄氧量/间歇）"
    }
    return zone to pct.roundToInt()
  }

  private fun pace(distanceKm: Double?, durationMin: Double?): Pace? {
    if (distanceKm == null || durationMin == null || distanceKm <= 0) return null
    val p = durationMin / distanceKm
    val m = floor(p).toInt()
    val s = ((p - m) * 60).roundToInt()
    return Pace(p, "${m}分${s.toString().padStart(2, '0')}秒/公里")
  }

  fun analyze(run: RunSummary, notes: String = ""): List<String> {
    val recs = mutableListOf<String>()
    val maxHr = estimateMaxHr(run.age)
    val p = pace(run.distanceKm, run.durationMin) ?: run.avgPaceMinPerKm?.let {
      val m = floor(it).toInt(); val s = ((it - m) * 60).roundToInt()
      Pace(it, "${m}分${s.toString().padStart(2, '0')}秒/公里")
    }
    if (p != null) recs += "你的平均配速为 ${p.label}。"

    run.avgHr?.let { hr ->
      val (zone, pct) = hrZone(hr, maxHr)
      if (pct != null) {
        recs += "平均心率 ${hr} 次/分 ≈ 最高心率的 ${pct}% → ${zone}。"
        when {
          pct >= 88 -> recs += "强度较高。建议缩短重复时长、拉长恢复时间，留意跑姿与呼吸。"
          pct >= 80 -> recs += "接近阈值。推荐10–20分钟一组，中间穿插2–3分钟轻松跑。"
          pct >= 70 -> recs += "稳态有氧，有助于建立耐力。保持可对话的呼吸节奏。"
          else -> recs += "轻松区间，适合恢复或热身/放松。"
        }
      }
    }

    if ((run.distanceKm ?: 0.0) >= 10.0 && (run.durationMin == null || run.durationMin > (run.distanceKm ?: 0.0) * 7)) {
      recs += "检测到较长距离。建议补给（每小时30–60克碳水）与补水（每小时400–800毫升）。"
    }

    val n = notes.lowercase()
    if (listOf("hot","heat","热","炎热").any { it in n }) {
      recs += "天气炎热。配速放慢10–20秒/公里，增加水与电解质摄入。"
    }
    if (listOf("hill","hills","elevation","坡","爬坡").any { it in n }) {
      recs += "存在爬坡。上坡时适当缩短步幅、提高步频；身体从脚踝轻微前倾。"
    }

    p?.let {
      when {
        it.paceMinPerKm <= 4.5 -> recs += "强度较快。结束后优先做好放松与轻度拉伸。"
        it.paceMinPerKm >= 7.5 -> recs += "今天配速较轻松——非常适合恢复日，保持可对话强度。"
      }
    }

    if (run.distanceKm == null && run.durationMin == null && run.avgHr == null && run.avgPaceMinPerKm == null) {
      recs += "添加距离、时长或心率以获得个性化建议。"
    }
    return recs
  }
}

