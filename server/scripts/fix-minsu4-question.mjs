import "dotenv/config";
import { prisma } from "../lib/prisma.js";

const folderId = "cmotwb4o400000gci0x1c9ygr";
const existingItemId = "cmou6vury0000vocig95rjowz";

const payload = {
  stem: "2024年1月8日，孙某在登山途中见郑某（9岁）失足滑落悬崖，立即施救。救助过程中，孙某被第三方刘某驾驶的观光车碰撞，导致重伤不治身亡。孙某家属起诉郑某监护人冯某索赔丧葬费、精神损害抚慰金等45万元。冯某辩称刘某的观光车驾驶失误系直接原因，申请追加刘某为共同被告。孙某家属拒绝追加刘某。诉讼终结后，孙某家属对刘某另行提起诉讼。",
  material: "案情",
  analysis:
    "本题围绕无独立请求权第三人、共同被告追加、处分权主义以及一事不再理展开。作答时要区分补偿关系与侵权关系，抓住法律关系性质、诉讼标的、当事人是否相同等关键点。",
  score: 15,
  sectionLabel: "主观题",
  sectionDescription: "民事诉讼法案例分析",
  subjectiveSubQuestions: [
    {
      id: "sub_1",
      title: "第1题：若冯某申请追加刘某为无独立请求权第三人，法院能否根据冯某的申请追加？简要说明理由。",
      placeholder: "请在此输入答案。",
      abilityLabel: "无独立请求权第三人",
      referenceAnswer:
        "法院不能根据冯某的申请追加刘某为无独立请求权第三人。理由：无独立请求权第三人是指对原被告双方争议的诉讼标的没有独立的请求权，但案件处理结果与其有法律上的利害关系的人；本案中，孙某家属起诉郑某监护人冯某的法律关系是基于救助行为产生的补偿关系，而刘某与孙某之间是侵权法律关系。两个法律关系性质不同，诉讼标的不同。刘某作为直接侵权人，其责任认定不依附于冯某的责任，也即案件的处理结果与刘某没有法律上的利害关系，故法院不能依据冯某的申请追加其为无独立请求权第三人。",
      rubricGuidance: "必须明确结论为不能追加，并从法律关系性质、诉讼标的、法律上的利害关系三个角度展开。",
      rubricPoints: [
        {
          id: "p1",
          title: "不能追加",
          score: 1,
          description: "明确写出法院不能追加刘某为无独立请求权第三人。",
          keywords: ["不能追加", "不得追加"],
        },
        {
          id: "p2",
          title: "两种法律关系性质不同",
          score: 2,
          description: "指出补偿关系与侵权关系属于不同法律关系。",
          keywords: ["法律关系性质不同", "补偿关系", "侵权关系"],
        },
        {
          id: "p3",
          title: "诉讼标的不同",
          score: 1,
          description: "指出两诉的诉讼标的不同。",
          keywords: ["诉讼标的不同"],
        },
        {
          id: "p4",
          title: "无法律上的利害关系",
          score: 1,
          description: "指出案件处理结果与刘某无法律上的利害关系。",
          keywords: ["法律上的利害关系", "无利害关系"],
        },
      ],
    },
    {
      id: "sub_2",
      title: "第2题：如果经法院释明，孙某家属仍不同意追加刘某为共同被告，在诉讼终结后能否对刘某另行提起诉讼？简要说明理由。",
      placeholder: "请在此输入答案。",
      abilityLabel: "共同被告追加与处分权",
      referenceAnswer:
        "孙某家属在诉讼终结后能够对刘某另行提起诉讼。理由：（1）刘某作为直接侵权人，与孙某家属之间存在独立的侵权法律关系，孙某家属有权选择是否起诉刘某；（2）法院虽可通过释明建议原告追加共同被告，但不能强制原告追加，原告有诉讼处分权，可以选择起诉的被告；（3）孙某家属与冯某之间的诉讼是基于救助关系的补偿请求，与对刘某的侵权赔偿请求是两个独立的诉讼，当事人不同，诉讼标的不同，诉讼请求的基础也不同，可以对刘某另行起诉；（4）原告放弃在同一诉讼中追加被告，不意味着放弃了对该被告的实体权利，仍可另行起诉主张权利。",
      rubricGuidance:
        "核心是能另诉，理由要覆盖独立侵权关系、原告诉讼处分权、两个独立诉讼、未放弃实体权利。",
      rubricPoints: [
        {
          id: "p1",
          title: "能够另行起诉",
          score: 1,
          description: "明确写出可以另行起诉刘某。",
          keywords: ["能够另行起诉", "可以另行起诉"],
        },
        {
          id: "p2",
          title: "独立的侵权法律关系",
          score: 1,
          description: "指出刘某与孙某家属之间存在独立侵权法律关系。",
          keywords: ["独立的侵权法律关系", "侵权关系独立"],
        },
        {
          id: "p3",
          title: "原告诉讼处分权",
          score: 1,
          description: "指出法院不能强制追加，被告选择属于原告诉讼处分权。",
          keywords: ["诉讼处分权", "不能强制追加"],
        },
        {
          id: "p4",
          title: "两个独立诉讼",
          score: 1,
          description: "指出前后两诉当事人、标的、基础不同，属于两个独立诉讼。",
          keywords: ["两个独立诉讼", "当事人不同", "诉讼标的不同"],
        },
        {
          id: "p5",
          title: "未放弃实体权利",
          score: 1,
          description: "指出未在前诉追加不代表放弃对刘某的实体权利。",
          keywords: ["未放弃实体权利", "仍可主张权利"],
        },
      ],
    },
    {
      id: "sub_3",
      title: "第3题：对刘某的另行起诉是否违反一事不再理原则？简要说明理由。",
      placeholder: "请在此输入答案。",
      abilityLabel: "一事不再理",
      referenceAnswer:
        "对刘某的另行起诉不违反一事不再理原则。理由：一事不再理原则要求同一当事人就同一诉讼标的基于同一事实和理由不得重复起诉。本案中，孙某家属对冯某的诉讼与对刘某的诉讼在三个要素上均不相同。第一，当事人不同，前诉被告是冯某，后诉被告是刘某。第二，诉讼标的不同，对冯某的诉讼标的是基于救助行为产生的补偿关系，对刘某的诉讼标的为侵权关系，两者法律关系性质不同。第三，诉讼请求不同，前者基于见义勇为请求补偿，后者基于刘某的侵权行为请求赔偿。因此，不构成重复起诉，故刘某的另行起诉不违反一事不再理原则。",
      rubricGuidance:
        "必须先下结论不违反，再说明一事不再理判断要素，并逐一比较当事人、诉讼标的、诉讼请求。",
      rubricPoints: [
        {
          id: "p1",
          title: "不违反一事不再理",
          score: 1,
          description: "明确写出不违反一事不再理原则。",
          keywords: ["不违反", "不构成重复起诉"],
        },
        {
          id: "p2",
          title: "一事不再理原则要素",
          score: 1,
          description: "指出需判断同一当事人、同一诉讼标的、同一事实理由或请求基础。",
          keywords: ["一事不再理原则", "同一当事人", "同一诉讼标的"],
        },
        {
          id: "p3",
          title: "当事人不同",
          score: 1,
          description: "指出前诉被告是冯某，后诉被告是刘某。",
          keywords: ["当事人不同", "冯某", "刘某"],
        },
        {
          id: "p4",
          title: "诉讼标的不同",
          score: 1,
          description: "指出补偿关系与侵权关系不同。",
          keywords: ["诉讼标的不同", "补偿关系", "侵权关系"],
        },
        {
          id: "p5",
          title: "诉讼请求不同",
          score: 1,
          description: "指出前诉请求补偿，后诉请求侵权赔偿。",
          keywords: ["诉讼请求不同", "补偿", "赔偿"],
        },
      ],
    },
  ],
};

