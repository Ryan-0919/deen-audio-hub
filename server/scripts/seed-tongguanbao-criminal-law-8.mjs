import { prisma } from "../lib/prisma.js";

const folderName = "通关宝";
const paperTitle = "通关宝-刑法8";
const itemStem = "结合案情与相关刑法理论，回答下列问题。";

const material = `钱某作为中介，协助李某（卖方）与孙某（买方）进行房产交易。约定孙某首付200万元后，李某过户房产，之后孙某再以房产抵押向乙公司贷款100万元支付尾款。钱某意图侵吞尾款，便在设法说服李某过户后，对孙某谎称代孙某申办贷款，以孙某名义抵押房产，使乙公司放款100万元至自己账户并挥霍。此前，钱某因财务紧张，在明知刘某进行电信诈骗的情况下，将银行卡租给刘某，获租金1500元。钱某发现卡中汇入50万元诈骗款后，随即持临时身份证挂失补卡，在企图取款时，被银行告知账户已被公安机关冻结。`;

const analysis = "本题重点围绕三角诈骗、帮助信息网络犯罪活动罪、片面共同犯罪、存款债权占有、银行取款诈骗审查及未遂认定展开。";

const questionMeta = {
  sectionLabel: "案例分析题",
  sectionDescription: "请分小问作答，系统将按小问进行 AI 批改。",
  subQuestions: [
    {
      id: "sub_1",
      title: "第1题：结合三角诈骗结构，分析钱某在房产交易中的行为是否构成诈骗罪？其财产损失应如何认定，需答出不同观点。",
      placeholder: "请输入第1题答案",
      abilityLabel: "三角诈骗与财产损失认定",
      referenceAnswer:
        "钱某在房产交易中的行为构成诈骗罪。其一，钱某就100万元贷款对孙某构成三角诈骗：钱某以代办贷款为名欺骗孙某，并使乙公司基于错误认识向其放款，孙某虽背负贷款债务却未取得贷款利益，形成财产损失。其二，钱某就房产过户对李某也构成诈骗罪：钱某隐瞒侵吞尾款的真实意图，促使李某完成过户，导致李某在未获得足额对价的情况下处分房产。关于财产损失认定，存在不同观点：观点A认为两起诈骗之间具有目的与手段上的关联，应仅以一罪论处，犯罪数额认定为100万元；观点B认为两起诈骗侵害不同被害人的不同财产利益，应数罪并罚或累计数额，犯罪数额可认定为200万元。",
      rubricGuidance:
        "必须完整回应三层内容：一是明确构成诈骗罪；二是分别分析100万元贷款对应孙某的三角诈骗、房产过户对应李某的诈骗；三是交代财产损失认定的不同观点并作出回应。",
      rubricPoints: [
        {
          id: "q1_p1",
          title: "明确钱某构成诈骗罪",
          score: 1,
          description: "明确给出房产交易行为成立诈骗罪的结论。",
          keywords: ["构成诈骗罪", "成立诈骗罪", "诈骗罪"],
          sortOrder: 1,
        },
        {
          id: "q1_p2",
          title: "指出100万元贷款部分构成对孙某的三角诈骗",
          score: 1,
          description: "交代钱某欺骗、乙公司错误处分、孙某受损的三角诈骗结构。",
          keywords: ["三角诈骗", "乙公司", "孙某", "100万元贷款", "处分财产"],
          sortOrder: 2,
        },
        {
          id: "q1_p3",
          title: "指出房产过户部分对李某构成诈骗罪",
          score: 1,
          description: "说明钱某隐瞒侵吞尾款意图，促使李某处分房产并受损。",
          keywords: ["李某", "房产过户", "隐瞒", "尾款", "处分房产"],
          sortOrder: 3,
        },
        {
          id: "q1_p4",
          title: "说明财产损失认定存在不同观点并展开回应",
          score: 2,
          description: "至少写出一罪论与数罪并罚/累计数额两种思路及其理由。",
          keywords: ["一罪论", "数罪并罚", "累计数额", "100万元", "200万元", "不同观点"],
          sortOrder: 4,
        },
      ],
      sortOrder: 1,
    },
    {
      id: "sub_2",
      title: "第2题：钱某出租银行卡的行为是否构成犯罪？若构成犯罪，构成何罪？钱某是否构成诈骗罪帮助犯，需答出不同观点。",
      placeholder: "请输入第2题答案",
      abilityLabel: "帮信罪与诈骗帮助犯争议",
      referenceAnswer:
        "钱某出租银行卡的行为构成帮助信息网络犯罪活动罪。因为钱某明知刘某利用信息网络实施诈骗，仍提供银行卡用于支付结算并收取租金，符合帮信罪的构成要件。关于是否同时构成诈骗罪帮助犯，存在不同观点：片面共同犯罪否定说认为，钱某与刘某之间缺乏通谋或者双向意思联络，仅单纯出租银行卡，不成立诈骗罪帮助犯；片面共同犯罪肯定说认为，成立片面共犯并不要求双向意思联络，钱某明知诈骗用途仍提供银行卡，客观上起到帮助作用，因此可以成立诈骗罪帮助犯。若采肯定说，可与帮信罪形成想象竞合，从一重罪处理；若采否定说，则仅成立帮助信息网络犯罪活动罪。",
      rubricGuidance:
        "答案应包括两部分：一是明确构成帮助信息网络犯罪活动罪并说明“明知诈骗仍出租银行卡”的理由；二是针对诈骗罪帮助犯分别交代片面共同犯罪否定说、肯定说。",
      rubricPoints: [
        {
          id: "q2_p1",
          title: "明确构成帮助信息网络犯罪活动罪",
          score: 2,
          description: "明确指出本行为成立帮信罪。",
          keywords: ["帮助信息网络犯罪活动罪", "帮信罪"],
          sortOrder: 1,
        },
        {
          id: "q2_p2",
          title: "说明其明知诈骗用途仍出租银行卡",
          score: 1,
          description: "写明钱某明知用于诈骗而提供银行卡并获利。",
          keywords: ["明知", "诈骗", "出租银行卡", "租金", "支付结算"],
          sortOrder: 2,
        },
        {
          id: "q2_p3",
          title: "写出片面共同犯罪否定说",
          score: 1,
          description: "说明因缺乏通谋或意思联络，不成立诈骗罪帮助犯。",
          keywords: ["片面共同犯罪否定说", "缺乏通谋", "意思联络", "不构成帮助犯"],
          sortOrder: 3,
        },
        {
          id: "q2_p4",
          title: "写出片面共同犯罪肯定说",
          score: 1,
          description: "说明无须双向意思联络亦可构成诈骗罪帮助犯。",
          keywords: ["片面共同犯罪肯定说", "无意思联络", "构成帮助犯", "诈骗罪帮助犯"],
          sortOrder: 4,
        },
      ],
      sortOrder: 2,
    },
    {
      id: "sub_3",
      title: "第3题：钱某企图取款未得逞的行为如何定性？请从存款债权占有观点（盗窃罪、侵占罪）、诈骗罪的实质审查与形式审查分歧及诈骗罪未遂认定角度分别展开分析。",
      placeholder: "请输入第3题答案",
      abilityLabel: "取款行为定性与未遂认定",
      referenceAnswer:
        "钱某企图取款未得逞的行为，应分别从两个对象分析。首先，对50万元存款债权，存在不同观点：规范标准说认为账户所有人钱某占有并所有存款债权，其挂失补卡行为不侵害他人权益，不构成犯罪；实质标准说认为真正控制账户并有正当权利的人即刘某占有该存款，钱某通过挂失排除他人控制并意图据为己有，构成盗窃罪；折中说认为账户名义人占有但不所有该债权，钱某将自己代为保管之财据为己有，构成侵占罪。其次，对银行50万元现金，若采实质审查说，银行工作人员需审查取款权来源，钱某无权取款却请求交付现金，足以使银行陷入错误认识，故可成立诈骗罪；若采形式审查说，银行仅形式审查账户与手续是否相符，不审查实体权利归属，因此不成立诈骗罪。若认为构成诈骗罪，未遂认定亦有分歧：具体危险说认为一般人难预见账户被冻结，行为具有得逞可能，应认定诈骗未遂；客观危险说认为账户已被冻结，客观上不可能取得现金，应认定为不可罚的不能犯。",
      rubricGuidance:
        "本题必须分别回答三个层面：一是存款债权占有的三说及对应结论；二是对银行现金的实质审查说与形式审查说；三是若成立诈骗罪时，对未遂与不能犯的分歧。",
      rubricPoints: [
        {
          id: "q3_p1",
          title: "写出存款债权占有观点的分歧结论",
          score: 1,
          description: "至少交代规范标准说无罪、实质标准说盗窃罪、折中说侵占罪。",
          keywords: ["规范标准说", "无罪", "实质标准说", "盗窃罪", "折中说", "侵占罪"],
          sortOrder: 1,
        },
        {
          id: "q3_p2",
          title: "写出诈骗罪审查分歧的结论",
          score: 1,
          description: "交代实质审查说可构成诈骗，形式审查说不构成诈骗。",
          keywords: ["实质审查说", "形式审查说", "构成诈骗", "不构成诈骗"],
          sortOrder: 2,
        },
        {
          id: "q3_p3",
          title: "说明存款债权占有观点各自理由",
          score: 1,
          description: "解释三种观点为什么分别得出无罪、盗窃、侵占的结论。",
          keywords: ["账户所有人", "共同占有", "真正支配", "代为保管", "据为己有"],
          sortOrder: 3,
        },
        {
          id: "q3_p4",
          title: "说明诈骗罪审查分歧的理由",
          score: 1,
          description: "解释银行是否负有实质审查取款权的职责。",
          keywords: ["银行实质审查", "银行仅形式审查", "取款权", "错误认识"],
          sortOrder: 4,
        },
        {
          id: "q3_p5",
          title: "写出未遂认定分歧",
          score: 1,
          description: "交代具体危险说诈骗未遂、客观危险说不能犯。",
          keywords: ["具体危险说", "诈骗未遂", "客观危险说", "不能犯", "账户冻结"],
          sortOrder: 5,
        },
      ],
      sortOrder: 3,
    },
  ],
};

