const state = {
  query: "",
  category: "",
  pricing: "",
  price: "",
  difficulty: "",
  korean: "",
  api: "",
  freePlanOnly: false,
  sort: "rating",
  compareIds: JSON.parse(localStorage.getItem("aiCompareIds") || "[]")
};

const els = {
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  pricingFilter: document.querySelector("#pricingFilter"),
  priceFilter: document.querySelector("#priceFilter"),
  difficultyFilter: document.querySelector("#difficultyFilter"),
  koreanFilter: document.querySelector("#koreanFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  resultCount: document.querySelector("#resultCount"),
  serviceList: document.querySelector("#serviceList"),
  emptyMessage: document.querySelector("#emptyMessage"),
  detailModal: document.querySelector("#detailModal"),
  modalContent: document.querySelector("#modalContent"),
  compareCount: document.querySelector("#compareCount"),
  compareTableWrap: document.querySelector("#compareTableWrap"),
  clearCompareBtn: document.querySelector("#clearCompareBtn"),
  categoryChips: document.querySelector("#categoryChips"),
  quickPanel: document.querySelector("#categoryQuick")
};

function init() {
  renderCategoryOptions();
  renderCategoryChips();
  bindEvents();
  renderServices();
  renderCompareTable();
}

function renderCategoryOptions() {
  const categories = [...new Set(aiServices.flatMap((service) => service.category))].sort((a, b) => a.localeCompare(b, "ko"));
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.appendChild(option);
  });
}

function renderCategoryChips() {
  if (!els.categoryChips) return;
  const categoryCounts = aiServices
    .flatMap((service) => service.category)
    .reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

  const priorityCategories = [
    "글쓰기",
    "이미지 생성",
    "영상 생성",
    "코딩",
    "리서치",
    "디자인",
    "자동화",
    "동영상 편집",
    "업무 생산성",
    "번역",
    "음성 합성",
    "음악 생성",
    "웹/UX/UI 디자인",
    "로컬 AI",
    "오픈소스"
  ];

  const categories = priorityCategories.filter((category) => categoryCounts[category] >= 2);
  els.categoryChips.innerHTML = [
    `<button class="chip active" type="button" data-chip-category="">전체</button>`,
    `<button class="chip" type="button" data-quick-free-plan="true">무료 플랜</button>`,
    `<button class="chip" type="button" data-quick-korean="true">한국어 지원</button>`,
    ...categories.map((category) => `<button class="chip" type="button" data-chip-category="${escapeAttribute(category)}">${escapeHtml(category)}</button>`)
  ].join("");
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderServices();
  });

  [
    ["categoryFilter", "category"],
    ["pricingFilter", "pricing"],
    ["priceFilter", "price"],
    ["difficultyFilter", "difficulty"],
    ["koreanFilter", "korean"],
    ["sortSelect", "sort"]
  ].forEach(([elementKey, stateKey]) => {
    els[elementKey].addEventListener("change", (event) => {
      state[stateKey] = event.target.value;
      state.freePlanOnly = false;
      if (stateKey === "category") updateActiveChip();
      renderServices();
    });
  });

  els.serviceList.addEventListener("click", handleCardClick);
  els.compareTableWrap.addEventListener("click", handleCompareClick);
  els.clearCompareBtn.addEventListener("click", clearCompareList);
  els.quickPanel?.addEventListener("click", handleQuickFilterClick);

  els.detailModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.detailModal.hidden) closeModal();
  });
}

function handleQuickFilterClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.classList.contains("chip")) {
    updateActiveChipButton(button);
  }

  if (button.dataset.quickCategory !== undefined) {
    setCategoryFilter(button.dataset.quickCategory);
  }

  if (button.dataset.quickPricing !== undefined) {
    state.freePlanOnly = false;
    state.pricing = button.dataset.quickPricing;
    els.pricingFilter.value = button.dataset.quickPricing;
    renderServices();
  }

  if (button.dataset.quickFreePlan !== undefined) {
    state.freePlanOnly = true;
    state.pricing = "";
    state.price = "";
    els.pricingFilter.value = "";
    els.priceFilter.value = "";
    renderServices();
    document.querySelector("#serviceList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (button.dataset.quickKorean !== undefined) {
    state.freePlanOnly = false;
    state.korean = button.dataset.quickKorean;
    els.koreanFilter.value = button.dataset.quickKorean;
    renderServices();
  }

  if (button.dataset.chipCategory !== undefined) {
    setCategoryFilter(button.dataset.chipCategory);
  }
}

