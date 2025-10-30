package com.example.ai_running_companion

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.builtins.ListSerializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder

object NetClients {
  private val client = OkHttpClient()
  private val json = Json { ignoreUnknownKeys = true }

  // Nominatim geocoding
  @Serializable
  data class NominatimResult(val display_name: String, val lat: String, val lon: String)

  suspend fun geocodePlace(query: String): Triple<String, Double, Double>? = withContext(Dispatchers.IO) {
    val q = URLEncoder.encode(query, "UTF-8")
    val url = "https://nominatim.openstreetmap.org/search?q=$q&format=json&limit=1"
    val req = Request.Builder().url(url).header("User-Agent", "ai-running-companion/1.0").build()
    client.newCall(req).execute().use { resp ->
      if (!resp.isSuccessful) return@use null
      val body = resp.body?.string() ?: return@use null
      val arr = json.decodeFromString(ListSerializer(NominatimResult.serializer()), body)
      val first = arr.firstOrNull() ?: return@use null
      Triple(first.display_name, first.lat.toDouble(), first.lon.toDouble())
    }
  }

  // OSRM routing (foot)
  @Serializable
  data class OsrmRoute(@SerialName("routes") val routes: List<OsrmOneRoute> = emptyList())
  @Serializable
  data class OsrmOneRoute(val geometry: OsrmGeometry? = null)
  @Serializable
  data class OsrmGeometry(val coordinates: List<List<Double>> = emptyList())

  suspend fun planFootRoute(lat1: Double, lng1: Double, lat2: Double, lng2: Double): List<Pair<Double, Double>>? = withContext(Dispatchers.IO) {
    val url = "https://router.project-osrm.org/route/v1/foot/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson"
    val req = Request.Builder().url(url).build()
    client.newCall(req).execute().use { resp ->
      if (!resp.isSuccessful) return@use null
      val body = resp.body?.string() ?: return@use null
      val parsed = json.decodeFromString(OsrmRoute.serializer(), body)
      val coords = parsed.routes.firstOrNull()?.geometry?.coordinates ?: return@use null
      // GeoJSON coordinates are [lng, lat]
      coords.map { (lng, lat) -> lat to lng }
    }
  }

  // OpenAI-compatible chat completions
  @Serializable
  data class ChatMessage(val role: String, val content: String)
  @Serializable
  data class ChatRequest(val model: String, val messages: List<ChatMessage>, val temperature: Double = 0.7)
  @Serializable
  data class ChatChoice(val message: ChatMessage)
  @Serializable
  data class ChatResponse(val choices: List<ChatChoice> = emptyList())

  suspend fun chatCompletion(base: String, model: String, apiKey: String?, messages: List<ChatMessage>): String? = withContext(Dispatchers.IO) {
    val b = base.trimEnd('/')
    val url = "$b/chat/completions"
    val reqBody = json.encodeToString(ChatRequest.serializer(), ChatRequest(model, messages)).toRequestBody("application/json".toMediaType())
    val builder = Request.Builder().url(url).post(reqBody).header("Content-Type", "application/json")
    if (!apiKey.isNullOrBlank()) builder.header("Authorization", "Bearer $apiKey")
    client.newCall(builder.build()).execute().use { resp ->
      if (!resp.isSuccessful) return@use null
      val body = resp.body?.string() ?: return@use null
      val parsed = json.decodeFromString(ChatResponse.serializer(), body)
      parsed.choices.firstOrNull()?.message?.content?.trim()
    }
  }
}
