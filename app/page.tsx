'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type Review, type ReviewInsert, type ReviewImage, type Manager, type ManagerInsert } from '@/lib/supabase'
import { differenceInDays, format, parseISO } from 'date-fns'
import {
  Plus, Search, X, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronUp, Edit2, Trash2, Building2,
  FileText, Calendar, Tag, StickyNote, ChevronRight, Copy,
  ImageIcon, Upload, Users, UserPlus
} from 'lucide-react'

const MATERIAL_OPTIONS = ['배너', '영상', '검색광고', 'SNS', '블로그', '기타']
const BUCKET = 'md_review-images'
const MANAGER_COLORS = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c','#2b6cb0','#718096','#2c7a7b']

function getDday(expiresAt: string) {
  return differenceInDays(parseISO(expiresAt), new Date())
}

function StatusBadge({ dday }: { dday: number }) {
  const base: React.CSSProperties = { width: 72, padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block', border: '1px solid', textAlign: 'center' }
  if (dday < 0)   return <span style={{ ...base, background: 'var(--danger-light)', color: '#991b1b', borderColor: 'var(--danger-border)' }}>만료됨</span>
  if (dday <= 30)  return <span style={{ ...base, background: '#fff1f0', color: '#c0392b', borderColor: '#fca5a5' }}>D-{dday}</span>
  if (dday <= 90)  return <span style={{ ...base, background: 'var(--warn-light)', color: 'var(--warn)', borderColor: 'var(--warn-border)' }}>D-{dday}</span>
  return <span style={{ ...base, background: 'var(--safe-light)', color: 'var(--safe)', borderColor: 'var(--safe-border)' }}>D-{dday}</span>
}

function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: 'white', flexShrink: 0 }}>
      {name[0]}
    </div>
  )
}

const emptyForm: ReviewInsert = {
  hospital_name: '', review_number: '', approved_at: '', expires_at: '',
  material_types: [], memo: '', images: [], manager_id: null,
}

type Tab = 'list' | 'hospital'
type FilterType = 'all' | 'expired' | 'danger' | 'warning' | 'safe'
type SortKey = 'expires_at' | 'hospital_name' | 'created_at'
type HospSortMode = 'name' | 'worst' | 'count'

function worstStatus(reviews: Review[]): FilterType {
  const days = reviews.map(r => getDday(r.expires_at))
  if (days.some(d => d < 0)) return 'expired'
  if (days.some(d => d <= 30)) return 'danger'
  if (days.some(d => d <= 90)) return 'warning'
  return 'safe'
}
const worstOrder: Record<string, number> = { expired: 0, danger: 1, warning: 2, safe: 3 }

