'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type Review, type ReviewInsert } from '@/lib/supabase'
import { differenceInDays, format, parseISO } from 'date-fns'
import {
  Plus, Search, X, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronUp, Edit2, Trash2, Building2,
  FileText, Calendar, Tag, StickyNote, ChevronRight, Copy
} from 'lucide-react'

const MATERIAL_OPTIONS = ['배너', '영상', '검색광고', 'SNS', '블로그', '기타']

function getDday(expiresAt: string) {
  return differenceInDays(parseISO(expiresAt), new Date())
}

function StatusBadge({ dday }: { dday: number }) {
  const base: React.CSSProperties = { padding: '4px 11px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }
  if (dday < 0)  return <span style={{ ...base, background: 'var(--danger-light)', color: '#991b1b', border: '1px solid var(--danger-border)' }}>만료됨</span>
  if (dday <= 30) return <span style={{ ...base, background: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>D-{dday}</span>
  if (dday <= 90) return <span style={{ ...base, background: 'var(--warn-light)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}>D-{dday}</span>
  return <span style={{ ...base, background: 'var(--safe-light)', color: 'var(--safe)', border: '1px solid var(--safe-border)' }}>D-{dday}</span>
}

const emptyForm: ReviewInsert = {
  hospital_name: '', review_number: '', approved_at: '', expires_at: '', material_types: [], memo: '',
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 탭
  const [tab, setTab] = useState<Tab>('list')

  // 전체 목록 상태
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortKey, setSortKey] = useState<SortKey>('expires_at')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([])
  const [ddOpen, setDdOpen] = useState(false)
  const [ddSearch, setDdSearch] = useState('')
  const ddRef = useRef<HTMLDivElement>(null)

  // 병원별 탭 상태
  const [hospSearch, setHospSearch] = useState('')
  const [hospSort, setHospSort] = useState<HospSortMode>('worst')

  // 모달
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Review | null>(null)
  const [form, setForm] = useState<ReviewInsert>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('reviews').select('*').order('expires_at', { ascending: true })
    if (error) setError(error.message)
    else setReviews(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  // 드롭다운 바깥 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 병원명 목록
  const hospitalNames = [...new Set(reviews.map(r => r.hospital_name))].sort((a, b) => a.localeCompare(b))
  const filteredDdNames = hospitalNames.filter(n => !ddSearch || n.includes(ddSearch))

  const toggleHospital = (name: string) => {
    setSelectedHospitals(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    )
  }

  // 전체 목록 필터링
  const filtered = reviews
    .filter(r => {
      if (selectedHospitals.length > 0 && !selectedHospitals.includes(r.hospital_name)) return false
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

  // 병원별 그룹핑
  const hospGroups = hospitalNames
    .filter(n => !hospSearch || n.includes(hospSearch))
    .map(name => ({ name, reviews: reviews.filter(r => r.hospital_name === name) }))
    .sort((a, b) => {
      if (hospSort === 'name') return a.name.localeCompare(b.name)
      if (hospSort === 'worst') return worstOrder[worstStatus(a.reviews)] - worstOrder[worstStatus(b.reviews)]
      return b.reviews.length - a.reviews.length
    })

  // 폼
  const openAdd = () => { setEditTarget(null); setForm(emptyForm); setShowModal(true) }
  const openCopy = (r: Review) => {
    setEditTarget(null)
    setForm({
      hospital_name: r.hospital_name,
      review_number: '',
      approved_at: '',
      expires_at: '',
      material_types: r.material_types,
      memo: r.memo || '',
    })
    setShowModal(true)
  }
  const openEdit = (r: Review) => {
    setEditTarget(r)
    setForm({ hospital_name: r.hospital_name, review_number: r.review_number, approved_at: r.approved_at, expires_at: r.expires_at, material_types: r.material_types, memo: r.memo || '' })
    setShowModal(true)
  }
  const handleSave = async () => {
    if (!form.hospital_name || !form.review_number || !form.approved_at || !form.expires_at) {
      alert('병원명, 심의번호, 승인일, 만료일은 필수입니다.')
      return
    }
    setSaving(true)
    if (editTarget) {
      const { error } = await supabase.from('reviews').update(form).eq('id', editTarget.id)
      if (error) alert('수정 실패: ' + error.message)
    } else {
      const { error } = await supabase.from('reviews').insert(form)
      if (error) alert('등록 실패: ' + error.message)
    }
    setSaving(false); setShowModal(false); fetchReviews()
  }
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) alert('삭제 실패: ' + error.message)
    setDeleteConfirm(null); fetchReviews()
  }
  const toggleMaterial = (m: string) => {
    setForm(f => ({ ...f, material_types: f.material_types.includes(m) ? f.material_types.filter(x => x !== m) : [...f.material_types, m] }))
  }
  const handleApprovedChange = (val: string) => {
    if (!val) { setForm(f => ({ ...f, approved_at: '', expires_at: '' })); return }
    const d = new Date(val); d.setFullYear(d.getFullYear() + 3)
    setForm(f => ({ ...f, approved_at: val, expires_at: d.toISOString().split('T')[0] }))
  }

  // 드롭다운 라벨
  const ddLabel = selectedHospitals.length === 0 ? '병원명' : selectedHospitals.length === 1 ? selectedHospitals[0] : `${selectedHospitals.length}개 병원`
  const ddActive = selectedHospitals.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* 헤더 */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
        padding: '0 28px', height: 62,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 12px rgba(29,78,216,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={17} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: -0.3 }}>의료심의 관리</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Medical Review Manager</div>
          </div>
        </div>
        <button onClick={openAdd} style={{
          background: 'white', color: 'var(--accent)', border: 'none', borderRadius: 8,
          padding: '8px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
        }}>
          <Plus size={15} /> 심의 추가
        </button>
      </header>

      {/* 탭 */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', display: 'flex' }}>
        {(['list', 'hospital'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '14px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', fontFamily: 'inherit',
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2.5px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6
          }}>
            {t === 'list' ? <><FileText size={14} /> 전체 목록</> : <><Building2 size={14} /> 병원별 현황</>}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* ── 전체 목록 탭 ── */}
        {tab === 'list' && (
          <>
            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: '만료됨', count: counts.expired, f: 'expired' as FilterType, icon: <X size={18} />, colorVar: 'var(--danger)', bgVar: 'var(--danger-light)', borderVar: 'var(--danger-border)' },
                { label: 'D-30 이내', count: counts.danger, f: 'danger' as FilterType, icon: <AlertTriangle size={18} />, colorVar: 'var(--warn)', bgVar: 'var(--warn-light)', borderVar: 'var(--warn-border)' },
                { label: 'D-90 이내', count: counts.warning, f: 'warning' as FilterType, icon: <Clock size={18} />, colorVar: '#b45309', bgVar: '#fffbeb', borderVar: '#fde68a' },
                { label: '정상', count: counts.safe, f: 'safe' as FilterType, icon: <CheckCircle size={18} />, colorVar: 'var(--safe)', bgVar: 'var(--safe-light)', borderVar: 'var(--safe-border)' },
              ].map(c => (
                <button key={c.label} onClick={() => setFilter(f => f === c.f ? 'all' : c.f)} style={{
                  background: filter === c.f ? c.bgVar : 'var(--surface)',
                  border: `1.5px solid ${filter === c.f ? c.colorVar : c.borderVar}`,
                  borderRadius: 14, padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.18s', boxShadow: filter === c.f ? `0 4px 16px rgba(0,0,0,0.1)` : '0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ color: c.colorVar, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: c.colorVar, lineHeight: 1, letterSpacing: -1 }}>{c.count}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, fontWeight: 500 }}>{c.label}</div>
                </button>
              ))}
            </div>

            {/* 검색 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input placeholder="병원명 또는 심의번호 검색" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, background: 'var(--surface)', outline: 'none', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* 테이블 */}
            <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'visible', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              {/* 테이블 헤더 */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 150px 105px 105px 180px 82px 80px',
                padding: '11px 20px',
                background: 'linear-gradient(to bottom, #f8f9fc, #f0f2f8)',
                borderBottom: '1.5px solid var(--border)',
                fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.3,
                borderRadius: '14px 14px 0 0'
              }}>
                {/* 병원명 드롭다운 필터 */}
                <div ref={ddRef} style={{ position: 'relative' }}>
                  <button onClick={() => { setDdOpen(o => !o); setDdSearch('') }} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', letterSpacing: 0.3,
                    color: ddActive ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'color 0.15s'
                  }}>
                    {ddLabel}
                    {ddActive && <span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', flexShrink: 0 }} />}
                    <ChevronDown size={11} style={{ transition: 'transform 0.2s', transform: ddOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </button>

                  {ddOpen && (
                    <div className="drop-in" style={{
                      position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
                      background: 'var(--surface)', border: '1.5px solid var(--border)',
                      borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
                      minWidth: 210, maxHeight: 260, overflowY: 'auto', padding: 6
                    }}>
                      <input
                        placeholder="병원 검색..."
                        value={ddSearch}
                        onChange={e => setDdSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', marginBottom: 5, background: 'var(--surface-alt)', color: 'var(--text-primary)' }}
                      />
                      {/* 전체 옵션 */}
                      <div onClick={() => { setSelectedHospitals([]); setDdOpen(false) }} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, color: selectedHospitals.length === 0 ? 'var(--accent)' : 'var(--text-secondary)',
                        background: selectedHospitals.length === 0 ? 'var(--accent-light)' : 'transparent'
                      }}>
                        <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${selectedHospitals.length === 0 ? 'var(--accent)' : 'var(--border)'}`, background: selectedHospitals.length === 0 ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', flexShrink: 0 }}>
                          {selectedHospitals.length === 0 ? '✓' : ''}
                        </span>
                        전체 ({reviews.length}건)
                      </div>
                      <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                      {filteredDdNames.map(name => {
                        const sel = selectedHospitals.includes(name)
                        const cnt = reviews.filter(r => r.hospital_name === name).length
                        return (
                          <div key={name} onClick={e => { e.stopPropagation(); toggleHospital(name) }} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                            fontSize: 13, color: sel ? 'var(--accent)' : 'var(--text-primary)', fontWeight: sel ? 700 : 500,
                            background: sel ? 'var(--accent-light)' : 'transparent', transition: 'background 0.1s'
                          }}>
                            <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', flexShrink: 0 }}>
                              {sel ? '✓' : ''}
                            </span>
                            <span style={{ flex: 1 }}>{name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cnt}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>심의번호</div>
                <div>승인일</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('expires_at')}>
                  만료일 {sortKey === 'expires_at' ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}
                </div>
                <div>소재 종류</div>
                <div>상태</div>
                <div />
              </div>

              {loading && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>불러오는 중...</div>}

              {error && (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--danger)', fontSize: 14 }}>
                  ⚠️ Supabase 연결 오류: {error}<br />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>.env.local 파일의 키를 확인해주세요.</span>
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div style={{ padding: 64, textAlign: 'center' }}>
                  <Building2 size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>심의 내역이 없습니다.</div>
                </div>
              )}

              {!loading && !error && filtered.map((r, idx) => {
                const dday = getDday(r.expires_at)
                const rowBg = dday < 0 ? '#fff5f5' : dday <= 30 ? '#fffaf5' : 'var(--surface)'
                return (
                  <div key={r.id} className="fade-in" style={{
                    display: 'grid', gridTemplateColumns: '1fr 150px 105px 105px 180px 82px 80px',
                    padding: '14px 20px', borderBottom: idx < filtered.length - 1 ? '1px solid #f0f2f6' : 'none',
                    alignItems: 'center', background: rowBg, transition: 'background 0.12s'
                  }}>
                    <div>
                      <button onClick={() => { setTab('hospital'); setHospSearch(r.hospital_name) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--accent)', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>
                        {r.hospital_name}
                      </button>
                      {r.memo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.memo}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', background: '#f4f5f9', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>{r.review_number}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{format(parseISO(r.approved_at), 'yy.MM.dd')}</div>
                    <div style={{ fontSize: 13, fontWeight: dday <= 90 ? 700 : 500, color: dday <= 30 ? 'var(--danger)' : dday <= 90 ? 'var(--warn)' : 'var(--text-secondary)' }}>{format(parseISO(r.expires_at), 'yy.MM.dd')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.material_types.map(m => (
                        <span key={m} style={{ fontSize: 11, padding: '2px 8px', background: '#eef0f8', border: '1px solid #d8dbe8', borderRadius: 5, color: 'var(--text-secondary)', fontWeight: 500 }}>{m}</span>
                      ))}
                    </div>
                    <StatusBadge dday={dday} />
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <button onClick={() => openCopy(r)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5, borderRadius: 6 }} title="복사해서 새 심의 만들기"><Copy size={14} /></button>
                      <button onClick={() => openEdit(r)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5, borderRadius: 6 }} title="수정"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteConfirm(r.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5, borderRadius: 6 }} title="삭제"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>

            {!loading && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', fontWeight: 500 }}>
                총 {filtered.length}건{(filter !== 'all' || selectedHospitals.length > 0) ? ` (전체 ${reviews.length}건)` : ''}
              </div>
            )}
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

            {loading && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>불러오는 중...</div>}

            {!loading && hospGroups.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                🏥 검색 결과가 없습니다.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {hospGroups.map(({ name, reviews: hrs }) => {
                const worst = worstStatus(hrs)
                const expiredCnt = hrs.filter(r => getDday(r.expires_at) < 0).length
                const dangerCnt = hrs.filter(r => { const d = getDday(r.expires_at); return d >= 0 && d <= 30 }).length
                const warnCnt = hrs.filter(r => { const d = getDday(r.expires_at); return d > 30 && d <= 90 }).length
                const safeCnt = hrs.filter(r => getDday(r.expires_at) > 90).length
                const borderColor = worst === 'expired' ? 'var(--danger)' : worst === 'danger' ? 'var(--warn)' : worst === 'warning' ? '#b45309' : 'var(--safe)'

                let topBadge: React.ReactNode
                if (expiredCnt > 0) topBadge = <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--danger-light)', color: '#991b1b', border: '1px solid var(--danger-border)' }}>만료 {expiredCnt}건</span>
                else if (dangerCnt > 0) topBadge = <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>D-30 이내 {dangerCnt}건</span>
                else if (warnCnt > 0) topBadge = <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--warn-light)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}>D-90 이내 {warnCnt}건</span>
                else topBadge = <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--safe-light)', color: 'var(--safe)', border: '1px solid var(--safe-border)' }}>정상</span>

                const sorted = [...hrs].sort((a, b) => getDday(a.expires_at) - getDday(b.expires_at))

                return (
                  <div key={name} className="fade-in" style={{
                    background: 'var(--surface)', borderRadius: 16, padding: '20px 22px',
                    border: '1.5px solid var(--border)', borderLeft: `4px solid ${borderColor}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.18s'
                  }}>
                    {/* 카드 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>심의 {hrs.length}건</div>
                      </div>
                      {topBadge}
                    </div>

                    {/* 상태 바 */}
                    <div style={{ display: 'flex', gap: 3, marginBottom: 14, height: 5, borderRadius: 4, overflow: 'hidden' }}>
                      {expiredCnt > 0 && <div style={{ flex: expiredCnt, background: 'var(--danger)' }} title={`만료 ${expiredCnt}건`} />}
                      {dangerCnt > 0 && <div style={{ flex: dangerCnt, background: '#f97316' }} title={`D-30 ${dangerCnt}건`} />}
                      {warnCnt > 0 && <div style={{ flex: warnCnt, background: '#eab308' }} title={`D-90 ${warnCnt}건`} />}
                      {safeCnt > 0 && <div style={{ flex: safeCnt, background: '#22c55e' }} title={`정상 ${safeCnt}건`} />}
                    </div>

                    {/* 심의 목록 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sorted.map(r => {
                        const d = getDday(r.expires_at)
                        const rowBg = d < 0 ? '#fff5f5' : d <= 30 ? '#fff9f5' : 'var(--surface-alt)'
                        const borderC = d < 0 ? 'var(--danger-border)' : d <= 30 ? 'var(--warn-border)' : 'var(--border)'
                        return (
                          <div key={r.id} style={{ background: rowBg, border: `1px solid ${borderC}`, borderRadius: 10, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'white', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4 }}>{r.review_number}</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
                                {r.material_types.map(m => <span key={m} style={{ fontSize: 10, padding: '1px 6px', background: '#eef0f8', border: '1px solid #d8dbe8', borderRadius: 4, color: 'var(--text-secondary)' }}>{m}</span>)}
                              </div>
                              {r.memo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.memo}</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                              <StatusBadge dday={d} />
                              <div style={{ fontSize: 11, color: d <= 30 ? 'var(--danger)' : d <= 90 ? 'var(--warn)' : 'var(--text-muted)', fontWeight: d <= 90 ? 700 : 400 }}>
                                ~{format(parseISO(r.expires_at), 'yy.MM.dd')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* 목록으로 바로가기 */}
                    <button onClick={() => { setTab('list'); setSelectedHospitals([name]) }} style={{
                      marginTop: 12, width: '100%', padding: '7px', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--surface-alt)',
                      fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: 'inherit'
                    }}>
                      전체 목록에서 보기 <ChevronRight size={12} />
                    </button>
                  </div>
                )
              })}
            </div>

            {!loading && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', fontWeight: 500 }}>
                총 {hospGroups.length}개 병원
              </div>
            )}
          </>
        )}
      </main>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="slide-in" style={{ background: 'var(--surface)', borderRadius: 18, width: 468, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800 }}>{editTarget ? '심의 수정' : form.hospital_name && !editTarget ? `${form.hospital_name} — 새 심의 추가` : '심의 추가'}</h2>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: '#f0f2f8', cursor: 'pointer', color: 'var(--text-secondary)', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <Field icon={<Building2 size={14} />} label="병원명 *">
                <input value={form.hospital_name} onChange={e => setForm(f => ({ ...f, hospital_name: e.target.value }))} placeholder="예: 강남연세의원" style={inputStyle} />
              </Field>
              <Field icon={<FileText size={14} />} label="심의번호 *">
                <input value={form.review_number} onChange={e => setForm(f => ({ ...f, review_number: e.target.value }))} placeholder="예: 2024-심의-00123" style={inputStyle} />
              </Field>
              <Field icon={<Calendar size={14} />} label="심의 승인일 * (입력 시 만료일 자동 계산)">
                <input type="date" value={form.approved_at} onChange={e => handleApprovedChange(e.target.value)} style={inputStyle} />
              </Field>
              <Field icon={<Calendar size={14} />} label="만료일 *">
                <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} style={inputStyle} />
              </Field>
              <Field icon={<Tag size={14} />} label="광고 소재 종류">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {MATERIAL_OPTIONS.map(m => (
                    <button key={m} type="button" onClick={() => toggleMaterial(m)} style={{
                      padding: '7px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${form.material_types.includes(m) ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.material_types.includes(m) ? 'var(--accent-light)' : 'transparent',
                      color: form.material_types.includes(m) ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: form.material_types.includes(m) ? 700 : 500
                    }}>{m}</button>
                  ))}
                </div>
              </Field>
              <Field icon={<StickyNote size={14} />} label="메모">
                <textarea value={form.memo || ''} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="추가 메모나 비고 사항" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 16px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', fontWeight: 600 }}>취소</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(29,78,216,0.3)' }}>
                {saving ? '저장 중...' : editTarget ? '수정 완료' : '추가'}
              </button>
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
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>삭제하면 되돌릴 수 없습니다.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>취소</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--danger)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
            </div>
          </div>
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)',
  borderRadius: 9, fontSize: 13, background: 'var(--surface)', outline: 'none',
  color: 'var(--text-primary)'
}
