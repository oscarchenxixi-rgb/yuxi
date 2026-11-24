<script setup>
import { computed, nextTick, reactive, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CASES, FIELD_OPTIONS } from '../data/cases'
import { submitSimulationPreview } from '../services/demoCaseService'
import ModalDialog from '../components/ModalDialog.vue'

const route = useRoute()
const router = useRouter()
const requestedCase = computed(() => CASES.find((item) => item.caseId === route.query.case))
const selectedCase = computed(() => requestedCase.value ?? CASES[0])
const selectedCaseId = computed({
  get: () => selectedCase.value.caseId,
  set: (caseId) => router.replace({ query: { ...route.query, case: caseId }, hash: route.hash })
})
const schema = computed(() => selectedCase.value.parameterSchema)
const formElement = useTemplateRef('simulationForm')
const fieldErrors = reactive({})
const hasFieldErrors = computed(() => Object.keys(fieldErrors).length > 0)
const message = ref('')
const toast = ref('')
const submitting = ref(false)
const showResetConfirm = ref(false)
const showPreviewSuccess = ref(false)
let activeSubmission = null
const referenceView = { layer: 'reference', quality: 'balanced' }
const form = reactive({
  presetId: '',
  parameters: {},
  field: 'surfacePressure',
  palette: 'viridis'
})

function defaultsForCurrentCase() {
  const currentSchema = schema.value
  form.presetId = currentSchema?.presets?.[0]?.id ?? ''
  form.parameters = Object.fromEntries((currentSchema?.fields ?? []).map((field) => [field.key, field.defaultValue]))
  form.field = 'surfacePressure'
  form.palette = 'viridis'
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  message.value = ''
  toast.value = ''
}

watch(selectedCaseId, () => {
  activeSubmission = null
  submitting.value = false
  showResetConfirm.value = false
  showPreviewSuccess.value = false
  defaultsForCurrentCase()
}, { immediate: true })

const selectedPresetLabel = computed(() =>
  schema.value?.presets?.find((preset) => preset.id === form.presetId)?.name
)

const hasChanges = computed(() => {
  const s = schema.value
  return form.presetId !== (s?.presets?.[0]?.id ?? '') ||
    (s?.fields ?? []).some((f) => form.parameters[f.key] !== f.defaultValue) ||
    form.field !== 'surfacePressure' || form.palette !== 'viridis'
})

function validateField(item) {
  const value = Number(form.parameters[item.key])
  if (form.parameters[item.key] === '' || !Number.isFinite(value)) {
    fieldErrors[item.key] = '请输入有效数字'
  } else if (value < item.min || value > item.max) {
    fieldErrors[item.key] = `请输入 ${item.min} 至 ${item.max}${item.unit || ''} 之间的数值`
  } else {
    delete fieldErrors[item.key]
  }
}

function snapToStep(item) {
  validateField(item)
  if (fieldErrors[item.key]) return
  const current = Number(form.parameters[item.key])
  const steps = Math.round((current - item.min) / item.step)
  const raw = item.min + steps * item.step
  const precision = (String(item.step).split('.')[1] || '').length
  const corrected = Math.max(item.min, Math.min(item.max, Number(raw.toFixed(precision))))
  if (Math.abs(current - corrected) > 1e-9) {
    form.parameters[item.key] = corrected
    toast.value = `${item.label}已按步长 ${item.step} 修正`
  }
}

function validate() {
  message.value = ''
  toast.value = ''
  if (!schema.value?.presets?.some((p) => p.id === form.presetId)) message.value = '请选择有效工况预设。'
  for (const item of schema.value?.fields ?? []) snapToStep(item)
  return !message.value && !hasFieldErrors.value
}

function requestReset() {
  if (!hasChanges.value) return defaultsForCurrentCase()
  showResetConfirm.value = true
}
function applyReset() { defaultsForCurrentCase(); showResetConfirm.value = false }
async function submit() {
  if (submitting.value) return
  if (!validate()) {
    await nextTick()
    formElement.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }

  const payload = {
    caseId: selectedCaseId.value,
    presetId: form.presetId,
    parameters: { ...form.parameters },
    view: { ...referenceView, field: form.field, palette: form.palette }
  }
  const submission = Symbol()
  activeSubmission = submission
  submitting.value = true
  try {
    await submitSimulationPreview(payload)
    if (activeSubmission === submission) showPreviewSuccess.value = true
  } catch (error) {
    if (activeSubmission === submission) {
      message.value = error?.message || '演示配置验证失败，请重试。'
    }
  } finally {
    if (activeSubmission === submission) {
      activeSubmission = null
      submitting.value = false
    }
  }
}
</script>

