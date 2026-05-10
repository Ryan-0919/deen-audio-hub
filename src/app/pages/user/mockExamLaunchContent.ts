import type { CSSProperties } from "react";

export type MockExamLegacyBlock =
  | {
      kind: "text";
      className: string;
      style?: CSSProperties;
      text: string;
    }
  | {
      kind: "image";
      className: string;
      style?: CSSProperties;
      src: string;
      width: number;
    }
  | {
      kind: "spacer";
      className: string;
      style?: CSSProperties;
    };

const launchImage = (fileName: string) => `/mock-exam/launch/${fileName}`;

const noticeTextStyle: CSSProperties = { textIndent: "30pt", lineHeight: "1.45" };
const ruleTextStyle: CSSProperties = { textIndent: "30.0pt" };
const guideTextStyle: CSSProperties = { textAlign: "left", textIndent: "24.0pt", background: "white", padding: 0 };
const guideListStyle: CSSProperties = {
  marginLeft: "21.0pt",
  textAlign: "left",
  textIndent: "-21.0pt",
  background: "white",
  padding: 0,
};
const guideSubListStyle: CSSProperties = {
  marginLeft: "66.0pt",
  textAlign: "left",
  textIndent: "-21.0pt",
  background: "white",
  padding: 0,
};

const text = (textValue: string, style: CSSProperties, className = "MsoNormal"): MockExamLegacyBlock => ({
  kind: "text",
  className,
  style,
  text: textValue,
});

const spacer = (height: string): MockExamLegacyBlock => ({
  kind: "spacer",
  className: "MsoNormal",
  style: { height },
});

const image = (fileName: string, width: number, style: CSSProperties = { textAlign: "center" }): MockExamLegacyBlock => ({
  kind: "image",
  className: "MsoNormal",
  style,
  src: launchImage(fileName),
  width,
});

export const MOCK_EXAM_NOTICE_BLOCKS: MockExamLegacyBlock[] = [
  text("2025年国家统一法律职业资格考试客观题考试应试人员须知", { textAlign: "center" }),
  spacer("22px"),
  text("一、应试人员进入考场后，应按照机位号入座，不得擅自更换座位或离开考场；暂时离开考场，须经监考员同意；返回考场时再次接受身份核验。", noticeTextStyle),
  spacer("22px"),
  text("二、应试人员应将本人居民身份证和准考证摆放在桌面左上角，供监考员查验；随身物品应当存放在指定位置。", noticeTextStyle),
  spacer("22px"),
  text("三、应试人员输入准考证号和居民身份证号登录考试系统，核对姓名、性别、准考证号和居民身份证号，阅读应试人员须知、应试规则和操作说明。", noticeTextStyle),
  text("考试开始后，计算机会自动进入答题界面。计算机屏幕右上方显示考试剩余时间。", noticeTextStyle),
  spacer("22px"),
  text("四、应试人员在考试过程中，如出现鼠标、键盘、显示屏幕故障等情况，影响正常答题时，应第一时间举手报告。监考员处理问题所用时间将按照规定程序给予补时。补时时长为应试人员举手报告时起，至恢复正常考试时止。", noticeTextStyle),
  text("因应试人员自身原因导致延误答题的，不予补时。", noticeTextStyle),
  spacer("22px"),
  text("五、考试开始三十分钟后，应试人员不得进入考场考试；考试结束前六十分钟内，应试人员提交答题数据经监考员确认后，方可离开考场，但不得在考场附近逗留、喧哗。", noticeTextStyle),
  spacer("22px"),
  text("六、考试时间结束仍未完成答题的，系统将自动提交应试人员答题数据；给予补时的，考试系统在补足时间后自动提交应试人员答题数据。", noticeTextStyle),
  spacer("22px"),
  text("七、考试结束离场时，应试人员不得将草稿纸带离考场。", noticeTextStyle),
  spacer("22px"),
  text("八、应试人员在考试期间应当严格遵守考场纪律，维护考场秩序，保持考场肃静。对应试人员的违纪行为，将按照《国家统一法律职业资格考试违纪行为处理办法》相关规定进行处理。", noticeTextStyle),
  spacer("22px"),
  spacer("22px"),
  spacer("22px"),
];

