<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CASES, FIELD_OPTIONS } from '../data/cases'
import { isSyntheticDemo, loadReferenceRange, referenceCaseIds, supportsPointField, syntheticCaseId } from '../data/case0577Cfd.js'

const FlowScene = defineAsyncComponent(() => import('../components/FlowScene.vue'))
const route = useRoute()
const router = useRouter()
function updateQuery(name, value) {
  router.replace({ query: { ...route.query, [name]: value }, hash: route.hash })
}
const requestedCaseId = computed({
  get: () => route.query.case,
  set: (caseId) => updateQuery('case', caseId),
})
const referenceCase = computed(() => CASES.find((item) => item.caseId === requestedCaseId.value))
const syntheticDemo = computed(() => isSyntheticDemo(route.query))
const referenceDemo = computed(() => !syntheticDemo.value && referenceCaseIds.includes(referenceCase.value?.caseId))
const datasetId = computed(() => {
  if (syntheticDemo.value) return syntheticCaseId
  return referenceDemo.value ? referenceCase.value.caseId : ''
})
const availableFields = computed(() => FIELD_OPTIONS.filter(({ value }) =>
  datasetId.value ? supportsPointField(datasetId.value, value) : value === 'speed' || value === 'surfacePressure'
))
const fieldId = computed({
  get: () => availableFields.value.find((option) => option.value === route.query.field)?.value ?? 'surfacePressure',
  set: (value) => updateQuery('field', value),
})
const playing = ref(true)
const palette = computed({
  get: () => ['viridis', 'turbo', 'coolwarm'].includes(route.query.palette) ? route.query.palette : 'viridis',
  set: (value) => updateQuery('palette', value),
})
const cameraView = ref('perspective')
const pointSize = ref('medium')
const qualityMap = { fast: 'smooth', smooth: 'smooth', balanced: 'balanced', fine: 'fine' }
const quality = computed({
  get: () => Object.hasOwn(qualityMap, route.query.quality) ? qualityMap[route.query.quality] : 'balanced',
  set: (value) => updateQuery('quality', value),
})
const layerMap = { reference: 'reference', prediction: 'prediction', error: 'error', absoluteError: 'error' }
const layer = computed({
  get: () => {
    if (datasetId.value) return 'reference'
    return Object.hasOwn(layerMap, route.query.layer) ? layerMap[route.query.layer] : 'prediction'
  },
  set: (value) => updateQuery('layer', value === 'error' ? 'absoluteError' : value),
})
const compareMode = ref(false)
const showComparison = computed(() => !datasetId.value && compareMode.value)
const scaleMode = computed({
  get: () => route.query.scale === 'shared' ? 'shared' : 'auto',
  set: (value) => updateQuery('scale', value === 'shared' ? 'shared' : undefined),
})
const dataRange = ref(null)
const sharedRange = ref(null)
const rangeStatus = ref('')
const displayedRange = computed(() => dataRange.value && (sharedRange.value ?? dataRange.value))
const rangeNumber = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 8, useGrouping: false })
const viewer = ref(null)
const sceneRefs = ref([])
const hoveredPoint = ref(null)
const selectedPoint = ref(null)
const cameraSync = ref(null)
const syncSource = ref('')
const fullscreen = ref(false)

const syntheticLabel = '合成演示数据'
const caseLabel = computed(() => syntheticDemo.value ? syntheticCaseId : referenceCase.value?.name ?? '程序生成样例')
const currentField = computed(() => FIELD_OPTIONS.find((item) => item.value === fieldId.value) || FIELD_OPTIONS[0])
const fieldKey = computed(() => fieldId.value.includes('Pressure') ? 'pressure' : 'speed')
const currentPoint = computed(() => selectedPoint.value || hoveredPoint.value)
const layerLabel = computed(() => ({ reference: '参考值', prediction: '预测值', error: '绝对误差' })[layer.value])
const qualityLabel = computed(() => ({ smooth: '流畅 · 1,800 点', balanced: '均衡 · 12,000 点', fine: '精细 · 40,000 点' })[quality.value])
const layers = [{ id: 'reference', title: '参考值' }, { id: 'prediction', title: '预测值' }, { id: 'error', title: '绝对误差' }]
const cameraViews = [{ id: 'perspective', text: '透视' }, { id: 'front', text: '正视' }, { id: 'top', text: '俯视' }, { id: 'side', text: '侧视' }]
const sizes = [{ id: 'small', text: '小' }, { id: 'medium', text: '中' }, { id: 'large', text: '大' }]
const paletteStops = {
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  turbo: ['#30123b', '#466be3', '#1bcfd4', '#7df657', '#f9c932', '#ef5a24', '#7a0403'],
  coolwarm: ['#3b4cc0', '#829fca', '#dddddd', '#d6604d', '#b40426'],
}
const legendStyle = computed(() => ({ background: `linear-gradient(90deg, ${paletteStops[palette.value].join(', ')})` }))

