<script setup lang="ts">
import { computed, ref } from 'vue'

type Stock = {
  quantity: number
  capacity: number
  reserved: number
}

const props = defineProps<{
  inventory: Record<string, Stock>
  cargo: Array<{ id: string; label: string; unit: string }>
}>()

const emit = defineEmits<{
  add: [itemId: string, amount: number]
  remove: [itemId: string, amount: number]
}>()

const selectedId = ref(props.cargo[0]?.id ?? '')
const amount = ref(10)
const selectedStock = computed(() => props.inventory[selectedId.value])

function submit(direction: 'add' | 'remove') {
  const safeAmount = Math.max(1, Math.floor(amount.value || 0))
  emit(direction, selectedId.value, safeAmount)
}
</script>

<template>
  <section class="harbor-warehouse">
    <header>
      <p class="eyebrow">Vue module</p>
      <h2>Hafenlager</h2>
      <p>Wiederverwendbare Lagersteuerung für ein separates Vue-Admin-Panel.</p>
    </header>

    <label>
      Ware
      <select v-model="selectedId">
        <option v-for="item in cargo" :key="item.id" :value="item.id">
          {{ item.label }}
        </option>
      </select>
    </label>

    <div v-if="selectedStock" class="warehouse-summary">
      {{ selectedStock.quantity.toLocaleString('de-DE') }} / {{ selectedStock.capacity.toLocaleString('de-DE') }}
    </div>

    <label>
      Menge
      <input v-model.number="amount" type="number" min="1" />
    </label>

    <div class="warehouse-actions">
      <button type="button" @click="submit('remove')">Entnehmen</button>
      <button type="button" @click="submit('add')">Einlagern</button>
    </div>
  </section>
</template>