<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useWeather, weatherGlyph } from '../composables/useWeather.js'
import { activityLogger } from '../utils/activityLogger.js'
import { useConfigStore } from '../stores/configStore.js'
import { worldCities } from '../data/worldCities.js'

const SELECTED_CITY_STORAGE_KEY = 'earth-weather-selected-city'

const configStore = useConfigStore()
const canvasRef = ref(null)
const stageRef = ref(null)
const isGlobeFullscreen = ref(false)
const selectedCity = ref('seoul')
const dragging = ref(false)
const zoom = ref(1)
const camera = reactive({ lon: 126.978, lat: 25 })
const pointer = reactive({ x: 0, y: 0, moved: false })
const size = reactive({ width: 640, height: 520, radius: 190 })
const textureReady = ref(false)
const hitAreas = []
let context = null
let resizeObserver = null
let frameId = 0
let earthTexture = null
let globeTextureCanvas = null
let globeTextureContext = null
let globeImageData = null

const { weather, loading, selectLocation } = useWeather()

const cities = worldCities

const landRegions = [
  { lat: 48, lon: -108, latRadius: 23, lonRadius: 34 },
  { lat: 34, lon: -82, latRadius: 18, lonRadius: 25 },
  { lat: 61, lon: -149, latRadius: 12, lonRadius: 18 },
  { lat: 72, lon: -42, latRadius: 10, lonRadius: 13 },
  { lat: -10, lon: -60, latRadius: 28, lonRadius: 17 },
  { lat: -35, lon: -66, latRadius: 16, lonRadius: 9 },
  { lat: 50, lon: 15, latRadius: 12, lonRadius: 18 },
  { lat: 8, lon: 21, latRadius: 31, lonRadius: 20 },
  { lat: 43, lon: 61, latRadius: 20, lonRadius: 37 },
  { lat: 50, lon: 110, latRadius: 20, lonRadius: 39 },
  { lat: 25, lon: 82, latRadius: 18, lonRadius: 18 },
  { lat: 20, lon: 111, latRadius: 16, lonRadius: 24 },
  { lat: -25, lon: 134, latRadius: 13, lonRadius: 19 },
  { lat: -42, lon: 172, latRadius: 6, lonRadius: 5 },
]

const landPoints = landRegions.flatMap((region, regionIndex) => {
  const points = []
  for (let y = -region.latRadius; y <= region.latRadius; y += 4.2) {
    const ratio = y / region.latRadius
    const span = region.lonRadius * Math.sqrt(Math.max(0, 1 - ratio * ratio))
    for (let x = -span; x <= span; x += 5.2) {
      const seed = Math.sin((x + regionIndex * 17) * 12.9898 + y * 78.233)
      if (seed > -0.72) {
        points.push({
          lat: region.lat + y + Math.sin(x * 0.7) * 0.7,
          lon: region.lon + x + Math.cos(y * 0.5) * 0.8,
        })
      }
    }
  }
  return points
})

const selectedCityInfo = computed(
  () => cities.find((city) => city.id === selectedCity.value) || cities[0],
)

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLongitude(value) {
  return ((((value + 180) % 360) + 360) % 360) - 180
}

function project(lat, lon) {
  const radians = Math.PI / 180
  const latitude = lat * radians
  const longitude = normalizeLongitude(lon - camera.lon) * radians
  const centerLatitude = camera.lat * radians
  const cosLatitude = Math.cos(latitude)
  const x = cosLatitude * Math.sin(longitude)
  const y =
    Math.cos(centerLatitude) * Math.sin(latitude) -
    Math.sin(centerLatitude) * cosLatitude * Math.cos(longitude)
  const z =
    Math.sin(centerLatitude) * Math.sin(latitude) +
    Math.cos(centerLatitude) * cosLatitude * Math.cos(longitude)

  return {
    x: size.width / 2 + x * size.radius,
    y: size.height / 2 - y * size.radius,
    z,
    visible: z > 0.015,
  }
}

