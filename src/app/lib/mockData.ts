import {
  clearAdminSessionForMode,
  getAdminConsoleMode,
  getAdminConsoleModeFromPath,
  getAdminTokenForMode,
  isAdminConsolePath,
} from "./admin-session";
import { clearUserSession as clearPersistedUserSession, getUserToken } from "./user-session";

export type UserStatus = "active" | "disabled";
export type CourseStatus = "open" | "closed" | "scheduled";
export type AudioProcessStatus = "pending" | "processing" | "ready" | "failed";
export type AdminRole = "super_admin" | "operations_admin" | "user_admin" | "review_admin";

export interface User {
  id: string;
  phone: string;
  password: string;
  status: UserStatus;
  registeredAt: string;
  lastLogin: string;
  deviceCount: number;
  coursePermissions: string[];
  mockExamPermissions: string[];
  mockExamPermissionConfigs?: UserMockExamPermissionConfig[];
}

export interface UserMockExamPermissionConfig {
  paperId: string;
  manualAttemptLimit: number | null;
  manualAttemptUsed: number;
  currentRecordStartedAt: string;
}

export interface Course {
  id: string;
  name: string;
  cover: string;
  description: string;
  status: CourseStatus;
  openTime: string;
  audioCount: number;
  createdAt: string;
  sortOrder: number;
}

export interface Tag {
  id: string;
  courseId: string;
  name: string;
  order: number;
}

export interface Audio {
  id: string;
  name: string;
  folderId: string;
  duration: number;
  processStatus?: AudioProcessStatus;
  processMessage?: string;
  isReady?: boolean;
  hasScript: boolean;
  script?: string;
  handoutUrl?: string;
  handoutObjectKey?: string;
  handoutName?: string;
  hasHandout?: boolean;
  uploadedAt?: string;
  audioUrl?: string;
}

export interface UserProgress {
  userId: string;
  courseId: string;
  audioId: string;
  progress: number;
  completed: boolean;
  lastUpdated: string;
}

export interface Folder {
  id: string;
  name: string;
  audioCount: number;
}

export interface Device {
  id: string;
  userId: string;
  deviceKey: string;
  type: string;
  model: string;
  loginTime: string;
  ip: string;
}

export interface AdminAccount {
  id: string;
  account: string;
  name: string;
  role: AdminRole;
  createdAt: string;
  updatedAt: string;
}

export interface SystemConfig {
  webhookUrl: string;
  customerServiceUrl: string;
  brandLogoUrl: string;
  brandLogoObjectKey: string;
  playerDiscImageUrl: string;
  playerDiscImageObjectKey: string;
  portalConfig: PortalConfig;
  typingPracticeDifficultyConfigs?: TypingPracticeDifficultyConfig[];
  mockExamLaunchConfig?: MockExamLaunchConfig;
}

export type MockExamAiReviewProvider = "rules" | "openai-compatible";

