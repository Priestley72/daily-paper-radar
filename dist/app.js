const state = { editions: [], edition: null, filter: "all", query: "", year: 0, month: 0, articles: {} };
const element = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" ? escapeHtml(url.href) : ""; }
  catch { return ""; }
}
function pageUrl(date, paperId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("date", date);
  if (paperId) url.searchParams.set("paper", paperId);
  return `${url.pathname}${url.search}`;
}
function topics() { return [...new Set(state.edition.papers.flatMap((paper) => paper.topics || []))]; }
function closeCalendar() {
  element("calendarPanel").hidden = true;
  element("calendarToggle").setAttribute("aria-expanded", "false");
}
function renderCalendar() {
  const dates = new Set(state.editions.map((item) => item.date));
  const years = [...new Set(state.editions.map((item) => Number(item.date.slice(0, 4))))].sort((a, b) => b - a);
  if (!years.includes(state.year)) years.push(state.year);
  element("calendarYear").innerHTML = years.map((year) => `<option value="${year}">${year} 年</option>`).join("");
  element("calendarYear").value = String(state.year);
  element("calendarMonth").innerHTML = Array.from({ length: 12 }, (_, index) => `<option value="${index}">${index + 1} 月</option>`).join("");
  element("calendarMonth").value = String(state.month);
  const firstWeekday = (new Date(state.year, state.month, 1).getDay() + 6) % 7;
  const dayCount = new Date(state.year, state.month + 1, 0).getDate();
  let cells = '<span class="calendar-blank"></span>'.repeat(firstWeekday);
  for (let day = 1; day <= dayCount; day++) {
    const date = `${state.year}-${String(state.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const available = dates.has(date);
    cells += `<button type="button" class="calendar-day${available ? " has-edition" : ""}" data-date="${date}" ${available ? "" : "disabled"} ${date === state.edition.date ? 'aria-current="date"' : ""} aria-label="${date}${available ? "，已收录" : "，暂无收录"}">${day}</button>`;
  }
  element("calendarDays").innerHTML = cells;
}
function renderFilters() {
  const filters = [["all", "全部"], ["priority", "优先阅读"], ...topics().map((topic) => [`topic:${topic}`, topic])];
  element("topicFilters").innerHTML = filters.map(([value, label]) =>
    `<button class="filter-button" type="button" data-filter="${escapeHtml(value)}" aria-pressed="${state.filter === value}">${escapeHtml(label)}</button>`
  ).join("");
}
function setEdition(date, push = true) {
  const edition = state.editions.find((item) => item.date === date) || state.editions[0];
  state.edition = edition; state.filter = "all"; state.query = "";
  element("searchInput").value = "";
  const [year, month] = edition.date.split("-").map(Number);
  state.year = year; state.month = month - 1;
  element("selectedDate").textContent = edition.date;
  element("editionTitle").textContent = edition.title;
  element("editionSummary").textContent = edition.summary;
  element("editionCount").textContent = `${edition.date} · 已收录 ${edition.papers.length} 篇`;
  element("articleView").hidden = true;
  element("editionTitle").closest(".edition-intro").hidden = false;
  element("paperHeading").closest(".library").hidden = false;
  document.title = `${edition.date} · Daily Paper Radar`;
  if (push) history.pushState(null, "", pageUrl(edition.date));
  renderCalendar(); closeCalendar(); renderFilters(); renderPapers();
}
function paperCard(paper, index) {
  const href = pageUrl(state.edition.date, paper.id);
  return `<article class="paper-card">
    <span class="paper-number">[${String(index + 1).padStart(2, "0")}]</span>
    <div><div class="paper-heading"><h3 class="paper-title"><a href="${escapeHtml(href)}" data-internal>${escapeHtml(paper.title)}</a></h3>${paper.priority ? `<span class="priority">优先读 #${escapeHtml(paper.priority)}</span>` : ""}</div>
      <div class="paper-meta">${(paper.topics || []).map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`).join("")}<span class="authors">${escapeHtml(paper.authors)}</span></div>
      <p class="explainer">${escapeHtml(paper.explainer)}</p>
      ${paper.why ? `<p class="why"><strong>为什么值得看：</strong>${escapeHtml(paper.why)}</p>` : ""}
      <a class="read-link" href="${escapeHtml(href)}" data-internal>${state.articles[paper.id] ? "阅读精读" : "查看论文详情"} →</a>
    </div></article>`;
}
function renderPapers() {
  const query = state.query.trim().toLocaleLowerCase("zh-CN");
  const papers = state.edition.papers.filter((paper) => {
    const matchesFilter = state.filter === "all" || (state.filter === "priority" && Boolean(paper.priority)) || (state.filter.startsWith("topic:") && paper.topics?.includes(state.filter.slice(6)));
    const searchable = [paper.title, paper.authors, paper.explainer, paper.why, ...(paper.topics || [])].join(" ").toLocaleLowerCase("zh-CN");
    return matchesFilter && (!query || searchable.includes(query));
  });
  element("resultCount").textContent = `显示 ${papers.length} / ${state.edition.papers.length} 篇`;
  element("emptyState").hidden = papers.length > 0;
  element("paperList").innerHTML = papers.map(paperCard).join("");
}
function renderArticle(paper, push = true) {
  const detail = state.articles[paper.id];
  const links = [["Hugging Face", paper.huggingface], ["arXiv 原文", paper.arxiv], ["项目主页", paper.project], ["代码仓库", paper.github]];
  const uniqueLinks = [...new Map(links.filter(([, url]) => safeUrl(url)).map(([label, url]) => [url, [label, url]])).values()];
  element("articleView").innerHTML = `<a class="back-link" href="${escapeHtml(pageUrl(state.edition.date))}" data-internal>← 返回 ${escapeHtml(state.edition.date)} 论文列表</a>
    <div class="article-kicker">${escapeHtml(state.edition.date)} · ${detail ? "论文精读" : "论文详情"}</div>
    <h1>${escapeHtml(paper.title)}</h1>
    <p class="article-authors">${escapeHtml(paper.authors)}</p>
    <div class="paper-meta">${(paper.topics || []).map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`).join("")}</div>
    <div class="article-lead"><p>${escapeHtml(paper.explainer)}</p><p><strong>为什么值得看：</strong>${escapeHtml(paper.why || "暂无编辑判断。")}</p></div>
    ${detail ? detail.sections.map((section) => `<section class="article-section"><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("") : '<section class="article-section"><h2>精读状态</h2><p>这篇论文目前只收录了快速筛选介绍，尚未完成基于论文原文的精读。请从下方链接查看原文。</p></section>'}
    <div class="article-sources"><h2>论文与项目链接</h2>${uniqueLinks.map(([label, url]) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`).join("")}</div>`;
  element("editionTitle").closest(".edition-intro").hidden = true;
  element("paperHeading").closest(".library").hidden = true;
  element("articleView").hidden = false;
  document.title = `${paper.title} · Daily Paper Radar`;
  if (push) history.pushState(null, "", pageUrl(state.edition.date, paper.id));
  window.scrollTo(0, 0);
}
function route(push = false) {
  const params = new URLSearchParams(window.location.search);
  setEdition(params.get("date"), push);
  const paper = state.edition.papers.find((item) => item.id === params.get("paper"));
  if (paper) renderArticle(paper, false);
  else if (params.has("paper")) history.replaceState(null, "", pageUrl(state.edition.date));
}
element("calendarToggle").addEventListener("click", () => {
  const panel = element("calendarPanel");
  panel.hidden = !panel.hidden;
  element("calendarToggle").setAttribute("aria-expanded", String(!panel.hidden));
});
element("calendarYear").addEventListener("change", (event) => { state.year = Number(event.target.value); renderCalendar(); });
element("calendarMonth").addEventListener("change", (event) => { state.month = Number(event.target.value); renderCalendar(); });
function moveMonth(delta) {
  const date = new Date(state.year, state.month + delta, 1);
  state.year = date.getFullYear(); state.month = date.getMonth(); renderCalendar();
}
element("prevMonth").addEventListener("click", () => moveMonth(-1));
element("nextMonth").addEventListener("click", () => moveMonth(1));
element("calendarDays").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-date]");
  if (button && !button.disabled) setEdition(button.dataset.date);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".calendar-wrap")) closeCalendar();
  const link = event.target.closest("a[data-internal]");
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  const date = url.searchParams.get("date");
  const paperId = url.searchParams.get("paper");
  setEdition(date, false);
  if (paperId) {
    const paper = state.edition.papers.find((item) => item.id === paperId);
    if (paper) renderArticle(paper, false);
  }
  history.pushState(null, "", `${url.pathname}${url.search}`);
  window.scrollTo(0, 0);
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeCalendar(); });
window.addEventListener("popstate", () => route());
element("searchInput").addEventListener("input", (event) => { state.query = event.target.value; renderPapers(); });
element("topicFilters").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter; renderFilters(); renderPapers();
});
Promise.all([
  fetch("./data/papers.json").then((response) => { if (!response.ok) throw new Error("期次加载失败"); return response.json(); }),
  fetch("./data/articles.json").then((response) => response.ok ? response.json() : {})
]).then(([editions, articles]) => {
  if (!Array.isArray(editions) || editions.length === 0) throw new Error("暂无可浏览的期次");
  state.editions = editions; state.articles = articles; route();
}).catch((error) => {
  element("editionTitle").textContent = "内容暂时无法加载";
  element("editionSummary").textContent = error.message;
});
