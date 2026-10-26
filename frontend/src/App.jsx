import { useEffect, useState } from 'react'

import BoardDecor from './components/BoardDecor.jsx'
import ChalkTray from './components/ChalkTray.jsx'
import Header from './components/Header.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import AccountMenu from './components/AccountMenu.jsx'
import ProgressView from './components/ProgressView.jsx'
import AccountSettings from './components/AccountSettings.jsx'
import Tabs from './components/Tabs.jsx'
import PipelineStatus from './components/PipelineStatus.jsx'
import PdfUpload from './components/PdfUpload.jsx'
import TranscriptInput from './components/TranscriptInput.jsx'
import TranscriptCard from './components/TranscriptCard.jsx'
import CoachingNote from './components/CoachingNote.jsx'
import RubricScores from './components/RubricScores.jsx'
import StatCards from './components/StatCards.jsx'
import BlockedBanner from './components/BlockedBanner.jsx'
import OverallScore from './components/OverallScore.jsx'
import ScoreSummary from './components/ScoreSummary.jsx'
import GrowthPanel from './components/GrowthPanel.jsx'
import DigestPanel from './components/DigestPanel.jsx'
import SideRail from './components/SideRail.jsx'
import UsagePanel from './components/UsagePanel.jsx'
import MathFlags from './components/MathFlags.jsx'

import { SAMPLE_TRANSCRIPT } from './mockData.js'
import { requestCoaching, fetchMe, fetchGrowth, logout, getToken, clearToken } from './api.js'

const BASE_TABS = [
  { key: 'pdf', label: 'Upload PDF' },
  { key: 'type', label: 'Type it out' }
]

// Showing every tutor's scores to every account would undo the point of having
// accounts, so the digest is a coordinator view.
const DIGEST_TAB = { key: 'digest', label: 'Coordinator digest' }

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  const [tab, setTab] = useState('pdf')
  const [panel, setPanel] = useState(null) // null | progress | settings
  const [transcript, setTranscript] = useState('')
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Stages the server has reported finishing, during a run in progress.
  const [liveStages, setLiveStages] = useState([])

  // The standing record shown in the right-hand rail.
  const [growth, setGrowth] = useState(null)
  const [growthLoading, setGrowthLoading] = useState(false)

  // A token kept from last time is only good if the server still honours it.
  useEffect(() => {
    if (!getToken()) {
      setChecking(false)
      return
    }

    fetchMe()
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (!user) {
      setGrowth(null)
      return
    }

    let cancelled = false
    setGrowthLoading(true)

    fetchGrowth()
      .then((data) => { if (!cancelled) setGrowth(data) })
      .catch(() => { /* the rail is not worth an error message of its own */ })
      .finally(() => { if (!cancelled) setGrowthLoading(false) })

    return () => { cancelled = true }
  }, [user, session])

  async function handleSubmit() {
    setBusy(true)
    setError('')
    setSession(null)
    setLiveStages([])

    try {
      setSession(await requestCoaching(transcript, {
        onStage: (stage) => setLiveStages((done) => [...done, stage])
      }))
    } catch (problem) {
      // The session expired underneath them: send them back to the gate
      // rather than showing a confusing error.
      if (problem.status === 401) {
        clearToken()
        setUser(null)
      }
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  function handleTabChange(next) {
    if (next === tab) return
    setTab(next)
    setPanel(null)
    setTranscript('')
    setSession(null)
    setError('')
    setLiveStages([])
  }

  async function handleLogOut() {
    try {
      await logout()
    } finally {
      clearToken()
      setUser(null)
      setSession(null)
      setTranscript('')
      setPanel(null)
      setTab('pdf')
    }
  }

  const tabs = user?.role === 'coordinator' ? [...BASE_TABS, DIGEST_TAB] : BASE_TABS

  return (
    <div className="page">
      <BoardDecor />

      {user && (
        <AccountMenu
          user={user}
          onViewProgress={() => setPanel('progress')}
          onAccountSettings={() => setPanel('settings')}
          onLogOut={handleLogOut}
        />
      )}

      <div className={`board-main ${user ? 'with-rail' : ''} ${panel ? 'panel-open' : ''}`}>
        <div className="board-content">
          <Header />

        {checking && <section className="card"><p>Checking your session…</p></section>}

        {!checking && !user && <LoginScreen onSignedIn={setUser} />}

        {!checking && user && panel === 'progress' && (
          <ProgressView onClose={() => setPanel(null)} />
        )}

        {!checking && user && panel === 'settings' && (
          <AccountSettings user={user} onUpdated={setUser} onClose={() => setPanel(null)} />
        )}

        {!checking && user && !panel && (
          <>
            <Tabs tabs={tabs} active={tab} onChange={handleTabChange} />

            {tab !== 'digest' && (
              <PipelineStatus
                completed={session?.stagesCompleted || liveStages}
                busy={busy}
              />
            )}

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === 'digest' ? (
                <DigestPanel />
              ) : tab === 'pdf' ? (
                <>
                  <PdfUpload onExtracted={setTranscript} disabled={busy} />
                  {transcript && (
                    <TranscriptInput
                      value={transcript}
                      onChange={setTranscript}
                      onSubmit={handleSubmit}
                      busy={busy}
                      label="Text from your PDF — fix anything that came out wrong"
                      submitLabel="Looks right, get feedback"
                    />
                  )}
                </>
              ) : (
                <TranscriptInput
                  value={transcript}
                  onChange={setTranscript}
                  onSubmit={handleSubmit}
                  onLoadExample={() => setTranscript(SAMPLE_TRANSCRIPT)}
                  busy={busy}
                />
              )}
            </div>

            {tab !== 'digest' && error && <section className="card error">{error}</section>}

            {session?.blocked && (
              <>
                <BlockedBanner blockedReason={session.blockedReason} />
                <TranscriptCard turns={session.transcript} />
              </>
            )}

            {session && !session.blocked && (
              <>
                <ScoreSummary scores={session.scores} overall={session.overall} />
                <CoachingNote coaching={session.coaching} />
                <RubricScores scores={session.scores} />
                <MathFlags maths={session.maths} />
                <TranscriptCard turns={session.transcript} />
              </>
            )}
            </>
          )}
        </div>

        {/* My progress and Account settings are whole views of their own, and
            the rail only repeats what they already show, so they get the full
            width of the board. */}
        {user && !panel && (
          <aside className="side-col">
            <SideRail growth={growth} loading={growthLoading} />

            {/* The figures and the record sit beside the feedback rather than
                below it, so a run fits on far less scrolling. */}
            {session && !session.blocked && (
              <>
                <OverallScore overall={session.overall} />
                <GrowthPanel growth={session.growth} />
                <StatCards stats={session.stats} />
                <UsagePanel usage={session.usage} />
              </>
            )}

            {session?.blocked && (
              <>
                <StatCards stats={session.stats} />
                <UsagePanel usage={session.usage} />
              </>
            )}
          </aside>
        )}
      </div>

      <ChalkTray />
    </div>
  )
}
