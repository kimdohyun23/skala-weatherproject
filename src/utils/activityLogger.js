const PRIVATE_KEYS = /^(lat|lon|latitude|longitude|coords|coordinates|position|geolocation|location|api[_-]?key|appid)$/i

function removePrivateData(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (seen.has(value)) return '[순환 데이터]'

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => removePrivateData(item, seen))
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_KEYS.test(key))
      .map(([key, item]) => [key, removePrivateData(item, seen)]),
  )
}

function print(level, category, message, details) {
  const time = new Date().toLocaleTimeString('ko-KR')
  const prefix = `[하늘결 · ${category}] ${time} — ${message}`
  const safeDetails = removePrivateData(details)

  if (safeDetails === undefined) {
    console[level](prefix)
    return
  }

  console[level](prefix, safeDetails)
}

export const activityLogger = {
  info(category, message, details) {
    print('log', category, message, details)
  },
  success(category, message, details) {
    print('info', category, `✅ ${message}`, details)
  },
  warn(category, message, details) {
    print('warn', category, `⚠️ ${message}`, details)
  },
  error(category, message, details) {
    print('error', category, `❌ ${message}`, details)
  },
}

function getElementLabel(element) {
  return (
    element.dataset.activityLabel ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.textContent?.replace(/\s+/g, ' ').trim() ||
    element.tagName.toLowerCase()
  ).slice(0, 100)
}

export function installActivityLogger(router) {
  const searchTimers = new WeakMap()

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return

    const target = event.target.closest('button, a, [role="button"], [data-activity-click]')
    if (!target || target.closest('[data-activity-ignore]')) return

    activityLogger.info('클릭', '사용자 클릭', {
      element: target.tagName.toLowerCase(),
      label: getElementLabel(target),
      path: window.location.pathname,
    })
  })

  document.addEventListener('input', (event) => {
    if (!(event.target instanceof HTMLInputElement)) return
    if (!event.target.matches('[data-activity-search]')) return
    if (event.isComposing) return

    const input = event.target
    window.clearTimeout(searchTimers.get(input))

    const timer = window.setTimeout(() => {
      activityLogger.info('검색어', '검색어 입력', {
        query: input.value.trim(),
      })
      searchTimers.delete(input)
    }, 400)

    searchTimers.set(input, timer)
  })

  document.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement)) return
    if (event.target.closest('[data-activity-ignore]')) return

    activityLogger.info('폼', '폼 제출', {
      name: event.target.getAttribute('name') || event.target.className || '이름 없음',
    })
  })

  router.beforeEach((to, from) => {
    activityLogger.info('페이지', '페이지 이동 시작', {
      from: from.fullPath || '(첫 진입)',
      to: to.fullPath,
    })
  })

  router.afterEach((to) => {
    activityLogger.success('페이지', '페이지 이동 완료', {
      page: to.name || '이름 없음',
      path: to.fullPath,
    })
  })

  router.onError((error) => {
    activityLogger.error('페이지', '페이지 이동 실패', {
      message: error.message,
    })
  })
}
