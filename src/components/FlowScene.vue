<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createDemoFieldData } from '../data/demoFieldData.js'
import { isSyntheticDemo, loadReferenceField, loadSyntheticField, referenceCaseIds, syntheticCaseId } from '../data/case0577Cfd.js'

const props = defineProps({
  field: { type: String, default: 'speed' },
  datasetId: String,
  dataField: String,
  sharedRange: Object,
  playing: Boolean,
  palette: { type: String, default: 'viridis' },
  pointSize: { type: String, default: 'medium' },
  quality: { type: String, default: 'balanced' },
  layer: { type: String, default: 'prediction' },
  cameraView: { type: String, default: 'perspective' },
  cameraSync: { type: Object, default: null },
  syncSource: { type: String, default: '' },
  viewId: { type: String, default: 'main' },
  selectedIndex: { type: Number, default: -1 },
  compactView: Boolean,
})
const emit = defineEmits(['point-hover', 'point-select', 'point-clear', 'camera-change', 'interaction-start', 'data-range'])
const host = ref(null)
const syntheticDemo = computed(() => props.datasetId === syntheticCaseId)
const cfdStatus = ref('')
const cfdNotice = ref('')
let cfdData = null
let loadVersion = 0
const webglError = ref(false)
const webglErrorMessage = ref('当前浏览器无法加载三维预览')
let renderer, scene, fieldGroup, camera, controls, points, hoverMarker, fieldData, frameId, resizeObserver, raycaster, pointer, suppressCameraEvent = false
let hoverFrame = 0
let lastHoverPick = 0
let pointerDownPosition = null
let normalPixelRatio = 1
let markerIndex = -1
let staticObjects = []

const palettes = {
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  turbo: ['#30123b', '#466be3', '#1bcfd4', '#7df657', '#f9c932', '#ef5a24', '#7a0403'],
  coolwarm: ['#3b4cc0', '#829fca', '#dddddd', '#d6604d', '#b40426'],
}
const pointSizes = { small: 0.028, medium: 0.045, large: 0.065 }
const pointCounts = { smooth: 1800, balanced: 12000, fine: 40000 }

function fieldValue(index, field = props.field, layer = props.layer) {
  return fieldData?.fields?.[field]?.[layer]?.[index] ?? null
}

function pointInfo(index) {
  if (cfdData) {
    const [x, y, z] = cfdData.positions.slice(index * 3, index * 3 + 3)
    const layer = syntheticDemo.value ? '合成演示数据（坐标 m）' : 'CFD 参考值（坐标 m）'
    return { index, x, y, z, value: cfdData.values[index], layer, unit: cfdData.unit }
  }
  const positions = points.geometry.attributes.position
  return {
    index,
    x: Number(positions.getX(index).toFixed(3)),
    y: Number(positions.getY(index).toFixed(3)),
    z: Number(positions.getZ(index).toFixed(3)),
    value: Number(((fieldValue(index) ?? 0) * 100).toFixed(2)),
    field: props.field === 'speed' ? '速度' : '压力',
    layer: ({ reference: '参考值（示意）', prediction: '预测值（示意）', error: '绝对误差（示意）' })[props.layer],
    unit: '归一化示意值',
  }
}

function setQuality(value) {
  if (!points || props.datasetId) return
  disposePoints()
  makePoints(pointCounts[value] || pointCounts.balanced)
  restoreSelectedMarker()
}

function disposePoints() {
  if (!points) return
  const previous = points
  previous.parent?.remove(previous)
  previous.geometry.dispose()
  previous.material.dispose()
  points = null
}

function makePoints(count = pointCounts[props.quality] || pointCounts.balanced) {
  fieldData = createDemoFieldData(count)
  renderPoints(fieldData.positions)
}

function renderPoints(positions) {
  const count = positions.length / 3
  const colors = new Float32Array(count * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: pointSizes[props.pointSize], vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 }))
  fieldGroup.add(points)
  colorPoints()
}

