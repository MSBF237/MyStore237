<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{ title: string; labels: string[]; values: number[] }>()
const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{ label: props.title, backgroundColor: '#3157d5', borderRadius: 5, data: props.values }],
}))
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
}
</script>

<template>
  <section class="card">
    <h2 style="font-size:1.1rem;margin-top:0">{{ title }}</h2>
    <div style="height:240px">
      <ClientOnly>
        <Bar :data="chartData" :options="chartOptions" :aria-label="title" role="img" />
        <template #fallback><p class="muted">Chart loads in your browser.</p></template>
      </ClientOnly>
    </div>
    <p class="muted">Illustrative mock data</p>
    <details>
      <summary>View chart data</summary>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Category</th><th scope="col">Value</th></tr></thead>
          <tbody><tr v-for="(label, index) in labels" :key="label"><th scope="row">{{ label }}</th><td>{{ values[index] }}</td></tr></tbody>
        </table>
      </div>
    </details>
  </section>
</template>
