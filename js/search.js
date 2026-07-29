(() => {
  const DB_PATHS = window.SEARCH_DB_PATHS || [
    "/json/article.json",
    "/json/histoire.json",
  ];
  const NO_RESULT_TEXT = "什么也没有找到说 QAQ";
  const PLACEHOLDERS = [
    "要找些什么呢 qaq",
    "昵嘻嘻，让我看看你要搜什么",
    "莫忘也用眼睛搜索窗外哦！",
    "欸，今天也有你感兴趣的东西吗？",
    "其实萝卜干比榨菜好吃",
    "我觉得数学题的答案大概是搜不到的",
    "试试搜索心中所想呢？",
    "风与风铃夜与夜莺~草莓熊最好了",
    "海豚是否会梦见地铁",
    "就像泪水消逝在雨中，迎来死亡",
    "我们总会穿越风暴，成为另一个人",
    "不要在酒吧点炒饭",
    "清晨的第一缕光丝，你还记得吗？",
  ];

  let entriesRequest = null;

  const normalize = (value) =>
    String(value || "").normalize("NFKC").trim().toLocaleLowerCase();

  const getTerms = (query) => normalize(query).split(/\s+/).filter(Boolean);

  const getSearchText = (entry) =>
    normalize(
      [
        entry.title,
        entry.description,
        ...(Array.isArray(entry.tags) ? entry.tags.map((tag) => tag?.name) : []),
      ].join(" ")
    );

  const rankMatch = (entry, query, terms) => {
    const title = normalize(entry.title);
    const searchable = getSearchText(entry);
    if (!terms.every((term) => searchable.includes(term))) return 0;
    if (title === query) return 4;
    if (title.includes(query)) return 3;
    if (searchable.includes(query)) return 2;
    return 1;
  };

  const loadEntries = () => {
    if (entriesRequest) return entriesRequest;
    if (!window.CoreList?._loadDatabases) return Promise.resolve([]);

    entriesRequest = window.CoreList
      ._loadDatabases(DB_PATHS)
      .then((entries) => (Array.isArray(entries) ? entries : []))
      .catch((error) => {
        console.warn("Search: failed to load entries", error);
        return [];
      });
    return entriesRequest;
  };

  const sortResults = (results) =>
    results.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftDate = new Date(
        left.entry.updated_at || left.entry.created_at || 0
      ).getTime();
      const rightDate = new Date(
        right.entry.updated_at || right.entry.created_at || 0
      ).getTime();
      return rightDate - leftDate;
    });

  const renderResults = (mount, results) => {
    mount.replaceChildren();

    if (!results.length) {
      const message = document.createElement("p");
      message.className = "text-center";
      message.textContent = NO_RESULT_TEXT;
      mount.appendChild(message);
      return;
    }

    const container = document.createElement("div");
    container.className = "mt-container";
    const fragment = document.createDocumentFragment();
    results.forEach(({ entry }) => {
      fragment.appendChild(
        window.CoreList._createTile(entry, { autoFormatDisplay: true })
      );
    });
    container.appendChild(fragment);
    mount.appendChild(container);
  };

  const init = () => {
    const form = document.getElementById("searchForm");
    const input = document.getElementById("searchInput");
    const button = document.getElementById("searchButton");
    const mount = document.getElementById("mt-list");
    const status = document.getElementById("searchStatus");
    if (!form || !input || !button || !mount || !status) return;

    input.placeholder = PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = normalize(input.value);
      if (!query) {
        input.setCustomValidity("请输入关键词");
        input.reportValidity();
        input.setCustomValidity("");
        input.focus();
        return;
      }

      button.disabled = true;
      status.textContent = "搜索中…";
      const terms = getTerms(query);
      const entries = await loadEntries();
      const results = sortResults(
        entries
          .map((entry) => ({ entry, score: rankMatch(entry, query, terms) }))
          .filter(({ score }) => score > 0)
      );
      renderResults(mount, results);
      status.textContent = results.length ? `找到 ${results.length} 项结果` : NO_RESULT_TEXT;
      button.disabled = false;
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