async function updateDataset() {
  if (!fieldGroup || webglError.value) return
  const version = ++loadVersion
  hideHoverMarker()
  disposePoints()
  fieldData = null
  cfdData = null
  emit('data-range', null)
  cfdStatus.value = ''
  cfdNotice.value = ''
  for (const object of staticObjects.slice(0, 2)) object.visible = !props.datasetId

  if (!props.datasetId) {
    makePoints()
    restoreSelectedMarker()
    return
  }
  const synthetic = syntheticDemo.value
  const datasetId = props.datasetId
  const label = synthetic ? `${syntheticCaseId} · 合成演示数据` : `Case ${datasetId} · CFD 参考数据`
  if (props.layer !== 'reference') {
    cfdStatus.value = synthetic ? `${label} · 此栏无预测或误差数据，请选择「参考值」查看合成点云。` :
      `Case ${datasetId} 暂无同点位预测或误差数据。请选择参考值。`
    return
  }

  cfdStatus.value = `正在读取 ${label}…`
  try {
    const field = props.dataField
    const data = await (synthetic ? loadSyntheticField(field) : loadReferenceField(datasetId, field))
    if (version !== loadVersion || webglError.value) return
    if (!data) {
      cfdStatus.value = `${label} · 此物理场暂无数据。`
      return
    }
    cfdData = data
    renderPoints(data.displayPositions)
    restoreSelectedMarker()
    emit('data-range', { min: data.min, max: data.max, unit: data.unit })
    cfdNotice.value = `${label} · ${data.values.length.toLocaleString()} 点 · ${data.min.toPrecision(5)} ～ ${data.max.toPrecision(5)} ${data.unit}`
    cfdStatus.value = ''
  } catch {
    if (version === loadVersion) cfdStatus.value = `${label}无法读取或格式有误。`
  }
}

function colorPoints() {
  if (!points) return
  const colors = points.geometry.attributes.color
  const stops = palettes[props.palette] || palettes.viridis
  const stopColors = stops.map((color) => new THREE.Color(color))
  const temp = new THREE.Color()
  const scale = cfdData && (props.sharedRange ?? cfdData)
  for (let i = 0; i < colors.count; i++) {
    const rawValue = cfdData?.values[i] ?? fieldValue(i) ?? 0
    let v = rawValue
    if (scale) {
      const span = scale.max - scale.min
      v = span ? THREE.MathUtils.clamp((rawValue - scale.min) / span, 0, 1) : 0.5
    } else if (props.layer === 'error') {
      v = THREE.MathUtils.clamp(rawValue / 0.145, 0, 1)
    }
    const scaled = v * (stopColors.length - 1)
    const index = Math.min(Math.floor(scaled), stopColors.length - 2)
    temp.copy(stopColors[index]).lerp(stopColors[index + 1], scaled - index)
    colors.setXYZ(i, temp.r, temp.g, temp.b)
  }
  colors.needsUpdate = true
  if (markerIndex >= 0) updateMarkerColor(markerIndex)
}

function resize(fitScene = false) {
  if (!host.value || !renderer) return
  const { clientWidth: w, clientHeight: h } = host.value
  if (!w || !h) return
  // 同时更新绘制缓冲区和 canvas 的 CSS 尺寸；否则高分屏下会按像素比放大布局尺寸，
  // 三栏画布只显示左上角的一部分，看起来就像模型被裁到右下方。
  renderer.setSize(w, h, true)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  if (fitScene && props.compactView) setView(props.cameraView)
}

function setView(view = props.cameraView) {
  if (!camera || !controls) return
  const directions = {
    // 透视方向尽量与管轴保持较大夹角，避免近端被透视放大后贴住画布边缘。
    perspective: new THREE.Vector3(1.1, 2.7, 9.2).normalize(),
    front: new THREE.Vector3(0, 0, 1),
    top: new THREE.Vector3(0, 1, 0.0001).normalize(),
    side: new THREE.Vector3(1, 0, 0),
  }
  const baseDistances = { perspective: 11.4, front: 10.2, top: 10.2, side: 6.4 }
  const distance = props.compactView ? fittedDistance(view, baseDistances[view] || 9.8) : (baseDistances[view] || 9.8)
  camera.position.copy((directions[view] || directions.perspective).multiplyScalar(distance))
  controls.target.set(0, 0, 0)
  controls.update()
}
function fittedDistance(view, minimumDistance) {
  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.1))
  const isSide = view === 'side'
  const halfWidth = isSide ? 1.15 : 4.15
  const halfHeight = view === 'perspective' ? 2.05 : 1.2
  const horizontalDistance = halfWidth / Math.tan(horizontalFov / 2)
  const verticalDistance = halfHeight / Math.tan(verticalFov / 2)
  // 三栏时单个画布会很窄，额外留出边距以免透视近端贴边或被裁切。
  const framingMargin = camera.aspect < 1 ? 1.22 : 1.16
  return Math.max(minimumDistance, horizontalDistance, verticalDistance) * framingMargin
}
function resetView() { setView('perspective') }
function updateHoverMarker(index) {
  if (!hoverMarker || !points || index < 0 || index >= points.geometry.attributes.position.count) {
    hideHoverMarker()
    return
  }
  const positions = points.geometry.attributes.position
  hoverMarker.position.set(positions.getX(index), positions.getY(index), positions.getZ(index))
  markerIndex = index
  updateMarkerColor(index)
  hoverMarker.visible = true
}
function updateMarkerColor(index) {
  if (!hoverMarker || !points || index < 0) return
  const colors = points.geometry.attributes.color
  hoverMarker.material.color.setRGB(colors.getX(index), colors.getY(index), colors.getZ(index))
}
function hideHoverMarker() {
  markerIndex = -1
  if (hoverMarker) hoverMarker.visible = false
}
function restoreSelectedMarker() {
  if (props.selectedIndex >= 0) updateHoverMarker(props.selectedIndex)
  else hideHoverMarker()
}
defineExpose({ resetView })