export const MOCK_EXAM_RULE_BLOCKS: MockExamLegacyBlock[] = [
  text("国家统一法律职业资格考试应试规则", { textAlign: "center" }),
  spacer("23px"),
  text("第一章 总 则", { textIndent: "30.1pt" }),
  spacer("23px"),
  text("第一条 为了规范国家统一法律职业资格考试考场秩序，确保考试公平公正，根据《国家统一法律职业资格考试实施办法》，制定本规则。", ruleTextStyle),
  spacer("23px"),
  text("第二条 参加国家统一法律职业资格考试的应试人员，应当遵守本规则。", ruleTextStyle),
  spacer("23px"),
  text("第三条 应试人员应当尊重监考人员，自觉接受监考人员的监督和检查，服从监考人员的管理，不得以任何理由妨碍监考人员履行职责，不得扰乱考场秩序。", ruleTextStyle),
  spacer("23px"),
  text("第二章 一般规定", { textIndent: "30.1pt" }),
  spacer("23px"),
  text("第四条 应试人员应当凭准考证和居民身份证，经考务安全管理系统核验身份后进入指定考场参加考试。无准考证和居民身份证的人员不得参加考试。", ruleTextStyle),
  spacer("23px"),
  text("第五条 应试人员在考试前四十五分钟内可以进入考场。考试开始三十分钟后，应试人员不得进入考场。考试结束前六十分钟内，应试人员经监考员同意后可以交卷离开考场。", ruleTextStyle),
  spacer("23px"),
  text("第六条 应试人员应当遵守下列考试纪律：", ruleTextStyle),
  spacer("23px"),
  text("（一）不得在考场内喧哗、走动等影响他人考试或者交卷后在考场附近喧哗等影响考试秩序；", ruleTextStyle),
  spacer("23px"),
  text("（二）不得在考场内交头接耳、左顾右盼或者以互打手势等方式传递信息；", ruleTextStyle),
  spacer("23px"),
  text("（三）不得与他人交换试卷（答卷），不得窥视、抄袭他人答卷或者同意他人抄袭；", ruleTextStyle),
  spacer("23px"),
  text("（四）不得在规定时间以外答题；", ruleTextStyle),
  spacer("23px"),
  text("（五）不得将试卷（答卷）、草稿纸和考场配发材料带出考场，不得抄写试题或者以任何形式将试题信息进行记录、存储、传输出考场；", ruleTextStyle),
  spacer("23px"),
  text("（六）不得有其他违反考试纪律的行为。", ruleTextStyle),
  spacer("23px"),
  text("第七条 应试人员除携带必需文具外，不得随身携带书籍、笔记本、纸张、报刊、电子用品、存储设备及通信工具等物品进入考场。考场提供文具的，应试人员不得自行带入。", ruleTextStyle),
  spacer("23px"),
  text("第八条 应试人员进入考场后，应当对号入座，并将准考证、居民身份证放在桌面左上角，供监考员查验。", ruleTextStyle),
  spacer("23px"),
  text("第九条 应试人员违反本规则的，由司法行政机关依据相关规定给予处理。", ruleTextStyle),
  spacer("23px"),
  text("第三章 计算机化考试", { textIndent: "30.1pt" }),
  spacer("23px"),
  text("第十条 应试人员应当在考试开始前，根据监考员的要求和提示，登录考试系统，填写准考证号和居民身份证号，阅读考生须知、注意事项等，核对考试相关信息并进行确认。遇有无法登录、计算机系统或网络通讯故障、信息错误等情形的，应试人员应当及时向监考员报告。", ruleTextStyle),
  spacer("23px"),
  text("第十一条 应试人员应当按照监考员的指令和规定的步骤操作计算机，使用鼠标和键盘在设定的答题区域内答题并保存答题结果，不得执行其他操作。", ruleTextStyle),
  spacer("23px"),
  text("第十二条 考试期间，应试人员不得擅自关闭计算机、调整计算机显示屏摆放位置和角度、搬动主机箱、更换键盘和鼠标等外接设备，不得在考试机上插入硬件和安装软件。", ruleTextStyle),
  spacer("23px"),
  text("第十三条 考试期间，应试人员不得要求监考员解释试题。如出现试题内容显示不全、识别率低、切换缓慢等情形的，可以举手报告，经监考员同意后询问。", ruleTextStyle),
  spacer("23px"),
  text("第十四条 考试期间，如出现网络故障、电力故障、设备故障等异常情况的，应试人员应当及时向监考员报告，服从监考员安排，耐心等待解决。", ruleTextStyle),
  spacer("23px"),
  text("非因应试人员自身原因出现的设备故障导致延误答题的，可以按规定进行补时、补考。", ruleTextStyle),
  spacer("23px"),
  text("第十五条 应试人员因自身原因导致电子试卷下载延迟、题目漏答、考试设备损毁、电子答题数据上传有误的，应当自行承担责任。", ruleTextStyle),
  spacer("23px"),
  text("第十六条 考试结束指令发出后，应试人员应当立即停止答题，系统自动回收电子答题数据。应试人员应当待监考员确认电子答题数据全部上传后，有序离开考场。", ruleTextStyle),
  spacer("23px"),
  text("第十七条 应试人员没有按照要求进行登录、答题、保存电子答题数据，导致系统不能正确记录相关信息的，应当自行承担相关责任。", ruleTextStyle),
  spacer("23px"),
  spacer("23px"),
  spacer("23px"),
  spacer("23px"),
];

