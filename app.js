/* 具身智能研究图谱 · 前端逻辑（无依赖，hash 路由） */
(function () {
  "use strict";

  const MODULES = (window.EAI_MODULES || []).slice().sort((a, b) => a.order - b.order);
  const FLOW = window.EAI_FLOW || [];

  const $view = document.getElementById("view");
  const $crumb = document.getElementById("breadcrumb");
  const $stats = document.getElementById("global-stats");

  /* ── 索引与统计 ── */
  const allPapers = [];
  let diffCount = 0;
  MODULES.forEach(m => {
    m.difficulties.forEach(d => {
      diffCount++;
      d.papers.forEach(p => allPapers.push({ paper: p, mod: m, diff: d }));
    });
  });
  $stats.textContent = `${MODULES.length} 个模块 · ${diffCount} 个研究难点 · ${allPapers.length} 篇代表论文`;

  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function badgeClass(status) {
    if (/预印本/.test(status)) return "preprint";
    if (/技术报告|综述性/.test(status)) return "report";
    if (/综述/.test(status)) return "survey";
    return "published";
  }

  function paperCount(m) {
    return m.difficulties.reduce((n, d) => n + d.papers.length, 0);
  }

  /* ── 路由 ── */
  function nav(hash) { location.hash = hash; }

  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean);
    window.scrollTo(0, 0);
    if (parts[0] === "timeline") return renderTimeline();
    if (parts[0] === "venues") return renderVenues(parts[1] ? decodeURIComponent(parts[1]) : null);
    if (parts[0] === "rank") return renderRank(parts[1] ? decodeURIComponent(parts[1]) : null);
    if (parts[0] === "library") return renderLibrary();
    if (parts[0] === "m" && parts[1]) {
      const mod = MODULES.find(m => m.id === parts[1]);
      if (!mod) return renderHome();
      if (parts[2]) {
        const diff = mod.difficulties.find(d => d.id === parts[2]);
        if (diff) return renderDifficulty(mod, diff, parts[3] || null);
      }
      return renderModule(mod);
    }
    renderHome();
  }

  function setCrumb(items) {
    $crumb.innerHTML = items.map((it, i) => {
      const cur = i === items.length - 1;
      const btn = `<span class="crumb${cur ? " current" : ""}" ${cur ? "" : `data-nav="${esc(it.hash)}"`}>${esc(it.label)}</span>`;
      return i === 0 ? btn : `<span class="crumb-sep">›</span>` + btn;
    }).join("");
  }

  /* ── 首页：环形全景 + 研究演进 ── */
  const ERAS = [
    { name: "感知与操作奠基", years: "2016–2021", mods: ["perception", "learning"],
      desc: "抓取检测、affordance、触觉硬件、遥操作与深度 RL 打下感知-操作地基",
      papers: ["graspnet", "where2act", "digit", "anygrasp"] },
    { name: "LLM 上身", years: "2022–2023", mods: ["planning", "vla"],
      desc: "大模型接入机器人：语义规划与 grounding，RT-1 验证规模化真机数据",
      papers: ["saycan", "innermonologue", "codeaspolicies", "palme", "rt1"] },
    { name: "VLA 范式确立", years: "2023–2024", mods: ["vla", "learning"],
      desc: "RT-2 命名 VLA，OpenVLA/OXE 开源开放，Diffusion Policy/ACT 定型动作生成",
      papers: ["rt2", "openvla", "rtx", "diffusionpolicy", "act"] },
    { name: "世界模型与数据引擎", years: "2024–2025", mods: ["worldmodel", "learning"],
      desc: "Genie/Sora/V-JEPA 定义世界模拟，π0 领衔高频 VLA，数据金字塔成型",
      papers: ["genie", "vjepa2", "pi0", "dreamgen", "agibot"] },
    { name: "WM×VLA 融合与测试时智能", years: "2025–2026", mods: ["worldmodel", "vla", "perception"],
      desc: "WAM 爆发、TTT/TTC 兴起、触觉智能与人形全身控制汇流成新前沿",
      papers: ["riemann10", "robottt", "wamttt", "n0twam", "g05"] }
  ];

  function paperLink(id) {
    const hit = allPapers.find(x => x.paper.id === id);
    return hit ? { name: hit.paper.name, hash: `#/m/${hit.mod.id}/${hit.diff.id}/${hit.paper.id}`, year: hit.paper.year } : null;
  }

  function renderHome() {
    setCrumb([]);
    const loops = MODULES.filter(m => m.type === "loop");
    const metas = MODULES.filter(m => m.type === "meta");

    // 环上位置（百分比坐标），loop 模块均匀分布在椭圆上
    const cx = 50, cy = 50, rx = 33, ry = 36;
    const loopPos = loops.map((m, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / loops.length;
      return { m, x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) };
    });
    // 元层四角
    const corner = [{ x: 11, y: 10 }, { x: 89, y: 10 }, { x: 89, y: 90 }, { x: 11, y: 90 }];
    const metaPos = metas.map((m, i) => ({ m, ...corner[i % 4] }));

    const posOf = id => loopPos.concat(metaPos).find(p => p.m.id === id);

    // SVG 流转箭头（HTML 标签另行定位，避免 viewBox 缩放放大文字）
    let svg = `<svg class="ring-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs><marker id="arrowhead" markerUnits="userSpaceOnUse" markerWidth="2.4" markerHeight="2.4" refX="2" refY="1.2" orient="auto">
        <polygon points="0 0, 2.4 1.2, 0 2.4" fill="#a89c7d"/></marker></defs>`;
    let labels = "";
    FLOW.forEach(f => {
      const a = posOf(f.from), b = posOf(f.to);
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // 控制点向环心外侧偏一点，形成弧线
      const dx = mx - cx, dy = my - cy;
      const len = Math.hypot(dx, dy) || 1;
      const px = mx + (dx / len) * 7, py = my + (dy / len) * 7;
      svg += `<path vector-effect="non-scaling-stroke" d="M ${a.x} ${a.y} Q ${px} ${py} ${b.x} ${b.y}"/>`;
      labels += `<span class="flow-label" style="left:${px}%;top:${py}%">${esc(f.label)}</span>`;
    });
    // 元层与最近 loop 模块的虚线
    metaPos.forEach(mp => {
      let best = null, bd = 1e9;
      loopPos.forEach(lp => {
        const d = Math.hypot(lp.x - mp.x, lp.y - mp.y);
        if (d < bd) { bd = d; best = lp; }
      });
      if (best) svg += `<path class="meta-link" vector-effect="non-scaling-stroke" d="M ${mp.x} ${mp.y} L ${best.x} ${best.y}"/>`;
    });
    svg += `</svg>`;
    svg += labels;

    const nodeHtml = p => {
      const minY = Math.min(...p.m.difficulties.flatMap(d => d.papers.map(x => x.year)));
      return `
      <div class="module-node${p.m.type === "meta" ? " meta" : ""}" style="--mc:${p.m.color};left:${p.x}%;top:${p.y}%" data-nav="#/m/${p.m.id}">
        <div class="mn-icon">${p.m.icon}</div>
        <div class="mn-name">${esc(p.m.name)}</div>
        <span class="mn-count">${p.m.difficulties.length} 难点 · ${paperCount(p.m)} 篇</span>
        <span class="mn-since">兴起 ${minY}</span>
      </div>`;
    };

    const mobileHtml = MODULES.map(m => `
      <div class="module-node${m.type === "meta" ? " meta" : ""}" style="--mc:${m.color}" data-nav="#/m/${m.id}">
        <div class="mn-icon">${m.icon}</div>
        <div>
          <div class="mn-name">${esc(m.name)}</div>
          <span class="mn-count">${m.difficulties.length} 难点 · ${paperCount(m)} 篇</span>
        </div>
      </div>`).join("");

    const eraBand = `
      <div class="era-band">
        <div class="era-head">
          <h3>📈 研究范式演进</h3>
          <span>研究重心的世代迁移：每个时代的工作孕育了下一个时代的问题</span>
        </div>
        <div class="era-track">
          ${ERAS.map((e, i) => `
          <div class="era-card" style="--ec:${["#8a836b", "#b8862d", "#d0603a", "#7a5cd6", "#3b7dd8"][i]}">
            <div class="era-years">${e.years}</div>
            <div class="era-name">${esc(e.name)}</div>
            <div class="era-desc">${esc(e.desc)}</div>
            <div class="era-papers">
              ${e.papers.map(pid => paperLink(pid)).filter(Boolean).map(l =>
                `<span class="era-paper" data-nav="${l.hash}">${esc(l.name)} <small>${l.year}</small></span>`).join("")}
            </div>
          </div>`).join("")}
        </div>
      </div>`;

    $view.innerHTML = `
      <p class="home-hint">环形图是<b>系统视角</b>：一个具身智能体的能力闭环（感知 → 世界模型 → VLA 决策 → 技能学习 → 规划 → 导航 → 记忆 ↺），模块上标注了各自的兴起年份；下方演进带是<b>历史视角</b>：研究热点的世代迁移。</p>
      <div id="ring-wrap">${svg}${loopPos.concat(metaPos).map(nodeHtml).join("")}</div>
      ${eraBand}
      <div class="home-list-mobile">${mobileHtml}</div>`;
  }

  /* ── 模块页 ── */
  function renderModule(mod) {
    setCrumb([{ label: "全景", hash: "#/" }, { label: mod.name, hash: `#/m/${mod.id}` }]);
    $view.innerHTML = `
      <div class="module-head">
        <h2><span>${mod.icon}</span>${esc(mod.name)}</h2>
        <div class="tagline">${esc(mod.tagline)}</div>
      </div>
      <div class="diff-grid">
        ${mod.difficulties.map(d => {
          const years = d.papers.map(p => p.year);
          const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "";
          return `
          <div class="diff-card" style="--mc:${mod.color}" data-nav="#/m/${mod.id}/${d.id}">
            <div class="dc-tag">研究难点</div>
            <h3>${esc(d.name)}</h3>
            <div class="dc-q">${esc(d.question)}</div>
            <div class="dc-meta">${d.papers.length} 篇 · ${span}</div>
          </div>`;
        }).join("")}
      </div>`;
  }

  /* ── 难点页：按年份铺开 ── */
  function renderDifficulty(mod, diff, openPaperId) {
    setCrumb([
      { label: "全景", hash: "#/" },
      { label: mod.name, hash: `#/m/${mod.id}` },
      { label: diff.name, hash: `#/m/${mod.id}/${diff.id}` }
    ]);
    const byYear = {};
    diff.papers.forEach(p => (byYear[p.year] = byYear[p.year] || []).push(p));
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

    const cardHtml = p => {
      if (p.id === openPaperId) return detailHtml(mod, diff, p);
      return `
        <div class="paper-card" data-nav="#/m/${mod.id}/${diff.id}/${p.id}">
          <div class="pc-top">
            <span class="pc-name">${esc(p.name)}</span>
            <span class="pc-badge ${badgeClass(p.status)}">${esc(p.venue)}</span>
            <span class="pc-year">${p.year}</span>
            ${libPillHtml(p.id)}
            ${arxivLinksHtml(p)}
          </div>
          <div class="pc-summary">${esc(p.summary)}</div>
        </div>`;
    };

    $view.innerHTML = `
      <div class="diff-head">
        <h2>${esc(diff.name)}</h2>
        <div class="dh-q">${esc(diff.question)}</div>
      </div>
      <div class="year-bar">${years.map(y => `<span class="year-chip"><b>${y}</b> · ${byYear[y].length} 篇</span>`).join("")}</div>
      ${years.map(y => `
        <div class="year-section">
          <div class="ys-label">${y}</div>
          <div class="paper-list" style="--mc:${mod.color}">${byYear[y].map(cardHtml).join("")}</div>
        </div>`).join("")}`;
    hypBackfill();
    if (openPaperId) {
      requestAnimationFrame(() => {
        const el = $view.querySelector(".paper-detail");
        if (el) el.scrollIntoView({ block: "start" });
      });
    }
  }

  function detailHtml(mod, diff, p) {
    const rec = libGet(p.id);
    const links = [];
    if (p.url) {
      links.push(`<a href="${esc(p.url)}" target="_blank" rel="noopener">查看原文 ↗</a>`);
      if (/arxiv\.org\/abs\//.test(p.url)) {
        links.push(`<a href="${esc(p.url.replace("/abs/", "/pdf/"))}" target="_blank" rel="noopener">PDF ↗</a>`);
        links.push(`<a href="${esc(p.url.replace("/abs/", "/html/"))}" target="_blank" rel="noopener">HTML 全文 ↗</a>`);
        links.push(`<a href="${esc(p.url.replace("/abs/", "/html/"))}" target="_blank" rel="noopener" title="打开 arXiv HTML 全文：装一次 Hypothes.is 扩展或书签工具，即可在侧栏选中段落高亮+批注（云端保存）">📝 批注阅读 ↗</a>`);
      }
    }
    const scholar = `https://scholar.google.com/scholar?q=${encodeURIComponent(p.title)}`;
    links.push(`<a href="${scholar}" target="_blank" rel="noopener">Google Scholar</a>`);
    return `
      <div class="paper-detail" style="--mc:${mod.color}">
        <div class="pd-top">
          <span class="pd-name">${esc(p.name)}</span>
          <span class="pc-badge ${badgeClass(p.status)}">${esc(p.venue)}</span>
          <span class="pc-year">${p.year} · ${esc(p.status)}</span>
        </div>
        <div class="pd-title">${esc(p.title)}</div>
        <div class="pd-section"><span class="pd-label">目的</span><p>${esc(p.purpose)}</p></div>
        <div class="pd-section"><span class="pd-label">方法</span><p>${esc(p.method)}</p></div>
        <div class="pd-section"><span class="pd-label">贡献</span><p>${esc(p.contribution)}</p></div>
        <div class="pd-lib">
          <div class="pd-lib-row">
            <span class="pd-label">我的阅读</span>
            <div class="lib-seg-group">
              ${LIB_ST.map(s => `<button class="lib-seg ${s.cls}${rec && rec.status === s.key ? " active" : ""}" data-lib="${p.id}" data-status="${s.key}">${s.icon} ${s.label}</button>`).join("")}
            </div>
            <span class="lib-hint">状态与笔记只存本地浏览器，可在「📚 阅读库」导出</span>
          </div>
          <textarea class="lib-note" data-lib="${p.id}" rows="3" placeholder="📝 私人笔记：关键洞察 / 与其他工作的关系 / 待验证的问题…（失焦自动保存）">${esc(rec ? rec.note || "" : "")}</textarea>
          ${hypSlotHtml(p, true)}
        </div>
        <div class="pd-actions">
          ${links.join("")}
          <button class="pd-close" data-nav="#/m/${mod.id}/${diff.id}">收起 ✕</button>
        </div>
      </div>`;
  }

  /* ── 年表 ── */
  function renderTimeline() {
    setCrumb([{ label: "全景", hash: "#/" }, { label: "年表", hash: "#/timeline" }]);
    const byYear = {};
    allPapers.forEach(e => (byYear[e.paper.year] = byYear[e.paper.year] || []).push(e));
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
    $view.innerHTML = `
      <div class="tl-head">
        <h2>🕰 论文年表</h2>
        <p>全部 ${allPapers.length} 篇代表工作按年份倒序排列，点击跳转详情。</p>
      </div>
      ${years.map(y => `
        <div class="tl-year">
          <div class="tl-year-label">${y}<small>${byYear[y].length} 篇</small></div>
          <div class="tl-items">
            ${byYear[y].map(e => `
              <div class="tl-item" style="--mc:${e.mod.color}" data-nav="#/m/${e.mod.id}/${e.diff.id}/${e.paper.id}">
                <div class="ti-name">${esc(e.paper.name)}</div>
                <div class="ti-path">${esc(e.mod.name)} · ${esc(e.diff.name)} · ${esc(e.paper.venue)}</div>
                <div class="ti-sum">${esc(e.paper.summary)}</div>
              </div>`).join("")}
          </div>
        </div>`).join("")}`;
  }

  /* ── 顶会统计：会议 × 年份 × 细分方向 ── */
  const VENUE_FAMILIES = [
    { key: "vision", name: "视觉三大会", icon: "🖼", desc: "CVPR · ICCV · ECCV" },
    { key: "ml", name: "机器学习三大会", icon: "🧮", desc: "NeurIPS · ICML · ICLR" },
    { key: "robotics", name: "机器人核心会", icon: "🤖", desc: "CoRL · RSS · ICRA · IROS" },
    { key: "journal", name: "期刊与专会", icon: "📚", desc: "RA-L · T-RO · TPAMI · Nature · EMNLP 等" },
    { key: "report", name: "技术报告与路线", icon: "🏢", desc: "公司技术报告 · 官方博客 · 平台发布" },
    { key: "preprint", name: "arXiv 预印本", icon: "📄", desc: "未经同行评审的最新工作" }
  ];
  const CONF_RE = [
    [/CVPR/, "CVPR"], [/ICCV/, "ICCV"], [/ECCV/, "ECCV"], [/WACV/, "WACV"],
    [/NeurIPS|NIPS/, "NeurIPS"], [/ICML/, "ICML"], [/ICLR/, "ICLR"],
    [/CoRL/, "CoRL"], [/RSS/, "RSS"], [/ICRA/, "ICRA"], [/IROS/, "IROS"],
    [/RA-L/, "RA-L"], [/T-RO/, "T-RO"], [/TPAMI/, "TPAMI"], [/Nature/, "Nature"],
    [/IJRR/, "IJRR"], [/SIGGRAPH/, "SIGGRAPH"], [/EMNLP/, "EMNLP"],
    [/ACL/, "ACL"], [/ACM/, "ACM"], [/TMLR/, "TMLR"]
  ];
  const LAB_RE = [
    [/NVIDIA/, "NVIDIA"], [/Physical Intelligence/, "Physical Intelligence"], [/Meta/, "Meta"],
    [/Google DeepMind|DeepMind/, "Google DeepMind"], [/Wayve/, "Wayve"], [/AgiBot/, "AgiBot"],
    [/ByteDance/, "ByteDance"], [/1X/, "1X"], [/UC Berkeley/, "UC Berkeley"],
    [/Toyota/, "Toyota Research"], [/Stanford/, "Stanford"], [/Figure/, "Figure AI"],
    [/OpenAI/, "OpenAI"], [/Hugging Face/, "Hugging Face"]
  ];

  function confOf(v) { for (const [re, n] of CONF_RE) if (re.test(v)) return n; return null; }
  function labOf(v) { for (const [re, n] of LAB_RE) if (re.test(v)) return n; return "其他（未标注机构）"; }

  function venueEntry(e) {
    const v = e.paper.venue;
    const c = confOf(v);
    if (c) {
      const fam = ["CVPR", "ICCV", "ECCV", "WACV"].includes(c) ? "vision"
        : ["NeurIPS", "ICML", "ICLR"].includes(c) ? "ml"
        : ["CoRL", "RSS", "ICRA", "IROS"].includes(c) ? "robotics" : "journal";
      return { fam, group: c };
    }
    if (/技术报告|博客|竞赛|公司|标准化|行业|路线|实践|进程/.test(v)) return { fam: "report", group: v };
    if (e.paper.status === "已发表" || e.paper.status === "已接收") return { fam: "journal", group: "其他期刊与专会" };
    return { fam: "preprint", group: labOf(v) };
  }

  // 过滤匹配：支持会议名、机构名、以及「arXiv <年份> 预印本」年份组
  function matchFilter(t, filter) {
    if (filter === "__report__") return t.fam === "report";
    if (t.group === filter) return true;
    const ym = filter.match(/^arXiv (\d{4}) 预印本$/);
    if (ym && t.fam === "preprint" && String(t.e.paper.year) === ym[1]) return true;
    return false;
  }

  function renderVenues(filter) {
    setCrumb([{ label: "全景", hash: "#/" }, { label: "顶会统计", hash: "#/venues" }]);
    const tagged = allPapers.map(e => ({ e, ...venueEntry(e) }));
    const years = [...new Set(allPapers.map(x => x.paper.year))].sort();

    // 会议 × 年份 矩阵（仅统计正式会议/期刊）
    const confRows = {};
    tagged.forEach(t => {
      if (["report", "preprint"].includes(t.fam)) return;
      confRows[t.group] = confRows[t.group] || {};
      confRows[t.group][t.e.paper.year] = (confRows[t.group][t.e.paper.year] || 0) + 1;
    });
    const confOrder = CONF_RE.map(x => x[1]).filter(n => confRows[n]);
    const matrixRows = confOrder.concat(Object.keys(confRows).filter(n => !confOrder.includes(n)));

    const famCount = f => tagged.filter(t => t.fam === f).length;
    const confTotal = c => tagged.filter(t => t.group === c && !["report", "preprint"].includes(t.fam)).length;

    // 顶会按钮：正式会议/期刊一组 + 预印本按年份 + 技术报告，含收录数与高亮
    const famOfConf = c => {
      const t = tagged.find(x => x.group === c);
      return t ? t.fam : "journal";
    };
    const confBtn = (c, label, count) => `
      <button class="venue-btn${filter === c ? " active" : ""}" data-nav="#/venues/${encodeURIComponent(c)}">
        ${esc(label || c)}<span class="vb-count">${count != null ? count : confTotal(c) || tagged.filter(t => t.group === c).length}</span>
      </button>`;
    const famGroups = VENUE_FAMILIES.filter(f => f.key !== "report" && f.key !== "preprint").map(f => {
      const btns = matrixRows.filter(c => famOfConf(c) === f.key).map(c => confBtn(c)).join("");
      return btns ? `<div class="venue-fam"><span class="vf-label">${f.icon} ${f.name.replace("三大会", "").replace("核心会", "")}</span><div class="vf-btns">${btns}</div></div>` : "";
    }).join("");

    // 预印本按年份按钮（含各年计数）
    const preYears = [...new Set(tagged.filter(t => t.fam === "preprint").map(t => t.e.paper.year))].sort();
    const preBtns = preYears.map(y => {
      const n = tagged.filter(t => t.fam === "preprint" && t.e.paper.year === y).length;
      return confBtn(`arXiv ${y} 预印本`, `${y}`, n);
    }).join("");
    // 技术报告合并为一个入口按钮
    const repCount = tagged.filter(t => t.fam === "report").length;
    const repBtn = confBtn("__report__", `报告与路线`, repCount);

    const venueBtns = `<div class="venue-btn-bar">
      ${famGroups}
      <div class="venue-fam"><span class="vf-label">📄 arXiv 预印本（按年份）</span><div class="vf-btns">${preBtns}</div></div>
      <div class="venue-fam"><span class="vf-label">🏢 技术报告</span><div class="vf-btns">${repBtn}</div></div>
      ${filter ? `<button class="venue-btn all" data-nav="#/venues">↩ 全部</button>` : ""}
    </div>`;

    const item = t => `
      <div class="tl-item" style="--mc:${t.e.mod.color}" data-nav="#/m/${t.e.mod.id}/${t.e.diff.id}/${t.e.paper.id}">
        <div class="ti-name">${esc(t.e.paper.name)} <span class="pc-year">${t.e.paper.year} · ${esc(t.e.paper.venue)}</span></div>
        <div class="ti-path">${esc(t.e.mod.name)} › ${esc(t.e.diff.name)}</div>
        <div class="ti-sum">${esc(t.e.paper.summary)}</div>
      </div>`;

    const groupBlock = (gname, arr) => {
      const byDir = {};
      arr.forEach(t => {
        const k = `${t.e.mod.name} › ${t.e.diff.name}`;
        (byDir[k] = byDir[k] || []).push(t);
      });
      const dirs = Object.entries(byDir).sort((a, b) => b[1].length - a[1].length);
      const modCount = {};
      arr.forEach(t => { modCount[t.e.mod.name] = (modCount[t.e.mod.name] || 0) + 1; });
      const modChips = Object.entries(modCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const ys = arr.map(t => t.e.paper.year);
      return `
        <div class="conf-section">
          <div class="conf-head">
            <h3 ${filter === gname ? "" : `data-nav="#/venues/${encodeURIComponent(gname)}"`}>${esc(gname)}</h3>
            <span class="ch-meta">${arr.length} 篇 · ${Math.min(...ys)}–${Math.max(...ys)}</span>
            ${modChips.map(([m, n]) => `<span class="dir-chip">${esc(m)} ×${n}</span>`).join("")}
          </div>
          ${dirs.map(([k, a]) => `
            <div class="dir-group-label">${esc(k)}<span>${a.length} 篇</span></div>
            <div class="tl-items">${a.map(item).join("")}</div>`).join("")}
        </div>`;
    };

    const famSections = famKey => {
      const famTagged = tagged.filter(t => t.fam === famKey && (!filter || matchFilter(t, filter)));
      if (!famTagged.length) return "";
      const groups = {};
      famTagged.forEach(t => (groups[t.group] = groups[t.group] || []).push(t));
      const f = VENUE_FAMILIES.find(x => x.key === famKey);
      return `
        <div class="tl-year">
          <div class="tl-year-label">${f.icon} ${f.name}<small>${f.desc} · 共 ${famTagged.length} 篇</small></div>
          ${Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([g, a]) => groupBlock(g, a)).join("")}
        </div>`;
    };

    $view.innerHTML = `
      <div class="tl-head">
        <h2>🏟 顶会与细分方向统计</h2>
        <p>全部 ${allPapers.length} 篇按「会议/期刊 × 年份 × 所属方向」三级统计，预印本按机构分组；点击下方顶会按钮可查看该会议收录的论文。</p>
        ${filter ? `<button class="tool-btn" data-nav="#/venues" style="margin-top:10px">← 显示全部</button>` : ""}
      </div>
      ${!filter ? `
      <div class="pending-note">
        <b>⏳ 2026 年会议的收录情况</b>
        <p>本页已收录 <b>CVPR 2026 ×14、ICLR 2026 ×12、RSS 2026 ×12、ICML 2026 ×9、ICRA 2026 ×7、ECCV 2026 ×2、RA-L 2026、ACM CCS 2026</b> 等已公布的录用（均经 arXiv 作者标注逐篇核实）。CoRL 2026（11 月开会）与 NeurIPS 2026 尚未放榜，相应工作暂列预印本区，后续转正时会自动迁移到对应会议分组。</p>
      </div>` : ""}
      ${venueBtns}
      <div class="year-bar">${VENUE_FAMILIES.map(f => `<span class="year-chip">${f.icon} <b>${f.name}</b> · ${famCount(f.key)} 篇</span>`).join("")}</div>
      ${!filter ? `
      <table class="venue-matrix">
        <thead><tr><th>会议/期刊</th>${years.map(y => `<th>${y}</th>`).join("")}<th>合计</th></tr></thead>
        <tbody>
          ${matrixRows.map(r => {
            const cells = years.map(y => {
              const n = confRows[r][y] || 0;
              return `<td class="count ${n ? "nonzero" : ""}">${n || "·"}</td>`;
            }).join("");
            const total = Object.values(confRows[r]).reduce((s, n) => s + n, 0);
            return `<tr><td class="vm-row" data-nav="#/venues/${encodeURIComponent(r)}">${esc(r)}</td>${cells}<td><b>${total}</b></td></tr>`;
          }).join("")}
        </tbody>
      </table>` : ""}
      ${VENUE_FAMILIES.map(f => famSections(f.key)).join("")}`;
  }

  /* ── 引用排行榜：按子领域（难点） ── */
  const CITED = (window.EAI_CITATIONS || {});

  function citeOf(id) { return (CITED[id] && typeof CITED[id].citations === "number") ? CITED[id].citations : null; }
  function fmtCite(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); }

  function renderRank(filter) {
    setCrumb([{ label: "全景", hash: "#/" }, { label: "引用排行", hash: "#/rank" }]);
    // 子领域按钮：按模块分组的难点按钮
    const subBtns = MODULES.map(mod => `
      <div class="venue-fam">
        <span class="vf-label" style="--mc:${mod.color}">${mod.icon} ${esc(mod.name)}</span>
        <div class="vf-btns">
          ${mod.difficulties.map(d => `
            <button class="venue-btn${filter === d.id ? " active" : ""}" data-nav="#/rank/${d.id}" style="--mc:${mod.color}">
              ${esc(d.name)}<span class="vb-count">${d.papers.length}</span>
            </button>`).join("")}
        </div>
      </div>`).join("");

    // 每个难点内部按引用数排序；filter 时只显示该难点
    const sections = MODULES.map(mod => ({
      mod,
      diffs: mod.difficulties.map(d => {
        const ranked = d.papers.map(p => ({ p, c: citeOf(p.id) }))
          .sort((a, b) => {
            if (a.c == null && b.c == null) return a.p.year - b.p.year;
            if (a.c == null) return 1;
            if (b.c == null) return b.c - a.c;
            return b.c - a.c;
          });
        const known = ranked.filter(x => x.c != null).length;
        return { d, ranked, known };
      }).filter(x => filter ? (x.d.id === filter || x.d.name === filter) : true)
    })).filter(s => s.diffs.length);

    const citedCount = allPapers.filter(e => citeOf(e.paper.id) != null).length;
    const totalCited = allPapers.reduce((s, e) => s + (citeOf(e.paper.id) || 0), 0);
    const top10 = allPapers.map(e => ({ e, c: citeOf(e.paper.id) })).filter(x => x.c != null).sort((a, b) => b.c - a.c).slice(0, 10);

    $view.innerHTML = `
      <div class="tl-head">
        <h2>🏆 引用排行榜（按子领域）</h2>
        <p>被引数据来自 OpenAlex（${citedCount}/${allPapers.length} 篇已匹配，累计被引 ${totalCited.toLocaleString()} 次）。点击下方子领域按钮查看该领域的排行榜；子领域内按被引降序，灰色行 = 暂无引用数据（多为 2026 新工作）。点击论文直达详情。</p>
        ${filter ? `<button class="tool-btn" data-nav="#/rank" style="margin-top:10px">← 显示全部子领域</button>` : ""}
      </div>
      <div class="venue-btn-bar rank-btn-bar">${subBtns}</div>
      ${!filter ? `
      <div class="rank-global">
        <div class="rg-title">🌍 全站 Top 10</div>
        <div class="rg-list">
          ${top10.map((x, i) => `
            <span class="rg-item" data-nav="#/m/${x.e.mod.id}/${x.e.diff.id}/${x.e.paper.id}">
              <b class="rg-no">${i + 1}</b>${esc(x.e.paper.name)}<small>${fmtCite(x.c)}</small>
            </span>`).join("")}
        </div>
      </div>` : ""}
      ${sections.map(s => `
        <div class="tl-year">
          <div class="tl-year-label">${s.mod.icon} ${esc(s.mod.name)}<small>${s.mod.difficulties.reduce((n, d) => n + d.papers.length, 0)} 篇</small></div>
          ${s.diffs.map(({ d, ranked, known }) => `
            <div class="rank-sub">
              <div class="dir-group-label">${esc(d.name)}<span>${d.papers.length} 篇 · ${known} 篇有引用数据</span></div>
              <div class="rank-list" style="--mc:${s.mod.color}">
                ${ranked.map((x, i) => {
                  const max = ranked[0] && ranked[0].c ? ranked[0].c : 1;
                  const w = x.c != null ? Math.max(3, Math.round(x.c / max * 100)) : 0;
                  return `
                  <div class="rank-row${x.c == null ? " nocite" : ""}" data-nav="#/m/${s.mod.id}/${d.id}/${x.p.id}">
                    <span class="rk-no">${i + 1}</span>
                    <span class="rk-name">${esc(x.p.name)}<small>${x.p.year} · ${esc(x.p.venue)}</small></span>
                    <span class="rk-bar-wrap"><span class="rk-bar" style="width:${w}%"></span></span>
                    <span class="rk-cite">${x.c != null ? fmtCite(x.c) : "—"}</span>
                  </div>`;
                }).join("")}
              </div>
            </div>`).join("")}
        </div>`).join("")}`;
  }

  /* ── 搜索 ── */
  const $searchOverlay = document.getElementById("search-overlay");
  const $searchInput = document.getElementById("search-input");
  const $searchResults = document.getElementById("search-results");

  function doSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { $searchResults.innerHTML = `<div class="search-empty">输入关键词，如「世界模型」「diffusion」「π0」「人形」…</div>`; return; }
    const hits = allPapers.filter(e => {
      const hay = [e.paper.name, e.paper.title, e.paper.venue, e.paper.summary, e.paper.purpose, e.paper.method, e.paper.contribution, e.mod.name, e.diff.name].join(" ").toLowerCase();
      return q.split(/\s+/).every(t => hay.includes(t));
    }).slice(0, 40);
    $searchResults.innerHTML = hits.length ? hits.map(e => `
      <div class="search-hit" data-nav="#/m/${e.mod.id}/${e.diff.id}/${e.paper.id}" data-close-overlay>
        <div class="sh-name">${esc(e.paper.name)} <span class="pc-year">${e.paper.year} · ${esc(e.paper.venue)}</span></div>
        <div class="sh-path">${esc(e.mod.name)} › ${esc(e.diff.name)}</div>
        <div class="sh-sum">${esc(e.paper.summary)}</div>
      </div>`).join("")
      : `<div class="search-empty">没有找到匹配「${esc(q)}」的论文。<br><br>
         <button class="tool-btn primary" id="search-sub-btn">📮 求收录「${esc(q.trim()).slice(0, 24)}」</button>
         <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px">提交后我们会核实并收录到对应研究方向</div></div>`;
    const subBtn = $searchResults.querySelector("#search-sub-btn");
    if (subBtn) subBtn.addEventListener("click", () => {
      $searchOverlay.classList.add("hidden");
      openSubmit(q.trim());
    });
  }

  /* ── 求收录（submissions） ── */
  const $subOverlay = document.getElementById("submit-overlay");
  const $subDiff = document.getElementById("sub-diff");
  const $subStatus = document.getElementById("sub-status");
  let lastQuery = "";

  // 下拉：模块 › 难点
  $subDiff.innerHTML = MODULES.map(m =>
    m.difficulties.map(d => `<option value="${d.id}">${esc(m.name)} › ${esc(d.name)}</option>`).join("")
  ).join("") + `<option value="">不确定 / 由我们判断</option>`;

  function openSubmit(prefill) {
    $subOverlay.classList.remove("hidden");
    $subStatus.textContent = "";
    if (prefill && /^https?:\/\/arxiv\.org\/abs\/[\d.]+/i.test(prefill)) {
      document.getElementById("sub-paper").value = prefill;
    } else if (prefill && /[a-z]/i.test(prefill) && prefill.length > 8) {
      document.getElementById("sub-paper").value = prefill;
    }
    lastQuery = prefill || "";
    document.getElementById("sub-paper").focus();
  }

  document.getElementById("sub-send").addEventListener("click", () => {
    const paper = document.getElementById("sub-paper").value.trim();
    const diff = $subDiff.value;
    const reason = document.getElementById("sub-reason").value.trim();
    const user = document.getElementById("sub-user").value.trim();
    if (!paper || paper.length < 5) {
      $subStatus.textContent = "⚠️ 请填写论文标题或 arXiv 链接";
      $subStatus.className = "sub-status warn";
      return;
    }
    const payload = { paper, diff: diff || null, reason, user, query: lastQuery, time: new Date().toISOString() };
    $subStatus.textContent = "提交中…";
    $subStatus.className = "sub-status";
    // 优先 POST 到本地保存端点；失败则退化为 GitHub issue 链接引导
    fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(r => {
      if (!r.ok) throw new Error("save failed");
      return r.json();
    }).then(() => {
      $subStatus.textContent = "✅ 已收到！我们会核实后收录（通常在下周一的更新中）。感谢贡献 🙏";
      $subStatus.className = "sub-status ok";
      document.getElementById("sub-paper").value = "";
      document.getElementById("sub-reason").value = "";
    }).catch(() => {
      // 纯静态环境（GitHub Pages）：引导用户到 GitHub issue
      const title = encodeURIComponent(`[求收录] ${paper}`);
      const body = encodeURIComponent(`**论文**: ${paper}\n**建议方向**: ${diff || "由维护者判断"}\n**理由**: ${reason || "-"}\n**来自站内搜索**: ${lastQuery || "-"}\n**推荐人**: ${user || "-"}`);
      $subStatus.innerHTML = `⚠️ 自动提交暂不可用，请 <a href="https://github.com/ljh-qh/embodied-ai-map/issues/new?title=${title}&body=${body}" target="_blank" rel="noopener">点这里发一个 GitHub Issue</a> 完成收录请求。`;
      $subStatus.className = "sub-status warn";
    });
  });

  // 顶栏也放入口（与搜索并列）
  const subTop = document.createElement("button");
  subTop.className = "tool-btn";
  subTop.textContent = "📮 求收录";
  subTop.addEventListener("click", () => openSubmit(""));
  document.querySelector(".toolbar").insertBefore(subTop, document.getElementById("btn-about"));

  /* ── 我的阅读库（localStorage，无后端） ── */
  const READING_KEY = "EAI_READING_v1";
  const LIB_ST = [
    { key: "want", label: "想读", icon: "🔖", cls: "want" },
    { key: "reading", label: "在读", icon: "📖", cls: "reading" },
    { key: "done", label: "已读", icon: "✅", cls: "done" }
  ];

  function libAll() {
    try { return JSON.parse(localStorage.getItem(READING_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function libSaveAll(o) {
    try { localStorage.setItem(READING_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function libGet(id) { return libAll()[id] || null; }
  function libSet(id, rec) {
    const o = libAll();
    const has = rec && (rec.status || (rec.note || "").trim());
    if (has) o[id] = rec; else delete o[id];
    libSaveAll(o);
  }

  function libPillHtml(id) {
    const rec = libGet(id);
    const st = rec && LIB_ST.find(s => s.key === rec.status);
    return `<button class="lib-pill${st ? " " + st.cls : ""}" data-lib="${id}" title="点击切换：想读 → 在读 → 已读 → 清除">${st ? st.icon + " " + st.label : "＋ 标记"}</button>`;
  }
  function libCycle(id) {
    const order = [null, "want", "reading", "done"];
    const rec = libGet(id) || { note: "" };
    rec.status = order[(order.indexOf(rec.status || null) + 1) % order.length];
    rec.ts = Date.now();
    libSet(id, rec);
  }

  /* ── Hypothes.is 公开批注回显（公开搜索 API，无需 key；仅回显公开标注） ── */
  const HYP_ACCT = "acct:ljh_qh@hypothes.is";
  const HYP_CACHE_KEY = "EAI_HYP_ANN_v1";
  const HYP_TTL = 10 * 60 * 1000; // 10 分钟内重复打开不再请求

  function hypAxId(uri) {
    const m = /arxiv\.org\/(?:abs|html|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Za-z-]+)?\/[0-9]{7}(?:v\d+)?)/i.exec(uri || "");
    return m ? m[1].replace(/v\d+$/i, "").toLowerCase() : null;
  }

  async function hypFetchAll() {
    const now = Date.now();
    try {
      const c = JSON.parse(sessionStorage.getItem(HYP_CACHE_KEY));
      if (c && c.ts && now - c.ts < HYP_TTL && c.byId) return c.byId;
    } catch (e) {}
    const rows = [];
    let scroll = null;
    for (let page = 0; page < 5; page++) { // 最多 5×200 条
      const q = new URLSearchParams({ user: HYP_ACCT, limit: "200", sort: "created", order: "desc" });
      if (scroll) q.set("scroll", scroll);
      const res = await fetch("https://hypothes.is/api/search?" + q.toString());
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      (data.rows || []).forEach(r => { if (!r.references) rows.push(r); }); // 只要主批注，回复不列
      scroll = data.scroll || null;
      if (!scroll || rows.length >= (data.total || 0)) break;
    }
    const byId = {};
    rows.forEach(r => {
      const ax = hypAxId(r.uri);
      if (!ax) return;
      const quote = (r.target || []).map(t => (t.selector || [])
        .filter(s => s.type === "TextQuoteSelector").map(s => s.exact).join(" ")).join(" ");
      (byId[ax] = byId[ax] || []).push({ id: r.id, quote: quote || "", text: (r.text || "").trim(), created: r.created });
    });
    try { sessionStorage.setItem(HYP_CACHE_KEY, JSON.stringify({ ts: now, byId })); } catch (e) {}
    return byId;
  }

  function hypSlotHtml(p, open) {
    const ax = p.url && hypAxId(p.url);
    if (!ax) return "";
    return `<div class="hyp-slot${open ? " open" : ""}" data-ax="${esc(ax)}"></div>`;
  }

  function hypItemHtml(a) {
    const quote = a.quote ? `<div class="hyp-quote">“${esc(a.quote.slice(0, 160))}${a.quote.length > 160 ? "…" : ""}”</div>` : "";
    const text = a.text ? `<div class="hyp-text">${esc(a.text).replace(/\n/g, "<br>")}</div>` : "";
    return `<div class="hyp-item">${quote}${text}<div class="hyp-meta">☁️ Hypothes.is · ${new Date(a.created).toLocaleDateString("zh-CN")}</div></div>`;
  }

  async function hypBackfill() {
    const slots = $view.querySelectorAll(".hyp-slot");
    const chip = document.getElementById("hyp-stat-chip");
    const extra = document.getElementById("hyp-extra");
    if (!slots.length && !chip && !extra) return;
    let byId;
    try { byId = await hypFetchAll(); }
    catch (e) {
      // 直连失败时退回仓库内每周归档的静态副本（可能滞后）
      const fb = window.EAI_ANNOTATIONS && window.EAI_ANNOTATIONS.byId;
      if (fb) byId = fb;
      else { slots.forEach(s => s.remove()); return; }
    }
    slots.forEach(slot => {
      const list = byId[slot.dataset.ax] || [];
      if (!list.length) { slot.remove(); return; }
      const open = slot.classList.contains("open");
      const shown = open ? list.slice(0, 10) : list.slice(0, 2);
      slot.innerHTML = `
        <div class="hyp-head">📝 Hypothes.is 公开批注 <b>${list.length}</b> 条${open ? "" : ` <span class="hyp-more-hint">（显示最新 2 条）</span>`}</div>
        ${shown.map(hypItemHtml).join("")}
        <a class="hyp-more" href="https://hypothes.is/users/ljh_qh" target="_blank" rel="noopener">${open && list.length > 10 ? `…共 ${list.length} 条，` : ""}查看全部 ↗</a>`;
    });
    // 统计胶囊 + 「有批注但未入库」分组（仅阅读库页）
    if (chip) {
      const inLib = Object.keys(byId).filter(ax => libEntries().some(x => hypAxId(x.e.paper.url) === ax)).length;
      chip.textContent = inLib ? `📝 在库论文云端批注 ${inLib} 篇` : "📝 云端批注 0 篇";
      chip.style.display = "";
    }
    const extraEl = extra;
    if (extraEl) {
      const lib = libAll();
      const listed = new Set(libEntries().map(x => hypAxId(x.e.paper.url)));
      const orphans = allPapers.filter(x => !lib[x.paper.id] && byId[hypAxId(x.paper.url)] && !listed.has(hypAxId(x.paper.url)));
      if (orphans.length) {
        extraEl.innerHTML = `
          <div class="tl-year">
            <div class="tl-year-label">📝 有批注、未入阅读库<small>${orphans.length} 篇 · 在 Hypothes.is 里批注过但还没标记阅读状态</small></div>
            <div class="tl-items">${orphans.map(x => `
              <div class="tl-item" style="--mc:${x.mod.color}" data-nav="#/m/${x.mod.id}/${x.diff.id}/${x.paper.id}">
                <div class="ti-name">${esc(x.paper.name)}
                  <span class="pc-year">${x.paper.year} · ${esc(x.paper.venue)}</span>
                  ${libPillHtml(x.paper.id)}
                </div>
                <div class="ti-path">${esc(x.mod.name)} › ${esc(x.diff.name)} · ${byId[hypAxId(x.paper.url)].length} 条批注</div>
              </div>`).join("")}</div>
          </div>`;
      }
    }
  }

  function arxivLinksHtml(p) {
    if (!p.url || !/arxiv\.org\/abs\//.test(p.url)) return "";
    return `<span class="pc-links">
      <a href="${esc(p.url.replace("/abs/", "/pdf/"))}" target="_blank" rel="noopener" title="下载 PDF">PDF↗</a>
      <a href="${esc(p.url.replace("/abs/", "/html/"))}" target="_blank" rel="noopener" title="arXiv HTML 全文（配合沉浸式翻译可双语阅读）">HTML↗</a>
      <a href="${esc(p.url.replace("/abs/", "/html/"))}" target="_blank" rel="noopener" title="打开 arXiv HTML 全文：装一次 Hypothes.is 扩展或书签工具，即可在侧栏选中段落高亮+批注（云端保存）">📝 批注</a>
    </span>`;
  }

  function libEntries() {
    const lib = libAll();
    return allPapers.filter(e => lib[e.paper.id]).map(e => ({ e, rec: lib[e.paper.id] }));
  }

  function renderLibrary() {
    setCrumb([{ label: "全景", hash: "#/" }, { label: "阅读库", hash: "#/library" }]);
    const entries = libEntries();
    const cnt = k => entries.filter(x => x.rec.status === k).length;
    const stLabel = k => { const s = LIB_ST.find(v => v.key === k); return s ? `${s.icon} ${s.label}` : "未标记"; };

    const head = `
      <div class="tl-head">
        <h2>📚 我的阅读库</h2>
        <p>在任意论文卡片上点「＋ 标记」或在详情页选择阅读状态、写笔记，都会汇聚到这里，<b>按图谱的模块 → 难点自动归类</b>。全文批注请先装一次 <a href="https://chrome.google.com/webstore/detail/hypothesis-web-pdf-annota/bjfhmglciegochdpefhhlphglcehbmek" target="_blank" rel="noopener">Hypothes.is 浏览器扩展</a>（Chrome/Edge/Brave），或把 <a href="https://web.hypothes.is/start/" target="_blank" rel="noopener">书签工具 Bookmarklet</a>（Firefox/Safari）拖到书签栏；然后点论文的 📝 批注 打开 arXiv HTML 全文，侧栏里选中任意段落即可高亮+写批注（云端保存，跨设备同步），配「沉浸式翻译」扩展可双语对照。你公开发布的段落批注会自动回显到本页和论文详情页；私人状态与笔记仅存本地浏览器，换设备请用 JSON 导出 / 导入。</p>
      </div>`;

    if (!entries.length) {
      $view.innerHTML = head + `
        <div class="lib-empty">
          <div class="le-icon">🔖</div>
          <p>还没有标记任何论文。</p>
          <p class="le-sub">去图谱里逛逛，遇到想读的论文点卡片右上角的「＋ 标记」吧。</p>
          <div class="le-actions">
            <button class="tool-btn primary" data-nav="#/">⌂ 浏览图谱</button>
            <button class="tool-btn" id="lib-import-btn">📥 导入 JSON</button>
            <input type="file" id="lib-import-file" accept=".json,application/json" hidden>
          </div>
        </div>
        <div id="hyp-extra"></div>`;
      wireImport();
      hypBackfill();
      return;
    }

    const byMod = {};
    entries.forEach(x => (byMod[x.e.mod.id] = byMod[x.e.mod.id] || []).push(x));
    const modStat = {};
    entries.forEach(x => { if (x.rec.status === "done") modStat[x.e.mod.name] = (modStat[x.e.mod.name] || 0) + 1; });

    const item = x => `
      <div class="tl-item" style="--mc:${x.e.mod.color}" data-nav="#/m/${x.e.mod.id}/${x.e.diff.id}/${x.e.paper.id}">
        <div class="ti-name">${esc(x.e.paper.name)}
          <span class="pc-year">${x.e.paper.year} · ${esc(x.e.paper.venue)}</span>
          <span class="lib-chip ${x.rec.status || ""}">${stLabel(x.rec.status)}</span>
        </div>
        <div class="ti-path">${esc(x.e.mod.name)} › ${esc(x.e.diff.name)}</div>
        ${x.rec.note ? `<div class="lib-note-text">📝 ${esc(x.rec.note)}</div>` : ""}
        ${hypSlotHtml(x.e.paper)}
      </div>`;

    $view.innerHTML = head + `
      <div class="lib-stats">
        <span class="year-chip"><b>${entries.length}</b> 篇在库</span>
        ${LIB_ST.map(s => `<span class="year-chip">${s.icon} ${s.label} <b>${cnt(s.key)}</b></span>`).join("")}
        ${Object.entries(modStat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) =>
          `<span class="year-chip">📚 ${esc(m)} 已读 <b>${n}</b></span>`).join("")}
        <span class="year-chip" id="hyp-stat-chip" style="display:none"></span>
      </div>
      <div class="lib-export">
        <button class="tool-btn" id="lib-md">⬇️ Markdown 大纲</button>
        <button class="tool-btn" id="lib-bib">⬇️ BibTeX（进 Zotero）</button>
        <button class="tool-btn" id="lib-json">⬇️ JSON 备份</button>
        <button class="tool-btn" id="lib-import-btn">📥 导入 JSON</button>
        <input type="file" id="lib-import-file" accept=".json,application/json" hidden>
        <button class="tool-btn lib-danger" id="lib-clear">🗑 清空</button>
      </div>
      ${MODULES.filter(m => byMod[m.id]).map(m => {
        const byDiff = {};
        byMod[m.id].forEach(x => (byDiff[x.e.diff.id] = byDiff[x.e.diff.id] || []).push(x));
        return `
        <div class="tl-year">
          <div class="tl-year-label">${m.icon} ${esc(m.name)}<small>${byMod[m.id].length} 篇 · 已读 ${byMod[m.id].filter(x => x.rec.status === "done").length}</small></div>
          ${Object.entries(byDiff).map(([did, arr]) => `
            <div class="dir-group-label">${esc(arr[0].e.diff.name)}<span>${arr.length} 篇</span></div>
            <div class="tl-items">${arr.map(item).join("")}</div>`).join("")}
        </div>`;
      }).join("")}
      <div id="hyp-extra"></div>`;

    document.getElementById("lib-md").addEventListener("click", () => libDownload("embodied-ai-阅读库.md", libMarkdown(entries), "text/markdown;charset=utf-8"));
    document.getElementById("lib-bib").addEventListener("click", () => libDownload("embodied-ai-阅读库.bib", libBibtex(entries), "application/x-bibtex;charset=utf-8"));
    document.getElementById("lib-json").addEventListener("click", () => libDownload("embodied-ai-阅读库.json",
      JSON.stringify({ version: 1, exported: new Date().toISOString(), papers: libAll() }, null, 2), "application/json"));
    document.getElementById("lib-clear").addEventListener("click", () => {
      if (confirm("确定清空全部阅读状态与笔记？此操作不可恢复（建议先导出 JSON 备份）。")) {
        libSaveAll({});
        renderLibrary();
      }
    });
    wireImport();
    hypBackfill();
  }

  function wireImport() {
    const btn = document.getElementById("lib-import-btn");
    const file = document.getElementById("lib-import-file");
    if (!btn || !file) return;
    btn.addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const f = file.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const data = JSON.parse(rd.result);
          const incoming = data && typeof data.papers === "object" ? data.papers : data;
          if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("bad");
          const valid = Object.entries(incoming).filter(([k, v]) => k && v && typeof v === "object" && (v.status || v.note));
          if (!valid.length) throw new Error("empty");
          const merged = libAll();
          valid.forEach(([k, v]) => merged[k] = { status: v.status || null, note: v.note || "", ts: v.ts || Date.now() });
          libSaveAll(merged);
          alert(`导入成功：合并 ${valid.length} 条记录（已覆盖同 ID 项）`);
          renderLibrary();
        } catch (e) {
          alert("导入失败：文件不是有效的阅读库 JSON（应为本站导出的备份文件）。");
        }
      };
      rd.readAsText(f);
    });
  }

  function libDownload(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function libMarkdown(entries) {
    const cnt = k => entries.filter(x => x.rec.status === k).length;
    const stLabel = k => { const s = LIB_ST.find(v => v.key === k); return s ? `${s.icon} ${s.label}` : "▫️ 未标记"; };
    const L = ["# 具身智能研究图谱 · 我的阅读库", "",
      `> 导出于 ${new Date().toLocaleString("zh-CN")} · 共 ${entries.length} 篇（想读 ${cnt("want")} / 在读 ${cnt("reading")} / 已读 ${cnt("done")}）`, ""];
    const byMod = {};
    entries.forEach(x => (byMod[x.e.mod.id] = byMod[x.e.mod.id] || []).push(x));
    MODULES.filter(m => byMod[m.id]).forEach(m => {
      L.push(`## ${m.icon} ${m.name}`, "");
      const byDiff = {};
      byMod[m.id].forEach(x => (byDiff[x.e.diff.id] = byDiff[x.e.diff.id] || []).push(x));
      Object.entries(byDiff).forEach(([did, arr]) => {
        L.push(`### ${arr[0].e.diff.name}`, "");
        arr.forEach(x => {
          const p = x.e.paper;
          L.push(`- [${stLabel(x.rec.status)}] **${p.name}** — ${p.title}（${p.venue}）`);
          if (p.url) L.push(`  - ${p.url}`);
          if (x.rec.note) x.rec.note.split("\n").forEach(ln => L.push(`  - 📝 ${ln}`));
        });
        L.push("");
      });
    });
    return L.join("\n");
  }

  function libBibtex(entries) {
    return entries.map(x => {
      const p = x.e.paper;
      const key = p.id.replace(/[^a-zA-Z0-9_]/g, "");
      const title = p.title.replace(/[{}]/g, "");
      const ax = p.url && /arxiv\.org\/abs\/([\d.]+)/.exec(p.url);
      const st = x.rec.status ? LIB_ST.find(s => s.key === x.rec.status).label : "未标记";
      const lines = [`@misc{${key},`, `  title = {${title}},`, `  year = {${p.year}},`];
      if (ax) lines.push(`  eprint = {${ax[1]}},`, `  archivePrefix = {arXiv},`);
      else if (p.url) lines.push(`  url = {${p.url}},`);
      lines.push(`  note = {${p.venue} · 图谱: ${x.e.mod.name} › ${x.e.diff.name} · ${st}}`, `}`);
      return lines.join("\n");
    }).join("\n\n");
  }

  // 顶栏「阅读库」入口
  const libTop = document.createElement("button");
  libTop.className = "tool-btn";
  libTop.textContent = "📚 阅读库";
  libTop.addEventListener("click", () => nav("#/library"));
  document.querySelector(".toolbar").insertBefore(libTop, subTop);

  /* ── 事件绑定 ── */
  document.body.addEventListener("click", ev => {
    // 卡片内直达链接（PDF/HTML）：走浏览器默认行为，不触发卡片跳转
    if (ev.target.closest("a[href]")) return;
    // 阅读状态胶囊：点击循环 想读→在读→已读→清除，原地刷新
    const pill = ev.target.closest(".lib-pill");
    if (pill) {
      libCycle(pill.dataset.lib);
      pill.outerHTML = libPillHtml(pill.dataset.lib);
      return;
    }
    // 详情页分段状态按钮
    const seg = ev.target.closest(".lib-seg");
    if (seg) {
      const id = seg.dataset.lib;
      const rec = libGet(id) || { note: "" };
      rec.status = rec.status === seg.dataset.status ? null : seg.dataset.status;
      rec.ts = Date.now();
      libSet(id, rec);
      const cur = (libGet(id) || {}).status;
      seg.parentElement.querySelectorAll(".lib-seg").forEach(b => b.classList.toggle("active", b.dataset.status === cur));
      return;
    }
    const navEl = ev.target.closest("[data-nav]");
    if (navEl) {
      if (navEl.hasAttribute("data-close-overlay")) $searchOverlay.classList.add("hidden");
      nav(navEl.getAttribute("data-nav"));
      return;
    }
    if (ev.target.closest("[data-close]")) {
      ev.target.closest(".overlay").classList.add("hidden");
      return;
    }
    if (ev.target.classList.contains("overlay")) ev.target.classList.add("hidden");
  });

  // 笔记失焦自动保存
  document.body.addEventListener("change", ev => {
    if (ev.target.classList && ev.target.classList.contains("lib-note")) {
      const id = ev.target.dataset.lib;
      const rec = libGet(id) || {};
      rec.note = ev.target.value;
      rec.ts = Date.now();
      libSet(id, rec);
    }
  });

  document.getElementById("btn-home").addEventListener("click", () => nav("#/"));
  document.getElementById("btn-timeline").addEventListener("click", () => nav("#/timeline"));
  document.getElementById("btn-venues").addEventListener("click", () => nav("#/venues"));
  document.getElementById("btn-rank").addEventListener("click", () => nav("#/rank"));
  document.getElementById("btn-about").addEventListener("click", () => document.getElementById("about-overlay").classList.remove("hidden"));
  document.getElementById("btn-search").addEventListener("click", () => {
    $searchOverlay.classList.remove("hidden");
    doSearch($searchInput.value);
    $searchInput.focus();
  });
  $searchInput.addEventListener("input", () => doSearch($searchInput.value));
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape") document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
    if ((ev.metaKey || ev.ctrlKey) && ev.key === "k") {
      ev.preventDefault();
      $searchOverlay.classList.remove("hidden");
      doSearch($searchInput.value);
      $searchInput.focus();
    }
  });

  window.addEventListener("hashchange", route);
  route();
})();
