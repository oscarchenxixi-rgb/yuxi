<script setup>
import { computed, ref } from 'vue'
import { CASES } from '../data/cases'
import CaseCard from '../components/CaseCard.vue'
const keyword = ref('')
const level = ref('all')
const sort = ref('recommended')
const view = ref('cards')

const sortKeys = {
  pressure: 'pressureRelativeL2',
  speed: 'speedRelativeL2'
}

function normalizeSearch(text) {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

const filteredCases = computed(() => {
  const query = normalizeSearch(keyword.value)
  const matching = CASES.filter((item) => (
    (level.value === 'all' || level.value === item.level) &&
    (item.caseId.includes(query.replace(/^case/, '')) ||
      [item.levelText, item.description].some((text) => normalizeSearch(text).includes(query)))
  ))
  const metric = sortKeys[sort.value]
  return metric
    ? matching.sort((a, b) => a.metrics[metric] - b.metrics[metric])
    : matching
})

function resetFilters() {
  keyword.value = ''
  level.value = 'all'
  sort.value = 'recommended'
}
</script>

<template>
  <main>
    <div class="page-top container"><div class="eyebrow">CASE LIBRARY</div><h1>典型案例库</h1><p>三组来自参考文献的代表案例，覆盖低、中、高误差情形。下方指标均为论文数据，非本平台算法产出。</p></div>
    <section class="container section compact-top">
      <div class="filter-bar">
        <label class="filter-field">
          搜索案例
          <input v-model="keyword" type="search" placeholder="0415、低误差或其他关键词" />
        </label>
        <label class="filter-field">
          误差水平
          <select v-model="level">
            <option value="all">全部</option>
            <option value="low">低误差</option>
            <option value="medium">中等误差</option>
            <option value="high">高误差</option>
          </select>
        </label>
        <label class="filter-field">
          排序方式
          <select v-model="sort">
            <option value="recommended">推荐顺序</option>
            <option value="pressure">压力误差从低到高</option>
            <option value="speed">速度误差从低到高</option>
          </select>
        </label>
        <button type="button" class="btn btn-secondary" @click="resetFilters">
          清除筛选
        </button>
      </div>

      <div class="toolbar-row">
        <p role="status" class="filter-count">共 {{ filteredCases.length }} 个案例</p>
        <div class="case-view-options" role="group" aria-label="案例显示方式">
          <button type="button" class="btn" :class="view === 'cards' ? 'btn-primary' : 'btn-secondary'" :aria-pressed="view === 'cards'" @click="view = 'cards'">
            案例卡片
          </button>
          <button type="button" class="btn" :class="view === 'table' ? 'btn-primary' : 'btn-secondary'" :aria-pressed="view === 'table'" @click="view = 'table'">
            指标对比
          </button>
        </div>
      </div>

      <div v-if="!filteredCases.length" class="empty-state">
        <h2>没有找到匹配案例</h2>
        <p>试试其他关键词或调整误差等级。</p>
      </div>
      <div v-else-if="view === 'cards'" class="case-grid">
        <CaseCard v-for="caseInfo in filteredCases" :key="caseInfo.caseId" :case-info="caseInfo" />
      </div>
      <div v-else class="table-scroll" tabindex="0" role="region" aria-label="案例误差对比">
        <table class="data-table case-comparison">
          <caption>参考论文案例误差对比</caption>
          <thead>
            <tr>
              <th scope="col">案例</th>
              <th scope="col">误差水平</th>
              <th scope="col" :aria-sort="sort === 'pressure' ? 'ascending' : undefined">压力 relative L2</th>
              <th scope="col" :aria-sort="sort === 'speed' ? 'ascending' : undefined">速度 relative L2</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="caseInfo in filteredCases" :key="caseInfo.caseId">
              <th scope="row">
                <RouterLink class="text-link" :to="{ name: 'case-detail', params: { caseId: caseInfo.caseId } }">{{ caseInfo.name }}</RouterLink>
              </th>
              <td>{{ caseInfo.levelText }}</td>
              <td>{{ caseInfo.metrics.pressureRelativeL2.toFixed(3) }}</td>
              <td>{{ caseInfo.metrics.speedRelativeL2.toFixed(3) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>
