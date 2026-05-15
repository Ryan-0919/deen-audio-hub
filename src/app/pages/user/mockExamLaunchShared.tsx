import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import mockExamLaunchOfficialCssRaw from "../../../styles/mock-exam-launch-official.css?raw";
import type { MockExamPaper } from "../../lib/mockData";
import type { MockExamLegacyBlock } from "./mockExamLaunchContent";

const SHADOW_RESET =
  ":host{all:initial;display:block}:host,:host *,:host *::before,:host *::after{box-sizing:content-box}:host img{display:inline-block;max-width:none}:host button,:host input,:host textarea,:host select{font:inherit;letter-spacing:normal}:host textarea{resize:none}";

const scopeOfficialCss = (css: string, scopeId: string, rootSelector: string) =>
  css.replace(new RegExp(`(^|})\\s*([^{}]*?\\[data-v-${scopeId}\\][^{}]*?)\\{`, "g"), (_match, boundary: string, selectorGroup: string) => {
    const selectors = selectorGroup
      .split(",")
      .flatMap((selector) => {
        const cleaned = selector.replaceAll(`[data-v-${scopeId}]`, "").trim();
        if (!cleaned) return [rootSelector];
        if (cleaned.startsWith(":")) return [`${rootSelector}${cleaned}`, `${rootSelector} *${cleaned}`];
        return [`${rootSelector} ${cleaned}`];
      })
      .join(",");
    return `${boundary}${selectors}{`;
  });

export const MOCK_EXAM_LAUNCH_OFFICIAL_CSS =
  scopeOfficialCss(
    scopeOfficialCss(
      scopeOfficialCss(
        mockExamLaunchOfficialCssRaw.replaceAll("../../static/img/", "/mock-exam/launch/"),
        "f2d81458",
        "[data-mock-screen='notice']",
      ),
      "6ab2d3a0",
      "[data-mock-screen='login']",
    ),
    "020ee950",
    "[data-mock-screen='launch']",
  ) +
  `
.mock-close-icon{position:absolute;top:0;right:18px;bottom:0;margin:auto;width:22px;height:22px;border:none;background:transparent;color:#606873;font-size:18px;line-height:22px;cursor:pointer}
.mock-login-image-btn{display:inline-flex;align-items:center;justify-content:center;width:75px;height:28px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-family:"宋体";font-weight:700;color:#fff;background:linear-gradient(180deg,#ffbb54 0%,#ee8b0e 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
.mock-login-image-btn.secondary{background:linear-gradient(180deg,#f6f6f6 0%,#d8d8d8 100%);color:#4c5668}
.mock-login-image-btn + .mock-login-image-btn{margin-left:7px}
.mock-popup-button{position:absolute;left:70%;top:70%;width:84px;height:31px;border:none;background:linear-gradient(180deg,#ffcb77 0%,#ef9827 100%);color:#fff;font-size:12px;font-family:"宋体";font-weight:700;cursor:pointer;border-radius:4px}
.mock-popup-button:hover,.mock-login-image-btn:hover{filter:brightness(.98)}
`;

export function MockExamShadowRoot({ children }: { children: ReactNode }) {
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
              <style>{SHADOW_RESET}</style>
              <style>{MOCK_EXAM_LAUNCH_OFFICIAL_CSS}</style>
              {children}
            </>,
            shadowRoot,
          )
        : null}
    </div>
  );
}

export const isSubjectivePaper = (paper: MockExamPaper) => paper.sections.some((section) => section.type === "subjective_case");
export const getMockExamHomePath = (paper: Pick<MockExamPaper, "sections">) =>
  isSubjectivePaper(paper as MockExamPaper) ? "/user/mock-exams" : "/user/objective-mock-exams";

export const renderLegacyBlock = (block: MockExamLegacyBlock, key: string) => {
  if (block.kind === "spacer") {
    return (
      <p key={key} className={block.className} style={block.style}>
        <span lang="en-US">&nbsp;</span>
      </p>
    );
  }

  if (block.kind === "image") {
    return (
      <p key={key} className={block.className} style={block.style} align="center">
        <span style={{ fontSize: "12.0pt", fontFamily: "宋体" }} lang="en-US">
          <img width={block.width} src={block.src} alt="" />
        </span>
      </p>
    );
  }

  return (
    <p key={key} className={block.className} style={block.style}>
      {block.text}
    </p>
  );
};
