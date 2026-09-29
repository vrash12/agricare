import axios from 'axios'
import { getCookie } from '../utils/cookies'
import store from '../store/index'
import { setSessionExpired, setUnauthorized } from '../store/slices/appSlice'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api'),
})

api.interceptors.request.use((config) => {
    const token = getCookie('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const url = error.config?.url || ''
            if (url.includes('/auth/') || url.includes('/system/login/') || url.includes('/positions/')) {
                return Promise.reject(error)
            }
            const token = getCookie('token')
            if (token) {
                store.dispatch(setSessionExpired(true))
            } else {
                store.dispatch(setUnauthorized(true))
            }
        }
        return Promise.reject(error)
    }
)

export default api
