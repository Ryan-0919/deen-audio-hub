import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import mockExamOfficialCss from "../../../styles/mock-exam-official.css?raw";
import { MockExamQuestion, MockExamRecordDetail, MockExamSubjectiveSubQuestion, mockApi } from "../../lib/mockData";
import { getUserPhone } from "../../lib/user-session";
import {
  applyObjectiveAnswerToRecord,
  buildDraftKey,
  buildIdCardNo,
  buildNextAnswerKeys,
  buildQuestionGroups,
  buildSubjectiveDraftMap,
  buildTicketNo,
  formatCountdown,
  getAnsweredQuestionCount,
  getDraftAnswer,
  getExamPhaseLabel,
  getInitialQuestionIndex,
  getQuestionState,
  isSubjectiveQuestion,
} from "./mockExamRoomHelpers";
import { getMockExamCardNo, getMockExamTicketNo } from "./mockExamCandidateSession";
import { MockExamDesktopNotice, useMockExamDesktopGuard } from "./mockExamDesktopGuard";
import { getMockExamHomePath } from "./mockExamLaunchShared";

const SAVE_DELAY = 600;
const VIEW_KEY = "mock-exam-official-view";
const MARK_KEY_PREFIX = "mock-exam-official-marks:";
const SECTION_ORDERS = ["一、", "二、", "三、", "四、", "五、", "六、"];
const THEME_BG = { 1: "#ddebf6", 2: "#cae0e0", 3: "#f5e9dc", 4: "#f5dce4", 5: "#deddf6" } as const;
const MOCK_EXAM_SHADOW_RESET = ":host{all:initial;display:block}:host,:host *,:host *::before,:host *::after{box-sizing:content-box}:host img{display:inline-block;max-width:none}:host button,:host input,:host textarea,:host select{font:inherit;letter-spacing:normal}:host textarea{resize:none}";
const MOCK_EXAM_RADIO_BASE_CSS = `
[data-v-6e05b77a] .el-radio{position:relative;display:inline-flex;align-items:center;cursor:pointer;white-space:nowrap;outline:none;line-height:1}
[data-v-6e05b77a] .el-radio__input{position:relative;display:inline-flex;align-items:center;white-space:nowrap;cursor:pointer;outline:none}
[data-v-6e05b77a] .el-radio__inner{position:relative;display:inline-block;box-sizing:border-box;border-radius:100%;background-color:#fff}
[data-v-6e05b77a] .el-radio__inner:after{content:"";position:absolute;left:50%;top:50%;border-radius:100%;transform:translate(-50%,-50%)}
[data-v-6e05b77a] .el-radio__original{position:absolute;inset:0;z-index:-1;opacity:0;margin:0}
[data-v-6e05b77a] .el-radio__label{display:inline-block}
[data-v-6e05b77a] .el-radio-group{display:inline-flex;align-items:center;flex-wrap:wrap}
[data-v-6e05b77a] .submitbutton{display:inline-block;box-sizing:border-box;width:98px;height:31px;line-height:29px;padding:0;border:1px solid #c60;background-repeat:no-repeat;background-size:100% 100%;background-position:center;color:#000;appearance:none;-webkit-appearance:none}
[data-v-6e05b77a] .dialog_button button{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;height:31px;line-height:31px;padding:0 10px;text-align:center}
`;
const OFFICIAL_OBJECTIVE_DESCRIPTIONS = [
  "每题所设选项中只有一个正确答案，多选、错选或不选均不得分。本部分含1—50题，每题1分，共50分。",
  "每题所设选项中至少有两个正确答案，多选、少选、错选或不选均不得分。本部分含51—85题，每题2分，共70分。",
  "每题所设选项中至少有一个正确答案，多选、少选、错选或不选均不得分。本部分含86—100题，每题2分，共30分。",
] as const;
const SCOPE = { "data-v-6e05b77a": "" };
type ThemeId = 1 | 2 | 3 | 4 | 5;
type PendingEntry = { questionId: string; subQuestionId: string; text: string };
type SubjectiveLeaveState = { nextIndex: number; message: string } | null;
type SubjectivePanelHeight = "300px" | "100%";
type AnswerPanelHeight = "340px" | "100%";
type LawDialogRect = { left: number; top: number; width: number; height: number };
type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type LawDialogAction =
  | { type: "move"; startX: number; startY: number; startRect: LawDialogRect }
  | { type: "resize"; direction: ResizeDirection; startX: number; startY: number; startRect: LawDialogRect };
type LawDialogBridge = {
  toggleFullscreen: () => boolean;
  getIsFullscreen: () => boolean;
};
type LawFrameWindow = Window & typeof globalThis & { __lawDialogBridge?: LawDialogBridge };
type HighlightBlock = "prompt" | "subjective-title";
type HighlightSelection = { block: HighlightBlock; key: string; start: number; end: number };

