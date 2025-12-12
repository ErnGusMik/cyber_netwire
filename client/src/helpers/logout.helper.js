const logout = (url = "app/msg/") => {
    // Remove indexedDB databases
    indexedDB.deleteDatabase("libsignal_store");
    indexedDB.deleteDatabase("app_store");

    // Remove local/session storage
    localStorage.clear();
    sessionStorage.clear();

    // Remove CSRF token cookie
    document.cookie =
        "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    return window.location.href = "/auth?redirect=" + url;
};

export default logout;