const buildQuestionMetaJson = () =>
  JSON.stringify({
    sectionLabel: payload.sectionLabel,
    sectionDescription: payload.sectionDescription,
    subQuestions: payload.subjectiveSubQuestions.map((item, index) => ({
      id: item.id,
      title: item.title,
      placeholder: item.placeholder,
      abilityLabel: item.abilityLabel,
      referenceAnswer: item.referenceAnswer,
      rubricGuidance: item.rubricGuidance,
      rubricPoints: item.rubricPoints.map((point, pointIndex) => ({
        id: point.id,
        title: point.title,
        score: point.score,
        description: point.description,
        keywords: point.keywords,
        sortOrder: pointIndex + 1,
      })),
      sortOrder: index + 1,
    })),
  });

try {
  const existing = await prisma.questionBankItem.findUnique({
    where: { id: existingItemId },
    select: { id: true, folderId: true },
  });

  if (existing) {
    const updated = await prisma.questionBankItem.update({
      where: { id: existingItemId },
      data: {
        folderId,
        type: "subjective_case",
        stem: payload.stem,
        material: payload.material,
        analysis: payload.analysis,
        score: payload.score,
        correctAnswerJson: JSON.stringify([]),
        questionMetaJson: buildQuestionMetaJson(),
      },
      select: {
        id: true,
        stem: true,
        score: true,
        questionMetaJson: true,
      },
    });

    const meta = JSON.parse(updated.questionMetaJson ?? "{}");
    console.log(
      JSON.stringify(
        {
          mode: "updated",
          id: updated.id,
          score: updated.score,
          stemPreview: updated.stem.slice(0, 60),
          subQuestionCount: Array.isArray(meta.subQuestions) ? meta.subQuestions.length : 0,
          firstSubQuestionTitle: meta?.subQuestions?.[0]?.title ?? "",
        },
        null,
        2,
      ),
    );
  } else {
    const maxSortItem = await prisma.questionBankItem.findFirst({
      where: { folderId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await prisma.questionBankItem.create({
      data: {
        folderId,
        type: "subjective_case",
        stem: payload.stem,
        material: payload.material,
        analysis: payload.analysis,
        score: payload.score,
        sortOrder: Number(maxSortItem?.sortOrder ?? 0) + 1,
        correctAnswerJson: JSON.stringify([]),
        questionMetaJson: buildQuestionMetaJson(),
      },
      select: {
        id: true,
        stem: true,
        score: true,
        questionMetaJson: true,
      },
    });

    const meta = JSON.parse(created.questionMetaJson ?? "{}");
    console.log(
      JSON.stringify(
        {
          mode: "created",
          id: created.id,
          score: created.score,
          stemPreview: created.stem.slice(0, 60),
          subQuestionCount: Array.isArray(meta.subQuestions) ? meta.subQuestions.length : 0,
          firstSubQuestionTitle: meta?.subQuestions?.[0]?.title ?? "",
        },
        null,
        2,
      ),
    );
  }
} finally {
  await prisma.$disconnect();
}
