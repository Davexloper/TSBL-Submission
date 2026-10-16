
const SESSION_DURATION = 8 * 60 * 60 * 1000;

const HEADERS = {
    "Content-Type": "text/html; charset=UTF-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatLabel(key) {
    const labels = {
        discord: "Discord Username",
        level: "Level",
        profile: "Player Profile",
        completion: "Completion Video",
        footage: "Raw Footage",
        percent: "Completion Percentage",
        fps: "FPS",
        id: "Submission ID",
        submittedAt: "Submitted At",
        status: "Status"
    };

    if (labels[key]) return labels[key];

    return key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

function formatValue(value) {
    if (value === null || value === undefined || value === "") {
        return "No answer provided";
    }

    if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
    }

    return String(value);
}

function renderAnswer(value) {
    const text = escapeHtml(formatValue(value));

    if (
        typeof value === "string" &&
        /^https?:\/\/\S+$/i.test(value)
    ) {
        return `
            <a class="answer-link"
               href="${text}"
               target="_blank"
               rel="noopener noreferrer">${text}</a>
        `;
    }

    return text;
}

async function sign(value, secret) {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(value)
    );

    return Array.from(new Uint8Array(signature))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function constantTimeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") {
        return false;
    }

    let difference = a.length ^ b.length;
    const length = Math.max(a.length, b.length);

    for (let i = 0; i < length; i++) {
        difference |=
            (a.charCodeAt(i) || 0) ^
            (b.charCodeAt(i) || 0);
    }

    return difference === 0;
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get("Cookie") || "";

    for (const cookie of cookieHeader.split(";")) {
        const separator = cookie.indexOf("=");

        if (separator === -1) continue;

        const key = cookie.slice(0, separator).trim();
        const value = cookie.slice(separator + 1).trim();

        if (key === name) return value;
    }

    return "";
}

async function createSession(secret) {
    const expires = Date.now() + SESSION_DURATION;
    const value = String(expires);
    const signature = await sign(value, secret);

    return `${value}.${signature}`;
}

async function validSession(request, secret) {
    const session = getCookie(request, "root_session");
    const separator = session.indexOf(".");

    if (separator === -1) return false;

    const expires = session.slice(0, separator);
    const signature = session.slice(separator + 1);

    if (!/^\d+$/.test(expires)) return false;
    if (Number(expires) <= Date.now()) return false;

    const expected = await sign(expires, secret);

    return constantTimeEqual(signature, expected);
}

