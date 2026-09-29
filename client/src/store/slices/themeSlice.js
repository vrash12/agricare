import { createSlice } from '@reduxjs/toolkit'

const defaultTheme = {
    primaryColor: '#478347',
    secondaryColor: '#87b787',
    dangerColor: '#e53e3e',
    backgroundColor: '#fff9e9',
    textColor: '#204a0e',
    borderRadius: '8px',
    minecraftMode: false,
    minecraftLogo: false,
    minecraftHero: false,
    minecraftSteve: false,
    minecraftMusic: false,
}

const themeSlice = createSlice({
    name: 'theme',
    initialState: defaultTheme,
    reducers: {
        setTheme: (state, action) => {
            return { ...state, ...action.payload }
        },
    },
})

export const { setTheme } = themeSlice.actions
export default themeSlice.reducer
