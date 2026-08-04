pwd
# 하늘결 (SKALA Weather Project)

OpenWeather API를 이용해 현재 위치와 검색한 도시의 실시간 날씨를 확인할 수 있는 Vue 3 기반 날씨 웹 애플리케이션입니다.

- 실행 페이지: [https://kimdohyun23.github.io/skala-weatherproject/](https://kimdohyun23.github.io/skala-weatherproject/)

## 주요 구현 방식

| 사용 방식 | 구현 내용 |
| --- | --- |
| Vue Router | 실시간 대시보드(`/dashboard`), 3D 지구 날씨(`/earth`), 서비스 소개(`/about`)를 각각의 페이지로 분리했습니다. GitHub Pages 새로고침 오류를 방지하기 위해 해시 라우팅을 사용했습니다. |
| Pinia Store | 섭씨·화씨 단위를 전역 상태로 관리하여 모든 날씨 화면의 온도 단위를 동시에 변경하도록 구현했습니다. 선택한 단위는 `localStorage`에 저장됩니다. |
| Composition API | `ref`, `reactive`, `computed`, `watch`를 이용해 날씨 데이터, 선택 도시, 로딩 상태, 지구본 회전과 확대 상태를 반응형으로 관리했습니다. |
| Composable | `useWeather`에 날씨 조회, 위치 동의, 로딩 및 오류 처리를 모아 여러 화면에서 같은 날씨 로직을 사용할 수 있도록 분리했습니다. |
| OpenWeather API | 현재 날씨, 대기 오염, 역지오코딩 데이터를 조회해 온도, 체감온도, 습도, 풍속, 미세먼지 등을 표시했습니다. |
| Geocoding API | 한글 또는 영문 도시명을 위도·경도로 변환한 뒤 해당 도시의 날씨를 조회하도록 구현했습니다. |
| Geolocation API | 첫 방문 시 사용자 동의를 받은 후 브라우저의 현재 위치를 이용해 주변 날씨를 표시합니다. 위치 권한을 거부하면 서울 날씨를 보여줍니다. |
| localStorage | 최대 5개의 관심 도시, 섭씨·화씨 설정, 화면 테마를 저장하여 새로고침 후에도 유지되도록 구현했습니다. |
| Canvas 2D | NASA Blue Marble 이미지를 구면 좌표로 투영해 회전과 확대가 가능한 지구본을 만들고, 도시 마커 선택과 날씨 조회 기능을 연결했습니다. |
| GitHub Actions | `main` 브랜치에 코드가 올라오면 Vite 프로젝트를 자동으로 빌드하여 GitHub Pages에 배포하도록 구성했습니다. |

## 페이지 구성

- **실시간 대시보드**: 현재 위치 날씨, 도시 검색, 관심 도시 추가·삭제, 최대 5개 도시 저장
- **지구의 날씨**: 지구본 드래그 회전, 스크롤 확대, 세계 주요 도시 선택 및 날씨 확인
- **서비스 소개**: 하늘결의 주요 기능과 사용 방법 안내

## 실행 방법

```sh
npm install
npm run dev
```

프로젝트 루트의 `.env` 파일에 OpenWeather API 키를 설정해야 실시간 데이터를 조회할 수 있습니다.

```env
VITE_OPENWEATHER_API_KEY=발급받은_API_KEY
```

프로덕션 빌드는 다음 명령으로 확인할 수 있습니다.

```sh
npm run build
```
