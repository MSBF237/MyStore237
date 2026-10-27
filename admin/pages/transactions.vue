<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { auditService } from '~/services/audit'
import { useLanguage } from '~/utils/i18n'

definePageMeta({ roles: ['admin', 'viewer'] })
const { t } = useLanguage()
const data = useDataStore()
const auth = useAuthStore()
const toast = useToast()
const loading = ref(true)
const { error: loadError } = await useAsyncData('transactions-data', async () => {
  await data.loadAll()
  await auditService.record({ userId: auth.user?.id ?? 'unknown', action: 'viewed', target: 'transactions' })
  return true
})
loading.value = false
onMounted(() => {
  if (loadError.value) {
    toast.add({ severity: 'error', summary: 'Could not load transactions', detail: data.error ?? loadError.value.message, life: 4000 })
  }
})
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>{{ t('transactions') }}</h1><p class="muted">{{ t('transactionSubtitle') }}</p></div></div>
    <ProgressSpinner v-if="loading" aria-label="Loading transactions" />
    <Message v-else-if="data.error" severity="error">{{ data.error }}</Message>
    <section v-else class="card table-wrap">
      <DataTable :value="data.transactions" paginator :rows="5" data-key="id">
        <Column field="id" header="Transaction" sortable />
        <Column field="orderId" header="Order" sortable />
        <Column field="date" header="Date" sortable />
        <Column field="amount" header="Amount (GHS)" sortable />
        <Column field="method" header="Method" sortable />
        <Column field="status" header="Status" sortable />
      </DataTable>
      <TrendChart title="Transaction totals" :labels="['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :values="[800, 620, 940, 700, 1100, 860, 1250]" />
    </section>
  </div>
</template>
