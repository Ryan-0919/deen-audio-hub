const clone = (value) => JSON.parse(JSON.stringify(value));

const toTrimmedString = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
};

const toStringArray = (value, fallback = []) => {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : [...fallback];
};

const normalizeFixedArray = (value, fallback, mapper) => {
  const source = Array.isArray(value) ? value : [];
  return fallback.map((item, index) => mapper(source[index] && typeof source[index] === "object" ? source[index] : {}, item, index));
};

const LEGACY_MEMBER_HOME_MOCK_EXAM_TITLE = "进入真机模考";
const LEGACY_MEMBER_HOME_MOCK_EXAM_DESCRIPTION = "直接进入机考系统，继续客观题刷题或主观题实战演练。";
const CURRENT_MEMBER_HOME_MOCK_EXAM_TITLE = "进入主观批改";
const CURRENT_MEMBER_HOME_MOCK_EXAM_DESCRIPTION = "直接进入主观题试卷列表，查看已购的试卷。";
const CURRENT_MEMBER_HOME_OBJECTIVE_MOCK_EXAM_TITLE = "客观题模考";
const CURRENT_MEMBER_HOME_OBJECTIVE_MOCK_EXAM_DESCRIPTION = "单独进入客观题试卷列表，后续和主观题批改彻底分开。";

