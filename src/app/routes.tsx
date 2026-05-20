import { Suspense, lazy } from "react";
import type { ComponentType, ReactNode } from "react";
import { Navigate, createBrowserRouter, useParams } from "react-router";
import { RouteErrorPage } from "./pages/public/RouteErrorPage";

const lazyPage = <T extends Record<string, unknown>>(loader: () => Promise<T>, exportName: keyof T) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });

const RouteLoading = () => <div className="p-8 text-slate-500">页面加载中...</div>;

const withSuspense = (element: ReactNode) => <Suspense fallback={<RouteLoading />}>{element}</Suspense>;

function LegacyMockExamLaunchRedirect() {
  const { paperId = "" } = useParams();
  return <Navigate to={`/user/mock-exams/papers/${paperId}`} replace />;
}

const UserLayout = lazyPage(() => import("./layouts/UserLayout"), "UserLayout");
const AdminLayout = lazyPage(() => import("./layouts/AdminLayout"), "AdminLayout");
const ReviewLayout = lazyPage(() => import("./layouts/ReviewLayout"), "ReviewLayout");
const PortalHome = lazyPage(() => import("./pages/public/PortalHome"), "PortalHome");
const PortalLegalPage = lazyPage(() => import("./pages/public/PortalLegalPage"), "PortalLegalPage");
const PortalNotFound = lazyPage(() => import("./pages/public/PortalNotFound"), "PortalNotFound");
const UserLogin = lazyPage(() => import("./pages/user/UserLogin"), "UserLogin");
const MyCourses = lazyPage(() => import("./pages/user/MyCourses"), "MyCourses");
const UserCourseLibrary = lazyPage(() => import("./pages/user/UserCourseLibrary"), "UserCourseLibrary");
const LawSearch = lazyPage(() => import("./pages/user/LawSearch"), "LawSearch");
const MockExamHome = lazyPage(() => import("./pages/user/MockExamHome"), "MockExamHome");
const MockExamLaunch = lazyPage(() => import("./pages/user/MockExamLaunch"), "MockExamLaunch");
const MockExamRoom = lazyPage(() => import("./pages/user/MockExamRoom"), "MockExamRoom");
const MockExamResult = lazyPage(() => import("./pages/user/MockExamResult"), "MockExamResult");
const MockExamReviewPending = lazyPage(() => import("./pages/user/MockExamReviewPending"), "MockExamReviewPending");
const UserMockExamHistory = lazyPage(() => import("./pages/user/UserMockExamHistory"), "UserMockExamHistory");
const UserMockExamLeaderboard = lazyPage(() => import("./pages/user/UserMockExamLeaderboard"), "UserMockExamLeaderboard");
const MyBookQuestionBanks = lazyPage(() => import("./pages/user/MyBookQuestionBanks"), "MyBookQuestionBanks");
const BookQuestionBankDetail = lazyPage(() => import("./pages/user/BookQuestionBankDetail"), "BookQuestionBankDetail");
const BookQuestionBankPractice = lazyPage(() => import("./pages/user/BookQuestionBankPractice"), "BookQuestionBankPractice");
const TypingPracticeHome = lazyPage(() => import("./pages/user/TypingPracticeHome"), "TypingPracticeHome");
const TypingPracticeGame = lazyPage(() => import("./pages/user/TypingPracticeGame"), "TypingPracticeGame");
const TypingPracticeResult = lazyPage(() => import("./pages/user/TypingPracticeResult"), "TypingPracticeResult");
const MockExamPaperList = lazyPage(() => import("./pages/admin/MockExamPaperList"), "MockExamPaperList");
const MockExamPaperEditor = lazyPage(() => import("./pages/admin/MockExamPaperEditor"), "MockExamPaperEditor");
const MockExamPaperScores = lazyPage(() => import("./pages/admin/MockExamPaperScores"), "MockExamPaperScores");
const MockExamReviewList = lazyPage(() => import("./pages/admin/MockExamReviewList"), "MockExamReviewList");
const MockExamAiReviewConfig = lazyPage(() => import("./pages/admin/MockExamAiReviewConfig"), "MockExamAiReviewConfig");
const MockExamLaunchConfig = lazyPage(() => import("./pages/admin/MockExamLaunchConfig"), "MockExamLaunchConfig");
const QuestionBank = lazyPage(() => import("./pages/admin/QuestionBank"), "QuestionBank");
const BookQuestionBankAdmin = lazyPage(() => import("./pages/admin/BookQuestionBankAdmin"), "BookQuestionBankAdmin");
const TypingPracticeAdmin = lazyPage(() => import("./pages/admin/TypingPracticeAdmin"), "TypingPracticeAdmin");
const CourseDetail = lazyPage(() => import("./pages/user/CourseDetail"), "CourseDetail");
const AudioPlayer = lazyPage(() => import("./pages/user/AudioPlayer"), "AudioPlayer");
const VideoCourseDetail = lazyPage(() => import("./pages/user/VideoCourseDetail"), "VideoCourseDetail");
const VideoPlayer = lazyPage(() => import("./pages/user/VideoPlayer"), "VideoPlayer");
const UserMe = lazyPage(() => import("./pages/user/UserMe"), "UserMe");
const AdminDashboard = lazyPage(() => import("./pages/admin/AdminDashboard"), "AdminDashboard");
const AdminLogin = lazyPage(() => import("./pages/admin/AdminLogin"), "AdminLogin");
const ReviewLogin = lazyPage(() => import("./pages/review/ReviewLogin"), "ReviewLogin");
const ReviewDashboard = lazyPage(() => import("./pages/review/ReviewDashboard"), "ReviewDashboard");
const ReviewPaperList = lazyPage(() => import("./pages/review/ReviewPaperList"), "ReviewPaperList");
const UserList = lazyPage(() => import("./pages/admin/UserList"), "UserList");
const CourseList = lazyPage(() => import("./pages/admin/CourseList"), "CourseList");
const CourseEdit = lazyPage(() => import("./pages/admin/CourseEdit"), "CourseEdit");
const CourseContent = lazyPage(() => import("./pages/admin/CourseContent"), "CourseContent");
const AudioLibrary = lazyPage(() => import("./pages/admin/AudioLibrary"), "AudioLibrary");
const VideoLibrary = lazyPage(() => import("./pages/admin/VideoLibrary"), "VideoLibrary");
const LawAdmin = lazyPage(() => import("./pages/admin/LawAdmin"), "LawAdmin");
const AdminAccountList = lazyPage(() => import("./pages/admin/AdminAccountList"), "AdminAccountList");
const SystemConfig = lazyPage(() => import("./pages/admin/SystemConfig"), "SystemConfig");
const SystemImageConfig = lazyPage(() => import("./pages/admin/SystemImageConfig"), "SystemImageConfig");
const SystemLogs = lazyPage(() => import("./pages/admin/SystemLogs"), "SystemLogs");

