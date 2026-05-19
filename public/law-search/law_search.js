"use strict";

const API_BASE = "/api/user/laws";
const API_HEADERS = {
  Accept: "application/json, text/plain, */*",
};
const OVERVIEW_CACHE_KEY = "law_search_overview_v2";
const CONTENT_CACHE_KEY_PREFIX = "law_search_content_v2_";

const styles = {
  box: "iet2TRwpa65B6Itl3s8WBw==",
  full: "JMUQshLeyhZseCzWPftVKg==",
  top: "foDQP3KaJV2f0zebGlTqLg==",
  title: "Rs2XqNq8ASVPw9gtdwADUw==",
  bottom: "W6XcCrT2dd-qXREMlc+POg==",
  left: "X78sh31iqReN49kQLUunbw==",
  hideLeft: "KzrW119NxvD6FZu5TR9hvg==",
  navbar: "N-CLd1SlwL3+HA9kUp-8lw==",
  navOpen: "R7N+jVTL+KtQY5MjXcuLOQ==",
  movebar: "fCX6MGsD3PopmhyLo58bMA==",
  searchArea: "_8+rB95TY7bGxKVaAKQFIcw==",
  inputBox: "-F6jE0+QZM5GooWVuWNexw==",
  searchRight: "jCwmR755zXuyzoQNLVpNlw==",
  searchPrev: "o5GNFP9ruUfolqcieT7lTA==",
  searchNext: "jVpQNl2s2ZfET6ap3j490w==",
  noScroll: "XueZp0yJftFREc4F6L4jtA==",
  listArea: "RmTjFuE3KX34t9DrDuId0Q==",
  right: "Dr9X1SCNbR+c1z6yRFP6cQ==",
  list: "_4SBJ400b2OTyommQad++ww==",
  listChildren: "CgvxFMHhl1XCEjMOrPtWjQ==",
  collapsedDash: "_8rBFEbxfp+NUONh5snIw7g==",
  folder: "_9IRZAbAkH0rOgFKytrd99w==",
  file: "u0jF4OVSHf17N3rd2t+9zA==",
  preIcon: "bETq4X-XRGsXFrxHW-fTBg==",
  folderSelected: "WRfowCHL0HzIFaWyvO+c4A==",
  fileSelected: "+025ub2+ze6LD8Iq6uthtg==",
  folderNoOpenFirst: "tYyQlhBN559xWVaK3mT8zw==",
  folderNoOpen: "MhkW2aB+JJsbb9QDRcdoZw==",
  folderNoOpenLast: "kpwTDCLOhHchJK22VCo01Q==",
  folderOpen: "zOlAJBzeF2Dzu2fwNVb8NA==",
  folderOpenFirst: "_6njayP4KdJnRcWatPT9jZg==",
  folderOpenLast: "wdRbtjXW8horsjRB+pCFRQ==",
  fileFirst: "rzSGOO8JzA2yhd3GXhxCOw==",
  fileLast: "_3OhPNSTKHyjr7lqvZdQH-g==",
  rightTip: "_0eZdR22z6OAmWmBw-VoFOA==",
};

const SEARCH_ICON_URL =
  "https://osscdn2.zhongheschool.com/common/defaultType/202401/202401231435070667.png";
const MAX_ICON_URL = "https://oss.zhumavip.com/images/lawPage/ic-fangda.png";
const RESTORE_ICON_URL = "https://oss.zhumavip.com/images/lawPage/ic-zuixiaohua.png";
const MOBILE_MEDIA_QUERY = "(max-width: 768px)";
const CLIPBOARD_KEYS = new Set(["c", "x"]);
const LEFT_WIDTH_MIN = 240;
const LEFT_WIDTH_MAX = 680;
const LEFT_COLLAPSE_THRESHOLD = 72;
const LEFT_REOPEN_DEFAULT_WIDTH = 320;
const LEFT_COLLAPSED_HANDLE_WIDTH = 12;

const state = {
  tree: [],
  nodeMap: new Map(),
  detailCache: new Map(),
  listLoaded: false,
  selectedId: "",
  renderedSections: null,
  searchValue: "",
  searchResults: [],
  searchIndex: 0,
  isLeftCollapsed: false,
  isFullscreen: false,
  leftWidth: 390,
  dragStart: null,
  dragging: false,
  pendingRequestId: 0,
  pendingDetailLoads: new Map(),
  loading: false,
};

const root = document.getElementById("law-page-root");

document.addEventListener("DOMContentLoaded", init);