export const MOCK_EXAM_GUIDE_BLOCKS: MockExamLegacyBlock[] = [
  text("国家统一法律职业资格考试计算机化考试应试人员操作说明", {
    textAlign: "center",
    textIndent: "6.0pt",
    lineHeight: "18.0pt",
    background: "white",
    padding: 0,
  }),
  text("一. 系统登录", guideListStyle, "MsoListParagraph"),
  text("进入答题系统后，请根据提示输入准考证号和身份证号，点击”登录”按钮进入系统等待界面。", guideTextStyle),
  image("202303072102170849.b0dca710.png", 450),
  text("二. 系统等待界面", guideListStyle, "MsoListParagraph"),
  text("系统等待界面是考试前的一个提示界面，登录后请认真核对屏幕左上方的基本信息。利用考前等待时间认真阅读考试重要提示：", guideTextStyle),
  text("（一）点击“应试人员须知”按钮，进入应试人员须知具体说明。", guideTextStyle),
  text("（二）点击“应试规则”按钮，进入应试规则具体说明。", guideTextStyle),
  text("（三）点击“操作说明”按钮，进入操作步骤具体说明。考试开始后，系统将自动进入应试人员答题界面。", guideTextStyle),
  image("202303081535150239.12085341.png", 662),
  text("三. 答题界面", guideListStyle, "MsoListParagraph"),
  text("答题界面上方为标题栏，下方为试题区。", guideTextStyle),
  text("(一) 标题栏", guideSubListStyle, "MsoListParagraph"),
  text("标题栏中间位置为本场考试科目名称，左侧为应试人员基本信息，包括姓名、性别、准考证号、身份证号、照片。右侧为本场考试科目剩余时间信息和交卷按钮。", guideTextStyle),
  image("202303081535330312.cbefa8cb.png", 802),
  text("(二) 题号列表区", guideSubListStyle, "MsoListParagraph"),
  image("202303081536010730.66cdf0c4.png", 339, {
    textAlign: "center",
    textIndent: "36.0pt",
    background: "white",
    padding: 0,
  }),
  text("题号“*”表示该小题未作答，无“*”表示该小题已作答，“？”表示该小题被标记。应试人员可以通过题号列表查看本考试科目全套试卷的作答情况（包括每道试题的已答或未答状态），还可点击各题号按钮，直接进入各试题进行答题或检查。", guideSubListStyle, "MsoListParagraph"),
  text("(三) 试题区域", guideSubListStyle, "MsoListParagraph"),
  text("1. 界面风格、调整字体大小", guideSubListStyle, "MsoListParagraph"),
  text("1）风格调整", guideSubListStyle, "MsoListParagraph"),
  text("通过点击“切换风格”按钮，可调整界面的背景颜色。", guideSubListStyle, "MsoListParagraph"),
  image("202303081536150229.84c43c35.png", 856),
  text("2）字体大小", guideSubListStyle, "MsoListParagraph"),
  text("通过点击“字体大小+”或“字体大小-”按钮，可调整试题文字的字体大小。", guideSubListStyle, "MsoListParagraph"),
  image("202303081536240260.4959d98d.png", 856),
  text("2. 题型介绍", guideSubListStyle, "MsoListParagraph"),
  text("1）单项选择题", guideSubListStyle, "MsoListParagraph"),
  text("单项选择题答题时，应试人员直接点击备选项中认为正确的选项前的按钮即可。如需修改答案，点击其他备选项前的按钮，原选择的选项将被自动替换。如需撤销已经选中的选项，再次点击该选项前的按钮即可。", guideTextStyle),
  image("202303081536320708.e2bff279.png", 856),
  text("2）多项选择题", guideSubListStyle, "MsoListParagraph"),
  text("多项选择题答题时，应试人员直接用鼠标点击备选项中认为正确的所有选项前的按钮即可。如需撤销已经选中的选项，再次点击该选项前的按钮即可。", guideTextStyle),
  image("202303081536420524.90f1d345.png", 856),
  text("3）不定项选择题", guideSubListStyle, "MsoListParagraph"),
  text("不定项选择题答题时，应试人员直接用鼠标点击备选项中认为正确的所有选项前的按钮即可。如需撤销已经选中的选项，再次点击该选项前的按钮即可。", guideTextStyle),
  image("202303081536540828.c806e808.png", 856),
  text("四. 结束考试", guideListStyle, "MsoListParagraph"),
  text("(一) 提前交卷", guideSubListStyle, "MsoListParagraph"),
  text("考试结束前60分钟，允许应试人员提前交卷。如应试人员决定结束本考试科目作答，可以点击屏幕上方的“交卷”按钮结束本考试科目答题。", guideTextStyle),
  text("1. 如所有题目均未作答，系统将提示本考试科目尚未作答，要求应试人员返回继续作答。", guideSubListStyle, "MsoListParagraph"),
  text("2. 如应试人员有部分题目未作答，系统将提示本考试科目未作答题目数量，应试人员可返回作答或确认交卷。", guideSubListStyle, "MsoListParagraph"),
  text("3. 应试人员如连续两次确认交卷，将不能再返回本考试科目继续作答。应试人员在提前交卷前，请务必仔细检查答题完成情况。确认无误后，点击”确定交卷”按钮结束本考试科目答题，提交本考试科目答题结果。", guideSubListStyle, "MsoListParagraph"),
  text("4. 应试人员在交卷后，应立即离开考场，不得在考场附近逗留、谈论和喧哗。", guideSubListStyle, "MsoListParagraph"),
  text("(二) 整场考试结束", guideSubListStyle, "MsoListParagraph"),
  text("考试时间结束仍未交卷的，系统将自动提交；考试时间内因发生异常需要补时的，系统在补足考试时间后自动提交。", guideTextStyle),
  text("五. 其他功能介绍", guideListStyle, "MsoListParagraph"),
  text("系统显示本场考试科目剩余时间，目的是提示应试人员合理控制答题进度。在每科目剩余30分钟、5分钟时，会有相应提示：", guideTextStyle),
  text("（一）在每科目剩余30分钟时，系统会弹出窗口提示应试人员；应试人员点击“返回作答”按钮，窗口会立即消失；如不点击，会在10秒后自动消失。", guideTextStyle),
  text("（二）在每科目剩余5分钟时，系统会弹出窗口提示应试人员，科目剩余时间信息字体会放大，字色会变红；应试人员点击“返回作答”按钮，窗口会立即消失；如不点击，会在10秒后自动消失。", guideTextStyle),
  text("本模拟答题系统旨在让应试人员熟悉计算机化考试环境和作答方式，考试题型、题量、分值、界面及文字内容以正式考试答题系统为准。", guideTextStyle),
  spacer("22px"),
];
