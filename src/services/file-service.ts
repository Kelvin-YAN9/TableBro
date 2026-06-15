import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, resolve, isAbsolute, relative, normalize } from 'path';
import { AppConfig } from '../config/types';
import { logger } from '../utils/logger';

export interface FileEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size?: number;
}

export class FileService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async read(filePath: string): Promise<string> {
    const validatedPath = this.validateAndResolvePath(filePath);

    logger.info('Reading file', { path: validatedPath });

    const stats = await stat(validatedPath);

    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    }

    if (stats.size > this.config.security.fileMaxSize) {
      throw new Error(
        `File too large: ${stats.size} bytes (max: ${this.config.security.fileMaxSize} bytes)`
      );
    }

    return readFile(validatedPath, 'utf-8');
  }

  async write(filePath: string, content: string): Promise<string> {
    const validatedPath = this.validateAndResolvePath(filePath);

    logger.info('Writing file', {
      path: validatedPath,
      contentLength: content.length,
    });

    if (Buffer.byteLength(content, 'utf-8') > this.config.security.fileMaxSize) {
      throw new Error(
        `Content too large: ${Buffer.byteLength(content, 'utf-8')} bytes (max: ${this.config.security.fileMaxSize} bytes)`
      );
    }

    await writeFile(validatedPath, content, 'utf-8');
    return `Successfully wrote ${Buffer.byteLength(content, 'utf-8')} bytes to ${filePath}`;
  }

  async list(dirPath: string): Promise<FileEntry[]> {
    const validatedPath = this.validateAndResolvePath(dirPath);

    logger.info('Listing directory', { path: validatedPath });

    const entries = await readdir(validatedPath, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      const entryType =
        entry.isDirectory()
          ? 'directory'
          : entry.isSymbolicLink()
            ? 'symlink'
            : entry.isFile()
              ? 'file'
              : 'other';

      const entryInfo: FileEntry = {
        name: entry.name,
        type: entryType,
      };

      // 对文件添加大小信息（不读取符号链接）
      if (entry.isFile()) {
        try {
          const stats = await stat(join(validatedPath, entry.name));
          entryInfo.size = stats.size;
        } catch {
          // 忽略 stat 错误
        }
      }

      result.push(entryInfo);
    }

    return result;
  }

  private validateAndResolvePath(requestedPath: string): string {
    // 解析为绝对路径
    const baseDir = '/root/TableBro';
    const absolutePath = isAbsolute(requestedPath)
      ? requestedPath
      : resolve(baseDir, requestedPath);

    // 规范化路径
    const normalized = normalize(absolutePath);

    // 检查是否在允许的路径内
    const isAllowed = this.config.security.fileAllowedPaths.some(
      (allowedPath) => {
        // 确保 allowedPath 也是绝对路径
        const resolvedAllowed = isAbsolute(allowedPath)
          ? allowedPath
          : resolve(baseDir, allowedPath);

        // 检查 normalized 是否在 allowedPath 内
        const rel = relative(resolvedAllowed, normalized);
        // 如果 rel 不以 .. 开头，则在允许范围内
        return !rel.startsWith('..') || rel === '';
      }
    );

    if (!isAllowed) {
      throw new Error(
        `Path not allowed: ${requestedPath}. ` +
        `Allowed paths: ${this.config.security.fileAllowedPaths.join(':')}. ` +
        `Resolved to: ${normalized}`
      );
    }

    return normalized;
  }
}