function init() {
  clearLegacyLawSearchCache();
  renderShell();
  bindStaticEvents();
  loadList();
}

function bindStaticEvents() {
  const input = getEl("search-input");
  input.addEventListener("change", (event) => {
    state.searchValue = event.target.value;
  });
  input.addEventListener("input", (event) => {
    state.searchValue = event.target.value;
  });
  input.addEventListener("paste", (event) => {
    event.preventDefault();
  });
  input.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      executeSearch(state.searchValue);
    }
  });

  const blockClipboardEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  document.addEventListener("copy", blockClipboardEvent, true);
  document.addEventListener("cut", blockClipboardEvent, true);
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }
    if (!CLIPBOARD_KEYS.has(String(event.key || "").toLowerCase())) {
      return;
    }
    blockClipboardEvent(event);
  }, true);

  getEl("search-button").addEventListener("click", () => {
    executeSearch(state.searchValue);
  });

  getEl("search-prev").addEventListener("click", () => {
    jumpSearch(-1);
  });

  getEl("search-next").addEventListener("click", () => {
    jumpSearch(1);
  });

  getEl("toggle-left").addEventListener("click", () => {
    if (isMobileLayout()) {
      return;
    }
    state.isLeftCollapsed = true;
    renderLayout();
  });

  getEl("expand-left").addEventListener("click", () => {
    if (isMobileLayout()) {
      return;
    }
    state.isLeftCollapsed = false;
    state.leftWidth = Math.max(state.leftWidth, LEFT_REOPEN_DEFAULT_WIDTH);
    renderLayout();
  });

  getEl("movebar").addEventListener("mousedown", (event) => {
    if (isMobileLayout()) {
      return;
    }
    state.dragging = true;
    state.dragStart = { x: event.pageX, width: state.leftWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.preventDefault();
    event.stopPropagation();
  });

  getEl("law-left-collapsed").addEventListener("mousedown", (event) => {
    if (isMobileLayout()) {
      return;
    }
    state.dragging = true;
    state.dragStart = { x: event.pageX, width: 0 };
    state.isLeftCollapsed = false;
    state.leftWidth = LEFT_WIDTH_MIN;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    renderLayout();
    event.preventDefault();
    event.stopPropagation();
  });

  window.addEventListener("mousemove", (event) => {
    if (!state.dragging || !state.dragStart) {
      return;
    }

    const nextWidth = state.dragStart.width + event.pageX - state.dragStart.x;
    if (nextWidth <= LEFT_COLLAPSE_THRESHOLD) {
      state.isLeftCollapsed = true;
    } else {
      state.isLeftCollapsed = false;
      state.leftWidth = clamp(nextWidth, LEFT_WIDTH_MIN, LEFT_WIDTH_MAX);
    }
    renderLayout();
    event.stopPropagation();
  });

  window.addEventListener("mouseup", (event) => {
    if (!state.dragging) {
      return;
    }

    state.dragging = false;
    state.dragStart = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    event.stopPropagation();
  });

  window.addEventListener("resize", () => {
    renderLayout();
  });
  window.addEventListener("law-dialog-bridge-change", () => {
    syncDialogFullscreenState();
    renderLayout();
  });

  getEl("tree-root").addEventListener("click", handleTreeClick);
  getEl("tree-root").addEventListener("dblclick", handleTreeDoubleClick);
}

async function loadList() {
  setLoading(true);

  try {
    const overview = await apiGet("overview");
    if (!overview || !Array.isArray(overview.tree)) {
      throw new Error("法条目录数据异常");
    }

    state.tree = normalizeTree(cloneData(overview.tree));
    finalizeListLoad(overview.initialNodeId || "");
  } catch (error) {
    renderRightPlaceholder(error.message || "加载失败");
  } finally {
    setLoading(false);
  }
}

function finalizeListLoad(initialNodeId) {
  state.nodeMap = buildNodeMap(state.tree);
  state.listLoaded = true;
  renderTree();

  if (state.tree.length > 0) {
    const first = state.nodeMap.get(initialNodeId) || state.tree[0];
    state.selectedId = first.id;
    renderTree();
    loadSections(first.id, first.id);
  }
}

