<script setup>
import { ref, onMounted } from 'vue'
import { activityLogger } from '../../utils/activityLogger.js'
import { useConfigStore } from '../../stores/configStore.js'
import { formatWeatherObservation, useWeather } from '../../composables/useWeather.js'

const configStore = useConfigStore()
const { weather, selectLocation } = useWeather()
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY

const cityList = ref([])
const searchInput = ref('')
const isLoading = ref(false)
const errorMsg = ref('')
const isComposing = ref(false) // 한글 입력(IME) 조합 상태 추적

const STORAGE_KEY = 'weather-dashboard-cities'

// -------------------------------
// 온도/습도 기반 기분 표현 매핑 함수
// -------------------------------
function getMoodMessage(temp, humidity) {
  if (temp >= 30) return { emoji: '🥵', text: '너무 더워요! 물 챙기세요' }
  if (temp >= 25 && humidity >= 70) return { emoji: '💦', text: '덥고 습해요, 끈적한 하루' }
  if (temp >= 25) return { emoji: '☀️', text: '더운 날씨, 시원한 곳 찾기' }
  if (temp >= 18 && temp < 25) return { emoji: '😊', text: '딱 좋은 날씨예요' }
  if (temp >= 10 && temp < 18) return { emoji: '🍂', text: '선선해요, 겉옷 하나 챙기세요' }
  if (temp >= 0 && temp < 10) return { emoji: '🧣', text: '쌀쌀해요, 따뜻하게 입으세요' }
  return { emoji: '🥶', text: '매우 추워요! 방한 필수' }
}

// -------------------------------
// 1단계: Geocoding API로 도시명 → 위도/경도 + 현지명 조회
// -------------------------------
async function geocodeCity(query) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${API_KEY}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('위치 검색에 실패했습니다.')
  }

  const results = await res.json()
  if (!results || results.length === 0) {
    throw new Error('도시를 찾을 수 없습니다.')
  }

  return results[0]
}

// -------------------------------
// 2단계: 위도/경도로 날씨 데이터 조회
// -------------------------------
async function fetchWeatherByCoords(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('날씨 정보를 불러오지 못했습니다.')
  }

  return res.json()
}

// -------------------------------
// 도시 검색 후 추가 (Geocoding → Weather 순차 호출)
// -------------------------------
async function addCity() {
  // 이미 요청이 진행 중이면 중복 실행 방지 (한글 입력 시 Enter 중복 감지 대응)
  if (isLoading.value) {
    activityLogger.warn('검색', '진행 중인 검색이 있어 요청을 건너뜀')
    return
  }

  const rawInput = searchInput.value.trim()
  if (!rawInput) {
    activityLogger.warn('검색', '빈 검색어 제출')
    return
  }

  activityLogger.info('검색', '도시 검색 시작', { query: rawInput })

  isLoading.value = true
  errorMsg.value = ''

  try {
    if (cityList.value.length >= 5) {
      errorMsg.value = '도시는 최대 5개까지 추가할 수 있습니다.'
      activityLogger.warn('즐겨찾기', '최대 등록 개수 초과', {
        query: rawInput,
        count: cityList.value.length,
      })
      return
    }

    // 1단계: 좌표 + 현지명 조회
    const geoData = await geocodeCity(rawInput)
    const { lat, lon, local_names, name, country } = geoData

    const koreanName = local_names?.ko || null
    const displayName = koreanName ? `${koreanName} (${name})` : name

    // 2단계: 좌표로 날씨 조회 (실제 고유 도시 ID를 받음)
    const weatherData = await fetchWeatherByCoords(lat, lon)

    // 중복 체크는 실제 날씨 API가 반환한 고유 id로만 판단
    const isDuplicate = cityList.value.some((c) => c.id === weatherData.id)
    if (isDuplicate) {
      errorMsg.value = '이미 등록된 도시입니다.'
      activityLogger.warn('즐겨찾기', '이미 등록된 도시', {
        query: rawInput,
        city: displayName,
      })
      isLoading.value = false
      return
    }

    const cityData = {
      id: weatherData.id,
      lat,
      lon,
      country,
      displayName,
      name,
      temp: Math.round(weatherData.main.temp),
      feelsLike: Math.round(weatherData.main.feels_like),
      humidity: weatherData.main.humidity,
      clouds: weatherData.clouds.all,
      windSpeed: weatherData.wind.speed,
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      updatedAt: weatherData.dt,
      timezone: weatherData.timezone,
    }

    cityList.value.push(cityData)
    saveToStorage()
    searchInput.value = ''
    activityLogger.success('즐겨찾기', '도시 추가 완료', {
      query: rawInput,
      city: displayName,
      count: cityList.value.length,
    })
  } catch (err) {
    errorMsg.value = err.message
    activityLogger.error('검색', '도시 검색 실패', {
      query: rawInput,
      message: err.message,
    })
  } finally {
    isLoading.value = false
  }
}

