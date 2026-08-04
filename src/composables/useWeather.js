import { computed, ref } from 'vue'

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY

const now = Math.floor(Date.now() / 1000)

const weather = ref({
  location: '서울',
  country: 'KR',
  lat: 37.5665,
  lon: 126.978,
  updatedAt: now,
  timezone: 32400,
  temp: 24,
  feelsLike: 25,
  tempMin: 22,
  tempMax: 27,
  description: '맑음',
  condition: 'Clear',
  humidity: 58,
  pressure: 1014,
  visibility: 10000,
  windSpeed: 2.4,
  clouds: 8,
  sunrise: now - 14400,
  sunset: now + 21600,
  aqi: 2,
  pm25: 14,
  pm10: 27,
})

const loading = ref(false)
const notice = ref(API_KEY ? 'OpenWeather 실시간 데이터 연결됨' : 'API 키 연결 전 · 샘플 화면')
const consentOpen = ref(sessionStorage.getItem('location-consent-seen') !== 'true')
let initialized = false

const conditionClass = computed(() => `weather-visual--${weather.value.condition.toLowerCase()}`)

function weatherGlyph(condition) {
  if (condition === 'Clear') return '☀'
  if (condition === 'Rain' || condition === 'Drizzle') return '☂'
  if (condition === 'Thunderstorm') return 'ϟ'
  if (condition === 'Snow') return '✣'
  if (['Mist', 'Fog', 'Haze'].includes(condition)) return '≋'
  return '☁'
}

async function requestJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || '날씨 정보를 불러오지 못했어요.')
  }
  return response.json()
}

async function loadWeather(lat, lon) {
  if (!API_KEY) throw new Error('OpenWeather API 키를 확인해 주세요.')

  const common = `lat=${lat}&lon=${lon}&appid=${API_KEY}`
  const [current, air, reverse] = await Promise.all([
    requestJson(`https://api.openweathermap.org/data/2.5/weather?${common}&units=metric&lang=kr`),
    requestJson(`https://api.openweathermap.org/data/2.5/air_pollution?${common}`),
    requestJson(`https://api.openweathermap.org/geo/1.0/reverse?${common}&limit=1`),
  ])

  const place = reverse?.[0]
  const airNow = air?.list?.[0]
  weather.value = {
    location: place?.local_names?.ko || place?.name || current.name,
    country: place?.country || current.sys.country,
    lat,
    lon,
    updatedAt: current.dt,
    timezone: current.timezone,
    temp: current.main.temp,
    feelsLike: current.main.feels_like,
    tempMin: current.main.temp_min,
    tempMax: current.main.temp_max,
    description: current.weather?.[0]?.description || '날씨 정보',
    condition: current.weather?.[0]?.main || 'Clouds',
    humidity: current.main.humidity,
    pressure: current.main.pressure,
    visibility: current.visibility || 0,
    windSpeed: current.wind?.speed || 0,
    clouds: current.clouds?.all || 0,
    sunrise: current.sys.sunrise,
    sunset: current.sys.sunset,
    aqi: airNow?.main?.aqi ?? null,
    pm25: airNow?.components?.pm2_5 ?? null,
    pm10: airNow?.components?.pm10 ?? null,
  }
  notice.value = '방금 업데이트 · OpenWeather'
}

async function requestLocation() {
  consentOpen.value = false
  sessionStorage.setItem('location-consent-seen', 'true')

  if (!navigator.geolocation) {
    notice.value = '이 브라우저에서는 위치 확인을 지원하지 않아요.'
    return
  }

  loading.value = true
  notice.value = '현재 위치의 하늘을 찾는 중이에요…'

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        await loadWeather(coords.latitude, coords.longitude)
      } catch (error) {
        notice.value = `${error.message} · 서울 샘플 표시 중`
      } finally {
        loading.value = false
      }
    },
    () => {
      loading.value = false
      notice.value = '위치 권한 없이 서울 날씨를 보여드려요.'
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
  )
}

function dismissConsent() {
  consentOpen.value = false
  sessionStorage.setItem('location-consent-seen', 'true')
  notice.value = '위치 정보 없이 서울 날씨를 보여드려요.'
}

async function initializeWeather() {
  if (initialized) return
  initialized = true
  if (!API_KEY) return

  loading.value = true
  try {
    await loadWeather(weather.value.lat, weather.value.lon)
  } catch (error) {
    notice.value = `${error.message} · 샘플 화면 표시 중`
  } finally {
    loading.value = false
  }
}

export function useWeather() {
  return {
    weather,
    loading,
    notice,
    consentOpen,
    conditionClass,
    initializeWeather,
    requestLocation,
    dismissConsent,
  }
}

export { weatherGlyph }
