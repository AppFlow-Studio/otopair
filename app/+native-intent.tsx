export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes("oauth-callback")) {
      const url = new URL(path, "otopair://placeholder");
      return `/oauth-callback${url.search}`;
    }

    return path;
  } catch {
    if (path.includes("oauth-callback")) {
      return "/oauth-callback";
    }

    return path;
  }
}
