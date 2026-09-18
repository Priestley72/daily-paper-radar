const state = { editions: [], edition: null, topic: "全部", query: "" };

const $ = (id) => document.getElementById(id);
const normalize = (value) => (value || "").toLocaleLowerCase("zh-CN");

async function load() {
  const response = await fetch("./data/papers.json");
  if (!response.ok) throw new Error("无法加载论文数据");
  state.editions = await response.json();
  state.edition = state.editions[0];
  renderEditionSelect();
  render();
}

function renderEditionSelect() {
  $("editionSelect").innerHTML = state.editions
    .map((item) => `<option value="${item.date}">${item.date}</option>`)
    .join("");
}

function render() {
  const edition = state.edition;
  document.title = `${edition.date} · Daily Paper Radar`;
  $("editionTitle").textContent = edition.title;
  $("editionSummary").textContent = edition.summary;
  $("paperCount").textContent = edition.papers.length;
  const topics = [...new Set(edition.papers.flatMap((paper) => paper.topics))];
  $("topicCount").textContent = topics.length;
  $("priorityCount").textContent = edition.papers.filter((paper) => paper.priority).length;
  renderFilters(topics);
  renderPapers();
}

function renderFilters(topics) {
  const options = ["全部", ...topics];
  if (!options.includes(state.topic)) state.topic = "全部";
  $("topicFilters").innerHTML = options.map((topic) =>
    `<button class="filter ${state.topic === topic ? "active" : ""}" data-topic="${topic}">${topic}</button>`
  ).join("");
}

function renderPapers() {
  const query = normalize(state.query.trim());
  const papers = state.edition.papers.filter((paper) => {
    const matchesTopic = state.topic === "全部" || paper.topics.includes(state.topic);
    const haystack = normalize([paper.title, paper.authors, paper.explainer, paper.why, ...paper.topics].join(" "));
    return matchesTopic && (!query || haystack.includes(query));
  });
  $("resultCount").textContent = `显示 ${papers.length} / ${state.edition.papers.length} 篇`;
  $("emptyState").hidden = papers.length !== 0;
  $("paperGrid").innerHTML = papers.map(card).join("");
}

function card(paper) {
  const links = [
    ["Hugging Face", paper.huggingface],
    ["arXiv", paper.arxiv],
    ["项目主页", paper.project],
    ["代码", paper.github]
  ].filter(([, url]) => url);
  return `
    <article class="paper-card ${paper.priority ? "priority" : ""}">
      <div class="card-top">
        <div class="tags">${paper.topics.map((topic) => `<span class="tag">${topic}</span>`).join("")}</div>
        ${paper.priority ? `<span class="rank">优先阅读 #${paper.priority}</span>` : ""}
      </div>
      <h3>${paper.title}</h3>
      <p class="authors">${paper.authors}</p>
      <p class="plain">${paper.explainer}</p>
      <p class="why"><strong>为什么值得看：</strong>${paper.why}</p>
      <div class="links">${links.map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer">${label} ↗</a>`).join("")}</div>
    </article>`;
}

$("editionSelect").addEventListener("change", (event) => {
  state.edition = state.editions.find((item) => item.date === event.target.value);
  state.topic = "全部";
  render();
});
$("searchInput").addEventListener("input", (event) => { state.query = event.target.value; renderPapers(); });
$("topicFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-topic]");
  if (!button) return;
  state.topic = button.dataset.topic;
  renderFilters([...new Set(state.edition.papers.flatMap((paper) => paper.topics))]);
  renderPapers();
});

load().catch((error) => {
  $("editionTitle").textContent = "内容暂时无法加载";
  $("editionSummary").textContent = error.message;
});
