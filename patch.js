const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'netlify/functions');
const mutations = [
    'activity-add.mjs', 'activity-delete.mjs', 'activity-presets-add.mjs', 'activity-presets-delete.mjs',
    'extra-delete.mjs', 'extra-edit.mjs', 'extra-upload.mjs',
    'presets-add.mjs', 'presets-delete.mjs',
    'set-description.mjs', 'set-score.mjs', 'upload.mjs'
];
for (const f of mutations) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    let code = fs.readFileSync(p, 'utf8');
    if (code.includes('auth-utils.mjs')) continue;
    code = 'import { verificarAuth } from "./auth-utils.mjs";\n' + code;

    const authBlock = `
    const authCheck = await verificarAuth(req, usuario);
    if (!authCheck.ok) { return new Response(JSON.stringify({ error: authCheck.error }), { status: 401, headers: { "Content-Type": "application/json" } }); }
`;

    if (code.includes('formData.get("usuario")')) {
        code = code.replace(/const usuario = formData\.get\("usuario"\);/, 'const usuario = formData.get("usuario");' + authBlock);
    } else {
        let replaced = false;
        code = code.replace(/const\s+\{([^}]*usuario[^}]*)\}\s*=\s*await req\.json\(\);/, (match) => {
            replaced = true;
            return match + authBlock;
        });
        if (!replaced) {
            // Some might destructure directly in the parameters if they are not using req.json? No, it's netlify functions.
            // Try to find where 'usuario' is defined.
            console.log("Could not find usuario assignment in JSON for " + f);
        }
    }
    fs.writeFileSync(p, code);
    console.log('Patched: ' + f);
}
