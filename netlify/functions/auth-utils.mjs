import { getStore } from "@netlify/blobs";

export async function verificarAuth(req, usuarioOpcional = null) {
    if (req.method === "OPTIONS") return { ok: true };

    // Allow passing the user via header or extracting it later. 
    // In forms (like upload) the user is in formData, so the caller passes `usuarioOpcional`.
    const authHeader = req.headers.get("x-user-password");

    if (!authHeader) {
        return { ok: false, error: "Falta el header X-User-Password" };
    }

    // Get the user from either explicit override, header, or nowhere.
    // Actually, wait: for generic verifier, we need to know WHICH user to verify.
    // For most JSON POST requests, it's inside the body. But we shouldn't read the body here 
    // multiple times. The best way is to let the endpoint read the body, then call `verificarAuth`.

    let usuario = usuarioOpcional;
    if (!usuario) {
        return { ok: false, error: "Usuario no provisto para autorizacion" };
    }

    if (usuario === "admin") {
        const adminPass = Netlify.env.get("ADMIN_PASSWORD") || "admin123";
        if (authHeader !== adminPass) {
            return { ok: false, error: "Contrasena de administrador incorrecta" };
        }
        return { ok: true };
    }

    const store = getStore("comidas");
    const pwdBlob = await store.get(`${usuario}:password`);

    if (pwdBlob !== null) {
        if (pwdBlob !== authHeader) {
            return { ok: false, error: "Contraseña incorrecta" };
        }
    } else {
        // Si no tiene password, validamos si existe y usamos 123456
        const items = await store.list({ prefix: `${usuario}:` });
        if (items.blobs.length > 0) {
            if (authHeader !== "123456") {
                return { ok: false, error: "Contraseña incorrecta (este usuario tiene la por defecto)" };
            }
            // Opcional: store.set() aca, pero no es tan necesario. Ya lo hace auth-login.
        } else {
            // El usuario no existe y no tiene password, no se puede hacer POST si no creó cuenta.
            return { ok: false, error: "Usuario no existe. Inicia sesión para crear cuenta." };
        }
    }

    return { ok: true };
}
