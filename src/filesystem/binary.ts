import fs from "fs";

export function isBinaryFile(filePath: string): boolean {
	try {
		const stat = fs.statSync(filePath);
		if (!stat.isFile()) return false;

		const fd = fs.openSync(filePath, "r");
		const buffer = Buffer.alloc(1024);
		const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
		fs.closeSync(fd);

		for (let i = 0; i < bytesRead; i++) {
			if (buffer[i] === 0) return true;
		}
		return false;
	} catch {
		return false;
	}
}

export function isBinaryBuffer(buffer: Buffer): boolean {
	return buffer.subarray(0, 1024).includes(0);
}
