/**
 * Resolves the Google OAuth redirect URI used by Passport and manual auth URLs.
 * Priority: GOOGLE_CALLBACK_URL → BACKEND_URL → VERCEL_URL → localhost (PORT).
 */
export function getGoogleCallbackUrl() {
    if (process.env.GOOGLE_CALLBACK_URL) {
        return process.env.GOOGLE_CALLBACK_URL.replace(/\/$/, "");
    }

    const backendBase = process.env.BACKEND_URL?.replace(/\/$/, "");
    if (backendBase) {
        return `${backendBase}/user/auth/google/callback`;
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}/user/auth/google/callback`;
    }

    const port = process.env.PORT || 5000;
    return `http://localhost:${port}/user/auth/google/callback`;
}
