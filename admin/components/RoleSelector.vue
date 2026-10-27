<script setup lang="ts">
import type { UserRole } from '~/types/domain'

defineProps<{
  modelValue: UserRole
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: UserRole]
}>()
</script>

<template>
  <div class="field">
    <label for="role">Demo role</label>
    <select id="role" :value="modelValue" class="form-control" aria-describedby="role-error" :aria-invalid="Boolean(error)" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as UserRole)">
      <option value="admin">Admin</option>
      <option value="partner">Partner</option>
      <option value="viewer">Viewer</option>
    </select>
    <span v-if="error" id="role-error" class="field-error" role="alert">{{ error }}</span>
  </div>
</template>