function cityObservationLabel(city) {
  if (!city.updatedAt) return '저장된 날씨 · 카드를 눌러 최신 정보 확인'
  return formatWeatherObservation(city.updatedAt, city.timezone)
}

function isSelectedCity(city) {
  return Math.abs(Number(weather.value.lat) - Number(city.lat)) < 0.01 && Math.abs(Number(weather.value.lon) - Number(city.lon)) < 0.01
}

async function selectCity(city) {
  if (!Number.isFinite(Number(city.lat)) || !Number.isFinite(Number(city.lon))) {
    errorMsg.value = '이 도시는 위치 정보가 없어 다시 검색해야 합니다.'
    return
  }

  errorMsg.value = ''
  activityLogger.info('대시보드', '도시 카드를 메인 날씨로 선택', {
    city: city.displayName,
  })
  await selectLocation(city.lat, city.lon, city.displayName)
  document.querySelector('.left-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function removeCity(id) {
  const city = cityList.value.find((item) => item.id === id)
  cityList.value = cityList.value.filter((c) => c.id !== id)
  saveToStorage()
  activityLogger.info('즐겨찾기', '도시 삭제', {
    city: city?.displayName || '알 수 없는 도시',
    count: cityList.value.length,
  })
}

// OpenWeather 사이트 내 해당 도시 페이지를 새 탭으로 열기
function openInOpenWeather(cityId) {
  const city = cityList.value.find((item) => item.id === cityId)
  activityLogger.info('외부 링크', 'OpenWeather 상세 페이지 열기', {
    city: city?.displayName || '알 수 없는 도시',
  })
  window.open(`https://openweathermap.org/city/${cityId}`, '_blank')
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cityList.value))
}

function loadFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    cityList.value = JSON.parse(saved)
  }
}

onMounted(() => {
  loadFromStorage()
  activityLogger.info('즐겨찾기', '저장된 도시 목록 불러오기', {
    count: cityList.value.length,
    cities: cityList.value.map((city) => city.displayName),
  })
})
</script>

