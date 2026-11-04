import * as XLSX from 'xlsx'
import type { RawRow } from '@/domain/rows'

// This module pulls in all of SheetJS, so load it with import() when it's needed.

export interface ParsedSheet {
  name: string
  headers: string[]
  rows: RawRow[]
}

function readWorkbook(workbook: XLSX.WorkBook): ParsedSheet[] {
  return workbook.SheetNames.flatMap((name) => {
    const sheet = workbook.Sheets[name]
    if (!sheet) return []
    const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: true,
    })
    const [headerRow, ...dataRows] = grid
    if (!headerRow) return []

    const headers = headerRow.map((cell) => String(cell).trim())
    const rows = dataRows.map((cells) => {
      const row: RawRow = {}
      headers.forEach((header, i) => {
        if (header) row[header] = cells[i] ?? ''
      })
      return row
    })
    return [{ name, headers: headers.filter(Boolean), rows }]
  })
}

export function parseXlsx(data: ArrayBuffer): ParsedSheet[] {
  return readWorkbook(XLSX.read(data, { type: 'array' }))
}

export function parseCsv(text: string, name = 'CSV'): ParsedSheet[] {
  // raw keeps "1/2" and "007" as typed instead of turning them into dates and numbers.
  const parsed = readWorkbook(XLSX.read(text, { type: 'string', raw: true }))
  return parsed.map((sheet) => ({ ...sheet, name }))
}

/** Decodes as UTF-8 and removes the byte order mark that Excel adds. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet[]> {
  const data = await file.arrayBuffer()
  return /\.(csv|tsv|txt)$/i.test(file.name)
    ? parseCsv(new TextDecoder('utf-8').decode(data), file.name)
    : parseXlsx(data)
}

/** A row of cells for each entry, in the deck's column order. */
export interface SheetData {
  name: string
  columns: string[]
  rows: RawRow[]
}

function toWorksheet({ columns, rows }: SheetData): XLSX.WorkSheet {
  // Strings stay text cells, so a value like "@click" can never run as a formula in XLSX.
  return XLSX.utils.aoa_to_sheet([columns, ...rows.map((row) => columns.map((c) => row[c] ?? ''))])
}

/** Excel limits sheet names to 31 characters and forbids some symbols. */
const safeSheetName = (name: string) =>
  name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet'

export function writeXlsx(sheets: SheetData[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, toWorksheet(sheet), safeSheetName(sheet.name))
  }
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

export function writeCsv(sheet: SheetData): string {
  // The byte order mark tells Excel the file is UTF-8, so "→" and accents display correctly.
  return `﻿${XLSX.utils.sheet_to_csv(toWorksheet(sheet), { blankrows: false })}`
}
