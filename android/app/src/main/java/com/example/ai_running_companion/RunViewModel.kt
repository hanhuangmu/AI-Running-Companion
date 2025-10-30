package com.example.ai_running_companion

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.location.Location
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.ai_running_companion.LocationUtils.Point
import com.google.android.gms.location.*
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.maps.android.compose.LatLng
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.floor
import kotlin.math.roundToInt

enum class RunMode { Free, Dest }

data class ChatMsg(val role: String, val text: String)

data class RunUiState(
  val running: Boolean = false,
  val voiceEnabled: Boolean = true,
  val useLLM: Boolean = false,
  val apiBase: String = "",
  val apiKey: String = "",
  val model: String = "gpt-4o-mini",
  val mode: RunMode = RunMode.Free,
  val destInput: String = "",
  val gender: String = "",
  val age: String = "",
  val totalDistanceKm: Double = 0.0,
  val instPaceLabel: String = "-",
  val avgPaceLabel: String = "-",
  val elapsedLabel: String = "-",
  val toDestKm: Double? = null,
  val current: LatLng? = null,
  val lastLatLng: String? = null,
  val destLatLng: LatLng? = null,
  val track: List<LatLng> = emptyList(),
  val routePlan: List<LatLng> = emptyList(),
  val messages: List<ChatMsg> = emptyList(),
  val inputText: String = "",
  val recognizing: Boolean = false
)

class RunViewModel : ViewModel() {
  private val _state = MutableStateFlow(RunUiState())
  val state = _state.asStateFlow()

  var voiceEnabled: Boolean = true
    private set

  private var fused: FusedLocationProviderClient? = null
  private var callback: LocationCallback? = null
  private var startTime: Long? = null
  private var lastKmSpoken: Int = 0
  private var lastKmAtTime: Long? = null
  private var lastKmAtDist: Double = 0.0
  private val points = mutableListOf<Point>()

  private var speechRecognizer: SpeechRecognizer? = null

  fun setVoiceEnabled(v: Boolean) { voiceEnabled = v; _state.value = _state.value.copy(voiceEnabled = v) }
  fun setUseLLM(v: Boolean) { _state.value = _state.value.copy(useLLM = v) }
  fun setApiBase(v: String) { _state.value = _state.value.copy(apiBase = v) }
  fun setApiKey(v: String) { _state.value = _state.value.copy(apiKey = v) }
  fun setModel(v: String) { _state.value = _state.value.copy(model = v) }
  fun setMode(m: RunMode) { _state.value = _state.value.copy(mode = m) }
  fun setDestInput(s: String) { _state.value = _state.value.copy(destInput = s) }
  fun setGender(s: String) { _state.value = _state.value.copy(gender = s) }
  fun setAge(s: String) { _state.value = _state.value.copy(age = s) }
  fun setInputText(s: String) { _state.value = _state.value.copy(inputText = s) }

  fun clear() {
    points.clear()
    startTime = null
    lastKmSpoken = 0
    lastKmAtTime = null
    lastKmAtDist = 0.0
    _state.value = _state.value.copy(
      running = false, totalDistanceKm = 0.0, instPaceLabel = "-", avgPaceLabel = "-", elapsedLabel = "-",
      track = emptyList(), routePlan = emptyList()
    )
  }

  fun clearChat() { _state.value = _state.value.copy(messages = emptyList()) }

  private fun fmtPace(minPerKm: Double?): String {
    if (minPerKm == null || minPerKm <= 0) return "-"
    val m = floor(minPerKm).toInt(); val s = ((minPerKm - m) * 60).roundToInt()
    return "${m}分${s.toString().padStart(2, '0')}秒/公里"
  }
  private fun fmtTime(sec: Long): String {
    if (sec < 0) return "-"
    val h = sec / 3600; val m = (sec % 3600) / 60; val s = sec % 60
    return if (h > 0) "$h:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}" else "$m:${s.toString().padStart(2,'0')}"
  }

