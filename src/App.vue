<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useWeather, weatherGlyph } from './composables/useWeather.js'
import { activityLogger } from './utils/activityLogger.js'
import { useConfigStore } from './stores/configStore.js'

// --- 보내주신 App.vue의 다크모드 상태 관리 ---
const isDark = ref(false)
const configStore = useConfigStore()
const { weather, loading, notice, consentOpen, weatherDateLabel, initializeWeather, requestLocation, dismissConsent } = useWeather()

const conditionClass = computed(() => `weather-visual--${weather.value.condition.toLowerCase()}`)

function applyTheme(dark) {
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

function toggleTheme() {
  isDark.value = !isDark.value
}

watch(isDark, (newVal) => {
  applyTheme(newVal)
  localStorage.setItem('theme', newVal ? 'dark' : 'light')
  activityLogger.info('테마', '화면 테마 변경', {
    theme: newVal ? 'dark' : 'light',
  })
})

onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme(isDark.value)
  initializeWeather()
})
</script>

<template>
  <div class="full-page">
    <!-- 보내주신 좌우 2단 레이아웃을 실제 서비스 화면으로 확장 -->
    <div class="split-layout">
      <!-- 왼쪽: 날씨 비주얼과 현재 지역 요약 -->
      <section class="left-panel">
        <div class="left-topline">
          <RouterLink to="/dashboard" class="brand-mark" aria-label="하늘결 실시간 대시보드">
            <span class="brand-sun" />
            <strong>하늘결</strong>
          </RouterLink>
          <span class="live-pill"><i /> LIVE WEATHER</span>
        </div>

        <div class="sky-copy">
          <p class="kicker">오늘, 여기의 하늘</p>
          <p class="weather-date">{{ weatherDateLabel }}</p>
          <h1>{{ weather.location }}</h1>
          <p>{{ weather.description }}</p>
        </div>

        <div class="weather-visual" :class="conditionClass" aria-hidden="true">
          <div v-if="weather.condition === 'Clear' || weather.condition === 'Clouds'" class="visual-sun" />
          <div v-if="weather.condition !== 'Clear'" class="visual-cloud visual-cloud-back" />
          <div v-if="weather.condition !== 'Clear'" class="visual-cloud visual-cloud-front" />
          <div v-if="['Rain', 'Drizzle', 'Thunderstorm'].includes(weather.condition)" class="visual-rain"><i /><i /><i /><i /></div>
          <div v-if="weather.condition === 'Snow'" class="visual-snow">✦　✦　✦</div>
          <span class="visual-glyph">{{ weatherGlyph(weather.condition) }}</span>
        </div>

        <div class="temperature-block">
          <strong>{{ configStore.formatTemperature(weather.temp) }}</strong>
          <div>
            <span>체감 {{ configStore.formatTemperature(weather.feelsLike) }}</span>
            <span>최고 {{ configStore.formatTemperature(weather.tempMax) }} · 최저 {{ configStore.formatTemperature(weather.tempMin) }}</span>
          </div>
        </div>

        <div class="left-summary">
          <div>
            <span>습도</span><strong>{{ weather.humidity }}%</strong>
          </div>
          <div>
            <span>바람</span><strong>{{ weather.windSpeed.toFixed(1) }}m/s</strong>
          </div>
          <div>
            <span>미세먼지</span><strong>{{ weather.pm25 === null ? '–' : Math.round(weather.pm25) }}</strong>
          </div>
        </div>

        <div class="left-footer">
          <p>“오늘의 하늘을 가장 편안하게”</p>
          <span>Weather data by OpenWeather</span>
        </div>
      </section>

      <!-- 오른쪽: 보내주신 네비게이션 + RouterView 구조 유지 -->
      <section class="right-panel">
        <div class="title-row">
          <nav class="nav-bar" aria-label="주요 메뉴">
            <RouterLink to="/dashboard" class="nav-item">🌦️ 실시간 대시보드</RouterLink>
            <span class="divider">|</span>
            <RouterLink to="/earth" class="nav-item">🌍 지구의 날씨</RouterLink>
            <span class="divider">|</span>
            <RouterLink to="/about" class="nav-item">ℹ️ 서비스 소개</RouterLink>
          </nav>
          <div class="display-controls">
            <button class="unit-toggle" type="button" :aria-label="configStore.unit === 'celsius' ? '화씨로 변경' : '섭씨로 변경'" @click="configStore.toggleUnit">
              {{ configStore.unitSymbol }} {{ configStore.unitName }}
            </button>
            <button class="theme-toggle" type="button" @click="toggleTheme">
              {{ isDark ? '☀️ 라이트 모드' : '🌙 다크 모드' }}
            </button>
          </div>
        </div>
        <hr />

        <div class="global-status" role="status">
          <i :class="{ loading }" />
          {{ loading ? '날씨를 불러오는 중…' : notice }}
          <button type="button" data-activity-ignore @click="requestLocation">⌖ 내 위치</button>
        </div>

        <RouterView />
      </section>
    </div>

    <div v-if="consentOpen" class="consent-backdrop" data-activity-ignore>
      <section class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="location-title">
        <div class="location-orbit"><span>⌖</span></div>
        <p class="kicker">WELCOME</p>
        <h2 id="location-title">지금 있는 곳의 하늘을<br />먼저 보여드릴까요?</h2>
        <p>동의하면 브라우저가 위치 권한을 요청합니다. 위치는 날씨 조회에만 사용하고 따로 저장하지 않아요.</p>
        <button class="consent-primary" type="button" @click="requestLocation">내 위치 날씨 보기</button>
        <button class="consent-secondary" type="button" @click="dismissConsent">서울부터 둘러보기</button>
      </section>
    </div>
  </div>
</template>

<style>
@import './assets/exercise.css';

.display-controls {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

button.unit-toggle {
  width: auto !important;
  display: inline-block !important;
  padding: 7px 13px !important;
  margin: 0 !important;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: var(--accent-soft);
  color: #216f92;
  cursor: pointer;
  font-size: 11px !important;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}

[data-theme='dark'] button.unit-toggle {
  color: #b7e8f8;
}

button.unit-toggle:hover {
  opacity: 0.78;
}

.sky-copy .weather-date {
  margin: -2px 0 13px;
  color: rgba(23, 56, 76, 0.66);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: -0.01em;
}

[data-theme='dark'] .sky-copy .weather-date {
  color: rgba(229, 246, 252, 0.68);
}

@media (max-width: 620px) {
  .display-controls {
    gap: 4px;
  }
  button.unit-toggle {
    padding-inline: 9px !important;
    font-size: 9px !important;
  }
}
</style>
