import { Suspense, lazy } from "react";
import type { ComponentType, ReactNode } from "react";
import { Navigate, createBrowserRouter, useLocation } from "react-router";

const lazyPage = <T extends Record<string, unknown>>(loader: () => Promise<T>, exportName: keyof T) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });

const RouteLoading = () => <div className="p-8 text-slate-500">页面加载中...</div>;

const withSuspense = (element: ReactNode) => <Suspense fallback={<RouteLoading />}>{element}</Suspense>;

function LegacyUserLoginRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/", search: location.search, hash: location.hash }} replace />;
}

function UserShopHiddenRedirect() {
  return <Navigate to="/user/courses" replace />;
}

function AdminShopHiddenRedirect() {
  return <Navigate to="/admin/courses" replace />;
}

const UserLayout = lazyPage(() => import("./layouts/UserLayout"), "UserLayout");
const AdminLayout = lazyPage(() => import("./layouts/AdminLayout"), "AdminLayout");
const UserLogin = lazyPage(() => import("./pages/user/UserLogin"), "UserLogin");
const MyCourses = lazyPage(() => import("./pages/user/MyCourses"), "MyCourses");
const CourseDetail = lazyPage(() => import("./pages/user/CourseDetail"), "CourseDetail");
const AudioPlayer = lazyPage(() => import("./pages/user/AudioPlayer"), "AudioPlayer");
const UserMe = lazyPage(() => import("./pages/user/UserMe"), "UserMe");
const AdminLogin = lazyPage(() => import("./pages/admin/AdminLogin"), "AdminLogin");
const UserList = lazyPage(() => import("./pages/admin/UserList"), "UserList");
const CourseList = lazyPage(() => import("./pages/admin/CourseList"), "CourseList");
const CourseEdit = lazyPage(() => import("./pages/admin/CourseEdit"), "CourseEdit");
const CourseContent = lazyPage(() => import("./pages/admin/CourseContent"), "CourseContent");
const AudioLibrary = lazyPage(() => import("./pages/admin/AudioLibrary"), "AudioLibrary");
const AdminAccountList = lazyPage(() => import("./pages/admin/AdminAccountList"), "AdminAccountList");
const SystemConfig = lazyPage(() => import("./pages/admin/SystemConfig"), "SystemConfig");
const SystemImageConfig = lazyPage(() => import("./pages/admin/SystemImageConfig"), "SystemImageConfig");
const SystemLogs = lazyPage(() => import("./pages/admin/SystemLogs"), "SystemLogs");

export const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<UserLogin />),
  },
  {
    path: "/login",
    element: <LegacyUserLoginRedirect />,
  },
  {
    path: "/user",
    element: withSuspense(<UserLayout />),
    children: [
      { path: "courses", element: withSuspense(<MyCourses />) },
      { path: "course/:courseId", element: withSuspense(<CourseDetail />) },
      { path: "player/:courseId/:audioId", element: withSuspense(<AudioPlayer />) },
      { path: "shop/*", element: <UserShopHiddenRedirect /> },
      { path: "me", element: withSuspense(<UserMe />) },
    ],
  },
  {
    path: "/admin/login",
    element: withSuspense(<AdminLogin />),
  },
  {
    path: "/admin",
    element: withSuspense(<AdminLayout />),
    children: [
      { path: "admins", element: withSuspense(<AdminAccountList />) },
      { path: "users", element: withSuspense(<UserList />) },
      { path: "courses", element: withSuspense(<CourseList />) },
      { path: "courses/new", element: withSuspense(<CourseEdit />) },
      { path: "courses/:courseId/edit", element: withSuspense(<CourseEdit />) },
      { path: "courses/:courseId/content", element: withSuspense(<CourseContent />) },
      { path: "library", element: withSuspense(<AudioLibrary />) },
      { path: "shop/*", element: <AdminShopHiddenRedirect /> },
      { path: "logs", element: withSuspense(<SystemLogs />) },
      { path: "settings", element: withSuspense(<SystemConfig />) },
      { path: "image-settings", element: withSuspense(<SystemImageConfig />) },
    ],
  },
  {
    path: "*",
    element: <LegacyUserLoginRedirect />,
  },
]);