watch(showComparison, () => {
  sceneRefs.value = []
  cameraSync.value = null
  syncSource.value = ''
  clearPoint()
})
watch([fieldId, layer, quality, () => route.query.case, syntheticDemo], clearPoint)
watch([referenceDemo, fieldId, scaleMode], async ([reference, field, mode], _, onCleanup) => {
  sharedRange.value = null
  rangeStatus.value = ''
  if (!reference || mode !== 'shared') return

  let active = true
  onCleanup(() => { active = false })
  rangeStatus.value = '正在加载三个案例的统一量程…'
  const range = await loadReferenceRange(field).catch(() => null)
  if (!active) return
  sharedRange.value = range
  rangeStatus.value = range ? '' : '统一量程暂不可用，当前使用本案例量程。'
}, { immediate: true })

function setSceneRef(el, index) { sceneRefs.value[index] = el }
function resetView() { cameraView.value = 'perspective'; sceneRefs.value.forEach((scene) => scene?.resetView()) }
function syncCamera(state) { cameraSync.value = state; syncSource.value = state.source }
function clearPoint() { selectedPoint.value = null; hoveredPoint.value = null }
function stopAutoRotate() { playing.value = false }
function onKeyDown(event) { if (event.key === 'Escape') { clearPoint(); if (document.fullscreenElement) document.exitFullscreen?.() } }
function onFullscreenChange() { fullscreen.value = Boolean(document.fullscreenElement) }
async function toggleFullscreen() {
  if (!viewer.value) return
  if (document.fullscreenElement) await document.exitFullscreen?.()
  else await viewer.value.requestFullscreen?.()
}
onMounted(() => { document.addEventListener('keydown', onKeyDown); document.addEventListener('fullscreenchange', onFullscreenChange) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('fullscreenchange', onFullscreenChange) })
</script>

