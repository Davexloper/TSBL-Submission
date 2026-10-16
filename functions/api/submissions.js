
export async function onRequest({ request, env }) {
    const headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    };

    if (request.method !== "POST") {
        return Response.json(
            { error: "Method not allowed" },
            { status: 405, headers: { ...headers, Allow: "POST" } }
        );
    }

    if (!env.SUBMISSIONS) {
        return Response.json(
            { error: "SUBMISSIONS KV binding is missing." },
            { status: 500, headers }
        );
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
        return Response.json(
            { error: "Expected JSON." },
            { status: 415, headers }
        );
    }

    const body = await request.text();

    if (body.length > 30000) {
        return Response.json(
            { error: "Submission is too large." },
            { status: 413, headers }
        );
    }

    let data;

    try {
        data = JSON.parse(body);
    } catch {
        return Response.json(
            { error: "Invalid JSON." },
            { status: 400, headers }
        );
    }

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        return Response.json(
            { error: "Invalid submission." },
            { status: 400, headers }
        );
    }

    const submission = {
        id: crypto.randomUUID(),
        submittedAt: new Date().toISOString(),
        status: "Pending",
        ...data
    };

    try {
        const existing =
            await env.SUBMISSIONS.get("submissions", "json") || [];

        if (!Array.isArray(existing)) {
            throw new Error("Stored submissions are not an array.");
        }

        existing.push(submission);

        await env.SUBMISSIONS.put(
            "submissions",
            JSON.stringify(existing)
        );

        return Response.json(
            {
                success: true,
                message: "Submission saved.",
                id: submission.id
            },
            { status: 201, headers }
        );
    } catch {
        return Response.json(
            { error: "Could not save submission." },
            { status: 500, headers }
        );
    }
}
