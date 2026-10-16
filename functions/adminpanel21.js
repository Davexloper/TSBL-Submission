
const encoder = new TextEncoder();
const SESSION_DURATION = 8 * 60 * 60 * 1000;

async function sign(value, secret) {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        {
            name: "HMAC",
            hash: "SHA-256"
        },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(value)
    );

    return btoa(
        String.fromCharCode(...new Uint8Array(signature))
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function html(content, status = 200) {
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Spacebar List | Root Panel</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            padding: 20px;
            display: grid;
            place-items: center;
            background: #111318;
            color: #eee;
            font-family: Arial, sans-serif;
        }

        main {
            width: 100%;
            max-width: 400px;
            padding: 28px;
            background: #191c23;
            border: 1px solid #303642;
            border-radius: 12px;
        }

        .brand {
            color: #00bfff;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        h1 {
            margin: 12px 0 8px;
            font-size: 27px;
        }

        p {
            color: #9ba3b2;
            font-size: 14px;
            line-height: 1.6;
        }

        label {
            display: block;
            margin-top: 22px;
            font-size: 14px;
            font-weight: bold;
        }

        input {
            width: 100%;
            margin-top: 9px;
            padding: 13px;
            border: 1px solid #394150;
            border-radius: 6px;
            background: #111318;
            color: white;
            font-size: 15px;
        }

        input:focus {
            outline: none;
            border-color: #00bfff;
        }

        button {
            width: 100%;
            margin-top: 16px;
            padding: 13px;
            border: 0;
            border-radius: 6px;
            background: #00bfff;
            color: #071117;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
        }

        button:hover {
            background: #55d5ff;
        }

        .error {
            color: #ff7777;
        }

        .success {
            padding: 12px;
            border: 1px solid #235b4b;
            border-radius: 6px;
            background: #14271f;
            color: #8af0c4;
        }

        .muted {
            font-size: 12px;
        }
    </style>
</head>
<body>
    <main>
        ${content}
    </main>
</body>
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
    return html(`
        <div class="brand">The Spacebar List</div>
        <h1>Root Panel</h1>
        <p>Enter the root password to access the administration area.</p>

        ${error
            ? '<p class="error">Incorrect password. Please try again.</p>'
            : ''
        }

        <form method="POST" action="/adminpanel21">
            <label for="password">Root Password</label>
            <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter password"
                autocomplete="current-password"
                required
                autofocus
            >
            <button type="submit">Login</button>
        </form>

        <p class="muted">Restricted area. Authorized access only.</p>
    `);
}

function dashboard() {
    return html(`
        <div class="brand">The Spacebar List</div>
        <h1>Root Access</h1>

        <p class="success">You are logged in as root.</p>

        <p>
            Authentication is working. The submissions dashboard
            has not been connected yet.
        </p>

        <form method="POST" action="/adminpanel21">
            <input type="hidden" name="logout" value="1">
            <button type="submit">Logout</button>
        </form>
    `);
}

function redirectToLogin() {
    return new Response(null, {
        status: 303,
        headers: {
            "Location": "/adminpanel21",
            "Cache-Control": "no-store",
            "Set-Cookie":
                "root_session=; Path=/adminpanel21; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
        }
    });
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
        expiry > Date.now() + SESSION_DURATION + 60_000
    ) {
        return false;
    }

    const expected = await sign(expires, secret);

    return signature === expected;
}

export async function onRequest({ request, env }) {
    if (!env.ROOT_PASSWORD || !env.SESSION_SECRET) {
        return html(`
            <h1>Configuration Error</h1>
            <p>
                Set the ROOT_PASSWORD and SESSION_SECRET
                secrets in Cloudflare Pages settings.
            </p>
        `, 500);
    }

    if (request.method !== "GET" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: {
                "Allow": "GET, POST",
                "Cache-Control": "no-store"
            }
        });
    }

    const loggedIn = await validSession(
        request,
        env.SESSION_SECRET
    );

    if (request.method === "GET") {
        return loggedIn ? dashboard() : loginPage();
    }

    let form;

    try {
        form = await request.formData();
    } catch {
        return html("<h1>Invalid request</h1>", 400);
    }

    if (form.get("logout") === "1") {
        if (!loggedIn) return redirectToLogin();
        return redirectToLogin();
    }

    if (loggedIn) {
        return dashboard();
    }

    const password = form.get("password");

    if (
        typeof password !== "string" ||
        password !== env.ROOT_PASSWORD
    ) {
        return loginPage(true);
    }

    const expires = String(Date.now() + SESSION_DURATION);
    const signature = await sign(
        expires,
        env.SESSION_SECRET
    );

    return new Response(null, {
        status: 303,
        headers: {
            "Location": "/adminpanel21",
            "Cache-Control": "no-store",
            "Set-Cookie":
                `root_session=${expires}.${signature}; Path=/adminpanel21; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`
        }
    });
}
