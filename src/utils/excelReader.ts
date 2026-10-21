import * as path from 'path';
import * as XLSX from 'xlsx';
import type { LoginRow } from './yamlReader';

/**
 * Reads the first (or named) worksheet of an .xlsx file.
 * Row 1 must be the header row, its cell values become object keys.
 */
export async function readExcel<T = Record<string, unknown>>(
    filePath: string,
    sheetName?: string
): Promise<T[]> {
    const workbook = XLSX.readFile(path.resolve(filePath));
    const selectedSheetName = sheetName ?? workbook.SheetNames[0];
    const sheet = selectedSheetName ? workbook.Sheets[selectedSheetName] : undefined;
    if (!sheet) {
        throw new Error(`Sheet ${sheetName ?? '#1'} not found in ${filePath}`);
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
    });
    const headers = (rows[0] ?? []).map((value) => String(value ?? '').trim());
    const data: T[] = [];
    for (const row of rows.slice(1)) {
        const record: Record<string, unknown> = {};
        headers.forEach((header, index) => {
            if (!header) return;
            const value = row[index];
            record[header] = value ?? '';
        });
        data.push(record as T);
    }

    return data;
}

/** Same file, mapped to the shared LoginRow shape. */
export async function readLoginDataFromExcel(filePath: string): Promise<LoginRow[]> {
    const rows = await readExcel<Record<string, unknown>>(filePath, 'LoginData');

    return rows.map((r) => ({
        description: String(r.description ?? ''),
        username: String(r.username ?? ''),
        password: String(r.password ?? ''),
        // Excel gives a real boolean, but a "TRUE"/"true" string is also handled.
        shouldPass: r.shouldPass === true || String(r.shouldPass).toLowerCase() === 'true',
        expectedError: String(r.expectedError ?? ''),
    }));
}