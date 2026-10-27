<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { auditService } from '~/services/audit'
import { notificationService } from '~/services/notifications'
import { useLanguage } from '~/utils/i18n'

definePageMeta({ roles: ['admin', 'partner', 'viewer'] })
const { t } = useLanguage()
const data = useDataStore()
const auth = useAuthStore()
const toast = useToast()
const loading = ref(true)

const { error: loadError } = await useAsyncData('dashboard-data', async () => {
  await data.loadAll()
  await auditService.record({ userId: auth.user?.id ?? 'unknown', action: 'viewed', target: 'dashboard' })
  return true
})
loading.value = false
onMounted(() => {
  if (loadError.value) {
    toast.add({ severity: 'error', summary: 'Could not load dashboard', detail: data.error ?? loadError.value.message, life: 4000 })
  }
})

const revenue = computed(() => data.transactions.reduce((sum, transaction) => sum + transaction.amount, 0))
async function sendTestNotice() {
  toast.add({ severity: 'info', summary: 'Sending test notification…', life: 1000 })
  try {
    await notificationService.notify('email', 'Dashboard test notification')
    toast.add({ severity: 'success', summary: 'Notification queued', detail: 'Mock notification service completed.', life: 2500 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Notification failed', detail: error instanceof Error ? error.message : 'Please retry.', life: 3500 })
  }
}
</script>

<template>
  <div>
    <div class="page-heading">
      <div><h1>{{ t('dashboard') }}</h1><p class="muted">{{ t('businessOverview') }} · mock data</p></div>
      <Button label="Test notification" icon="pi pi-bell" severity="secondary" outlined @click="sendTestNotice" />
    </div>
    <ProgressSpinner v-if="loading" aria-label="Loading dashboard" />
    <Message v-else-if="data.error" severity="error">{{ data.error }}</Message>
    <template v-else>
      <div class="grid stats-grid">
        <section class="card"><span class="muted">Orders</span><strong class="stat-value">{{ data.orders.length }}</strong><small class="muted">Recent sample</small></section>
        <section class="card"><span class="muted">Revenue (GHS)</span><strong class="stat-value">{{ revenue.toLocaleString() }}</strong><small class="muted">Sample transactions</small></section>
        <section class="card"><span class="muted">Products</span><strong class="stat-value">{{ data.products.length }}</strong><small class="muted">Active catalog sample</small></section>
        <section class="card"><span class="muted">Low stock</span><strong class="stat-value">{{ data.products.filter(product => product.stock < 20).length }}</strong><small class="muted">Below 20 units</small></section>
      </div>
      <div class="grid content-grid">
        <TrendChart title="Orders by day" :labels="['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :values="[12, 19, 15, 24, 18, 28, 22]" />
        <section class="card">
          <h2 style="font-size:1.1rem;margin-top:0">{{ t('recentOrders') }}</h2>
          <div class="table-wrap">
            <table><caption class="muted" style="text-align:left;padding-bottom:.5rem">Latest sample orders</caption>
              <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Status</th></tr></thead>
              <tbody><tr v-for="order in data.orders.slice(0, 4)" :key="order.id"><td>{{ order.id }}</td><td>{{ order.customer }}</td><td>{{ order.status }}</td></tr></tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
