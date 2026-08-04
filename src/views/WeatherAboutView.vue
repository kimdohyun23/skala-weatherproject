<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const handleGoHome = () => {
  router.push('/')
}
</script>

<template>
  <div>
    <h3>ℹ️ 서비스 소개</h3>
    <hr />

    <div class="description-box">
      <p>본 앱은 <strong>Vue 3</strong> 및 <strong>Vue Router 4</strong> 기반으로 제작된 실습용 기상 관측 대시보드 시스템입니다.</p>
      <ul>
        <li><code>components/exercise/</code> 폴더 내부의 독립 부품 연동</li>
        <li>클라이언트 사이드 라우팅을 통한 새로고침 없는 화면 전환</li>
        <li>URL 쿼리 스트링 매핑을 활용한 실시간 검색 상태 동기화</li>
      </ul>
    </div>

    <div class="description-box">
      <h4>⚙️ 어떻게 작동하나요?</h4>
      <ol>
        <li>
          <strong>도시 검색</strong> — 도시 이름을 입력하면, 먼저 OpenWeather의
          <strong>Geocoding API</strong>를 호출해 해당 도시의 위도·경도 좌표와 현지어
          이름을 조회합니다.
        </li>
        <li>
          <strong>날씨 조회</strong> — 확보한 좌표를 바탕으로
          <strong>Current Weather API</strong>를 호출하여 실시간 기온, 습도, 구름양,
          풍속, 날씨 상태 등의 데이터를 가져옵니다.
        </li>
        <li>
          <strong>카드 렌더링</strong> — 받아온 데이터를 Vue의 반응형 상태에 저장하고,
          도시별로 카드 UI를 자동 생성합니다. 기온에 따라 "더움 / 선선함" 배지가,
          온도·습도 조합에 따라 기분 표현 문구가 함께 표시됩니다.
        </li>
        <li>
          <strong>저장 및 삭제</strong> — 등록한 도시 목록은 브라우저의
          <code>localStorage</code>에 저장되어, 새로고침해도 유지됩니다. 카드의 삭제
          버튼으로 언제든 목록에서 제거할 수 있습니다.
        </li>
      </ol>
    </div>

    <div class="description-box">
      <h4>🛠️ 어떻게 만들어졌나요?</h4>
      <ul>
        <li><strong>프레임워크</strong>: Vue 3 (Composition API, <code>&lt;script setup&gt;</code>)</li>
        <li><strong>라우팅</strong>: Vue Router 4로 대시보드 / 소개 페이지 전환</li>
        <li><strong>데이터 소스</strong>: OpenWeather Geocoding API + Current Weather API</li>
        <li><strong>상태 저장</strong>: 브라우저 <code>localStorage</code></li>
        <li><strong>스타일링</strong>: 커스텀 CSS + 다크모드/라이트모드 토글 (CSS 변수 기반)</li>
        <li><strong>빌드 도구</strong>: Vite</li>
      </ul>
    </div>

    <div class="description-box note-box">
      <p>
        📌 본 프로젝트는 Vue 3 학습을 목적으로 제작된 실습용 애플리케이션입니다. 날씨
        데이터는 OpenWeather의 무료 API를 사용하고 있으며, 실제 서비스 운영 목적이
        아닌 프론트엔드 기술 학습을 위한 예제입니다.
      </p>
    </div>

    <button @click="handleGoHome" class="home-btn">대시보드 홈으로 이동</button>
  </div>
</template>

<style scoped>
.description-box {
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  line-height: 1.5;
  font-size: 14px;
  margin-bottom: 12px;
}

.description-box h4 {
  margin: 0 0 8px 0;
  font-size: 15px;
}

.note-box {
  background-color: #fff9db;
}

ul,
ol {
  padding-left: 20px;
  margin: 8px 0 0 0;
}

li {
  margin-bottom: 6px;
  color: #555;
}

code {
  background-color: #ffeaa7;
  padding: 2px 4px;
  border-radius: 4px;
  color: #d63031;
}

.home-btn {
  width: 100%;
  margin-top: 15px;
  padding: 10px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
</style>