<template>
  <main class="visualization-page">
    <section class="visualization-heading">
      <div>
        <div class="visualization-eyebrow">PIPE FLOW · INTERACTIVE RESULT</div>
        <div class="title-row"><h1>三维流场可视化</h1><span class="demo-badge">{{ syntheticDemo ? syntheticLabel : referenceDemo ? 'CFD 参考数据' : '示意数据' }}</span></div>
        <p>{{ caseLabel }} · {{ currentField.label }} · {{ layerLabel }}。</p>
      </div>
      <div class="case-summary">
        <span>{{ referenceDemo ? referenceCase.levelText : '联调' }}</span>
        <strong>{{ syntheticDemo ? syntheticLabel : caseLabel }}</strong>
        <small>{{ syntheticDemo ? '程序生成' : referenceDemo ? 'SOLIDWORKS Flow Simulation' : '程序生成的示意数据' }}</small>
      </div>
    </section>

    <section class="visualization-layout">
      <div ref="viewer" class="visualization-viewer">
        <header class="viewer-head">
          <div class="viewer-title"><i></i><strong>{{ showComparison ? '三栏同步对比' : '三维流场' }}</strong><span>{{ currentField.label }} / {{ layerLabel }}</span></div>
          <div class="viewer-meta"><span>{{ datasetId ? '固定采样' : qualityLabel }}</span><span>{{ palette }}</span></div>
          <div class="viewer-actions"><button type="button" title="重置视角" @click="resetView">⌖</button><button type="button" :title="fullscreen ? '退出全屏' : '全屏查看'" @click="toggleFullscreen">⛶</button></div>
        </header>

        <div class="scene-stage">
          <div v-if="showComparison" class="comparison-layout">
            <article v-for="(item, index) in layers" :key="item.id" class="comparison-pane">
              <div class="pane-label"><span>{{ index + 1 }}</span>{{ item.title }}</div>
              <FlowScene :ref="(el) => setSceneRef(el, index)" :view-id="`compare-${index}`" :camera-sync="cameraSync" :sync-source="syncSource" :field="fieldKey" :layer="item.id" :palette="palette" :point-size="pointSize" :quality="quality" :camera-view="cameraView" :playing="false" :selected-index="selectedPoint?.index ?? -1" compact-view @camera-change="syncCamera" @interaction-start="stopAutoRotate" @point-hover="hoveredPoint = $event" @point-select="selectedPoint = $event" @point-clear="clearPoint" />
            </article>
          </div>
          <FlowScene v-else :ref="(el) => setSceneRef(el, 0)" view-id="single" :camera-sync="cameraSync" :sync-source="syncSource" :field="fieldKey" :dataset-id="datasetId" :data-field="fieldId" :shared-range="sharedRange" :layer="layer" :playing="playing" :palette="palette" :point-size="pointSize" :quality="quality" :camera-view="cameraView" :selected-index="selectedPoint?.index ?? -1" compact-view @camera-change="syncCamera" @interaction-start="stopAutoRotate" @point-hover="hoveredPoint = $event" @point-select="selectedPoint = $event" @point-clear="clearPoint" @data-range="dataRange = $event" />
          <div class="interaction-hint">左键旋转 · 滚轮缩放 · 右键平移 · 双击重置 · 点击锁定测点</div>
          <div v-if="displayedRange" class="color-legend color-legend-numeric" aria-label="点云色标">
            <span>{{ rangeNumber.format(displayedRange.min) }}</span>
            <div :style="legendStyle" aria-hidden="true"></div>
            <span>{{ rangeNumber.format(displayedRange.max) }} {{ displayedRange.unit }}</span>
          </div>
          <div v-else-if="!datasetId" class="color-legend" aria-label="示意数据色标">
            <span>低</span><div :style="legendStyle" aria-hidden="true"></div><span>高</span>
          </div>
        </div>
      </div>

      <aside class="visualization-controls">
        <section class="control-group">
          <div class="group-title"><span>01</span><strong>结果内容</strong></div>
          <label v-if="referenceDemo" class="control-label">
            参考案例
            <select v-model="requestedCaseId">
              <option v-for="item in CASES" :key="item.caseId" :value="item.caseId">{{ item.name }}</option>
            </select>
          </label>
          <label class="control-label">物理场<select v-model="fieldId"><option v-for="item in availableFields" :key="item.value" :value="item.value">{{ item.label }}（{{ item.unit }}）</option></select></label>
          <template v-if="!datasetId">
            <div class="control-label">数据层</div>
            <div class="segmented three"><button v-for="item in layers" :key="item.id" type="button" :class="{ active: layer === item.id }" @click="layer = item.id">{{ item.title }}</button></div>
          </template>
        </section>
        <section class="control-group">
          <div class="group-title"><span>02</span><strong>查看方式</strong></div>
          <div v-if="!datasetId" class="segmented"><button type="button" :class="{ active: !compareMode }" @click="compareMode = false">单视图</button><button type="button" :class="{ active: compareMode }" @click="compareMode = true">三栏对比</button></div>
          <div class="control-label spacing-top">标准视角</div>
          <div class="view-buttons"><button v-for="item in cameraViews" :key="item.id" type="button" :class="{ active: cameraView === item.id }" @click="cameraView = item.id">{{ item.text }}</button></div>
        </section>
        <section class="control-group display-grid">
          <div class="group-title full"><span>03</span><strong>显示设置</strong></div>
          <label class="control-label">调色板<select v-model="palette"><option value="viridis">Viridis</option><option value="turbo">Turbo</option><option value="coolwarm">Coolwarm</option></select></label>
          <label v-if="!datasetId" class="control-label">点云质量<select v-model="quality"><option value="smooth">流畅</option><option value="balanced">均衡</option><option value="fine">精细</option></select></label>
          <label v-if="referenceDemo" class="control-label">
            色标量程
            <select v-model="scaleMode">
              <option value="auto">当前案例</option>
              <option value="shared">三个案例统一</option>
            </select>
          </label>
          <p v-if="rangeStatus" class="demo-note full" role="status">{{ rangeStatus }}</p>
          <div class="control-label full">点大小</div>
          <div class="segmented three full"><button v-for="item in sizes" :key="item.id" type="button" :class="{ active: pointSize === item.id }" @click="pointSize = item.id">{{ item.text }}</button></div>
          <button type="button" class="rotate-button full" :class="{ active: playing }" @click="playing = !playing"><span>{{ playing ? 'Ⅱ' : '▶' }}</span>{{ playing ? '暂停自动旋转' : '继续自动旋转' }}</button>
        </section>
        <section class="point-inspector" :class="{ active: currentPoint }">
          <div class="group-title"><span>04</span><strong>{{ selectedPoint ? '已锁定测点' : hoveredPoint ? '悬停测点' : '测点信息' }}</strong></div>
          <template v-if="currentPoint"><dl><dt>编号</dt><dd>#{{ currentPoint.index + 1 }}</dd><dt>坐标 X / Y / Z</dt><dd>{{ currentPoint.x }} / {{ currentPoint.y }} / {{ currentPoint.z }}</dd><dt>{{ currentPoint.layer }}</dt><dd>{{ currentPoint.value }} <small>{{ currentPoint.unit }}</small></dd></dl><button v-if="selectedPoint" type="button" class="unlock-button" @click="clearPoint">解除锁定</button></template>
          <p v-else>将鼠标移到测点上查看信息；点击测点可锁定。</p>
        </section>
        <p class="demo-note">{{ referenceDemo ? '当前案例提供 CFD 参考点云。预测值与绝对误差待接入。' : '当前点云由程序生成，用于交互联调。' }}</p>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.visualization-page{min-height:calc(100dvh - 72px);padding:30px clamp(18px,3vw,52px) 42px;background:#091019;color:#e6edf4}.visualization-heading{width:min(1760px,100%);margin:0 auto 22px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.visualization-eyebrow{margin-bottom:8px;color:#62d5b1;font-size:11px;font-weight:800;letter-spacing:.17em}.title-row{display:flex;align-items:center;gap:12px}.title-row h1{margin:0;font-size:clamp(25px,2.2vw,36px);letter-spacing:-.035em}.visualization-heading p{margin:7px 0 0;color:#8292a4;font-size:13px;line-height:1.5}.demo-badge{padding:4px 8px;border:1px solid #315246;border-radius:999px;background:#122a22;color:#7edcbb;font-size:10px}.case-summary{display:grid;grid-template-columns:auto auto;align-items:center;gap:5px 12px;padding:11px 14px;border:1px solid #273442;border-radius:10px;background:#111a24}.case-summary span{grid-row:1/3;padding:5px 8px;border-radius:5px;background:#19372e;color:#85ddbd;font-size:10px}.case-summary strong{font-size:13px}.case-summary small{color:#718193;font-size:10px}.visualization-layout{width:min(1760px,100%);margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:start}.visualization-viewer,.visualization-controls{border:1px solid #24313e;border-radius:12px;background:#101821}.visualization-viewer{height:clamp(570px,calc(100dvh - 215px),820px);min-width:0;overflow:hidden;display:flex;flex-direction:column}.viewer-head{flex:0 0 52px;display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:18px;padding:0 16px;border-bottom:1px solid #22303c}.viewer-title{display:flex;align-items:center;min-width:0;gap:8px;font-size:12px}.viewer-title i{width:7px;height:7px;border-radius:50%;background:#65d9b1;box-shadow:0 0 12px #65d9b177}.viewer-title span{overflow:hidden;color:#748596;text-overflow:ellipsis;white-space:nowrap}.viewer-meta{display:flex;gap:7px}.viewer-meta span{padding:4px 7px;border-radius:5px;background:#16222e;color:#7f91a2;font-size:9px;text-transform:capitalize}.viewer-actions{display:flex;gap:7px}.viewer-actions button{width:30px;height:30px;border:1px solid #2b3a48;border-radius:7px;background:#17222d;color:#b7c4cf;font-size:17px}.viewer-actions button:hover{border-color:#4f8875;color:#8de1c2}.scene-stage{position:relative;flex:1;min-height:0}.scene-stage :deep(.scene-host),.scene-stage :deep(.webgl-fallback){width:100%;height:100%!important;min-height:0}.comparison-layout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));height:100%}.comparison-pane{position:relative;min-width:0;overflow:hidden;border-right:1px solid #263440}.comparison-pane:last-child{border-right:0}.comparison-pane :deep(.scene-host){height:100%}.pane-label{position:absolute;z-index:3;top:12px;left:12px;display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #2b3a47;border-radius:7px;background:#101923e8;color:#cdd7df;font-size:10px;pointer-events:none}.pane-label span{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:#204638;color:#8ce0c1}.interaction-hint{position:absolute;z-index:3;left:15px;bottom:14px;color:#718193;font-size:9px;pointer-events:none}.color-legend{position:absolute;z-index:3;right:15px;bottom:12px;display:flex;align-items:center;gap:7px;color:#9aa8b5;font-size:9px;pointer-events:none}.color-legend>div{width:112px;height:7px;border-radius:99px}.color-legend small{color:#718193}.visualization-controls{padding:15px;display:flex;flex-direction:column;gap:11px}.control-group,.point-inspector{padding:13px;border:1px solid #23313d;border-radius:9px;background:#0c141d}.group-title{display:flex;align-items:center;gap:8px;margin-bottom:11px}.group-title span{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:#17352c;color:#78d9b7;font-size:9px}.group-title strong{font-size:11px;letter-spacing:.03em}.control-label{display:flex;flex-direction:column;gap:6px;margin-bottom:9px;color:#8191a1;font-size:10px}.control-label select{width:100%;height:34px;padding:0 9px;border:1px solid #293846;border-radius:7px;background:#111c26;color:#dbe5ed;font-size:11px}.segmented{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;padding:3px;border-radius:8px;background:#080f16}.segmented.three{grid-template-columns:repeat(3,minmax(0,1fr))}.segmented button,.view-buttons button{min-height:30px;border:0;border-radius:6px;background:transparent;color:#7d8d9c;font-size:10px}.segmented button:hover,.view-buttons button:hover{color:#c5d3dd;background:#17232d}.segmented button.active,.view-buttons button.active{color:#bff0dd;background:#1a3a30;box-shadow:inset 0 0 0 1px #2a5949}.spacing-top{margin-top:11px}.view-buttons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.view-buttons button{background:#111b25;border:1px solid #253440}.display-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}.display-grid .full{grid-column:1/-1}.rotate-button{height:34px;margin-top:10px;border:1px solid #2b4d41;border-radius:7px;background:#12281f;color:#a7dcca;font-size:10px}.rotate-button span{margin-right:7px}.rotate-button.active{border-color:#3c755f;background:#17392d;color:#c7f3e3}.point-inspector{min-height:112px}.point-inspector.active{border-color:#315044}.point-inspector p{margin:0;color:#718293;font-size:10px;line-height:1.6}.point-inspector dl{display:grid;grid-template-columns:1fr auto;gap:6px 10px;margin:0;font-size:10px}.point-inspector dt{color:#738496}.point-inspector dd{margin:0;color:#dbe4eb;text-align:right}.point-inspector small{color:#788998}.unlock-button{width:100%;height:29px;margin-top:10px;border:1px solid #3b594e;border-radius:6px;background:#14281f;color:#a9ddca;font-size:10px}.demo-note{margin:0;padding:10px 11px;border-radius:8px;background:#101f29;color:#728493;font-size:9px;line-height:1.55}.visualization-viewer:fullscreen{width:100vw;height:100vh;border:0;border-radius:0;background:#0b121b}.visualization-viewer:fullscreen .scene-stage{min-height:0}@media(max-width:1180px){.visualization-layout{grid-template-columns:1fr}.visualization-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.point-inspector,.demo-note{grid-column:1/-1}.visualization-viewer{height:clamp(540px,68dvh,760px)}}@media(max-width:760px){.visualization-page{padding:22px 14px 32px}.visualization-heading{align-items:flex-start;flex-direction:column}.case-summary{width:100%}.visualization-viewer{height:580px}.visualization-controls{display:flex}.comparison-layout{grid-template-columns:1fr;grid-template-rows:repeat(3,minmax(0,1fr))}.comparison-pane{border-right:0;border-bottom:1px solid #263440}.viewer-meta,.color-legend small{display:none}.interaction-hint{max-width:55%}.color-legend>div{width:72px}}
.color-legend-numeric {
  color: #dbe5ed;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 760px) {
  .color-legend-numeric { bottom: 38px; }
}
</style>
