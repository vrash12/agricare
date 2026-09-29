import { createSlice } from '@reduxjs/toolkit'
import { getCookie, setPermCookie } from '../../utils/cookies'

const layoutSlice = createSlice({
    name: 'layout',
    initialState: {
        layout: getCookie('layout') || 'topbar',
    },
    reducers: {
        setLayout: (state, action) => {
            state.layout = action.payload
            setPermCookie('layout', action.payload)
        },
    },
})

export const { setLayout } = layoutSlice.actions
export default layoutSlice.reducer
