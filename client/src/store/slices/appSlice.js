import { createSlice } from '@reduxjs/toolkit'

const appSlice = createSlice({
    name: 'app',
    initialState: {
        isLoading: false,
        sessionExpired: false,
        unauthorized: false,
    },
    reducers: {
        setAppLoading: (state, action) => {
            state.isLoading = action.payload
        },
        setSessionExpired: (state, action) => {
            state.sessionExpired = action.payload
        },
        setUnauthorized: (state, action) => {
            state.unauthorized = action.payload
        },
    },
})

export const { setAppLoading, setSessionExpired, setUnauthorized } = appSlice.actions
export default appSlice.reducer