export const DEFAULT_PORTAL_CONFIG = {
  seo: {
    title: "得恩法考 | 音频课程、机考系统、法条检索与打字训练一体化平台",
    description:
      "得恩法考将音频课程、真机机考、法条检索与打字训练整合进同一套数字备考平台，帮助学员完成从入门到冲刺的连续学习路径。",
    keywords: "得恩法考,法考培训,法考机考,法考主观题,法考客观题,法条检索,打字练习,音频课程",
    ogImageUrl: "/portal/founder-avatar.png",
    ogImageObjectKey: "",
  },
  actions: {
    authLoggedInLabel: "进入学习中心",
    authLoggedOutLabel: "立即登录",
    authLoggedInShortLabel: "学习中心",
    browseModulesLabel: "浏览平台模块",
    consultNowLabel: "立即咨询",
    footerBrowseLabel: "查看核心模块",
  },
  navigation: {
    links: [
      { label: "核心模块", href: "#products" },
      { label: "备考路径", href: "#journey" },
      { label: "平台价值", href: "#experience" },
      { label: "咨询入口", href: "#contact" },
    ],
    quickEntryLabel: "快捷入口",
    footerNavTitle: "页面导航",
    footerFeatureTitle: "平台模块",
  },
  hero: {
    badge: "法考学习门户",
    title: "把法考学习做成",
    highlight: "一个真正可操作的数字考场",
    description:
      "公开门户负责展示品牌、模块结构与产品气质，登录后直接进入你的学习首页。课程、机考、法条与打字被收进一套连续路径里，而不是零散入口。",
    quickTags: ["公开门户展示", "登录直达首页", "PC / 手机双端"],
  },
  products: {
    title: "从第一次听课到最后冲刺，每个模块都有明确位置",
  },
  memberHome: {
    hero: {
      badge: "快捷入口",
      title: "欢迎使用得宝",
      description: "课程学习、机考训练、法条检索和打字练习统一收口，直接进入今天的学习节奏。",
    },
    bannerImageUrl: "/portal/home-hero-banner.png",
    bannerImageObjectKey: "",
    announcement: {
      title: "学习公告",
      subtitle: "Announcement",
      badge: "最新",
      items: [
        {
          title: "首页已整合课程、机考、法条检索与打字练习四个常用入口",
          description: "登录后优先从首页直接进入当日学习动作，减少来回切换和重复查找。",
        },
        {
          title: "课程更新、模考安排与系统通知都会持续汇总到这里",
          description: "后续如有班级动态、阶段提醒或专项训练安排，可直接通过后台统一维护。",
        },
      ],
    },
    operations: {
      title: "首页推荐位",
      subtitle: "Operations",
      items: [
        {
          eyebrow: "课程入口",
          title: "继续课程学习",
          description: "返回最近正在推进的课程，优先完成今天的听课和复盘任务。",
          path: "/user/courses",
        },
        {
          eyebrow: "机考训练",
          title: CURRENT_MEMBER_HOME_MOCK_EXAM_TITLE,
          description: CURRENT_MEMBER_HOME_MOCK_EXAM_DESCRIPTION,
          path: "/user/mock-exams",
        },
        {
          eyebrow: "机考训练",
          title: CURRENT_MEMBER_HOME_OBJECTIVE_MOCK_EXAM_TITLE,
          description: CURRENT_MEMBER_HOME_OBJECTIVE_MOCK_EXAM_DESCRIPTION,
          path: "/user/objective-mock-exams",
        },
        {
          eyebrow: "专项提升",
          title: "开始打字训练",
          description: "针对主观题输入速度与稳定性做专项强化，拉高输出效率。",
          path: "/user/typing-practice",
        },
      ],
    },
  },
  examHome: {
    eyebrow: "Mock Exam",
    title: "我的试卷",
    objectiveModeLabel: "客观题专场",
    subjectiveModeLabel: "主观题专场",
    objectiveEmptyText: "当前还没有可进入的客观题试卷，请先在后台发布试卷。",
    subjectiveEmptyText: "当前还没有可进入的主观题试卷，请先在后台发布试卷。",
  },
  accountCenter: {
    eyebrow: "Account Center",
    description: "这里统一放课程学习外的个人操作入口。你可以查看考试记录，也可以随时安全退出当前设备。",
    shortcutTitle: "DE EN FA KAO",
    shortcuts: [
      {
        title: "我的考试",
        description: "查看你参加过的考试记录与结果。",
        path: "/user/my-exams",
        accentText: "进入考试记录",
      },
      {
        title: "考试排行榜",
        description: "按试卷查看自己的成绩排名，只显示你已经考过的试卷排行榜。",
        path: "/user/exam-leaderboard",
        accentText: "进入排行榜",
      },
    ],
  },
  journey: {
    eyebrow: "学习流程",
    title: "门户不是孤立展示页，它会把用户自然引向整套学习路径",
    cards: [
      {
        step: "01",
        title: "先听课，快速搭出框架",
        description: "先用音频课程建立完整知识图，再决定哪些模块需要加练。",
      },
      {
        step: "02",
        title: "再进机考，模拟真实节奏",
        description: "客观题练准确率，主观题练输出和流程感，训练和考试统一习惯。",
      },
      {
        step: "03",
        title: "法条与打字做专项强化",
        description: "把法条检索和输入速度拆出来单独打磨，减少主观题卡顿感。",
      },
    ],
  },
  experience: {
    badge: "平台价值",
    title: "一边是吸引用户理解产品的公开门户，一边是登录后立即开学的学习工作台",
    cards: [
      {
        title: "门户负责展示",
        description: "未登录用户先看到完整的平台价值、模块分布和视觉氛围。",
      },
      {
        title: "登录后直达个人首页",
        description: "右上角登录进入站内，不再把公开展示页和学习页混在一起。",
      },
      {
        title: "电脑与手机双布局",
        description: "门户是营销入口，站内是学习入口，两端都保留各自合理的体验重心。",
      },
    ],
  },
  startPanel: {
    eyebrow: "立即开始",
    loggedInTitle: "继续进入你的学习中心",
    loggedOutTitle: "登录后即可进入你的学习中心",
    description: "从了解课程到进入训练，整条路径更短，也更容易把注意力放回真正重要的备考动作。",
  },
  startOptions: {
    eyebrow: "开始方式",
    items: [
      {
        title: "先看课程体系",
        description: "适合先了解老师、内容和学习路径",
        path: "/user/courses",
      },
      {
        title: "先做机考训练",
        description: "适合已经进入刷题、模考与实战阶段",
        path: "/user/mock-exams",
      },
    ],
  },
  founder: {
    imageUrl: "/portal/FGTM.png",
    imageObjectKey: "",
    sectionBadge: "创始人介绍",
    perspectiveLabel: "Founder",
    name: "创始人",
    role: "得恩法考创始人",
    intro:
      "长期聚焦法考教育与数字化学习场景，持续推动课程、机考、法条检索与打字训练做成一套完整系统。",
    statement:
      "希望把传统培训里分散的听课、练题、冲刺和复盘，真正搬进一个可操作、可持续、可迭代的学习工作台里。",
    methodLabel: "以产品方法重构法考学习体验",
    perspective:
      "学习平台不只是在堆功能，而是在重新组织用户从认知、训练到成交的完整节奏。",
    tags: ["学习闭环", "数字机考", "效率导向"],
  },
  footer: {
    description:
      "得恩法考门户负责把平台价值、学习路径与产品气质完整讲清楚。登录之后，用户直接进入课程、机考、法条与打字训练组成的学习工作台。",
    copyright: "© 2026 得恩法考. 门户官网结构已就位，正式上线前可继续补充真实公司与合规信息。",
    legalDocuments: [
      {
        title: "服务协议",
        slug: "terms-of-service",
        content: [
          "欢迎使用得恩法考平台。平台提供课程学习、机考训练、法条检索、打字练习及相关学习服务，用户在注册、登录或使用平台功能前，应当先充分阅读并理解本协议。",
          "用户应当妥善保管账号、密码及登录设备，不得向他人出借、出租、出售或以其他方式提供账号使用。因账号保管不当造成的损失，由账号持有人自行承担。",
          "平台上的课程内容、题库资料、页面设计、程序代码及相关数据均受法律保护。未经书面许可，任何组织或个人不得擅自复制、传播、出售或用于商业用途。",
          "如用户存在扰乱平台秩序、恶意抓取内容、违规共享账号、攻击系统或其他违法违规行为，平台有权暂停或终止服务，并保留依法追责的权利。",
        ],
      },
      {
        title: "隐私政策",
        slug: "privacy-policy",
        content: [
          "得恩法考重视用户个人信息与学习数据保护。平台在提供服务过程中，可能收集账号信息、登录设备信息、学习记录、订单信息及客服沟通信息，用于身份识别、服务交付、运营保障与体验优化。",
          "平台仅在实现既定服务目的所必需的范围内处理用户信息，并采取合理的技术与管理措施保护数据安全，避免信息泄露、篡改或丢失。",
          "除法律法规另有规定，或为完成支付、云存储、消息通知等必要服务合作外，平台不会擅自向无关第三方披露用户个人信息。",
          "用户有权对个人信息进行查询、更正、删除或联系平台处理相关问题。若涉及订单、法律合规或安全审计要求，平台将在法定范围内保留必要记录。",
        ],
      },
      {
        title: "用户守则",
        slug: "user-guidelines",
        content: [
          "用户应基于真实、合法、合规的目的使用得恩法考平台，不得利用平台从事违法活动、破坏系统稳定、传播有害信息或侵犯他人合法权益。",
          "在课程学习、机考训练、法条检索与打字练习过程中，用户应遵守平台既定流程，不得通过外挂、脚本、异常接口调用等方式影响平台正常运行或干扰其他用户。",
          "用户在平台内提交的反馈、咨询或自定义内容，应保证内容合法、客观、真实，不得包含侮辱、诽谤、广告、诈骗或其他不当信息。",
          "平台鼓励用户合理使用各项训练工具，持续提升学习效率。若发现功能异常、信息错误或安全问题，欢迎及时联系平台客服处理。",
        ],
      },
    ],
  },
  contact: {
    badge: "咨询与试学",
    title: "先咨询，再试学，再进入完整学习路径",
    description:
      "课程咨询、试学预约、开通问题和合作需求，都可以从这里直接进入，不再让公开门户只停留在展示层。",
    buttonLabel: "联系课程顾问",
    buttonHint: "客服链接由后台系统配置统一维护，可替换为企微客服、表单或预约链接。",
    phone: "",
    wechat: "",
    url: "",
    steps: [
      {
        step: "01",
        title: "先咨询，再判断班型",
        detail: "从课程咨询、试学预约到学习规划，第一步沟通都会在首页完成。",
      },
      {
        step: "02",
        title: "按基础与目标给出建议",
        detail: "根据你的阶段、目标分数和时间安排，判断更适合的训练路径。",
      },
      {
        step: "03",
        title: "登录后进入完整学习路径",
        detail: "课程、机考、法条与打字练习会在站内统一承接，持续推进。",
      },
    ],
  },
  features: [
    {
      key: "audio",
      title: "音频课程",
      eyebrow: "碎片化输入",
      description: "把课程、讲义与回放节奏收进同一个学习界面，适合日常通勤和高频复习。",
      detail: "适合先建立知识框架，再进入做题和主观题训练。",
      action: "进入课程",
      tags: ["讲义联动", "倍速回听", "移动端同步"],
    },
    {
      key: "exam",
      title: "机考系统",
      eyebrow: "真机流程",
      description: "客观题和主观题分流训练，考试须知、进入考场、作答节奏全部按机考方式组织。",
      detail: "不是单页刷题，而是更接近真实考试的操作流。",
      action: "进入机考",
      tags: ["须知流程", "客主分离", "成绩总览"],
    },
    {
      key: "laws",
      title: "法条检索",
      eyebrow: "主观题配套",
      description: "在主观题训练过程中直接调用法条窗口，支持放大检索、快速定位与考试式阅读。",
      detail: "法条不是孤立入口，而是训练过程里的并行工作区。",
      action: "查看法条",
      tags: ["全屏放大", "考试模式", "检索联动"],
    },
    {
      key: "typing",
      title: "打字练习",
      eyebrow: "输出速度",
      description: "用法律专业文本做跟打、冲刺和默写训练，把主观题录入速度单独拉起来。",
      detail: "节奏、速度、正确率三条线一起看，服务主观题输出。",
      action: "开始练习",
      tags: ["跟打模式", "限时冲刺", "法条默写"],
    },
  ],
};