function updateActiveChipButton(activeButton) {
  document.querySelectorAll(".chip").forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

function setCategoryFilter(category) {
  state.category = category;
  state.freePlanOnly = false;
  els.categoryFilter.value = category;
  updateActiveChip();
  renderServices();
  document.querySelector("#serviceList")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateActiveChip() {
  document.querySelectorAll("[data-chip-category]").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.chipCategory === state.category);
  });
}

function getFilteredServices() {
  return aiServices
    .filter(matchesSearch)
    .filter((service) => !state.category || service.category.includes(state.category))
    .filter((service) => !state.pricing || service.pricingType === state.pricing)
    .filter((service) => !state.freePlanOnly || service.hasFreePlan)
    .filter(matchesPrice)
    .filter((service) => !state.difficulty || service.difficulty === state.difficulty)
    .filter((service) => state.korean === "" || String(service.koreanSupport) === state.korean)
    .sort(sortServices);
}

function matchesSearch(service) {
  if (!state.query) return true;
  const searchable = [
    service.name,
    service.shortDescription,
    ...service.category,
    ...service.tags,
    ...service.recommendedUses
  ].join(" ").toLowerCase();

  return searchable.includes(state.query);
}

function matchesPrice(service) {
  const price = Number(service.monthlyPrice);
  if (!state.price) return true;
  if (state.price === "free") return price === 0 || service.pricingType === "무료";
  if (!Number.isFinite(price)) return false;
  if (state.price === "under20") return price > 0 && price < 20;
  if (state.price === "20to50") return price >= 20 && price < 50;
  if (state.price === "over50") return price >= 50;
  return true;
}

function sortServices(a, b) {
  if (state.sort === "price") {
    const priceA = Number.isFinite(Number(a.monthlyPrice)) ? Number(a.monthlyPrice) : Number.POSITIVE_INFINITY;
    const priceB = Number.isFinite(Number(b.monthlyPrice)) ? Number(b.monthlyPrice) : Number.POSITIVE_INFINITY;
    return priceA - priceB || b.rating - a.rating;
  }
  if (state.sort === "name") return a.name.localeCompare(b.name, "ko");
  if (state.sort === "updated") return new Date(b.updatedAt) - new Date(a.updatedAt);
  return b.rating - a.rating || a.name.localeCompare(b.name, "ko");
}

function renderServices() {
  const services = getFilteredServices();
  els.resultCount.textContent = services.length;
  els.emptyMessage.hidden = services.length > 0;
  els.serviceList.innerHTML = services.map((service) => createServiceCard(service)).join("");
}

function createServiceCard(service) {
  const compareLabel = state.compareIds.includes(service.id) ? "추가됨" : "비교에 추가";
  const strengths = service.strengths.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const tags = service.tags.slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

  return `
    <article class="service-card">
      <div class="card-top">
        <div>
          <div class="tool-icon" aria-hidden="true">
            <img src="${escapeAttribute(getLogoUrl(service))}" alt="" loading="lazy" onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
            <span hidden>${getServiceIcon(service)}</span>
          </div>
          <h3>${escapeHtml(service.name)}</h3>
          <div class="badge-row">${service.category.slice(0, 2).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}</div>
        </div>
        <span class="pill ${service.pricingType === "유료" ? "paid" : ""}">${escapeHtml(service.pricingType)}</span>
      </div>
      <p class="short-description">${escapeHtml(service.shortDescription)}</p>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">월 가격</span><span class="meta-value">${escapeHtml(service.priceText)}</span></div>
        <div class="meta-item"><span class="meta-label">추천 점수</span><span class="meta-value">${service.rating.toFixed(1)} / 5</span></div>
      </div>
      <ul class="mini-list">${strengths}</ul>
      <p class="use-case"><strong>추천 용도</strong> ${escapeHtml(service.recommendedUses.slice(0, 2).join(", "))}</p>
      <div class="tag-row">${tags}</div>
      <div class="card-actions">
        <button class="button button-secondary" type="button" data-action="detail" data-id="${service.id}">자세히 보기</button>
        <button class="button" type="button" data-action="compare" data-id="${service.id}" ${state.compareIds.includes(service.id) ? "disabled" : ""}>${compareLabel}</button>
      </div>
    </article>
  `;
}