const ensureFolder = async () => {
  const existing = await prisma.questionBankFolder.findFirst({
    where: {
      paperType: "subjective",
      name: folderName,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.questionBankFolder.create({
    data: {
      name: folderName,
      paperType: "subjective",
    },
  });
};

const ensureItem = async (folderId) => {
  const existing = await prisma.questionBankItem.findFirst({
    where: {
      folderId,
      stem: itemStem,
      material,
    },
  });

  const maxSort = await prisma.questionBankItem.findFirst({
    where: { folderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const data = {
    folderId,
    type: "subjective_case",
    stem: itemStem,
    material,
    analysis,
    score: 15,
    correctAnswerJson: JSON.stringify([]),
    questionMetaJson: JSON.stringify(questionMeta),
  };

  if (existing) {
    return prisma.questionBankItem.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.questionBankItem.create({
    data: {
      ...data,
      sortOrder: Number(maxSort?.sortOrder ?? 0) + 1,
    },
  });
};

const ensurePaper = async (item) => {
  const existing = await prisma.mockExamPaper.findFirst({
    where: {
      title: paperTitle,
    },
  });

  const maxSort = await prisma.mockExamPaper.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const paperData = {
    title: paperTitle,
    subtitle: "刑法主观题 AI 批改测试卷",
    paperType: "subjective",
    year: 2026,
    phase: "主观题",
    durationMinutes: 120,
    maxAttempts: 0,
    reviewEnabled: true,
    totalScore: 15,
    questionCount: 1,
    passScore: 9,
    description: "用于测试主观题逐小问 AI 批改、评分点命中、遗漏点评与结果页展示。",
    status: "published",
  };

  if (existing) {
    return prisma.mockExamPaper.update({
      where: { id: existing.id },
      data: {
        ...paperData,
        questions: {
          deleteMany: {},
          create: [
            {
              sourceBankItemId: item.id,
              type: "subjective_case",
              stem: item.stem,
              material: item.material,
              analysis: item.analysis,
              score: item.score,
              sortOrder: 1,
              correctAnswerJson: item.correctAnswerJson,
              questionMetaJson: item.questionMetaJson,
            },
          ],
        },
      },
    });
  }

  return prisma.mockExamPaper.create({
    data: {
      ...paperData,
      code: `tongguanbao_criminal_8_${Date.now().toString(36)}`,
      sortOrder: Number(maxSort?.sortOrder ?? 0) + 1,
      questions: {
        create: [
          {
            sourceBankItemId: item.id,
            type: "subjective_case",
            stem: item.stem,
            material: item.material,
            analysis: item.analysis,
            score: item.score,
            sortOrder: 1,
            correctAnswerJson: item.correctAnswerJson,
            questionMetaJson: item.questionMetaJson,
          },
        ],
      },
    },
  });
};

try {
  const folder = await ensureFolder();
  const item = await ensureItem(folder.id);
  const paper = await ensurePaper(item);

  console.log(
    JSON.stringify(
      {
        folderId: folder.id,
        folderName: folder.name,
        itemId: item.id,
        paperId: paper.id,
        paperTitle: paper.title,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