export const createDefaultPortalConfig = () => clone(DEFAULT_PORTAL_CONFIG);

export const normalizePortalConfig = (value, options = {}) => {
  const fallback = createDefaultPortalConfig();
  const source = value && typeof value === "object" ? value : {};
  const seoSource = source.seo && typeof source.seo === "object" ? source.seo : {};
  const actionSource = source.actions && typeof source.actions === "object" ? source.actions : {};
  const navigationSource = source.navigation && typeof source.navigation === "object" ? source.navigation : {};
  const heroSource = source.hero && typeof source.hero === "object" ? source.hero : {};
  const productsSource = source.products && typeof source.products === "object" ? source.products : {};
  const memberHomeSource = source.memberHome && typeof source.memberHome === "object" ? source.memberHome : {};
  const memberHomeAnnouncementSource =
    memberHomeSource.announcement && typeof memberHomeSource.announcement === "object"
      ? memberHomeSource.announcement
      : {};
  const memberHomeHeroSource =
    memberHomeSource.hero && typeof memberHomeSource.hero === "object"
      ? memberHomeSource.hero
      : {};
  const memberHomeOperationsSource =
    memberHomeSource.operations && typeof memberHomeSource.operations === "object"
      ? memberHomeSource.operations
      : {};
  const examHomeSource = source.examHome && typeof source.examHome === "object" ? source.examHome : {};
  const accountCenterSource = source.accountCenter && typeof source.accountCenter === "object" ? source.accountCenter : {};
  const journeySource = source.journey && typeof source.journey === "object" ? source.journey : {};
  const experienceSource = source.experience && typeof source.experience === "object" ? source.experience : {};
  const startPanelSource = source.startPanel && typeof source.startPanel === "object" ? source.startPanel : {};
  const startOptionsSource = source.startOptions && typeof source.startOptions === "object" ? source.startOptions : {};
  const founderSource = source.founder && typeof source.founder === "object" ? source.founder : {};
  const footerSource = source.footer && typeof source.footer === "object" ? source.footer : {};
  const contactSource = source.contact && typeof source.contact === "object" ? source.contact : {};
  const featureMap = new Map(
    (Array.isArray(source.features) ? source.features : [])
      .filter((item) => item && typeof item === "object")
      .map((item) => [`${item.key ?? ""}`.trim(), item]),
  );

  fallback.seo = {
    title: toTrimmedString(seoSource.title, fallback.seo.title),
    description: toTrimmedString(seoSource.description, fallback.seo.description),
    keywords: toTrimmedString(seoSource.keywords, fallback.seo.keywords),
    ogImageUrl: toTrimmedString(seoSource.ogImageUrl, fallback.seo.ogImageUrl),
    ogImageObjectKey: toTrimmedString(seoSource.ogImageObjectKey, fallback.seo.ogImageObjectKey),
  };

  fallback.actions = {
    authLoggedInLabel: toTrimmedString(actionSource.authLoggedInLabel, fallback.actions.authLoggedInLabel),
    authLoggedOutLabel: toTrimmedString(actionSource.authLoggedOutLabel, fallback.actions.authLoggedOutLabel),
    authLoggedInShortLabel: toTrimmedString(actionSource.authLoggedInShortLabel, fallback.actions.authLoggedInShortLabel),
    browseModulesLabel: toTrimmedString(actionSource.browseModulesLabel, fallback.actions.browseModulesLabel),
    consultNowLabel: toTrimmedString(actionSource.consultNowLabel, fallback.actions.consultNowLabel),
    footerBrowseLabel: toTrimmedString(actionSource.footerBrowseLabel, fallback.actions.footerBrowseLabel),
  };

  fallback.navigation = {
    links: normalizeFixedArray(navigationSource.links, fallback.navigation.links, (item, link) => ({
      label: toTrimmedString(item.label, link.label),
      href: toTrimmedString(item.href, link.href),
    })),
    quickEntryLabel: toTrimmedString(navigationSource.quickEntryLabel, fallback.navigation.quickEntryLabel),
    footerNavTitle: toTrimmedString(navigationSource.footerNavTitle, fallback.navigation.footerNavTitle),
    footerFeatureTitle: toTrimmedString(navigationSource.footerFeatureTitle, fallback.navigation.footerFeatureTitle),
  };

  fallback.hero = {
    badge: toTrimmedString(heroSource.badge, fallback.hero.badge),
    title: toTrimmedString(heroSource.title, fallback.hero.title),
    highlight: toTrimmedString(heroSource.highlight, fallback.hero.highlight),
    description: toTrimmedString(heroSource.description, fallback.hero.description),
    quickTags: toStringArray(heroSource.quickTags, fallback.hero.quickTags),
  };

  fallback.products = {
    title: toTrimmedString(productsSource.title, fallback.products.title),
  };

  fallback.memberHome = {
    hero: {
      badge: toTrimmedString(memberHomeHeroSource.badge, fallback.memberHome.hero.badge),
      title: toTrimmedString(memberHomeHeroSource.title, fallback.memberHome.hero.title),
      description: toTrimmedString(memberHomeHeroSource.description, fallback.memberHome.hero.description),
    },
    bannerImageUrl: toTrimmedString(memberHomeSource.bannerImageUrl, fallback.memberHome.bannerImageUrl),
    bannerImageObjectKey: toTrimmedString(memberHomeSource.bannerImageObjectKey, fallback.memberHome.bannerImageObjectKey),
    announcement: {
      title: toTrimmedString(memberHomeAnnouncementSource.title, fallback.memberHome.announcement.title),
      subtitle: toTrimmedString(memberHomeAnnouncementSource.subtitle, fallback.memberHome.announcement.subtitle),
      badge: toTrimmedString(memberHomeAnnouncementSource.badge, fallback.memberHome.announcement.badge),
      items: normalizeFixedArray(
        memberHomeAnnouncementSource.items,
        fallback.memberHome.announcement.items,
        (item, announcementItem) => ({
          title: toTrimmedString(item.title, announcementItem.title),
          description: toTrimmedString(item.description, announcementItem.description),
        }),
      ),
    },
    operations: {
      title: toTrimmedString(memberHomeOperationsSource.title, fallback.memberHome.operations.title),
      subtitle: toTrimmedString(memberHomeOperationsSource.subtitle, fallback.memberHome.operations.subtitle),
      items: normalizeFixedArray(memberHomeOperationsSource.items, fallback.memberHome.operations.items, (item, operationItem) => ({
        eyebrow: toTrimmedString(item.eyebrow, operationItem.eyebrow),
        title:
          toTrimmedString(item.path, operationItem.path) === "/user/mock-exams" &&
          toTrimmedString(item.title, operationItem.title) === LEGACY_MEMBER_HOME_MOCK_EXAM_TITLE
            ? CURRENT_MEMBER_HOME_MOCK_EXAM_TITLE
            : toTrimmedString(item.title, operationItem.title),
        description:
          toTrimmedString(item.path, operationItem.path) === "/user/mock-exams" &&
          toTrimmedString(item.description, operationItem.description) === LEGACY_MEMBER_HOME_MOCK_EXAM_DESCRIPTION
            ? CURRENT_MEMBER_HOME_MOCK_EXAM_DESCRIPTION
            : toTrimmedString(item.description, operationItem.description),
        path: toTrimmedString(item.path, operationItem.path),
      })),
    },
  };

  fallback.examHome = {
    eyebrow: toTrimmedString(examHomeSource.eyebrow, fallback.examHome.eyebrow),
    title: toTrimmedString(examHomeSource.title, fallback.examHome.title),
    objectiveModeLabel: toTrimmedString(examHomeSource.objectiveModeLabel, fallback.examHome.objectiveModeLabel),
    subjectiveModeLabel: toTrimmedString(examHomeSource.subjectiveModeLabel, fallback.examHome.subjectiveModeLabel),
    objectiveEmptyText: toTrimmedString(examHomeSource.objectiveEmptyText, fallback.examHome.objectiveEmptyText),
    subjectiveEmptyText: toTrimmedString(examHomeSource.subjectiveEmptyText, fallback.examHome.subjectiveEmptyText),
  };

  fallback.accountCenter = {
    eyebrow: toTrimmedString(accountCenterSource.eyebrow, fallback.accountCenter.eyebrow),
    description: toTrimmedString(accountCenterSource.description, fallback.accountCenter.description),
    shortcutTitle: toTrimmedString(accountCenterSource.shortcutTitle, fallback.accountCenter.shortcutTitle),
    shortcuts: normalizeFixedArray(accountCenterSource.shortcuts, fallback.accountCenter.shortcuts, (item, shortcut) => ({
      title: toTrimmedString(item.title, shortcut.title),
      description: toTrimmedString(item.description, shortcut.description),
      path: toTrimmedString(item.path, shortcut.path),
      accentText: toTrimmedString(item.accentText, shortcut.accentText),
    })),
  };

  fallback.journey = {
    eyebrow: toTrimmedString(journeySource.eyebrow, fallback.journey.eyebrow),
    title: toTrimmedString(journeySource.title, fallback.journey.title),
    cards: normalizeFixedArray(journeySource.cards, fallback.journey.cards, (item, card) => ({
      step: toTrimmedString(item.step, card.step),
      title: toTrimmedString(item.title, card.title),
      description: toTrimmedString(item.description, card.description),
    })),
  };

  fallback.experience = {
    badge: toTrimmedString(experienceSource.badge, fallback.experience.badge),
    title: toTrimmedString(experienceSource.title, fallback.experience.title),
    cards: normalizeFixedArray(experienceSource.cards, fallback.experience.cards, (item, card) => ({
      title: toTrimmedString(item.title, card.title),
      description: toTrimmedString(item.description, card.description),
    })),
  };

  fallback.startPanel = {
    eyebrow: toTrimmedString(startPanelSource.eyebrow, fallback.startPanel.eyebrow),
    loggedInTitle: toTrimmedString(startPanelSource.loggedInTitle, fallback.startPanel.loggedInTitle),
    loggedOutTitle: toTrimmedString(startPanelSource.loggedOutTitle, fallback.startPanel.loggedOutTitle),
    description: toTrimmedString(startPanelSource.description, fallback.startPanel.description),
  };

  fallback.startOptions = {
    eyebrow: toTrimmedString(startOptionsSource.eyebrow, fallback.startOptions.eyebrow),
    items: normalizeFixedArray(startOptionsSource.items, fallback.startOptions.items, (item, option) => ({
      title: toTrimmedString(item.title, option.title),
      description: toTrimmedString(item.description, option.description),
      path: toTrimmedString(item.path, option.path),
    })),
  };

  fallback.founder = {
    imageUrl: toTrimmedString(founderSource.imageUrl, fallback.founder.imageUrl),
    imageObjectKey: toTrimmedString(founderSource.imageObjectKey, fallback.founder.imageObjectKey),
    sectionBadge: toTrimmedString(founderSource.sectionBadge, fallback.founder.sectionBadge),
    perspectiveLabel: toTrimmedString(founderSource.perspectiveLabel, fallback.founder.perspectiveLabel),
    name: toTrimmedString(founderSource.name, fallback.founder.name),
    role: toTrimmedString(founderSource.role, fallback.founder.role),
    intro: toTrimmedString(founderSource.intro, fallback.founder.intro),
    statement: toTrimmedString(founderSource.statement, fallback.founder.statement),
    methodLabel: toTrimmedString(founderSource.methodLabel, fallback.founder.methodLabel),
    perspective: toTrimmedString(founderSource.perspective, fallback.founder.perspective),
    tags: toStringArray(founderSource.tags, fallback.founder.tags),
  };

  fallback.footer = {
    description: toTrimmedString(footerSource.description, fallback.footer.description),
    copyright: toTrimmedString(footerSource.copyright, fallback.footer.copyright),
    legalDocuments: normalizeFixedArray(footerSource.legalDocuments, fallback.footer.legalDocuments, (item, document) => ({
      title: toTrimmedString(item.title, document.title),
      slug: toTrimmedString(item.slug, document.slug),
      content: toStringArray(item.content, document.content),
    })),
  };

  fallback.contact = {
    badge: toTrimmedString(contactSource.badge, fallback.contact.badge),
    title: toTrimmedString(contactSource.title, fallback.contact.title),
    description: toTrimmedString(contactSource.description, fallback.contact.description),
    buttonLabel: toTrimmedString(contactSource.buttonLabel, fallback.contact.buttonLabel),
    buttonHint: toTrimmedString(contactSource.buttonHint, fallback.contact.buttonHint),
    phone: toTrimmedString(contactSource.phone, fallback.contact.phone),
    wechat: toTrimmedString(contactSource.wechat, fallback.contact.wechat),
    url: toTrimmedString(contactSource.url, ""),
    steps: normalizeFixedArray(contactSource.steps, fallback.contact.steps, (item, step) => ({
      step: toTrimmedString(item.step, step.step),
      title: toTrimmedString(item.title, step.title),
      detail: toTrimmedString(item.detail, step.detail),
    })),
  };

  if (options.customerServiceUrl && !fallback.contact.url) {
    fallback.contact.url = `${options.customerServiceUrl}`.trim();
  }

  fallback.features = fallback.features.map((feature) => {
    const sourceFeature = featureMap.get(feature.key) ?? {};
    return {
      ...feature,
      title: toTrimmedString(sourceFeature.title, feature.title),
      eyebrow: toTrimmedString(sourceFeature.eyebrow, feature.eyebrow),
      description: toTrimmedString(sourceFeature.description, feature.description),
      detail: toTrimmedString(sourceFeature.detail, feature.detail),
      action: toTrimmedString(sourceFeature.action, feature.action),
      tags: toStringArray(sourceFeature.tags, feature.tags),
    };
  });

  return fallback;
};