export interface MockExamAiReviewConfig {
  provider: MockExamAiReviewProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface MockExamLaunchConfigTab {
  key: "notice" | "rules" | "guide";
  label: string;
  html: string;
}

export interface MockExamLaunchConfig {
  login: {
    ticketLabel: string;
    idCardLabel: string;
    loginButtonText: string;
    resetButtonText: string;
    fullscreenTip: string;
  };
  notice: {
    readSeconds: number;
    beginPromptDelayMs: number;
    beginPromptMessage: string;
    countdownPrefix: string;
    startButtonText: string;
    startingButtonText: string;
    agreementText: string;
    agreePromptMessage: string;
    examOverMessage: string;
    confirmButtonText: string;
    backButtonText: string;
    candidateNameLabel: string;
    candidateGenderLabel: string;
    ticketLabel: string;
    idCardLabel: string;
    defaultCandidateName: string;
    defaultCandidateGender: string;
    avatarUrl: string;
    avatarObjectKey: string;
  };
  tabs: MockExamLaunchConfigTab[];
}

export interface PortalFeatureConfig {
  key: string;
  title: string;
  eyebrow: string;
  description: string;
  detail: string;
  action: string;
  tags: string[];
}

export interface PortalNavLink {
  label: string;
  href: string;
}

export interface PortalJourneyCard {
  step: string;
  title: string;
  description: string;
}

export interface PortalValueCard {
  title: string;
  description: string;
}

export interface PortalMemberHomeAnnouncementItem {
  title: string;
  description: string;
}

export interface PortalMemberHomeHeroConfig {
  badge: string;
  title: string;
  description: string;
}

export interface PortalMemberHomeOperationItem {
  eyebrow: string;
  title: string;
  description: string;
  path: string;
}

export interface PortalMemberHomeConfig {
  hero: PortalMemberHomeHeroConfig;
  bannerImageUrl: string;
  bannerImageObjectKey: string;
  announcement: {
    title: string;
    subtitle: string;
    badge: string;
    items: PortalMemberHomeAnnouncementItem[];
  };
  operations: {
    title: string;
    subtitle: string;
    items: PortalMemberHomeOperationItem[];
  };
}

export interface PortalExamHomeConfig {
  eyebrow: string;
  title: string;
  objectiveModeLabel: string;
  subjectiveModeLabel: string;
  objectiveEmptyText: string;
  subjectiveEmptyText: string;
}

export interface PortalAccountShortcutItem {
  title: string;
  description: string;
  path: string;
  accentText: string;
}

export interface PortalAccountCenterConfig {
  eyebrow: string;
  description: string;
  shortcutTitle: string;
  shortcuts: PortalAccountShortcutItem[];
}

export interface PortalStartOption {
  title: string;
  description: string;
  path: string;
}

export interface PortalLegalDocument {
  title: string;
  slug: string;
  content: string[];
}

export interface PortalContactStep {
  step: string;
  title: string;
  detail: string;
}

export interface PortalConfig {
  seo: {
    title: string;
    description: string;
    keywords: string;
    ogImageUrl: string;
    ogImageObjectKey: string;
  };
  actions: {
    authLoggedInLabel: string;
    authLoggedOutLabel: string;
    authLoggedInShortLabel: string;
    browseModulesLabel: string;
    consultNowLabel: string;
    footerBrowseLabel: string;
  };
  navigation: {
    links: PortalNavLink[];
    quickEntryLabel: string;
    footerNavTitle: string;
    footerFeatureTitle: string;
  };
  hero: {
    badge: string;
    title: string;
    highlight: string;
    description: string;
    quickTags: string[];
  };
  products: {
    title: string;
  };
  memberHome: PortalMemberHomeConfig;
  examHome: PortalExamHomeConfig;
  accountCenter: PortalAccountCenterConfig;
  journey: {
    eyebrow: string;
    title: string;
    cards: PortalJourneyCard[];
  };
  experience: {
    badge: string;
    title: string;
    cards: PortalValueCard[];
  };
  startPanel: {
    eyebrow: string;
    loggedInTitle: string;
    loggedOutTitle: string;
    description: string;
  };
  startOptions: {
    eyebrow: string;
    items: PortalStartOption[];
  };
  founder: {
    imageUrl: string;
    imageObjectKey: string;
    sectionBadge: string;
    perspectiveLabel: string;
    name: string;
    role: string;
    intro: string;
    statement: string;
    methodLabel: string;
    perspective: string;
    tags: string[];
  };
  footer: {
    description: string;
    copyright: string;
    legalDocuments: PortalLegalDocument[];
  };
  contact: {
    badge: string;
    title: string;
    description: string;
    buttonLabel: string;
    buttonHint: string;
    phone: string;
    wechat: string;
    url?: string;
    steps: PortalContactStep[];
  };
  features: PortalFeatureConfig[];
}

export interface LogSummary {
  auditTotal: number;
  auditToday: number;
  webhookSuccess: number;
  webhookFailed: number;
  webhookSkipped: number;
}

export interface AuditLogItem {
  id: string;
  operatorName: string;
  operatorAccount: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  detail: string;
  createdAt: string;
}

export type WebhookLogStatus = "success" | "failed" | "skipped";

export interface WebhookLogItem {
  id: string;
  scene: string;
  status: WebhookLogStatus;
  title: string;
  webhookUrl: string;
  messagePreview: string;
  responseCode: number | null;
  errorMessage: string;
  relatedEntityType: string;
  relatedEntityId: string;
  createdAt: string;
}

export interface BrandingConfig {
  brandLogoUrl: string;
  customerServiceUrl: string;
  playerDiscImageUrl: string;
  portalConfig: PortalConfig;
}

export interface UserHomeConfig {
  memberHome: PortalMemberHomeConfig;
  examHome: PortalExamHomeConfig;
  accountCenter: PortalAccountCenterConfig;
}

export interface UserHomeOverviewRecentCourse {
  courseId: string;
  courseName: string;
  audioId: string;
  audioName: string;
  tagName: string;
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  completed: boolean;
  lastUpdated: string;
}

export interface UserHomeOverviewRecentMockExam {
  paperId: string;
  paperTitle: string;
  paperSubtitle: string;
  recordId: string;
  status: MockExamRecordStatus;
  totalScore: number;
  answeredCount: number;
  questionCount: number;
  canResume: boolean;
  startedAt: string;
  submittedAt: string;
}

export interface UserHomeOverview {
  recentCourseProgress: UserHomeOverviewRecentCourse | null;
  recentMockExam: UserHomeOverviewRecentMockExam | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CourseDetailPayload {
  course: Course;
  tags: Tag[];
  selectedTagId?: string;
  tagContents?: TagContentPayload[];
  initialAudios?: Audio[];
  initialProgress?: UserProgress[];
}

export interface TagAudiosPayload {
  audios: Audio[];
  progress: UserProgress[];
}

export interface TagContentPayload extends TagAudiosPayload {
  tagId: string;
}

export interface UserSummary {
  total: number;
  active: number;
  disabled: number;
  fullDevices: number;
}

export interface AudioLibraryTagOption {
  id: string;
  name: string;
}

export interface AudioLibraryMeta {
  totalAudioCount: number;
  referencedCount: number;
  pendingScriptCount: number;
  tagOptions: AudioLibraryTagOption[];
}

export interface AudioLibraryItem extends Audio {
  folderName: string;
  courseRefs: { courseId: string; courseName: string; tagId: string; tagName: string }[];
}

export type QuestionBankPaperType = "objective" | "subjective";

export interface QuestionBankSummary {
  totalFolders: number;
  totalQuestions: number;
  objectiveQuestions: number;
  subjectiveQuestions: number;
}

export interface QuestionBankFolder {
  id: string;
  name: string;
  paperType: QuestionBankPaperType;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBankOption {
  id?: string;
  key: string;
  content: string;
}

export interface MockExamRubricPoint {
  id?: string;
  title: string;
  score: number;
  description?: string;
  keywords?: string[];
  hit?: boolean;
  awardedScore?: number;
  matchedText?: string;
}

export interface MockExamMissedPoint {
  id?: string;
  title: string;
  description?: string;
  score?: number;
}

export interface QuestionBankSubQuestion {
  id?: string;
  title: string;
  placeholder: string;
  abilityLabel?: string;
  referenceAnswer?: string;
  rubricGuidance?: string;
  rubricPoints?: MockExamRubricPoint[];
}

export interface QuestionBankItem {
  id: string;
  folderId: string;
  folderName: string;
  paperType: QuestionBankPaperType;
  questionType: MockExamQuestionType;
  questionTypeLabel: string;
  stem: string;
  material: string;
  analysis: string;
  score: number;
  sortOrder: number;
  correctAnswerKeys: string[];
  options: QuestionBankOption[];
  sectionLabel: string;
  sectionDescription: string;
  subjectiveSubQuestions: QuestionBankSubQuestion[];
  lessonAudioUrl?: string;
  lessonAudioObjectKey?: string;
  lessonAudioDurationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBankItemPayload {
  folderId: string;
  questionType: MockExamQuestionType;
  stem: string;
  material?: string;
  analysis?: string;
  score: number;
  correctAnswerKeys?: string[];
  options?: QuestionBankOption[];
  sectionLabel?: string;
  sectionDescription?: string;
  subjectiveSubQuestions?: QuestionBankSubQuestion[];
  lessonAudioUrl?: string;
  lessonAudioObjectKey?: string;
  lessonAudioDurationSeconds?: number;
}

export type LawNodeType = "folder" | "record";

export interface LawTreeNode {
  id: string;
  title: string;
  nodeType: LawNodeType;
  pathLabels: string[];
  recordId?: string;
  recordCount: number;
  children?: LawTreeNode[];
}

export interface LawRecordMeta {
  id: string;
  sourceLawId: number;
  topCategoryId: number;
  topCategoryTitle: string;
  bookTitle: string;
  title: string;
  displayTitle: string;
  customTitle: string;
  pathLabels: string[];
  pathString: string;
  isPublished: boolean;
  isPinned: boolean;
  manualSortOrder: number;
  tags: string[];
  operatorNote: string;
  updatedAt: string;
}

export interface LawContentItem extends LawRecordMeta {
  content: string;
}

export interface LawSearchResult extends LawRecordMeta {
  snippet: string;
}

export interface LawOverviewPayload {
  tree: LawTreeNode[];
  totalRecords: number;
  topCategoryCount: number;
  lastUpdated: string;
  initialNodeId: string;
}

export interface LawNodeContentPayload {
  nodeId: string;
  nodeType: LawNodeType;
  nodeTitle: string;
  pathLabels: string[];
  items: LawContentItem[];
  total: number;
}

export interface LawAdminCategoryOption {
  id: number;
  title: string;
}

export interface LawAdminSummary {
  totalRecords: number;
  publishedRecords: number;
  hiddenRecords: number;
  pinnedRecords: number;
  topCategoryCount: number;
  lastUpdated: string;
  topCategories: LawAdminCategoryOption[];
}

export interface LawAdminEntryUpdatePayload {
  isPublished?: boolean;
  isPinned?: boolean;
  manualSortOrder?: number | string;
  customTitle?: string;
  tags?: string[] | string;
  operatorNote?: string;
}

export type MockExamQuestionType = "single_choice" | "multiple_choice" | "uncertain_choice" | "subjective_case";
export type MockExamRecordStatus = "in_progress" | "submitted";
export type MockExamQuestionAnswerState = "unanswered" | "partial" | "answered";
export type MockExamReviewWorkflowStatus = "not_required" | "ai_pending" | "ai_processing" | "manual_pending" | "published";

export interface MockExamSection {
  type: MockExamQuestionType;
  label: string;
  count: number;
  totalScore: number;
}

export interface MockExamRecordSummary {
  id: string;
  status: MockExamRecordStatus;
  attemptNo: number;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  totalScore: number;
  allottedSeconds: number;
  consumedSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  submittedAt: string;
  reviewedAt: string;
  reviewWorkflowStatus: MockExamReviewWorkflowStatus;
  canResume: boolean;
}

export interface MockExamPaper {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  coverObjectKey: string;
  year: number;
  phase: string;
  durationMinutes: number;
  maxAttempts: number;
  reviewEnabled: boolean;
  permissionRequired: boolean;
  totalScore: number;
  questionCount: number;
  passScore: number;
  description: string;
  sections: MockExamSection[];
  activeRecord: MockExamRecordSummary | null;
  latestRecord: MockExamRecordSummary | null;
}

export interface MockExamQuestionOption {
  id: string;
  key: string;
  content: string;
}

export interface MockExamSubjectiveSubQuestion {
  id: string;
  title: string;
  placeholder: string;
  answer: string;
  wordCount: number;
  maxScore?: number;
  score?: number;
  reviewComment?: string;
  referenceAnswer?: string;
  reviewSource?: "ai" | "rule" | "manual" | "system";
  reviewProvider?: MockExamAiReviewProvider;
  isReviewed?: boolean;
  abilityLabel?: string;
  abilityScoreRate?: number;
  answerMarks?: MockExamSubjectiveAnswerMark[];
  rubricGuidance?: string;
  rubricPoints?: MockExamRubricPoint[];
  missedPoints?: MockExamMissedPoint[];
  skippedReview?: boolean;
  skippedReviewReason?: string;
}

export interface MockExamSubjectiveAnswerMark {
  id: string;
  highlight: string;
  comment: string;
  status?: "correct" | "wrong" | "score" | "neutral";
  score?: number;
  start?: number;
  end?: number;
}

export interface MockExamQuestion {
  id: string;
  sortOrder: number;
  type: MockExamQuestionType;
  typeLabel: string;
  score: number;
  material: string;
  stem: string;
  analysis: string;
  options: MockExamQuestionOption[];
  userAnswerKeys: string[];
  correctAnswerKeys: string[];
  isCorrect: boolean | null;
  earnedScore: number;
  answerState: MockExamQuestionAnswerState;
  sectionLabel: string;
  sectionDescription: string;
  subjectiveSubQuestions: MockExamSubjectiveSubQuestion[];
  reviewSource?: "ai" | "rule" | "manual" | "system";
  reviewProvider?: MockExamAiReviewProvider;
  reviewFeedbackStars?: number;
  reviewFeedbackSubmittedAt?: string;
  lessonAudioUrl?: string;
  lessonAudioObjectKey?: string;
  lessonAudioDurationSeconds?: number;
  reviewVoiceUrl?: string;
  reviewVoiceObjectKey?: string;
  reviewVoiceDurationSeconds?: number;
}

export interface MockExamRecordDetail {
  id: string;
  status: MockExamRecordStatus;
  attemptNo: number;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  totalScore: number;
  allottedSeconds: number;
  consumedSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  submittedAt: string;
  reviewedAt: string;
  publishedAt: string;
  reviewWorkflowStatus: MockExamReviewWorkflowStatus;
  paper: Omit<MockExamPaper, "activeRecord" | "latestRecord">;
  summary: {
    accuracyRate: number;
    wrongCount: number;
    unfinishedCount: number;
    pendingReviewCount: number;
    finalScorePending: boolean;
    isPassed: boolean | null;
  };
  questions: MockExamQuestion[];
  reviewEnabled: boolean;
}

export interface UserMockExamHistoryItem {
  id: string;
  status: MockExamRecordStatus;
  attemptNo: number;
  totalScore: number;
  questionCount: number;
  subjectiveQuestionCount: number;
  reviewStatus: "published" | "ai_pending" | "ai_processing" | "manual_pending";
  reviewEnabled: boolean;
  submittedAt: string;
  reviewedAt: string;
  publishedAt: string;
  paper: {
    id: string;
    code: string;
    title: string;
    coverUrl: string;
    coverObjectKey: string;
    phase: string;
    year: number;
    totalScore: number;
    passScore: number;
  };
}

export type AdminMockExamPaperType = "objective" | "subjective";
export type AdminMockExamPaperStatus = "draft" | "published";
export type AdminMockExamReviewStatus = "ai_pending" | "ai_processing" | "manual_reviewing" | "manual_pending" | "published";

export interface AdminMockExamManualReviewLock {
  active: boolean;
  ownedByCurrentAdmin: boolean;
  reviewerId: string;
  reviewerName: string;
  lockToken: string;
  claimedAt: string;
  expiresAt: string;
  version: number;
}

export interface AdminMockExamPaperSummary {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  coverObjectKey: string;
  year: number;
  phase: string;
  paperType: AdminMockExamPaperType;
  status: AdminMockExamPaperStatus;
  durationMinutes: number;
  maxAttempts: number;
  reviewEnabled: boolean;
  permissionRequired: boolean;
  totalScore: number;
  questionCount: number;
  passScore: number;
  sortOrder: number;
  sections: MockExamSection[];
  canDelete?: boolean;
  updatedAt: string;
}

export interface MockExamPermissionOption {
  id: string;
  title: string;
  subtitle: string;
  paperType: AdminMockExamPaperType;
  paperTypeLabel: string;
  year: number;
  phase: string;
  status: AdminMockExamPaperStatus;
  reviewEnabled: boolean;
  maxAttempts?: number;
}

export interface AdminMockExamPaperListPayload {
  list: AdminMockExamPaperSummary[];
  summary: {
    total: number;
    published: number;
    draft: number;
    objective: number;
    subjective: number;
  };
}

export interface AdminMockExamPaperQuestion {
  id: string;
  sourceBankItemId: string;
  sourceFolderName: string;
  sortOrder: number;
  questionType: MockExamQuestionType;
  questionTypeLabel: string;
  score: number;
  stem: string;
  material: string;
  analysis: string;
  correctAnswerKeys: string[];
  options: QuestionBankOption[];
  sectionLabel: string;
  sectionDescription: string;
  subjectiveSubQuestions: Array<QuestionBankSubQuestion & { sortOrder?: number }>;
  updatedAt: string;
}

export interface AdminMockExamPaperDetail extends AdminMockExamPaperSummary {
  description: string;
  createdAt: string;
  questions: AdminMockExamPaperQuestion[];
}

export interface AdminMockExamPaperPayload {
  title: string;
  subtitle?: string;
  coverUrl?: string;
  coverObjectKey?: string;
  year?: number | string;
  phase?: string;
  paperType?: AdminMockExamPaperType;
  durationMinutes?: number | string;
  maxAttempts?: number | string;
  reviewEnabled?: boolean;
  permissionRequired?: boolean;
  passScore?: number | string;
  description?: string;
  status?: AdminMockExamPaperStatus;
  sortOrder?: number | string;
  code?: string;
}

export interface AdminMockExamReviewSummary {
  id: string;
  attemptNo: number;
  totalScore: number;
  questionCount: number;
  subjectiveQuestionCount: number;
  submittedAt: string;
  reviewedAt: string;
  publishedAt: string;
  reviewStatus: AdminMockExamReviewStatus;
  manualReviewLock: AdminMockExamManualReviewLock;
  user: {
    id: string;
    phone: string;
  };
  paper: {
    id: string;
    code: string;
    title: string;
    coverUrl: string;
    coverObjectKey: string;
    phase: string;
    year: number;
    totalScore: number;
    passScore: number;
  };
}

export interface AdminMockExamReviewListPayload {
  list: AdminMockExamReviewSummary[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  summary: {
    total: number;
    aiPending: number;
    aiProcessing: number;
    manualReviewing: number;
    manualPending: number;
    published: number;
  };
}

export interface AdminMockExamReviewPaperSummary extends AdminMockExamPaperSummary {
  reviewSummary: {
    total: number;
    aiPending: number;
    aiProcessing: number;
    manualReviewing: number;
    manualPending: number;
    published: number;
  };
}

export interface AdminMockExamReviewPaperListPayload {
  list: AdminMockExamReviewPaperSummary[];
  summary: {
    totalPapers: number;
    totalRecords: number;
    aiPending: number;
    aiProcessing: number;
    manualReviewing: number;
    manualPending: number;
    published: number;
  };
}

export interface AdminMockExamReviewDetail extends MockExamRecordDetail {
  reviewStatus: AdminMockExamReviewStatus;
  manualReviewLock: AdminMockExamManualReviewLock;
  user: {
    id: string;
    phone: string;
  };
  scoring: {
    objectiveScore: number;
    subjectiveScore: number;
    subjectiveQuestionCount: number;
  };
  reviewSource?: "ai" | "rule" | "manual" | "system";
  reviewProvider?: MockExamAiReviewProvider;
}

export interface AdminMockExamReviewSubQuestionScoreInput {
  subQuestionId: string;
  score: number;
  reviewComment?: string;
  referenceAnswer?: string;
  abilityLabel?: string;
  rubricGuidance?: string;
  rubricPoints?: MockExamRubricPoint[];
  missedPoints?: MockExamMissedPoint[];
  answerMarks?: MockExamSubjectiveAnswerMark[];
}

export interface AdminMockExamReviewQuestionScoreInput {
  questionId: string;
  score?: number;
  subQuestions?: AdminMockExamReviewSubQuestionScoreInput[];
  reviewVoiceUrl?: string;
  reviewVoiceObjectKey?: string;
  reviewVoiceDurationSeconds?: number;
}

export type TypingPracticeTextStatus = "draft" | "published";
export type TypingPracticeDifficulty = "easy" | "medium" | "hard";
export type TypingPracticeMode = "guided" | "sprint" | "memorize";

export interface TypingPracticeDifficultyConfig {
  difficulty: TypingPracticeDifficulty;
  label: string;
  initialLives: number;
  baseStageTimeSeconds: number;
  extraTimePer20Chars: number;
  minStageTimeSeconds: number;
  levelTimeReductionSeconds: number;
  thiefSpeedBase: number;
  thiefSpeedStepLevels: number;
  scorePerChar: number;
  errorPenalty: number;
  captureBonus: number;
  lifeBonus: number;
  memorizePreviewSeconds: number;
}

export interface TypingPracticeSummary {
  totalFolders: number;
  totalTexts: number;
  publishedTexts: number;
  draftTexts: number;
  totalRecords: number;
}

export interface TypingPracticeFolder {
  id: string;
  name: string;
  sortOrder: number;
  textCount: number;
  publishedTextCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TypingPracticeText {
  id: string;
  folderId: string;
  folderName: string;
  title: string;
  difficulty: TypingPracticeDifficulty;
  difficultyLabel: string;
  source: string;
  tags: string[];
  content: string;
  note: string;
  status: TypingPracticeTextStatus;
  statusLabel: string;
  sortOrder: number;
  contentLength: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
  difficultyConfig?: TypingPracticeDifficultyConfig;
  playTicket?: string;
}

export interface TypingPracticeTextPayload {
  folderId: string;
  title: string;
  difficulty?: TypingPracticeDifficulty;
  source?: string;
  tags?: string[] | string;
  content: string;
  note?: string;
  status: TypingPracticeTextStatus;
  sortOrder?: number | string;
}

export interface TypingPracticeTextListPayload {
  items: TypingPracticeText[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TypingPracticeRecord {
  id: string;
  textId: string;
  mode: TypingPracticeMode;
  modeLabel: string;
  difficulty: TypingPracticeDifficulty;
  difficultyLabel: string;
  title: string;
  source: string;
  targetLength: number;
  typedLength: number;
  correctLength: number;
  errorCount: number;
  backspaceCount: number;
  comboMax: number;
  accuracyRate: number;
  completionRate: number;
  cpm: number;
  score: number;
  durationSeconds: number;
  timeLimitSeconds: number | null;
  previewSeconds: number | null;
  createdAt: string;
  completedAt: string;
  targetPreview: string;
  typedPreview: string;
  contentSnapshot: string;
  typedContent: string;
}

export interface TypingPracticeRecordListPayload {
  items: TypingPracticeRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TypingPracticeLeaderboardEntry {
  rank: number;
  userId: string;
  userLabel: string;
  bestScore: number;
  bestCpm: number;
  practiceCount: number;
  avgAccuracyRate: number;
  lastCompletedAt: string;
}

export interface TypingPracticeHomeRuleParagraph {
  text: string;
}

export interface TypingPracticeHomeRuleCard {
  title: string;
  description: string;
}

export interface TypingPracticeHomeConfig {
  hero: {
    title: string;
    englishTitle: string;
    description: string;
    topNotice: string;
    policeImageUrl: string;
    policeImageObjectKey: string;
    thiefImageUrl: string;
    thiefImageObjectKey: string;
  };
  modeHints: {
    guided: string;
    sprint: string;
    memorize: string;
  };
  rules: {
    paragraphs: TypingPracticeHomeRuleParagraph[];
    cards: TypingPracticeHomeRuleCard[];
  };
}

export interface TypingPracticeHomePayload {
  homeConfig: TypingPracticeHomeConfig;
  summary: {
    totalFolders: number;
    totalTexts: number;
    practiceCount: number;
    avgAccuracyRate: number;
    avgCpm: number;
    bestCpm: number;
    bestScore: number;
    totalTypedLength: number;
  };
  folders: TypingPracticeFolder[];
  texts: TypingPracticeText[];
  recentRecords: TypingPracticeRecord[];
}

export interface TypingPracticeRecordPayload {
  textId?: string;
  mode: TypingPracticeMode;
  difficulty: TypingPracticeDifficulty;
  title: string;
  sourceSnapshot?: string;
  contentSnapshot: string;
  typedContent: string;
  playTicket?: string;
  errorCount: number;
  backspaceCount: number;
  comboMax: number;
  capturedStageCount?: number;
  livesRemaining?: number;
  durationSeconds: number;
  timeLimitSeconds?: number;
  previewSeconds?: number;
}

export type ShopProductType = "virtual" | "physical" | "hybrid";
export type ShopProductStatus = "draft" | "on_sale" | "off_sale";
export type ShopOrderStatus = "pending_payment" | "paid" | "partially_fulfilled" | "completed" | "cancelled" | "refunding" | "refunded";
export type ShopPaymentStatus = "unpaid" | "paid" | "failed" | "refunded";
export type ShopShipmentStatus = "pending" | "shipped" | "in_transit" | "signed" | "failed";
export type ShopRefundStatus = "pending" | "approved" | "rejected" | "completed" | "failed";
export type ShopPaymentChannel = "wechat_jsapi" | "wechat_h5" | "alipay_wap";
export type ShopBannerLinkType = "product" | "category" | "custom";

export interface ShopBanner {
  id: string;
  title: string;
  imageUrl: string;
  imageSourceUrl?: string;
  imageObjectKey: string;
  linkType: ShopBannerLinkType;
  linkTarget: string;
  sortOrder: number;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopConfig {
  shopNotice: string;
  customerServiceUrl: string;
  featuredProductIds: string[];
  featuredCategoryIds: string[];
  paymentGuide: string;
  enableWechatH5: boolean;
  enableWechatJsapi: boolean;
  enableAlipayWap: boolean;
  runtimePaymentMode: string;
  paymentRuntime: {
    mode: string;
    siteBaseUrl: string;
    notifyBaseUrl: string;
    baseReady: boolean;
    baseMissing: string[];
    refundSupported: boolean;
    refundNotice: string;
    channels: {
      wechatH5: {
        enabled: boolean;
        ready: boolean;
        missing: string[];
        note: string;
      };
      wechatJsapi: {
        enabled: boolean;
        ready: boolean;
        missing: string[];
        note: string;
      };
      alipayWap: {
        enabled: boolean;
        ready: boolean;
        missing: string[];
        note: string;
      };
    };
  };
  banners: ShopBanner[];
}

export interface AdminShopConfigPayload {
  shopNotice: string;
  customerServiceUrl: string;
  featuredProductIds: string[];
  featuredCategoryIds: string[];
  paymentGuide: string;
  enableWechatH5: boolean;
  enableWechatJsapi: boolean;
  enableAlipayWap: boolean;
  banners: {
    title: string;
    imageUrl: string;
    imageObjectKey: string;
    linkType: ShopBannerLinkType;
    linkTarget: string;
    sortOrder: number;
    status: boolean;
  }[];
}

export interface ShopCategory {
  id: string;
  name: string;
  sortOrder: number;
  status: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopProduct {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  subtitle: string;
  coverUrl: string;
  type: ShopProductType;
  status: ShopProductStatus;
  minPrice: string;
  maxPrice: string;
  originalPrice: string;
  defaultSkuId: string;
  requiresShipping: boolean;
  salesCount: number;
  sortOrder: number;
  skuCount: number;
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ShopSku {
  id: string;
  productId: string;
  name: string;
  price: string;
  originalPrice: string;
  stock: number;
  weight: number;
  isDefault: boolean;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopBoundCourse {
  id: string;
  name: string;
  coverUrl: string;
  description: string;
  status: CourseStatus | "";
  openTime: string;
}

export interface ShopProductDetail extends ShopProduct {
  description: string;
  detailContent: string;
  images: ShopProductImage[];
  detailImages: ShopProductImage[];
  skus: ShopSku[];
  boundCourses: ShopBoundCourse[];
}

export interface AdminShopProduct extends ShopProduct {
  coverPreviewUrl?: string;
  isDeleted: boolean;
}

export interface AdminShopProductImage extends ShopProductImage {
  imageObjectKey: string;
  imagePreviewUrl?: string;
}

export interface AdminShopSkuInput {
  id?: string;
  name: string;
  price: string;
  originalPrice: string;
  stock: number;
  weight: number;
  isDefault: boolean;
  status: boolean;
  sortOrder: number;
}

export interface AdminShopProductImageInput {
  id?: string;
  imageUrl: string;
  imageObjectKey: string;
  sortOrder: number;
}

export interface AdminShopProductDetail extends AdminShopProduct {
  coverObjectKey: string;
  description: string;
  detailContent: string;
  images: AdminShopProductImage[];
  detailImages: AdminShopProductImage[];
  skus: ShopSku[];
  courseIds: string[];
  boundCourses: ShopBoundCourse[];
}

export interface AdminShopProductPayload {
  categoryId: string;
  name: string;
  subtitle: string;
  coverUrl: string;
  coverObjectKey?: string;
  type: ShopProductType;
  status: ShopProductStatus;
  description: string;
  detailContent: string;
  sortOrder: number;
  courseIds: string[];
  images: AdminShopProductImageInput[];
  detailImages: AdminShopProductImageInput[];
  skus: AdminShopSkuInput[];
}

export interface ShopCartItem {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productType: ShopProductType;
  coverUrl: string;
  skuId: string;
  skuName: string;
  price: string;
  originalPrice: string;
  quantity: number;
  stock: number;
  subtotal: string;
  requiresShipping: boolean;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopCartPayload {
  items: ShopCartItem[];
  summary: {
    itemCount: number;
    amount: string;
    availableCount: number;
  };
}

export interface ShopAddress {
  id: string;
  userId: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopCheckoutPreviewItem {
  productId: string;
  productName: string;
  productType: ShopProductType;
  coverUrl: string;
  skuId: string;
  skuName: string;
  quantity: number;
  price: string;
  originalPrice: string;
  subtotal: string;
  requiresShipping: boolean;
  courseIds: string[];
}

export interface ShopCheckoutPreview {
  items: ShopCheckoutPreviewItem[];
  productAmount: string;
  freightAmount: string;
  discountAmount: string;
  payAmount: string;
  requiresShipping: boolean;
  address: ShopAddress | null;
  warnings: string[];
}

export interface ShopOrderItem {
  id: string;
  orderId: string;
  productId: string;
  skuId: string;
  productName: string;
  productType: ShopProductType;
  coverUrl: string;
  price: string;
  originalPrice: string;
  quantity: number;
  requiresShipping: boolean;
  courseIds: string[];
  createdAt: string;
}

export interface ShopShipmentTrack {
  id: string;
  shipmentId: string;
  content: string;
  location: string;
  trackTime: string;
  createdAt: string;
}

export interface ShopShipmentItem {
  id: string;
  shipmentId: string;
  orderItemId: string;
  quantity: number;
  productName: string;
  productType: ShopProductType | "";
  requiresShipping: boolean;
}

export interface ShopShipment {
  id: string;
  orderId: string;
  orderNo: string;
  userId: string;
  userPhone: string;
  status: ShopShipmentStatus;
  company: string;
  trackingNo: string;
  shippedAt: string;
  signedAt: string;
  createdAt: string;
  updatedAt: string;
  items: ShopShipmentItem[];
  latestTrack: ShopShipmentTrack | null;
  tracks: ShopShipmentTrack[];
}

export interface ShopPaymentRecord {
  id: string;
  orderId: string;
  channel: ShopPaymentChannel | string;
  status: ShopPaymentStatus;
  transactionNo: string;
  payAmount: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopDigitalFulfillment {
  id: string;
  orderId: string;
  orderItemId: string;
  userId: string;
  status: "pending" | "success" | "failed";
  grantType: string;
  grantPayload: string;
  grantedAt: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopRefundRecord {
  id: string;
  orderId: string;
  orderItemId: string;
  status: ShopRefundStatus;
  refundAmount: string;
  reason: string;
  resultMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrder {
  id: string;
  orderNo: string;
  userId: string;
  userPhone: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  hasPendingShipmentItems: boolean;
  shipmentStatus: ShopShipmentStatus;
  digitalFulfillmentStatus: string;
  totalAmount: string;
  payAmount: string;
  freightAmount: string;
  payExpireAt: string;
  remark: string;
  receiverName: string;
  receiverPhone: string;
  receiverProvince: string;
  receiverCity: string;
  receiverDistrict: string;
  receiverAddress: string;
  paidAt: string;
  cancelledAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: ShopOrderItem[];
}

export interface ShopOrderDetail extends ShopOrder {
  payments: ShopPaymentRecord[];
  digitalFulfillments: ShopDigitalFulfillment[];
  shipments: ShopShipment[];
  refunds: ShopRefundRecord[];
}

export interface ShopLogistics {
  orderId: string;
  orderNo: string;
  orderStatus: ShopOrderStatus;
  shipmentId: string;
  company: string;
  trackingNo: string;
  status: ShopShipmentStatus;
  tracks: ShopShipmentTrack[];
  shipments: ShopShipment[];
}

export interface ShopHomePayload {
  banners: ShopBanner[];
  shopNotice: string;
  customerServiceUrl: string;
  paymentGuide: string;
  enableWechatH5: boolean;
  enableWechatJsapi: boolean;
  enableAlipayWap: boolean;
  featuredCategories: ShopCategory[];
  featuredProducts: ShopProduct[];
  courseProducts: ShopProduct[];
  physicalProducts: ShopProduct[];
  hybridProducts: ShopProduct[];
}

export interface UserShopOrderSummary {
  total: number;
  pendingPayment: number;
  pendingShipment: number;
  pendingReceipt: number;
}

export interface AdminShopProductListSummary {
  total: number;
  onSale: number;
  draft: number;
  offSale: number;
}

export interface AdminShopOrderListSummary {
  total: number;
  pendingPayment: number;
  paid: number;
  waitingShipment: number;
}

export interface AdminShopShipmentListSummary {
  total: number;
  pending: number;
  shipped: number;
  inTransit: number;
  signed: number;
  failed: number;
}

export interface ShopListResult<T, S = undefined> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  summary?: S;
}

export interface ShopCreateOrderResult {
  orderId: string;
  orderNo: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  payAmount: string;
  payExpireAt: string;
}

export interface ShopWechatJsapiPaymentPayload {
  type: "wechat_jsapi";
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
  returnUrl: string;
}

export interface ShopPaymentStartResult {
  mode: "mock" | "gateway";
  channel: ShopPaymentChannel;
  launchUrl: string;
  paymentPayload: ShopWechatJsapiPaymentPayload | null;
  order: ShopOrderDetail;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiRequestError extends Error {
  code: number;
  status: number;

  constructor(message: string, options?: { code?: number; status?: number }) {
    super(message);
    this.name = "ApiRequestError";
    this.code = options?.code ?? -1;
    this.status = options?.status ?? 0;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const ADMIN_CACHE_TTL_MS = 30 * 1000;

const buildUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : path);
const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, `${value}`);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

const isAdminContext = () => typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

const getToken = (mode: "user" | "admin" | "auto") => {
  if (mode === "user") return getUserToken();
  if (mode === "admin") return getAdminTokenForMode();
  return typeof window !== "undefined" && isAdminConsolePath(window.location.pathname) ? getAdminTokenForMode() : getUserToken();
};

const clearUserSession = () => {
  clearPersistedUserSession();
};

const clearAdminSession = () => {
  clearAdminSessionForMode(getAdminConsoleMode());
};

type AdminCacheEntry<T> = {
  data: T;
  expiresAt: number;
};

let adminCourseListCache: AdminCacheEntry<Course[]> | null = null;
let folderListCache: AdminCacheEntry<Folder[]> | null = null;
let adminCourseListPromise: Promise<Course[]> | null = null;
let folderListPromise: Promise<Folder[]> | null = null;

const readCache = <T>(entry: AdminCacheEntry<T> | null) => {
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.data;
};

const writeCache = <T>(data: T): AdminCacheEntry<T> => ({
  data,
  expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
});

const invalidateAdminCourseListCache = () => {
  adminCourseListCache = null;
  adminCourseListPromise = null;
};

const invalidateFolderListCache = () => {
  folderListCache = null;
  folderListPromise = null;
};

const request = async <T>(path: string, options?: RequestInit & { auth?: "user" | "admin" | "auto" }): Promise<T> => {
  const headers = new Headers(options?.headers);
  const token = getToken(options?.auth ?? "auto");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !json || json.code !== 0) {
    const message = json?.message ?? "请求失败";
    if (response.status === 401) {
      if ((options?.auth ?? "auto") === "admin" || path.startsWith("/api/admin")) {
        clearAdminSessionForMode(
          typeof window !== "undefined" ? getAdminConsoleModeFromPath(window.location.pathname) : "admin",
        );
      }
      else clearUserSession();
    }
    throw new ApiRequestError(message, {
      code: json?.code,
      status: response.status,
    });
  }

  return json.data;
};

const postJson = <T>(path: string, body?: unknown, auth: "user" | "admin" | "auto" = "auto") =>
  request<T>(path, {
    method: "POST",
    auth,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

const postJsonWithOptions = <T>(
  path: string,
  body: unknown,
  options: RequestInit & { auth?: "user" | "admin" | "auto" } = {},
) =>
  request<T>(path, {
    ...options,
    method: "POST",
    auth: options.auth ?? "auto",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body ?? {}),
  });

const patchJson = <T>(path: string, body?: unknown, auth: "user" | "admin" | "auto" = "auto") =>
  request<T>(path, {
    method: "PATCH",
    auth,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

const deleteRequest = <T>(path: string, auth: "user" | "admin" | "auto" = "auto") =>
  request<T>(path, {
    method: "DELETE",
    auth,
  });

const requestBlob = async (path: string, options?: RequestInit & { auth?: "user" | "admin" | "auto" }): Promise<Blob> => {
  const headers = new Headers(options?.headers);
  const token = getToken(options?.auth ?? "auto");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    const message = json?.message ?? "请求失败";
    if (response.status === 401) {
      if ((options?.auth ?? "auto") === "admin" || path.startsWith("/api/admin")) clearAdminSession();
      else clearUserSession();
    }
    throw new ApiRequestError(message, {
      code: json?.code,
      status: response.status,
    });
  }

  return response.blob();
};

const uploadFiles = async <T>(
  path: string,
  files: File[],
  extraFields: Record<string, string> = {},
  auth: "user" | "admin" | "auto" = "admin",
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  Object.entries(extraFields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return request<T>(path, {
    method: "POST",
    body: formData,
    auth,
  });
};

const uploadSingleFile = async <T>(path: string, file: File, auth: "user" | "admin" | "auto" = "admin") => {
  const formData = new FormData();
  formData.append("file", file);
  return request<T>(path, {
    method: "POST",
    body: formData,
    auth,
  });
};

const uploadSingleFileWithFields = async <T>(
  path: string,
  file: File,
  extraFields: Record<string, string | string[]>,
  auth: "user" | "admin" | "auto" = "admin",
) => {
  const formData = new FormData();
  formData.append("file", file);

  Object.entries(extraFields).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
      return;
    }

    formData.append(key, value);
  });

  return request<T>(path, {
    method: "POST",
    body: formData,
    auth,
  });
};

export const mockApi = {
  login: (phone: string, password: string, deviceInfo: Record<string, string>) =>
    postJson<{ success: boolean; token: string; user: User }>("/api/auth/user/login", { phone, password, ...deviceInfo }, "user"),

  getCurrentUser: () => request<User>("/api/auth/user/me", { auth: "user" }),

  adminLogin: (account: string, password: string) =>
    postJson<{ success: boolean; token: string; admin: { id: string; account: string; name: string; role: AdminRole } }>(
      "/api/auth/admin/login",
      { account, password },
      "admin",
    ),

  logout: (_userId: string, deviceKey?: string) => postJson<{ success: boolean }>("/api/auth/user/logout", { deviceKey }, "user"),

  getUserCourses: (_userId: string) => request<Course[]>("/api/user/courses", { auth: "user" }),

  getCourseDetail: (courseId: string) =>
    request<CourseDetailPayload>(
      isAdminContext() ? `/api/admin/courses/${courseId}/detail` : `/api/user/courses/${courseId}/detail`,
      { auth: isAdminContext() ? "admin" : "user" },
    ),

  getTagAudios: (tagId: string, scope: string) =>
    request<TagAudiosPayload>(
      scope === "admin-preview" ? `/api/admin/tags/${tagId}/audios` : `/api/user/tags/${tagId}/audios`,
      { auth: scope === "admin-preview" ? "admin" : "user" },
    ),

  getAudioDetail: (audioId: string, courseId: string) =>
    request<{ audio: Audio; tag: Tag; course: Course; prev?: Audio; next?: Audio; first?: Audio; last?: Audio }>(
      `/api/user/courses/${courseId}/audios/${audioId}/detail`,
      { auth: "user" },
    ),

  saveProgress: (_userId: string, courseId: string, audioId: string, progress: number) =>
    postJson<UserProgress>("/api/user/progress", { courseId, audioId, progress }, "user"),

  markCompleted: (_userId: string, courseId: string, audioId: string, progress?: number) =>
    postJson<UserProgress>("/api/user/progress/complete", { courseId, audioId, progress }, "user"),

  getUserProgress: (_userId: string, courseId: string, audioId: string) =>
    request<UserProgress | undefined>(`/api/user/audios/${audioId}/progress?courseId=${encodeURIComponent(courseId)}`, { auth: "user" }),

  getLawOverview: () => request<LawOverviewPayload>("/api/user/laws/overview", { auth: "user" }),
  getLawContent: (nodeId: string) =>
    request<LawNodeContentPayload>(`/api/user/laws/content${buildQueryString({ nodeId })}`, { auth: "user" }),
  searchLaws: (keyword: string) =>
    request<LawSearchResult[]>(`/api/user/laws/search${buildQueryString({ keyword })}`, { auth: "user" }),

  getMockExamPapers: () => request<MockExamPaper[]>("/api/user/mock-exams/papers", { auth: "user" }),
  getMockExamLaunchConfig: () => request<MockExamLaunchConfig>("/api/user/mock-exams/launch-config", { auth: "user" }),
  getUserMockExamHistory: () => request<UserMockExamHistoryItem[]>("/api/user/mock-exams/history", { auth: "user" }),
  startMockExam: (paperId: string) => postJson<MockExamRecordDetail>(`/api/user/mock-exams/papers/${paperId}/start`, {}, "user"),
  getMockExamRecord: (recordId: string) => request<MockExamRecordDetail>(`/api/user/mock-exams/records/${recordId}`, { auth: "user" }),
  pauseMockExam: (recordId: string, options?: { keepalive?: boolean }) =>
    postJsonWithOptions<MockExamRecordDetail>(`/api/user/mock-exams/records/${recordId}/pause`, {}, { auth: "user", keepalive: options?.keepalive }),
  saveMockExamAnswer: (
    recordId: string,
    payload:
      | { questionId: string; answerKeys: string[] }
      | { questionId: string; subQuestionId: string; answerText: string },
  ) =>
    patchJson<MockExamRecordDetail>(`/api/user/mock-exams/records/${recordId}/answers`, payload, "user"),
  submitMockExam: (recordId: string) => postJson<MockExamRecordDetail>(`/api/user/mock-exams/records/${recordId}/submit`, {}, "user"),
  getAdminMockExamPapers: () => request<AdminMockExamPaperListPayload>("/api/admin/mock-exams/papers", { auth: "admin" }),
  getAdminMockExamPaperDetail: (paperId: string) => request<AdminMockExamPaperDetail>(`/api/admin/mock-exams/papers/${paperId}`, { auth: "admin" }),
  createAdminMockExamPaper: (payload: AdminMockExamPaperPayload) =>
    postJson<AdminMockExamPaperDetail>("/api/admin/mock-exams/papers", payload, "admin"),
  updateAdminMockExamPaper: (paperId: string, payload: AdminMockExamPaperPayload) =>
    patchJson<AdminMockExamPaperDetail>(`/api/admin/mock-exams/papers/${paperId}`, payload, "admin"),
  deleteAdminMockExamPaper: (paperId: string) =>
    deleteRequest<{ success: boolean; paperId: string; title: string }>(`/api/admin/mock-exams/papers/${paperId}`, "admin"),
  addAdminMockExamPaperQuestionsFromBank: (paperId: string, itemIds: string[]) =>
    postJson<AdminMockExamPaperDetail>(`/api/admin/mock-exams/papers/${paperId}/questions/from-bank`, { itemIds }, "admin"),
  removeAdminMockExamPaperQuestion: (paperId: string, questionId: string) =>
    deleteRequest<AdminMockExamPaperDetail>(`/api/admin/mock-exams/papers/${paperId}/questions/${questionId}`, "admin"),
  getQuestionBankSummary: () => request<QuestionBankSummary>("/api/admin/mock-exams/question-bank/summary", { auth: "admin" }),
  getQuestionBankFolders: (paperType: QuestionBankPaperType) =>
    request<QuestionBankFolder[]>(`/api/admin/mock-exams/question-bank/folders${buildQueryString({ paperType })}`, { auth: "admin" }),
  createQuestionBankFolder: (name: string, paperType: QuestionBankPaperType) =>
    postJson<QuestionBankFolder>("/api/admin/mock-exams/question-bank/folders", { name, paperType }, "admin"),
  updateQuestionBankFolder: (folderId: string, name: string) =>
    patchJson<QuestionBankFolder>(`/api/admin/mock-exams/question-bank/folders/${folderId}`, { name }, "admin"),
  deleteQuestionBankFolder: (folderId: string) =>
    deleteRequest<{ success: boolean }>(`/api/admin/mock-exams/question-bank/folders/${folderId}`, "admin"),
  getQuestionBankItems: (params: {
    paperType: QuestionBankPaperType;
    folderId?: string;
    keyword?: string;
    questionType?: MockExamQuestionType | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<PagedResult<QuestionBankItem>>(
      `/api/admin/mock-exams/question-bank/items${buildQueryString({
        paperType: params.paperType,
        folderId: params.folderId,
        keyword: params.keyword,
        questionType: params.questionType && params.questionType !== "all" ? params.questionType : undefined,
        page: params.page,
        pageSize: params.pageSize,
      })}`,
      { auth: "admin" },
    ),
  createQuestionBankItem: (payload: QuestionBankItemPayload) =>
    postJson<QuestionBankItem>("/api/admin/mock-exams/question-bank/items", payload, "admin"),
  updateQuestionBankItem: (itemId: string, payload: QuestionBankItemPayload) =>
    patchJson<QuestionBankItem>(`/api/admin/mock-exams/question-bank/items/${itemId}`, payload, "admin"),
  deleteQuestionBankItem: (itemId: string) =>
    deleteRequest<{ success: boolean }>(`/api/admin/mock-exams/question-bank/items/${itemId}`, "admin"),
  importQuestionBankItems: (file: File, folderId: string, paperType: QuestionBankPaperType) =>
    uploadSingleFileWithFields<{ parsedCount: number; createdCount: number }>(
      "/api/admin/mock-exams/question-bank/items/import",
      file,
      {
        folderId,
        paperType,
      },
      "admin",
    ),
  downloadQuestionBankTemplate: (paperType: QuestionBankPaperType) =>
    requestBlob(`/api/admin/mock-exams/question-bank/template${buildQueryString({ paperType })}`, { auth: "admin" }),
  createMockExamPaperFromQuestionBank: (payload: {
    itemIds: string[];
    paper: {
      title: string;
      subtitle?: string;
      year?: number;
      phase?: string;
      durationMinutes?: number;
      maxAttempts?: number;
      reviewEnabled?: boolean;
      passScore?: number;
      description?: string;
      status?: AdminMockExamPaperStatus;
      sortOrder?: number;
      code?: string;
    };
  }) =>
    postJson<{ paperId: string; title: string; totalScore: number; questionCount: number }>(
      "/api/admin/mock-exams/papers/create-from-bank",
      payload,
      "admin",
    ),
  getAdminMockExamReviews: (params?: { keyword?: string; reviewStatus?: "all" | AdminMockExamReviewStatus; paperId?: string; page?: number; pageSize?: number }) =>
    request<AdminMockExamReviewListPayload>(
      `/api/admin/mock-exams/reviews${buildQueryString({
        keyword: params?.keyword,
        reviewStatus: params?.reviewStatus,
        paperId: params?.paperId,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getAdminMockExamReviewPapers: (params?: { keyword?: string }) =>
    request<AdminMockExamReviewPaperListPayload>(
      `/api/admin/mock-exams/reviews/papers${buildQueryString({
        keyword: params?.keyword,
      })}`,
      { auth: "admin" },
    ),
  getAdminMockExamReviewDetail: (recordId: string) =>
    request<AdminMockExamReviewDetail>(`/api/admin/mock-exams/reviews/${recordId}`, { auth: "admin" }),
  claimAdminMockExamReview: (recordId: string) =>
    postJson<AdminMockExamReviewDetail>(`/api/admin/mock-exams/reviews/${recordId}/claim`, {}, "admin"),
  renewAdminMockExamReviewLock: (recordId: string, lockToken: string) =>
    postJson<AdminMockExamReviewDetail>(`/api/admin/mock-exams/reviews/${recordId}/renew-lock`, { lockToken }, "admin"),
  releaseAdminMockExamReviewLock: (recordId: string, lockToken: string) =>
    postJson<AdminMockExamReviewDetail>(`/api/admin/mock-exams/reviews/${recordId}/release-lock`, { lockToken }, "admin"),
  getAdminMockExamAiReviewConfig: () =>
    request<MockExamAiReviewConfig>("/api/admin/mock-exams/settings/ai-review", { auth: "admin" }),
  updateAdminMockExamAiReviewConfig: (payload: MockExamAiReviewConfig) =>
    patchJson<MockExamAiReviewConfig>("/api/admin/mock-exams/settings/ai-review", payload, "admin"),
  getAdminMockExamLaunchConfig: () =>
    request<MockExamLaunchConfig>("/api/admin/mock-exams/settings/launch", { auth: "admin" }),
  updateAdminMockExamLaunchConfig: (payload: { config: MockExamLaunchConfig }) =>
    patchJson<MockExamLaunchConfig>("/api/admin/mock-exams/settings/launch", payload, "admin"),
  aiScoreAdminMockExamReview: (recordId: string) =>
    postJson<AdminMockExamReviewDetail>(`/api/admin/mock-exams/reviews/${recordId}/ai-score`, {}, "admin"),
  submitAdminMockExamReview: (
    recordId: string,
    payload: {
      items: AdminMockExamReviewQuestionScoreInput[];
      lockToken: string;
      version: number;
      targetWorkflowStatus?: "manual_reviewing" | "manual_pending";
    },
  ) => postJson<AdminMockExamReviewDetail>(`/api/admin/mock-exams/reviews/${recordId}/score`, payload, "admin"),
  publishAdminMockExamReview: (recordId: string, payload: { lockToken: string; version: number }) =>
    postJson<AdminMockExamReviewDetail>(`/api/admin/mock-exams/reviews/${recordId}/publish`, payload, "admin"),
  uploadQuestionBankLessonAudio: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string; readableUrl?: string; durationSeconds?: number }>(
      "/api/admin/mock-exams/question-bank/upload-lesson-audio",
      file,
      "admin",
    ),
  uploadMockExamReviewVoice: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string; readableUrl?: string; durationSeconds?: number }>(
      "/api/admin/mock-exams/reviews/upload-voice",
      file,
      "admin",
    ),
  submitMockExamReviewFeedback: (recordId: string, questionId: string, stars: number) =>
    postJson<MockExamRecordDetail>(`/api/user/mock-exams/records/${recordId}/review-feedback`, { questionId, stars }, "user"),

  getTypingPracticeHome: () => request<TypingPracticeHomePayload>("/api/user/typing-practice/home", { auth: "user" }),
  getTypingPracticeText: (textId: string, params?: { mode?: TypingPracticeMode; difficulty?: TypingPracticeDifficulty; timeLimitSeconds?: number }) =>
    request<TypingPracticeText>(
      `/api/user/typing-practice/texts/${textId}${buildQueryString({
        mode: params?.mode,
        difficulty: params?.difficulty,
        limit: params?.timeLimitSeconds,
      })}`,
      { auth: "user" },
    ),
  createTypingPracticeRecord: (payload: TypingPracticeRecordPayload) =>
    postJson<TypingPracticeRecord>("/api/user/typing-practice/records", payload, "user"),
  getTypingPracticeRecords: (params?: { page?: number; pageSize?: number }) =>
    request<TypingPracticeRecordListPayload>(
      `/api/user/typing-practice/records${buildQueryString({
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "user" },
    ),
  getTypingPracticeLeaderboard: (params?: { limit?: number }) =>
    request<TypingPracticeLeaderboardEntry[]>(
      `/api/user/typing-practice/leaderboard${buildQueryString({
        limit: params?.limit,
      })}`,
      { auth: "user" },
    ),
  getTypingPracticeRecord: (recordId: string) =>
    request<TypingPracticeRecord>(`/api/user/typing-practice/records/${recordId}`, { auth: "user" }),

  getAdminTypingPracticeSummary: () => request<TypingPracticeSummary>("/api/admin/typing-practice/summary", { auth: "admin" }),
  getAdminTypingPracticeHomeConfig: () => request<TypingPracticeHomeConfig>("/api/admin/typing-practice/home-config", { auth: "admin" }),
  updateAdminTypingPracticeHomeConfig: (payload: { config: TypingPracticeHomeConfig }) =>
    patchJson<TypingPracticeHomeConfig>("/api/admin/typing-practice/home-config", payload, "admin"),
  getAdminTypingPracticeDifficultyConfigs: () =>
    request<TypingPracticeDifficultyConfig[]>("/api/admin/typing-practice/difficulty-configs", { auth: "admin" }),
  updateAdminTypingPracticeDifficultyConfigs: (payload: { items: TypingPracticeDifficultyConfig[] }) =>
    patchJson<TypingPracticeDifficultyConfig[]>("/api/admin/typing-practice/difficulty-configs", payload, "admin"),
  getAdminTypingPracticeFolders: () => request<TypingPracticeFolder[]>("/api/admin/typing-practice/folders", { auth: "admin" }),
  createAdminTypingPracticeFolder: (payload: { name: string; sortOrder?: number | string }) =>
    postJson<TypingPracticeFolder>("/api/admin/typing-practice/folders", payload, "admin"),
  updateAdminTypingPracticeFolder: (folderId: string, payload: { name: string; sortOrder?: number | string }) =>
    patchJson<TypingPracticeFolder>(`/api/admin/typing-practice/folders/${folderId}`, payload, "admin"),
  deleteAdminTypingPracticeFolder: (folderId: string) =>
    deleteRequest<{ success: boolean }>(`/api/admin/typing-practice/folders/${folderId}`, "admin"),
  getAdminTypingPracticeTexts: (params?: {
    folderId?: string;
    keyword?: string;
    status?: TypingPracticeTextStatus | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<TypingPracticeTextListPayload>(
      `/api/admin/typing-practice/texts${buildQueryString({
        folderId: params?.folderId && params.folderId !== "all" ? params.folderId : undefined,
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  createAdminTypingPracticeText: (payload: TypingPracticeTextPayload) =>
    postJson<TypingPracticeText>("/api/admin/typing-practice/texts", payload, "admin"),
  updateAdminTypingPracticeText: (textId: string, payload: TypingPracticeTextPayload) =>
    patchJson<TypingPracticeText>(`/api/admin/typing-practice/texts/${textId}`, payload, "admin"),
  deleteAdminTypingPracticeText: (textId: string) =>
    deleteRequest<{ success: boolean }>(`/api/admin/typing-practice/texts/${textId}`, "admin"),

  getShopHome: () => request<ShopHomePayload>("/api/user/shop/home", { auth: "user" }),
  getShopCategories: () => request<ShopCategory[]>("/api/user/shop/categories", { auth: "user" }),
  getShopProducts: (params?: {
    categoryId?: string;
    type?: ShopProductType | "all";
    keyword?: string;
    sortBy?: "default" | "sales_desc" | "price_asc" | "price_desc" | "latest";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopProduct>>(
      `/api/user/shop/products${buildQueryString({
        categoryId: params?.categoryId,
        type: params?.type && params.type !== "all" ? params.type : undefined,
        keyword: params?.keyword,
        sortBy: params?.sortBy,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "user" },
    ),
  getShopProductDetail: (productId: string) => request<ShopProductDetail>(`/api/user/shop/products/${productId}`, { auth: "user" }),
  getShopCart: () => request<ShopCartPayload>("/api/user/shop/cart", { auth: "user" }),
  addShopCartItem: (payload: { productId: string; skuId: string; quantity: number }) =>
    postJson<ShopCartPayload>("/api/user/shop/cart/items", payload, "user"),
  updateShopCartItem: (itemId: string, payload: { quantity: number }) =>
    patchJson<ShopCartPayload>(`/api/user/shop/cart/items/${itemId}`, payload, "user"),
  deleteShopCartItem: (itemId: string) => deleteRequest<ShopCartPayload>(`/api/user/shop/cart/items/${itemId}`, "user"),
  getShopAddresses: () => request<ShopAddress[]>("/api/user/shop/addresses", { auth: "user" }),
  createShopAddress: (payload: {
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    address: string;
    isDefault?: boolean;
  }) => postJson<ShopAddress>("/api/user/shop/addresses", payload, "user"),
  updateShopAddress: (
    addressId: string,
    payload: Partial<{
      name: string;
      phone: string;
      province: string;
      city: string;
      district: string;
      address: string;
      isDefault: boolean;
    }>,
  ) => patchJson<ShopAddress>(`/api/user/shop/addresses/${addressId}`, payload, "user"),
  deleteShopAddress: (addressId: string) => deleteRequest<{ success: boolean }>(`/api/user/shop/addresses/${addressId}`, "user"),
  previewShopCheckout: (payload: {
    source: "cart" | "buy_now";
    cartItemIds?: string[];
    buyNowSkuId?: string;
    buyNowQuantity?: number;
    addressId?: string;
  }) => postJson<ShopCheckoutPreview>("/api/user/shop/checkout/preview", payload, "user"),
  createShopOrder: (payload: {
    source: "cart" | "buy_now";
    cartItemIds?: string[];
    buyNowSkuId?: string;
    buyNowQuantity?: number;
    addressId?: string;
    remark?: string;
    payChannel: ShopPaymentChannel;
  }) => postJson<ShopCreateOrderResult>("/api/user/shop/orders", payload, "user"),
  payShopOrder: (orderId: string, payChannel: ShopPaymentChannel, options?: { wechatOpenId?: string }) =>
    postJson<ShopPaymentStartResult>(
      `/api/user/shop/orders/${orderId}/pay`,
      { payChannel, wechatOpenId: options?.wechatOpenId },
      "user",
    ),
  syncShopOrderPaymentStatus: (orderId: string) =>
    postJson<ShopOrderDetail>(`/api/user/shop/orders/${orderId}/payment-status/sync`, {}, "user"),
  getShopOrderDetail: (orderId: string) => request<ShopOrderDetail>(`/api/user/shop/orders/${orderId}`, { auth: "user" }),
  getShopOrderLogistics: (orderId: string) => request<ShopLogistics>(`/api/user/shop/orders/${orderId}/logistics`, { auth: "user" }),
  getShopOrderSummary: () => request<UserShopOrderSummary>("/api/user/shop/orders/summary", { auth: "user" }),
  getShopOrders: (params?: {
    status?: "all" | "pending_payment" | "pending_shipment" | "shipped" | "completed" | "cancelled";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopOrder>>(
      `/api/user/shop/orders${buildQueryString({
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "user" },
    ),
  cancelShopOrder: (orderId: string) => postJson<ShopOrder>(`/api/user/shop/orders/${orderId}/cancel`, {}, "user"),
  requestShopOrderRefund: (orderId: string, payload: { reason: string }) =>
    postJson<ShopOrderDetail>(`/api/user/shop/orders/${orderId}/refunds`, payload, "user"),
  confirmShopOrderReceipt: (orderId: string) => postJson<ShopLogistics>(`/api/user/shop/orders/${orderId}/confirm-receipt`, {}, "user"),

  getAdminShopConfig: () => request<ShopConfig>("/api/admin/shop/config", { auth: "admin" }),
  updateAdminShopConfig: (payload: AdminShopConfigPayload) => patchJson<ShopConfig>("/api/admin/shop/config", payload, "admin"),

  getAdminShopCategories: (params?: { keyword?: string; status?: "all" | "enabled" | "disabled" }) =>
    request<ShopCategory[]>(
      `/api/admin/shop/categories${buildQueryString({
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
      })}`,
      { auth: "admin" },
    ),
  createAdminShopCategory: (payload: { name: string; sortOrder: number; status: boolean }) =>
    postJson<ShopCategory>("/api/admin/shop/categories", payload, "admin"),
  updateAdminShopCategory: (categoryId: string, payload: { name: string; sortOrder: number; status: boolean }) =>
    patchJson<ShopCategory>(`/api/admin/shop/categories/${categoryId}`, payload, "admin"),
  deleteAdminShopCategory: (categoryId: string) => deleteRequest<{ success: boolean }>(`/api/admin/shop/categories/${categoryId}`, "admin"),

  getAdminShopProducts: (params?: {
    keyword?: string;
    categoryId?: string;
    type?: ShopProductType | "all";
    status?: ShopProductStatus | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<AdminShopProduct, AdminShopProductListSummary>>(
      `/api/admin/shop/products${buildQueryString({
        keyword: params?.keyword,
        categoryId: params?.categoryId && params.categoryId !== "all" ? params.categoryId : undefined,
        type: params?.type && params.type !== "all" ? params.type : undefined,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getAdminShopProductDetail: (productId: string) => request<AdminShopProductDetail>(`/api/admin/shop/products/${productId}`, { auth: "admin" }),
  createAdminShopProduct: (payload: AdminShopProductPayload) => postJson<AdminShopProductDetail>("/api/admin/shop/products", payload, "admin"),
  updateAdminShopProduct: (productId: string, payload: AdminShopProductPayload) =>
    patchJson<AdminShopProductDetail>(`/api/admin/shop/products/${productId}`, payload, "admin"),
  publishAdminShopProduct: (productId: string, status: ShopProductStatus) =>
    postJson<AdminShopProductDetail>(`/api/admin/shop/products/${productId}/publish`, { status }, "admin"),
  deleteAdminShopProduct: (productId: string) => deleteRequest<{ success: boolean }>(`/api/admin/shop/products/${productId}`, "admin"),
  getAdminShopOrders: (params?: {
    orderNo?: string;
    phone?: string;
    keyword?: string;
    status?: ShopOrderStatus | "all";
    paymentStatus?: ShopPaymentStatus | "all";
    shipmentStatus?: ShopShipmentStatus | "pending" | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopOrder, AdminShopOrderListSummary>>(
      `/api/admin/shop/orders${buildQueryString({
        orderNo: params?.orderNo,
        phone: params?.phone,
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        paymentStatus: params?.paymentStatus && params.paymentStatus !== "all" ? params.paymentStatus : undefined,
        shipmentStatus: params?.shipmentStatus && params.shipmentStatus !== "all" ? params.shipmentStatus : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getAdminShopOrderDetail: (orderId: string) => request<ShopOrderDetail>(`/api/admin/shop/orders/${orderId}`, { auth: "admin" }),
  closeAdminShopOrder: (orderId: string, reason: string) => postJson<ShopOrderDetail>(`/api/admin/shop/orders/${orderId}/close`, { reason }, "admin"),
  approveAdminShopRefund: (refundId: string, payload?: { note?: string }) =>
    postJson<ShopOrderDetail>(`/api/admin/shop/refunds/${refundId}/approve`, payload ?? {}, "admin"),
  rejectAdminShopRefund: (refundId: string, payload: { reason: string }) =>
    postJson<ShopOrderDetail>(`/api/admin/shop/refunds/${refundId}/reject`, payload, "admin"),
  completeAdminShopRefund: (refundId: string, payload?: { note?: string }) =>
    postJson<ShopOrderDetail>(`/api/admin/shop/refunds/${refundId}/complete`, payload ?? {}, "admin"),
  getAdminShopShipments: (params?: {
    orderNo?: string;
    phone?: string;
    keyword?: string;
    trackingNo?: string;
    status?: ShopShipmentStatus | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopShipment, AdminShopShipmentListSummary>>(
      `/api/admin/shop/shipments${buildQueryString({
        orderNo: params?.orderNo,
        phone: params?.phone,
        keyword: params?.keyword,
        trackingNo: params?.trackingNo,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  createAdminShopShipment: (
    orderId: string,
    payload: {
      company: string;
      trackingNo: string;
      remark?: string;
      status?: ShopShipmentStatus;
      items: { orderItemId: string; quantity: number }[];
    },
  ) => postJson<ShopShipment>(`/api/admin/shop/orders/${orderId}/shipments`, payload, "admin"),
  updateAdminShopShipment: (
    shipmentId: string,
    payload: {
      company?: string;
      trackingNo?: string;
      status?: ShopShipmentStatus;
      trackContent?: string;
      location?: string;
      trackTime?: string;
    },
  ) => patchJson<ShopShipment>(`/api/admin/shop/shipments/${shipmentId}`, payload, "admin"),
  createAdminShopShipmentTrack: (
    shipmentId: string,
    payload: {
      content: string;
      location?: string;
      trackTime?: string;
    },
  ) => postJson<ShopShipment>(`/api/admin/shop/shipments/${shipmentId}/tracks`, payload, "admin"),
  uploadShopImage: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string; readableUrl?: string }>("/api/admin/uploads/shop-image", file, "admin"),

  getAllUsers: (params?: { keyword?: string; status?: UserStatus | "all"; courseId?: string; page?: number; pageSize?: number }) =>
    request<PagedResult<User>>(
      `/api/admin/users${buildQueryString({
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        courseId: params?.courseId && params.courseId !== "all" ? params.courseId : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getUserSummary: () => request<UserSummary>("/api/admin/users/summary", { auth: "admin" }),
  getAllAdmins: () => request<AdminAccount[]>("/api/admin/admins", { auth: "admin" }),
  getAllMockExamPermissionPapers: () =>
    request<MockExamPermissionOption[]>("/api/admin/mock-exam-papers", { auth: "admin" }),
  createAdminAccount: (payload: { account: string; name: string; password: string; role: AdminRole }) =>
    postJson<AdminAccount>("/api/admin/admins", payload, "admin"),
  updateAdminAccount: (adminId: string, payload: { account: string; name: string; role: AdminRole }) =>
    patchJson<AdminAccount>(`/api/admin/admins/${adminId}`, payload, "admin"),
  updateAdminPassword: (adminId: string, password: string) =>
    patchJson<{ success: boolean }>(`/api/admin/admins/${adminId}/password`, { password }, "admin"),
  deleteAdminAccount: (adminId: string) => deleteRequest<{ success: boolean }>(`/api/admin/admins/${adminId}`, "admin"),
  getAllCourses: async () => {
    const cached = readCache(adminCourseListCache);
    if (cached) return cached;

    if (!adminCourseListPromise) {
      adminCourseListPromise = request<Course[]>("/api/admin/courses", { auth: "admin" })
        .then((data) => {
          adminCourseListCache = writeCache(data);
          return data;
        })
        .finally(() => {
          adminCourseListPromise = null;
        });
    }

    return adminCourseListPromise;
  },
  getUserDevices: (userId: string) => request<Device[]>(`/api/admin/users/${userId}/devices`, { auth: "admin" }),
  removeDevice: (deviceId: string) => deleteRequest<{ success: boolean }>(`/api/admin/devices/${deviceId}`, "admin"),
  clearUserDevices: (userId: string) => deleteRequest<{ success: boolean }>(`/api/admin/users/${userId}/devices`, "admin"),

  createUser: (phone: string, courseIds: string[], mockExamPaperIds: string[] = []) =>
    postJson<{ isNew: boolean; userId: string; phone: string }>("/api/admin/users", { phone, courseIds, mockExamPaperIds }, "admin"),
  batchCreateUsers: (phones: string[], courseIds: string[], mockExamPaperIds: string[] = []) =>
    postJson<{ createdCount: number; appendedCount: number; failed: string[] }>(
      "/api/admin/users/batch-import",
      { phones, courseIds, mockExamPaperIds },
      "admin",
    ),
  batchCreateUsersByExcel: (file: File, courseIds: string[], mockExamPaperIds: string[] = []) =>
    uploadSingleFileWithFields<{ createdCount: number; appendedCount: number; failed: string[]; parsedCount: number }>(
      "/api/admin/users/batch-import-excel",
      file,
      { courseIds, mockExamPaperIds },
      "admin",
    ),
  updateUserPermissions: (
    userId: string,
    addCourses: string[],
    removeCourses: string[],
    addMockExamPapers: string[] = [],
    removeMockExamPapers: string[] = [],
  ) =>
    patchJson<{ success: boolean }>(
      `/api/admin/users/${userId}/permissions`,
      { addCourses, removeCourses, addMockExamPapers, removeMockExamPapers },
      "admin",
    ),
  updateUserPassword: (userId: string, password: string) =>
    patchJson<{ success: boolean }>(`/api/admin/users/${userId}/password`, { password }, "admin"),
  batchAddUserPermissions: (userIds: string[], courseIds: string[], mockExamPaperIds: string[] = []) =>
    postJson<{ success: boolean }>("/api/admin/users/batch-permissions", { userIds, courseIds, mockExamPaperIds }, "admin"),
  resetUserMockExamAttempts: (userId: string, paperId: string) =>
    postJson<{ paperId: string; manualAttemptLimit: number | null; manualAttemptUsed: number }>(
      `/api/admin/users/${userId}/mock-exam-permissions/${paperId}/reset-attempts`,
      {},
      "admin",
    ),
  resetUserMockExamTime: (userId: string, paperId: string) =>
    postJson<{ paperId: string; recordId: string; currentRecordStartedAt: string }>(
      `/api/admin/users/${userId}/mock-exam-permissions/${paperId}/reset-time`,
      {},
      "admin",
    ),
  toggleUserStatus: (userId: string, status: UserStatus) =>
    patchJson<{ success: boolean }>(`/api/admin/users/${userId}/status`, { status }, "admin"),
  batchToggleUserStatus: (userIds: string[], status: UserStatus) =>
    postJson<{ success: boolean }>("/api/admin/users/batch-status", { userIds, status }, "admin"),
  deleteUser: (userId: string) => deleteRequest<{ success: boolean }>(`/api/admin/users/${userId}`, "admin"),
  batchDeleteUsers: (userIds: string[]) => postJson<{ success: boolean }>("/api/admin/users/batch-delete", { userIds }, "admin"),

  uploadCoverImage: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string }>("/api/admin/uploads/course-cover", file, "admin"),

  uploadAudioHandout: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string }>("/api/admin/uploads/audio-handout", file, "admin"),

  uploadSystemImage: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string; readableUrl?: string }>("/api/admin/uploads/system-image", file, "admin"),
  uploadMockExamPaperCover: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string; readableUrl?: string }>("/api/admin/uploads/system-image", file, "admin"),

  extractScriptFile: (file: File) =>
    uploadSingleFile<{ text: string }>("/api/admin/uploads/script-file", file, "admin"),

  getAdminLawSummary: () => request<LawAdminSummary>("/api/admin/laws/summary", { auth: "admin" }),
  getAdminLawEntries: (params?: {
    keyword?: string;
    topCategoryId?: string;
    visibility?: "all" | "published" | "hidden";
    pinnedOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) =>
    request<PagedResult<LawRecordMeta>>(
      `/api/admin/laws/entries${buildQueryString({
        keyword: params?.keyword,
        topCategoryId: params?.topCategoryId && params.topCategoryId !== "all" ? params.topCategoryId : undefined,
        visibility: params?.visibility && params.visibility !== "all" ? params.visibility : undefined,
        pinnedOnly: params?.pinnedOnly ? "true" : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  updateAdminLawEntry: (sourceLawId: number | string, payload: LawAdminEntryUpdatePayload) =>
    patchJson<LawRecordMeta>(`/api/admin/laws/entries/${sourceLawId}`, payload, "admin"),
  syncAdminLaws: () =>
    postJson<{ source: string; sourceLabel: string; totalRecords: number; topCategoryCount: number; syncedAt: string }>(
      "/api/admin/laws/sync",
      {},
      "admin",
    ),

  createCourse: async (payload: {
    name: string;
    cover: string;
    coverObjectKey?: string;
    description: string;
    status: CourseStatus;
    openTime: string;
    tags?: string[];
  }) => {
    invalidateAdminCourseListCache();
    return postJson<Course>("/api/admin/courses", payload, "admin");
  },
  updateCourse: async (
    courseId: string,
    payload: Partial<Course> & { coverObjectKey?: string | null },
  ) => {
    invalidateAdminCourseListCache();
    return patchJson<Course>(`/api/admin/courses/${courseId}`, payload, "admin");
  },
  updateCourseOrder: async (items: { id: string; order: number }[]) => {
    invalidateAdminCourseListCache();
    return patchJson<{ success: boolean }>("/api/admin/courses/order", { items }, "admin");
  },
  deleteCourse: async (courseId: string) => {
    invalidateAdminCourseListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/courses/${courseId}`, "admin");
  },

  createTag: (courseId: string, name: string) => postJson<Tag>(`/api/admin/courses/${courseId}/tags`, { name }, "admin"),
  updateTag: (tagId: string, name: string) => patchJson<Tag>(`/api/admin/tags/${tagId}`, { name }, "admin"),
  deleteTag: async (tagId: string) => {
    invalidateAdminCourseListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/tags/${tagId}`, "admin");
  },
  updateTagOrder: (courseId: string, items: { id: string; order: number }[]) =>
    patchJson<{ success: boolean }>(`/api/admin/courses/${courseId}/tags/order`, { items }, "admin"),

  addAudioToCourse: async (courseId: string, tagId: string, audioIds: string[]) => {
    invalidateAdminCourseListCache();
    return postJson<{ success: boolean }>(`/api/admin/courses/${courseId}/tags/${tagId}/audios/reference`, { audioIds }, "admin");
  },
  updateAudioOrder: (courseId: string, tagId: string, items: { id: string; order: number }[]) =>
    patchJson<{ success: boolean }>(`/api/admin/courses/${courseId}/tags/${tagId}/audios/order`, { items }, "admin"),
  updateAudioTag: (courseId: string, audioId: string, tagId: string) =>
    patchJson<{ success: boolean }>(`/api/admin/courses/${courseId}/audios/${audioId}/tag`, { tagId }, "admin"),
  removeAudioFromCourse: async (courseId: string, audioId: string) => {
    invalidateAdminCourseListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/courses/${courseId}/audios/${audioId}`, "admin");
  },

  getFolders: async () => {
    const cached = readCache(folderListCache);
    if (cached) return cached;

    if (!folderListPromise) {
      folderListPromise = request<Folder[]>("/api/admin/library/folders", { auth: "admin" })
        .then((data) => {
          folderListCache = writeCache(data);
          return data;
        })
        .finally(() => {
          folderListPromise = null;
        });
    }

    return folderListPromise;
  },
  createFolder: async (name: string) => {
    invalidateFolderListCache();
    return postJson<Folder>("/api/admin/library/folders", { name }, "admin");
  },
  updateFolder: async (folderId: string, name: string) => {
    invalidateFolderListCache();
    return patchJson<Folder>(`/api/admin/library/folders/${folderId}`, { name }, "admin");
  },
  deleteFolder: async (folderId: string) => {
    invalidateFolderListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/library/folders/${folderId}`, "admin");
  },
  getAudioLibraryMeta: () => request<AudioLibraryMeta>("/api/admin/library/meta", { auth: "admin" }),
  getAudioLibraryItems: (params?: {
    folderId?: string;
    keyword?: string;
    courseId?: string;
    excludeCourseId?: string;
    tagId?: string;
    refFilter?: "all" | "referenced" | "unreferenced";
    scriptFilter?: "all" | "scripted" | "unscripted";
    processFilter?: AudioProcessStatus | "all";
    searchScope?: "current" | "all";
    sortMode?: "uploaded-desc" | "name-asc";
    page?: number;
    pageSize?: number;
  }) =>
    request<PagedResult<AudioLibraryItem>>(
      `/api/admin/library/audios${buildQueryString({
        folderId: params?.folderId,
        keyword: params?.keyword,
        courseId: params?.courseId && params.courseId !== "all" ? params.courseId : undefined,
        excludeCourseId: params?.excludeCourseId,
        tagId: params?.tagId && params.tagId !== "all" ? params.tagId : undefined,
        refFilter: params?.refFilter && params.refFilter !== "all" ? params.refFilter : undefined,
        scriptFilter: params?.scriptFilter && params.scriptFilter !== "all" ? params.scriptFilter : undefined,
        processFilter: params?.processFilter && params.processFilter !== "all" ? params.processFilter : undefined,
        searchScope: params?.searchScope,
        sortMode: params?.sortMode,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  updateAudioName: (audioId: string, name: string) => patchJson<Audio>(`/api/admin/library/audios/${audioId}/name`, { name }, "admin"),
  updateAudioScript: (audioId: string, script: string) => patchJson<Audio>(`/api/admin/library/audios/${audioId}/script`, { script }, "admin"),
  updateAudioHandout: (
    audioId: string,
    payload: {
      handoutUrl?: string | null;
      handoutObjectKey?: string | null;
      handoutName?: string | null;
    },
  ) => patchJson<Audio>(`/api/admin/library/audios/${audioId}/handout`, payload, "admin"),
  moveAudiosToFolder: async (audioIds: string[], folderId: string) => {
    invalidateFolderListCache();
    return postJson<{ success: boolean }>("/api/admin/library/audios/move-folder", { audioIds, folderId }, "admin");
  },
  deleteAudio: async (audioId: string) => {
    invalidateFolderListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/library/audios/${audioId}`, "admin");
  },

  uploadAudioToLibrary: async (folderId: string, files: File[], script = "") => {
    invalidateFolderListCache();
    return uploadFiles<Audio[]>("/api/admin/library/audios/upload", files, { folderId, script }, "admin");
  },
  uploadAudioDirectlyToCourse: async (courseId: string, tagId: string, files: File[], script = "") => {
    invalidateFolderListCache();
    invalidateAdminCourseListCache();
    return uploadFiles<Audio>(`/api/admin/courses/${courseId}/tags/${tagId}/audios/upload`, files, { script }, "admin");
  },

  getBrandingConfig: () => request<BrandingConfig>("/api/auth/branding", { auth: "auto" }),
  getUserHomeConfig: () => request<UserHomeConfig>("/api/auth/user-home-config", { auth: "user" }),
  getUserHomeOverview: () => request<UserHomeOverview>("/api/user/home-overview", { auth: "user" }),
  downloadAudioHandout: (courseId: string, audioId: string) =>
    requestBlob(`/api/user/courses/${courseId}/audios/${audioId}/handout/download`, { auth: "user" }),
  getSystemConfig: () => request<SystemConfig>("/api/admin/system-config", { auth: "admin" }),
  updateSystemConfig: (payload: Partial<SystemConfig>) => patchJson<SystemConfig>("/api/admin/system-config", payload, "admin"),
  testWebhook: (webhookUrl: string) => postJson<{ success: boolean }>("/api/admin/system-config/test-webhook", { webhookUrl }, "admin"),
  getLogSummary: () => request<LogSummary>("/api/admin/logs/summary", { auth: "admin" }),
  getAuditLogs: (params?: { keyword?: string; entityType?: string; page?: number; pageSize?: number }) =>
    request<PagedResult<AuditLogItem>>(
      `/api/admin/logs/audit${buildQueryString({
        keyword: params?.keyword,
        entityType: params?.entityType && params.entityType !== "all" ? params.entityType : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getWebhookLogs: (params?: { keyword?: string; status?: WebhookLogStatus | "all"; page?: number; pageSize?: number }) =>
    request<PagedResult<WebhookLogItem>>(
      `/api/admin/logs/webhooks${buildQueryString({
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
};
