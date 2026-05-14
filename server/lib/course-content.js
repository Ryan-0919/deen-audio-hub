import { prisma } from "./prisma.js";
import { serializeAudio, serializeAudioListItem, serializeCourse, serializeTag, serializeVideo, serializeVideoListItem } from "./serializers.js";
import { formatDateTime } from "./time.js";

export const COURSE_TYPE_AUDIO = "audio";
export const COURSE_TYPE_VIDEO = "video";

export const readyAudioRelationWhere = {
  audio: {
    is: {
      processStatus: "ready",
    },
  },
};

export const serializeAudioProgress = (progress) =>
  progress
    ? {
        userId: progress.userId,
        courseId: progress.courseId,
        audioId: progress.audioId,
        progress: progress.progress,
        completed: progress.completed,
        lastUpdated: formatDateTime(progress.lastUpdated),
      }
    : undefined;

export const serializeVideoProgress = (progress) =>
  progress
    ? {
        userId: progress.userId,
        courseId: progress.courseId,
        videoId: progress.videoId,
        progress: progress.progress,
        completed: progress.completed,
        lastUpdated: formatDateTime(progress.lastUpdated),
      }
    : undefined;

export const buildAudioProgressMap = (progressList) => new Map(progressList.map((item) => [item.audioId, serializeAudioProgress(item)]));
export const buildVideoProgressMap = (progressList) => new Map(progressList.map((item) => [item.videoId, serializeVideoProgress(item)]));

export const buildAudioTagContent = (courseAudios, progressMap) => ({
  audios: courseAudios.map((item) => serializeAudioListItem(item.audio)),
  progress: courseAudios.map((item) => progressMap.get(item.audioId)).filter(Boolean),
});

export const buildVideoTagContent = (courseVideos, progressMap) => ({
  videos: courseVideos.map((item) => serializeVideoListItem(item.video)),
  progress: courseVideos.map((item) => progressMap.get(item.videoId)).filter(Boolean),
});

export const getCourseCountsSelect = {
  _count: {
    select: {
      courseAudios: true,
      courseVideos: true,
    },
  },
};

export const serializeCourseWithCounts = (course) =>
  serializeCourse(course, course?._count?.courseAudios ?? 0, course?._count?.courseVideos ?? 0);

export const getCourseListWithCounts = async () => {
  const courses = await prisma.course.findMany({
    include: getCourseCountsSelect,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return courses.map(serializeCourseWithCounts);
};

export const getCourseDetailForAdminByType = async (courseId) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      tags: {
        orderBy: { order: "asc" },
      },
      ...getCourseCountsSelect,
    },
  });

  if (!course) return null;

  return {
    course: serializeCourseWithCounts(course),
    tags: course.tags.map(serializeTag),
  };
};

export const getAdminTagAudios = async (tagId) => {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      courseAudios: {
        orderBy: { order: "asc" },
        include: {
          audio: true,
        },
      },
    },
  });

  if (!tag) return null;

  return {
    audios: tag.courseAudios.map((item) => serializeAudio(item.audio)),
    progress: [],
  };
};

export const getAdminTagVideos = async (tagId) => {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      courseVideos: {
        orderBy: { order: "asc" },
        include: {
          video: true,
        },
      },
    },
  });

  if (!tag) return null;

  return {
    videos: tag.courseVideos.map((item) => serializeVideo(item.video)),
    progress: [],
  };
};

