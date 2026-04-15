const getTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export const getDevicesToEvictForNewLogin = (devices = [], limit = 5) => {
  if (!Array.isArray(devices) || devices.length === 0) return [];

  const overflowCount = Math.max(0, devices.length - limit + 1);
  if (overflowCount <= 0) return [];

  return [...devices]
    .sort((left, right) => {
      const loginDiff = getTime(left.loginAt) - getTime(right.loginAt);
      if (loginDiff !== 0) return loginDiff;

      const updatedDiff = getTime(left.updatedAt ?? left.loginAt) - getTime(right.updatedAt ?? right.loginAt);
      if (updatedDiff !== 0) return updatedDiff;

      return `${left.id}`.localeCompare(`${right.id}`);
    })
    .slice(0, overflowCount)
    .map((device) => device.id);
};
