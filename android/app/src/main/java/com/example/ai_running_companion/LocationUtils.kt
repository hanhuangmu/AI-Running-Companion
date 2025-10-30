package com.example.ai_running_companion

import kotlin.math.*

object LocationUtils {
  data class Point(val lat: Double, val lng: Double, val ts: Long)

  fun haversineKm(a: Point, b: Point): Double {
    val R = 6371.0
    val dLat = Math.toRadians(b.lat - a.lat)
    val dLng = Math.toRadians(b.lng - a.lng)
    val la1 = Math.toRadians(a.lat)
    val la2 = Math.toRadians(b.lat)
    val h = sin(dLat / 2).pow(2.0) + cos(la1) * cos(la2) * sin(dLng / 2).pow(2.0)
    return 2 * R * asin(sqrt(h))
  }
}

