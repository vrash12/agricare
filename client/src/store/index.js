import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import layoutReducer from './slices/layoutSlice'
import themeReducer from './slices/themeSlice'
import appReducer from './slices/appSlice'

const store = configureStore({
    reducer: {
        auth: authReducer,
        layout: layoutReducer,
        theme: themeReducer,
        app: appReducer,
    },
})

export default store
