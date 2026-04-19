import { PUBLIC_GITHUB_CLIENT_ID } from '$env/static/public';
import { browser } from '$app/environment';

export function getAccessToken(): string | null {
    if (!browser) return null;
    return localStorage.getItem('github_access_token');
}

export function setAccessToken(token: string): void {
    if (!browser) return;
    localStorage.setItem('github_access_token', token);
}

export function clearAccessToken(): void {
    if (!browser) return;
    localStorage.removeItem('github_access_token');
}

export function logout(): void {
    clearAccessToken();
}

export function login(redirectPath?: string): void {
    if (!browser) return;
    
    const path = redirectPath || (window.location.pathname + window.location.search);
    localStorage.setItem('oauth_redirect_path', path);
    
    const clientId = PUBLIC_GITHUB_CLIENT_ID;
    const scope = 'repo,workflow';
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}`;
}

export function getRedirectPath(): string {
    if (!browser) return '/';
    return localStorage.getItem('oauth_redirect_path') || '/';
}

export function clearRedirectPath(): void {
    if (!browser) return;
    localStorage.removeItem('oauth_redirect_path');
}
