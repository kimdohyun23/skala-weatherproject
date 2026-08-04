import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'weather-temperature-unit'

export const useConfigStore = defineStore('config', () => {
  const savedUnit = localStorage.getItem(STORAGE_KEY)
  const unit = ref(savedUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius')

  const unitSymbol = computed(() => (unit.value === 'celsius' ? '℃' : '℉'))
  const unitName = computed(() => (unit.value === 'celsius' ? '섭씨' : '화씨'))

  function toggleUnit() {
    unit.value = unit.value === 'celsius' ? 'fahrenheit' : 'celsius'
    localStorage.setItem(STORAGE_KEY, unit.value)
  }

  function convertTemperature(celsius) {
    return unit.value === 'celsius' ? celsius : (celsius * 9) / 5 + 32
  }

  function formatTemperature(celsius) {
    return `${Math.round(convertTemperature(celsius))}°`
  }

  return {
    unit,
    unitSymbol,
    unitName,
    toggleUnit,
    convertTemperature,
    formatTemperature,
  }
})