function renderShell() {
  root.innerHTML = `
    <div
      id="law-box"
      class="${styles.box}"
      style="margin-top: 40px; margin-bottom: 40px; width: 1200px; height: calc(100vh - 80px); min-height: 540px;"
    >
      <div id="law-topbar" class="${styles.top}">
        <div class="${styles.title}" title="法律法规汇编">法律法规汇编</div>
        <img id="toggle-fullscreen" src="" alt="" />
      </div>
      <div class="${styles.bottom}">
        <div id="law-left-expanded">
          <div id="law-left" class="${styles.left}">
            <div class="${styles.navbar}">
              <div>章节导航</div>
              <div id="toggle-left" class="${styles.navOpen}" role="button" tabindex="0" aria-label="收起导航">
                ${renderIcon("left")}
              </div>
            </div>
            <div class="${styles.searchArea}">
              <div class="${styles.inputBox}">
                <input
                  id="search-input"
                  type="text"
                  autocomplete="off"
                  placeholder=""
                  value=""
                />
                <img id="search-button" src="${SEARCH_ICON_URL}" alt="搜索" />
              </div>
              <div class="${styles.searchRight}">
                <div id="search-prev" class="${styles.searchPrev}" role="button" tabindex="0" aria-label="上一个">
                  ${renderIcon("left")}
                </div>
                <div id="search-next" class="${styles.searchNext}" role="button" tabindex="0" aria-label="下一个">
                  ${renderIcon("right")}
                </div>
              </div>
            </div>
            <div id="tree-root" class="${styles.listArea} ${styles.list}"></div>
          </div>
        </div>
        <div id="movebar" class="${styles.movebar}"></div>
        <div id="law-left-collapsed" class="${styles.hideLeft}" hidden>
          <div class="${styles.navbar}">
            <div id="expand-left" class="${styles.navOpen}" role="button" tabindex="0" aria-label="展开导航">
              ${renderIcon("right")}
            </div>
          </div>
        </div>
        <div id="right-panel" class="${styles.right}"></div>
      </div>
    </div>
  `;

  renderTopIcons();
  renderLayout();
  renderRightPlaceholder("法律法规汇编");
}

function renderTopIcons() {
  syncDialogFullscreenState();
  const icon = getEl("toggle-fullscreen");
  icon.style.display = isMobileLayout() ? "none" : "block";
  icon.src = state.isFullscreen ? RESTORE_ICON_URL : MAX_ICON_URL;
  icon.alt = state.isFullscreen ? "还原" : "放大";
  icon.onclick = () => {
    if (isMobileLayout()) {
      return;
    }
    const bridge = getDialogBridge();
    if (bridge) {
      state.isFullscreen = Boolean(bridge.toggleFullscreen());
      renderLayout();
      return;
    }
    state.isFullscreen = !state.isFullscreen;
    renderLayout();
  };
}

function renderLayout() {
  syncDialogFullscreenState();
  const box = getEl("law-box");
  const mobile = isMobileLayout();

  if (mobile) {
    state.isFullscreen = false;
    state.isLeftCollapsed = false;
  }

  box.className = !mobile && state.isFullscreen ? `${styles.box} ${styles.full}` : styles.box;
  if (mobile) {
    box.style.marginTop = "0";
    box.style.marginBottom = "0";
    box.style.width = "100%";
    box.style.height = "100%";
    box.style.minHeight = "0";
  } else if (!state.isFullscreen) {
    box.style.marginTop = "40px";
    box.style.marginBottom = "40px";
    box.style.width = "1200px";
    box.style.height = "calc(100vh - 80px)";
    box.style.minHeight = "540px";
  } else {
    box.style.marginTop = "0";
    box.style.marginBottom = "0";
    box.style.width = "";
    box.style.height = "";
    box.style.minHeight = "";
  }

  renderTopIcons();

  getEl("law-left-expanded").hidden = mobile ? false : state.isLeftCollapsed;
  getEl("movebar").hidden = mobile ? true : state.isLeftCollapsed;
  getEl("law-left-collapsed").hidden = mobile ? true : !state.isLeftCollapsed;
  getEl("law-left").style.width = mobile ? "100%" : `${state.leftWidth}px`;
  getEl("law-left-collapsed").style.width = mobile ? "0" : `${LEFT_COLLAPSED_HANDLE_WIDTH}px`;
  getEl("law-left-collapsed").style.pointerEvents = mobile || !state.isLeftCollapsed ? "none" : "auto";
}

function getDialogBridge() {
  const bridge = window.__lawDialogBridge;
  if (!bridge || typeof bridge.toggleFullscreen !== "function" || typeof bridge.getIsFullscreen !== "function") {
    return null;
  }
  return bridge;
}

