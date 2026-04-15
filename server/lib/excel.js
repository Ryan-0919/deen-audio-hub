import XLSX from "xlsx";
import { extname } from "path";

const SUPPORTED_EXTENSIONS = new Set([".xls", ".xlsx"]);
const HEADER_CANDIDATES = new Set(["手机号", "手机号码", "phone", "mobile", "tel"]);

const normalizePhoneCell = (value) => {
  const text = `${value ?? ""}`
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.0$/, "");

  if (!text) {
    return "";
  }

  if (HEADER_CANDIDATES.has(text.toLowerCase()) || HEADER_CANDIDATES.has(text)) {
    return "";
  }

  if (!/\d{6,}/.test(text)) {
    return "";
  }

  return text;
};

export const extractPhonesFromExcel = async ({ fileName, buffer }) => {
  const extension = extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("仅支持 xls、xlsx Excel 文件");
  }

  try {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      cellNF: false,
      cellText: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return [];
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    const phones = rows
      .map((row) => (Array.isArray(row) ? row[0] : ""))
      .map(normalizePhoneCell)
      .filter(Boolean);

    return [...new Set(phones)];
  } catch (error) {
    throw new Error("Excel 解析失败，请确认文件只有一列手机号");
  }
};