  @SuppressLint("MissingPermission")
  fun start(context: Context, speak: (String)->Unit) {
    if (_state.value.running) return
    fused = LocationServices.getFusedLocationProviderClient(context)
    callback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        for (loc in result.locations) handleLocation(loc, speak)
      }
    }
    val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L).setMinUpdateIntervalMillis(1000L).build()
    fused?.requestLocationUpdates(req, callback!!, context.mainLooper)
    startTime = System.currentTimeMillis()
    lastKmSpoken = 0
    lastKmAtTime = startTime
    lastKmAtDist = 0.0
    _state.value = _state.value.copy(running = true)
    addMsg("assistant", "已开始跑步。定位初始化中……")
    if (voiceEnabled) speak("已开始跑步，定位初始化中")
  }

  fun stop(speak: (String)->Unit) {
    fused?.removeLocationUpdates(callback!!)
    _state.value = _state.value.copy(running = false)
    val el = (System.currentTimeMillis() - (startTime ?: System.currentTimeMillis())) / 1000
    // Simple finish tip using Coach
    val tips = Coach.analyze(
      Coach.RunSummary(
        age = _state.value.age.toIntOrNull(),
        avgHr = null,
        distanceKm = _state.value.totalDistanceKm,
        durationMin = el.toDouble() / 60.0,
        avgPaceMinPerKm = null
      )
    )
    tips.firstOrNull()?.let { addMsg("assistant", "本次结束。$it"); if (voiceEnabled) speak(it) }
  }

  private fun addMsg(role: String, text: String) { _state.value = _state.value.copy(messages = _state.value.messages + ChatMsg(role, text)) }

  private fun handleLocation(loc: Location, speak: (String)->Unit) {
    val p = Point(loc.latitude, loc.longitude, System.currentTimeMillis())
    val prev = points.lastOrNull()
    points += p
    var total = _state.value.totalDistanceKm
    if (prev != null) total += LocationUtils.haversineKm(prev, p)
    val elapsedSec = ((System.currentTimeMillis() - (startTime ?: System.currentTimeMillis())) / 1000).coerceAtLeast(0)
    val instPace = when {
      loc.hasSpeed() && loc.speed > 0 -> (1000.0 / loc.speed) / 60.0
      prev != null -> {
        val dt = (p.ts - prev.ts) / 1000.0; val dk = LocationUtils.haversineKm(prev, p)
        if (dt > 0 && dk > 0) (dt / 60.0) / dk else null
      }
      else -> null
    }
    val avgPace = if (total > 0) (elapsedSec / 60.0) / total else null
    val last = LatLng(p.lat, p.lng)
    val toDest = _state.value.destLatLng?.let { d ->
      val a = Point(last.latitude, last.longitude, p.ts); val b = Point(d.latitude, d.longitude, p.ts)
      LocationUtils.haversineKm(a, b)
    }
    _state.value = _state.value.copy(
      totalDistanceKm = total,
      instPaceLabel = fmtPace(instPace),
      avgPaceLabel = fmtPace(avgPace),
      elapsedLabel = fmtTime(elapsedSec),
      toDestKm = toDest,
      current = last,
      lastLatLng = "${"%.5f".format(last.latitude)}, ${"%.5f".format(last.longitude)}",
      track = _state.value.track + last
    )

    maybePlanRoute()
    maybeAnnounceKilometer(instPace, speak)
  }

  private fun maybeAnnounceKilometer(lapPace: Double?, speak: (String)->Unit) {
    val kmDone = _state.value.totalDistanceKm.toInt()
    if (kmDone > lastKmSpoken && kmDone >= 1) {
      val now = System.currentTimeMillis()
      val deltaMin = ((now - (lastKmAtTime ?: now)) / 60000.0)
      val deltaDist = (_state.value.totalDistanceKm - lastKmAtDist).coerceAtLeast(0.0)
      val pace = if (deltaDist > 0.2) (deltaMin / deltaDist) else lapPace
      val label = fmtPace(pace)
      val msg = "已完成第 ${kmDone} 公里，保持！该公里配速 $label。"
      addMsg("assistant", msg)
      if (voiceEnabled) speak(msg)
      lastKmSpoken = kmDone
      lastKmAtTime = now
      lastKmAtDist = _state.value.totalDistanceKm
    }
  }

  fun toggleMic(context: Context) {
    if (!SpeechRecognizer.isRecognitionAvailable(context)) return
    if (_state.value.recognizing) {
      speechRecognizer?.stopListening()
      _state.value = _state.value.copy(recognizing = false)
    } else {
      if (speechRecognizer == null) speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN")
      }
      _state.value = _state.value.copy(recognizing = true)
      speechRecognizer?.setRecognitionListener(SimpleRecognitionListener(onFinal = { text ->
        _state.value = _state.value.copy(recognizing = false, inputText = text)
      }))
      speechRecognizer?.startListening(intent)
    }
  }

  fun setDestination(lat: Double, lng: Double, label: String?) {
    _state.value = _state.value.copy(destLatLng = LatLng(lat, lng))
    maybePlanRoute()
    addMsg("assistant", "已设置目的地：${label ?: "目的地"}")
  }

  fun maybePlanRoute() {
    val cur = _state.value.current ?: return
    val dest = _state.value.destLatLng ?: return
    viewModelScope.launch {
      val coords = NetClients.planFootRoute(cur.latitude, cur.longitude, dest.latitude, dest.longitude)
      val pts = coords?.map { LatLng(it.first, it.second) } ?: emptyList()
      _state.value = _state.value.copy(routePlan = pts)
    }
  }

  fun parseDestInput(): Triple<String, Double, Double>? {
    val t = _state.value.destInput.trim()
    if (t.isBlank()) return null
    val regex = Regex("^\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*$")
    val m = regex.find(t)
    if (m != null) {
      val lat = m.groupValues[1].toDouble(); val lng = m.groupValues[2].toDouble()
      return Triple("$lat,$lng", lat, lng)
    }
    return null
  }

  fun searchDestination() {
    viewModelScope.launch {
      parseDestInput()?.let { (label, lat, lng) -> setDestination(lat, lng, label); return@launch }
      val r = NetClients.geocodePlace(_state.value.destInput) ?: return@launch
      setDestination(r.second, r.third, r.first)
    }
  }

  suspend fun sendMessage(speak: (String)->Unit) {
    val text = _state.value.inputText.trim()
    if (text.isBlank()) return
    addMsg("user", text)
    _state.value = _state.value.copy(inputText = "")
    // Local coach
    val avgPace = _state.value.avgPaceLabel.takeIf { it != "-" }
    val avgPaceVal: Double? = null // kept simple
    val tips = Coach.analyze(
      Coach.RunSummary(
        age = _state.value.age.toIntOrNull(),
        avgHr = null,
        distanceKm = _state.value.totalDistanceKm.takeIf { it > 0 },
        durationMin = null,
        avgPaceMinPerKm = avgPaceVal
      )
    )
    var reply = if (tips.isNotEmpty()) tips.first() else "告诉我你的距离、时长和心率，我可以给出更有针对性的建议。"

    if (_state.value.useLLM && _state.value.apiBase.isNotBlank()) {
      val sys = "你是一名专业的跑步教练。你可以结合用户的实时跑步数据提供中文建议，每次不超过120字，具体可执行。"
      val ctx = "实时跑步数据 JSON：" +
        mapOf(
          "mode" to _state.value.mode.name.lowercase(),
          "distanceKm" to _state.value.totalDistanceKm,
          "avgPace" to _state.value.avgPaceLabel,
          "toDestKm" to _state.value.toDestKm,
          "age" to _state.value.age,
          "gender" to _state.value.gender
        ).toString()
      val messages = listOf(
        NetClients.ChatMessage("system", sys),
        NetClients.ChatMessage("user", "$ctx\n\n用户：$text")
      )
      NetClients.chatCompletion(_state.value.apiBase, _state.value.model, _state.value.apiKey, messages)?.let { reply = it }
    }

    addMsg("assistant", reply)
    if (voiceEnabled) speak(reply)
  }
}

// Minimal speech recognition listener wrapper
import android.os.Bundle
import android.speech.RecognitionListener

class SimpleRecognitionListener(val onFinal: (String)->Unit) : RecognitionListener {
  override fun onReadyForSpeech(params: Bundle?) {}
  override fun onBeginningOfSpeech() {}
  override fun onRmsChanged(rmsdB: Float) {}
  override fun onBufferReceived(buffer: ByteArray?) {}
  override fun onEndOfSpeech() {}
  override fun onError(error: Int) {}
  override fun onPartialResults(partialResults: Bundle?) {}
  override fun onEvent(eventType: Int, params: Bundle?) {}
  override fun onResults(results: Bundle?) {
    val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
    val finalText = list?.firstOrNull()?.trim().orEmpty()
    if (finalText.isNotBlank()) onFinal(finalText)
  }
}

