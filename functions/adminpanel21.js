
const encoder = new TextEncoder();
const SESSION_DURATION = 8 * 60 * 60 * 1000;

async function sign(value, secret) {
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

    return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function page(content, status = 200) {
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>The Spacebar List | Root Panel</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:22px;background:#111318;color:#edf0f7;font-family:Arial,sans-serif}
main{max-width:850px;margin:30px auto;background:#191c23;border:1px solid #303642;border-radius:14px;padding:25px}
.brand{color:#00bfff;font-size:12px;font-weight:bold;letter-spacing:2px}
h1{font-size:28px;margin:15px 0}
h2{font-size:20px;overflow-wrap:anywhere}
p{color:#a7afbd;line-height:1.6}
.panel{background:#11141a;border:1px solid #303642;border-radius:9px;padding:18px;margin:20px 0}
pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font:13px/1.7 Consolas,monospace;color:#dce6f4}
button{padding:12px 17px;border:0;border-radius:7px;background:#00bfff;color:#071117;font-weight:bold;cursor:pointer}
button:hover{background:#55d5ff}
button:disabled{opacity:.3;cursor:not-allowed}
input{width:100%;padding:13px;background:#111318;color:white;border:1px solid #394150;border-radius:7px}
label{display:block;margin:22px 0 8px;font-size:14px;font-weight:bold}
.full{width:100%;margin-top:15px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px}
.nav{display:flex;gap:12px;margin:24px 0}
.nav form{flex:1}
.nav button{width:100%}
.error{color:#ff8585}
.muted{font-size:12px;color:#858e9e}
@media(max-width:550px){body{padding:10px}main{margin:10px auto;padding:17px}.top{align-items:flex-start}}
</style>
</head>
<body><main>${content}</main></body>
</html>`, {
        status,
        headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY",
            "Content-Security-Policy":
                "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
        }
    });
}

function loginPage(error = false) {
    return page(`
        <div class="brand">THE SPACEBAR LIST</div>
        <h1>Root Login</h1>
        <p>Sign in to view record submissions.</p>
        ${error ? '<p class="error">Incorrect password. Try again.</p>' : ""}
        <form method="POST" action="/adminpanel21">
            <label for="password">Root password</label>
            <input id="password" name="password" type="password"
                autocomplete="current-password" required autofocus>
            <button class="full" type="submit">Login</button>
        </form>
    `);
}

function redirect(location, cookie) {
    const headers = new Headers({
        Location: location,
        "Cache-Control": "no-store"
    });

    if (cookie) {
        headers.set("Set-Cookie", cookie);
    }

    return new Response(null, { status: 303, headers });
}

async function validSession(request, secret) {
    const cookies = request.headers.get("Cookie") || "";
    const match = cookies.match(
        /(?:^|;\s*)root_session=([A-Za-z0-9_.-]+)/
    );

    if (!match) return false;

    const parts = match[1].split(".");
    if (parts.length !== 2) return false;

    const [expires, signature] = parts;
    const expiry = Number(expires);

    if (
        !Number.isSafeInteger(expiry) ||
        expiry <= Date.now() ||
        expiry > Date.now() + SESSION_DURATION + 60000
    ) {
        return false;
    }

    return signature === await sign(expires, secret);
}

async function getSubmissions(env) {
    if (!env.SUBMISSIONS) {
        throw new Error("SUBMISSIONS KV binding is missing.");
    }

    const data = await env.SUBMISSIONS.get("submissions", "json");
    return Array.isArray(data) ? data : [];
}

function dashboard(submissions, index) {
    const count = submissions.length;

    if (count === 0) {
        return page(`
            <div class="top">
                <div class="brand">THE SPACEBAR LIST</div>
                <form method="POST" action="/adminpanel21">
                    <button name="logout" value="1">Logout</button>
                </form>
            </div>
            <h1>Record Submissions</h1>
            <div class="panel">
                <h2>No submissions yet</h2>
                <p>There are no record submissions...</p>
            </div>
        `);
    }

    const current = Math.max(0, Math.min(index, count - 1));
    const submission = submissions[current];

    const level =
        submission.level ||
        submission.levelName ||
        submission.level_name ||
        submission.name ||
        `Submission #${current + 1}`;

    return page(`
        <div class="top">
            <div class="brand">THE SPACEBAR LIST</div>
            <form method="POST" action="/adminpanel21">
                <button name="logout" value="1">Logout</button>
            </form>
        </div>

        <h1>Record Submissions</h1>
        <p>Submission ${current + 1} of ${count}</p>

        <div class="panel">
            <h2>${escapeHtml(level)}</h2>
            <pre>${escapeHtml(JSON.stringify(submission, null, 2))}</pre>
        </div>

        <div class="nav">
            <form method="POST" action="/adminpanel21">
                <input type="hidden" name="index" value="${current - 1}">
                <button name="navigate" value="previous"
                    ${current === 0 ? "disabled" : ""}>← Previous</button>
            </form>

            <form method="POST" action="/adminpanel21">
                <input type="hidden" name="index" value="${current + 1}">
                <button name="navigate" value="next"
                    ${current >= count - 1 ? "disabled" : ""}>Next →</button>
            </form>
        </div>

        <p class="muted">All submitted fields are shown above.</p>
    `);
}

export async function onRequest({ request, env }) {
    if (!env.ROOT_PASSWORD || !env.SESSION_SECRET) {
        return page(
            "<h1>Configuration Error</h1><p>Set ROOT_PASSWORD and SESSION_SECRET in Cloudflare.</p>",
            500
        );
    }

    if (request.method !== "GET" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: { Allow: "GET, POST", "Cache-Control": "no-store" }
        });
    }

    const loggedIn = await validSession(request, env.SESSION_SECRET);

    if (request.method === "GET") {
        if (!loggedIn) return loginPage();

        try {
            const submissions = await getSubmissions(env);
            const url = new URL(request.url);
            const index = Number(url.searchParams.get("index") || 0);

            return dashboard(
                submissions,
                Number.isFinite(index) ? index : 0
            );
        } catch {
            return page(`
                <h1>Storage Error</h1>
                <p>Cloudflare KV binding SUBMISSIONS is missing or unavailable.</p>
            `, 500);
        }
    }

    let form;

    try {
        form = await request.formData();
    } catch {
        return page("<h1>Invalid request</h1>", 400);
    }

    if (form.get("logout") === "1") {
        return redirect(
            "/adminpanel21",
            "root_session=; Path=/adminpanel21; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
        );
    }

    if (!loggedIn) {
        const password = form.get("password");

        if (
            typeof password !== "string" ||
            password !== env.ROOT_PASSWORD
        ) {
            return loginPage(true);
        }

        const expires = String(Date.now() + SESSION_DURATION);
        const signature = await sign(expires, env.SESSION_SECRET);

        return redirect(
            "/adminpanel21",
            `root_session=${expires}.${signature}; Path=/adminpanel21; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`
        );
    }

    const requestedIndex = Number(form.get("index") || 0);

    try {
        const submissions = await getSubmissions(env);

        return dashboard(
            submissions,
            Number.isFinite(requestedIndex) ? requestedIndex : 0
        );
    } catch {
        return page("<h1>Could not load submissions.</h1>", 500);
    }
}
