import { useEffect, useMemo, useRef } from 'react'

import { HeaderEditor } from '../components/HeaderEditor'
import { SheetView } from '../components/SheetView'
import { Toolbar } from '../components/Toolbar'
import { useSheetStore } from '../state/sheetStore'

export function App() {
  const document = useSheetStore((state) => state.document)
  const load = useSheetStore((state) => state.load)
  const save = useSheetStore((state) => state.save)
  const status = useSheetStore((state) => state.status)
  const message = useSheetStore((state) => state.message)
  const hasLoaded = useRef(false)

  useEffect(() => {
    void load().then(() => {
      hasLoaded.current = true
    })
  }, [load])

  useEffect(() => {
    if (!hasLoaded.current) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void save()
    }, 450)

    return () => window.clearTimeout(timeoutId)
  }, [document, save])

  const statusLabel = useMemo(() => {
    if (status === 'saving') {
      return 'Saving'
    }

    if (status === 'error') {
      return message || 'Needs attention'
    }

    return message || 'Ready'
  }, [message, status])

  return (
    <main className="app-shell">
      <Toolbar statusLabel={statusLabel} />
      <section className="workspace" aria-label="Rakuseru sheet workspace">
        <SheetView />
        <HeaderEditor />
      </section>
    </main>
  )
}
