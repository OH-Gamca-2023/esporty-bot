import * as path from "path";
import {IAdapter} from "../adapter/IAdapter";
import {JsonAdapter} from "../adapter/data/JsonAdapter";
import {FileAdapter} from "../adapter/file/FileAdapter";

export interface JsonDBConfig {
    readonly adapter: IAdapter<any>,
    readonly saveOnPush: boolean,
    readonly separator: string,
}

export class Config implements JsonDBConfig {
    adapter: IAdapter<any>;
    public readonly filename: string
    saveOnPush: boolean
    separator: string

    constructor(filename: string, saveOnPush = true, humanReadable = false, separator = '/', syncOnSave = false) {
        this.filename = filename

        // Force json if no extension
        if (path.extname(filename) === "") {
            this.filename += ".json"
        }

        this.saveOnPush = saveOnPush
        this.separator = separator
        this.adapter = new JsonAdapter(new FileAdapter(this.filename, syncOnSave), humanReadable);
    }
}

export class ConfigWithAdapter implements JsonDBConfig {
    readonly adapter: IAdapter<any>;
    readonly saveOnPush: boolean;
    readonly separator: string;


    constructor(adapter: IAdapter<any>, saveOnPush = true, separator = '/') {
        this.adapter = adapter;
        this.saveOnPush = saveOnPush;
        this.separator = separator;
    }
}