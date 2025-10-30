# AI-Running-Companion
An AI companion who can chat with you while you are running and analyse your running data .

中文说明请见下方「使用说明（中文）」章节。

## How to Use

1) Open the app
- Option A: Double‑click `index.html` to open it in your browser.
- Option B (recommended): Serve locally to avoid browser security limits.
- Python: `python3 -m http.server` then visit `http://localhost:8000`

2) Start a run (realtime tracking)
- Choose mode: Free Run or Destination Run.
- Optional destination: enter a place name and click the new "搜索" button to search and set it, or enter coordinates like `31.23,121.47`. If a destination is set, the app auto‑plans a walking route and shows distance to destination.
- A live map displays your current position (moving marker), recorded route (solid blue), and planned route (dashed green). You can also click the map to set the destination to the clicked coordinates.
- Enter gender and age.
- Click "Start" to begin. The app will track your position, instantaneous pace (min:sec per km), average pace, distance, and time. In the UI, pace displays as Chinese “分秒/公里”. Voice announces metrics, distance to destination, and gives encouragement every completed kilometer.

3) Chat with the coach
- Type a message and press Enter or click "Send".
- Common topics: pace, heart rate zones, hydration, fueling, warm‑up, cool‑down, injuries.
- Clear the chat anytime with the "Clear" button.

4) Use voice features
- Click the mic button to speak; click again to stop listening.
- Toggle "Voice coach" in the header to enable/disable spoken replies (TTS).
- Notes:
  - Speech recognition uses the Web Speech API (webkitSpeechRecognition). It works best in Chromium‑based browsers.
  - Text‑to‑Speech depends on your system/browser voices.

5) Optional: OpenAI integration
- Toggle "Use OpenAI API" and paste your API key to get LLM‑generated responses. The coach context includes local weather (temperature, wind, description) fetched from Open‑Meteo based on your GPS position.
- Security note: This demo calls the OpenAI API directly from the browser, which exposes your key to anyone using the page. For production, proxy requests through your own backend.

## Tips and Data Handling
- Pace, zones, hydration, and fueling suggestions are computed locally with a rule‑based coach. LLM is optional.
- Weather, geocoding, and routing use public services from the browser: Open‑Meteo (weather), Nominatim (place search), OSRM (walking routes). If these are blocked or rate‑limited, the app will continue without them.
- Your run inputs are saved in `localStorage` only. Use "Clear" to reset.
- Health disclaimer: Tips are educational and not medical advice.

## Android App (Native)

An Android app mirroring the web features (GPS tracking, map, destination routing, chat, voice) is scaffolded under `android/`.

Quick start
- Open `android/` in Android Studio (Giraffe+ recommended).
- Set your Google Maps API key in `android/app/src/main/AndroidManifest.xml` at `com.google.android.geo.API_KEY`.
- Build and run on a device with GPS and microphone permissions.

Features
- Live GPS tracking with instant/average pace, distance, elapsed time.
- Modes: Free run and Destination run. Search destination via Nominatim or enter `lat,lng`.
- Map view: current marker, recorded route polyline (blue), planned route (green via OSRM foot routing).
- Kilometer encouragement and short real‑time cues.
- Chat coach: local rule‑based tips; optional OpenAI‑compatible chat completion (configure API Base/Model/Key in the header toggles).
- Voice coach (TTS) and speech input (Android SpeechRecognizer).

Notes
- The app uses public endpoints for geocoding (Nominatim) and routing (OSRM). For production, consider your own proxies and rate limits.
- For LLM, set an OpenAI‑compatible base (e.g., `https://api.openai.com/v1` or local servers like Ollama/LM Studio) and a model name.


## Troubleshooting
- No mic input option: Your browser may not support the Web Speech API; you can still chat via text.
- No spoken replies: Enable "Voice coach" and confirm your system has TTS voices enabled.
- API errors: If OpenAI calls fail, the app automatically falls back to local coaching.
- Weather/search/route not working: Your network may block external requests to Open‑Meteo, Nominatim, or OSRM. Try again later or use coordinates/destination by map click.

## LLM Configuration (OpenAI‑compatible)
- Toggle "Use OpenAI‑compatible API" in the header to enable LLM replies.
- Set these fields in the header:
  - API Base: The base URL for an OpenAI‑compatible endpoint (default OpenAI: `https://api.openai.com/v1`).
  - Model: The model name your endpoint exposes (e.g., `gpt-4o-mini`, `llama3.1`, etc.).
  - API key: Optional; some local servers ignore auth. If required, enter your key (e.g., `ollama`).
- The app persists API Base and Model in `localStorage` (not the key by default).

Examples
- OpenAI
  - API Base: `https://api.openai.com/v1`
  - Model: `gpt-4o-mini`
  - API Key: your OpenAI key