function page(content, title = "Admin Panel") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(title)} | The Spacebar List</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #0c0e12;
            --panel: #14171e;
            --card: #1b1f28;
            --border: #2a303b;
            --text: #f2f5f9;
            --muted: #929baa;
            --accent: #00bfff;
            --accent-hover: #38ccff;
            --danger: #ff626f;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            padding: 36px 18px;
            background:
                radial-gradient(ellipse at top, #14232e 0%, transparent 48%),
                var(--bg);
            color: var(--text);
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont,
                "Segoe UI", sans-serif;
        }

        button, input {
            font: inherit;
        }

        button, a {
            -webkit-tap-highlight-color: transparent;
        }

        .container {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
        }

        .brand {
            margin-bottom: 28px;
        }

        .brand-name {
            margin: 0;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 2.4px;
            color: var(--accent);
            text-transform: uppercase;
        }

        .brand-subtitle {
            margin-top: 8px;
            color: var(--muted);
            font-size: 14px;
        }

        .panel {
            background: rgba(20, 23, 30, 0.96);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 26px;
            box-shadow: 0 24px 80px #0004;
        }

        h1 {
            margin: 0;
            font-size: clamp(24px, 4vw, 32px);
            letter-spacing: -0.8px;
        }

        .subtitle {
            color: var(--muted);
            margin: 9px 0 0;
            line-height: 1.6;
        }

        .login-panel {
            max-width: 460px;
            margin: 8vh auto 0;
        }

        .field {
            margin-top: 26px;
        }

        .field label {
            display: block;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 9px;
        }

        input {
            width: 100%;
            padding: 14px 15px;
            color: var(--text);
            background: #0e1117;
            border: 1px solid var(--border);
            border-radius: 10px;
            outline: none;
        }

        input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px #00bfff1c;
        }

        .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 44px;
            padding: 11px 17px;
            color: var(--text);
            background: #202631;
            border: 1px solid var(--border);
            border-radius: 10px;
            font-weight: 750;
            text-decoration: none;
            cursor: pointer;
            transition: background .18s, border-color .18s,
                transform .18s, opacity .18s;
        }

        .button:hover {
            background: #2a3240;
            border-color: #485364;
        }

        .button:active {
            transform: scale(.97);
        }

        .button:disabled {
            opacity: .35;
            cursor: not-allowed;
            transform: none;
        }

        .button-primary {
            color: #001018;
            background: var(--accent);
            border-color: var(--accent);
        }

        .button-primary:hover {
            background: var(--accent-hover);
            border-color: var(--accent-hover);
        }

        .button-danger {
            color: #ff929b;
        }

        .full-width {
            width: 100%;
            margin-top: 18px;
        }

        .message {
            margin-top: 18px;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 14px;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }

        .message-error {
            color: #ffadb4;
            background: #ff626f12;
            border: 1px solid #ff626f35;
        }

        .message-success {
            color: #8ef0c0;
            background: #39d98a12;
            border: 1px solid #39d98a35;
        }

        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 14px;
            margin-top: 26px;
            padding-bottom: 22px;
            border-bottom: 1px solid var(--border);
        }

        .toolbar-label {
            color: var(--muted);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1.1px;
            text-transform: uppercase;
        }

        .navigator {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .counter {
            min-width: 65px;
            text-align: center;
            font-weight: 800;
            font-variant-numeric: tabular-nums;
        }

        .arrow {
            width: 44px;
            height: 44px;
            padding: 0;
            font-size: 23px;
        }

        .submission-heading {
            margin: 24px 0 18px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            flex-wrap: wrap;
        }

        .submission-heading h2 {
            margin: 0;
            font-size: 20px;
        }

        .submission-meta {
            margin-top: 7px;
            color: var(--muted);
            font-size: 13px;
            overflow-wrap: anywhere;
        }

        .answer-list {
            display: grid;
            gap: 13px;
        }

        .answer-card {
            min-width: 0;
            padding: 18px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            animation: fade-in .22s ease both;
        }

        .question-number {
            color: var(--accent);
            font-size: 11px;
            font-weight: 850;
            letter-spacing: 1.2px;
            text-transform: uppercase;
        }

        .question {
            margin-top: 8px;
            font-size: 15px;
            font-weight: 800;
            overflow-wrap: anywhere;
        }

        .answer {
            margin-top: 10px;
            color: #c5ccd7;
            font-size: 14px;
            line-height: 1.75;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .answer-link {
            color: var(--accent);
            text-decoration: none;
            overflow-wrap: anywhere;
        }

        .answer-link:hover {
            text-decoration: underline;
        }

        .empty {
            padding: 42px 20px;
            text-align: center;
            border: 1px dashed #38404d;
            border-radius: 13px;
            color: var(--muted);
            line-height: 1.7;
        }

        .empty strong {
            display: block;
            margin-bottom: 8px;
            color: var(--text);
            font-size: 18px;
        }

        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
        }

        .footer-note {
            color: var(--muted);
            font-size: 12px;
        }

        @keyframes fade-in {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 560px) {
            body {
                padding: 22px 12px;
            }

            .panel {
                padding: 19px;
                border-radius: 14px;
            }

            .toolbar {
                align-items: flex-start;
                flex-direction: column;
            }

            .navigator {
                width: 100%;
                justify-content: space-between;
            }

            .answer-card {
                padding: 15px;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: .01ms !important;
                transition-duration: .01ms !important;
            }
        }
    </style>
</head>
<body>
    <main class="container">
        <header class="brand">
            <p class="brand-name">The Spacebar List</p>
            <div class="brand-subtitle">Private Administration Panel</div>
        </header>
        ${content}
    </main>
</body>
</html>`;
}

function loginPage(error = "") {
    return page(`
        <section class="panel login-panel">
            <h1>Admin Login</h1>
            <p class="subtitle">
                Sign in to view and manage record submissions.
            </p>

            ${error ? `
                <div class="message message-error" role="alert">
                    ${escapeHtml(error)}
                </div>
            ` : ""}

            <form method="POST" action="/adminpanel21">
                <input type="hidden" name="action" value="login">

                <div class="field">
                    <label for="password">Admin Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        autocomplete="current-password"
                        required
                        autofocus
                    >
                </div>

                <button class="button button-primary full-width" type="submit">
                    Sign In
                </button>
            </form>
        </section>
    `, "Admin Login");
}

function dashboardPage(submissions, index, error = "") {
    const total = submissions.length;

    if (total === 0) {
        return page(`
            <section class="panel">
                <h1>Record Submissions</h1>
                <p class="subtitle">
                    View submitted records and their answers.
                </p>

                <div class="empty" style="margin-top:26px">
                    <strong>No submissions yet</strong>
                    New submissions will appear here once someone submits
                    the record form.
                </div>

                ${error ? `
                    <div class="message message-error" role="alert">
                        ${escapeHtml(error)}
                    </div>
                ` : ""}

                <footer class="footer">
                    <span class="footer-note">The Spacebar List Admin</span>
                    <form method="POST" action="/adminpanel21">
                        <input type="hidden" name="action" value="logout">
                        <button class="button button-danger" type="submit">
                            Log Out
                        </button>
                    </form>
                </footer>
            </section>
        `, "Submissions");
    }

    const safeIndex = Math.min(Math.max(index, 0), total - 1);
    const submission = submissions[safeIndex];

    const excludedFields = new Set(["id", "submittedAt"]);
    const fields = Object.entries(submission).filter(
        ([key]) => !excludedFields.has(key)
    );

    const answers = fields.map(([key, value], i) => `
        <article class="answer-card">
            <div class="question-number">Question ${i + 1}</div>
            <div class="question">${escapeHtml(formatLabel(key))}</div>
            <div class="answer">${renderAnswer(value)}</div>
        </article>
    `).join("");

    const submittedAt = submission.submittedAt
        ? new Date(submission.submittedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC"
        }) + " UTC"
        : "Unknown";

    return page(`
        <section class="panel">
            <h1>Record Submissions</h1>
            <p class="subtitle">
                Browse submissions and review every answer.
            </p>

            ${error ? `
                <div class="message message-error" role="alert">
                    ${escapeHtml(error)}
                </div>
            ` : ""}

            <div class="toolbar">
                <span class="toolbar-label">Submission Navigator</span>

                <nav class="navigator" aria-label="Submission navigation">
                    <form method="POST" action="/adminpanel21">
                        <input type="hidden" name="action" value="navigate">
                        <input type="hidden" name="index" value="${safeIndex - 1}">
                        <button
                            class="button arrow"
                            type="submit"
                            aria-label="Previous submission"
                            ${safeIndex === 0 ? "disabled" : ""}
                        >&#8592;</button>
                    </form>

                    <span class="counter">${safeIndex + 1} / ${total}</span>

                    <form method="POST" action="/adminpanel21">
                        <input type="hidden" name="action" value="navigate">
                        <input type="hidden" name="index" value="${safeIndex + 1}">
                        <button
                            class="button arrow"
                            type="submit"
                            aria-label="Next submission"
                            ${safeIndex >= total - 1 ? "disabled" : ""}
                        >&#8594;</button>
                    </form>
                </nav>
            </div>

            <div class="submission-heading">
                <div>
                    <h2>Submission ${safeIndex + 1}</h2>
                    <div class="submission-meta">
                        Submitted: ${escapeHtml(submittedAt)}
                    </div>
                    <div class="submission-meta">
                        ID: ${escapeHtml(submission.id || "Unavailable")}
                    </div>
                </div>
            </div>

            <div class="answer-list">
                ${answers || `
                    <div class="empty">
                        This submission contains no answers.
                    </div>
                `}
            </div>

            <footer class="footer">
                <span class="footer-note">
                    ${total} submission${total === 1 ? "" : "s"} total
                </span>

                <form method="POST" action="/adminpanel21">
                    <input type="hidden" name="action" value="logout">
                    <button class="button button-danger" type="submit">
                        Log Out
                    </button>
                </form>
            </footer>
        </section>
    `, "Record Submissions");
}

function redirect(location, cookie = "") {
    const headers = new Headers({
        Location: location,
        "Cache-Control": "no-store"
    });

    if (cookie) headers.append("Set-Cookie", cookie);

    return new Response(null, { status: 303, headers });
}

function cookieHeader(value, maxAge) {
    return `root_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/adminpanel21; Max-Age=${maxAge}`;
}

async function getSubmissions(env) {
    if (!env.SUBMISSIONS) {
        throw new Error("The SUBMISSIONS KV binding is missing.");
    }

    const submissions =
        await env.SUBMISSIONS.get("submissions", "json") || [];

    if (!Array.isArray(submissions)) {
        throw new Error("Stored submissions have an invalid format.");
    }

    return submissions;
}

export async function onRequest({ request, env }) {
    const url = new URL(request.url);

    if (url.pathname !== "/adminpanel21") {
        return new Response("Not Found", {
            status: 404,
            headers: HEADERS
        });
    }

    if (!env.ROOT_PASSWORD || !env.SESSION_SECRET) {
        return new Response(
            "Server configuration error. Check ROOT_PASSWORD and SESSION_SECRET.",
            { status: 500, headers: HEADERS }
        );
    }

    const isLoggedIn = await validSession(request, env.SESSION_SECRET);

    if (request.method === "GET") {
        if (!isLoggedIn) {
            return new Response(loginPage(), {
                status: 200,
                headers: HEADERS
            });
        }

        try {
            const submissions = await getSubmissions(env);
            const requestedIndex = Number(url.searchParams.get("index") || 0);
            const index = Number.isFinite(requestedIndex)
                ? Math.trunc(requestedIndex)
                : 0;

            return new Response(dashboardPage(submissions, index), {
                status: 200,
                headers: HEADERS
            });
        } catch (error) {
            return new Response(
                page(`
                    <section class="panel">
                        <h1>Storage Error</h1>
                        <p class="subtitle">
                            The submissions could not be loaded.
                        </p>
                        <div class="message message-error">
                            ${escapeHtml(error.message)}
                        </div>
                        <a class="button" href="/adminpanel21">Try Again</a>
                    </section>
                `, "Storage Error"),
                { status: 500, headers: HEADERS }
            );
        }
    }

    if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: { ...HEADERS, Allow: "GET, POST" }
        });
    }

    const contentType = request.headers.get("Content-Type") || "";

    if (!contentType.includes("application/x-www-form-urlencoded")) {
        return new Response("Unsupported content type.", {
            status: 415,
            headers: HEADERS
        });
    }

    const form = await request.formData();
    const action = String(form.get("action") || "");

    if (action === "login") {
        const password = String(form.get("password") || "");

        if (!constantTimeEqual(password, env.ROOT_PASSWORD)) {
            return new Response(loginPage("Incorrect password. Please try again."), {
                status: 401,
                headers: HEADERS
            });
        }

        const session = await createSession(env.SESSION_SECRET);

        return redirect(
            "/adminpanel21",
            cookieHeader(session, SESSION_DURATION / 1000)
        );
    }

    if (action === "logout") {
        return redirect(
            "/adminpanel21",
            cookieHeader("", 0)
        );
    }

    if (action === "navigate") {
        if (!isLoggedIn) {
            return redirect("/adminpanel21");
        }

        const requestedIndex = Number(form.get("index"));

        if (!Number.isFinite(requestedIndex)) {
            return redirect("/adminpanel21");
        }

        try {
            const submissions = await getSubmissions(env);
            const index = Math.min(
                Math.max(Math.trunc(requestedIndex), 0),
                Math.max(submissions.length - 1, 0)
            );

            return redirect(`/adminpanel21?index=${index}`);
        } catch {
            return new Response(
                page(`
                    <section class="panel">
                        <h1>Storage Error</h1>
                        <p class="subtitle">
                            The submissions could not be loaded.
                        </p>
                        <a class="button" href="/adminpanel21">Try Again</a>
                    </section>
                `, "Storage Error"),
                { status: 500, headers: HEADERS }
            );
        }
    }

    return new Response("Bad Request", {
        status: 400,
        headers: HEADERS
    });
}
