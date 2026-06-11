import { useState, useRef, useEffect, forwardRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { sendEmail, buildEmailHTML, getFileUrl } from '../lib/gas'
import { supabase } from '../lib/supabase'
import { SUGGESTED_EMAILS, AUTO_CC_RULES, formatBytes, getFileIcon } from '../lib/utils'
import { useBranchEmailMap, useBranchOptions } from '../hooks/useBranches'
import Swal from 'sweetalert2'

const TagInput = forwardRef(({ tags, input, setInput, field, placeholder, removeTag, handleKeyDown, onFocus, addTag }, ref) => (
  <div
    ref={ref}
    className="flex flex-wrap gap-1.5 p-2 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[42px] cursor-text bg-white dark:bg-gray-900"
    onClick={() => document.getElementById(`input-${field}`)?.focus()}
  >
    {tags.map(email => (
      <span key={email} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-md text-xs font-medium">
        {email}
        <button onClick={(e) => { e.stopPropagation(); removeTag(email, field); }} className="hover:text-red-500 transition-colors">
          <i className="fas fa-times text-[9px]" />
        </button>
      </span>
    ))}
    <input
      id={`input-${field}`}
      className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-800 dark:text-gray-200"
      placeholder={tags.length ? '' : placeholder}
      value={input}
      onChange={e => setInput(e.target.value)}
      onKeyDown={e => handleKeyDown(e, field)}
      onFocus={onFocus}
      onBlur={() => setTimeout(() => { if (input.trim()) addTag(input, field) }, 150)}
    />
  </div>
))

export default function SendEmail({ draft, onClose, embedded = false }) {

  const { user } = useAuthStore()
  const location = useLocation()
  const branchEmailMap = useBranchEmailMap()
  const branchOptions = useBranchOptions()
  const initDraft = draft ?? location.state?.draft ?? {}
  const defaultMessageBody = "Good day, Ma'am/Sir,\n\nKindly see the attached File/s"
  const [toTags, setToTags] = useState([])
  const [ccTags, setCcTags] = useState([])
  const [toInput, setToInput] = useState('')
  const [ccInput, setCcInput] = useState('')
  const [subject, setSubject] = useState('')
  const [messageBody, setMessageBody] = useState(defaultMessageBody)
  const [note, setNote] = useState('FOR VP/SVP APPROVAL')
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [branchQuery, setBranchQuery] = useState('')
  const [showBranchSugg, setShowBranchSugg] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [driveAttachment, setDriveAttachment] = useState(null)
  const [showSugg, setShowSugg] = useState(null) // 'to' | 'cc' | null
  const [suggQuery, setSuggQuery] = useState('')
  const [sending, setSending] = useState(false)
  const toRef = useRef(); const ccRef = useRef(); const suggRef = useRef(); const branchRef = useRef(); const branchSuggRef = useRef()
  const fileInputRef = useRef()

  const filteredBranches = branchOptions.filter(b =>
    b.label.toLowerCase().includes(branchQuery.toLowerCase())
  ).slice(0, 10)

  // All suggestion emails
  const allEmails = [...new Set([...SUGGESTED_EMAILS, ...Object.values(branchEmailMap).filter(Boolean)])]

  const filteredSugg = allEmails.filter(e =>
    e.toLowerCase().includes(suggQuery.toLowerCase()) &&
    !toTags.includes(e) && !ccTags.includes(e)
  ).slice(0, 8)

  useEffect(() => {
    const fn = (e) => {
      if (suggRef.current && !suggRef.current.contains(e.target) &&
          toRef.current && !toRef.current.contains(e.target) &&
          ccRef.current && !ccRef.current.contains(e.target)) {
        setShowSugg(null)
      }
      if (branchSuggRef.current && !branchSuggRef.current.contains(e.target) &&
          branchRef.current && !branchRef.current.contains(e.target)) {
        setShowBranchSugg(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => {
    const d = initDraft
    if (!d) return

    setToTags(Array.isArray(d.to) ? d.to.filter(Boolean) : [])
    setCcTags(Array.isArray(d.cc) ? d.cc.filter(Boolean) : [])
    setToInput('')
    setCcInput('')
    setSubject(d.subject || '')
    setMessageBody(d.messageBody || defaultMessageBody)
    setNote(d.note || 'FOR VP/SVP APPROVAL')
    setDriveAttachment(null)
    setBranchQuery('')
    setShowBranchSugg(false)

    // Load branch if provided in draft
    if (d.branch_code) {
      const matchedBranch = branchOptions.find(b => b.code === d.branch_code)
      if (matchedBranch) setSelectedBranch(matchedBranch)
    }

    if (d.fileId) {
      getFileUrl(d.fileId)
        .then(file => {
          setDriveAttachment({
            fileId: d.fileId,
            name: file?.name || d.fileName || 'Request Letter Attachment',
            fileName: file?.name || d.fileName || 'Request Letter Attachment',
          })
        })
        .catch(() => {
          setDriveAttachment({
            fileId: d.fileId,
            name: d.fileName || 'Request Letter Attachment',
            fileName: d.fileName || 'Request Letter Attachment',
          })
        })
    }
  }, [draft, branchOptions])

  const addTag = (email, field) => {
    const clean = email.replace(/,/g, '').trim()
    if (!clean) return
    if (field === 'to') {
      if (!toTags.includes(clean)) {
        setToTags(prev => [...prev, clean])
        // Auto-CC rule
        const autoCC = AUTO_CC_RULES[clean.toLowerCase()]
        if (autoCC) {
          setCcTags(prev => {
            const added = autoCC.filter(e => !prev.includes(e))
            if (added.length) {
              Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Auto CC: ${added.join(', ')}`, showConfirmButton: false, timer: 3000 })
            }
            return [...prev, ...added]
          })
        }
      }
      setToInput('')
    } else {
      if (!ccTags.includes(clean)) setCcTags(prev => [...prev, clean])
      setCcInput('')
    }
    setShowSugg(null)
  }

  const removeTag = (email, field) => {
    if (field === 'to') setToTags(prev => prev.filter(e => e !== email))
    else setCcTags(prev => prev.filter(e => e !== email))
  }

  const handleKeyDown = (e, field) => {
    const val = field === 'to' ? toInput : ccInput
    if (['Enter', ',', ' '].includes(e.key) && val.trim()) {
      e.preventDefault(); addTag(val, field)
    }
    if (e.key === 'Backspace' && !val) {
      if (field === 'to') setToTags(p => p.slice(0, -1))
      else setCcTags(p => p.slice(0, -1))
    }
    if (e.key === 'Escape') setShowSugg(null)
  }

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      if (file.size > 20 * 1024 * 1024) { Swal.fire('Too large', `${file.name} exceeds 20MB`, 'warning'); return }
      if (attachments.find(a => a.name === file.name)) return
      const reader = new FileReader()
      reader.onload = (e) => {
        setAttachments(prev => [...prev, { file, name: file.name, size: file.size, mimeType: file.type, base64: e.target.result.split(',')[1] }])
      }
      reader.readAsDataURL(file)
    })
    if (!subject && files[0]) setSubject(files[0].name.replace(/\.[^/.]+$/, ''))
  }

  const handleDrop = (e) => {
    e.preventDefault(); e.currentTarget.classList.remove('border-blue-400')
    handleFiles(e.dataTransfer.files)
  }

  const handleSend = async () => {
    // Commit any un-entered tags
    if (toInput.trim()) addTag(toInput, 'to')
    if (ccInput.trim()) addTag(ccInput, 'cc')
    if (!toTags.length && !toInput.trim()) return Swal.fire('Error', 'Add at least one recipient', 'error')
    if (!subject.trim()) return Swal.fire('Error', 'Enter a subject', 'error')
    if (!attachments.length && !driveAttachment?.fileId) return Swal.fire('Error', 'Attach at least one file', 'error')
    const unread = attachments.filter(a => !a.base64)
    if (unread.length) return Swal.fire('Wait', 'Files still loading, please try again', 'info')

    setSending(true)
    try {
      const to = toTags.join(', ')
      const cc = ccTags.join(', ')
      const emailAttachments = driveAttachment ? [driveAttachment, ...attachments] : attachments
      const htmlBody = buildEmailHTML({ subject, senderName: user?.full_name, senderEmail: user?.email, note, messageBody, attachments: emailAttachments })
      const attData = attachments.map(a => ({ base64: a.base64, mimeType: a.mimeType, fileName: a.name }))

      await sendEmail({
        to,
        cc,
        subject,
        htmlBody,
        senderName: user?.full_name,
        senderEmail: user?.email,
        attachments: attData,
        fileId: driveAttachment?.fileId,
        fileName: driveAttachment?.fileName,
      })

      // Log email
      await supabase.from('email_logs').insert({ sent_by: user?.full_name, to_addresses: to, cc_addresses: cc, subject })

      Swal.fire('Sent!', 'Email sent successfully.', 'success')
      setToTags([]); setCcTags([]); setSubject(''); setMessageBody(defaultMessageBody); setNote('FOR VP/SVP APPROVAL'); setAttachments([]); setDriveAttachment(null); setSelectedBranch(null)
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to send', 'error')
    } finally { setSending(false) }
  }

  const handleClear = () => {
    setToTags([])
    setCcTags([])
    setToInput('')
    setCcInput('')
    setSubject('')
    setMessageBody(defaultMessageBody)
    setNote('FOR VP/SVP APPROVAL')
    setAttachments([])
    setDriveAttachment(null)
    setSelectedBranch(null)
    setBranchQuery('')
    setShowBranchSugg(false)
  }

  const TagInput = ({ tags, input, setInput, field, placeholder, ref: inputRef }) => (
    <div
      ref={inputRef}
      className="flex flex-wrap gap-1.5 p-2 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[42px] cursor-text bg-white dark:bg-gray-900"
      onClick={() => document.getElementById(`input-${field}`)?.focus()}
    >
      {tags.map(email => (
        <span key={email} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-md text-xs font-medium">
          {email}
          <button onClick={() => removeTag(email, field)} className="hover:text-red-500 transition-colors">
            <i className="fas fa-times text-[9px]" />
          </button>
        </span>
      ))}
      <input
        id={`input-${field}`}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-800 dark:text-gray-200"
        placeholder={tags.length ? '' : placeholder}
        value={input}
        onChange={e => { setInput(e.target.value); setSuggQuery(e.target.value); setShowSugg(field) }}
        onKeyDown={e => handleKeyDown(e, field)}
        onFocus={() => { setSuggQuery(input); setShowSugg(field) }}
        onBlur={() => setTimeout(() => { if (input.trim()) addTag(input, field) }, 150)}
      />
    </div>
  )

  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const initial = user?.full_name?.charAt(0).toUpperCase() || 'U'

  return (
    <div className={embedded ? 'bg-white p-5 text-gray-900' : ''}>
      {!embedded && (
      <div className="flex items-end justify-between mb-5 flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Compose</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Send to Email</h1>
          <p className="text-sm font-semibold text-gray-500">Compose and send emails with multiple attachments</p>
        </div>
        <button onClick={handleSend} disabled={sending} className="btn-primary flex items-center gap-2 px-5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
          {sending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</> : <><i className="fas fa-paper-plane" /> Send Email</>}
        </button>
      </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {/* LEFT: Compose */}
        <div>
          <div className="card overflow-hidden">
            {/* Compose header */}
            <div className="bg-gradient-to-r from-[#1e3a5f] to-blue-600 px-6 py-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest bg-white/10 px-2 py-1 rounded mb-2 inline-block"><i className="fas fa-envelope mr-1" />New Message</span>
                <div className="text-white font-semibold text-lg">Compose Email</div>
              </div>
              <div className="text-white/50 text-xs flex items-center gap-1.5"><i className="fas fa-lock" /> Secure</div>
            </div>

            {/* Sender row */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{initial}</div>
              <div>
                <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">{user?.full_name}</div>
                <div className="text-xs text-gray-400">{user?.email}</div>
              </div>
              <span className="ml-auto badge badge-approved text-xs">Sender</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Relative wrapper for suggestion dropdown */}
              <div className="relative">
                <label className="label mb-1">To <span className="text-red-500">*</span></label>
                <TagInput tags={toTags} input={toInput} setInput={setToInput} field="to" placeholder="recipient@asaphil.org" ref={toRef} />
                {showSugg === 'to' && filteredSugg.length > 0 && (
                  <div ref={suggRef} className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                      <i className="fas fa-address-book mr-1 text-blue-500" />Suggested Recipients
                    </div>
                    {filteredSugg.map(email => {
                      const name = email.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                      const isSugg = SUGGESTED_EMAILS.includes(email)
                      const hasCC = !!AUTO_CC_RULES[email.toLowerCase()]
                      const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500']
                      const bg = colors[email.charCodeAt(0) % colors.length]
                      return (
                        <div key={email} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors" onMouseDown={e => { e.preventDefault(); addTag(email, 'to') }}>
                          <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{name.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{name}</div>
                            <div className="text-xs text-gray-400 truncate">{email}</div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            {isSugg && <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">SUGGESTED</span>}
                            {hasCC && <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">AUTO CC</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="label mb-1">CC</label>
                <TagInput tags={ccTags} input={ccInput} setInput={setCcInput} field="cc" placeholder="cc@asaphil.org (optional)" ref={ccRef} />
                {showSugg === 'cc' && filteredSugg.length > 0 && (
                  <div ref={suggRef} className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                      <i className="fas fa-address-book mr-1 text-blue-500" />Suggested
                    </div>
                    {filteredSugg.map(email => (
                      <div key={email} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onMouseDown={e => { e.preventDefault(); addTag(email, 'cc') }}>
                        <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label mb-1">Subject</label>
                <input className="input" placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>

              <div>
                <label className="label mb-1">Message Body</label>
                <textarea
                  className="input min-h-[130px] resize-y leading-relaxed"
                  placeholder="Type the body of your email..."
                  value={messageBody}
                  onChange={e => setMessageBody(e.target.value)}
                />
              </div>

              <div>
                <label className="label mb-1">Note</label>
                <textarea className="input resize-none" rows={2} value={note} onChange={e => setNote(e.target.value)} />
              </div>

              {/* Branch Selection */}
              <div className="relative">
                <label className="label mb-1"><i className="fas fa-code mr-1" />Branch Code</label>
                <div
                  ref={branchRef}
                  className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[42px] cursor-pointer bg-white dark:bg-gray-900"
                  onClick={() => { setBranchQuery(''); setShowBranchSugg(!showBranchSugg) }}
                >
                  {selectedBranch ? (
                    <>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {selectedBranch.code.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">{selectedBranch.code}</div>
                        <div className="text-xs text-gray-400 truncate">{selectedBranch.name}</div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedBranch(null); setBranchQuery('') }}
                        className="w-6 h-6 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center transition-colors flex-shrink-0"
                      >
                        <i className="fas fa-times text-xs" />
                      </button>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-search text-gray-400 ml-2" />
                      <input
                        type="text"
                        placeholder="Search branch code (B0001, B1860...)..."
                        className="flex-1 min-w-[150px] outline-none text-sm bg-transparent text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        value={branchQuery}
                        onChange={e => { setBranchQuery(e.target.value); setShowBranchSugg(true) }}
                        onFocus={() => { setShowBranchSugg(true); setBranchQuery('') }}
                        onClick={e => e.stopPropagation()}
                      />
                    </>
                  )}
                </div>

                {/* Branch Suggestions */}
                {showBranchSugg && filteredBranches.length > 0 && (
                  <div ref={branchSuggRef} className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <i className="fas fa-code mr-1 text-blue-500" />Available Branches
                    </div>
                    {filteredBranches.map(branch => (
                      <div
                        key={branch.code}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={() => { setSelectedBranch(branch); setShowBranchSugg(false); setBranchQuery('') }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {branch.code.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">{branch.code}</div>
                          <div className="text-xs text-gray-400 truncate">{branch.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr className="border-gray-100 dark:border-gray-800" />

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label"><i className="fas fa-paperclip mr-1" />Attachments</label>
                  <span className="badge badge-pending text-xs">{attachments.length + (driveAttachment ? 1 : 0)} file{attachments.length + (driveAttachment ? 1 : 0) !== 1 ? 's' : ''}</span>
                </div>
                <div
                  className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all relative"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400') }}
                  onDragLeave={e => e.currentTarget.classList.remove('border-blue-400')}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.ppt,.pptx,.txt,.zip" onChange={e => handleFiles(e.target.files)} />
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-cloud-upload-alt text-blue-500 text-xl" />
                  </div>
                  <div className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Drop files here or click to browse</div>
                  <div className="text-xs text-gray-400">PDF, Word, Excel, Images, ZIP — max 20MB each</div>
                </div>

                {(driveAttachment || attachments.length > 0) && (
                  <div className="mt-3 space-y-2">
                    {driveAttachment && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700 rounded-xl">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-link text-sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-700 dark:text-gray-300 truncate">{driveAttachment.name}</div>
                          <div className="text-xs text-gray-400">Auto-detected from approved request</div>
                        </div>
                        <button onClick={() => setDriveAttachment(null)} className="w-7 h-7 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center transition-colors">
                          <i className="fas fa-times text-xs" />
                        </button>
                      </div>
                    )}
                    {attachments.map((a, i) => {
                      const fi = getFileIcon(a.name)
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 transition-colors">
                          <div className={`w-9 h-9 rounded-lg ${fi.cls} flex items-center justify-center flex-shrink-0`}>
                            <i className={`fas ${fi.icon} text-sm`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-700 dark:text-gray-300 truncate">{a.name}</div>
                            <div className="text-xs text-gray-400">{formatBytes(a.size)}</div>
                          </div>
                          <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="w-7 h-7 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center transition-colors">
                            <i className="fas fa-times text-xs" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button onClick={handleClear} className="btn-secondary text-sm">
                  <i className="fas fa-times mr-1" />Clear
                </button>
                <button onClick={handleSend} disabled={sending} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                  {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="fas fa-paper-plane" />}
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  )
}
