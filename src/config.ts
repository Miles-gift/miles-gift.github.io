import type {
    SiteConfig,
    ProfileConfig,
    LicenseConfig
} from "./types/config"

import type { FriendLink } from "./types/friend"

export const siteConfig: SiteConfig = {
    title: "Miles",
    subTitle: "工程、学习与成长",

    favicon: "/brand/miles-mark.svg", // Path of the favicon, relative to the /public directory

    pageSize: 6, // Number of posts per page
    toc: {
        enable: true,
        depth: 3 // Max depth of the table of contents, between 1 and 4
    },
    blogNavi: {
        enable: true // Whether to enable blog navigation in the blog footer
    },
    comments: {
        enable: false, // Disabled until a self-controlled comment service is configured
        platform: "default", // Comment platform, set "default" to use Momo-backend, also supports "twikoo"
        backendUrl: "" // Backend URL for comments
    },
    theme: {
        AOS: false, // Motion is limited to the orchestrated opening sequence
        LQIP: true, // Whether to enable LQIP (Low-Quality Image Placeholder) for image placeholders
        PhotoSwipe: true, // Whether to enable PhotoSwipe for image viewer
        postCard: {
            imageMode: "top" // Cover image mode for article cards: "top" shows the image above the content; "background" uses the image as the card background, fading to transparent from right to left
        }
    }
}

export const profileConfig: ProfileConfig = {
    avatar: "/brand/miles-mark.svg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
    name: "Miles",
    description: "Miles 的工程实践、学习笔记与成长记录。",
    indexPage: "https://github.com/Miles-gift",
    startYear: 2026,
}

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// 友链将在有真实、经过确认的条目后重新开放。
export const friendLinkConfig: FriendLink[] = []