export const getVideoLibraryMeta = async () => {
  const [totalVideoCount, referencedCount, pendingScriptCount, tagOptions] = await Promise.all([
    prisma.video.count(),
    prisma.video.count({
      where: {
        courseVideos: {
          some: {},
        },
      },
    }),
    prisma.video.count({
      where: {
        scriptText: null,
      },
    }),
    prisma.tag.findMany({
      where: {
        courseVideos: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    totalVideoCount,
    referencedCount,
    pendingScriptCount,
    tagOptions,
  };
};

export const getVideoFoldersWithCounts = async () => {
  const folders = await prisma.videoFolder.findMany({
    include: {
      _count: {
        select: {
          videos: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    videoCount: folder._count.videos,
  }));
};

export const getVideoLibraryItems = async (query = {}) => {
  const folderId = `${query.folderId ?? ""}`.trim();
  const keyword = `${query.keyword ?? ""}`.trim();
  const courseId = `${query.courseId ?? ""}`.trim();
  const tagId = `${query.tagId ?? ""}`.trim();
  const excludeCourseId = `${query.excludeCourseId ?? ""}`.trim();
  const searchScope = `${query.searchScope ?? "current"}`.trim() === "all" ? "all" : "current";
  const refFilter = `${query.refFilter ?? "all"}`.trim();
  const scriptFilter = `${query.scriptFilter ?? "all"}`.trim();
  const sortMode = `${query.sortMode ?? "uploaded-desc"}`.trim();
  const page = Math.max(Number.parseInt(`${query.page ?? "1"}`, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(`${query.pageSize ?? "15"}`, 10) || 15, 1), 50);
  const relationFilter = {
    ...(courseId ? { courseId } : {}),
    ...(tagId ? { tagId } : {}),
  };
  const courseVideoConditions = [];

  const noCurrentFolderSelected = searchScope === "current" && !folderId;
  const impossibleFilter = noCurrentFolderSelected || (refFilter === "unreferenced" && (courseId || tagId));
  if (refFilter === "unreferenced") {
    courseVideoConditions.push({
      courseVideos: {
        none: {},
      },
    });
  } else if (refFilter === "referenced" || courseId || tagId) {
    courseVideoConditions.push({
      courseVideos: {
        some: relationFilter,
      },
    });
  }

  if (excludeCourseId) {
    courseVideoConditions.push({
      courseVideos: {
        none: {
          courseId: excludeCourseId,
        },
      },
    });
  }

  const where = impossibleFilter
    ? { id: "__empty__" }
    : {
        ...(searchScope === "current" && folderId ? { folderId } : {}),
        ...(keyword
          ? {
              name: {
                contains: keyword,
              },
            }
          : {}),
        ...(scriptFilter === "scripted"
          ? {
              scriptText: {
                not: null,
              },
            }
          : {}),
        ...(scriptFilter === "unscripted"
          ? {
              scriptText: null,
            }
          : {}),
        ...(courseVideoConditions.length === 1
          ? courseVideoConditions[0]
          : courseVideoConditions.length > 1
            ? {
                AND: courseVideoConditions,
              }
            : {}),
      };

  const total = await prisma.video.count({ where });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const videos =
    total === 0
      ? []
      : await prisma.video.findMany({
          where,
          select: {
            id: true,
            name: true,
            folderId: true,
            duration: true,
            scriptText: true,
            handoutUrl: true,
            handoutObjectKey: true,
            handoutName: true,
            objectKey: true,
            objectUrl: true,
            mimeType: true,
            uploadedAt: true,
            folder: {
              select: {
                name: true,
              },
            },
            courseVideos: {
              select: {
                courseId: true,
                tagId: true,
                course: {
                  select: {
                    name: true,
                  },
                },
                tag: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy:
            sortMode === "name-asc"
              ? [{ name: "asc" }, { uploadedAt: "desc" }]
              : [{ uploadedAt: "desc" }, { id: "desc" }],
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

  return {
    items: videos.map((video) => ({
      ...serializeVideo(video),
      folderName: video.folder.name,
      courseRefs: video.courseVideos.map((item) => ({
        courseId: item.courseId,
        courseName: item.course.name,
        tagId: item.tagId,
        tagName: item.tag.name,
      })),
    })),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  };
};

export const getOrderedCourseAudios = async (courseId) => {
  const tags = await prisma.tag.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      courseAudios: {
        where: readyAudioRelationWhere,
        orderBy: { order: "asc" },
        include: { audio: true },
      },
    },
  });

  return tags.flatMap((tag) =>
    tag.courseAudios.map((item) => ({
      tag,
      courseAudio: item,
      audio: item.audio,
    })),
  );
};

export const getOrderedCourseVideos = async (courseId) => {
  const tags = await prisma.tag.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      courseVideos: {
        orderBy: { order: "asc" },
        include: { video: true },
      },
    },
  });

  return tags.flatMap((tag) =>
    tag.courseVideos.map((item) => ({
      tag,
      courseVideo: item,
      video: item.video,
    })),
  );
};
