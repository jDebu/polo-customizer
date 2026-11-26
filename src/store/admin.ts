import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useStore } from './index'
import { ApiError, backendConfigured, listOrderRows, updateOrderRow } from '../lib/adminApi'
import { notifyStatusChange } from '../lib/telegram'
import { limaDay, normalizeRow, PAID, STATUSES, type AdminOrder, type Status } from '../lib/orderModel'

export type Range = 'today' | '7d' | '30d' | 'all'
export interface Toast { id: number; text: string; tone: 'ok' | 'err'; undo?: () => void }

export const useAdmin = defineStore('admin', () => {
  const main = useStore()
  const orders = ref<AdminOrder[]>([])
  const loading = ref(false)
  const error = ref('')
  const loadedAt = ref<Date | null>(null)
  const busy = reactive<Record<string, boolean>>({})
  const toasts = ref<Toast[]>([])

  const filters = reactive({ status: '' as '' | Status, q: '', range: '30d' as Range, pay: '' })

  async function load(silent = false) {
    if (!backendConfigured) { orders.value = []; error.value = ''; loadedAt.value = new Date(); return }
    if (!silent) loading.value = true
    try {
      const rows = await listOrderRows(main.adminToken)
      orders.value = rows.map(normalizeRow).filter(o => o.id).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      error.value = ''
      loadedAt.value = new Date()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'auth') { main.adminLogout(); location.hash = '#/admin/login'; return }
      error.value = e instanceof Error ? e.message : 'No se pudieron cargar los pedidos'
    } finally {
      loading.value = false
    }
  }

  /* ── Filtros ───────────────────────────────────── */
  const inRange = (o: AdminOrder) => {
    if (filters.range === 'all' || !o.createdAt) return true
    const days = filters.range === 'today' ? 0 : filters.range === '7d' ? 6 : 29
    const from = new Date(); from.setDate(from.getDate() - days)
    return limaDay(o.createdAt) >= limaDay(from)
  }
  const matchesText = (o: AdminOrder) => {
    const q = filters.q.trim().toLowerCase()
    if (!q) return true
    return [o.id, o.name, o.dni, o.phone, o.dept, o.dist].some(v => v.toLowerCase().includes(q))
  }
  /** Sin el filtro de estado: sirve para los contadores de cada pestaña. */
  const base = computed(() => orders.value.filter(o => inRange(o) && matchesText(o) && (!filters.pay || o.payment === filters.pay)))
  const filtered = computed(() => base.value.filter(o => !filters.status || o.status === filters.status))
  const counts = computed(() => {
    const c = Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<Status, number>
    for (const o of base.value) c[o.status]++
    return c
  })
  const pending = computed(() => orders.value.filter(o => o.status === 'pending_validation'))

  /* ── Acciones ──────────────────────────────────── */
  function toast(text: string, tone: Toast['tone'] = 'ok', undo?: () => void) {
    const t: Toast = { id: Date.now() + Math.random(), text, tone, undo }
    toasts.value.push(t)
    setTimeout(() => dismiss(t.id), undo ? 7000 : 4000)
  }
  const dismiss = (id: number) => { toasts.value = toasts.value.filter(t => t.id !== id) }

  /** Cambia el estado en pantalla al instante, confirma con la hoja y revierte si falla. */
  async function setStatus(o: AdminOrder, status: Status, extra: { notes?: string; estimatedDelivery?: string } = {}, label = '') {
    if (busy[o.id]) return
    const prev = { status: o.status, notes: o.notes, est: o.estimatedDelivery, upd: o.updatedAt }
    busy[o.id] = true
    o.status = status; o.updatedAt = new Date()
    if (extra.notes !== undefined) o.notes = extra.notes
    if (extra.estimatedDelivery !== undefined) o.estimatedDelivery = extra.estimatedDelivery
    try {
      await updateOrderRow(main.adminToken, { orderId: o.id, status, ...extra })
      toast(label || 'Estado actualizado', 'ok', status === prev.status ? undefined : () => {
        void setStatus(o, prev.status, { notes: prev.notes, estimatedDelivery: prev.est }, 'Cambio deshecho')
      })
      void notifyStatusChange(o.id, status, o.phone).catch(() => {})
    } catch (e) {
      o.status = prev.status; o.notes = prev.notes; o.estimatedDelivery = prev.est; o.updatedAt = prev.upd
      toast(e instanceof Error ? e.message : 'No se pudo guardar el cambio', 'err')
    } finally {
      busy[o.id] = false
    }
  }

  async function saveNotes(o: AdminOrder, notes: string) {
    if (notes === o.notes) return
    const prev = o.notes
    o.notes = notes
    try {
      await updateOrderRow(main.adminToken, { orderId: o.id, notes })
      toast('Nota guardada')
    } catch (e) {
      o.notes = prev
      toast(e instanceof Error ? e.message : 'No se pudo guardar la nota', 'err')
    }
  }

  async function saveEstimated(o: AdminOrder, value: string) {
    if (value === o.estimatedDelivery) return
    const prev = o.estimatedDelivery
    o.estimatedDelivery = value
    try {
      await updateOrderRow(main.adminToken, { orderId: o.id, estimatedDelivery: value })
      toast('Fecha estimada guardada')
    } catch (e) {
      o.estimatedDelivery = prev
      toast(e instanceof Error ? e.message : 'No se pudo guardar la fecha', 'err')
    }
  }

  return { orders, loading, error, loadedAt, busy, toasts, filters, base, filtered, counts, pending, load, setStatus, saveNotes, saveEstimated, toast, dismiss, PAID }
})
