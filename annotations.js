// Hypothes.is 公开批注静态归档（每周 cron 用公开搜索 API 刷新，无需 key）
// 作用：前端直连 hypothes.is 失败时的降级数据源；数据可能滞后一周
window.EAI_ANNOTATIONS = {
  updated: null, // ISO 时间戳，null = 尚无归档
  byId: {}       // arXiv id → [{ id, quote, text, created }]
};
