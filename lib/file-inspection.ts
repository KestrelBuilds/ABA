import yauzl from "yauzl";
import { MAX_UPLOAD_BYTES, uploadMime } from "./upload-policy";
export async function inspectFile(bytes: Buffer, name: string) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES)
    throw Error("Files must be between 1 byte and 25 MB.");
  const mime = uploadMime(name);
  const ascii = bytes.subarray(0, 16).toString("ascii");
  const valid =
    mime === "application/pdf"
      ? ascii.startsWith("%PDF-")
      : mime === "application/postscript"
        ? ascii.startsWith("%PDF-") || ascii.startsWith("%!PS-Adobe")
        : mime === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : mime === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : mime === "image/webp"
              ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
              : mime === "application/zip"
                ? bytes.length >= 4 &&
                  (bytes.readUInt32LE(0) === 0x04034b50 ||
                    bytes.readUInt32LE(0) === 0x06054b50)
                : false;
  if (!valid) throw Error("The file contents do not match its file type.");
  if (mime === "application/zip") await inspectZip(bytes);
  return mime;
}
function inspectZip(bytes: Buffer) {
  return new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(
      bytes,
      { lazyEntries: true, validateEntrySizes: true, autoClose: true },
      (error, zip) => {
        if (error || !zip)
          return reject(Error("This ZIP could not be checked."));
        let count = 0,
          total = 0,
          done = false;
        const fail = (message: string) => {
          if (done) return;
          done = true;
          zip.close();
          reject(Error(message));
        };
        zip.on("error", () => fail("This ZIP is damaged or unsupported."));
        zip.on("end", () => {
          if (!done) {
            done = true;
            resolve();
          }
        });
        zip.on("entry", (entry: yauzl.Entry) => {
          count++;
          total += entry.uncompressedSize;
          const path = entry.fileName;
          const ext = path.split(".").pop()?.toLowerCase() ?? "";
          if (
            count > 2000 ||
            total > 250 * 1024 * 1024 ||
            entry.uncompressedSize > 50 * 1024 * 1024 ||
            (entry.uncompressedSize > 1024 * 1024 &&
              entry.uncompressedSize / Math.max(entry.compressedSize, 1) > 200)
          )
            return fail("This ZIP expands beyond the allowed limits.");
          if (
            entry.generalPurposeBitFlag & 1 ||
            [0, 8].includes(entry.compressionMethod) === false
          )
            return fail(
              "Encrypted or unsupported ZIP files cannot be checked.",
            );
          if (
            path.includes("\\") ||
            path.includes("\0") ||
            path.startsWith("/") ||
            /^[a-z]:/i.test(path) ||
            path.split("/").includes("..")
          )
            return fail("This ZIP contains unsafe paths.");
          if (
            [
              "zip",
              "7z",
              "rar",
              "tar",
              "gz",
              "xz",
              "bz2",
              "exe",
              "msi",
              "dll",
              "com",
              "scr",
              "bat",
              "cmd",
              "ps1",
              "vbs",
              "js",
              "jar",
              "sh",
              "docm",
              "xlsm",
              "pptm",
            ].includes(ext)
          )
            return fail(
              "Nested archives, executables and scripts are not accepted in source ZIPs.",
            );
          const unixType = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (unixType && ![0o100000, 0o040000].includes(unixType))
            return fail("ZIP links and special files are not accepted.");
          if (path.endsWith("/")) return zip.readEntry();
          zip.openReadStream(entry, (readError, stream) => {
            if (readError || !stream)
              return fail("A ZIP entry could not be checked.");
            let expanded = 0,
              header = Buffer.alloc(0);
            stream.on("data", (part: Buffer) => {
              expanded += part.length;
              if (header.length < 8) {
                header = Buffer.concat([
                  header,
                  part.subarray(0, 8 - header.length),
                ]);
                const hex = header.toString("hex");
                if (
                  [
                    "504b0304",
                    "504b0506",
                    "377abcaf271c",
                    "52617221",
                    "1f8b",
                    "4d5a",
                    "7f454c46",
                    "cafebabe",
                    "feedface",
                    "cefaedfe",
                    "feedfacf",
                    "cffaedfe",
                  ].some((prefix) => hex.startsWith(prefix))
                ) {
                  stream.destroy();
                  return fail(
                    "Disguised archives and executables are not accepted in source ZIPs.",
                  );
                }
              }
              if (
                expanded > entry.uncompressedSize ||
                expanded > 50 * 1024 * 1024
              ) {
                stream.destroy();
                fail("A ZIP entry expands beyond its declared size.");
              }
            });
            stream.on("error", () => fail("A ZIP entry is damaged."));
            stream.on("end", () => {
              if (!done) {
                if (expanded !== entry.uncompressedSize)
                  return fail("A ZIP entry has an invalid size.");
                zip.readEntry();
              }
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