function getLogoUrl(service) {
  try {
    if (!service.officialUrl || service.officialUrl === "#") return "";
    const hostname = new URL(service.officialUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch (error) {
    return "";
  }
}

function getServiceIcon(service) {
  const category = service.category.join(" ");
  if (category.includes("이미지")) return "🎨";
  if (category.includes("영상") || category.includes("동영상")) return "🎬";
  if (category.includes("코딩") || category.includes("개발")) return "⚙️";
  if (category.includes("검색") || category.includes("리서치")) return "🔎";
  if (category.includes("음성") || category.includes("오디오")) return "🔊";
  if (category.includes("음악")) return "🎵";
  if (category.includes("번역")) return "🌐";
  if (category.includes("자동화")) return "⚡";
  if (category.includes("디자인")) return "✨";
  return "🤖";
}

function handleCardClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const service = aiServices.find((item) => item.id === button.dataset.id);
  if (!service) return;

  if (button.dataset.action === "detail") openModal(service);
  if (button.dataset.action === "compare") addToCompare(service.id);
}

function openModal(service) {
  els.modalContent.innerHTML = `
    <div class="modal-title-row">
      <div>
        <p class="eyebrow">상세 정보</p>
        <h2 id="modalTitle">${escapeHtml(service.name)}</h2>
        <p>${escapeHtml(service.shortDescription)}</p>
        <div class="badge-row">${service.category.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <a class="official-link" href="${escapeAttribute(service.officialUrl)}" target="_blank" rel="noopener noreferrer">공식 주소 열기</a>
    </div>
    <div class="detail-grid">
      ${detailSection("기본 정보", [
        `무료/유료: ${service.pricingType}`,
        `난이도: ${service.difficulty}`,
        `한국어 지원: ${formatBoolean(service.koreanSupport)}`,
        `모바일 사용: ${formatBoolean(service.mobileAvailable)}`,
        `팀 협업: ${formatBoolean(service.teamFeatures)}`
      ])}
      ${detailSection("요금제 설명", [
        `구분: ${service.planType}`,
        `가격: ${service.priceText}`,
        `무료 플랜: ${formatBoolean(service.hasFreePlan)}`
      ])}
      ${detailSection("장점", service.strengths)}
      ${detailSection("단점/주의사항", service.weaknesses)}
      ${detailSection("추천 사용 용도", service.recommendedUses)}
      ${detailSection("추천 사용자", service.recommendedUsers)}
      ${detailSection("비슷한 서비스", service.alternatives)}
      ${detailSection("비고", [service.notes, `업데이트 날짜: ${service.updatedAt}`, `입문자 추천: ${formatBoolean(service.beginnerFriendly)}`])}
    </div>
  `;
  els.detailModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function detailSection(title, items) {
  return `
    <section class="detail-section">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function closeModal() {
  els.detailModal.hidden = true;
  document.body.style.overflow = "";
}

function addToCompare(id) {
  if (state.compareIds.includes(id)) return;
  state.compareIds.push(id);
  saveCompareState();
  renderServices();
  renderCompareTable();
}

function handleCompareClick(event) {
  const button = event.target.closest("button[data-remove-id]");
  if (!button) return;
  state.compareIds = state.compareIds.filter((id) => id !== button.dataset.removeId);
  saveCompareState();
  renderServices();
  renderCompareTable();
}

function clearCompareList() {
  state.compareIds = [];
  saveCompareState();
  renderServices();
  renderCompareTable();
}

function saveCompareState() {
  localStorage.setItem("aiCompareIds", JSON.stringify(state.compareIds));
}

function renderCompareTable() {
  const comparedServices = state.compareIds
    .map((id) => aiServices.find((service) => service.id === id))
    .filter(Boolean);

  els.compareCount.textContent = `선택된 서비스 ${comparedServices.length}개`;
  els.clearCompareBtn.disabled = comparedServices.length === 0;

  if (comparedServices.length === 0) {
    els.compareTableWrap.innerHTML = `<p class="empty-message">비교할 서비스를 추가해보세요.</p>`;
    return;
  }

  els.compareTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>서비스 이름</th>
          <th>분야</th>
          <th>무료/유료</th>
          <th>월 가격</th>
          <th>무료 플랜</th>
          <th>한국어 지원</th>
          <th>모바일</th>
          <th>팀 협업</th>
          <th>난이도</th>
          <th>추천 점수</th>
          <th>제거</th>
        </tr>
      </thead>
      <tbody>
        ${comparedServices.map((service) => `
          <tr>
            <td><strong>${escapeHtml(service.name)}</strong></td>
            <td>${escapeHtml(service.category.join(", "))}</td>
            <td>${escapeHtml(service.pricingType)}</td>
            <td>${escapeHtml(service.priceText)}</td>
            <td>${formatBoolean(service.hasFreePlan)}</td>
            <td>${formatBoolean(service.koreanSupport)}</td>
            <td>${formatBoolean(service.mobileAvailable)}</td>
            <td>${formatBoolean(service.teamFeatures)}</td>
            <td>${escapeHtml(service.difficulty)}</td>
            <td>${service.rating.toFixed(1)}</td>
            <td><button class="remove-btn" type="button" data-remove-id="${service.id}">삭제</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function formatBoolean(value) {
  return value ? "지원" : "미지원";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

init();
