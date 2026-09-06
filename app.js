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
    if (openPaperId) {
      requestAnimationFrame(() => {
        const el = $view.querySelector(".paper-detail");
        if (el) el.scrollIntoView({ block: "start" });
      });
    }
  }

  function detailHtml(mod, diff, p) {
    const links = [];
    if (p.url) {
      links.push(`<a href="${esc(p.url)}" target="_blank" rel="noopener">查看原文 ↗</a>`);
      if (/arxiv\.org\/abs\//.test(p.url)) {
        links.push(`<a href="${esc(p.url.replace("/abs/", "/pdf/"))}" target="_blank" rel="noopener">PDF</a>`);
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
      </div>`).join("") : `<div class="search-empty">没有找到匹配「${esc(q)}」的论文。</div>`;
  }

  /* ── 事件绑定 ── */
  document.body.addEventListener("click", ev => {
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
