const state = { editions: [], edition: null, filter: "all", query: "" };
const element = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? escapeHtml(url.href) : "";
  } catch {
    return "";
  }
}

function topics() {
  return [...new Set(state.edition.papers.flatMap((paper) => paper.topics || []))];
}

function setEdition(date) {
  const edition = state.editions.find((item) => item.date === date) || state.editions[0];
  state.edition = edition;
  state.filter = "all";
  state.query = "";
  element("searchInput").value = "";
  element("editionSelect").value = edition.date;
  document.title = `${edition.date} · Daily Paper Radar`;
  element("editionTitle").textContent = edition.title;
  element("editionSummary").textContent = edition.summary;
  element("editionCount").textContent = `${edition.date} · 已收录 ${edition.papers.length} 篇`;
  const address = new URL(window.location.href);
  address.searchParams.set("date", edition.date);
  history.replaceState(null, "", address);
  renderFilters();
  renderPapers();
}

function renderFilters() {
  const filters = [["all", "全部"], ["priority", "优先阅读"], ...topics().map((topic) => [`topic:${topic}`, topic])];
  element("topicFilters").innerHTML = filters.map(([value, label]) =>
    `<button class="filter-button" type="button" data-filter="${escapeHtml(value)}" aria-pressed="${state.filter === value}">${escapeHtml(label)}</button>`
  ).join("");
}

function paperCard(paper, index) {
  const links = [
    ["Hugging Face", paper.huggingface], ["arXiv", paper.arxiv],
    ["项目", paper.project], ["代码", paper.github]
  ];
  const uniqueLinks = [...new Map(links.filter(([, url]) => safeUrl(url)).map(([label, url]) => [url, [label, url]])).values()];
  const titleUrl = safeUrl(paper.huggingface) || safeUrl(paper.arxiv);
  const title = escapeHtml(paper.title);
  return `<article class="paper-card">
    <span class="paper-number">[${String(index + 1).padStart(2, "0")}]</span>
    <div>
      <div class="paper-heading">
        <h3 class="paper-title">${titleUrl ? `<a href="${titleUrl}" target="_blank" rel="noopener noreferrer">${title} ↗</a>` : title}</h3>
        ${paper.priority ? `<span class="priority">优先读 #${escapeHtml(paper.priority)}</span>` : ""}
      </div>
      <div class="paper-meta">
        ${(paper.topics || []).map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`).join("")}
        <span class="authors">${escapeHtml(paper.authors)}</span>
      </div>
      <p class="explainer">${escapeHtml(paper.explainer)}</p>
      ${paper.why ? `<p class="why"><strong>为什么值得看：</strong>${escapeHtml(paper.why)}</p>` : ""}
      <div class="paper-links">${uniqueLinks.map(([label, url]) =>
        `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`
      ).join("")}</div>
    </div>
  </article>`;
}

function renderPapers() {
  const query = state.query.trim().toLocaleLowerCase("zh-CN");
  const papers = state.edition.papers.filter((paper) => {
    const matchesFilter = state.filter === "all"
      || (state.filter === "priority" && Boolean(paper.priority))
      || (state.filter.startsWith("topic:") && paper.topics?.includes(state.filter.slice(6)));
    const searchable = [paper.title, paper.authors, paper.explainer, paper.why, ...(paper.topics || [])]
      .join(" ").toLocaleLowerCase("zh-CN");
    return matchesFilter && (!query || searchable.includes(query));
  });
  element("resultCount").textContent = `显示 ${papers.length} / ${state.edition.papers.length} 篇`;
  element("emptyState").hidden = papers.length > 0;
  element("paperList").innerHTML = papers.map(paperCard).join("");
}

element("editionSelect").addEventListener("change", (event) => setEdition(event.target.value));
element("searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderPapers();
});
element("topicFilters").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  renderFilters();
  renderPapers();
});

fetch("./data/papers.json")
  .then((response) => {
    if (!response.ok) throw new Error("数据加载失败");
    return response.json();
  })
  .then((editions) => {
    if (!Array.isArray(editions) || editions.length === 0) throw new Error("暂无可浏览的期次");
    state.editions = editions;
    element("editionSelect").innerHTML = editions.map((item) =>
      `<option value="${escapeHtml(item.date)}">${escapeHtml(item.date)}</option>`
    ).join("");
    setEdition(new URLSearchParams(window.location.search).get("date"));
  })
  .catch((error) => {
    element("editionTitle").textContent = "内容暂时无法加载";
    element("editionSummary").textContent = error.message;
  });
