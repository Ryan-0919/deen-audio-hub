import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { extname, join } from "path";

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

        resolve(`${stdout ?? ""}`.trim());
      },
    );
  });

const toPowerShellLiteral = (value) => `'${`${value}`.replace(/'/g, "''")}'`;
const decodePowerShellBase64 = (value) => Buffer.from(`${value ?? ""}`.trim(), "base64").toString("utf8");

export const extractPhonesFromExcel = async ({ fileName, buffer }) => {
  const extension = extname(fileName).toLowerCase();
  if (![".xls", ".xlsx"].includes(extension)) {
    throw new Error("仅支持 xls、xlsx Excel 文件");
  }

  if (!isWindows) {
    throw new Error("当前服务器暂不支持 Excel 解析，请在 Windows 环境下使用");
  }

  const tempPath = join(tmpdir(), `user-import-${randomUUID()}${extension}`);

  try {
    await writeFile(tempPath, buffer);

    const script = `
      $ErrorActionPreference = 'Stop'
      $excel = $null
      $workbook = $null
      try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $workbook = $excel.Workbooks.Open(${toPowerShellLiteral(tempPath)})
        $sheet = $workbook.Worksheets.Item(1)
        $usedRange = $sheet.UsedRange
        $rowCount = $usedRange.Rows.Count
        $phones = New-Object System.Collections.Generic.List[string]

        for ($row = 1; $row -le $rowCount; $row++) {
          $value = $sheet.Cells.Item($row, 1).Text
          if ($null -eq $value) { continue }

          $text = [string]$value
          $text = $text.Trim()
          if ([string]::IsNullOrWhiteSpace($text)) { continue }

          $text = $text -replace '\\s', ''
          $text = $text -replace '\\.0$', ''

          if ($text -eq '手机号') { continue }

          $phones.Add($text)
        }

        $json = $phones | ConvertTo-Json -Compress
        [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
      } finally {
        if ($workbook -ne $null) {
          $workbook.Close($false)
          [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
        }
        if ($excel -ne $null) {
          $excel.Quit()
          [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
        }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
      }
    `;

    const decoded = decodePowerShellBase64(await runPowerShell(script));
    const parsed = JSON.parse(decoded || "[]");
    const phones = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    return [...new Set(phones.map((item) => `${item}`.trim()).filter(Boolean))];
  } catch (error) {
    throw new Error("Excel 解析失败，请确认文件只有一列手机号，且当前服务器已安装 Microsoft Excel");
  } finally {
    await unlink(tempPath).catch(() => null);
  }
};
