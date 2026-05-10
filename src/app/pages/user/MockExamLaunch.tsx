import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { type MockExamLaunchConfig, mockApi } from "../../lib/mockData";
import { getUserPhone } from "../../lib/user-session";
import { getMockExamCardNo, getMockExamTicketNo, saveMockExamCandidateInfo } from "./mockExamCandidateSession";
import { MockExamDesktopNotice, useMockExamDesktopGuard } from "./mockExamDesktopGuard";
import { buildIdCardNo, buildTicketNo, formatCountdown } from "./mockExamRoomHelpers";
import { MockExamShadowRoot } from "./mockExamLaunchShared";
import { createDefaultMockExamLaunchConfig } from "../../../shared/mock-exam-launch-config.js";

type LaunchStep = "login" | "notice";
type NoticeTabKey = "notice" | "rules" | "guide";

export function MockExamLaunch() {
  const navigate = useNavigate();
  const { paperId = "" } = useParams();
  const isMobileBlocked = useMockExamDesktopGuard();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);
  const [launchConfig, setLaunchConfig] = useState<MockExamLaunchConfig>(createDefaultMockExamLaunchConfig());
  const [step, setStep] = useState<LaunchStep>("login");
  const [ticketNo, setTicketNo] = useState("");
  const [cardNo, setCardNo] = useState("");
  const [noticeCountdown, setNoticeCountdown] = useState(createDefaultMockExamLaunchConfig().notice.readSeconds);
  const [activeTab, setActiveTab] = useState<NoticeTabKey>("notice");
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [agreePromptOpen, setAgreePromptOpen] = useState(false);
  const [beginPromptOpen, setBeginPromptOpen] = useState(false);
  const [beginPromptMessage, setBeginPromptMessage] = useState(createDefaultMockExamLaunchConfig().notice.beginPromptMessage);
  const [examOverOpen, setExamOverOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fallbackPhone = getUserPhone() || "";
    setTicketNo(getMockExamTicketNo() || buildTicketNo(fallbackPhone) || "888888");
    setCardNo(getMockExamCardNo() || buildIdCardNo(fallbackPhone) || "88888888888888");
  }, []);

  useEffect(() => {
    if (isMobileBlocked) return;

    const load = async () => {
      try {
        const [paperList, nextLaunchConfig] = await Promise.all([mockApi.getMockExamPapers(), mockApi.getMockExamLaunchConfig()]);
        setPapers(paperList);
        setLaunchConfig(nextLaunchConfig);
        setNoticeCountdown(nextLaunchConfig.notice.readSeconds);
        setBeginPromptMessage(nextLaunchConfig.notice.beginPromptMessage);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "加载考试信息失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isMobileBlocked]);

  const selectedPaper = useMemo(() => papers.find((paper) => paper.id === paperId) ?? null, [paperId, papers]);

  useEffect(() => {
    if (step !== "notice" || noticeCountdown <= 0) return;
    const countdownTimer = window.setTimeout(() => setNoticeCountdown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(countdownTimer);
  }, [noticeCountdown, step]);

  useEffect(() => {
    if (step !== "notice") return;
    const promptTimer = window.setTimeout(() => {
      setBeginPromptMessage(launchConfig.notice.beginPromptMessage);
      setBeginPromptOpen(true);
    }, launchConfig.notice.beginPromptDelayMs);
    return () => window.clearTimeout(promptTimer);
  }, [launchConfig.notice.beginPromptDelayMs, launchConfig.notice.beginPromptMessage, step]);

  const activeTabConfig = useMemo(
    () => launchConfig.tabs.find((tab) => tab.key === activeTab) ?? launchConfig.tabs[0] ?? null,
    [activeTab, launchConfig.tabs],
  );

  const handleLogin = () => {
    if (!ticketNo.trim()) {
      window.alert(`请输入${launchConfig.login.ticketLabel}`);
      return;
    }

    if (!cardNo.trim()) {
      window.alert(`请输入${launchConfig.login.idCardLabel}`);
      return;
    }

    saveMockExamCandidateInfo({ ticketNo, cardNo });
    setNoticeCountdown(launchConfig.notice.readSeconds);
    setActiveTab("notice");
    setAgreeChecked(false);
    setAgreePromptOpen(false);
    setBeginPromptMessage(launchConfig.notice.beginPromptMessage);
    setBeginPromptOpen(false);
    setExamOverOpen(false);
    setStep("notice");
  };

  const handleResetLogin = () => {
    setTicketNo("");
    setCardNo("");
  };

  const handleStartExam = async () => {
    if (!selectedPaper || starting) return;

    if (!agreeChecked) {
      setAgreePromptOpen(true);
      return;
    }

    saveMockExamCandidateInfo({ ticketNo, cardNo });
    setStarting(true);

    try {
      if (selectedPaper.activeRecord?.canResume) {
        navigate(`/user/mock-exams/records/${selectedPaper.activeRecord.id}`);
        return;
      }

      const record = await mockApi.startMockExam(selectedPaper.id);
      navigate(`/user/mock-exams/records/${record.id}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "进入考试失败");
      setExamOverOpen(true);
    } finally {
      setStarting(false);
    }
  };

  const handleBackHome = () => {
    setExamOverOpen(false);
    setBeginPromptOpen(false);
    setAgreePromptOpen(false);
    setStep("login");
    navigate("/user/mock-exams");
  };

  if (isMobileBlocked) {
    return <MockExamDesktopNotice />;
  }

  if (loading) {
    return (
      <MockExamShadowRoot>
        <div className="webLoginExe" data-mock-screen="login">
          <div className="webBox">
            <div className="conBox" />
          </div>
        </div>
      </MockExamShadowRoot>
    );
  }

  if (!selectedPaper) {
    return (
      <MockExamShadowRoot>
        <div className="webLoginExe" data-mock-screen="login">
          <div className="webBox">
            <div className="conBox">
              <div className="loginBox" style={{ paddingTop: "135px", textAlign: "center", color: "#255dad", fontWeight: 700 }}>
                当前试卷不存在或未发布
                <div className="btn" style={{ marginTop: "28px", marginLeft: "220px" }}>
                  <button type="button" className="mock-login-image-btn" onClick={handleBackHome}>
                    返回列表
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MockExamShadowRoot>
    );
  }

  return (
    <MockExamShadowRoot>
      {step === "login" ? (
        <div className="webLoginExe" data-mock-screen="login">
          <div className="webBox">
            <div className="conBox">
              <div className="loginBox">
                <div className="kcmc">{selectedPaper.phase || "机考试卷"}</div>
                <div className="input inputTop">
                  <span>{launchConfig.login.ticketLabel}: </span>
                  <input type="text" value={ticketNo} onChange={(event) => setTicketNo(event.target.value)} />
                </div>
                <div className="input">
                  <span>{launchConfig.login.idCardLabel}: </span>
                  <input type="text" value={cardNo} onChange={(event) => setCardNo(event.target.value)} />
                </div>
                <div className="btn" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "7px" }}>
                  <button type="button" className="mock-login-image-btn" onClick={handleLogin}>
                    {launchConfig.login.loginButtonText}
                  </button>
                  <button type="button" className="mock-login-image-btn secondary" onClick={handleResetLogin}>
                    {launchConfig.login.resetButtonText}
                  </button>
                </div>
              </div>
              <div className="F11">
                {launchConfig.login.fullscreenTip}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === "notice" ? (
        <div className="webInfoExe" data-mock-screen="notice">
          <div className="webBox">
            <div className="conBox">
              <img className="userImg" src={launchConfig.notice.avatarUrl} alt="" />
              <div className="nameBox">
                {launchConfig.notice.candidateNameLabel}：<span>{launchConfig.notice.defaultCandidateName}</span>
                <br />
                {launchConfig.notice.candidateGenderLabel}：<span>{launchConfig.notice.defaultCandidateGender}</span>
                <br />
                {launchConfig.notice.ticketLabel}：<span>{ticketNo}</span>
                <br />
                {launchConfig.notice.idCardLabel}：<span>{cardNo}</span>
              </div>
              <div className="timeBox">
                <div className="desc">
                  {launchConfig.notice.countdownPrefix}<span>{formatCountdown(noticeCountdown)}</span>
                  <span>
                    <div className="btn" onClick={() => void handleStartExam()}>
                      {starting ? launchConfig.notice.startingButtonText : launchConfig.notice.startButtonText}
                    </div>
                  </span>
                </div>
              </div>
              <div className="HeadTitle" />
              <div className="textCon">
                <div className="Section1" dangerouslySetInnerHTML={{ __html: activeTabConfig?.html ?? "" }} />
              </div>
              <div className="footBox">
                <div className="input">
                  <input type="checkbox" checked={agreeChecked} onChange={(event) => setAgreeChecked(event.target.checked)} />
                  {launchConfig.notice.agreementText}
                </div>
                <div className="tabBtnA tabBtn" onClick={() => setActiveTab("notice")}>
                  {launchConfig.tabs.find((tab) => tab.key === "notice")?.label ?? "应试人员须知"}
                </div>
                <div className="tabBtnB tabBtn" onClick={() => setActiveTab("rules")}>
                  {launchConfig.tabs.find((tab) => tab.key === "rules")?.label ?? "应试规则"}
                </div>
                <div className="tabBtnC tabBtn" onClick={() => setActiveTab("guide")}>
                  {launchConfig.tabs.find((tab) => tab.key === "guide")?.label ?? "操作说明"}
                </div>
              </div>

              {agreePromptOpen ? (
                <div className="tanInfo agreen">
                  <div />
                  <div />
                  <div>{launchConfig.notice.agreePromptMessage}</div>
                  <button type="button" className="mock-popup-button" onClick={() => setAgreePromptOpen(false)}>
                    {launchConfig.notice.confirmButtonText}
                  </button>
                </div>
              ) : null}

              {beginPromptOpen ? (
                <div className="tanInfo">
                  <div />
                  <div />
                  <div>{beginPromptMessage}</div>
                  <button type="button" className="mock-popup-button" onClick={() => setBeginPromptOpen(false)}>
                    {launchConfig.notice.confirmButtonText}
                  </button>
                </div>
              ) : null}

              {examOverOpen ? (
                <div className="tanInfo over">
                  <div />
                  <div />
                  <div>{launchConfig.notice.examOverMessage}</div>
                  <button type="button" className="mock-popup-button" onClick={handleBackHome}>
                    {launchConfig.notice.backButtonText}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </MockExamShadowRoot>
  );
}