function pick(event, select = false) {
  if (!renderer || !points || !raycaster) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  raycaster.params.Points.threshold = props.pointSize === 'large' ? 0.13 : 0.09
  const hit = raycaster.intersectObject(points)[0]
  if (!hit) {
    // 空白处点击只负责旋转/平移，不取消已经锁定的测点。
    // 需要取消时由信息面板的“取消锁定”或 Esc 明确触发。
    if (!select) { restoreSelectedMarker(); emit('point-hover', null) }
    return
  }
  if (!select) updateHoverMarker(hit.index)
  const info = pointInfo(hit.index)
  emit(select ? 'point-select' : 'point-hover', info)
}

function onControlsChange() {
  if (suppressCameraEvent) return
  emit('camera-change', { source: props.viewId, position: camera.position.toArray(), target: controls.target.toArray() })
}
function applySharedCamera(state, source) {
  if (!camera || !controls || !state || source === props.viewId) return
  suppressCameraEvent = true
  camera.position.fromArray(state.position)
  controls.target.fromArray(state.target)
  controls.update()
  suppressCameraEvent = false
}

function onKeyDown(event) {
  if (event.key === 'Escape') {
    emit('point-clear')
  }
}
function onPointerMove(event) {
  const now = performance.now()
  if (hoverFrame || now - lastHoverPick < 45) return
  lastHoverPick = now
  const clientX = event.clientX
  const clientY = event.clientY
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0
    pick({ clientX, clientY }, false)
  })
}
function onPointerLeave() { restoreSelectedMarker(); emit('point-hover', null) }
function onPointerDown(event) { pointerDownPosition = [event.clientX, event.clientY] }
function onPointerClick(event) {
  if (!pointerDownPosition) return
  const distance = Math.hypot(event.clientX - pointerDownPosition[0], event.clientY - pointerDownPosition[1])
  pointerDownPosition = null
  if (distance < 4) pick(event, true)
}
function onWebGLContextLost(event) {
  event.preventDefault()
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  webglErrorMessage.value = '三维渲染连接已中断'
  webglError.value = true
}
function onInteractionStart() {
  if (!renderer) return
  emit('interaction-start')
  renderer.setPixelRatio(Math.min(normalPixelRatio, 1))
  resize(false)
}
function onInteractionEnd() {
  if (!renderer) return
  renderer.setPixelRatio(normalPixelRatio)
  resize(false)
}

