<script setup>
import { DATA_DISCLAIMER } from '../data/cases'
import ModalDialog from './ModalDialog.vue'

defineProps({ open: Boolean })
defineEmits(['close'])
</script>

<template>
  <ModalDialog :open="open" label="数据来源说明" @close="$emit('close')">
    <div class="modal-head"><h2>数据来源说明</h2><button class="icon-button" aria-label="关闭弹窗" @click="$emit('close')">×</button></div>
    <p>{{ DATA_DISCLAIMER }}</p>
    <p class="muted">参考文献：Geometry-Conditioned Anchored-Branched Transformers for Three-Dimensional Pipe-Flow Surrogate Modeling。来源文件为 main.pdf。</p>
    <p class="muted">RMSE、MAE、R² 和 relative L2 均应结合物理场与数据范围解读。聚合指标反映的是测试集整体表现。</p>
    <div class="right"><button class="btn btn-primary" @click="$emit('close')">我知道了</button></div>
  </ModalDialog>
</template>
