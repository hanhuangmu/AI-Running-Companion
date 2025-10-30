plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  kotlin("plugin.serialization") version "1.9.23"
}

android {
  namespace = "com.example.ai_running_companion"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.example.ai_running_companion"
    minSdk = 26
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  buildFeatures { compose = true }

  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.10"
  }

  packagingOptions {
    resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
  }
}

dependencies {
  implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.9.23"))
  implementation("androidx.core:core-ktx:1.12.0")
  implementation("androidx.activity:activity-compose:1.8.2")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")

  // Compose
  implementation("androidx.compose.ui:ui:1.6.7")
  implementation("androidx.compose.material3:material3:1.2.1")
  implementation("androidx.compose.ui:ui-tooling-preview:1.6.7")
  debugImplementation("androidx.compose.ui:ui-tooling:1.6.7")

  // Maps + Location
  implementation("com.google.android.gms:play-services-maps:18.2.0")
  implementation("com.google.maps.android:maps-compose:4.3.3")
  implementation("com.google.android.gms:play-services-location:21.0.1")

  // Networking
  implementation("com.squareup.okhttp3:okhttp:4.11.0")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}