const LAW_DIALOG_MIN_WIDTH = 640;
const LAW_DIALOG_MIN_HEIGHT = 420;
const LAW_DIALOG_MARGIN = 16;
const LAW_DIALOG_TOP_MARGIN = 8;
const CLIPBOARD_DISABLED_MESSAGE = "考试过程中不允许复制、剪切、粘贴";
const STEM_HIGHLIGHT_CLASS = "mock-stem-highlight";
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const buildSubjectiveTitleKey = (questionId: string, subQuestionId: string) => `${questionId}:${subQuestionId}`;
const getLawDialogViewport = () => ({
  width: typeof window === "undefined" ? 1440 : window.innerWidth,
  height: typeof window === "undefined" ? 900 : window.innerHeight,
});
const getTextOffsetWithin = (root: Node, container: Node, offset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let total = 0;

  while (current) {
    const textLength = current.textContent?.length ?? 0;
    if (current === container) return total + Math.min(offset, textLength);
    total += textLength;
    current = walker.nextNode();
  }

  return total;
};
const locateTextBoundary = (root: HTMLElement, targetOffset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode() as Text | null;
  let remaining = Math.max(0, targetOffset);
  let lastTextNode: Text | null = null;

  while (current) {
    const textLength = current.textContent?.length ?? 0;
    lastTextNode = current;
    if (remaining <= textLength) return { node: current, offset: remaining };
    remaining -= textLength;
    current = walker.nextNode() as Text | null;
  }

  return lastTextNode ? { node: lastTextNode, offset: lastTextNode.textContent?.length ?? 0 } : null;
};
const unwrapHighlightElement = (element: Element) => {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
  parent.normalize();
};
const cleanupHighlightContainer = (container: HTMLElement) => {
  Array.from(container.querySelectorAll(`span.${STEM_HIGHLIGHT_CLASS}`)).forEach((element) => {
    if (!element.textContent) element.remove();
  });
  container.normalize();
};
const applyHighlightToHtml = (html: string, start: number, end: number) => {
  if (start >= end) return html;
  const container = document.createElement("div");
  container.innerHTML = html;
  const startBoundary = locateTextBoundary(container, start);
  const endBoundary = locateTextBoundary(container, end);
  if (!startBoundary || !endBoundary) return html;

  const range = document.createRange();
  range.setStart(startBoundary.node, startBoundary.offset);
  range.setEnd(endBoundary.node, endBoundary.offset);
  if (range.collapsed) return html;

  const highlight = document.createElement("span");
  highlight.className = STEM_HIGHLIGHT_CLASS;
  highlight.setAttribute("style", "background:#fff59d;");
  highlight.appendChild(range.extractContents());
  range.insertNode(highlight);
  cleanupHighlightContainer(container);
  return container.innerHTML;
};
const clearHighlightInHtml = (html: string, start?: number, end?: number) => {
  const container = document.createElement("div");
  container.innerHTML = html;
  const highlightElements = Array.from(container.querySelectorAll(`span.${STEM_HIGHLIGHT_CLASS}`));
  if (highlightElements.length === 0) return html;

  if (typeof start !== "number" || typeof end !== "number" || start >= end) {
    highlightElements.forEach((element) => unwrapHighlightElement(element));
    cleanupHighlightContainer(container);
    return container.innerHTML;
  }

  const startBoundary = locateTextBoundary(container, start);
  const endBoundary = locateTextBoundary(container, end);
  if (!startBoundary || !endBoundary) {
    highlightElements.forEach((element) => unwrapHighlightElement(element));
    cleanupHighlightContainer(container);
    return container.innerHTML;
  }

  const range = document.createRange();
  range.setStart(startBoundary.node, startBoundary.offset);
  range.setEnd(endBoundary.node, endBoundary.offset);
  highlightElements.forEach((element) => {
    if (range.intersectsNode(element)) unwrapHighlightElement(element);
  });
  cleanupHighlightContainer(container);
  return container.innerHTML;
};
const clampLawDialogRect = (rect: LawDialogRect) => {
  const viewport = getLawDialogViewport();
  const maxWidth = Math.max(420, viewport.width - LAW_DIALOG_MARGIN * 2);
  const maxHeight = Math.max(320, viewport.height - LAW_DIALOG_TOP_MARGIN - LAW_DIALOG_MARGIN);
  const minWidth = Math.min(LAW_DIALOG_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(LAW_DIALOG_MIN_HEIGHT, maxHeight);
  const width = clamp(rect.width, minWidth, maxWidth);
  const height = clamp(rect.height, minHeight, maxHeight);
  const left = clamp(rect.left, LAW_DIALOG_MARGIN, Math.max(LAW_DIALOG_MARGIN, viewport.width - LAW_DIALOG_MARGIN - width));
  const top = clamp(rect.top, LAW_DIALOG_TOP_MARGIN, Math.max(LAW_DIALOG_TOP_MARGIN, viewport.height - LAW_DIALOG_MARGIN - height));
  return { left, top, width, height };
};
const buildDefaultLawDialogRect = () => {
  const viewport = getLawDialogViewport();
  const width = Math.min(Math.max(760, Math.round(viewport.width * 0.5)), viewport.width - LAW_DIALOG_MARGIN * 2);
  const height = Math.min(Math.max(560, Math.round(viewport.height * 0.7)), viewport.height - LAW_DIALOG_TOP_MARGIN - LAW_DIALOG_MARGIN);
  return clampLawDialogRect({
    left: Math.round((viewport.width - width) / 2),
    top: Math.max(LAW_DIALOG_TOP_MARGIN, Math.round((viewport.height - height) / 2)),
    width,
    height,
  });
};
const buildMaximizedLawDialogRect = () => {
  const viewport = getLawDialogViewport();
  return clampLawDialogRect({
    left: LAW_DIALOG_MARGIN,
    top: LAW_DIALOG_TOP_MARGIN,
    width: viewport.width - LAW_DIALOG_MARGIN * 2,
    height: viewport.height - LAW_DIALOG_TOP_MARGIN - LAW_DIALOG_MARGIN,
  });
};
const resizeLawDialogRect = (startRect: LawDialogRect, direction: ResizeDirection, dx: number, dy: number) => {
  const viewport = getLawDialogViewport();
  const maxWidth = Math.max(420, viewport.width - LAW_DIALOG_MARGIN * 2);
  const maxHeight = Math.max(320, viewport.height - LAW_DIALOG_TOP_MARGIN - LAW_DIALOG_MARGIN);
  const minWidth = Math.min(LAW_DIALOG_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(LAW_DIALOG_MIN_HEIGHT, maxHeight);
  const right = startRect.left + startRect.width;
  const bottom = startRect.top + startRect.height;
  let { left, top, width, height } = startRect;

  if (direction.includes("e")) {
    width = clamp(startRect.width + dx, minWidth, viewport.width - LAW_DIALOG_MARGIN - left);
  }

  if (direction.includes("s")) {
    height = clamp(startRect.height + dy, minHeight, viewport.height - LAW_DIALOG_MARGIN - top);
  }

  if (direction.includes("w")) {
    const minLeft = Math.max(LAW_DIALOG_MARGIN, right - maxWidth);
    const maxLeft = right - minWidth;
    left = clamp(startRect.left + dx, minLeft, maxLeft);
    width = right - left;
  }

  if (direction.includes("n")) {
    const minTop = Math.max(LAW_DIALOG_TOP_MARGIN, bottom - maxHeight);
    const maxTop = bottom - minHeight;
    top = clamp(startRect.top + dy, minTop, maxTop);
    height = bottom - top;
  }

  return clampLawDialogRect({ left, top, width, height });
};
const getLawDialogCursor = (action: LawDialogAction | null) => {
  if (!action) return "";
  if (action.type === "move") return "move";

  const cursorMap: Record<ResizeDirection, string> = {
    n: "n-resize",
    e: "e-resize",
    s: "s-resize",
    w: "w-resize",
    ne: "ne-resize",
    nw: "nw-resize",
    se: "se-resize",
    sw: "sw-resize",
  };

  return cursorMap[action.direction];
};
const isClipboardShortcut = (event: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
  const key = event.key.toLowerCase();
  return ((event.ctrlKey || event.metaKey) && (key === "c" || key === "v" || key === "x" || key === "insert")) || (event.shiftKey && key === "insert");
};
const EXAM_CLIPBOARD_ALLOWED_SELECTOR = ".itemArea, .itemContext, .zhuGuan, #msTitle, .textAreaWh";
const isEditableClipboardElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLInputElement)) return false;
  if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled;
  return !target.readOnly && !target.disabled && ["text", "search", "url", "tel", "password", "email", "number"].includes(target.type);
};
const isNodeWithinClipboardAllowedArea = (node: Node | null) => {
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest(EXAM_CLIPBOARD_ALLOWED_SELECTOR));
};
const getSelectionFromNode = (node?: Node | null) => {
  const root = node?.getRootNode?.();
  const rootSelection =
    root && "getSelection" in root
      ? (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? null
      : null;
  return rootSelection ?? window.getSelection?.() ?? null;
};
const hasClipboardAllowedSelection = (node?: Node | null) => {
  const selection = getSelectionFromNode(node);
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  return isNodeWithinClipboardAllowedArea(selection.getRangeAt(0).commonAncestorContainer);
};

const toHtml = (text: string) => (!text ? "" : text.includes("<") ? text : text.replace(/\n/g, "<br />"));
const stripLegacyYearLabel = (text: string) => text.replace(/（2019年真题）/g, "");
const promptHtml = (q: MockExamQuestion) =>
  toHtml(stripLegacyYearLabel(q.material && q.stem ? `${q.material}\n\n${q.stem}` : q.material || q.stem));
const orderText = (index: number) => SECTION_ORDERS[index] ?? `${index + 1}. `;
const getQuestionTypeCode = (question: MockExamQuestion) => {
  if (question.type === "single_choice") return 0;
  if (question.type === "multiple_choice") return 1;
  if (question.type === "uncertain_choice") return 2;
  return 11;
};
const getPaperSubjectName = (record: MockExamRecordDetail) => {
  const phaseLabel = record.paper.phase || getExamPhaseLabel(record);
  if (phaseLabel.includes("试卷一")) return "试卷一";
  if (phaseLabel.includes("试卷二")) return "试卷二";
  if (phaseLabel.includes("主观")) return "主观题";
  return record.paper.title || phaseLabel;
};

function MockExamShadowRoot({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    if (!hostRef.current) return;
    const root = hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: "open" });
    setShadowRoot(root);
  }, []);

  return (
    <div ref={hostRef} style={{ display: "block", minHeight: "100vh" }}>
      {shadowRoot
        ? createPortal(
            <>
              <style>{MOCK_EXAM_SHADOW_RESET}</style>
              <style>{mockExamOfficialCss + MOCK_EXAM_RADIO_BASE_CSS}</style>
              {children}
            </>,
            shadowRoot,
          )
        : null}
    </div>
  );
}

