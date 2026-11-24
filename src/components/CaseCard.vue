
<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { LAYER_OPTIONS } from '../data/cases'

const props = defineProps({
  caseInfo: {
    type: Object,
    required: true
  }
})

// 每张卡片拥有独立的切换状态
const selectedLayer = ref('reference')

const selectedLabel = computed(() =>
  LAYER_OPTIONS.find(({ value }) => value === selectedLayer.value)?.label
)

const preview = computed(() =>
  props.caseInfo.previews?.[selectedLayer.value] ?? null
)
</script>

<template>
  <article class="case-card">
    <div class="case-visual">
      <RouterLink
        class="case-visual-link"
        :to="`/cases/${caseInfo.caseId}`"
        :aria-label="`查看 ${caseInfo.name} 详情`"
      >
        <template v-if="preview">
          <img
            :src="preview.image"
            :alt="`${caseInfo.name} 体积压力点云 · ${selectedLabel}`"
            class="case-visual-image"
            width="1120"
            height="560"
            loading="lazy"
            decoding="async"
          />
          <div class="case-preview-scale">
            <span>体积压力</span>
            <span>{{ preview.min }}</span>
            <span class="pressure-scale-ramp" aria-hidden="true"></span>
            <span>{{ preview.max }} kPa</span>
          </div>
        </template>
      </RouterLink>
      <div class="case-preview-status" role="status">
        <span v-if="!preview">暂无{{ selectedLabel }}数据</span>
      </div>
    </div>

    <!-- 每张卡片独立切换 -->
    <div class="case-preview-switcher" role="group" :aria-label="`${caseInfo.name} 预览图层`">
      <button
        v-for="layer in LAYER_OPTIONS"
        :key="layer.value"
        type="button"
        class="case-preview-option"
        :class="{ active: selectedLayer === layer.value }"
        :aria-pressed="selectedLayer === layer.value"
        @click="selectedLayer = layer.value"
      >
        {{ layer.label }}
      </button>
    </div>

    <div class="case-content">
      <div class="case-heading">
        <h3>{{ caseInfo.name }}</h3>
        <span
          class="level-badge"
          :class="`level-${caseInfo.level}`"
        >
          {{ caseInfo.levelText }}
        </span>
      </div>

      <p class="muted">{{ caseInfo.description }}</p>

      <div class="metric-pair">
        <div>
          <small>压力 relative L2</small>
          <strong>
            {{ caseInfo.metrics.pressureRelativeL2.toFixed(3) }}
          </strong>
        </div>
        <div>
          <small>速度 relative L2</small>
          <strong>
            {{ caseInfo.metrics.speedRelativeL2.toFixed(3) }}
          </strong>
        </div>
      </div>

      <div class="card-actions">
        <RouterLink
          class="btn btn-secondary"
          :to="`/cases/${caseInfo.caseId}`"
        >
          查看详情
        </RouterLink>

        <RouterLink
          class="btn btn-primary"
          :to="{
            path: '/simulation',
            query: { case: caseInfo.caseId }
          }"
        >
          开始演示
        </RouterLink>
      </div>

      <small class="source-hint">
        参考论文数据 · {{ caseInfo.source }}
      </small>
    </div>
  </article>
</template>
