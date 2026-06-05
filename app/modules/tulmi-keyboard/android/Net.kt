package com.tulmi.app.keyboard

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Tiny backend client for the keyboard. Uses OkHttp (already on the classpath
 * via React Native), so no extra Gradle dependency is needed.
 *
 * NOTE: until we bridge the app's saved backend URL into the keyboard, set
 * baseUrl here. Android emulator → your PC = 10.0.2.2; a physical phone → your
 * PC's LAN IP, or your VPS URL.
 */
object Net {
    var baseUrl: String = "http://10.0.2.2:8770"
    private const val TOKEN = "dev" // backend runs with DEV_SKIP_AUTH for now

    private val client = OkHttpClient.Builder()
        .callTimeout(60, TimeUnit.SECONDS)
        .build()

    fun refine(text: String, targetApp: String): String {
        val json = JSONObject()
            .put("text", text)
            .put("targetApp", targetApp)
            .put("language", "auto")
            .toString()
        val req = Request.Builder()
            .url("$baseUrl/v1/refine")
            .addHeader("Authorization", "Bearer $TOKEN")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(req).execute().use { res ->
            val s = res.body?.string() ?: ""
            if (!res.isSuccessful) throw RuntimeException("refine ${res.code}: $s")
            return JSONObject(s).optString("refinedText")
        }
    }

    fun transcribeClean(file: File, targetApp: String): String {
        val body = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("audio", "audio.m4a", file.asRequestBody("audio/m4a".toMediaType()))
            .addFormDataPart("targetApp", targetApp)
            .addFormDataPart("language", "auto")
            .build()
        val req = Request.Builder()
            .url("$baseUrl/v1/transcribe-clean")
            .addHeader("Authorization", "Bearer $TOKEN")
            .post(body)
            .build()
        client.newCall(req).execute().use { res ->
            val s = res.body?.string() ?: ""
            if (!res.isSuccessful) throw RuntimeException("transcribe ${res.code}: $s")
            return JSONObject(s).optString("cleanedText")
        }
    }
}