export function MockExamRoom() {
  const { recordId = "" } = useParams();
  const navigate = useNavigate();
  const isMobileBlocked = useMockExamDesktopGuard();
  const [record, setRecord] = useState<MockExamRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSubQuestionIndex, setActiveSubQuestionIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [arrayDialogOpen, setArrayDialogOpen] = useState(false);
  const [subjectiveLeaveState, setSubjectiveLeaveState] = useState<SubjectiveLeaveState>(null);
  const [leftNavOpen, setLeftNavOpen] = useState(true);
  const [themeId, setThemeId] = useState<ThemeId>(1);
  const [fontSize, setFontSize] = useState(18);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [zhuguanAH, setZhuguanAH] = useState<SubjectivePanelHeight>("300px");
  const [zhuguanQH, setZhuguanQH] = useState<AnswerPanelHeight>("340px");
  const [markedQuestionIds, setMarkedQuestionIds] = useState<string[]>([]);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [groupVisibility, setGroupVisibility] = useState<Record<string, boolean>>({});
  const [selectedText, setSelectedText] = useState("");
  const [promptHighlightHtmlMap, setPromptHighlightHtmlMap] = useState<Record<string, string>>({});
  const [subjectiveTitleHighlightHtmlMap, setSubjectiveTitleHighlightHtmlMap] = useState<Record<string, string>>({});
  const [lawDialogOpen, setLawDialogOpen] = useState(false);
  const [lawDialogMaximized, setLawDialogMaximized] = useState(false);
  const [lawDialogRect, setLawDialogRect] = useState<LawDialogRect>(() => buildDefaultLawDialogRect());
  const [lawDialogInteracting, setLawDialogInteracting] = useState(false);
  const recordRef = useRef<MockExamRecordDetail | null>(null);
  const draftRef = useRef<Record<string, string>>({});
  const submittingRef = useRef(false);
  const skipPauseRef = useRef(false);
  const allowUnmountPauseRef = useRef(false);
  const autoSubmitRef = useRef(false);
  const copyTextRef = useRef("");
  const timersRef = useRef<Record<string, number>>({});
  const pendingRef = useRef<Record<string, PendingEntry>>({});
  const undoHistoryRef = useRef<Record<string, string[]>>({});
  const redoHistoryRef = useRef<Record<string, string[]>>({});
  const lawDialogActionRef = useRef<LawDialogAction | null>(null);
  const lawDialogRestoreRectRef = useRef<LawDialogRect | null>(null);
  const lastClipboardWarningAtRef = useRef(0);
  const lawFrameRef = useRef<HTMLIFrameElement | null>(null);
  const answerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const questionPromptRef = useRef<HTMLSpanElement | null>(null);
  const subjectiveTitleRef = useRef<HTMLDivElement | null>(null);
  const highlightSelectionRef = useRef<HighlightSelection | null>(null);

  useEffect(() => { recordRef.current = record; }, [record]);
  useEffect(() => { draftRef.current = draftAnswers; }, [draftAnswers]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VIEW_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{ themeId: ThemeId; fontSize: number; leftNavOpen: boolean }>;
      if (parsed.themeId && parsed.themeId in THEME_BG) setThemeId(parsed.themeId);
      if (typeof parsed.fontSize === "number") setFontSize(Math.max(12, Math.min(28, parsed.fontSize)));
      if (typeof parsed.leftNavOpen === "boolean") setLeftNavOpen(parsed.leftNavOpen);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_KEY, JSON.stringify({ themeId, fontSize, leftNavOpen })); } catch {}
  }, [fontSize, leftNavOpen, themeId]);

  useEffect(() => () => Object.values(timersRef.current).forEach((id) => window.clearTimeout(id)), []);

  useEffect(() => {
    const stopLawDialogAction = () => {
      lawDialogActionRef.current = null;
      setLawDialogInteracting(false);
      document.body.style.userSelect = "";
    };

    const handleMouseMove = (event: MouseEvent) => {
      const action = lawDialogActionRef.current;
      if (!action) return;

      event.preventDefault();

      if (action.type === "move") {
        setLawDialogRect(
          clampLawDialogRect({
            ...action.startRect,
            left: action.startRect.left + event.clientX - action.startX,
            top: action.startRect.top + event.clientY - action.startY,
          }),
        );
        return;
      }

      setLawDialogRect(
        resizeLawDialogRect(action.startRect, action.direction, event.clientX - action.startX, event.clientY - action.startY),
      );
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopLawDialogAction);
    window.addEventListener("blur", stopLawDialogAction);
    window.addEventListener("mouseleave", stopLawDialogAction);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopLawDialogAction);
      window.removeEventListener("blur", stopLawDialogAction);
      window.removeEventListener("mouseleave", stopLawDialogAction);
      stopLawDialogAction();
    };
  }, []);

  useEffect(() => {
    if (!lawDialogOpen) return;

    syncLawFrameBridge();

    const handleResize = () => {
      setLawDialogRect((current) => (lawDialogMaximized ? buildMaximizedLawDialogRect() : clampLawDialogRect(current)));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLawDialogOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lawDialogMaximized, lawDialogOpen, lawDialogRect]);

  useEffect(() => {
    if (isMobileBlocked) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const detail = await mockApi.getMockExamRecord(recordId);
        if (detail.status === "submitted") return void navigateAfterSubmit(detail.id, detail.reviewWorkflowStatus, detail.reviewEnabled);
        const drafts = buildSubjectiveDraftMap(detail.questions);
        setRecord(detail);
        setCountdown(detail.remainingSeconds);
        setActiveIndex(getInitialQuestionIndex(detail.questions));
        setActiveSubQuestionIndex(0);
        setDraftAnswers(drafts);
        draftRef.current = drafts;
        setGroupVisibility(Object.fromEntries(buildQuestionGroups(detail.questions).map((group) => [group.key, true])));
        setZhuguanAH("300px");
        setZhuguanQH("340px");
        autoSubmitRef.current = false;
        try {
          const rawMarks = window.localStorage.getItem(`${MARK_KEY_PREFIX}${detail.id}`);
          const marks = rawMarks ? JSON.parse(rawMarks) : [];
          setMarkedQuestionIds(Array.isArray(marks) ? marks.filter((item) => typeof item === "string") : []);
        } catch { setMarkedQuestionIds([]); }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载考试失败");
        navigateBackToPaperHome();
      } finally { setLoading(false); }
    };
    void load();
  }, [isMobileBlocked, navigate, recordId]);

  useEffect(() => {
    if (!record || record.status !== "in_progress") return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [record?.id, record?.status]);

  useEffect(() => {
    if (!record || record.status !== "in_progress") return;
    allowUnmountPauseRef.current = false;
    const armPause = window.setTimeout(() => {
      allowUnmountPauseRef.current = true;
    }, 0);
    const handlePageHide = () => {
      void pauseExam({ keepalive: true, skipState: true });
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.clearTimeout(armPause);
      if (allowUnmountPauseRef.current) {
        void pauseExam({ keepalive: true, skipState: true });
      }
      allowUnmountPauseRef.current = false;
    };
  }, [record?.id, record?.status]);

  useEffect(() => {
    if (!record || record.status !== "in_progress") return;
    if (countdown <= 0) {
      if (!autoSubmitRef.current) { autoSubmitRef.current = true; void handleSubmit(true); }
      return;
    }
    const id = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [countdown, record, submitting]);

  useEffect(() => {
    highlightSelectionRef.current = null;
    copyTextRef.current = "";
    setSelectedText("");
  }, [activeIndex, activeSubQuestionIndex]);

  const persistMarks = (next: string[]) => {
    if (!recordRef.current) return;
    try { window.localStorage.setItem(`${MARK_KEY_PREFIX}${recordRef.current.id}`, JSON.stringify(next)); } catch {}
  };

  const navigateBackToPaperHome = () => {
    const active = recordRef.current;
    if (!active) {
      navigate("/user/mock-exams", { replace: true });
      return;
    }
    navigate(getMockExamHomePath(active.paper), { replace: true });
  };

  const navigateAfterSubmit = (nextRecordId: string, reviewWorkflowStatus?: string, reviewEnabled?: boolean) => {
    skipPauseRef.current = true;
    if (reviewEnabled && reviewWorkflowStatus && reviewWorkflowStatus !== "published" && reviewWorkflowStatus !== "not_required") {
      navigate(`/user/mock-exams/records/${nextRecordId}/review-pending`, { replace: true });
      return;
    }
    navigate(`/user/mock-exams/records/${nextRecordId}/result`, { replace: true });
  };

  const pauseExam = async (options?: { keepalive?: boolean; skipState?: boolean }) => {
    const active = recordRef.current;
    if (!active || active.status !== "in_progress" || submittingRef.current || skipPauseRef.current) return;
    try {
      const paused = await mockApi.pauseMockExam(active.id, { keepalive: options?.keepalive });
      if (!options?.skipState) {
        recordRef.current = paused;
        setRecord(paused);
        setCountdown(paused.remainingSeconds);
      }
    } catch {}
  };

  const persistSubjective = async (entry: PendingEntry) => {
    const active = recordRef.current;
    if (!active || active.status !== "in_progress") return;
    try {
      const saved = await mockApi.saveMockExamAnswer(active.id, { questionId: entry.questionId, subQuestionId: entry.subQuestionId, answerText: entry.text });
      setRecord(saved);
      if (saved.status === "submitted") return void navigateAfterSubmit(saved.id, saved.reviewWorkflowStatus, saved.reviewEnabled);
      const key = buildDraftKey(entry.questionId, entry.subQuestionId);
      if (pendingRef.current[key]?.text === entry.text) delete pendingRef.current[key];
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "主观题答案保存失败");
    }
  };

  const flushPending = async () => {
    for (const [key, entry] of Object.entries(pendingRef.current)) {
      if (timersRef.current[key]) { window.clearTimeout(timersRef.current[key]); delete timersRef.current[key]; }
      await persistSubjective(entry);
    }
  };

  const handleSubmit = async (isAuto = false) => {
    const active = recordRef.current;
    if (!active || submitting) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await flushPending();
      const detail = await mockApi.submitMockExam(active.id);
      toast.success(isAuto ? "考试时间已到，系统已自动交卷" : "交卷成功");
      navigateAfterSubmit(detail.id, detail.reviewWorkflowStatus, detail.reviewEnabled);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "交卷失败");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitDialogOpen(false);
    }
  };

  const syncDraft = (
    questionId: string,
    subQuestion: MockExamSubjectiveSubQuestion,
    value: string,
    options?: { skipHistory?: boolean },
  ) => {
    const key = buildDraftKey(questionId, subQuestion.id);
    const previous = draftRef.current[key] ?? subQuestion.answer ?? "";
    if (!options?.skipHistory && previous !== value) {
      if (!undoHistoryRef.current[key]) undoHistoryRef.current[key] = [];
      undoHistoryRef.current[key].push(previous);
      redoHistoryRef.current[key] = [];
    }
    const nextDrafts = { ...draftRef.current, [key]: value };
    draftRef.current = nextDrafts;
    setDraftAnswers(nextDrafts);
    pendingRef.current[key] = { questionId, subQuestionId: subQuestion.id, text: value };
    if (timersRef.current[key]) window.clearTimeout(timersRef.current[key]);
    timersRef.current[key] = window.setTimeout(() => { delete timersRef.current[key]; const entry = pendingRef.current[key]; if (entry) void persistSubjective(entry); }, SAVE_DELAY);
  };

  if (!isMobileBlocked && (loading || !record)) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>考试加载中...</div>;

  if (isMobileBlocked) {
    return <MockExamDesktopNotice />;
  }

  const groups = buildQuestionGroups(record.questions);
  const currentQuestion = record.questions[activeIndex] ?? record.questions[0];
  const isSubjective = isSubjectiveQuestion(currentQuestion);
  const currentSubQuestion = isSubjective ? currentQuestion.subjectiveSubQuestions[activeSubQuestionIndex] ?? currentQuestion.subjectiveSubQuestions[0] : null;
  const currentSubText = isSubjective && currentSubQuestion ? getDraftAnswer(currentQuestion.id, currentSubQuestion, draftAnswers) : "";
  const currentGroupIndex = groups.findIndex((group) => group.questions.some((question) => question.id === currentQuestion.id));
  const currentGroup = groups[currentGroupIndex] ?? groups[0];
  const currentQuestionTypeCode = getQuestionTypeCode(currentQuestion);
  const currentPromptHtml = promptHtml(currentQuestion);
  const currentPromptDisplayHtml = promptHighlightHtmlMap[currentQuestion.id] ?? currentPromptHtml;
  const currentSubQuestionTitleKey = currentSubQuestion ? buildSubjectiveTitleKey(currentQuestion.id, currentSubQuestion.id) : "";
  const currentSubQuestionTitleBaseHtml = currentSubQuestion ? toHtml(currentSubQuestion.title) : "";
  const currentSubQuestionTitleDisplayHtml =
    currentSubQuestion && currentSubQuestionTitleKey
      ? subjectiveTitleHighlightHtmlMap[currentSubQuestionTitleKey] ?? currentSubQuestionTitleBaseHtml
      : "";
  const answeredCount = getAnsweredQuestionCount(record.questions, draftAnswers);
  const unfinishedCount = record.questions.filter((question) => getQuestionState(question, draftAnswers) !== "answered").length;
  const displayPhone = getUserPhone() || "13800000000";
  const displayTicketNo = getMockExamTicketNo() || buildTicketNo(displayPhone);
  const displayCardNo = getMockExamCardNo() || buildIdCardNo(displayPhone);
  const subjectName = getPaperSubjectName(record);
  const currentQuestionMarked = markedQuestionIds.includes(currentQuestion.id);
  const currentSubjectiveUnfinishedCount = isSubjective
    ? currentQuestion.subjectiveSubQuestions.filter((subQuestion) => !getDraftAnswer(currentQuestion.id, subQuestion, draftAnswers).trim()).length
    : 0;
  const currentObjectiveDescription = OFFICIAL_OBJECTIVE_DESCRIPTIONS[currentGroupIndex] ?? currentGroup?.description ?? currentQuestion.sectionDescription;
  const getExamSelection = () => getSelectionFromNode(questionPromptRef.current ?? subjectiveTitleRef.current ?? answerTextareaRef.current);
  const selectWindowText = () => getExamSelection()?.toString() ?? "";

  const performJump = (index: number) => {
    setActiveIndex(index);
    setActiveSubQuestionIndex(0);
  };

  const attemptJump = (index: number) => {
    if (index === activeIndex) return;

    if (isSubjective && currentQuestion.subjectiveSubQuestions.length > 1 && currentSubjectiveUnfinishedCount > 0) {
      setSubjectiveLeaveState({
        nextIndex: index,
        message: `第 ${activeIndex + 1} 题还有 ${currentSubjectiveUnfinishedCount} 小问未作答，确认离开？`,
      });
      return;
    }

    if (currentQuestion.type === "multiple_choice" && currentQuestion.userAnswerKeys.length === 1) {
      setArrayDialogOpen(true);
      return;
    }

    performJump(index);
  };

  const changeQuestionByDirection = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (activeIndex <= 0) {
        toast.warning("这是第一题");
        return;
      }
      attemptJump(activeIndex - 1);
      return;
    }

    if (activeIndex >= record.questions.length - 1) {
      toast.warning("这是最后一题");
      return;
    }
    attemptJump(activeIndex + 1);
  };

  const changeSubQuestionByDirection = (direction: "prev" | "next") => {
    if (!isSubjective) return;

    if (direction === "prev") {
      if (activeSubQuestionIndex <= 0) {
        toast.warning("这是第一问");
        return;
      }
      setActiveSubQuestionIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (activeSubQuestionIndex >= currentQuestion.subjectiveSubQuestions.length - 1) {
      toast.warning("这是最后一问");
      return;
    }
    setActiveSubQuestionIndex((current) => Math.min(currentQuestion.subjectiveSubQuestions.length - 1, current + 1));
  };

  const toggleMark = (questionId: string, nextValue?: boolean) => {
    setMarkedQuestionIds((current) => {
      const exists = current.includes(questionId);
      const shouldAdd = typeof nextValue === "boolean" ? nextValue : !exists;
      const next = shouldAdd ? (exists ? current : [...current, questionId]) : current.filter((item) => item !== questionId);
      persistMarks(next);
      return next;
    });
  };

  const clearHighlightSelection = () => {
    highlightSelectionRef.current = null;
    copyTextRef.current = "";
    setSelectedText("");
    getExamSelection()?.removeAllRanges();
  };

  const buildHighlightSelection = (root: HTMLElement, range: Range, block: HighlightBlock, key: string) => {
    if (!root.contains(range.commonAncestorContainer)) return null;
    const start = getTextOffsetWithin(root, range.startContainer, range.startOffset);
    const end = getTextOffsetWithin(root, range.endContainer, range.endOffset);
    if (end <= start) return null;
    return { block, key, start, end } satisfies HighlightSelection;
  };

  const setPromptHighlightHtml = (questionId: string, nextHtml: string, baseHtml: string) => {
    setPromptHighlightHtmlMap((current) => {
      const next = { ...current };
      if (nextHtml === baseHtml) delete next[questionId];
      else next[questionId] = nextHtml;
      return next;
    });
  };

  const setSubjectiveTitleHighlightHtml = (key: string, nextHtml: string, baseHtml: string) => {
    setSubjectiveTitleHighlightHtmlMap((current) => {
      const next = { ...current };
      if (nextHtml === baseHtml) delete next[key];
      else next[key] = nextHtml;
      return next;
    });
  };

  const handleStemMark = () => {
    const selection = highlightSelectionRef.current;
    if (!selection) {
      toast.warning("请先选中需要标识的题干内容");
      return;
    }

    if (selection.block === "prompt") {
      const nextHtml = applyHighlightToHtml(currentPromptDisplayHtml, selection.start, selection.end);
      setPromptHighlightHtml(currentQuestion.id, nextHtml, currentPromptHtml);
      clearHighlightSelection();
      return;
    }

    if (selection.block === "subjective-title" && currentSubQuestion && currentSubQuestionTitleKey) {
      const nextHtml = applyHighlightToHtml(currentSubQuestionTitleDisplayHtml, selection.start, selection.end);
      setSubjectiveTitleHighlightHtml(currentSubQuestionTitleKey, nextHtml, currentSubQuestionTitleBaseHtml);
      clearHighlightSelection();
      return;
    }

    toast.warning("当前选中内容不支持题干标识");
  };

  const handleStemUnmark = () => {
    const selection = highlightSelectionRef.current;

    if (selection?.block === "prompt") {
      const nextHtml = clearHighlightInHtml(currentPromptDisplayHtml, selection.start, selection.end);
      setPromptHighlightHtml(currentQuestion.id, nextHtml, currentPromptHtml);
      clearHighlightSelection();
      return;
    }

    if (selection?.block === "subjective-title" && currentSubQuestion && currentSubQuestionTitleKey) {
      const nextHtml = clearHighlightInHtml(currentSubQuestionTitleDisplayHtml, selection.start, selection.end);
      setSubjectiveTitleHighlightHtml(currentSubQuestionTitleKey, nextHtml, currentSubQuestionTitleBaseHtml);
      clearHighlightSelection();
      return;
    }

    if (currentPromptDisplayHtml !== currentPromptHtml) {
      setPromptHighlightHtml(currentQuestion.id, clearHighlightInHtml(currentPromptDisplayHtml), currentPromptHtml);
    }
    if (currentSubQuestion && currentSubQuestionTitleKey && currentSubQuestionTitleDisplayHtml !== currentSubQuestionTitleBaseHtml) {
      setSubjectiveTitleHighlightHtml(
        currentSubQuestionTitleKey,
        clearHighlightInHtml(currentSubQuestionTitleDisplayHtml),
        currentSubQuestionTitleBaseHtml,
      );
    }
    clearHighlightSelection();
  };

  const handleObjectiveAnswer = async (optionKey: string) => {
    const active = recordRef.current;
    if (!active || submitting) return;
    const nextAnswerKeys = buildNextAnswerKeys(currentQuestion, optionKey);
    const previous = active;
    setRecord(applyObjectiveAnswerToRecord(active, currentQuestion.id, nextAnswerKeys, draftRef.current));
    try {
      const saved = await mockApi.saveMockExamAnswer(active.id, { questionId: currentQuestion.id, answerKeys: nextAnswerKeys });
      if (saved.status === "submitted") return void navigateAfterSubmit(saved.id, saved.reviewWorkflowStatus, saved.reviewEnabled);
      setRecord(saved);
    } catch (error) {
      setRecord(previous);
      toast.error(error instanceof Error ? error.message : "保存答案失败");
    }
  };

  const handleUndo = () => {
    if (!currentSubQuestion) return;
    const key = buildDraftKey(currentQuestion.id, currentSubQuestion.id);
    const history = undoHistoryRef.current[key] ?? [];
    const currentValue = draftRef.current[key] ?? currentSubQuestion.answer ?? "";

    if (history.length === 0) {
      if (!currentValue) return;
      if (!redoHistoryRef.current[key]) redoHistoryRef.current[key] = [];
      redoHistoryRef.current[key].push(currentValue);
      syncDraft(currentQuestion.id, currentSubQuestion, "", { skipHistory: true });
      return;
    }

    const previous = history.pop() ?? "";
    if (!redoHistoryRef.current[key]) redoHistoryRef.current[key] = [];
    redoHistoryRef.current[key].push(currentValue);
    syncDraft(currentQuestion.id, currentSubQuestion, previous, { skipHistory: true });
  };

  const handleRedo = () => {
    if (!currentSubQuestion) return;
    const key = buildDraftKey(currentQuestion.id, currentSubQuestion.id);
    const history = redoHistoryRef.current[key] ?? [];
    if (history.length === 0) return;

    const currentValue = draftRef.current[key] ?? currentSubQuestion.answer ?? "";
    const nextValue = history.pop() ?? "";
    if (!undoHistoryRef.current[key]) undoHistoryRef.current[key] = [];
    undoHistoryRef.current[key].push(currentValue);
    syncDraft(currentQuestion.id, currentSubQuestion, nextValue, { skipHistory: true });
  };

  const notifyClipboardDisabled = () => {
    const now = Date.now();
    if (now - lastClipboardWarningAtRef.current < 1200) return;
    lastClipboardWarningAtRef.current = now;
    toast.warning(CLIPBOARD_DISABLED_MESSAGE);
  };

  const blockClipboardAction = (event?: { preventDefault: () => void; stopPropagation?: () => void }) => {
    event?.preventDefault();
    event?.stopPropagation?.();
    notifyClipboardDisabled();
  };

  const isAllowedClipboardContext = (target: EventTarget | null) => {
    if (isEditableClipboardElement(target)) return true;
    if (target instanceof Element && target.closest(EXAM_CLIPBOARD_ALLOWED_SELECTOR)) return true;
    return hasClipboardAllowedSelection(questionPromptRef.current ?? subjectiveTitleRef.current ?? answerTextareaRef.current);
  };

  const handleExamClipboardCapture = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (isAllowedClipboardContext(event.target)) return;
    blockClipboardAction(event);
  };

  const handleExamKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isClipboardShortcut(event) && !isAllowedClipboardContext(event.target)) {
      blockClipboardAction(event);
    }
  };

  const handleLawFrameLoad = () => {
    const frameWindow = lawFrameRef.current?.contentWindow as LawFrameWindow | null;
    const frameDocument = lawFrameRef.current?.contentDocument;
    if (!frameWindow || !frameDocument) return;

    const handleFrameClipboard = (event: Event) => {
      blockClipboardAction(event as { preventDefault: () => void; stopPropagation?: () => void });
    };

    const handleFrameKeyDown = (event: KeyboardEvent) => {
      if (isClipboardShortcut(event)) {
        blockClipboardAction(event as { preventDefault: () => void; stopPropagation?: () => void });
      }
    };

    frameDocument.addEventListener("copy", handleFrameClipboard, true);
    frameDocument.addEventListener("cut", handleFrameClipboard, true);
    frameDocument.addEventListener("paste", handleFrameClipboard, true);
    frameWindow.addEventListener("keydown", handleFrameKeyDown, true);
    syncLawFrameBridge();
  };

  const handleCopy = async () => {
    const currentSelection = selectWindowText().trim();
    const textarea = answerTextareaRef.current;
    const textareaSelection =
      textarea && textarea.selectionStart !== textarea.selectionEnd
        ? textarea.value.slice(textarea.selectionStart ?? 0, textarea.selectionEnd ?? 0)
        : "";
    const textToCopy = currentSelection || textareaSelection || selectedText.trim();
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      return;
    } catch {}

    if (textarea) {
      textarea.focus();
      document.execCommand("copy");
    }
  };

  const handleCut = () => {
    if (!currentSubQuestion) return;
    const textarea = answerTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    if (start === end) return;

    const cutText = textarea.value.slice(start, end);
    void navigator.clipboard.writeText(cutText).catch(() => undefined);
    const nextValue = `${textarea.value.slice(0, start)}${textarea.value.slice(end)}`;
    syncDraft(currentQuestion.id, currentSubQuestion, nextValue);
    window.requestAnimationFrame(() => {
      const nextTextarea = answerTextareaRef.current;
      if (!nextTextarea) return;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(start, start);
    });
  };

  const handlePaste = async () => {
    if (!currentSubQuestion) return;
    const textarea = answerTextareaRef.current;
    if (!textarea) return;

    let pasteText = "";
    try {
      pasteText = await navigator.clipboard.readText();
    } catch {
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const nextValue = `${textarea.value.slice(0, start)}${pasteText}${textarea.value.slice(end)}`;
    const nextCursor = start + pasteText.length;
    syncDraft(currentQuestion.id, currentSubQuestion, nextValue);
    window.requestAnimationFrame(() => {
      const nextTextarea = answerTextareaRef.current;
      if (!nextTextarea) return;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleQuestionMouseUp = () => {
    const selectionText = selectWindowText();
    setSelectedText(selectionText);
    copyTextRef.current = selectionText;

    const selection = getExamSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      highlightSelectionRef.current = null;
      return;
    }

    const range = selection.getRangeAt(0);
    const promptRoot = questionPromptRef.current;
    if (promptRoot && promptRoot.contains(range.commonAncestorContainer)) {
      highlightSelectionRef.current = buildHighlightSelection(promptRoot, range, "prompt", currentQuestion.id);
      return;
    }

    const titleRoot = subjectiveTitleRef.current;
    if (titleRoot && currentSubQuestion && titleRoot.contains(range.commonAncestorContainer)) {
      highlightSelectionRef.current = buildHighlightSelection(
        titleRoot,
        range,
        "subjective-title",
        buildSubjectiveTitleKey(currentQuestion.id, currentSubQuestion.id),
      );
      return;
    }

    highlightSelectionRef.current = null;
  };

  const openLawDialog = () => {
    setLawDialogRect((current) => clampLawDialogRect(lawDialogRestoreRectRef.current ?? current));
    setLawDialogMaximized(false);
    setLawDialogOpen(true);
  };

  const closeLawDialog = () => {
    lawDialogActionRef.current = null;
    setLawDialogInteracting(false);
    document.body.style.userSelect = "";
    if (lawDialogMaximized) {
      setLawDialogRect(clampLawDialogRect(lawDialogRestoreRectRef.current ?? buildDefaultLawDialogRect()));
    }
    setLawDialogMaximized(false);
    setLawDialogOpen(false);
  };

  const toggleLawDialogMaximize = () => {
    if (lawDialogMaximized) {
      setLawDialogRect(clampLawDialogRect(lawDialogRestoreRectRef.current ?? buildDefaultLawDialogRect()));
      setLawDialogMaximized(false);
      return;
    }

    lawDialogRestoreRectRef.current = lawDialogRect;
    setLawDialogRect(buildMaximizedLawDialogRect());
    setLawDialogMaximized(true);
  };

  const syncLawFrameBridge = () => {
    const frameWindow = lawFrameRef.current?.contentWindow as LawFrameWindow | null;
    if (!frameWindow) return;

    frameWindow.__lawDialogBridge = {
      toggleFullscreen: () => {
        const next = !lawDialogMaximized;
        if (next) {
          lawDialogRestoreRectRef.current = clampLawDialogRect(lawDialogRect);
          setLawDialogRect(buildMaximizedLawDialogRect());
        } else {
          setLawDialogRect(clampLawDialogRect(lawDialogRestoreRectRef.current ?? buildDefaultLawDialogRect()));
        }
        setLawDialogMaximized(next);
        return next;
      },
      getIsFullscreen: () => lawDialogMaximized,
    };

    frameWindow.dispatchEvent(
      new frameWindow.CustomEvent("law-dialog-bridge-change", {
        detail: { isFullscreen: lawDialogMaximized },
      }),
    );
  };

  const startLawDialogMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (lawDialogMaximized) return;
    event.preventDefault();
    setLawDialogInteracting(true);
    lawDialogActionRef.current = {
      type: "move",
      startX: event.clientX,
      startY: event.clientY,
      startRect: lawDialogRect,
    };
    document.body.style.userSelect = "none";
  };

  const startLawDialogResize = (direction: ResizeDirection) => (event: ReactMouseEvent<HTMLDivElement>) => {
    if (lawDialogMaximized) return;
    event.preventDefault();
    event.stopPropagation();
    setLawDialogInteracting(true);
    lawDialogActionRef.current = {
      type: "resize",
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startRect: lawDialogRect,
    };
    document.body.style.userSelect = "none";
  };

  return (
    <MockExamShadowRoot>
      <div {...SCOPE} onCopyCapture={handleExamClipboardCapture} onCutCapture={handleExamClipboardCapture} onPasteCapture={handleExamClipboardCapture} onKeyDownCapture={handleExamKeyDownCapture}>
        <div {...SCOPE} id="layout" style={{ background: THEME_BG[themeId] }}>
        <div {...SCOPE} id="header">
          <div {...SCOPE} className="infoNav">
            <ul {...SCOPE}>
              <li {...SCOPE} style={{ width: "45px", height: "56px", border: "1px solid #fff", marginRight: "8px" }} />
              <li {...SCOPE}>
                姓&nbsp;名：<span {...SCOPE} id="ksxm">xxx</span><br {...SCOPE} />
                性&nbsp;别：<span {...SCOPE} id="ksxb">女</span><br {...SCOPE} />
                准考证号&nbsp;：<span {...SCOPE}>{displayTicketNo}</span><br {...SCOPE} />
                身份证号:&nbsp;<span {...SCOPE}>{displayCardNo}</span>
              </li>
            </ul>
          </div>
          <div {...SCOPE} className="clockNav">
            <ul {...SCOPE}>
              <li {...SCOPE} className="clockNav_m"><div {...SCOPE}>考试剩余时间:<span {...SCOPE} id="clock">{formatCountdown(countdown)}</span></div></li>
              <li {...SCOPE}><input {...SCOPE} className="submitbutton" id="submitbtn" name="交卷" type="button" value="交 卷" onClick={() => setSubmitDialogOpen(true)} /></li>
            </ul>
          </div>
          <div {...SCOPE} className="subjectNav">
            <span {...SCOPE} className="prname" id="projectName">国家统一法律职业资格考试计算机化考试模拟答题系统</span><br {...SCOPE} />
            <span {...SCOPE} id="subjectName">{subjectName}</span>
          </div>
        </div>

        <div {...SCOPE} id="main">
          <div {...SCOPE} id="leftnav" style={{ width: `${leftNavOpen ? 384 : 0}px` }}>
            <div {...SCOPE} id="itembar">
              <div {...SCOPE} id="papernav">
                <ul {...SCOPE} id="P-sj2" style={{ display: "block" }}>
                  {groups.map((group, groupIndex) => (
                    <li {...SCOPE} key={group.key}>
                      <p
                        {...SCOPE}
                        className={groupVisibility[group.key] === false ? "hide" : undefined}
                        onClick={() => setGroupVisibility((current) => ({ ...current, [group.key]: !current[group.key] }))}
                      >
                        <a {...SCOPE} href="#!" onClick={(event) => event.preventDefault()}>&nbsp;&nbsp;{orderText(groupIndex)}{group.label}</a>
                      </p>
                      <div {...SCOPE} className="subitem" style={{ display: groupVisibility[group.key] === false ? "none" : "block" }}>
                        {group.questions.map((question) => {
                          const index = record.questions.findIndex((item) => item.id === question.id);
                          const answered = getQuestionState(question, draftAnswers) === "answered";
                          const marked = markedQuestionIds.includes(question.id);
                          return (
                            <span {...SCOPE} key={question.id}>
                              <span {...SCOPE}>
                                <a
                                  {...SCOPE}
                                  href="#!"
                                  style={answered ? { color: "green" } : undefined}
                                  onClick={(event) => { event.preventDefault(); attemptJump(index); }}
                                >
                                  {" "}{index + 1}{marked ? <span {...SCOPE} style={{ color: "red" }}>?</span> : !answered ? <span {...SCOPE} style={{ color: "red" }}>*</span> : null}
                                </a>
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {isSubjective ? (
                <div {...SCOPE} className="submark">
                  说明：<br {...SCOPE} />
                  1.主观题考试设置选作题的，应试人员可选择其一作答。<br {...SCOPE} />
                  2.题号右方的“*”符号代表该题尚未作答。<br {...SCOPE} />
                  3.题号右方的“?”符号代表该题做过标记。<br {...SCOPE} />
                  4.作答的同时系统自动保存答案。
                  <div {...SCOPE} style={{ textAlign: "center", marginTop: "13px" }}>
                    <button
                      {...SCOPE}
                      type="button"
                      style={{ padding: "7px 12px", fontWeight: 600, fontSize: "14px", color: "black", background: "linear-gradient(#9bccf3, #478ec4)", border: "1px solid #5d8ab6", cursor: "pointer" }}
                      onClick={openLawDialog}
                    >
                      法律法规汇编
                    </button>
                  </div>
                </div>
              ) : (
                <div {...SCOPE} className="submark">
                  说明：<br {...SCOPE} />
                  1.题号右方的“*”符号代表该题尚未作答。<br {...SCOPE} />
                  2.题号右方的“?”符号代表该题做过标记。<br {...SCOPE} />
                  3.作答的同时系统自动保存答案。
                </div>
              )}
            </div>
          </div>

          <div {...SCOPE} className="middlebar" onClick={() => setLeftNavOpen((current) => !current)}><input {...SCOPE} className={leftNavOpen ? "" : "hidden"} type="button" id="navbtn" readOnly /></div>

          <div {...SCOPE} id="container">
            <div {...SCOPE} id="question_frame2" style={{ height: "80%" }}>
              <div {...SCOPE} id="sjHtml" style={{ paddingTop: "10px", paddingLeft: "10px" }}>
                <div {...SCOPE} id="sjHtml2">
                  <div {...SCOPE} className="paperTitle">
                    <li {...SCOPE} className="single">试卷</li>
                    {currentQuestionTypeCode === 2 ? (
                      <li {...SCOPE}>
                        <a
                          {...SCOPE}
                          target="_self"
                          id="mark"
                          href="#!"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => { event.preventDefault(); handleStemMark(); }}
                        >
                          标记题干
                        </a>
                        <a
                          {...SCOPE}
                          target="_self"
                          id="unmark"
                          href="#!"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => { event.preventDefault(); handleStemUnmark(); }}
                        >
                          取消标记
                        </a>
                      </li>
                    ) : null}
                    <li {...SCOPE} id="themeLi" onMouseEnter={() => setThemeMenuOpen(true)} onMouseLeave={() => setThemeMenuOpen(false)}>
                      <a {...SCOPE} id="themeP">切换风格</a>
                      {([1, 2, 3, 4, 5] as ThemeId[]).map((id) => (
                        <div {...SCOPE} className="theme" id={`theme${id}`} key={id} style={{ display: themeMenuOpen ? "block" : "none" }} onClick={() => setThemeId(id)}>
                          风格{["一", "二", "三", "四", "五"][id - 1]}
                        </div>
                      ))}
                    </li>
                    <li {...SCOPE}>
                      <a {...SCOPE} id="themeAdd" style={{ cursor: "pointer" }} href="#!" onClick={(event) => { event.preventDefault(); setFontSize((current) => Math.min(28, current + 2)); }}>字体大小+</a>
                      <a {...SCOPE} id="themeDec" style={{ cursor: "pointer" }} href="#!" onClick={(event) => { event.preventDefault(); setFontSize((current) => Math.max(12, current - 2)); }}>字体大小-</a>
                    </li>
                  </div>

                  {!isSubjective ? (
                    <div {...SCOPE} id={`Ii-${activeIndex}`}>
                      <div {...SCOPE} className="itemGroupTitle">{orderText(currentGroupIndex)}{currentGroup?.label ?? currentQuestion.sectionLabel}。{currentObjectiveDescription}</div>
                      <div {...SCOPE} className="itemArea" itemcode="1" style={{ fontSize: `${fontSize}px` }} onMouseUp={handleQuestionMouseUp}>
                        <p {...SCOPE}>第<small {...SCOPE} className="itemName">{activeIndex + 1}</small>题&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span {...SCOPE} id="jmsz" style={{ fontSize: "14px" }} /></p>
                        <div {...SCOPE} className="itemContext"><span {...SCOPE} ref={questionPromptRef} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: currentPromptDisplayHtml }} /></div>
                        {currentQuestion.options.map((option, optionIndex) => (
                          <div {...SCOPE} className="choiceList" key={option.id} onClick={() => { void handleObjectiveAnswer(option.key); }}>
                            <div {...SCOPE} className="choiceContext" style={{ fontSize: `${fontSize}px`, cursor: "pointer" }}>
                              <div {...SCOPE} className="labelClss">
                                <div {...SCOPE} style={{ float: "left" }}>
                                  <input {...SCOPE} style={{ display: "none" }} type={currentQuestion.type === "single_choice" ? "radio" : "checkbox"} name={`item_${optionIndex}`} value={option.key} readOnly />
                                  <span {...SCOPE} className="choiceTitle">{option.key}.</span>
                                </div>
                                <div {...SCOPE} style={{ marginLeft: "54px" }}><span {...SCOPE} dangerouslySetInnerHTML={{ __html: toHtml(option.content) }} /></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div {...SCOPE} id={`Ii-${activeIndex}`}>
                      {zhuguanAH === "300px" ? (
                        <div {...SCOPE} className="itemGroupTitle zhuguanTitle">
                          {orderText(currentGroupIndex)}{currentGroup?.label ?? currentQuestion.sectionLabel}。(本题{currentQuestion.score}分)
                          <li {...SCOPE} className="rightFloat">
                            <a {...SCOPE} target="_self" id="mark1" href="#!" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); handleStemMark(); }}>题干标识</a>
                            <a {...SCOPE} target="_self" id="unmark1" href="#!" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); handleStemUnmark(); }}>取消标识</a>
                            {zhuguanQH === "340px" ? (
                              <a {...SCOPE} target="_self" href="#!" onClick={(event) => { event.preventDefault(); setZhuguanQH("100%"); }}>放大窗口</a>
                            ) : (
                              <a {...SCOPE} target="_self" href="#!" onClick={(event) => { event.preventDefault(); setZhuguanQH("340px"); }}>缩小窗口</a>
                            )}
                          </li>
                        </div>
                      ) : null}
                      {zhuguanAH === "300px" ? (
                        <div {...SCOPE} className="zhuGuan" style={{ height: zhuguanQH }} onMouseUp={handleQuestionMouseUp}>
                          <div {...SCOPE} className="itemContext"><span {...SCOPE} ref={questionPromptRef} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: currentPromptDisplayHtml }} /></div>
                        </div>
                      ) : null}
                      {zhuguanQH === "340px" ? (
                        <div {...SCOPE} id="answerArea">
                        <div {...SCOPE} className=" partingTitle ">
                          {currentQuestion.subjectiveSubQuestions.map((subQuestion, index) => {
                            const answer = getDraftAnswer(currentQuestion.id, subQuestion, draftAnswers);
                            return <li {...SCOPE} className={activeSubQuestionIndex === index ? "bewrite active2" : "bewrite"} id="bewrite03" key={subQuestion.id} onClick={() => setActiveSubQuestionIndex(index)}>{currentQuestion.subjectiveSubQuestions.length === 1 ? "问题" : `问题(${index + 1})`}{answer ? null : <b {...SCOPE} id="add03"> *</b>}</li>;
                          })}
                          <li {...SCOPE} className="tip" style={{ fontSize: "15.5px", fontWeight: "bold", marginTop: "8px" }}>请在对应的答题区域内答题！</li>
                          <li {...SCOPE} className="rightFloat">
                            <a {...SCOPE} target="_self" id="undo" href="#!" onClick={(event) => { event.preventDefault(); handleUndo(); }}>撤销</a>
                            <a {...SCOPE} target="_self" id="redo" href="#!" onClick={(event) => { event.preventDefault(); handleRedo(); }}>恢复</a>
                            <a {...SCOPE} target="_self" id="copy1" href="#!" onClick={(event) => { event.preventDefault(); handleCopy(); }}>复制</a>
                            <a {...SCOPE} target="_self" id="shear" href="#!" onClick={(event) => { event.preventDefault(); handleCut(); }}>剪切</a>
                            <a {...SCOPE} target="_self" id="paste1" href="#!" onClick={(event) => { event.preventDefault(); handlePaste(); }}>粘贴</a>
                            {zhuguanAH === "300px" ? (
                              <a {...SCOPE} target="_self" id="zoomwindow1" href="#!" onClick={(event) => { event.preventDefault(); setZhuguanAH("100%"); }}>放大窗口</a>
                            ) : (
                              <a {...SCOPE} target="_self" id="zoomwindow1" href="#!" onClick={(event) => { event.preventDefault(); setZhuguanAH("300px"); }}>缩小窗口</a>
                            )}
                          </li>
                        </div>
                        <div {...SCOPE} className="windowOverflow" id="window03">
                          {currentSubQuestion ? (
                            <div {...SCOPE} className="itemArea" id="B-1" itemcode="1">
                              <div {...SCOPE} id="msTitle" ref={subjectiveTitleRef} onMouseUp={handleQuestionMouseUp}>
                                <p {...SCOPE} className="zhuguanProblem" dangerouslySetInnerHTML={{ __html: currentSubQuestionTitleDisplayHtml }} />
                                <p {...SCOPE} className="spanBold">请在下方答题区内答题! <span {...SCOPE} style={{ color: "red" }} id="fontnum_3">已输入字数为：{currentSubText.length}</span></p>
                              </div>
                              <textarea
                                {...SCOPE}
                                className="textAreaWh"
                                id="textArea02"
                                ref={answerTextareaRef}
                                value={currentSubText}
                                onMouseUp={handleQuestionMouseUp}
                                onChange={(event) => syncDraft(currentQuestion.id, currentSubQuestion, event.target.value)}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div {...SCOPE} id="footer">
              <label {...SCOPE} style={{ fontWeight: "normal" }} htmlFor="testflag"><input {...SCOPE} style={{ width: "16px", height: "16px", verticalAlign: "middle" }} name="testflag" id="testflag" type="checkbox" checked={currentQuestionMarked} onChange={(event) => toggleMark(currentQuestion.id, event.target.checked)} /> 标记&nbsp;</label>
              <button {...SCOPE} id="prevbtn" name="上一题" type="button" disabled={activeIndex <= 0} onClick={() => changeQuestionByDirection("prev")}>上一题</button>
              {isSubjective ? (
                <span {...SCOPE}>
                  <button {...SCOPE} style={{ marginLeft: "20px" }} name="上一问" type="button" disabled={activeSubQuestionIndex <= 0} onClick={() => changeSubQuestionByDirection("prev")}>上一问</button>
                  <button {...SCOPE} style={{ marginLeft: "20px", marginRight: "20px" }} name="下一问" type="button" disabled={activeSubQuestionIndex >= currentQuestion.subjectiveSubQuestions.length - 1} onClick={() => changeSubQuestionByDirection("next")}>下一问</button>
                </span>
              ) : currentQuestion.type === "single_choice" ? (
                <span {...SCOPE}>
                  &nbsp;第&nbsp;<span {...SCOPE} id="xtName">{activeIndex + 1}</span>&nbsp;题&nbsp;
                  <span {...SCOPE} className="el-radio-group">
                  {currentQuestion.options.map((option) => {
                    const checked = currentQuestion.userAnswerKeys.includes(option.key);
                    return <label {...SCOPE} className="el-radio" key={option.id}><span {...SCOPE} className={`el-radio__input${checked ? " is-checked" : ""}`}><span {...SCOPE} className="el-radio__inner" /><input {...SCOPE} className="el-radio__original" type="radio" name={`itemc-${activeIndex}`} value={option.key} checked={checked} onChange={() => { void handleObjectiveAnswer(option.key); }} /></span><span {...SCOPE} className="el-radio__label">{option.key}</span></label>;
                  })}
                  </span>
                </span>
              ) : (
                <span {...SCOPE}>
                  &nbsp;第&nbsp;<span {...SCOPE} id="xtName">{activeIndex + 1}</span>&nbsp;题&nbsp;
                  {currentQuestion.options.map((option) => <span {...SCOPE} key={option.id} className="checkedBOx"><input {...SCOPE} type="checkbox" name={`itemc-${activeIndex}`} value={option.key} checked={currentQuestion.userAnswerKeys.includes(option.key)} onChange={() => { void handleObjectiveAnswer(option.key); }} /> {option.key}&nbsp;</span>)}
                </span>
              )}
              <button {...SCOPE} id="nextbtn" name="下一题" type="button" disabled={activeIndex >= record.questions.length - 1} onClick={() => changeQuestionByDirection("next")}>下一题</button>
            </div>
          </div>
        </div>

        {lawDialogOpen ? (
          <div
            {...SCOPE}
            className="dialogOut"
            style={{
              left: `${lawDialogRect.left}px`,
              top: `${lawDialogRect.top}px`,
              width: `${lawDialogRect.width}px`,
              height: `${lawDialogRect.height}px`,
              zIndex: 900,
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            <div {...SCOPE} className="wind-head" onMouseDown={startLawDialogMove}>
              <span {...SCOPE}>法律法规汇编</span>
              <div {...SCOPE} style={{ display: "flex", alignItems: "center" }} onMouseDown={(event) => event.stopPropagation()}>
                <button
                  {...SCOPE}
                  type="button"
                  onClick={closeLawDialog}
                  style={{ border: "none", background: "transparent", color: "#606266", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            </div>
            <div
              {...SCOPE}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "41px",
                bottom: 0,
                background: "#fff",
                overflow: "hidden",
              }}
            >
              <iframe
                ref={lawFrameRef}
                title="法律法规汇编"
                src="/law-search/law_search.html"
                onLoad={handleLawFrameLoad}
                style={{ display: "block", width: "100%", height: "100%", border: "0", background: "#fff" }}
              />
              {lawDialogInteracting ? (
                <div
                  {...SCOPE}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "transparent",
                    cursor: getLawDialogCursor(lawDialogActionRef.current) || "move",
                    zIndex: 2,
                  }}
                />
              ) : null}
            </div>
            {lawDialogMaximized ? null : (
              <>
                <div {...SCOPE} className="border-row border-top" onMouseDown={startLawDialogResize("n")} />
                <div {...SCOPE} className="border-col border-right" onMouseDown={startLawDialogResize("e")} />
                <div {...SCOPE} className="border-row border-bottom" onMouseDown={startLawDialogResize("s")} />
                <div {...SCOPE} className="border-col" style={{ left: 0, cursor: "w-resize" }} onMouseDown={startLawDialogResize("w")} />
                <div {...SCOPE} className="horn left-top" onMouseDown={startLawDialogResize("nw")} />
                <div {...SCOPE} className="horn rig-top" onMouseDown={startLawDialogResize("ne")} />
                <div {...SCOPE} className="horn rig-bott" onMouseDown={startLawDialogResize("se")} />
                <div {...SCOPE} className="horn left-bott" onMouseDown={startLawDialogResize("sw")} />
              </>
            )}
          </div>
        ) : null}

        {submitDialogOpen ? (
          <div {...SCOPE} style={{ width: "100%", height: "100%", background: "rgba(128,128,128,0.8)", position: "fixed", left: "0px", top: "0px", overflow: "hidden", userSelect: "none", zIndex: 1024 }}>
            <div {...SCOPE} className="ui-popup ui-popup-modal ui-popup-show ui-popup-focus" style={{ position: "absolute", outline: "0px", left: 0, top: 0, bottom: 0, right: 0, margin: "auto", zIndex: 1024 }} tabIndex={1} role="alertdialog">
              <div {...SCOPE} className="dialog_main" style={{ display: "block" }}>
                <div {...SCOPE} className="dialog_bt" />
                <div {...SCOPE} className="dialog_img" />
                <div {...SCOPE} className="dialog_content">
                  <li {...SCOPE} className="dialog_text"><font {...SCOPE} color="red"><span {...SCOPE}><p {...SCOPE}>再次确认是否交卷？</p><p {...SCOPE}>交卷后将不能继续答题！</p><br {...SCOPE} /></span></font></li>
                  <li {...SCOPE}><div {...SCOPE} className="dialog_button" id="auto_sbm_btn"><button {...SCOPE} type="button" disabled={submitting} onClick={() => setSubmitDialogOpen(false)}>返回作答</button><button {...SCOPE} type="button" disabled={submitting} onClick={() => void handleSubmit(false)}>{submitting ? "交卷中..." : "确定交卷"}</button></div></li>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {arrayDialogOpen ? (
          <div {...SCOPE} style={{ width: "100%", height: "100%", background: "rgba(128,128,128,0.8)", position: "fixed", left: "0px", top: "0px", overflow: "hidden", userSelect: "none", zIndex: 1024 }}>
            <div {...SCOPE} className="ui-popup ui-popup-modal ui-popup-show ui-popup-focus" style={{ position: "absolute", outline: "0px", left: 0, top: 0, bottom: 0, right: 0, margin: "auto", zIndex: 1024 }} tabIndex={1} role="alertdialog">
              <div {...SCOPE} className="dialog_main" style={{ display: "block" }}>
                <div {...SCOPE} className="dialog_bt" />
                <div {...SCOPE} className="dialog_img" />
                <div {...SCOPE} className="dialog_content">
                  <li {...SCOPE} className="dialog_text"><font {...SCOPE} color="red"><span {...SCOPE}>多选题至少需要选两个答案!<br {...SCOPE} /></span></font></li>
                  <li {...SCOPE}><div {...SCOPE} className="dialog_button" id="auto_sbm_btn"><button {...SCOPE} type="button" onClick={() => setArrayDialogOpen(false)}>返回作答</button></div></li>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {subjectiveLeaveState ? (
          <div {...SCOPE} style={{ width: "100%", height: "100%", background: "rgba(128,128,128,0.8)", position: "fixed", left: "0px", top: "0px", overflow: "hidden", userSelect: "none", zIndex: 1024 }}>
            <div {...SCOPE} className="ui-popup ui-popup-modal ui-popup-show ui-popup-focus" style={{ position: "absolute", outline: "0px", left: 0, top: 0, bottom: 0, right: 0, margin: "auto", zIndex: 1024 }} tabIndex={1} role="alertdialog">
              <div {...SCOPE} className="dialog_main" style={{ display: "block" }}>
                <div {...SCOPE} className="dialog_bt" />
                <div {...SCOPE} className="dialog_img" />
                <div {...SCOPE} className="dialog_content">
                  <li {...SCOPE} className="dialog_text"><font {...SCOPE} color="red"><span {...SCOPE}><p {...SCOPE}>{subjectiveLeaveState.message}</p><br {...SCOPE} /></span></font></li>
                  <li {...SCOPE}><div {...SCOPE} className="dialog_button" id="auto_sbm_btn"><button {...SCOPE} type="button" onClick={() => setSubjectiveLeaveState(null)}>返回作答</button><button {...SCOPE} type="button" onClick={() => { performJump(subjectiveLeaveState.nextIndex); setSubjectiveLeaveState(null); }}>确认离开</button></div></li>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </MockExamShadowRoot>
  );
}
