<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CASES, FIELD_OPTIONS, LAYER_OPTIONS } from '../data/cases'
const route = useRoute()
const current = computed(() => CASES.find((item) => item.caseId === route.params.caseId))
const index = computed(() => CASES.findIndex((item) => item.caseId === route.params.caseId))
const field = ref('surfacePressure')
const previewFields = FIELD_OPTIONS.filter(({ value }) => value === 'surfacePressure' || value === 'speed')
const fieldLabel = computed(() => previewFields.find(({ value }) => value === field.value)?.label)
</script>

<template>
  <main v-if="current">
    <div class="page-top container"><RouterLink to="/cases" class="text-link">← 返回案例库</RouterLink><div class="eyebrow top-space">CASE DETAILS</div><div class="title-row"><h1>{{ current.name }}</h1><span class="level-badge" :class="`level-${current.level}`">{{ current.levelText }}</span></div><p>{{ current.description }}</p></div>
    <section class="container section compact-top">
      <div class="toolbar-row">
        <h2>三层数据预览</h2>
        <label class="field-inline">
          预览物理场
          <select v-model="field">
            <option v-for="option in previewFields" :key="option.value" :value="option.value">
              {{ option.label }} ({{ option.unit }})
            </option>
          </select>
        </label>
      </div>
      <div class="preview-grid">
        <article v-for="layer in LAYER_OPTIONS" :key="layer.value" class="preview-card">
          <h3>{{ layer.label }}</h3>
          <div class="preview-image">
            <div class="preview-pipe" aria-hidden="true"></div>
            <span>{{ fieldLabel }}预览图待接入</span>
          </div>
          <p class="muted small">示意占位，论文流场图待授权后接入。</p>
        </article>
      </div>
    </section>
    <section class="container section compact-top"><div class="metric-summary"><div class="metric-box"><span>压力 relative L2</span><strong>{{ current.metrics.pressureRelativeL2.toFixed(3) }}</strong></div><div class="metric-box"><span>速度 relative L2</span><strong>{{ current.metrics.speedRelativeL2.toFixed(3) }}</strong></div><div class="metric-box"><span>案例定位</span><strong class="smaller">{{ current.levelText }}</strong></div></div><div v-if="current.caseId === '0072'" class="notice warning">Case 0072 用于展示困难工况与模型局限性，不能将其表现泛化至所有工况。</div><div class="notice">所有误差指标均来自参考论文 main.pdf；页面未执行真实 CFD 或模型训练。</div></section>
    <section class="container section compact-top"><div class="detail-actions"><RouterLink v-if="index > 0" class="btn btn-secondary" :to="`/cases/${CASES[index - 1].caseId}`">← 上一个案例</RouterLink><span v-else></span><RouterLink class="btn btn-primary" :to="{ path: '/simulation', query: { case: current.caseId } }">使用此案例开始演示 →</RouterLink><RouterLink v-if="index < CASES.length - 1" class="btn btn-secondary" :to="`/cases/${CASES[index + 1].caseId}`">下一个案例 →</RouterLink><span v-else></span></div></section>
  </main>
</template>