function drawStars() {
  context.save()
  for (let index = 0; index < 56; index += 1) {
    const x = ((index * 83.37) % 100) * (size.width / 100)
    const y = ((index * index * 17.13 + 11) % 100) * (size.height / 100)
    const distanceFromGlobe = Math.hypot(x - size.width / 2, y - size.height / 2)
    if (distanceFromGlobe < size.radius * 1.12) continue
    const alpha = 0.16 + ((index * 7) % 10) / 40
    context.fillStyle = `rgba(215, 241, 255, ${alpha})`
    context.beginPath()
    context.arc(x, y, index % 9 === 0 ? 1.4 : 0.75, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function loadEarthTexture() {
  return new Promise((resolve) => {
    const image = new Image()

    image.addEventListener('load', () => {
      const sourceCanvas = document.createElement('canvas')
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
      sourceCanvas.width = 1440
      sourceCanvas.height = 720
      sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height)
      earthTexture = {
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        pixels: sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data,
      }
      globeTextureCanvas = document.createElement('canvas')
      globeTextureContext = globeTextureCanvas.getContext('2d')
      textureReady.value = true
      activityLogger.info('지구본', 'NASA Blue Marble 텍스처 로드 완료')
      scheduleDraw()
      resolve()
    })

    image.addEventListener('error', () => {
      activityLogger.warn('지구본', '지구 텍스처 로드 실패 - 기본 지형을 표시합니다')
      resolve()
    })

    image.src = `${import.meta.env.BASE_URL}earth-blue-marble.jpg`
  })
}

function drawTexturedEarth(centerX, centerY) {
  if (!earthTexture || !globeTextureCanvas || !globeTextureContext) return false

  const resolution = Math.round(clamp(size.radius * 1.2, 220, 420))
  if (globeTextureCanvas.width !== resolution || globeTextureCanvas.height !== resolution) {
    globeTextureCanvas.width = resolution
    globeTextureCanvas.height = resolution
    globeImageData = globeTextureContext.createImageData(resolution, resolution)
  }

  const output = globeImageData.data
  const source = earthTexture.pixels
  const sourceWidth = earthTexture.width
  const sourceHeight = earthTexture.height
  const radians = Math.PI / 180
  const centerLatitude = camera.lat * radians
  const centerLongitude = camera.lon * radians
  const sinCenter = Math.sin(centerLatitude)
  const cosCenter = Math.cos(centerLatitude)
  const fullTurn = Math.PI * 2

  for (let y = 0; y < resolution; y += 1) {
    const screenY = ((y + 0.5) / resolution) * 2 - 1
    const projectedY = -screenY

    for (let x = 0; x < resolution; x += 1) {
      const screenX = ((x + 0.5) / resolution) * 2 - 1
      const radiusSquared = screenX * screenX + screenY * screenY
      const outputIndex = (y * resolution + x) * 4

      if (radiusSquared > 1) {
        output[outputIndex + 3] = 0
        continue
      }

      const depth = Math.sqrt(1 - radiusSquared)
      const sinLatitude = clamp(cosCenter * projectedY + sinCenter * depth, -1, 1)
      const latitude = Math.asin(sinLatitude)
      const longitude =
        centerLongitude +
        Math.atan2(screenX, -sinCenter * projectedY + cosCenter * depth)
      const wrappedLongitude = ((longitude / fullTurn + 0.5) % 1 + 1) % 1
      const textureY = clamp(
        Math.floor((0.5 - latitude / Math.PI) * sourceHeight),
        0,
        sourceHeight - 1,
      )
      const textureX = clamp(Math.floor(wrappedLongitude * sourceWidth), 0, sourceWidth - 1)
      const sourceIndex = (textureY * sourceWidth + textureX) * 4

      const edgeShade = clamp(0.36 + depth * 0.78, 0.34, 1)
      const sunLight = clamp(1 + (-screenX - screenY) * 0.09, 0.82, 1.12)
      const light = edgeShade * sunLight
      output[outputIndex] = Math.min(255, source[sourceIndex] * light)
      output[outputIndex + 1] = Math.min(255, source[sourceIndex + 1] * light)
      output[outputIndex + 2] = Math.min(255, source[sourceIndex + 2] * light * 1.04)
      output[outputIndex + 3] = 255
    }
  }

  globeTextureContext.putImageData(globeImageData, 0, 0)
  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    globeTextureCanvas,
    centerX - size.radius,
    centerY - size.radius,
    size.radius * 2,
    size.radius * 2,
  )
  context.restore()
  return true
}

function drawLine(points, color, width = 1) {
  context.beginPath()
  let drawing = false
  points.forEach(({ lat, lon }) => {
    const point = project(lat, lon)
    if (!point.visible) {
      drawing = false
      return
    }
    if (drawing) context.lineTo(point.x, point.y)
    else context.moveTo(point.x, point.y)
    drawing = true
  })
  context.strokeStyle = color
  context.lineWidth = width
  context.stroke()
}

function drawGraticule() {
  for (let lat = -60; lat <= 60; lat += 30) {
    const points = []
    for (let lon = -180; lon <= 180; lon += 3) points.push({ lat, lon })
    drawLine(points, 'rgba(181, 224, 241, 0.16)')
  }

  for (let lon = -180; lon < 180; lon += 30) {
    const points = []
    for (let lat = -88; lat <= 88; lat += 3) points.push({ lat, lon })
    drawLine(points, 'rgba(181, 224, 241, 0.13)')
  }
}

function drawLand() {
  landPoints.forEach(({ lat, lon }) => {
    const point = project(lat, lon)
    if (!point.visible) return
    const alpha = clamp(0.18 + point.z * 0.58, 0.18, 0.76)
    context.fillStyle = `rgba(144, 220, 179, ${alpha})`
    context.beginPath()
    context.arc(point.x, point.y, 0.7 + point.z * 1.25, 0, Math.PI * 2)
    context.fill()
  })
}

function drawCities() {
  hitAreas.length = 0
  const orderedCities = [...cities]
    .map((city) => ({ city, point: project(city.lat, city.lon) }))
    .filter(({ point }) => point.visible)
    .sort((a, b) => a.point.z - b.point.z)

  orderedCities.forEach(({ city, point }) => {
    const active = city.id === selectedCity.value
    const radius = active ? 6.5 : 4.2
    context.shadowColor = active ? 'rgba(255, 218, 124, 0.9)' : 'rgba(148, 227, 255, 0.8)'
    context.shadowBlur = active ? 15 : 8
    context.fillStyle = active ? '#ffd978' : '#d8f6ff'
    context.beginPath()
    context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fill()
    context.shadowBlur = 0

    if (active || point.z > 0.58) {
      context.font = `${active ? 700 : 600} ${active ? 13 : 11}px Pretendard, sans-serif`
      context.fillStyle = active ? '#fff2bd' : 'rgba(224, 247, 255, 0.82)'
      context.textAlign = 'left'
      context.fillText(city.name, point.x + 10, point.y + 4)
    }

    hitAreas.push({ city, x: point.x, y: point.y, radius: active ? 20 : 15 })
  })
}

function drawGlobe() {
  frameId = 0
  if (!context) return
  context.clearRect(0, 0, size.width, size.height)
  drawStars()

  const centerX = size.width / 2
  const centerY = size.height / 2
  const atmosphere = context.createRadialGradient(
    centerX - size.radius * 0.3,
    centerY - size.radius * 0.34,
    size.radius * 0.08,
    centerX,
    centerY,
    size.radius * 1.16,
  )
  atmosphere.addColorStop(0, 'rgba(98, 191, 226, 0.3)')
  atmosphere.addColorStop(0.74, 'rgba(32, 112, 157, 0.12)')
  atmosphere.addColorStop(1, 'rgba(79, 187, 229, 0)')
  context.fillStyle = atmosphere
  context.beginPath()
  context.arc(centerX, centerY, size.radius * 1.16, 0, Math.PI * 2)
  context.fill()

  context.save()
  context.beginPath()
  context.arc(centerX, centerY, size.radius, 0, Math.PI * 2)
  context.clip()

  const textureDrawn = drawTexturedEarth(centerX, centerY)
  if (!textureDrawn) {
    const ocean = context.createRadialGradient(
      centerX - size.radius * 0.38,
      centerY - size.radius * 0.42,
      size.radius * 0.05,
      centerX + size.radius * 0.12,
      centerY + size.radius * 0.08,
      size.radius * 1.12,
    )
    ocean.addColorStop(0, '#6bc7e5')
    ocean.addColorStop(0.38, '#237da9')
    ocean.addColorStop(0.78, '#145078')
    ocean.addColorStop(1, '#08243f')
    context.fillStyle = ocean
    context.fillRect(centerX - size.radius, centerY - size.radius, size.radius * 2, size.radius * 2)
    drawLand()
  }

  drawGraticule()
  context.restore()

  context.strokeStyle = 'rgba(164, 231, 255, 0.46)'
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(centerX, centerY, size.radius, 0, Math.PI * 2)
  context.stroke()
  drawCities()
}

function scheduleDraw() {
  if (!frameId) frameId = requestAnimationFrame(drawGlobe)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const stage = stageRef.value
  if (!canvas || !stage) return
  const bounds = stage.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  size.width = Math.max(300, bounds.width)
  size.height = Math.max(390, bounds.height)
  size.radius = Math.min(size.width, size.height) * 0.34 * zoom.value
  canvas.width = Math.round(size.width * pixelRatio)
  canvas.height = Math.round(size.height * pixelRatio)
  canvas.style.width = `${size.width}px`
  canvas.style.height = `${size.height}px`
  context = canvas.getContext('2d')
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  scheduleDraw()
}

function onPointerDown(event) {
  dragging.value = true
  pointer.x = event.clientX
  pointer.y = event.clientY
  pointer.moved = false
  canvasRef.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event) {
  if (!dragging.value) return
  const deltaX = event.clientX - pointer.x
  const deltaY = event.clientY - pointer.y
  if (Math.abs(deltaX) + Math.abs(deltaY) > 2) pointer.moved = true
  camera.lon = normalizeLongitude(camera.lon - (deltaX / Math.max(size.radius, 1)) * 82)
  camera.lat = clamp(camera.lat + (deltaY / Math.max(size.radius, 1)) * 66, -68, 68)
  pointer.x = event.clientX
  pointer.y = event.clientY
  scheduleDraw()
}

function onPointerUp(event) {
  if (!dragging.value) return
  dragging.value = false
  canvasRef.value?.releasePointerCapture(event.pointerId)
  if (pointer.moved) return

  const bounds = canvasRef.value.getBoundingClientRect()
  const clickX = event.clientX - bounds.left
  const clickY = event.clientY - bounds.top
  const hit = [...hitAreas]
    .reverse()
    .find((area) => Math.hypot(area.x - clickX, area.y - clickY) <= area.radius)
  if (hit) chooseCity(hit.city)
}

function onWheel(event) {
  event.preventDefault()
  zoom.value = clamp(zoom.value - event.deltaY * 0.0012, 0.78, 1.62)
  size.radius = Math.min(size.width, size.height) * 0.34 * zoom.value
  scheduleDraw()
}

async function chooseCity(city) {
  selectedCity.value = city.id
  sessionStorage.setItem(SELECTED_CITY_STORAGE_KEY, city.id)
  camera.lon = city.lon
  camera.lat = clamp(city.lat, -58, 58)
  scheduleDraw()
  activityLogger.info('지구본', '도시 날씨 선택', {
    city: city.name,
    country: city.country,
  })
  await selectLocation(city.lat, city.lon, city.name)
}

function resetGlobe() {
  camera.lon = 126.978
  camera.lat = 25
  zoom.value = 1
  size.radius = Math.min(size.width, size.height) * 0.34
  scheduleDraw()
}

async function toggleGlobeFullscreen() {
  const stage = stageRef.value
  if (!stage) return

  if (!document.fullscreenEnabled) {
    activityLogger.warn('지구본', '이 브라우저는 전체화면을 지원하지 않습니다')
    return
  }

  try {
    // 이미 전체화면이면 원래 화면으로 돌아가기
    if (document.fullscreenElement === stage) {
      await document.exitFullscreen()
      return
    }

    // 지구본을 전체화면으로 표시
    await stage.requestFullscreen()
  } catch (error) {
    activityLogger.warn('지구본', '전체화면 전환 실패', {
      message: error?.message || String(error),
    })
  }
}

function handleFullscreenChange() {
  const wasGlobeFullscreen = isGlobeFullscreen.value
  const isFullscreenNow = document.fullscreenElement === stageRef.value

  isGlobeFullscreen.value = isFullscreenNow

  // 더블클릭이나 Esc로 전체화면을 종료하면 현재 화면을 새로고침합니다.
  if (wasGlobeFullscreen && !isFullscreenNow) {
    window.location.reload()
    return
  }

  // 화면 크기가 바뀐 뒤 캔버스를 다시 계산
  requestAnimationFrame(() => {
    resizeCanvas()
  })
}

watch(
  () => weather.value.updatedAt,
  () => scheduleDraw(),
)

onMounted(async () => {
  await nextTick()

  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(stageRef.value)

  canvasRef.value.addEventListener('wheel', onWheel, {
    passive: false,
  })

  document.addEventListener(
    'fullscreenchange',
    handleFullscreenChange,
  )

  resizeCanvas()

  const savedCityId = sessionStorage.getItem(SELECTED_CITY_STORAGE_KEY)
  const savedCity = cities.find((city) => city.id === savedCityId)

  if (savedCity) {
    await chooseCity(savedCity)
  }

  await loadEarthTexture()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  canvasRef.value?.removeEventListener('wheel', onWheel)

  document.removeEventListener(
    'fullscreenchange',
    handleFullscreenChange,
  )

  if (frameId) cancelAnimationFrame(frameId)
})
</script>

<template>
  <section class="earth-weather-page">
    <header class="earth-header">
      <div>
        <p class="earth-kicker">INTERACTIVE WEATHER GLOBE</p>
        <h2>지구의 날씨</h2>
        <p>지구본을 움직여 도시를 선택하고 지금의 하늘을 확인해 보세요.</p>
        <p>더블 클릭시 전체화면으로 전환됩니다.</p>
      </div>
      <button type="button" class="reset-button" @click="resetGlobe">↺ 지구본 초기화</button>
    </header>

    <div class="earth-layout">
      <div class="globe-card">
        <div
          ref="stageRef"
          class="globe-stage"
          :class="{ dragging, fullscreen: isGlobeFullscreen }"
          :aria-label="
            isGlobeFullscreen
              ? '더블클릭하면 전체화면을 종료하는 3D 지구본'
              : '더블클릭하면 전체화면으로 전환되는 3D 지구본'
          "
          @dblclick.stop.prevent="toggleGlobeFullscreen"
        >
          <canvas
            ref="canvasRef"
            role="img"
            aria-label="세계 주요 도시 날씨를 선택하는 3D 지구본"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          />
          <div class="texture-credit" :class="{ ready: textureReady }">
            <i /> {{ textureReady ? 'NASA BLUE MARBLE' : 'EARTH TEXTURE LOADING' }}
          </div>
          <div class="globe-hint">
            <span>↔ 드래그 회전</span>
            <span>⌁ 스크롤 확대</span>
            <span>{{ isGlobeFullscreen ? '⛶ 더블클릭 원래 화면' : '⛶ 더블클릭 전체화면' }}</span>
          </div>
          <div class="zoom-meter" aria-label="확대 비율">
            <span>ZOOM</span>
            <div><i :style="{ width: `${((zoom - 0.78) / 0.84) * 100}%` }" /></div>
          </div>
        </div>
      </div>

      <aside class="earth-weather-card" aria-live="polite">
        <div class="city-orbit"><span>{{ weatherGlyph(weather.condition) }}</span></div>
        <p class="earth-kicker">SELECTED CITY</p>
        <h3>{{ weather.location }}</h3>
        <p class="country-label">{{ selectedCityInfo.country }} · {{ weather.description }}</p>
        <div class="earth-temperature">
          <strong>{{ configStore.formatTemperature(weather.temp) }}</strong>
          <span>체감 {{ configStore.formatTemperature(weather.feelsLike) }}</span>
        </div>
        <div class="earth-metrics">
          <div><span>습도</span><strong>{{ weather.humidity }}%</strong></div>
          <div><span>풍속</span><strong>{{ weather.windSpeed.toFixed(1) }}m/s</strong></div>
          <div><span>미세먼지</span><strong>{{ weather.pm25 === null ? '–' : Math.round(weather.pm25) }}</strong></div>
          <div><span>구름</span><strong>{{ weather.clouds }}%</strong></div>
        </div>
        <div v-if="loading" class="earth-loading"><i /> 도시의 하늘을 불러오는 중…</div>
      </aside>
    </div>

    <div class="city-selector">
      <div class="city-selector-title">
        <div><span>WORLD CITIES</span><strong>도시 바로 선택</strong></div>
        <small>{{ cities.length }}개 도시</small>
      </div>
      <div class="city-list">
        <button
          v-for="city in cities"
          :key="city.id"
          type="button"
          :class="{ active: selectedCity === city.id }"
          @click="chooseCity(city)"
        >
          <i />
          <span>{{ city.name }}<small>{{ city.country }}</small></span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.earth-weather-page {
  padding: 8px 0 24px;
  color: var(--text-color);
}

.earth-header,
.earth-layout,
.city-selector-title,
.earth-metrics,
.globe-hint {
  display: flex;
}

.earth-header {
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.earth-kicker {
  margin: 0 0 5px;
  color: #3780a2;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.17em;
}

.earth-header h2 {
  margin: 0;
  font-size: clamp(24px, 3.5vw, 38px);
  letter-spacing: -0.045em;
}

.earth-header > div > p:last-child {
  margin: 7px 0 0;
  color: var(--muted-color);
  font-size: 12px;
}

.reset-button {
  flex: 0 0 auto;
  padding: 9px 13px;
  border: 1px solid var(--border-color);
  border-radius: 11px;
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.earth-layout {
  align-items: stretch;
  gap: 14px;
}

.globe-card {
  flex: 1 1 65%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(125, 195, 223, 0.3);
  border-radius: 22px;
  background:
    radial-gradient(circle at 16% 18%, rgba(117, 181, 255, 0.22) 0 1px, transparent 1.7px),
    radial-gradient(circle at 78% 24%, rgba(255, 255, 255, 0.26) 0 1px, transparent 1.6px),
    radial-gradient(circle at 34% 76%, rgba(180, 218, 255, 0.2) 0 1.2px, transparent 1.8px),
    radial-gradient(ellipse at 52% 42%, rgba(28, 72, 124, 0.28), transparent 54%),
    linear-gradient(145deg, #020610 0%, #061224 48%, #01040c 100%);
  background-size: 73px 79px, 107px 113px, 149px 137px, 100% 100%, 100% 100%;
  box-shadow: 0 20px 54px rgba(11, 33, 61, 0.28);
}

.globe-stage {
  position: relative;
  min-height: 480px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.globe-stage::before,
.globe-stage::after {
  position: absolute;
  content: '';
  pointer-events: none;
}

.globe-stage::before {
  inset: 0;
  background:
    radial-gradient(circle at 21% 31%, rgba(255, 255, 255, 0.55) 0 0.7px, transparent 1.3px),
    radial-gradient(circle at 82% 72%, rgba(149, 205, 255, 0.5) 0 0.8px, transparent 1.4px);
  background-size: 181px 167px, 223px 211px;
  opacity: 0.55;
}

.globe-stage::after {
  inset: auto 10% 4% 10%;
  height: 18%;
  background: radial-gradient(ellipse, rgba(32, 95, 150, 0.2), transparent 70%);
  filter: blur(18px);
}

.globe-stage.dragging { cursor: grabbing; }
.globe-stage canvas { position: relative; z-index: 2; display: block; width: 100%; height: 100%; }

.texture-credit {
  position: absolute;
  z-index: 3;
  right: 17px;
  top: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(190, 222, 240, 0.52);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
  pointer-events: none;
}

.texture-credit i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8d9aaa;
  box-shadow: 0 0 7px currentColor;
}

.texture-credit.ready { color: rgba(150, 226, 255, 0.72); }
.texture-credit.ready i { background: #79d6f7; }

.globe-hint {
  position: absolute;
  top: 16px;
  left: 17px;
  gap: 7px;
  pointer-events: none;
}

.globe-hint span {
  padding: 6px 9px;
  border: 1px solid rgba(180, 231, 249, 0.18);
  border-radius: 99px;
  background: rgba(5, 25, 43, 0.55);
  color: rgba(219, 246, 255, 0.7);
  font-size: 9px;
  font-weight: 700;
  backdrop-filter: blur(8px);
}

.zoom-meter {
  position: absolute;
  right: 17px;
  bottom: 16px;
  width: 88px;
  color: rgba(218, 245, 255, 0.63);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.zoom-meter > div {
  height: 3px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(213, 243, 255, 0.15);
}

.zoom-meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7ed7f4, #ffe08a);
}

.earth-weather-card {
  position: relative;
  flex: 1 1 35%;
  min-width: 210px;
  padding: 23px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 22px;
  background: var(--card-bg);
  box-shadow: 0 18px 48px rgba(48, 104, 128, 0.1);
}

.city-orbit {
  position: absolute;
  top: 22px;
  right: 22px;
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--accent-soft);
  color: #347c9a;
  font-size: 23px;
}
.globe-stage:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  border-radius: 0;
  background:
    radial-gradient(
      circle at center,
      rgba(21, 70, 118, 0.35),
      transparent 48%
    ),
    #01040c;
}

.globe-stage:fullscreen canvas {
  width: 100%;
  height: 100%;
}

.earth-weather-card h3 {
  max-width: calc(100% - 54px);
  margin: 7px 0 4px;
  font-size: clamp(25px, 3vw, 36px);
  letter-spacing: -0.05em;
}

.country-label {
  margin: 0;
  color: var(--muted-color);
  font-size: 10px;
}

.earth-temperature {
  margin: 30px 0 23px;
}

.earth-temperature strong {
  display: block;
  font-family: Georgia, serif;
  font-size: clamp(58px, 8vw, 84px);
  font-weight: 500;
  line-height: 0.9;
  letter-spacing: -0.09em;
}

.earth-temperature span {
  display: block;
  margin-top: 10px;
  color: var(--muted-color);
  font-size: 11px;
}

.earth-metrics {
  flex-wrap: wrap;
  gap: 8px;
}

.earth-metrics > div {
  flex: 1 1 calc(50% - 4px);
  min-width: 76px;
  padding: 11px;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-color);
}

.earth-metrics span,
.earth-metrics strong { display: block; }
.earth-metrics span { color: var(--muted-color); font-size: 9px; }
.earth-metrics strong { margin-top: 4px; font-size: 13px; }

.earth-loading {
  position: absolute;
  right: 20px;
  bottom: 18px;
  left: 20px;
  padding: 9px 11px;
  border-radius: 10px;
  background: rgba(54, 130, 164, 0.92);
  color: white;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
}

.earth-loading i {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 5px;
  border-radius: 50%;
  background: #bdf1ff;
  animation: earthPulse 0.9s ease-in-out infinite alternate;
}

.city-selector {
  margin-top: 14px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: var(--card-bg);
}

.city-selector-title {
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 11px;
}

.city-selector-title span,
.city-selector-title strong { display: block; }
.city-selector-title span { color: #3780a2; font-size: 8px; font-weight: 800; letter-spacing: 0.15em; }
.city-selector-title strong { margin-top: 2px; font-size: 13px; }
.city-selector-title small { color: var(--muted-color); font-size: 9px; }

.city-list {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
  max-height: 150px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.city-list button {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 9px;
  border: 1px solid var(--border-color);
  border-radius: 11px;
  background: var(--bg-color);
  color: var(--text-color);
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.city-list button:hover,
.city-list button.active {
  border-color: rgba(63, 146, 180, 0.5);
  background: var(--accent-soft);
  transform: translateY(-1px);
}

.city-list button > i {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #66b6d4;
  box-shadow: 0 0 0 3px rgba(102, 182, 212, 0.13);
}

.city-list button.active > i { background: #f2c966; box-shadow: 0 0 0 3px rgba(242, 201, 102, 0.18); }
.city-list button > span { min-width: 0; overflow: hidden; font-size: 10px; font-weight: 750; white-space: nowrap; text-overflow: ellipsis; }
.city-list button small { display: block; margin-top: 2px; overflow: hidden; color: var(--muted-color); font-size: 7px; font-weight: 600; text-overflow: ellipsis; }

@keyframes earthPulse {
  to { transform: scale(1.5); opacity: 0.45; }
}

@media (max-width: 1180px) {
  .earth-layout { flex-direction: column; }
  .earth-weather-card { min-width: 0; }
  .globe-stage { min-height: 460px; }
  .city-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .earth-header { align-items: flex-start; flex-direction: column; }
  .globe-stage { min-height: 390px; }
  .city-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .globe-hint { flex-direction: column; }
}
</style>
