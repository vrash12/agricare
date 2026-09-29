import { useSelector } from 'react-redux'

const Footer = () => {
    const theme = useSelector((state) => state.theme)

    return (
        <footer className='px-6 py-3 text-center text-xs opacity-60' style={{ color: theme.textColor, borderTop: `1px solid ${theme.secondaryColor}` }}>
            © {new Date().getFullYear()} AgriCare. All rights reserved.
        </footer>
    )
}

export default Footer
