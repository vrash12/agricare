import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { GiWheat } from 'react-icons/gi'
import { FaUserAlt } from 'react-icons/fa'
import { MdArrowForward, MdCheckCircle, MdMenuBook, MdSupportAgent, MdSearch } from 'react-icons/md'
import heroMinecraft from '../assets/hero-minecraft.jpg'
import heroBackground from '../assets/hero-background.jpg'
import logoMinecraft from '../assets/logo-minecraft.png'
import steveImg from '../assets/running-steve.png'
import Dialog from '../components/ui/Dialog'
import Button from '../components/ui/Button'

const LandingPage = () => {
    const navigate = useNavigate()
    const theme = useSelector((state) => state.theme)
    const [dialog, setDialog] = useState({ open: false, type: null })

    const openDialog = type => setDialog({ open: true, type })
    const closeDialog = () => setDialog({ open: false, type: null })
    const selectRole = role => {
        const action = dialog.type === 'login' ? 'login' : 'register'
        closeDialog()
        navigate(`/${action}?role=${role}`)
    }

    const steps = [
        { number: '01', icon: MdSearch, title: 'Ask AgriXa', body: 'Search practical answers prepared by your local agricultural support team.' },
        { number: '02', icon: MdMenuBook, title: 'Read the guidance', body: 'Get a recommended solution right away when the knowledge base has a match.' },
        { number: '03', icon: MdSupportAgent, title: 'Connect when needed', body: 'If there is no answer, send your concern to an extension worker.' },
    ]

    return (
        <div className='min-h-screen' style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}>
            <header className='relative z-10' style={{ backgroundColor: theme.primaryColor }}>
                <nav className='mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8'>
                    <button type='button' onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className='flex items-center gap-2 text-white' aria-label='AgriCare home'>
                        {theme.minecraftLogo ? <img src={logoMinecraft} alt='' className='h-9 w-9 object-contain' /> : <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-white/15'><GiWheat size={22} /></span>}
                        <span className='text-xl font-extrabold tracking-tight'>Agri<span style={{ color: theme.secondaryColor }}>Care</span></span>
                    </button>
                    <div className='flex items-center gap-2 sm:gap-3'><button onClick={() => openDialog('login')} className='rounded-lg px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10'>Log in</button><Button size='sm' onClick={() => openDialog('register')} style={{ backgroundColor: '#fff', color: theme.primaryColor }}>Get started <MdArrowForward size={16} /></Button></div>
                </nav>
            </header>

            <main>
                <section className='relative isolate flex min-h-[560px] items-center overflow-hidden px-5 py-20 md:min-h-[620px] md:px-8'
                    style={{ backgroundImage: `url(${theme.minecraftHero ? heroMinecraft : heroBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className='absolute inset-0 -z-10' style={{ background: `linear-gradient(90deg, ${theme.primaryColor}f2 0%, ${theme.primaryColor}d9 45%, rgba(9, 33, 15, .35) 100%)` }} />
                    <div className='mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.2fr_.8fr]'>
                        <div className='max-w-2xl'><span className='inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white'><GiWheat size={14} /> Agricultural guidance, closer to home</span><h1 className='mt-6 text-4xl font-extrabold leading-[1.07] tracking-tight text-white sm:text-5xl md:text-6xl'>Answers for your farm.<br /><span style={{ color: '#d6f4b2' }}>People when you need them.</span></h1><p className='mt-6 max-w-xl text-base leading-7 text-white/85 md:text-lg'>AgriXa helps farmers find trusted answers to common concerns. When an answer is not available, AgriCare connects you with a local extension worker.</p><div className='mt-8 flex flex-wrap gap-3'><Button size='lg' onClick={() => openDialog('register')} style={{ backgroundColor: '#fff', color: theme.primaryColor }}>Start with AgriXa <MdArrowForward size={18} /></Button><Button size='lg' onClick={() => openDialog('login')} style={{ backgroundColor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.5)' }}>I already have an account</Button></div><div className='mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-white/75'><span className='flex items-center gap-1.5'><MdCheckCircle size={16} /> Fast answers</span><span className='flex items-center gap-1.5'><MdCheckCircle size={16} /> Local support</span><span className='flex items-center gap-1.5'><MdCheckCircle size={16} /> Ticket updates</span></div></div>
                        <div className='hidden rounded-2xl border border-white/20 bg-white/95 p-5 shadow-2xl backdrop-blur-sm lg:block'><div className='flex items-center gap-3 border-b pb-4' style={{ borderColor: `${theme.secondaryColor}55` }}><span className='flex h-11 w-11 items-center justify-center rounded-xl' style={{ backgroundColor: `${theme.primaryColor}14`, color: theme.primaryColor }}><MdMenuBook size={25} /></span><div><p className='text-sm font-bold' style={{ color: theme.textColor }}>Ask AgriXa</p><p className='text-xs text-slate-500'>Search the knowledge base first</p></div></div><div className='mt-5 flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-400' style={{ borderColor: `${theme.secondaryColor}55` }}><MdSearch size={20} /><span>How do I protect my crops from pests?</span></div><div className='mt-4 rounded-xl p-4' style={{ backgroundColor: `${theme.primaryColor}0f` }}><span className='text-[10px] font-bold uppercase tracking-wider' style={{ color: theme.primaryColor }}>How it works</span><p className='mt-2 text-sm font-semibold' style={{ color: theme.textColor }}>Knowledge first. Personal help next.</p><p className='mt-1 text-xs leading-5 text-slate-600'>Common questions can be answered immediately. New concerns become a support ticket for your local team.</p></div><div className='mt-4 flex items-center justify-between text-xs font-medium text-slate-500'><span>Built for farmers and LGU teams</span><MdArrowForward size={18} color={theme.primaryColor} /></div></div>
                    </div>
                </section>

                <section className='mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20'><div className='mb-9 max-w-2xl'><p className='text-xs font-bold uppercase tracking-[0.18em]' style={{ color: theme.primaryColor }}>Simple support journey</p><h2 className='mt-2 text-3xl font-bold tracking-tight md:text-4xl'>From question to solution</h2><p className='mt-3 text-sm leading-6 opacity-70'>Get help in the way that fits your concern, whether it is a familiar question or something that needs an expert.</p></div><div className='grid gap-4 md:grid-cols-3'>{steps.map(step => <div key={step.number} className='rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md' style={{ borderColor: `${theme.secondaryColor}55` }}><div className='flex items-center justify-between'><span className='flex h-12 w-12 items-center justify-center rounded-xl' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}><step.icon size={25} /></span><span className='text-3xl font-black opacity-10'>{step.number}</span></div><h3 className='mt-6 text-lg font-bold'>{step.title}</h3><p className='mt-2 text-sm leading-6 opacity-65'>{step.body}</p></div>)}</div></section>

                <section className='px-5 py-14 md:px-8' style={{ backgroundColor: `${theme.primaryColor}0c` }}><div className='mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row'><div className='flex items-center gap-4'>{theme.minecraftSteve && <img src={steveImg} alt='' className='hidden h-24 w-24 object-contain sm:block' />}<div><p className='text-xs font-bold uppercase tracking-wider' style={{ color: theme.primaryColor }}>Here to help you grow</p><h2 className='mt-1 text-2xl font-bold'>Ready to ask your first question?</h2><p className='mt-1 max-w-lg text-sm opacity-65'>Create an account to explore AgriXa and reach your local support team.</p></div></div><Button onClick={() => openDialog('register')}>Create an account <MdArrowForward size={17} /></Button></div></section>
            </main>

            <footer className='px-5 py-6 text-xs' style={{ backgroundColor: theme.primaryColor, color: '#ffffffb8' }}><div className='mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3'><span>© {new Date().getFullYear()} AgriCare. Helping farmers grow smarter.</span><button onClick={() => navigate('/admin-login')} className='rounded px-2 py-1 hover:bg-white/10'>Admin sign in</button></div></footer>

            <Dialog isOpen={dialog.open} onClose={closeDialog} title={dialog.type === 'login' ? 'Choose how to log in' : 'Join AgriCare'} icon={GiWheat}>
                <div className='grid w-[min(460px,85vw)] gap-3 sm:grid-cols-2'>
                    <button type='button' onClick={() => selectRole('farmer')} className='flex flex-col items-start gap-2 rounded-xl border-2 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md' style={{ borderColor: `${theme.primaryColor}55`, backgroundColor: `${theme.primaryColor}0c` }}><FaUserAlt size={26} color={theme.primaryColor} /><span className='font-bold'>Farmer</span><span className='text-xs leading-5 opacity-65'>Find answers and get help for your farm.</span></button>
                    <button type='button' onClick={() => selectRole('extension')} className='flex flex-col items-start gap-2 rounded-xl border-2 bg-blue-50 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md' style={{ borderColor: '#93c5fd' }}><MdSupportAgent size={28} color='#1d4ed8' /><span className='font-bold'>Extension worker</span><span className='text-xs leading-5 opacity-65'>Respond to concerns and share useful guidance.</span></button>
                </div>
                <div className='mt-4 flex justify-end'><Button variant='ghost' onClick={closeDialog}>Cancel</Button></div>
                {theme.minecraftMode && <p className='mt-2 text-center text-xs opacity-50'>Have you ever downloaded Minecraft? <a href='https://www.minecraft.net/en-us/download' target='_blank' rel='noreferrer' className='underline'>Download now</a></p>}
            </Dialog>
        </div>
    )
}

export default LandingPage
