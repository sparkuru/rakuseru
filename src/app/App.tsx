import { useEffect, useMemo, useRef } from 'react'

import { EditorSidePanel } from '../components/EditorSidePanel'
import { SheetView } from '../components/SheetView'
import { Toolbar } from '../components/Toolbar'
import { validateDocumentContent } from '../model/contentValidation'
import { useSheetStore } from '../state/sheetStore'

export function App() {
  const document = useSheetStore((state) => state.document)
  const load = useSheetStore((state) => state.load)
  const save = useSheetStore((state) => state.save)
  const sidePanelCollapsed = useSheetStore((state) => state.sidePanelCollapsed)
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

  const validationIssues = useMemo(() => validateDocumentContent(document), [document])

  return (
    <main className="app-shell">
      <Toolbar validationIssues={validationIssues} />
      <section className={sidePanelCollapsed ? 'workspace side-panel-collapsed' : 'workspace'} aria-label="Rakuseru sheet workspace">
        <SheetView validationIssues={validationIssues} />
        <EditorSidePanel />
      </section>
    </main>
  )
}