- Ollama (local)
  - API Base: `http://localhost:11434/v1`
  - Model: name exposed by `ollama list` (e.g., `llama3.1`)
  - API Key: optional (some setups use `ollama` or none)
- LM Studio (local)
  - API Base: `http://localhost:1234/v1`
  - Model: the served model name in LM Studio
  - API Key: often optional

Notes
- Endpoint used: `<API Base>/chat/completions` with the OpenAI Chat schema.
- CORS: Your local server must allow browser requests from your origin.
- Security: Entering an API key in the browser exposes it to users. For production, proxy calls through your backend.

---

## 使用说明（中文）

1）打开应用
- 方式 A：直接双击 `index.html` 用浏览器打开。
- 方式 B（推荐）：本地启动静态服务器，避免浏览器的本地文件安全限制。
  - Python：`python3 -m http.server`，然后访问 `http://localhost:8000`

2）开始跑步（实时）
- 选择模式：自由跑 或 目的地跑。
- 目的地：可输入地名并点击「搜索」按钮设置，或以“纬度,经度”形式（如 `31.23,121.47`）。设置目的地后，应用会自动规划步行路线并显示与目的地的距离。
- 地图会实时显示当前位置（移动标记）、已跑轨迹（蓝色实线）与规划路线（绿色虚线）。也可直接点击地图设置目的地坐标。
- 输入性别与年龄。
- 点击「开始跑步」。应用会实时记录位置、即时配速（分秒/公里）、平均配速、已跑距离与用时；支持语音播报与教练提醒。每完成 1 公里会自动语音鼓励并汇报该公里配速。

3）与教练聊天
- 在输入框输入问题后回车或点击「发送」。
- 常见话题：配速、心率区间、补水、补给、热身、放松、伤病提醒等。
- 点击「清空」可清除聊天记录。

4）使用语音功能
- 点击麦克风按钮开始说话；再次点击停止识别。
- 顶部开关「语音教练」可启用/关闭语音播报（TTS）。
- 说明：
  - 语音识别使用 Web Speech API（webkitSpeechRecognition），在 Chromium 内核浏览器上效果更佳。
  - 语音播报依赖系统/浏览器内置的语音引擎。

5）可选：接入兼容 OpenAI 的 LLM
- 打开「使用兼容 OpenAI 的接口」开关，填写 API 基址、模型和（可选）密钥，即可获得大模型生成的回复。教练会结合本地获取的天气信息（温度、风速、天气描述）给出更贴合的建议。
- 安全提示：此示例在浏览器中直接调用接口，若输入密钥，可能会暴露给使用者。生产环境建议通过自有后端代理。

## 提示与数据处理
- 配速、心率区、补水与补给建议由本地规则引擎计算完成；大模型仅为可选增强。
- 天气/地名搜索/路线规划通过浏览器访问公共服务：Open‑Meteo（天气）、Nominatim（地名检索）、OSRM（步行路径）。若被网络限制或达到频率限制，这些功能可能暂时不可用，核心跑步记录仍可使用。
- 跑步数据仅存储于浏览器 `localStorage`；可通过「清空」重置。
- 健康声明：所有建议仅供参考，不构成医疗建议。

## 常见问题（FAQ）
- 没有麦克风输入：可能是浏览器不支持 Web Speech API；仍可使用文字聊天。
- 没有语音播报：开启「语音教练」，并确认系统/浏览器语音引擎可用。
- 接口报错：若兼容 OpenAI 的接口调用失败，应用会自动回落到本地规则教练。

## 大模型配置（兼容 OpenAI）
- 在页面顶部启用「使用兼容 OpenAI 的接口」，并填写：
  - API 基址：兼容 OpenAI 的接口地址（OpenAI 默认：`https://api.openai.com/v1`）。
  - 模型：接口提供的模型名称（如 `gpt-4o-mini`、`llama3.1` 等）。
  - API 密钥：可选；某些本地服务可忽略认证。需要时请填写（如 `ollama`）。
- 应用会将 API 基址与模型名称保存到 `localStorage`（默认不保存密钥）。

示例
- OpenAI
  - API 基址：`https://api.openai.com/v1`
  - 模型：`gpt-4o-mini`
  - API 密钥：你的 OpenAI key
- Ollama（本地）
  - API 基址：`http://localhost:11434/v1`
  - 模型：使用 `ollama list` 中的名称（如 `llama3.1`）
  - API 密钥：可选（有些环境使用 `ollama` 或无需密钥）
- LM Studio（本地）
  - API 基址：`http://localhost:1234/v1`
  - 模型：LM Studio 中对外提供的模型名称
  - API 密钥：通常可选

注意
- 实际调用的端点为：`<API 基址>/chat/completions`，遵循 OpenAI Chat schema。
- CORS：你的本地服务需要允许来自该页面的跨域访问。
- 安全：浏览器内输入密钥存在泄露风险；生产环境建议走后端代理。