function syncDialogFullscreenState() {
  const bridge = getDialogBridge();
  if (!bridge) {
    return false;
  }
  state.isFullscreen = Boolean(bridge.getIsFullscreen());
  return true;
}

function handleTreeClick(event) {
  const toggle = event.target.closest("[data-tree-toggle-id]");
  if (toggle) {
    const node = state.nodeMap.get(toggle.dataset.treeToggleId);
    if (!node || !hasChildren(node)) {
      return;
    }

    node.is_open = !node.is_open;
    renderTree();
    return;
  }

  const folder = event.target.closest("[data-folder-id]");
  if (folder) {
    const nodeId = folder.dataset.folderId;
    state.selectedId = nodeId;
    renderTree();
    return;
  }

  const file = event.target.closest("[data-file-id]");
  if (file) {
    const nodeId = file.dataset.fileId;
    const node = state.nodeMap.get(nodeId);
    if (!node) {
      return;
    }

    state.selectedId = node.id;
    renderTree();
    loadSections(node.id, node.id);
  }
}

function handleTreeDoubleClick(event) {
  const folder = event.target.closest("[data-folder-id]");
  if (!folder) {
    return;
  }

  const nodeId = folder.dataset.folderId;
  const node = state.nodeMap.get(nodeId);
  if (!node) {
    return;
  }

  if (hasChildren(node)) {
    node.is_open = !node.is_open;
  }

  state.selectedId = node.id;
  renderTree();
  loadSections(node.id, node.id);
  getEl("right-panel").scrollTop = 0;
}

function renderTree() {
  if (!state.listLoaded) {
    return;
  }

  const treeRoot = getEl("tree-root");
  treeRoot.innerHTML = renderTreeList(state.tree, 1);
}

