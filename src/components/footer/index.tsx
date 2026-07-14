import { useEffect, useState } from "react";

type PolicyKey = "cookie" | "privacy";
type ThemeMode = "dark" | "light";
type CookieConsent = "accepted" | "denied";

const THEME_COOKIE_NAME = "typeschema-theme";
const COOKIE_CONSENT_STORAGE_KEY = "typeschema-cookie-consent";

function getThemeFromCookie(): ThemeMode {
    const cookiePair = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${THEME_COOKIE_NAME}=`));

    if (!cookiePair) {
        return "dark";
    }

    const value = cookiePair.split("=")[1];
    return value === "light" ? "light" : "dark";
}

function persistTheme(theme: ThemeMode) {
    document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

function clearThemeCookie() {
    document.cookie = `${THEME_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

function getCookieConsent(): CookieConsent | null {
    const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (value === "accepted" || value === "denied") {
        return value;
    }
    return null;
}

function persistCookieConsent(consent: CookieConsent) {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, consent);
}

const POLICY_CONTENT: Record<PolicyKey, { title: string; body: string[] }> = {
    cookie: {
        title: "Cookie Policy",
        body: [
            "TypeWizard stores a small first-party cookie to remember whether you prefer light mode or dark mode when you return.",
            "The app may also use essential browser storage to remember interface preferences and keep the SQL conversion workspace responsive during your session.",
            "No advertising or third-party tracking cookies are required for the core SQL conversion flow.",
            "If analytics are introduced later, this policy should be updated to describe the provider, retention period, and opt-out controls.",
        ],
    },
    privacy: {
        title: "Privacy Policy",
        body: [
            "Effective Date: July 13, 2026",
            'core softworks ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your information when you visit our website.',
            'Information We Collect',
            'Location Data: We may collect general location data (e.g., city or region) to analyze site usage patterns. This data is collected through cookies or similar technologies and does not directly identify you.',
            'Usage Data: We may collect non-personal data such as pages visited, time spent on the site, and browser type to improve website performance and user experience.',
            'How We Use Your Information',
            'We use the collected information to analyze trends, improve our website, and enhance user experience. No SQL queries are transmitted to our servers and remain client side.',
        ],
    },
};

export default function AppFooter() {
    const initialConsent = getCookieConsent();
    const [activePolicy, setActivePolicy] = useState<PolicyKey | null>(null);
    const [cookieConsent, setCookieConsent] = useState<CookieConsent | null>(initialConsent);
    const [theme, setTheme] = useState<ThemeMode>(() => (initialConsent === "accepted" ? getThemeFromCookie() : "dark"));

    const policy = activePolicy ? POLICY_CONTENT[activePolicy] : null;

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;

        if (cookieConsent === "accepted") {
            persistTheme(theme);
            return;
        }

        clearThemeCookie();
    }, [cookieConsent, theme]);

    useEffect(() => {
        if (!policy) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setActivePolicy(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [policy]);

    const onAcceptCookies = () => {
        setCookieConsent("accepted");
        persistCookieConsent("accepted");
        persistTheme(theme);
    };

    const onDenyCookies = () => {
        setCookieConsent("denied");
        persistCookieConsent("denied");
        clearThemeCookie();
    };

    return (
        <>
            <footer className="app-footer">
                <div className="app-footer-branding">
                    <div className="core-softworks-logo" aria-hidden="true" onClick={() => { 
                        window.open("https://coresoftworks.com", "_blank");
                    }}></div>
                </div>

                <div className="app-footer-links">
                    <button
                        type="button"
                        className="app-footer-link-button footer-theme-button"
                        aria-pressed={theme === "light"}
                        onClick={() => setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"))}
                    >
                        {theme === "light" ? "⏾" : "✸"}
                    </button>
                    <button type="button" className="app-footer-link-button" onClick={() => setActivePolicy("cookie")}>
                        Cookie Policy
                    </button>
                    <button type="button" className="app-footer-link-button" onClick={() => setActivePolicy("privacy")}>
                        Privacy Policy
                    </button>
                </div>
            </footer>

            {policy && (
                <div className="policy-dialog-backdrop" onClick={() => setActivePolicy(null)}>
                    <div
                        className="policy-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="policy-dialog-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="policy-dialog-header">
                            <h2 id="policy-dialog-title">{policy.title}</h2>
                            <button
                                type="button"
                                className="policy-dialog-close"
                                aria-label="Close policy dialog"
                                onClick={() => setActivePolicy(null)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="policy-dialog-content">
                            {policy.body.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!cookieConsent && (
                <div className="cookie-banner" role="region" aria-label="Cookie consent">
                    <p>
                        TypeWizard uses cookies only for theme preferences. You can accept or deny optional cookies.
                    </p>
                    <div className="cookie-banner-actions">
                        <button type="button" className="footer-link-button accept" onClick={onAcceptCookies}>
                            Accept
                        </button>
                        <button type="button" className="footer-link-button deny" onClick={onDenyCookies}>
                            Deny
                        </button>
                        <button type="button" className="footer-link-button learn-more" onClick={() => setActivePolicy("cookie")}>
                            Learn More
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}