import { X } from 'lucide-react'

import { BACKGROUND_COLOR_PRESETS } from '../model/color'

type BackgroundColorControlProps = {
  color?: string
  label: string
  onChange: (color: string | undefined) => void
}

export function BackgroundColorControl({ color, label, onChange }: BackgroundColorControlProps) {
  return (
    <section className="color-control" aria-label={`${label}背景色`}>
      <span className="field-label">背景色</span>
      <div className="color-preset-list" aria-label="常用背景色">
        {BACKGROUND_COLOR_PRESETS.map((preset) => (
          <button key={preset} type="button" className={preset === color ? 'color-swatch selected' : 'color-swatch'} style={{ backgroundColor: preset }} onClick={() => onChange(preset)} aria-label={`使用 ${preset} 背景色`} title={preset} />
        ))}
      </div>
      <div className="color-control-actions">
        <label className="color-input-label">
          <span>自定义</span>
          <input type="color" value={color ?? '#FFFFFF'} onChange={(event) => onChange(event.target.value)} aria-label={`${label}自定义背景色`} />
        </label>
        <button type="button" className="text-button" onClick={() => onChange(undefined)} disabled={!color}>
          <X size={14} />
          清除
        </button>
      </div>
    </section>
  )
}
