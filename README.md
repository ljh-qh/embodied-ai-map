# 具身智能 · 研究图谱

一个具身智能（Embodied AI）领域的交互式论文研究统计站，覆盖 **VLA（视觉-语言-动作模型）**、**世界模型（World Model / WAM）** 与具身 Agent 全链路。格式与协同逻辑参考 [多模态 Agent 长期记忆 · 研究图谱](https://mmjtt.github.io/MultimodalMemory/#/)。

## 信息架构

三层结构：**模块 → 研究难点 → 代表论文**。

### 内环（具身智能体闭环流转，7 个模块）

感知 → 世界模型 → VLA 决策 → 技能学习 → 规划 → 导航 → 记忆 ↺ 回到感知

| 模块 | 覆盖方向 |
|---|---|
| 多模态感知与表征 | 3D/空间理解、Affordance、抓取与位姿、语义地图与场景图、触觉与多感官（含 2026 触觉智能：N₀-Foundation、触觉基础模型、触觉 WAM、触觉闭环） |
| 世界模型 (WM/WAM) | 视频生成式 WM、潜空间动力学与 MBRL、JEPA 表征预测、交互式生成环境、WM 驱动决策（World-Gymnast、WEAVER、τ₀-WM、Cosmos Policy），以及 **2026 年爆发的世界-动作模型（WAM）独立难点**（Riemann-1.0、ZimaBlue、DELE-w0.5、GlanceWAM、Hydra + 触觉 WAM 家族 N₀-TWAM、VT-WAM、Dream-Tac、HiTac-WAM，共 18 篇） |
| VLA 基础模型 | 端到端 VLA 开创与规模化（含 G0.5、CometVLA）、**测试时训练与测试时计算 TTT/TTC（RoboTTT、WAM-TTT、τ₀-VLA、E-TTS 等 12 篇）**、动作表征与解码（πR²、DriftingVLA、ActionCache）、具身推理与 CoT（HINT、LM-X）、潜动作与视频学习、高效推理（MINERVA、Fewer Layers、PhyAI）、双系统与全身控制（Ψ₀、HAF、BFM 系） |
| 技能学习范式 | 模仿学习与遥操作（Teleopit）、Sim-to-Real、VLA 的 RL 后训练（PAVE）、数据引擎与合成数据（RoboTok、SABER、1500h 双臂数据） |
| 任务规划与长程推理 | LLM 规划与 Grounding、开放世界智能体、分层快慢系统（含 Agentic Real2Sim） |
| 导航与移动操作 | VLN（Uni-LaViRA、VerNav）、通用导航基础模型、移动操作一体化 |
| 具身记忆与自我改进 | 空间/情景记忆（HitMem 动态 3D 记忆）、经验积累与自我改进、持续学习与技能库 |

### 元层（4 个模块）

系统目标与综述 · Benchmark 与评测 · 开放问题与边界 · 安全与对齐

### 论文卡片

每篇论文包含：一句话摘要 + **目的 / 方法 / 贡献** 三段卡 + venue/状态标签 + 原文/PDF/Scholar 链接。收录标准为领域开创作、当前 SOTA 或某条路线的代表实现（RT-1/RT-2、OpenVLA、π0/π0.5、GR00T、Genie、V-JEPA 2、DreamerV3、Mobile ALOHA、SayCan、Voyager…），2026 年论文均经 arXiv API 核实（Riemann-1.0、ZimaBlue、G0.5、N₀-Foundation 等），时间截至 2026 年 9 月。

## 功能

- 首页环形全景图（模块间流转关系可视化 + 研究范式演进带：奠基 → LLM 上身 → VLA 确立 → 世界模型与数据引擎 → WM×VLA 融合与测试时智能），移动端自动降级为列表
- 模块页难点卡片 → 难点页按年份铺开论文 → 点击展开详情卡
- **顶会统计视图**：按 CVPR/ICCV/ECCV、NeurIPS/ICML/ICLR、CoRL/RSS/ICRA/IROS、期刊、技术报告、arXiv 预印本六类分组，组内按具体 venue × 细分方向统计；2026 年已公布录用（CVPR/ICLR/ICML/RSS/ICRA 等 58 篇）均已收录
- **引用排行榜（🏆 排行）**：按 11 个模块的子领域分别排名，被引数据来自 Semantic Scholar（`citations.js`，可用 `fetch_cit.py` 增量刷新），带全站 Top 10 与子领域内比例条
- 全文搜索（⌘K / Ctrl+K），支持论文名、关键词、机构、会议
- 论文年表视图（按年份倒序浏览全部论文）
- hash 路由，任意论文可直链分享（如 `#/m/vla/vla_pioneer/pi0`）

## 本地运行

纯静态站点，无构建、无依赖：

```bash
cd embodied-ai-map
python3 -m http.server 8642
# 打开 http://localhost:8642
```

## 部署到 GitHub Pages

1. 新建仓库并推送本目录全部文件到 `main` 分支
2. 仓库 Settings → Pages → Source 选 `main` 分支根目录
3. 访问 `https://<用户名>.github.io/<仓库名>/`

## 文件结构

```
index.html    页面骨架
styles.css    样式
app.js        路由与渲染逻辑（无框架依赖）
data1.js      感知 + 世界模型
data2.js      VLA + 技能学习
data3.js      规划 + 导航 + 记忆
data4.js      元层（综述/评测/开放问题/安全）+ 模块流转关系
```

新增论文只需在对应 `dataN.js` 的 `papers` 数组中追加条目，字段：`id, name, title, year, venue, status, url, summary, purpose, method, contribution`。

## 免责声明

内容为人工梳理的领域快照，论文归属、venue 与描述可能存在疏漏或随时间过时，请以原文为准。
