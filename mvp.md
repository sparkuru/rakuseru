# 结构化采购清单 Web 工具 MVP

## 背景

目标是做一个比普通 Excel 更适合结构化采购清单维护的工具，支持自定义表头、列类型约束、图片、导入导出、展示输出，以及后续 API 化扩展。

结论：单文件可以用于原型验证，但不适合作为长期实现。正式版本更适合做成纯前端模块化应用，不一定需要后端。

## 命名意象：Rakuseru

项目名定为 **Rakuseru**，来自日语意象 **楽セル**：

- **楽 / raku**：轻松、省事，表达“比普通 Excel 更少折腾”的目标。
- **セル / seru**：单元格，也借用了 Excel 的日语读音 **エクセル / ekuseru** 的尾音。

这个名字不是要做 Excel 的完整替代品，而是做一个更轻、更顺手的结构化清单工具。

| 项目机制 | Rakuseru 的意象 |
|---|---|
| 类 Excel 表格编辑 | `seru` 对应单元格，保留用户熟悉的表格心智 |
| 比普通 Excel 更轻便 | `raku` 表达轻松、省事、少维护负担 |
| 自定义表头 schema | 单元格不再只是自由文本，而是被结构约束的字段 |
| 图片、选项、链接、金额等列类型 | 每个采购项像带属性的结构化条目 |
| JSON 母格式 | 数据先稳定保存，再导出为不同格式 |
| Markdown / XLSX / HTML / CSV 导出 | 从同一份结构化清单生成不同展示和流转版本 |

落选方向：

- `ekuseru`：Excel 的日语罗马音，抓眼但过于贴近 Excel 本体，容易让项目被理解成仿 Excel。
- `zukan`：图鉴意象很贴合“图片 + 属性 + 物品条目”，但弱化了表格和 Excel 的玩梗感。
- `karuseru`：来自“軽 / karui + cell”，更偏轻量，但不如 `rakuseru` 同时表达“省事”和“表格”。

## 单文件可行性

单文件 HTML 可以做到：

- 自定义列
- 单选 / 多选
- 增删行列
- 本地保存
- 导入导出 JSON / CSV / Markdown
- 图片转 base64 嵌入
- 简单 URL 查询，例如 `?row=1&col=2`

但长期问题明显：

- 图片 base64 会让文件迅速膨胀
- 复杂表格交互难维护
- Excel 导入导出会引入较大的库
- UI、数据模型、导入导出、校验逻辑混在一起
- 列宽锁定、冻结行列、虚拟滚动、单元格编辑器会让单文件快速失控

因此，单文件适合做 `prototype.html`，不适合作为正式工具。

## 推荐方向

采用纯前端应用：

```text
前端应用
  -> 表格编辑器 UI
  -> 统一数据模型 JSON
  -> 导入 / 导出适配器
  -> Markdown / Excel / CSV / JSON / HTML
```

除非需要多人协作、权限、云端存储、审计日志、附件集中管理，否则第一版不需要后端。

## 推荐技术栈

- Vite
- React / Svelte
- TypeScript
- Zustand / Jotai / reducer
- IndexedDB
- xlsx 导入导出库
- Markdown / HTML 模板导出

完整技术架构还可以考虑 heyapi、reactquery、tanstack、router、shadcnui、elysia.js

表格组件建议使用成熟方案，不建议从零实现完整表格控件。

## 项目结构草案

```text
purchase-sheet/
  src/
    app/
      App.tsx
      routes.tsx
    components/
      SheetView.tsx
      HeaderEditor.tsx
      CellEditor.tsx
      Toolbar.tsx
      ImportExportDialog.tsx
    model/
      document.ts
      column.ts
      row.ts
      cell.ts
      validation.ts
    adapters/
      importJson.ts
      exportJson.ts
      importXlsx.ts
      exportXlsx.ts
      exportMarkdown.ts
      exportHtml.ts
      exportCsv.ts
    storage/
      indexedDb.ts
      localFile.ts
    api/
      cellQuery.ts
    utils/
      width.ts
      image.ts
  public/
  package.json
```

## 核心数据模型

重点是先定义稳定的数据格式。所有 UI、导入导出、API 查询都围绕这个模型实现。

```ts
type SheetDocument = {
  version: 1
  title: string
  columns: ColumnDef[]
  rows: RowData[]
}

type ColumnDef = {
  id: string
  title: string
  type: 'text' | 'number' | 'money' | 'singleSelect' | 'multiSelect' | 'image' | 'link'
  width?: number
  lockedWidth?: boolean
  wrap?: boolean
  options?: string[]
  required?: boolean
}

type RowData = {
  id: string
  height?: number
  lockedHeight?: boolean
  cells: Record<string, CellValue>
}

type CellValue =
  | string
  | number
  | string[]
  | {
      kind: 'image'
      name: string
      mime: string
      dataUrl: string
    }
```

## 表头编辑

表头不是单纯的文字，而是列 schema。

示例：

```text
列名：采购状态
类型：单选
选项：选项A / 选项B / 选项C
是否必填：是
是否换行：是
是否锁定宽度：否
```

不同列类型对应不同编辑器：

```text
text          普通输入框
number        数字输入框
money         金额输入框
singleSelect  下拉单选
multiSelect   多选标签
image         图片上传 / 粘贴
link          URL 输入
```

## 导入导出策略

JSON 应作为母格式。

```text
JSON：完整保真，推荐用于再次导入
XLSX：给人编辑和流转
Markdown：给文档展示
HTML：给浏览器展示
CSV：只支持基础文本，不能完整保留图片和列配置
```

推荐流程：

```text
JSON <-> 应用内部模型
XLSX -> 应用内部模型 -> XLSX
应用内部模型 -> Markdown
应用内部模型 -> HTML
```

不要把 Markdown 当作主数据源。Markdown 适合展示，不适合承载列类型、选项、图片、锁定宽度等结构信息。

## API 化访问

纯前端也可以支持简单的 URL 查询：

```text
?row=1&col=2
?rowId=abc&col=price
#/cell/abc/price
```

内部实现：

```ts
getCellValue(document, { rowIndex: 1, columnIndex: 2 })
getCellValue(document, { rowId: 'abc', columnId: 'price' })
```

如果以后增加后端，可以自然演进为：

```http
GET /api/sheets/:sheetId/rows/:rowId/cells/:columnId
```

## MVP 范围

第一版不做后端，做纯前端：

- 表格编辑
- 表头 schema 编辑
- 行列增删
- 单选 / 多选列
- 图片粘贴 / 上传
- IndexedDB 自动保存
- JSON 导入导出
- Markdown / XLSX 导出

第二版再加：

- 多文件管理
- HTML 预览
- URL 查询某个单元格
- 校验规则
- 批量处理列内容

第三版如果需要多人协作，再补后端。

## 其他需求

### 前端

1.   导出预览模式（markdown 表格、excel 表格）
2.   可以为行、列，甚至单独块着色

## 总结

单文件可以验证想法。正式实现建议采用纯前端模块化架构。核心不是先做复杂 UI，而是先把“表格内容”和“列结构”设计成稳定 JSON，然后所有展示、导入、导出、API 都围绕这个模型展开。
