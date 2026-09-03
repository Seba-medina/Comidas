import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

export default async (req) => {
    if (req.method !== "GET") {
        return new Response("Método no permitido", { status: 405 });
    }

    try {
        // Only admin can list users
        const authCheck = await verificarAuth(req, "admin");
        if (!authCheck.ok) {
            return new Response(JSON.stringify({ error: authCheck.error }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const store = getStore("comidas");
        // List all to discover users.
        // Netlify Blobs list({ prefix: "" }) might be too slow if too large, but for a family app it's fine.

        let allKeys = [];
        let listParams = { prefix: "" };

        // Simplification for getting all keys if the dataset is smallish.
        const res = await store.list(listParams);
        allKeys = res.blobs.map(b => b.key);

        const usersMap = {};

        // Determine all users by splitting keys
        for (const key of allKeys) {
            const parts = key.split(":");
            const username = parts[0];
            if (username) {
                if (!usersMap[username]) {
                    usersMap[username] = { hasData: true, password: null };
                }
            }
        }

        // Now look for the password keys explicitly to assign passwords
        for (const key of allKeys) {
            if (key.endsWith(":password")) {
                const username = key.replace(":password", "");
                if (usersMap[username]) {
                    const pass = await store.get(key);
                    usersMap[username].password = pass;
                }
            }
        }

        // Generate output format
        const output = Object.keys(usersMap).map(usuario => {
            let finalPassword = usersMap[usuario].password;
            // Apply the 123456 rule if none set
            if (finalPassword === null && usersMap[usuario].hasData) {
                finalPassword = "123456 (default, sin guardar)";
            }
            return {
                usuario,
                password: finalPassword
            };
        });

        return new Response(JSON.stringify({ ok: true, users: output }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config = { path: "/api/admin-users" };
