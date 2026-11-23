<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 })

const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  rotate: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  flip: 'M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z',
  center: 'M12 3v4M12 17v4M3 12h4M17 12h4M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  ruler: 'M3 16L16 3l5 5L8 21 3 16zM7 12l2 2M10 9l2 2M13 6l2 2',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.01',
  layout: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  split: 'M3 4h18v16H3zM12 4v16',
  shirt: 'M8 3l-5 3 2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z',
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path :d="PATHS[name] ?? ''" />
  </svg>
</template>