<template>
  <div class="dashboard-wrapper">
    <section class="search-box">
      <h3>🔍 도시 검색 및 추가</h3>
      <div class="search-input-row">
        <input
          type="text"
          v-model="searchInput"
          data-activity-search
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
          @keyup.enter="
            () => {
              if (!isComposing) addCity()
            }
          "
          placeholder="도시 이름 입력 (한글 또는 영문, 예: 서울, Seoul)"
        />
        <button class="btn-detail" @click="addCity" :disabled="isLoading">
          {{ isLoading ? '검색 중...' : '추가' }}
        </button>
      </div>
      <p v-if="errorMsg" style="color: #e74c3c; margin-top: 6px">⚠️ {{ errorMsg }}</p>
    </section>

    <section class="list-box">
      <h3>🏙️ 등록된 도시 날씨</h3>
      <p class="card-guide">도시 카드를 누르면 왼쪽 메인 화면에서 최신 날씨와 세부 정보를 확인할 수 있습니다.</p>

      <div
        v-for="city in cityList"
        :key="city.id"
        class="weather-card"
        :class="{ selected: isSelectedCity(city) }"
        role="button"
        tabindex="0"
        :aria-label="`${city.displayName} 날씨를 왼쪽 메인 화면에서 보기`"
        @click="selectCity(city)"
        @keydown.enter.self="selectCity(city)"
      >
        <div class="card-header">
          <h4>{{ city.displayName }}</h4>
          <button class="btn-delete" @click.stop="removeCity(city.id)">✕ 삭제</button>
        </div>
        <p class="card-observed-at">{{ cityObservationLabel(city) }}</p>
        <span v-if="isSelectedCity(city)" class="selected-label">● 왼쪽 화면에 표시 중</span>

        <div class="weather-main">
          <img :src="`https://openweathermap.org/img/wn/${city.icon}@2x.png`" :alt="city.description" class="weather-icon" />
          <div class="temp-info">
            <p class="temp-big">
              {{ configStore.formatTemperature(city.temp) }}
            </p>
            <p class="feels-like">체감 {{ configStore.formatTemperature(city.feelsLike) }}</p>
          </div>
        </div>

        <p class="description">{{ city.description }}</p>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">💧 습도</span>
            <span class="detail-value">{{ city.humidity }}%</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">☁️ 구름양</span>
            <span class="detail-value">{{ city.clouds }}%</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">🌬️ 풍속</span>
            <span class="detail-value">{{ city.windSpeed }} m/s</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">🌡️ 체감온도</span>
            <span class="detail-value">{{ configStore.formatTemperature(city.feelsLike) }}</span>
          </div>
        </div>

        <span v-if="city.temp >= 25" class="badge hot">🔥 더움 (25도 이상)</span>
        <span v-else class="badge cool">❄️ 선선함 (25도 미만)</span>

        <div class="mood-box">
          {{ getMoodMessage(city.temp, city.humidity).emoji }}
          {{ getMoodMessage(city.temp, city.humidity).text }}
        </div>

        <button class="btn-openweather" @click.stop="openInOpenWeather(city.id)">🌐 OpenWeather에서 상세보기</button>
      </div>

      <p v-if="cityList.length === 0" style="text-align: center; color: #888; padding: 20px 0">검색해서 도시를 추가해보세요 🔍</p>
    </section>
  </div>
</template>

<style scoped>
.search-input-row {
  display: flex;
  gap: 8px;
}

.search-input-row input {
  flex: 1;
}

.card-guide {
  margin: -4px 0 14px;
  color: var(--muted-color);
  font-size: 11px;
  line-height: 1.6;
}

.weather-card {
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.weather-card:hover,
.weather-card:focus-visible {
  transform: translateY(-2px);
  outline: none;
}

.weather-card.selected {
  border-color: #55a8ca !important;
  box-shadow:
    0 0 0 3px rgba(85, 168, 202, 0.16),
    var(--shadow) !important;
}

.card-observed-at {
  margin: 5px 0 0;
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 650;
}

.selected-label {
  display: inline-block;
  margin-top: 7px;
  color: #2384a9;
  font-size: 9px;
  font-weight: 850;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-delete {
  background: none;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
}

.btn-delete:hover {
  background-color: #e74c3c;
  color: white;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}

.weather-icon {
  width: 60px;
  height: 60px;
}

.temp-big {
  font-size: 28px;
  font-weight: bold;
  margin: 0;
}

.feels-like {
  font-size: 13px;
  color: #666;
  margin: 0;
}

.description {
  text-transform: capitalize;
  margin: 4px 0 12px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-item {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 8px;
  text-align: center;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: #666;
}

.detail-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
}

.mood-box {
  margin-top: 10px;
  padding: 10px;
  background-color: #fff9db;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
}

.btn-openweather {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  border: 1px solid #4a90d9;
  border-radius: 8px;
  background-color: #eaf3fc;
  color: #2166b0;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.btn-openweather:hover {
  background-color: #4a90d9;
  color: white;
}
</style>
