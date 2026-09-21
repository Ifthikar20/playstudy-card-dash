import { useEffect } from "react";

/*
  Per-page <title>, description and canonical URL for a single-page app.

  index.html holds the site-wide defaults, plus the social-card (Open Graph /
  Twitter) tags, which link previews read without running JavaScript, so those
  describe the site as a whole. This hook swaps the title, description and
  canonical URL while a page is open and restores the defaults when it closes,
  so a page that doesn't call it never keeps the previous page's title.
*/

export const SITE_NAME = "AnotherNotes";
export const SITE_URL = "https://anothernote.app";

// Read once, before any page has changed them: whatever index.html says.
const DEFAULTS =
  typeof document === "undefined"
    ? { title: SITE_NAME, description: "" }
    : {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      };

export function usePageMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    const descriptionTag = document.querySelector('meta[name="description"]');
    const canonicalTag = document.querySelector('link[rel="canonical"]');

    document.title = `${title} · ${SITE_NAME}`;
    descriptionTag?.setAttribute("content", description);
    canonicalTag?.setAttribute("href", `${SITE_URL}${window.location.pathname}`);

    return () => {
      document.title = DEFAULTS.title;
      descriptionTag?.setAttribute("content", DEFAULTS.description);
      canonicalTag?.setAttribute("href", `${SITE_URL}/`);
    };
  }, [title, description]);
}
