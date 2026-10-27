<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { auditService } from '~/services/audit'
import { useLanguage } from '~/utils/i18n'

definePageMeta({ roles: ['admin', 'partner', 'viewer'] })
const { t } = useLanguage()
const data = useDataStore()
const auth = useAuthStore()
const toast = useToast()
const loading = ref(true)
const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } })
const { error: loadError } = await useAsyncData('orders-data', async () => {
  await data.loadAll()
  await auditService.record({ userId: auth.user?.id ?? 'unknown', action: 'viewed', target: 'orders' })
  return true
})
loading.value = false
onMounted(() => {
  if (loadError.value) {
    toast.add({ severity: 'error', summary: 'Could not load orders', detail: data.error ?? loadError.value.message, life: 4000 })
  }
})
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>{{ t('orders') }}</h1><p class="muted">{{ t('orderSubtitle') }}</p></div></div>
    <ProgressSpinner v-if="loading" aria-label="Loading orders" />
    <Message v-else-if="data.error" severity="error">{{ data.error }}</Message>
    <section v-else class="card table-wrap">
      <DataTable v-model:filters="filters" :value="data.orders" paginator :rows="5" :rows-per-page-options="[5, 10]" sort-mode="single" :global-filter-fields="['id', 'customer', 'status']" data-key="id">
        <template #header><label for="orders-search">Search orders</label> <InputText id="orders-search" v-model="filters.global.value" placeholder="Search orders" /></template>
        <Column field="id" header="Order" sortable />
        <Column field="customer" header="Customer" sortable />
        <Column field="date" header="Date" sortable />
        <Column field="total" header="Total (GHS)" sortable />
        <Column field="status" header="Status" sortable />
      </DataTable>
      <p class="muted">Sorting and pagination run locally on demo data; connect API query parameters when the backend is ready.</p>
    </section>
  </div>
</template>