export const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<PortalHome />),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/login",
    element: withSuspense(<UserLogin />),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/legal/:slug",
    element: withSuspense(<PortalLegalPage />),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/user",
    element: withSuspense(<UserLayout />),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/user/courses" replace /> },
      { path: "courses", element: withSuspense(<MyCourses />) },
      { path: "my-courses", element: withSuspense(<UserCourseLibrary />) },
      { path: "laws", element: withSuspense(<LawSearch />) },
      { path: "mock-exams", element: withSuspense(<MockExamHome />) },
      { path: "objective-mock-exams", element: withSuspense(<MockExamHome />) },
      { path: "my-exams", element: withSuspense(<UserMockExamHistory />) },
      { path: "exam-leaderboard", element: withSuspense(<UserMockExamLeaderboard />) },
      { path: "book-question-banks", element: withSuspense(<MyBookQuestionBanks />) },
      { path: "book-question-banks/:bookId", element: withSuspense(<BookQuestionBankDetail />) },
      { path: "book-question-banks/:bookId/items/:bookItemId", element: withSuspense(<BookQuestionBankPractice />) },
      { path: "mock-exams/papers/:paperId", element: withSuspense(<MockExamLaunch />) },
      { path: "mock-exams/papers/:paperId/launch", element: <LegacyMockExamLaunchRedirect /> },
      { path: "mock-exams/records/:recordId", element: withSuspense(<MockExamRoom />) },
      { path: "mock-exams/records/:recordId/review-pending", element: withSuspense(<MockExamReviewPending />) },
      { path: "mock-exams/records/:recordId/result", element: withSuspense(<MockExamResult />) },
      { path: "typing-practice", element: withSuspense(<TypingPracticeHome />) },
      { path: "typing-practice/texts/:textId/play", element: withSuspense(<TypingPracticeGame />) },
      { path: "typing-practice/records/:recordId", element: withSuspense(<TypingPracticeResult />) },
      { path: "course/:courseId", element: withSuspense(<CourseDetail />) },
      { path: "player/:courseId/:audioId", element: withSuspense(<AudioPlayer />) },
      { path: "video-course/:courseId", element: withSuspense(<VideoCourseDetail />) },
      { path: "video-player/:courseId/:videoId", element: withSuspense(<VideoPlayer />) },
      { path: "me", element: withSuspense(<UserMe />) },
    ],
  },
  {
    path: "/admin/login",
    element: withSuspense(<AdminLogin />),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/adminpg/login",
    element: withSuspense(<ReviewLogin />),
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/admin",
    element: withSuspense(<AdminLayout />),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: withSuspense(<AdminDashboard />) },
      { path: "admins", element: withSuspense(<AdminAccountList />) },
      { path: "users", element: withSuspense(<UserList />) },
      { path: "courses", element: withSuspense(<CourseList />) },
      { path: "courses/new", element: withSuspense(<CourseEdit />) },
      { path: "courses/:courseId/edit", element: withSuspense(<CourseEdit />) },
      { path: "courses/:courseId/content", element: withSuspense(<CourseContent />) },
      { path: "library", element: withSuspense(<AudioLibrary />) },
      { path: "video-library", element: withSuspense(<VideoLibrary />) },
      { path: "laws", element: withSuspense(<LawAdmin />) },
      { path: "mock-exams", element: <Navigate to="/admin/mock-exams/papers" replace /> },
      { path: "mock-exams/question-bank", element: withSuspense(<QuestionBank />) },
      { path: "book-question-banks", element: withSuspense(<BookQuestionBankAdmin />) },
      { path: "mock-exams/papers", element: withSuspense(<MockExamPaperList />) },
      { path: "mock-exams/scores", element: withSuspense(<MockExamPaperScores />) },
      { path: "mock-exams/papers/:paperId/scores", element: withSuspense(<MockExamPaperScores />) },
      { path: "mock-exams/papers/new", element: withSuspense(<MockExamPaperEditor />) },
      { path: "mock-exams/papers/:paperId/edit", element: withSuspense(<MockExamPaperEditor />) },
      { path: "mock-exams/reviews", element: <Navigate to="/adminpg/papers" replace /> },
      { path: "mock-exams/launch-settings", element: withSuspense(<MockExamLaunchConfig />) },
      { path: "mock-exams/ai-review-settings", element: withSuspense(<MockExamAiReviewConfig />) },
      { path: "typing-practice", element: withSuspense(<TypingPracticeAdmin />) },
      { path: "logs", element: withSuspense(<SystemLogs />) },
      { path: "settings", element: withSuspense(<SystemConfig />) },
      { path: "image-settings", element: withSuspense(<SystemImageConfig />) },
    ],
  },
  {
    path: "/adminpg",
    element: withSuspense(<ReviewLayout />),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/adminpg/dashboard" replace /> },
      { path: "dashboard", element: withSuspense(<ReviewDashboard />) },
      { path: "papers", element: withSuspense(<ReviewPaperList />) },
      { path: "papers/:paperId", element: withSuspense(<MockExamReviewList />) },
      { path: "ai-settings", element: <Navigate to="/admin/mock-exams/ai-review-settings" replace /> },
    ],
  },
  {
    path: "/review/login",
    element: <Navigate to="/adminpg/login" replace />,
  },
  {
    path: "/review",
    element: <Navigate to="/adminpg/dashboard" replace />,
  },
  {
    path: "/review/dashboard",
    element: <Navigate to="/adminpg/dashboard" replace />,
  },
  {
    path: "/review/papers",
    element: <Navigate to="/adminpg/papers" replace />,
  },
  {
    path: "/review/ai-settings",
    element: <Navigate to="/admin/mock-exams/ai-review-settings" replace />,
  },
  {
    path: "/user/shop/*",
    element: <Navigate to="/user/courses" replace />,
  },
  {
    path: "/admin/shop/*",
    element: <Navigate to="/admin/courses" replace />,
  },
  {
    path: "*",
    element: withSuspense(<PortalNotFound />),
  },
]);