onMounted(() => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b111b')
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(5.5, 4.1, 7.2)
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }) }
  catch {
    webglErrorMessage.value = '当前浏览器无法加载三维预览'
    webglError.value = true
    return
  }
  normalPixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer.setPixelRatio(normalPixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.075
  controls.minDistance = 4.2
  controls.maxDistance = 34
  controls.zoomToCursor = true
  controls.addEventListener('change', onControlsChange)
  controls.addEventListener('start', onInteractionStart)
  controls.addEventListener('end', onInteractionEnd)
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.55
  scene.add(new THREE.AmbientLight(0xffffff, 1.5))
  const grid = new THREE.GridHelper(12, 24, '#26394c', '#172433')
  grid.position.y = -1.25
  scene.add(grid)
  fieldGroup = new THREE.Group()
  // 让数据主体处于画布的视觉中心；网格仍留在底部作为空间参照。
  // 坐标读取来自几何体本身，因此不会改变测点显示的真实局部坐标。
  fieldGroup.position.y = props.compactView ? 0.28 : 0
  scene.add(fieldGroup)
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 7.7, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#a4c2d5', wireframe: true, transparent: true, opacity: 0.14 }))
  pipe.rotation.z = Math.PI / 2
  fieldGroup.add(pipe)
  const hoverGeometry = new THREE.BufferGeometry()
  hoverGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
  hoverMarker = new THREE.Points(
    hoverGeometry,
    new THREE.PointsMaterial({ color: '#ffffff', size: pointSizes[props.pointSize] * 2.35, sizeAttenuation: true, transparent: true, opacity: 1, depthTest: false }),
  )
  hoverMarker.visible = false
  hoverMarker.renderOrder = 20
  fieldGroup.add(hoverMarker)
  staticObjects = [grid, pipe, hoverMarker]
  updateDataset()
  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerleave', onPointerLeave)
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('click', onPointerClick)
  renderer.domElement.addEventListener('dblclick', resetView)
  renderer.domElement.addEventListener('webglcontextlost', onWebGLContextLost)
  window.addEventListener('keydown', onKeyDown)
  resizeObserver = new ResizeObserver(() => resize(true))
  resizeObserver.observe(host.value)
  resize(true)
  const animate = () => {
    frameId = requestAnimationFrame(animate)
    controls.autoRotate = props.playing
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
})

watch(() => [props.datasetId, props.dataField, props.layer], ([active], [wasActive]) => {
  if (active || wasActive) {
    emit('point-clear')
    updateDataset()
  }
})
watch(() => [props.field, props.palette, props.layer, props.sharedRange], colorPoints)
watch(() => props.pointSize, (value) => {
  const size = pointSizes[value] || pointSizes.medium
  if (points) points.material.size = size
  if (hoverMarker) hoverMarker.material.size = size * 2.35
})
watch(() => props.cameraView, setView)
watch(() => props.quality, setQuality)
watch(() => props.selectedIndex, restoreSelectedMarker)
watch(() => [props.cameraSync, props.syncSource], ([state, source]) => applySharedCamera(state, source), { deep: true })
onBeforeUnmount(() => {
  loadVersion++
  cancelAnimationFrame(frameId)
  cancelAnimationFrame(hoverFrame)
  resizeObserver?.disconnect()
  controls?.removeEventListener('change', onControlsChange)
  controls?.removeEventListener('start', onInteractionStart)
  controls?.removeEventListener('end', onInteractionEnd)
  controls?.dispose()
  window.removeEventListener('keydown', onKeyDown)
  const canvas = renderer?.domElement
  canvas?.removeEventListener('pointermove', onPointerMove)
  canvas?.removeEventListener('pointerleave', onPointerLeave)
  canvas?.removeEventListener('pointerdown', onPointerDown)
  canvas?.removeEventListener('click', onPointerClick)
  canvas?.removeEventListener('dblclick', resetView)
  canvas?.removeEventListener('webglcontextlost', onWebGLContextLost)
  points?.geometry.dispose()
  points?.material.dispose()
  for (const object of staticObjects) {
    object.geometry?.dispose()
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
    else object.material?.dispose()
  }
  renderer?.domElement.remove()
  fieldData = null
  renderer?.dispose()
})
</script>

<template>
  <div v-if="webglError" class="webgl-fallback"><strong>{{ webglErrorMessage }}</strong><span>可以继续查看页面内容；刷新页面可重新尝试加载三维场景。</span></div>
  <div v-else ref="host" class="scene-host">
    <p v-if="cfdStatus" class="cfd-status" role="status">{{ cfdStatus }}</p>
    <p v-else-if="cfdNotice" class="cfd-notice">{{ cfdNotice }}</p>
  </div>
</template>

<style scoped>
.scene-host { position: relative; }
.cfd-status, .cfd-notice {
  position: absolute;
  z-index: 1;
  margin: 0;
  padding: 0.5rem 0.75rem;
  color: #dbe5ed;
  background: #101923e8;
  border-radius: 6px;
  font-size: 0.75rem;
  pointer-events: none;
}
.cfd-status { top: 50%; left: 50%; width: max-content; max-width: 85%; transform: translate(-50%, -50%); }
.cfd-notice { top: 3rem; left: 0.75rem; right: 0.75rem; width: fit-content; }
</style>
