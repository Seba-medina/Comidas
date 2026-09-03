import { getStore } from "@netlify/blobs";

const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  try {
    const { usuario, password } = await req.json();

    if (!usuario || typeof usuario !== "string") {
      return new Response(JSON.stringify({ error: "Usuario requerido" }), { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Contraseña requerida" }), { status: 400 });
    }

    if (usuario === "admin") {
      const adminPass = Netlify.env.get("ADMIN_PASSWORD") || "admin123";
      if (password === adminPass) {
        return new Response(JSON.stringify({ ok: true, admin: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Contraseña de admin incorrecta" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!USUARIO_REGEX.test(usuario)) {
      return new Response(JSON.stringify({ error: "Usuario inválido" }), { status: 400 });
    }

    const store = getStore("comidas");
    const pwdBlob = await store.get(`${usuario}:password`);

    if (pwdBlob !== null) {
      if (pwdBlob === password) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ error: "Contraseña incorrecta" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Usuario no tiene password. Veamos si tiene datos antiguos.
    const items = await store.list({ prefix: `${usuario}:` });
    if (items.blobs.length > 0) {
      // Usuario antiguo
      if (password === "123456") {
        await store.set(`${usuario}:password`, "123456");
        return new Response(JSON.stringify({ ok: true, isNew: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ error: "Usuario existente. Usa la contraseña por defecto (123456) si no la cambiaste." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      // Usuario nuevo
      await store.set(`${usuario}:password`, password);
      return new Response(JSON.stringify({ ok: true, isNew: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/auth-login" };
