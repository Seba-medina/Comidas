import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

export default async (req) => {
    if (req.method !== "POST") {
        return new Response("Método no permitido", { status: 405 });
    }

    try {
        const { usuario, newPassword } = await req.json();

        const authCheck = await verificarAuth(req, usuario);
        if (!authCheck.ok) {
            return new Response(JSON.stringify({ error: authCheck.error }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!newPassword || typeof newPassword !== "string" || newPassword.length < 3) {
            return new Response(JSON.stringify({ error: "Contraseña muy corta" }), { status: 400 });
        }

        const store = getStore("comidas");
        await store.set(`${usuario}:password`, newPassword);

        return new Response(JSON.stringify({ ok: true }), {
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

export const config = { path: "/api/auth-change-password" };