<template>
  <main>
    <div class="page-top container"><div class="eyebrow">SIMULATION DEMO</div><h1>仿真演示配置</h1><p>选择案例，配置演示参数和初始显示设置，再验证表单。</p></div>
    <section class="container section compact-top">
      <div class="simulation-grid">
        <form ref="simulationForm" class="form-card" :aria-busy="submitting" @submit.prevent="submit" novalidate>
          <div class="form-section">
            <h2>选择案例</h2>
            <label class="form-field">
              案例编号
              <select v-model="selectedCaseId" :disabled="submitting">
                <option v-for="c in CASES" :key="c.caseId" :value="c.caseId">{{ c.name }} · {{ c.levelText }}</option>
              </select>
            </label>
            <p v-if="route.query.case !== undefined && !requestedCase" class="notice warning">链接中的案例编号无效，已显示 {{ selectedCase.name }}。</p>
            <p class="muted small">{{ selectedCase.description }}</p>
          </div>
          <div class="form-section"><h2>工况预设与演示参数</h2><label class="form-field"><span>工况预设</span><select v-model="form.presetId" :disabled="submitting" :aria-invalid="!!message && !selectedPresetLabel"><option v-for="preset in schema?.presets || []" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select></label>
            <div v-for="item in schema?.fields || []" :key="item.key" class="parameter-field">
              <div class="parameter-head">
                <label :id="`${item.key}-label`" :for="`${item.key}-number`">{{ item.label }}</label>
                <span :id="`${item.key}-bounds`">{{ item.min }} – {{ item.max }} {{ item.unit }}</span>
              </div>
              <div class="range-row">
                <input v-model.number="form.parameters[item.key]" type="range" :min="item.min" :max="item.max" :step="item.step" :disabled="submitting" :aria-labelledby="`${item.key}-label`" @change="validateField(item)" />
                <input :id="`${item.key}-number`" v-model.number="form.parameters[item.key]" class="number-input" type="number" :min="item.min" :max="item.max" :step="item.step" :disabled="submitting" :aria-invalid="!!fieldErrors[item.key]" :aria-describedby="fieldErrors[item.key] ? `${item.key}-error` : `${item.key}-bounds`" @input="fieldErrors[item.key] && validateField(item)" />
              </div>
              <p v-if="fieldErrors[item.key]" :id="`${item.key}-error`" class="input-error">{{ fieldErrors[item.key] }}</p>
            </div>
            <p v-if="!(schema?.fields?.length)" class="notice warning">该案例尚无参数 schema，请先让数据组提供相应字段。</p>
            <div v-if="schema?.demoOnly" class="notice warning">当前案例已接入 CFD 参考结果。上方预设和滑块仅用于演示配置流程，调整后不会改变已保存的压力和速度结果。</div>
          </div>
          <div class="form-section"><h2>初始显示设置</h2><p class="muted small">三维预览使用固定采样的 CFD 参考点云。</p><div class="two-columns"><label class="form-field"><span>初始物理场</span><select v-model="form.field" :disabled="submitting"><option v-for="f in FIELD_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}（{{ f.unit }}）</option></select></label><label class="form-field"><span>调色板</span><select v-model="form.palette" :disabled="submitting"><option value="viridis">Viridis</option><option value="turbo">Turbo</option><option value="coolwarm">Coolwarm</option></select></label></div></div>
          <div class="notice">当前为静态数据驱动的流程演示，提交参数不会触发真实 CFD 或模型计算。</div>
          <div v-if="message || hasFieldErrors" class="notice error" role="alert">{{ message || '参数存在错误，请检查标红的输入框。' }}</div>
          <div v-if="toast" class="notice" role="status">{{ toast }} <button type="button" class="link-button" @click="toast = ''">关闭</button></div>
          <div class="form-actions"><button type="button" class="btn btn-secondary" :disabled="submitting" @click="requestReset">重置</button><button type="submit" class="btn btn-primary" :disabled="submitting"><span v-if="submitting" class="spinner"></span>{{ submitting ? '正在验证演示配置…' : '验证并模拟提交（联调模式）' }}</button></div>
        </form>
        <aside class="summary-card"><div class="eyebrow">SUMMARY</div><h2>参数摘要</h2><dl><dt>案例</dt><dd>{{ selectedCase.name }}</dd><dt>工况预设</dt><dd>{{ selectedPresetLabel ?? '未选择' }}</dd><template v-for="item in schema?.fields || []" :key="item.key"><dt>{{ item.label }}</dt><dd>{{ form.parameters[item.key] === '' ? '未填写' : form.parameters[item.key] }} {{ item.unit }}</dd></template><dt>物理场</dt><dd>{{ FIELD_OPTIONS.find((f) => f.value === form.field)?.label }}</dd><dt>数据层</dt><dd>参考值</dd><dt>采样</dt><dd>固定采样</dd><dt>调色板</dt><dd>{{ form.palette }}</dd></dl><RouterLink :to="{ name: 'case-detail', params: { caseId: selectedCaseId } }" class="text-link">查看当前案例 →</RouterLink></aside>
      </div>
    </section>
    <ModalDialog :open="showResetConfirm" label="重置确认" @close="showResetConfirm = false">
      <h2>确定重置参数？</h2>
      <p>当前案例的演示参数和显示设置将恢复默认值。</p>
      <div class="right action-gap">
        <button type="button" class="btn btn-secondary" @click="showResetConfirm = false">取消</button>
        <button type="button" class="btn btn-primary" @click="applyReset">确认重置</button>
      </div>
    </ModalDialog>
    <ModalDialog :open="showPreviewSuccess" label="演示验证结果" @close="showPreviewSuccess = false">
      <h2>表单验证通过</h2>
      <p>当前版本仅验证前端配置。任务服务接入后，才会创建任务并显示结果。</p>
      <div class="right action-gap">
        <button type="button" class="btn btn-secondary" @click="showPreviewSuccess = false">关闭</button>
        <RouterLink class="btn btn-primary" :to="{ path: '/visualization', query: { case: selectedCaseId, field: form.field, palette: form.palette } }">查看三维预览</RouterLink>
      </div>
    </ModalDialog>
  </main>
</template>
