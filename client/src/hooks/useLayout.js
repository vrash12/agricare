import { useDispatch, useSelector } from 'react-redux'
import { setLayout } from '../store/slices/layoutSlice'

const useLayout = () => {
    const dispatch = useDispatch()
    const layout = useSelector((state) => state.layout.layout)

    const toggleLayout = (value) => dispatch(setLayout(value))

    return { layout, toggleLayout }
}

export default useLayout
