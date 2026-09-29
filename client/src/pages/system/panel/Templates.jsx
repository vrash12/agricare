import { useState, useEffect } from 'react'
import { MdCheckCircle } from 'react-icons/md'
import SystemLayout from './SystemLayout'
import api from '../../../services/api'

const ROLES = [
    {
        key: 'admin',
        label: 'Admin',
        pages: ['Dashboard', 'Farmers', 'Extension Workers', 'AgriXa', 'Reports', 'Notifications'],
    },
    {
        key: 'farmer',
        label: 'Farmer',
        pages: ['Dashboard', 'AgriXa', 'Extension Workers', 'Notifications'],
    },
    {
        key: 'extension_worker',
        label: 'Extension Worker',
        pages: ['Dashboard', 'Tickets', 'Notifications'],
    },
]

// Skeleton block primitives
const SkelBox = ({ w = 'w-full', h = 'h-2', rounded = 'rounded', opacity = 'opacity-30' }) => (
    <div className={`${w} ${h} ${rounded} ${opacity} bg-white`} />
)

// Skeleton layouts per page type
const SKELETONS = {
    Dashboard: (
        <div className='flex flex-col gap-1.5'>
            {/* Hero banner */}
            <SkelBox h='h-8' rounded='rounded-md' />
            {/* Stat cards row */}
            <div className='flex gap-1 mt-1'>
                <SkelBox h='h-5' rounded='rounded' />
                <SkelBox h='h-5' rounded='rounded' />
                <SkelBox h='h-5' rounded='rounded' />
            </div>
            {/* Chart */}
            <SkelBox h='h-10' rounded='rounded-md' opacity='opacity-20' />
        </div>
    ),
    Farmers: (
        <div className='flex flex-col gap-1.5'>
            {/* Search + button row */}
            <div className='flex gap-1'>
                <SkelBox h='h-3' rounded='rounded' />
                <SkelBox w='w-8' h='h-3' rounded='rounded' />
            </div>
            {/* Table rows */}
            {[...Array(4)].map((_, i) => (
                <SkelBox key={i} h='h-2.5' rounded='rounded' opacity='opacity-20' />
            ))}
        </div>
    ),
    'Extension Workers': (
        <div className='flex flex-col gap-1.5'>
            <div className='flex gap-1'>
                <SkelBox h='h-3' rounded='rounded' />
                <SkelBox w='w-8' h='h-3' rounded='rounded' />
            </div>
            {[...Array(4)].map((_, i) => (
                <SkelBox key={i} h='h-2.5' rounded='rounded' opacity='opacity-20' />
            ))}
        </div>
    ),
    'AgriXa': (
        <div className='flex flex-col gap-1.5'>
            {/* Search + tabs */}
            <SkelBox h='h-3' rounded='rounded' />
            <div className='flex gap-1'>
                {[...Array(4)].map((_, i) => <SkelBox key={i} w='w-8' h='h-2' rounded='rounded' />)}
            </div>
            {/* Ticket cards */}
            {[...Array(3)].map((_, i) => (
                <SkelBox key={i} h='h-5' rounded='rounded-md' opacity='opacity-20' />
            ))}
        </div>
    ),
    Reports: (
        <div className='flex flex-col gap-1.5'>
            {/* 2x2 chart grid */}
            <div className='grid grid-cols-2 gap-1'>
                {[...Array(4)].map((_, i) => (
                    <SkelBox key={i} h='h-8' rounded='rounded-md' opacity='opacity-20' />
                ))}
            </div>
        </div>
    ),
    Notifications: (
        <div className='flex flex-col gap-1.5'>
            {[...Array(5)].map((_, i) => (
                <div key={i} className='flex gap-1 items-center'>
                    <SkelBox w='w-4' h='h-4' rounded='rounded-full' />
                    <SkelBox h='h-2.5' rounded='rounded' opacity='opacity-20' />
                </div>
            ))}
        </div>
    ),
    Tickets: (
        <div className='flex flex-col gap-1.5'>
            <div className='flex gap-1'>
                {[...Array(3)].map((_, i) => <SkelBox key={i} w='w-10' h='h-2' rounded='rounded' />)}
            </div>
            {[...Array(4)].map((_, i) => (
                <SkelBox key={i} h='h-5' rounded='rounded-md' opacity='opacity-20' />
            ))}
        </div>
    ),
}

const TEMPLATES = [
    { id: 1, label: 'Template 1', desc: 'Default layout' },
]

const TemplateCard = ({ template, page, isSelected, onSelect }) => (
    <button onClick={onSelect}
        className='flex flex-col gap-2 p-3 rounded-xl cursor-pointer w-full text-left transition-all'
        style={{ backgroundColor: isSelected ? '#e9456015' : '#0f3460', border: `1px solid ${isSelected ? '#e94560' : '#ffffff10'}` }}>
        {/* Skeleton preview */}
        <div className='w-full rounded-lg p-2' style={{ backgroundColor: '#0a1628', minHeight: '80px' }}>
            {SKELETONS[page] ?? <SkelBox h='h-full' />}
        </div>
        {/* Label row */}
        <div className='flex items-center justify-between'>
            <div>
                <p className='text-xs font-semibold' style={{ color: '#fff' }}>{template.label}</p>
                <p className='text-xs opacity-40' style={{ color: '#fff' }}>{template.desc}</p>
            </div>
            {isSelected && <MdCheckCircle size={16} color='#e94560' />}
        </div>
    </button>
)

const Templates = () => {
    const [templates, setTemplates] = useState({})
    const [activeRole, setActiveRole] = useState('admin')

    useEffect(() => {
        api.get('/system/config/').then(res => {
            setTemplates(res.data.dashboardTemplates ?? {})
        })
    }, [])

    const handleSelect = async (role, page, templateId) => {
        const key = `${role}__${page}`
        const updated = { ...templates, [key]: templateId }
        setTemplates(updated)
        await api.patch('/system/config/', { dashboardTemplates: updated })
    }

    const getSelected = (role, page) => templates[`${role}__${page}`] ?? 1
    const role = ROLES.find(r => r.key === activeRole)

    return (
        <SystemLayout title='Templates'>
            {/* Role Tabs */}
            <div className='flex gap-2 mb-5'>
                {ROLES.map(r => (
                    <button key={r.key} onClick={() => setActiveRole(r.key)}
                        className='px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer'
                        style={{ backgroundColor: activeRole === r.key ? '#e94560' : '#16213e', color: '#fff' }}>
                        {r.label}
                    </button>
                ))}
            </div>

            {/* Pages */}
            <div className='flex flex-col gap-5'>
                {role.pages.map(page => (
                    <div key={page} className='p-4 rounded-xl' style={{ backgroundColor: '#16213e' }}>
                        <p className='text-sm font-semibold mb-3' style={{ color: '#fff' }}>{page}</p>
                        <div className='flex gap-3 overflow-x-auto pb-1'>
                            {TEMPLATES.map(t => (
                                <div key={t.id} className='min-w-[140px]'>
                                    <TemplateCard
                                        template={t}
                                        page={page}
                                        isSelected={getSelected(activeRole, page) === t.id}
                                        onSelect={() => handleSelect(activeRole, page, t.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </SystemLayout>
    )
}

export default Templates
