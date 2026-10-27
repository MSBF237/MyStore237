<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { auditService } from '~/services/audit'
import { storageService } from '~/services/storage'
import { productSchema } from '~/utils/validation'
import { useLanguage } from '~/utils/i18n'

definePageMeta({ roles: ['admin', 'partner'] })
const { t } = useLanguage()
const data = useDataStore()
const auth = useAuthStore()
const toast = useToast()
const loading = ref(true)
const preview = ref<string | null>(null)
const form = reactive({ name: '', sku: '', price: 0, stock: 0 })
const errors = reactive<Record<string, string | undefined>>({})
const { error: loadError } = await useAsyncData('products-data', () => data.loadAll())
loading.value = false
onMounted(() => {
  if (loadError.value) {
    toast.add({ severity: 'error', summary: 'Could not load products', detail: data.error ?? loadError.value.message, life: 4000 })
  }
})
async function selectFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const uploaded = await storageService.upload(file)
    if (preview.value) URL.revokeObjectURL(preview.value)
    preview.value = uploaded.previewUrl
    toast.add({ severity: 'success', summary: 'Image preview ready', detail: uploaded.name, life: 2500 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Image rejected', detail: error instanceof Error ? error.message : 'Choose another file.', life: 3500 })
  }
}
async function submit() {
  const result = productSchema.safeParse(form)
  Object.assign(errors, { name: undefined, sku: undefined, price: undefined, stock: undefined })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      if (typeof field === 'string' && !errors[field]) errors[field] = issue.message
    }
    return
  }
  toast.add({ severity: 'info', summary: 'Submitting product…', life: 1000 })
  try {
    await auditService.record({ userId: auth.user?.id ?? 'unknown', action: 'submitted', target: 'product-form' })
    toast.add({ severity: 'success', summary: 'Product form validated', detail: 'Connect the product API to save this item.', life: 3500 })
    Object.assign(form, { name: '', sku: '', price: 0, stock: 0 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Could not record action', detail: error instanceof Error ? error.message : 'Please retry.', life: 3500 })
  }
}
onBeforeUnmount(() => { if (preview.value) URL.revokeObjectURL(preview.value) })
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>{{ t('products') }}</h1><p class="muted">{{ t('productSubtitle') }}</p></div></div>
    <ProgressSpinner v-if="loading" aria-label="Loading products" />
    <Message v-else-if="data.error" severity="error">{{ data.error }}</Message>
    <div v-else class="grid content-grid">
      <section class="card table-wrap">
        <DataTable :value="data.products" paginator :rows="5" data-key="id">
          <Column field="name" header="Product" sortable />
          <Column field="sku" header="SKU" sortable />
          <Column field="stock" header="Stock" sortable />
          <Column field="price" header="Price (GHS)" sortable />
        </DataTable>
      </section>
      <section class="card">
        <h2 style="font-size:1.1rem;margin-top:0">Add product (demo)</h2>
        <form @submit.prevent="submit">
          <div class="field"><label for="product-name">Name</label><InputText id="product-name" v-model="form.name" aria-describedby="name-error" :aria-invalid="Boolean(errors.name)" /><small id="name-error" class="field-error" role="alert">{{ errors.name }}</small></div>
          <div class="field"><label for="product-sku">SKU</label><InputText id="product-sku" v-model="form.sku" aria-describedby="sku-error" :aria-invalid="Boolean(errors.sku)" /><small id="sku-error" class="field-error" role="alert">{{ errors.sku }}</small></div>
          <div class="field"><label for="product-price">Price (GHS)</label><InputNumber id="product-price" v-model="form.price" :min="0.01" aria-describedby="price-error" :aria-invalid="Boolean(errors.price)" /><small id="price-error" class="field-error" role="alert">{{ errors.price }}</small></div>
          <div class="field"><label for="product-stock">Stock</label><InputNumber id="product-stock" v-model="form.stock" :min="0" :min-fraction-digits="0" :max-fraction-digits="0" aria-describedby="stock-error" :aria-invalid="Boolean(errors.stock)" /><small id="stock-error" class="field-error" role="alert">{{ errors.stock }}</small></div>
          <div class="field"><label for="product-image">Product image (JPG, PNG or WebP; max 5 MB)</label><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" @change="selectFile"></div>
          <img v-if="preview" class="upload-preview" :src="preview" alt="Selected product image preview">
          <Button type="submit" label="Validate product" />
        </form>
      </section>
      <TrendChart title="Product performance (units sold)" :labels="data.products.map(product => product.name)" :values="[68, 54, 81]" />
    </div>
  </div>
</template>
