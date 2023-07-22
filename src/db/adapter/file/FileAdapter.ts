import {IFileAdapter} from "../IAdapter";
import {readFile, open, FileHandle, mkdir} from "fs/promises";
import {readFileSync, openSync, writeFileSync, closeSync, mkdirSync} from "fs";
import * as path from "path";

export class FileAdapter implements IFileAdapter<string> {
    public readonly filename: string;
    private readonly fsync: boolean;

    constructor(filename: string, fsync: boolean) {
        this.filename = filename;
        this.fsync = fsync;
    }

    read(): string | null {
        try {
            return readFileSync(this.filename, {
                encoding: 'utf-8'
            })
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw e
        }
    }

    write(data: string): void {
        let fd;
        try {
            fd = openSync(this.filename, 'w')
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw e;
            }
            const basepath = path.dirname(this.filename);
            mkdirSync(basepath, {recursive: true});
            fd = openSync(this.filename, 'w');
        }
        try {
            writeFileSync(fd, data, {
                encoding: 'utf-8'
            })
        } finally {
            closeSync(fd);
        }
    }
}