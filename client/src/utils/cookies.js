export const setCookie = (name, value, days = 1) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Strict`
}

export const setPermCookie = (name, value) => {
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;SameSite=Strict`
}

export const getCookie = (name) => {
    return document.cookie.split('; ').reduce((acc, cookie) => {
        const [key, val] = cookie.split('=')
        return key === name ? decodeURIComponent(val) : acc
    }, null)
}

export const deleteCookie = (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
}

export const setSessionCookie = (name, value) => {
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;SameSite=Strict`
}


export const REMEMBER_ME_DAYS = 7