export default function Home() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('list')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortKey, setSortKey] = useState<SortKey>('expires_at')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([])
  const [ddOpen, setDdOpen] = useState(false)
  const [ddSearch, setDdSearch] = useState('')
  const ddRef = useRef<HTMLDivElement>(null)

  // 담당자 필터 드롭다운
  const [mgrFilterId, setMgrFilterId] = useState<string | null>(null)
  const [mgrDdOpen, setMgrDdOpen] = useState(false)
  const [mgrDdSearch, setMgrDdSearch] = useState('')
  const mgrDdRef = useRef<HTMLDivElement>(null)

  const [hospSearch, setHospSearch] = useState('')
  const [hospSort, setHospSort] = useState<HospSortMode>('worst')

  // 심의 모달
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Review | null>(null)
  const [form, setForm] = useState<ReviewInsert>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploadingMat, setUploadingMat] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // 담당자 관리 모달
  const [showMgrModal, setShowMgrModal] = useState(false)
  const [newMgrName, setNewMgrName] = useState('')
  const [newMgrColor, setNewMgrColor] = useState(MANAGER_COLORS[0])
  const [savingMgr, setSavingMgr] = useState(false)

  // 심의번호 분리 입력
  const [numLeft, setNumLeft] = useState('')
  const [numRight, setNumRight] = useState('')

  // 라이트박스
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: rData, error: rErr }, { data: mData, error: mErr }] = await Promise.all([
      supabase.from('reviews').select('*').order('expires_at', { ascending: true }),
      supabase.from('managers').select('*').order('created_at', { ascending: true }),
    ])
    if (rErr) setError(rErr.message)
    else setReviews((rData || []).map(r => ({ ...r, images: r.images || [] })))
    if (!mErr) setManagers(mData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false)
      if (mgrDdRef.current && !mgrDdRef.current.contains(e.target as Node)) setMgrDdOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const getMgr = (id: string | null) => managers.find(m => m.id === id) || null
  const hospitalNames = [...new Set(reviews.map(r => r.hospital_name))].sort((a, b) => a.localeCompare(b))
  const filteredDdNames = hospitalNames.filter(n => !ddSearch || n.includes(ddSearch))
  const filteredMgrList = managers.filter(m => !mgrDdSearch || m.name.includes(mgrDdSearch))

  const toggleHospital = (name: string) => {
    setSelectedHospitals(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])
  }

  const filtered = reviews
    .filter(r => {
      if (selectedHospitals.length > 0 && !selectedHospitals.includes(r.hospital_name)) return false
      if (mgrFilterId && r.manager_id !== mgrFilterId) return false
      if (search && !r.hospital_name.includes(search) && !r.review_number.includes(search)) return false
      const d = getDday(r.expires_at)
      if (filter === 'expired') return d < 0
      if (filter === 'danger') return d >= 0 && d <= 30
      if (filter === 'warning') return d > 30 && d <= 90
      if (filter === 'safe') return d > 90
      return true
    })
    .sort((a, b) => {
      const va = a[sortKey] as string, vb = b[sortKey] as string
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const counts = {
    expired: reviews.filter(r => getDday(r.expires_at) < 0).length,
    danger: reviews.filter(r => { const d = getDday(r.expires_at); return d >= 0 && d <= 30 }).length,
    warning: reviews.filter(r => { const d = getDday(r.expires_at); return d > 30 && d <= 90 }).length,
    safe: reviews.filter(r => getDday(r.expires_at) > 90).length,
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const hospGroups = hospitalNames
    .filter(n => !hospSearch || n.includes(hospSearch))
    .map(name => ({ name, reviews: reviews.filter(r => r.hospital_name === name) }))
    .sort((a, b) => {
      if (hospSort === 'name') return a.name.localeCompare(b.name)
      if (hospSort === 'worst') return worstOrder[worstStatus(a.reviews)] - worstOrder[worstStatus(b.reviews)]
      return b.reviews.length - a.reviews.length
    })

  // 이미지 업로드/삭제
  const handleImageUpload = async (files: FileList, materialType: string) => {
    if (!files.length) return
    setUploadingMat(materialType)
    const uploaded: ReviewImage[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file)
      if (error) { alert('업로드 실패: ' + error.message); continue }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      uploaded.push({ url: data.publicUrl, path, material_type: materialType, name: file.name })
    }
    setForm(f => ({ ...f, images: [...f.images, ...uploaded] }))
    setUploadingMat(null)
  }

  const removeImage = async (img: ReviewImage) => {
    await supabase.storage.from(BUCKET).remove([img.path])
    setForm(f => ({ ...f, images: f.images.filter(i => i.path !== img.path) }))
  }

  // 심의 CRUD
  const openAdd = () => {
    setEditTarget(null); setForm(emptyForm); setNumLeft(''); setNumRight(''); setShowModal(true)
  }
  const openCopy = (r: Review) => {
    setEditTarget(null)
    const parts = r.review_number.split('-중-')
    setNumLeft(parts[0] || ''); setNumRight(parts[1] || '')
    setForm({ hospital_name: r.hospital_name, review_number: r.review_number, approved_at: r.approved_at, expires_at: r.expires_at, material_types: r.material_types, memo: r.memo || '', images: [], manager_id: r.manager_id })
    setShowModal(true)
  }
  const openEdit = (r: Review) => {
    setEditTarget(r)
    const parts = r.review_number.split('-중-')
    setNumLeft(parts[0] || ''); setNumRight(parts[1] || '')
    setForm({ hospital_name: r.hospital_name, review_number: r.review_number, approved_at: r.approved_at, expires_at: r.expires_at, material_types: r.material_types, memo: r.memo || '', images: r.images || [], manager_id: r.manager_id })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.hospital_name || !numLeft || !numRight || !form.approved_at || !form.expires_at) {
      alert('병원명, 심의번호, 승인일, 만료일은 필수입니다.'); return
    }
    const reviewNumber = `${numLeft}-중-${numRight}`
    const payload = { ...form, review_number: reviewNumber }
    setSaving(true)
    if (editTarget) {
      const { error } = await supabase.from('reviews').update(payload).eq('id', editTarget.id)
      if (error) alert('수정 실패: ' + error.message)
    } else {
      const { error } = await supabase.from('reviews').insert(payload)
      if (error) alert('등록 실패: ' + error.message)
    }
    setSaving(false); setShowModal(false); fetchAll()
  }

  const handleDelete = async (id: string) => {
    const r = reviews.find(x => x.id === id)
    if (r?.images?.length) await supabase.storage.from(BUCKET).remove(r.images.map(i => i.path))
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) alert('삭제 실패: ' + error.message)
    setDeleteConfirm(null); fetchAll()
  }

  const toggleMaterial = (m: string) => {
    setForm(f => ({ ...f, material_types: f.material_types.includes(m) ? f.material_types.filter(x => x !== m) : [...f.material_types, m] }))
  }

  const handleApprovedChange = (val: string) => {
    if (!val) { setForm(f => ({ ...f, approved_at: '', expires_at: '' })); return }
    const d = new Date(val); d.setFullYear(d.getFullYear() + 3)
    setForm(f => ({ ...f, approved_at: val, expires_at: d.toISOString().split('T')[0] }))
  }

  // 병원명 입력 시 기존 담당자 자동 선택
  const handleHospitalChange = (val: string) => {
    setForm(f => ({ ...f, hospital_name: val }))
    if (!editTarget) {
      const last = reviews.filter(r => r.hospital_name === val).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      if (last?.manager_id) setForm(f => ({ ...f, hospital_name: val, manager_id: last.manager_id }))
    }
  }

  // 담당자 CRUD
  const handleAddManager = async () => {
    if (!newMgrName.trim()) { alert('이름을 입력해주세요.'); return }
    if (managers.find(m => m.name === newMgrName.trim())) { alert('이미 등록된 담당자입니다.'); return }
    setSavingMgr(true)
    const { error } = await supabase.from('managers').insert({ name: newMgrName.trim(), color: newMgrColor } as ManagerInsert)
    if (error) alert('추가 실패: ' + error.message)
    setNewMgrName(''); setSavingMgr(false); fetchAll()
  }

  const handleDeleteManager = async (id: string) => {
    const m = managers.find(x => x.id === id)!
    const cnt = reviews.filter(r => r.manager_id === id).length
    const msg = cnt > 0 ? `${m.name} 담당자를 삭제하면 담당 심의 ${cnt}건의 담당자가 해제됩니다. 삭제할까요?` : `${m.name} 담당자를 삭제할까요?`
    if (!confirm(msg)) return
    await supabase.from('managers').delete().eq('id', id)
    if (mgrFilterId === id) setMgrFilterId(null)
    fetchAll()
  }

  const ddLabel = selectedHospitals.length === 0 ? '병원명' : selectedHospitals.length === 1 ? selectedHospitals[0] : `${selectedHospitals.length}개 병원`
  const ddActive = selectedHospitals.length > 0
  const mgrFilter = getMgr(mgrFilterId)

  const MATERIAL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    '배너':    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    '영상':    { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
    '검색광고': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    'SNS':    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    '블로그':  { bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
    '기타':    { bg: '#f4f5f9', color: '#4b5563', border: '#dde0ea' },
  }
  const getMatStyle = (m: string) => MATERIAL_COLORS[m] || MATERIAL_COLORS['기타']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* 헤더 */}
      <header style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)', padding: '0 28px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(29,78,216,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={17} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: -0.3 }}>의료심의 관리</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Medical Review Manager</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowMgrModal(true)} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
            <Users size={14} /> 담당자 관리
          </button>
          <button onClick={openAdd} style={{ background: 'white', color: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 4px rgba(0,0,0,0.15)', fontFamily: 'inherit' }}>
            <Plus size={15} /> 심의 추가
          </button>
        </div>
      </header>

      {/* 탭 */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', padding: '0 28px', flex: 1 }}>
          {(['list', 'hospital'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', color: tab === t ? 'var(--accent)' : 'var(--text-muted)', borderBottom: `2.5px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t === 'list' ? <><FileText size={14} /> 전체 목록</> : <><Building2 size={14} /> 병원별 현황</>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderLeft: '1px solid var(--border)' }}>
          <button onClick={() => setShowGuide(g => !g)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', background: showGuide ? 'var(--accent)' : 'var(--accent-light)', color: showGuide ? 'white' : 'var(--accent)', border: `1.5px solid ${showGuide ? 'var(--accent)' : '#bfdbfe'}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
            📖 사용 가이드
          </button>
        </div>
      </div>

      {/* 가이드 패널 오버레이 */}
      {showGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowGuide(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-4px 0 32px rgba(0,0,0,.13)', display: 'flex', flexDirection: 'column', animation: 'slideInRight .25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #f0f4ff, #e8f0fe)', flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>📖 사용 가이드</span>
              <button onClick={() => setShowGuide(false)} style={{ border: 'none', background: '#e2e8f0', cursor: 'pointer', width: 28, height: 28, borderRadius: 7, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '16px 18px', flex: 1 }}>
              {[
                { title: '➕ 심의 추가', items: ['오른쪽 위 + 심의 추가 클릭', '병원명 입력 — 기존 병원이면 담당자 자동 선택', '심의번호 앞 6자리 / 뒤 6자리 입력 (숫자만)', '승인일 입력 시 만료일 자동 계산 (+3년)', '소재 종류 선택 후 이미지 업로드', '담당자 지정 후 저장'], tip: null },
                { title: '👤 담당자 관리', items: ['헤더 담당자 관리 버튼 클릭', '이름 + 색상 선택 후 추가', '삭제 시 해당 심의는 미지정으로 변경'], tip: '색상으로 담당자를 구분하면 한눈에 보여요.' },
                { title: '📋 심의 복사', items: ['목록에서 복사 아이콘 클릭', '병원명·번호·날짜·소재·담당자 자동 입력', '심의번호·날짜만 수정 후 바로 저장 가능'], tip: '같은 병원 갱신 심의 등록할 때 편리해요.' },
                { title: '🔍 필터 & 검색', items: ['상단 카드 클릭 → 만료 상태별 필터', '병원명 ▼ → 복수 병원 동시 선택', '담당자 드롭다운 → 담당자별 보기', '검색창 → 병원명·심의번호 검색'], tip: null },
                { title: '🖼 이미지 관리', items: ['소재 종류별로 이미지 분류 업로드', '썸네일 클릭 → 원본 이미지 확대', '심의 삭제 시 이미지도 함께 삭제'], tip: '배너·영상·SNS 소재를 한 심의에 묶어 관리해요.' },
                { title: '⚠️ 만료 기준', items: ['만료됨 — 만료일이 지난 심의', 'D-30 — 30일 이내 만료 예정', 'D-90 — 90일 이내 만료 예정', '정상 — 90일 이상 남은 심의'], tip: '의료광고 심의 유효기간은 승인일로부터 3년이에요.' },
              ].map((section, si) => (
                <div key={si}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 9 }}>{section.title}</div>
                  <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: section.tip ? 8 : 0 }}>
                    {section.items.map((item, ii) => (
                      <li key={ii} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item}</li>
                    ))}
                  </ol>
                  {section.tip && (
                    <div style={{ padding: '7px 10px', background: '#fffbeb', borderLeft: '3px solid #f59e0b', borderRadius: '0 6px 6px 0', fontSize: 11.5, color: '#78350f', lineHeight: 1.5, marginBottom: 0 }}>
                      💡 {section.tip}
                    </div>
                  )}
                  {si < 5 && <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>

        {/* ── 전체 목록 탭 ── */}
        {tab === 'list' && (
          <>
            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: '만료됨',   count: counts.expired, f: 'expired' as FilterType, icon: <X size={18} />,            bg: '#e53e3e', activeBorder: '#c53030' },
                { label: 'D-30 이내', count: counts.danger,  f: 'danger'  as FilterType, icon: <AlertTriangle size={18} />, bg: '#ed8936', activeBorder: '#dd6b20' },
                { label: 'D-90 이내', count: counts.warning, f: 'warning' as FilterType, icon: <Clock size={18} />,         bg: '#3182ce', activeBorder: '#2b6cb0' },
                { label: '정상',      count: counts.safe,    f: 'safe'    as FilterType, icon: <CheckCircle size={18} />,   bg: '#2b6cb0', activeBorder: '#2c5282' },
              ].map(c => (
                <button key={c.label} onClick={() => setFilter(f => f === c.f ? 'all' : c.f)} style={{ background: c.bg, border: `2px solid ${filter === c.f ? c.activeBorder : c.bg}`, borderRadius: 14, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s', boxShadow: filter === c.f ? '0 4px 20px rgba(0,0,0,0.18)' : '0 1px 4px rgba(0,0,0,0.08)', transform: filter === c.f ? 'translateY(-2px)' : 'none' }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: -1, textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>{c.count}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6, fontWeight: 600 }}>{c.label}</div>
                </button>
              ))}
            </div>

            {/* 툴바 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input placeholder="병원명 또는 심의번호 검색" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, background: 'var(--surface)', outline: 'none', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
              </div>

              {/* 담당자 필터 드롭다운 */}
              <div ref={mgrDdRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => { setMgrDdOpen(o => !o); setMgrDdSearch('') }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', border: `2px solid ${mgrFilterId ? 'var(--accent)' : '#3182ce'}`, borderRadius: 9, background: mgrFilterId ? 'linear-gradient(135deg,#1d4ed8,#3182ce)' : 'linear-gradient(135deg,#ebf4ff,#dbeafe)', fontSize: 13, fontWeight: 700, color: mgrFilterId ? 'white' : '#1d4ed8', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minWidth: 148, boxShadow: '0 2px 8px rgba(49,130,206,0.15)', transition: 'all .15s' }}>
                  <Users size={14} />
                  {mgrFilter ? <><Avatar name={mgrFilter.name} color={mgrFilter.color} size={20} />{mgrFilter.name}</> : '전체 담당자'}
                  <ChevronDown size={11} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: mgrDdOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />
                </button>
                {mgrDdOpen && (
                  <div className="drop-in" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.13)', minWidth: 210, padding: 6 }}>
                    <input placeholder="담당자 검색..." value={mgrDdSearch} onChange={e => setMgrDdSearch(e.target.value)} autoFocus
                      style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', marginBottom: 5, background: 'var(--surface-alt)' }} />
                    {/* 전체 */}
                    <div onClick={() => { setMgrFilterId(null); setMgrDdOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: mgrFilterId === null ? 700 : 500, color: mgrFilterId === null ? 'var(--accent)' : 'var(--text-primary)', background: mgrFilterId === null ? 'var(--accent-light)' : 'transparent' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#718096', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0 }}>전</div>
                      <span style={{ flex: 1 }}>전체 담당자</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-alt)', padding: '1px 6px', borderRadius: 10 }}>{reviews.length}건</span>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                    {filteredMgrList.map(m => {
                      const cnt = reviews.filter(r => r.manager_id === m.id).length
                      const sel = mgrFilterId === m.id
                      return (
                        <div key={m.id} onClick={() => { setMgrFilterId(m.id); setMgrDdOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? 'var(--accent)' : 'var(--text-primary)', background: sel ? 'var(--accent-light)' : 'transparent' }}>
                          <Avatar name={m.name} color={m.color} size={26} />
                          <span style={{ flex: 1 }}>{m.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-alt)', padding: '1px 6px', borderRadius: 10 }}>{cnt}건</span>
                        </div>
                      )
                    })}
                    {managers.length === 0 && <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>등록된 담당자가 없습니다.</div>}
                  </div>
                )}
              </div>

              {/* 병원명 드롭다운 */}
              <div ref={ddRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => { setDdOpen(o => !o); setDdSearch('') }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', border: `1.5px solid ${ddActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 9, background: ddActive ? 'var(--accent-light)' : 'var(--surface)', fontSize: 13, fontWeight: 600, color: ddActive ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minWidth: 120 }}>
                  {ddLabel}
                  {ddActive && <span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%' }} />}
                  <ChevronDown size={11} style={{ transition: 'transform 0.2s', transform: ddOpen ? 'rotate(180deg)' : 'none', marginLeft: 'auto' }} />
                </button>
                {ddOpen && (
                  <div className="drop-in" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.13)', minWidth: 210, maxHeight: 260, overflowY: 'auto', padding: 6 }}>
                    <input placeholder="병원 검색..." value={ddSearch} onChange={e => setDdSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus
                      style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', marginBottom: 5, background: 'var(--surface-alt)' }} />
                    <div onClick={() => { setSelectedHospitals([]); setDdOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: selectedHospitals.length === 0 ? 'var(--accent)' : 'var(--text-secondary)', background: selectedHospitals.length === 0 ? 'var(--accent-light)' : 'transparent' }}>
                      <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${selectedHospitals.length === 0 ? 'var(--accent)' : 'var(--border)'}`, background: selectedHospitals.length === 0 ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', flexShrink: 0 }}>{selectedHospitals.length === 0 ? '✓' : ''}</span>
                      전체 ({reviews.length}건)
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                    {filteredDdNames.map(name => {
                      const sel = selectedHospitals.includes(name)
                      const cnt = reviews.filter(r => r.hospital_name === name).length
                      return (
                        <div key={name} onClick={e => { e.stopPropagation(); toggleHospital(name) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: sel ? 'var(--accent)' : 'var(--text-primary)', fontWeight: sel ? 700 : 500, background: sel ? 'var(--accent-light)' : 'transparent' }}>
                          <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', flexShrink: 0 }}>{sel ? '✓' : ''}</span>
                          <span style={{ flex: 1 }}>{name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cnt}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 테이블 */}
            <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'visible', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 160px 105px 115px 185px 120px 110px 90px 88px', padding: '12px 24px', background: 'linear-gradient(to bottom, #f8f9fc, #f0f2f8)', borderBottom: '1.5px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.3, borderRadius: '14px 14px 0 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} onClick={() => toggleSort('hospital_name')}>병원명{sortKey === 'hospital_name' ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}</div>
                <div style={{ textAlign: 'center' }}>심의번호</div>
                <div>승인일</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} onClick={() => toggleSort('expires_at')}>만료일{sortKey === 'expires_at' ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}</div>
                <div>소재 종류</div>
                <div>이미지</div>
                <div>담당자</div>
                <div style={{ textAlign: 'center' }}>상태</div>
                <div />
              </div>

              {loading && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>불러오는 중...</div>}
              {error && <div style={{ padding: 48, textAlign: 'center', color: 'var(--danger)', fontSize: 14 }}>⚠️ {error}</div>}
              {!loading && !error && filtered.length === 0 && (
                <div style={{ padding: 64, textAlign: 'center' }}>
                  <Building2 size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>심의 내역이 없습니다.</div>
                </div>
              )}

              {!loading && !error && filtered.map((r, idx) => {
                const dday = getDday(r.expires_at)
                const rowBg = dday < 0 ? '#fff5f5' : dday <= 30 ? '#fffaf5' : 'var(--surface)'
                const imagesByMat: Record<string, ReviewImage[]> = {}
                ;(r.images || []).forEach(img => {
                  if (!imagesByMat[img.material_type]) imagesByMat[img.material_type] = []
                  imagesByMat[img.material_type].push(img)
                })
                const mgr = getMgr(r.manager_id)
                return (
                  <div key={r.id} className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1.4fr 160px 105px 115px 185px 120px 110px 90px 88px', padding: '15px 24px', borderBottom: idx < filtered.length - 1 ? '1px solid #f0f2f6' : 'none', alignItems: 'center', background: rowBg, transition: 'background 0.12s' }}>
                    <div>
                      <button onClick={() => { setTab('hospital'); setHospSearch(r.hospital_name) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--accent)', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>{r.hospital_name}</button>
                      {r.memo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.memo}</div>}
                    </div>
                    <div style={{ textAlign: 'center' }}><span title={r.review_number} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', background: '#f4f5f9', padding: '2px 6px', borderRadius: 4, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{r.review_number}</span></div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{format(parseISO(r.approved_at), 'yy.MM.dd')}</div>
                    <div style={{ fontSize: 13, fontWeight: dday <= 90 ? 700 : 500, color: dday <= 30 ? 'var(--danger)' : dday <= 90 ? 'var(--warn)' : 'var(--text-secondary)' }}>{format(parseISO(r.expires_at), 'yy.MM.dd')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.material_types.map(m => { const s = getMatStyle(m); return <span key={m} style={{ fontSize: 11, padding: '2px 8px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5, color: s.color, fontWeight: 600 }}>{m}</span> })}
                    </div>
                    {/* 썸네일 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {Object.keys(imagesByMat).length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}><ImageIcon size={12} /> 없음</div>
                      ) : (
                        Object.entries(imagesByMat).map(([mat, imgs]) =>
                          imgs.slice(0, 3).map((img, i) => (
                            <div key={`${mat}-${i}`} onClick={() => setLightbox({ url: img.url, name: img.name })} title={`${mat}: ${img.name}`}
                              style={{ width: 36, height: 36, borderRadius: 5, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)', flexShrink: 0, position: 'relative', background: '#f0f2f8' }}>
                              <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')} />
                            </div>
                          ))
                        )
                      )}
                    </div>
                    {/* 담당자 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {mgr ? (<><Avatar name={mgr.name} color={mgr.color} size={22} /><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{mgr.name}</span></>) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>미지정</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}><StatusBadge dday={dday} /></div>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                      {[
                        { icon: <Copy size={13} />, onClick: () => openCopy(r), title: '복사', hoverBorder: '#93c5fd', hoverColor: 'var(--accent)' },
                        { icon: <Edit2 size={13} />, onClick: () => openEdit(r), title: '수정', hoverBorder: '#93c5fd', hoverColor: 'var(--accent)' },
                        { icon: <Trash2 size={13} />, onClick: () => setDeleteConfirm(r.id), title: '삭제', hoverBorder: '#fca5a5', hoverColor: 'var(--danger)' },
                      ].map((btn, i) => (
                        <button key={i} onClick={btn.onClick} title={btn.title}
                          style={{ border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'all .15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = btn.hoverBorder; (e.currentTarget as HTMLButtonElement).style.color = btn.hoverColor }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}>
                          {btn.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {!loading && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', fontWeight: 500 }}>총 {filtered.length}건{(filter !== 'all' || selectedHospitals.length > 0 || mgrFilterId) ? ` (전체 ${reviews.length}건)` : ''}</div>}
          </>
        )}

        {/* ── 병원별 현황 탭 ── */}
        {tab === 'hospital' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
              <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input placeholder="병원명 검색" value={hospSearch} onChange={e => setHospSearch(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, background: 'var(--surface)', outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)' }} />
              </div>
              <select value={hospSort} onChange={e => setHospSort(e.target.value as HospSortMode)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value="worst">위급 순</option>
                <option value="name">병원명순</option>
                <option value="count">심의 건수순</option>
              </select>
            </div>
            {loading && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>불러오는 중...</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {hospGroups.map(({ name, reviews: hrs }) => {
                const worst = worstStatus(hrs)
                const ec = hrs.filter(r => getDday(r.expires_at) < 0).length
                const dc = hrs.filter(r => { const d = getDday(r.expires_at); return d >= 0 && d <= 30 }).length
                const wc = hrs.filter(r => { const d = getDday(r.expires_at); return d > 30 && d <= 90 }).length
                const sc = hrs.filter(r => getDday(r.expires_at) > 90).length
                const borderColor = worst === 'expired' ? 'var(--danger)' : worst === 'danger' ? 'var(--warn)' : worst === 'warning' ? '#b45309' : 'var(--safe)'
                const topBadge = ec > 0 ? <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--danger-light)', color: '#991b1b', border: '1px solid var(--danger-border)' }}>만료 {ec}건</span>
                  : dc > 0 ? <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>D-30 이내 {dc}건</span>
                  : wc > 0 ? <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--warn-light)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}>D-90 이내 {wc}건</span>
                  : <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--safe-light)', color: 'var(--safe)', border: '1px solid var(--safe-border)' }}>정상</span>
                // 담당자 추출 (중복 제거)
                const mgrIds = [...new Set(hrs.map(r => r.manager_id).filter(Boolean))]
                const hospMgrs = mgrIds.map(id => getMgr(id)).filter(Boolean) as Manager[]
                return (
                  <div key={name} className="fade-in" style={{ background: 'var(--surface)', borderRadius: 16, padding: '20px 22px', border: '1.5px solid var(--border)', borderLeft: `4px solid ${borderColor}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>심의 {hrs.length}건</div>
                      </div>
                      {topBadge}
                    </div>
                    {/* 담당자 표시 */}
                    {hospMgrs.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        {hospMgrs.map(m => <Avatar key={m.id} name={m.name} color={m.color} size={22} />)}
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{hospMgrs.map(m => m.name).join(', ')}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 3, marginBottom: 14, height: 5, borderRadius: 4, overflow: 'hidden' }}>
                      {ec > 0 && <div style={{ flex: ec, background: 'var(--danger)' }} />}
                      {dc > 0 && <div style={{ flex: dc, background: '#f97316' }} />}
                      {wc > 0 && <div style={{ flex: wc, background: '#eab308' }} />}
                      {sc > 0 && <div style={{ flex: sc, background: '#22c55e' }} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...hrs].sort((a, b) => getDday(a.expires_at) - getDday(b.expires_at)).map(r => {
                        const d = getDday(r.expires_at)
                        const allImgs = r.images || []
                        return (
                          <div key={r.id} style={{ background: d < 0 ? '#fff5f5' : d <= 30 ? '#fff9f5' : 'var(--surface-alt)', border: `1px solid ${d < 0 ? 'var(--danger-border)' : d <= 30 ? 'var(--warn-border)' : 'var(--border)'}`, borderRadius: 10, padding: '11px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'white', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4 }}>{r.review_number}</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
                                  {r.material_types.map(m => { const s = getMatStyle(m); return <span key={m} style={{ fontSize: 10, padding: '1px 6px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, color: s.color, fontWeight: 600 }}>{m}</span> })}
                                </div>
                                {r.memo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.memo}</div>}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <StatusBadge dday={d} />
                                <div style={{ fontSize: 11, color: d <= 30 ? 'var(--danger)' : d <= 90 ? 'var(--warn)' : 'var(--text-muted)', fontWeight: d <= 90 ? 700 : 400 }}>~{format(parseISO(r.expires_at), 'yy.MM.dd')}</div>
                              </div>
                            </div>
                            {allImgs.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                                {allImgs.slice(0, 6).map((img, i) => (
                                  <div key={i} onClick={() => setLightbox({ url: img.url, name: img.name })} style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)' }}>
                                    <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => { setTab('list'); setSelectedHospitals([name]) }} style={{ marginTop: 12, width: '100%', padding: '7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: 'inherit' }}>
                      전체 목록에서 보기 <ChevronRight size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
            {!loading && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', fontWeight: 500 }}>총 {hospGroups.length}개 병원</div>}
          </>
        )}
      </main>

      {/* ── 심의 추가/수정 모달 ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="slide-in" style={{ background: 'var(--surface)', borderRadius: 18, width: 520, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800 }}>{editTarget ? '심의 수정' : form.hospital_name ? `${form.hospital_name} — 새 심의 추가` : '심의 추가'}</h2>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: '#f0f2f8', cursor: 'pointer', color: 'var(--text-secondary)', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <Field icon={<Building2 size={14} />} label="병원명 *">
                <input value={form.hospital_name} onChange={e => handleHospitalChange(e.target.value)} placeholder="예: 강남연세의원" style={inputStyle} />
              </Field>
              <Field icon={<FileText size={14} />} label="심의번호 *">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input value={numLeft} onChange={e => setNumLeft(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="250320" maxLength={6} style={{ ...inputStyle, textAlign: 'center', letterSpacing: 2, flex: 1 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>- 중 -</span>
                  <input value={numRight} onChange={e => setNumRight(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="185904" maxLength={6} style={{ ...inputStyle, textAlign: 'center', letterSpacing: 2, flex: 1 }} />
                </div>
              </Field>
              <Field icon={<Calendar size={14} />} label="심의 승인일 * (입력 시 만료일 자동 계산)">
                <input type="date" value={form.approved_at} onChange={e => handleApprovedChange(e.target.value)} style={inputStyle} max="2099-12-31" />
              </Field>
              <Field icon={<Calendar size={14} />} label="만료일 *">
                <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} style={inputStyle} max="2099-12-31" />
              </Field>
              <Field icon={<Tag size={14} />} label="광고 소재 종류">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {MATERIAL_OPTIONS.map(m => { const s = getMatStyle(m); const sel = form.material_types.includes(m); return <button key={m} type="button" onClick={() => toggleMaterial(m)} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${sel ? s.color : 'var(--border)'}`, background: sel ? s.bg : 'transparent', color: sel ? s.color : 'var(--text-secondary)', fontWeight: sel ? 700 : 500 }}>{m}</button> })}
                </div>
              </Field>
              <Field icon={<ImageIcon size={14} />} label="광고 소재 이미지">
                {form.material_types.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>소재 종류를 먼저 선택해주세요.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {form.material_types.map(mat => {
                      const matImgs = form.images.filter(i => i.material_type === mat)
                      return (
                        <div key={mat} style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface-alt)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{mat}</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1.5px solid var(--accent)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'var(--accent-light)' }}>
                              <Upload size={12} />{uploadingMat === mat ? '업로드 중...' : '이미지 추가'}
                              <input type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => e.target.files && handleImageUpload(e.target.files, mat)} disabled={uploadingMat !== null} />
                            </label>
                          </div>
                          {matImgs.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {matImgs.map((img, i) => (
                                <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                                  <img src={img.url} alt={img.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setLightbox({ url: img.url, name: img.name })} />
                                  <button onClick={() => removeImage(img)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', border: 'none', cursor: 'pointer', color: 'white', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
                                </div>
                              ))}
                            </div>
                          ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>업로드된 이미지가 없습니다.</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Field>
              {/* 담당자 선택 */}
              <Field icon={<Users size={14} />} label="담당자">
                {managers.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                    담당자가 없습니다. 헤더의 <b>담당자 관리</b>에서 먼저 추가해주세요.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {managers.map(m => {
                      const sel = form.manager_id === m.id
                      return (
                        <button key={m.id} type="button" onClick={() => setForm(f => ({ ...f, manager_id: sel ? null : m.id }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${sel ? m.color : 'var(--border)'}`, background: sel ? m.color + '18' : 'transparent', color: sel ? m.color : 'var(--text-secondary)', fontWeight: sel ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' }}>
                          <Avatar name={m.name} color={m.color} size={20} />{m.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Field>
              <Field icon={<StickyNote size={14} />} label="메모">
                <textarea value={form.memo || ''} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="추가 메모나 비고 사항" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 16px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', fontWeight: 600 }}>취소</button>
              <button onClick={handleSave} disabled={saving || uploadingMat !== null} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || uploadingMat !== null ? 0.7 : 1, fontFamily: 'inherit' }}>
                {saving ? '저장 중...' : editTarget ? '수정 완료' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 담당자 관리 모달 ── */}
      {showMgrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowMgrModal(false) }}>
          <div className="slide-in" style={{ background: 'var(--surface)', borderRadius: 18, width: 420, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={18} /> 담당자 관리</h2>
              <button onClick={() => setShowMgrModal(false)} style={{ border: 'none', background: '#f0f2f8', cursor: 'pointer', color: 'var(--text-secondary)', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>×</button>
            </div>

            {/* 기존 담당자 목록 */}
            {managers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>등록된 담당자가 없습니다.<br />아래에서 추가해보세요.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {managers.map(m => {
                  const cnt = reviews.filter(r => r.manager_id === m.id).length
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--surface-alt)' }}>
                      <Avatar name={m.name} color={m.color} size={34} />
                      <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 10 }}>{cnt}건 담당</span>
                      <button onClick={() => handleDeleteManager(m.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--danger-light)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}>
                        삭제
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 새 담당자 추가 */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><UserPlus size={13} /> 새 담당자 추가</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={newMgrName} onChange={e => setNewMgrName(e.target.value)} placeholder="이름 입력" onKeyDown={e => e.key === 'Enter' && handleAddManager()} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleAddManager} disabled={savingMgr} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>추가</button>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>색상 선택</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MANAGER_COLORS.map(c => (
                  <div key={c} onClick={() => setNewMgrColor(c)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: `3px solid ${newMgrColor === c ? '#1a1916' : 'transparent'}`, transform: newMgrColor === c ? 'scale(1.15)' : 'none', transition: 'all .15s', boxShadow: newMgrColor === c ? '0 0 0 1px white inset' : 'none' }} />
                ))}
              </div>
              {/* 미리보기 */}
              {newMgrName && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-alt)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <Avatar name={newMgrName} color={newMgrColor} size={28} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{newMgrName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>미리보기</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 28, width: 318, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>심의를 삭제할까요?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>이미지 파일도 함께 삭제됩니다.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>취소</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--danger)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()} />
          <div style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{lightbox.name}</div>
        </div>
      )}
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        {icon} {label}
      </label>
      {children}
    </div>
  )
}

function MatBtn({ m, selected, onClick }: { m: string; selected: boolean; onClick: () => void }) {
  const MATERIAL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    '배너':    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    '영상':    { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
    '검색광고': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    'SNS':    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    '블로그':  { bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
    '기타':    { bg: '#f4f5f9', color: '#4b5563', border: '#dde0ea' },
  }
  const s = MATERIAL_COLORS[m] || MATERIAL_COLORS['기타']
  return (
    <button type="button" onClick={onClick} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${selected ? s.color : 'var(--border)'}`, background: selected ? s.bg : 'transparent', color: selected ? s.color : 'var(--text-secondary)', fontWeight: selected ? 700 : 500 }}>{m}</button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)',
  borderRadius: 9, fontSize: 13, background: 'var(--surface)', outline: 'none',
  color: 'var(--text-primary)'
}
