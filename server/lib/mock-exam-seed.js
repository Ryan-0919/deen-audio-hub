const objectivePaperSeeds = [
  {
    code: "objective_mock_paper_1",
    title: "2026 客观题模考卷一",
    subtitle: "民法、公司法、行政法综合体验卷",
    year: 2026,
    phase: "客观题卷一",
    durationMinutes: 90,
    passScore: 12,
    sortOrder: 1,
    description: "先提供客观题模考的完整流程体验，后续可继续扩充正式题库、套卷和主观题。",
    questions: [
      {
        type: "single_choice",
        score: 2,
        stem: "10 周岁的张某未经父母同意，独自花费 9000 元购买一部高端手机。关于该买卖合同的效力，下列哪一说法是正确的？",
        analysis: "张某属于限制民事行为能力人，购买高价手机明显超出其年龄、智力相适应的范围，该合同行为需经法定代理人追认后方能生效。",
        correctAnswerKeys: ["B"],
        options: [
          { key: "A", content: "合同当然有效" },
          { key: "B", content: "合同经其法定代理人追认后有效" },
          { key: "C", content: "合同当然无效" },
          { key: "D", content: "合同可由出卖人单方撤销" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "甲公司在格式合同中约定“因甲公司重大过失造成消费者损失的，甲公司不承担赔偿责任”，且未以合理方式提示。关于该条款，下列哪一说法是正确的？",
        analysis: "涉及免除提供格式条款一方责任、排除对方主要权利的内容，应履行提示说明义务；免除因重大过失造成损失责任的条款本身也无效。",
        correctAnswerKeys: ["C"],
        options: [
          { key: "A", content: "该条款有效，因为双方已签字确认" },
          { key: "B", content: "该条款仅在甲公司故意时无效" },
          { key: "C", content: "该条款无效" },
          { key: "D", content: "该条款效力待定" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "关于正当防卫，下列哪一说法是正确的？",
        analysis: "正当防卫针对正在进行的不法侵害，未明显超过必要限度造成重大损害的，不负刑事责任。",
        correctAnswerKeys: ["C"],
        options: [
          { key: "A", content: "只要造成侵害人受伤，就一定构成防卫过当" },
          { key: "B", content: "对尚未开始的不法侵害也可以实行正当防卫" },
          { key: "C", content: "针对正在进行的不法侵害实施防卫，符合条件的不负刑事责任" },
          { key: "D", content: "正当防卫只能针对故意犯罪行为实施" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "关于有限责任公司股东责任，下列哪一说法是正确的？",
        analysis: "有限责任公司的股东以其认缴的出资额为限对公司承担责任，公司以其全部财产对外承担责任。",
        correctAnswerKeys: ["A"],
        options: [
          { key: "A", content: "股东以其认缴的出资额为限对公司承担责任" },
          { key: "B", content: "股东应以个人全部财产对公司债务承担连带责任" },
          { key: "C", content: "公司亏损时股东当然丧失股东资格" },
          { key: "D", content: "股东未参与经营即无需履行出资义务" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "甲将房屋出租给乙，租期两年。租赁期间，甲将该房屋出售给丙并办理过户。关于租赁关系，下列哪一说法是正确的？",
        analysis: "买卖不破租赁。房屋所有权转移后，不影响既有租赁合同的效力，承租人可在租赁期间继续占有使用。",
        correctAnswerKeys: ["B"],
        options: [
          { key: "A", content: "租赁合同当然终止" },
          { key: "B", content: "丙应继续尊重乙在租赁期间的占有使用权" },
          { key: "C", content: "乙只能向甲主张权利，不能对抗丙" },
          { key: "D", content: "丙可随时要求乙立即搬离" },
        ],
      },
      {
        type: "multiple_choice",
        score: 3,
        stem: "下列哪些民事法律行为属于无效民事法律行为？",
        analysis: "无民事行为能力人独立实施、恶意串通损害他人合法权益、违背公序良俗、以合法形式掩盖非法目的等行为均属无效。",
        correctAnswerKeys: ["A", "B", "C", "D"],
        options: [
          { key: "A", content: "无民事行为能力人独立实施的民事法律行为" },
          { key: "B", content: "行为人与相对人恶意串通，损害第三人合法权益的行为" },
          { key: "C", content: "违背公序良俗的行为" },
          { key: "D", content: "以合法形式掩盖非法目的的行为" },
        ],
      },
      {
        type: "multiple_choice",
        score: 3,
        stem: "根据行政处罚法，下列哪些属于行政处罚？",
        analysis: "警告、罚款、没收违法所得、行政拘留、吊销许可证件、责令停产停业等都属于行政处罚；行政调解不是行政处罚。",
        correctAnswerKeys: ["A", "B", "C"],
        options: [
          { key: "A", content: "罚款" },
          { key: "B", content: "行政拘留" },
          { key: "C", content: "吊销许可证件" },
          { key: "D", content: "行政调解" },
        ],
      },
      {
        type: "uncertain_choice",
        score: 4,
        material:
          "甲在某电商平台购买一台笔记本电脑，已完成付款。商家乙将电脑交付物流公司丙运输。运输途中因丙保管不当导致电脑严重损坏。甲拒绝签收并要求退款。",
        stem: "根据上述案情，下列哪些说法是正确的？",
        analysis: "甲与乙之间存在买卖合同关系，乙对向甲交付符合约定的标的物负有义务；运输损坏一般不由消费者自行承担。乙向甲承担责任后，可再向存在过错的承运人丙追偿。",
        correctAnswerKeys: ["A", "C", "D"],
        options: [
          { key: "A", content: "甲有权要求乙承担相应的违约责任" },
          { key: "B", content: "只要乙已将货物交给丙，乙即当然免责" },
          { key: "C", content: "乙承担责任后，可以依法向丙追偿" },
          { key: "D", content: "甲拒绝签收并主张退款具有法律依据" },
        ],
      },
    ],
  },
  {
    code: "objective_mock_paper_2",
    title: "2026 客观题模考卷二",
    subtitle: "宪法、诉讼法、劳动法综合体验卷",
    year: 2026,
    phase: "客观题卷二",
    durationMinutes: 90,
    passScore: 12,
    sortOrder: 2,
    description: "当前先搭建客观题考试链路，后续可继续接入更完整的卷册、章节和错题训练。",
    questions: [
      {
        type: "single_choice",
        score: 2,
        stem: "根据宪法，下列哪一机关有权解释宪法并监督宪法的实施？",
        analysis: "全国人民代表大会常务委员会行使解释宪法、监督宪法实施的职权。",
        correctAnswerKeys: ["B"],
        options: [
          { key: "A", content: "全国人民代表大会主席团" },
          { key: "B", content: "全国人民代表大会常务委员会" },
          { key: "C", content: "最高人民法院" },
          { key: "D", content: "国务院法制机构" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "关于犯罪未遂，下列哪一说法是正确的？",
        analysis: "已经着手实行犯罪，由于犯罪分子意志以外的原因而未得逞的，是犯罪未遂。对未遂犯，可以比照既遂犯从轻或者减轻处罚。",
        correctAnswerKeys: ["D"],
        options: [
          { key: "A", content: "只要没有造成危害结果，就一定属于犯罪未遂" },
          { key: "B", content: "犯罪未遂必须免除处罚" },
          { key: "C", content: "犯罪未遂以尚未着手实施犯罪为前提" },
          { key: "D", content: "对未遂犯，可以比照既遂犯从轻或者减轻处罚" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "公民认为具体行政行为侵犯其合法权益，申请行政复议的一般期限是自知道该具体行政行为之日起多少日内？",
        analysis: "行政复议法通常规定申请人应当自知道该具体行政行为之日起 60 日内提出复议申请。",
        correctAnswerKeys: ["C"],
        options: [
          { key: "A", content: "15 日" },
          { key: "B", content: "30 日" },
          { key: "C", content: "60 日" },
          { key: "D", content: "90 日" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "当事人不服第一审民事判决提起上诉的期间，一般为判决书送达之日起多少日？",
        analysis: "民事诉讼中，对第一审判决不服的上诉期间通常为 15 日。",
        correctAnswerKeys: ["A"],
        options: [
          { key: "A", content: "15 日" },
          { key: "B", content: "10 日" },
          { key: "C", content: "20 日" },
          { key: "D", content: "30 日" },
        ],
      },
      {
        type: "single_choice",
        score: 2,
        stem: "关于劳动合同试用期，下列哪一说法是正确的？",
        analysis: "试用期包含在劳动合同期限内。仅约定试用期的，试用期不成立，该期限为劳动合同期限。",
        correctAnswerKeys: ["B"],
        options: [
          { key: "A", content: "试用期不属于劳动合同期限" },
          { key: "B", content: "试用期包含在劳动合同期限内" },
          { key: "C", content: "所有劳动合同都可以约定六个月试用期" },
          { key: "D", content: "劳动者在试用期内不得解除劳动合同" },
        ],
      },
      {
        type: "multiple_choice",
        score: 3,
        stem: "下列哪些属于无权代理的法律后果规则？",
        analysis: "无权代理未经被代理人追认，对被代理人不发生效力；相对人可催告被代理人在合理期限内追认；善意相对人在被追认前享有撤销权。",
        correctAnswerKeys: ["A", "B", "D"],
        options: [
          { key: "A", content: "未经被代理人追认，对被代理人不发生效力" },
          { key: "B", content: "相对人可以催告被代理人在合理期限内予以追认" },
          { key: "C", content: "无权代理行为一律当然无效" },
          { key: "D", content: "善意相对人在被代理人追认前可以撤销" },
        ],
      },
      {
        type: "multiple_choice",
        score: 3,
        stem: "下列哪些情形中，用人单位可以依法解除劳动合同？",
        analysis: "劳动者严重违反规章制度、严重失职给单位造成重大损害、被依法追究刑事责任等，均可成为用人单位依法解除劳动合同的依据。",
        correctAnswerKeys: ["A", "C", "D"],
        options: [
          { key: "A", content: "劳动者严重违反用人单位规章制度" },
          { key: "B", content: "劳动者依法参加工会活动" },
          { key: "C", content: "劳动者严重失职，给用人单位造成重大损害" },
          { key: "D", content: "劳动者被依法追究刑事责任" },
        ],
      },
      {
        type: "uncertain_choice",
        score: 4,
        material:
          "李某与某培训机构签订面授课程培训合同，合同约定培训费 2 万元。签约后，培训机构未按约安排授课教师，多次延期。李某催告后，机构仍未在合理期限内履行。",
        stem: "根据上述案情，下列哪些说法是正确的？",
        analysis: "培训机构迟延履行主要义务，经催告后在合理期限内仍未履行，李某有权解除合同并请求返还相应费用；造成损失的，还可依法主张赔偿。",
        correctAnswerKeys: ["A", "B", "D"],
        options: [
          { key: "A", content: "李某有权催告培训机构继续履行" },
          { key: "B", content: "在合理期限内仍不履行的，李某有权解除合同" },
          { key: "C", content: "李某只能等待机构后续安排，不能主张退款" },
          { key: "D", content: "符合条件时，李某可以请求返还培训费并主张损失赔偿" },
        ],
      },
    ],
  },
];

const subjectivePaperSeeds = [
  {
    code: "subjective_mock_paper_1",
    title: "2026 主观题真机模拟",
    subtitle: "案例分析与论述题真机模拟卷",
    year: 2026,
    phase: "主观题",
    durationMinutes: 240,
    passScore: 108,
    sortOrder: 9,
    description: "按真机模拟主观题答题方式组织，支持分问切换、自动保存和交卷后待批改提示。",
    questions: [
      {
        type: "subjective_case",
        score: 56,
        stem: "一、民商事综合案例分析题。",
        material:
          "高某与林某筹备设立康健医疗公司，高某以个人名义向瑞康公司订购实验设备，约定货到付款。公司成立后，林某以公司法定代表人身份继续推进生产线建设，并租赁朱某名下厂房八年。其后，因设备款、租赁瑕疵和公司对外责任承担发生争议。",
        analysis:
          "参考要点：1. 设立中公司对外订立合同的责任承担，应结合发起人名义、公司设立后追认或实际受益情况综合判断。2. 厂房租赁如存在权利瑕疵或重大隐瞒，承租方可依法主张解除、减租或赔偿。3. 公司成立后如实际接收设备并投入经营，原则上应对设立期间与公司利益直接相关的交易承担责任。",
        questionMeta: {
          sectionLabel: "一、案例分析题",
          groupDescription: "请在对应的答题区域内作答，系统会实时保存。",
          subQuestions: [
            {
              id: "subjective_1_q1",
              title: "问题(1)：瑞康公司可否直接要求康健公司承担22万元设备价款？请说明理由。",
              placeholder: "请围绕设立中公司合同责任、公司设立后承受合同的条件展开作答。",
            },
            {
              id: "subjective_1_q2",
              title: "问题(2)：若朱某出租的厂房存在权属争议，林某或康健公司可以主张哪些权利？",
              placeholder: "请结合法律关系性质、瑕疵担保责任和违约救济方式作答。",
            },
            {
              id: "subjective_1_q3",
              title: "问题(3)：高某、林某与康健公司之间对外责任分担应如何处理？",
              placeholder: "请从发起人责任、公司责任承接以及内部追偿角度作答。",
            },
          ],
        },
      },
      {
        type: "subjective_case",
        score: 44,
        stem: "二、行政与程序法综合论述题。",
        material:
          "某市市场监管局在未充分听取陈述申辩的情况下，对甲公司作出高额罚款并责令停业整顿。甲公司认为处罚程序严重违法、事实认定不清，并拟同步申请行政复议和提起行政诉讼。同时，甲公司内部合规负责人建议启动证据保全与整改留痕机制。",
        analysis:
          "参考要点：1. 行政处罚应依法履行告知、陈述申辩和听证等程序。2. 对具体行政行为不服的救济路径，应区分复议前置与一般复议/诉讼并行规则。3. 企业侧应注意保全证据、形成整改闭环，并评估停业措施对经营的持续影响。",
        questionMeta: {
          sectionLabel: "二、论述题",
          groupDescription: "请结合程序法和实体法规则分点论述，避免遗漏关键救济步骤。",
          subQuestions: [
            {
              id: "subjective_2_q1",
              title: "问题(1)：该行政处罚决定在程序上可能存在哪些违法点？",
              placeholder: "请围绕告知义务、陈述申辩、听证权保障等角度作答。",
            },
            {
              id: "subjective_2_q2",
              title: "问题(2)：甲公司可如何选择复议与诉讼路径？各自的核心注意事项是什么？",
              placeholder: "请从期限、受理机关、审查范围和执行影响等方面展开。",
            },
            {
              id: "subjective_2_q3",
              title: "问题(3)：从企业合规角度，甲公司应立即采取哪些证据保全与整改措施？",
              placeholder: "请从证据留存、责任划分、外部沟通与后续风控机制角度作答。",
            },
          ],
        },
      },
    ],
  },
];

const mockExamPaperSeeds = [...objectivePaperSeeds, ...subjectivePaperSeeds];

const buildPaperStats = (questions) => ({
  questionCount: questions.length,
  totalScore: questions.reduce((sum, question) => sum + question.score, 0),
});

export const ensureMockExamSeedData = async (db) => {
  for (const paper of mockExamPaperSeeds) {
    const existing = await db.mockExamPaper.findUnique({
      where: {
        code: paper.code,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      continue;
    }

    const stats = buildPaperStats(paper.questions);

    await db.mockExamPaper.create({
      data: {
        code: paper.code,
        title: paper.title,
        subtitle: paper.subtitle,
        paperType: paper.questions.some((question) => question.type === "subjective_case") ? "subjective" : "objective",
        year: paper.year,
        phase: paper.phase,
        durationMinutes: paper.durationMinutes,
        maxAttempts: Number(paper.maxAttempts ?? 0),
        totalScore: stats.totalScore,
        questionCount: stats.questionCount,
        passScore: paper.passScore,
        description: paper.description,
        status: "published",
        sortOrder: paper.sortOrder,
        questions: {
          create: paper.questions.map((question, questionIndex) => ({
            type: question.type,
            stem: question.stem,
            material: question.material ?? "",
            analysis: question.analysis,
            score: question.score,
            sortOrder: questionIndex + 1,
            correctAnswerJson: JSON.stringify(question.correctAnswerKeys ?? []),
            questionMetaJson: question.questionMeta ? JSON.stringify(question.questionMeta) : null,
            options: {
              create: (question.options ?? []).map((option, optionIndex) => ({
                optionKey: option.key,
                content: option.content,
                sortOrder: optionIndex + 1,
              })),
            },
          })),
        },
      },
    });
  }
};
