<script setup>
import { ref, computed, watch, watchEffect } from 'vue'

// 1. [1일차 데이터] 가상의 백엔드 데이터 배열
const weatherList = ref([
  { id: 'city_01', name: '서울', temp: 28, status: '맑음' },
  { id: 'city_02', name: '수원', temp: 24, status: '비' },
  { id: 'city_03', name: '부산', temp: 26, status: '구름' },
])

// 2. [1일차 데이터] 검색어 및 알림창 제어용 데이터
const searchQuery = ref('')
const selectedCityInfo = ref('카드를 클릭하거나 검색해 보세요.')

// 3. [2일차 추가] computed를 활용한 실시간 검색 필터링 연산기 (★핵심)
const filteredWeatherList = computed(() => {
  const query = searchQuery.value.trim()
  if (!query) {
    return weatherList.value
  }
  return weatherList.value.filter((item) => item.name.includes(query))
})

// 4. [2일차 추가] watch를 활용한 선택 도시 추적 센서
watch(selectedCityInfo, (newInfo) => {
  console.log(`👁️‍🗨️ [watch 감지] 상태 바 문구가 업데이트되었습니다 -> "${newInfo}"`)
})

// 5. [2일차 추가] watchEffect를 활용한 자동 의존성 API 로그 시뮬레이션
watchEffect(() => {
  console.log(`🤖 [watchEffect 자동 호출] 현재 검색어 '${searchQuery.value}'에 매칭되는 API 데이터를 필터링합니다.`)
})

// 6. [신규 추가] 날씨 상태(맑음/구름/비)에 따른 아이콘 & 배지 정보 매핑
const weatherStatusMap = {
  맑음: { icon: '☀️', label: '맑음', badgeClass: 'sunny' },
  구름: { icon: '☁️', label: '흐림', badgeClass: 'cloudy' },
  비: { icon: '🌧️', label: '비', badgeClass: 'rainy' },
}

// 상태 문자열을 넣으면 아이콘/라벨/클래스 정보를 반환
function getWeatherInfo(status) {
  return weatherStatusMap[status] || { icon: '🌈', label: status, badgeClass: 'unknown' }
}

// 알림 대행 함수 (온도 배지 + 날씨 배지 정보를 함께 alert에 표시)
const showDetail = (cityName, status, temp) => {
  const weatherInfo = getWeatherInfo(status)
  const tempInfo = temp >= 25 ? '🔥 더움 (25도 이상)' : '❄️ 선선함 (25도 미만)'

  window.alert(
    `${cityName}의 현재 날씨 상세 정보\n\n` +
      `${weatherInfo.icon} 날씨: ${weatherInfo.label}\n` +
      `🌡️ 기온: ${temp}°C\n` +
      `${tempInfo}`
  )
}
</script>

<template>
  <div class="dashboard-wrapper">
    <section class="search-box">
      <h3>🔍 도시 검색</h3>
      <input type="text" :value="searchQuery" @input="(e) => (searchQuery = e.target.value)" placeholder="검색할 도시 이름 입력" />
      <p>
        검색 중인 도시: <strong>{{ searchQuery }}</strong>
      </p>
    </section>

    <section class="list-box">
      <h3>🏙️ 지역별 날씨 현황</h3>

      <div v-for="item in filteredWeatherList" :key="item.id" class="weather-card" @click="selectedCityInfo = `${item.name}이 선택되었습니다.`">
        <h4>{{ item.name }} ({{ item.status }})</h4>
        <p>현재 기온: {{ item.temp }}°C</p>

        <!-- 온도 배지 (기존) -->
        <span v-if="item.temp >= 25" class="badge hot">🔥 더움 (25도 이상)</span>
        <span v-else class="badge cool">❄️ 선선함 (25도 미만)</span>

        <!-- 날씨 상태 배지 (신규) -->
        <span class="badge" :class="getWeatherInfo(item.status).badgeClass">
          {{ getWeatherInfo(item.status).icon }} {{ getWeatherInfo(item.status).label }}
        </span>

        <button class="btn-detail" @click.stop="showDetail(item.name, item.status, item.temp)">상세보기</button>
      </div>

      <p v-if="filteredWeatherList.length === 0" style="text-align: center; color: #e74c3c; padding: 10px 0">😭 검색 결과와 일치하는 도시가 없습니다.</p>
    </section>

    <div class="status-bar">
      {{ selectedCityInfo }}
    </div>
  </div>
</template>

<style scoped>
/* 날씨 상태 배지 색상 */
.badge.sunny {
  background-color: #fff3cd;
  color: #b8860b;
}

.badge.cloudy {
  background-color: #e2e8f0;
  color: #4a5568;
}

.badge.rainy {
  background-color: #d0ebff;
  color: #1864ab;
}

.badge.unknown {
  background-color: #f1f3f5;
  color: #495057;
}
</style>
