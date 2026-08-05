<template>
  <div ref="switchArea" class="theme-switch">
    <el-switch
      :model-value="isDark"
      inline-prompt
      active-text="🌙"
      inactive-text="☀️"
      aria-label="색상 모드 전환"
      @change="changeTheme"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const root = document.documentElement
const isDark = ref(root.classList.contains('dark'))
const switchArea = ref(null)

function applyTheme(dark) {
  isDark.value = dark

  // Element Plus 다크 모드
  root.classList.toggle('dark', dark)

  // 기존 exercise.css의 [data-theme='dark'] 스타일 지원
  if (dark) {
    root.setAttribute('data-theme', 'dark')
  } else {
    root.removeAttribute('data-theme')
  }

  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

async function changeTheme(value) {
  const nextDark = value === true

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  if (
    typeof document.startViewTransition !== 'function' ||
    reduceMotion
  ) {
    applyTheme(nextDark)
    return
  }

  const rect = switchArea.value?.getBoundingClientRect()

  const x = rect
    ? rect.left + rect.width / 2
    : window.innerWidth / 2

  const y = rect
    ? rect.top + rect.height / 2
    : window.innerHeight / 2

  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  const transition = document.startViewTransition(() => {
    applyTheme(nextDark)
  })

  try {
    await transition.ready

    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 500,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)',
      },
    )
  } catch {
    // 애니메이션이 취소돼도 테마는 전환됩니다.
  }
}

onMounted(() => {
  applyTheme(root.classList.contains('dark'))
})
</script>
