function formatFileSize(sizeInBytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (sizeInBytes === 0) return "0 Byte";
  const a = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
  return (
    parseFloat((sizeInBytes / Math.pow(1024, a)).toFixed(2)) + " " + sizes[a]
  );
}

module.exports = formatFileSize;
