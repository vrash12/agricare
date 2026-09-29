import { createSlice } from '@reduxjs/toolkit'
import { getCookie, deleteCookie } from '../../utils/cookies'

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: null,
        token: getCookie('token'),
        isAuthenticated: !!getCookie('token'),
    },
    reducers: {
        setCredentials: (state, action) => {
            state.user = action.payload.user
            state.token = action.payload.token
            state.isAuthenticated = true
        },
        updateProfilePicture: (state, action) => {
            if (state.user) state.user.profilePicture = action.payload
        },
        clearCredentials: (state) => {
            state.user = null
            state.token = null
            state.isAuthenticated = false
            deleteCookie('token')
        },
    },
})

export const { setCredentials, clearCredentials, updateProfilePicture } = authSlice.actions
export default authSlice.reducer
