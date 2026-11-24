/**
 * Case metadata comes from PRD V1.0. Do not present these values as this project's model output.
 * parameterSchema below is explicitly a UI-only placeholder, NOT paper-derived physical parameters.
 * Replace with the data team's case JSON parameterSchema before real task integration.
 */
const UI_ONLY_PARAMETER_SCHEMA = {
  demoOnly: true,
  presets: [{ id: 'reference', name: '参考预设（交互占位）' }],
  fields: [
    { key: 'exampleParameter', label: '演示参数（非物理量）', min: 0, max: 10, step: 1, defaultValue: 1, unit: '' }
  ]
}

export const CASES = [
  {
    caseId: '0415', name: 'Case 0415', level: 'low', levelText: '低误差',
    description: '低误差代表案例，用于首页预览与主演示。',
    metrics: { pressureRelativeL2: 0.048, speedRelativeL2: 0.242 },
    previews: { reference: {
      image: new URL('../assets/case-0415-volume-pressure.webp', import.meta.url).href,
      min: '88.03', max: '131.11'
    } },
    source: 'main.pdf', parameterSchema: UI_ONLY_PARAMETER_SCHEMA
  },
  {
    caseId: '0577', name: 'Case 0577', level: 'medium', levelText: '中等误差',
    description: '中等误差代表案例，用于常规效果展示。',
    metrics: { pressureRelativeL2: 0.286, speedRelativeL2: 0.324 },
    previews: { reference: {
      image: new URL('../assets/case-0577-volume-pressure.webp', import.meta.url).href,
      min: '101.328', max: '101.767'
    } },
    source: 'main.pdf', parameterSchema: UI_ONLY_PARAMETER_SCHEMA
  },
  {
    caseId: '0072', name: 'Case 0072', level: 'high', levelText: '高误差',
    description: '困难工况与模型局限性展示，不应作为普遍精度的代表。',
    metrics: { pressureRelativeL2: 0.400, speedRelativeL2: 2.098 },
    previews: { reference: {
      image: new URL('../assets/case-0072-volume-pressure.webp', import.meta.url).href,
      min: '101.3196', max: '101.3339'
    } },
    source: 'main.pdf', parameterSchema: UI_ONLY_PARAMETER_SCHEMA
  }
]

export const FIELD_OPTIONS = [
  { value: 'surfacePressure', label: '近壁面压力', unit: 'kPa' },
  { value: 'volumePressure', label: '体积压力', unit: 'kPa' },
  { value: 'speed', label: '合速度', unit: 'm/s' },
  { value: 'ux', label: '速度 ux', unit: 'm/s' },
  { value: 'uy', label: '速度 uy', unit: 'm/s' },
  { value: 'uz', label: '速度 uz', unit: 'm/s' }
]

export const LAYER_OPTIONS = [
  { value: 'reference', label: '参考值' },
  { value: 'prediction', label: '预测值' },
  { value: 'absoluteError', label: '绝对误差' }
]

export const REFERENCE_METRICS = [
  { label: '近壁面压力', unit: 'kPa', rmse: 135.890, mae: 47.238, r2: 0.809 },
  { label: '体积压力', unit: 'kPa', rmse: 175.943, mae: 64.284, r2: 0.866 },
  { label: '速度 ux', unit: 'm/s', rmse: 3.954, mae: 2.028, r2: 0.796 },
  { label: '速度 uy', unit: 'm/s', rmse: 2.896, mae: 1.157, r2: 0.254 },
  { label: '速度 uz', unit: 'm/s', rmse: 3.383, mae: 1.270, r2: 0.703 },
  { label: '合速度', unit: 'm/s', rmse: 5.833, mae: 3.469, r2: 0.594 }
]

export const DATA_DISCLAIMER = '演示使用的案例、物理场及指标来自参考论文 main.pdf 的既有结果；仅用于前端可视化展示，不构成本项目算法产出。'
