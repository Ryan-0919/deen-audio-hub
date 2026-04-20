import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { extname, join } from "path";
import iconv from "iconv-lite";
import * as unzipper from "unzipper";

const isWindows = process.platform === "win32";

const runPowerShell = (script) =>
  new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }

        resolve(`${stdout ?? ""}`);
      },
    );
  });

const toPowerShellLiteral = (value) => `'${`${value}`.replace(/'/g, "''")}'`;
const decodePowerShellBase64 = (value) => Buffer.from(`${value ?? ""}`.trim(), "base64").toString("utf8");

const decodeXmlEntities = (value) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)));

const normalizeScriptText = (value) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => (line.trim() ? line.trimEnd() : ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const decodeTextBuffer = (buffer) => {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return normalizeScriptText(iconv.decode(buffer, "utf16-le"));
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return normalizeScriptText(iconv.decode(buffer, "utf16-be"));
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return normalizeScriptText(iconv.decode(buffer, "utf8"));
  }

  const utf8Text = iconv.decode(buffer, "utf8");
  if (!utf8Text.includes("\ufffd")) {
    return normalizeScriptText(utf8Text);
  }

  return normalizeScriptText(iconv.decode(buffer, "gb18030"));
};

const parseWordDocumentXml = (xml) =>
  normalizeScriptText(
    decodeXmlEntities(
      xml
        .replace(/>\s+</g, "><")
        .replace(/<w:p\b[^>]*>/g, "\n")
        .replace(/<w:tab\b[^>]*\/>/g, "\t")
        .replace(/<w:br\b[^>]*\/>/g, "\n")
        .replace(/<w:cr\b[^>]*\/>/g, "\n")
        .replace(/<[^>]+>/g, ""),
    ),
  );

const parseDocxBuffer = async (buffer) => {
  try {
    const archive = await unzipper.Open.buffer(buffer);
    const entry = archive.files.find((item) => {
      const filePath = `${item.path ?? item.props?.path ?? ""}`.replace(/\\/g, "/");
      return filePath === "word/document.xml" || filePath.endsWith("/word/document.xml");
    });

    if (!entry) {
      throw new Error("word/document.xml not found");
    }

    return parseWordDocumentXml((await entry.buffer()).toString("utf8"));
  } catch (error) {
    throw new Error(error instanceof Error ? `docx 文档解析失败：${error.message}` : "docx 文档解析失败");
  }
};

const parseDocFile = async (filePath) => {
  if (!isWindows) {
    throw new Error("当前服务器暂不支持解析 doc，请先转换为 docx、txt 或 md 再上传");
  }

  const script = `
    $ErrorActionPreference = 'Stop'
    $word = $null
    $document = $null
    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $word.DisplayAlerts = 0
      $document = $word.Documents.Open(${toPowerShellLiteral(filePath)}, $false, $true)
      $text = $document.Content.Text
      [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($text))
    } finally {
      if ($document -ne $null) {
        $document.Close([ref]$false)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
      }
      if ($word -ne $null) {
        $word.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
      }
      [GC]::Collect()
      [GC]::WaitForPendingFinalizers()
    }
  `;

  try {
    return normalizeScriptText(decodePowerShellBase64(await runPowerShell(script)));
  } catch (_error) {
    throw new Error("doc 文档解析失败，请确认当前服务器已安装 Microsoft Word；若未安装，请先转换为 docx、txt 或 md");
  }
};

export const extractScriptFromFile = async ({ fileName, buffer }) => {
  const extension = extname(fileName).toLowerCase();

  if ([".txt", ".text", ".md", ".srt", ".lrc"].includes(extension)) {
    return decodeTextBuffer(buffer);
  }

  if (extension === ".docx") {
    return parseDocxBuffer(buffer);
  }

  if (extension !== ".doc") {
    throw new Error("仅支持 txt、md、srt、lrc、doc、docx 文案文件");
  }

  const tempPath = join(tmpdir(), `audio-script-${randomUUID()}${extension}`);

  try {
    await writeFile(tempPath, buffer);
    return await parseDocFile(tempPath);
  } finally {
    await unlink(tempPath).catch(() => null);
  }
};