function renderTreeList(nodes, depth) {
  return nodes
    .map((node, index) => {
      const isFirst = index === 0 && depth === 1;
      const isLast = index === nodes.length - 1;
      const isSelected = node.id === state.selectedId;

      if (hasChildren(node)) {
        const preIconClass = getFolderSprite(node, isFirst, isLast);
        const children = node.is_open
          ? `
              <div class="${styles.listChildren}">
                ${renderTreeList(node.children, depth + 1)}
              </div>
            `
          : "";

        return `
          <div>
            <div
              class="${styles.folder} ${isSelected ? styles.folderSelected : ""}"
              title="${escapeHtml(node.title)}"
              id="${styles.list}_${node.id}"
              data-folder-id="${node.id}"
            >
              <div
                class="${styles.preIcon} ${preIconClass}"
                data-tree-toggle-id="${node.id}"
              ></div>
              <div>${escapeHtml(node.title)}</div>
            </div>
            ${children}
          </div>
        `;
      }

      const fileIcon = isFirst ? styles.fileFirst : isLast ? styles.fileLast : styles.file;
      return `
        <div>
          <div class="${styles.file}" title="${escapeHtml(node.title)}" id="${styles.list}_${node.id}" data-file-id="${node.id}">
            <div class="${styles.preIcon} ${fileIcon}"></div>
            <div class="${isSelected ? styles.fileSelected : ""}" data-file-id="${node.id}">
              ${escapeHtml(node.title)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function getFolderSprite(node, isFirst, isLast) {
  if (node.is_open) {
    if (isFirst) {
      return styles.folderOpenFirst;
    }
    if (isLast) {
      return styles.folderOpenLast;
    }
    return styles.folderOpen;
  }

  if (isFirst) {
    return styles.folderNoOpenFirst;
  }
  if (isLast) {
    return styles.folderNoOpenLast;
  }
  return styles.folderNoOpen;
}

function executeSearch(rawValue) {
  const query = String(rawValue || "").trim();
  state.searchValue = query;
  getEl("search-input").value = query;

  if (!query) {
    state.searchResults = [];
    state.searchIndex = 0;
    renderTree();
    return;
  }

  const terms = query.split(" ").filter(Boolean);
  const matches = [];
  const seenIds = new Set();
  const clonedTree = cloneData(state.tree);
  const clonedMap = buildNodeMap(clonedTree);

  terms.forEach((term) => {
    searchTree(clonedTree, clonedMap, term, matches, seenIds);
  });

  state.tree = clonedTree;
  state.nodeMap = clonedMap;
  state.searchResults = matches;
  state.searchIndex = 0;

  renderTree();

  if (matches.length > 0) {
    jumpToSearchIndex(0);
  }
}

function searchTree(nodes, map, term, matches, seenIds) {
  let foundCount = 0;
  nodes.forEach((node) => {
    let localFound = false;
    const compactTitle = node.title.replace(/\s*/g, "");
    if (compactTitle.indexOf(term) !== -1 && !seenIds.has(node.id)) {
      seenIds.add(node.id);
      matches.push(node);
      localFound = true;
      foundCount += 1;
    }

    if (hasChildren(node)) {
      const childCount = searchTree(node.children, map, term, matches, seenIds);
      if (childCount > 0) {
        foundCount += childCount;
        const self = map.get(node.id);
        if (self) {
          self.is_open = true;
        }
      }
    }

    if (localFound) {
      expandAncestors(node, map);
    }
  });

  return foundCount;
}

function jumpSearch(step) {
  if (state.searchResults.length === 0) {
    return;
  }

  const total = state.searchResults.length;
  const nextIndex = step < 0
    ? state.searchIndex - 1 >= 0
      ? state.searchIndex - 1
      : total - 1
    : state.searchIndex + 1 >= total
      ? 0
      : state.searchIndex + 1;

  jumpToSearchIndex(nextIndex);
}

function jumpToSearchIndex(index) {
  const matches = state.searchResults;
  if (!matches[index]) {
    return;
  }

  const node = matches[index];
  state.searchIndex = index;
  state.selectedId = node.id;
  renderTree();
  scrollTreeNode(node.id);

  if (hasChildren(node)) {
    loadSections(node.id, node.id);
    getEl("right-panel").scrollTop = 0;
  } else {
    loadSections(node.id, node.id);
  }
}

async function loadSections(requestId, focusId) {
  const token = ++state.pendingRequestId;
  state.loading = true;
  renderRightPlaceholder("加载中");

  try {
    const sections = await getSections(requestId);
    if (token !== state.pendingRequestId) {
      return;
    }

    state.selectedId = focusId;
    renderTree();
    state.renderedSections = sections;
    renderSections(state.renderedSections, focusId);
    scrollTreeNode(focusId);
  } catch (error) {
    if (token !== state.pendingRequestId) {
      return;
    }
    if (String(error && error.message ? error.message : "").includes("HTTP 404")) {
      await reloadLawOverviewAfterMissingNode(requestId, focusId, token);
      return;
    }
    renderRightPlaceholder(error.message || "加载失败");
  } finally {
    if (token === state.pendingRequestId) {
      state.loading = false;
    }
  }
}

async function getSections(requestId) {
  if (!requestId) {
    throw new Error("参数错误，请联系管理员");
  }

  if (state.detailCache.has(requestId)) {
    return cloneData(state.detailCache.get(requestId));
  }

  let pending = state.pendingDetailLoads.get(requestId);
  if (!pending || Date.now() - pending.time > 60000) {
    pending = {
      time: Date.now(),
      promise: apiGet("content", { nodeId: requestId }),
    };
    state.pendingDetailLoads.set(requestId, pending);
  }

  try {
    const payload = await pending.promise;
    const sections = Array.isArray(payload?.items) ? payload.items : [];
    const normalized = sections.map((section) => ({
      ...section,
      id: buildRecordNodeId(section.id),
    }));
    state.detailCache.set(requestId, normalized);
    return cloneData(normalized);
  } finally {
    state.pendingDetailLoads.delete(requestId);
  }
}

function renderSections(sections, focusId) {
  const panel = getEl("right-panel");

  if (!sections || sections.length === 0) {
    panel.innerHTML = `<div class="${styles.rightTip}">法律法规汇编</div>`;
    return;
  }

  panel.innerHTML = sections
    .map((section) => {
      return `
        <div id="${styles.right}_${section.id}">
          ${String(section.content || "")}
        </div>
      `;
    })
    .join("");

  requestAnimationFrame(() => {
    const target = document.getElementById(`${styles.right}_${focusId}`);
    if (target) {
      target.scrollIntoView({ block: "start" });
    } else {
      panel.scrollTop = 0;
    }
  });
}

function renderRightPlaceholder(text) {
  getEl("right-panel").innerHTML = `<div class="${styles.rightTip}">${escapeHtml(text)}</div>`;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  if (isLoading) {
    renderRightPlaceholder("加载中");
  }
}

function normalizeTree(nodes, parentId = "") {
  return nodes.map((node) => {
    return {
      ...node,
      parentId: node.parentId || parentId || "",
      pathLabels: Array.isArray(node.pathLabels) ? node.pathLabels : [],
      nodeType: node.nodeType || (Array.isArray(node.children) && node.children.length > 0 ? "folder" : "record"),
      is_open: Boolean(node.is_open),
      children: Array.isArray(node.children) ? normalizeTree(node.children, node.id) : [],
    };
  });
}

function buildNodeMap(nodes) {
  const map = new Map();

  function walk(items) {
    items.forEach((node) => {
      map.set(node.id, node);
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    });
  }

  walk(nodes);
  return map;
}

function hasChildren(node) {
  return Array.isArray(node.children) && node.children.length > 0;
}

function expandAncestors(node, map) {
  let current = map.get(node.id);
  while (current) {
    current.is_open = true;
    current = current.parentId ? map.get(current.parentId) : null;
  }
}

function scrollTreeNode(nodeId) {
  requestAnimationFrame(() => {
    const target = document.getElementById(`${styles.list}_${nodeId}`);
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  });
}

function renderIcon(direction) {
  if (direction === "left") {
    return `
      <svg class="law-inline-icon" viewBox="0 0 1024 1024" aria-hidden="true">
        <path d="M650.667 213.333a42.667 42.667 0 0 1 0 60.334L412.587 512l238.08 238.08a42.667 42.667 0 1 1-60.334 60.334l-268.245-268.16a42.667 42.667 0 0 1 0-60.334l268.245-268.16a42.667 42.667 0 0 1 60.334 0Z"></path>
      </svg>
    `;
  }

  return `
    <svg class="law-inline-icon" viewBox="0 0 1024 1024" aria-hidden="true">
      <path d="M373.333 810.667a42.667 42.667 0 0 1 0-60.334L611.413 512 373.333 273.92a42.667 42.667 0 1 1 60.334-60.334l268.245 268.16a42.667 42.667 0 0 1 0 60.334l-268.245 268.16a42.667 42.667 0 0 1-60.334 0Z"></path>
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

async function reloadLawOverviewAfterMissingNode(requestId, focusId, token) {
  try {
    const overview = await apiGet("overview");
    if (!overview || !Array.isArray(overview.tree)) {
      throw new Error("法条目录数据异常");
    }

    state.tree = normalizeTree(cloneData(overview.tree));
    state.nodeMap = buildNodeMap(state.tree);
    state.listLoaded = true;

    const fallbackNode = state.nodeMap.get(focusId) || state.nodeMap.get(requestId) || state.nodeMap.get(overview.initialNodeId) || state.tree[0];
    if (!fallbackNode) {
      renderRightPlaceholder("法律法规汇编");
      return;
    }

    state.selectedId = fallbackNode.id;
    renderTree();

    if (fallbackNode.id !== requestId) {
      const sections = await getSections(fallbackNode.id);
      if (token !== state.pendingRequestId) {
        return;
      }
      state.renderedSections = sections;
      renderSections(sections, fallbackNode.id);
      scrollTreeNode(fallbackNode.id);
      return;
    }

    renderRightPlaceholder("该法条已更新，请重新点击左侧目录");
  } catch (refreshError) {
    renderRightPlaceholder(refreshError.message || "加载失败");
  }
}

function clearLegacyLawSearchCache() {
  try {
    const keys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) {
        continue;
      }
      if (key === OVERVIEW_CACHE_KEY || key.startsWith(CONTENT_CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    // Ignore storage failures.
  }
}

function readJsonStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage quota and serialization failures.
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isMobileLayout() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getEl(id) {
  return document.getElementById(id);
}

function buildRecordNodeId(recordId) {
  const normalized = String(recordId || "");
  return normalized.startsWith("record:") ? normalized : `record:${normalized}`;
}

function readCookie(name) {
  const encodedName = encodeURIComponent(name);
  const segments = document.cookie ? document.cookie.split("; ") : [];
  const matched = segments.find((segment) => segment.startsWith(`${encodedName}=`));
  if (!matched) {
    return "";
  }

  return decodeURIComponent(matched.slice(encodedName.length + 1));
}

function getUserToken() {
  try {
    return window.localStorage.getItem("userToken") || readCookie("userToken") || "";
  } catch (error) {
    return readCookie("userToken") || "";
  }
}

async function apiGet(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const headers = {
    ...API_HEADERS,
  };
  const token = getUserToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    if (window.top && window.top !== window) {
      window.top.location.href = "/";
    } else {
      window.location.href = "/";
    }
    throw new Error("登录状态已失效");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.code !== 0) {
    throw new Error(payload.message || "接口返回失败");
  }

  return payload.data;
}
